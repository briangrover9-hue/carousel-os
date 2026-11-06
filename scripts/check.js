#!/usr/bin/env node
'use strict';
// check: the whole repository gate. `npm run check` runs this. Zero dependencies.
//
//   node scripts/check.js [--tokens FILE ...]
//
// Steps: process checks, process tests, installer tests, link check, leak scan.
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const USAGE = 'usage: node scripts/check.js [--tokens FILE ...]';
const argv = process.argv.slice(2);
const tokens = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tokens' && argv[i + 1] && !argv[i + 1].startsWith('--')) tokens.push(argv[++i]);
  else if (argv[i] === '-h' || argv[i] === '--help') { console.log(USAGE); process.exit(0); }
  else { console.error((argv[i] === '--tokens' ? '--tokens needs a file name' : 'unknown argument ' + argv[i]) + '\n' + USAGE); process.exit(2); }
}

const steps = [
  ['process checks', ['scripts/check-process.js']],
  ['process tests', ['tests/process/run.js']],
  ['installer tests', ['tests/installer/run.js']],
  ['script tests', ['tests/scripts/scripts.test.js']],
  ['example scanner tests', ['tests/example/scan.test.js']],
  ['link check', ['scripts/check-links.js']],
  ['leak scan', ['scripts/leak-scan.js'].concat(...tokens.map((t) => ['--tokens', t]))],
];

let failed = 0;
steps.forEach(([name, args]) => {
  console.log(`\n== ${name}`);
  const r = cp.spawnSync(process.execPath, args.map((a, i) => (i === 0 ? path.join(ROOT, a) : a)), { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.error(`!! ${name} failed`); }
});
console.log(`\ncheck: ${steps.length - failed} of ${steps.length} steps passed`);
process.exit(failed ? 1 : 0);
