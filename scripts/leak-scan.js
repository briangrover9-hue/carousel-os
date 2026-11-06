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
// It also opens every .pptx it finds: the creator and last-modified-by in docProps/core.xml must be the neutral
// "Carousel OS example", app.xml may name no company or manager, and the token list, email and home-path checks run
// on the document properties and on all slide and notes text.
// Findings and errors go to stderr, the summary line to stdout. Exit 1 on any hit, 2 on a usage error.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NEUTRAL = 'Carousel OS example';
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
    else if (TEXT.has(path.extname(d.name).toLowerCase()) || /\.pptx$/i.test(d.name)) yield r;
  }
}


// ---- a .pptx is a zip of XML: read the central directory, inflate the entries we need
function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file');
  const out = new Map();
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    const nameLen = buf.readUInt16LE(off + 28);
    out.set(buf.toString('utf8', off + 46, off + 46 + nameLen), { method: buf.readUInt16LE(off + 10), size: buf.readUInt32LE(off + 20), header: buf.readUInt32LE(off + 42) });
    off += 46 + nameLen + buf.readUInt16LE(off + 30) + buf.readUInt16LE(off + 32);
  }
  return out;
}
function zipRead(buf, e) {
  const start = e.header + 30 + buf.readUInt16LE(e.header + 26) + buf.readUInt16LE(e.header + 28);
  const data = buf.subarray(start, start + e.size);
  return (e.method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
}
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Checks the lines of text from one place with the built-in and token rules, appending hits.
function checkText(where, text, toks, hits) {
  text.split(/\r?\n/).forEach((line, i) => {
    const at = `${where}:${i + 1}`;
    if (/\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\/.test(line)) hits.push(`${at}: home path`);
    (line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).forEach((m) => { if (!ALLOWED_EMAIL.test(m)) hits.push(`${at}: email address ${m}`); });
    const folded = fold(line);
    toks.forEach((k) => { if (k.re.test(folded)) hits.push(`${at}: token from your list`); });
  });
}

function scanDeck(rel, buf, toks, hits) {
  let entries;
  try { entries = zipEntries(buf); } catch (e) { hits.push(`${rel}: cannot read this .pptx (${e.message})`); return; }
  const read = (name) => (entries.has(name) ? zipRead(buf, entries.get(name)) : '');
  const core = read('docProps/core.xml');
  [['dc:creator', 'creator'], ['cp:lastModifiedBy', 'last-modified-by']].forEach(([tag, label]) => {
    const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(core);
    if (m && unxml(m[1]).trim() !== NEUTRAL) hits.push(`${rel}!docProps/core.xml: ${label} is not the neutral "${NEUTRAL}"`);
  });
  const app = read('docProps/app.xml');
  ['Company', 'Manager'].forEach((tag) => {
    const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(app);
    if (m && m[1].trim()) hits.push(`${rel}!docProps/app.xml: names a ${tag.toLowerCase()}`);
  });
  checkText(`${rel}!docProps/core.xml`, unxml(core.replace(/<[^>]+>/g, '\n')), toks, hits);
  checkText(`${rel}!docProps/app.xml`, unxml(app.replace(/<[^>]+>/g, '\n')), toks, hits);
  [...entries.keys()].filter((k) => /^ppt\/(slides|notesSlides)\/[^/]+\.xml$/.test(k)).sort().forEach((k) => {
    const text = (read(k).match(/<a:t>[\s\S]*?<\/a:t>/g) || []).map((t) => unxml(t.replace(/<[^>]+>/g, ''))).join('\n');
    checkText(`${rel}!${k}`, text, toks, hits);
  });
}

function scan(root, tokenFiles) {
  const hits = [];
  const toks = loadTokens(tokenFiles).map((t) => ({ t, re: tokenRegex(t) }));
  const builtin = [
    { name: 'home path', re: /\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\/ },
  ];
  let scanned = 0;
  for (const rel of files(root, '')) {
    if (/\.pptx$/i.test(rel)) {
      try { scanDeck(rel, fs.readFileSync(path.join(root, rel)), toks, hits); scanned++; } catch (e) { hits.push(`${rel}: cannot read this file`); }
      continue;
    }
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
    const need = () => { if (!argv[i + 1] || argv[i + 1].startsWith('--')) { console.error('leak-scan: ' + argv[i] + ' needs a value\nusage: node scripts/leak-scan.js [--root DIR] [--tokens FILE ...]'); return false; } return true; };
    if (argv[i] === '--root') { if (!need()) return 2; root = path.resolve(argv[++i]); }
    else if (argv[i] === '--tokens') { if (!need()) return 2; tokenFiles.push(path.resolve(argv[++i])); }
    else { console.error('leak-scan: unknown argument ' + argv[i] + '\nusage: node scripts/leak-scan.js [--root DIR] [--tokens FILE ...]'); return 2; }
  }
  (process.env.CAROUSEL_LEAK_TOKENS || '').split(path.delimiter).filter(Boolean).forEach((f) => tokenFiles.push(path.resolve(f)));
  const missingFile = tokenFiles.find((f) => !fs.existsSync(f));
  if (missingFile) { console.error('leak-scan: token file not found: ' + missingFile); return 2; }
  const r = scan(root, tokenFiles);
  // The scan prints where a hit is and never the token itself.
  r.hits.forEach((h) => console.error('LEAK  ' + h));
  if (!r.tokens) console.log('note: no token list given; only the built-in checks ran');
  console.log(`leak-scan: ${r.scanned} files, ${r.tokens} tokens, ${r.hits.length} hits`);
  return r.hits.length ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { scan, main };
