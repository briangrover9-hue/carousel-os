#!/usr/bin/env node
'use strict';
// leak-scan: find names and personal paths that should not ship. Zero dependencies.
//
//   node scripts/leak-scan.js [--root DIR] [--tokens FILE ...]
//
// Token files hold one name per line (# comments allowed). They live outside the repository, because
// the names are the thing you are keeping out. $CAROUSEL_LEAK_TOKENS may also name one or more files
// (separated by the platform path delimiter). A token matches as a whole word, case folded, accents
// stripped. A token with no word characters at its edges matches as plain text.
// Without a token file the scan still runs its built-in checks (personal home paths, email
// addresses) and says that no name list was given.
// Exit 1 on any hit.

const fs = require('fs');
const path = require('path');

const TEXT = new Set(['.md', '.js', '.json', '.py', '.txt', '.yml', '.yaml', '.sh', '.toml', '.html', '.csv', '']);
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.carousel-venv', 'out', 'build', 'dist']);
// Addresses on reserved or invented example domains are fixtures, not leaks.
const ALLOWED_EMAIL = /^(noreply|no-reply)@|@([a-z0-9-]+\.)*(example\.(com|org|net)|example-company\.com|host\.tld|invalid|test)$/i;

function fold(s) { return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function loadTokens(files) {
  const out = [];
  files.forEach((f) => {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line) => {
      const t = line.split('#')[0].trim();
      if (t) out.push(t);
    });
  });
  return out;
}

function tokenRegex(t) {
  const f = esc(fold(t));
  const left = /^\w/.test(t) ? '(?<![\\p{L}\\p{N}_])' : '';
  const right = /\w$/.test(t) ? '(?![\\p{L}\\p{N}_])' : '';
  return new RegExp(left + f + right, 'u');
}

function* files(dir, rel) {
  for (const d of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (SKIP_DIRS.has(d.name)) continue;
    const r = rel ? rel + '/' + d.name : d.name;
    if (d.isDirectory()) yield* files(dir, r);
    else if (TEXT.has(path.extname(d.name).toLowerCase())) yield r;
  }
}

function scan(root, tokenFiles) {
  const hits = [];
  const toks = loadTokens(tokenFiles).map((t) => ({ t, re: tokenRegex(t) }));
  const builtin = [
    { name: 'home path', re: /\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\/ },
  ];
  let scanned = 0;
  for (const rel of files(root, '')) {
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { continue; }
    scanned++;
    text.split(/\r?\n/).forEach((line, i) => {
      const where = `${rel}:${i + 1}`;
      const folded = fold(line);
      builtin.forEach((b) => { if (b.re.test(line)) hits.push(`${where}: ${b.name}`); });
      (line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).forEach((m) => {
        if (!ALLOWED_EMAIL.test(m)) hits.push(`${where}: email address ${m}`);
      });
      toks.forEach((k) => { if (k.re.test(folded)) hits.push(`${where}: token from your list`); });
    });
  }
  return { hits, scanned, tokens: toks.length };
}

function main(argv) {
  let root = process.cwd();
  const tokenFiles = [];
  for (let i = 0; i < argv.length; i++) {
    const need = () => { if (!argv[i + 1] || argv[i + 1].startsWith('--')) { console.log(argv[i] + ' needs a value\nusage: node scripts/leak-scan.js [--root DIR] [--tokens FILE ...]'); return false; } return true; };
    if (argv[i] === '--root') { if (!need()) return 2; root = path.resolve(argv[++i]); }
    else if (argv[i] === '--tokens') { if (!need()) return 2; tokenFiles.push(path.resolve(argv[++i])); }
    else { console.log('usage: node scripts/leak-scan.js [--root DIR] [--tokens FILE ...]'); return 2; }
  }
  (process.env.CAROUSEL_LEAK_TOKENS || '').split(path.delimiter).filter(Boolean).forEach((f) => tokenFiles.push(path.resolve(f)));
  const missingFile = tokenFiles.find((f) => !fs.existsSync(f));
  if (missingFile) { console.log('token file not found: ' + missingFile); return 2; }
  const r = scan(root, tokenFiles);
  // The scan prints where a hit is and never the token itself.
  r.hits.forEach((h) => console.log('LEAK  ' + h));
  if (!r.tokens) console.log('note: no token list given; only the built-in checks ran');
  console.log(`leak-scan: ${r.scanned} files, ${r.tokens} tokens, ${r.hits.length} hits`);
  return r.hits.length ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { scan, main };
