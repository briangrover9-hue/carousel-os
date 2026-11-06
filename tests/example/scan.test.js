#!/usr/bin/env node
'use strict';
// Tests for the reference scanner in docs/build-your-engine/example/. Zero dependencies. Every test builds
// its own tiny .pptx in code (a zip of slide XML), so each check has a passing and a failing deck.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const EX = path.join(ROOT, 'docs', 'build-your-engine', 'example');
const SCAN = path.join(EX, 'scan.js');
const RENDER = path.join(EX, 'render.js');
const RUN_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-scan-'));
let seq = 0;
let passed = 0;
let failed = 0;

function tmp() { const d = path.join(RUN_DIR, 'd' + (++seq)); fs.mkdirSync(d); return d; }
function test(name, fn) {
  try { fn(); passed++; console.log('ok    ' + name); } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || 'expected equal') + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }
function yes(c, msg) { if (!c) throw new Error(msg); }

const { zip } = require('../helpers/minizip.js');

// ---- slide builders
function shape(o) {
  const run = `<a:r><a:rPr${o.size ? ` sz="${o.size * 100}"` : ''}>${o.color ? `<a:solidFill><a:srgbClr val="${o.color}"/></a:solidFill>` : ''}</a:rPr><a:t>${o.text}</a:t></a:r>`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="2" name="${o.name || 'TextBox 1'}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${o.fill ? `<a:solidFill><a:srgbClr val="${o.fill}"/></a:solidFill>` : ''}</p:spPr><p:txBody><a:p>${run}</a:p></p:txBody></p:sp>`;
}
function slide(shapes, bg) {
  return `<p:sld xmlns:a="a" xmlns:p="p"><p:cSld>${bg ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill></p:bgPr></p:bg>` : ''}<p:spTree>${shapes.join('')}</p:spTree></p:cSld></p:sld>`;
}
function deck(slides, deflate) {
  const files = {};
  slides.forEach((s, i) => { files[`ppt/slides/slide${i + 1}.xml`] = s; });
  const file = path.join(tmp(), 'deck.pptx');
  fs.writeFileSync(file, zip(files, deflate));
  return file;
}
function scan(deckFile, extra) {
  const out = tmp();
  const r = cp.spawnSync(process.execPath, [SCAN, deckFile, out].concat(extra || []), { encoding: 'utf8' });
  const lines = (r.stdout || '').split('\n').filter(Boolean);
  return { code: r.status, last: lines[lines.length - 1], out: r.stdout, dir: out };
}
const headline = (text) => shape({ name: 'Headline 1', text, size: 28 });

// ---- headline length (limit 72 in tokens.json)
test('headline length: a short headline passes, an 80 character headline fails and names the slide', () => {
  let r = scan(deck([slide([headline('Skips fell by half in the second quarter')])]));
  eq(r.code, 0, r.out); eq(r.last, 'scan: 0 FAIL, 0 CANDIDATE');
  r = scan(deck([slide([headline('Short one')]), slide([headline('x'.repeat(80))])]));
  eq(r.code, 1, r.out);
  yes(/FAIL slide 2 headline length: 80 characters, limit 72/.test(r.out), r.out);
  eq(r.last, 'scan: 1 FAIL, 0 CANDIDATE');
});
test('headline length: within 10 percent of the limit is a CANDIDATE and does not fail', () => {
  const r = scan(deck([slide([headline('y'.repeat(68))])]));
  eq(r.code, 0, r.out); eq(r.last, 'scan: 0 FAIL, 1 CANDIDATE');
});
test('headline length: with no named headline, the first sentence of the first text is the headline', () => {
  const long = 'Members who miss two weeks in a row cancel at three times the base rate of everyone else here. Source: file.';
  let r = scan(deck([slide([shape({ text: long })])]));
  eq(r.code, 1, r.out);
  r = scan(deck([slide([shape({ text: 'A short claim. ' + 'z'.repeat(200) })])]));
  eq(r.code, 0, 'a long body after a short first sentence failed: ' + r.out);
});

// ---- type sizes
test('type sizes: a size on the scale passes, a size off it fails', () => {
  eq(scan(deck([slide([headline('Fine'), shape({ name: 'Body', text: 'Body text', size: 14 })])])).code, 0);
  const r = scan(deck([slide([headline('Fine'), shape({ name: 'Body', text: 'Body text', size: 30 })])]));
  eq(r.code, 1, r.out);
  yes(/FAIL slide 1 type sizes: 30pt is not on the scale/.test(r.out), r.out);
});

// ---- colors
test('colors: a palette color passes, a color off the palette fails', () => {
  eq(scan(deck([slide([headline('Fine'), shape({ name: 'Box', text: 'Box', fill: '3D84EA', color: 'FFFFFF' })])])).code, 1, 'white on blue is under 4.5:1, so this is the contrast test, not the color test');
  const ok = scan(deck([slide([headline('Fine'), shape({ name: 'Box', text: 'Box', fill: 'FFFFFF', color: '0F141D' })])]));
  eq(ok.code, 0, ok.out);
  const r = scan(deck([slide([headline('Fine'), shape({ name: 'Box', text: 'Box', fill: '123456', color: 'FFFFFF' })])]));
  eq(r.code, 1, r.out);
  yes(/FAIL slide 1 colors: #123456 is not in the palette/.test(r.out), r.out);
});

// ---- text contrast
test('text contrast: ink on white passes, vermilion on blue fails with the ratio', () => {
  eq(scan(deck([slide([shape({ name: 'Box', text: 'Readable', fill: 'FFFFFF', color: '0F141D' })])])).code, 0);
  const r = scan(deck([slide([shape({ name: 'Box', text: 'Hard to read', fill: '3D84EA', color: 'F0764F' })])]));
  eq(r.code, 1, r.out);
  yes(/FAIL slide 1 text contrast: #F0764F on #3D84EA is \d\.\d\d:1, under 4\.5:1/.test(r.out), r.out);
});
test('text contrast: the slide background counts as the fill under a run, and a run with no color is NOT SCANNED, never passed', () => {
  let r = scan(deck([slide([shape({ name: 'Box', text: 'On the ground', color: '555B66' })], 'F5F8FB')]));
  eq(r.code, 0, r.out);
  r = scan(deck([slide([shape({ name: 'Box', text: 'On the ground', color: 'FFFFFF' })], 'F5F8FB')]));
  eq(r.code, 1, 'white on the ground passed: ' + r.out);
  r = scan(deck([slide([shape({ name: 'Box', text: 'No color of its own' })])]));
  eq(r.code, 0, r.out);
  yes(/1 text runs have no color of their own or sit on no known fill: NOT SCANNED/.test(fs.readFileSync(path.join(r.dir, 'scan-report.md'), 'utf8')), 'the report does not count the run as NOT SCANNED');
});

// ---- percentage with no base
test('percentage base: a percent beside a count passes, a bare percent fails, a year is not a base', () => {
  eq(scan(deck([slide([headline('Skips fell'), shape({ name: 'Body', text: '61% of 4,200 members skipped twice', size: 14 })])])).code, 0);
  eq(scan(deck([slide([headline('Skips fell'), shape({ name: 'Body', text: '61% of members skipped twice, n=300', size: 14 })])])).code, 0);
  let r = scan(deck([slide([headline('Skips fell'), shape({ name: 'Body', text: '61% of members skipped twice', size: 14 })])]));
  eq(r.code, 1, r.out);
  yes(/FAIL slide 1 percentage base: 61% with no base/.test(r.out), r.out);
  r = scan(deck([slide([headline('Skips fell'), shape({ name: 'Body', text: '61% in 2026', size: 14 })])]));
  eq(r.code, 1, 'a year was taken for a base: ' + r.out);
});

// ---- the contract: exit codes, the last line, the report, the deck untouched
test('exit codes: 0 for a pass, 1 for a FAIL, 2 for a missing deck, a file that is not a zip, missing tokens, no arguments', () => {
  const good = deck([slide([headline('Fine')])]);
  eq(scan(good).code, 0);
  eq(scan(deck([slide([headline('q'.repeat(90))])])).code, 1);
  let r = scan(path.join(RUN_DIR, 'nothing.pptx'));
  eq(r.code, 2, r.out); yes(/^scan: MISSING/.test(r.last), r.last);
  const notZip = path.join(tmp(), 'x.pptx');
  fs.writeFileSync(notZip, 'this is not a zip');
  eq(scan(notZip).code, 2);
  r = scan(good, ['--tokens', path.join(RUN_DIR, 'no-tokens.json')]);
  eq(r.code, 2, r.out); yes(/cannot read tokens/.test(r.last), r.last);
  eq(cp.spawnSync(process.execPath, [SCAN], { encoding: 'utf8' }).status, 2);
});
test('the scan writes both reports, ends with the one-line summary and leaves the deck unchanged', () => {
  const file = deck([slide([headline('x'.repeat(90))])], true);
  const before = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const r = scan(file);
  yes(/^scan: \d+ FAIL, \d+ CANDIDATE$/.test(r.last), r.last);
  const md = fs.readFileSync(path.join(r.dir, 'scan-report.md'), 'utf8');
  ['## headline length: FAIL', '## type sizes: PASS', '## colors: PASS', '## text contrast: PASS', '## percentage base: PASS'].forEach((h) => yes(md.includes(h), 'report lacks "' + h + '"'));
  eq(JSON.parse(fs.readFileSync(path.join(r.dir, 'scan-report.json'), 'utf8')).findings.length, 1, 'json findings');
  eq(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), before, 'the scan changed the deck');
});
test('a deflated deck and a stored deck give the same result', () => {
  const slides = [slide([headline('x'.repeat(90)), shape({ name: 'Body', text: 'Body', size: 30 })])];
  const a = scan(deck(slides, false));
  const b = scan(deck(slides, true));
  eq(a.last, b.last);
  eq(a.out, b.out);
});
test('a custom tokens file changes the limits', () => {
  const t = path.join(tmp(), 'tokens.json');
  fs.writeFileSync(t, JSON.stringify({ palette: { ink: '0F141D' }, type: { scale: [30] }, headline: { maxChars: 10 }, contrast: { min: 4.5 } }));
  const r = scan(deck([slide([shape({ name: 'Headline 1', text: 'A headline of fifteen', size: 30 })])]), ['--tokens', t]);
  eq(r.code, 1, r.out);
  yes(/limit 10/.test(r.out) && !/type sizes/.test(r.out), r.out);
});

// ---- the render stub and the registration
test('the render stub writes an outline per slide, says it is a stub, and exits 2 on a missing deck', () => {
  const out = tmp();
  const r = cp.spawnSync(process.execPath, [RENDER, deck([slide([headline('First one')]), slide([headline('Second one')])]), out], { encoding: 'utf8' });
  eq(r.status, 0, r.stdout);
  yes(/^render stub: wrote 2 slide outlines/.test(r.stdout.trim()), r.stdout);
  const o = fs.readFileSync(path.join(out, 'outline.txt'), 'utf8');
  yes(/^STUB: text only/.test(o) && /Slide 2\nSecond one/.test(o), o);
  eq(cp.spawnSync(process.execPath, [RENDER, path.join(RUN_DIR, 'no.pptx'), out], { encoding: 'utf8' }).status, 2);
});
test('carousel.config.json registers scan and render with {deck} and {out}, and the files it names exist', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(EX, 'carousel.config.json'), 'utf8'));
  eq(Object.keys(cfg).join(), 'engine');
  ['scan', 'render'].forEach((k) => {
    const t = cfg.engine[k];
    yes(t && t.includes('{deck}') && t.includes('{out}'), k + ' template lacks {deck} or {out}: ' + t);
    yes(fs.existsSync(path.join(ROOT, /node (\S+)/.exec(t)[1])), k + ' names a file that does not exist: ' + t);
  });
  yes(!Object.keys(cfg.engine).some((k) => !['scan', 'render', 'tools'].includes(k)), 'an unread key under engine');
});
if (process.platform !== 'win32') {
  test('the registered scan template runs on the worked example deck, as the README shows', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(EX, 'carousel.config.json'), 'utf8'));
    const out = tmp();
    const cmd = cfg.engine.scan.replace('{deck}', 'plans/example/wrenmoor-skip-cancel.pptx').replace('{out}', out);
    const r = cp.spawnSync('sh', ['-c', cmd], { cwd: ROOT, encoding: 'utf8' });
    eq(r.status, 1, r.stdout);
    eq(r.stdout.trim().split('\n').pop(), 'scan: 3 FAIL, 1 CANDIDATE');
    const readme = fs.readFileSync(path.join(EX, 'README.md'), 'utf8');
    r.stdout.trim().split('\n').forEach((line) => yes(readme.includes(line), 'the README output does not hold this line: ' + line));
  });
}

fs.rmSync(RUN_DIR, { recursive: true, force: true });
console.log(`\nexample scanner tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
