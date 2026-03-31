---
name: project
description: Full six-phase lifecycle — discuss, research, plan, execute (waves), verify, ship
injects_into: [orchestrator-project]
---

# Project Mode

Full lifecycle orchestrator for features, refactors, new systems, and multi-file changes.

```
Discuss → Research (4 parallel agents) → Plan → Execute (waves) → Verify → Ship
```

## When to Use

- Multi-system features or refactors
- Ambiguous requirements needing discussion
- Changes spanning many files with dependencies
- Any task invoked via `/project`

## When NOT to Use

- Bug fixes, renames, config changes, adding tests → use `/quick`

## Orchestrator Rules

- **The orchestrator NEVER writes code** — it only coordinates subagents
- All code changes happen in executor subagents with fresh context windows
- The orchestrator stays lean (~15-25% context usage)
- Each subagent gets the full methodology stack for its task type

## Composable Flags

```
/project --skip-discuss       Skip Phase 1, start at Research
/project --skip-research      Skip Phase 2, start at Plan
/project --assumptions        Phase 1 uses codebase analysis instead of questions
/project --max-parallel N     Override executor parallelism (default 3)
```

## State Management

All state lives in `.planning/` — human-readable Markdown, git-committable.

### Initialization

At the start, initialize the planning directory using `initPlanning()` from `cli/lib/planning.js`:

```javascript
initPlanning(projectRoot, {
  modelProfile: 'default',
  flags: { skipDiscuss: false, skipResearch: false, assumptions: false, maxParallel: 3 },
})
// Creates: .planning/roadmap.md, .planning/config.json, .planning/phases/
```

Then create a phase for this work using `initPhase()`:

```javascript
initPhase(projectRoot, 1)
// Creates: .planning/phases/phase-1/discussion.md, research/, plans/, tasks/, progress.md
```

Update the roadmap using `updateRoadmap()`:

```javascript
updateRoadmap(projectRoot, 1, 'active')
```

### Session Resumption

If `.planning/` already exists when this skill is invoked, the session-start hook has already detected it and reported status. Read progress to determine where to resume:

```javascript
const progress = readProgress(projectRoot)
// Returns: { phase, entries, summary: { total, done, pending, failed, currentWave } }
```

Use `isActive(projectRoot)` to confirm there's an active (non-completed) session. Use `readConfig(projectRoot)` to restore flags and model profile.

---

## Phase 1 — Discuss

**Skippable:** `--skip-discuss`

Invoke the **brainstorming skill** (`skills/brainstorming/`).

### Two sub-modes

**Interactive (default):**
1. Ask clarifying questions one at a time
2. Propose 2-3 approaches with trade-offs
3. Present the design for section-by-section approval
4. Gate: user must approve the design before proceeding

**Assumptions (`--assumptions` flag):**
1. Analyze the codebase to understand patterns, constraints, and context
2. Present a set of assumptions about the approach for the user to correct
3. Iterate until assumptions are confirmed
4. Gate: user must approve the final assumptions

### Output

Save the approved design to `.planning/phases/phase-1/discussion.md`:

```javascript
writeDiscussion(projectRoot, 1, designMarkdown)
```

The `writeDiscussion()` function appends to the existing file, so you can call it incrementally as the discussion evolves.

### Gate

**User must explicitly approve the design before Phase 2 begins.** Do not proceed without approval.

---

## Phase 2 — Research

**Skippable:** `--skip-research`

Spawn **4 parallel researcher subagents** using the Agent tool. Each gets a focused prompt built from templates in `cli/lib/agents.js` (`RESEARCHER_PROMPTS`):

### Researcher dispatch

Build the context object from the approved design (Phase 1) and project state, then generate prompts:

| Researcher | Template | Key context fields |
|-----------|----------|-------------------|
| Stack | `RESEARCHER_PROMPTS.stackResearcher(ctx)` | `ctx.goal`, `ctx.packageJson`, `ctx.architectureExcerpt` |
| Feature | `RESEARCHER_PROMPTS.featureResearcher(ctx)` | `ctx.goal`, `ctx.codeExcerpt` |
| Architecture | `RESEARCHER_PROMPTS.architectureResearcher(ctx)` | `ctx.goal`, `ctx.architectureExcerpt`, `ctx.affectedFiles` |
| Pitfall | `RESEARCHER_PROMPTS.pitfallResearcher(ctx)` | `ctx.goal`, `ctx.plan` |

For all researchers, `ctx.goal` is the approved design summary from Phase 1.

Dispatch all 4 as parallel Agent tool calls:

```
Agent(prompt: RESEARCHER_PROMPTS.stackResearcher(ctx), description: "Research tech stack")
Agent(prompt: RESEARCHER_PROMPTS.featureResearcher(ctx), description: "Research feature patterns")
Agent(prompt: RESEARCHER_PROMPTS.architectureResearcher(ctx), description: "Research architecture fit")
Agent(prompt: RESEARCHER_PROMPTS.pitfallResearcher(ctx), description: "Research pitfalls risks")
```

### Output

Save each researcher's output using `writeResearch()`:

```javascript
writeResearch(projectRoot, 1, 'stack', stackResult)
writeResearch(projectRoot, 1, 'features', featureResult)
writeResearch(projectRoot, 1, 'architecture', architectureResult)
writeResearch(projectRoot, 1, 'pitfalls', pitfallResult)
```

Each call writes to `.planning/phases/phase-1/research/{name}.md`.

---

## Phase 3 — Plan

**Not skippable.**

Invoke the **writing-plans skill** (`skills/writing-plans/`).

### Planning process

1. Read the design from `discussion.md` and all 4 research outputs from `research/`
2. Combine into a research summary for the planner
3. Generate the task plan using `PLANNER_PROMPT` from `cli/lib/agents.js`:

```javascript
const prompt = PLANNER_PROMPT({
  goal: designSummary,
  researchSummary: combinedResearch,
  conventions: projectConventions,
})
```

4. Dispatch a planner Agent with this prompt. The planner returns a JSON array of task objects:

```json
[
  {
    "id": "1",
    "title": "Short imperative title",
    "type": "write-feature",
    "description": "What to do in detail",
    "files": ["path/to/file.js"],
    "acceptance": ["Criterion 1", "Criterion 2"],
    "dependsOn": []
  }
]
```

### Plan validation loop

Run the plan-checker (max 3 iterations) using `PLAN_CHECKER_PROMPT` from `cli/lib/agents.js`:

```javascript
const checkerPrompt = PLAN_CHECKER_PROMPT({
  goal: designSummary,
  plan: JSON.stringify(tasks, null, 2),
  iteration: iterationNumber,  // 1, 2, or 3
})
```

The checker returns:
```json
{
  "approved": true | false,
  "issues": ["issue 1"],
  "suggestions": ["suggestion 1"]
}
```

If `approved: false`, incorporate the issues and re-plan. After 3 iterations, proceed with the best plan and note unresolved issues.

### Output

Save the plan and individual task specs using `writePlan()` and `writeTask()`:

```javascript
writePlan(projectRoot, 1, {
  id: 1,
  title: 'Plan title',
  waves: [{ number: 1, tasks: ['Task 1', 'Task 2'] }, { number: 2, tasks: ['Task 3'] }],
})

// For each task:
writeTask(projectRoot, 1, taskId, {
  title: task.title,
  description: task.description,
  skills: SKILL_MAP[task.type],  // from cli/lib/executor.js
  files: task.files,
  acceptance: task.acceptance,
  wave: waveNumber,
})
```

Update the roadmap:

```javascript
updateRoadmap(projectRoot, 1, 'planning-complete')
```

---

## Phase 4 — Execute

**Not skippable.**

Invoke the **executing-plans skill** (`skills/executing-plans/`).

### Wave execution

1. Build the wave plan from the task dependency graph using `buildWavePlan()` from `cli/lib/executor.js`:

```javascript
const waves = buildWavePlan(tasks)
// Returns: [{ wave: 1, tasks: [taskA, taskB] }, { wave: 2, tasks: [taskC] }]
```

2. Read `maxParallel` from config (default 3):

```javascript
const config = readConfig(projectRoot)
const maxParallel = config?.flags?.maxParallel || 3
```

3. For each wave, build task packets and dispatch parallel executors:

```javascript
// For each task in the wave:
const packet = buildTaskPacket(task, {
  projectRoot,
  branch: currentBranch,
  recentCommits: gitLogOutput,
  architectureExcerpt: relevantSections,
  conventions: claudeMdConventions,
})

const execution = executeTask(packet, {
  useWorktree: true,   // when task scope warrants it
  model: 'sonnet',     // optional model override
})

// Dispatch via Agent tool:
Agent(
  prompt: execution.prompt,
  description: execution.description,
  isolation: execution.isolation,  // 'worktree' if useWorktree was true
  model: execution.model,          // if specified
)
```

`buildTaskPacket()` automatically injects methodology skills based on task type via `SKILL_MAP`:

| Task type | Skills injected |
|-----------|----------------|
| `write-feature` | tdd, verification-before-completion, anti-rationalization, using-git-worktrees |
| `fix-bug` | systematic-debugging, verification-before-completion, anti-rationalization, using-git-worktrees |
| `refactor` | verification-before-completion, anti-rationalization, using-git-worktrees |
| `write-test` | tdd, anti-rationalization |
| `research` | *(none)* |

4. Limit concurrent agents to `maxParallel`. If a wave has more tasks than `maxParallel`, batch them into sub-groups.

5. Wait for all agents in the wave to complete before starting the next wave.

### Progress tracking

After each task completes, record results using `writeProgress()`:

```javascript
writeProgress(projectRoot, 1, progressEntries)
// progressEntries: [{ wave, task, status, executor, commit }]
```

You can also render a progress table for display using `formatWaveProgress()`:

```javascript
const table = formatWaveProgress(waves, resultsMap)
// resultsMap: Map<taskId, { status: 'completed'|'failed', commitHash?: string }>
```

### Between waves

After each wave completes:
1. Run `git status` to verify no conflicts
2. Run the project's test suite to catch regressions early
3. If tests fail, diagnose before starting the next wave

### Failure handling

**Single task failure:**
1. Spawn a debugger agent using `DEBUGGER_PROMPT` from `cli/lib/agents.js`:

```javascript
const debugPrompt = DEBUGGER_PROMPT({
  taskTitle: failedTask.title,
  taskDescription: failedTask.description,
  error: errorMessage,
  logs: relevantLogs,
})
```

2. The debugger returns:
```json
{
  "rootCause": "What went wrong",
  "category": "spec | code | environment",
  "fix": "What to do on retry",
  "retryable": true | false
}
```

3. If `retryable: true`, rebuild the task packet with the fix guidance appended to the description and dispatch a new executor. **One retry only.**

4. If the retry also fails, mark the task as `failed` in progress, skip any tasks that depend on it, and continue with independent tasks.

**Multiple failures (2+ tasks in the same wave):**
1. Pause execution
2. Report full status: which tasks succeeded, which failed, what the debuggers found
3. Ask the user how to proceed

---

## Phase 5 — Verify

**Not skippable.**

Invoke the **code-review skill** (`skills/code-review/`).

### Verification process

1. Gather the full diff of all changes:
   ```
   git diff <base-branch>...HEAD
   ```

2. Spawn a code-reviewer agent using `CODE_REVIEWER_PROMPT` from `cli/lib/agents.js`:

```javascript
const reviewPrompt = CODE_REVIEWER_PROMPT({
  diff: fullDiff,
  plan: planSummary,
  taskSpec: acceptanceCriteria,
})
```

The reviewer evaluates against 6 criteria: spec compliance, correctness, test coverage, security, maintainability, consistency.

3. Run the full test suite, linter, and build:
   ```
   npm test    (or project-appropriate command)
   npm run lint
   npm run build
   ```

4. Spawn a verification agent using `VERIFIER_PROMPT` from `cli/lib/agents.js`:

```javascript
const verifyPrompt = VERIFIER_PROMPT({
  goal: originalDesign,
  plan: planJSON,
  results: executionSummary,
  testOutput: testResults,
})
```

The verifier returns:
```json
{
  "verified": true | false,
  "issues": [],
  "regressions": [],
  "missingWork": []
}
```

### Fix loop (max 3 rounds)

If the code reviewer finds critical or important issues, or the verifier finds problems:

1. Spawn fix executor subagents for each issue (these are fresh-context agents, same as Phase 4 executors)
2. Re-run the code reviewer on the updated diff
3. Repeat until the review returns PASS (zero critical and zero important issues) or 3 rounds are exhausted
4. After 3 rounds, report remaining issues to the user

### Gate

**Must pass with zero critical and zero important issues.** Suggestions are acceptable.

Update the roadmap:

```javascript
updateRoadmap(projectRoot, 1, 'verified')
```

---

## Phase 6 — Ship

**Not skippable.**

Invoke the **finishing-branches skill** (`skills/finishing-branches/`).

### Default: Push + Open PR

1. Push the feature branch:
   ```
   git push -u origin <branch-name>
   ```

2. Auto-generate the PR body from `.planning/` state:
   - **Summary:** design decisions from `discussion.md`
   - **Tasks completed:** from `progress.md` entries
   - **Test results:** from the verify phase output
   - **Research highlights:** key findings from `research/`

3. Open the PR:
   ```
   gh pr create --title "<short title>" --body "<generated body>"
   ```

4. Clean up worktrees (if any were used by executors)

### Rules

- **NEVER merge to main/master** — the PR is for human review
- **NEVER force push**
- Report the PR URL to the user when done

### Final state update

```javascript
updateRoadmap(projectRoot, 1, 'completed')
```

---

## Quick Reference: Module APIs

### cli/lib/planning.js

| Function | Purpose |
|----------|---------|
| `initPlanning(projectRoot, config)` | Create `.planning/` with roadmap.md and config.json |
| `initPhase(projectRoot, phaseNum)` | Create phase directory with discussion.md, research/, plans/, tasks/, progress.md |
| `readProgress(projectRoot, phaseNum?)` | Read wave execution state with summary |
| `writeProgress(projectRoot, phaseNum, data)` | Update progress.md with current wave state |
| `readRoadmap(projectRoot)` | Parse roadmap.md to get phase list with statuses |
| `updateRoadmap(projectRoot, phaseNum, status)` | Update a phase's status in roadmap.md |
| `readConfig(projectRoot)` | Read .planning/config.json |
| `writeConfig(projectRoot, config)` | Write .planning/config.json |
| `writeDiscussion(projectRoot, phaseNum, content)` | Append to discussion.md |
| `writeResearch(projectRoot, phaseNum, agentName, content)` | Write researcher output to research/ |
| `writePlan(projectRoot, phaseNum, planData)` | Write plan with wave structure to plans/ |
| `writeTask(projectRoot, phaseNum, taskId, taskSpec)` | Write individual task spec to tasks/ |
| `getPlanningRoot(startDir)` | Walk up to find .planning/ (like git finds .git/) |
| `isActive(projectRoot)` | Check if any phases are non-completed |

### cli/lib/executor.js

| Function | Purpose |
|----------|---------|
| `buildTaskPacket(task, options)` | Assemble self-contained task packet with spec, context, skills, contract |
| `executeTask(taskPacket, options)` | Build Agent tool invocation data (prompt, description, isolation, model) |
| `buildWavePlan(tasks)` | Topological sort into parallel execution waves; throws on cycles |
| `formatWaveProgress(wavePlan, results)` | Render Markdown progress table |
| `getSkillContent(skillName, projectRoot)` | Read SKILL.md from ~/.claude/skills/ with project fallback |
| `SKILL_MAP` | Maps task types to methodology skill arrays |

### cli/lib/agents.js

| Export | Purpose |
|--------|---------|
| `RESEARCHER_PROMPTS.stackResearcher(ctx)` | Tech stack analysis prompt |
| `RESEARCHER_PROMPTS.featureResearcher(ctx)` | Pattern discovery prompt |
| `RESEARCHER_PROMPTS.architectureResearcher(ctx)` | Integration mapping prompt |
| `RESEARCHER_PROMPTS.pitfallResearcher(ctx)` | Risk identification prompt |
| `PLANNER_PROMPT(ctx)` | Atomic task plan creation prompt |
| `PLAN_CHECKER_PROMPT(ctx)` | Plan validation prompt (max 3 iterations) |
| `DEBUGGER_PROMPT(ctx)` | Task failure diagnosis prompt |
| `VERIFIER_PROMPT(ctx)` | Execution result verification prompt |
| `CODE_REVIEWER_PROMPT(ctx)` | Structured code review prompt |
