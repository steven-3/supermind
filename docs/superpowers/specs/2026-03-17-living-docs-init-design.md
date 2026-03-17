# Living Docs Init — Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Scope:** New `/living-docs:init` skill, updates to `/living-docs`, `/init`, template CLAUDE.md, and project CLAUDE.md

## Problem

At conversation start, the `/living-docs` skill expects `ARCHITECTURE.md` and `DESIGN.md` to exist. If they don't, there's no guided way to create them. Additionally, `DESIGN.md` is checked/maintained even for non-UI projects where it's irrelevant. There's no AI-optimized format standard for these files, meaning Claude often has to scan the entire project to understand structure — wasting tokens and time.

## Naming: `ARCHITECTURE.md` (uppercase)

The existing `/living-docs` skill currently references `architecture.md` (lowercase). This spec standardizes on **`ARCHITECTURE.md`** (uppercase) to match `DESIGN.md` and `CLAUDE.md` conventions.

**Migration:** The updated `/living-docs` skill must check for both `architecture.md` and `ARCHITECTURE.md`. If only the lowercase version exists, rename it to `ARCHITECTURE.md`. References in `skills/living-docs/SKILL.md` change from `architecture.md` to `ARCHITECTURE.md`.

**Files with lowercase references to update:**
- `skills/living-docs/SKILL.md` — all occurrences of `architecture.md`
- `README.md` — if it references `architecture.md`
- `SETUP.md` — if it references `architecture.md`

## Solution

A new `/living-docs:init` skill that:
1. Asks the user if the project has a UI
2. Deep scans existing codebases to auto-generate AI-optimized `ARCHITECTURE.md` and `DESIGN.md`
3. Creates skeleton templates for new/empty projects
4. Integrates with `/init` so it runs automatically during project scaffolding

The existing `/living-docs` skill becomes conditional — it only maintains `DESIGN.md` if the file exists (indicating a UI project).

`/living-docs:init` can also be run standalone on any existing project — it does not require `/init` to have been run first.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI detection method | Ask the user | Always correct, no false positives from heuristics |
| Information gathering | Deep scan, auto-generate | Autonomous, no interview needed |
| Empty project handling | Skeleton templates with empty sections | Files exist immediately so maintenance kicks in as code is added |
| Existing file handling | Ask user: keep or migrate | Respects existing work while offering the optimized format |
| DESIGN.md conditionality | Existence-based | If the file exists, it's a UI project. No flags needed |
| Monorepo scoping | Ask user: subfolder or entire repo | User decides the right scope |
| Skill file structure | Skill + separate template files | Templates are easy to iterate on independently from process logic |
| Canonical filename | `ARCHITECTURE.md` (uppercase) | Consistent with `DESIGN.md` and `CLAUDE.md` conventions |

## Skill: `/living-docs:init`

### Location

```
skills/living-docs/init/
  SKILL.md                    — Process logic
  architecture-template.md    — AI-optimized skeleton for ARCHITECTURE.md
  design-template.md          — AI-optimized skeleton for DESIGN.md
```

### SKILL.md Frontmatter

```yaml
---
name: living-docs:init
description: Create AI-optimized ARCHITECTURE.md and DESIGN.md for a project via deep scan or skeleton templates. Run standalone or as part of /init.
---
```

### Process Flow

The flow tracks which files need creation using two flags: `create_arch` and `create_design`. Steps 4-5 may resolve these flags early (via "keep" or "migrate"). Step 7 only acts on files whose flags are still unresolved.

```
1. Ask: "Does this project have a UI?" → yes/no
   → Sets: needs_ui = true/false

2. Detect monorepo:
   a. If working directory != repo root:
      Ask: "You're in <subdir>. Document just this subfolder, or the entire repo?"
   b. If at repo root AND workspace indicators exist (packages/, apps/, workspaces
      in package.json, pnpm-workspace.yaml, Cargo workspace):
      Ask: "This looks like a monorepo. Document the entire repo, or a specific subfolder?"
   → Sets: scan_root = chosen directory
   c. If neither condition triggers: scan_root = working directory (repo root)

3. Set flags: create_arch = true, create_design = needs_ui

4. Check ARCHITECTURE.md exists in scan_root?
   → exists: Ask "Keep as-is or migrate to AI-optimized format?"
     → keep: create_arch = false (skip entirely)
     → migrate: Read existing file. Map content into template sections.
       Content that doesn't fit any section goes into a "Notes" section at the end.
       Back up original to ARCHITECTURE.md.bak before overwriting (overwrite .bak if it already exists).
       create_arch = false (handled by migration)
   → missing: create_arch remains true

5. If needs_ui, check DESIGN.md exists in scan_root?
   → exists: Ask "Keep as-is or migrate?"
     → keep: create_design = false
     → migrate: Same process as ARCHITECTURE.md migration.
       Back up to DESIGN.md.bak (overwrite .bak if it already exists). create_design = false
   → missing: create_design remains true

6. If create_arch = false AND create_design = false: skip to step 8

7. Detect project state and generate files:
   "Empty project" = fewer than 5 source files (excluding config files like
   .gitignore, package.json, CLAUDE.md, lock files, READMEs, and dotfiles).

   → Empty/new project:
     - If create_arch: write ARCHITECTURE.md from skeleton template (empty sections
       with <!-- Fill as project grows --> placeholders)
     - If create_design: write DESIGN.md from skeleton template

   → Existing project:
     - Deep scan codebase (scoped to scan_root)
     - If create_arch: fill ARCHITECTURE.md template from scan results
     - If create_design: fill DESIGN.md template from scan results

8. Commit generated/migrated files with message:
   - New files: "Initialize living documentation (ARCHITECTURE.md[, DESIGN.md])"
   - Migrated files: "Migrate living documentation to AI-optimized format (ARCHITECTURE.md[, DESIGN.md])"
   This is a standalone commit containing only the generated/migrated docs (and .bak files if migrating).
   Committing is auto-approved per CLAUDE.md git permissions (non-destructive write).
```

### Deep Scan (existing projects)

The skill scans and extracts:

| Scan Target | Source | Maps To |
|-------------|--------|---------|
| Directory structure | Glob all files | File Index section |
| Tech stack | package.json, Cargo.toml, go.mod, requirements.txt, Gemfile, file extensions | Tech Stack table |
| Imports/dependencies | Import statements, require() calls | Dependencies & Data Flow table |
| API routes | Route files, decorators, framework conventions | API Contracts table |
| Data models | Type definitions, schemas, ORM models | Referenced in File Index |
| Environment variables | .env.example, docker-compose, code references | Environment Variables table |
| Key patterns | Code conventions, error handling, naming | Key Patterns section |
| Colors/tokens | CSS variables, Tailwind config, theme files | Color Tokens table (DESIGN.md) |
| Typography | Font declarations, heading styles | Typography table (DESIGN.md) |
| Spacing | Spacing scale, CSS custom properties | Spacing Scale table (DESIGN.md) |
| Components | Component files, variants, props | Component Patterns section (DESIGN.md) |
| Layout | Grid config, breakpoints, containers | Layout Conventions (DESIGN.md) |
| Animations | Transition definitions, keyframes | Animation Patterns table (DESIGN.md) |

### Scan Bounds

- **File Index:** List source files only (no node_modules, build output, lock files, .git). Cap at 200 entries. If the project exceeds 200 source files, prioritize by directory depth (shallower first) and note "Truncated — run `/living-docs:init` on subfolders for full coverage."
- **Directory depth:** Scan up to 5 levels deep by default.
- **Priority order:** File Index and Tech Stack first (cheapest, most value), then API Contracts and Environment Variables, then Dependencies & Data Flow (most expensive). If context is running low, stop after the high-priority targets and note incomplete sections.
- **Exclusions:** `node_modules/`, `dist/`, `build/`, `.git/`, `__pycache__/`, `target/`, `vendor/`, `.next/`, coverage directories, and any paths in `.gitignore`.

## AI-Optimized Format

### Philosophy

**Tables over prose.** An AI reading `| src/auth/login.ts | Login form with email/password |` is vastly cheaper than parsing paragraphs or globbing directories. Every section that can be a table, is a table.

### ARCHITECTURE.md Sections

| Section | Format | Purpose |
|---------|--------|---------|
| Overview | One paragraph | What the project does, core architecture pattern |
| Tech Stack | Table: category, technology, purpose | Quick stack reference |
| File Index | Table: path, purpose | **#1 token saver** — AI reads this instead of scanning the project |
| Dependencies & Data Flow | Table + ASCII diagram (see example below) | Know what to read when changing something |
| API Contracts | Table: method, route, request, response, purpose | API reference without reading route files |
| Environment Variables | Table: variable, required, purpose | Setup reference |
| Key Patterns & Conventions | Bullet list | Follow existing patterns without inferring them |

#### File Index Granularity

- List **source files only** — no generated output, lock files, or build artifacts
- List files, not directories (directories are implicit from paths)
- Every row has a one-line purpose description
- Example:

```markdown
| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout with global providers and metadata |
| `src/app/page.tsx` | Home page — hero section + feature grid |
| `src/lib/auth.ts` | JWT verification and session management |
| `src/middleware.ts` | Auth guard for protected routes |
```

#### Dependencies & Data Flow Example

The table shows file-level dependencies. The ASCII diagram shows the high-level data flow:

```markdown
### Data Flow

User Request → middleware.ts → route handler → service → database
                   ↓
              auth check

### File Dependencies

| File | Depends On | Used By |
|------|-----------|---------|
| `src/lib/auth.ts` | `src/models/user.ts` | `src/middleware.ts`, `src/app/api/login/route.ts` |
| `src/middleware.ts` | `src/lib/auth.ts` | All protected routes |
```

### DESIGN.md Sections

| Section | Format | Purpose |
|---------|--------|---------|
| Overview | One paragraph | Visual identity summary |
| Color Tokens | Table: token, value, usage | Color reference |
| Typography | Table: role, font, size, weight, line-height | Type scale reference |
| Spacing Scale | Table: token, value, usage | Spacing reference |
| Component Patterns | Per-component: variants, sizes, file path | Component API reference |
| Layout Conventions | Bullets: grid, breakpoints, container widths | Layout reference |
| Animation Patterns | Table: name, duration, easing, usage | Motion reference |

## Changes to Existing Files

### `skills/living-docs/SKILL.md` — Edit

This **replaces** the current "On Every Conversation Start" step 4 ("offer to create it") with a redirect to `/living-docs:init`:

- Rename all `architecture.md` references to `ARCHITECTURE.md`
- Always read `ARCHITECTURE.md` at conversation start (check for both `architecture.md` and `ARCHITECTURE.md`; if lowercase exists, rename to uppercase)
- Only read `DESIGN.md` if it exists (existence = UI project)
- If `ARCHITECTURE.md` is missing, prompt user: "No ARCHITECTURE.md found. Run `/living-docs:init` to create one before starting work." This **replaces** the current behavior of offering to create the file inline.
- Remove any hard requirement to create/maintain `DESIGN.md` unconditionally
- Update the "Two Documents" table and Serena integration section to use `ARCHITECTURE.md`

### `skills/init/SKILL.md` — Edit

Add a new step at the end of the `/init` flow:
- After CLAUDE.md setup is complete, run `/living-docs:init` to generate architecture/design docs

### `templates/CLAUDE.md` — Edit Living Documentation section

```markdown
## Living Documentation
- At conversation start, check for `ARCHITECTURE.md` (always) and `DESIGN.md` (only if it exists).
- If `ARCHITECTURE.md` is missing, prompt the user to run `/living-docs:init` before starting any coding work.
- If `DESIGN.md` exists, treat this as a UI project and maintain it alongside `ARCHITECTURE.md`.
- After code changes, update `ARCHITECTURE.md`. After design/UI changes, update `DESIGN.md` (if it exists).
```

### `CLAUDE.md` — Edit Living Documentation section

Same content as the template above, replacing the current Living Documentation section.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty/new project (< 5 source files) | Write skeleton templates with empty sections and `<!-- Fill as project grows -->` placeholders |
| Monorepo at repo root | Detect workspace indicators (packages/, apps/, workspace configs) and ask user to scope |
| Monorepo in subfolder | Detect working dir != repo root and ask user to scope |
| No manifest file (no package.json etc.) | Scan files directly — infer tech stack from extensions, imports, shebangs |
| User says "keep" for existing file | Skip that file entirely, `create_*` flag set to false |
| User says "migrate" for existing file | Back up original to `.bak`, read content, map into template sections, unmapped content goes to "Notes" section |
| Truly nothing to scan (< 5 source files) | Produce skeleton (same as empty project) |
| Project exceeds 200 source files | Truncate File Index, note incomplete coverage |
| Existing lowercase `architecture.md` | Rename to `ARCHITECTURE.md` during `/living-docs` conversation-start check |
| Standalone run (no prior `/init`) | Works identically — `/init` integration is optional |

## What Is NOT Changing

- `/living-docs` maintenance behavior (surgical edits, Edit tool, factual content) — unchanged
- Worktree workflow, git permissions, MCP sections — unchanged
- No new dependencies or hooks

## Files Summary

| File | Action |
|------|--------|
| `skills/living-docs/init/SKILL.md` | **Create** — skill process logic |
| `skills/living-docs/init/architecture-template.md` | **Create** — AI-optimized skeleton |
| `skills/living-docs/init/design-template.md` | **Create** — AI-optimized skeleton |
| `skills/living-docs/SKILL.md` | **Edit** — conditional DESIGN.md, missing-file prompt, `architecture.md` → `ARCHITECTURE.md` rename |
| `skills/init/SKILL.md` | **Edit** — add `/living-docs:init` at end of flow |
| `templates/CLAUDE.md` | **Edit** — rewrite Living Documentation section |
| `CLAUDE.md` | **Edit** — rewrite Living Documentation section + update Skill System section (line 10: `architecture.md` → `ARCHITECTURE.md`) |
| `README.md` | **Edit** — `architecture.md` → `ARCHITECTURE.md` in Living Docs feature description |
| `SETUP.md` | **Edit** — `architecture.md` → `ARCHITECTURE.md` in skills table |
