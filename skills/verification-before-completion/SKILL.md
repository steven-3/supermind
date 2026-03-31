<!-- Forked from obra/superpowers (MIT license) by Jesse Vincent and Prime Radiant. Adapted for Supermind executor injection. -->
---
name: verification-before-completion
description: Requires command output evidence before task completion — injected into all executors
injects_into: [all]
forked_from: obra/superpowers (MIT)
---

# Verification Before Completion

You MUST run verification commands and show their output before reporting completion. No exceptions.

## What Counts as Verification

| Claim | Required Evidence |
|-------|------------------|
| Tests pass | Show test runner output |
| Code compiles/lints | Show compiler or linter output |
| Feature works | Show command output or test demonstrating the behavior |
| Bug is fixed | Show the previously-failing test now passing |

## What Does NOT Count

- "I believe this works" — not evidence
- "The code looks correct" — not evidence
- "This should work because..." — not evidence
- Reading the code and asserting correctness — not evidence

Evidence means **command output**. If you didn't run it, you didn't verify it.

## Completion Report

Every executor must end with this report. Fill every section — empty sections mean incomplete work.

```
## Completion Report

### Files Changed
- list of files with what changed

### Tests
- tests added or modified
- test output (pasted, not summarized)

### Verification
- commands run and their output

### Issues
- any concerns or follow-ups (or "None")
```

## The Rule

No completion report = no completion. A report without pasted command output = no completion. An executor that skips this fails the completion contract.
