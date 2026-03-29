#!/usr/bin/env node
// Improvement Logger Hook — logs session git activity to JSONL
// Fires on: Stop (async)

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const LOG_FILE = path.join(os.homedir(), ".claude", "improvement-log.jsonl");
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function gitExec(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function getGitInfo(projectDir) {
  const info = { branch: null, commits: [], filesChanged: 0 };

  try {
    info.branch = gitExec(["rev-parse", "--abbrev-ref", "HEAD"], projectDir);
  } catch {
    // silently skip
  }

  try {
    const logOutput = gitExec(
      ["log", "--oneline", "--since=4 hours ago"],
      projectDir
    );
    info.commits = logOutput
      ? logOutput.split("\n").filter((line) => line.length > 0)
      : [];
  } catch {
    // silently skip
  }

  try {
    const diffOutput = gitExec(
      ["diff", "--name-only", "HEAD~1", "HEAD"],
      projectDir
    );
    info.filesChanged = diffOutput
      ? diffOutput.split("\n").filter((line) => line.length > 0).length
      : 0;
  } catch {
    try {
      const diffOutput = gitExec(["diff", "--name-only"], projectDir);
      info.filesChanged = diffOutput
        ? diffOutput.split("\n").filter((line) => line.length > 0).length
        : 0;
    } catch {
      // silently skip
    }
  }

  return info;
}

function rotateLogs() {
  try {
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > MAX_SIZE) {
      fs.renameSync(LOG_FILE, LOG_FILE + ".1");
    }
  } catch {
    // file doesn't exist or stat failed — no rotation needed
  }
}

function main() {
  const projectDir = process.env.PROJECT_DIR || process.cwd();
  const sessionId = process.env.SESSION_ID || "unknown";

  const gitInfo = getGitInfo(projectDir);

  const entry = {
    timestamp: new Date().toISOString(),
    project: projectDir,
    branch: gitInfo.branch,
    sessionId,
    commits: gitInfo.commits,
    filesChanged: gitInfo.filesChanged,
  };

  try {
    rotateLogs();
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {
    // Non-critical — silently fail
  }
}

main();
