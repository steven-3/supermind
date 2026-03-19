'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS } = require('../lib/platform');
const logger = require('../lib/logger');
const { SUPERMIND_PLUGINS } = require('../lib/settings');
const { getHookFiles } = require('../lib/hooks');
const { getSkillDirs } = require('../lib/skills');
const { version } = require('../../package.json');

function check(label, pass, detail) {
  if (pass) {
    logger.success(label);
  } else {
    logger.error(`${label}${detail ? ' \u2014 ' + detail : ''}`);
  }
  return pass;
}

module.exports = function doctor(flags) {
  logger.banner();
  console.log('  Running health checks...\n');

  let passed = 0;
  let failed = 0;

  function run(label, pass, detail) {
    if (check(label, pass, detail)) passed++;
    else failed++;
  }

  // Node.js version
  const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
  run('Node.js >= 18', nodeVersion >= 18, `found v${process.versions.node}`);

  // Claude home
  run('~/.claude/ exists', fs.existsSync(PATHS.claudeHome));

  // Settings
  const settingsExists = fs.existsSync(PATHS.settings);
  run('settings.json exists', settingsExists);

  let settings = {};
  if (settingsExists) {
    try {
      settings = JSON.parse(fs.readFileSync(PATHS.settings, 'utf-8'));
      run('settings.json is valid JSON', true);
    } catch (err) {
      run('settings.json is valid JSON', false, err.message);
    }
  }

  // Hooks present
  let expectedHooks;
  try {
    expectedHooks = getHookFiles();
  } catch (err) {
    run('Hook enumeration', false, err.message);
    expectedHooks = [];
  }
  for (const file of expectedHooks) {
    run(`Hook: ${file}`, fs.existsSync(path.join(PATHS.hooksDir, file)));
  }

  // Skills present
  let expectedSkills;
  try {
    expectedSkills = getSkillDirs();
  } catch (err) {
    run('Skill enumeration', false, err.message);
    expectedSkills = [];
  }
  for (const dir of expectedSkills) {
    const skillPath = path.join(PATHS.skillsDir, dir);
    run(`Skill: ${dir}`, fs.existsSync(skillPath) && fs.existsSync(path.join(skillPath, 'SKILL.md')));
  }

  // Plugins
  if (SUPERMIND_PLUGINS.length === 0) {
    logger.warn('Plugin list unavailable — plugin checks skipped');
  } else {
    for (const id of SUPERMIND_PLUGINS) {
      run(`Plugin: ${id.split('@')[0]}`, settings.enabledPlugins?.[id] === true);
    }
  }

  // Template
  run('CLAUDE.md template', fs.existsSync(path.join(PATHS.templatesDir, 'CLAUDE.md')));

  // Sessions directory
  run('Sessions directory writable', (() => {
    const testFile = path.join(PATHS.sessionsDir, '.doctor-test');
    try {
      fs.writeFileSync(testFile, 'test');
    } catch {
      return false;
    }
    try { fs.unlinkSync(testFile); } catch { /* cleanup non-critical */ }
    return true;
  })());

  // Docker (warn only, not required)
  try {
    require('child_process').execSync('docker compose version', { stdio: 'pipe', timeout: 5000 });
    logger.success('Docker available');
    passed++;
  } catch {
    logger.warn('Docker not available (optional \u2014 needed for AIRIS mode)');
  }

  // Version
  let installedVersion = 'not found';
  try {
    installedVersion = fs.readFileSync(PATHS.versionFile, 'utf-8').trim();
  } catch (err) {
    if (err.code !== 'ENOENT') {
      installedVersion = `error: ${err.message}`;
    }
  }
  run('Version marker', installedVersion === version, installedVersion !== version ? `installed: ${installedVersion}, package: ${version}` : undefined);

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
};
