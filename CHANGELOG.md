# Changelog

## [2.1.0] - 2026-03-18

### Added
- bash-permissions hook: auto-approve `base64` and `claude` CLI subcommands (config/mcp/plugin)
- bash-permissions hook: block implicit `gh api` POST mutations (via `-f`/`-F`/`--field`/`--input` flags)
- Default installed plugins: pr-review-toolkit, hookify, security-guidance, elements-of-style
- /supermind-init skill: create `.serena/` directory automatically instead of just suggesting it

### Changed
- /supermind-init skill: tool discovery dispatches two parallel agents (skills + MCPs) instead of one
- /supermind-init skill: exclude sequential-thinking-mcp from recommendations
- /supermind-init skill: explicit guard against writing to template source (`~/.claude/templates/CLAUDE.md`)
- Template `~/.claude/templates/CLAUDE.md`: document new auto-approved commands and gh api protections

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
