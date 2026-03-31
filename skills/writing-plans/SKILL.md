<!-- Forked from obra/superpowers (MIT license) by Jesse Vincent and Prime Radiant. Adapted for Supermind orchestrator. -->
---
name: writing-plans
description: Creates atomic implementation plans with dependency graphs — used by orchestrator Plan phase
injects_into: [orchestrator-plan]
forked_from: obra/superpowers (MIT)
---

# Writing Plans

## Overview

Create granular, atomic implementation plans with dependency graphs. Each task is a self-contained work unit completable by a fresh-context executor in 2-5 minutes.

Over-specify rather than under-specify. Executors get fresh context — they don't know what you know. Include exact file paths, function names, line numbers, and code snippets.

**Announce at start:** "Using writing-plans to create the implementation plan."

## Input

Read the design from `.planning/phases/phase-N/discussion.md` (output of brainstorming). If no discussion file exists, read the user's requirements directly.

## Scope Check

If the design covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns.

This structure informs the task decomposition.

## Task Spec Format

Each task in the plan uses this format:

```markdown
---
id: task-N
type: write-feature|fix-bug|refactor|write-test|research
dependsOn: [task-ids]
---

## Task: [descriptive name]

### What to do
[Clear, specific instructions — not vague directions]

### Files to read first
- `path/to/file.js` — reason why this file matters for context

### Files to modify/create
- `path/to/file.js` — what changes to make

### Acceptance criteria
- [ ] [specific, verifiable criterion]
- [ ] [another criterion]

### Verification
- [exact command to run to prove it works]
- [expected output]
```

## Task Granularity

Each task should be:
- **Completable in 2-5 minutes** by an executor with fresh context
- **Self-contained** — the task spec has everything needed (files to read, what to change, acceptance criteria)
- **Independently testable** — each task has verification steps
- **Small enough** that an executor can hold the full context in one pass

**Example bite-sized steps within a task:**
- "Write the failing test" — one step
- "Implement the minimal code to make it pass" — one step
- "Run tests and verify" — one step
- "Commit" — one step

## No Placeholders

Every task must contain the actual content an executor needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the content — executors may read tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Methodology Injection

Each task should specify which methodology skills apply based on its type:
- `write-feature` or `write-test` tasks: TDD (red-green-refactor)
- `fix-bug` tasks: systematic-debugging (REPRODUCE-ISOLATE-FIX-VERIFY)
- All tasks: verification-before-completion, anti-rationalization

## Planning Process

1. **Read the design** from `discussion.md` or user requirements
2. **Map file structure** — which files will be created or modified
3. **Decompose into atomic tasks** following the task spec format above
4. **Identify dependencies** between tasks (task B needs task A's output)
5. **Arrange into a dependency graph** — tasks with no dependencies form Wave 1, tasks depending on Wave 1 form Wave 2, etc.
6. **Plan-checker pass** (max 3 iterations):
   - Does each task have clear acceptance criteria?
   - Are dependencies correctly identified?
   - Can each task be completed with only its task spec?
   - Are there circular dependencies? (reject if so)
   - Does the full set of tasks implement the complete design?
   - Are there placeholder violations? (see No Placeholders above)
   - Do types, method signatures, and names stay consistent across tasks?
7. **Save the plan** to `.planning/phases/phase-N/plans/plan.md`
8. **Save individual task specs** to `.planning/phases/phase-N/tasks/task-N.md` (one file per task)

## Plan Document Header

Every plan starts with:

```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Files affected:** [List of files created/modified]

**Dependency graph:**
Wave 1: [task-1, task-2]  <- independent, parallel
Wave 2: [task-3 (needs task-1)]  <- sequential dependency
Wave 3: [task-4 (needs task-2, task-3)]

---
```

## Self-Review

After writing the complete plan, review with fresh eyes:

1. **Spec coverage:** Skim each requirement. Can you point to a task that implements it? List any gaps.
2. **Placeholder scan:** Search for red flags from the No Placeholders section. Fix them.
3. **Type consistency:** Do the types, method signatures, and property names used in later tasks match what was defined in earlier tasks?
4. **Dependency completeness:** Does every task that reads a file created by another task list that dependency?
5. **Test coverage:** Are tests distributed throughout the plan, not bunched at the end?

If you find issues, fix them inline. If you find a requirement with no task, add the task.

## Output

After saving the plan and task specs:

```
Plan complete:
- Plan: .planning/phases/phase-N/plans/plan.md
- Tasks: .planning/phases/phase-N/tasks/task-{1..N}.md
- Waves: [count] waves, [count] tasks total
- Ready for execution via executing-plans skill
```

## Key Principles

- **Over-specify.** Executors get fresh context. They don't know what you know.
- **Include exact file paths**, function names, line numbers where relevant.
- **Include code snippets** in the task spec if the approach is specific.
- **Plan for testing throughout** — don't leave all tests to the end.
- **DRY, YAGNI, TDD, frequent commits.**
