# Supermind v3.0 Massive Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Supermind from a setup tool into a complete development workflow engine with OpenSpec integration, vendor skill imports, template overhaul, new hooks, and CLI expansions.

**Architecture:** All new code follows the existing zero-dependency Node.js CommonJS pattern. New CLI subcommands (skill, openspec) use the same lazy-load routing pattern as existing commands. New hooks follow the stdin-JSON-parse, stdout-JSON-output pattern. New skills are SKILL.md files with frontmatter.

**Tech Stack:** Node.js >= 18, CommonJS, fs/path/os/child_process/crypto/readline stdlib only

**Spec:** `docs/superpowers/specs/2026-03-29-supermind-v3-massive-improvement-design.md`

---

## File Structure

### New Files (10)

| File | Responsibility |
|------|---------------|
| `templates/CLAUDE.md` | Rewritten project template (~250 lines) with banlist, parallelism, lifecycle, OpenSpec, vendor skills |
| `hooks/pre-merge-checklist.js` | PostToolUse hook: advisory warnings when merging to main/master |
| `hooks/improvement-logger.js` | Stop hook: append session summary to ~/.claude/improvement-log.jsonl |
| `cli/lib/openspec.js` | OpenSpec CLI detection, version check, installation |
| `cli/lib/vendor-skills.js` | Vendor skill add/update/list/remove + skills-lock.json management |
| `cli/commands/skill.js` | CLI routing for `supermind skill add/update/list/remove` |
| `cli/commands/openspec.js` | CLI routing for `supermind openspec install/doctor` |
| `skills/openspec-propose/SKILL.md` | OpenSpec propose workflow skill |
| `skills/openspec-explore/SKILL.md` | OpenSpec explore/thinking mode skill |
| `skills/openspec-apply/SKILL.md` | OpenSpec apply/implement tasks skill |
| `skills/openspec-archive/SKILL.md` | OpenSpec archive completed change skill |

### Modified Files (12)

| File | Change |
|------|--------|
| `cli/index.js` | Add `skill` and `openspec` command routing + updated help text |
| `cli/commands/install.js` | Add steps 8 (OpenSpec CLI) and 9 (verify); update TOTAL from 7 to 9 |
| `cli/commands/update.js` | Add vendor skill update step; update TOTAL from 4 to 5 |
| `cli/commands/doctor.js` | Add OpenSpec CLI check, vendor skill integrity, new hook checks |
| `cli/commands/uninstall.js` | Add vendor skill cleanup, improvement log cleanup |
| `cli/lib/hooks.js` | Add pre-merge-checklist and improvement-logger to KNOWN_HOOKS and getHookSettings |
| `cli/lib/skills.js` | Add 4 OpenSpec skills to KNOWN_SKILLS |
| `cli/lib/settings.js` | Add 2 new hook filenames to SUPERMIND_HOOKS |
| `cli/lib/platform.js` | Add `improvementLog` and `skillsLock` paths to PATHS |
| `skills/supermind-init/SKILL.md` | Add Phase 1.5 (config scaffolding) and Phase 2.5 (OpenSpec init) |
| `package.json` | Version bump to 3.0.0 |
| `CHANGELOG.md` | Document all v3.0 changes |

---

## Milestone 1: Template and Hooks (Foundation)

These have no dependencies on other new code and provide the foundation.

### Task 1: Rewrite templates/CLAUDE.md

**Files:**
- Modify: `templates/CLAUDE.md`

- [ ] **Step 1: Read current template**

Read `templates/CLAUDE.md` to confirm current content (104 lines).

- [ ] **Step 2: Write the new template**

Replace the entire file with the new ~250-line template. The template includes these sections in order:

1. `# Claude Code Instructions` (title)
2. `## Quick Reference` (preserved, links to ARCHITECTURE.md/DESIGN.md)
3. `## Commands` (placeholder for /supermind-init)
4. `## Tech Stack` (placeholder for /supermind-init)
5. `## Project Structure` (placeholder for /supermind-init)
6. `## Shell & Git Permissions` (NEW: banlist approach)
7. `## Subagent Strategy` (NEW: parallelism rules)
8. `## Development Lifecycle` (NEW: 6-phase, replaces old Worktree section)
9. `## OpenSpec Workflow` (NEW: when/how to use OpenSpec)
10. `## Vendor Skills` (NEW: skill import commands)
11. `## MCP Servers` (preserved, dynamic based on install mode)
12. `## UI Changes` (preserved)
13. `## Living Documentation` (preserved)

The Shell & Git Permissions section uses the banlist model — documents what's banned, everything else auto-approved. The Development Lifecycle encodes the 6-phase process from lead-scout-finder. The Subagent Strategy section encodes the 10+ parallel agents and milestone decomposition patterns.

The MCP Servers section continues to use the `{{MCP_SECTION}}` template variable for dynamic rendering based on install mode (docker/direct/skip), matching the existing `installTemplates()` behavior in `cli/lib/templates.js`.

**Important:** The template must include a branch safety rule (either as a standalone section or within the Development Lifecycle): "If the current branch is `main` or `master` when a code change is requested, create a feature branch first. Never commit directly to `main` or `master`." This is currently in the old Worktree section and must be preserved in the new lifecycle.

- [ ] **Step 3: Verify template renders correctly**

Run: `node -e "const t = require('fs').readFileSync('templates/CLAUDE.md','utf-8'); console.log('Lines:', t.split('\\n').length); console.log('Sections:', (t.match(/^## /gm)||[]).length)"`

Expected: Lines ~250, Sections ~11

- [ ] **Step 4: Commit**

```bash
git add templates/CLAUDE.md
git commit -m "feat: rewrite template with banlist permissions, parallelism, 6-phase lifecycle, OpenSpec"
```

---

### Task 2: Create hooks/pre-merge-checklist.js

**Files:**
- Create: `hooks/pre-merge-checklist.js`

- [ ] **Step 1: Write the hook**

This is a PostToolUse hook that fires after Bash commands containing `git merge`. It checks three things and outputs advisory warnings.

The hook reads JSON from stdin with shape `{ tool_name, tool_input: { command }, tool_output }`. It only acts when the command contains `git merge` and the target is `main` or `master`. It outputs JSON with a `hookSpecificOutput` containing warnings.

Key logic:
- Parse the merge command to detect if target branch is main/master
- Check if ARCHITECTURE.md has been modified in this branch vs the merge target (using `git diff --name-only <target>...HEAD`)
- Check if `openspec/changes/` contains any non-archived changes with all tasks completed (scan for directories, read tasks.md, count `- [x]` vs `- [ ]`)
- Output warnings array; empty array means all clear

The hook must handle errors gracefully — if any check fails, skip it and continue with other checks. A hook failure should never block work.

- [ ] **Step 2: Verify hook runs without errors**

Run: `echo '{"tool_name":"Bash","tool_input":{"command":"echo test"}}' | node hooks/pre-merge-checklist.js`

Expected: Empty JSON output (no merge command, hook exits early)

- [ ] **Step 3: Commit**

```bash
git add hooks/pre-merge-checklist.js
git commit -m "feat: add pre-merge checklist advisory hook"
```

---

### Task 3: Create hooks/improvement-logger.js

**Files:**
- Create: `hooks/improvement-logger.js`

- [ ] **Step 1: Write the hook**

This is a Stop event hook (async). It appends a JSONL entry to `~/.claude/improvement-log.jsonl`.

The hook:
1. Reads PROJECT_DIR, SESSION_ID from environment
2. Gets current git branch via `git rev-parse --abbrev-ref HEAD`
3. Gets recent commits via `git log --oneline --since="4 hours ago"` (captures session work)
4. Counts changed files via `git diff --name-only HEAD~1 HEAD` (fallback to `git diff --name-only` for uncommitted)
5. Builds a JSON object: `{ timestamp, project, branch, sessionId, commits[], filesChanged }`
6. Appends as one line to `~/.claude/improvement-log.jsonl`
7. Checks file size; if > 10MB, renames to `.1` and starts fresh
8. Silent fail on any error (non-critical hook)

- [ ] **Step 2: Verify hook runs without errors**

Run: `PROJECT_DIR=/tmp SESSION_ID=test node hooks/improvement-logger.js < /dev/null`

Expected: Exit 0 (no crash). Check `~/.claude/improvement-log.jsonl` for a new entry.

- [ ] **Step 3: Commit**

```bash
git add hooks/improvement-logger.js
git commit -m "feat: add improvement logger hook for session tracking"
```

---

## Milestone 2: OpenSpec Integration

### Task 4: Create cli/lib/openspec.js

**Files:**
- Create: `cli/lib/openspec.js`

- [ ] **Step 1: Write the module**

Exports:
- `detectCli()` — returns `{ installed: bool, version: string|null, path: string|null }` by running `openspec --version` via `execFileSync`
- `installCli()` — runs `npm install -g openspec` via `execFileSync`, returns success/fail
- `checkHealth()` — calls detectCli, checks version against `OPENSPEC_MIN_VERSION = '1.0.0'`, returns health report object
- `OPENSPEC_MIN_VERSION` — exported constant

All child_process calls use `execFileSync` with argument arrays (never shell strings). Wrap in try/catch for graceful failure.

- [ ] **Step 2: Verify module loads**

Run: `node -e "const o = require('./cli/lib/openspec'); console.log(o.detectCli())"`

Expected: `{ installed: false, version: null, path: null }` (or true if openspec is installed)

- [ ] **Step 3: Commit**

```bash
git add cli/lib/openspec.js
git commit -m "feat: add OpenSpec CLI detection and installation module"
```

---

### Task 5: Create cli/commands/openspec.js

**Files:**
- Create: `cli/commands/openspec.js`

- [ ] **Step 1: Write the command**

Routes two subcommands:
- `install` — calls `openspecLib.installCli()`, reports result
- `doctor` — calls `openspecLib.checkHealth()`, formats as pass/fail output

Parses args from `process.argv` after the `openspec` command word. If no subcommand or unknown subcommand, shows help text listing available subcommands.

- [ ] **Step 2: Verify command runs**

Run: `node cli/index.js openspec doctor`

Expected: Shows OpenSpec CLI health status (installed or not found)

Note: This step will fail until Task 9 wires up the command in index.js. Verify after Task 9.

- [ ] **Step 3: Commit**

```bash
git add cli/commands/openspec.js
git commit -m "feat: add supermind openspec CLI command"
```

---

### Task 6: Create OpenSpec Skills (4 SKILL.md files)

**Files:**
- Create: `skills/openspec-propose/SKILL.md`
- Create: `skills/openspec-explore/SKILL.md`
- Create: `skills/openspec-apply/SKILL.md`
- Create: `skills/openspec-archive/SKILL.md`

- [ ] **Step 1: Create openspec-propose/SKILL.md**

Create directory `skills/openspec-propose/` and write SKILL.md.

Frontmatter:
```yaml
---
name: openspec-propose
description: "Propose a new change with all artifacts generated in one step. Use when the user wants to describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation."
---
```

Body: Adapted from ai-web-builder's version. Steps:
1. Derive kebab-case name from user input (or ask via AskUserQuestion)
2. Run `openspec new change "<name>"` to scaffold
3. Get artifact build order via `openspec status --change "<name>" --json`
4. Create artifacts in dependency order using `openspec instructions`
5. Show final status

Include a **Fallback (no CLI)** section: manually create `openspec/changes/<name>/` with proposal.md, design.md, tasks.md files. Use built-in structure (## What, ## Why for proposal; ## Approach, ## Components, ## Data Flow for design; markdown checkboxes for tasks).

Include guardrails: create ALL artifacts, read dependencies before creating, ask user if unclear, handle existing change names.

- [ ] **Step 2: Create openspec-explore/SKILL.md**

Create directory `skills/openspec-explore/` and write SKILL.md.

Frontmatter:
```yaml
---
name: openspec-explore
description: "Enter explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change. Never writes code."
---
```

Body: Adapted from ai-web-builder's version. Sections:
- The Stance (curious, open, visual, adaptive, patient, grounded)
- What You Might Do (explore problem space, investigate codebase, compare options, visualize, surface risks)
- OpenSpec Awareness (check for existing changes, read artifacts, offer to capture insights)
- Handling Different Entry Points (examples for vague ideas, specific problems, mid-implementation, comparing options)
- Ending Discovery (flow into proposal, update artifacts, or just provide clarity)
- Guardrails (never implement, never fake understanding, never rush, do visualize, do explore codebase)

Include fallback: check `openspec/changes/` directory directly instead of CLI commands.

- [ ] **Step 3: Create openspec-apply/SKILL.md**

Create directory `skills/openspec-apply/` and write SKILL.md.

Frontmatter:
```yaml
---
name: openspec-apply
description: "Implement tasks from an OpenSpec change. Use when a change has been proposed and the user wants to start building. Reads all artifacts for context, implements tasks sequentially, marks complete as it goes."
---
```

Body: Steps:
1. Select change (infer from context or ask)
2. Read all context files (proposal.md, design.md, specs/, tasks.md)
3. Implement tasks sequentially, marking `- [ ]` to `- [x]` as each completes
4. Pause on blockers, unclear requirements, or discovered design issues
5. Show progress: "N/M tasks complete"

Include fallback: read task files directly, parse markdown checkboxes.
Include guardrails: read ALL artifacts before starting, mark tasks as you go, pause on blockers.

- [ ] **Step 4: Create openspec-archive/SKILL.md**

Create directory `skills/openspec-archive/` and write SKILL.md.

Frontmatter:
```yaml
---
name: openspec-archive
description: "Archive a completed OpenSpec change. Use when all tasks are done and the change is ready to be finalized. Checks completion, syncs specs, moves to archive."
---
```

Body: Steps:
1. Check artifact and task completion status
2. Assess delta spec sync (compare change specs with main specs)
3. Prompt for spec sync before archiving
4. Create `openspec/changes/archive/YYYY-MM-DD-<name>/` directory
5. Move change files to archive
6. Show summary of what was archived

Include fallback: manual directory move and completion checking.
Include guardrails: verify all tasks completed, warn on incomplete, confirm before archiving.

- [ ] **Step 5: Verify all skill directories exist with SKILL.md files**

Run: `for d in openspec-propose openspec-explore openspec-apply openspec-archive; do echo "$d: $(test -f skills/$d/SKILL.md && echo OK || echo MISSING)"; done`

Expected: All show OK

- [ ] **Step 6: Commit**

```bash
git add skills/openspec-propose/ skills/openspec-explore/ skills/openspec-apply/ skills/openspec-archive/
git commit -m "feat: add 4 OpenSpec workflow skills (propose, explore, apply, archive)"
```

---

## Milestone 3: Vendor Skill System

### Task 7: Create cli/lib/vendor-skills.js

**Files:**
- Create: `cli/lib/vendor-skills.js`

- [ ] **Step 1: Write the module**

This is the largest new module. Exports:

**`addSkill(url, options)`**
1. Parse GitHub URL: extract owner, repo, optional path, branch (default: main)
2. Create temp dir via `fs.mkdtempSync(path.join(os.tmpdir(), 'supermind-skill-'))`
3. Shallow clone: `execFileSync('git', ['clone', '--depth', '1', '--branch', branch, repoUrl, tempDir])`
4. Find SKILL.md files in the cloned path: walk directory tree looking for SKILL.md
5. For each skill found:
   a. Read all files in the skill directory
   b. Compute SHA-256 hash of concatenated content using `crypto.createHash('sha256')`
   c. Copy directory to target (global: `~/.claude/skills/`, project: `.claude/skills/`)
   d. Get commit hash: `execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tempDir })`
6. Update skills-lock.json
7. Clean up temp dir: `fs.rmSync(tempDir, { recursive: true, force: true })`
8. Return { installed: skillNames[], source, commit }

**`updateSkill(name, options)`**
1. Read lock file entry for the skill
2. If not found, throw error
3. Re-clone source repo (shallow)
4. Compute new hash
5. If hash differs: copy new files, update lock entry. If same: return "up to date"
6. Clean up

**`updateAll(options)`**
- Read both global and project lock files
- Call updateSkill for each entry

**`listSkills(options)`**
- Read both lock files
- Return formatted list: name, source, commit (short), installed date, scope

**`removeSkill(name, options)`**
- Read lock file, find entry
- Remove skill directory
- Remove entry from lock file
- Write updated lock file

**`verifySkills(options)`**
- For each locked skill: check directory exists, optionally recompute hash
- Return { valid: [], missing: [], corrupted: [] }

**`readLockFile(scope)`** / **`writeLockFile(scope, data)`**
- scope: 'global' or 'project'
- Global: `~/.claude/skills-lock.json`
- Project: `.claude/skills-lock.json`
- readLockFile returns `{ skills: {} }` if file doesn't exist

**URL parsing helper:** `parseGitHubUrl(url)`
- Accepts: `github.com/owner/repo`, `https://github.com/owner/repo`, `github.com/owner/repo/tree/branch/path`
- Returns: `{ owner, repo, branch, path, cloneUrl }`

All `execFileSync` calls use argument arrays, never shell strings. Wrap all git operations in try/catch.

- [ ] **Step 2: Verify module loads and URL parser works**

Run: `node -e "const v = require('./cli/lib/vendor-skills'); console.log(v.parseGitHubUrl('github.com/cloudflare/skills'))"`

Expected: `{ owner: 'cloudflare', repo: 'skills', branch: 'main', path: '.', cloneUrl: 'https://github.com/cloudflare/skills.git' }`

- [ ] **Step 3: Commit**

```bash
git add cli/lib/vendor-skills.js
git commit -m "feat: add vendor skill management library (add/update/list/remove with lock file)"
```

---

### Task 8: Create cli/commands/skill.js

**Files:**
- Create: `cli/commands/skill.js`

- [ ] **Step 1: Write the command**

Parses subcommand from argv: `add`, `update`, `list`, `remove`.

- `add <url> [--global]`: calls `vendorSkills.addSkill(url, { global: hasGlobalFlag })`
- `update [name] [--all]`: calls `vendorSkills.updateSkill(name)` or `vendorSkills.updateAll()` if --all
- `list`: calls `vendorSkills.listSkills()`, formats as table
- `remove <name>`: calls `vendorSkills.removeSkill(name)`
- No subcommand or `--help`: shows usage text

Each subcommand wraps the lib call with logger output (step numbers, success/error messages).

- [ ] **Step 2: Verify command shows help**

Run: `node cli/index.js skill`

Expected: Shows skill subcommand usage (will work after Task 9 wires routing)

- [ ] **Step 3: Commit**

```bash
git add cli/commands/skill.js
git commit -m "feat: add supermind skill CLI command (add/update/list/remove)"
```

---

## Milestone 4: CLI Integration

Wire all new components into the existing CLI infrastructure.

### Task 9: Update cli/index.js

**Files:**
- Modify: `cli/index.js`

- [ ] **Step 1: Add new commands to COMMANDS map**

Add `skill` and `openspec` to the COMMANDS object with lazy requires.

- [ ] **Step 2: Update help text**

Add the new commands to the help output:
```
    skill       Manage vendor skills (add/update/list/remove)
    openspec    Manage OpenSpec CLI (install/doctor)
```

- [ ] **Step 3: Add --global flag parsing**

Add `if (arg === '--global') { flags.global = true; continue; }` to the parseArgs loop.
Add `if (arg === '--all') { flags.all = true; continue; }` too.

Also: currently the arg parser only recognizes args that are in COMMANDS. For subcommands like `skill add <url>`, the positional args after the command need to be captured. Add logic to collect remaining positional args into `flags.args = []` after the command is identified.

- [ ] **Step 4: Verify new commands route correctly**

Run: `node cli/index.js --help`

Expected: Help text shows `skill` and `openspec` commands

Run: `node cli/index.js skill --help`

Expected: Skill subcommand help (or the skill command's default output)

- [ ] **Step 5: Commit**

```bash
git add cli/index.js
git commit -m "feat: add skill and openspec command routing to CLI"
```

---

### Task 10: Update cli/lib/platform.js

**Files:**
- Modify: `cli/lib/platform.js`

- [ ] **Step 1: Add new paths**

Add to the PATHS object:
- `improvementLog`: `path.join(home, '.claude', 'improvement-log.jsonl')`
- `skillsLock`: `path.join(home, '.claude', 'skills-lock.json')`
- `approvedCommands`: `path.join(home, '.claude', 'supermind-approved.json')`

- [ ] **Step 2: Commit**

```bash
git add cli/lib/platform.js
git commit -m "feat: add improvement log and skills lock paths to platform module"
```

---

### Task 11: Update cli/lib/settings.js

**Files:**
- Modify: `cli/lib/settings.js`

- [ ] **Step 1: Add new hooks to SUPERMIND_HOOKS array**

Add `'pre-merge-checklist.js'` and `'improvement-logger.js'` to the SUPERMIND_HOOKS array.

- [ ] **Step 2: Commit**

```bash
git add cli/lib/settings.js
git commit -m "feat: register new hooks in settings module"
```

---

### Task 12: Update cli/lib/hooks.js

**Files:**
- Modify: `cli/lib/hooks.js`

- [ ] **Step 1: Add new hooks to getHookSettings()**

Add to the `hooks` object returned by `getHookSettings()`:

A new `PostToolUse` event entry for the pre-merge checklist:
```javascript
PostToolUse: [{
  matcher: 'Bash',
  hooks: [{ type: 'command', command: `node "${path.join(hooksDir, 'pre-merge-checklist.js')}"`, timeout: 5 }],
}],
```

Add the improvement logger to the existing `Stop` event's hooks array:
```javascript
{ type: 'command', command: `node "${path.join(hooksDir, 'improvement-logger.js')}"`, async: true },
```

- [ ] **Step 2: Update KNOWN_HOOKS fallback list**

Add `'pre-merge-checklist.js'` and `'improvement-logger.js'` to the KNOWN_HOOKS array.

- [ ] **Step 3: Commit**

```bash
git add cli/lib/hooks.js
git commit -m "feat: register pre-merge checklist and improvement logger hooks"
```

---

### Task 13: Update cli/lib/skills.js

**Files:**
- Modify: `cli/lib/skills.js`

- [ ] **Step 1: Update KNOWN_SKILLS fallback list**

Add the 4 new OpenSpec skill directories to KNOWN_SKILLS:
```javascript
const KNOWN_SKILLS = ['supermind', 'supermind-init', 'supermind-living-docs',
  'openspec-propose', 'openspec-explore', 'openspec-apply', 'openspec-archive'];
```

- [ ] **Step 2: Commit**

```bash
git add cli/lib/skills.js
git commit -m "feat: register OpenSpec skills in skills module"
```

---

### Task 14: Update cli/commands/install.js

**Files:**
- Modify: `cli/commands/install.js`

- [ ] **Step 1: Add OpenSpec import and update step count**

Add require for openspec lib at top. Change `TOTAL` from 7 to 9.

- [ ] **Step 2: Add Step 8: OpenSpec CLI installation**

After step 7 (templates), add:

```javascript
// Step 8: OpenSpec CLI
logger.step(8, TOTAL, 'Setting up OpenSpec CLI...');
const openspecLib = require('../lib/openspec');
const openspecStatus = openspecLib.detectCli();
if (openspecStatus.installed) {
  logger.success(`OpenSpec CLI v${openspecStatus.version} found`);
  const health = openspecLib.checkHealth();
  if (!health.compatible) {
    logger.warn(`OpenSpec CLI v${openspecStatus.version} is below minimum v${openspecLib.OPENSPEC_MIN_VERSION}`);
  }
} else {
  if (flags.nonInteractive) {
    logger.info('OpenSpec CLI not found (install with: npm install -g openspec)');
  } else {
    // Prompt to install
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(r => rl.question('  OpenSpec CLI not found. Install it? [Y/n]: ', a => { rl.close(); r(a.trim()); }));
    if (answer.toLowerCase() !== 'n') {
      const result = openspecLib.installCli();
      if (result.success) logger.success('OpenSpec CLI installed');
      else logger.warn(`OpenSpec CLI install failed: ${result.error}`);
    } else {
      logger.info('Skipped (OpenSpec skills will use fallback mode)');
    }
  }
}
```

- [ ] **Step 3: Add Step 9: Verification**

Move the existing `fs.writeFileSync(PATHS.versionFile, version)` into step 9 and add basic verification checks inline (not calling doctor, which uses process.exit):

```javascript
// Step 9: Verify installation
logger.step(9, TOTAL, 'Verifying installation...');
fs.writeFileSync(PATHS.versionFile, version);

// Quick inline verification
const hookCount = fs.readdirSync(PATHS.hooksDir).filter(f => f.endsWith('.js')).length;
const skillCount = fs.readdirSync(PATHS.skillsDir).filter(f => {
  try { return fs.statSync(path.join(PATHS.skillsDir, f)).isDirectory(); } catch { return false; }
}).length;
logger.success(`${hookCount} hooks, ${skillCount} skills, version ${version}`);
```

Remove the old version marker write that was between step 7 and the summary (it's now in step 9).

- [ ] **Step 4: Update summary text**

Add OpenSpec and skill management to the "Next steps" output:
```javascript
console.log('    4. Use: supermind skill add <repo>  to install vendor skills');
console.log('    5. Use: /openspec-propose  to start structured change management\n');
```

- [ ] **Step 5: Verify install runs**

Run: `node cli/index.js --version`

Expected: Shows current version

Run: `node cli/index.js doctor`

Expected: All new hooks and skills show as present

- [ ] **Step 6: Commit**

```bash
git add cli/commands/install.js
git commit -m "feat: add OpenSpec CLI setup and verification to install command"
```

---

### Task 15: Update cli/commands/update.js

**Files:**
- Modify: `cli/commands/update.js`

- [ ] **Step 1: Update step count and add vendor skill update**

Change `TOTAL` from 4 to 5. Add step 5 after templates:

```javascript
// Step 5: Vendor skills (if lock file exists)
logger.step(5, TOTAL, 'Checking vendor skills...');
try {
  const vendorSkills = require('../lib/vendor-skills');
  const globalLock = vendorSkills.readLockFile('global');
  const skillCount = Object.keys(globalLock.skills || {}).length;
  if (skillCount > 0) {
    logger.info(`${skillCount} vendor skills tracked (run 'supermind skill update --all' to refresh)`);
  } else {
    logger.info('No vendor skills installed');
  }
} catch (err) {
  logger.info('Vendor skill check skipped');
}
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/update.js
git commit -m "feat: add vendor skill check to update command"
```

---

### Task 16: Update cli/commands/doctor.js

**Files:**
- Modify: `cli/commands/doctor.js`

- [ ] **Step 1: Add OpenSpec CLI check**

After the Docker check, add:

```javascript
// OpenSpec CLI
try {
  const openspecLib = require('../lib/openspec');
  const status = openspecLib.detectCli();
  if (status.installed) {
    run('OpenSpec CLI installed', true);
    const health = openspecLib.checkHealth();
    run('OpenSpec CLI version compatible', health.compatible,
      health.compatible ? undefined : `found v${status.version}, need >= v${openspecLib.OPENSPEC_MIN_VERSION}`);
  } else {
    logger.warn('OpenSpec CLI not installed (optional - install with: npm install -g openspec)');
  }
} catch {
  logger.warn('OpenSpec CLI check skipped');
}
```

- [ ] **Step 2: Add vendor skill integrity check**

After the OpenSpec check, add:

```javascript
// Vendor skills
try {
  const vendorSkills = require('../lib/vendor-skills');
  const result = vendorSkills.verifySkills();
  for (const name of result.valid) {
    run(`Vendor skill: ${name}`, true);
  }
  for (const name of result.missing) {
    run(`Vendor skill: ${name}`, false, 'directory not found');
  }
} catch {
  // No vendor skills or module not loaded - skip silently
}
```

- [ ] **Step 3: Add improvement log check**

```javascript
// Improvement log
run('Improvement log writable', (() => {
  try {
    const logPath = path.join(PATHS.claudeHome, 'improvement-log.jsonl');
    fs.appendFileSync(logPath, '', { flag: 'a' });
    return true;
  } catch { return false; }
})());
```

- [ ] **Step 4: Commit**

```bash
git add cli/commands/doctor.js
git commit -m "feat: add OpenSpec, vendor skill, and improvement log checks to doctor"
```

---

### Task 17: Update cli/commands/uninstall.js

**Files:**
- Modify: `cli/commands/uninstall.js`

- [ ] **Step 1: Add vendor skill lock file cleanup**

After the "Clean settings" section, add:

```javascript
// Remove vendor skills lock file
const skillsLockPath = path.join(PATHS.claudeHome, 'skills-lock.json');
if (fs.existsSync(skillsLockPath)) {
  fs.unlinkSync(skillsLockPath);
  logger.success('Removed vendor skills lock file');
}
```

Add `const path = require('path');` to imports if not already there.

- [ ] **Step 2: Add improvement log cleanup option**

After the AIRIS cleanup section, add an optional cleanup for the improvement log:

```javascript
// Optional: Improvement log
const improvementLog = path.join(PATHS.claudeHome, 'improvement-log.jsonl');
if (fs.existsSync(improvementLog)) {
  if (flags.yes || flags.nonInteractive) {
    fs.unlinkSync(improvementLog);
    logger.success('Removed improvement log');
  } else {
    const answer = await prompt('  Also remove improvement log? [y/N]: ');
    if (answer.toLowerCase() === 'y') {
      fs.unlinkSync(improvementLog);
      logger.success('Removed improvement log');
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add cli/commands/uninstall.js
git commit -m "feat: add vendor skill and improvement log cleanup to uninstall"
```

---

## Milestone 5: Init Skill Updates

### Task 18: Update skills/supermind-init/SKILL.md

**Files:**
- Modify: `skills/supermind-init/SKILL.md`

- [ ] **Step 1: Add Phase 1.5: Project-Local Config Scaffolding**

Insert a new phase between Phase 1 (CLAUDE.md) and Phase 2 (Living Docs):

```markdown
## Phase 1.5: Project-Local Config Scaffolding

Generate project-specific Claude Code configuration files to streamline permissions and MCP server setup.

### Steps

7a. **Generate `.claude/settings.local.json`** (only if file does not exist):

   a. Detect project stack from manifest files:
      - `package.json` present: Node.js stack
      - `Cargo.toml` present: Rust stack
      - `go.mod` present: Go stack
      - `requirements.txt` or `pyproject.toml` present: Python stack
      - `Gemfile` present: Ruby stack

   b. Build permission allows based on detected stack:
      | Stack | Permissions |
      |-------|------------|
      | Node.js | Bash(npm install:*), Bash(npm run:*), Bash(npm test:*), Bash(npx:*), Bash(node:*), Bash(tsc:*) |
      | Python | Bash(pip install:*), Bash(pytest:*), Bash(python:*), Bash(uv:*) |
      | Rust | Bash(cargo build:*), Bash(cargo test:*), Bash(cargo run:*), Bash(cargo clippy:*) |
      | Go | Bash(go build:*), Bash(go test:*), Bash(go run:*), Bash(go vet:*) |
      | Ruby | Bash(bundle install:*), Bash(bundle exec:*), Bash(rake:*), Bash(rspec:*) |

   c. Always include: `WebSearch`, `mcp__plugin_semgrep-plugin_semgrep__semgrep_scan`

   d. Write the file using the Write tool. Tell the user what was generated.

7b. **Generate `.mcp.json`** (only if file does not exist):

   a. Scan for service indicators in package.json dependencies and .env.example:
      - `@supabase/supabase-js` -> suggest Supabase MCP
      - `railway` in scripts -> suggest Railway MCP
      - Database connection strings -> suggest relevant DB MCP

   b. If indicators found, ask the user which MCP servers to enable.

   c. Write `.mcp.json` with selected servers. If no indicators found, skip this step.

   d. Check if `.mcp.json` should be in `.gitignore` (if it would contain API keys). If so, add it.
```

- [ ] **Step 2: Add Phase 2.5: OpenSpec Scaffolding**

Insert after Phase 2 (Living Docs), before Phase 3 (Health):

```markdown
## Phase 2.5: OpenSpec Scaffolding

Set up OpenSpec for structured change management in this project.

### Steps

14a. **Check OpenSpec CLI availability**:
    - Run `openspec --version` to detect if installed
    - If installed, report version

14b. **Initialize OpenSpec** (only if `openspec/` directory does not exist):
    - If CLI available: run `openspec init` in the project root
    - If CLI not available: create `openspec/changes/` directory manually
    - Add `openspec/changes/archive/` to `.gitignore` if not already present
    - Tell the user: "OpenSpec initialized. Use `/openspec-propose` to create your first change."

14c. **If OpenSpec directory already exists**: tell the user it is already set up and skip.
```

- [ ] **Step 3: Update Phase 1 infrastructure sections list**

In the Phase 1 Section Ownership, add the new template sections to the Infrastructure list:
- Subagent Strategy
- Development Lifecycle
- OpenSpec Workflow
- Vendor Skills

These are infrastructure sections that get replaced from template on every run, just like Shell & Git Permissions and Worktree Development Workflow.

- [ ] **Step 4: Commit**

```bash
git add skills/supermind-init/SKILL.md
git commit -m "feat: add config scaffolding and OpenSpec init phases to supermind-init"
```

---

## Milestone 6: Documentation and Release

### Task 19: Update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version to 3.0.0**

Change `"version": "2.1.1"` to `"version": "3.0.0"`.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 3.0.0"
```

---

### Task 20: Update CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Read current CHANGELOG.md**

Read the file to understand the existing format.

- [ ] **Step 2: Add v3.0.0 entry**

Prepend a new entry at the top following the existing format:

```markdown
## [3.0.0] - 2026-03-29

### Added
- OpenSpec integration: 4 new skills (propose, explore, apply, archive) with CLI detection and fallback mode
- Vendor skill management: `supermind skill add/update/list/remove` with skills-lock.json versioning
- Pre-merge checklist hook: advisory warnings for living docs, OpenSpec archival, and code review
- Improvement logger hook: append-only session tracking to ~/.claude/improvement-log.jsonl
- Template CLAUDE.md: subagent strategy section with parallelism rules and milestone decomposition
- Template CLAUDE.md: 6-phase development lifecycle (setup, design, implement, test, pre-merge, merge)
- Template CLAUDE.md: OpenSpec workflow section with skill references
- Template CLAUDE.md: vendor skills section with CLI commands
- Project-local config scaffolding in /supermind-init (settings.local.json, .mcp.json)
- OpenSpec project scaffolding in /supermind-init
- CLI: `supermind openspec install/doctor` commands
- CLI: `supermind skill add/update/list/remove` commands

### Changed
- Template CLAUDE.md: permissions section rewritten to banlist model (document what's banned, not what's allowed)
- Template CLAUDE.md: worktree section replaced with comprehensive 6-phase lifecycle
- Install command: 9 steps (was 7), adds OpenSpec CLI setup and verification
- Doctor command: checks OpenSpec CLI, vendor skill integrity, improvement log
- Update command: 5 steps (was 4), adds vendor skill check
- Hook count: 7 (was 5)
- Skill count: 7 directories (was 3)

### Breaking
- Template CLAUDE.md completely rewritten — run /supermind-init to merge new sections into existing projects
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add v3.0.0 changelog entry"
```

---

### Task 21: Update CLAUDE.md (repo instructions)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read current CLAUDE.md**

Read the file to understand the current structure.

- [ ] **Step 2: Update File Organization section**

Update the file organization to reflect new directories and counts:
```markdown
- `cli/` — Installer commands (install, update, doctor, uninstall, skill, openspec)
- `hooks/` — Runtime hooks copied to `~/.claude/hooks/` (7 hooks: bash-permissions, session-start, session-end, cost-tracker, statusline, pre-merge-checklist, improvement-logger)
- `skills/` — SKILL.md files copied to `~/.claude/skills/` (7 dirs: supermind, supermind-init, supermind-living-docs, openspec-propose, openspec-explore, openspec-apply, openspec-archive)
- `cli/lib/` — Shared utilities (paths, settings, hooks, skills, templates, mcp, plugins, logger, vendor-skills, openspec)
- `templates/` — CLAUDE.md project template copied to `~/.claude/templates/`
```

- [ ] **Step 3: Add OpenSpec Integration section**

Add after the Skill System section:
```markdown
## OpenSpec Integration
- OpenSpec CLI is detected/installed during `supermind install` (step 8)
- 4 OpenSpec skills ship with supermind: propose, explore, apply, archive
- Skills use CLI when available, fall back to manual directory/file creation
- `/supermind-init` scaffolds `openspec/` directory in new projects
- `supermind openspec install` — standalone CLI installer
- `supermind openspec doctor` — check CLI health
```

- [ ] **Step 4: Add Vendor Skill System section**

```markdown
## Vendor Skill System
- `supermind skill add <github-url> [--global]` — install from GitHub repo
- `supermind skill update [name] [--all]` — refresh from source
- `supermind skill list` — show installed with source and version
- `supermind skill remove <name>` — remove skill and lock entry
- Global lock: `~/.claude/skills-lock.json`, Project lock: `.claude/skills-lock.json`
- All git operations use execFileSync with argument arrays (no shell injection)
```

- [ ] **Step 5: Add Hook Reference table**

```markdown
## Hook Reference
| Hook | Event | Matcher | Purpose |
|------|-------|---------|---------|
| bash-permissions.js | PreToolUse | Bash | Command permission classification |
| session-start.js | SessionStart | — | Load session + living docs |
| session-end.js | Stop | — | Save session summary |
| cost-tracker.js | Stop | — | Log session cost |
| statusline-command.js | statusLine | — | Two-line terminal display |
| pre-merge-checklist.js | PostToolUse | Bash | Advisory pre-merge warnings |
| improvement-logger.js | Stop | — | Session improvement tracking |
```

- [ ] **Step 6: Update Skill System section**

Update to mention OpenSpec skills and the `auto-trigger` behavior:
- When a user asks to explore/propose/implement/archive a change, the corresponding OpenSpec skill fires

- [ ] **Step 7: Update Development Workflow section**

Replace references to "worktree-only workflow" with the 6-phase development lifecycle. The section should reference the template's Development Lifecycle section and explain that all non-trivial changes follow it.

- [ ] **Step 8: Update Release Checklist**

Add OpenSpec archiving step to the release checklist. Between "Commit" and "After PR is squash-merged", add:
- Archive any OpenSpec changes used during development: `/openspec-archive`

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for v3.0 architecture"
```

---

### Task 22: Update ARCHITECTURE.md

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Read current ARCHITECTURE.md**

Read the file to understand current structure.

- [ ] **Step 2: Update File Index**

Add the 10 new files to the appropriate sections of the File Index table.

- [ ] **Step 3: Update Data Flow section**

Add the new runtime flows:
- Vendor Skill Flow: `supermind skill add` -> git clone -> hash -> copy -> skills-lock.json
- OpenSpec Flow: /explore -> /propose -> /apply -> /archive
- PostToolUse flow: Bash `git merge` -> pre-merge-checklist.js -> advisory warnings
- Additional Stop hook: improvement-logger.js -> improvement-log.jsonl

- [ ] **Step 4: Update API Contracts**

Add the 6 new CLI commands to the commands table.

- [ ] **Step 5: Update Tech Stack**

Add OpenSpec CLI as optional dependency.

- [ ] **Step 6: Update Hook Registration table**

Add PostToolUse event with pre-merge-checklist, update Stop to include improvement-logger.

- [ ] **Step 7: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: update ARCHITECTURE.md for v3.0"
```

---

### Task 23: Final Verification

- [ ] **Step 1: Run doctor**

Run: `node cli/index.js doctor`

Expected: All checks pass (7 hooks, 7 skills, all plugins, OpenSpec status, version marker 3.0.0)

- [ ] **Step 2: Verify version**

Run: `node cli/index.js --version`

Expected: `3.0.0`

- [ ] **Step 3: Verify help**

Run: `node cli/index.js --help`

Expected: Shows all commands including `skill` and `openspec`

- [ ] **Step 4: Dry-run pack**

Run: `npm pack --dry-run`

Expected: Package includes all new files (hooks/, skills/, cli/, templates/)

- [ ] **Step 5: Commit any remaining changes**

If any files were missed, stage and commit them.

```bash
git add -A
git status
# If changes: git commit -m "chore: final v3.0.0 cleanup"
```
