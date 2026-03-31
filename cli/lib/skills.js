'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS, ensureDir, getPackageRoot } = require('./platform');
const logger = require('./logger');

function getSkillDirs() {
  const skillsSource = path.join(getPackageRoot(), 'skills');
  return fs.readdirSync(skillsSource).filter(f =>
    fs.statSync(path.join(skillsSource, f)).isDirectory()
  );
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function installSkills() {
  ensureDir(PATHS.skillsDir);
  const skillsSource = path.join(getPackageRoot(), 'skills');
  const dirs = getSkillDirs();

  for (const dir of dirs) {
    copyDirRecursive(path.join(skillsSource, dir), path.join(PATHS.skillsDir, dir));
    logger.success(dir);
  }
  return dirs;
}

// Fallback list if package source is unavailable
const KNOWN_SKILLS = ['supermind', 'supermind-init', 'supermind-living-docs', 'anti-rationalization', 'verification-before-completion', 'tdd', 'systematic-debugging', 'brainstorming', 'code-review', 'using-git-worktrees'];

function removeSkills() {
  let dirs;
  try { dirs = getSkillDirs(); } catch { dirs = KNOWN_SKILLS; }
  for (const dir of dirs) {
    const target = path.join(PATHS.skillsDir, dir);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      logger.success(`Removed ${dir}`);
    }
  }
}

// Remove legacy skill paths from previous versions
function removeLegacySkills() {
  const legacyPaths = [
    path.join(PATHS.skillsDir, 'supermind', 'init'),
    path.join(PATHS.skillsDir, 'supermind', 'living-docs'),
    path.join(PATHS.skillsDir, 'sm'),
  ];
  for (const p of legacyPaths) {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      logger.info(`Cleaned up legacy path: ${path.basename(p)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Agent definitions — copied to ~/.claude/agents/ on install
// ---------------------------------------------------------------------------

const KNOWN_AGENTS = ['code-reviewer'];

function getAgentFiles() {
  const agentsSource = path.join(getPackageRoot(), 'agents');
  return fs.readdirSync(agentsSource).filter(f =>
    f.endsWith('.md') && fs.statSync(path.join(agentsSource, f)).isFile()
  );
}

function installAgents() {
  ensureDir(PATHS.agentsDir);
  const agentsSource = path.join(getPackageRoot(), 'agents');
  const files = getAgentFiles();

  for (const file of files) {
    fs.copyFileSync(path.join(agentsSource, file), path.join(PATHS.agentsDir, file));
    logger.success(file);
  }
  return files;
}

function removeAgents() {
  let files;
  try { files = getAgentFiles(); } catch { files = KNOWN_AGENTS.map(n => `${n}.md`); }
  for (const file of files) {
    const target = path.join(PATHS.agentsDir, file);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      logger.success(`Removed ${file}`);
    }
  }
}

module.exports = { installSkills, removeSkills, removeLegacySkills, getSkillDirs, installAgents, removeAgents, getAgentFiles };
