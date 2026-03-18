---
name: init
description: Initialize or update a project's CLAUDE.md from the installed template — run /sm:init in any project directory
---

# Project Initialization

Create or update `CLAUDE.md` in the current project directory from the installed template.

## Section Ownership

Sections are classified as **project-specific** (user-owned, preserved during updates) or **infrastructure** (template-owned, always updated to latest):

**Project-specific** (preserved during merge):
- Quick Reference
- Commands
- Tech Stack
- Project Structure
- Any section not listed below (custom user sections)

**Infrastructure** (replaced from template on every run):
- Shell & Git Permissions
- Worktree Development Workflow
- MCP Servers
- UI Changes
- Living Documentation

## Steps

1. Read the template from `~/.claude/templates/CLAUDE.md`. If it doesn't exist, tell the user to run `bash setup.sh` first to install it, then stop.

2. Check if `CLAUDE.md` exists in the current project root.

3. **If no existing CLAUDE.md** — copy the template as-is, then proceed to step 5.

4. **If CLAUDE.md exists** — perform a section-level merge:
   a. Parse both files into sections by splitting on `## ` heading lines. The content before the first `## ` is the preamble (title + intro).
   b. Keep the user's preamble (title line, any intro text).
   c. For each **project-specific** section: keep the user's version if it exists and has real content (not just placeholder comments). If the user's version is empty/placeholder and the template has content, use the template's.
   d. For each **infrastructure** section: replace with the template's version regardless of what the user had.
   e. For sections in the user's file that aren't in either ownership list: preserve them as custom sections.
   f. Output sections in this order: template sections first (in template order), then any custom user sections at the end.
   g. Write the merged result using the Edit tool (or Write if creating fresh).
   h. Show the user a brief summary:
      - **Preserved**: project-specific sections kept from their file
      - **Updated**: infrastructure sections replaced with latest template
      - **Added**: template sections the user didn't have before
      - **Kept**: custom sections the user had that aren't in the template

5. Scan the project to auto-detect context:
   - `package.json` — read `scripts` for Commands, `dependencies`/`devDependencies` for Tech Stack
   - `Cargo.toml` — Rust project
   - `go.mod` — Go project
   - `requirements.txt` / `pyproject.toml` — Python project
   - `Gemfile` — Ruby project
   - Directory structure for the Project Structure section

6. Fill in what you can detect automatically — **only for sections that are currently empty or have placeholder content** (e.g., `<!-- Fill in -->` comments). Do not overwrite sections the user has already filled in.
   - **Commands**: Extract from package.json scripts, Makefile targets, etc.
   - **Tech Stack**: Infer from dependencies/config files
   - **Project Structure**: Generate from actual directory layout (top 2 levels, skip node_modules/dist/.git/.worktrees)

7. Tell the user what was created or updated and which sections they should review.

8. Run `/living-docs:init` to generate `ARCHITECTURE.md` and optionally `DESIGN.md` for the project.
