# Architecture

## Overview

Supermind is a unified skill engine for Claude Code — combining execution infrastructure (fresh-context workers, wave parallelism, context monitoring) with behavioral discipline (TDD, systematic debugging, anti-rationalization, verification gates). Zero external dependencies. Distributed as both an npm package (`supermind-claude`) and a Claude Code plugin. Installs into `~/.claude/` via a copy-on-install pattern, merging configuration non-destructively into `settings.json` to preserve user customizations.

```
┌─────────────────────────────────────────────────────┐
│                   User Prompt                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              COMPLEXITY ROUTER                       │
│  /supermind → analyzes scope → /quick or /project    │
└──────┬───────────────────────────────┬──────────────┘
       │                               │
       ▼                               ▼
┌──────────────┐            ┌─────────────────────────┐
│  QUICK MODE  │            │     PROJECT MODE         │
│  Single-pass │            │  discuss → research →    │
│  executor    │            │  plan → execute (waves)  │
│              │            │  → verify → ship         │
└──────────────┘            └─────────────────────────┘
       │                               │
       ▼                               ▼
┌─────────────────────────────────────────────────────┐
│              EXECUTOR ENGINE                         │
│  Fresh-context subagents with injected skills        │
│  Wave parallelism for independent tasks              │
│  Context monitor (warns at 35%/25% remaining)        │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              SAFETY LAYER                            │
│  Blocklist-based bash permissions                    │
│  No push to main/master · No destructive git ops     │
│  Database operations require approval                │
│  Gate override logging to safety-log.jsonl           │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              INFRASTRUCTURE                          │
│  Session persistence · Cost tracking · Status line   │
│  Vendor skills · Settings management · Living docs   │
└─────────────────────────────────────────────────────┘
```

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

### CLI

| Path | Lines | Purpose |
|------|-------|---------|
| `cli/index.js` | 81 | Entry point — parses argv, routes to commands, handles --help/--version |
| `cli/commands/install.js` | 85 | Full setup: creates ~/.claude dirs, merges settings, installs hooks/skills/agents/MCP/templates, registers plugin |
| `cli/commands/update.js` | 75 | Refreshes hooks, skills, agents, templates, plugin manifest; re-merges hook settings |
| `cli/commands/doctor.js` | 161 | Health check: validates Node version, ~/.claude structure, settings, hooks, skills, agents, plugin registration, vendor skills |
| `cli/commands/uninstall.js` | 105 | Removes all Supermind components from ~/.claude, cleans settings, deregisters plugin |
| `cli/commands/approve.js` | 72 | Manages ~/.claude/supermind-approved.json (add/list/remove auto-approved command patterns) |
| `cli/commands/skill.js` | 164 | Vendor skill management CLI (add/update/list/remove) |

### CLI Libraries

| Path | Lines | Purpose |
|------|-------|---------|
| `cli/lib/platform.js` | 35 | PATHS constant and utilities: ensureDir(), getPackageRoot() |
| `cli/lib/logger.js` | 38 | Color-coded terminal output: banner(), step(), success(), warn(), error(), info() |
| `cli/lib/settings.js` | 144 | Settings I/O: readSettings(), writeSettings(), backupSettings(), mergeSettings(), removeSupermindEntries() |
| `cli/lib/hooks.js` | 73 | Hook lifecycle: installHooks(), getHookSettings(), removeHooks() |
| `cli/lib/skills.js` | 107 | Skill and agent lifecycle: installSkills(), removeSkills(), removeLegacySkills(), getSkillDirs(), installAgents(), removeAgents(), getAgentFiles() |
| `cli/lib/templates.js` | 71 | Template lifecycle: installTemplates(), removeTemplates() |
| `cli/lib/mcp.js` | 132 | MCP server setup: setupMcp(), promptApiKeys(), setupDocker(), setupDirect() |
| `cli/lib/plugin.js` | 127 | Plugin lifecycle: installPlugin(), removePlugin(). Registers in ~/.claude/plugins/installed_plugins.json, manages cache |
| `cli/lib/vendor-skills.js` | 594 | Vendor skill fetching, hashing, lock file management (skills-lock.json) |
| `cli/lib/planning.js` | 502 | Planning state management: .planning/ directory CRUD (roadmap, phases, progress, config, research, plans, tasks). Path-safe via safeJoin/safeFilenameSegment |
| `cli/lib/executor.js` | 365 | Executor engine: buildTaskPacket(), executeTask(), buildWavePlan() (topological sort), formatWaveProgress(), getSkillContent(). SKILL_MAP maps task types to methodology skills |
| `cli/lib/agents.js` | 413 | Agent prompt templates: RESEARCHER_PROMPTS (4 types), PLANNER_PROMPT, PLAN_CHECKER_PROMPT, DEBUGGER_PROMPT, VERIFIER_PROMPT, CODE_REVIEWER_PROMPT |

### Hooks

| Path | Lines | Event | Purpose |
|------|-------|-------|---------|
| `hooks/bash-permissions.js` | 467 | PreToolUse (Bash) | Blocklist-based command classification; ~15 dangerous patterns. Logs to ~/.claude/safety-log.jsonl |
| `hooks/session-start.js` | 266 | SessionStart | Loads previous session summary, injects ARCHITECTURE.md and DESIGN.md, detects active .planning/ sessions |
| `hooks/session-end.js` | 82 | Stop | Saves session context to ~/.claude/sessions/, tracks git branch and modified files |
| `hooks/cost-tracker.js` | 26 | Stop (async) | Appends session cost estimate to ~/.claude/cost-log.jsonl |
| `hooks/statusline-command.js` | 328 | statusLine | Line 1: user@host, model, branch, context bar. Line 2: token counts, wave progress, executor count, cost. Writes context metrics to ~/.claude/context-metrics.json |
| `hooks/pre-merge-checklist.js` | 102 | PostToolUse (Bash) | Advisory pre-merge checks triggered on git merge commands |
| `hooks/improvement-logger.js` | 94 | Stop (async) | Appends session improvement observations to ~/.claude/improvement-log.jsonl |
| `hooks/context-monitor.js` | 79 | PostToolUse | Reads context metrics, injects warnings at 35%/25% remaining. Tracks state in ~/.claude/context-monitor-state.json |

### Skills

| Path | Lines | Injected Into | Purpose |
|------|-------|--------------|---------|
| `skills/supermind/SKILL.md` | 67 | Entry point | Complexity router — auto-detects scope, routes to /quick or /project |
| `skills/quick/SKILL.md` | 178 | — | Quick Mode — single-executor path for small tasks. Stateless |
| `skills/project/SKILL.md` | 533 | — | Project Mode — six-phase lifecycle orchestrator. Uses executor.js, agents.js, planning.js |
| `skills/anti-rationalization/SKILL.md` | 38 | All executors | Blocks LLM rationalizations for skipping steps. Forked from obra/superpowers (MIT) |
| `skills/verification-before-completion/SKILL.md` | 54 | All executors | Requires command output evidence before success claims. Forked from obra/superpowers (MIT) |
| `skills/tdd/SKILL.md` | 179 | write-feature, write-test | Strict red-green-refactor. Forked from obra/superpowers (MIT) |
| `skills/systematic-debugging/SKILL.md` | 129 | fix-bug | Four-phase root-cause debugging (REPRODUCE-ISOLATE-FIX-VERIFY). Forked from obra/superpowers (MIT) |
| `skills/brainstorming/SKILL.md` | 165 | Orchestrator discuss | Design exploration with interactive and assumptions modes. Forked from obra/superpowers (MIT), assumptions mode from gsd-build/get-shit-done (MIT) |
| `skills/code-review/SKILL.md` | 144 | Verify phase | Six-criteria structured review, three-tier classification. Forked from obra/superpowers (MIT) |
| `skills/writing-plans/SKILL.md` | 169 | Orchestrator plan | Atomic task plans with dependency graphs. Forked from obra/superpowers (MIT) |
| `skills/executing-plans/SKILL.md` | 138 | Execute phase | Wave-based execution with progress tracking. Forked from obra/superpowers (MIT) |
| `skills/using-git-worktrees/SKILL.md` | 138 | Executors | Automated worktree creation with safety checks. Forked from obra/superpowers (MIT) |
| `skills/finishing-branches/SKILL.md` | 144 | Ship phase | Push/PR/keep/discard with worktree cleanup. Forked from obra/superpowers (MIT) |
| `skills/supermind-init/SKILL.md` | 238 | — | Project onboarding: CLAUDE.md, ARCHITECTURE.md, DESIGN.md, health checks |
| `skills/supermind-living-docs/SKILL.md` | 65 | — | Manual sync trigger for living documentation |

### Other

| Path | Lines | Purpose |
|------|-------|---------|
| `agents/code-reviewer.md` | 81 | Agent definition for code reviewer subagent — review-only constraint, structured output |
| `templates/CLAUDE.md` | 178 | Project CLAUDE.md template with infrastructure and placeholder sections |
| `skills/supermind-init/architecture-template.md` | — | Skeleton template for ARCHITECTURE.md generation |
| `skills/supermind-init/design-template.md` | — | Skeleton template for DESIGN.md generation |
| `airis/docker-compose.yml` | — | AIRIS gateway Docker compose for MCP server management |
| `airis/mcp-config.json` | — | Direct-mode MCP server configuration (npx/uvx launch commands) |
| `.claude-plugin/plugin.json` | 21 | Plugin manifest — name, description, author, keywords. Version overridden from package.json on install |
| `.env.example` | — | Environment variable template (TAVILY_API_KEY, TWENTYFIRST_API_KEY) |

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
│    ├─ skills.js → copy agents/*.md → ~/.claude/agents/           │
│    ├─ templates.js → copy templates/ → ~/.claude/templates/      │
│    ├─ plugin.js → register in ~/.claude/plugins/                 │
│    └─ mcp.js → setup Docker/direct MCP servers                   │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ RUNTIME (Claude Code Session)                                    │
│                                                                   │
│  SessionStart → session-start.js                                 │
│    ├─ Load previous session from ~/.claude/sessions/             │
│    ├─ Read ARCHITECTURE.md + DESIGN.md into context              │
│    └─ Detect .planning/ → report active phase/wave progress      │
│                                                                   │
│  User prompt → /supermind complexity router                      │
│    ├─ Quick signals → /quick → single executor                   │
│    └─ Project signals → /project → 6-phase orchestrator          │
│                                                                   │
│  Executor engine (cli/lib/executor.js)                           │
│    ├─ buildTaskPacket() → spec + context + skills + contract     │
│    ├─ buildWavePlan() → topological sort into parallel waves     │
│    └─ executeTask() → Agent tool invocation for fresh context    │
│                                                                   │
│  PreToolUse (Bash) → bash-permissions.js                         │
│    ├─ Split compound commands on && || ;                         │
│    ├─ Check against blocklist (~15 dangerous patterns)           │
│    ├─ Check ~/.claude/supermind-approved.json (user overrides)   │
│    ├─ Log blocked commands → ~/.claude/safety-log.jsonl          │
│    └─ Return allow (default) | ask (blocked)                     │
│                                                                   │
│  PostToolUse → context-monitor.js                                │
│    ├─ Read ~/.claude/context-metrics.json (from statusline hook) │
│    ├─ 35% remaining → advisory, 25% → warning                   │
│    └─ Track state in ~/.claude/context-monitor-state.json        │
│                                                                   │
│  PostToolUse (Bash) → pre-merge-checklist.js                     │
│    └─ Triggered on git merge → advisory warnings                 │
│                                                                   │
│  Stop → session-end.js + cost-tracker.js + improvement-logger.js │
│    ├─ Save session summary → ~/.claude/sessions/                 │
│    ├─ Append cost entry → ~/.claude/cost-log.jsonl               │
│    └─ Append improvements → ~/.claude/improvement-log.jsonl      │
└─────────────────────────────────────────────────────────────────┘

Vendor Skill Flow:
supermind skill add <github-url> → git clone → hash → copy → skills-lock.json

State Management (.planning/):
.planning/roadmap.md          ← Phase overview with status
.planning/config.json         ← Model profile, flags, safety overrides
.planning/phases/phase-N/
  ├─ discussion.md            ← Captured decisions
  ├─ research/                ← 4 researcher outputs
  ├─ plans/                   ← Atomic task plans with dependency graph
  ├─ tasks/                   ← Individual task specs (one per executor)
  └─ progress.md              ← Wave execution progress
```

### File Dependencies

| File | Depends On | Used By |
|------|-----------|---------|
| `cli/index.js` | package.json | Entry point (bin) |
| `cli/commands/install.js` | platform, logger, settings, hooks, skills, mcp, templates, plugin | index.js |
| `cli/commands/update.js` | platform, logger, settings, hooks, skills, templates, plugin, package.json | index.js |
| `cli/commands/doctor.js` | platform, logger, settings, hooks, skills, package.json | index.js |
| `cli/commands/uninstall.js` | platform, logger, settings, hooks, skills, templates, plugin, readline | index.js |
| `cli/commands/approve.js` | fs, path, platform, logger | index.js |
| `cli/commands/skill.js` | logger, vendor-skills | index.js |
| `cli/lib/platform.js` | fs, path, os | All commands, all lib modules |
| `cli/lib/logger.js` | package.json | All commands |
| `cli/lib/settings.js` | fs, platform, logger | install, update, doctor, uninstall |
| `cli/lib/hooks.js` | fs, path, platform, logger | install, update, doctor, uninstall |
| `cli/lib/skills.js` | fs, path, platform, logger | install, update, doctor, uninstall |
| `cli/lib/templates.js` | fs, path, platform, logger | install, uninstall |
| `cli/lib/mcp.js` | fs, path, readline, child_process, platform, logger | install |
| `cli/lib/plugin.js` | fs, path, platform, logger, package.json | install, update, uninstall |
| `cli/lib/vendor-skills.js` | fs, path, os, crypto, child_process | skill command |
| `cli/lib/planning.js` | fs, path | Project Mode orchestrator (skill) |
| `cli/lib/executor.js` | fs, path, os | Quick Mode + Project Mode (skills) |
| `cli/lib/agents.js` | (none — pure template functions) | Project Mode orchestrator (skill) |
| `hooks/bash-permissions.js` | fs, path, os | Runtime (PreToolUse) |
| `hooks/session-start.js` | fs, path, os | Runtime (SessionStart) |
| `hooks/session-end.js` | fs, path, os, child_process | Runtime (Stop) |
| `hooks/cost-tracker.js` | fs, path, os | Runtime (Stop) |
| `hooks/pre-merge-checklist.js` | fs, path, os | Runtime (PostToolUse) |
| `hooks/improvement-logger.js` | fs, path, os | Runtime (Stop) |
| `hooks/statusline-command.js` | fs, path, child_process | Runtime (statusLine), context-monitor.js (via metrics file) |
| `hooks/context-monitor.js` | fs, path | Runtime (PostToolUse) |

## API Contracts

| Command | Args | Flags | Purpose |
|---------|------|-------|---------|
| `supermind-claude [install]` | — | `--non-interactive`, `--mcp docker\|direct\|skip`, `--yes`, `--help`, `--version` | Full global setup (default command) |
| `supermind-claude update` | — | `--non-interactive` | Refresh hooks, skills, templates |
| `supermind-claude doctor` | — | (none) | Health check report |
| `supermind-claude uninstall` | — | `--yes`, `--non-interactive` | Remove all Supermind components |
| `supermind-claude approve <pattern>` | pattern | `--list`, `--remove` | Manage auto-approved bash commands |
| `supermind-claude skill add` | github-url | `--global` | Install vendor skill from GitHub |
| `supermind-claude skill update` | [name] | `--all` | Update vendor skill(s) |
| `supermind-claude skill list` | — | — | List installed vendor skills |
| `supermind-claude skill remove` | name | — | Remove vendor skill |

### Hook Registration (in settings.json)

| Hook Event | Timeout | Script | Matcher |
|-----------|---------|--------|---------|
| PreToolUse | 5s | bash-permissions.js | Bash only |
| PostToolUse | 5s | pre-merge-checklist.js | Bash only |
| PostToolUse | 3s | context-monitor.js | All |
| SessionStart | — | session-start.js | All |
| Stop | async | session-end.js | All |
| Stop | async | cost-tracker.js | All |
| Stop | async | improvement-logger.js | All |
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
- **Settings backup** — settings.json.backup created on first install (never overwritten on subsequent runs)
- **Fallback error handling** — try-catch returns defaults (readSettings → {}, getHookFiles → KNOWN_HOOKS); non-critical failures silently skip
- **Color-coded logging** — step(n, total, msg) progress counters, success/warn/error with ANSI symbols
- **Blocklist command classification** — bash-permissions.js uses a blocklist model (FILESYSTEM_BLOCKED, DANGEROUS_FLAGS, PROCESS_BLOCKED, PUBLISH_BLOCKED, DB_CLI_PATTERNS, DB_DESTRUCTIVE_SQL, HTTP_MUTATING, GIT_BLOCKED, GH_BLOCKED) with compound command splitting; everything not on the blocklist is auto-approved
- **Session rotation** — max 20 session files in ~/.claude/sessions/, oldest pruned on save
- **Path-safe operations** — planning.js and executor.js use safeJoin/safeFilenameSegment to prevent path traversal
- **Executor injection model** — methodology skills injected into fresh-context subagents via SKILL_MAP based on task type
