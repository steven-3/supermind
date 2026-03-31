# Supermind v4: Unified Skill Engine

**Date:** 2026-03-30
**Status:** Approved (pending spec review)
**Breaking change:** Yes — major version bump to 4.0.0

## Summary

Supermind v4 is a ground-up rebuild that combines GSD's execution infrastructure (fresh-context workers, wave parallelism, context monitoring) with Superpowers' behavioral discipline (TDD, systematic debugging, anti-rationalization, verification gates) into a single native system.

OpenSpec is removed. The Superpowers plugin dependency is removed. Methodology skills are forked from Superpowers (with credit), adapted for the GSD-style executor injection model. The result is a self-contained skill engine where Claude works autonomously after initial prompt, with safety rails preventing destructive operations.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Complexity model | Dial: `/quick` + `/project` with auto-detection | Small tasks shouldn't pay ceremony tax; large tasks need full lifecycle |
| Distribution | npm package + `.claude-plugin/` manifest (dual) | npm for CLI + infrastructure; plugin for skill discovery + updates |
| Methodology approach | GSD-style orchestration engine + Superpowers behavioral skills as composable slots | Execution power with discipline; extensible via vendor skills |
| Superpowers dependency | Clean break — fork skills with credit, no upstream dependency | Full control to reshape skills for executor injection model |
| Bash permissions | Blocklist (not allowlist) | Autonomous workflow needs minimal friction; block only dangerous commands |
| Git push | Auto-approved unless targeting main/master or using --force | Feature branch pushes are routine and safe |
| Project decomposition | 17 sub-projects across 5 phases | Each sub-project gets its own brainstorm-plan-execute cycle for best results |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User Prompt                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              COMPLEXITY ROUTER                       │
│  Analyzes scope → routes to /quick or /project       │
│  User can override: "quick: fix the typo"           │
└──────┬───────────────────────────────┬──────────────┘
       │                               │
       ▼                               ▼
┌──────────────┐            ┌─────────────────────────┐
│  QUICK MODE  │            │     PROJECT MODE         │
│              │            │                          │
│  Single-pass │            │  discuss → research →    │
│  executor    │            │  plan → execute (waves)  │
│  with safety │            │  → verify → ship         │
│  rails       │            │                          │
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
│  Blocklist-based bash-permissions                    │
│  No merge to main/master                            │
│  No destructive git ops                             │
│  Database operations require explicit approval       │
│  Gate override logging                              │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              INFRASTRUCTURE                          │
│  Session persistence │ Cost tracking │ Status line   │
│  Vendor skills │ Settings management │ Living docs   │
└─────────────────────────────────────────────────────┘
```

## Complexity Router

### Quick Mode

For small, clear tasks — bug fixes, renames, config changes, adding tests.

```
User prompt → Executor (single, fresh context) → Verify → Done
```

- Single executor with safety rails and behavioral skills injected
- Still gets TDD if writing code, verification before completion
- Still uses a worktree if touching >2-3 files
- No `.planning/` state — stateless and fast
- Prefix with `quick:` or invoke `/quick`

### Project Mode

For features, refactors, new systems, multi-file changes.

```
Discuss → Research (4 parallel agents) → Plan → Execute (waves) → Verify → Ship
```

| Phase | What happens | Skippable? |
|-------|-------------|------------|
| **Discuss** | Understand intent. Supports "assumptions mode" (analyze codebase, present assumptions for correction) | Yes (`--skip-discuss`) |
| **Research** | 4 parallel agents: stack/deps, features/patterns, architecture/integration, pitfalls/edge-cases | Yes (`--skip-research`) |
| **Plan** | Atomic task plans with dependency graph. Planner + plan-checker loop (max 3 iterations). Tasks grouped into waves. | No |
| **Execute** | Wave-based parallel execution. Each task gets a fresh-context executor. Independent tasks run simultaneously. Atomic commits per task. | No |
| **Verify** | Run tests, check regressions, validate against original intent. Automated diagnosis on failure. | No |
| **Ship** | Push feature branch, open PR with summary. Never merges to main/master. | No |

### Auto-Detection

If the user doesn't specify a mode, the router judges based on signals:

- **Quick signals:** "fix", "rename", "add test for", "update config", single-file scope
- **Project signals:** "build", "implement", "refactor", "add feature", multi-system scope, ambiguity

Announces its choice with an escape hatch: *"This looks like a quick fix — running in quick mode. Say `/project` if you want the full lifecycle."*

### Composable Flags

```
/quick --with-research       # Quick + run researchers first
/quick --with-discuss        # Quick + ask questions first
/project --skip-discuss      # Project, skip to research
/project --skip-research     # Project, skip to planning
/project --assumptions       # Discuss via codebase analysis, not questions
```

## Executor Engine

### Fresh-Context Subagents

Every task runs in a dedicated subagent via Claude Code's Agent tool. The orchestrator never executes code — it only coordinates.

The orchestrator builds a **task packet** for each executor:

1. **Task spec** — what to build/fix/change, acceptance criteria, files to read, expected output
2. **Project context** (compact) — relevant ARCHITECTURE.md sections, key CLAUDE.md conventions, branch + recent commits
3. **Injected skills** (based on task type):
   - "write feature" → TDD + verification + anti-rationalization
   - "fix bug" → systematic-debugging + verification + anti-rationalization
   - "refactor" → verification + anti-rationalization
   - "write tests" → TDD + anti-rationalization
4. **Completion contract** — must commit atomically, report files/tests/issues, must NOT merge or modify files outside scope

### Wave Execution

The planner produces a dependency graph. The engine groups tasks into waves:

```
Wave 1: [Task A, Task B, Task C]    ← independent, parallel
Wave 2: [Task D (needs A), Task E]  ← D waits for A, E independent
Wave 3: [Task F (needs D+E)]        ← depends on wave 2
```

- Parallel subagents within each wave
- Sequential across waves
- Failed task → debugger executor diagnoses → retry once → escalate to user
- Max parallel executors: configurable, default 3

### Context Monitor

Two-hook bridge pattern:

- **StatusLine hook** writes context metrics (% remaining, token counts) to temp file
- **PostToolUse hook** reads metrics and injects warnings:
  - 35% remaining → advisory: "Context getting heavy"
  - 25% remaining → warning: "Commit current work and spawn fresh executor"

Orchestrator stays at ~15-25% context usage since all real work is in fresh executors.

## Methodology Skills

Forked from [obra/superpowers](https://github.com/obra/superpowers) (MIT license), adapted for executor injection.

Each skill has an `injects_into:` frontmatter field declaring when it activates:

| Skill | Forked from | Injected into | Purpose |
|-------|------------|---------------|---------|
| **anti-rationalization** | Superpowers `using-superpowers` | All executors | Blocks common LLM excuses for skipping steps |
| **verification-before-completion** | Superpowers skill | All executors | Requires command output evidence before success claims |
| **tdd** | Superpowers `test-driven-development` | write-feature, write-test | Strict red-green-refactor with iron law |
| **systematic-debugging** | Superpowers skill | fix-bug | Four-phase root-cause-first, blocks premature fixes |
| **brainstorming** | Superpowers skill | Orchestrator discuss phase | Pre-implementation design exploration, assumptions mode |
| **code-review** | Superpowers `requesting-code-review` | Verify phase | Structured review with critical/important/suggestion tiers |
| **writing-plans** | Superpowers skill | Orchestrator plan phase | Granular task plans with 2-5 minute increments |
| **executing-plans** | Superpowers skill | Execute phase (orchestrator) | Batch execution with checkpoints |
| **using-git-worktrees** | Superpowers skill | Executors (when scope warrants) | Automated worktree creation with safety checks |
| **finishing-branches** | Superpowers `finishing-a-development-branch` | Ship phase | PR/keep/discard options (merges worktree→feature only, never to main/master) |

Additional Supermind-native skills (not forked):

| Skill | Purpose |
|-------|---------|
| **supermind-init** | Project onboarding (CLAUDE.md, ARCHITECTURE.md, DESIGN.md) |
| **supermind-living-docs** | Keep ARCHITECTURE.md and DESIGN.md in sync |

## Safety Layer

### Blocklist-Based Bash Permissions

**Default: everything auto-approved.** Only explicitly dangerous commands require approval.

**Blocked commands (always require approval):**
- `rm -rf`, `rmdir`, `del` (destructive filesystem)
- `git reset --hard`, `git clean`, `git checkout .` (discarding changes)
- `git rebase`, `git revert` (history rewriting)
- `git merge` to main/master
- `git push --force` (any branch)
- `git push` to main/master
- `git stash drop`, `git stash pop`, `git stash clear`
- `kill`, `killall`, `pkill` (process termination)
- `npm publish`, `docker push` (publishing)
- Database CLIs: `psql`, `mysql`, `mongo`, `redis-cli` + commands containing `DROP`, `DELETE FROM`, `TRUNCATE`, `ALTER TABLE`
- `curl`/`wget` with mutating HTTP methods to production-pattern URLs

**Auto-approved (everything else):**
- All build/test/lint tools: `node`, `npm`, `npx`, `python`, `cargo`, `go`, `make`, `tsc`, etc.
- All read-only commands
- `git push` to non-main/master branches (without `--force`)
- `git merge` in worktree contexts
- File creation and modification

**User overrides:** `~/.claude/supermind-approved.json` for permanently approving blocked commands.

**Gate override logging:** When a user approves a blocked command, log to `~/.claude/safety-log.jsonl` with timestamp, command, and context.

## State Management

Project mode writes state to `.planning/` in the project root:

```
.planning/
  roadmap.md                  # Phase overview with status
  config.json                 # Model profile, flags, safety overrides
  phases/
    phase-N/
      discussion.md           # Captured decisions
      research/               # 4 researcher outputs
      plans/                  # Atomic task plans with dependency graph
      tasks/                  # Individual task specs (one per executor)
      progress.md             # Wave execution progress
```

All Markdown. Human-readable. Git-committable. Session-start hook reads `.planning/progress.md` to resume across sessions.

Quick mode writes nothing — fully stateless.

## Distribution

### Dual: npm + Plugin

**npm package** (`supermind-claude`):
- `npx supermind-claude install` — copies hooks, skills, templates to `~/.claude/`
- Provides CLI: `supermind doctor`, `supermind skill add`, `supermind approve`, etc.
- Merges settings non-destructively into `~/.claude/settings.json`

**Claude Code plugin** (`.claude-plugin/plugin.json`):
- Installer creates plugin manifest so Claude Code recognizes Supermind as a plugin
- Skills, hooks, and agents declared in manifest
- `/plugin update supermind` works for skill-only updates
- Plugin marketplace discovery (future)

## Hooks (v4)

| Hook | Event | Purpose | Changed from v3? |
|------|-------|---------|-------------------|
| **bash-permissions.js** | PreToolUse (Bash) | Blocklist-based command classification | **Rewritten** (allowlist → blocklist) |
| **session-start.js** | SessionStart | Load session + living docs + `.planning/` resume | Enhanced |
| **session-end.js** | Stop | Save session context | Unchanged |
| **cost-tracker.js** | Stop | Log session cost | Unchanged |
| **statusline-command.js** | statusLine | Terminal display + context metrics to temp file | **Enhanced** (context %, wave progress) |
| **context-monitor.js** | PostToolUse | Read context metrics, inject warnings at thresholds | **New** |
| **pre-merge-checklist.js** | PostToolUse (Bash) | Advisory pre-merge warnings | Unchanged |
| **improvement-logger.js** | Stop | Session improvement tracking | Unchanged |

## Sub-Project Decomposition

17 sub-projects across 5 phases. Each gets its own brainstorm → plan → execute cycle.

### Phase 1: Foundation (parallel, no dependencies)

| # | Sub-Project | Scope |
|---|------------|-------|
| 1.1 | Bash Permissions v2: Blocklist | Rewrite from allowlist to blocklist. Smart git push. Database awareness. Gate override logging. Ships as v3.1. |
| 1.2 | Remove OpenSpec | Delete 4 skills, 2 CLI files, all references. ~476 lines removed. |
| 1.3 | Remove Superpowers Plugin Dependency | Remove from plugins.js, update settings merge, update CLAUDE.md. |

### Phase 2: Core Engine (sequential)

| # | Sub-Project | Depends on |
|---|------------|-----------|
| 2.1 | Context Monitor (two-hook bridge) | 1.1 |
| 2.2 | State Management (`.planning/`) | — (parallel with 2.1) |
| 2.3 | Executor Engine (fresh-context, waves, task packets) | 2.1, 2.2 |

### Phase 3: Methodology Skills (parallel)

| # | Sub-Project | Depends on |
|---|------------|-----------|
| 3.1 | Anti-rationalization & Verification skills | 2.3 |
| 3.2 | TDD Skill | 2.3 |
| 3.3 | Systematic Debugging Skill | 2.3 |
| 3.4 | Brainstorming Skill (with assumptions mode) | 2.3 |
| 3.5 | Code Review Skill + Agent | 2.3 |
| 3.6 | Git Worktree Skill | 2.3 |
| 3.7 | Plan Writing & Execution Skills | 2.3 |

### Phase 4: Orchestration (sequential)

| # | Sub-Project | Depends on |
|---|------------|-----------|
| 4.1 | Quick Mode | 2.3, 3.1, 3.2, 3.3 |
| 4.2 | Project Mode | 4.1, all Phase 3 |
| 4.3 | Complexity Router | 4.1, 4.2 |

### Phase 5: Polish & Distribution (parallel)

| # | Sub-Project | Depends on |
|---|------------|-----------|
| 5.1 | Plugin Manifest (`.claude-plugin/`) | 4.3 |
| 5.2 | Enhanced Statusline | 2.1, 2.3 |
| 5.3 | Living Docs & CLAUDE.md rewrite | Everything |
| 5.4 | Doctor v2 (new health checks) | Everything |

### Dependency Graph

```
Phase 1 (parallel):  1.1  1.2  1.3
                      │         │
Phase 2:              ▼         ▼
                     2.1  2.2  (1.3 enables Phase 3)
                      │    │
                      ▼    ▼
                      2.3 ◄┘
                       │
Phase 3 (parallel):    ▼
                 3.1 3.2 3.3 3.4 3.5 3.6 3.7
                  │   │   │   │   │   │   │
Phase 4:          ▼   ▼   ▼   ▼   ▼   ▼   ▼
                     4.1
                      │
                     4.2
                      │
                     4.3
                       │
Phase 5 (parallel):    ▼
                 5.1 5.2 5.3 5.4
```

### Versioning Strategy

- Phase 1 ships incrementally: v3.1 (bash rewrite), v3.2 (remove openspec), v3.3 (remove superpowers dep)
- Phases 2-4 come together as v4.0.0
- Phase 5 is v4.0.x polish

## Credits

Methodology skills in this project are forked from [obra/superpowers](https://github.com/obra/superpowers) (MIT license) by Jesse Vincent and the Prime Radiant team. Execution architecture is inspired by [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) (MIT license). Both adapted and rebuilt as Supermind-native implementations.
