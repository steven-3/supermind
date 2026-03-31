'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { PATHS } = require('../lib/platform');
const logger = require('../lib/logger');
const { readSettings, writeSettings, removeSupermindEntries, backupSettings } = require('../lib/settings');
const { removeHooks } = require('../lib/hooks');
const { removeSkills, removeAgents } = require('../lib/skills');
const { removeTemplates } = require('../lib/templates');
const { removePlugin } = require('../lib/plugin');

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

  // Remove skills and agents
  console.log('  Removing skills and agents...');
  removeSkills();
  removeAgents();

  // Remove templates
  console.log('  Removing templates...');
  removeTemplates();

  // Remove plugin registration
  console.log('  Removing plugin registration...');
  removePlugin();

  // Clean settings
  console.log('  Cleaning settings...');
  backupSettings();
  const settings = readSettings();
  const cleaned = removeSupermindEntries(settings);
  writeSettings(cleaned);
  logger.success('Settings cleaned');

  // Remove vendor skills lock file
  const skillsLockPath = path.join(PATHS.claudeHome, 'skills-lock.json');
  if (fs.existsSync(skillsLockPath)) {
    fs.unlinkSync(skillsLockPath);
    logger.success('Removed vendor skills lock file');
  }

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

  // Optional: Improvement log
  const improvementLog = path.join(PATHS.claudeHome, 'improvement-log.jsonl');
  if (fs.existsSync(improvementLog)) {
    if (flags.yes || flags.nonInteractive) {
      fs.unlinkSync(improvementLog);
      logger.success('Removed improvement log');
    } else {
      const answer = await prompt('  Also remove improvement log? [y/N]: ');
      if (answer.toLowerCase() === 'y') {
        fs.unlinkSync(improvementLog);
        logger.success('Removed improvement log');
      }
    }
  }

  console.log(`\n${'\x1b[32m'}\u2713 Supermind uninstalled${'\x1b[0m'}\n`);
};
