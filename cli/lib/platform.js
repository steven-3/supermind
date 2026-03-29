'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

const home = os.homedir();

const PATHS = {
  claudeHome: path.join(home, '.claude'),
  settings: path.join(home, '.claude', 'settings.json'),
  settingsBackup: path.join(home, '.claude', 'settings.json.backup'),
  hooksDir: path.join(home, '.claude', 'hooks'),
  skillsDir: path.join(home, '.claude', 'skills'),
  templatesDir: path.join(home, '.claude', 'templates'),
  sessionsDir: path.join(home, '.claude', 'sessions'),
  versionFile: path.join(home, '.claude', '.supermind-version'),
  legacyHooksJson: path.join(home, '.claude', 'hooks.json'),
  airisDir: path.join(home, '.claude', 'airis'),
  improvementLog: path.join(home, '.claude', 'improvement-log.jsonl'),
  skillsLock: path.join(home, '.claude', 'skills-lock.json'),
  approvedCommands: path.join(home, '.claude', 'supermind-approved.json'),
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// Note: assumes platform.js is at cli/lib/platform.js (two levels deep from package root)
function getPackageRoot() {
  return path.resolve(__dirname, '..', '..');
}

module.exports = { PATHS, ensureDir, getPackageRoot };
