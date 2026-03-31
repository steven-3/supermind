# Architecture

## Overview

Supermind is a zero-dependency Node.js CLI (`supermind-claude`) that provides complete Claude Code setup — hooks, skills, status line, MCP servers, and living documentation. It installs into `~/.claude/` via a copy-on-install pattern, merging configuration non-destructively into `settings.json` to preserve user customizations. v3.0 adds vendor skill management (install third-party skills from GitHub with hash-locked integrity).

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
| `cli/commands/install.js` | Full setup: creates ~/.claude dirs, merges settings, installs hooks/skills/agents/MCP/templates |
| `cli/commands/update.js` | Refreshes hooks, skills, agents, templates; re-merges hook settings; updates version marker |
| `cli/commands/doctor.js` | Health check: validates Node version, ~/.claude structure, settings, hooks, skills, agents, Docker, vendor skills |
| `cli/commands/uninstall.js` | Removes all Supermind components (including agents) from ~/.claude, cleans settings |
| `cli/commands/approve.js` | Manages ~/.claude/supermind-approved.json (add/list/remove auto-approved command patterns) |
| `cli/commands/skill.js` | Vendor skill management CLI (add/update/list/remove) |
| `cli/lib/platform.js` | PATHS constant (including agentsDir) and utilities: ensureDir(), getPackageRoot() |
| `cli/lib/logger.js` | Color-coded terminal output: banner(), step(), success(), warn(), error(), info() |
| `cli/lib/settings.js` | Settings I/O: readSettings(), writeSettings(), backupSettings(), mergeSettings(), removeSupermindEntries() |
| `cli/lib/hooks.js` | Hook lifecycle: installHooks(), getHookSettings(), removeHooks() |
| `cli/lib/skills.js` | Skill and agent lifecycle: installSkills(), removeSkills(), removeLegacySkills(), installAgents(), removeAgents(), getAgentFiles() |
| `cli/lib/templates.js` | Template lifecycle: installTemplates(), removeTemplates() |
| `cli/lib/mcp.js` | MCP server setup: setupMcp(), promptApiKeys(), setupDocker(), setupDirect() |
| `cli/lib/vendor-skills.js` | Skill fetching, hashing, lock file management (skills-lock.json) |
| `cli/lib/planning.js` | Planning state management: .planning/ directory CRUD (roadmap, phases, progress, config, research, plans, tasks). Used by Project Mode orchestrator. Path-safe via safeJoin/safeFilenameSegment |
| `cli/lib/executor.js` | Executor engine: buildTaskPacket (assembles self-contained task packets with spec/context/skills/contract), executeTask (builds Agent tool invocation data), buildWavePlan (topological sort into parallel waves), formatWaveProgress (Markdown progress table), getSkillContent (reads SKILL.md from ~/.claude/skills/ with project fallback). SKILL_MAP maps task types to methodology skills. Path-safe via safeJoin |
| `cli/lib/agents.js` | Agent prompt templates for Project Mode: RESEARCHER_PROMPTS (4 templates: stack, feature, architecture, pitfall), PLANNER_PROMPT (atomic task plans with dependency graphs), PLAN_CHECKER_PROMPT (validates plans against goals), DEBUGGER_PROMPT (diagnoses executor failures), VERIFIER_PROMPT (checks results against original goal), CODE_REVIEWER_PROMPT (structured code review for Verify phase). All return prompt strings |
| `hooks/bash-permissions.js` | PreToolUse hook — blocklist-based command classification; everything auto-approved except ~15 dangerous patterns. Logs blocked commands to ~/.claude/safety-log.jsonl |
| `hooks/session-start.js` | SessionStart hook — loads previous session summary, injects ARCHITECTURE.md and DESIGN.md, detects active .planning/ sessions and reports phase/wave progress |
| `hooks/session-end.js` | Stop hook — saves session context to ~/.claude/sessions/, tracks git branch and modified files |
| `hooks/cost-tracker.js` | Stop hook (async) — appends session cost estimate to ~/.claude/cost-log.jsonl |
| `hooks/pre-merge-checklist.js` | PostToolUse hook — advisory pre-merge checks triggered on git merge Bash calls |
| `hooks/improvement-logger.js` | Stop hook (async) — appends session improvement observations to ~/.claude/improvement-log.jsonl |
| `hooks/statusline-command.js` | Status line renderer — shows user, host, git branch, context usage, agents, session cost. Also writes context metrics to ~/.claude/context-metrics.json for the context monitor |
| `hooks/context-monitor.js` | PostToolUse hook — reads context metrics and injects advisory warnings at 35%/25% remaining thresholds. Tracks state in ~/.claude/context-monitor-state.json |
| `skills/supermind/SKILL.md` | Parent namespace listing /supermind-init and /supermind-living-docs |
| `skills/supermind-init/SKILL.md` | Project onboarding: CLAUDE.md merge, ARCHITECTURE.md + DESIGN.md generation, health checks |
| `skills/supermind-init/architecture-template.md` | Skeleton template for ARCHITECTURE.md |
| `skills/supermind-init/design-template.md` | Skeleton template for DESIGN.md |
| `skills/supermind-living-docs/SKILL.md` | Manual sync trigger for ARCHITECTURE.md and DESIGN.md |
| `skills/anti-rationalization/SKILL.md` | Blocks common LLM rationalizations for skipping steps — injected into all executors. Forked from obra/superpowers (MIT) |
| `skills/verification-before-completion/SKILL.md` | Requires command output evidence before task completion — injected into all executors. Forked from obra/superpowers (MIT) |
| `skills/tdd/SKILL.md` | Strict RED-GREEN-REFACTOR test-driven development — injected into write-feature and write-test executors. Forked from obra/superpowers (MIT) |
| `skills/systematic-debugging/SKILL.md` | Four-phase root-cause debugging methodology (REPRODUCE → ISOLATE → FIX → VERIFY) — injected into fix-bug executors. Forked from obra/superpowers (MIT) |
| `skills/brainstorming/SKILL.md` | Pre-implementation design exploration with interactive and assumptions modes — used by orchestrator Discuss phase. Forked from obra/superpowers (MIT), assumptions mode from gsd-build/get-shit-done (MIT) |
| `skills/code-review/SKILL.md` | Structured code review methodology for the Verify phase — six criteria, three-tier issue classification, anti-performative-agreement. Forked from obra/superpowers (MIT) |
| `skills/using-git-worktrees/SKILL.md` | Automated worktree creation with safety checks — used by executors for isolated development when task scope warrants it. Forked from obra/superpowers (MIT) |
| `agents/code-reviewer.md` | Agent definition for code reviewer subagent — review-only constraint, structured review output, input template for diff/plan/task_spec |
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
│    ├─ skills.js → copy agents/*.md → ~/.claude/agents/           │
│    ├─ templates.js → copy templates/ → ~/.claude/templates/      │
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
│  PreToolUse (Bash) → bash-permissions.js                         │
│    ├─ Split compound commands on && || ;                         │
│    ├─ Check against blocklist (~15 dangerous patterns)           │
│    ├─ Smart git push (block main/master + --force only)          │
│    ├─ Check ~/.claude/supermind-approved.json (user overrides)   │
│    ├─ Log blocked commands → ~/.claude/safety-log.jsonl          │
│    └─ Return allow (default) | ask (blocked)                     │
│                                                                   │
│  PostToolUse (Bash) → pre-merge-checklist.js                     │
│    └─ Triggered on git merge → advisory warnings to stdout       │
│                                                                   │
│  PostToolUse (all) → context-monitor.js                          │
│    ├─ Read ~/.claude/context-metrics.json (from statusline hook) │
│    ├─ 35% remaining → advisory, 25% → warning                   │
│    └─ Track state in ~/.claude/context-monitor-state.json        │
│                                                                   │
│  Stop → session-end.js + cost-tracker.js + improvement-logger.js │
│    ├─ Save session summary → ~/.claude/sessions/                 │
│    ├─ Append cost entry → ~/.claude/cost-log.jsonl               │
│    └─ Append improvement observations → ~/.claude/improvement-log.jsonl │
└─────────────────────────────────────────────────────────────────┘

Vendor Skill Flow:
supermind skill add <github-url> -> git clone -> hash -> copy -> skills-lock.json
```

### File Dependencies

| File | Depends On | Used By |
|------|-----------|---------|
| `cli/index.js` | package.json | Entry point (bin) |
| `cli/commands/install.js` | platform, logger, settings, hooks, skills, mcp, templates | index.js |
| `cli/commands/update.js` | platform, logger, settings, hooks, skills, templates, package.json | index.js |
| `cli/commands/doctor.js` | platform, logger, settings, hooks, skills, package.json | index.js |
| `cli/commands/uninstall.js` | platform, logger, settings, hooks, skills, templates, readline | index.js |
| `cli/commands/approve.js` | fs, path, platform, logger | index.js |
| `cli/commands/skill.js` | logger, vendor-skills | index.js |
| `cli/lib/platform.js` | fs, path, os | All commands, all lib modules |
| `cli/lib/logger.js` | package.json | All commands |
| `cli/lib/settings.js` | fs, platform, logger | install, update, doctor, uninstall |
| `cli/lib/hooks.js` | fs, path, platform, logger | install, update, doctor, uninstall |
| `cli/lib/skills.js` | fs, path, platform, logger | install, update, doctor, uninstall |
| `cli/lib/templates.js` | fs, path, platform, logger | install, uninstall |
| `cli/lib/mcp.js` | fs, path, readline, child_process, platform, logger | install |
| `cli/lib/vendor-skills.js` | fs, path, os, crypto, child_process | skill command |
| `cli/lib/planning.js` | fs, path | Project Mode orchestrator |
| `cli/lib/executor.js` | fs, path, os | Project Mode orchestrator (builds task packets and wave plans) |
| `cli/lib/agents.js` | (none — pure template functions) | Project Mode orchestrator (provides agent prompts) |
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
- **Settings backup** — settings.json.backup created on first install (never overwritten on subsequent runs due to existence check)
- **Fallback error handling** — try-catch returns defaults (readSettings → {}, getHookFiles → KNOWN_HOOKS); non-critical failures silently skip
- **Color-coded logging** — step(n, total, msg) progress counters, success/warn/error with ANSI symbols
- **Blocklist command classification** — bash-permissions.js uses a blocklist model (FILESYSTEM_BLOCKED, DANGEROUS_FLAGS, PROCESS_BLOCKED, PUBLISH_BLOCKED, DB_CLI_PATTERNS, DB_DESTRUCTIVE_SQL, HTTP_MUTATING, GIT_BLOCKED, GH_BLOCKED) with compound command splitting; everything not on the blocklist is auto-approved. Blocked commands logged to ~/.claude/safety-log.jsonl
- **Session rotation** — max 20 session files in ~/.claude/sessions/, oldest pruned on save
