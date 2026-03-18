---
name: living-docs:init
description: Create AI-optimized ARCHITECTURE.md and DESIGN.md for a project via deep scan or skeleton templates. Run standalone or as part of /sm:init.
---

# Initialize Living Documentation

Create AI-optimized `ARCHITECTURE.md` and optionally `DESIGN.md` for the current project. These files use a tables-over-prose format designed to save AI tokens — the AI reads the file index instead of scanning the entire project.

Can be run standalone or as part of `/sm:init`.

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
| Data models | Type definitions, schemas, ORM models | **File Index** — referenced with purpose descriptions |
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
