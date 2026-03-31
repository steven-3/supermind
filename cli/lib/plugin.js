'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS, ensureDir, getPackageRoot } = require('./platform');
const logger = require('./logger');
const { version } = require('../../package.json');

const PLUGIN_NAME = 'supermind';
const PLUGIN_MARKETPLACE = 'local';
const PLUGIN_KEY = `${PLUGIN_NAME}@${PLUGIN_MARKETPLACE}`;

function getPluginsDir() {
  return path.join(PATHS.claudeHome, 'plugins');
}

function getPluginCacheBase() {
  return path.join(getPluginsDir(), 'cache', PLUGIN_MARKETPLACE, PLUGIN_NAME);
}

function getPluginCacheDir() {
  return path.join(getPluginCacheBase(), version);
}

function getInstalledPluginsPath() {
  return path.join(getPluginsDir(), 'installed_plugins.json');
}

function readInstalledPlugins() {
  const filePath = getInstalledPluginsPath();
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return { version: 2, plugins: {} };
  }
}

function writeInstalledPlugins(data) {
  const filePath = getInstalledPluginsPath();
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// Build plugin.json with the current version from package.json.
// The template .claude-plugin/plugin.json uses a placeholder version
// that is always overridden here with the actual package.json version.
function buildPluginManifest() {
  const templatePath = path.join(getPackageRoot(), '.claude-plugin', 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
  manifest.version = version;
  return manifest;
}

// Remove stale version directories from the plugin cache, keeping only the current version.
function cleanOldVersions() {
  const cacheBase = getPluginCacheBase();
  if (!fs.existsSync(cacheBase)) return;
  for (const entry of fs.readdirSync(cacheBase)) {
    if (entry !== version) {
      const stale = path.join(cacheBase, entry);
      try {
        fs.rmSync(stale, { recursive: true, force: true });
      } catch { /* non-critical cleanup */ }
    }
  }
}

// Register Supermind as a Claude Code plugin.
// This is a forward-looking registration stub — Supermind's skills, hooks, and agents
// are delivered through the traditional ~/.claude/ installation paths, not through the
// plugin cache. The registration enables future marketplace discovery and `/plugin update`
// support when Claude Code adds npm-based plugin sources.
function installPlugin() {
  const cacheDir = getPluginCacheDir();
  ensureDir(cacheDir);

  // Write plugin manifest to cache
  const pluginDir = path.join(cacheDir, '.claude-plugin');
  ensureDir(pluginDir);
  const manifest = buildPluginManifest();
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');

  // Clean up old version directories
  cleanOldVersions();

  // Register in installed_plugins.json
  const registry = readInstalledPlugins();
  const now = new Date().toISOString();
  const entry = {
    scope: 'user',
    installPath: cacheDir,
    version: version,
    installedAt: now,
    lastUpdated: now,
  };

  // Preserve original installedAt on re-install
  const existing = registry.plugins[PLUGIN_KEY];
  if (existing && Array.isArray(existing) && existing.length > 0) {
    entry.installedAt = existing[0].installedAt || now;
  }

  registry.plugins[PLUGIN_KEY] = [entry];
  writeInstalledPlugins(registry);

  logger.success(`Plugin registered as ${PLUGIN_KEY}`);
}

// Remove plugin registration and cached files
function removePlugin() {
  // Remove from installed_plugins.json
  const registry = readInstalledPlugins();
  if (registry.plugins[PLUGIN_KEY]) {
    delete registry.plugins[PLUGIN_KEY];
    writeInstalledPlugins(registry);
    logger.success('Plugin registration removed');
  }

  // Remove cached plugin directory
  const cacheBase = getPluginCacheBase();
  if (fs.existsSync(cacheBase)) {
    fs.rmSync(cacheBase, { recursive: true, force: true });
    logger.success('Plugin cache removed');
  }
}

module.exports = { installPlugin, removePlugin, PLUGIN_NAME, PLUGIN_KEY };
