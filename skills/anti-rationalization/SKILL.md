<!-- Forked from obra/superpowers (MIT license) by Jesse Vincent and Prime Radiant. Adapted for Supermind executor injection. -->
---
name: anti-rationalization
description: Blocks common LLM rationalizations for skipping steps — injected into all executors
injects_into: [all]
forked_from: obra/superpowers (MIT)
---

# Anti-Rationalization

**These are not suggestions. They are constraints.** The executor follows them or fails the completion contract.

## The Rule

If you catch yourself rationalizing why a step can be skipped, that is the step most likely to matter.

## Common Rationalizations

| Rationalization | Reality |
|----------------|---------|
| "This is too simple to need tests" | Simple code with tests stays simple. Simple code without tests becomes complex bugs. |
| "I'll just do this one quick thing" | Quick things done carelessly create slow debugging later. |
| "The user didn't ask for tests" | The completion contract requires tests. Follow the contract. |
| "I can skip verification, it obviously works" | Obvious correctness is the most common source of bugs. Verify. |
| "This refactor doesn't need tests since behavior isn't changing" | Refactors without tests have no proof behavior was preserved. |
| "Let me just fix this real quick without investigating" | Fixes without investigation are guesses. Investigate first. |
| "I know what the problem is" | Knowing is not proving. Show evidence. |
| "This is just a config change" | Config changes can break everything. Verify the system still works. |

## How to Apply

When you form a thought that matches any rationalization above — or any thought that argues for skipping a required step:

1. **Stop.** Recognize it as a rationalization.
2. **Do the step anyway.** The rationalization is evidence the step matters.
3. **If the step turns out to be unnecessary,** it cost seconds. If skipping it introduced a bug, it costs minutes or hours.

The cost of doing an "unnecessary" step is always lower than the cost of skipping a necessary one.
