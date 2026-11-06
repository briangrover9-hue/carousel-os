'use strict';
// A tiny test harness: plain node assert, no dependencies.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const SKIP = new Set(['.git', 'node_modules', 'engine', '.github', 'decks']);

let passed = 0;
let failed = 0;
const temps = [];

function tmpDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'carousel-test-'));
  temps.push(d);
  return d;
}

function copyDir(src, dst, rel) {
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach((d) => {
    const r = rel ? rel + '/' + d.name : d.name;
    if (SKIP.has(d.name)) return;
    if (rel === 'tests' && d.name !== 'process') return;
    if (d.isDirectory()) copyDir(path.join(src, d.name), path.join(dst, d.name), r);
    else fs.copyFileSync(path.join(src, d.name), path.join(dst, d.name));
  });
}

// A copy of the real repo with no engine/ folder, safe to mutate.
function copyRepo() {
  const dir = tmpDir();
  copyDir(ROOT, dir, '');
  // The installer belongs to another part of the repo. Tests must not depend on whether it exists yet.
  const installer = path.join(dir, 'scripts', 'install.js');
  if (!fs.existsSync(installer)) fs.writeFileSync(installer, '// stand-in for the installer in test copies\n');
  return dir;
}

function edit(dir, rel, fn) {
  const file = path.join(dir, rel);
  // Tests edit text with \n. A checkout with CRLF line endings is read as LF and written back as LF.
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, fn(before));
}

function node(script, args, cwd) {
  const r = spawnSync(process.execPath, [script].concat(args || []), { cwd: cwd || ROOT, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function check(dir, args) {
  return node(path.join(SCRIPTS, 'check-process.js'), ['--root', dir].concat(args || []), dir);
}

// The mutated copy must fail the named check, with the needle in the output.
function mustFail(dir, name, needle) {
  const r = check(dir);
  assert.strictEqual(r.code, 1, `expected exit 1, got ${r.code}\n${r.out}`);
  assert.ok(r.out.includes(`FAIL ${name}`), `expected FAIL ${name}\n${r.out}`);
  if (needle) assert.ok(r.out.includes(needle), `expected output to contain "${needle}"\n${r.out}`);
}

function mustPass(dir) {
  const r = check(dir);
  assert.strictEqual(r.code, 0, `expected exit 0, got ${r.code}\n${r.out}`);
}

// ---- a minimal .pptx writer (stored zip, no dependencies) so tests can draw decks of their own
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(files, deflate) {
  const locals = []; const central = []; let offset = 0;
  files.forEach(([name, data]) => {
    const raw = Buffer.from(data); const comp = deflate ? zlib.deflateRawSync(raw) : raw; const nm = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(deflate ? 8 : 0, 8);
    lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc32(raw), 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(deflate ? 8 : 0, 10);
    ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc32(raw), 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nm, comp); central.push(Buffer.concat([ch, nm])); offset += 30 + nm.length + comp.length;
  });
  const cd = Buffer.concat(central); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat(locals.concat([cd, end]));
}
const xmlEsc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// texts: one string per slide. A string may hold several paragraphs, split on "\n".
function makePptx(texts, opts) {
  const o = opts || {};
  const files = [['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>']];
  const ids = texts.map((t, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`);
  files.push(['ppt/presentation.xml', `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>${(o.reverseOrder ? ids.slice().reverse() : ids).join('')}</p:sldIdLst></p:presentation>`]);
  files.push(['ppt/_rels/presentation.xml.rels', `<Relationships>${texts.map((t, i) => `<Relationship Id="rId${i + 1}" Type="slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`]);
  texts.forEach((t, i) => {
    const paras = String(t).split('\n').map((p) => `<a:p><a:r><a:t>${xmlEsc(p)}</a:t></a:r></a:p>`).join('');
    files.push([`ppt/slides/slide${i + 1}.xml`, `<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree><p:sp><p:txBody>${paras}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`]);
  });
  if (o.notes) files.push(['ppt/notesSlides/notesSlide1.xml', `<p:notes xmlns:a="a"><a:p><a:r><a:t>${xmlEsc(o.notes)}</a:t></a:r></a:p></p:notes>`]);
  return zip(files, !!o.deflate);
}

// Rewrite the four hashes in a plan's Check section from the files as they are now.
function syncHashes(dir, planRel) {
  const r = check(dir, ['--hashes', planRel]);
  assert.strictEqual(r.code, 0, r.out);
  const h = {};
  r.out.split('\n').forEach((l) => { const m = /^(Deck|Ledger|Build) sha256: ([0-9a-f]{64})$/.exec(l); if (m) h[m[1]] = m[2]; });
  edit(dir, planRel, (t) => t
    .replace(/^Deck sha256 before tools: .*$/m, `Deck sha256 before tools: ${h.Deck}`)
    .replace(/^Deck sha256: .*$/m, `Deck sha256: ${h.Deck}`)
    .replace(/^Ledger sha256: .*$/m, `Ledger sha256: ${h.Ledger}`)
    .replace(/^Build sha256: .*$/m, `Build sha256: ${h.Build}`));
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${String(e.message).split('\n').join('\n       ')}`);
  }
}

function done() {
  temps.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* ignore */ } });
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

module.exports = { assert, fs, path, ROOT, SCRIPTS, tmpDir, copyRepo, edit, node, check, makePptx, syncHashes, mustFail, mustPass, test, done };
