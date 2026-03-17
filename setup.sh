#!/usr/bin/env bash
set -euo pipefail

# Claude Code Portable Setup
# Run: bash setup.sh
# Works on Windows (Git Bash/WSL), macOS, Linux

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
SUPERCLAUDE_DIR="$HOME/.superclaude"
AIRIS_DIR="$SUPERCLAUDE_DIR/airis-mcp-gateway"

echo "=== Claude Code Setup ==="
echo ""

# ── 1. Settings ──────────────────────────────────────────────
echo "[1/5] Installing settings.json..."
mkdir -p "$CLAUDE_DIR"
if [ -f "$CLAUDE_DIR/settings.json" ]; then
    cp "$CLAUDE_DIR/settings.json" "$CLAUDE_DIR/settings.json.bak"
    echo "  Backed up existing settings to settings.json.bak"
fi
cp "$SCRIPT_DIR/settings.json" "$CLAUDE_DIR/settings.json"
echo "  Done."

# ── 2. Plugins ───────────────────────────────────────────────
echo "[2/5] Installing plugins..."
PLUGINS=(
    "interface-design@interface-design"
    "frontend-design@claude-plugins-official"
    "superpowers@claude-plugins-official"
    "ui-ux-pro-max@ui-ux-pro-max-skill"
)
for plugin in "${PLUGINS[@]}"; do
    echo "  Installing $plugin..."
    claude plugin install "$plugin" 2>/dev/null || echo "  (already installed or install manually)"
done
echo "  Done."

# ── 3. MCP Servers (non-AIRIS) ──────────────────────────────
echo "[3/5] Adding direct MCP servers..."

# Pencil (local app — skip if not installed)
if [ -f "$LOCALAPPDATA/Programs/Pencil/resources/app.asar.unpacked/out/mcp-server-windows-x64.exe" ] 2>/dev/null; then
    claude mcp add -s user pencil -- "$LOCALAPPDATA/Programs/Pencil/resources/app.asar.unpacked/out/mcp-server-windows-x64.exe" --app desktop 2>/dev/null || true
    echo "  Added pencil"
fi

# Magic (21st.dev)
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi
if [ -n "${TWENTYFIRST_API_KEY:-}" ]; then
    claude mcp add -s user -e API_KEY="$TWENTYFIRST_API_KEY" magic -- cmd /c npx -y @21st-dev/magic@latest 2>/dev/null || true
    echo "  Added magic"
else
    echo "  Skipped magic (no TWENTYFIRST_API_KEY in .env)"
fi

# AIRIS gateway (SSE)
claude mcp add --transport sse -s user airis-mcp-gateway http://localhost:9400/sse 2>/dev/null || true
echo "  Added airis-mcp-gateway"
echo "  Done."

# ── 4. AIRIS Gateway ────────────────────────────────────────
echo "[4/5] Setting up AIRIS MCP Gateway..."
mkdir -p "$AIRIS_DIR"
cp "$SCRIPT_DIR/airis/docker-compose.yml" "$AIRIS_DIR/docker-compose.yml"
cp "$SCRIPT_DIR/airis/mcp-config.json" "$AIRIS_DIR/mcp-config.json"
mkdir -p "$AIRIS_DIR/profiles"

# Pass API keys to docker-compose env if available
if [ -f "$SCRIPT_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env" "$AIRIS_DIR/.env"
fi

echo "  Files copied to $AIRIS_DIR"
echo "  Start gateway with: cd $AIRIS_DIR && docker compose up -d"

# Auto-start if Docker is available
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    echo "  Docker detected — starting gateway..."
    cd "$AIRIS_DIR" && docker compose up -d 2>&1 | sed 's/^/  /'
    echo "  Gateway started."
else
    echo "  Docker not running — start manually later."
fi

# ── 5. Verify ────────────────────────────────────────────────
echo "[5/5] Verifying..."
echo ""
claude mcp list 2>/dev/null || echo "  Run 'claude mcp list' to verify after restarting Claude Code."
echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and add your API keys"
echo "  2. Restart Claude Code"
echo "  3. Run 'claude mcp list' to verify all servers"
