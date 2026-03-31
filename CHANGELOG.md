# Changelog

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
