<!-- Forked from obra/superpowers (MIT license) by Jesse Vincent and Prime Radiant. Assumptions mode inspired by gsd-build/get-shit-done (MIT license). Adapted for Supermind orchestrator. -->
---
name: brainstorming
description: Pre-implementation design exploration with interactive and assumptions modes — used by orchestrator Discuss phase
injects_into: [orchestrator-discuss]
forked_from: obra/superpowers (MIT)
---

# Brainstorming Ideas Into Designs

Pre-implementation design exploration. Used by the orchestrator during the Discuss phase of Project Mode. Ensures Claude understands what to build before building it.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until a design is presented and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
</HARD-GATE>

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. "Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## Modes

### MODE 1 — Interactive (default)

The default mode. Ask clarifying questions to understand what the user wants.

- Ask questions **one at a time** — never batch multiple questions
- Prefer **multiple choice** when possible — easier to answer than open-ended
- Focus on: **purpose**, **constraints**, **success criteria**, **scope**
- Only one question per message — if a topic needs more exploration, break it into multiple questions

### MODE 2 — Assumptions (triggered by `--assumptions` flag)

For users who know what they want and work in a codebase Claude can read. Instead of interviewing the user, analyze the codebase and present assumptions for correction.

1. Read relevant files, recent commits, existing patterns, ARCHITECTURE.md, DESIGN.md
2. Analyze the request against the codebase context
3. Present a numbered list of assumptions:
   > "Based on the codebase, here's what I think you want..."
   >
   > 1. **Location:** New code goes in `src/components/` following the existing pattern
   > 2. **Pattern:** Uses the same factory pattern as `src/components/button.js`
   > 3. **Testing:** Jest tests matching `*.test.js` convention
   > 4. **Scope:** Only modifies the rendering pipeline, no API changes
   > ...
4. User corrects or confirms each assumption
5. For anything the codebase can't answer, fall back to Interactive mode for those specific questions

Assumptions mode is faster but requires a readable codebase. If the codebase lacks clear patterns or the request is highly ambiguous, fall back to Interactive mode entirely.

## Process Flow

```
1. Explore project context (files, docs, recent commits)
2. Detect scope (single feature vs. multi-system)
3. Choose mode (interactive or assumptions based on flag)
4. Build understanding of what to build
5. Propose 2-3 approaches with trade-offs
6. Present design, get user approval section by section
7. Output: structured design document → .planning/phases/phase-N/discussion.md
```

### Step 1: Explore Project Context

Before asking any questions or making assumptions, understand the project:

- Check existing files, directory structure, and patterns
- Read ARCHITECTURE.md and DESIGN.md if they exist
- Review recent commits for current direction and momentum
- Note conventions: naming, file organization, test patterns

### Step 2: Detect Scope

Before refining details, assess scope. If the request describes multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and analytics"), flag this immediately:

> "This looks like it has N independent subsystems. Rather than designing a monolith, let's break it into sub-projects that each get their own design cycle."

Help decompose into sub-projects:
- What are the independent pieces?
- How do they relate?
- What order should they be built?

Then brainstorm the first sub-project through the normal design flow. Each sub-project gets its own discussion → plan → execution cycle.

### Step 3: Choose Mode

- **No flag or `--interactive`:** Use Interactive mode (Step 4a)
- **`--assumptions` flag:** Use Assumptions mode (Step 4b)

### Step 4a: Interactive — Build Understanding

Ask questions one at a time to understand:
- **Purpose:** What problem does this solve? Who is it for?
- **Constraints:** Performance, compatibility, timeline, tech stack requirements?
- **Success criteria:** How do we know it works?
- **Scope:** What's explicitly out of scope?

Keep asking until you have enough to propose approaches. Don't over-question simple projects.

### Step 4b: Assumptions — Build Understanding

Analyze the codebase and present assumptions (see MODE 2 above). After corrections, you should have the same understanding as the interactive path.

### Step 5: Propose Approaches

Propose 2-3 different approaches with trade-offs:
- Lead with your recommended option and explain why
- Include at least one simpler alternative
- Be concrete: name files, patterns, dependencies
- Call out what each approach trades off (complexity, flexibility, speed)

### Step 6: Present Design

Once the user picks an approach (or you've converged on one):
- Present the design **section by section**
- Scale detail to complexity: a few sentences if straightforward, paragraphs if nuanced
- Ask after each section whether it looks right so far
- Cover as appropriate: architecture, components, data flow, error handling, testing approach
- Revise any section the user pushes back on before moving forward

### Step 7: Output

Save the validated design as a structured Markdown document to `.planning/phases/phase-N/discussion.md` (the orchestrator determines the phase number).

The document should capture:
- The problem statement
- Key decisions and their rationale
- The chosen approach
- Component breakdown
- Any constraints or non-goals identified during discussion

## Key Principles

- **One question at a time** — don't overwhelm with multiple questions
- **Multiple choice preferred** — easier to answer than open-ended when possible
- **YAGNI ruthlessly** — remove unnecessary features from designs. If the user didn't ask for it and the system doesn't need it, cut it
- **Explore alternatives** — always propose 2-3 approaches before settling
- **Design for isolation and clarity** — break into smaller units with one clear purpose, well-defined interfaces, and independent testability
- **In existing codebases, follow existing patterns** — explore the current structure before proposing changes. Only deviate when existing patterns actively prevent the goal
- **Incremental validation** — present design sections, get approval before moving on
- **Scale to complexity** — a trivial change gets a few sentences of design; a system redesign gets paragraphs

## Red Flags — STOP and Reassess

| Signal | Action |
|--------|--------|
| Request describes 3+ independent subsystems | Decompose into sub-projects first |
| User says "just build it" | Present a minimal design anyway — the HARD GATE applies |
| You're designing features the user didn't mention | YAGNI — cut them |
| Design requires modifying half the codebase | Scope is too large — decompose |
| You can't explain a component's purpose in one sentence | Boundary is wrong — rethink |
| Existing codebase has a pattern for this and you're ignoring it | Follow the pattern unless it's actively broken |

## Verification Checklist

Before transitioning to the Plan phase:

- [ ] Project context explored (files, docs, recent commits)
- [ ] Scope assessed — multi-system requests decomposed into sub-projects
- [ ] User understands the problem and constraints
- [ ] 2-3 approaches proposed with trade-offs
- [ ] Design presented section by section with user approval
- [ ] No unnecessary features in design (YAGNI applied)
- [ ] Design follows existing codebase patterns where applicable
- [ ] Structured design document saved to `.planning/phases/phase-N/discussion.md`
