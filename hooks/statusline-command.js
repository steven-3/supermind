#!/usr/bin/env node
// Claude Code status line — sleek terminal aesthetic
// Two-line display: identity + context bar, wave progress + executors + cost
// Reads .planning/ state for wave progress, context-metrics.json for enhanced context display

const { execSync } = require("child_process");
const { readFileSync, writeFileSync, statSync, existsSync, openSync, readSync, closeSync } = require("fs");
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
  const model = data?.model?.display_name || process.env.CLAUDE_MODEL_NAME || "";

  // Git branch (symbolic-ref with short hash fallback)
  // Note: execSync is used here with hardcoded commands only (no user input),
  // so shell injection is not a concern. This is a status line hook with no
  // interactive input — all values come from process.env or the Claude Code data pipe.
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

  let percentRemaining = null;
  if (usedPct != null && windowSize) {
    percentRemaining = Math.round((100 - usedPct) * 10) / 10;
    try {
      const metricsPath = join(process.env.HOME || process.env.USERPROFILE, ".claude", "context-metrics.json");
      writeFileSync(metricsPath, JSON.stringify({
        percentRemaining,
        tokensUsed: usedTokens || 0,
        tokensTotal: windowSize,
        timestamp: Date.now(),
      }));
    } catch {}
  }

  // ─── Wave progress (from .planning/) ────────────────────────────────────

  let waveProgress = null;
  try {
    const planningDir = join(cwdUnix, ".planning");
    if (existsSync(planningDir)) {
      // Find active phase from roadmap.md
      const roadmapPath = join(planningDir, "roadmap.md");
      if (existsSync(roadmapPath)) {
        const roadmapContent = readFileSync(roadmapPath, "utf8");
        const roadmapLines = roadmapContent.split("\n");
        let activePhase = null;
        for (const line of roadmapLines) {
          const match = line.match(/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/);
          if (match && match[2].trim() !== "completed" && match[2].trim() !== "skipped") {
            activePhase = parseInt(match[1], 10);
            break;
          }
        }

        if (activePhase != null) {
          const progressPath = join(planningDir, "phases", `phase-${activePhase}`, "progress.md");
          if (existsSync(progressPath)) {
            const progressContent = readFileSync(progressPath, "utf8");
            const entries = [];
            for (const line of progressContent.split("\n")) {
              const match = line.match(/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/);
              if (match) {
                entries.push({
                  wave: parseInt(match[1], 10),
                  status: match[3].trim(),
                });
              }
            }

            if (entries.length > 0) {
              const totalTasks = entries.length;
              const doneTasks = entries.filter(e => e.status === "completed").length;
              const maxWave = Math.max(...entries.map(e => e.wave));
              // Use the lowest incomplete wave as "current"
              const incompleteWaves = entries.filter(e => e.status !== "completed").map(e => e.wave);
              const currentWave = incompleteWaves.length > 0 ? Math.min(...incompleteWaves) : maxWave;

              waveProgress = {
                currentWave,
                totalWaves: maxWave,
                doneTasks,
                totalTasks,
              };
            }
          }
        }
      }
    }
  } catch {}

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
  const R = "\x1b[0m";
  const BOLD = "\x1b[1m";

  // Palette
  const TEAL   = c(80);   // user@host
  const ROSE   = c(204);  // model
  const MINT   = c(114);  // branch
  const SLATE  = c(239);  // ctx bar empty / separators
  const LILAC  = c(183);  // thinking
  const CORAL  = c(209);  // supabase
  const ORANGE = c(214);  // folder name
  const GRAY   = c(245);  // labels
  const WHITE  = c(255);  // bright text
  const DKGRAY = c(237);  // box chars
  const GREEN  = c(114);  // context bar >50% remaining
  const YELLOW = c(220);  // context bar 25-50% remaining
  const RED    = c(196);  // context bar <25% remaining

  // ─── Context bar (color-coded by remaining capacity) ────────────────────

  function contextBar(usedPercent, width = 10) {
    const filled = Math.round((usedPercent / 100) * width);
    const empty = width - filled;
    const remaining = 100 - usedPercent;

    // Color by remaining capacity: green >50%, yellow 25-50%, red <25%
    let barColor;
    if (remaining > 50) barColor = GREEN;
    else if (remaining >= 25) barColor = YELLOW;
    else barColor = RED;

    return `${SLATE}[${R}${barColor}${"\u2588".repeat(filled)}${SLATE}${"\u2591".repeat(empty)}${R}${SLATE}]${R}`;
  }

  // ─── Separators ─────────────────────────────────────────────────────────

  const SEP = `${DKGRAY}  \u2502  ${R}`;
  const DOT = `${DKGRAY} \u00b7 ${R}`;

  // ─── Line 1: identity + branch + context bar ───────────────────────────

  let line1 = `${DKGRAY}\u256d${R} `;
  line1 += `${TEAL}${BOLD}${user}${R}${GRAY}@${R}${TEAL}${host}${R}`;
  if (model) line1 += `${SEP}${ROSE}${model}${R}`;
  if (gitBranch) line1 += `${SEP}${MINT}${BOLD}${gitBranch}${R}`;

  // Folder name (basename of cwd)
  const folderName = cwdUnix.split("/").filter(Boolean).pop() || "";
  if (folderName) line1 += `${SEP}${ORANGE}${BOLD}${folderName}${R}`;

  // ─── Line 2: wave progress + executors + cost ──────────────────────────

  let line2 = `${DKGRAY}\u2570${R} `;
  const parts2 = [];

  // Context bar + token counts (compact)
  if (usedTokens != null && windowSize) {
    const barPrefix = usedPct != null ? `${contextBar(Math.round(usedPct))} ` : "";
    parts2.push(
      `${barPrefix}${WHITE}${fmt(usedTokens)}${R}${GRAY}/${R}${WHITE}${fmt(windowSize)}${R}${GRAY} tokens${R}`,
    );
  }

  // Wave progress (only when .planning/ has active progress)
  if (waveProgress) {
    const VIOLET = c(141);
    parts2.push(
      `${VIOLET}\u25b8 Wave ${waveProgress.currentWave}/${waveProgress.totalWaves}${R}${DOT}${WHITE}${waveProgress.doneTasks}/${waveProgress.totalTasks}${R}${GRAY} tasks${R}`,
    );
  }

  if (thinkingLevel) {
    const icon = thinkingLevel === "high" ? "\u25c6" : thinkingLevel === "low" ? "\u25c7" : "\u25c8";
    parts2.push(`${LILAC}${icon} ${thinkingLevel}${R}`);
  }

  if (supabaseRef) {
    parts2.push(`${CORAL}\u25c8 ${R}${GRAY}sb:${R}${CORAL}${supabaseRef}${R}`);
  }

  // Active executors / agents
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
      `${CYAN}${spinner} ${activeAgents.length} executor${activeAgents.length > 1 ? "s" : ""}${R}${GRAY}: ${names}${R}`,
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
