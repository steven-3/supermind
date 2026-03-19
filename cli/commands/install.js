'use strict';

const fs = require('fs');
const { PATHS, ensureDir } = require('../lib/platform');
const logger = require('../lib/logger');
const { readSettings, writeSettings, backupSettings, mergeSettings } = require('../lib/settings');
const { installHooks, getHookSettings } = require('../lib/hooks');
const { installSkills, removeLegacySkills } = require('../lib/skills');
const { getPluginDefaults } = require('../lib/plugins');
const { setupMcp } = require('../lib/mcp');
const { installTemplates } = require('../lib/templates');
const { version } = require('../../package.json');

module.exports = async function install(flags) {
  logger.banner();
  const TOTAL = 7;

  // Step 1: Platform setup
  logger.step(1, TOTAL, 'Detecting platform and creating directories...');
  ensureDir(PATHS.claudeHome);
  ensureDir(PATHS.hooksDir);
  ensureDir(PATHS.skillsDir);
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
  const pluginDefaults = getPluginDefaults();
  const defaults = {
    ...hookSettings,
    ...pluginDefaults,
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

  // Step 4: Skills
  logger.step(4, TOTAL, 'Installing skills...');
  removeLegacySkills();
  const skillDirs = installSkills();
  logger.info(`${skillDirs.length} skill directories installed`);

  // Step 5: Plugins (data already merged in Step 2 via getPluginDefaults — this step is log-only)
  logger.step(5, TOTAL, 'Enabling plugins...');
  const pluginNames = Object.keys(pluginDefaults.enabledPlugins).map(k => k.split('@')[0]);
  logger.success(pluginNames.join(', '));

  // Step 6: MCP servers
  logger.step(6, TOTAL, 'MCP server setup...');
  const mcpConfig = await setupMcp(flags);
  if (mcpConfig.mcpServers) {
    merged = readSettings();
    merged.mcpServers = { ...(merged.mcpServers || {}), ...mcpConfig.mcpServers };
    writeSettings(merged);
  }

  // Step 7: Templates
  logger.step(7, TOTAL, 'Installing templates...');
  installTemplates(mcpConfig.mode);

  // Write version marker
  fs.writeFileSync(PATHS.versionFile, version);

  // Summary
  console.log(`\n${'\x1b[32m'}\u2713 Supermind v${version} installed successfully${'\x1b[0m'}\n`);
  console.log('  Next steps:');
  console.log('    1. Restart Claude Code to activate plugins');
  console.log('    2. In any project, run /supermind-init to set up project docs');
  console.log('    3. Run: npx supermind-claude doctor  to verify installation\n');
};
