'use strict';

const { version } = require('../../package.json');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const R = '\x1b[0m';

function banner() {
  console.log(`\n${CYAN}${BOLD}  \u26a1 Supermind${R} ${DIM}v${version}${R}`);
  console.log(`${DIM}  Complete Claude Code setup${R}\n`);
}

function step(n, total, message) {
  console.log(`${DIM}[${n}/${total}]${R} ${message}`);
}

function success(message) {
  console.log(`  ${GREEN}\u2713${R} ${message}`);
}

function warn(message) {
  console.log(`  ${YELLOW}\u26a0${R} ${message}`);
}

function error(message) {
  console.log(`  ${RED}\u2717${R} ${message}`);
}

function info(message) {
  console.log(`  ${DIM}${message}${R}`);
}

module.exports = { banner, step, success, warn, error, info };
