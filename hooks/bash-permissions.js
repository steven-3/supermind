#!/usr/bin/env node
// PreToolUse hook for Bash — blocklist-based command classification.
// Default: everything auto-approved. Only explicitly dangerous commands require approval.
// Splits compound commands on && || ; and checks each segment (including pipes).
// Returns permissionDecision: "allow" | "ask"

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── User-approved commands ──────────────────────────────────────────────────
// Reads ~/.claude/supermind-approved.json — an array of command strings/patterns
// that the user has explicitly approved for auto-allow.

const APPROVED_FILE = path.join(os.homedir(), '.claude', 'supermind-approved.json');
const SAFETY_LOG_FILE = path.join(os.homedir(), '.claude', 'safety-log.jsonl');

function loadApprovedCommands() {
  try {
    const data = JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code !== 'ENOENT') {
      process.stderr.write(`[bash-permissions] Could not load approved commands: ${err.message}\n`);
    }
    return [];
  }
}

let _approvedCache;
function getApprovedCommands() {
  if (_approvedCache === undefined) {
    _approvedCache = loadApprovedCommands();
  }
  return _approvedCache;
}

function isUserApproved(cmd) {
  const approved = getApprovedCommands();
  const trimmed = cmd.trim();
  for (const pattern of approved) {
    if (trimmed === pattern) return true;
    if (trimmed.startsWith(pattern + ' ') || trimmed.startsWith(pattern + '\t')) return true;
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      try {
        if (new RegExp(pattern.slice(1, -1)).test(trimmed)) return true;
      } catch (e) {
        process.stderr.write(`[bash-permissions] Invalid regex in approved commands: ${pattern} (${e.message})\n`);
      }
    }
  }
  return false;
}

// ─── Gate override logging ──────────────────────────────────────────────────
// Logs every blocked command for safety audit trail.

function logBlockedCommand(command, reason) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      command: command.length > 500 ? command.slice(0, 500) + '...' : command,
      reason,
      cwd: process.cwd(),
    };
    fs.appendFileSync(SAFETY_LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (_) {
    // Non-critical — don't block on logging failure
  }
}

// ─── Git global flag stripping ───────────────────────────────────────────────

function stripGitGlobalFlags(gitArgs) {
  let args = gitArgs;
  args = args.replace(/^(-C\s+"[^"]*"|-C\s+'[^']*'|-C\s+\S+)\s*/g, "");
  args = args.replace(/^(-c\s+"[^"]*"|-c\s+'[^']*'|-c\s+\S+)\s*/g, "");
  args = args.replace(/^(--git-dir[= ]\S+)\s*/g, "");
  args = args.replace(/^(--work-tree[= ]\S+)\s*/g, "");
  args = args.replace(/^(--no-pager|--bare|--no-replace-objects|--literal-pathspecs|--no-optional-locks)\s*/g, "");
  if (args !== gitArgs) return stripGitGlobalFlags(args);
  return args;
}

// ─── Blocklist: Dangerous flags ─────────────────────────────────────────────

const DANGEROUS_FLAGS = [
  /--force(?![\w-])/,
  /--hard(?![\w-])/,
];

// ─── Blocklist: Filesystem destructive ──────────────────────────────────────

const FILESYSTEM_BLOCKED = [
  /^rm\b/,
  /^rmdir\b/,
  /^del\b/,
];

// ─── Blocklist: Process termination ─────────────────────────────────────────

const PROCESS_BLOCKED = [
  /^kill\b/,
  /^killall\b/,
  /^pkill\b/,
];

// ─── Blocklist: Publishing / deployment ─────────────────────────────────────

const PUBLISH_BLOCKED = [
  /^npm\s+publish\b/,
  /^docker\s+push\b/,
];

// ─── Blocklist: Database CLIs with destructive SQL ──────────────────────────

const DB_CLI_PATTERNS = [
  /^(psql|mysql|mongo|mongosh|redis-cli)\b/,
];

const DB_DESTRUCTIVE_SQL = [
  /\bDROP\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\b/i,
];

// ─── Blocklist: curl/wget with mutating HTTP methods ────────────────────────

const HTTP_MUTATING = [
  /\bcurl\b.*\s(-X\s*(POST|PUT|PATCH|DELETE)|--request\s*(POST|PUT|PATCH|DELETE))/,
  /\bcurl\b.*\s(-d[\s=]|--data[\s=]|--data-raw[\s=]|--data-binary[\s=]|--data-urlencode[\s=]|-F[\s=]|--form[\s=])/,
  /\bwget\b.*\s--method=(POST|PUT|PATCH|DELETE)/,
  /\bwget\b.*\s--post-data\b/,
  /\bwget\b.*\s--post-file\b/,
];

// ─── Blocklist: Git commands ────────────────────────────────────────────────

const GIT_BLOCKED = [
  /^reset\b/,
  /^clean\b/,
  /^rebase\b/,
  /^revert\b/,
  /^checkout\s+--\s/,
  /^checkout\s+\.\s*$/,
  /^restore\b/,
  /^branch\s+-D\b/,
  /^stash\s+drop\b/,
  /^stash\s+pop\b/,
  /^stash\s+clear\b/,
];

// ─── Blocklist: GitHub CLI mutating operations ──────────────────────────────

const GH_BLOCKED = [
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
  /^gh\s+api\s+(\S+\s+)*(-f[\s=]|-f\S|--field[\s=]|--raw-field[\s=]|-F[\s=]|-F\S|--typed-field[\s=]|--input[\s=])/,
];

// ─── Git push classification ────────────────────────────────────────────────

function classifyGitPush(gitCmd) {
  if (/--force(?![\w-])/.test(gitCmd)) return "ask";

  // Extract positional args (skip flags like -u, --set-upstream, etc.)
  const parts = gitCmd.replace(/^push\s*/, '').split(/\s+/).filter(p => !p.startsWith('-'));
  // parts[0] = remote (or refspec if no remote), parts[1] = refspec
  const remote = parts.length >= 2 ? parts[0] : '';
  const rawRefspec = parts.length >= 2 ? parts[1] : (parts[0] || '');
  // Strip leading + (git force-push shorthand) for branch name matching
  const refspec = rawRefspec.replace(/^\+/, '');

  // Block push to main/master (as source or destination in refspec)
  if (/^(main|master)(:|$)/.test(refspec)) return "ask";
  if (remote && /^(main|master)$/.test(refspec)) return "ask";
  if (/[:/](main|master)$/.test(refspec)) return "ask";
  // Also block the raw +refspec form (force push shorthand)
  if (/^\+/.test(rawRefspec)) return "ask";

  // Everything else auto-approved (bare "git push", feature branches, etc.)
  return "allow";
}

// ─── Git merge classification ───────────────────────────────────────────────

function classifyGitMerge(inWorktree) {
  // In worktree context, merge is auto-approved (worktree workflow)
  if (inWorktree) return "allow";
  // Outside worktree, require approval
  return "ask";
}

// ─── Command classifiers ─────────────────────────────────────────────────────

function classifyGitCommand(cmd, { inWorktree = false } = {}) {
  const gitCmd = stripGitGlobalFlags(cmd.slice(4).trim());

  // Dangerous flags first (--force, --hard)
  for (const p of DANGEROUS_FLAGS) {
    if (p.test(cmd)) return { decision: "ask", reason: "dangerous flag" };
  }

  // Git push — smart branch-aware classification
  if (/^push\b/.test(gitCmd)) {
    const result = classifyGitPush(gitCmd);
    return { decision: result, reason: result === "ask" ? "push to protected branch or with --force" : null };
  }

  // Git merge — worktree-aware
  if (/^merge\b/.test(gitCmd)) {
    const result = classifyGitMerge(inWorktree);
    return { decision: result, reason: result === "ask" ? "merge outside worktree context" : null };
  }

  // Worktree-only commands (worktree remove/prune, branch -d)
  if (/^(worktree\s+remove|worktree\s+prune|branch\s+-d)\b/.test(gitCmd)) {
    return inWorktree
      ? { decision: "allow", reason: null }
      : { decision: "ask", reason: "worktree-only command outside worktree" };
  }

  // Blocked git subcommands (reset, clean, rebase, revert, etc.)
  for (const p of GIT_BLOCKED) {
    if (p.test(gitCmd)) return { decision: "ask", reason: "blocked git command" };
  }

  // Everything else auto-approved (add, commit, status, diff, log, branch, tag, stash push, fetch, pull, etc.)
  return { decision: "allow", reason: null };
}

function classifySegment(raw, { inWorktree = false } = {}) {
  const cmd = raw.trim();
  if (!cmd || cmd === "true" || cmd === "false") return { decision: "allow", reason: null };

  // User-approved commands override all blocklist checks
  if (isUserApproved(cmd)) return { decision: "allow", reason: null };

  // Strip leading environment variable assignments
  const withoutEnv = cmd.replace(/^(\w+=\S+\s+)+/, "");
  const firstWord = withoutEnv.split(/\s/)[0];

  // ── Git commands (complex rules) ──
  if (withoutEnv.startsWith("git ")) return classifyGitCommand(withoutEnv, { inWorktree });

  // ── GitHub CLI ──
  if (withoutEnv.startsWith("gh ")) {
    for (const p of GH_BLOCKED) {
      if (p.test(withoutEnv)) return { decision: "ask", reason: "mutating gh command" };
    }
    return { decision: "allow", reason: null };
  }

  // ── Dangerous flags (any command) ──
  for (const p of DANGEROUS_FLAGS) {
    if (p.test(cmd)) return { decision: "ask", reason: "dangerous flag" };
  }

  // ── Filesystem destructive ──
  for (const p of FILESYSTEM_BLOCKED) {
    if (p.test(withoutEnv)) return { decision: "ask", reason: "destructive filesystem command" };
  }

  // ── Process termination ──
  for (const p of PROCESS_BLOCKED) {
    if (p.test(withoutEnv)) return { decision: "ask", reason: "process termination" };
  }

  // ── Publishing ──
  for (const p of PUBLISH_BLOCKED) {
    if (p.test(withoutEnv)) return { decision: "ask", reason: "publishing command" };
  }

  // ── Database CLIs with destructive SQL ──
  for (const p of DB_CLI_PATTERNS) {
    if (p.test(withoutEnv)) {
      for (const sql of DB_DESTRUCTIVE_SQL) {
        if (sql.test(cmd)) return { decision: "ask", reason: "destructive database operation" };
      }
      return { decision: "allow", reason: null };
    }
  }

  // ── curl/wget with mutating methods ──
  for (const p of HTTP_MUTATING) {
    if (p.test(withoutEnv)) return { decision: "ask", reason: "HTTP mutation" };
  }

  // ── Everything else: auto-approved ──
  return { decision: "allow", reason: null };
}

// ─── Worktree context detection ──────────────────────────────────────────────

function detectWorktreeContext(segments) {
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (trimmed.startsWith("cd ")) {
      const target = trimmed.slice(3).trim().replace(/^["']|["']$/g, "");
      if (/[/\\]\.worktrees?[/\\]/.test(target) || /^\.worktrees?[/\\]/.test(target)) {
        return true;
      }
    }
    if (/git\s+worktree\s+remove\s+.*\.worktrees?[/\\]/.test(trimmed)) {
      return true;
    }
  }
  return false;
}

// ─── Compound command parser ─────────────────────────────────────────────────

function classifyCommand(command, { cwdInWorktree = false } = {}) {
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
        i++;
        continue;
      }
      if (ch === "|" && command[i + 1] === "|") {
        segments.push(current);
        current = "";
        i++;
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

  const inWorktree = cwdInWorktree || detectWorktreeContext(segments);

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

    for (const pipePart of pipeParts) {
      const result = classifySegment(pipePart, { inWorktree });
      if (result.decision === "ask") {
        return { decision: "ask", segment: pipePart.trim(), reason: result.reason };
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

      const cwd = process.cwd();
      const cwdInWorktree = /[/\\]\.worktrees?[/\\]/.test(cwd);

      const { decision, segment, reason } = classifyCommand(command, { cwdInWorktree });

      if (decision === "ask") {
        logBlockedCommand(command, reason || `Segment needs approval: ${segment}`);
      }

      const output = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: decision,
          permissionDecisionReason: decision === "allow"
            ? "Auto-approved (not on blocklist)"
            : `Blocked: ${reason || segment}`,
        },
      };

      console.log(JSON.stringify(output));
    } catch (err) {
      if (!(err instanceof SyntaxError)) {
        process.stderr.write(`[bash-permissions] Unexpected error: ${err.stack || err.message}\n`);
      }
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

// Export for testing
module.exports = { classifyCommand, classifySegment, classifyGitCommand, classifyGitPush, isUserApproved };

if (require.main === module) {
  main();
}
