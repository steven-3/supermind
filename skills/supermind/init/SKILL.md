---
name: init
description: Initialize or update a project — CLAUDE.md merge, tech stack detection, ARCHITECTURE.md and optional DESIGN.md generation. Run /sm:init in any project.
---

# Project Initialization

One command to fully set up a project: creates/updates CLAUDE.md, detects the tech stack, and generates living documentation (ARCHITECTURE.md + optional DESIGN.md).

---

## Phase 1: CLAUDE.md

### Section Ownership

**Project-specific** (preserved during merge):
- Quick Reference, Commands, Tech Stack, Project Structure
- Any custom section not listed below

**Infrastructure** (replaced from template on every run):
- Shell & Git Permissions, Worktree Development Workflow, MCP Servers, UI Changes, Living Documentation

### Steps

1. Read the template from `~/.claude/templates/CLAUDE.md`. If missing, tell the user to run `bash setup.sh` first and stop.

2. Check if `CLAUDE.md` exists in the project root.

3. **If no existing CLAUDE.md** — copy the template as-is, proceed to step 5.

4. **If CLAUDE.md exists** — section-level merge:
   a. Parse both files into sections (split on `## ` headings). Content before the first `## ` is the preamble.
   b. Keep the user's preamble.
   c. **Project-specific sections**: keep user's version if it has real content. If empty/placeholder, use template's.
   d. **Infrastructure sections**: replace with template's version.
   e. **Custom sections** (not in either list): preserve, append at end.
   f. Output in template section order, custom sections last.
   g. Show summary: preserved / updated / added / kept.

5. Auto-detect project context:
   - `package.json` — scripts for Commands, dependencies for Tech Stack
   - `Cargo.toml` / `go.mod` / `requirements.txt` / `pyproject.toml` / `Gemfile`
   - Directory structure for Project Structure

6. Fill in empty/placeholder sections only (don't overwrite user content):
   - **Commands**: from package.json scripts, Makefile targets, etc.
   - **Tech Stack**: from dependencies/config files
   - **Project Structure**: top 2 levels, skip node_modules/dist/.git/.worktrees

7. Tell the user what was created/updated and what to review.

---

## Phase 2: Living Documentation

Generate AI-optimized `ARCHITECTURE.md` and optionally `DESIGN.md`. These use tables-over-prose format to save tokens — the AI reads the file index instead of scanning the entire project.

### Steps

8. **Ask about UI**:
   > "Does this project have a UI? (This determines whether a DESIGN.md is created)"

9. **Detect scope**:
   - If not at git root: ask "Document just this subfolder, or the entire repo?"
   - If monorepo indicators exist (`packages/`, `apps/`, `pnpm-workspace.yaml`, workspace configs): ask "Document entire repo, or a specific subfolder?"
   - Otherwise: scan_root = working directory

10. **Check for existing ARCHITECTURE.md**:
    - If found: ask "Keep as-is, or migrate to AI-optimized format?"
    - Keep: skip. Migrate: back up to `.bak`, map content into template sections.

11. **Check for existing DESIGN.md** (if UI project):
    - Same keep/migrate flow as above.

12. **Generate files**:

    **Empty project** (< 5 source files, excluding config/lock/dotfiles):
    - Write from skeleton templates (`architecture-template.md`, `design-template.md` in this skill's directory)

    **Existing project — Deep Scan**:

    Scan bounds:
    - Exclude: node_modules/, dist/, build/, .git/, __pycache__/, target/, vendor/, .next/, coverage, gitignored paths
    - Cap File Index at 200 entries (shallower files first)
    - Max 5 directory levels deep
    - Priority: File Index + Tech Stack → API Contracts + Env Vars → Dependencies & Data Flow

    ARCHITECTURE.md scan targets:

    | Scan | How | Section |
    |------|-----|---------|
    | Source files | Glob, read headers/exports | **File Index** |
    | Tech stack | Read package.json, Cargo.toml, go.mod, etc. | **Tech Stack** |
    | API routes | Find route/endpoint definitions | **API Contracts** |
    | Env vars | Read .env.example, grep process.env/os.environ | **Environment Variables** |
    | Import graph | Read import/require statements | **Dependencies & Data Flow** |
    | Code patterns | Observe conventions | **Key Patterns & Conventions** |

    DESIGN.md scan targets (if UI):

    | Scan | How | Section |
    |------|-----|---------|
    | Colors | CSS vars, Tailwind config | **Color Tokens** |
    | Typography | Font declarations, heading styles | **Typography** |
    | Spacing | CSS vars, Tailwind spacing | **Spacing Scale** |
    | Components | Component files, variants, props | **Component Patterns** |
    | Layout | Grid, breakpoints, containers | **Layout Conventions** |
    | Animations | Transitions, keyframes, motion variants | **Animation Patterns** |

    Leave unfilled sections with `<!-- No [X] detected -->`.

13. **Commit** generated/migrated docs:
    - New: `git commit -m "Initialize project (CLAUDE.md, ARCHITECTURE.md[, DESIGN.md])"`
    - Migrated: `git commit -m "Migrate living documentation to AI-optimized format"`

## Template Reference

Skeleton templates are sibling files in this skill's directory:
- `architecture-template.md` — sections and table headers for ARCHITECTURE.md
- `design-template.md` — sections and table headers for DESIGN.md

Read these before generating files to match the expected format.
