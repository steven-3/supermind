#!/usr/bin/env node
// Context monitor — reads metrics from statusline hook and injects warnings at thresholds
// PostToolUse hook (all tool uses), non-blocking advisory output

const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");

const METRICS_PATH = join(process.env.HOME || process.env.USERPROFILE, ".claude", "context-metrics.json");
const STATE_PATH = join(process.env.HOME || process.env.USERPROFILE, ".claude", "context-monitor-state.json");
const STALENESS_MS = 60_000;
const WARN_THRESHOLD = 35;
const CRITICAL_THRESHOLD = 25;
const SPAM_INTERVAL = 5; // below critical, warn every Nth tool call

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    // Read metrics written by statusline hook
    if (!existsSync(METRICS_PATH)) { output(null); return; }
    const metrics = JSON.parse(readFileSync(METRICS_PATH, "utf8"));

    // Skip if metrics are stale (>60s old)
    if (Date.now() - metrics.timestamp > STALENESS_MS) { output(null); return; }

    const pct = metrics.percentRemaining;

    // Load state to track warnings
    let state = { lastLevel: null, toolCallsSinceCriticalWarn: 0 };
    try {
      if (existsSync(STATE_PATH)) state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    } catch {}

    state.toolCallsSinceCriticalWarn = (state.toolCallsSinceCriticalWarn || 0) + 1;

    let message = null;

    if (pct <= CRITICAL_THRESHOLD) {
      // Below critical: warn every SPAM_INTERVAL tool calls to avoid noise
      if (state.lastLevel !== "critical" || state.toolCallsSinceCriticalWarn >= SPAM_INTERVAL) {
        const rounded = Math.round(pct);
        message = `\u26a0\ufe0f Context critical at ${rounded}% remaining. Commit current work now. Remaining tasks should run in fresh subagents.`;
        state.lastLevel = "critical";
        state.toolCallsSinceCriticalWarn = 0;
      }
    } else if (pct <= WARN_THRESHOLD) {
      // Advisory zone: warn once on entry
      if (state.lastLevel !== "warn" && state.lastLevel !== "critical") {
        const rounded = Math.round(pct);
        message = `\u26a0 Context at ${rounded}% remaining. Consider wrapping up current task or spawning a fresh executor.`;
        state.lastLevel = "warn";
        state.toolCallsSinceCriticalWarn = 0;
      }
    } else {
      // Above threshold — reset state
      state.lastLevel = null;
      state.toolCallsSinceCriticalWarn = 0;
    }

    // Persist state
    try { writeFileSync(STATE_PATH, JSON.stringify(state)); } catch {}

    output(message);
  } catch {
    // Any failure — silent, non-blocking
    output(null);
  }
});

function output(message) {
  if (message) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { additionalContext: message },
    }));
  }
}
