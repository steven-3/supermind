<!-- Forked from obra/superpowers (MIT license) by Jesse Vincent and Prime Radiant. Adapted for Supermind executor injection. -->
---
name: code-review
description: Structured code review methodology for the Verify phase — review criteria, issue classification, and anti-performative-agreement
injects_into: [orchestrator-verify]
forked_from: obra/superpowers (MIT)
---

# Code Review

## Review Process

Follow these steps in order. Do not skip steps.

### 1. Understand the Intent

Read the plan or task spec first. Understand what was supposed to be built before looking at code. If there is no plan, infer intent from commit messages and the diff itself — but flag the missing spec as a concern.

### 2. Read All Changed Files

Get the full diff against the base branch (`git diff <base>...HEAD`). Read every changed file completely — not just the diff hunks. Context around changes matters.

### 3. Evaluate Against Criteria

Check every change against all six criteria. Do not skip criteria because "it looks fine."

#### a. Spec Compliance

Does the code do what the plan said? Check each acceptance criterion. If a criterion is unmet, that is a critical issue regardless of code quality.

#### b. Correctness

- Logic errors, off-by-ones, fence-post errors
- Edge cases: empty inputs, null/undefined, boundary values, overflow
- Error handling: are errors caught? Are they handled correctly or silently swallowed?
- Async correctness: race conditions, unhandled rejections, missing awaits

#### c. Test Coverage

- Are the important behaviors tested?
- Are edge cases and error paths covered?
- Do tests verify behavior, not implementation details?
- Do tests actually fail when the feature is broken? (Not just "passes when correct")
- Missing tests for new public functions or changed behavior = important issue

#### d. Security

- Injection: command injection, SQL injection, XSS, template injection
- Path traversal: unsanitized user input in file paths
- Secrets: API keys, passwords, tokens hardcoded or logged
- Unsafe operations: eval, exec with unsanitized input, deserialization of untrusted data
- Permissions: missing access checks, privilege escalation

#### e. Maintainability

- Clear naming: can you understand the code without reading the commit message?
- Reasonable file sizes: single files doing too many things
- No unnecessary complexity: abstractions that serve no current purpose, premature generalization
- Comments where logic isn't self-evident (and no comments where it is)

#### f. Consistency

- Follows existing codebase patterns (naming conventions, module structure, export style)
- Uses existing utilities instead of reimplementing
- Matches the project's error handling pattern
- Follows the project's test structure and naming

## Issue Classification

Every finding gets exactly one classification:

| Classification | Meaning | Action Required |
|---------------|---------|-----------------|
| **Critical** | Must fix before merge. Bugs, security issues, spec violations, missing tests for core behavior. | Fix immediately. |
| **Important** | Should fix before merge. Poor naming, missing edge case tests, unclear logic, inconsistency with codebase patterns. | Fix unless you can justify why not. |
| **Suggestion** | Nice to have. Style preferences, minor simplifications, alternative approaches. | Optional — address if they improve clarity. |

Rules:
- If you're unsure whether something is Critical or Important, make it Critical. Err on the side of strictness.
- A finding with no file/line reference is incomplete. Always include location.
- "This could be better" without a concrete suggestion is not a finding. Say what to change.

## Output Format

```
## Code Review: [task/feature name]

### Summary
One paragraph: overall assessment, confidence level, key observations.

### Critical Issues
- [file:line] Description. Why it matters. Suggested fix.

### Important Issues
- [file:line] Description. Why it matters. Suggested fix.

### Suggestions
- [file:line] Description.

### Verdict
PASS | NEEDS FIXES | FAIL
```

**Verdict rules:**
- **PASS**: Zero critical issues AND zero important issues. Suggestions are acceptable.
- **NEEDS FIXES**: Has critical or important issues that are fixable without redesign.
- **FAIL**: Fundamental problems — wrong approach, missing core functionality, security vulnerability that requires architectural change.

If a section is empty, write "None" — do not omit the section.

## Receiving Review Feedback

When you receive review feedback (as the implementer, not the reviewer), apply these rules:

### Do Not Blindly Agree

Performative agreement — accepting every finding without evaluation — is worse than pushing back. It produces bad fixes, wastes time, and erodes trust.

For each finding, ask:
1. **Is this correct?** Does the finding accurately describe a real problem?
2. **Is this important?** Even if technically valid, does it matter for this change?
3. **Does the suggested fix make sense?** The reviewer may be right about the problem but wrong about the solution.

### When to Push Back

- The finding misunderstands the code (reviewer missed context)
- The finding is technically valid but the fix would make things worse
- The suggestion conflicts with the plan/spec — the plan wins unless the suggestion reveals a flaw in the plan
- The finding is about style preference, not correctness or clarity

Push back with reasoning, not just "I disagree." Show why the current approach is correct or why the suggested change would cause problems.

### When to Accept

- The finding is correct and the fix improves the code — just fix it, don't argue
- The finding reveals something you missed — acknowledge it and fix it
- The finding is about consistency with codebase patterns — consistency wins over personal preference

### Fix Protocol

1. Fix ALL critical and important issues. No negotiation on critical.
2. Suggestions are optional but should be addressed if they improve clarity.
3. After fixing, re-run verification (tests, linter, etc.) to ensure fixes don't break anything.
4. If a fix introduces new concerns, flag them — don't silently create new problems.
