#!/usr/bin/env node
// PostToolUse hook — advisory warnings before merging into main/master.
// Fires after any Bash command containing "git merge".
// Never blocks — outputs warnings only.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gitExec(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 10000 }).trim();
}

function isMergingToMainOrMaster(command) {
  // Match "git merge" anywhere in the command (handles compound cmds)
  if (!/\bgit\b.*\bmerge\b/.test(command)) return false;

  // After "merge" keyword, find the target branch token
  const afterMerge = command.replace(/^[\s\S]*?\bmerge\b/, '').trim();
  const tokens = afterMerge.split(/\s+/).filter(t => t && !t.startsWith('-') && !t.startsWith('"') && !t.startsWith("'"));
  for (const token of tokens) {
    const bare = token.replace(/^[^/]+\//, ''); // strip "origin/" prefix
    if (bare === 'main' || bare === 'master') return true;
  }
  return false;
}

function getTargetBranch(command) {
  const afterMerge = command.replace(/^[\s\S]*?\bmerge\b/, '').trim();
  const tokens = afterMerge.split(/\s+/).filter(t => t && !t.startsWith('-'));
  for (const token of tokens) {
    const bare = token.replace(/^[^/]+\//, '');
    if (bare === 'main' || bare === 'master') return token;
  }
  return 'main';
}

// ─── Check 1: ARCHITECTURE.md in branch diff ─────────────────────────────────

function checkLivingDocs(projectDir, targetBranch) {
  try {
    const diffOutput = gitExec(['diff', '--name-only', `${targetBranch}...HEAD`], projectDir);
    const changedFiles = diffOutput.split('\n').map(f => f.trim()).filter(Boolean);
    const archChanged = changedFiles.some(f => f === 'ARCHITECTURE.md' || f.endsWith('/ARCHITECTURE.md'));
    if (!archChanged) {
      return 'ARCHITECTURE.md not updated in this branch';
    }
  } catch {
    // Diff failed (e.g., no common history) — skip check
  }
  return null;
}

// ─── Check 2: OpenSpec archive ────────────────────────────────────────────────

function checkOpenSpecArchive(projectDir) {
  const warnings = [];
  try {
    const changesDir = path.join(projectDir, 'openspec', 'changes');
    if (!fs.existsSync(changesDir)) return warnings;

    const entries = fs.readdirSync(changesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'archive') continue;

      const tasksFile = path.join(changesDir, entry.name, 'tasks.md');
      if (!fs.existsSync(tasksFile)) continue;

      try {
        const content = fs.readFileSync(tasksFile, 'utf-8');
        const done = (content.match(/- \[x\]/gi) || []).length;
        const notDone = (content.match(/- \[ \]/g) || []).length;

        if (done > 0 && notDone === 0) {
          warnings.push(`Completed OpenSpec change '${entry.name}' not archived. Run /openspec-archive first.`);
        }
      } catch {
        // Cannot read tasks.md — skip this change dir
      }
    }
  } catch {
    // openspec/changes not accessible — skip check
  }
  return warnings;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input || '{}');
      const command = data.tool_input?.command || '';

      // Only fire on git merge commands targeting main/master
      if (!command.includes('git') || !command.includes('merge')) {
        process.stdout.write('{}');
        return;
      }

      if (!isMergingToMainOrMaster(command)) {
        process.stdout.write('{}');
        return;
      }

      const projectDir = process.cwd();
      const targetBranch = getTargetBranch(command);
      const warnings = [];

      // Check 1: ARCHITECTURE.md in diff
      try {
        const livingDocsWarning = checkLivingDocs(projectDir, targetBranch);
        if (livingDocsWarning) warnings.push(livingDocsWarning);
      } catch {
        // skip
      }

      // Check 2: OpenSpec archive
      try {
        const openSpecWarnings = checkOpenSpecArchive(projectDir);
        warnings.push(...openSpecWarnings);
      } catch {
        // skip
      }

      if (warnings.length === 0) {
        process.stdout.write('{}');
      } else {
        process.stdout.write(JSON.stringify({ hookSpecificOutput: { warnings } }));
      }
    } catch {
      // Hook errors must never surface — exit silently
      process.stdout.write('{}');
    }
  });
}

main();
