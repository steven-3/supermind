'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS, ensureDir, getPackageRoot } = require('./platform');
const logger = require('./logger');

function getHookFiles() {
  const hooksSource = path.join(getPackageRoot(), 'hooks');
  return fs.readdirSync(hooksSource).filter(f => f.endsWith('.js'));
}

function installHooks() {
  ensureDir(PATHS.hooksDir);
  const hooksSource = path.join(getPackageRoot(), 'hooks');
  const files = getHookFiles();

  for (const file of files) {
    fs.copyFileSync(path.join(hooksSource, file), path.join(PATHS.hooksDir, file));
    logger.success(file);
  }
  return files;
}

function getHookSettings() {
  const hooksDir = PATHS.hooksDir;
  return {
    hooks: {
      PreToolUse: [{
        matcher: 'Bash',
        hooks: [{ type: 'command', command: `node "${path.join(hooksDir, 'bash-permissions.js')}"`, timeout: 5 }],
      }],
      SessionStart: [{
        hooks: [{ type: 'command', command: `node "${path.join(hooksDir, 'session-start.js')}"`, statusMessage: 'Loading session context...' }],
      }],
      Stop: [{
        hooks: [
          { type: 'command', command: `node "${path.join(hooksDir, 'session-end.js')}"`, async: true },
          { type: 'command', command: `node "${path.join(hooksDir, 'cost-tracker.js')}"`, async: true },
        ],
      }],
    },
    statusLine: {
      type: 'command',
      command: `node "${path.join(hooksDir, 'statusline-command.js')}"`,
    },
  };
}

// Fallback list if package source is unavailable
const KNOWN_HOOKS = ['bash-permissions.js', 'session-start.js', 'session-end.js', 'cost-tracker.js', 'statusline-command.js'];

function removeHooks() {
  if (!fs.existsSync(PATHS.hooksDir)) return;
  let files;
  try { files = getHookFiles(); } catch { files = KNOWN_HOOKS; }
  for (const file of files) {
    const target = path.join(PATHS.hooksDir, file);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      logger.success(`Removed ${file}`);
    }
  }
}

module.exports = { installHooks, getHookSettings, removeHooks, getHookFiles };
