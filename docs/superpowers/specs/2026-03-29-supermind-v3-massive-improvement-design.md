# Supermind v3.0 — Massive Improvement Design Specification

**Date:** 2026-03-29
**Status:** Draft
**Approach:** A — Big Bang v3.0 (all improvements in single release)
**Prior art:** lead-scout-finder CLAUDE.md/OpenSpec commands, ai-web-builder OpenSpec skills, supermind v2.1.1

---

## 1. Overview

Supermind v3.0 evolves from a "Claude Code setup tool" into a **complete development workflow engine**. It retains everything from v2.x (hooks, skills, status line, MCP servers, living documentation) and adds:

1. **OpenSpec integration** — bundled CLI + 4 workflow skills (propose/explore/apply/archive)
2. **Vendor skill imports** — `supermind skill add <repo>` with `skills-lock.json` versioning
3. **Template CLAUDE.md overhaul** — banlist permissions, aggressive parallelism, milestone decomposition, 6-phase dev lifecycle
4. **Project-local config scaffolding** — `.claude/settings.local.json` and `.mcp.json` generation during `/supermind-init`
5. **New hooks** — pre-merge checklist, improvement logging
6. **CLI expansions** — `supermind skill`, `supermind openspec` subcommand trees

**Target audience:** Steven (primary), plus any Claude Code user who wants an opinionated, high-velocity workflow.

**Zero-dependency constraint preserved.** The supermind package itself remains pure Node.js. OpenSpec CLI is installed as a separate global npm package, not bundled as a dependency.

---

## 2. Architecture Delta from v2.x

### New files and directories

```
supermind/
├── cli/
│   ├── commands/
│   │   ├── install.js          # Updated: adds OpenSpec CLI install step
│   │   ├── update.js           # Updated: refreshes OpenSpec skills + vendor skills
│   │   ├── doctor.js           # Updated: checks OpenSpec CLI, vendor skill integrity
│   │   ├── uninstall.js        # Updated: removes OpenSpec skills, vendor skills
│   │   ├── skill.js            # NEW: vendor skill management (add/update/list/remove)
│   │   └── openspec.js         # NEW: OpenSpec CLI wrapper/installer
│   └── lib/
│       ├── vendor-skills.js    # NEW: vendor skill fetching, hashing, lock file
│       ├── openspec.js         # NEW: OpenSpec CLI detection, installation, version check
│       └── ...existing...
├── hooks/
│   ├── ...existing 5 hooks...
│   ├── pre-merge-checklist.js  # NEW: PostToolUse hook for git merge
│   └── improvement-logger.js   # NEW: Stop hook for improvement logging
├── skills/
│   ├── ...existing 3 skill dirs...
│   ├── openspec-propose/       # NEW
│   │   └── SKILL.md
│   ├── openspec-explore/       # NEW
│   │   └── SKILL.md
│   ├── openspec-apply/         # NEW
│   │   └── SKILL.md
│   └── openspec-archive/       # NEW
│       └── SKILL.md
└── templates/
    └── CLAUDE.md               # REWRITTEN: banlist, parallelism, lifecycle, OpenSpec
```

### Modified files

| File | Change |
|------|--------|
| `cli/index.js` | Add `skill` and `openspec` command routing |
| `cli/commands/install.js` | Add OpenSpec CLI install step, OpenSpec skill install step |
| `cli/commands/update.js` | Add vendor skill update, OpenSpec skill refresh |
| `cli/commands/doctor.js` | Add OpenSpec CLI check, vendor skill hash verification |
| `cli/commands/uninstall.js` | Add OpenSpec skill removal, vendor skill cleanup |
| `cli/lib/hooks.js` | Register 2 new hooks |
| `cli/lib/skills.js` | Handle 4 new OpenSpec skill directories |
| `cli/lib/settings.js` | Register new hook events in settings merge |
| `templates/CLAUDE.md` | Complete rewrite (see Section 3) |
| `skills/supermind-init/SKILL.md` | Add Phase 1.5 (project-local config scaffolding), update Phase 1 for new template |
| `package.json` | Version bump to 3.0.0, add files if needed |
| `CLAUDE.md` | Update to document new architecture |
| `ARCHITECTURE.md` | Update file index, API contracts, data flow |

---

## 3. Template CLAUDE.md Overhaul

The template grows from 104 lines to ~250 lines. It remains a skeleton that `/supermind-init` fills with project-specific details.

### 3.1 Permission Model — Banlist Approach

**Current (v2.x):** Lists what's auto-approved (mirrors the hook's allowlist).

**New (v3.0):** Documents what's **banned**. Everything not banned is auto-approved by the bash-permissions hook.

```markdown
## Shell and Git Permissions

A PreToolUse hook (bash-permissions.js) handles all Bash permission classification.
Everything is auto-approved UNLESS it matches a banned pattern.

**Banned** (always requires approval):
- File deletion: rm, rmdir, del
- Force flags: --force, --hard
- Destructive git: push, pull, fetch, reset, revert, rebase, clean, checkout --, restore
- Destructive stash: stash drop, stash pop, stash clear
- GitHub mutations: pr merge, pr close, issue close, repo delete, release create/delete
- npm publish (manual step)

**Worktree-only** (auto-approved only inside .worktrees/):
- git merge, git worktree remove, git branch -d

**User overrides:** ~/.claude/supermind-approved.json — manage via supermind approve "command"
```

### 3.2 Subagent Strategy Section (New)

```markdown
## Subagent Strategy

Use subagent-driven development for all non-trivial implementation.

**Task granularity:** Each subagent task touches 3 or fewer files, completable with fresh context.

**Parallelism:**
- Dispatch as many parallel subagents as tasks allow (10+ is better than 3 sequential)
- Always dispatch parallel code review agents after implementation

**Milestone decomposition:** For features with >8 tasks:
- Split into sequential milestones (each milestone = a coherent chunk)
- Execute tasks within each milestone in parallel
- Complete one milestone before starting the next
```

### 3.3 Development Lifecycle — 6 Phases (Replaces Worktree-only Section)

```markdown
## Development Lifecycle

All non-trivial changes follow this 6-phase lifecycle:

### Phase 1: Setup
- Create feature branch from current branch (never from remote ref)
- Create worktree via /using-git-worktrees skill
- Install dependencies in worktree

### Phase 2: Design and Plan
- Read ARCHITECTURE.md, DESIGN.md, relevant code
- If complex: use /openspec-explore to investigate, then /openspec-propose to create change artifacts
- If straightforward: brainstorm, then write implementation plan
- Decompose into milestones if >8 tasks

### Phase 3: Implementation
- Execute via subagent-driven development in the worktree
- Follow milestone order (if applicable), parallel within milestones
- Commit incrementally as milestones complete

### Phase 4: Test and Verify
- Run all tests; fix failures
- Verify against the plan/OpenSpec tasks
- Run code review agents in parallel; fix ALL findings (critical, minor, style — everything)
- Re-review until clean

### Phase 5: Pre-merge
- Update ARCHITECTURE.md if files, APIs, dependencies, or env vars changed
- Update DESIGN.md if colors, fonts, spacing, or components changed
- Archive OpenSpec changes (if used): /openspec-archive
- Bump version in package.json, update CHANGELOG.md

### Phase 6: Merge
- Invoke /finishing-a-development-branch to merge + clean up
- Worktree branch merges back into originating branch (never a different branch)

This entire lifecycle executes autonomously — no stopping to ask for permission.
```

### 3.4 OpenSpec Workflow Section (New)

```markdown
## OpenSpec Workflow

OpenSpec provides structured change management for complex features.

**When to use:** Features that need exploration, have unclear requirements, touch many files,
or benefit from formal proposal/design/tasks decomposition.

**Skills:**
- /openspec-explore — Thinking mode: investigate, diagram, clarify. Never writes code.
- /openspec-propose — Create a change with all artifacts (proposal.md, design.md, tasks.md)
- /openspec-apply — Implement tasks from a change, marking complete as you go
- /openspec-archive — Finalize completed change, sync specs, move to archive

**When NOT to use:** Simple bug fixes, typo corrections, config changes, fewer than 3 file edits.
```

### 3.5 Vendor Skills Section (New)

```markdown
## Vendor Skills

Project-specific skills imported from external repositories.

**Install:** supermind skill add <github-url> (project-local by default, --global for global)
**Update:** supermind skill update [name]
**List:** supermind skill list
**Remove:** supermind skill remove <name>

Tracked in skills-lock.json with source repo, commit hash, and content hash.
```

### 3.6 Sections Preserved As-Is

- Quick Reference (links to ARCHITECTURE.md, DESIGN.md)
- Commands (filled by /supermind-init)
- Tech Stack (filled by /supermind-init)
- Project Structure (filled by /supermind-init)
- MCP Servers (dynamic based on install mode)
- UI Changes (references /ui-ux-pro-max)
- Living Documentation (hook + manual sync)
- Branch safety rule (never commit directly to main/master)

---

## 4. OpenSpec Integration

### 4.1 OpenSpec CLI Management

**Install flow:**
1. `supermind install` checks if `openspec` CLI is globally available (which openspec / where openspec)
2. If not found, prompts: "OpenSpec CLI not found. Install it? (npm install -g openspec)" — auto-approve in --non-interactive mode
3. If found, checks version compatibility (minimum version constant in `cli/lib/openspec.js`, e.g., `OPENSPEC_MIN_VERSION = '1.0.0'`)
4. `supermind doctor` reports OpenSpec CLI status (installed/missing/outdated)
5. `supermind openspec install` — standalone command to install/update OpenSpec CLI

**Implementation:** `cli/lib/openspec.js` handles detection, installation, version parsing.

### 4.2 OpenSpec Skills (4 new skills)

All 4 skills are adapted from ai-web-builder's versions, with these changes:
- Remove ai-web-builder-specific context
- Add fallback behavior when OpenSpec CLI is not available
- Reference supermind's development lifecycle phases

#### openspec-propose/SKILL.md

```yaml
---
name: openspec-propose
description: "Propose a new change with all artifacts generated in one step. Use when the user wants to describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation."
---
```

**Behavior:**
1. Derive kebab-case change name from user input (or ask)
2. Run `openspec new change "<name>"` to scaffold directory
3. Get artifact build order via `openspec status --change "<name>" --json`
4. Create artifacts in dependency order (proposal.md then design.md then tasks.md)
5. For each artifact: get instructions via `openspec instructions <id> --change "<name>" --json`, read dependencies, create file
6. Show final status

**Fallback (no CLI):** Manually create `openspec/changes/<name>/` with proposal.md, design.md, tasks.md using built-in templates. No .openspec.yaml schema validation, but same directory structure.

#### openspec-explore/SKILL.md

```yaml
---
name: openspec-explore
description: "Enter explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change. Never writes code."
---
```

**Behavior:**
- Thinking-only mode: read files, search code, investigate, visualize with ASCII diagrams
- Never write application code (creating OpenSpec artifacts is OK)
- Check for existing changes via `openspec list --json`
- If a change exists, read its artifacts for context
- Offer to capture insights to artifacts (user decides)
- No fixed steps — adaptive, curious, patient stance

**Fallback (no CLI):** Check openspec/changes/ directory directly instead of using CLI commands. Same behavior otherwise.

#### openspec-apply/SKILL.md

```yaml
---
name: openspec-apply
description: "Implement tasks from an OpenSpec change. Use when a change has been proposed and the user wants to start building. Reads all artifacts for context, implements tasks sequentially, marks complete as it goes."
---
```

**Behavior:**
1. Select change (infer from context or ask)
2. Read all context files (proposal.md, design.md, specs/, tasks.md)
3. Implement tasks sequentially, marking `- [ ]` to `- [x]` as each completes
4. Pause on blockers, unclear requirements, or discovered design issues
5. Show progress: "N/M tasks complete"

**Fallback (no CLI):** Read task files directly, parse markdown checkboxes.

#### openspec-archive/SKILL.md

```yaml
---
name: openspec-archive
description: "Archive a completed OpenSpec change. Use when all tasks are done and the change is ready to be finalized. Checks completion, syncs specs, moves to archive."
---
```

**Behavior:**
1. Check artifact and task completion status
2. Assess delta spec sync (compare change specs with main specs)
3. Prompt for spec sync before archiving
4. Create `openspec/changes/archive/YYYY-MM-DD-<name>/` directory
5. Move change files to archive
6. Show summary

**Fallback (no CLI):** Manual directory move and completion checking.

### 4.3 supermind-init Integration

Phase 2.5 (new, after living docs, before health check):

**OpenSpec Scaffolding:**
1. Check if openspec CLI is available
2. If available: run `openspec init` in project root (creates openspec/ directory with default schema)
3. If not available: create openspec/changes/ directory manually
4. Add openspec/changes/archive/ to .gitignore if not already present
5. Note in output: "OpenSpec initialized. Use /openspec-propose to create your first change."

---

## 5. Vendor Skill Imports

### 5.1 CLI Subcommand: supermind skill

```
supermind skill add <github-url> [--global]    # Install skill from GitHub repo
supermind skill update [name] [--all]          # Update skill(s) from source
supermind skill list                           # Show installed vendor skills
supermind skill remove <name>                  # Remove skill + lock entry
```

### 5.2 Add Flow

```
supermind skill add github.com/cloudflare/skills --global
```

1. Parse GitHub URL — extract owner, repo, optional path within repo
2. Clone repo to temp directory (shallow clone: git clone --depth 1)
3. Detect skill directories: look for SKILL.md files in the repo/path
4. For each skill found:
   a. Compute content hash (SHA-256 of concatenated file contents)
   b. Copy skill directory to target (~/.claude/skills/ if --global, .claude/skills/ if project-local)
   c. Record in skills-lock.json
5. Clean up temp directory
6. Report: "Installed N skills from <repo>"

### 5.3 skills-lock.json Format

```json
{
  "skills": {
    "cloudflare": {
      "source": "github.com/cloudflare/skills",
      "path": "cloudflare",
      "branch": "main",
      "commit": "abc1234",
      "hash": "sha256:def5678...",
      "installedAt": "2026-03-29T12:00:00Z",
      "scope": "global"
    },
    "stripe-best-practices": {
      "source": "github.com/stripe/ai",
      "path": "skills/stripe-best-practices",
      "branch": "main",
      "commit": "fed8765",
      "hash": "sha256:123abc...",
      "installedAt": "2026-03-29T12:00:00Z",
      "scope": "project"
    }
  }
}
```

**Lock file locations:**
- Global skills: ~/.claude/skills-lock.json
- Project-local skills: .claude/skills-lock.json

### 5.4 Update Flow

```
supermind skill update cloudflare
```

1. Read lock entry for the skill
2. Shallow clone source repo
3. Compute new content hash
4. If hash differs: copy new files, update lock entry
5. If hash matches: "Already up to date"
6. `supermind skill update --all` updates all skills in both global and project-local lock files

### 5.5 Doctor Integration

`supermind doctor` adds:
- Check: global skills-lock.json exists and is valid JSON
- For each locked skill: verify the skill directory exists at the expected path
- Optional (with --verify-hashes): recompute content hashes and flag mismatches

### 5.6 Implementation: cli/lib/vendor-skills.js

Exports:
- `addSkill(url, options)` — full add flow
- `updateSkill(name, options)` — full update flow
- `listSkills(options)` — read + format lock files
- `removeSkill(name, options)` — remove files + lock entry
- `verifySkills(options)` — hash verification for doctor
- `readLockFile(scope)` — read global or project lock file
- `writeLockFile(scope, data)` — write lock file

Uses Node.js built-in `crypto` for hashing and `child_process` for git operations (maintaining zero-dependency constraint). All git operations use `execFileSync` with argument arrays to prevent shell injection.

---

## 6. Project-Local Config Scaffolding

### 6.1 .claude/settings.local.json Generation

Added to /supermind-init Phase 1 (after CLAUDE.md management):

1. Detect project stack from package.json, Cargo.toml, go.mod, etc.
2. Generate permission allows based on stack:

| Stack | Auto-allowed |
|-------|-------------|
| Node.js | npm install, npm run, npm test, npx, node, tsc |
| Python | pip install, pytest, python, uv |
| Rust | cargo build, cargo test, cargo run, cargo clippy |
| Go | go build, go test, go run, go vet |
| Ruby | bundle install, bundle exec, rake, rspec |

3. Add WebSearch and semgrep scan as defaults
4. Write to .claude/settings.local.json (only if file does not exist — never overwrite)

### 6.2 .mcp.json Generation

Added to /supermind-init Phase 1:

1. Scan for service indicators:
   - @supabase/supabase-js in dependencies — suggest Supabase MCP
   - railway in scripts or dependencies — suggest Railway MCP
   - Database URLs in .env.example — suggest relevant DB MCP
2. Ask user which to enable (or auto-scaffold in --non-interactive)
3. Write .mcp.json with selected servers (only if file does not exist)
4. Add .mcp.json to .gitignore if it contains secrets (API keys)

---

## 7. New Hooks

### 7.1 pre-merge-checklist.js (PostToolUse)

**Event:** PostToolUse
**Matcher:** Bash commands containing `git merge`
**Timeout:** 5000ms (5 seconds)

**Behavior:**
1. Detect if the merge target is main/master
2. If merging to main/master, check:
   a. **Living docs updated:** Has ARCHITECTURE.md been modified in this session? (Check git diff against the merge source branch)
   b. **OpenSpec archived:** Are there any non-archived changes in openspec/changes/ that have all tasks completed? If so, warn: "Completed OpenSpec change not archived. Run /openspec-archive first."
   c. **Code review passed:** Check if the last code-reviewer agent run had zero critical findings (heuristic: search recent conversation for reviewer output — best-effort, not enforced)
3. Output warnings as hook output (Claude sees them, can decide to proceed or address)
4. Never blocks the merge — advisory only

**Decision:** This hook is advisory, not blocking. Claude already follows the development lifecycle which includes these steps. The hook catches the case where a step was accidentally skipped.

### 7.2 improvement-logger.js (Stop)

**Event:** Stop (async, like cost-tracker)
**Timeout:** 5000ms

**Behavior:**
1. Read environment: PROJECT_DIR, SESSION_ID, timestamp
2. Read git info: current branch, recent commits in this session (git log --oneline --since="4 hours ago")
3. Append entry to ~/.claude/improvement-log.jsonl:

```json
{
  "timestamp": "2026-03-29T15:30:00Z",
  "project": "/Users/stevenspivak/Projects/supermind",
  "branch": "feature/openspec-integration",
  "sessionId": "sess_abc123",
  "commits": ["abc1234 Add OpenSpec skills", "def5678 Update template"],
  "filesChanged": 12
}
```

4. Silent fail on error (non-critical)
5. Max file size: 10MB — rotate to improvement-log.jsonl.1 when exceeded

**Purpose:** Over time, builds a queryable log of what was built across all projects. Unlike the session files (which rotate), this is append-only and permanent.

---

## 8. CLI Expansions

### 8.1 Updated Command Tree

```
supermind [install]                    # Full setup (default)
supermind update                       # Refresh hooks, skills, templates
supermind doctor                       # Health check
supermind uninstall                    # Clean removal
supermind approve <command>            # Add to approved commands
supermind approve --list               # List approved commands
supermind approve --remove <command>   # Remove approved command
supermind skill add <url> [--global]   # NEW: Install vendor skill
supermind skill update [name] [--all]  # NEW: Update vendor skill(s)
supermind skill list                   # NEW: List vendor skills
supermind skill remove <name>          # NEW: Remove vendor skill
supermind openspec install             # NEW: Install/update OpenSpec CLI
supermind openspec doctor              # NEW: Check OpenSpec CLI health
```

### 8.2 cli/commands/skill.js

Routes subcommands:
- `add` calls vendorSkills.addSkill(url, { global: flags.global })
- `update` calls vendorSkills.updateSkill(name, { all: flags.all })
- `list` calls vendorSkills.listSkills()
- `remove` calls vendorSkills.removeSkill(name)

### 8.3 cli/commands/openspec.js

Routes subcommands:
- `install` calls openspecLib.installCli()
- `doctor` calls openspecLib.checkHealth()

### 8.4 Install Command Updates

New steps added to cli/commands/install.js:

```
[1/9] Detecting platform and creating directories
[2/9] Merging settings
[3/9] Installing hooks (7 hooks)
[4/9] Installing skills (7 skill dirs)
[5/9] Enabling plugins
[6/9] Setting up MCP servers
[7/9] Installing templates
[8/9] Installing OpenSpec CLI
[9/9] Verifying installation (runs doctor inline)
```

### 8.5 Doctor Command Updates

New checks:
- OpenSpec CLI installed and version compatible
- OpenSpec skills present in ~/.claude/skills/
- Global skills-lock.json valid (if exists)
- Vendor skill directories match lock file entries
- Pre-merge-checklist hook registered
- Improvement logger hook registered
- improvement-log.jsonl writable

---

## 9. Supermind's Own CLAUDE.md Update

The repo's CLAUDE.md must be updated to reflect the v3.0 architecture. Key additions:

### File Organization Update

```markdown
**File organization:**
- cli/ — Installer commands (install, update, doctor, uninstall, skill, openspec)
- cli/lib/ — Shared utilities (paths, settings, file ops, vendor-skills, openspec)
- hooks/ — Runtime hooks copied to ~/.claude/hooks/ (7 hooks)
- skills/ — SKILL.md files copied to ~/.claude/skills/ (7 skill directories)
- templates/ — CLAUDE.md project template copied to ~/.claude/templates/
```

### New Sections

- **OpenSpec Integration** — how the CLI is detected/installed, how skills use it, fallback behavior
- **Vendor Skill System** — how skills-lock.json works, the add/update/list/remove lifecycle
- **Hook Reference** — table of all 7 hooks with event, matcher, purpose

### Updated Sections

- **Skill System** — add OpenSpec skills, update count
- **Development Workflow** — reference 6-phase lifecycle
- **Release Checklist** — include OpenSpec archiving step
- **Versioning** — v3.0.0 is major (new CLI commands, new hooks, new skills, template rewrite)

---

## 10. ARCHITECTURE.md Update

Must be updated after implementation to reflect:

### File Index Additions

| File | Purpose |
|------|---------|
| cli/commands/skill.js | Vendor skill management CLI |
| cli/commands/openspec.js | OpenSpec CLI wrapper |
| cli/lib/vendor-skills.js | Skill fetching, hashing, lock file management |
| cli/lib/openspec.js | OpenSpec CLI detection and installation |
| hooks/pre-merge-checklist.js | Advisory pre-merge checks |
| hooks/improvement-logger.js | Session improvement logging |
| skills/openspec-propose/SKILL.md | OpenSpec propose workflow |
| skills/openspec-explore/SKILL.md | OpenSpec explore/thinking mode |
| skills/openspec-apply/SKILL.md | OpenSpec task implementation |
| skills/openspec-archive/SKILL.md | OpenSpec change archival |

### Data Flow Updates

```
Installation Flow:
CLI -> PATHS -> settings.json -> hooks(7)/skills(7)/plugins/MCP/templates -> OpenSpec CLI

Runtime Flow:
SessionStart -> [PreToolUse Bash] -> [PostToolUse merge check] -> Stop (session + cost + improvement)

Vendor Skill Flow:
supermind skill add -> git clone -> hash -> copy -> skills-lock.json

OpenSpec Flow:
/explore -> /propose -> /apply -> /archive
```

### API Contracts Updates

| Command | Args | Flags | Purpose |
|---------|------|-------|---------|
| supermind skill add | github-url | --global | Install vendor skill |
| supermind skill update | [name] | --all | Update vendor skill(s) |
| supermind skill list | — | — | List vendor skills |
| supermind skill remove | name | — | Remove vendor skill |
| supermind openspec install | — | — | Install OpenSpec CLI |
| supermind openspec doctor | — | — | Check OpenSpec health |

---

## 11. Migration from v2.x

### Breaking Changes (justifies major version bump)

1. **Template CLAUDE.md completely rewritten** — existing projects using the old template will not automatically get the new sections. `supermind update` will replace the template; /supermind-init on existing projects will merge new sections.
2. **2 new hooks** — settings.json gains new hook entries. `supermind update` handles this via settings merge.
3. **4 new skill directories** — installed alongside existing skills. No conflicts.
4. **New CLI commands** — additive, no existing commands change behavior.

### Upgrade Path

1. User runs `npm install -g supermind-claude@3` (or `npx supermind-claude@3`)
2. Installer detects v2.x installation via ~/.claude/.supermind-version
3. Runs full install with merge strategy:
   - New hooks added, existing hooks overwritten (Supermind-owned)
   - New skills added, existing skills overwritten (Supermind-owned)
   - Settings merged (new hook entries added, existing preserved)
   - Template replaced
   - OpenSpec CLI install prompted
4. .supermind-version updated to 3.0.0

### No Manual Steps Required

The v3.0 installer is fully backward-compatible with v2.x installations. No manual cleanup needed.

---

## 12. Implementation Scope Summary

| Category | Items | Effort |
|----------|-------|--------|
| Template CLAUDE.md | 1 file rewrite (~250 lines) | Medium |
| OpenSpec skills | 4 new SKILL.md files | Medium |
| OpenSpec CLI lib | 1 new lib module | Small |
| OpenSpec CLI command | 1 new command | Small |
| Vendor skill system | 1 lib module + 1 command + lock file format | Large |
| New hooks | 2 new hook files | Small |
| CLI updates | install.js, update.js, doctor.js, uninstall.js, index.js | Medium |
| supermind-init updates | SKILL.md rewrite (add config scaffolding + OpenSpec init) | Medium |
| CLAUDE.md (repo) | Update with new architecture | Small |
| ARCHITECTURE.md | Update file index, data flow, API contracts | Small |
| package.json | Version bump, update files array | Trivial |
| CHANGELOG.md | Document all changes | Small |

**Total new files:** ~10
**Total modified files:** ~12
**Estimated total lines of new/changed code:** 2500-3500

---

## 13. Design Decisions and Trade-offs

### D1: OpenSpec CLI as separate global package, not bundled

**Decision:** Supermind installs OpenSpec CLI via `npm install -g openspec`, not as a bundled dependency.

**Why:** Maintains zero-dependency constraint. OpenSpec CLI evolves independently. Users can update OpenSpec without updating supermind.

**Trade-off:** Extra install step, potential version mismatch. Mitigated by version compatibility check in doctor.

### D2: Vendor skills use git clone, not npm

**Decision:** `supermind skill add` clones from GitHub directly, does not go through npm.

**Why:** Most Claude Code skills live in GitHub repos, not npm. Git clone is universal and does not require packaging. Lead-scout-finder's skills-lock.json already validates this approach.

**Trade-off:** Requires git on the system. Acceptable — git is effectively universal for developers.

### D3: Pre-merge hook is advisory, not blocking

**Decision:** The pre-merge checklist hook outputs warnings but does not prevent the merge.

**Why:** Claude already follows the development lifecycle which includes these checks. The hook catches accidental skips. Blocking merges would require a way to override, adding complexity. The bash-permissions hook already handles actual permission blocking.

**Trade-off:** A skipped step could go unnoticed if Claude ignores the warning. Acceptable — the warning is visible in conversation.

### D4: Improvement logger is append-only JSONL, not structured DB

**Decision:** Log to ~/.claude/improvement-log.jsonl, not SQLite or similar.

**Why:** Zero dependencies. JSONL is trivially parseable with jq or Node.js readline. Append-only means no corruption risk. File rotation at 10MB prevents unbounded growth.

**Trade-off:** No indexing, no complex queries. Acceptable — the log is for trend observation, not real-time analytics.

### D5: Fallback mode for OpenSpec skills when CLI unavailable

**Decision:** OpenSpec skills work without the CLI by manually creating directory structures and parsing markdown.

**Why:** The OpenSpec workflow is valuable even without the CLI's schema validation and status tracking. Users who cannot or do not want to install the CLI still get the proposal/design/tasks/archive workflow.

**Trade-off:** No schema validation, no openspec status tracking, no artifact dependency resolution. The fallback is a simplified version. Acceptable — the CLI is recommended, fallback is a safety net.

### D6: Template grows from 104 to ~250 lines

**Decision:** Significant template expansion to encode proven patterns.

**Why:** The patterns from lead-scout-finder (banlist, parallelism, milestone decomposition, 6-phase lifecycle) are battle-tested and universally applicable. Encoding them in the template means every new project benefits immediately.

**Trade-off:** Longer CLAUDE.md means more context consumed. Mitigated by the session-start hook only extracting key sections, not loading the entire file.

### D7: All git operations use execFileSync with argument arrays

**Decision:** Never use shell-based exec for git commands in vendor-skills or openspec modules.

**Why:** Prevents shell injection when processing user-supplied GitHub URLs or skill names. execFileSync with explicit argument arrays is the safe-by-default approach.

**Trade-off:** Slightly more verbose code. Acceptable — security over convenience.
