#!/usr/bin/env node
'use strict';

const { version } = require('../package.json');

const COMMANDS = {
  install: () => require('./commands/install'),
  update: () => require('./commands/update'),
  doctor: () => require('./commands/doctor'),
  uninstall: () => require('./commands/uninstall'),
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {};
  let command = 'install'; // default

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { flags.help = true; continue; }
    if (arg === '--version' || arg === '-v') { flags.version = true; continue; }
    if (arg === '--non-interactive') { flags.nonInteractive = true; continue; }
    if (arg === '--yes' || arg === '-y') { flags.yes = true; continue; }
    if (arg === '--mcp' && args[i + 1]) { flags.mcp = args[++i]; continue; }
    if (!arg.startsWith('-') && COMMANDS[arg]) { command = arg; continue; }
  }

  return { command, flags };
}

function showHelp() {
  console.log(`
  supermind-claude v${version}

  Usage: supermind-claude [command] [options]

  Commands:
    install     Full global setup (default)
    update      Refresh hooks, skills, and templates
    doctor      Verify installation health
    uninstall   Remove all Supermind components

  Options:
    --non-interactive   Skip all prompts, use defaults
    --mcp <mode>        MCP setup: docker, direct, or skip
    --yes, -y           Auto-confirm destructive operations
    --help, -h          Show this help
    --version, -v       Show version
`);
}

async function main() {
  const { command, flags } = parseArgs(process.argv);

  if (flags.version) { console.log(version); process.exit(0); }
  if (flags.help) { showHelp(); process.exit(0); }

  const run = COMMANDS[command]();
  await run(flags);
}

main().catch(err => {
  console.error(`\n  \x1b[31m\u2717\x1b[0m ${err.message}\n`);
  process.exit(1);
});
