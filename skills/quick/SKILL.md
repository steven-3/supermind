---
name: quick
description: Single-executor mode for small tasks — quick fix, rename, config change, add test
injects_into: [orchestrator-quick]
---

# Quick Mode

Single-executor mode for small, clear tasks. No planning ceremony, no `.planning/` state.

```
User prompt → Single fresh-context executor → Verify → Done
```

## When to Use

- Bug fixes, typo corrections
- Renames, moves, config changes
- Adding tests for existing code
- Any task the user prefixes with `quick:` or invokes via `/quick`

## When NOT to Use

- Multi-system features → use `/project`
- Ambiguous requirements needing discussion → use `/project --assumptions`
- Changes spanning many files with dependencies → use `/project`

If in doubt, announce your routing decision and offer the escape hatch:
*"This looks like a quick fix — running in quick mode. Say `/project` if you want the full lifecycle."*

## Process

### Step 1 — Parse Task and Detect Type

Read the user's task description and classify it:

| Signal words | Task type |
|-------------|-----------|
| "fix", "bug", "broken", "error", "crash", "fails" | `fix-bug` |
| "test", "spec", "coverage", "add test" | `write-test` |
| "refactor", "rename", "move", "clean", "extract", "simplify" | `refactor` |
| Everything else | `write-feature` |

Identify relevant files from the description. If the user names specific files, use those. If not, use Grep/Glob to locate the files before dispatching.

### Step 2 — Gather Context (Compact)

Collect the minimum context the executor needs:

1. **Branch** — run `git branch --show-current`
2. **Recent commits** — run `git log --oneline -5`
3. **Architecture excerpt** — read ARCHITECTURE.md, extract only sections relevant to the task (not the whole file). If the file is large, pick the 2-3 most relevant sections.
4. **Conventions** — pull key conventions from CLAUDE.md (test framework, module system, naming patterns)

Keep context compact. The executor gets a fresh context window — don't waste it on irrelevant architecture.

### Step 3 — Build the Task Packet

Use `buildTaskPacket()` from `cli/lib/executor.js` to assemble the executor prompt.

The function signature:

```javascript
buildTaskPacket(task, options)
```

Where `task` is:
```javascript
{
  id: 'quick-1',           // fixed ID for quick mode
  title: '<short imperative title from user description>',
  type: '<detected task type>',  // fix-bug | write-test | refactor | write-feature
  description: '<user description + any files/context you gathered>',
  files: ['<relevant file paths>'],
  acceptance: ['<derived from user description>'],
}
```

And `options` is:
```javascript
{
  branch: '<current branch>',
  recentCommits: '<git log output>',
  architectureExcerpt: '<relevant ARCHITECTURE.md sections>',
  conventions: '<key CLAUDE.md conventions>',
  projectRoot: '<project root path>',
}
```

The function automatically injects methodology skills based on `task.type` using `SKILL_MAP`:

| Task type | Skills injected |
|-----------|----------------|
| `write-feature` | tdd, verification-before-completion, anti-rationalization, using-git-worktrees |
| `fix-bug` | systematic-debugging, verification-before-completion, anti-rationalization, using-git-worktrees |
| `refactor` | verification-before-completion, anti-rationalization, using-git-worktrees |
| `write-test` | tdd, anti-rationalization |
| `research` | *(none — not used by Quick Mode's auto-detection, but valid in executor.js)* |

### Step 4 — Decide Worktree

- If the task touches **1-2 files** and is a simple fix → no worktree
- If the task touches **3+ files** or involves logic changes → use worktree isolation

Pass this decision when calling `executeTask()`:

```javascript
executeTask(taskPacket, { useWorktree: true })  // returns { prompt, description, isolation: 'worktree' }
executeTask(taskPacket, {})                       // no worktree
```

### Step 5 — Dispatch Executor

Spawn a **single** subagent using the Agent tool:

```
Agent tool call:
  prompt: <the task packet string from buildTaskPacket()>
  description: <5-word summary from executeTask()>
  isolation: 'worktree'  (only if useWorktree)
```

**Do NOT dispatch multiple agents.** Quick mode is a single executor.

### Step 6 — Report Results

When the executor returns:

**On success**, report to the user:
- What was done (1-2 sentences)
- Files changed
- Tests run and passed
- Commit hash (if committed)

**On failure**, report:
- What went wrong
- Root cause if identifiable
- Offer: *"Want me to retry, or escalate to `/project` mode for the full lifecycle?"*

## Composable Flags

### `--with-research`

Before dispatching the executor, spawn a single researcher agent to gather context:

1. Use the `featureResearcher` template from `cli/lib/agents.js`:
   ```javascript
   RESEARCHER_PROMPTS.featureResearcher({ goal: '<user description>' })
   ```
2. Run the researcher as an Agent tool call
3. Append the researcher's findings to the task packet's `description` field before building the packet

### `--with-discuss`

Before dispatching the executor, ask 2-3 clarifying questions:

1. Analyze the user's request for ambiguities
2. Ask questions **one at a time** (not batched)
3. Once clarified, proceed with the normal quick flow

## What Quick Mode Does NOT Do

- **No `.planning/` state** — fully stateless
- **No wave execution** — single executor only
- **No roadmap or phases** — no multi-step lifecycle
- **No multi-task planning** — one task, one executor, done
- **No parallel researchers** (unless `--with-research`)

## Completion Contract (Inherited by Executor)

The executor receives these rules via `buildTaskPacket()`:

- Commit atomically when done (one commit)
- Report: files changed, tests run, tests passed
- Stay in scope — only modify files related to this task
- NEVER merge branches or push to main/master
- NEVER skip tests or verification steps
- If unable to complete, report what failed and why
