'use strict';

const { execFileSync } = require('child_process');
const os = require('os');

const OPENSPEC_MIN_VERSION = '1.0.0';

/**
 * Compare two semver strings.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 */
function compareSemver(a, b) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const av = aParts[i] || 0;
    const bv = bParts[i] || 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

/**
 * Detect whether the openspec CLI is installed.
 * Returns { installed: boolean, version: string|null, path: string|null }
 */
function detectCli() {
  try {
    const whichCmd = os.platform() === 'win32' ? 'where' : 'which';
    const cliPath = execFileSync(whichCmd, ['openspec'], { stdio: 'pipe' })
      .toString()
      .trim()
      .split('\n')[0]
      .trim();

    if (!cliPath) {
      return { installed: false, version: null, path: null };
    }

    const versionOutput = execFileSync('openspec', ['--version'], { stdio: 'pipe' })
      .toString()
      .trim();

    // Extract semver pattern from output (e.g. "openspec v1.2.3" or "1.2.3")
    const match = versionOutput.match(/(\d+\.\d+\.\d+)/);
    const version = match ? match[1] : null;

    return { installed: true, version, path: cliPath };
  } catch {
    return { installed: false, version: null, path: null };
  }
}

/**
 * Install the openspec CLI globally via npm.
 * Returns { success: boolean, error: string|null }
 */
function installCli() {
  try {
    execFileSync('npm', ['install', '-g', 'openspec'], { stdio: 'pipe' });
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Check the health of the openspec CLI installation.
 * Returns { installed: boolean, version: string|null, compatible: boolean }
 */
function checkHealth() {
  const { installed, version } = detectCli();
  const compatible = installed && version !== null
    ? compareSemver(version, OPENSPEC_MIN_VERSION) >= 0
    : false;
  return { installed, version, compatible };
}

module.exports = { OPENSPEC_MIN_VERSION, detectCli, installCli, checkHealth, compareSemver };
