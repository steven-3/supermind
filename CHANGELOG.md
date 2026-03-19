# Changelog

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
