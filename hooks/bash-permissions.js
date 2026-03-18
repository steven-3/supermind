#!/usr/bin/env node
// PreToolUse hook for Bash — classifies commands as safe or needing approval.
// Splits compound commands on && || ; and checks each segment (including pipes).
// Returns permissionDecision: "allow" | "ask"

// ─── Constants ───────────────────────────────────────────────────────────────

// Filesystem + shell read-only commands (match by first word or first two words)
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
  // Node/npm/npx (two-word matches)
  "node -e", "node -p", "npm ls", "npm list", "npm view", "npm info",
  "npx which", "npx tsc", "npx eslint", "npx prettier", "npx vitest",
  "npx jest", "npx tsx", "npx ts-node",
];

// Prefix-matched safe commands (not just first word)
const SAFE_PREFIXES = [
  "sed -n",        // read-only sed
  "sed -e",        // expression sed (read-only when no -i)
  "[[ ",           // bash conditional
  "[ ",            // test
];

// Safe write commands (mkdir, touch, etc.) — still checked against DANGEROUS_PATTERNS
const SAFE_WRITE_COMMANDS = [
  "mkdir", "touch", "cp", "mv",
];

// ─── Git classification lists ────────────────────────────────────────────────

// Git read-only subcommands (always auto-approved)
const GIT_SAFE_READ = [
  "status", "diff", "log", "show", "blame", "rev-parse", "symbolic-ref",
  "remote", "ls-files", "shortlog", "tag -l", "tag --list", "config --get",
  "config --list", "check-ignore", "rev-list", "name-rev", "describe",
  "for-each-ref", "cat-file", "ls-tree", "verify-commit", "branch -a",
  "branch -r", "branch --list", "branch -l", "branch -v",
];

// Git non-destructive write subcommands (always auto-approved)
const GIT_SAFE_WRITE = [
  "add", "commit", "stash", "worktree add", "worktree list",
  "branch -m",
];

// Git commands auto-approved ONLY inside a worktree directory
const GIT_WORKTREE_ONLY = [
  "worktree remove", "worktree prune", "merge", "branch -d",
];

// Git commands that always require human approval
const GIT_DANGEROUS = [
  "push", "pull", "fetch", "reset", "revert", "rebase", "clean",
  "checkout -- ", "checkout .", "restore",
  "branch -D",
];

// ─── Dangerous patterns (checked across all command types) ───────────────────

const DANGEROUS_PATTERNS = [
  /--force/,
  /--hard/,
  /-rf\s/,
  /\brm\b/,
  /\brmdir\b/,
  /\bdel\b/,
  // Note: redirects to /dev/null are safe and handled by allowing the base command
];

// ─── GitHub CLI patterns ─────────────────────────────────────────────────────

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

// ─── Git global flag stripping ───────────────────────────────────────────────
// Strips flags like -C <path>, -c <key=val>, --git-dir, --work-tree, --no-pager
// that appear before the actual git subcommand.

function stripGitGlobalFlags(gitArgs) {
  let args = gitArgs;
  // Flags that consume the next argument
  args = args.replace(/^(-C\s+"[^"]*"|-C\s+'[^']*'|-C\s+\S+)\s*/g, "");
  args = args.replace(/^(-c\s+"[^"]*"|-c\s+'[^']*'|-c\s+\S+)\s*/g, "");
  args = args.replace(/^(--git-dir[= ]\S+)\s*/g, "");
  args = args.replace(/^(--work-tree[= ]\S+)\s*/g, "");
  // Standalone flags
  args = args.replace(/^(--no-pager|--bare|--no-replace-objects|--literal-pathspecs|--no-optional-locks)\s*/g, "");
  // Recurse in case multiple global flags are chained
  if (args !== gitArgs) return stripGitGlobalFlags(args);
  return args;
}

// ─── Command classifiers ─────────────────────────────────────────────────────

function classifyGhCommand(cmd) {
  for (const pattern of GH_DANGEROUS_PATTERNS) {
    if (pattern.test(cmd)) return "ask";
  }
  return "allow";
}

function classifyGitCommand(cmd, { inWorktree = false } = {}) {
  const gitCmd = stripGitGlobalFlags(cmd.slice(4).trim());

  // Dangerous subcommands take priority
  for (const d of GIT_DANGEROUS) {
    if (gitCmd.startsWith(d)) return "ask";
  }

  // Dangerous patterns (--force, --hard, rm, etc.)
  for (const p of DANGEROUS_PATTERNS) {
    if (p.test(cmd)) return "ask";
  }

  // Safe read-only subcommands
  for (const r of GIT_SAFE_READ) {
    if (gitCmd.startsWith(r)) return "allow";
  }

  // Safe write subcommands
  for (const w of GIT_SAFE_WRITE) {
    if (gitCmd.startsWith(w)) return "allow";
  }

  // Worktree-only commands — auto-approve only inside a worktree dir
  for (const w of GIT_WORKTREE_ONLY) {
    if (gitCmd.startsWith(w)) return inWorktree ? "allow" : "ask";
  }

  // Bare "git branch <name>" (create branch) — safe
  if (/^branch\s+[^-]/.test(gitCmd)) return "allow";

  // Unknown git subcommand — ask
  return "ask";
}

function isSedSafe(cmd) {
  // sed is safe only when it does NOT have -i (in-place edit)
  return /^sed\s/.test(cmd) && !/-i/.test(cmd);
}

// Classify a single command segment (no pipes, no compound operators)
function classifySegment(raw, { inWorktree = false } = {}) {
  const cmd = raw.trim();
  if (!cmd || cmd === "true" || cmd === "false") return "allow";

  // Strip leading environment variable assignments: FOO=bar BAZ=qux cmd ...
  const withoutEnv = cmd.replace(/^(\w+=\S+\s+)+/, "");

  // gh CLI
  if (withoutEnv.startsWith("gh ")) return classifyGhCommand(withoutEnv);

  // git
  if (withoutEnv.startsWith("git ")) return classifyGitCommand(withoutEnv, { inWorktree });

  // sed special handling (safe only without -i)
  if (withoutEnv.startsWith("sed ")) return isSedSafe(withoutEnv) ? "allow" : "ask";

  // Safe prefixes (sed -n, [[ , etc.)
  for (const p of SAFE_PREFIXES) {
    if (withoutEnv.startsWith(p)) return "allow";
  }

  // Safe read commands — match first word
  const firstWord = withoutEnv.split(/\s/)[0];
  if (SAFE_READ_COMMANDS.includes(firstWord)) return "allow";

  // Safe write commands — still check dangerous patterns
  if (SAFE_WRITE_COMMANDS.includes(firstWord)) {
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

// ─── Worktree context detection ──────────────────────────────────────────────
// Checks if any segment cd's into a .worktrees/ path or references one in
// a git worktree command.

function detectWorktreeContext(segments) {
  for (const seg of segments) {
    const trimmed = seg.trim();
    // cd into a worktree
    if (trimmed.startsWith("cd ")) {
      const target = trimmed.slice(3).trim().replace(/^["']|["']$/g, "");
      if (/[/\\]\.worktrees?[/\\]/.test(target) || /^\.worktrees?[/\\]/.test(target)) {
        return true;
      }
    }
    // git worktree remove targeting a .worktrees/ path
    if (/git\s+worktree\s+remove\s+.*\.worktrees?[/\\]/.test(trimmed)) {
      return true;
    }
    // git worktree remove with a relative .worktrees path
    if (/git\s+worktree\s+remove\s+\.worktrees?[/\\]/.test(trimmed)) {
      return true;
    }
  }
  return false;
}

// ─── Compound command parser ─────────────────────────────────────────────────
// Splits on && || ; while respecting single and double quotes.
// Then splits each segment on pipes. If ANY part is "ask", the whole command is "ask".

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

  // Detect worktree context from cd targets or CWD
  const inWorktree = cwdInWorktree || detectWorktreeContext(segments);

  // Classify each segment — if ANY is "ask", the whole command is "ask"
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    // Split pipes within segment (quote-aware)
    const pipeParts = [];
    let pipeCurrent = "";
    let pInSingle = false;
    let pInDouble = false;

    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === "'" && !pInDouble) pInSingle = !pInSingle;
      if (ch === '"' && !pInSingle) pInDouble = !pInDouble;
      if (ch === "|" && trimmed[i + 1] !== "|" && !pInSingle && !pInDouble) {
        pipeParts.push(pipeCurrent);
        pipeCurrent = "";
        continue;
      }
      pipeCurrent += ch;
    }
    pipeParts.push(pipeCurrent);

    // Check each pipe part
    for (const pipePart of pipeParts) {
      const result = classifySegment(pipePart, { inWorktree });
      if (result === "ask") {
        return { decision: "ask", segment: pipePart.trim() };
      }
    }
  }

  return { decision: "allow" };
}

// ─── Main ────────────────────────────────────────────────────────────────────

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
