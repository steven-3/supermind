'use strict';

const fs = require('fs');
const { PATHS } = require('../lib/platform');
const logger = require('../lib/logger');
const { readSettings, writeSettings, mergeSettings, backupSettings } = require('../lib/settings');
const { installHooks, getHookSettings } = require('../lib/hooks');
const { installSkills, removeLegacySkills, installAgents } = require('../lib/skills');
const { installTemplates } = require('../lib/templates');
const { detectMcpMode } = require('../lib/mcp');
const { installPlugin } = require('../lib/plugin');
const { version } = require('../../package.json');

module.exports = function update(flags) {
  logger.banner();

  // Version comparison
  let installedVersion = 'unknown';
  try { installedVersion = fs.readFileSync(PATHS.versionFile, 'utf-8').trim(); } catch {}

  if (installedVersion === version) {
    logger.info(`Already at v${version}, refreshing files...`);
  } else {
    logger.info(`Updating from v${installedVersion} to v${version}...`);
  }

  const TOTAL = 6;

  // Step 1: Hooks
  logger.step(1, TOTAL, 'Updating hooks...');
  installHooks();

  // Step 2: Hook settings (re-merge to pick up any new hooks)
  logger.step(2, TOTAL, 'Updating settings...');
  backupSettings();
  const existing = readSettings();
  const hookSettings = getHookSettings();
  const merged = mergeSettings(existing, hookSettings);
  writeSettings(merged);
  logger.success('Hook settings refreshed');

  // Step 3: Skills & agents
  logger.step(3, TOTAL, 'Updating skills and agents...');
  removeLegacySkills();
  installSkills();
  installAgents();

  // Step 4: Templates
  logger.step(4, TOTAL, 'Updating templates...');
  installTemplates(detectMcpMode());

  // Step 5: Plugin manifest
  logger.step(5, TOTAL, 'Updating plugin manifest...');
  installPlugin();

  // Step 6: Vendor skills check
  logger.step(6, TOTAL, 'Checking vendor skills...');
  try {
    const vendorSkills = require('../lib/vendor-skills');
    const globalLock = vendorSkills.readLockFile('global');
    const skillCount = Object.keys(globalLock.skills || {}).length;
    if (skillCount > 0) {
      logger.info(`${skillCount} vendor skill(s) tracked (run 'supermind skill update --all' to refresh)`);
    } else {
      logger.info('No vendor skills installed');
    }
  } catch {
    logger.info('Vendor skill check skipped');
  }

  // Write version marker
  fs.writeFileSync(PATHS.versionFile, version);

  console.log(`\n${'\x1b[32m'}\u2713 Supermind updated to v${version}${'\x1b[0m'}\n`);
};
