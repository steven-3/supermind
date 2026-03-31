'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS, getPackageRoot } = require('../lib/platform');
const logger = require('../lib/logger');
const { getHookFiles } = require('../lib/hooks');
const { getSkillDirs, getAgentFiles } = require('../lib/skills');
const { PLUGIN_KEY } = require('../lib/plugin');
const { readSettings } = require('../lib/settings');
const { version } = require('../../package.json');

const { GREEN, RED, BOLD, R } = require('../lib/logger');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function section(title) {
  console.log(`\n  ${BOLD}${title}${R}`);
}

function ok(label) {
  logger.success(label);
  return true;
}

function fail(label, detail) {
  logger.error(`${label}${detail ? ' — ' + detail : ''}`);
  return false;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkNode() {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  return major >= 18
    ? ok(`Node.js v${process.versions.node} (>= 18 required)`)
    : fail(`Node.js v${process.versions.node}`, '>= 18 required');
}

function checkClaudeHome() {
  return fs.existsSync(PATHS.claudeHome)
    ? ok('~/.claude/ directory structure OK')
    : fail('~/.claude/ directory missing');
}

function checkSettings() {
  if (!fs.existsSync(PATHS.settings)) return fail('settings.json missing');
  try {
    JSON.parse(fs.readFileSync(PATHS.settings, 'utf-8'));
    return ok('settings.json valid');
  } catch (err) {
    return fail('settings.json invalid', err.message);
  }
}

// Template
function checkTemplate() {
  return fs.existsSync(path.join(PATHS.templatesDir, 'CLAUDE.md'))
    ? ok('CLAUDE.md template')
    : fail('CLAUDE.md template missing');
}

// Sessions directory writable
function checkSessions() {
  if (!fs.existsSync(PATHS.sessionsDir)) {
    return fail('Sessions directory missing');
  }
  try {
    fs.accessSync(PATHS.sessionsDir, fs.constants.W_OK);
    return ok('Sessions directory writable');
  } catch (err) {
    return fail('Sessions directory not writable', err.message);
  }
}

// Improvement log writable
function checkImprovementLog() {
  try {
    fs.appendFileSync(PATHS.improvementLog, '', { flag: 'a' });
    return ok('Improvement log writable');
  } catch (err) {
    return fail('Improvement log not writable', err.message);
  }
}

// Skills: verify all methodology skills installed with SKILL.md
function checkSkills() {
  section('Skills');
  let expectedDirs;
  try {
    expectedDirs = getSkillDirs();
  } catch (err) {
    logger.warn(`Could not enumerate skills from package: ${err.message}`);
    expectedDirs = [
      'supermind', 'quick', 'project', 'brainstorming', 'tdd',
      'systematic-debugging', 'anti-rationalization', 'verification-before-completion',
      'code-review', 'writing-plans', 'executing-plans', 'finishing-branches',
      'using-git-worktrees', 'supermind-init', 'supermind-living-docs',
    ];
  }

  const missing = [];
  for (const dir of expectedDirs) {
    const skillPath = path.join(PATHS.skillsDir, dir);
    const hasDir = fs.existsSync(skillPath);
    const hasSkillMd = hasDir && fs.existsSync(path.join(skillPath, 'SKILL.md'));
    if (!hasDir || !hasSkillMd) missing.push(dir);
  }

  const installed = expectedDirs.length - missing.length;
  if (missing.length === 0) {
    ok(`${installed}/${expectedDirs.length} skills installed`);
    return true;
  }
  fail(`${installed}/${expectedDirs.length} skills installed — missing: ${missing.join(', ')}`);
  return false;
}

// Agents: verify agent definitions exist
function checkAgents() {
  section('Agents');
  let expectedFiles;
  try {
    expectedFiles = getAgentFiles();
  } catch (err) {
    logger.warn(`Could not enumerate agents from package: ${err.message}`);
    expectedFiles = ['code-reviewer.md'];
  }

  const missing = [];
  for (const file of expectedFiles) {
    if (!fs.existsSync(path.join(PATHS.agentsDir, file))) missing.push(file);
  }

  const installed = expectedFiles.length - missing.length;
  if (missing.length === 0) {
    ok(`${installed}/${expectedFiles.length} agents installed`);
    return true;
  }
  fail(`${installed}/${expectedFiles.length} agents installed — missing: ${missing.join(', ')}`);
  return false;
}

// Hooks: verify all 8 hooks exist and are registered in settings.json
function checkHooks() {
  section('Hooks');
  let expectedFiles;
  try {
    expectedFiles = getHookFiles();
  } catch (err) {
    logger.warn(`Could not enumerate hooks from package: ${err.message}`);
    expectedFiles = [
      'bash-permissions.js', 'session-start.js', 'session-end.js',
      'cost-tracker.js', 'statusline-command.js', 'context-monitor.js',
      'pre-merge-checklist.js', 'improvement-logger.js',
    ];
  }

  // Check files on disk
  const missingFiles = [];
  for (const file of expectedFiles) {
    if (!fs.existsSync(path.join(PATHS.hooksDir, file))) missingFiles.push(file);
  }

  // Check registration in settings.json
  const settings = readSettings();
  if (!settings || Object.keys(settings).length === 0) {
    if (missingFiles.length > 0) {
      fail(`Hooks — missing files: ${missingFiles.join(', ')}`);
    } else {
      ok(`${expectedFiles.length}/${expectedFiles.length} hooks installed`);
    }
    logger.warn('Hook registration check skipped — settings.json empty or unreadable');
    return missingFiles.length === 0;
  }
  const settingsJson = JSON.stringify(settings);
  const unregistered = [];
  for (const file of expectedFiles) {
    // statusline-command.js is registered under statusLine, not hooks
    if (file === 'statusline-command.js') {
      if (!settings.statusLine || !JSON.stringify(settings.statusLine).includes(file)) {
        unregistered.push(file);
      }
    } else if (!settingsJson.includes(file)) {
      unregistered.push(file);
    }
  }

  const fileOk = missingFiles.length === 0;
  const regOk = unregistered.length === 0;
  const total = expectedFiles.length;

  if (fileOk && regOk) {
    ok(`${total}/${total} hooks installed and registered`);
    return true;
  }
  const issues = [];
  if (!fileOk) issues.push(`missing files: ${missingFiles.join(', ')}`);
  if (!regOk) issues.push(`not registered: ${unregistered.join(', ')}`);
  fail(`Hooks — ${issues.join('; ')}`);
  return false;
}

// Context monitor: verify hook exists, optionally check metrics file
function checkContextMonitor() {
  section('Context monitor');
  const hookExists = fs.existsSync(path.join(PATHS.hooksDir, 'context-monitor.js'));
  if (!hookExists) {
    fail('context-monitor.js hook missing');
    return false;
  }

  const metricsPath = path.join(PATHS.claudeHome, 'context-metrics.json');
  if (fs.existsSync(metricsPath)) {
    ok('active (metrics file present)');
  } else {
    ok('installed (metrics written during active sessions)');
  }
  return true;
}

// Plugin manifest: verify registration and cached manifest
function checkPlugin() {
  section('Plugin manifest');

  const pluginsPath = path.join(PATHS.claudeHome, 'plugins', 'installed_plugins.json');
  if (!fs.existsSync(pluginsPath)) {
    return fail('not registered — installed_plugins.json missing');
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(pluginsPath, 'utf-8'));
  } catch (err) {
    return fail('installed_plugins.json invalid', err.message);
  }

  const entry = registry.plugins && registry.plugins[PLUGIN_KEY];
  if (!entry || !Array.isArray(entry) || entry.length === 0) {
    return fail('not registered in installed_plugins.json');
  }

  const installPath = entry[0].installPath;
  if (!installPath) {
    return fail('plugin registry entry missing installPath');
  }

  const manifestPath = path.join(installPath, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(manifestPath)) {
    return fail('manifest missing from cache');
  }

  try {
    JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return ok('valid');
  } catch (err) {
    return fail('plugin.json manifest invalid', err.message);
  }
}

// Executor engine: verify core modules exist in package
function checkExecutorEngine() {
  section('Executor engine');
  const root = getPackageRoot();
  const modules = ['cli/lib/executor.js', 'cli/lib/agents.js', 'cli/lib/planning.js'];
  const missing = modules.filter(m => !fs.existsSync(path.join(root, m)));

  if (missing.length === 0) {
    return ok('modules present');
  }
  return fail(`missing: ${missing.join(', ')}`);
}

// Safety layer: verify blocklist model
function checkSafety() {
  section('Safety layer');
  const hookPath = path.join(PATHS.hooksDir, 'bash-permissions.js');
  if (!fs.existsSync(hookPath)) {
    return fail('bash-permissions.js not found');
  }

  let content;
  try {
    content = fs.readFileSync(hookPath, 'utf-8');
  } catch (err) {
    return fail('bash-permissions.js unreadable', err.message);
  }

  const blocklist = content.includes('BLOCKED') || content.includes('blocklist');
  if (!blocklist) {
    return fail('bash-permissions.js does not use blocklist model');
  }

  return ok('blocklist model');
}

// .planning/ check: project-specific, not an error if absent
function checkPlanning() {
  section('Planning');
  const projectDir = process.env.PROJECT_DIR || process.cwd();
  const planningDir = path.join(projectDir, '.planning');

  if (!fs.existsSync(planningDir)) {
    return ok('no active session');
  }

  let allOk = true;

  // Verify roadmap.md — read once, reuse for active phase detection
  const roadmapPath = path.join(planningDir, 'roadmap.md');
  let roadmapContent = null;
  if (fs.existsSync(roadmapPath)) {
    try {
      roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
      ok('roadmap.md present');
    } catch (err) {
      fail('roadmap.md unreadable', err.message);
      allOk = false;
    }
  } else {
    fail('roadmap.md missing from .planning/');
    allOk = false;
  }

  // Verify config.json
  const configPath = path.join(planningDir, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      ok('config.json valid');
    } catch (err) {
      fail('config.json invalid', err.message);
      allOk = false;
    }
  } else {
    fail('config.json missing from .planning/');
    allOk = false;
  }

  // Report active phase if detectable
  if (roadmapContent) {
    const activeMatch = roadmapContent.match(/\|\s*(\d+)\s*\|[^|]*\|\s*(?:in.progress|active|executing)/i);
    if (activeMatch) {
      logger.info(`Active phase: ${activeMatch[1]}`);
    }
  }

  return allOk;
}

// Version marker
function checkVersion() {
  section('Version');
  let installedVersion = 'not found';
  try {
    installedVersion = fs.readFileSync(PATHS.versionFile, 'utf-8').trim();
  } catch (err) {
    if (err.code !== 'ENOENT') installedVersion = `error: ${err.message}`;
  }

  if (installedVersion === version) {
    return ok(`v${version}`);
  }
  return fail(`Version mismatch — installed: ${installedVersion}, package: ${version}`);
}

// Vendor skills (optional, returns failure count)
function checkVendorSkills() {
  let vendorSkills;
  try {
    vendorSkills = require('../lib/vendor-skills');
  } catch {
    return 0; // Module not available — no vendor skills to check
  }

  try {
    const result = vendorSkills.verifySkills();
    if (result.valid.length === 0 && result.missing.length === 0) return 0;
    section('Vendor skills');
    let failures = 0;
    for (const name of result.valid) { ok(name); }
    for (const name of result.missing) { fail(name, 'directory not found'); failures++; }
    return failures;
  } catch (err) {
    section('Vendor skills');
    fail('Vendor skill verification failed', err.message);
    return 1;
  }
}

// Docker (optional, warn only)
function checkDocker() {
  try {
    // Static command, no user input — safe to use execSync
    require('child_process').execSync('docker compose version', { stdio: 'pipe', timeout: 5000 });
    ok('Docker available');
  } catch {
    logger.warn('Docker not available (optional — needed for AIRIS mode)');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

module.exports = function doctor(flags) {
  logger.banner();
  console.log('  Running health checks...');

  let failed = 0;
  const run = (fn) => {
    try {
      if (!fn()) failed++;
    } catch (err) {
      fail(`${fn.name || 'check'} crashed`, err.message);
      failed++;
    }
  };

  // Foundation
  run(checkNode);
  run(checkClaudeHome);
  run(checkSettings);
  run(checkTemplate);
  run(checkSessions);
  run(checkImprovementLog);

  // Components
  run(checkSkills);
  run(checkAgents);
  run(checkHooks);

  // Subsystems
  run(checkContextMonitor);
  run(checkPlugin);
  run(checkExecutorEngine);
  run(checkSafety);

  // Project-specific
  run(checkPlanning);

  // Version
  run(checkVersion);

  // Optional (don't count as failures for overall health)
  failed += checkVendorSkills();
  checkDocker();

  // Overall
  console.log('');
  if (failed === 0) {
    console.log(`  ${GREEN}${BOLD}Overall: healthy ✓${R}\n`);
  } else {
    console.log(`  ${RED}${BOLD}Overall: ${failed} issue${failed === 1 ? '' : 's'} found${R}\n`);
    process.exit(1);
  }
};
