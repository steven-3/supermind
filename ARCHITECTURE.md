# Architecture

## Overview

Supermind is a zero-dependency Node.js CLI (`supermind-claude`) that provides complete Claude Code setup — hooks, skills, status line, MCP servers, and living documentation. It installs into `~/.claude/` via a copy-on-install pattern, merging configuration non-destructively into `settings.json` to preserve user customizations.

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Node.js >= 18 | CLI and hook execution |
| Language | JavaScript (CommonJS) | All source files |
| Stdlib | fs, path, os, child_process, readline | File ops, process info, CLI prompts |
| Package | npm (supermind-claude) | Distribution and global install |
| MCP (optional) | context7, playwright, serena, tavily, shadcn, chrome-devtools | Code nav, browser testing, search, UI components |
| MCP Gateway (optional) | AIRIS (Docker) | Cold-start MCP server management |

## File Index

| Path | Purpose |
|------|---------|
| `cli/index.js` | Entry point — parses argv, routes to commands, handles --help/--version |
| `cli/commands/install.js` | Full setup: creates ~/.claude dirs, merges settings, installs hooks/skills/plugins/MCP/templates |
| `cli/commands/update.js` | Refreshes hooks, skills, templates; re-merges hook settings; updates version marker |
| `cli/commands/doctor.js` | Health check: validates Node version, ~/.claude structure, settings, hooks, skills, Docker |
| `cli/commands/uninstall.js` | Removes all Supermind components from ~/.claude, cleans settings |
| `cli/commands/approve.js` | Manages ~/.claude/supermind-approved.json (add/list/remove auto-approved command patterns) |
| `cli/lib/platform.js` | PATHS constant and utilities: ensureDir(), getPackageRoot() |
| `cli/lib/logger.js` | Color-coded terminal output: banner(), step(), success(), warn(), error(), info() |
| `cli/lib/settings.js` | Settings I/O: readSettings(), writeSettings(), backupSettings(), mergeSettings(), removeSupermindEntries() |
| `cli/lib/hooks.js` | Hook lifecycle: installHooks(), getHookSettings(), removeHooks() |
| `cli/lib/skills.js` | Skill lifecycle: installSkills(), removeSkills(), removeLegacySkills() |
| `cli/lib/templates.js` | Template lifecycle: installTemplates(), removeTemplates() |
| `cli/lib/mcp.js` | MCP server setup: setupMcp(), promptApiKeys(), setupDocker(), setupDirect() |
| `cli/lib/plugins.js` | Plugin defaults: getPluginDefaults() returns enabledPlugins and marketplace config |
| `hooks/bash-permissions.js` | PreToolUse hook — classifies bash commands as allow/ask based on safe lists and approved patterns |
| `hooks/session-start.js` | SessionStart hook — loads previous session summary, injects ARCHITECTURE.md and DESIGN.md |
| `hooks/session-end.js` | Stop hook — saves session context to ~/.claude/sessions/, tracks git branch and modified files |
| `hooks/cost-tracker.js` | Stop hook (async) — appends session cost estimate to ~/.claude/cost-log.jsonl |
| `hooks/statusline-command.js` | Status line renderer — shows user, host, git branch, context usage, agents, session cost |
| `skills/supermind/SKILL.md` | Parent namespace listing /supermind-init and /supermind-living-docs |
| `skills/supermind-init/SKILL.md` | Project onboarding: CLAUDE.md merge, ARCHITECTURE.md + DESIGN.md generation, health checks |
| `skills/supermind-init/architecture-template.md` | Skeleton template for ARCHITECTURE.md |
| `skills/supermind-init/design-template.md` | Skeleton template for DESIGN.md |
| `skills/supermind-living-docs/SKILL.md` | Manual sync trigger for ARCHITECTURE.md and DESIGN.md |
| `templates/CLAUDE.md` | Project CLAUDE.md template with infrastructure and placeholder sections |
| `airis/mcp-config.json` | Direct-mode MCP server configuration (npx/uvx launch commands) |
| `.env.example` | Environment variable template (TAVILY_API_KEY, TWENTYFIRST_API_KEY) |

## Dependencies & Data Flow

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ INSTALLATION                                                     │
│                                                                   │
│  supermind-claude install                                         │
│    ├─ platform.js → resolve PATHS (~/.claude/*)                  │
│    ├─ settings.js → backup + merge settings.json                 │
│    ├─ hooks.js → copy hooks/*.js → ~/.claude/hooks/              │
│    ├─ skills.js → copy skills/*/ → ~/.claude/skills/             │
│    ├─ templates.js → copy templates/ → ~/.claude/templates/      │
│    ├─ plugins.js → inject plugin defaults                        │
│    └─ mcp.js → setup Docker/direct MCP servers                   │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ RUNTIME (Claude Code Session)                                    │
│                                                                   │
│  SessionStart → session-start.js                                 │
│    ├─ Load previous session from ~/.claude/sessions/             │
│    └─ Read ARCHITECTURE.md + DESIGN.md into context              │
│                                                                   │
│  PreToolUse (Bash) → bash-permissions.js                         │
│    ├─ Split compound commands on && || ;                         │
│    ├─ Check against SAFE_* lists                                 │
│    ├─ Check ~/.claude/supermind-approved.json                    │
│    └─ Return allow | ask                                         │
│                                                                   │
│  Stop → session-end.js + cost-tracker.js                         │
│    ├─ Save session summary → ~/.claude/sessions/                 │
│    └─ Append cost entry → ~/.claude/cost-log.jsonl               │
└─────────────────────────────────────────────────────────────────┘
```

### File Dependencies

| File | Depends On | Used By |
|------|-----------|---------|
| `cli/index.js` | package.json | Entry point (bin) |
| `cli/commands/install.js` | platform, logger, settings, hooks, skills, plugins, mcp, templates | index.js |
| `cli/commands/update.js` | platform, logger, settings, hooks, skills, templates, package.json | index.js |
| `cli/commands/doctor.js` | platform, logger, settings, hooks, skills, package.json | index.js |
| `cli/commands/uninstall.js` | platform, logger, settings, hooks, skills, templates, readline | index.js |
| `cli/commands/approve.js` | fs, path, platform, logger | index.js |
| `cli/lib/platform.js` | fs, path, os | All commands, all lib modules |
| `cli/lib/logger.js` | package.json | All commands |
| `cli/lib/settings.js` | fs, platform, logger, plugins | install, update, doctor, uninstall |
| `cli/lib/hooks.js` | fs, path, platform, logger | install, update, doctor, uninstall |
| `cli/lib/skills.js` | fs, path, platform, logger | install, update, doctor, uninstall |
| `cli/lib/templates.js` | fs, path, platform, logger | install, uninstall |
| `cli/lib/mcp.js` | fs, path, readline, child_process, platform, logger | install |
| `cli/lib/plugins.js` | (none) | install, settings (soft — fallback on load failure) |
| `hooks/bash-permissions.js` | fs, path, os | Runtime (PreToolUse) |
| `hooks/session-start.js` | fs, path, os | Runtime (SessionStart) |
| `hooks/session-end.js` | fs, path, os, child_process | Runtime (Stop) |
| `hooks/cost-tracker.js` | fs, path, os | Runtime (Stop) |
| `hooks/statusline-command.js` | fs, path, child_process | Runtime (statusLine) |

## API Contracts

| Command | Flags | Purpose |
|---------|-------|---------|
| `supermind-claude [install]` | `--non-interactive`, `--mcp docker\|direct\|skip`, `--yes`, `--help`, `--version` | Full global setup (default command) |
| `supermind-claude update` | `--non-interactive` | Refresh hooks, skills, templates |
| `supermind-claude doctor` | (none) | Health check report |
| `supermind-claude uninstall` | `--yes`, `--non-interactive` | Remove all Supermind components |
| `supermind-claude approve <pattern>` | `--list`, `--remove` | Manage auto-approved bash commands |

### Hook Registration (in settings.json)

| Hook Event | Timeout | Script | Matcher |
|-----------|---------|--------|---------|
| PreToolUse | 5s | bash-permissions.js | Bash only |
| SessionStart | — | session-start.js | All |
| Stop | async | session-end.js | All |
| Stop | async | cost-tracker.js | All |
| statusLine | — | statusline-command.js | Command output |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `TAVILY_API_KEY` | No | Tavily search MCP server |
| `TWENTYFIRST_API_KEY` | No | 21st Dev API key |
| `HOME` / `USERPROFILE` | Yes (OS) | Home directory resolution |
| `USER` / `USERNAME` | Yes (OS) | Status line display |
| `CLAUDE_SESSION_COST_USD` | Auto | Session cost estimate (injected by Claude Code) |
| `PROJECT_DIR` | Auto | Project directory (injected by Claude Code) |
| `SESSION_ID` | Auto | Session identifier (injected by Claude Code) |
| `SESSION_SUMMARY` | Auto | Session summary text (injected by Claude Code) |
| `CLAUDE_MODEL_NAME` | Auto | Model display name fallback |

## Key Patterns & Conventions

- **Zero external dependencies** — pure Node.js stdlib (fs, path, os, child_process, readline)
- **CommonJS modules** — each lib file exports functions/objects, no classes
- **Lazy command loading** — index.js requires command modules on demand
- **Copy-on-install** — package files copied to ~/.claude/ on install, removed on uninstall
- **Non-destructive settings merge** — preserves user customizations, Supermind entries identified by hook filename
- **Settings backup** — settings.json.backup created on first install (never overwritten on subsequent runs due to existence check)
- **Fallback error handling** — try-catch returns defaults (readSettings → {}, getHookFiles → KNOWN_HOOKS); non-critical failures silently skip
- **Color-coded logging** — step(n, total, msg) progress counters, success/warn/error with ANSI symbols
- **Command classification** — bash-permissions.js uses categorized lists (SAFE_READ_COMMANDS, SAFE_WRITE_COMMANDS, SAFE_PREFIXES, GIT_SAFE_READ, GIT_SAFE_WRITE, GIT_STASH_DESTRUCTIVE, GIT_WORKTREE_ONLY, GIT_DANGEROUS, DANGEROUS_PATTERNS, GH_DANGEROUS_PATTERNS) with compound command splitting
- **Session rotation** — max 20 session files in ~/.claude/sessions/, oldest pruned on save
