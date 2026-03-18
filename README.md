# Claude Code Setup

Opinionated, portable Claude Code configuration. One script installs skills, hooks, plugins, MCP servers, a custom status line, and smart permission handling — so Claude Code works the way you want out of the box.

## What This Does

This repo configures Claude Code with a full development workflow:

| Layer | What | How |
|-------|------|-----|
| **Skills** | TDD, debugging, planning, code review, brainstorming | [Superpowers](https://github.com/anthropics/claude-code-plugins) plugin with enforcement |
| **Session Persistence** | Remembers context between conversations | Hooks save/load summaries (~500 tokens) on stop/start |
| **Bash Permissions** | Auto-approves safe commands, blocks dangerous ones | PreToolUse hook parses compound commands segment-by-segment |
| **Status Line** | Model, branch, context %, agents, cost at a glance | Two-line colored terminal display |
| **MCP Servers** | Code nav, browser testing, web search, UI components | Docker (AIRIS gateway) or direct (individual servers) |
| **Living Docs** | ARCHITECTURE.md and DESIGN.md stay in sync with code | Custom skill fires on conversation start + after changes |
| **Project Template** | CLAUDE.md starter for any new project | `/sm:init` skill auto-detects tech stack and fills it in |
| **UI Plugins** | Design guidance for frontend work | frontend-design, ui-ux-pro-max |

## Quick Start

### Let Claude do it

Give Claude this repo URL and it will self-install:

> Clone https://github.com/steven-3/claude-setup.git and run the setup script

It will ask about API keys and Docker vs Direct MCP mode, then handle everything. After restarting Claude Code, run `/sm:init` in your project to create or update your project's CLAUDE.md.

### Or do it yourself

```bash
git clone https://github.com/steven-3/claude-setup.git
cd claude-setup
cp .env.example .env    # add API keys (optional)
bash setup.sh
```

Restart Claude Code after setup completes.

## What Gets Installed

### Hooks (to `~/.claude/hooks/`)

| Hook | Event | Purpose |
|------|-------|---------|
| `session-start.js` | SessionStart | Loads previous session summary into context |
| `session-end.js` | Stop | Saves branch, files, decisions, next steps |
| `cost-tracker.js` | Stop | Appends session cost to `~/.claude/cost-log.jsonl` |
| `statusline-command.js` | Status line | Two-line display with model, branch, context bar, agents, cost |
| `bash-permissions.js` | PreToolUse (Bash) | Classifies commands as safe/dangerous — see below |

### Plugins

| Plugin | Purpose |
|--------|---------|
| `superpowers` | TDD, debugging, planning, code review with enforcement |
| `claude-md-management` | CLAUDE.md auditing and maintenance |
| `frontend-design` | Responsive web design patterns |
| `ui-ux-pro-max` | Advanced UX patterns and design systems |

### MCP Servers

You choose Docker or Direct mode during setup:

- **Docker (recommended)**: Single AIRIS gateway on `localhost:9400` routing to Serena, Context7, Playwright, Tavily, chrome-devtools, shadcn
- **Direct**: Each server registered individually via npx/uvx (no Docker needed)

Plus Pencil (auto-detected) and Magic MCP (if API key provided).

## How Bash Permissions Work

Claude Code's default permission system uses pattern-matching allow-lists in `settings.json`. This breaks on compound commands (`cd foo && git add . && git commit -m "msg"`) because patterns can't match arbitrary combinations.

This setup replaces that with a **PreToolUse hook** that classifies commands dynamically:

```
Command received → split on && || ; → classify each segment → allow or ask
```

**Auto-approved**: read-only shell (ls, cat, grep, sed without -i, jq), safe git (status, diff, log, add, commit, stash), mkdir, read-only gh commands (pr list/view, issue list/view — not merge/close/delete), and any compound combining these.

**Worktree-aware**: `git merge`, `git worktree remove`, and `git branch -d` auto-approve **only** when a `cd` in the command targets a `.worktrees/` directory (or CWD is already in one). This prevents accidental merges in the main repo while allowing the worktree development workflow to run uninterrupted.

**Always asks**: git push/pull/fetch/reset/revert/rebase, rm, `--force`, `--hard`, and unknown commands.

To customize the rules, edit the classification lists at the top of `hooks/bash-permissions.js`.

## Quirks and Things to Know

### Superpowers enforcement

The Superpowers plugin enforces skill usage — it will make Claude check for applicable skills before responding to most requests. This is intentional but can feel heavy for simple tasks. Prefix requests with `quick:` to skip skill gates.

### Session persistence is lossy

Sessions save a ~500 token summary, not a full transcript. Claude gets the gist of what happened last time (branch, modified files, key decisions, next steps) but not every detail. This is a deliberate tradeoff for context window efficiency.

### Status line requires Node.js

The status line hook runs `node ~/.claude/hooks/statusline-command.js` on every render cycle. If Node isn't in your PATH, you'll see a blank status bar. No errors, just silence.

### Worktree directory convention

The setup expects worktrees in `.worktrees/` (with the dot). The bash permissions hook checks for this specific pattern. If you use a different directory name, update the regex in `bash-permissions.js`.

### Docker mode requires HOST_WORKSPACE_DIR

If using Docker/AIRIS mode, Serena can only see projects under the mounted `HOST_WORKSPACE_DIR` (defaults to `~/github`). Change it in `~/.claude/airis-mcp-gateway/.env` if your projects live elsewhere.

### ui-ux-pro-max may need a second install

This plugin uses a custom marketplace (`extraKnownMarketplaces` in settings.json). The marketplace is registered when settings.json is copied, but Claude Code may not discover it until the next restart. If installation fails during setup, restart Claude Code and run:
```bash
claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

### Plugin installation can fail silently

`claude plugin install` sometimes says "already installed" when it actually failed. Verify with `claude plugin list` after setup.

### The /sm:init skill needs a restart first

The `/sm:init` skill (for creating CLAUDE.md in new projects) is installed to `~/.claude/skills/` but won't be available until you restart Claude Code after running setup.

### Settings are overwritten, not merged

`setup.sh` backs up your existing `settings.json` to `.bak` then replaces it. If you've added custom settings, merge them back manually from the backup.

## New Project Setup

After installing, in any project directory:

1. Run `/sm:init` — auto-detects tech stack, creates CLAUDE.md, generates ARCHITECTURE.md
2. Or manually: `cp ~/.claude/templates/CLAUDE.md ./CLAUDE.md` and fill in the blanks

## Detailed Setup Guide

See [SETUP.md](SETUP.md) for manual installation, per-project Serena configuration, API keys, verification steps, and troubleshooting.
