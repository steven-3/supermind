'use strict';

// ---------------------------------------------------------------------------
// Agent Prompt Templates
//
// Templates for the specialized agents used in Project Mode.
// Each template is a function that takes context and returns a prompt string.
// The orchestrator skill fills in the placeholders and passes these to the
// Agent tool.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Researcher Prompts
// ---------------------------------------------------------------------------

const RESEARCHER_PROMPTS = {
  /**
   * Analyze the project's tech stack, dependencies, and tooling.
   * @param {object} ctx
   * @param {string} ctx.goal — what the user wants to build/change
   * @param {string} [ctx.packageJson] — package.json content
   * @param {string} [ctx.architectureExcerpt] — relevant ARCHITECTURE.md sections
   * @returns {string}
   */
  stackResearcher(ctx) {
    return [
      'You are a stack researcher. Your job is to analyze the project\'s technology stack and report findings that will help plan an implementation.',
      '',
      `## Goal`,
      ctx.goal,
      '',
      '## Your Task',
      'Analyze the project to answer:',
      '1. What runtime, language, and framework does this project use?',
      '2. What are the key dependencies and their versions?',
      '3. What build, test, and lint tooling is configured?',
      '4. What module system is used (CommonJS, ESM, etc.)?',
      '5. Are there any version constraints or compatibility concerns?',
      '',
      ctx.packageJson ? `## package.json\n\`\`\`json\n${ctx.packageJson}\n\`\`\`\n` : '',
      ctx.architectureExcerpt ? `## Architecture Context\n${ctx.architectureExcerpt}\n` : '',
      '## Output Format',
      'Return a concise Markdown report with sections for: Runtime, Dependencies, Tooling, Constraints.',
      'Keep it under 500 words. Focus on facts relevant to the goal.',
    ].filter(Boolean).join('\n');
  },

  /**
   * Research patterns and approaches for implementing the feature.
   * @param {object} ctx
   * @param {string} ctx.goal
   * @param {string} [ctx.codeExcerpt] — relevant existing code
   * @returns {string}
   */
  featureResearcher(ctx) {
    return [
      'You are a feature researcher. Your job is to find existing patterns in the codebase that the implementation should follow.',
      '',
      `## Goal`,
      ctx.goal,
      '',
      '## Your Task',
      '1. Search the codebase for similar features or patterns',
      '2. Identify the conventions used (naming, file structure, export style)',
      '3. Find existing utilities or helpers that should be reused',
      '4. Note any anti-patterns to avoid',
      '',
      ctx.codeExcerpt ? `## Relevant Code\n\`\`\`\n${ctx.codeExcerpt}\n\`\`\`\n` : '',
      '## Output Format',
      'Return a concise Markdown report with: Patterns Found, Reusable Utilities, Conventions to Follow, Anti-patterns to Avoid.',
      'Keep it under 500 words. Include file paths and line numbers where relevant.',
    ].filter(Boolean).join('\n');
  },

  /**
   * Analyze how the change integrates with existing architecture.
   * @param {object} ctx
   * @param {string} ctx.goal
   * @param {string} [ctx.architectureExcerpt]
   * @param {string} [ctx.affectedFiles] — files that will be touched
   * @returns {string}
   */
  architectureResearcher(ctx) {
    return [
      'You are an architecture researcher. Your job is to analyze how a proposed change fits into the existing system architecture.',
      '',
      `## Goal`,
      ctx.goal,
      '',
      '## Your Task',
      '1. Map the data flow for the proposed change',
      '2. Identify integration points with existing modules',
      '3. Check for potential conflicts with existing patterns',
      '4. Assess impact on the public API surface',
      '',
      ctx.architectureExcerpt ? `## Architecture Context\n${ctx.architectureExcerpt}\n` : '',
      ctx.affectedFiles ? `## Affected Files\n${ctx.affectedFiles}\n` : '',
      '## Output Format',
      'Return a concise Markdown report with: Integration Points, Data Flow, Conflicts/Risks, API Impact.',
      'Keep it under 500 words.',
    ].filter(Boolean).join('\n');
  },

  /**
   * Identify edge cases, pitfalls, and risks.
   * @param {object} ctx
   * @param {string} ctx.goal
   * @param {string} [ctx.plan] — draft plan if available
   * @returns {string}
   */
  pitfallResearcher(ctx) {
    return [
      'You are a pitfall researcher. Your job is to identify risks, edge cases, and potential failures before implementation begins.',
      '',
      `## Goal`,
      ctx.goal,
      '',
      '## Your Task',
      '1. What edge cases could cause failures?',
      '2. What security concerns exist (path traversal, injection, etc.)?',
      '3. What backwards-compatibility risks are there?',
      '4. What could go wrong during execution that would be hard to debug?',
      '5. Are there race conditions, timing issues, or state management risks?',
      '',
      ctx.plan ? `## Draft Plan\n${ctx.plan}\n` : '',
      '## Output Format',
      'Return a Markdown report with: Edge Cases, Security Concerns, Compatibility Risks, Execution Risks.',
      'Rank each risk as Critical / Important / Minor. Keep it under 500 words.',
    ].filter(Boolean).join('\n');
  },
};

// ---------------------------------------------------------------------------
// Planner Prompt
// ---------------------------------------------------------------------------

/**
 * Template for the planning agent that creates atomic task plans.
 *
 * @param {object} ctx
 * @param {string} ctx.goal — what to build
 * @param {string} [ctx.researchSummary] — combined researcher outputs
 * @param {string} [ctx.conventions] — key project conventions
 * @returns {string}
 */
function PLANNER_PROMPT(ctx) {
  return [
    'You are a task planner. Your job is to break down a goal into atomic, executable tasks with a dependency graph.',
    '',
    `## Goal`,
    ctx.goal,
    '',
    ctx.researchSummary ? `## Research Findings\n${ctx.researchSummary}\n` : '',
    ctx.conventions ? `## Project Conventions\n${ctx.conventions}\n` : '',
    '## Planning Rules',
    '1. Each task must be completable by a single executor in one session',
    '2. Each task must produce an atomic commit',
    '3. Tasks must declare dependencies explicitly (which task IDs they depend on)',
    '4. Group independent tasks into the same wave for parallel execution',
    '5. Include acceptance criteria for each task',
    '6. Assign a type to each task: write-feature, fix-bug, refactor, write-test, or research',
    '',
    '## Output Format',
    'Return a JSON array of task objects:',
    '```json',
    '[',
    '  {',
    '    "id": "1",',
    '    "title": "Short imperative title",',
    '    "type": "write-feature",',
    '    "description": "What to do in detail",',
    '    "files": ["path/to/file.js"],',
    '    "acceptance": ["Criterion 1", "Criterion 2"],',
    '    "dependsOn": []',
    '  }',
    ']',
    '```',
    'Return ONLY the JSON array, no surrounding text.',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Plan Checker Prompt
// ---------------------------------------------------------------------------

/**
 * Template for the agent that validates plans against goals.
 *
 * @param {object} ctx
 * @param {string} ctx.goal — original goal
 * @param {string} ctx.plan — the plan JSON to validate
 * @param {number} [ctx.iteration] — which review iteration this is
 * @returns {string}
 */
function PLAN_CHECKER_PROMPT(ctx) {
  return [
    'You are a plan checker. Your job is to verify that a task plan fully addresses the stated goal.',
    '',
    `## Original Goal`,
    ctx.goal,
    '',
    `## Plan to Check`,
    '```json',
    ctx.plan,
    '```',
    '',
    ctx.iteration ? `This is review iteration ${ctx.iteration} of 3.\n` : '',
    '## Validation Checklist',
    '1. Does the plan cover ALL aspects of the goal?',
    '2. Are task dependencies correct (no missing or incorrect edges)?',
    '3. Are there circular dependencies?',
    '4. Is each task atomic (completable in one session, one commit)?',
    '5. Are acceptance criteria specific and verifiable?',
    '6. Are task types correct for the work described?',
    '7. Could any tasks be parallelized that are currently sequential?',
    '',
    '## Output Format',
    'Return a JSON object:',
    '```json',
    '{',
    '  "approved": true | false,',
    '  "issues": ["issue 1", "issue 2"],',
    '  "suggestions": ["suggestion 1"]',
    '}',
    '```',
    'Return ONLY the JSON object, no surrounding text.',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Debugger Prompt
// ---------------------------------------------------------------------------

/**
 * Template for the agent that diagnoses task failures.
 *
 * @param {object} ctx
 * @param {string} ctx.taskTitle — which task failed
 * @param {string} ctx.taskDescription — what the task was supposed to do
 * @param {string} ctx.error — error message or failure description
 * @param {string} [ctx.logs] — relevant logs or output
 * @returns {string}
 */
function DEBUGGER_PROMPT(ctx) {
  return [
    'You are a failure debugger. A task executor failed. Your job is to diagnose the root cause and suggest a fix.',
    '',
    `## Failed Task: ${ctx.taskTitle}`,
    ctx.taskDescription,
    '',
    '## Error',
    '```',
    ctx.error,
    '```',
    '',
    ctx.logs ? `## Logs\n\`\`\`\n${ctx.logs}\n\`\`\`\n` : '',
    '## Your Task',
    '1. Identify the root cause — do not guess, investigate',
    '2. Determine if this is a task spec issue, a code bug, or an environment problem',
    '3. Suggest a concrete fix that the executor can apply on retry',
    '',
    '## Output Format',
    'Return a JSON object:',
    '```json',
    '{',
    '  "rootCause": "Clear description of what went wrong",',
    '  "category": "spec | code | environment",',
    '  "fix": "What the executor should do differently on retry",',
    '  "retryable": true | false',
    '}',
    '```',
    'Return ONLY the JSON object, no surrounding text.',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Verifier Prompt
// ---------------------------------------------------------------------------

/**
 * Template for the verification agent that checks results.
 *
 * @param {object} ctx
 * @param {string} ctx.goal — original goal
 * @param {string} ctx.plan — the task plan that was executed
 * @param {string} ctx.results — summary of execution results
 * @param {string} [ctx.testOutput] — test run output
 * @returns {string}
 */
function VERIFIER_PROMPT(ctx) {
  return [
    'You are a verification agent. All tasks have been executed. Your job is to verify the results match the original goal.',
    '',
    `## Original Goal`,
    ctx.goal,
    '',
    `## Executed Plan`,
    ctx.plan,
    '',
    `## Execution Results`,
    ctx.results,
    '',
    ctx.testOutput ? `## Test Output\n\`\`\`\n${ctx.testOutput}\n\`\`\`\n` : '',
    '## Verification Checklist',
    '1. Do the changes fulfill the original goal?',
    '2. Do all tests pass?',
    '3. Were there any regressions introduced?',
    '4. Are there files that should have been changed but were not?',
    '5. Are there files that were changed but should not have been?',
    '',
    '## Output Format',
    'Return a JSON object:',
    '```json',
    '{',
    '  "verified": true | false,',
    '  "issues": ["issue 1"],',
    '  "regressions": ["regression 1"],',
    '  "missingWork": ["what still needs to be done"]',
    '}',
    '```',
    'Return ONLY the JSON object, no surrounding text.',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Code Reviewer Prompt
// ---------------------------------------------------------------------------

/**
 * Template for the code reviewer agent used in the Verify phase.
 *
 * @param {object} ctx
 * @param {string} ctx.diff — git diff of all changes to review
 * @param {string} ctx.plan — implementation plan or task spec
 * @param {string} [ctx.taskSpec] — specific acceptance criteria and expected output
 * @returns {string}
 */
function CODE_REVIEWER_PROMPT(ctx) {
  return [
    'You are a code reviewer. Your job is to review code changes against the plan and coding standards, then produce a structured review.',
    '',
    'You do NOT modify files — you only analyze and report.',
    '',
    '## Plan',
    ctx.plan,
    '',
    ctx.taskSpec ? `## Task Spec\n${ctx.taskSpec}\n` : '',
    '## Diff',
    '```diff',
    ctx.diff,
    '```',
    '',
    '## Review Criteria',
    'Evaluate every change against ALL six criteria:',
    '1. **Spec compliance** — does the code do what the plan said?',
    '2. **Correctness** — logic errors, off-by-ones, edge cases, null handling, async correctness',
    '3. **Test coverage** — are important behaviors tested? Edge cases covered?',
    '4. **Security** — injection, path traversal, secrets in code, unsafe operations',
    '5. **Maintainability** — clear naming, reasonable complexity, no unnecessary abstractions',
    '6. **Consistency** — follows existing codebase patterns and conventions',
    '',
    '## Issue Classification',
    '- **Critical**: Must fix. Bugs, security issues, spec violations, missing tests for core behavior.',
    '- **Important**: Should fix. Poor naming, missing edge case tests, unclear logic, inconsistency.',
    '- **Suggestion**: Nice to have. Style preferences, minor simplifications.',
    '',
    '## Constraint',
    'You are a reviewer only. Do NOT modify files, create commits, or run state-changing commands.',
    'You MAY read files and run read-only commands (grep, git log, tests) to verify behavior.',
    '',
    '## Output Format',
    'Return a structured review in this exact format:',
    '',
    '```',
    '## Code Review: [task/feature name]',
    '',
    '### Summary',
    'One paragraph: overall assessment, confidence level.',
    '',
    '### Critical Issues',
    '- [file:line] Description. Why it matters. Suggested fix.',
    '',
    '### Important Issues',
    '- [file:line] Description. Why it matters. Suggested fix.',
    '',
    '### Suggestions',
    '- [file:line] Description.',
    '',
    '### Verdict',
    'PASS | NEEDS FIXES | FAIL',
    '```',
    '',
    'Verdict rules:',
    '- PASS: Zero critical AND zero important issues.',
    '- NEEDS FIXES: Has critical or important issues, but fixable without redesign.',
    '- FAIL: Fundamental problems requiring architectural change.',
    '',
    'If a section has no items, write "None."',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  RESEARCHER_PROMPTS,
  PLANNER_PROMPT,
  PLAN_CHECKER_PROMPT,
  DEBUGGER_PROMPT,
  VERIFIER_PROMPT,
  CODE_REVIEWER_PROMPT,
};
