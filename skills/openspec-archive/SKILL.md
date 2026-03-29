---
name: openspec-archive
description: "Archive a completed OpenSpec change. Use when all tasks are done and the change is ready to be finalized. Checks completion, syncs specs, moves to archive."
---

# Archive Change

Finalize a completed change by verifying its task list, optionally syncing specs, and moving all artifacts to the archive.

---

## Steps

### 1. Select the Change

Infer the change name from context:
- Was `/openspec-apply` just run? Use that change name.
- Did the user mention a change name? Use it.

If neither applies, ask: "Which change should I archive? (Check `openspec/changes/` for available changes.)"

### 2. Check Completion

Read `openspec/changes/<name>/tasks.md` and count:
- `- [x]` — completed tasks
- `- [ ]` — incomplete tasks

**If any tasks are incomplete:**

Warn the user: "This change has N incomplete tasks. Archive anyway, or finish the remaining tasks first?"

- If the user says archive anyway: proceed and note in the archive that tasks were incomplete.
- If the user says finish first: stop and let them continue with `/openspec-apply`.

### 3. Check for Specs to Sync

If `openspec/changes/<name>/specs/` exists and contains files:

- Compare the change's specs with `openspec/specs/` (the main specs directory)
- If relevant updates exist, ask: "This change includes spec updates. Sync them to `openspec/specs/` before archiving?"
- If yes: copy or merge the spec files, then continue to archiving.
- If no: skip spec sync.

### 4. Create Archive Directory

Determine today's date in YYYY-MM-DD format and create:

```
openspec/changes/archive/YYYY-MM-DD-<name>/
```

### 5. Move All Change Files

Move everything from `openspec/changes/<name>/` to the archive directory:
- `proposal.md`
- `design.md`
- `tasks.md`
- `specs/` (if present)
- Any other files in the change directory

After moving, remove the now-empty `openspec/changes/<name>/` directory.

### 6. Show Summary

Report:
- Change name and archive path
- Task completion status: "N/N tasks completed" (or note if archived with incomplete tasks)
- Files archived: list each one
- Spec sync status: synced, skipped, or not applicable

---

## Guardrails

- **Verify all tasks completed.** Always check before archiving — never assume.
- **Warn on incomplete tasks.** Never silently archive an incomplete change. The user must explicitly confirm.
- **Confirm before moving.** If the change has many files or specs, confirm the archive action before proceeding.
- **Never delete — only move.** All artifacts must land in the archive directory. Nothing is deleted.
- **Preserve the archive layout.** The `YYYY-MM-DD-<name>` format is required — it makes the archive browsable and sortable.
