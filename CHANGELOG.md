# Changelog

## [3.17.0] - 2026-03-31

### Added
- **Plugin manifest** (`.claude-plugin/plugin.json`): Supermind now registers as a Claude Code plugin during install, enabling future `/plugin update supermind` support and marketplace discovery. Dual distribution — npm package for CLI + infrastructure, plugin manifest for skill/hook/agent discovery.
- **Plugin module** (`cli/lib/plugin.js`): handles plugin registration in `~/.claude/plugins/installed_plugins.json`, manifest generation with auto-versioning from `package.json`, and cache directory management at `~/.claude/plugins/cache/npm/supermind/<version>/`.
- **Doctor check**: plugin registration health check verifies `supermind@npm` entry exists in `installed_plugins.json`.
- Updated install (7 steps, was 6), update (6 steps, was 5), and uninstall commands to manage plugin lifecycle.
- `.claude-plugin/` added to npm `files` array for package distribution.
- Sub-project 5.1 of Supermind v4 Unified Engine design.

## [3.16.0] - 2026-03-31

### Changed
- **Supermind complexity router** (`skills/supermind/SKILL.md`): replaced the static parent namespace skill with a complexity router — the `/supermind` entry point that auto-detects task scope and routes to `/quick` or `/project` mode
  - Analyzes user prompts against quick signals (fix, rename, typo, single-file scope, unambiguous) and project signals (build, implement, create, multi-file scope, ambiguous)
  - Announces routing decision with escape hatch; proceeds immediately (user can override at any time)
  - Supports all explicit overrides (`quick: <task>`, `/quick`, `/project`) and composable flags from both modes
  - Edge cases: non-task prompts skip routing; active `.planning/` sessions resume Project Mode; ambiguous tasks default to quick
  - Preserves `/supermind-init` and `/supermind-living-docs` as sub-commands
  - Sub-project 4.3 of Supermind v4 Unified Engine design

## [3.15.0] - 2026-03-31

### Added
- **Project Mode skill** (`skills/project/SKILL.md`): full six-phase lifecycle orchestrator — discuss, research, plan, execute (waves), verify, ship. Coordinates the entire development lifecycle for features, refactors, new systems, and multi-file changes. Phase 1 (Discuss): invokes brainstorming skill with interactive or `--assumptions` mode, saves design to `.planning/phases/phase-N/discussion.md` via `writeDiscussion()`. Phase 2 (Research): spawns 4 parallel researcher subagents (`RESEARCHER_PROMPTS.stackResearcher/featureResearcher/architectureResearcher/pitfallResearcher` from `cli/lib/agents.js`), saves outputs via `writeResearch()`. Phase 3 (Plan): invokes writing-plans skill, generates atomic task plans via `PLANNER_PROMPT`, validates with `PLAN_CHECKER_PROMPT` (max 3 iterations), saves via `writePlan()`/`writeTask()`. Phase 4 (Execute): invokes executing-plans skill, builds wave plan via `buildWavePlan()`, dispatches parallel executors via `buildTaskPacket()`/`executeTask()` with automatic `SKILL_MAP` injection, tracks progress via `writeProgress()`, handles failures with `DEBUGGER_PROMPT` (one retry). Phase 5 (Verify): invokes code-review skill, spawns code-reviewer via `CODE_REVIEWER_PROMPT` and verifier via `VERIFIER_PROMPT`, fix loop (max 3 rounds). Phase 6 (Ship): invokes finishing-branches skill, pushes branch, opens PR with auto-generated body from `.planning/` state. Composable flags: `--skip-discuss`, `--skip-research`, `--assumptions`, `--max-parallel N`. Orchestrator never writes code — only coordinates subagents. Sub-project 4.2 of Supermind v4 Unified Engine design.
- Updated `KNOWN_SKILLS` in `cli/lib/skills.js` to include `project`
- Skill count: 15 directories (was 14)

## [3.14.0] - 2026-03-31

### Added
- **Quick Mode skill** (`skills/quick/SKILL.md`): single-executor mode for small, clear tasks — bug fixes, renames, config changes, adding tests. Activated by `quick:` prefix or `/quick` invocation. Parses task description to detect type (fix-bug, write-test, refactor, write-feature), builds a task packet via `buildTaskPacket()` from `cli/lib/executor.js` with automatic skill injection via `SKILL_MAP`, spawns a single fresh-context executor subagent, and reports results. Supports composable flags: `--with-research` (pre-dispatch researcher via `RESEARCHER_PROMPTS.featureResearcher` from `cli/lib/agents.js`) and `--with-discuss` (2-3 clarifying questions before dispatch). Worktree decision based on file count (>2-3 files → worktree via `executeTask({ useWorktree: true })`). Fully stateless — no `.planning/` directory. Sub-project 4.1 of Supermind v4 Unified Engine design.
- Updated `KNOWN_SKILLS` in `cli/lib/skills.js` to include `quick`
- Skill count: 14 directories (was 13)

## [3.13.0] - 2026-03-31

### Added
- **Writing-plans skill** (`skills/writing-plans/SKILL.md`): creates atomic implementation plans with dependency graphs for the orchestrator Plan phase. Includes task spec format (id, type, dependsOn, acceptance criteria, verification), wave grouping via dependency graph, plan-checker self-review loop (max 3 iterations), and `.planning/` state output (plan.md + individual task specs). Forked from obra/superpowers (MIT).
- **Executing-plans skill** (`skills/executing-plans/SKILL.md`): wave-based plan execution with progress tracking and failure handling for the orchestrator Execute phase. Coordinates fresh-context executor dispatch via `buildTaskPacket`/`executeTask`/`buildWavePlan` from `executor.js`, respects `maxParallel` config (default 3), tracks progress in `.planning/phases/phase-N/progress.md`, handles single-task retry, multi-failure pause, and dependency cascade skip. Forked from obra/superpowers (MIT).
- **Finishing-branches skill** (`skills/finishing-branches/SKILL.md`): Ship phase handler — push branch, open PR, or keep/discard branch with worktree cleanup. Three options: Create PR (default, auto-generates description from `.planning/` state), Keep Branch (preserves worktree), Discard (requires typed confirmation). Never merges to main/master, never force pushes. Forked from obra/superpowers (MIT).
- Updated `KNOWN_SKILLS` in `cli/lib/skills.js` to include `writing-plans`, `executing-plans`, `finishing-branches`
- Skill count: 13 directories (was 10)

## [3.12.0] - 2026-03-31

### Added
- **Git worktree skill** (`skills/using-git-worktrees/SKILL.md`): automated worktree creation with safety checks for isolated development — used by executors when task scope warrants it (>2-3 files, logic changes, parallel execution). Covers .gitignore verification, dependency auto-detection (npm/yarn/pnpm, cargo, pip, go), baseline test verification, and completion reporting. Executors create and commit in worktrees; orchestrator handles merge and cleanup. Forked from obra/superpowers (MIT).
- Skill count: 10 directories (was 9)

## [3.11.0] - 2026-03-31

### Added
- **Code review skill** (`skills/code-review/SKILL.md`): structured code review methodology for the Verify phase — six evaluation criteria (spec compliance, correctness, test coverage, security, maintainability, consistency), three-tier issue classification (critical/important/suggestion), structured output format with verdicts (PASS/NEEDS FIXES/FAIL), and anti-performative-agreement guidance for receiving review feedback. Forked from obra/superpowers (MIT).
- **Agent definitions** (`agents/`): new directory for subagent prompt templates installed to `~/.claude/agents/`. First agent: `code-reviewer.md` — review-only subagent that evaluates diffs against plans and coding standards.
- **`CODE_REVIEWER_PROMPT`** in `cli/lib/agents.js`: agent prompt template for spawning code reviewer subagents in the Verify phase. Takes diff, plan, and optional task spec context.
- Agent install infrastructure: `installAgents()`, `removeAgents()`, `getAgentFiles()` in `cli/lib/skills.js`; `PATHS.agentsDir` in platform.js; wired into install, update, uninstall, and doctor commands.
- Skill count: 9 directories (was 8). Agent count: 1 definition.

## [3.10.0] - 2026-03-31

### Added
- **Brainstorming skill** (`skills/brainstorming/SKILL.md`): pre-implementation design exploration with two modes — Interactive (default, one-question-at-a-time clarification) and Assumptions (analyzes codebase and presents assumptions for user correction, triggered by `--assumptions` flag). Used by orchestrator during Discuss phase of Project Mode. Includes scope detection (flags multi-system requests for decomposition), 2-3 approach proposals with trade-offs, section-by-section design approval, and structured output to `.planning/phases/phase-N/discussion.md`. Forked from obra/superpowers (MIT), assumptions mode inspired by gsd-build/get-shit-done (MIT).
- Skill count: 8 directories (was 7)

## [3.9.0] - 2026-03-31

### Added
- **Systematic debugging skill** (`skills/systematic-debugging/SKILL.md`): four-phase root-cause debugging methodology — injected into `fix-bug` executors via `SKILL_MAP`. Enforces "always find root cause before attempting fixes" iron law with mandatory REPRODUCE → ISOLATE → FIX → VERIFY phases. Includes anti-patterns table, escalation rule (stop after 3 failed fixes), and verification checklist. Forked from obra/superpowers (MIT).
- Skill count: 7 directories (was 6)

## [3.8.0] - 2026-03-31

### Added
- **TDD skill** (`skills/tdd/SKILL.md`): strict RED-GREEN-REFACTOR test-driven development methodology — injected into `write-feature` and `write-test` executors via `SKILL_MAP`. Enforces "no production code without a failing test first" iron law. Includes step-zero test framework detection (Node.js, Python, Rust, Go), single-test loop discipline, anti-patterns table, bug fix flow, and verification checklist. Forked from obra/superpowers (MIT).
- Skill count: 6 directories (was 5)

## [3.7.0] - 2026-03-31

### Added
- **Anti-rationalization skill** (`skills/anti-rationalization/SKILL.md`): blocks common LLM rationalizations for skipping steps — injected into all executors via `SKILL_MAP`. Includes 8 rationalization/rebuttal pairs covering tests, verification, investigation, and config changes. Forked from obra/superpowers (MIT).
- **Verification-before-completion skill** (`skills/verification-before-completion/SKILL.md`): requires command output evidence before any executor can report task completion. Defines what counts as verification (test output, compiler output, behavior demos) vs. what doesn't (assertions, beliefs, code reading). Includes mandatory completion report template. Forked from obra/superpowers (MIT).
- Skill count: 5 directories (was 3)

## [3.6.0] - 2026-03-31

### Added
- **Executor engine** (`cli/lib/executor.js`): core runtime engine for Project Mode's fresh-context subagent execution
  - `buildTaskPacket(task, options)` — assembles self-contained task packets with spec, context, injected methodology skills, and completion contract
  - `executeTask(taskPacket, options)` — builds structured execution requests (prompt + metadata) for the orchestrator to pass to the Agent tool
  - `buildWavePlan(tasks)` — topological sort of tasks by dependency graph into parallel execution waves; throws on circular dependencies
  - `formatWaveProgress(wavePlan, results)` — renders Markdown progress table (wave/task/status/commit)
  - `getSkillContent(skillName, projectRoot)` — reads SKILL.md from `~/.claude/skills/` with project-level fallback
  - `SKILL_MAP` — maps task types to methodology skill sets (write-feature→TDD+verification+anti-rationalization, fix-bug→debugging+verification+anti-rationalization, etc.)
  - All paths validated via `safeJoin` pattern; skill names validated with regex
- **Agent prompt templates** (`cli/lib/agents.js`): specialized agent prompts for Project Mode orchestration
  - `RESEARCHER_PROMPTS` — 4 researcher templates: stackResearcher (tech stack analysis), featureResearcher (pattern discovery), architectureResearcher (integration mapping), pitfallResearcher (risk identification)
  - `PLANNER_PROMPT` — creates atomic task plans with dependency graphs and acceptance criteria
  - `PLAN_CHECKER_PROMPT` — validates plans against goals (max 3 iterations)
  - `DEBUGGER_PROMPT` — diagnoses task executor failures with root cause analysis
  - `VERIFIER_PROMPT` — verifies execution results against original goal

## [3.5.0] - 2026-03-31

### Added
- **Planning state management** (`cli/lib/planning.js`): new module providing read/write utilities for `.planning/` directory structure used by Project Mode
  - `initPlanning(projectRoot, config)` — create `.planning/` with `roadmap.md` and `config.json`
  - `initPhase(projectRoot, phaseNum)` — create `phases/phase-N/` with `discussion.md`, `research/`, `plans/`, `tasks/`, `progress.md`
  - `readProgress(projectRoot, phaseNum?)` — read wave execution state with summary (total/done/pending/failed/currentWave)
  - `writeProgress(projectRoot, phaseNum, data)` — update `progress.md` with current wave state
  - `readRoadmap(projectRoot)` / `updateRoadmap(projectRoot, phaseNum, status)` — parse and update phase roadmap
  - `readConfig(projectRoot)` / `writeConfig(projectRoot, config)` — manage `config.json` (model profile, flags)
  - `writeDiscussion(projectRoot, phaseNum, content)` — append to phase discussion log
  - `writeResearch(projectRoot, phaseNum, agentName, content)` — write researcher output files
  - `writePlan(projectRoot, phaseNum, planData)` — write plans with dependency frontmatter and wave structure
  - `writeTask(projectRoot, phaseNum, taskId, taskSpec)` — write individual task specs with acceptance criteria
  - `getPlanningRoot(startDir)` — walk up directory tree to find `.planning/` (like git finds `.git/`)
  - `isActive(projectRoot)` — check if any phases are non-completed
  - All paths validated via `safeJoin` pattern (no path traversal); filenames validated with `safeFilenameSegment`
- **Session-start hook**: `.planning/` awareness — detects active planning sessions and reports phase, wave, and task progress on session start

### Changed
- Session-start hook (`session-start.js`): all `path.join` calls migrated to `safeJoin` helper for path traversal protection

## [3.4.0] - 2026-03-31

### Added
- **Context monitor hook** (`context-monitor.js`): two-hook bridge pattern that monitors context window usage and injects advisory warnings when context gets heavy
  - At 35% remaining: advisory — "Consider wrapping up current task or spawning a fresh executor"
  - At 25% remaining: warning — "Commit current work now. Remaining tasks should run in fresh subagents"
  - Below 25%: repeats warning every 5th tool call to avoid spam
  - Reads metrics from `~/.claude/context-metrics.json` written by the statusline hook
  - Tracks warning state in `~/.claude/context-monitor-state.json` to avoid duplicate warnings
  - Silent when metrics are stale (>60s) or missing

### Changed
- **Statusline hook** (`statusline-command.js`): now writes context metrics (percentRemaining, tokensUsed, tokensTotal, timestamp) to `~/.claude/context-metrics.json` on each render
- Hook count: 8 (was 7)
- PostToolUse now has two registered entries: pre-merge-checklist (Bash matcher) and context-monitor (all tools)

## [3.3.0] - 2026-03-31

### Removed
- Third-party plugin dependencies: superpowers, claude-md-management, frontend-design, ui-ux-pro-max, pr-review-toolkit, security-guidance, elements-of-style
- `cli/lib/plugins.js` module (dead code — nothing imports it)
- Plugin merge step from `install` command (7 steps → 6)
- Plugin health checks from `doctor` command
- Plugin/marketplace merge and cleanup logic from `settings.js`
- `SUPERMIND_PLUGINS` export from settings module
- Superpowers skill references from CLAUDE.md (auto-trigger, skill invocations, enforcement rules)
- UI Changes section from CLAUDE.md (referenced ui-ux-pro-max plugin)
- Plugin row from README.md "What Gets Installed" table
- Plugin references from ARCHITECTURE.md (data flow, file dependencies)

### Changed
- Install command: 6 steps (was 7), no plugin step
- Worktree workflow in CLAUDE.md: describes process directly instead of referencing Superpowers skills
- `supermind-init` skill: "Superpowers skills and Claude plugins" → "vendor skills and MCP servers"
- README.md troubleshooting: removed "Plugins not active" entry

## [3.2.0] - 2026-03-30

### Removed
- OpenSpec integration: 4 skills (propose, explore, apply, archive), CLI command, and lib module
- `supermind openspec install/doctor` CLI commands
- OpenSpec CLI health checks from `supermind doctor`
- OpenSpec references from CLAUDE.md template (workflow section, Phase 2/5 references)
- OpenSpec references from ARCHITECTURE.md (tech stack, file index, data flow, API contracts, dependencies)

### Changed
- Skill count: 3 directories (was 7)
- Template CLAUDE.md Phase 2: complex changes now use `/brainstorming` instead of OpenSpec
- KNOWN_SKILLS fallback list reduced to 3 entries

## [3.1.0] - 2026-03-30

### Changed
- **bash-permissions.js rewritten from allowlist to blocklist model** — everything is auto-approved by default; only ~15 dangerous patterns are blocklisted
- Build/test/lint tools (node, npm, python, cargo, go, make, tsc, etc.) no longer need explicit allowlisting
- `git push` to non-main/master branches auto-approved (without `--force`)
- `git fetch` and `git pull` auto-approved (previously required approval)
- `sed -i` (in-place edit) auto-approved (previously required approval)
- Unknown/new commands auto-approved instead of requiring approval

### Added
- Database CLI awareness: `psql`, `mysql`, `mongo`, `mongosh`, `redis-cli` with destructive SQL detection (`DROP`, `DELETE FROM`, `TRUNCATE`, `ALTER TABLE`)
- HTTP mutation detection: `curl`/`wget` with `-X POST/PUT/PATCH/DELETE`, `--post-data`, `--post-file`
- Publishing blocklist: `npm publish`, `docker push`
- Process termination blocklist: `kill`, `killall`, `pkill`
- Gate override logging: blocked commands logged to `~/.claude/safety-log.jsonl` with timestamp, command, reason, and cwd
- Module exports for testing: `classifyCommand`, `classifySegment`, `classifyGitCommand`, `classifyGitPush`, `isUserApproved`

### Unchanged
- Compound command parsing (&&, ||, ;, pipes) with quote-aware splitting
- User override system (`~/.claude/supermind-approved.json`) with exact, prefix, and regex matching
- Worktree context detection and auto-approval for merge/worktree remove/branch -d
- Git global flag stripping (-C, -c, --git-dir, --work-tree, --no-pager)
- GitHub CLI mutation blocking (pr merge/close, issue close/delete, repo delete, mutating API calls)

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
- Template CLAUDE.md: permissions section rewritten to banlist model (document what is banned, not what is allowed)
- Template CLAUDE.md: worktree section replaced with comprehensive 6-phase lifecycle
- Install command: 9 steps (was 7), adds OpenSpec CLI setup and verification
- Doctor command: checks OpenSpec CLI, vendor skill integrity, improvement log
- Update command: 5 steps (was 4), adds vendor skill check
- Hook count: 7 (was 5)
- Skill count: 7 directories (was 3)

### Breaking
- Template CLAUDE.md completely rewritten — run /supermind-init to merge new sections into existing projects

## [2.1.1] - 2026-03-19

### Fixed
- Template CLAUDE.md now renders correct MCP section based on install mode (docker/direct/skip) instead of hardcoding AIRIS gateway
- Update command auto-detects existing MCP mode via installed artifacts
- Branch safety rule added to template: auto-create feature branches when on main/master

## [2.1.0] - 2026-03-18

### Added
- bash-permissions hook: auto-approve `base64` and `claude` CLI subcommands (config/mcp/plugin)
- bash-permissions hook: block implicit `gh api` POST mutations (via `-f`/`-F`/`--field`/`--raw-field`/`--typed-field`/`--input` flags)
- Default installed plugins: pr-review-toolkit, security-guidance, elements-of-style
- /supermind-init skill: create `.serena/` directory automatically instead of just suggesting it
- /supermind-init skill: verification pass after generating ARCHITECTURE.md (spot-checks claims against source)
- /supermind-living-docs skill: change-time validation (verifies existing doc claims against changed files)
- Worktree workflow: mandatory living docs check before merge (step 6)

### Changed
- /supermind-init skill: tool discovery dispatches two parallel agents (skills + MCPs) instead of one
- /supermind-init skill: exclude sequential-thinking-mcp from recommendations
- /supermind-init skill: explicit guard against writing to template source (`~/.claude/templates/CLAUDE.md`)
- Template `~/.claude/templates/CLAUDE.md`: document new auto-approved commands and gh api protections
- Install success message now dynamically lists all enabled plugins
- SUPERMIND_PLUGINS derived from plugins.js (single source of truth, eliminates manual sync)

### Fixed
- Uninstall now removes all plugins (SUPERMIND_PLUGINS derived from getPluginDefaults)
- `gh api` mutation regex: handle flag-immediately-after-api, `--typed-field`, compact `-fkey=val` syntax
- ARCHITECTURE.md: correct constant names, dependency lists, and backup description
- Documentation accuracy: config read-only (--get, --list), branch rename, worktree prune, bare stash

## [2.0.2] - 2026-03-18

### Changed
- README now recommends `npm install -g supermind-claude` as primary install method

## [2.0.1] - 2026-03-18

### Fixed
- Add executable permission to cli/index.js so `npx supermind-claude` works (bin entries were stripped from 2.0.0 tarball)

## [2.0.0] - 2026-03-18

### Changed
- Complete rebuild as npm package (`npx supermind-claude`)
- Replaced shell scripts (setup.sh, update.sh) with Node.js CLI
- Rewrote all hooks for consistency and clarity
- Rewrote all skills following skill-creator patterns
- Session-start hook now auto-reads ARCHITECTURE.md and DESIGN.md
- Standardized skill naming to hyphens (supermind-init, supermind-living-docs)

### Added
- `npx supermind-claude install` — full global setup
- `npx supermind-claude update` — lightweight refresh
- `npx supermind-claude doctor` — health check
- `npx supermind-claude uninstall` — clean removal
- `--non-interactive` and `--mcp` flags for scripted use
- Phase 3 in /supermind-init: health check and skill/MCP discovery
- Version tracking via ~/.claude/.supermind-version
- Cost tracker captures CLAUDE_SESSION_COST_USD
- `npx supermind-claude approve` — permanently auto-approve specific commands
- User-approved commands file (~/.claude/supermind-approved.json) with exact, prefix, and regex matching
- Granular git stash classification: push/save/list/show auto-approved, drop/pop/clear require approval

### Removed
- setup.sh, update.sh (replaced by CLI)
- settings.json shipped as static file (now constructed programmatically)
- VERSION file (version in package.json)
- SETUP.md (merged into README.md)
