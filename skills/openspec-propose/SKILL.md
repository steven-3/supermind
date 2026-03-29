---
name: openspec-propose
description: "Propose a new change with all artifacts generated in one step. Use when the user wants to describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation."
---

# Propose a New Change

One command to go from idea to a fully structured change: creates a named change with proposal, design, and task checklist ready for implementation.

---

## Steps

### 1. Derive the Change Name

Infer a kebab-case name from the user's description (e.g., "add user authentication" → `add-user-authentication`). If the input is too vague to produce a meaningful name, use the AskUserQuestion tool to ask: "What should this change be called? (kebab-case, e.g. `add-user-auth`)"

### 2. Check for OpenSpec CLI

Run `openspec --version`. If the command succeeds, use the **CLI path**. If not found, use the **fallback path**.

### 3a. CLI Path

Run the following in order:

1. `openspec new change "<name>"` — create the change
2. `openspec status --change "<name>" --json` — get the list of artifact IDs
3. For each artifact ID returned: `openspec instructions <artifact-id> --change "<name>" --json` — read the instructions for each artifact and generate its content

### 3b. Fallback Path (no CLI)

Create the directory `openspec/changes/<name>/` and write three files:

**`proposal.md`**
```
## What
[Describe the change in plain language]

## Why
[The problem this solves or the value it delivers]

## Scope
[What is included and explicitly what is excluded]

## Success Criteria
[How you will know this change is complete and correct]
```

**`design.md`**
```
## Approach
[The chosen implementation strategy and why]

## Components
[Files, modules, or services involved]

## Data Flow
[How data moves through the system for this change]

## Error Handling
[Known failure modes and how they are handled]
```

**`tasks.md`**
```
- [ ] [First task description]
- [ ] [Second task description]
- [ ] [Continue for all implementation steps]
```

### 4. Show Summary

After creating all artifacts, display:
- The change name and directory path
- Which artifacts were created (proposal.md, design.md, tasks.md)
- How many tasks are in the task list
- Next step suggestion: "Run `/openspec-apply` when you are ready to implement."

---

## Guardrails

- **Create ALL artifacts.** Never create a partial set — proposal, design, and tasks must all exist before reporting success.
- **Ask if unclear.** If the user's description is ambiguous or too short to generate meaningful content, ask one clarifying question before proceeding.
- **Handle name conflicts.** If `openspec/changes/<name>/` already exists, warn the user and ask: "A change named `<name>` already exists. Overwrite, choose a different name, or cancel?"
- **Never start implementing.** This skill only creates planning artifacts — no code changes.
