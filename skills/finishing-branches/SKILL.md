<!-- Forked from obra/superpowers (MIT license) by Jesse Vincent and Prime Radiant. Adapted for Supermind orchestrator. -->
---
name: finishing-branches
description: Ship phase — push branch, open PR, clean up worktrees. Never merges to main/master.
injects_into: [orchestrator-ship]
forked_from: obra/superpowers (MIT)
---

# Finishing Branches

## Overview

Handle the Ship phase — push the feature branch, open a PR, and clean up worktrees. The orchestrator picks the appropriate option based on context.

**Core principle:** Verify tests -> Choose option -> Execute -> Clean up.

**Announce at start:** "Using finishing-branches to complete this work."

## Step 1: Verify Tests

Before anything else, run the project's test suite:

```bash
npm test / cargo test / pytest / go test ./...
```

**If tests fail:** Stop. Do not proceed. Report failures and fix them first.

**If tests pass:** Continue to Step 2.

## Step 2: Choose Option

The orchestrator picks one of three options:

### Option A: Create PR (default for Ship phase)

Push the feature branch and open a pull request.

```bash
# Push feature branch to remote
git push -u origin <branch>
```

```bash
# Open PR with summary from .planning/
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<bullets: what was built, tasks completed>

## Test Results
<test suite output summary>

## Tasks Completed
<from .planning/phases/phase-N/progress.md>
EOF
)"
```

- PR description auto-generated from `.planning/` state
- Never set auto-merge — user merges manually
- Clean up worktrees after PR is created (Step 3)

### Option B: Keep Branch

Keep the branch for continued work later.

```bash
# Commit all changes
git add -A && git commit -m "wip: <description>"
```

- Report branch name and current status
- Leave worktrees intact — do NOT clean up
- Report: "Keeping branch `<name>`. Worktree preserved at `<path>`."

### Option C: Discard

Throw away the work. **Requires explicit user confirmation.**

```
This will permanently delete:
- Branch: <name>
- All commits since branching
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact typed confirmation before proceeding.

If confirmed:
```bash
git checkout <originating-branch>
git branch -D <feature-branch>
```

Clean up worktrees after deletion (Step 3).

## Step 3: Worktree Cleanup

**For Options A and C only** (not B):

```bash
# Remove each worktree used during execution
git worktree remove .worktrees/<name>

# Prune stale worktree references
git worktree prune

# Delete merged worktree branches
git branch -d worktree/<name>
```

## Safety Rules

These are non-negotiable:

- **NEVER merge to main/master.** The PR is the integration mechanism.
- **NEVER force push.** No `--force`, no `--force-with-lease` unless the user explicitly requests it.
- **NEVER set auto-merge** on the PR.
- **Always verify tests** before offering any option.
- **Always get typed confirmation** for Option C (discard).

## Quick Reference

| Option | Push | PR | Keep Worktree | Cleanup Branch |
|--------|------|------|---------------|----------------|
| A. Create PR | yes | yes | no | no (PR branch) |
| B. Keep Branch | no | no | yes | no |
| C. Discard | no | no | no | yes (force) |

## Red Flags

**Never:**
- Proceed with failing tests
- Merge to main/master
- Delete work without typed confirmation
- Force-push without explicit user request

**Always:**
- Verify tests first
- Generate PR description from `.planning/` state
- Clean up worktrees for Options A and C
- Preserve worktrees for Option B
