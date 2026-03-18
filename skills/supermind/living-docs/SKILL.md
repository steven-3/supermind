---
name: living-docs
description: Use at the start of every conversation and after making any code or design changes — keeps ARCHITECTURE.md and DESIGN.md synchronized with the codebase
---

# Living Documentation

## Overview

Maintain living documents that stay synchronized with the codebase. **Read them before any work. Update after any changes.**

## The Two Documents

| Document | Location | Tracks | Required |
|----------|----------|--------|----------|
| `ARCHITECTURE.md` | Project root | File structure, data flow, API contracts, dependencies, env vars | Always |
| `DESIGN.md` | Project root | Colors, typography, spacing, shadows, animation, component patterns, page layouts | Only if project has UI (existence-based — if the file exists, maintain it) |

## Workflow

### On Every Conversation Start

1. Read `ARCHITECTURE.md` from the project root (if it exists). Also check for lowercase `architecture.md` — if found, rename it to `ARCHITECTURE.md`.
2. Read `DESIGN.md` from the project root **only if it exists**. Its existence means this is a UI project.
3. Use them as context for understanding the current system state.
4. Reference them when making decisions about where code goes and how it should look.
5. If `ARCHITECTURE.md` is missing, prompt the user: "No ARCHITECTURE.md found. Run `/sm:init` to create one before starting work."

### After Code Changes

Update `ARCHITECTURE.md` if you:
- Added, removed, or renamed files
- Changed API routes or their contracts
- Modified the data flow or added new dependencies
- Changed environment variables
- Added new types or modified existing ones
- Changed the component hierarchy

### After Design Changes

**Only applies if `DESIGN.md` exists** (UI projects). Skip this section for non-UI projects.

Update `DESIGN.md` if you:
- Changed colors, fonts, spacing, or shadows in globals.css
- Added or modified UI components
- Changed animation variants or timing
- Altered page layouts or responsive breakpoints
- Modified component variants or props

### Update Rules

- **Be surgical** — only update the sections that changed, don't rewrite the whole doc
- **Use the Edit tool** — don't rewrite the entire file for a small change
- **Keep it factual** — document what IS, not what should be
- **Include file paths** — always reference the actual source files
- **Match the existing format** — follow the section structure already in the doc

## Integration with Serena

If Serena MCP is available, use `write_memory` for architectural decisions that go beyond what ARCHITECTURE.md tracks (e.g., rationale behind choices, cross-project patterns). ARCHITECTURE.md tracks structure; Serena memories track reasoning.

## What NOT to Do

- Don't skip reading the docs "because you remember" — the codebase may have changed
- Don't defer updates to "later" — update immediately after changes
- Don't add aspirational content — only document current state
- Don't duplicate code in the docs — reference files, describe structure
