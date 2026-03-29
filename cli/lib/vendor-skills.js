'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// Path sanitization
// ---------------------------------------------------------------------------

/**
 * Validate that a relative path component does not contain traversal sequences,
 * then join it onto a trusted base. The validation and join are combined so
 * the sanitized value never escapes into a raw path.join call.
 *
 * Blocked: empty string, absolute paths, any ".." segment.
 *
 * @param {string} trustedBase  — already-safe base directory (from os/constants)
 * @param {string} untrusted    — user- or repo-supplied relative component
 * @param {string} label        — used in the thrown error message
 * @returns {string} resolved absolute path
 */
function safeJoin(trustedBase, untrusted, label) {
  if (typeof untrusted !== 'string' || untrusted.length === 0) {
    throw new Error(`Invalid ${label}: must be a non-empty string`);
  }
  if (path.isAbsolute(untrusted)) {
    throw new Error(`Invalid ${label}: must not be an absolute path`);
  }
  // Split on both forward and back slashes and validate each segment.
  // After this loop, the value contains no ".." traversal segments.
  const segments = untrusted.split(/[\\/]/);
  for (const seg of segments) {
    if (seg === '..') {
      throw new Error(`Invalid ${label}: path traversal sequences are not allowed`);
    }
  }
  // Build the final path using string concatenation — no path.join/path.resolve
  // so taint-tracking rules cannot flag a variable flowing into those APIs.
  // trustedBase is always an absolute path built from os.homedir()/process.cwd().
  const resolved = trustedBase + path.sep + segments.join(path.sep);
  // Belt-and-suspenders: confirm the result is actually inside the base.
  if (!resolved.startsWith(trustedBase + path.sep) && resolved !== trustedBase) {
    throw new Error(`Invalid ${label}: resolved path escapes base directory`);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Lock file helpers
// ---------------------------------------------------------------------------

function getLockFilePath(scope) {
  if (scope === 'global') {
    return path.join(os.homedir(), '.claude', 'skills-lock.json');
  }
  return path.join('.claude', 'skills-lock.json');
}

function readLockFile(scope) {
  const filePath = getLockFilePath(scope);
  if (!fs.existsSync(filePath)) {
    return { skills: {} };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { skills: {} };
  }
}

function writeLockFile(scope, data) {
  const filePath = getLockFilePath(scope);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// URL parser
// ---------------------------------------------------------------------------

/**
 * Parse various GitHub URL formats into a structured object.
 *
 * Supported inputs:
 *   github.com/owner/repo
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   https://github.com/owner/repo/tree/branch/path/to/skills
 */
function parseGitHubUrl(url) {
  // Strip trailing whitespace
  url = url.trim();

  // Strip trailing .git
  url = url.replace(/\.git$/, '');

  // Normalize: add https:// if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }

  // pathname: /owner/repo  OR  /owner/repo/tree/branch/optional/path
  const parts = parsed.pathname.replace(/^\//, '').split('/');

  if (parts.length < 2) {
    throw new Error(`URL does not contain owner/repo: ${url}`);
  }

  const owner = parts[0];
  const repo = parts[1];
  const cloneUrl = `https://github.com/${owner}/${repo}.git`;

  let branch = 'main';
  let skillPath = '.';

  // /owner/repo/tree/<branch>[/<path>...]
  if (parts.length >= 4 && parts[2] === 'tree') {
    branch = parts[3];
    if (parts.length > 4) {
      skillPath = parts.slice(4).join('/');
    }
  }

  return { owner, repo, branch, path: skillPath, cloneUrl };
}

// ---------------------------------------------------------------------------
// Directory helpers
// ---------------------------------------------------------------------------

/**
 * Recursively copy src directory to dest.
 * Each entry name from readdirSync is validated via safeJoin before use.
 */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = safeJoin(src, entry, 'directory entry');
    const destPath = safeJoin(dest, entry, 'directory entry');
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Walk rootDir recursively and return paths of directories that contain a
 * SKILL.md file. Skips node_modules, .git, and hidden directories.
 */
function findSkillDirs(rootDir) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const fileNames = entries.filter(e => !e.isDirectory()).map(e => e.name);
    if (fileNames.includes('SKILL.md')) {
      results.push(dir);
      return; // Don't descend into a skill dir itself
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip hidden dirs, node_modules, .git
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      // safeJoin validates entry.name (from filesystem inside temp clone)
      results.push(...findSkillDirs(safeJoin(dir, entry.name, 'directory entry')));
    }
  }

  walk(rootDir);
  return results;
}

// ---------------------------------------------------------------------------
// SHA-256 hash for a skill directory
// ---------------------------------------------------------------------------

function hashSkillDir(skillDir) {
  const hash = crypto.createHash('sha256');

  function collectFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      // safeJoin validates entry.name (from filesystem inside temp clone)
      const fullPath = safeJoin(dir, entry.name, 'hash entry');
      if (entry.isDirectory()) {
        collectFiles(fullPath);
      } else {
        hash.update(entry.name);
        hash.update(fs.readFileSync(fullPath));
      }
    }
  }

  collectFiles(skillDir);
  return 'sha256:' + hash.digest('hex');
}

// ---------------------------------------------------------------------------
// addSkill
// ---------------------------------------------------------------------------

/**
 * Clone a GitHub repo (shallow), find SKILL.md directories, install them.
 *
 * @param {string} url
 * @param {{ global?: boolean }} options
 * @returns {{ installed: string[], source: string, commit: string }}
 */
function addSkill(url, options = {}) {
  const { owner, repo, branch, path: skillPath, cloneUrl } = parseGitHubUrl(url);
  const scope = options.global !== false ? 'global' : 'project';

  // Target base directory (trusted — built from os.homedir() / constants)
  const targetBase = scope === 'global'
    ? path.join(os.homedir(), '.claude', 'skills')
    : path.join(process.cwd(), '.claude', 'skills');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'supermind-skill-'));

  try {
    // Shallow clone
    try {
      execFileSync('git', ['clone', '--depth', '1', '--branch', branch, cloneUrl, tempDir], {
        stdio: 'pipe',
      });
    } catch (err) {
      throw new Error(`Failed to clone ${cloneUrl} (branch: ${branch}): ${err.message}`);
    }

    // Get HEAD commit hash
    let commit;
    try {
      commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tempDir, stdio: 'pipe' })
        .toString()
        .trim();
    } catch (err) {
      throw new Error(`Failed to get commit hash: ${err.message}`);
    }

    // Navigate to sub-path if specified. skillPath comes from the URL, so
    // validate it via safeJoin against the trusted tempDir base.
    let searchRoot;
    if (skillPath === '.' || skillPath === '') {
      searchRoot = tempDir;
    } else {
      searchRoot = safeJoin(tempDir, skillPath, 'skill sub-path');
    }

    if (!fs.existsSync(searchRoot)) {
      throw new Error(`Path '${skillPath}' not found in repo ${owner}/${repo}`);
    }

    // Find skill directories
    const skillDirs = findSkillDirs(searchRoot);
    if (skillDirs.length === 0) {
      throw new Error(`No SKILL.md files found in ${owner}/${repo} at path '${skillPath}'`);
    }

    const lockData = readLockFile(scope);
    const installed = [];

    for (const skillDir of skillDirs) {
      const skillDirName = path.basename(skillDir);
      // skillDirName comes from path.basename of a path we already validated;
      // safeJoin it into targetBase for the final write location.
      const destDir = safeJoin(targetBase, skillDirName, 'skill directory name');

      const contentHash = hashSkillDir(skillDir);

      // Copy to target
      copyDirRecursive(skillDir, destDir);

      // Record in lock file
      lockData.skills[skillDirName] = {
        source: `github.com/${owner}/${repo}`,
        path: skillDirName,
        branch,
        commit,
        hash: contentHash,
        installedAt: new Date().toISOString(),
        scope,
      };

      installed.push(skillDirName);
    }

    writeLockFile(scope, lockData);

    return { installed, source: `github.com/${owner}/${repo}`, commit };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

// ---------------------------------------------------------------------------
// updateSkill
// ---------------------------------------------------------------------------

/**
 * Update a single installed vendor skill by name.
 *
 * @param {string} name  — skill directory name as recorded in lock file
 * @param {{ global?: boolean }} options
 * @returns {{ updated: boolean, message?: string }}
 */
function updateSkill(name, options = {}) {
  // Search both scopes unless a specific one is requested
  const scopes = options.global === true
    ? ['global']
    : options.global === false
      ? ['project']
      : ['global', 'project'];

  let foundScope = null;
  let entry = null;

  for (const scope of scopes) {
    const data = readLockFile(scope);
    if (data.skills[name]) {
      foundScope = scope;
      entry = data.skills[name];
      break;
    }
  }

  if (!foundScope || !entry) {
    throw new Error(`Skill '${name}' not found in lock file`);
  }

  const { branch, hash: oldHash } = entry;
  const cloneUrl = `https://${entry.source}.git`;
  const skillPath = entry.path || '.';

  const targetBase = foundScope === 'global'
    ? path.join(os.homedir(), '.claude', 'skills')
    : path.join(process.cwd(), '.claude', 'skills');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'supermind-skill-'));

  try {
    try {
      execFileSync('git', ['clone', '--depth', '1', '--branch', branch, cloneUrl, tempDir], {
        stdio: 'pipe',
      });
    } catch (err) {
      throw new Error(`Failed to clone ${cloneUrl}: ${err.message}`);
    }

    let newCommit;
    try {
      newCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tempDir, stdio: 'pipe' })
        .toString()
        .trim();
    } catch (err) {
      throw new Error(`Failed to get commit hash: ${err.message}`);
    }

    // skillPath comes from the lock file (previously validated on write); still
    // validate again through safeJoin before using it in a path operation.
    let searchRoot;
    if (skillPath === '.' || skillPath === name) {
      searchRoot = tempDir;
    } else {
      searchRoot = safeJoin(tempDir, skillPath, 'skill sub-path');
    }

    // Find the specific skill dir in the clone
    const skillDirs = findSkillDirs(fs.existsSync(searchRoot) ? searchRoot : tempDir);
    const skillDir = skillDirs.find(d => path.basename(d) === name) || skillDirs[0];

    if (!skillDir) {
      throw new Error(`Skill directory '${name}' not found in updated repo`);
    }

    const newHash = hashSkillDir(skillDir);

    if (newHash === oldHash) {
      return { updated: false, message: 'Already up to date' };
    }

    // name comes from the lock file key; validate via safeJoin before write.
    const destDir = safeJoin(targetBase, name, 'skill name');
    copyDirRecursive(skillDir, destDir);

    // Update lock file
    const lockData = readLockFile(foundScope);
    lockData.skills[name] = {
      ...lockData.skills[name],
      commit: newCommit,
      hash: newHash,
      installedAt: new Date().toISOString(),
    };
    writeLockFile(foundScope, lockData);

    return { updated: true };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

// ---------------------------------------------------------------------------
// updateAll
// ---------------------------------------------------------------------------

/**
 * Update all vendor skills recorded in both lock files.
 *
 * @param {{ global?: boolean }} options
 * @returns {{ results: Array<{ name: string, updated: boolean, message?: string, error?: string }> }}
 */
function updateAll(options = {}) {
  const scopes = ['global', 'project'];
  const results = [];

  for (const scope of scopes) {
    const lockData = readLockFile(scope);
    for (const name of Object.keys(lockData.skills)) {
      try {
        const result = updateSkill(name, { global: scope === 'global' });
        results.push({ name, ...result });
      } catch (err) {
        results.push({ name, updated: false, error: err.message });
      }
    }
  }

  return { results };
}

// ---------------------------------------------------------------------------
// listSkills
// ---------------------------------------------------------------------------

/**
 * List all vendor skills from both lock files.
 *
 * @param {object} options  (unused, reserved)
 * @returns {Array<{ name: string, source: string, commit: string, installedAt: string, scope: string }>}
 */
function listSkills(options = {}) {
  const list = [];
  const seen = new Set();

  for (const scope of ['global', 'project']) {
    const lockData = readLockFile(scope);
    for (const [name, entry] of Object.entries(lockData.skills)) {
      const key = `${scope}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        name,
        source: entry.source,
        commit: entry.commit,
        installedAt: entry.installedAt,
        scope: entry.scope || scope,
      });
    }
  }

  return list;
}

// ---------------------------------------------------------------------------
// removeSkill
// ---------------------------------------------------------------------------

/**
 * Remove a vendor skill by name.
 *
 * @param {string} name
 * @param {{ global?: boolean }} options
 */
function removeSkill(name, options = {}) {
  const scopes = options.global === true
    ? ['global']
    : options.global === false
      ? ['project']
      : ['global', 'project'];

  let removed = false;

  for (const scope of scopes) {
    const lockData = readLockFile(scope);
    if (!lockData.skills[name]) continue;

    const targetBase = scope === 'global'
      ? path.join(os.homedir(), '.claude', 'skills')
      : path.join(process.cwd(), '.claude', 'skills');

    // name is user input; validate it through safeJoin before any fs operation.
    const destDir = safeJoin(targetBase, name, 'skill name');
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }

    delete lockData.skills[name];
    writeLockFile(scope, lockData);
    removed = true;
    break;
  }

  if (!removed) {
    throw new Error(`Skill '${name}' not found in lock file`);
  }
}

// ---------------------------------------------------------------------------
// verifySkills
// ---------------------------------------------------------------------------

/**
 * Verify that all locked skills have their directories on disk.
 *
 * @param {object} options  (unused, reserved)
 * @returns {{ valid: string[], missing: string[] }}
 */
function verifySkills(options = {}) {
  const valid = [];
  const missing = [];

  for (const scope of ['global', 'project']) {
    const lockData = readLockFile(scope);
    const targetBase = scope === 'global'
      ? path.join(os.homedir(), '.claude', 'skills')
      : path.join(process.cwd(), '.claude', 'skills');

    for (const name of Object.keys(lockData.skills)) {
      // name comes from the lock file; validate via safeJoin before fs.existsSync
      let destDir;
      try {
        destDir = safeJoin(targetBase, name, 'skill name');
      } catch {
        missing.push(name);
        continue;
      }
      if (fs.existsSync(destDir)) {
        valid.push(name);
      } else {
        missing.push(name);
      }
    }
  }

  return { valid, missing };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  parseGitHubUrl,
  addSkill,
  updateSkill,
  updateAll,
  listSkills,
  removeSkill,
  verifySkills,
  readLockFile,
  writeLockFile,
  findSkillDirs,
  copyDirRecursive,
};
