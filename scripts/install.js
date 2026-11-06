#!/usr/bin/env node
'use strict';
// carousel-os installer. Zero dependencies.
//
//   node scripts/install.js init <target> [--no-agents] [--dry-run] [--overwrite]
//   node scripts/install.js <existing-folder> [...]       the same as init, for a folder that already exists
//   node scripts/install.js update [<target>] [--no-agents] [--dry-run] [--overwrite]
//   node scripts/install.js doctor [<target>]
//
// init     copies the process into <target>: RULES.md, commands, plans, bookshelf, docs, memory skeleton and
//          scripts. It also copies the nine commands into <target>/.claude/commands/ where agents look
//          (--no-agents skips that copy).
// update   re-runs init against an existing install. It replaces only files you have not edited, does not
//          bring back a file you deleted on purpose, and removes a file a newer version stopped shipping
//          only when you have not edited it.
// doctor   checks what is installed and prints exactly what is missing.
//
// A file you already have in .claude/commands/ with the same name is never replaced, even with --overwrite.
// A manifest (.carousel-install.json) records the hash of every file this script wrote and every file you
// deleted. memory/ is a skeleton: it is created once and never changed again, even with --overwrite.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE = path.resolve(__dirname, '..');
const MANIFEST = '.carousel-install.json';
const AGENT_DIR = '.claude/commands';
const VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(SOURCE, 'package.json'), 'utf8')).version; } catch (e) { return '0'; }
})();

// What the process installs. A "dir" is copied whole; a "file" singly.
const PROCESS = [
  { file: 'RULES.md' },
  { file: 'cheatsheet.md' },
  { file: 'carousel.config.example.json' },   // the example only: a carousel.config.json is the user's and is never installed
  { file: 'AGENTS.md', onlyIfAbsent: true },
  { file: 'CLAUDE.md', onlyIfAbsent: true },
  { dir: 'commands' },
  { dir: 'plans' },
  { dir: 'bookshelf' },
  { dir: 'docs', only: ['light-path.md', 'cost.md', 'how-it-thinks.md'] },
  { dir: 'docs/build-your-engine' },
  { dir: 'docs/gallery' },
  { dir: 'tests/process' },
  { dir: 'scripts', only: ['check-process.js', 'check-process.config.json', 'rotate-log.js', 'lessons.js', 'install.js'] },
  { dir: 'memory', skeleton: true },
];
const SKIP_NAMES = new Set(['__pycache__', '.DS_Store', '.git', 'node_modules']);

class InstallError extends Error {}

const EMPTY_LOG = [
  '# Log', '',
  'What happened, newest first. One plain paragraph per session under a heading `## YYYY-MM-DD <slug>`, and an optional `Friction:` line when something slowed the work. Facts that stay true go in `wiki/`. Entries older than the current ISO week move to `history/` when `node scripts/rotate-log.js` runs.',
  '',
].join('\n');

function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function say(msg) { process.stdout.write(msg + '\n'); }

// Refuse to write through a symlink: the target folder itself, or any folder or file under it on the way to a path.
function assertNoSymlink(target, rel) {
  const parts = [''].concat(rel ? rel.split('/') : []);
  let cur = target;
  parts.forEach((part) => {
    cur = part ? path.join(cur, part) : cur;
    let st = null;
    try { st = fs.lstatSync(cur); } catch (e) { return; }
    if (st.isSymbolicLink()) throw new InstallError('refusing to write through a symlink: ' + cur + '. Replace it with a real folder or file, or pick another target.');
  });
}

function walk(root, rel, out) {
  const abs = path.join(root, rel);
  fs.readdirSync(abs, { withFileTypes: true }).forEach((d) => {
    if (SKIP_NAMES.has(d.name) || d.name.endsWith('.pyc')) return;
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

// memory/wiki/lessons.history starts as its header comment only, whatever the repository's own copy holds.
function lessonsHistoryEntry() {
  const t = path.join(SOURCE, 'memory', 'wiki', 'lessons.history');
  const head = fs.existsSync(t) ? fs.readFileSync(t, 'utf8').split('\n').filter((l) => l.startsWith('#')).join('\n') + '\n' : '# Append-only. One line per human-confirmed action.\n';
  return { rel: 'memory/wiki/lessons.history', skeleton: true, content: Buffer.from(head) };
}

function listSource() {
  const out = [];
  PROCESS.forEach((s) => {
    if (s.file) {
      if (fs.existsSync(path.join(SOURCE, s.file))) out.push({ rel: s.file, onlyIfAbsent: !!s.onlyIfAbsent });
      return;
    }
    if (!fs.existsSync(path.join(SOURCE, s.dir))) return;
    let files = walk(SOURCE, s.dir, []);
    if (s.only) files = files.filter((f) => s.only.includes(f.slice(s.dir.length + 1)));
    else if (s.dir === 'docs') files = [];
    files.forEach((f) => {
      if (out.some((o) => o.rel === f)) return;                                    // a nested dir listed on its own
      if (s.skeleton && (f === 'memory/LOG.md' || f === 'memory/LOG.md.template' || f === 'memory/wiki/lessons.history')) return;
      out.push({ rel: f, skeleton: !!s.skeleton });
    });
    if (s.skeleton && s.dir === 'memory') { out.push(logEntry()); out.push(lessonsHistoryEntry()); }
  });
  return out;
}

// The nine stage commands, copied where agents look. They are the user's to keep: an existing file of the same
// name that this tool did not write is never touched.
function agentFiles() {
  const dir = path.join(SOURCE, 'commands');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^carousel-.*\.md$/.test(f)).sort()
    .map((f) => ({ rel: AGENT_DIR + '/' + f, from: 'commands/' + f, userOwned: true }));
}

function readManifest(target) {
  try { return JSON.parse(fs.readFileSync(path.join(target, MANIFEST), 'utf8')); } catch (e) { return null; }
}

const USAGE = [
  'usage: node scripts/install.js init <target> [--no-agents] [--dry-run] [--overwrite]',
  '       node scripts/install.js update [<target>] [--no-agents] [--dry-run] [--overwrite]',
  '       node scripts/install.js doctor [<target>]',
  '       node scripts/install.js <existing-folder> [options]     the same as init',
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
  } else {
    o.errors.push(`unknown command "${first}". Use "init ${first}" to create a new folder, or pass a folder that exists.`);
    return o;
  }
  if (rest.length > 1) o.errors.push('too many arguments: ' + rest.slice(1).join(' '));
  o.target = rest[0] ? path.resolve(rest[0]) : null;
  return o;
}

// ------------------------------------------------------------------ install

function install(o, updating) {
  if (!o.target) { say(USAGE); return 2; }
  if (fs.existsSync(o.target) && !fs.statSync(o.target).isDirectory()) { say('install: ' + o.target + ' is a file, not a folder. Pass the folder to install into.'); return 1; }
  assertNoSymlink(o.target, '');
  const manifest = readManifest(o.target);
  if (updating && !manifest) { say('update: no ' + MANIFEST + ' in ' + o.target + '. Run init first.'); return 1; }
  const withAgents = o.agentsGiven ? o.agents : !(manifest && manifest.agents === false);
  const files = listSource().concat(withAgents ? agentFiles() : []);
  const recorded = (manifest && manifest.files) || {};
  const deleted = new Set((manifest && manifest.deleted) || []);
  const next = Object.assign({}, recorded);
  const counts = { added: 0, updated: 0, same: 0, kept: 0, exists: 0, skippedDeleted: 0, removed: 0 };
  const verb = o.dry ? 'would ' : '';
  const shipped = new Set(files.map((f) => f.rel));

  files.forEach((f) => {
    const dst = path.join(o.target, f.rel);
    const buf = f.content || fs.readFileSync(path.join(SOURCE, f.from || f.rel));
    const h = sha(buf);
    const present = fs.existsSync(dst);
    let action = null;
    if (!present) {
      if (recorded[f.rel] && !o.overwrite) {                  // we installed it and it is gone: the user deleted it
        deleted.add(f.rel); delete next[f.rel];
        counts.skippedDeleted++; say('skipped  ' + f.rel + ' (you deleted it; use --overwrite to bring it back)');
        return;
      }
      if (deleted.has(f.rel) && !o.overwrite) { counts.skippedDeleted++; say('skipped  ' + f.rel + ' (you deleted it; use --overwrite to bring it back)'); return; }
      action = 'add';
    } else if (f.skeleton) { counts.same++; return; }           // memory is never touched again
    else {
      const cur = sha(fs.readFileSync(dst));
      if (cur === h) { counts.same++; next[f.rel] = h; return; }
      if (f.userOwned && !recorded[f.rel]) { counts.exists++; say('exists   ' + f.rel + ' (yours; never replaced)'); return; }
      if (f.onlyIfAbsent && !recorded[f.rel]) { counts.exists++; say('exists   ' + f.rel + ' (yours; never replaced)'); return; }
      if (f.onlyIfAbsent && !o.overwrite) { counts.exists++; say('exists   ' + f.rel); return; }
      if (o.overwrite) action = 'update';
      else if (recorded[f.rel] && recorded[f.rel] === cur) action = 'update';   // unedited since install
      else if (recorded[f.rel]) { counts.kept++; say('kept     ' + f.rel + ' (you edited it; use --overwrite to replace)'); return; }
      else { counts.exists++; say('exists   ' + f.rel + ' (not installed by this tool; use --overwrite to replace)'); return; }
    }
    say(verb + (action === 'add' ? 'add      ' : 'update   ') + f.rel);
    counts[action === 'add' ? 'added' : 'updated']++;
    if (!o.dry) {
      assertNoSymlink(o.target, f.rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, buf);
      next[f.rel] = h;
      deleted.delete(f.rel);
    }
  });

  // Files a newer version no longer ships: removed only when you have not edited them.
  Object.keys(recorded).filter((rel) => !shipped.has(rel)).forEach((rel) => {
    const dst = path.join(o.target, rel);
    if (rel.startsWith('engine/') || rel === 'scripts/engine.js' || rel.startsWith('.carousel-venv/')) {
      say('left     ' + rel + ' (no longer shipped; this copy is yours to keep)');
      return;
    }
    if (!fs.existsSync(dst)) { delete next[rel]; return; }
    if (sha(fs.readFileSync(dst)) === recorded[rel]) {
      say(verb + 'remove   ' + rel + ' (no longer shipped)');
      counts.removed++;
      if (!o.dry) { assertNoSymlink(o.target, rel); fs.rmSync(dst); delete next[rel]; }
    } else {
      counts.kept++; say('kept     ' + rel + ' (no longer shipped, but you edited it)');
    }
  });

  say(`${verb}done: ${counts.added} added, ${counts.updated} updated, ${counts.same} unchanged, ${counts.kept} kept (edited), ${counts.exists} left alone, ${counts.skippedDeleted} skipped (deleted by you), ${counts.removed} removed.`);

  if (!o.dry) {
    fs.mkdirSync(o.target, { recursive: true });
    assertNoSymlink(o.target, MANIFEST);
    const out = { version: VERSION, agents: !!withAgents, files: next };
    if (deleted.size) out.deleted = Array.from(deleted).sort();
    fs.writeFileSync(path.join(o.target, MANIFEST), JSON.stringify(out, null, 2) + '\n');
  }
  return 0;
}

// ------------------------------------------------------------------- doctor

// Paths under scripts/ and tests/ that the stage commands name. A command that calls a file the install did not copy
// is a defect.
function filesCalledByCommands(target) {
  const dir = path.join(target, 'commands');
  const out = [];
  const seen = new Set();
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).filter((f) => f.endsWith('.md')).forEach((f) => {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const ref = /\b((?:scripts|tests)\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_](?:\.[A-Za-z0-9]+))/g;
    let m;
    while ((m = ref.exec(text))) {
      if (/[<*{]/.test(m[1]) || seen.has(m[1])) continue;
      // The engine is optional: its wrapper is only expected where the project has an engine/ folder.
      if (m[1] === 'scripts/engine.js' && !fs.existsSync(path.join(target, 'engine'))) continue;
      seen.add(m[1]);
      out.push({ path: m[1], by: 'commands/' + f });
    }
  });
  return out;
}

function doctor(o) {
  const target = o.target || process.cwd();
  if (!fs.existsSync(target)) { say('doctor: ' + target + ' does not exist.'); return 1; }
  if (!fs.statSync(target).isDirectory()) { say('doctor: ' + target + ' is a file, not a folder.'); return 1; }
  const problems = [];
  const ok = (m) => say('ok       ' + m);
  const bad = (m) => { problems.push(m); say('MISSING  ' + m); };

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) ok('Node ' + process.versions.node); else bad('Node 18 or newer (found ' + process.versions.node + ')');

  const required = ['RULES.md', 'commands/README.md', 'plans/plan.template.md', 'memory/wiki/lessons.md', 'bookshelf/README.md', 'scripts/check-process.js'];
  required.forEach((f) => { if (fs.existsSync(path.join(target, f))) ok(f); else bad(f + ' (run: node scripts/install.js init ' + target + ')'); });
  const cmds = fs.existsSync(path.join(target, 'commands')) ? fs.readdirSync(path.join(target, 'commands')).filter((f) => /^carousel-.*\.md$/.test(f)).length : 0;
  if (cmds >= 9) ok(cmds + ' stage commands'); else bad('stage commands: found ' + cmds + ' of 9 in commands/');

  const manifest = readManifest(target);
  const agentDir = path.join(target, AGENT_DIR);
  const agentHave = fs.existsSync(agentDir) ? fs.readdirSync(agentDir).filter((f) => /^carousel-.*\.md$/.test(f)).length : 0;
  if (agentHave >= 9) ok(AGENT_DIR + ': ' + agentHave + ' commands');
  else if (manifest && manifest.agents) bad(AGENT_DIR + ': found ' + agentHave + ' of 9 commands (run: node scripts/install.js update ' + target + ')');
  else say('agents   ' + AGENT_DIR + ' has ' + agentHave + ' of 9 commands (optional; add with: node scripts/install.js update ' + target + ' --agents)');

  const called = filesCalledByCommands(target);
  called.forEach((f) => { if (!fs.existsSync(path.join(target, f.path))) bad(f.path + ' (called by ' + f.by + ')'); });
  if (called.length) ok(called.length + ' files called by the commands are all present');
  if (!fs.existsSync(path.join(target, 'engine'))) say('engine   none (optional; see docs/build-your-engine/README.md)');

  say(problems.length ? `doctor: ${problems.length} problem(s)` : 'doctor: all good');
  return problems.length ? 1 : 0;
}

// --------------------------------------------------------------------- main

function main(argv) {
  const o = parseArgs(argv);
  if (o.help) { say(USAGE); return 0; }
  if (o.errors.length) { o.errors.forEach((e) => say(e)); say(USAGE); return 2; }
  try {
    if (o.cmd === 'doctor') return doctor(o);
    if (o.cmd === 'update' && !o.target) o.target = process.cwd();
    return install(o, o.cmd === 'update');
  } catch (e) {
    if (e instanceof InstallError) { say(e.message); return 1; }
    if (e && (e.code === 'ENOTDIR' || e.code === 'EEXIST')) { say('install: a file is where a folder should be (' + (e.path || 'unknown path') + '). Move or rename it, then run again.'); return 1; }
    if (e && e.code === 'EISDIR') { say('install: a folder is where a file should be (' + (e.path || 'unknown path') + '). Move or rename it, then run again.'); return 1; }
    if (e && (e.code === 'EACCES' || e.code === 'EPERM')) { say('install: no permission to write ' + (e.path || 'there') + '.'); return 1; }
    throw e;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main, parseArgs, assertNoSymlink };
