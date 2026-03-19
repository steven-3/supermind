'use strict';

const fs = require('fs');
const { PATHS } = require('../lib/platform');
const logger = require('../lib/logger');
const { readSettings, writeSettings, mergeSettings, backupSettings } = require('../lib/settings');
const { installHooks, getHookSettings } = require('../lib/hooks');
const { installSkills, removeLegacySkills } = require('../lib/skills');
const { installTemplates } = require('../lib/templates');
const { detectMcpMode } = require('../lib/mcp');
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

  const TOTAL = 4;

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

  // Step 3: Skills
  logger.step(3, TOTAL, 'Updating skills...');
  removeLegacySkills();
  installSkills();

  // Step 4: Templates
  logger.step(4, TOTAL, 'Updating templates...');
  installTemplates(detectMcpMode());

  // Write version marker
  fs.writeFileSync(PATHS.versionFile, version);

  console.log(`\n${'\x1b[32m'}\u2713 Supermind updated to v${version}${'\x1b[0m'}\n`);
};
