# Claude Code Setup Guide

Portable Claude Code configuration with skills, session persistence, custom status line, and semantic code navigation.

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- [Node.js](https://nodejs.org/) 18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for AIRIS/Serena — optional but recommended)
- Git

## Quick Start

```bash
git clone https://github.com/steven-3/claude-setup.git
cd claude-setup
cp .env.example .env        # Edit .env and add your API keys
bash setup.sh
```

Restart Claude Code after setup completes.

## What Gets Installed

### Files

| Source | Destination | Purpose |
|--------|-------------|---------|
| `settings.json` | `~/.claude/settings.json` | Plugins, hooks, status line, permissions |
| `hooks/session-start.js` | `~/.claude/hooks/` | Loads previous session context on startup |
| `hooks/session-end.js` | `~/.claude/hooks/` | Saves session context on exit |
| `hooks/cost-tracker.js` | `~/.claude/hooks/` | Appends cost data to `~/.claude/cost-log.jsonl` |
| `hooks/statusline-command.js` | `~/.claude/hooks/` | Two-line colored status bar with metrics |
| `hooks/bash-permissions.js` | `~/.claude/hooks/` | PreToolUse hook that auto-approves safe Bash commands |
| `hooks.json` | `~/.claude/hooks.json` | Hook event definitions (skipped if already exists) |
| `skills/living-docs/SKILL.md` | `~/.claude/skills/living-docs/` | Auto-syncs ARCHITECTURE.md and DESIGN.md |
| `skills/sm/init/SKILL.md` | `~/.claude/skills/sm/init/` | Initialize/update CLAUDE.md with smart merge (`/sm:init`) |
| `skills/living-docs/init/SKILL.md` | `~/.claude/skills/living-docs/init/` | Creates AI-optimized ARCHITECTURE.md and DESIGN.md |
| `skills/living-docs/init/architecture-template.md` | `~/.claude/skills/living-docs/init/` | Skeleton template for ARCHITECTURE.md |
| `skills/living-docs/init/design-template.md` | `~/.claude/skills/living-docs/init/` | Skeleton template for DESIGN.md |
| `airis/docker-compose.yml` | `~/.claude/airis-mcp-gateway/` | Docker stack for MCP servers |
| `airis/mcp-config.json` | `~/.claude/airis-mcp-gateway/` | MCP server registry |
| `templates/CLAUDE.md` | `~/.claude/templates/CLAUDE.md` | Starter CLAUDE.md for new projects |

### Plugins

| Plugin | Purpose |
|--------|---------|
| `superpowers` | TDD, debugging, planning, code review with enforcement |
| `claude-md-management` | Documentation management |
| `frontend-design` | Responsive web design |
| `ui-ux-pro-max` | Advanced UX patterns |

### MCP Servers

During setup you'll be asked to choose an installation mode:

**Option 1: Docker via AIRIS (recommended)**

| Server | Transport | Notes |
|--------|-----------|-------|
| `airis-mcp-gateway` | SSE (localhost:9400) | Single endpoint routing to all servers below |
| `pencil` | Local exe | Auto-skipped if Pencil app not installed |
| `magic` | npx | Requires `TWENTYFIRST_API_KEY` in `.env` |

All 6 sub-servers (Serena, Context7, Playwright, Tavily, chrome-devtools, shadcn) are managed by Docker and accessed through the AIRIS gateway.

**Option 2: Direct (no Docker)**

| Server | Transport | Notes |
|--------|-----------|-------|
| `context7` | npx | Library docs lookup |
| `playwright` | npx | Browser automation |
| `serena` | uvx | Semantic code navigation (requires Python/uvx) |
| `tavily` | npx | Web search (requires `TAVILY_API_KEY`) |
| `chrome-devtools` | npx | Chrome debugging |
| `shadcn` | npx | UI component search |
| `pencil` | Local exe | Auto-skipped if Pencil app not installed |
| `magic` | npx | Requires `TWENTYFIRST_API_KEY` in `.env` |

Each server runs as a standalone process, started on demand by Claude Code.

### Status Line

Two-line terminal display showing:

```
╭ user@host  │  Opus 4.6 (1M context)  │  ~/project · main
╰ ━━━━━━━━━━━━━━━━━━━━ 12% ctx · 120k/1.0M  ◆ high  ⠹ 2 agents: Research.., Build..  $0.42
```

- User/host, model, directory, git branch
- Context window progress bar with color gradient
- Token usage, thinking level, active subagent count + names, session cost

### Bash Permission Hook

Instead of maintaining dozens of `Bash(...)` allow-list patterns in `settings.json`, a single `PreToolUse` hook (`bash-permissions.js`) classifies every Bash command dynamically:

1. Splits compound commands on `&&`, `||`, `;` (respects quotes)
2. Classifies each segment against safe-command rules
3. Returns `permissionDecision: "allow"` or `"ask"`

**Auto-approved commands** include read-only shell (ls, cat, sed without -i, grep, etc.), safe git (status, diff, log, add, commit, stash, worktree add/list), mkdir, gh CLI, and pipes between safe commands.

**Worktree-aware**: `git merge`, `git worktree remove`, and `git branch -d` are only auto-approved when the command includes a `cd` into a `.worktrees/` directory or CWD is already inside one. Outside that context, they require approval.

**Always requires approval**: git push/pull/fetch/reset/revert/rebase, rm, any `--force` or `--hard` flag, and unknown commands.

To customize, edit `~/.claude/hooks/bash-permissions.js` — the classification lists are at the top of the file.

## API Keys

Copy `.env.example` to `.env` and fill in:

```
TAVILY_API_KEY=your_key       # Web search via Tavily (used by AIRIS)
TWENTYFIRST_API_KEY=your_key  # 21st.dev magic components (optional)
```

## Verification

After setup and restarting Claude Code:

```bash
# Check MCP servers are registered
claude mcp list

# Check AIRIS gateway is running (if using Docker)
docker ps | grep airis

# Expected containers:
#   airis-serena              (Serena semantic code server)
#   airis-mcp-gateway-core    (Docker MCP gateway)
#   airis-mcp-gateway         (FastAPI proxy on port 9400)
```

---

## New Project Setup

After running `setup.sh`, every new project gets a starter CLAUDE.md:

```bash
cp ~/.claude/templates/CLAUDE.md /path/to/your/project/CLAUDE.md
```

Then fill in the project-specific sections:
1. **Commands** — dev, build, test commands
2. **Tech Stack** — frameworks and services used
3. **Project Structure** — directory layout

The template already includes generic sections for Git workflow, MCP server usage, UI change guidelines, and living documentation.

---

## Serena Per-Project Setup

Serena provides semantic code navigation (find-definition, find-references, rename refactoring, symbol overview). Each project needs a one-time onboarding regardless of which MCP mode you chose.

### If Using Docker Mode (AIRIS)

**Step 1: Ensure AIRIS is Running**

```bash
cd ~/.claude/airis-mcp-gateway
docker compose up -d
```

Verify at `http://localhost:9400/health`.

**Step 2: Make Project Accessible to Docker**

The docker-compose mounts `HOST_WORKSPACE_DIR` (defaults to `~/github`) into Serena's container. Either:

- **Option A** — Keep projects under the default path (`~/github/`)
- **Option B** — Change the mount in `~/.claude/airis-mcp-gateway/.env`:
  ```
  HOST_WORKSPACE_DIR=/path/to/your/projects
  ```
  Then restart: `docker compose down && docker compose up -d`

**Step 3: Activate the Project**

Open Claude Code in your project directory and tell Claude:

```
activate the project at /workspaces/projects/your-project
```

The path inside the container is always `/workspaces/projects/<folder-name>` regardless of host location.

### If Using Direct Mode

No Docker or path remapping needed. Serena runs standalone via `uvx` (requires Python/uvx installed).

Open Claude Code in your project directory and tell Claude:

```
activate the project at /path/to/your/project
```

Use your actual filesystem path.

### Onboarding (Both Modes, First Time Only)

On the first conversation in a new project, Claude will detect that onboarding hasn't been performed and run the `onboarding` tool. This:

- Indexes the project's symbols and structure
- Creates a `.serena/` directory in the project with configuration
- Builds the initial memory/context for Serena

You can also trigger it manually:

```
run serena onboarding for this project
```

### Verify

Ask Claude something that exercises semantic navigation:

```
find all references to the UserService class
```

If Serena is working, Claude will use `find_symbol`, `find_referencing_symbols`, and `get_symbols_overview` tools instead of grep.

### Per-Project Checklist

| Step | Docker Mode | Direct Mode |
|------|------------|-------------|
| 1. Project location | Under `HOST_WORKSPACE_DIR` | Anywhere on filesystem |
| 2. Activate | Container path: `/workspaces/projects/<name>` | Actual path: `/path/to/project` |
| 3. Onboard | First conversation (automatic) | First conversation (automatic) |
| 4. Memories | Persist in `.serena/memories/` | Persist in `.serena/memories/` |

---

## Troubleshooting

### Status line not showing
- Verify `~/.claude/hooks/statusline-command.js` exists
- Check `~/.claude/settings.json` has the `statusLine` entry
- Restart Claude Code

### Session hooks not firing
- Check `~/.claude/settings.json` has the `hooks` section with `SessionStart` and `Stop`
- Verify hook files exist in `~/.claude/hooks/`
- Check `~/.claude/sessions/` directory exists

### AIRIS not connecting
- Run `docker ps` to check containers are running
- Check `http://localhost:9400/health`
- View logs: `cd ~/.claude/airis-mcp-gateway && docker compose logs -f`
- Restart: `docker compose down && docker compose up -d`

### MCP server not registered
- Run `claude mcp list` to see registered servers
- Re-add manually: `claude mcp add --transport sse -s user airis-mcp-gateway http://localhost:9400/sse`

### Plugins not loading
- Run `claude plugin list` to verify installation
- Reinstall: `claude plugin install superpowers@claude-plugins-official`

## Updating

Pull the latest and re-run setup:

```bash
cd claude-setup
git pull
bash setup.sh
```

Your existing `settings.json` is backed up to `settings.json.bak` before overwriting.
