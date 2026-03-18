# Claude Code Instructions

## Quick Reference
<!-- Update these as documentation files are created -->
- **Architecture details**: See `ARCHITECTURE.md`
- **Design system**: See `DESIGN.md`

## Commands
<!-- Fill in the project's common commands -->
```bash
# npm run dev / start / build / test etc.
```

## Tech Stack
<!-- List the project's core technologies -->

## Project Structure
<!-- Document the directory layout -->

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

## MCP Servers
Use these naturally when relevant — don't wait to be asked.

- **Magic MCP** — `component_builder`, `component_inspiration`, `component_refiner`, `logo_search` — use when building/refining UI components
- **Airis Gateway** (Docker, localhost:9400) — cold-start sub-servers:
  - **context7** — Library docs lookup
  - **playwright** — Browser automation/testing
  - **serena** — Symbolic code navigation (run `activate_project` on first use)
  - **tavily** — Web search/research
  - **chrome-devtools** — Chrome debugging
  - **shadcn** — shadcn/ui component search

## UI Changes
- When making any UI/frontend changes, invoke the `/ui-ux-pro-max` skill for design guidance and quality checks.

## Living Documentation
- At conversation start, check for `ARCHITECTURE.md` (always) and `DESIGN.md` (only if it exists).
- If `ARCHITECTURE.md` is missing, prompt the user to run `/sm:init` before starting any coding work.
- If `DESIGN.md` exists, treat this as a UI project and maintain it alongside `ARCHITECTURE.md`.
- After code changes, update `ARCHITECTURE.md`. After design/UI changes, update `DESIGN.md` (if it exists).
