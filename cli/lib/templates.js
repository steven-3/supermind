'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS, ensureDir, getPackageRoot } = require('./platform');
const logger = require('./logger');

const MCP_SECTIONS = {
  docker: `## MCP Servers
Use these naturally when relevant — don't wait to be asked.

- **Magic MCP** — \`component_builder\`, \`component_inspiration\`, \`component_refiner\`, \`logo_search\` — use when building/refining UI components
- **Airis Gateway** (Docker, localhost:9400) — cold-start sub-servers:
  - **context7** — Library docs lookup
  - **playwright** — Browser automation/testing
  - **serena** — Symbolic code navigation (run \`activate_project\` on first use)
  - **tavily** — Web search/research
  - **chrome-devtools** — Chrome debugging
  - **shadcn** — shadcn/ui component search`,

  direct: `## MCP Servers
Use these naturally when relevant — don't wait to be asked.

- **Magic MCP** — \`component_builder\`, \`component_inspiration\`, \`component_refiner\`, \`logo_search\` — use when building/refining UI components
- **context7** — Library docs lookup (npx)
- **playwright** — Browser automation/testing (npx)
- **serena** — Symbolic code navigation; run \`activate_project\` on first use (uvx)
- **tavily** — Web search/research (npx, requires TAVILY_API_KEY)
- **chrome-devtools** — Chrome debugging (npx)
- **shadcn** — shadcn/ui component search (npx)`,

  skip: `## MCP Servers
Use these naturally when relevant — don't wait to be asked.

- **Magic MCP** — \`component_builder\`, \`component_inspiration\`, \`component_refiner\`, \`logo_search\` — use when building/refining UI components
<!-- Add your MCP servers here. Run \`npx supermind-claude\` to set up context7, playwright, serena, tavily, and more. -->`,
};

const MCP_SECTION_PATTERN = /## MCP Servers\nUse these naturally when relevant.*?(?=\n## |\n$)/s;

function installTemplates(mcpMode) {
  ensureDir(PATHS.templatesDir);
  const src = path.join(getPackageRoot(), 'templates', 'CLAUDE.md');
  const dest = path.join(PATHS.templatesDir, 'CLAUDE.md');
  fs.copyFileSync(src, dest);

  if (mcpMode && MCP_SECTIONS[mcpMode]) {
    let content = fs.readFileSync(dest, 'utf-8');
    content = content.replace(MCP_SECTION_PATTERN, MCP_SECTIONS[mcpMode]);
    fs.writeFileSync(dest, content);
  }

  logger.success('CLAUDE.md template');
}

function removeTemplates() {
  const dest = path.join(PATHS.templatesDir, 'CLAUDE.md');
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
    logger.success('Removed CLAUDE.md template');
  }
}

module.exports = { installTemplates, removeTemplates };
