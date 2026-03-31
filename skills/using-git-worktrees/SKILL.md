---
name: using-git-worktrees
description: Automated worktree creation with safety checks — used by executors for isolated development
injects_into: [write-feature, fix-bug, refactor]
forked_from: obra/superpowers (MIT)
---

# Using Git Worktrees

Forked from [obra/superpowers](https://github.com/obra/superpowers) (MIT license) by Jesse Vincent and Prime Radiant. Adapted for Supermind executor injection.

## When to Use a Worktree

- Task touches more than 2-3 files
- Task involves logic changes (not just config/docs)
- Task follows an implementation plan with multiple steps
- Multiple executors running in parallel (each gets its own worktree)
- When in doubt, use a worktree — the cost is low, the safety is high

## Setup Process

### 1. Choose Directory

Use `.worktrees/` in the project root.

- Create `.worktrees/` if it doesn't exist
- Branch name: `worktree/<task-description-slug>` (e.g., `worktree/add-auth-middleware`)

### 2. Verify .gitignore Safety

**MUST happen before creating the worktree.**

```bash
# Check if .worktrees/ is already ignored
git check-ignore -q .worktrees 2>/dev/null
```

**If NOT ignored:**
1. Add `.worktrees/` to `.gitignore`
2. Commit: `chore: add .worktrees/ to .gitignore`
3. Then proceed with worktree creation

**Why critical:** Prevents accidentally committing worktree contents to the repository.

### 3. Create Worktree

```bash
git worktree add .worktrees/<name> -b worktree/<name>
```

- Always branch from `HEAD` (current local branch), never from a remote ref
- The worktree branch tracks the local branch it was created from

### 4. Install Dependencies (Auto-Detect)

```bash
# Node.js — detect lockfile to choose package manager
if [ -f package-lock.json ]; then npm install
elif [ -f yarn.lock ]; then yarn install
elif [ -f pnpm-lock.yaml ]; then pnpm install
elif [ -f package.json ]; then npm install
fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then pip install -e .; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 5. Baseline Test Verification

Run the project's test suite in the worktree:

```bash
# Use the project-appropriate command
npm test       # Node.js
cargo test     # Rust
pytest         # Python
go test ./...  # Go
```

- Report any pre-existing failures BEFORE starting work
- This establishes the baseline — the executor is not blamed for pre-existing failures
- If tests fail: report failures and note them as pre-existing, then proceed

## Working in the Worktree

- All file operations happen inside the worktree directory
- Commit frequently — small, atomic commits
- Stay on the worktree branch
- Do not modify files outside the worktree directory

## Completion

When the executor finishes its task:

1. Commit final state in the worktree
2. Report back to the orchestrator:
   - Branch name
   - Commit hash
   - Files changed
   - Test results
3. The orchestrator handles merge — **not the executor**

## Cleanup

Cleanup is handled by the orchestrator or the finishing skill, never by the executor:

```bash
git worktree remove .worktrees/<name>
git branch -d worktree/<name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| `.worktrees/` exists | Use it (verify ignored) |
| `.worktrees/` doesn't exist | Create it, verify ignored |
| Directory not in .gitignore | Add to .gitignore + commit first |
| Tests fail during baseline | Report as pre-existing, proceed |
| No package.json/Cargo.toml/etc. | Skip dependency install |
| Task touches <= 2 files, no logic changes | Skip worktree, work in place |
| Multiple executors in parallel | Each gets its own worktree |

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Skipping .gitignore check | Worktree contents get tracked, pollute git status | Always `git check-ignore` before creating |
| Branching from remote ref | Creates tracking mismatches | Always branch from `HEAD` |
| Executor merging its own branch | Conflicts with orchestrator's merge strategy | Report completion; orchestrator merges |
| Skipping baseline tests | Can't distinguish new bugs from pre-existing | Always run tests before starting work |
| Hardcoding setup commands | Breaks on projects using different tools | Auto-detect from lockfiles and project files |
