# Living Docs Init — Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Scope:** New `/living-docs:init` skill, updates to `/living-docs`, `/init`, template CLAUDE.md, and project CLAUDE.md

## Problem

At conversation start, the `/living-docs` skill expects `ARCHITECTURE.md` and `DESIGN.md` to exist. If they don't, there's no guided way to create them. Additionally, `DESIGN.md` is checked/maintained even for non-UI projects where it's irrelevant. There's no AI-optimized format standard for these files, meaning Claude often has to scan the entire project to understand structure — wasting tokens and time.

## Solution

A new `/living-docs:init` skill that:
1. Asks the user if the project has a UI
2. Deep scans existing codebases to auto-generate AI-optimized `ARCHITECTURE.md` and `DESIGN.md`
3. Creates skeleton templates for new/empty projects
4. Integrates with `/init` so it runs automatically during project scaffolding

The existing `/living-docs` skill becomes conditional — it only maintains `DESIGN.md` if the file exists (indicating a UI project).

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

## Skill: `/living-docs:init`

### Location

```
skills/living-docs/init/
  SKILL.md                    — Process logic
  architecture-template.md    — AI-optimized skeleton for ARCHITECTURE.md
  design-template.md          — AI-optimized skeleton for DESIGN.md
```

### Process Flow

```
1. Ask: "Does this project have a UI?" → yes/no

2. If working directory != repo root:
   Ask: "You're in <subdir>. Document just this subfolder, or the entire repo?"

3. Check ARCHITECTURE.md exists?
   → exists: Ask "Keep as-is or migrate to AI-optimized format?"
     → keep: skip
     → migrate: read existing, restructure into template, write
   → missing: continue to step 5

4. If UI project, check DESIGN.md exists?
   → exists: Ask "Keep as-is or migrate?"
     → keep: skip
     → migrate: read existing, restructure into template, write
   → missing: continue to step 5

5. Detect project state:
   → Empty/new project:
     - Write ARCHITECTURE.md from skeleton template (empty sections)
     - If UI project: write DESIGN.md from skeleton template
   → Existing project:
     - Deep scan codebase
     - Fill ARCHITECTURE.md template sections from scan results
     - If UI project: fill DESIGN.md template sections from scan results

6. Commit the generated files
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

## AI-Optimized Format

### Philosophy

**Tables over prose.** An AI reading `| src/auth/login.ts | Login form with email/password |` is vastly cheaper than parsing paragraphs or globbing directories. Every section that can be a table, is a table.

### ARCHITECTURE.md Sections

| Section | Format | Purpose |
|---------|--------|---------|
| Overview | One paragraph | What the project does, core architecture pattern |
| Tech Stack | Table: category, technology, purpose | Quick stack reference |
| File Index | Table: path, purpose | **#1 token saver** — AI reads this instead of scanning the project |
| Dependencies & Data Flow | Table: file, depends on, used by + ASCII flow diagram | Know what to read when changing something |
| API Contracts | Table: method, route, request, response, purpose | API reference without reading route files |
| Environment Variables | Table: variable, required, purpose | Setup reference |
| Key Patterns & Conventions | Bullet list | Follow existing patterns without inferring them |

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

- Always read `ARCHITECTURE.md` at conversation start
- Only read `DESIGN.md` if it exists (existence = UI project)
- If `ARCHITECTURE.md` is missing, prompt user: "No ARCHITECTURE.md found. Run `/living-docs:init` to create one before starting work."
- Remove any hard requirement to create/maintain DESIGN.md unconditionally

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
| Empty/new project | Write skeleton templates with empty sections and `<!-- Fill as project grows -->` placeholders |
| Monorepo / subfolder | Ask user: "Document just this subfolder, or the entire repo?" |
| No manifest file (no package.json etc.) | Scan files directly — infer tech stack from extensions, imports, shebangs |
| User says "keep" for existing file | Skip that file, move to next step |
| User says "migrate" for existing file | Read existing content, map into AI-optimized template, preserve all information |
| Truly nothing to scan | Produce skeleton (same as empty project) |

## What Is NOT Changing

- `/living-docs` maintenance behavior (surgical edits, Edit tool, factual content)
- Worktree workflow, git permissions, MCP sections
- No new dependencies or hooks

## Files Summary

| File | Action |
|------|--------|
| `skills/living-docs/init/SKILL.md` | **Create** — skill process logic |
| `skills/living-docs/init/architecture-template.md` | **Create** — AI-optimized skeleton |
| `skills/living-docs/init/design-template.md` | **Create** — AI-optimized skeleton |
| `skills/living-docs/SKILL.md` | **Edit** — conditional DESIGN.md, missing-file prompt |
| `skills/init/SKILL.md` | **Edit** — add `/living-docs:init` at end of flow |
| `templates/CLAUDE.md` | **Edit** — rewrite Living Documentation section |
| `CLAUDE.md` | **Edit** — rewrite Living Documentation section |
