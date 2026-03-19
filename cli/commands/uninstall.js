'use strict';

const fs = require('fs');
const readline = require('readline');
const { PATHS } = require('../lib/platform');
const logger = require('../lib/logger');
const { readSettings, writeSettings, removeSupermindEntries, backupSettings } = require('../lib/settings');
const { removeHooks } = require('../lib/hooks');
const { removeSkills } = require('../lib/skills');
const { removeTemplates } = require('../lib/templates');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

module.exports = async function uninstall(flags) {
  logger.banner();

  if (!flags.yes && !flags.nonInteractive) {
    const answer = await prompt('  Remove all Supermind components? [y/N]: ');
    if (answer.toLowerCase() !== 'y') {
      console.log('  Cancelled.\n');
      return;
    }
  }

  console.log('');

  // Remove hooks
  console.log('  Removing hooks...');
  removeHooks();

  // Remove skills
  console.log('  Removing skills...');
  removeSkills();

  // Remove templates
  console.log('  Removing templates...');
  removeTemplates();

  // Clean settings
  console.log('  Cleaning settings...');
  backupSettings();
  const settings = readSettings();
  const cleaned = removeSupermindEntries(settings);
  writeSettings(cleaned);
  logger.success('Settings cleaned');

  // Remove version marker
  if (fs.existsSync(PATHS.versionFile)) {
    fs.unlinkSync(PATHS.versionFile);
  }

  // Remove legacy hooks.json
  if (fs.existsSync(PATHS.legacyHooksJson)) {
    fs.unlinkSync(PATHS.legacyHooksJson);
    logger.info('Removed legacy hooks.json');
  }

  // Optional: AIRIS config
  if (fs.existsSync(PATHS.airisDir)) {
    if (flags.yes || flags.nonInteractive) {
      fs.rmSync(PATHS.airisDir, { recursive: true, force: true });
      logger.success('Removed AIRIS config');
    } else {
      const answer = await prompt('  Also remove AIRIS/Docker config? [y/N]: ');
      if (answer.toLowerCase() === 'y') {
        fs.rmSync(PATHS.airisDir, { recursive: true, force: true });
        logger.success('Removed AIRIS config');
      }
    }
  }

  console.log(`\n${'\x1b[32m'}\u2713 Supermind uninstalled${'\x1b[0m'}\n`);
};
