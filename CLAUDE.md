# Supermind

## Project Overview
Supermind is an npm package (`supermind-claude`) providing complete Claude Code setup — hooks, skills, status line, MCP servers, and living documentation.

**File organization:**
- `cli/` — Installer commands (install, update, doctor, uninstall, skill, openspec)
- `cli/lib/` — Shared utilities (paths, settings, hooks, skills, templates, mcp, plugins, logger, vendor-skills, openspec)
- `hooks/` — Runtime hooks copied to `~/.claude/hooks/` (7 hooks: bash-permissions, session-start, session-end, cost-tracker, statusline, pre-merge-checklist, improvement-logger)
- `skills/` — SKILL.md files copied to `~/.claude/skills/` (7 dirs: supermind, supermind-init, supermind-living-docs, openspec-propose, openspec-explore, openspec-apply, openspec-archive)
- `templates/` — CLAUDE.md project template copied to `~/.claude/templates/`

## Skill System
- Superpowers skills are installed and auto-trigger per the using-superpowers meta-skill
- When I prefix a request with "quick:", skip brainstorming and skill gates
- Superpowers enforcement takes priority over all other methodology guidance **except** Git Permissions, Shell Permissions, and Worktree Workflow rules in this file — those are enforced by a PreToolUse hook and must not be second-guessed or re-prompted by skills
- **`/supermind-init`** onboards a project: creates CLAUDE.md, generates ARCHITECTURE.md and DESIGN.md, runs health checks, scaffolds `openspec/` directory
- **`/supermind-living-docs`** keeps ARCHITECTURE.md and DESIGN.md in sync with code changes (manual trigger)
- **`/openspec-propose`**, **`/openspec-explore`**, **`/openspec-apply`**, **`/openspec-archive`** — OpenSpec workflow skills

## OpenSpec Integration
- OpenSpec CLI is detected/installed during `supermind install` (step 8)
- 4 OpenSpec skills ship with supermind: propose, explore, apply, archive
- Skills use CLI when available, fall back to manual directory/file creation
- `/supermind-init` scaffolds `openspec/` directory in new projects
- `supermind openspec install` — standalone CLI installer
- `supermind openspec doctor` — check CLI health

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

### Auto-trigger: Skill Development Tools
- When **writing or modifying** files in `skills/` or `hooks/` (SKILL.md content, hook scripts, frontmatter), invoke `working-with-claude-code` to reference the correct schemas and formats
- When a skill is **functionally complete** (draft written or meaningfully revised), invoke `skill-creator` to run the eval/improvement loop — test prompts, benchmarking, and description optimization
- These two don't replace each other: `working-with-claude-code` is for getting the implementation right, `skill-creator` is for verifying the skill actually works well

## Shell & Git Permissions

A PreToolUse hook (`bash-permissions.js`) handles all Bash permission classification automatically. It parses compound commands, splits on `&&`/`||`/`;`, and classifies each segment. You do not need to worry about permission prompts for safe commands — the hook handles it.

**Auto-approved** (standalone or in any compound):
- **Read-only shell**: ls, cat, head, tail, find, sed (without -i), grep, echo, pwd, jq, etc.
- **Safe writes**: mkdir, touch, cp, mv
- **Utilities**: base64, claude CLI (config/mcp/plugin subcommands)
- **Read-only git**: status, diff, log, show, blame, rev-parse, check-ignore, branch listing, tag listing, config (read-only: --get, --list)
- **Non-destructive git writes**: add, commit, stash (bare/push/save/list/show), worktree add, worktree list, branch create, branch rename
- **gh CLI**: read-only gh commands (pr list/view/diff, issue list/view, repo view, gh api GET — not merge, close, delete, or mutating API calls)

**Worktree-only** (auto-approved only when `cd` targets a `.worktrees/` path or CWD is inside one):
- git merge, git worktree remove, git worktree prune, git branch -d

**Always requires approval**:
- push, pull, fetch, reset, revert, rebase, clean, checkout (discarding), restore, branch -D
- stash drop, stash pop, stash clear (destructive stash operations)
- Any command with --force or --hard
- rm, rmdir, del

**User-approved commands**: `~/.claude/supermind-approved.json` contains commands permanently approved by the user. If asked to approve a command permanently, edit this file. Manage via `npx supermind-claude approve "command"`.

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
6. **Living docs check** — before merging, check if the changes affect anything documented in ARCHITECTURE.md (or DESIGN.md). For each changed file, verify that any claims the docs make about that file's behavior, constants, or patterns are still accurate. If updates are needed, make them and commit in the worktree branch.
7. **Finish** — invoke `/finishing-a-development-branch` to merge back and clean up. The skill handles:
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
3a. Archive any OpenSpec changes used during development: `/openspec-archive`
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
