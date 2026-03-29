'use strict';

const fs = require('fs');
const { PATHS } = require('./platform');
const logger = require('./logger');

// Known Supermind hook filenames — used to identify owned entries
const SUPERMIND_HOOKS = [
  'bash-permissions.js', 'session-start.js', 'session-end.js',
  'cost-tracker.js', 'statusline-command.js',
  'pre-merge-checklist.js', 'improvement-logger.js',
];

// Derived from plugins.js — single source of truth for plugin and marketplace IDs.
// Wrapped in try-catch so a plugins.js error doesn't crash doctor/uninstall.
function loadPluginIds() {
  try {
    const { getPluginDefaults } = require('./plugins');
    const defaults = getPluginDefaults();
    return {
      plugins: Object.keys(defaults.enabledPlugins),
      marketplaces: Object.keys(defaults.extraKnownMarketplaces),
    };
  } catch (err) {
    logger.warn(`Could not load plugins.js — plugin checks/cleanup will be skipped (${err.message})`);
    return { plugins: [], marketplaces: [] };
  }
}

const { plugins: SUPERMIND_PLUGINS, marketplaces: SUPERMIND_MARKETPLACES } = loadPluginIds();
// SUPERMIND_MARKETPLACES is used only within this module (for uninstall cleanup) — intentionally not exported

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(PATHS.settings, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    logger.warn(`Failed to read settings.json: ${err.message}`);
    return {};
  }
}

function writeSettings(settings) {
  try {
    fs.writeFileSync(PATHS.settings, JSON.stringify(settings, null, 2) + '\n');
  } catch (err) {
    logger.error(`Could not write settings.json: ${err.message}`);
    throw err;
  }
}

function backupSettings() {
  if (fs.existsSync(PATHS.settings) && !fs.existsSync(PATHS.settingsBackup)) {
    fs.copyFileSync(PATHS.settings, PATHS.settingsBackup);
    logger.info('Backed up existing settings.json');
  }
}

function isSupermindHookEntry(entry) {
  const cmd = entry?.command || '';
  return SUPERMIND_HOOKS.some(h => cmd.includes(h));
}

// Merge hook arrays: keep user entries, upsert Supermind entries by filename match
function mergeHookArray(existing, incoming) {
  const result = (existing || []).filter(e => !isSupermindHookEntry(e));
  for (const entry of incoming) {
    result.push(entry);
  }
  return result;
}

// Merge objects: add missing keys, preserve existing
function mergeObjects(existing, incoming) {
  const result = { ...existing };
  for (const [key, val] of Object.entries(incoming)) {
    if (!(key in result)) result[key] = val;
  }
  return result;
}

// Merge hook event configs: each event has a { matcher?, hooks: [] } structure
function mergeHookEvents(existing, incoming) {
  const result = { ...existing };
  for (const [event, configs] of Object.entries(incoming)) {
    if (!result[event]) {
      result[event] = configs;
      continue;
    }
    // Merge each config entry's hooks array
    const existingConfigs = Array.isArray(result[event]) ? result[event] : [result[event]];
    const incomingConfigs = Array.isArray(configs) ? configs : [configs];

    for (const inConfig of incomingConfigs) {
      const matcher = inConfig.matcher || null;
      const existingIdx = existingConfigs.findIndex(c => (c.matcher || null) === matcher);
      if (existingIdx >= 0) {
        existingConfigs[existingIdx] = {
          ...existingConfigs[existingIdx],
          hooks: mergeHookArray(existingConfigs[existingIdx].hooks, inConfig.hooks),
        };
      } else {
        existingConfigs.push(inConfig);
      }
    }
    result[event] = existingConfigs;
  }
  return result;
}

function mergeSettings(existing, defaults) {
  const result = { ...existing };

  // Scalars: set only if absent
  for (const key of ['alwaysThinkingEnabled', 'effortLevel', 'voiceEnabled', 'skipDangerousModePermissionPrompt']) {
    if (!(key in result) && key in defaults) result[key] = defaults[key];
  }

  // Supermind-owned (always overwrite)
  if (defaults.statusLine) result.statusLine = defaults.statusLine;

  // Objects: recursive merge
  if (defaults.permissions) result.permissions = mergeObjects(result.permissions || {}, defaults.permissions);
  if (defaults.enabledPlugins) result.enabledPlugins = mergeObjects(result.enabledPlugins || {}, defaults.enabledPlugins);
  if (defaults.extraKnownMarketplaces) result.extraKnownMarketplaces = mergeObjects(result.extraKnownMarketplaces || {}, defaults.extraKnownMarketplaces);

  // Hooks: special merge
  if (defaults.hooks) result.hooks = mergeHookEvents(result.hooks || {}, defaults.hooks);

  return result;
}

// Remove Supermind entries from settings (for uninstall)
function removeSupermindEntries(settings) {
  const result = { ...settings };

  // Remove statusLine
  delete result.statusLine;

  // Remove Supermind plugins and marketplace entries
  if (SUPERMIND_PLUGINS.length === 0) {
    logger.warn('Plugin/marketplace list unavailable — these entries were NOT removed from settings. ' +
      'You may need to manually edit ~/.claude/settings.json');
  } else {
    if (result.enabledPlugins) {
      for (const id of SUPERMIND_PLUGINS) {
        delete result.enabledPlugins[id];
      }
    }
    if (result.extraKnownMarketplaces) {
      for (const id of SUPERMIND_MARKETPLACES) {
        delete result.extraKnownMarketplaces[id];
      }
    }
  }

  // Remove Supermind hooks from each event
  if (result.hooks) {
    for (const [event, configs] of Object.entries(result.hooks)) {
      const configArr = Array.isArray(configs) ? configs : [configs];
      for (const config of configArr) {
        if (config.hooks) {
          config.hooks = config.hooks.filter(h => !isSupermindHookEntry(h));
        }
      }
      // Clean up empty configs
      result.hooks[event] = configArr.filter(c => c.hooks?.length > 0);
      if (result.hooks[event].length === 0) delete result.hooks[event];
    }
    if (Object.keys(result.hooks).length === 0) delete result.hooks;
  }

  // Note: do NOT delete scalars like alwaysThinkingEnabled/effortLevel —
  // the user may have set these independently. Supermind only sets them if absent.

  return result;
}

module.exports = {
  readSettings, writeSettings, backupSettings,
  mergeSettings, removeSupermindEntries,
  SUPERMIND_HOOKS, SUPERMIND_PLUGINS,
};
