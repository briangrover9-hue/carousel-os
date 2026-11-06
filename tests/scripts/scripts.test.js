#!/usr/bin/env node
'use strict';
// Behavior tests for scripts/check.js, scripts/check-links.js and scripts/leak-scan.js. Zero dependencies.
// Each test builds its own temp folder, so runs never share state.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { zip } = require('../helpers/minizip.js');

const ROOT = path.resolve(__dirname, '..', '..');
const RUN_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-scripts-'));
let seq = 0;
let passed = 0;
let failed = 0;

function tmp() { const d = path.join(RUN_DIR, 'd' + (++seq)); fs.mkdirSync(d); return d; }
function test(name, fn) {
  try { fn(); passed++; console.log('ok    ' + name); } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || 'expected equal') + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }
function yes(c, msg) { if (!c) throw new Error(msg); }
function write(dir, rel, text) { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; }
function node(script, args, cwd) {
  const r = cp.spawnSync(process.execPath, [script].concat(args || []), { encoding: 'utf8', cwd: cwd || ROOT });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}
// Addresses are built at run time so this file holds none for the leak scan to find.
const ADDR = ['person', 'company.io'].join('@');
const NOREPLY = ['noreply', 'company.io'].join('@');
const REAL = ['real', 'company.io'].join('@');
const lastLine = (s) => s.trim().split('\n').pop();

// ------------------------------------------------------------------ check.js
// A stand-in project: the real check.js, check-links.js and leak-scan.js, and stubs for the other steps.
const STEP_FILES = ['scripts/check-process.js', 'tests/process/run.js', 'tests/installer/run.js', 'tests/scripts/scripts.test.js', 'tests/example/scan.test.js'];
function stubProject(failing) {
  const t = tmp();
  ['check.js', 'check-links.js', 'leak-scan.js'].forEach((f) => write(t, 'scripts/' + f, fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8')));
  STEP_FILES.forEach((f) => write(t, f, `process.exit(${failing === f ? 1 : 0});\n`));
  write(t, 'README.md', 'A clean page. See [the rules](RULES.md).\n');
  write(t, 'RULES.md', '# Rules\n');
  return t;
}

test('check.js passes and says so when every step passes', () => {
  const r = node(path.join(stubProject(null), 'scripts', 'check.js'));
  eq(r.code, 0, r.out + r.err);
  yes(/^check: (\d+) of \1 steps passed$/.test(lastLine(r.out)), lastLine(r.out));
});

test('check.js exits nonzero and names the step when any one step fails', () => {
  STEP_FILES.forEach((f) => {
    const t = stubProject(f);
    const r = node(path.join(t, 'scripts', 'check.js'));
    yes(r.code !== 0, f + ' failed but check.js exited ' + r.code);
    yes(/!! .* failed/.test(r.err), f + ': no failure message on stderr: ' + r.err);
    const m = /^check: (\d+) of (\d+) steps passed$/.exec(lastLine(r.out));
    yes(m && Number(m[1]) === Number(m[2]) - 1, f + ': the summary does not count one failure: ' + lastLine(r.out));
  });
});

test('check.js exits nonzero when only the link check fails, and when only the leak scan fails', () => {
  let t = stubProject(null);
  write(t, 'docs/page.md', 'See [missing](nowhere.md).\n');
  let r = node(path.join(t, 'scripts', 'check.js'));
  yes(r.code !== 0, 'a broken link did not fail check.js');
  yes(/!! link check failed/.test(r.err), r.err);
  t = stubProject(null);
  write(t, 'notes.md', 'Write to ' + ADDR + ' today.\n');
  r = node(path.join(t, 'scripts', 'check.js'));
  yes(r.code !== 0, 'a leaked address did not fail check.js');
  yes(/!! leak scan failed/.test(r.err), r.err);
});

test('check.js rejects unknown flags and a missing --tokens value with usage on stderr', () => {
  ['--bogus', '--tokens'].forEach((a) => {
    const r = node(path.join(ROOT, 'scripts', 'check.js'), [a]);
    eq(r.code, 2, a);
    yes(/usage/i.test(r.err) && r.out === '', a + ' usage is not on stderr alone: ' + r.out + r.err);
  });
});

// ------------------------------------------------------------------ check-links.js
test('check-links reports a broken link with file and line, fails, and keeps the summary on stdout', () => {
  const t = tmp();
  write(t, 'a.md', 'Fine line.\nBroken [here](gone.md) link.\n');
  const r = node(path.join(ROOT, 'scripts', 'check-links.js'), ['--root', t]);
  eq(r.code, 1, r.out + r.err);
  yes(/FAIL  a\.md:2: link to gone\.md does not resolve/.test(r.err), r.err);
  eq(lastLine(r.out), 'check-links: 1 relative links, 1 broken');
});

test('check-links passes good links, with anchors, in subfolders, and skips web links', () => {
  const t = tmp();
  write(t, 'docs/b.md', '# B\n');
  write(t, 'a.md', 'See [b](docs/b.md), [b heading](docs/b.md#b), [web](https://example.com/x), [mail](mailto:x), [top](#top).\n');
  write(t, 'docs/c.md', 'Back to [a](../a.md).\n');
  const r = node(path.join(ROOT, 'scripts', 'check-links.js'), ['--root', t]);
  eq(r.code, 0, r.out + r.err);
  yes(/0 broken/.test(lastLine(r.out)), r.out);
});

test('check-links skips fenced code and inline code, and the generated folders', () => {
  const t = tmp();
  write(t, 'a.md', 'Inline `[x](nope.md)` is code.\n\n```\n[y](nope2.md)\n```\n\nAfter the fence, [ok](a.md).\n');
  write(t, 'out/skipped.md', '[z](nope3.md)\n');
  write(t, 'node_modules/p/x.md', '[z](nope4.md)\n');
  const r = node(path.join(ROOT, 'scripts', 'check-links.js'), ['--root', t]);
  eq(r.code, 0, r.out + r.err);
  eq(lastLine(r.out), 'check-links: 1 relative links, 0 broken');
});

test('check-links catches a link that sits right after a closed fence', () => {
  const t = tmp();
  write(t, 'a.md', '```\ncode\n```\n[late](nope.md)\n');
  const r = node(path.join(ROOT, 'scripts', 'check-links.js'), ['--root', t]);
  eq(r.code, 1, r.out + r.err);
});

// ------------------------------------------------------------------ leak-scan.js
function leak(dir, extra) { return node(path.join(ROOT, 'scripts', 'leak-scan.js'), ['--root', dir].concat(extra || [])); }

test('leak-scan flags an email address, allows example and no-reply addresses, and ignores out/', () => {
  const t = tmp();
  write(t, 'a.md', 'Mail ' + ADDR + ' for details.\n');
  let r = leak(t);
  eq(r.code, 1, r.out + r.err);
  yes(r.err.includes('LEAK  a.md:1: email address ' + ADDR), r.err);
  const ok = tmp();
  write(ok, 'a.md', 'Use name@example.com or ' + NOREPLY + ' or a@mail.example.org here.\n');
  write(ok, 'out/b.md', REAL + '\n');
  r = leak(ok);
  eq(r.code, 0, r.out + r.err);
});

test('leak-scan keeps findings on stderr and the summary on stdout, and finds a listed name without printing it', () => {
  const t = tmp();
  write(t, 'a.md', 'Sales at Zorblax grew.\n');
  const tokens = write(tmp(), 'names.txt', '# invented\nZorblax\n');
  const r = leak(t, ['--tokens', tokens]);
  eq(r.code, 1);
  yes(/LEAK  a\.md:1: token from your list/.test(r.err) && !r.err.includes('Zorblax') && !r.out.includes('Zorblax'), r.out + r.err);
  eq(lastLine(r.out), 'leak-scan: 1 files, 1 tokens, 1 hits');
});

// ---- decks
const CORE = (creator, modifier) => `<?xml version="1.0"?><cp:coreProperties xmlns:cp="c" xmlns:dc="d"><dc:title>T</dc:title><dc:creator>${creator}</dc:creator><cp:lastModifiedBy>${modifier}</cp:lastModifiedBy></cp:coreProperties>`;
const APP = (extra) => `<?xml version="1.0"?><Properties><Application>x</Application>${extra || ''}</Properties>`;
const SLIDE = (text) => `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
function deckDir(over, deflate) {
  const t = tmp();
  const files = Object.assign({
    'docProps/core.xml': CORE('Carousel OS example', 'Carousel OS example'),
    'docProps/app.xml': APP(),
    'ppt/slides/slide1.xml': SLIDE('A plain claim'),
    'ppt/notesSlides/notesSlide1.xml': SLIDE('A plain note'),
  }, over || {});
  fs.writeFileSync(path.join(t, 'deck.pptx'), zip(files, deflate));
  return t;
}

test('leak-scan accepts a deck with the neutral creator and last-modified-by, stored or deflated', () => {
  [false, true].forEach((d) => {
    const r = leak(deckDir(null, d));
    eq(r.code, 0, r.out + r.err);
    eq(lastLine(r.out), 'leak-scan: 1 files, 0 tokens, 0 hits');
  });
});

test('leak-scan fails a deck whose creator or last-modified-by is not the neutral value, without printing the name', () => {
  [CORE('Jane Q Person', 'Carousel OS example'), CORE('Carousel OS example', 'Jane Q Person'), CORE('', 'Carousel OS example')].forEach((core, i) => {
    const r = leak(deckDir({ 'docProps/core.xml': core }));
    eq(r.code, 1, 'case ' + i + ': ' + r.out + r.err);
    yes(/deck\.pptx!docProps\/core\.xml: (creator|last-modified-by) is not the neutral "Carousel OS example"/.test(r.err), r.err);
    yes(!/Jane/.test(r.out + r.err), 'the name was printed: ' + r.err);
  });
});

test('leak-scan fails a deck whose app.xml names a company or manager', () => {
  ['Company', 'Manager'].forEach((tag) => {
    const r = leak(deckDir({ 'docProps/app.xml': APP(`<${tag}>Somebody Inc</${tag}>`) }));
    eq(r.code, 1, r.out + r.err);
    yes(new RegExp('names a ' + tag.toLowerCase()).test(r.err), r.err);
  });
  eq(leak(deckDir({ 'docProps/app.xml': APP('<Company></Company>') })).code, 0, 'an empty Company field failed');
});

test('leak-scan finds a listed name inside slide text, notes and document properties, and an address in a slide', () => {
  const tokens = write(tmp(), 'names.txt', 'Zorblax\n');
  [['ppt/slides/slide1.xml', SLIDE('Sales at Zorblax grew')], ['ppt/notesSlides/notesSlide1.xml', SLIDE('Ask Zorblax')],
    ['docProps/core.xml', CORE('Carousel OS example', 'Carousel OS example').replace('<dc:title>T', '<dc:title>Zorblax plan')]].forEach(([name, xml]) => {
    const r = leak(deckDir({ [name]: xml }), ['--tokens', tokens]);
    eq(r.code, 1, name + ': ' + r.out + r.err);
    yes(r.err.includes('deck.pptx!' + name) && !r.err.includes('Zorblax'), name + ': ' + r.err);
  });
  const r = leak(deckDir({ 'ppt/slides/slide1.xml': SLIDE('Write to ' + ADDR) }));
  eq(r.code, 1, r.out + r.err);
  yes(r.err.includes('email address ' + ADDR), r.err);
});

test('leak-scan fails a .pptx it cannot read rather than skipping it', () => {
  const t = tmp();
  fs.writeFileSync(path.join(t, 'broken.pptx'), 'not a zip at all');
  const r = leak(t);
  eq(r.code, 1, r.out + r.err);
  yes(/broken\.pptx: cannot read this \.pptx/.test(r.err), r.err);
});

test('the .pptx files shipped in this repository carry the neutral metadata and no home path or address', () => {
  const r = node(path.join(ROOT, 'scripts', 'leak-scan.js'), ['--root', path.join(ROOT, 'plans')]);
  eq(r.code, 0, r.out + r.err);
  yes(/leak-scan: [1-9]\d* files/.test(lastLine(r.out)), lastLine(r.out));
});

fs.rmSync(RUN_DIR, { recursive: true, force: true });
console.log(`\nscript tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
