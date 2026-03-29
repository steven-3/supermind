---
name: openspec-apply
description: "Implement tasks from an OpenSpec change. Use when a change has been proposed and the user wants to start building. Reads all artifacts for context, implements tasks sequentially, marks complete as it goes."
---

# Apply Change

Implement a planned change by reading all its artifacts, then executing tasks one at a time while keeping the task list up to date.

---

## Steps

### 1. Select the Change

Infer the change name from context:
- Was `/openspec-propose` just run? Use that change name.
- Did the user mention a change name? Use it.
- Is there only one change in `openspec/changes/`? Use it.

If none of the above apply, ask: "Which change should I apply? (Run `openspec list` or check `openspec/changes/` to see available changes.)"

### 2. Read ALL Context

Before writing a single line of code, read every artifact for the change:

- `openspec/changes/<name>/proposal.md` — understand the what and why
- `openspec/changes/<name>/design.md` — understand the approach and components
- `openspec/changes/<name>/specs/` — read any spec files if this directory exists
- `openspec/changes/<name>/tasks.md` — load the full task list

Do not skip any artifact. Context from all files informs every implementation decision.

### 3. Load the Task List

- **CLI available:** Run `openspec status --change "<name>" --json` to get the current task state
- **No CLI:** Read `tasks.md` directly — find all `- [ ]` (incomplete) and `- [x]` (complete) tasks

Start from the first incomplete task.

### 4. Implement Tasks Sequentially

For each incomplete task, in order:

**a. Read the task description.** Understand exactly what it requires.

**b. Implement the change.** Write the code. Follow the design from `design.md`. Match existing codebase patterns.

**c. Mark the task done.** Update `tasks.md` immediately after completing each task — change `- [ ]` to `- [x]`. Do not batch updates.

**d. Show progress.** After each task: "Task N/M complete: [task description]"

### 5. Pause On

Stop and check with the user when:
- **Blockers:** A dependency is missing, a file doesn't exist, or an external system is unavailable
- **Unclear requirements:** The task description is ambiguous and the design does not resolve it
- **Discovered design issues:** Implementation reveals a conflict with the proposed design that was not anticipated

Do not guess past blockers. State what you found and what decision is needed.

### 6. Completion

When all tasks show `- [x]`:

- Summarize what was implemented (files changed, key decisions made)
- Note any deviations from the original design and why they were made
- Suggest next step: "All tasks complete. Run `/openspec-archive` to archive this change."

---

## Guardrails

- **Read ALL artifacts before starting.** Never begin implementation after reading only tasks.md.
- **Mark tasks as you go.** Update `tasks.md` after each task, not at the end. If the session is interrupted, the task list reflects real progress.
- **Pause on blockers — do not guess.** Guessing past a genuine blocker creates technical debt and incorrect assumptions downstream.
- **Follow existing codebase patterns.** The design artifacts describe intent. Real implementation must match the conventions already in the codebase (naming, error handling, file organization, test structure).
- **Implement in order.** Later tasks may depend on earlier ones. Do not skip ahead.
