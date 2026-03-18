# Supermind

## Project Overview
Supermind is an npm package (`supermind-claude`) providing complete Claude Code setup — hooks, skills, status line, MCP servers, and living documentation.

**File organization:**
- `cli/` — Installer commands (install, update, doctor, uninstall)
- `hooks/` — Runtime hooks copied to `~/.claude/hooks/` (session persistence, bash permissions, status line, cost tracking)
- `skills/` — SKILL.md files copied to `~/.claude/skills/` (supermind-init, supermind-living-docs)
- `templates/` — CLAUDE.md project template copied to `~/.claude/templates/`
- `cli/lib/` — Shared utilities (paths, settings builder, file operations)

## Skill System
- Superpowers skills are installed and auto-trigger per the using-superpowers meta-skill
- When I prefix a request with "quick:", skip brainstorming and skill gates
- Superpowers enforcement takes priority over all other methodology guidance **except** Git Permissions, Shell Permissions, and Worktree Workflow rules in this file — those are enforced by a PreToolUse hook and must not be second-guessed or re-prompted by skills
- **`/supermind-init`** onboards a project: creates CLAUDE.md, generates ARCHITECTURE.md and DESIGN.md, runs health checks
- **`/supermind-living-docs`** keeps ARCHITECTURE.md and DESIGN.md in sync with code changes (manual trigger)

## Shell & Git Permissions

A PreToolUse hook (`bash-permissions.js`) handles all Bash permission classification automatically. It parses compound commands, splits on `&&`/`||`/`;`, and classifies each segment. You do not need to worry about permission prompts for safe commands — the hook handles it.

**Auto-approved** (standalone or in any compound):
- **Read-only shell**: ls, cat, head, tail, find, sed (without -i), grep, echo, pwd, jq, etc.
- **Safe writes**: mkdir, touch, cp, mv
- **Read-only git**: status, diff, log, show, blame, rev-parse, check-ignore, branch listing, tag listing, config
- **Non-destructive git writes**: add, commit, stash, worktree add, worktree list, branch create
- **gh CLI**: read-only gh commands (pr list/view/diff, issue list/view, repo view, etc. — not merge, close, delete)

**Worktree-only** (auto-approved only when `cd` targets a `.worktrees/` path or CWD is inside one):
- git merge, git worktree remove, git branch -d

**Always requires approval**:
- push, pull, fetch, reset, revert, rebase, clean, checkout (discarding), restore, branch -D
- Any command with --force or --hard
- rm, rmdir, del

Compound commands with `&&`, `||`, `;` and pipes are fully supported — no need to split into separate calls.

## Worktree Development Workflow

When implementing changes beyond a trivial edit, use a worktree. The bar is low — if it touches more than 2-3 files, involves logic changes, or follows an implementation plan, it goes through a worktree.

Always use **subagent-driven development** for implementation.

### Setup

Use the superpowers `/using-git-worktrees` skill for worktree creation. It handles:
- Directory selection (`.worktrees/` preferred, already configured)
- `.gitignore` safety verification (adds entry + commits if missing)
- Dependency installation (auto-detects package.json, Cargo.toml, etc.)
- Baseline test verification (reports failures before work begins)

**Constraint:** The skill must branch from `HEAD` (the current local branch), never from a remote ref.

### Process (runs fully autonomously — no approval needed at any step)

1. **Create worktree** — invoke `/using-git-worktrees` as described above
2. **Implement** all changes in the worktree directory using subagent-driven development
3. **Commit** all work in the worktree
4. **Review** — run the superpowers `code-reviewer` agent against the changes
5. **Fix everything** — address ALL issues found by the reviewer (critical, minor, style, naming — everything). Do not ask what to fix. Fix all of them. Then re-review until the reviewer passes clean.
6. **Finish** — invoke `/finishing-a-development-branch` to merge back and clean up. The skill handles:
   - Merging the worktree branch into the originating branch
   - Removing the worktree directory
   - Deleting the temporary branch

### Rules

- The worktree branch must always be created from and merged back into the **same branch** — the one you are currently on locally. Never merge into a different branch.
- `git merge`, `git worktree remove`, and `git branch -d` are auto-approved **only** within this worktree workflow. In all other contexts, these still require user approval.
- The code reviewer must find zero remaining issues before merging. If it finds problems, fix them and run the reviewer again. Repeat until clean.
- Never skip the review step. Never skip "minor" fixes. Every finding gets fixed.
- This entire process — create, implement, review, fix, merge, clean up — executes without stopping to ask for permission.

## Development Workflow
All non-trivial changes go through the worktree workflow above. Claude handles version bumps in `package.json` and updates to `CHANGELOG.md` as part of the commit.

## Release Checklist
1. Bump version in `package.json`
2. Update `CHANGELOG.md`
3. Test with `node cli/index.js --version` and `node cli/index.js doctor`
4. Commit
5. `npm publish` (requires user approval)

## Versioning
- **Patch** (0.0.x): Bug fixes, typo corrections, minor hook/skill tweaks
- **Minor** (0.x.0): New features, new hooks/skills, new CLI commands
- **Major** (x.0.0): Breaking changes to CLI interface, hook API, or installed file layout

## MCP Servers
Use these naturally when relevant — don't wait to be asked.

- **Serena** (via AIRIS gateway): Semantic code navigation with `--context claude-code`. Use for find-definition, find-references, rename refactoring. Serena memories persist in `.serena/memories/`
- **Context7**: Library documentation retrieval
- **Playwright**: Browser testing and interaction
- **Tavily**: Web search when WebSearch is insufficient
- **shadcn**: UI component references
- **Magic MCP**: `component_builder`, `component_inspiration`, `component_refiner`, `logo_search`

## UI Changes
- When making any UI/frontend changes, invoke the `/ui-ux-pro-max` skill for design guidance and quality checks.

## Living Documentation
- The session-start hook automatically reads `ARCHITECTURE.md` and `DESIGN.md` (if it exists) at the beginning of every conversation.
- After code changes, update `ARCHITECTURE.md` if files, APIs, dependencies, or environment variables changed.
- After design/UI changes, update `DESIGN.md` if colors, fonts, spacing, or components changed.
- Run `/supermind-living-docs` to manually sync documentation with recent changes.
- If `ARCHITECTURE.md` is missing, run `/supermind-init` to create one.

## Hooks
Session persistence hooks fire automatically:
- `SessionStart`: Loads previous session summary (~500-700 tokens), reads ARCHITECTURE.md and DESIGN.md
- `Stop`: Saves session context for next session + cost tracking

## Memory Protocol
- Project-specific rules belong in this file (CLAUDE.md)
- Use Serena `write_memory` for architectural decisions and conventions discovered during work
- Cross-project patterns: manually extract to `~/.serena/memories/global/` or Obsidian vault
- Session continuity is handled by hooks (session-start.js / session-end.js)
