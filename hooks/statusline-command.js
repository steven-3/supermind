#!/usr/bin/env node
// Claude Code status line — sleek terminal aesthetic
// Two-line display with box-drawing chars, context bar gradient, subagent tracking

const { execSync } = require("child_process");
const { readFileSync, writeFileSync, statSync, openSync, readSync, closeSync } = require("fs");
const { join } = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let data = {};
  try { data = JSON.parse(input); } catch {}

  // ─── Data collection ────────────────────────────────────────────────────

  const user = process.env.USER || process.env.USERNAME || "user";
  const host = process.env.HOSTNAME || process.env.COMPUTERNAME || "";

  // Working directory (normalize to Unix slashes for display)
  let cwd = data?.workspace?.current_dir || data?.cwd || process.cwd();
  let cwdUnix = cwd.replace(/\\/g, "/");
  const home = (process.env.HOME || process.env.USERPROFILE || "").replace(/\\/g, "/");
  let cwdDisplay = cwdUnix;
  if (home && cwdDisplay.startsWith(home)) cwdDisplay = "~" + cwdDisplay.slice(home.length);

  const model = data?.model?.display_name || process.env.CLAUDE_MODEL_NAME || "";

  // Git branch (symbolic-ref with short hash fallback)
  let gitBranch = "";
  try {
    gitBranch = execSync("git symbolic-ref --short HEAD", {
      cwd: cwdUnix, encoding: "utf8", timeout: 2000, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    try {
      gitBranch = execSync("git rev-parse --short HEAD", {
        cwd: cwdUnix, encoding: "utf8", timeout: 2000, stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {}
  }

  // Thinking level from settings
  let thinkingLevel = "";
  try {
    const sp = join(process.env.HOME || process.env.USERPROFILE, ".claude", "settings.json");
    const s = JSON.parse(readFileSync(sp, "utf8"));
    if (s.alwaysThinkingEnabled) thinkingLevel = s.effortLevel || "on";
  } catch {}

  // Supabase project ref from .mcp.json
  let supabaseRef = "";
  try {
    const mcp = JSON.parse(readFileSync(join(cwdUnix, ".mcp.json"), "utf8"));
    const url = mcp?.mcpServers?.supabase?.url || "";
    const m = url.match(/project_ref=([a-z0-9]+)/);
    if (m) supabaseRef = m[1];
  } catch {}

  // ─── Subagent detection (parse transcript tail) ─────────────────────────

  let activeAgents = [];
  try {
    const tp = data?.transcript_path;
    if (tp) {
      const tpUnix = tp.replace(/\\/g, "/");
      const stat = statSync(tpUnix);
      const TAIL_BYTES = Math.min(stat.size, 128 * 1024); // read last 128KB
      const buf = Buffer.alloc(TAIL_BYTES);
      const fd = openSync(tpUnix, "r");
      readSync(fd, buf, 0, TAIL_BYTES, stat.size - TAIL_BYTES);
      closeSync(fd);
      const tail = buf.toString("utf8");

      // Split into lines, skip partial first line if we didn't read from start
      const lines = tail.split("\n");
      if (stat.size > TAIL_BYTES) lines.shift();

      const agentCalls = new Map(); // tool_use id -> description
      const completedIds = new Set();

      for (const line of lines) {
        if (!line) continue;
        try {
          const entry = JSON.parse(line);
          // Find Agent tool_use in assistant messages
          if (entry.type === "assistant" && entry.message?.content) {
            for (const c of entry.message.content) {
              if (c.type === "tool_use" && c.name === "Agent") {
                agentCalls.set(c.id, c.input?.description || "agent");
              }
            }
          }
          // Find tool_result matching agent calls
          if (entry.type === "user" && entry.message?.content) {
            const arr = Array.isArray(entry.message.content) ? entry.message.content : [];
            for (const c of arr) {
              if (c.type === "tool_result" && agentCalls.has(c.tool_use_id)) {
                completedIds.add(c.tool_use_id);
              }
            }
          }
        } catch {}
      }

      for (const [id, desc] of agentCalls) {
        if (!completedIds.has(id)) activeAgents.push(desc);
      }
    }
  } catch {}

  // ─── Context window + cost ──────────────────────────────────────────────

  const usedPct = data?.context_window?.used_percentage;
  const cu = data?.context_window?.current_usage || {};
  const usedTokens =
    (Number(cu.input_tokens || 0) +
      Number(cu.output_tokens || 0) +
      Number(cu.cache_creation_input_tokens || 0) +
      Number(cu.cache_read_input_tokens || 0)) || null;
  const windowSize = data?.context_window?.context_window_size;
  const cost = process.env.CLAUDE_SESSION_COST_USD;

  // ─── Write context metrics for context-monitor hook ─────────────────────

  if (usedPct != null && windowSize) {
    try {
      const metricsPath = join(process.env.HOME || process.env.USERPROFILE, ".claude", "context-metrics.json");
      const percentRemaining = Math.round((100 - usedPct) * 10) / 10;
      writeFileSync(metricsPath, JSON.stringify({
        percentRemaining,
        tokensUsed: usedTokens || 0,
        tokensTotal: windowSize,
        timestamp: Date.now(),
      }));
    } catch {}
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  function fmt(n) {
    if (n == null || n === "") return "?";
    n = Number(n);
    if (isNaN(n)) return "?";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 100000) return Math.floor(n / 1000) + "k";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  }

  // 256-color ANSI sequences
  const c = (n) => `\x1b[38;5;${n}m`;
  const bg = (n) => `\x1b[48;5;${n}m`;
  const R = "\x1b[0m";
  const BOLD = "\x1b[1m";
  const DIM = "\x1b[2m";

  // Palette
  const TEAL   = c(80);   // user@host
  const ROSE   = c(204);  // model
  const AMBER  = c(215);  // path
  const MINT   = c(114);  // branch
  const SKY    = c(117);  // ctx bar filled
  const SLATE  = c(239);  // ctx bar empty / separators
  const LILAC  = c(183);  // thinking
  const CORAL  = c(209);  // supabase
  const GRAY   = c(245);  // labels
  const WHITE  = c(255);  // bright text
  const DKGRAY = c(237);  // box chars

  // ─── Progress bar (teal -> sky -> rose gradient at 75%) ─────────────────

  function progressBar(pct, width = 20) {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    // Gradient: low=teal, mid=sky, high=rose
    let barColor = SKY;
    if (pct > 75) barColor = c(204);
    else if (pct > 50) barColor = c(220);

    const filledStr = barColor + "\u2501".repeat(filled);
    const emptyStr = SLATE + "\u2501".repeat(empty);
    return filledStr + emptyStr + R;
  }

  // ─── Separators ─────────────────────────────────────────────────────────

  const SEP = `${DKGRAY}  \u2502  ${R}`;
  const DOT = `${DKGRAY} \u00b7 ${R}`;

  // ─── Line 1: identity + location ────────────────────────────────────────

  let line1 = `${DKGRAY}\u256d${R} `;
  line1 += `${TEAL}${BOLD}${user}${R}${GRAY}@${R}${TEAL}${host}${R}`;
  if (model) line1 += `${SEP}${ROSE}${model}${R}`;
  line1 += `${SEP}${AMBER}${cwdDisplay}${R}`;
  if (gitBranch) line1 += `${DOT}${MINT}${BOLD}${gitBranch}${R}`;

  // ─── Line 2: metrics ───────────────────────────────────────────────────

  let line2 = `${DKGRAY}\u2570${R} `;
  const parts2 = [];

  if (usedPct != null) {
    const pct = Math.round(usedPct);
    const bar = progressBar(pct);
    parts2.push(
      `${bar} ${WHITE}${BOLD}${pct}%${R}${GRAY} ctx${R}${DOT}${WHITE}${fmt(usedTokens)}${R}${GRAY}/${R}${WHITE}${fmt(windowSize)}${R}`,
    );
  }

  if (thinkingLevel) {
    const icon = thinkingLevel === "high" ? "\u25c6" : thinkingLevel === "low" ? "\u25c7" : "\u25c8";
    parts2.push(`${LILAC}${icon} ${thinkingLevel}${R}`);
  }

  if (supabaseRef) {
    parts2.push(`${CORAL}\u25c8 ${R}${GRAY}sb:${R}${CORAL}${supabaseRef}${R}`);
  }

  if (activeAgents.length) {
    const CYAN = c(81);
    const names = activeAgents
      .map((d) => (d.length > 20 ? d.slice(0, 18) + ".." : d))
      .join(", ");
    const spinner =
      ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"][
        Math.floor(Date.now() / 100) % 10
      ];
    parts2.push(
      `${CYAN}${spinner} ${activeAgents.length} agent${activeAgents.length > 1 ? "s" : ""}${R}${GRAY}: ${names}${R}`,
    );
  }

  if (cost) {
    parts2.push(`${GRAY}$${Number(cost).toFixed(2)}${R}`);
  }

  line2 += parts2.join(`${SEP}`);

  // ─── Output ─────────────────────────────────────────────────────────────

  if (parts2.length) {
    process.stdout.write(`${line1}\n${line2}`);
  } else {
    process.stdout.write(line1);
  }
});
