# Supermind Rebuild — Design Specification

**Date:** 2026-03-18
**Status:** Approved
**Approach:** C — npm Package with JS CLI + Skills as Separate Concern

---

## 1. Overview

Supermind is a complete, opinionated Claude Code setup system distributed as an npm package. It provides:

- **Global setup** via `npx supermind` — installs hooks, skills, settings, plugins, MCP servers, status line, templates
- **Project-level onboarding** via `/supermind-init` — CLAUDE.md management, living documentation generation, health checks, optional skill/MCP discovery
- **Ongoing documentation** via hooks (auto-read on session start) and `/supermind-living-docs` (manual sync)

**Target audience:** Developers who want a clean, opinionated Claude Code environment. Not building a community, but clean install UX so others can use it easily.

**Platforms:** Windows, macOS, Linux

---

## 2. Repository & Package Identity

- **Repo:** Rename `claude-setup` → `supermind`
- **npm package:** `supermind-claude` (the name `supermind` is taken on npm)
- **Install:** `npx supermind-claude` (primary), or give Claude Code the repo URL and it figures it out
- **Version:** semver in `package.json` (single source of truth)
- **License:** MIT

---

## 3. CLI Commands

| Command | Purpose |
|---|---|
| `npx supermind-claude` / `npx supermind-claude install` | Full global setup |
| `npx supermind-claude update` | Lightweight refresh (hooks, skills, templates only) |
| `npx supermind-claude doctor` | Health check — verify everything works |
| `npx supermind-claude uninstall` | Clean removal of all installed components |

---

## 4. File Tree

```
supermind/
├── package.json
├── .gitignore
├── .env.example
├── CLAUDE.md                   # Instructions for working ON supermind itself
├── README.md
├── CHANGELOG.md
├── cli/
│   ├── index.js                # Entry point, arg parsing, routes to commands
│   ├── commands/
│   │   ├── install.js          # Full setup orchestrator
│   │   ├── update.js           # Lightweight refresh
│   │   ├── doctor.js           # Health check & diagnostics
│   │   └── uninstall.js        # Clean removal
│   └── lib/
│       ├── platform.js         # OS detection, path resolution
│       ├── settings.js         # Read/merge/write settings.json
│       ├── hooks.js            # Copy hook files, register in settings
│       ├── skills.js           # Install skill directories
│       ├── plugins.js          # Enable plugins in settings
│       ├── mcp.js              # MCP server setup (Docker vs Direct)
│       ├── templates.js        # Copy CLAUDE.md template
│       └── logger.js           # Colored output, banners, step formatting
├── hooks/
│   ├── bash-permissions.js     # PreToolUse: command classification
│   ├── session-start.js        # SessionStart: load session + read ARCHITECTURE.md/DESIGN.md
│   ├── session-end.js          # Stop: save session summary
│   ├── cost-tracker.js         # Stop: log session cost
│   └── statusline-command.js   # StatusLine: two-line terminal display
├── skills/
│   ├── supermind/
│   │   └── SKILL.md            # Namespace parent
│   ├── supermind-init/
│   │   ├── SKILL.md            # Project onboarding (3 phases)
│   │   ├── architecture-template.md
│   │   └── design-template.md
│   └── supermind-living-docs/
│       └── SKILL.md            # Manual doc sync
├── templates/
│   └── CLAUDE.md               # Starter template for new projects
└── airis/
    ├── docker-compose.yml      # AIRIS gateway Docker config
    └── mcp-config.json         # Direct mode MCP server registry
```

---

## 5. CLI Architecture

### 5.1 Entry Point (`cli/index.js`)

- Parse args: `install` (default), `update`, `doctor`, `uninstall`
- Route to command handler
- Handle `--help`, `--version`, `--non-interactive` (skip all prompts, use defaults), `--mcp docker|direct|skip`
- Shebang: `#!/usr/bin/env node` at top
- No external dependencies — use only Node.js built-ins (fs, path, os, child_process, readline)

### 5.2 Platform Detection (`cli/lib/platform.js`)

Resolves all paths cross-platform:

| Path | Windows | macOS/Linux |
|---|---|---|
| Claude home | `%APPDATA%\claude` or `~/.claude` | `~/.claude` |
| Settings | `~/.claude/settings.json` | `~/.claude/settings.json` |
| Hooks dir | `~/.claude/hooks/` | `~/.claude/hooks/` |
| Skills dir | `~/.claude/skills/` | `~/.claude/skills/` |
| Templates dir | `~/.claude/templates/` | `~/.claude/templates/` |
| Sessions dir | `~/.claude/sessions/` | `~/.claude/sessions/` |

Exports: `getClaudeHome()`, `getHooksDir()`, `getSkillsDir()`, `getTemplatesDir()`, `getSessionsDir()`, `ensureDir(path)`

### 5.3 Settings Management (`cli/lib/settings.js`)

Non-destructive merge strategy:
1. Read existing `settings.json` (if any)
2. Backup existing settings before first write (`settings.json.backup`)
3. Merge Supermind defaults using key-type-aware strategy:
   - **Scalars** (strings, booleans, numbers): set only if key is absent (never overwrite user values)
   - **Objects** (enabledPlugins, extraKnownMarketplaces, permissions): recursive merge, add missing keys, preserve existing
   - **Arrays** (hooks arrays, permissions.allow): union/deduplicate by matching on command string or hook command path
   - **Supermind-owned keys**: `statusLine`, hook entries pointing to `~/.claude/hooks/supermind-*` or known Supermind hook filenames — these are always overwritten on install/update
4. Write merged settings

**Identifying Supermind-owned entries:** Hook entries are identified by their command path containing Supermind hook filenames (bash-permissions.js, session-start.js, session-end.js, cost-tracker.js, statusline-command.js). Plugin entries are identified by known plugin IDs. This allows uninstall to remove only Supermind entries.

Handles: `permissions`, `enabledPlugins`, `extraKnownMarketplaces`, `statusLine`, `hooks`, `alwaysThinkingEnabled`, `effortLevel`

### 5.4 Hook Installation (`cli/lib/hooks.js`)

- Copy all hook files from package's `hooks/` to `~/.claude/hooks/`
- Overwrite existing (hooks are owned by Supermind)
- Register hooks in settings.json under the correct event keys

### 5.5 Skill Installation (`cli/lib/skills.js`)

- Copy skill directories from package's `skills/` to `~/.claude/skills/`
- Preserve directory structure (supermind/, supermind-init/, supermind-living-docs/)
- Overwrite existing (skills are owned by Supermind)

### 5.6 Plugin Enablement (`cli/lib/plugins.js`)

Enables plugins by writing to `settings.json.enabledPlugins` (does not invoke `claude plugin install` subprocess — avoids runtime dependency on `claude` being in PATH). Plugins activate when Claude Code next starts or restarts.

Plugins:
- `superpowers@claude-plugins-official`
- `claude-md-management@claude-plugins-official`
- `frontend-design@claude-plugins-official`
- `ui-ux-pro-max@ui-ux-pro-max-skill` (with marketplace config in `extraKnownMarketplaces`)

### 5.7 MCP Server Setup (`cli/lib/mcp.js`)

Interactive choice via readline (skipped with `--non-interactive` or `--mcp docker|direct|skip`):
- **Docker mode:** Copy docker-compose.yml and mcp-config.json to `~/.claude/airis/`, start containers if Docker available. Uses `docker compose` (v2, not deprecated `docker-compose` v1).
- **Direct mode:** Configure individual MCP servers via npx/uvx in settings
- **Skip:** Don't configure MCP servers

Handles API key prompts (Tavily, 21st.dev) and `.env` management.

### 5.8 Template Installation (`cli/lib/templates.js`)

Copy `templates/CLAUDE.md` to `~/.claude/templates/CLAUDE.md`.

### 5.9 Logger (`cli/lib/logger.js`)

Consistent output formatting:
- `banner()` — Supermind ASCII/styled banner with version
- `step(n, total, message)` — `[3/7] Installing hooks...`
- `success(message)` — green checkmark
- `warn(message)` — yellow warning
- `error(message)` — red X
- `info(message)` — dim info text

### 5.10 Install Command (`cli/commands/install.js`)

Orchestrates all 7 steps in order:
1. `platform.js` — detect OS, resolve paths, ensure directories
2. `settings.js` — backup & merge settings
3. `hooks.js` — install hooks
4. `skills.js` — install skills
5. `plugins.js` — enable plugins
6. `mcp.js` — MCP server setup (interactive)
7. `templates.js` — install templates

Prints summary at end with next steps.

### 5.11 Update Command (`cli/commands/update.js`)

1. Read installed version from `~/.claude/.supermind-version` (written by install/update)
2. Compare to package.json version
3. Log: "Updating from X.Y.Z to A.B.C" or "Already at X.Y.Z, refreshing files"
4. Overwrite: hooks, skills, templates
5. Write new version to `~/.claude/.supermind-version`
6. Print what was updated

Always idempotent — safe to run repeatedly.

### 5.12 Doctor Command (`cli/commands/doctor.js`)

Checks (pass/fail/warn for each):
- Node.js version ≥ 18
- `~/.claude/` directory exists
- `settings.json` exists and is valid JSON
- All expected hooks present in `~/.claude/hooks/` (derived from package's `hooks/` directory at runtime, not hardcoded count)
- Hooks registered in settings.json
- All expected skill directories present in `~/.claude/skills/` (derived from package's `skills/` directory at runtime)
- Plugins enabled in settings
- CLAUDE.md template present
- Session directory writable
- Docker available (if using AIRIS mode)
- MCP servers responding (if configured)

### 5.13 Uninstall Command (`cli/commands/uninstall.js`)

- Remove hooks from `~/.claude/hooks/` (identified by known Supermind filenames: bash-permissions.js, session-start.js, session-end.js, cost-tracker.js, statusline-command.js)
- Remove skills from `~/.claude/skills/` (known directories: supermind/, supermind-init/, supermind-living-docs/)
- Remove template (`~/.claude/templates/CLAUDE.md`)
- Remove Supermind entries from settings.json (identified by known hook command paths and plugin IDs — see Section 5.3)
- Remove `~/.claude/.supermind-version`
- Remove legacy `~/.claude/hooks.json` if present
- Optionally remove AIRIS config (`~/.claude/airis/`)
- Confirm before executing (skip with `--yes`)

---

## 6. Hooks

### 6.1 bash-permissions.js (PreToolUse)

Same logic as current, cleaned up:
- Parse compound commands (split on `&&`, `||`, `;`)
- Classify each segment against safe/dangerous lists
- Worktree-aware (auto-approve merge/remove/branch-d in `.worktrees/`)
- Output: `{ permissionDecision: "allow" | "ask", reason: "..." }`
- Under 150 lines, constants at top

### 6.2 session-start.js (SessionStart)

Merged responsibility — session context + living docs:
1. Load most recent session file from `~/.claude/sessions/` (max 7 days old)
2. Resolve project root via `process.env.PROJECT_DIR` (set by Claude Code's hook runner) with fallback to `process.cwd()`
3. Check for `ARCHITECTURE.md` in project root — if exists, read and extract:
   - The Overview section (first paragraph)
   - The Tech Stack table
   - Section headings only for remaining sections (as a table of contents)
   - Truncate to ~200 tokens max for ARCHITECTURE.md portion (priority order: Overview paragraph first, then Tech Stack table, then section headings — truncate lowest priority first if over budget)
4. Check for `DESIGN.md` in project root — if exists, read and extract:
   - The Overview section
   - Section headings only
   - Truncate to ~100 tokens max for DESIGN.md portion
5. If ARCHITECTURE.md missing, include note: "Run `/supermind-init` to set up project documentation"
6. Output combined context (~500-700 tokens total: ~300 session + ~200 architecture + ~100 design + ~100 framing)

**Note:** The extraction is structural (section headings, first paragraphs, tables) not LLM-based compression. This is implementable in pure Node.js with simple markdown parsing.

### 6.3 session-end.js (Stop)

Save session summary:
- Timestamp, project dir, git branch, modified files
- Session summary from `process.env.SESSION_SUMMARY` (note: this env var may not be set by Claude Code — if absent, saves "Session ended (no summary provided)" which is acceptable; the session file still captures branch and modified files for continuity)
- Write to `~/.claude/sessions/session-{timestamp}.json`
- Clean up old sessions (keep max 20)

### 6.4 cost-tracker.js (Stop)

Append cost entry to `~/.claude/cost-log.jsonl`:
- Reads `SESSION_ID`, `PROJECT_DIR` from environment
- Reads `CLAUDE_SESSION_COST_USD` if available (for actual cost data)
- Falls back to timestamp + project dir if cost env var not set
- Silent fail on error (non-critical hook)

### 6.5 statusline-command.js (StatusLine)

Two-line display:
- Line 1: `user@host │ model │ ~/path · branch`
- Line 2: `[context bar] % ctx · tokens/max │ thinking │ agents · cost`
- 256-color ANSI, gradient context bar
- Under 150 lines

---

## 7. Skills

### 7.1 `/supermind` (Namespace Parent)

```yaml
---
name: supermind
description: "Supermind — project initialization, living documentation, and configuration skills"
---
```

Lists children: `/supermind-init`, `/supermind-living-docs`

**Naming convention:** Skill directories and `name` fields use hyphens (`supermind-init`). Invocation is `/supermind-init`. The colon notation (`/supermind-init`) is NOT used — hyphens throughout for consistency with the SKILL.md `name` field.

### 7.2 `/supermind-init` (Project Onboarding)

```yaml
---
name: supermind-init
description: "Initialize a project with Supermind. Use when starting work in a new project, when ARCHITECTURE.md is missing, or when the user wants to set up CLAUDE.md, living documentation, and project health checks. Triggers on: new project setup, missing docs, /supermind-init"
---
```

**Phase 1 — CLAUDE.md Management:**
- No CLAUDE.md → copy from `~/.claude/templates/CLAUDE.md`, auto-detect and fill project info
- Existing CLAUDE.md → intelligent section-level merge:
  - Preserve: user's preamble, Commands, Tech Stack, Project Structure, any custom sections
  - Update: Shell & Git Permissions, Worktree Workflow, MCP Servers, UI Changes, Living Documentation
- Auto-detect from project files: package.json (scripts, dependencies), Cargo.toml, go.mod, requirements.txt, pyproject.toml, Gemfile
- Fill: test commands, build commands, tech stack, project structure overview

**Phase 2 — Living Documentation:**
- Detect if UI project (check dependencies for react, vue, svelte, angular, etc., or ask)
- Detect scope: single folder vs. entire repo vs. monorepo
- Deep scan (exclude: node_modules, dist, build, .git, __pycache__, target, vendor, .next, coverage):
  - File index (max 200 entries)
  - Tech stack detection
  - API routes, env vars, import graph, code patterns
- Generate ARCHITECTURE.md from template (or preserve existing, filling gaps)
- Generate DESIGN.md from template if UI project (or preserve existing)
- Commit generated files

**Phase 3 — Project Health & Discovery (optional, ask user):**
- Verify: hooks firing, session directory writable
- Check: Serena configured for this project? Suggest setup if not
- Spawn subagent: research additional skills/MCPs relevant to this project's stack
  - Analyze detected tech stack
  - Search for relevant Claude Code skills
  - Suggest MCP servers that would help (e.g., database MCP for DB-heavy projects)
  - Present findings to user as suggestions, not auto-install

### 7.3 `/supermind-living-docs` (Manual Sync)

```yaml
---
name: supermind-living-docs
description: "Manually sync living documentation. Use when ARCHITECTURE.md or DESIGN.md need updating after code changes, when the user asks to update docs, or as a periodic check. Does not auto-trigger — this is the manual 'sync now' command."
---
```

When invoked:
1. Read current ARCHITECTURE.md and DESIGN.md (if exists)
2. Analyze recent changes: `git diff`, modified/added/removed files
3. Reason about what sections need updating (don't update if nothing meaningful changed)
4. Make surgical edits using Edit tool (not full rewrites)
5. If changes were made, commit with descriptive message

---

## 8. Templates

### 8.1 `templates/CLAUDE.md`

Simplified starter template with:
- Quick Reference section (links to ARCHITECTURE.md, DESIGN.md)
- Commands (placeholder — `/supermind-init` fills this)
- Tech Stack (placeholder)
- Project Structure (placeholder)
- Shell & Git Permissions (complete — references bash-permissions.js hook)
- Worktree Development Workflow (complete)
- MCP Servers (complete — lists available servers)
- UI Changes (complete — references /ui-ux-pro-max)
- Living Documentation (complete — explains hook + manual sync)

### 8.2 `architecture-template.md`

Skeleton with sections: Overview, Tech Stack, File Index, Dependencies & Data Flow, API Contracts, Environment Variables, Key Patterns & Conventions

### 8.3 `design-template.md`

Skeleton with sections: Overview, Color Tokens, Typography, Spacing Scale, Component Patterns, Layout Conventions, Animation Patterns

---

## 9. Release & Development Pipeline

### 9.1 Development Workflow

1. User describes desired change
2. Claude creates worktree, implements, reviews (code-reviewer agent), fixes until clean
3. Claude bumps version in `package.json`, updates `CHANGELOG.md`
4. Claude presents changes, asks user to approve merge
5. User approves → merge back to master
6. User runs `npm publish` (or Claude runs with approval)

### 9.2 Versioning Rules

- Bug fixes / minor improvements → patch (1.1.0 → 1.1.1)
- New features / new skills → minor (1.1.0 → 1.2.0)
- Breaking changes → major (1.1.0 → 2.0.0)

### 9.3 CHANGELOG.md Format

```markdown
# Changelog

## [1.2.0] - 2026-03-19
### Added
- Feature description
### Changed
- Change description
### Fixed
- Fix description
```

### 9.4 CLAUDE.md for Supermind Repo

The repo's own CLAUDE.md includes:
- Project overview (what Supermind is)
- Development rules (worktree workflow, versioning, changelog)
- File organization guide (where things go)
- Release checklist (version bump, changelog, test, publish)

---

## 10. Migration Plan

### Delete from repo
- `setup.sh`, `update.sh` — replaced by CLI
- `hooks.json` — replaced by settings.json management in CLI
- `VERSION` — replaced by package.json version
- `RESEARCH-PROMPT.md`, `OPTIMAL-SETUP-REPORT.md` — one-time research artifacts
- `research/` directory — one-time research
- Old `skills/supermind/` with nested init/living-docs — replaced by flat skill directories
- `settings.json` — no longer shipped as a static file; settings are constructed programmatically by `cli/lib/settings.js`
- `SETUP.md` — replaced by README.md with install instructions

### Clean up on user's machine (during install)
- Remove `~/.claude/hooks.json` if present (legacy file, prevents duplicate hook firing)
- Remove old skill paths: `~/.claude/skills/supermind/init/`, `~/.claude/skills/supermind/living-docs/`, `~/.claude/skills/sm/`

### Rewrite from Scratch
- All hooks (cleaner, consistent patterns, under 150 lines each)
- All skills (skill-creator patterns)
- `CLAUDE.md` (for the Supermind repo itself)
- `README.md` (Supermind branding, npm install instructions)
- Templates

### Keep (clean up)
- `airis/` config (docker-compose.yml, mcp-config.json)
- `.env.example`
- `.gitignore` (update entries)

### New
- `package.json` (npm package definition)
- `cli/` directory (entire CLI)
- `CHANGELOG.md` (fresh start from 2.0.0)

---

## 11. Cross-Platform Considerations

- All path handling uses `path.join()` / `path.resolve()`, never hardcoded separators
- Use `os.homedir()` for `~` resolution
- File operations use `fs.mkdirSync({ recursive: true })` for directory creation
- Shell commands in hooks use cross-platform alternatives where possible
- Git commands work identically across platforms
- Docker detection: check `docker` command availability
- UV/UVX installation: platform-specific install commands in MCP setup

---

## 12. package.json

```json
{
  "name": "supermind-claude",
  "version": "2.0.0",
  "description": "Complete, opinionated Claude Code setup — hooks, skills, status line, MCP servers, and living documentation",
  "bin": {
    "supermind-claude": "./cli/index.js",
    "supermind": "./cli/index.js"
  },
  "files": [
    "cli/",
    "hooks/",
    "skills/",
    "templates/",
    "airis/",
    ".env.example"
  ],
  "keywords": ["claude", "claude-code", "ai", "developer-tools", "mcp"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/USER/supermind"
  },
  "engines": {
    "node": ">=18"
  }
}
```

Zero runtime dependencies. Node.js built-ins only.

---

## 13. README.md Structure

- **What is Supermind** — one-paragraph description
- **Quick Install** — `npx supermind-claude` + what it does
- **What Gets Installed** — table of hooks, skills, plugins, settings
- **Project Setup** — how to use `/supermind-init` in a new project
- **Living Documentation** — how auto-read and manual sync work
- **Status Line** — screenshot/description of the two-line display
- **MCP Servers** — Docker vs Direct mode, what's included
- **Updating** — `npx supermind-claude update`
- **Uninstalling** — `npx supermind-claude uninstall`
- **Platforms** — Windows, macOS, Linux support notes
- **Troubleshooting** — common issues and `npx supermind-claude doctor`
