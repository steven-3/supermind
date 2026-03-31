# Supermind

## Project Overview
Supermind is an npm package (`supermind-claude`) providing complete Claude Code setup — hooks, skills, status line, MCP servers, and living documentation.

**File organization:**
- `cli/` — Installer commands (install, update, doctor, uninstall, skill)
- `cli/lib/` — Shared utilities (paths, settings, hooks, skills, templates, mcp, logger, vendor-skills)
- `hooks/` — Runtime hooks copied to `~/.claude/hooks/` (8 hooks: bash-permissions, session-start, session-end, cost-tracker, statusline, pre-merge-checklist, improvement-logger, context-monitor)
- `skills/` — SKILL.md files copied to `~/.claude/skills/` (3 dirs: supermind, supermind-init, supermind-living-docs)
- `templates/` — CLAUDE.md project template copied to `~/.claude/templates/`

## Skill System
- When I prefix a request with "quick:", skip brainstorming and skill gates
- **`/supermind-init`** onboards a project: creates CLAUDE.md, generates ARCHITECTURE.md and DESIGN.md, runs health checks
- **`/supermind-living-docs`** keeps ARCHITECTURE.md and DESIGN.md in sync with code changes (manual trigger)

## Vendor Skill System
- `supermind skill add <github-url> [--global]` — install from GitHub repo
- `supermind skill update [name] [--all]` — refresh from source
- `supermind skill list` — show installed with source and version
- `supermind skill remove <name>` — remove skill and lock entry
- Global lock: `~/.claude/skills-lock.json`, Project lock: `.claude/skills-lock.json`

## Hook Reference
| Hook | Event | Matcher | Purpose |
|------|-------|---------|---------|
| bash-permissions.js | PreToolUse | Bash | Command permission classification |
| session-start.js | SessionStart | — | Load session + living docs |
| session-end.js | Stop | — | Save session summary |
| cost-tracker.js | Stop | — | Log session cost |
| statusline-command.js | statusLine | — | Two-line terminal display |
| pre-merge-checklist.js | PostToolUse | Bash | Advisory pre-merge warnings |
| improvement-logger.js | Stop | — | Session improvement tracking |
| context-monitor.js | PostToolUse | — | Context window usage warnings at 35%/25% remaining |

## Shell & Git Permissions

A PreToolUse hook (`bash-permissions.js`) uses a **blocklist model**: everything is auto-approved by default, only explicitly dangerous commands require approval. It parses compound commands, splits on `&&`/`||`/`;`, and classifies each segment. Blocked commands are logged to `~/.claude/safety-log.jsonl`.

**Default: everything auto-approved** — all build/test/lint tools (node, npm, npx, python, cargo, go, make, tsc, etc.), all read-only commands, all file creation/modification, git fetch, git pull, git push to feature branches.

**Blocklist (always requires approval):**
- `rm`, `rmdir`, `del` (destructive filesystem)
- `git reset --hard`, `git clean`, `git rebase`, `git revert` (history rewriting)
- `git checkout .`, `git checkout -- <file>`, `git restore` (discarding changes)
- `git push --force` (any branch), `git push` to main/master
- `git merge` outside worktree context
- `git stash drop/pop/clear`, `git branch -D`
- `kill`, `killall`, `pkill` (process termination)
- `npm publish`, `docker push` (publishing)
- Database CLIs (`psql`, `mysql`, `mongo`, `mongosh`, `redis-cli`) with `DROP`, `DELETE FROM`, `TRUNCATE`, `ALTER TABLE`
- `curl`/`wget` with mutating HTTP methods (`-X POST/PUT/PATCH/DELETE`, `--post-data`)
- Any command with `--force` or `--hard`
- Mutating `gh` CLI commands (pr merge/close, issue close/delete, repo delete, mutating API calls)

**Worktree-only** (auto-approved only when `cd` targets a `.worktrees/` path or CWD is inside one):
- git merge, git worktree remove, git worktree prune, git branch -d

**User-approved commands**: `~/.claude/supermind-approved.json` contains commands permanently approved by the user. If asked to approve a command permanently, edit this file. Manage via `npx supermind-claude approve "command"`.

Compound commands with `&&`, `||`, `;` and pipes are fully supported — no need to split into separate calls.

## Worktree Development Workflow

When implementing changes beyond a trivial edit, use a worktree. The bar is low — if it touches more than 2-3 files, involves logic changes, or follows an implementation plan, it goes through a worktree.

### Setup

Create a worktree in `.worktrees/` from the current branch:
- Verify `.worktrees/` is in `.gitignore` (add entry + commit if missing)
- Create worktree: `git worktree add .worktrees/<name> -b <branch-name>`
- Install dependencies if needed (auto-detect package.json, Cargo.toml, etc.)
- Run baseline tests to identify pre-existing failures

**Constraint:** Always branch from `HEAD` (the current local branch), never from a remote ref.

### Process (runs fully autonomously — no approval needed at any step)

1. **Create worktree** — follow the setup steps above
2. **Implement** all changes in the worktree directory
3. **Commit** all work in the worktree
4. **Review** — run code review against the changes
5. **Fix everything** — address ALL issues found by the reviewer (critical, minor, style, naming — everything). Do not ask what to fix. Fix all of them. Then re-review until the reviewer passes clean.
6. **Living docs check** — before merging, check if the changes affect anything documented in ARCHITECTURE.md (or DESIGN.md). For each changed file, verify that any claims the docs make about that file's behavior, constants, or patterns are still accurate. If updates are needed, make them and commit in the worktree branch.
7. **Finish** — merge back and clean up:
   - Merging the worktree branch into the originating branch
   - Removing the worktree directory
   - Deleting the temporary branch

### Rules

- The worktree branch must always be created from and merged back into the **same branch** — the one you are currently on locally. Never merge into a different branch.
- `git merge`, `git worktree remove`, `git worktree prune`, and `git branch -d` are auto-approved **only** within this worktree workflow. In all other contexts, these still require user approval.
- The code reviewer must find zero remaining issues before merging. If it finds problems, fix them and run the reviewer again. Repeat until clean.
- Never skip the review step. Never skip "minor" fixes. Every finding gets fixed.
- This entire process — create, implement, review, fix, merge, clean up — executes without stopping to ask for permission.

## Development Workflow
All non-trivial changes go through the worktree workflow above. Claude handles version bumps in `package.json` and updates to `CHANGELOG.md` as part of the commit.

**6-phase development lifecycle:** Plan → Worktree → Implement → Review → Living Docs → Finish. Each phase is mandatory for non-trivial changes.

**Branch safety:** If the current branch is `main` or `master` when a code change is requested, create a feature branch first (`feature/…`, `fix/…`, or `chore/…`) before making any changes. Never commit directly to `main` or `master`.

## PR Review Workflow

When `/pr-review-toolkit:review-pr` is invoked, run an **auto-fix loop** instead of just reporting findings:

1. **Run the review** — launch all applicable review agents (code, comments, errors, simplify) in parallel
2. **Collect findings** — aggregate results into critical, important, and suggestions
3. **If issues found** — spawn subagents to fix them directly (no worktree needed for pre-PR fixes). Each subagent gets a specific set of findings to address. Do not ask the user what to fix — for the first 2 rounds, fix everything including suggestions. After that, fix only critical and important issues.
4. **Re-run the review** — after all fixes are applied, run the review again. For the first 2-3 rounds, always launch all agents. After that, scale down to only the agents relevant to the remaining changes.
5. **Repeat** steps 2-4 until the review comes back clean (zero critical and important issues; suggestions are acceptable)
6. **Report** — tell the user:
   - What was found and fixed in each round
   - How many review cycles were needed
   - Any remaining suggestions that were left as-is (with reasoning)

No user approval needed at any step — this runs autonomously like the worktree workflow. The user gets one final summary when it's done.

After the review passes clean, run the **pre-publish verification** automatically:
1. `node cli/index.js --version` — confirm version matches `package.json`
2. `node cli/index.js doctor` — verify installation health
3. `npm pack --dry-run` — verify package contents (correct files included, nothing missing)
4. Report results to the user. Do not publish — that is manual.

## Release Checklist
1. Bump version in `package.json`
2. Update `CHANGELOG.md`
3. Commit
4. After PR is squash-merged into `main`, automatically:
   - Create git tag: `git tag v<version> && git push origin v<version>`
   - Create GitHub release: `gh release create v<version>` with notes from CHANGELOG.md
   - Delete the merged feature branch (local + remote)
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
