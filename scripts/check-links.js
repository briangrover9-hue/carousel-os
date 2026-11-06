#!/usr/bin/env node
'use strict';
// check-links: every relative markdown link in the repository resolves to a file. Zero dependencies.
//
//   node scripts/check-links.js [--root DIR]
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['.git', 'node_modules', '__pycache__', '.carousel-venv', 'out', 'build', 'dist']);

function* mdFiles(dir, rel) {
  for (const d of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (SKIP.has(d.name)) continue;
    const r = rel ? rel + '/' + d.name : d.name;
    if (d.isDirectory()) yield* mdFiles(dir, r);
    else if (d.name.endsWith('.md')) yield r;
  }
}

function check(root) {
  const bad = [];
  let n = 0;
  for (const rel of mdFiles(root, '')) {
    let fenced = false;
    fs.readFileSync(path.join(root, rel), 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return; }
      if (fenced) return;
      const plain = line.replace(/`[^`]*`/g, '');
      const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
      let m;
      while ((m = re.exec(plain))) {
        const target = m[1];
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        n++;
        const file = target.split('#')[0];
        if (!file) continue;
        if (!fs.existsSync(path.resolve(root, path.dirname(rel), file))) bad.push(`${rel}:${i + 1}: link to ${target} does not resolve`);
      }
    });
  }
  return { bad, n };
}

function main(argv) {
  let root = process.cwd();
  if (argv[0] === '--root') { if (!argv[1]) { console.error('check-links: --root needs a folder\nusage: node scripts/check-links.js [--root DIR]'); return 2; } root = path.resolve(argv[1]); }
  else if (argv.length) { console.error('check-links: unexpected argument ' + argv[0] + '\nusage: node scripts/check-links.js [--root DIR]'); return 2; }
  const r = check(root);
  r.bad.forEach((b) => console.error('FAIL  ' + b));
  console.log(`check-links: ${r.n} relative links, ${r.bad.length} broken`);
  return r.bad.length ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { check };
