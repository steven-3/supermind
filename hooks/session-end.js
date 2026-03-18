#!/usr/bin/env node
// Session End Hook — saves session summary for next session
// Fires on: Stop

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const SESSION_DIR = path.join(os.homedir(), ".claude", "sessions");
const MAX_SESSIONS = 20;

// ─── Git info collection ────────────────────────────────────────────────────

function getGitInfo(cwd) {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd, encoding: "utf-8",
    }).trim();
    let diff = '';
    try {
      diff = execSync("git diff --name-only HEAD~1 HEAD", {
        cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      diff = execSync("git diff --name-only", {
        cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    }
    const filesModified = diff ? diff.split("\n").filter(Boolean) : [];
    return { branch, filesModified };
  } catch {
    return { branch: null, filesModified: [] };
  }
}

// ─── Session cleanup ─────────────────────────────────────────────────────────

function cleanOldSessions() {
  if (!fs.existsSync(SESSION_DIR)) return;

  const files = fs.readdirSync(SESSION_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const filepath = path.join(SESSION_DIR, f);
      return { filepath, mtime: fs.statSync(filepath).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  // Keep only MAX_SESSIONS most recent
  for (const file of files.slice(MAX_SESSIONS)) {
    try { fs.unlinkSync(file.filepath); } catch {}
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });

  const cwd = process.env.PROJECT_DIR || process.cwd();
  const gitInfo = getGitInfo(cwd);

  const summary = process.env.SESSION_SUMMARY || "Session ended (no summary provided)";

  const session = {
    timestamp: new Date().toISOString(),
    project: cwd,
    branch: gitInfo.branch,
    filesModified: gitInfo.filesModified,
    summary,
    decisions: [],
    nextSteps: "",
  };

  const filename = `session-${Date.now()}.json`;
  fs.writeFileSync(path.join(SESSION_DIR, filename), JSON.stringify(session, null, 2));

  cleanOldSessions();
}

main();
