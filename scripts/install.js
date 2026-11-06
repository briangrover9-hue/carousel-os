#!/usr/bin/env node
'use strict';
// carousel-os installer. Zero dependencies.
//
//   node scripts/install.js init <target> [--agents|--no-agents] [--dry-run] [--overwrite]
//   node scripts/install.js <existing-folder> [...]       the same as init, for a folder that already exists
//   node scripts/install.js update [<target>] [--agents|--no-agents] [--dry-run] [--overwrite]
//   node scripts/install.js doctor [<target>]
//
// init     copies the process into <target>: RULES.md, the nine stages in .agents/skills/ (where Cursor and Codex
//          look), the reviewer agents in agents/, plans, bookshelf, docs, memory skeleton and scripts. It also
//          copies the stages to <target>/.claude/skills/ and the reviewers to <target>/.claude/agents/, where
//          Claude Code looks. --no-agents skips those .claude/ copies; .agents/skills/ is the process itself and
//          always installs.
// update   re-runs init against an existing install. It replaces only files you have not edited and does not
//          bring back a file you deleted on purpose. It removes a file only when its path is on the retiredFiles list in
//          scripts/stages.json and its hash still matches the hash the manifest recorded. Any other manifest entry for
//          a path this version does not ship is forgotten, and the file stays yours.
//          Before it replaces or removes a file whose bytes it cannot prove it wrote, it saves the file as
//          <file>.carousel-backup (then .carousel-backup2, and so on) and prints a "backup" line. That covers every
//          --overwrite, and every write or removal against a manifest without the "format" field: older installers
//          wrote no such field, and one of them, run from inside a project, could record the hashes of your edits.
//          Hashes from such a manifest are never carried over as proof: they move to "unverified", which marks a path as
//          the tool's but proves nothing, and a path leaves it only when a run decides it against the package. A run
//          that fails partway records only what it wrote, so the rerun still saves a backup before any other write.
// doctor   checks what is installed and prints exactly what is missing.
//
// The installer copies from the folder it lives in, so it refuses to run from an installed project (one with a
// .carousel-install.json) or into its own folder. Run it from a Carousel OS clone or the npm package. It copies and
// records only paths the package ships: never your own skills, plans or notes beside them.
//
// A file you already have with the same name in .agents/skills/, .claude/skills/ or .claude/agents/ is never
// replaced, even with --overwrite.
// A manifest (.carousel-install.json) records the hash of every file this script wrote and every file you
// deleted. generate-skills.js records the .claude/ copies it writes there too, under "generated"; both count as
// the tool's own files. memory/ is a skeleton: it is created once and never changed again, even with --overwrite. The one
// exception: update replaces memory/handoff.md or memory/handoff.template.md when it is still exactly what an earlier
// version shipped (its hash matches the manifest), because the process checks read their layout.
// The stages and agents are the ones scripts/stages.json lists. When update keeps a stage or agent source you edited,
// its .claude/ copy is made from your source, so generate-skills.js --confirm still passes. Update never rewrites a
// .claude/ file whose hash is not one the tooling recorded: an edited copy is kept, and update says how to regenerate it.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE = path.resolve(__dirname, '..');
const MANIFEST = '.carousel-install.json';
const skills = require('./generate-skills.js');
// The stages and agents this version ships, and the ones an earlier version shipped (scripts/stages.json).
const LIST = skills.shipped(SOURCE);
const STAGE_SET = new Set(LIST.stages.concat(LIST.retiredStages));
const AGENT_SET = new Set(LIST.agents.concat(LIST.retiredAgents));
// Every path an earlier version installed that this one does not: the only files update may ever remove.
const RETIRED = new Set(LIST.retiredFiles);
const checks = require('./check-process.js');
const CLAUDE_SKILLS = '.claude/skills';
const CLAUDE_AGENTS = '.claude/agents';
const VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(SOURCE, 'package.json'), 'utf8')).version; } catch (e) { return '0'; }
})();

// What the process installs. A "dir" is copied whole unless it names "ships", the files of it the package itself
// ships; a "file" singly. Folders where you keep files of your own (.agents/skills, agents, plans, memory) name
// "ships", so the installer never records a file of yours as its own.
const PROCESS = [
  { gitattributes: true },   // made, not copied: written only into a project that has no .gitattributes of its own
  { file: 'RULES.md' },
  { file: 'cheatsheet.md' },
  { file: 'carousel.config.example.json' },   // the example only: a carousel.config.json is the user's and is never installed
  { file: 'AGENTS.md', onlyIfAbsent: true },
  { file: 'CLAUDE.md', onlyIfAbsent: true },
  { dir: '.agents/skills', userOwned: true,   // a tool folder: a skill of yours with the same name is never replaced
    ships: (f) => f === '.agents/skills/README.md' || (f.split('/').length > 3 && STAGE_SET.has(f.split('/')[2])) },
  { dir: 'agents', ships: (f) => f === 'agents/README.md' || (f.split('/').length === 2 && AGENT_SET.has(f.slice(7))) },
  { dir: 'plans', ships: (f) => /^plans\/[^/]+\.template\.[^/]+$/.test(f) || f.startsWith('plans/example/') },
  { dir: 'bookshelf' },
  { dir: 'docs', only: ['short-run.md', 'cost.md', 'how-it-thinks.md'] },
  { dir: 'docs/build-your-engine' },   // docs/gallery stays home: its images are not in the npm package
  { dir: 'tests/process' },
  { dir: 'scripts', exclude: ['check.js', 'check-links.js', 'leak-scan.js', 'make-release-zip.js'] },   // repository-only scripts stay home; every other script a process script needs ships
  { dir: 'memory', skeleton: true,
    ships: (f) => /^memory\/(handoff\.md|handoff\.template\.md|LOG\.template\.md|history\/README\.md|wiki\/[^/]+\.md|wiki\/lessons\.history)$/.test(f) },
];
// Memory files an update may still replace: only an unedited copy of what an earlier version shipped (its hash matches
// the manifest), because the process checks read their layout. An edited one is kept.
const MIGRATE = new Set(['memory/handoff.md', 'memory/handoff.template.md']);
const SKIP_NAMES = new Set(['__pycache__', '.DS_Store', '.git', 'node_modules']);

class InstallError extends Error {}

const EMPTY_LOG = [
  '# Log', '',
  'Each session adds a dated paragraph at the top (`## YYYY-MM-DD <slug>`). Add `Blocked by:` only if something held the work up. Facts that stay true go in `wiki/`. When a new ISO week starts, the previous weeks\' entries move to `memory/history/`, one file per week.',
  '',
].join('\n');

function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
// Line endings: a checkout with core.autocrlf=true (git on Windows) turns LF into CRLF, which is the same text. Text
// files are compared and hashed with CRLF read as LF; a binary file (the example deck, an image) is compared byte for
// byte. So a file that differs only in its line endings counts as unedited, and the manifest records the LF hash.
const BINARY = /\.(pptx|xlsx|docx|png|jpe?g|gif|webp|pdf|zip|woff2?|ttf|otf)$/i;
function lfBytes(rel, buf) {
  if (BINARY.test(rel) || buf.includes(0)) return buf;
  return Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
}
// The hashes a file answers to: its bytes, and for text, its bytes with LF endings.
function hashesOf(rel, buf) {
  const raw = sha(buf);
  const lf = sha(lfBytes(rel, buf));
  return raw === lf ? [raw] : [lf, raw];
}
function sameText(rel, a, b) { return lfBytes(rel, a).equals(lfBytes(rel, b)); }
function say(msg) { process.stdout.write(msg + '\n'); }
function warn(msg) { process.stderr.write(msg + '\n'); }       // errors go to stderr; summary lines stay on stdout

// Refuse to write through a symlink: the target folder itself, or any folder or file under it on the way to a path.
function assertNoSymlink(target, rel) {
  const parts = [''].concat(rel ? rel.split(/[\\/]/) : []);
  let cur = target;
  parts.forEach((part) => {
    cur = part ? path.join(cur, part) : cur;
    let st = null;
    try { st = fs.lstatSync(cur); } catch (e) { return; }
    if (st.isSymbolicLink()) throw new InstallError('refusing to write through a symlink: ' + cur + '. Point the target at a plain folder instead.');
  });
}

// The real path of p: resolve the deepest part of it that exists (following any symlink), then add the rest.
function realOf(p) {
  let probe = path.resolve(p);
  const rest = [];
  for (;;) {
    try { fs.lstatSync(probe); break; } catch (e) {
      const up = path.dirname(probe);
      if (up === probe) break;
      rest.unshift(path.basename(probe));
      probe = up;
    }
  }
  let real;
  try { real = nativeReal(probe); } catch (e) { throw new InstallError('cannot resolve ' + probe + ' (a broken symlink?). Nothing was written there.'); }
  return path.join(real, ...rest);
}
// The native resolver gives one spelling for one folder: on Windows it expands 8.3 short names (RUNNER~1) and follows
// junctions, so a project under a short-name temp path and its own files always compare as the same tree.
function nativeReal(p) { try { return fs.realpathSync.native(p); } catch (e) { return fs.realpathSync(p); } }
// Whether real lies at or under root. Windows paths ignore case, so the comparison does too there.
function within(real, root) {
  const fold = (x) => (process.platform === 'win32' ? x.toLowerCase() : x);
  const r = fold(real);
  const top = fold(root);
  return r === top || r.startsWith(top.endsWith(path.sep) ? top : top + path.sep);
}

// Whether two paths name the same folder once resolved (case aside on Windows).
function samePlace(a, b) {
  const fold = (x) => (process.platform === 'win32' ? x.toLowerCase() : x);
  return fold(realOf(a)) === fold(realOf(b));
}

// Refuse a write whose real location falls outside the project, whatever symlinks sit on the way.
function assertInside(target, rel) {
  const root = realOf(target);
  const real = realOf(path.join(target, rel));
  if (!within(real, root)) throw new InstallError('refusing to write outside the project: ' + path.join(target, rel) + ' resolves to ' + real + '.');
}

// Every write and removal goes through both checks.
function guardWrite(target, rel) {
  assertNoSymlink(target, rel);
  assertInside(target, rel);
}

function walk(root, rel, out) {
  const abs = path.join(root, rel);
  fs.readdirSync(abs, { withFileTypes: true }).forEach((d) => {
    if (SKIP_NAMES.has(d.name) || d.name.endsWith('.pyc') || d.name.includes('.carousel-backup')) return;
    const r = rel ? rel + '/' + d.name : d.name;
    if (d.isDirectory()) walk(root, r, out); else out.push(r);
  });
  return out;
}

// memory/LOG.md for a new project: made from the repository's memory/LOG.template.md when it exists, else a built-in
// empty log. The template is copied too, because the process checks read it. The author's own log is never copied.
function logEntry() {
  const t = path.join(SOURCE, 'memory', 'LOG.template.md');
  return { rel: 'memory/LOG.md', skeleton: true, content: fs.existsSync(t) ? fs.readFileSync(t) : Buffer.from(EMPTY_LOG) };
}

// With core.autocrlf=true (git on Windows), git checks text out with CRLF line endings and could mangle the example
// deck by treating it as text. This file tells git to store and check out every text file with LF endings and to
// leave the deck's bytes alone. The tools compare text with CRLF read as LF either way (see lfBytes), so a checkout
// made before this file existed still counts as unedited. It is installed only where the project has no
// .gitattributes, and never replaces one.
const GITATTRIBUTES = '# Written by the Carousel OS installer. Text is stored and checked out with LF endings; the deck is binary.\n* text=auto eol=lf\n*.pptx binary\n';
function gitattributesEntry() { return { rel: '.gitattributes', onlyIfAbsent: true, content: Buffer.from(GITATTRIBUTES) }; }

// memory/wiki/lessons.history starts as its header comment only, whatever the repository's own copy holds.
function lessonsHistoryEntry() {
  const t = path.join(SOURCE, 'memory', 'wiki', 'lessons.history');
  const head = fs.existsSync(t) ? fs.readFileSync(t, 'utf8').split('\n').filter((l) => l.startsWith('#')).join('\n') + '\n' : '# Append-only. One line per human-confirmed action.\n';
  return { rel: 'memory/wiki/lessons.history', skeleton: true, content: Buffer.from(head) };
}

// The package's own "files" list in package.json: a path it leaves out (a .png, docs/gallery, the publish
// checklist, anything outside the listed folders) is never installed, and so never recorded as the tool's.
function globRe(g) {
  return new RegExp('^' + g.split('**/').map((part) => part.split('**').map((x) => x.split('*').map((y) => y.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*')).join('(?:.*/)?') + '$');
}
function packageFilter() {
  let list = null;
  try { list = JSON.parse(fs.readFileSync(path.join(SOURCE, 'package.json'), 'utf8')).files; } catch (e) { return () => true; }
  if (!Array.isArray(list)) return () => true;
  const keep = list.filter((e) => !e.startsWith('!'));
  const drop = list.filter((e) => e.startsWith('!')).map((e) => globRe(e.slice(1)));
  return (rel) => keep.some((e) => (e.endsWith('/') ? rel.startsWith(e) : rel === e)) && !drop.some((re) => re.test(rel));
}

// Run from a git clone, only the files git tracks ship: an untracked file (a draft, a note, a stray copy) in a folder
// that ships whole is never copied or recorded. The check applies only when the source folder is itself the top of the
// clone, so a package that sits inside some other repository is not filtered by that repository's list. Without git,
// the package's "files" list alone decides.
function trackedFilter() {
  if (!fs.existsSync(path.join(SOURCE, '.git'))) return () => true;
  const cp = require('child_process');
  // An empty prefix means SOURCE is the top of its clone. Asking git this way compares no path spellings, which on
  // Windows differ (forward slashes, 8.3 short names, drive letter case) for the same folder.
  const top = cp.spawnSync('git', ['-C', SOURCE, 'rev-parse', '--show-prefix'], { encoding: 'utf8' });
  if (top.error || top.status !== 0 || top.stdout.trim() !== '') return () => true;
  const ls = cp.spawnSync('git', ['-C', SOURCE, 'ls-files', '-z', '--cached'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (ls.error || ls.status !== 0) return () => true;
  const tracked = new Set(ls.stdout.split('\0').filter(Boolean).map((f) => f.replace(/\\/g, '/')));
  return (rel) => tracked.has(rel);
}

function listSource() {
  const packaged = packageFilter();
  const tracked = trackedFilter();
  const out = [];
  PROCESS.forEach((s) => {
    if (s.gitattributes) { out.push(gitattributesEntry()); return; }
    if (s.file) {
      if (fs.existsSync(path.join(SOURCE, s.file)) && tracked(s.file)) out.push({ rel: s.file, onlyIfAbsent: !!s.onlyIfAbsent });
      return;
    }
    if (!fs.existsSync(path.join(SOURCE, s.dir))) return;
    let files = walk(SOURCE, s.dir, []);
    files = files.filter((f) => packaged(f) && tracked(f) && (!s.ships || s.ships(f)));
    if (s.only) files = files.filter((f) => s.only.includes(f.slice(s.dir.length + 1)));
    else if (s.exclude) files = files.filter((f) => !s.exclude.includes(f.slice(s.dir.length + 1)));
    else if (s.dir === 'docs') files = [];
    files.forEach((f) => {
      if (out.some((o) => o.rel === f)) return;                                    // a nested dir listed on its own
      if (s.skeleton && (f === 'memory/LOG.md' || f === 'memory/LOG.md.template' || f === 'memory/wiki/lessons.history')) return;
      out.push({ rel: f, skeleton: !!s.skeleton, userOwned: !!s.userOwned });
    });
    if (s.skeleton && s.dir === 'memory') { out.push(logEntry()); out.push(lessonsHistoryEntry()); }
  });
  return out;
}

// The Claude Code copies: each stage's SKILL.md byte for byte, and each reviewer agent. They are the user's to keep:
// an existing file of the same name that this tool did not write is never touched.
function agentFiles() {
  const out = skills.stageNames(SOURCE).map((n) => ({ rel: `${CLAUDE_SKILLS}/${n}/SKILL.md`, from: `${skills.SKILLS}/${n}/SKILL.md`, userOwned: true }));
  return out.concat(skills.agentNames(SOURCE).map((f) => ({ rel: `${CLAUDE_AGENTS}/${f}`, from: `${skills.AGENTS}/${f}`, userOwned: true })));
}

// Remove folders the update emptied, from the file's folder up to (not including) the target.
function pruneEmpty(target, rel) {
  let dir = path.dirname(path.join(target, rel));
  while (dir.startsWith(path.resolve(target) + path.sep)) {
    try { if (fs.readdirSync(dir).length) return; fs.rmdirSync(dir); } catch (e) { return; }
    dir = path.dirname(dir);
  }
}

// A manifest path must stay inside the project: no absolute path, no "..", nothing that resolves outside the target.
function safeRel(target, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || rel.split(/[\\/]/).includes('..')) return false;
  return path.resolve(target, rel).startsWith(path.resolve(target) + path.sep);
}

function readManifest(target) {
  let m = null;
  const file = path.join(target, MANIFEST);
  if (!fs.existsSync(file)) return null;
  try { m = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    throw new InstallError(`${MANIFEST} is not valid JSON (${e.message}). Nothing was changed. Repair it, or move it aside and run init again: with no manifest, init leaves every file that differs from the package alone.`);
  }
  const shape = skills.shapeError(m);
  if (shape) throw new InstallError(`${MANIFEST} has the wrong shape: ${shape}. Nothing was changed. Repair it, or move it aside and run init again: with no manifest, init leaves every file that differs from the package alone.`);
  const keys = Object.keys(m.files || {}).concat(Object.keys(m.generated || {}), Object.keys(m.unverified || {}), m.deleted || []);
  const bad = keys.find((k) => !safeRel(target, k));
  if (bad !== undefined) throw new InstallError(`${MANIFEST} names a path outside the project: ${JSON.stringify(bad)}. Nothing was changed. Delete or repair ${MANIFEST}, then run again.`);
  return m;
}

// Run from the npm package (npx or a dependency), the command people type is
// `npx carousel-os`; run from a clone, it is the script path.
const FROM_NPM = /[\\/]node_modules[\\/]|[\\/]_npx[\\/]/.test(__dirname);
const CMD = FROM_NPM ? 'npx carousel-os' : 'node scripts/install.js';
const USAGE = [
  `usage: ${CMD} init <target> [--agents|--no-agents] [--dry-run] [--overwrite]`,
  `       ${CMD} update [<target>] [--agents|--no-agents] [--dry-run] [--overwrite]`,
  `       ${CMD} doctor [<target>]`,
  `       ${CMD} <existing-folder> [options]     the same as init`,
].join('\n');

function parseArgs(argv) {
  const o = { cmd: null, target: null, dry: false, overwrite: false, agents: true, agentsGiven: false, help: false, errors: [] };
  const rest = [];
  argv.forEach((a) => {
    if (a === '--dry-run') o.dry = true;
    else if (a === '--overwrite') o.overwrite = true;
    else if (a === '--agents') { o.agents = true; o.agentsGiven = true; }
    else if (a === '--no-agents') { o.agents = false; o.agentsGiven = true; }
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a === '--engine' || a === '--no-venv') o.errors.push(a + ' is gone: the engine is not part of this repository. See docs/build-your-engine/README.md.');
    else if (a.startsWith('-')) o.errors.push('unknown option ' + a);
    else rest.push(a);
  });
  if (!rest.length) { o.cmd = 'init'; return o; }
  const first = rest[0];
  if (first === 'init' || first === 'update' || first === 'doctor') {
    o.cmd = first; rest.shift();
  } else if (fs.existsSync(first)) {
    o.cmd = 'init';
  } else if (rest.length > 1 && fs.existsSync(rest[1]) && fs.statSync(rest[1]).isDirectory()) {
    o.errors.push(`"${first}" is not a command, and "${rest[1]}" is a folder. Did you mean: node ${checks.shq(__filename)} init ${checks.shq(path.resolve(rest[1]))}`);
    return o;
  } else {
    o.errors.push(`unknown command "${first}". Use "init ${first}" to create a new folder, or pass a folder that exists.`);
    return o;
  }
  if (rest.length > 1) o.errors.push('too many arguments: ' + rest.slice(1).join(' '));
  o.target = rest[0] ? path.resolve(rest[0]) : null;
  return o;
}

// ------------------------------------------------------------------ install

// The installer copies from the folder it lives in. Run from inside a project, that folder is the project, and an
// install would record the project's own files (your skills, your plans) as the tool's, for a later update to delete.
function assertRealSource(target) {
  const again = 'Run the installer from your Carousel OS clone (node <clone>/scripts/install.js ...) or from the npm package (npx carousel-os ...).';
  if (samePlace(SOURCE, target)) throw new InstallError('install: refusing to install a folder into itself (' + target + ' is where this installer lives). ' + again);
  if (fs.existsSync(path.join(SOURCE, MANIFEST))) throw new InstallError('install: refusing to run from an installed project (' + SOURCE + ' has ' + MANIFEST + '), because it would record that project\'s own files as the tool\'s. ' + again);
}

function install(o, updating) {
  if (!o.target) { warn(USAGE); return 2; }
  assertRealSource(o.target);
  if (fs.existsSync(o.target) && !fs.statSync(o.target).isDirectory()) { warn('install: ' + o.target + ' is a file, not a folder. Pass the folder to install into.'); return 1; }
  assertNoSymlink(o.target, '');
  const manifest = readManifest(o.target);
  if (updating && !manifest) { warn('update: no ' + MANIFEST + ' in ' + o.target + '. Run init first.'); return 1; }
  const withAgents = o.agentsGiven ? o.agents : !(manifest && manifest.agents === false);
  const files = listSource().concat(withAgents ? agentFiles() : []);
  const recorded = (manifest && manifest.files) || {};
  const deleted = new Set((manifest && manifest.deleted) || []);
  // Only a manifest this installer wrote (it carries the format field) proves which bytes the tool wrote. An older one
  // may record the hashes of files you had edited, so its hashes are never carried into the new manifest as proof:
  // they move to "unverified", which still marks a path as the tool's but never proves its bytes. A path leaves
  // "unverified" only when this run decides it against the package (same bytes, or a write that saved a backup first).
  const trust = skills.trusted(manifest);
  const oldGenerated = (manifest && manifest.generated) || {};
  const next = trust ? Object.assign({}, recorded) : {};
  // .claude/ copies that generate-skills.js wrote: the tool's own files, the same as the ones this script wrote.
  const generated = trust ? Object.assign({}, oldGenerated) : {};
  const oldUnverified = trust ? ((manifest && manifest.unverified) || {}) : Object.assign({}, oldGenerated, recorded);
  const unverified = Object.assign({}, oldUnverified);
  const ours = (rel) => recorded[rel] || oldGenerated[rel] || oldUnverified[rel];
  // cur is the list hashesOf gives: a match on either hash counts, so line endings alone never make a file edited.
  const unedited = (rel, cur) => [].concat(cur).some((c) => recorded[rel] === c || oldGenerated[rel] === c || oldUnverified[rel] === c);
  // True only when a trusted record says the tool wrote exactly these bytes.
  const proven = (rel, cur) => trust && [].concat(cur).some((c) => recorded[rel] === c || oldGenerated[rel] === c);
  const mustBackup = (rel, cur) => o.overwrite || !proven(rel, cur);
  const recordFile = (rel, h) => { next[rel] = h; delete generated[rel]; delete unverified[rel]; };
  const recordCopy = (rel, h) => { generated[rel] = h; delete next[rel]; delete unverified[rel]; };
  const counts = { added: 0, updated: 0, same: 0, kept: 0, exists: 0, skippedDeleted: 0, removed: 0 };
  const verb = o.dry ? 'would ' : '';
  const shipped = new Set(files.map((f) => f.rel));
  // Every .claude/ copy this version can make, installed now or not: the only paths "generated" may name.
  const copyRels = new Set(agentFiles().map((f) => f.rel));
  // Stage and agent sources left as they are (edited by you, or yours): their .claude/ copies follow them.
  const keptSources = new Set();

  const writeManifest = () => {
    guardWrite(o.target, MANIFEST);
    fs.mkdirSync(o.target, { recursive: true });
    const out = { format: skills.MANIFEST_FORMAT, version: VERSION, agents: !!withAgents, files: next };
    if (Object.keys(generated).length) out.generated = generated;
    if (Object.keys(unverified).length) out.unverified = unverified;
    if (deleted.size) out.deleted = Array.from(deleted).sort();
    fs.writeFileSync(path.join(o.target, MANIFEST), JSON.stringify(out, null, 2) + '\n');
  };
  // Keep a copy of a file before replacing or removing bytes the tool cannot prove it wrote itself.
  const backup = (dst, rel) => {
    let saved;
    try { saved = skills.saveBackup(dst, o.target); } catch (e) { if (e.outside) throw new InstallError(e.message + ' Nothing was written there.'); throw e; }
    say('backup   ' + rel + ' (your copy is saved as ' + path.basename(saved) + ')');
  };

  // The .claude/ copy of a source you kept: made from your source, the way generate-skills.js makes it, so the copy
  // never goes back to the package's text while the source stays yours. A copy of yours is still never touched.
  const followSource = (f, dst, present) => {
    if (present && !ours(f.rel)) { counts.exists++; say('exists   ' + f.rel + ' (yours; never replaced)'); return; }
    const cur = present ? hashesOf(f.rel, fs.readFileSync(dst)) : null;
    if (!present && (ours(f.rel) || deleted.has(f.rel)) && !o.overwrite) {
      deleted.add(f.rel); delete next[f.rel]; delete unverified[f.rel];
      counts.skippedDeleted++; say('skipped  ' + f.rel + ' (you deleted it; use --overwrite to bring it back)');
      return;
    }
    const src = fs.readFileSync(path.join(o.target, f.from), 'utf8');
    const text = f.rel.startsWith(CLAUDE_SKILLS + '/') ? skills.skillText(f.rel.split('/')[2], skills.splitFrontMatter(src).body) : src;
    if (text === null) { counts.kept++; say('kept     ' + f.rel + ' (' + f.from + ' has no "Job:" line; node ' + checks.shq(path.join(o.target, 'scripts', 'generate-skills.js')) + ' --confirm --root ' + checks.shq(o.target) + ' names the problem)'); return; }
    const h = sha(lfBytes(f.rel, Buffer.from(text)));
    if (present && cur.includes(h)) { counts.same++; recordCopy(f.rel, h); return; }
    // A copy whose hash the tooling never recorded was edited by you: kept, unless --overwrite (which saves a backup).
    const edited = present && !unedited(f.rel, cur);
    if (edited && !o.overwrite) {
      counts.kept++;
      say('kept     ' + f.rel + ' (you edited it; to rebuild it from ' + f.from + ': ' + checks.regenAdvice(o.target).text + '; it saves your copy as a .carousel-backup file first)');
      return;
    }
    guardWrite(o.target, f.rel);
    say(verb + 'follow   ' + f.rel + ' (made from your edited ' + f.from + ')');
    counts.updated++;
    if (o.dry) return;
    if (present && mustBackup(f.rel, cur)) backup(dst, f.rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, text);
    recordCopy(f.rel, h); deleted.delete(f.rel);
  };
  // Sources whose .claude/ copies the installer makes.
  const sourceRels = new Set(agentFiles().map((f) => f.from));

  // Returns true when the package's content is in place (or would be, on a dry run).
  const placeOne = (f) => {
      const dst = path.join(o.target, f.rel);
      const buf = f.content || fs.readFileSync(path.join(SOURCE, f.from || f.rel));
      const h = sha(lfBytes(f.rel, buf));   // what is recorded: the LF text, so a CRLF checkout of it still matches
      const present = fs.existsSync(dst);
      if (present && fs.statSync(dst).isDirectory()) throw new InstallError('a folder is where a file should be: ' + dst + '. Move or rename it, then run again.');
      let action = null;
      if (f.from && keptSources.has(f.from)) { followSource(f, dst, present); return; }
      if (!present) {
        if (ours(f.rel) && !o.overwrite) {                      // we installed it and it is gone: the user deleted it
          deleted.add(f.rel); delete next[f.rel]; delete unverified[f.rel];
          counts.skippedDeleted++; say('skipped  ' + f.rel + ' (you deleted it; use --overwrite to bring it back)');
          return;
        }
        if (deleted.has(f.rel) && !o.overwrite) { counts.skippedDeleted++; say('skipped  ' + f.rel + ' (you deleted it; use --overwrite to bring it back)'); return; }
        action = 'add';
      } else if (f.skeleton) {                                     // memory is never touched again, except an unedited old layout
        const cur = hashesOf(f.rel, fs.readFileSync(dst));
        if (cur.includes(h) && manifest) recordFile(f.rel, h);
        if (!manifest || !MIGRATE.has(f.rel) || cur.includes(h)) { counts.same++; return; }
        if (!unedited(f.rel, cur)) {
          counts.kept++;
          // Speak up only while the kept file fails the layout check-process reads, so the note stops once you migrate.
          const errs = checks.validateHandoff(fs.readFileSync(dst, 'utf8'));
          if (errs.length) say('kept     ' + f.rel + ' (' + (ours(f.rel) ? 'you edited it' : 'yours, kept') + ', and it does not match this version\'s layout: ' + errs[0] + '. Compare it with memory/handoff.template.md in your project. The layout, in order: ' + checks.HANDOFF_LAYOUT + ' Then run ' + checkCommand(o.target) + ' to see what still needs fixing.)');
          return;
        }
        action = 'update';
      } else {
        const cur = hashesOf(f.rel, fs.readFileSync(dst));
        if (cur.includes(h)) { counts.same++; recordFile(f.rel, h); return true; }
        if (f.userOwned && !ours(f.rel)) { counts.exists++; say('exists   ' + f.rel + ' (yours; never replaced)'); return; }
        if (f.onlyIfAbsent && !ours(f.rel)) { counts.exists++; say('exists   ' + f.rel + ' (yours; never replaced)'); return; }
        if (f.onlyIfAbsent && !o.overwrite) { counts.exists++; say('exists   ' + f.rel); return; }
        if (o.overwrite) action = 'update';
        else if (ours(f.rel) && unedited(f.rel, cur)) action = 'update';   // unedited since the tool wrote it
        else if (ours(f.rel)) { counts.kept++; say('kept     ' + f.rel + ' (you edited it; use --overwrite to replace)'); return; }
        else { counts.exists++; say('exists   ' + f.rel + ' (not installed by this tool; use --overwrite to replace)'); return; }
      }
      // Containment first, so no action is printed for a path the installer then refuses to write.
      guardWrite(o.target, f.rel);
      say(verb + (action === 'add' ? 'add      ' : 'update   ') + f.rel);
      counts[action === 'add' ? 'added' : 'updated']++;
      if (!o.dry) {
        if (action === 'update' && mustBackup(f.rel, hashesOf(f.rel, fs.readFileSync(dst)))) backup(dst, f.rel);
        try { fs.mkdirSync(path.dirname(dst), { recursive: true }); } catch (e) {
          if (e.code === 'ENOTDIR' || e.code === 'EEXIST') throw new InstallError('expected a folder, found a file: ' + path.dirname(dst) + '. Move or rename it, then run again.');
          throw e;
        }
        fs.writeFileSync(dst, buf);
        recordFile(f.rel, h);
        deleted.delete(f.rel);
      }
      return true;
  };

  try {
    files.forEach((f) => {
      if (!placeOne(f) && sourceRels.has(f.rel) && fs.existsSync(path.join(o.target, f.rel))) keptSources.add(f.rel);
    });

    // Manifest entries for paths this version does not ship. A file is removed only when its path is on the
    // retiredFiles list in scripts/stages.json and its hash matches the one the manifest recorded. Every other entry is
    // forgotten and its file kept: an older or damaged manifest can name a file of yours, and only the list says what
    // the tool once shipped. The .claude/ copies come last, so a copy whose retired source you kept stays beside it.
    const recordedHash = (rel) => [recorded[rel], oldGenerated[rel], oldUnverified[rel]].filter(Boolean);
    const leftovers = Array.from(new Set(Object.keys(recorded).concat(Object.keys(oldGenerated), Object.keys(oldUnverified))))
      .filter((rel) => !shipped.has(rel) && !copyRels.has(rel))
      .sort((x, y) => (x.startsWith('.claude/') ? 1 : 0) - (y.startsWith('.claude/') ? 1 : 0) || (x < y ? -1 : x > y ? 1 : 0));
    const forget = (rel) => { if (!o.dry) { delete next[rel]; delete generated[rel]; delete unverified[rel]; } };
    leftovers.forEach((rel) => {
      const dst = path.join(o.target, rel);
      if (!fs.existsSync(dst)) { forget(rel); return; }
      if (!RETIRED.has(rel)) {
        say(verb + 'forget   ' + rel + ' (not a file this version retired; yours to keep)');
        forget(rel);
        return;
      }
      const parts = rel.split('/');
      const source = rel.startsWith(CLAUDE_SKILLS + '/') ? `${skills.SKILLS}/${parts[2]}/SKILL.md` : rel.startsWith(CLAUDE_AGENTS + '/') ? `${skills.AGENTS}/${parts[2]}` : null;
      if (source && fs.existsSync(path.join(o.target, source))) {
        counts.kept++; say('kept     ' + rel + ' (no longer shipped; it follows ' + source + ', which you kept)');
        forget(rel);
        return;
      }
      const cur = hashesOf(rel, fs.readFileSync(dst));
      if (recordedHash(rel).some((x) => cur.includes(x))) {
        guardWrite(o.target, rel);
        say(verb + 'remove   ' + rel + ' (no longer shipped)');
        counts.removed++;
        // This version keeps no record of the hashes a retired path once shipped with, so against a manifest it cannot
        // trust, a removal always saves the file first.
        if (!o.dry) { if (mustBackup(rel, cur)) backup(dst, rel); fs.rmSync(dst); forget(rel); pruneEmpty(o.target, rel); }
      } else {
        counts.kept++; say('kept     ' + rel + ' (no longer shipped, but you edited it; it is yours now)');
        forget(rel);
      }
    });
  } catch (e) {
    // A partial install records what it did write, so a rerun recognizes its own files. Entries this run never reached
    // stay where they were: an unproven one stays in "unverified", so the rerun still saves a backup before any write.
    if (!o.dry && (Object.keys(next).length || Object.keys(unverified).length)) { try { writeManifest(); } catch (e2) { /* the first error is the one to show */ } }
    throw e;
  }

  // With --no-agents the .claude/ copies are not written, but copies an earlier version left behind still sit there and
  // the process checks compare them with their source. Say which command rebuilds them.
  if (!withAgents && !o.dry) {
    const behind = agentFiles().filter((c) => {
      const dst = path.join(o.target, c.rel);
      const src = path.join(o.target, c.from);
      return fs.existsSync(dst) && fs.existsSync(src) && ours(c.rel) && !sameText(c.rel, fs.readFileSync(dst), fs.readFileSync(src));
    });
    if (behind.length) say('next     ' + behind.length + ' .claude/ cop' + (behind.length === 1 ? 'y differs' : 'ies differ') + ' from ' + (behind.length === 1 ? 'its source' : 'their sources') + ' (left by an earlier version). To rebuild ' + (behind.length === 1 ? 'it' : 'them') + ': ' + checks.regenAdvice(o.target).text + '; it saves each one the tool cannot prove it wrote as a .carousel-backup file first.');
  }
  say(`${verb}done: ${counts.added} added, ${counts.updated} updated, ${counts.same} unchanged, ${counts.kept} kept (edited), ${counts.exists} left alone, ${counts.skippedDeleted} skipped (deleted by you), ${counts.removed} removed.`);
  if (!o.dry) writeManifest();
  return 0;
}

// ------------------------------------------------------------------- doctor

// Paths under scripts/ and tests/ that the stages and reviewer agents name. A stage that calls a file the install
// did not copy is a defect.
function filesCalledByCommands(target) {
  const out = [];
  const seen = new Set();
  const files = skills.stageNames(target).map((n) => `${skills.SKILLS}/${n}/SKILL.md`)
    .concat(skills.agentNames(target).map((f) => `${skills.AGENTS}/${f}`));
  files.forEach((rel) => {
    const text = fs.readFileSync(path.join(target, rel), 'utf8');
    const ref = /\b((?:scripts|tests)\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_](?:\.[A-Za-z0-9]+))/g;
    let m;
    while ((m = ref.exec(text))) {
      if (/[<*{]/.test(m[1]) || seen.has(m[1])) continue;
      // The engine is optional: its wrapper is only expected where the project has an engine/ folder.
      if (m[1] === 'scripts/engine.js' && !fs.existsSync(path.join(target, 'engine'))) continue;
      seen.add(m[1]);
      out.push({ path: m[1], by: rel });
    }
  });
  return out;
}

// The command that fixes a project: the installer of a Carousel OS clone or the npm package, never the project's own
// copy, which refuses to run (it would treat the project as the source). Run from a clone, doctor names that clone.
function installerCommand(sub, target, extra) {
  const tail = sub + ' ' + checks.shq(path.resolve(target)) + (extra ? ' ' + extra : '');
  const fromClone = !samePlace(SOURCE, target) && !fs.existsSync(path.join(SOURCE, MANIFEST));
  if (fromClone) return 'node ' + checks.shq(path.join(SOURCE, 'scripts', 'install.js')) + ' ' + tail;
  return 'run the installer from your Carousel OS clone: node <clone>/scripts/install.js ' + tail + ', or from npm: npx carousel-os ' + tail;
}

// The project's own check-process, by its absolute path, so the command works from any folder.
function checkCommand(target) {
  const t = path.resolve(target);
  return 'node ' + checks.shq(path.join(t, 'scripts', 'check-process.js')) + ' --root ' + checks.shq(t);
}

// The engine: each command carousel.config.json registers, and whether the program or script it starts exists. The
// command is split into words the way a shell would (quotes and backslashes honored), up to the first unquoted
// operator. The first word is the program. For an interpreter (node, python3, bash and the like), the first word after
// its own options is the script it runs, a path inside the project; it is checked only when it is clearly a file (it
// holds a slash or ends in an extension). Code given inline (-c, -e) or a module (python -m) has no file to check,
// so doctor says so and never calls it missing.
const INTERPRETERS = new Set(['node', 'python', 'python3', 'bash', 'sh', 'zsh', 'ruby', 'perl', 'deno', 'bun', 'pwsh', 'powershell']);
// Options that take the next word as their value, so that word is never read as the script.
const VALUE_FLAGS = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '-W', '-X', '-I', '--config', '--env-file']);
function shellWords(cmd) {
  const words = [];
  let cur = null;
  let i = 0;
  const s = String(cmd);
  const push = () => { if (cur !== null) words.push(cur); cur = null; };
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { push(); i++; continue; }
    if (/[|&;<>()]/.test(c)) break;
    if (c === "'") { const j = s.indexOf("'", i + 1); const end = j < 0 ? s.length : j; cur = (cur || '') + s.slice(i + 1, end); i = end + 1; continue; }
    if (c === '"') {
      let j = i + 1; let out = '';
      while (j < s.length && s[j] !== '"') { if (s[j] === '\\' && j + 1 < s.length && /["\\$`]/.test(s[j + 1])) { out += s[j + 1]; j += 2; } else out += s[j++]; }
      cur = (cur || '') + out; i = j + 1; continue;
    }
    if (c === '\\' && i + 1 < s.length) { cur = (cur || '') + s[i + 1]; i += 2; continue; }
    cur = (cur || '') + c; i++;
  }
  push();
  return words;
}
// What an interpreter command runs: { script }, { inline: true }, { module: name } or {} when nothing names a file.
function interpreterTarget(base, args) {
  const rest = (base === 'deno' || base === 'bun') && args[0] === 'run' ? args.slice(1) : args;
  for (let i = 0; i < rest.length; i++) {
    const w = rest[i];
    if (/^\{(deck|out)\}$/.test(w)) continue;
    if (w === '-m' && /^python/.test(base)) return { module: rest[i + 1] || '' };
    if (/^python/.test(base) && /^-m./.test(w)) return { module: w.slice(2) };
    if (['-e', '--eval', '-p', '--print', '-Command', '-c'].includes(w) || (/^(ba|z)?sh$/.test(base) && /^-[a-z]*c[a-z]*$/.test(w))) return { inline: true };
    if (w === '--') continue;
    if (w.startsWith('-')) { if (VALUE_FLAGS.has(w)) i++; continue; }
    return /[\/\\]/.test(w) || /\.[A-Za-z0-9]+$/.test(w) ? { script: w } : {};
  }
  return {};
}
function onPath(cmd) {
  const exts = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  return (process.env.PATH || '').split(path.delimiter).filter(Boolean).some((d) => exts.some((x) => fs.existsSync(path.join(d, cmd + x))));
}
function engineLines(target, ok, bad, fail) {
  const file = path.join(target, 'carousel.config.json');
  if (!fs.existsSync(file)) { say('engine   none (optional; see docs/build-your-engine/README.md)'); return; }
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail('carousel.config.json is not valid JSON (' + e.message + ')'); return; }
  const e = cfg && cfg.engine;
  if (!e) { say('engine   none registered in carousel.config.json (optional; see bookshelf/engine-contract.md)'); return; }
  const cmds = Object.assign({}, (e.tools && typeof e.tools === 'object') ? e.tools : {}, { scan: e.scan, render: e.render });
  ['scan', 'render'].concat(Object.keys(cmds).filter((n) => n !== 'scan' && n !== 'render').sort()).forEach((name) => {
    const c = cmds[name];
    if (typeof c !== 'string' || !c.trim()) { bad('engine ' + name + ': carousel.config.json registers no command (see bookshelf/engine-contract.md)'); return; }
    const words = shellWords(c);
    if (!words.length) { bad('engine ' + name + ': carousel.config.json registers a command doctor cannot read: ' + c); return; }
    const prog = words[0];
    const base = path.basename(prog).replace(/\.exe$/i, '');
    if (INTERPRETERS.has(base)) {
      const t = interpreterTarget(base, words.slice(1));
      if (t.module !== undefined) { ok('engine ' + name + ': ' + prog + ' -m ' + t.module + ' (a module, not a file: doctor cannot check it)'); return; }
      if (t.inline) { ok('engine ' + name + ': ' + prog + ' runs inline code (no script file to check)'); return; }
      const script = t.script;
      if (!script) { ok('engine ' + name + ': ' + prog + ' (no script path to check)'); return; }
      if (fs.existsSync(path.resolve(target, script))) ok('engine ' + name + ': ' + script + ' found');
      else bad('engine ' + name + ': ' + script + ' not found (carousel.config.json runs it with ' + prog + ' from the project root)');
      return;
    }
    const isPath = prog.includes('/') || prog.includes('\\');
    if (isPath ? fs.existsSync(path.resolve(target, prog)) : onPath(prog)) ok('engine ' + name + ': ' + prog + ' found');
    else bad('engine ' + name + ': ' + prog + ' not found' + (isPath ? '' : ' on PATH'));
  });
}

function doctor(o) {
  const target = o.target || process.cwd();
  if (!fs.existsSync(target)) { warn('doctor: ' + target + ' does not exist.'); return 1; }
  if (!fs.statSync(target).isDirectory()) { warn('doctor: ' + target + ' is a file, not a folder.'); return 1; }
  const problems = [];
  const ok = (m) => say('ok       ' + m);
  const bad = (m) => { problems.push(m); warn('MISSING  ' + m); };
  const fail = (m) => { problems.push(m); warn('FAIL     ' + m); };
  const differs = (m) => { problems.push(m); warn('DIFFERS  ' + m); };
  const fix = ' (' + installerCommand('update', target) + ')';

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) ok('Node ' + process.versions.node); else bad('Node 20 or newer (found ' + process.versions.node + ')');

  const required = ['RULES.md', skills.SKILLS + '/README.md', 'plans/plan.template.md', 'memory/wiki/lessons.md', 'bookshelf/README.md', 'scripts/check-process.js'];
  required.forEach((f) => { if (fs.existsSync(path.join(target, f))) ok(f); else bad(f + ' (' + installerCommand('init', target) + ')'); });
  const want = skills.stageNames(SOURCE);
  const have = want.filter((n) => fs.existsSync(path.join(target, skills.SKILLS, n, 'SKILL.md')));
  if (have.length === want.length) ok(skills.SKILLS + ': ' + have.length + ' stages');
  else bad(skills.SKILLS + ': found ' + have.length + ' of ' + want.length + ' stages' + fix);
  const yaml = have.filter((n) => fs.existsSync(path.join(target, skills.SKILLS, n, 'agents', 'openai.yaml')));
  if (yaml.length === have.length) ok(yaml.length + ' stages marked manual-only for Codex');
  else bad(skills.SKILLS + ': ' + (have.length - yaml.length) + ' stage(s) lack agents/openai.yaml' + fix);
  const reviewers = skills.agentNames(SOURCE);
  const revHave = reviewers.filter((f) => fs.existsSync(path.join(target, skills.AGENTS, f)));
  if (revHave.length === reviewers.length) ok(skills.AGENTS + ': ' + revHave.length + ' reviewer agents');
  else bad(skills.AGENTS + ': found ' + revHave.length + ' of ' + reviewers.length + ' reviewer agents' + fix);

  // The Claude Code copies: optional after --no-agents, and they must match their source byte for byte.
  const manifest = readManifest(target);
  const copies = agentFiles();
  const present = copies.filter((c) => fs.existsSync(path.join(target, c.rel)));
  // A file of yours with a copy's name is not a copy: it is counted apart, and never toward what is installed.
  const yours = present.filter((c) => skills.userOwned(target, c.rel));
  const ours = present.filter((c) => !yours.includes(c));
  const nSkills = ours.filter((c) => c.rel.startsWith(CLAUDE_SKILLS + '/')).length;
  const yoursNote = yours.length ? ', plus ' + yours.length + ' file(s) of yours in their place' : '';
  if (ours.length + yours.length === copies.length) ok('.claude/: ' + nSkills + ' skills and ' + (ours.length - nSkills) + ' agents' + yoursNote);
  else if (manifest && manifest.agents) bad('.claude/: found ' + ours.length + ' of ' + copies.length + ' skill and agent copies' + yoursNote + fix);
  else say('agents   .claude/ has ' + ours.length + ' of ' + copies.length + ' skill and agent copies' + yoursNote + ' (optional; to add them, ' + installerCommand('update', target, '--agents').replace(/^run /, 'run ') + ')');
  // Copies the tool made that no longer match their source (an earlier version's, or one you edited). One command
  // rebuilds them all, and it saves each one whose bytes the tool cannot prove it wrote, so it is the first fix named.
  const stale = present.filter((c) => {
    const src = path.join(target, c.from);
    return fs.existsSync(src) && !sameText(c.rel, fs.readFileSync(src), fs.readFileSync(path.join(target, c.rel)));
  });
  const advice = checks.regenAdvice(target);
  if (stale.some((c) => !skills.userOwned(target, c.rel))) {
    say('fix      the .claude/ copies listed below differ from their source. To rebuild them: ' + advice.text + '. It saves each copy the tool cannot prove it wrote as a .carousel-backup file beside it first, so an edit of yours can be carried into its source.');
  }
  stale.forEach((c) => {
    // A copy the installer did not write is yours: report it, and suggest nothing that would replace it.
    if (skills.userOwned(target, c.rel)) { say('yours    ' + c.rel + ' differs from ' + c.from + ' (your own file; never replaced)'); return; }
    // The copy exists, so it is never reported as missing. Regenerating it saves an unproven copy as a backup first.
    const edited = !hashesOf(c.rel, fs.readFileSync(path.join(target, c.rel))).some((h) => skills.toolWrote(target, c.rel, h));
    differs(c.rel + ' differs from ' + c.from + ' (to rebuild it from ' + c.from + ': ' + advice.text +
      (edited ? '; it saves the current copy as a .carousel-backup file beside it first, so you can carry any edit of yours into ' + c.from + ')' : ')'));
  });

  // The same checks check-process runs, so doctor never says all good while check-process fails. A stage file you
  // kept (edited) that names a retired stage, or no longer meets this version's stage contract, gets a plain message.
  if (fs.existsSync(path.join(target, 'RULES.md'))) {
    let res = null;
    try { res = checks.checkProject(target); } catch (e) { fail('check-process could not read the project: ' + e.message); }
    if (res && res.failed) {
      // The file a problem line names: the path before its first colon or space. A line about another file gets no fix line.
      const fileOf = (p) => { const m = /^(\S+?\.(?:md|json|yaml|js))(?=:|\s)/.exec(p); return m ? m[1] : null; };
      const keptFile = (f) => !!f && (f.startsWith(skills.SKILLS + '/') || f.startsWith(skills.AGENTS + '/') || f === 'RULES.md' || f === 'cheatsheet.md');
      const overwrite = installerCommand('update', target, '--overwrite');
      const runIt = /^run /.test(overwrite) ? overwrite : 'run: ' + overwrite;
      const allEdits = 'That replaces every file you edited, across the whole project, and saves each one as a .carousel-backup file beside it first, so you can carry your edits over.';
      const fromClone = /^node /.test(overwrite);
      const compare = (f) => fromClone ? ' Or compare it with ' + path.join(SOURCE, f) + ' and carry the changes in by hand.' : '';
      (res.problems.deadrefs || []).forEach((p) => {
        const m = /^(\S+?):(\d+): `(carousel-[a-z-]+)` is not a stage/.exec(p);
        // A name this version ships is only missing its file: the missing-file fix line below covers it.
        if (!m || !keptFile(m[1]) || LIST.stages.includes(m[3]) || LIST.agents.includes(m[3] + '.md')) return;
        const now = LIST.renamed[m[3]];
        say('fix      ' + m[1] + ' line ' + m[2] + ' names `' + m[3] + '`, a stage this version no longer ships' + (now ? '; it is now `' + now + '`. Change that name to `' + now + '`' : '. Remove or replace that name') + '. Update kept this file because you edited it.');
      });
      const contractFiles = Array.from(new Set((res.problems.contract || []).map(fileOf).filter(keptFile)));
      contractFiles.forEach((f) => {
        if (!fs.existsSync(path.join(target, f))) say('fix      ' + f + ' is missing. To bring it back, ' + runIt + '. ' + allEdits);
        else say('fix      ' + f + ' does not meet what this version\'s checks require (you edited it, so update kept it). To take this version\'s copy, ' + runIt + '. ' + allEdits + compare(f));
      });
      (res.migration || []).forEach((l) => say(l.startsWith('HINT ') ? 'fix      ' + l.slice(5) : '         ' + l.trim()));
      Object.keys(res.problems).forEach((name) => fail('check-process: ' + name + ' fails (' + res.problems[name].length + '); run ' + checkCommand(target) + ' to see each problem'));
    } else if (res) ok('check-process passes');
  }

  const called = filesCalledByCommands(target);
  called.forEach((f) => { if (!fs.existsSync(path.join(target, f.path))) bad(f.path + ' (called by ' + f.by + ')'); });
  if (called.length) ok(called.length + ' files called by the stages are all present');
  engineLines(target, ok, bad, fail);

  say(problems.length ? `doctor: ${problems.length} problem(s)` : 'doctor: all good');
  return problems.length ? 1 : 0;
}

// --------------------------------------------------------------------- main

function main(argv) {
  const o = parseArgs(argv);
  if (o.help) { say(USAGE); return 0; }
  if (o.errors.length) { o.errors.forEach((e) => warn(e)); warn(USAGE); return 2; }
  try {
    if (o.cmd === 'doctor') return doctor(o);
    if (o.cmd === 'update' && !o.target) o.target = process.cwd();
    return install(o, o.cmd === 'update');
  } catch (e) {
    if (e instanceof InstallError) { warn(e.message); return 1; }
    if (e && (e.code === 'ENOTDIR' || e.code === 'EEXIST')) { warn('install: expected a folder, found a file (' + (e.path || 'unknown path') + '). Move or rename it, then run again.'); return 1; }
    if (e && e.code === 'EISDIR') { warn('install: a folder is where a file should be (' + (e.path || 'unknown path') + '). Move or rename it, then run again.'); return 1; }
    if (e && (e.code === 'EACCES' || e.code === 'EPERM')) { warn('install: no permission to write ' + (e.path || 'there') + '.'); return 1; }
    throw e;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main, parseArgs, assertNoSymlink, assertInside };
