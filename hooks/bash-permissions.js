#!/usr/bin/env node
// PreToolUse hook for Bash — classifies commands as safe or needing approval.
// Splits compound commands on && || ; and checks each segment.
// Returns permissionDecision: "allow" | "ask"

const SAFE_READ_COMMANDS = [
  // Filesystem read-only
  "ls", "cat", "head", "tail", "find", "tree", "du", "df", "wc",
  "file", "which", "type", "readlink", "realpath", "stat", "test",
  // Shell builtins / safe
  "echo", "printf", "pwd", "true", "false", "set", "export",
  "cd", "pushd", "popd", "source", ".",
  // Text processing (read-only)
  "grep", "rg", "awk", "sort", "uniq", "cut", "tr", "tee",
  "diff", "comm", "paste", "column", "fmt", "fold", "rev",
  "jq", "yq", "xargs",
  // System info
  "uname", "whoami", "hostname", "date", "env", "printenv",
  "nproc", "free", "uptime", "id",
  // Node/npm/npx
  "node -e", "node -p", "npm ls", "npm list", "npm view", "npm info",
  "npx which", "npx tsc", "npx eslint", "npx prettier", "npx vitest",
  "npx jest", "npx tsx", "npx ts-node",
];

// Commands that are safe but need prefix matching (not just first word)
const SAFE_PREFIXES = [
  "sed -n",        // read-only sed
  "sed -e",        // expression sed (read-only when no -i)
  "[[ ",           // bash conditional
  "[ ",            // test
];

// Git commands split into safe read-only and safe non-destructive writes
const GIT_SAFE_READ = [
  "status", "diff", "log", "show", "blame", "rev-parse", "symbolic-ref",
  "remote", "ls-files", "shortlog", "tag -l", "tag --list", "config --get",
  "config --list", "check-ignore", "rev-list", "name-rev", "describe",
  "for-each-ref", "cat-file", "ls-tree", "verify-commit", "branch -a",
  "branch -r", "branch --list", "branch -l", "branch -v",
];

const GIT_SAFE_WRITE = [
  "add", "commit", "stash", "worktree add", "worktree list",
  "branch -m",
];

// These git commands are only auto-approved inside a worktree directory
const GIT_WORKTREE_ONLY = [
  "worktree remove", "worktree prune", "merge", "branch -d",
];

// Always denied — these need human approval
const GIT_DANGEROUS = [
  "push", "pull", "fetch", "reset", "revert", "rebase", "clean",
  "checkout -- ", "checkout .", "restore",
  "branch -D",
];

const DANGEROUS_PATTERNS = [
  /--force/,
  /--hard/,
  /-rf\s/,
  /\brm\b/,
  /\brmdir\b/,
  /\bdel\b/,
  /> \/dev\/null/,  // allow redirects TO /dev/null (safe)
];

const SAFE_WRITE_COMMANDS = [
  "mkdir", "touch", "cp", "mv",
];

// gh CLI subcommands that are destructive or affect shared state
const GH_DANGEROUS_PATTERNS = [
  /^gh\s+pr\s+merge/,
  /^gh\s+pr\s+close/,
  /^gh\s+pr\s+ready/,
  /^gh\s+issue\s+close/,
  /^gh\s+issue\s+delete/,
  /^gh\s+repo\s+delete/,
  /^gh\s+repo\s+archive/,
  /^gh\s+release\s+(create|delete|edit)/,
  /^gh\s+api\s+-X\s+(DELETE|PUT|PATCH|POST)/,
  /^gh\s+api\s+--method\s+(DELETE|PUT|PATCH|POST)/,
];

// gh read commands and safe operations
function isGhCommand(cmd) {
  if (!cmd.startsWith("gh ")) return false;
  for (const p of GH_DANGEROUS_PATTERNS) {
    if (p.test(cmd)) return "ask";
  }
  return "allow";
}

// Strip git global options that appear before the subcommand
// e.g., git -C /path log → log, git --no-pager diff → diff
function stripGitGlobalFlags(gitArgs) {
  let args = gitArgs;
  // Flags that consume the next argument: -C <path>, -c <key=value>, --git-dir <path>, --work-tree <path>
  args = args.replace(/^(-C\s+"[^"]*"|-C\s+'[^']*'|-C\s+\S+)\s*/g, "");
  args = args.replace(/^(-c\s+"[^"]*"|-c\s+'[^']*'|-c\s+\S+)\s*/g, "");
  args = args.replace(/^(--git-dir[= ]\S+)\s*/g, "");
  args = args.replace(/^(--work-tree[= ]\S+)\s*/g, "");
  // Standalone flags: --no-pager, --bare, --no-replace-objects, --literal-pathspecs
  args = args.replace(/^(--no-pager|--bare|--no-replace-objects|--literal-pathspecs|--no-optional-locks)\s*/g, "");
  // Recurse in case multiple global flags are chained
  if (args !== gitArgs) return stripGitGlobalFlags(args);
  return args;
}

function isGitCommand(cmd, { inWorktree = false } = {}) {
  if (!cmd.startsWith("git ")) return false;
  const gitCmd = stripGitGlobalFlags(cmd.slice(4).trim());

  // Check dangerous first (takes priority)
  for (const d of GIT_DANGEROUS) {
    if (gitCmd.startsWith(d)) return "ask";
  }

  // Check dangerous patterns
  for (const p of DANGEROUS_PATTERNS) {
    if (p.test(cmd)) return "ask";
  }

  // Check safe read
  for (const r of GIT_SAFE_READ) {
    if (gitCmd.startsWith(r)) return "allow";
  }

  // Check safe write (always allowed)
  for (const w of GIT_SAFE_WRITE) {
    if (gitCmd.startsWith(w)) return "allow";
  }

  // Worktree-only commands — only auto-approve inside a worktree dir
  for (const w of GIT_WORKTREE_ONLY) {
    if (gitCmd.startsWith(w)) return inWorktree ? "allow" : "ask";
  }

  // Bare "git branch <name>" (create branch) — safe
  if (/^branch\s+[^-]/.test(gitCmd)) return "allow";

  // Unknown git subcommand — ask
  return "ask";
}

function isSedSafe(cmd) {
  // sed is safe if it does NOT have -i (in-place) flag
  // sed -n, sed -e without -i are read-only
  return /^sed\s/.test(cmd) && !/-i/.test(cmd);
}

function classifySegment(raw, { inWorktree = false } = {}) {
  const cmd = raw.trim();
  if (!cmd || cmd === "true" || cmd === "false") return "allow";

  // Strip leading environment variable assignments: FOO=bar cmd ...
  const withoutEnv = cmd.replace(/^(\w+=\S+\s+)+/, "");

  // gh CLI
  if (withoutEnv.startsWith("gh ")) return isGhCommand(withoutEnv);

  // git
  if (withoutEnv.startsWith("git ")) return isGitCommand(withoutEnv, { inWorktree });

  // sed special handling
  if (withoutEnv.startsWith("sed ")) return isSedSafe(withoutEnv) ? "allow" : "ask";

  // Safe prefixes
  for (const p of SAFE_PREFIXES) {
    if (withoutEnv.startsWith(p)) return "allow";
  }

  // Safe read commands (match first word)
  const firstWord = withoutEnv.split(/\s/)[0];
  if (SAFE_READ_COMMANDS.includes(firstWord)) return "allow";

  // Safe write commands
  if (SAFE_WRITE_COMMANDS.includes(firstWord)) {
    // Check for dangerous patterns even in "safe" commands
    for (const p of DANGEROUS_PATTERNS) {
      if (p.test(cmd)) return "ask";
    }
    return "allow";
  }

  // Multi-word safe read commands (e.g., "node -e", "npm ls")
  const firstTwo = withoutEnv.split(/\s/).slice(0, 2).join(" ");
  if (SAFE_READ_COMMANDS.includes(firstTwo)) return "allow";

  // Unknown command — ask
  return "ask";
}

// Detect if a cd target points into a worktree directory
function detectWorktreeFromCd(segments) {
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (trimmed.startsWith("cd ")) {
      const target = trimmed.slice(3).trim().replace(/^["']|["']$/g, "");
      if (/[/\\]\.worktrees?[/\\]/.test(target) || /^\.worktrees?[/\\]/.test(target)) {
        return true;
      }
    }
  }
  return false;
}

function classifyCommand(command, { cwdInWorktree = false } = {}) {
  // Split compound commands on && || ; while respecting quotes
  const segments = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (ch === "&" && command[i + 1] === "&") {
        segments.push(current);
        current = "";
        i++; // skip second &
        continue;
      }
      if (ch === "|" && command[i + 1] === "|") {
        segments.push(current);
        current = "";
        i++; // skip second |
        continue;
      }
      if (ch === ";") {
        segments.push(current);
        current = "";
        continue;
      }
    }

    current += ch;
  }
  if (current.trim()) segments.push(current);

  // Detect if any cd segment targets a worktree directory, or CWD is already in one
  const inWorktree = cwdInWorktree || detectWorktreeFromCd(segments);

  // Classify each segment — if ANY is "ask", the whole command is "ask"
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    // Handle pipes within a segment
    const pipeParts = [];
    let pipeCurrent = "";
    let pInSingle = false;
    let pInDouble = false;

    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === "'" && !pInDouble) { pInSingle = !pInSingle; }
      if (ch === '"' && !pInSingle) { pInDouble = !pInDouble; }
      if (ch === "|" && trimmed[i + 1] !== "|" && !pInSingle && !pInDouble) {
        pipeParts.push(pipeCurrent);
        pipeCurrent = "";
        continue;
      }
      pipeCurrent += ch;
    }
    pipeParts.push(pipeCurrent);

    // Check each pipe segment
    for (const pipePart of pipeParts) {
      const result = classifySegment(pipePart, { inWorktree });
      if (result === "ask") {
        return { decision: "ask", segment: pipePart.trim() };
      }
    }
  }

  return { decision: "allow" };
}

function main() {
  let input = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    try {
      const data = JSON.parse(input);
      const command = data.tool_input?.command || "";

      // Check if CWD is inside a worktree directory
      const cwd = process.cwd();
      const cwdInWorktree = /[/\\]\.worktrees?[/\\]/.test(cwd);

      const { decision, segment } = classifyCommand(command, { cwdInWorktree });

      const output = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: decision,
          permissionDecisionReason: decision === "allow"
            ? "All command segments classified as safe"
            : `Segment needs approval: ${segment}`,
        },
      };

      console.log(JSON.stringify(output));
    } catch (err) {
      // On parse error, don't block — let the normal permission system handle it
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: `Hook error: ${err.message}`,
        },
      }));
    }
  });
}

main();
