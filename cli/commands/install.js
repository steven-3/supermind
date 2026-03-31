'use strict';

const fs = require('fs');
const { PATHS, ensureDir } = require('../lib/platform');
const logger = require('../lib/logger');
const { readSettings, writeSettings, backupSettings, mergeSettings } = require('../lib/settings');
const { installHooks, getHookSettings } = require('../lib/hooks');
const { installSkills, removeLegacySkills, installAgents } = require('../lib/skills');
const { setupMcp } = require('../lib/mcp');
const { installTemplates } = require('../lib/templates');
const { installPlugin } = require('../lib/plugin');
const { version } = require('../../package.json');

module.exports = async function install(flags) {
  logger.banner();
  const TOTAL = 7;

  // Step 1: Platform setup
  logger.step(1, TOTAL, 'Detecting platform and creating directories...');
  ensureDir(PATHS.claudeHome);
  ensureDir(PATHS.hooksDir);
  ensureDir(PATHS.skillsDir);
  ensureDir(PATHS.agentsDir);
  ensureDir(PATHS.sessionsDir);
  logger.success(`Claude home: ${PATHS.claudeHome}`);

  // Clean up legacy files
  if (fs.existsSync(PATHS.legacyHooksJson)) {
    fs.unlinkSync(PATHS.legacyHooksJson);
    logger.info('Removed legacy hooks.json');
  }

  // Step 2: Settings
  logger.step(2, TOTAL, 'Configuring settings...');
  backupSettings();
  const existing = readSettings();
  const hookSettings = getHookSettings();
  const defaults = {
    ...hookSettings,
    alwaysThinkingEnabled: true,
    effortLevel: 'high',
  };
  let merged = mergeSettings(existing, defaults);
  writeSettings(merged);
  logger.success('Settings merged');

  // Step 3: Hooks
  logger.step(3, TOTAL, 'Installing hooks...');
  const hookFiles = installHooks();
  logger.info(`${hookFiles.length} hooks installed`);

  // Step 4: Skills & agents
  logger.step(4, TOTAL, 'Installing skills and agents...');
  removeLegacySkills();
  const skillDirs = installSkills();
  const agentFiles = installAgents();
  logger.info(`${skillDirs.length} skill directories, ${agentFiles.length} agent definitions installed`);

  // Step 5: MCP servers
  logger.step(5, TOTAL, 'MCP server setup...');
  const mcpConfig = await setupMcp(flags);
  if (mcpConfig.mcpServers) {
    merged = readSettings();
    merged.mcpServers = { ...(merged.mcpServers || {}), ...mcpConfig.mcpServers };
    writeSettings(merged);
  }

  // Step 6: Templates
  logger.step(6, TOTAL, 'Installing templates...');
  installTemplates(mcpConfig.mode);

  // Step 7: Plugin manifest
  logger.step(7, TOTAL, 'Registering plugin...');
  installPlugin();

  // Write version marker
  fs.writeFileSync(PATHS.versionFile, version);

  // Summary
  console.log(`\n${'\x1b[32m'}\u2713 Supermind v${version} installed successfully${'\x1b[0m'}\n`);
  console.log('  Next steps:');
  console.log('    1. Restart Claude Code to activate hooks');
  console.log('    2. In any project, run /supermind-init to set up project docs');
  console.log('    3. Run: npx supermind-claude doctor  to verify installation\n');
};
