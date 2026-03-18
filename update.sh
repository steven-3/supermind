#!/usr/bin/env bash
set -euo pipefail

# Lightweight update — refreshes hooks, skills, and templates only.
# Does NOT touch settings.json, plugins, or MCP servers.
# Run: bash update.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SKILLS_DIR="$CLAUDE_DIR/skills"

echo "=== Claude Code Update (hooks + skills + templates) ==="
echo ""

# ── Hooks ──────────────────────────────────────────────────
echo "[1/3] Updating hooks..."
mkdir -p "$HOOKS_DIR"
for hook in session-start.js session-end.js cost-tracker.js statusline-command.js bash-permissions.js; do
    if [ -f "$SCRIPT_DIR/hooks/$hook" ]; then
        cp "$SCRIPT_DIR/hooks/$hook" "$HOOKS_DIR/$hook"
    fi
done
echo "  Updated: session-start, session-end, cost-tracker, statusline, bash-permissions"

# ── Skills ─────────────────────────────────────────────────
echo "[2/3] Updating skills..."

# Remove old skill paths from previous versions
rm -rf "$SKILLS_DIR/init" "$SKILLS_DIR/sm" "$SKILLS_DIR/living-docs" 2>/dev/null

mkdir -p "$SKILLS_DIR/supermind/init"
mkdir -p "$SKILLS_DIR/supermind/living-docs"
cp "$SCRIPT_DIR/skills/supermind/SKILL.md" "$SKILLS_DIR/supermind/SKILL.md"
cp "$SCRIPT_DIR/skills/supermind/init/SKILL.md" "$SKILLS_DIR/supermind/init/SKILL.md"
cp "$SCRIPT_DIR/skills/supermind/init/architecture-template.md" "$SKILLS_DIR/supermind/init/architecture-template.md"
cp "$SCRIPT_DIR/skills/supermind/init/design-template.md" "$SKILLS_DIR/supermind/init/design-template.md"
cp "$SCRIPT_DIR/skills/supermind/living-docs/SKILL.md" "$SKILLS_DIR/supermind/living-docs/SKILL.md"
echo "  Updated supermind skills (/sm:init, /sm:living-docs)"

# ── Templates ──────────────────────────────────────────────
echo "[3/3] Updating CLAUDE.md template..."
TEMPLATE_DEST="$CLAUDE_DIR/templates"
mkdir -p "$TEMPLATE_DEST"
cp "$SCRIPT_DIR/templates/CLAUDE.md" "$TEMPLATE_DEST/CLAUDE.md"
echo "  Updated template"

echo ""
echo "=== Update complete ==="
echo "Restart Claude Code (or open /hooks) to pick up changes."
