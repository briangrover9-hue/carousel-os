#!/usr/bin/env node
'use strict';
// Run every *.test.js in this folder. Exits non-zero when any file fails.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
let failed = 0;
files.forEach((f) => {
  console.log(f);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) failed++;
});
console.log(failed ? `process tests: ${failed} of ${files.length} files failed` : `process tests: all ${files.length} files passed`);
process.exit(failed ? 1 : 0);
