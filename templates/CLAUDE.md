# Claude Code Instructions

## Quick Reference
<!-- Update these as documentation files are created -->
- **Architecture details**: See `ARCHITECTURE.md`
- **Design system**: See `DESIGN.md`

## Commands
<!-- Fill in or run /supermind-init to auto-detect -->
```bash
# npm run dev      — start development server
# npm run build    — production build
# npm test         — run test suite
# npm run lint     — lint source files
```

## Tech Stack
<!-- Fill in or run /supermind-init to auto-detect -->

## Project Structure
<!-- Fill in or run /supermind-init to auto-detect -->

## Shell & Git Permissions

A PreToolUse hook (`bash-permissions.js`) classifies every Bash command automatically. It parses compound commands and splits on `&&`/`||`/`;` before classifying each segment individually. Most commands run without any prompt. Only the categories below are banned outright or require explicit approval.

**Banned — always requires approval:**
- `rm`, `rmdir`, `del` — destructive file removal
- Any command using `--force` or `--hard` flags (regardless of the base command)
- Destructive git operations: `push` (to remote), `pull`, `fetch`, `reset`, `revert`, `rebase`, `clean`, `checkout` (when used to discard changes), `restore`, `branch -D`
- Destructive stash operations: `stash drop`, `stash pop`, `stash clear`
- GitHub mutations: `gh pr merge`, `gh pr close`, `gh issue close`, `gh repo delete`, `gh release create`, `gh release delete`, any mutating `gh api` call (non-GET)
- `npm publish` — publishing to the registry always requires human confirmation

**Worktree-only** (auto-approved only when CWD is inside `.worktrees/`):
- `git merge` — merging back from a feature worktree
- `git worktree remove` — cleaning up a worktree directory
- `git worktree prune` — pruning stale worktree entries
- `git branch -d` — deleting a merged branch after cleanup

In all other contexts, these four commands still require user approval.

**Everything else is auto-approved:**
- Read-only shell: `ls`, `cat`, `head`, `tail`, `find`, `grep`, `sed` (without `-i`), `awk`, `echo`, `pwd`, `jq`, `wc`, `sort`, `uniq`, etc.
- Safe writes: `mkdir`, `touch`, `cp`, `mv`
- Utilities: `base64`, `curl` (read), `node`, `npx`, `claude` CLI (config/mcp/plugin subcommands)
- Read-only git: `status`, `diff`, `log`, `show`, `blame`, `rev-parse`, `check-ignore`, branch listing, tag listing, `config --get`/`--list`
- Non-destructive git writes: `add`, `commit`, `stash push`/`save`/`list`/`show`, `worktree add`, `worktree list`, branch create, branch rename, `tag` (local)
- gh read-only: `pr list`/`view`/`diff`, `issue list`/`view`, `repo view`, `gh api` GET requests, `gh run view`

**User overrides**: `~/.claude/supermind-approved.json` contains commands permanently approved by the user. If asked to approve a command permanently, add the command string to that file. Manage via `supermind approve "command"`.

Compound commands with `&&`, `||`, `;`, and pipes are fully supported — no need to split into separate calls.

## Subagent Strategy

Always use **subagent-driven development** for implementation work. This means spawning multiple parallel subagents to execute independent tasks instead of running everything in a single thread.

**Task granularity:** Each subagent task should touch at most 3 files. Larger tasks must be decomposed into smaller, independent pieces before dispatch. Smaller tasks are easier to parallelize, easier to review, and produce cleaner commit history.

**Parallelism:** Prefer 10 parallel subagents over 3 sequential ones. Any tasks that share no state and have no ordering dependency must run in parallel. Never serialize work that can parallelize — the goal is minimum wall-clock time, not minimum subagent count. If you find yourself writing "then do X, then do Y, then do Z" for three unrelated changes, those should be three parallel subagents.

**Milestone decomposition:** If an implementation plan has more than 8 tasks, split into milestones before starting. Each milestone is a coherent, independently committable unit of work. Run all tasks within a milestone in parallel, then review, commit, and advance to the next milestone. Do not start milestone N+1 until milestone N is committed and clean.

**Autonomy:** Subagents execute without stopping to ask for permission. If a subagent hits a blocker that genuinely cannot be resolved by reading the codebase or making a reasonable judgment call, surface it — but most uncertainty should be resolved autonomously.

**What counts as independent:** Two tasks are independent if neither reads a file the other writes, they do not share mutable in-memory state, and their commit order does not matter for correctness. When in doubt, run them in parallel — conflicts in parallel commits are far cheaper to resolve than the time lost to needless serialization.

## Development Lifecycle

This entire lifecycle executes autonomously — no stopping to ask for permission at any step. The user receives one summary when the lifecycle is complete.

**Branch safety:** If the current branch is `main` or `master` when a code change is requested, create a feature branch first (`feature/…`, `fix/…`, or `chore/…`) before making any changes. Never commit directly to `main` or `master`.

**Lifecycle overview:**
1. Setup — branch + worktree + deps + baseline
2. Design & Plan — read docs, spec or brainstorm, milestone plan
3. Implementation — parallel subagents, milestone commits
4. Test & Verify — tests + code review + fix everything + re-review
5. Pre-merge — update docs, version bump, changelog
6. Merge — merge to originating branch, clean up worktree

### Phase 1 — Setup
- Verify the current branch is not `main`/`master`; create a feature branch if it is
- Invoke `/using-git-worktrees` to create an isolated worktree in `.worktrees/`
  - The skill verifies `.gitignore` safety and adds an entry if missing
  - It installs dependencies automatically (detects package.json, Cargo.toml, pyproject.toml, etc.)
  - It reports baseline test results before work begins
- Branch must be created from the current local `HEAD`, never from a remote ref
- Do not proceed if baseline tests are broken — surface failures first

### Phase 2 — Design & Plan
- Read `ARCHITECTURE.md` and `DESIGN.md` to understand existing patterns, conventions, and constraints before proposing any approach
- **Complex changes** — new subsystem, cross-cutting refactor, ambiguous requirements, or significant design tradeoffs: invoke `/brainstorming` to explore the design space, then write a milestone-based implementation plan; do not start implementation until the plan is reviewed
- **Simple changes** — clear, contained requirements with no meaningful design decisions open: invoke `/brainstorming` to quickly explore the approach, then write a milestone-based implementation plan
- If the plan exceeds 8 tasks, decompose into milestones now — not during implementation

### Phase 3 — Implementation
- Execute using the Subagent Strategy: spawn parallel subagents for all independent tasks within a milestone
- Commit at each milestone boundary with a descriptive commit message that explains why the change was made, not just what changed
- Do not advance to the next milestone before the current one is committed
- Do not implement beyond the written plan without flagging the addition

### Phase 4 — Test & Verify
- Run the full test suite; fix all failures before proceeding — do not leave failing tests as "known issues"
- Invoke the `code-reviewer` agent against all changes in the branch
- Fix **every** finding — critical, important, minor, style, naming, and suggestions. Do not ask which to fix. Fix everything.
- Re-run the reviewer after applying fixes. Repeat until the reviewer returns zero findings.
- Never skip the review step. Never defer "minor" fixes. Every finding is addressed before moving on.

### Phase 5 — Pre-merge
- Compare `ARCHITECTURE.md` and `DESIGN.md` against every changed file; update any stale claims about behavior, constants, file layout, APIs, data models, or environment variables
- Bump the version following semver: patch for bug fixes, minor for new features, major for breaking changes to public interfaces
- Update `CHANGELOG.md` with a concise summary of what changed and why
- Commit all pre-merge updates (docs, version, changelog) in the worktree branch

### Phase 6 — Merge
- Invoke `/finishing-a-development-branch` to merge back and clean up
- The skill merges the worktree branch into the **originating branch only** — the branch that was active in Phase 1. Never merge into a different branch.
- The skill removes the worktree directory and deletes the temporary branch
- Confirm the merge succeeded and the working tree is clean before reporting done

## Vendor Skills

Supermind skills extend Claude Code with reusable, versioned behaviors. Skills live in `~/.claude/skills/` and are invoked with `/skill-name` during a session. Install and manage them with the `supermind` CLI:

```bash
supermind skill add <github-url>          # Install a skill (project-local by default)
supermind skill add <github-url> --global # Install a skill globally
supermind skill update [name]             # Update a specific skill
supermind skill update --all              # Update all installed skills to latest versions
supermind skill list                      # List all installed skills and their current versions
supermind skill remove <name>             # Uninstall a skill and remove it from skills-lock.json
```

Installed skills and their pinned versions are recorded in `~/.claude/skills-lock.json`. Commit `skills-lock.json` to your repository to share the exact skill set with your team and ensure consistent behavior across all machines.

{{MCP_SECTION}}

## UI Changes

When making any UI/frontend changes, invoke the `/ui-ux-pro-max` skill for design guidance and quality checks before finalizing the implementation.

The skill provides:
- Design token and color palette validation
- Typography and spacing consistency checks
- Component accessibility review
- Responsive behavior assessment
- Recommendations aligned with the project's existing design language

Do not ship UI changes without running this skill. Design quality is a first-class concern, not a post-implementation polish step.

## Living Documentation

Living documentation means `ARCHITECTURE.md` and `DESIGN.md` stay accurate as the code evolves. They are not written once and forgotten — they are updated as part of every development lifecycle.

**Automatic loading:** The session-start hook reads `ARCHITECTURE.md` and `DESIGN.md` at the start of every conversation so Claude always has current context without being asked.

**When to update `ARCHITECTURE.md`:** After any code change that affects file layout, module responsibilities, public APIs, environment variables, configuration schema, external dependencies, or build/deploy steps.

**When to update `DESIGN.md`:** After any UI/design change that affects the color palette, typography, spacing scale, component library, layout patterns, or interaction conventions.

**Manual sync:** Run `/supermind-living-docs` at any time to audit both documents against recent changes and update anything stale.

**Bootstrap:** If `ARCHITECTURE.md` is missing, run `/supermind-init` to generate it from the current codebase. This also creates `DESIGN.md` if the project has a UI layer.
