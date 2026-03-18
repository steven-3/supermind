# Supermind

Complete, opinionated Claude Code setup — hooks, skills, status line, MCP servers, and living documentation.

## Quick Install

```bash
npx supermind-claude
```

Or give Claude Code the repo URL and it will figure out the setup.

## What Gets Installed

| Component | Location | Purpose |
|-----------|----------|---------|
| Hooks | ~/.claude/hooks/ | Session persistence, bash permissions, status line, cost tracking |
| Skills | ~/.claude/skills/ | /supermind-init, /supermind-living-docs |
| Plugins | settings.json | Superpowers, frontend-design, claude-md-management, ui-ux-pro-max |
| Settings | settings.json | Thinking mode, effort level, hook registration |
| Templates | ~/.claude/templates/ | CLAUDE.md project template |

## Project Setup

After installing, run `/supermind-init` in any project to:
1. Create or merge CLAUDE.md with project-specific config
2. Generate ARCHITECTURE.md (and DESIGN.md for UI projects)
3. Check setup health and discover relevant tools

## Living Documentation

- **Auto-read**: Session-start hook reads ARCHITECTURE.md and DESIGN.md at every conversation start
- **Manual sync**: Run `/supermind-living-docs` to update docs after code changes

## Status Line

Two-line terminal display showing: user, model, path, git branch, context usage, thinking level, active agents, and session cost.

## MCP Servers

Choose during setup:
- **Docker** (AIRIS gateway): Single endpoint routing to context7, playwright, serena, tavily, chrome-devtools, shadcn
- **Direct**: Individual servers via npx/uvx

## Commands

| Command | Purpose |
|---------|---------|
| `npx supermind-claude` | Full global setup |
| `npx supermind-claude update` | Refresh hooks, skills, templates |
| `npx supermind-claude doctor` | Verify installation health |
| `npx supermind-claude uninstall` | Remove all components |
| `npx supermind-claude approve "cmd"` | Permanently auto-approve a command |

## Approved Commands

Permanently auto-approve specific commands that the bash-permissions hook would normally flag:

```bash
npx supermind-claude approve "git push"        # exact/prefix match
npx supermind-claude approve "/npm run .*/"    # regex match
npx supermind-claude approve --list            # see all approved
npx supermind-claude approve --remove "git push"  # remove approval
```

Or tell Claude: "add that to my approved commands" — it knows how to edit the file directly.

## Platforms

Windows, macOS, and Linux. Requires Node.js >= 18.

## Troubleshooting

Run `npx supermind-claude doctor` to check installation health. Common issues:
- **Plugins not active**: Restart Claude Code after install
- **Status line not showing**: Ensure Node.js is in PATH
- **Hooks not firing**: Run `npx supermind-claude update` to re-register
