'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Path safety — mirrors planning.js / vendor-skills.js safeJoin pattern
// ---------------------------------------------------------------------------

function safeJoin(trustedBase, segment, label) {
  if (typeof segment !== 'string' || segment.length === 0) {
    throw new Error(`Invalid ${label}: must be a non-empty string`);
  }
  if (path.isAbsolute(segment)) {
    throw new Error(`Invalid ${label}: must not be an absolute path`);
  }
  const parts = segment.split(/[\\/]/);
  for (const part of parts) {
    if (part === '..') {
      throw new Error(`Invalid ${label}: path traversal sequences are not allowed`);
    }
  }
  const resolved = trustedBase + path.sep + parts.join(path.sep);
  if (!resolved.startsWith(trustedBase + path.sep) && resolved !== trustedBase) {
    throw new Error(`Invalid ${label}: resolved path escapes base directory`);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SKILLS_DIR_NAME = 'skills';

/** Maps task types to the methodology skills injected into executor prompts. */
const SKILL_MAP = {
  'write-feature': ['tdd', 'verification-before-completion', 'anti-rationalization'],
  'fix-bug': ['systematic-debugging', 'verification-before-completion', 'anti-rationalization'],
  'refactor': ['verification-before-completion', 'anti-rationalization'],
  'write-test': ['tdd', 'anti-rationalization'],
  'research': [],
};

// ---------------------------------------------------------------------------
// getSkillContent — reads SKILL.md from the skills directory
// ---------------------------------------------------------------------------

/**
 * Read a skill's SKILL.md content.
 *
 * Search order:
 *   1. ~/.claude/skills/{skillName}/SKILL.md
 *   2. {projectRoot}/.claude/skills/{skillName}/SKILL.md (project-level)
 *
 * @param {string} skillName — e.g. 'tdd', 'anti-rationalization'
 * @param {string} [projectRoot] — project root for project-level fallback
 * @returns {string | null} file content or null if not found
 */
function getSkillContent(skillName, projectRoot) {
  if (typeof skillName !== 'string' || skillName.length === 0) return null;
  if (!/^[\w.-]+$/.test(skillName)) return null;

  // Global: ~/.claude/skills/{skillName}/SKILL.md
  const globalSkillsDir = safeJoin(CLAUDE_DIR, SKILLS_DIR_NAME, 'skills directory');
  const globalPath = safeJoin(
    safeJoin(globalSkillsDir, skillName, 'skill name'),
    'SKILL.md',
    'skill file',
  );
  try {
    return fs.readFileSync(globalPath, 'utf-8');
  } catch { /* fall through */ }

  // Project-level: {projectRoot}/.claude/skills/{skillName}/SKILL.md
  if (typeof projectRoot === 'string' && projectRoot.length > 0) {
    const projectClaudeDir = safeJoin(projectRoot, '.claude', 'project claude dir');
    const projectSkillsDir = safeJoin(projectClaudeDir, SKILLS_DIR_NAME, 'skills directory');
    const projectPath = safeJoin(
      safeJoin(projectSkillsDir, skillName, 'skill name'),
      'SKILL.md',
      'skill file',
    );
    try {
      return fs.readFileSync(projectPath, 'utf-8');
    } catch { /* fall through */ }
  }

  return null;
}

// ---------------------------------------------------------------------------
// buildTaskPacket — assembles everything a subagent needs
// ---------------------------------------------------------------------------

/**
 * Assemble a self-contained task packet for a fresh-context executor.
 *
 * @param {object} task
 * @param {string} task.id — unique task identifier
 * @param {string} task.title — short task title
 * @param {string} task.type — one of: write-feature, fix-bug, refactor, write-test, research
 * @param {string} [task.description] — what to do (falls back to placeholder)
 * @param {string[]} [task.files] — files the executor should read/modify
 * @param {string[]} [task.acceptance] — acceptance criteria
 * @param {string} [task.expectedOutput] — what the result should look like
 * @param {string[]} [task.dependsOn] — IDs of tasks this depends on
 * @param {object} [options]
 * @param {string} [options.projectRoot] — for skill + context resolution
 * @param {string} [options.branch] — current git branch
 * @param {string} [options.recentCommits] — compact git log
 * @param {string} [options.architectureExcerpt] — relevant ARCHITECTURE.md sections
 * @param {string} [options.conventions] — key CLAUDE.md conventions
 * @returns {string} a single prompt string ready for the Agent tool
 */
function buildTaskPacket(task, options = {}) {
  if (!task || !task.id || !task.title || !task.type) {
    throw new Error('buildTaskPacket: task must have id, title, and type');
  }
  if (!SKILL_MAP.hasOwnProperty(task.type)) {
    const valid = Object.keys(SKILL_MAP).join(', ');
    throw new Error(`buildTaskPacket: invalid task type "${task.type}" (valid: ${valid})`);
  }

  const sections = [];

  // --- Task spec ---
  sections.push('# Task Spec');
  sections.push(`**ID:** ${task.id}`);
  sections.push(`**Title:** ${task.title}`);
  sections.push(`**Type:** ${task.type}`);
  sections.push('');
  sections.push('## What to Do');
  sections.push(task.description || '(no description provided)');

  if (task.files && task.files.length > 0) {
    sections.push('');
    sections.push('## Files');
    for (const f of task.files) {
      sections.push(`- ${f}`);
    }
  }

  if (task.acceptance && task.acceptance.length > 0) {
    sections.push('');
    sections.push('## Acceptance Criteria');
    for (const a of task.acceptance) {
      sections.push(`- [ ] ${a}`);
    }
  }

  if (task.expectedOutput) {
    sections.push('');
    sections.push('## Expected Output');
    sections.push(task.expectedOutput);
  }

  // --- Project context (compact) ---
  const contextParts = [];
  if (options.branch) {
    contextParts.push(`**Branch:** ${options.branch}`);
  }
  if (options.recentCommits) {
    contextParts.push(`**Recent commits:**\n${options.recentCommits}`);
  }
  if (options.architectureExcerpt) {
    contextParts.push(`**Architecture:**\n${options.architectureExcerpt}`);
  }
  if (options.conventions) {
    contextParts.push(`**Conventions:**\n${options.conventions}`);
  }
  if (contextParts.length > 0) {
    sections.push('');
    sections.push('# Project Context');
    sections.push(contextParts.join('\n\n'));
  }

  // --- Injected skills ---
  const skillNames = SKILL_MAP[task.type] || [];
  const skillSections = [];
  for (const name of skillNames) {
    const content = getSkillContent(name, options.projectRoot);
    if (content) {
      skillSections.push(`<skill name="${name}">\n${content}\n</skill>`);
    }
  }
  if (skillSections.length > 0) {
    sections.push('');
    sections.push('# Methodology Skills');
    sections.push('Follow these skills strictly:');
    sections.push(skillSections.join('\n\n'));
  }

  // --- Completion contract ---
  sections.push('');
  sections.push('# Completion Contract');
  sections.push('You MUST follow these rules:');
  sections.push('- Commit your work atomically when done (one commit per task)');
  sections.push('- Report results: files changed, tests run, tests passed');
  sections.push('- Stay in scope — only modify files related to this task');
  sections.push('- NEVER merge branches or push to main/master');
  sections.push('- NEVER skip tests or verification steps');
  sections.push('- If you cannot complete the task, report what failed and why');

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// executeTask — builds the prompt an orchestrator passes to Agent tool
// ---------------------------------------------------------------------------

/**
 * Build a structured execution request from a task packet.
 *
 * This does NOT call the Agent tool — the orchestrator skill does that.
 * It returns the prompt string and metadata the orchestrator needs.
 *
 * @param {string} taskPacket — output of buildTaskPacket
 * @param {object} [options]
 * @param {boolean} [options.useWorktree] — whether executor should use a worktree
 * @param {string} [options.model] — model override (e.g. 'sonnet', 'opus')
 * @returns {{ prompt: string, description: string, model?: string, isolation?: string }}
 */
function executeTask(taskPacket, options = {}) {
  if (typeof taskPacket !== 'string' || taskPacket.length === 0) {
    throw new Error('executeTask: taskPacket must be a non-empty string');
  }

  // Extract task title from the packet for the Agent description
  const titleMatch = taskPacket.match(/^\*\*Title:\*\*\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Execute task';

  // Truncate description to 5 words for the Agent tool's description field
  const descWords = title.split(/\s+/).slice(0, 5).join(' ');

  const result = {
    prompt: taskPacket,
    description: descWords,
  };

  if (options.model) {
    result.model = options.model;
  }

  if (options.useWorktree) {
    result.isolation = 'worktree';
  }

  return result;
}

// ---------------------------------------------------------------------------
// buildWavePlan — topological sort + wave grouping
// ---------------------------------------------------------------------------

/**
 * Group tasks into execution waves based on dependency graph.
 *
 * @param {Array<{ id: string, dependsOn?: string[] }>} tasks
 * @returns {Array<{ wave: number, tasks: Array }>}
 * @throws if circular dependencies are detected
 */
function buildWavePlan(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  // Build lookup: taskId → task object, and pre-compute string deps
  const taskMap = new Map();
  const depsMap = new Map(); // taskId → string[] of dependency IDs

  for (const task of tasks) {
    const id = String(task.id);
    taskMap.set(id, task);
    depsMap.set(id, (task.dependsOn || []).map(String));
  }

  // Validate: all referenced dependencies must exist in the task list
  for (const [id, deps] of depsMap) {
    for (const dep of deps) {
      if (!taskMap.has(dep)) {
        throw new Error(
          `Task "${id}" depends on "${dep}" which does not exist in the task list`,
        );
      }
    }
  }

  const waves = [];
  const resolved = new Set();
  const remaining = new Set(taskMap.keys());

  while (remaining.size > 0) {
    // Collect tasks whose dependencies are all resolved
    const ready = [];
    for (const id of remaining) {
      if (depsMap.get(id).every(d => resolved.has(d))) {
        ready.push(id);
      }
    }

    if (ready.length === 0) {
      const stuck = Array.from(remaining).join(', ');
      throw new Error(`Circular dependency detected among tasks: ${stuck}`);
    }

    const waveNum = waves.length + 1;
    waves.push({ wave: waveNum, tasks: ready.map(id => taskMap.get(id)) });

    for (const id of ready) {
      resolved.add(id);
      remaining.delete(id);
    }
  }

  return waves;
}

// ---------------------------------------------------------------------------
// formatWaveProgress — Markdown progress table
// ---------------------------------------------------------------------------

/**
 * Render a Markdown progress table from a wave plan and results.
 *
 * @param {Array<{ wave: number, tasks: Array<{ id: string, title: string }> }>} wavePlan
 * @param {Map<string, { status: string, commitHash?: string }>} [results] — taskId → result
 * @returns {string} Markdown table
 */
function formatWaveProgress(wavePlan, results) {
  const resultMap = results || new Map();
  const lines = [];

  lines.push('| Wave | Task | Status | Commit |');
  lines.push('|------|------|--------|--------|');

  for (const wave of wavePlan) {
    for (const task of wave.tasks) {
      const id = String(task.id);
      const r = resultMap.get(id);
      const status = r ? r.status : 'pending';
      const commit = (r && r.commitHash) ? r.commitHash.slice(0, 7) : '';
      const safeTitle = (task.title || id).replace(/\|/g, '\\|');
      lines.push(`| ${wave.wave} | ${safeTitle} | ${status} | ${commit} |`);
    }
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  buildTaskPacket,
  executeTask,
  buildWavePlan,
  formatWaveProgress,
  getSkillContent,
  // Exposed for testing
  SKILL_MAP,
};
