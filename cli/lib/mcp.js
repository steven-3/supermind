'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const { PATHS, ensureDir, getPackageRoot } = require('./platform');
const logger = require('./logger');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

function isDockerAvailable() {
  try {
    execSync('docker compose version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function getDirectMcpConfig() {
  const configPath = path.join(getPackageRoot(), 'airis', 'mcp-config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

async function setupDocker() {
  const airisSource = path.join(getPackageRoot(), 'airis');
  ensureDir(PATHS.airisDir);
  for (const file of ['docker-compose.yml', 'mcp-config.json']) {
    const src = path.join(airisSource, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(PATHS.airisDir, file));
    }
  }
  logger.success('AIRIS config copied');

  if (isDockerAvailable()) {
    logger.info('Starting AIRIS gateway...');
    try {
      execSync('docker compose up -d', { cwd: PATHS.airisDir, stdio: 'pipe', timeout: 60000 });
      logger.success('AIRIS gateway started');
    } catch {
      logger.warn('Could not start AIRIS gateway — start manually with: docker compose up -d');
    }
  } else {
    logger.warn('Docker not found — install Docker and run: docker compose up -d');
  }
}

async function promptApiKeys(flags) {
  const keys = {};
  if (flags.nonInteractive) return keys;

  const tavily = await prompt('  Tavily API key (press Enter to skip): ');
  if (tavily) keys.TAVILY_API_KEY = tavily;

  return keys;
}

function setupDirect(apiKeys) {
  const config = getDirectMcpConfig();
  const servers = config.mcpServers || {};

  // Inject API keys into server configs that need them
  if (apiKeys.TAVILY_API_KEY && servers.tavily) {
    servers.tavily.env = { TAVILY_API_KEY: apiKeys.TAVILY_API_KEY };
  }

  // Remove servers that require missing API keys
  if (!apiKeys.TAVILY_API_KEY && servers.tavily?.env?.TAVILY_API_KEY?.startsWith('$')) {
    logger.warn('Skipping Tavily (no API key)');
    delete servers.tavily;
  }

  return servers;
}

async function setupMcp(flags) {
  // Determine mode from flags or prompt
  let mode = flags.mcp;
  if (!mode && !flags.nonInteractive) {
    console.log('\n  MCP Server Setup:');
    console.log('    1) Docker (AIRIS gateway — single endpoint, recommended)');
    console.log('    2) Direct (individual servers via npx/uvx)');
    console.log('    3) Skip\n');
    const answer = await prompt('  Choose [1/2/3]: ');
    mode = { '1': 'docker', '2': 'direct', '3': 'skip' }[answer] || 'skip';
  }
  if (!mode || mode === 'skip') {
    logger.info('Skipping MCP setup');
    return {};
  }

  if (mode === 'docker') {
    await setupDocker();
    return { mode: 'docker' }; // Docker mode uses AIRIS, not settings.json mcpServers
  }

  if (mode === 'direct') {
    const apiKeys = await promptApiKeys(flags);
    const servers = setupDirect(apiKeys);
    logger.success(`Configured ${Object.keys(servers).length} MCP servers`);
    return { mode: 'direct', mcpServers: servers };
  }

  return { mode: 'skip' };
}

function detectMcpMode() {
  // Check if AIRIS docker-compose exists (docker mode was used)
  if (fs.existsSync(path.join(PATHS.airisDir, 'docker-compose.yml'))) {
    return 'docker';
  }
  // Check if direct MCP servers are in settings.json
  try {
    const settings = JSON.parse(fs.readFileSync(PATHS.settings, 'utf-8'));
    const servers = settings.mcpServers || {};
    if (servers.context7 || servers.playwright || servers.serena || servers.tavily) {
      return 'direct';
    }
  } catch {}
  return 'skip';
}

module.exports = { setupMcp, detectMcpMode };
