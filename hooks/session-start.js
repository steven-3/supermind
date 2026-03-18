#!/usr/bin/env node
// Session Start Hook — loads previous session context + living docs summaries
// Fires on: SessionStart
// Outputs combined context: session summary + ARCHITECTURE.md + DESIGN.md

const fs = require("fs");
const path = require("path");
const os = require("os");

const SESSION_DIR = path.join(os.homedir(), ".claude", "sessions");
const MAX_AGE_DAYS = 7;

// ─── Session loading ─────────────────────────────────────────────────────────

function getLatestSession(projectDir) {
  if (!fs.existsSync(SESSION_DIR)) return null;

  const files = fs.readdirSync(SESSION_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const filepath = path.join(SESSION_DIR, f);
      const stat = fs.statSync(filepath);
      return { filepath, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  // Find the most recent session for this project (or any session)
  for (const file of files) {
    const ageDays = (Date.now() - file.mtime) / (1000 * 60 * 60 * 24);
    if (ageDays > MAX_AGE_DAYS) continue;

    try {
      const data = JSON.parse(fs.readFileSync(file.filepath, "utf-8"));
      if (!projectDir || data.project === projectDir) {
        return data;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function formatSessionContext(session) {
  if (!session) return "[Session] No previous session found. Starting fresh.";

  const age = Math.round((Date.now() - new Date(session.timestamp).getTime()) / (1000 * 60 * 60));
  const ageStr = age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`;

  const parts = [`[Previous Session: ${ageStr}]`];

  if (session.summary) parts.push(`Summary: ${session.summary}`);
  if (session.branch) parts.push(`Branch: ${session.branch}`);
  if (session.filesModified?.length) {
    parts.push(`Modified: ${session.filesModified.slice(0, 15).join(", ")}`);
  }
  if (session.decisions?.length) {
    parts.push(`Key decisions: ${session.decisions.join("; ")}`);
  }
  if (session.nextSteps) parts.push(`Next steps: ${session.nextSteps}`);

  return parts.join("\n");
}

// ─── Living docs extraction ──────────────────────────────────────────────────

function extractDocSummary(content, maxChars) {
  const sections = content.split(/^## /m);
  const headings = [];
  let overview = "";
  let techStack = "";

  for (const section of sections) {
    const lines = section.split("\n");
    const title = lines[0]?.trim();
    if (!title) continue;
    headings.push(title);

    if (/overview/i.test(title)) {
      const body = lines.slice(1).join("\n").trim();
      overview = body.split(/\n\s*\n/)[0]?.slice(0, 400) || "";
    }
    if (/tech stack/i.test(title)) {
      techStack = lines.filter(l => l.trim().startsWith("|")).join("\n").slice(0, 300);
    }
  }

  const parts = [];
  if (overview) parts.push("Overview: " + overview);
  if (techStack) parts.push("Tech Stack:\n" + techStack);
  if (headings.length) parts.push("Sections: " + headings.join(", "));
  return parts.join("\n").slice(0, maxChars);
}

function formatLivingDocs(projectDir) {
  const parts = [];

  // ARCHITECTURE.md — always check
  const archPath = path.join(projectDir, "ARCHITECTURE.md");
  if (fs.existsSync(archPath)) {
    try {
      const content = fs.readFileSync(archPath, "utf-8");
      const summary = extractDocSummary(content, 800);
      if (summary) parts.push(`[Architecture]\n${summary}`);
    } catch {}
  } else {
    parts.push("[Setup] No ARCHITECTURE.md found. Run /supermind-init to create one.");
  }

  // DESIGN.md — only if it exists
  const designPath = path.join(projectDir, "DESIGN.md");
  if (fs.existsSync(designPath)) {
    try {
      const content = fs.readFileSync(designPath, "utf-8");
      const summary = extractDocSummary(content, 400);
      if (summary) parts.push(`[Design]\n${summary}`);
    } catch {}
  }

  return parts.join("\n");
}

// ─── Project health check ────────────────────────────────────────────────────

function checkProjectHealth(projectDir) {
  const missing = [];
  if (!fs.existsSync(path.join(projectDir, "CLAUDE.md"))) {
    missing.push("CLAUDE.md");
  }
  if (missing.length > 0) {
    return `[Setup] Missing: ${missing.join(", ")} — consider creating one for this project.`;
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  try {
    const projectDir = process.env.PROJECT_DIR || process.cwd();

    const outputParts = [];

    // Project health check
    const healthWarning = checkProjectHealth(projectDir);
    if (healthWarning) outputParts.push(healthWarning);

    // Session context
    const session = getLatestSession(projectDir);
    outputParts.push(formatSessionContext(session));

    // Living docs
    const docsContext = formatLivingDocs(projectDir);
    if (docsContext) outputParts.push(docsContext);

    console.log(outputParts.join("\n---\n"));
  } catch (err) {
    console.log("[Session] Hook error: " + err.message);
  }
}

main();
