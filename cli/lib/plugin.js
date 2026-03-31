'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS, ensureDir, getPackageRoot } = require('./platform');
const logger = require('./logger');
const { version } = require('../../package.json');

const PLUGIN_NAME = 'supermind';
const PLUGIN_MARKETPLACE = 'npm';
const PLUGIN_KEY = `${PLUGIN_NAME}@${PLUGIN_MARKETPLACE}`;

function getPluginsDir() {
  return path.join(PATHS.claudeHome, 'plugins');
}

function getPluginCacheDir() {
  return path.join(getPluginsDir(), 'cache', PLUGIN_MARKETPLACE, PLUGIN_NAME, version);
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

// Build plugin.json with the current version from package.json
function buildPluginManifest() {
  const templatePath = path.join(getPackageRoot(), '.claude-plugin', 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
  manifest.version = version;
  return manifest;
}

// Copy .claude-plugin/ and essential plugin files to the cache directory
function installPlugin() {
  const cacheDir = getPluginCacheDir();
  ensureDir(cacheDir);

  // Write plugin manifest
  const pluginDir = path.join(cacheDir, '.claude-plugin');
  ensureDir(pluginDir);
  const manifest = buildPluginManifest();
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');

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

  // Check for existing entry to preserve installedAt
  const existing = registry.plugins[PLUGIN_KEY];
  if (existing && Array.isArray(existing) && existing.length > 0) {
    entry.installedAt = existing[0].installedAt || now;
  }

  registry.plugins[PLUGIN_KEY] = [entry];
  writeInstalledPlugins(registry);

  logger.success(`Plugin registered as ${PLUGIN_KEY}`);
}

// Update the plugin manifest version and refresh registration
function updatePlugin() {
  installPlugin();
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
  const cacheBase = path.join(getPluginsDir(), 'cache', PLUGIN_MARKETPLACE, PLUGIN_NAME);
  if (fs.existsSync(cacheBase)) {
    fs.rmSync(cacheBase, { recursive: true, force: true });
    logger.success('Plugin cache removed');
  }
}

module.exports = { installPlugin, updatePlugin, removePlugin, PLUGIN_NAME, PLUGIN_KEY };
