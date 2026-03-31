<!-- Forked from obra/superpowers (MIT license) by Jesse Vincent and Prime Radiant. Adapted for Supermind orchestrator. -->
---
name: executing-plans
description: Wave-based plan execution with progress tracking and failure handling — used by orchestrator Execute phase
injects_into: [orchestrator-execute]
forked_from: obra/superpowers (MIT)
---

# Executing Plans

## Overview

Guide the orchestrator through wave-based plan execution. Coordinate executor dispatch, track progress, handle failures. Every task runs in a fresh-context subagent — the orchestrator never executes code directly.

**Announce at start:** "Using executing-plans to run the implementation plan."

## Execution Process

### 1. Load the Plan

Read the plan and task specs from `.planning/phases/phase-N/`:
- `plans/plan.md` — the full plan with dependency graph
- `tasks/task-N.md` — individual task specs (one per executor)

Review critically before starting. If concerns exist, raise them before executing.

### 2. Build the Wave Plan

Use the dependency graph from the plan to group tasks into waves. Tasks with no unresolved dependencies form the current wave. Use `buildWavePlan` from `executor.js` for topological sorting.

```
Wave 1: [Task A, Task B, Task C]    <- independent, parallel
Wave 2: [Task D (needs A), Task E]  <- D waits for A, E independent
Wave 3: [Task F (needs D+E)]        <- depends on wave 2
```

### 3. Execute Waves

For each wave:

**a. Dispatch executor subagents in parallel** (one per task, up to `maxParallel`):
- Each executor gets: task spec + injected methodology skills + completion contract
- Use `buildTaskPacket` from `executor.js` to assemble the task packet
- Use `executeTask` from `executor.js` to build the Agent tool invocation
- Respect `config.json` `maxParallel` setting (default: 3)

**b. Wait for all executors in the wave to complete**

**c. Record results in progress.md:**
Update `.planning/phases/phase-N/progress.md` after each task completes.

| Wave | Task | Status | Executor | Commit | Notes |
|------|------|--------|----------|--------|-------|

Use `formatWaveProgress` from `executor.js` for the Markdown table.

**d. Handle failures** (see Failure Handling below)

### 4. Between Waves

After each wave completes, before starting the next:
- Verify no conflicts between executor outputs (`git status`)
- Run the test suite to catch integration issues
- If tests fail, diagnose before proceeding to the next wave

### 5. After All Waves

Run full verification:
- Complete test suite
- Lint check (if configured)
- Build check (if configured)
- Compare results against the original plan's acceptance criteria

## Failure Handling

### Single Task Failure
1. Spawn a debugger executor with the error context (use `fix-bug` task type for systematic-debugging skill injection)
2. Debugger gets: original task spec + error output + relevant file state
3. If debugger succeeds: mark task as completed, continue
4. If debugger also fails: mark task as **failed**, continue with remaining independent tasks, report to user

### Multiple Task Failures in Same Wave
- Pause execution immediately
- Report full status: which tasks failed, which succeeded, error details
- Ask user for direction before continuing

### Dependency Failure
- If a task fails and other tasks depend on it: skip all dependent tasks
- Report the cascade: "Task X failed. Skipping tasks Y, Z which depend on it."
- Continue with any independent tasks in subsequent waves

## Progress Tracking

Update `.planning/phases/phase-N/progress.md` after each task completes:

```markdown
# Execution Progress

**Phase:** N
**Started:** YYYY-MM-DD HH:MM
**Status:** in_progress | completed | blocked

| Wave | Task | Status | Commit | Notes |
|------|------|--------|--------|-------|
| 1 | Task description | completed | abc1234 | |
| 1 | Task description | completed | def5678 | |
| 2 | Task description | in_progress | | |
| 2 | Task description | pending | | |

## Failures
- [task-id]: [error summary and resolution or escalation status]
```

Valid statuses: `pending`, `in_progress`, `completed`, `failed`, `skipped`

## Completion

When all waves are done and verification passes:
- Update `progress.md` status to `completed`
- Report summary: tasks completed, tasks failed/skipped, test results
- Hand off to the finishing-branches skill for the Ship phase

## When to Stop and Ask

- Multiple failures in the same wave
- Verification reveals regressions not caused by the current changes
- A task's acceptance criteria are ambiguous and the executor can't resolve it
- The plan has gaps that weren't caught during planning

**Ask for clarification rather than guessing.**

## Key Principles

- **Fresh context per task.** Every executor starts clean. The task packet must be self-contained.
- **Never execute code in the orchestrator.** All implementation happens in subagents.
- **Atomic commits.** Each task produces exactly one commit.
- **Fail fast, report clearly.** Don't silently retry — surface failures with context.
- **Respect maxParallel.** Don't launch more concurrent executors than configured.
