# Living Docs Init — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/living-docs:init` skill that generates AI-optimized `ARCHITECTURE.md` and `DESIGN.md` files, integrate it with `/init` and `/living-docs`, and standardize on uppercase `ARCHITECTURE.md`.

**Architecture:** Three new files in `skills/living-docs/init/` (SKILL.md + 2 templates), plus edits to 6 existing files. The skill asks one question (UI?), deep-scans existing projects or writes skeletons for new ones, and commits the results. The existing `/living-docs` skill becomes conditional on `DESIGN.md` existence.

**Tech Stack:** Markdown skill files (no runtime code). Uses Claude Code's Glob, Grep, Read tools for deep scan.

**Spec:** `docs/superpowers/specs/2026-03-17-living-docs-init-design.md`

---

### Task 1: Create architecture template

**Files:**
- Create: `skills/living-docs/init/architecture-template.md`

- [ ] **Step 1: Create the template file**

Write `skills/living-docs/init/architecture-template.md` with the AI-optimized skeleton:

```markdown
# Architecture

## Overview

<!-- One paragraph: what the project does and its core architecture pattern -->

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
<!-- Fill as project grows -->

## File Index

<!-- Source files only. No generated output, lock files, node_modules, or build artifacts. -->
<!-- Every row gets a one-line purpose description. -->

| Path | Purpose |
|------|---------|
<!-- Fill as project grows -->

## Dependencies & Data Flow

### Data Flow

<!-- ASCII diagram showing high-level request/data flow -->

### File Dependencies

| File | Depends On | Used By |
|------|-----------|---------|
<!-- Fill as project grows -->

## API Contracts

| Method | Route | Request | Response | Purpose |
|--------|-------|---------|----------|---------|
<!-- Fill as project grows -->

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
<!-- Fill as project grows -->

## Key Patterns & Conventions

<!-- Document project conventions as they emerge -->
```

- [ ] **Step 2: Verify file exists**

Run: `ls -la skills/living-docs/init/architecture-template.md`
Expected: File exists with non-zero size

- [ ] **Step 3: Commit**

```bash
git add skills/living-docs/init/architecture-template.md
git commit -m "Add AI-optimized ARCHITECTURE.md skeleton template"
```

---

### Task 2: Create design template

**Files:**
- Create: `skills/living-docs/init/design-template.md`

- [ ] **Step 1: Create the template file**

Write `skills/living-docs/init/design-template.md` with the AI-optimized skeleton:

```markdown
# Design System

## Overview

<!-- One paragraph: visual identity and design language summary -->

## Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
<!-- Fill as project grows -->

## Typography

| Role | Font | Size | Weight | Line Height |
|------|------|------|--------|-------------|
<!-- Fill as project grows -->

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
<!-- Fill as project grows -->

## Component Patterns

<!-- Per component: variants, sizes, file path -->
<!-- Example:
### Button
- Variants: primary, secondary, ghost, danger
- Sizes: sm, md, lg
- File: `src/components/ui/button.tsx`
-->

## Layout Conventions

<!-- Grid system, breakpoints, container max-widths -->

## Animation Patterns

| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
<!-- Fill as project grows -->
```

- [ ] **Step 2: Verify file exists**

Run: `ls -la skills/living-docs/init/design-template.md`
Expected: File exists with non-zero size

- [ ] **Step 3: Commit**

```bash
git add skills/living-docs/init/design-template.md
git commit -m "Add AI-optimized DESIGN.md skeleton template"
```

---

### Task 3: Create living-docs:init SKILL.md

**Files:**
- Create: `skills/living-docs/init/SKILL.md`

**Note:** Invoke `/skill-creator` for guidance on skill file best practices before writing.

- [ ] **Step 1: Create the skill file**

Write `skills/living-docs/init/SKILL.md`. This is the core deliverable. The full content follows:

```markdown
---
name: living-docs:init
description: Create AI-optimized ARCHITECTURE.md and DESIGN.md for a project via deep scan or skeleton templates. Run standalone or as part of /init.
---

# Initialize Living Documentation

Create AI-optimized `ARCHITECTURE.md` and optionally `DESIGN.md` for the current project. These files use a tables-over-prose format designed to save AI tokens — the AI reads the file index instead of scanning the entire project.

Can be run standalone or as part of `/init`.

## Process

### Step 1: Ask about UI

Ask the user:
> "Does this project have a UI? (This determines whether a DESIGN.md is created)"

Set `needs_ui` based on the answer.

### Step 2: Detect scope

Check if the working directory is the git repo root:

```bash
git rev-parse --show-toplevel
```

- **If working directory != repo root:** Ask the user:
  > "You're in `<subdir>`. Document just this subfolder, or the entire repo?"

- **If at repo root AND workspace indicators exist** (check for `packages/`, `apps/`, `pnpm-workspace.yaml`, `workspaces` key in package.json, `[workspace]` in Cargo.toml):
  > "This looks like a monorepo. Document the entire repo, or a specific subfolder?"

- **Otherwise:** `scan_root` = working directory.

### Step 3: Set flags

```
create_arch = true
create_design = needs_ui
```

### Step 4: Check for existing ARCHITECTURE.md

Look for `ARCHITECTURE.md` (or `architecture.md`) in `scan_root`.

- **If found:** Ask the user:
  > "ARCHITECTURE.md already exists. Keep it as-is, or migrate it to the AI-optimized format?"
  - **Keep:** Set `create_arch = false`. Skip.
  - **Migrate:** Read the existing file. Back up to `ARCHITECTURE.md.bak` (overwrite .bak if exists). Map existing content into the template sections from `architecture-template.md`. Content that doesn't fit any section goes into a "Notes" section at the end. Set `create_arch = false`.

### Step 5: Check for existing DESIGN.md (if UI project)

If `needs_ui = true`, look for `DESIGN.md` in `scan_root`.

- **If found:** Ask the user:
  > "DESIGN.md already exists. Keep it as-is, or migrate it to the AI-optimized format?"
  - **Keep:** Set `create_design = false`. Skip.
  - **Migrate:** Same process as ARCHITECTURE.md. Back up to `DESIGN.md.bak`. Map into `design-template.md` sections. Set `create_design = false`.

### Step 6: Early exit check

If `create_arch = false` AND `create_design = false`: skip to Step 8.

### Step 7: Generate files

Detect whether this is an empty or existing project:

**Empty project** = fewer than 5 source files. Exclude from count: `.gitignore`, `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `CLAUDE.md`, `README.md`, `LICENSE`, lock files, and dotfiles/dotdirectories.

#### For empty/new projects:

- If `create_arch = true`: Write `ARCHITECTURE.md` from `architecture-template.md` (the skeleton with `<!-- Fill as project grows -->` placeholders).
- If `create_design = true`: Write `DESIGN.md` from `design-template.md`.

#### For existing projects — Deep Scan:

Run the deep scan scoped to `scan_root`. Follow these rules:

**Scan bounds:**
- Source files only. Exclude: `node_modules/`, `dist/`, `build/`, `.git/`, `__pycache__/`, `target/`, `vendor/`, `.next/`, coverage directories, and gitignored paths.
- Cap File Index at 200 entries. Prioritize by directory depth (shallower first). If truncated, add note: "Truncated at 200 entries — run `/living-docs:init` on subfolders for full coverage."
- Scan up to 5 directory levels deep.
- Priority order: File Index + Tech Stack first → API Contracts + Environment Variables → Dependencies & Data Flow (most expensive). If context is running low, stop after high-priority targets and note incomplete sections.

**Scan targets for ARCHITECTURE.md:**

| What to scan | How | Maps to section |
|-------------|-----|-----------------|
| All source files | Glob patterns, read file headers/exports | **File Index** — table with path + one-line purpose |
| Tech stack | Read package.json, Cargo.toml, go.mod, requirements.txt, Gemfile, pyproject.toml; infer from file extensions | **Tech Stack** — table with category, technology, purpose |
| API routes | Find route/endpoint definitions (Next.js app/api/, Express router, FastAPI decorators, etc.) | **API Contracts** — table with method, route, request, response, purpose |
| Environment variables | Read .env.example, docker-compose.yml, grep for `process.env`, `os.environ`, etc. | **Environment Variables** — table with variable, required, purpose |
| Import graph | Read import/require statements in key files | **Dependencies & Data Flow** — dependency table + ASCII data flow diagram |
| Code patterns | Observe error handling, naming conventions, file organization | **Key Patterns & Conventions** — bullet list |

**Additional scan targets for DESIGN.md (if `create_design = true`):**

| What to scan | How | Maps to section |
|-------------|-----|-----------------|
| Color tokens | Read CSS variables, Tailwind config (theme.extend.colors), theme files | **Color Tokens** table |
| Typography | Font declarations, heading styles, Tailwind typography config | **Typography** table |
| Spacing | Spacing scale in CSS variables, Tailwind spacing config | **Spacing Scale** table |
| Components | Component files — extract variants, sizes, props | **Component Patterns** |
| Layout | Grid config, breakpoint definitions, container settings | **Layout Conventions** |
| Animations | Transition definitions, keyframes, Framer Motion variants | **Animation Patterns** table |

Fill each template section with the scan results. Leave sections empty with `<!-- No [X] detected -->` if nothing was found for that category.

### Step 8: Commit

Commit only the generated/migrated docs (and .bak files if migrating):

- **New files:** `git commit -m "Initialize living documentation (ARCHITECTURE.md[, DESIGN.md])"`
- **Migrated files:** `git commit -m "Migrate living documentation to AI-optimized format (ARCHITECTURE.md[, DESIGN.md])"`

## Template Reference

The skeleton templates are in sibling files:
- `architecture-template.md` — sections and table headers for ARCHITECTURE.md
- `design-template.md` — sections and table headers for DESIGN.md

Read these templates before generating files to ensure the output matches the expected format exactly.
```

- [ ] **Step 2: Verify file exists and frontmatter is correct**

Run: `head -5 skills/living-docs/init/SKILL.md`
Expected: Shows `---`, `name: living-docs:init`, `description: ...`, `---`

- [ ] **Step 3: Verify all three files are in the init directory**

Run: `ls -la skills/living-docs/init/`
Expected: `SKILL.md`, `architecture-template.md`, `design-template.md`

- [ ] **Step 4: Commit**

```bash
git add skills/living-docs/init/SKILL.md
git commit -m "Add /living-docs:init skill with deep scan and skeleton generation"
```

---

### Task 4: Update existing /living-docs skill

**Files:**
- Modify: `skills/living-docs/SKILL.md` (all 65 lines)

- [ ] **Step 1: Read current file**

Read `skills/living-docs/SKILL.md` to confirm current content before editing.

- [ ] **Step 2: Update frontmatter description**

Change line 3 from:
```
description: Use at the start of every conversation and after making any code or design changes — keeps architecture.md and DESIGN.md synchronized with the codebase
```
To:
```
description: Use at the start of every conversation and after making any code or design changes — keeps ARCHITECTURE.md and DESIGN.md synchronized with the codebase
```

- [ ] **Step 3: Update overview text**

Change line 10 from:
```
Maintain two living documents that stay synchronized with the codebase. **Read both before any work. Update both after any changes.**
```
To:
```
Maintain living documents that stay synchronized with the codebase. **Read them before any work. Update after any changes.**
```

- [ ] **Step 4: Update the Two Documents table**

Change the table (lines 14-17) from:
```markdown
| Document | Location | Tracks |
|----------|----------|--------|
| `architecture.md` | Project root | File structure, data flow, API contracts, dependencies, env vars |
| `DESIGN.md` | Project root | Colors, typography, spacing, shadows, animation, component patterns, page layouts |
```
To:
```markdown
| Document | Location | Tracks | Required |
|----------|----------|--------|----------|
| `ARCHITECTURE.md` | Project root | File structure, data flow, API contracts, dependencies, env vars | Always |
| `DESIGN.md` | Project root | Colors, typography, spacing, shadows, animation, component patterns, page layouts | Only if project has UI (existence-based — if the file exists, maintain it) |
```

- [ ] **Step 5: Update "On Every Conversation Start" section**

Replace lines 21-26 with:
```markdown
### On Every Conversation Start

1. Read `ARCHITECTURE.md` from the project root (if it exists). Also check for lowercase `architecture.md` — if found, rename it to `ARCHITECTURE.md`.
2. Read `DESIGN.md` from the project root **only if it exists**. Its existence means this is a UI project.
3. Use them as context for understanding the current system state.
4. Reference them when making decisions about where code goes and how it should look.
5. If `ARCHITECTURE.md` is missing, prompt the user: "No ARCHITECTURE.md found. Run `/living-docs:init` to create one before starting work."
```

- [ ] **Step 6: Update "After Code Changes" section**

Replace all occurrences of `architecture.md` with `ARCHITECTURE.md` in lines 28-36.

- [ ] **Step 7: Update "After Design Changes" section**

Add a conditional note at the top of this section (after line 38):
```markdown
**Only applies if `DESIGN.md` exists** (UI projects). Skip this section for non-UI projects.
```

- [ ] **Step 8: Update Serena integration section**

Change line 57 from:
```
If Serena MCP is available, use `write_memory` for architectural decisions that go beyond what architecture.md tracks (e.g., rationale behind choices, cross-project patterns). architecture.md tracks structure; Serena memories track reasoning.
```
To:
```
If Serena MCP is available, use `write_memory` for architectural decisions that go beyond what ARCHITECTURE.md tracks (e.g., rationale behind choices, cross-project patterns). ARCHITECTURE.md tracks structure; Serena memories track reasoning.
```

- [ ] **Step 9: Verify all `architecture.md` references are now `ARCHITECTURE.md`**

Run: `grep -i "architecture.md" skills/living-docs/SKILL.md`
Expected: All occurrences should be uppercase `ARCHITECTURE.md` (no lowercase matches)

- [ ] **Step 10: Commit**

```bash
git add skills/living-docs/SKILL.md
git commit -m "Update /living-docs: conditional DESIGN.md, redirect to /living-docs:init, rename to ARCHITECTURE.md"
```

---

### Task 5: Update /init skill to run /living-docs:init

**Files:**
- Modify: `skills/init/SKILL.md:119` (add after line 119)

- [ ] **Step 1: Read current file**

Read `skills/init/SKILL.md` to confirm current content.

- [ ] **Step 2: Add living-docs:init step**

After line 119 (the last step "Tell the user what was created..."), add:

```markdown

6. Run `/living-docs:init` to generate `ARCHITECTURE.md` and optionally `DESIGN.md` for the project. This creates the AI-optimized living documentation files that the `/living-docs` skill will maintain going forward.
```

- [ ] **Step 3: Also update the fallback template's Living Documentation section**

In the fallback template content (around line 101-103), change:
```markdown
## Living Documentation
- Run `/living-docs` at the **start** of every conversation to load `ARCHITECTURE.md` and `DESIGN.md`.
- After making code or design changes, update the relevant doc before ending the conversation.
```
To:
```markdown
## Living Documentation
- At conversation start, check for `ARCHITECTURE.md` (always) and `DESIGN.md` (only if it exists).
- If `ARCHITECTURE.md` is missing, prompt the user to run `/living-docs:init` before starting any coding work.
- If `DESIGN.md` exists, treat this as a UI project and maintain it alongside `ARCHITECTURE.md`.
- After code changes, update `ARCHITECTURE.md`. After design/UI changes, update `DESIGN.md` (if it exists).
```

- [ ] **Step 4: Commit**

```bash
git add skills/init/SKILL.md
git commit -m "Integrate /living-docs:init into /init flow"
```

---

### Task 6: Update template CLAUDE.md and project CLAUDE.md

**Files:**
- Modify: `templates/CLAUDE.md:103-105`
- Modify: `CLAUDE.md:10,99-101`

- [ ] **Step 1: Update templates/CLAUDE.md Living Documentation section**

Replace lines 103-105:
```markdown
## Living Documentation
- Run `/living-docs` at the **start** of every conversation to load `ARCHITECTURE.md` and `DESIGN.md` as working context.
- After making code or design changes, update the relevant doc (`ARCHITECTURE.md` for structural changes, `DESIGN.md` for UI/styling changes) before ending the conversation.
```
With:
```markdown
## Living Documentation
- At conversation start, check for `ARCHITECTURE.md` (always) and `DESIGN.md` (only if it exists).
- If `ARCHITECTURE.md` is missing, prompt the user to run `/living-docs:init` before starting any coding work.
- If `DESIGN.md` exists, treat this as a UI project and maintain it alongside `ARCHITECTURE.md`.
- After code changes, update `ARCHITECTURE.md`. After design/UI changes, update `DESIGN.md` (if it exists).
```

- [ ] **Step 2: Update CLAUDE.md Living Documentation section**

Replace lines 99-101 with the same content as step 1.

- [ ] **Step 3: Update CLAUDE.md Skill System section**

Change line 10 from:
```
- **living-docs** skill keeps architecture.md and DESIGN.md in sync with code changes (fires on conversation start + after changes)
```
To:
```
- **living-docs** skill keeps ARCHITECTURE.md and DESIGN.md in sync with code changes (fires on conversation start + after changes)
```

- [ ] **Step 4: Verify no lowercase `architecture.md` remains in either file**

Run: `grep -n "architecture.md" CLAUDE.md templates/CLAUDE.md`
Expected: No matches (all should be uppercase)

- [ ] **Step 5: Commit**

```bash
git add templates/CLAUDE.md CLAUDE.md
git commit -m "Update Living Documentation sections: conditional DESIGN.md, /living-docs:init prompt"
```

---

### Task 7: Rename architecture.md references in README.md and SETUP.md

**Files:**
- Modify: `README.md:55`
- Modify: `SETUP.md:35`

- [ ] **Step 1: Update README.md**

Change line 55 from:
```
| **Living Docs** | Auto-syncs architecture.md and DESIGN.md with code changes |
```
To:
```
| **Living Docs** | Auto-syncs ARCHITECTURE.md and DESIGN.md with code changes |
```

- [ ] **Step 2: Update SETUP.md**

Change line 35 from:
```
| `skills/living-docs/SKILL.md` | `~/.claude/skills/living-docs/` | Auto-syncs architecture.md and DESIGN.md |
```
To:
```
| `skills/living-docs/SKILL.md` | `~/.claude/skills/living-docs/` | Auto-syncs ARCHITECTURE.md and DESIGN.md |
```

- [ ] **Step 3: Verify no lowercase `architecture.md` remains**

Run: `grep -rn "architecture.md" README.md SETUP.md`
Expected: No matches

- [ ] **Step 4: Commit**

```bash
git add README.md SETUP.md
git commit -m "Rename architecture.md to ARCHITECTURE.md in README and SETUP"
```

---

### Task 8: Final verification

- [ ] **Step 1: Verify all new files exist**

Run: `ls -la skills/living-docs/init/`
Expected: `SKILL.md`, `architecture-template.md`, `design-template.md`

- [ ] **Step 2: Verify no lowercase references remain anywhere**

Run: `grep -rn "architecture\.md" skills/ templates/ CLAUDE.md README.md SETUP.md --include="*.md"`
Expected: Only uppercase `ARCHITECTURE.md` matches (case-sensitive grep for lowercase should return nothing)

- [ ] **Step 3: Verify git log shows clean commit history**

Run: `git log --oneline -8`
Expected: 7 new commits, one per task

- [ ] **Step 4: Run spec compliance check**

Verify against the spec at `docs/superpowers/specs/2026-03-17-living-docs-init-design.md`:
- All files in the "Files Summary" table are accounted for
- SKILL.md frontmatter matches spec
- Process flow covers all 8 steps from spec
- All edge cases from spec are handled in SKILL.md
- Scan bounds match spec (200 file cap, 5-level depth, priority order, exclusions)
