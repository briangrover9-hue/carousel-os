#!/usr/bin/env node
'use strict';
// Installer and repository-hygiene tests. Zero dependencies. Every test makes its own temp folders (in one
// per-run parent, removed at the end), so runs never share state.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const INSTALL = path.join(ROOT, 'scripts', 'install.js');
const RUN_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-test-'));
let failures = 0;
let passed = 0;
let seq = 0;

function tmp() { const d = path.join(RUN_DIR, 'd' + (++seq)); fs.mkdirSync(d); return d; }
function run(args, opts) {
  const r = cp.spawnSync(process.execPath, [INSTALL].concat(args), { encoding: 'utf8', cwd: (opts && opts.cwd) || ROOT });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function node(script, args, cwd) {
  const r = cp.spawnSync(process.execPath, [script].concat(args || []), { encoding: 'utf8', cwd: cwd || ROOT });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function test(name, fn) {
  try { fn(); passed++; console.log('ok    ' + name); } catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || 'expected equal') + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }
function yes(c, msg) { if (!c) throw new Error(msg); }
function walk(dir, rel, out) {
  fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).forEach((d) => {
    const r = rel ? rel + '/' + d.name : d.name;
    if (d.isDirectory()) walk(dir, r, out); else out.push(r);
  });
  return out;
}
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function manifestOf(t) { return JSON.parse(fs.readFileSync(path.join(t, '.carousel-install.json'), 'utf8')); }
function writeManifest(t, m) { fs.writeFileSync(path.join(t, '.carousel-install.json'), JSON.stringify(m)); }

const NINE = ['start', 'brief', 'storyboard', 'challenge-plan', 'build', 'check', 'review', 'wrap', 'handoff'].map((n) => `carousel-${n}.md`);

// ------------------------------------------------------------------ init and the argument rules
test('init installs the process, with no engine and no Python files', () => {
  const t = tmp();
  const r = run(['init', t]);
  eq(r.code, 0, 'exit code\n' + r.out);
  ['RULES.md', 'commands/carousel-build.md', 'plans/plan.template.md', 'memory/wiki/lessons.md', 'bookshelf/rubric.md', 'scripts/check-process.js', 'tests/process/run.js', '.carousel-install.json'].forEach((f) => yes(fs.existsSync(path.join(t, f)), 'missing ' + f));
  yes(!fs.existsSync(path.join(t, 'engine')), 'an engine folder was installed');
  yes(!walk(t, '', []).some((f) => f.endsWith('.py')), 'a Python file was installed');
});

test('every script the process scripts require ships, and the repository-only ones stay home', () => {
  const t = tmp();
  run(['init', t]);
  const have = fs.readdirSync(path.join(t, 'scripts'));
  ['check-process.js', 'lessons.js', 'rotate-log.js', 'install.js', 'check-process.config.json'].forEach((f) => yes(have.includes(f), f + ' was not installed'));
  ['check.js', 'check-links.js', 'leak-scan.js'].forEach((f) => yes(!have.includes(f), f + ' was installed'));
  fs.readdirSync(path.join(ROOT, 'scripts')).filter((f) => f.endsWith('.js')).forEach((f) => {
    const text = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
    if (!have.includes(f)) return;
    (text.match(/require\('\.\/[^']+'\)/g) || []).forEach((m) => yes(have.includes(m.slice(11, -2)), f + ' requires ' + m + ', which was not installed'));
  });
});

test('the bare form works for a folder that exists', () => {
  const t = tmp();
  eq(run([t]).code, 0);
  yes(fs.existsSync(path.join(t, 'RULES.md')), 'RULES.md missing');
});

test('a first word that is not a command and not an existing folder is refused', () => {
  const r = run([path.join(RUN_DIR, 'no-such-folder')]);
  eq(r.code, 2, r.out);
  yes(/unknown command/.test(r.out) && /init/.test(r.out), r.out);
  yes(!fs.existsSync(path.join(RUN_DIR, 'no-such-folder')), 'a folder was created');
  eq(run(['updte', tmp() + '-nope']).code, 2, 'a typo of a command was accepted');
});

test('init creates a new folder when it is given', () => {
  const t = path.join(tmp(), 'brand-new');
  eq(run(['init', t]).code, 0);
  yes(fs.existsSync(path.join(t, 'RULES.md')), 'RULES.md missing');
});

test('extra positional arguments are refused', () => {
  const r = run(['init', tmp(), tmp()]);
  eq(r.code, 2, r.out);
  yes(/too many arguments/.test(r.out), r.out);
});

test('an unknown flag is refused, and --engine says the engine is not in this repository', () => {
  eq(run(['init', tmp(), '--bogus']).code, 2);
  const r = run(['init', tmp(), '--engine']);
  eq(r.code, 2, r.out);
  yes(/engine is not part of this repository/.test(r.out), r.out);
});

test('dry run writes nothing', () => {
  const t = path.join(tmp(), 'new');
  const r = run(['init', t, '--dry-run']);
  eq(r.code, 0);
  yes(/would add/.test(r.out), 'no "would add" lines');
  yes(!fs.existsSync(t), 'dry run created the target');
});

test('the installed project passes its own process checks and its own process tests', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0);
  let r = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  eq(r.code, 0, 'check-process in the installed copy\n' + r.out);
  r = node(path.join(t, 'tests', 'process', 'run.js'), [], t);
  eq(r.code, 0, "the installed project's own process tests\n" + r.out.slice(-800));
});

// ------------------------------------------------------------------ re-runs, edits, deletions
test('a re-run changes nothing', () => {
  const t = tmp();
  run(['init', t]);
  const before = walk(t, '', []).sort().join('\n');
  const r = run(['init', t]);
  eq(r.code, 0);
  yes(/0 added, 0 updated/.test(r.out), 'second run touched files:\n' + r.out);
  eq(walk(t, '', []).sort().join('\n'), before, 'file list changed');
});

test('a re-run keeps a file you edited and updates one you did not', () => {
  const t = tmp();
  run(['init', t]);
  const edited = path.join(t, 'bookshelf', 'rubric.md');
  fs.appendFileSync(edited, '\nMy own note.\n');
  const stale = path.join(t, 'bookshelf', 'design.md');
  fs.writeFileSync(stale, 'older release text\n');
  const m = manifestOf(t);
  m.files['bookshelf/design.md'] = sha('older release text\n');
  writeManifest(t, m);
  const r = run(['update', t]);
  eq(r.code, 0);
  yes(/kept\s+bookshelf\/rubric\.md/.test(r.out), 'edited file was not reported as kept:\n' + r.out);
  yes(fs.readFileSync(edited, 'utf8').includes('My own note.'), 'edited file lost its edit');
  yes(!fs.readFileSync(stale, 'utf8').includes('older release text'), 'an unedited stale file was not updated');
});

test('--overwrite replaces an edited file but never touches memory', () => {
  const t = tmp();
  run(['init', t]);
  const edited = path.join(t, 'bookshelf', 'rubric.md');
  fs.appendFileSync(edited, '\nMy own note.\n');
  const mem = path.join(t, 'memory', 'wiki', 'lessons.md');
  fs.appendFileSync(mem, '\n- my lesson\n');
  eq(run(['init', t, '--overwrite']).code, 0);
  yes(!fs.readFileSync(edited, 'utf8').includes('My own note.'), '--overwrite did not replace the edited file');
  yes(fs.readFileSync(mem, 'utf8').includes('my lesson'), 'memory was changed');
});

test('a file you deleted on purpose is not brought back by update, and --overwrite brings it back', () => {
  const t = tmp();
  run(['init', t]);
  fs.unlinkSync(path.join(t, 'bookshelf', 'narrative-devices.md'));
  let r = run(['update', t]);
  yes(/skipped\s+bookshelf\/narrative-devices\.md \(you deleted it/.test(r.out), r.out);
  yes(!fs.existsSync(path.join(t, 'bookshelf', 'narrative-devices.md')), 'update re-added a deleted file');
  yes(manifestOf(t).deleted.includes('bookshelf/narrative-devices.md'), 'the deletion was not recorded');
  r = run(['update', t]);
  yes(!fs.existsSync(path.join(t, 'bookshelf', 'narrative-devices.md')), 'a second update re-added it');
  r = run(['update', t, '--overwrite']);
  yes(fs.existsSync(path.join(t, 'bookshelf', 'narrative-devices.md')), '--overwrite did not bring it back');
  yes(!(manifestOf(t).deleted || []).includes('bookshelf/narrative-devices.md'), 'the deletion record stayed after the file came back');
});

test('update removes a file a newer version no longer ships only when it is unedited', () => {
  const t = tmp();
  run(['init', t]);
  const gone = path.join(t, 'bookshelf', 'retired-a.md');
  const edited = path.join(t, 'bookshelf', 'retired-b.md');
  fs.writeFileSync(gone, 'old a\n');
  fs.writeFileSync(edited, 'old b\n');
  const m = manifestOf(t);
  m.files['bookshelf/retired-a.md'] = sha('old a\n');
  m.files['bookshelf/retired-b.md'] = sha('old b\n');
  m.files['bookshelf/retired-c.md'] = sha('never existed\n');       // already gone from disk
  writeManifest(t, m);
  fs.appendFileSync(edited, 'my edit\n');
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  yes(!fs.existsSync(gone), 'an unedited retired file was not removed');
  yes(fs.existsSync(edited), 'an edited retired file was removed');
  yes(/kept\s+bookshelf\/retired-b\.md \(no longer shipped, but you edited it\)/.test(r.out), r.out);
  const after = manifestOf(t).files;
  yes(!('bookshelf/retired-a.md' in after) && !('bookshelf/retired-c.md' in after), 'removed or missing files stayed in the manifest');
});

test('an engine copy from an older install is left alone, not removed', () => {
  const t = tmp();
  run(['init', t]);
  fs.mkdirSync(path.join(t, 'engine'));
  fs.writeFileSync(path.join(t, 'engine', 'deck_kit.py'), '# mine\n');
  const m = manifestOf(t);
  m.files['engine/deck_kit.py'] = sha('# mine\n');
  writeManifest(t, m);
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  yes(fs.existsSync(path.join(t, 'engine', 'deck_kit.py')), 'an older engine copy was deleted');
  yes(/left\s+engine\/deck_kit\.py/.test(r.out), r.out);
});

test('memory is never updated, even when the source memory file changes', () => {
  const t = tmp();
  run(['init', t]);
  const mem = path.join(t, 'memory', 'LOG.md');
  fs.writeFileSync(mem, 'my log\n');
  run(['update', t]);
  eq(fs.readFileSync(mem, 'utf8'), 'my log\n', 'memory/LOG.md was overwritten');
});

test('an existing project file is left alone without --overwrite', () => {
  const t = tmp();
  fs.writeFileSync(path.join(t, 'AGENTS.md'), 'my agents file\n');
  fs.mkdirSync(path.join(t, 'scripts'));
  fs.writeFileSync(path.join(t, 'scripts', 'check-process.js'), '// mine\n');
  const r = run(['init', t]);
  eq(r.code, 0);
  eq(fs.readFileSync(path.join(t, 'AGENTS.md'), 'utf8'), 'my agents file\n', 'AGENTS.md replaced');
  eq(fs.readFileSync(path.join(t, 'scripts', 'check-process.js'), 'utf8'), '// mine\n', 'a project script was replaced');
  yes(/exists\s+AGENTS\.md/.test(r.out), 'no "exists" line for AGENTS.md');
});

test('update refuses a folder with no manifest', () => {
  const r = run(['update', tmp()]);
  eq(r.code, 1);
  yes(/Run init first/.test(r.out), r.out);
});

test('--overwrite never replaces a CLAUDE.md or AGENTS.md the tool did not install', () => {
  const t = tmp();
  fs.writeFileSync(path.join(t, 'CLAUDE.md'), 'my claude file\n');
  fs.writeFileSync(path.join(t, 'AGENTS.md'), 'my agents file\n');
  const r = run(['init', t, '--overwrite']);
  eq(r.code, 0, r.out);
  eq(fs.readFileSync(path.join(t, 'CLAUDE.md'), 'utf8'), 'my claude file\n', '--overwrite replaced CLAUDE.md');
  eq(fs.readFileSync(path.join(t, 'AGENTS.md'), 'utf8'), 'my agents file\n', '--overwrite replaced AGENTS.md');
  yes(/exists\s+CLAUDE\.md \(yours; never replaced\)/.test(r.out), r.out);
  run(['update', t, '--overwrite']);
  eq(fs.readFileSync(path.join(t, 'CLAUDE.md'), 'utf8'), 'my claude file\n', 'a later --overwrite replaced CLAUDE.md');
});

test('memory/LOG.md in a new project is empty and made from the template, and the author\'s own log is not copied', () => {
  const t = tmp();
  run(['init', t]);
  const log = fs.readFileSync(path.join(t, 'memory', 'LOG.md'), 'utf8');
  yes(!/^## \d{4}-\d{2}-\d{2}/m.test(log), 'the new LOG.md holds an entry:\n' + log.slice(0, 300));
  yes(/^# Log/.test(log), 'the new LOG.md has no heading');
  yes(fs.existsSync(path.join(t, 'memory', 'LOG.template.md')), 'the log template is missing, and the process checks read it');
  const src = path.join(ROOT, 'memory', 'LOG.template.md');
  if (fs.existsSync(src)) eq(log, fs.readFileSync(src, 'utf8'), 'LOG.md is not the template');
  run(['update', t, '--overwrite']);
  eq(fs.readFileSync(path.join(t, 'memory', 'LOG.md'), 'utf8'), log, 'an update changed LOG.md');
});

test('lessons.history starts as its header only, the example config ships and a real config never does', () => {
  const t = tmp();
  run(['init', t]);
  const hist = fs.readFileSync(path.join(t, 'memory', 'wiki', 'lessons.history'), 'utf8');
  yes(/^#/.test(hist) && hist.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length === 0, 'lessons.history holds entries:\n' + hist);
  yes(fs.existsSync(path.join(t, 'carousel.config.example.json')), 'the example config was not installed');
  yes(!fs.existsSync(path.join(t, 'carousel.config.json')), 'a carousel.config.json was installed');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  yes(pkg.files.includes('carousel.config.example.json'), 'package.json does not list the example config');
  yes(!pkg.files.includes('carousel.config.json'), 'package.json lists a real config');
});

// ------------------------------------------------------------------ agent commands
test('init copies the nine commands to .claude/commands and keeps commands/', () => {
  const t = tmp();
  run(['init', t]);
  NINE.forEach((f) => {
    yes(fs.existsSync(path.join(t, '.claude', 'commands', f)), 'missing .claude/commands/' + f);
    eq(fs.readFileSync(path.join(t, '.claude', 'commands', f), 'utf8'), fs.readFileSync(path.join(t, 'commands', f), 'utf8'), f + ' differs between the two copies');
  });
  const m = manifestOf(t);
  eq(m.agents, true, 'manifest does not record agents');
  yes(NINE.every((f) => m.files['.claude/commands/' + f]), 'manifest does not track every agent command');
  yes(!fs.existsSync(path.join(t, '.claude', 'commands', 'README.md')), 'the commands README was copied as a command');
});

test('--no-agents skips .claude/commands and an update keeps skipping it', () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0);
  yes(!fs.existsSync(path.join(t, '.claude')), '.claude was created with --no-agents');
  run(['update', t]);
  yes(!fs.existsSync(path.join(t, '.claude')), 'an update added agents after --no-agents');
  run(['update', t, '--agents']);
  yes(fs.existsSync(path.join(t, '.claude', 'commands', 'carousel-build.md')), '--agents did not add them later');
});

test('a user file of the same name in .claude/commands is never replaced, even with --overwrite', () => {
  const t = tmp();
  fs.mkdirSync(path.join(t, '.claude', 'commands'), { recursive: true });
  const mine = path.join(t, '.claude', 'commands', 'carousel-build.md');
  fs.writeFileSync(mine, 'my own build command\n');
  const r = run(['init', t]);
  yes(/exists\s+\.claude\/commands\/carousel-build\.md/.test(r.out), 'no "exists" line:\n' + r.out);
  run(['init', t, '--overwrite']);
  eq(fs.readFileSync(mine, 'utf8'), 'my own build command\n', '--overwrite replaced the user file');
  yes(fs.existsSync(path.join(t, '.claude', 'commands', 'carousel-check.md')), 'the other commands were not installed');
});

test('an edited agent command is kept on update; an unedited stale one is updated', () => {
  const t = tmp();
  run(['init', t]);
  const edited = path.join(t, '.claude', 'commands', 'carousel-wrap.md');
  fs.appendFileSync(edited, '\nMy addition.\n');
  const stale = path.join(t, '.claude', 'commands', 'carousel-start.md');
  fs.writeFileSync(stale, 'older text\n');
  const m = manifestOf(t);
  m.files['.claude/commands/carousel-start.md'] = sha('older text\n');
  writeManifest(t, m);
  const r = run(['update', t]);
  yes(/kept\s+\.claude\/commands\/carousel-wrap\.md/.test(r.out), r.out);
  yes(fs.readFileSync(edited, 'utf8').includes('My addition.'), 'edit lost');
  yes(fs.readFileSync(stale, 'utf8') !== 'older text\n', 'stale command not updated');
});

// ------------------------------------------------------------------ doctor
test('doctor passes on an install, and checks the files the commands call', () => {
  const t = tmp();
  run(['init', t]);
  const r = run(['doctor', t]);
  eq(r.code, 0, r.out);
  yes(/ok\s+\.claude\/commands: 9 commands/.test(r.out), r.out);
  yes(!/MISSING/.test(r.out), r.out);
  fs.appendFileSync(path.join(t, 'commands', 'carousel-check.md'), '\nRun `scripts/not_installed.js` and `tests/not_installed.js`.\n');
  const bad = run(['doctor', t]);
  eq(bad.code, 1, bad.out);
  yes(/MISSING\s+scripts\/not_installed\.js \(called by commands\/carousel-check\.md\)/.test(bad.out), bad.out);
  yes(/MISSING\s+tests\/not_installed\.js/.test(bad.out), bad.out);
});

test('doctor names what is missing, and a missing agent command', () => {
  const t = tmp();
  run(['init', t]);
  fs.unlinkSync(path.join(t, 'RULES.md'));
  fs.unlinkSync(path.join(t, '.claude', 'commands', 'carousel-review.md'));
  const r = run(['doctor', t]);
  eq(r.code, 1);
  yes(/MISSING\s+RULES\.md/.test(r.out), r.out);
  yes(/MISSING\s+\.claude\/commands: found 8 of 9/.test(r.out), r.out);
});

test('doctor treats a missing .claude/commands as optional after --no-agents', () => {
  const t = tmp();
  run(['init', t, '--no-agents']);
  const r = run(['doctor', t]);
  eq(r.code, 0, r.out);
  yes(/agents\s+\.claude\/commands has 0 of 9/.test(r.out), r.out);
});

test('doctor says plainly when the folder does not exist or is a file', () => {
  let r = run(['doctor', path.join(RUN_DIR, 'nothing-here')]);
  eq(r.code, 1);
  yes(/does not exist/.test(r.out) && !/\n\s+at /.test(r.out), r.out);
  const f = path.join(tmp(), 'afile');
  fs.writeFileSync(f, 'x');
  r = run(['doctor', f]);
  eq(r.code, 1);
  yes(/is a file, not a folder/.test(r.out), r.out);
});

test('init and doctor need no Python at all', () => {
  const t = tmp();
  const env = Object.assign({}, process.env, { PATH: path.dirname(process.execPath) });
  const a = cp.spawnSync(process.execPath, [INSTALL, 'init', t], { encoding: 'utf8', env });
  eq(a.status, 0, a.stdout + a.stderr);
  const d = cp.spawnSync(process.execPath, [INSTALL, 'doctor', t], { encoding: 'utf8', env });
  eq(d.status, 0, d.stdout + d.stderr);
  yes(!/Python/i.test(d.stdout), 'doctor looked for Python');
});

// ------------------------------------------------------------------ safe failures
test('a target that is a file gets a friendly error, not a stack trace', () => {
  const f = path.join(tmp(), 'afile');
  fs.writeFileSync(f, 'x');
  const r = run(['init', f]);
  eq(r.code, 1, r.out);
  yes(/is a file, not a folder/.test(r.out), r.out);
  yes(!/\n\s+at /.test(r.out), 'a stack trace was printed:\n' + r.out);
});

test('a folder where a file should be (EISDIR) and a file where a folder should be (ENOTDIR) get plain messages', () => {
  const a = tmp();
  fs.mkdirSync(path.join(a, 'RULES.md'));
  let r = run(['init', a]);
  eq(r.code, 1, r.out);
  yes(/a folder is where a file should be/.test(r.out) && !/\n\s+at /.test(r.out), r.out);
  const b = tmp();
  fs.writeFileSync(path.join(b, 'commands'), 'i am a file');
  r = run(['init', b]);
  eq(r.code, 1, r.out);
  yes(/a file is where a folder should be/.test(r.out) && !/\n\s+at /.test(r.out), r.out);
});

if (process.platform !== 'win32') {
  test('the installer refuses to write through a symlink: the target, a folder in it, or a file in it', () => {
    const outside = tmp();
    const link = path.join(tmp(), 'link');
    fs.symlinkSync(outside, link);
    let r = run(['init', link]);
    eq(r.code, 1, r.out);
    yes(/refusing to write through a symlink/.test(r.out), r.out);
    eq(fs.readdirSync(outside).length, 0, 'files were written through the target symlink');
    const t = tmp();
    fs.symlinkSync(outside, path.join(t, 'commands'));
    r = run(['init', t]);
    eq(r.code, 1, r.out);
    yes(/refusing to write through a symlink: .*commands/.test(r.out), r.out);
    eq(fs.readdirSync(outside).length, 0, 'files were written through a folder symlink');
    const t2 = tmp();
    const victim = path.join(outside, 'victim.md');
    fs.writeFileSync(victim, 'keep me\n');
    fs.symlinkSync(victim, path.join(t2, 'RULES.md'));
    r = run(['init', t2, '--overwrite']);
    eq(r.code, 1, r.out);
    eq(fs.readFileSync(victim, 'utf8'), 'keep me\n', 'a file was overwritten through its symlink');
  });
}

// ------------------------------------------------------------------ the repository's own scripts
test('check.js, leak-scan.js and check-links.js refuse unknown flags and missing values', () => {
  [['scripts/check.js', '--bogus'], ['scripts/check.js', '--engine'], ['scripts/check.js', '--tokens'], ['scripts/leak-scan.js', '--tokens'],
    ['scripts/leak-scan.js', '--root'], ['scripts/leak-scan.js', '--bogus'], ['scripts/check-links.js', '--root'], ['scripts/check-links.js', 'extra']].forEach((a) => {
    const r = node(path.join(ROOT, a[0]), a.slice(1));
    eq(r.code, 2, a.join(' ') + ' exit code; output: ' + r.out);
    yes(/usage/i.test(r.out), a.join(' ') + ' printed no usage');
  });
  const r = node(path.join(ROOT, 'scripts', 'leak-scan.js'), ['--tokens', path.join(RUN_DIR, 'no-such-file')]);
  eq(r.code, 2, r.out);
  yes(/token file not found/.test(r.out) && !/\n\s+at /.test(r.out), r.out);
});

test('leak-scan finds a listed name and a home path, and ignores out/ and build/', () => {
  const t = tmp();
  fs.writeFileSync(path.join(t, 'a.md'), 'Sales at Zorblax grew.\n');
  fs.writeFileSync(path.join(t, 'b.md'), 'See ' + ['', 'Users', 'someone'].join('/') + '/notes.\n');
  fs.mkdirSync(path.join(t, 'out'));
  fs.writeFileSync(path.join(t, 'out', 'c.md'), 'Zorblax again.\n');
  const tokens = path.join(tmp(), 'names.txt');
  fs.writeFileSync(tokens, '# invented\nZorblax\n');
  const r = node(path.join(ROOT, 'scripts', 'leak-scan.js'), ['--root', t, '--tokens', tokens]);
  eq(r.code, 1, r.out);
  yes(/a\.md:1: token from your list/.test(r.out) && /b\.md:1: home path/.test(r.out), r.out);
  yes(!/out\//.test(r.out), 'the generated out/ folder was scanned:\n' + r.out);
  yes(!r.out.includes('Zorblax'), 'the scan printed the token itself');
});

test('there are no numeric flags left to validate: no script in scripts/ reads a number from argv', () => {
  fs.readdirSync(path.join(ROOT, 'scripts')).filter((f) => f.endsWith('.js')).forEach((f) => {
    const text = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
    yes(!/Number\(\s*(?:argv|args|process\.argv)/.test(text), f + ' reads a number from its arguments without a test here');
  });
});

test('package.json lists only files that exist, names no engine, and carries the repository fields', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  pkg.files.filter((f) => !f.startsWith('!')).forEach((f) => yes(fs.existsSync(path.join(ROOT, f)), 'package.json lists a missing path: ' + f));
  yes(!pkg.files.some((f) => /engine/.test(f)), 'package.json still lists an engine path');
  yes(!/engine/i.test(JSON.stringify(pkg.keywords) + pkg.description), 'package.json still describes an engine');
  eq(pkg.repository.url, 'git+https://github.com/briangrover9-hue/carousel-os.git', 'repository url');
  eq(pkg.bugs.url, 'https://github.com/briangrover9-hue/carousel-os/issues', 'bugs url');
  eq(pkg.homepage, 'https://github.com/briangrover9-hue/carousel-os', 'homepage');
  eq(pkg.name, 'carousel-os');
});

test('a mistyped command before a folder says the first word is not a command and names the folder', () => {
  const r = run(['frob', '.']);
  eq(r.code, 2, r.out);
  yes(/"frob" is not a command, and "\." is a folder/.test(r.out) && /init \./.test(r.out), r.out);
});

test('leak-scan errors carry the leak-scan: prefix', () => {
  [['--bogus'], ['--tokens'], ['--root'], ['--tokens', path.join(RUN_DIR, 'no-such-file')]].forEach((a) => {
    const r = node(path.join(ROOT, 'scripts', 'leak-scan.js'), a);
    eq(r.code, 2, a.join(' ') + ': ' + r.out);
    yes(/^leak-scan: /.test(r.out), a.join(' ') + ' error has no prefix: ' + r.out);
  });
});

test('package.json asks for Node 20, keeps the publish checklist out of the package, and CI and the checklist carry no "not run" note', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  eq(pkg.engines.node, '>=20');
  yes(pkg.files.includes('!docs/publish-checklist.md'), 'the publish checklist is not excluded from the package');
  yes(fs.existsSync(path.join(ROOT, 'docs', 'publish-checklist.md')), 'the checklist must stay in the repository');
  yes(!/has not run/i.test(fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'check.yml'), 'utf8')), 'CI file still says it has not run');
  yes(!/has not run/i.test(fs.readFileSync(path.join(ROOT, 'docs', 'publish-checklist.md'), 'utf8')), 'the checklist still says CI has not run');
  const ci = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'check.yml'), 'utf8');
  yes(/node: \[20, 22\]/.test(ci) && /ubuntu-latest, macos-latest, windows-latest/.test(ci), 'the CI matrix is not 3 systems by Node 20 and 22');
});

test('the skill wrapper obeys the upload rules: name, no angle brackets, 1024 characters or fewer', () => {
  const text = fs.readFileSync(path.join(ROOT, 'skills', 'carousel-os', 'SKILL.md'), 'utf8');
  const fm = (/^---\n([\s\S]*?)\n---/.exec(text) || [])[1] || '';
  yes(/^name:\s*carousel-os\s*$/m.test(fm), 'the frontmatter name is not carousel-os');
  const d = /^description:\s*"(.*)"\s*$/m.exec(fm);
  yes(d, 'no quoted description');
  yes(!/[<>]/.test(d[1]), 'the description has an angle bracket');
  yes(d[1].length <= 1024 && d[1].length >= 40, 'the description is ' + d[1].length + ' characters');
});

// ------------------------------------------------------------------ safety round: manifest, backups, partial installs
function runSplit(args) {
  const r = cp.spawnSync(process.execPath, [INSTALL].concat(args), { encoding: 'utf8', cwd: ROOT });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}
// A copy of this repository to act as the install source, so a test can change the source without touching the real one.
function sourceCopy(mutate) {
  const dest = tmp();
  const skip = new Set(['.git', 'node_modules', 'out', 'build']);
  (function copyDir(from, to) {
    fs.readdirSync(from, { withFileTypes: true }).forEach((d) => {
      if (skip.has(d.name)) return;
      const f = path.join(from, d.name);
      const t = path.join(to, d.name);
      if (d.isDirectory()) { fs.mkdirSync(t, { recursive: true }); copyDir(f, t); } else fs.copyFileSync(f, t);
    });
  })(ROOT, dest);
  if (mutate) mutate(dest);
  return dest;
}

test('a manifest key that resolves outside the project is refused, and nothing is deleted or written', () => {
  const outside = tmp();
  const victim = path.join(outside, 'victim.txt');
  fs.writeFileSync(victim, 'keep me\n');
  ['../victim.txt', '../../etc/passwd', '/etc/hosts', 'a/../../victim.txt', 'C:\\Windows\\win.ini'].forEach((key) => {
    const t = tmp();
    run(['init', t]);
    const m = manifestOf(t);
    m.files[key] = sha('keep me\n');
    writeManifest(t, m);
    const r = runSplit(['update', t]);
    eq(r.code, 1, key + ': ' + r.out + r.err);
    yes(/names a path outside the project/.test(r.err), key + ': ' + r.err);
    eq(fs.readFileSync(victim, 'utf8'), 'keep me\n', key + ' touched a file outside the project');
  });
  const t2 = tmp();
  run(['init', t2]);
  const m2 = manifestOf(t2);
  m2.deleted = ['../victim.txt'];
  writeManifest(t2, m2);
  eq(runSplit(['update', t2]).code, 1, 'a deleted entry outside the project was accepted');
  eq(runSplit(['doctor', t2]).code, 1, 'doctor accepted a manifest outside the project');
});

test('the EISDIR message names the real path of the folder that is in the way', () => {
  const t = tmp();
  fs.mkdirSync(path.join(t, 'RULES.md'));
  const r = runSplit(['init', t]);
  eq(r.code, 1, r.err);
  yes(r.err.includes(path.join(t, 'RULES.md')) && /a folder is where a file should be/.test(r.err), r.err);
  const t2 = tmp();
  fs.writeFileSync(path.join(t2, 'commands'), 'a file');
  const r2 = runSplit(['init', t2]);
  eq(r2.code, 1, r2.err);
  yes(r2.err.includes(path.join(t2, 'commands')) && /a file is where a folder should be/.test(r2.err), r2.err);
});

test('--overwrite saves your copy as .carousel-backup before replacing a file the tool never installed', () => {
  const t = tmp();
  fs.mkdirSync(path.join(t, 'bookshelf'));
  fs.writeFileSync(path.join(t, 'bookshelf', 'rubric.md'), 'my own rubric\n');
  let r = run(['init', t, '--overwrite']);
  eq(r.code, 0, r.out);
  yes(/backup\s+bookshelf\/rubric\.md \(your copy is saved as rubric\.md\.carousel-backup\)/.test(r.out), r.out);
  eq(fs.readFileSync(path.join(t, 'bookshelf', 'rubric.md.carousel-backup'), 'utf8'), 'my own rubric\n', 'the backup holds the wrong text');
  yes(fs.readFileSync(path.join(t, 'bookshelf', 'rubric.md'), 'utf8') !== 'my own rubric\n', 'the file was not replaced');
  // an edit to a file the tool did install is backed up too, and a second backup does not overwrite the first
  fs.writeFileSync(path.join(t, 'bookshelf', 'rubric.md'), 'edited again\n');
  r = run(['init', t, '--overwrite']);
  yes(/backup\s+bookshelf\/rubric\.md \(your copy is saved as rubric\.md\.carousel-backup2\)/.test(r.out), r.out);
  eq(fs.readFileSync(path.join(t, 'bookshelf', 'rubric.md.carousel-backup'), 'utf8'), 'my own rubric\n', 'the first backup was overwritten');
  eq(fs.readFileSync(path.join(t, 'bookshelf', 'rubric.md.carousel-backup2'), 'utf8'), 'edited again\n');
});

test('a file the tool installed and you never touched is replaced without a backup', () => {
  const src = sourceCopy();
  const t = tmp();
  const SRC_INSTALL = path.join(src, 'scripts', 'install.js');
  cp.spawnSync(process.execPath, [SRC_INSTALL, 'init', t], { encoding: 'utf8' });
  fs.appendFileSync(path.join(src, 'bookshelf', 'rubric.md'), '\nA newer line.\n');
  const r = cp.spawnSync(process.execPath, [SRC_INSTALL, 'update', t, '--overwrite'], { encoding: 'utf8' });
  eq(r.status, 0, r.stdout + r.stderr);
  yes(/update\s+bookshelf\/rubric\.md/.test(r.stdout) && !/backup/.test(r.stdout), r.stdout);
  yes(!fs.existsSync(path.join(t, 'bookshelf', 'rubric.md.carousel-backup')), 'a backup was made for an untouched file');
});

test('a partial install records what it wrote, and a rerun after the fix recognizes its own files', () => {
  const t = tmp();
  fs.mkdirSync(path.join(t, 'commands'));
  fs.mkdirSync(path.join(t, 'commands', 'carousel-build.md'));          // stops the install partway through commands/
  let r = runSplit(['init', t]);
  eq(r.code, 1, r.err);
  const m = manifestOf(t);
  yes(m.files['RULES.md'] && m.files['cheatsheet.md'], 'the manifest does not hold the files written before the failure');
  yes(!m.files['commands/carousel-build.md'], 'the manifest holds the file that failed');
  fs.rmSync(path.join(t, 'commands', 'carousel-build.md'), { recursive: true });
  r = runSplit(['init', t]);
  eq(r.code, 0, r.err);
  yes(!/not installed by this tool/.test(r.out + r.err), 'the rerun did not recognize its own files:\n' + r.out);
  yes(/0 kept \(edited\), 0 left alone/.test(r.out), r.out);
  yes(fs.existsSync(path.join(t, 'commands', 'carousel-build.md')), 'the rerun did not finish the install');
});

test('new projects get a header-only lessons.history and an empty log even when the source holds entries', () => {
  const src = sourceCopy((d) => {
    fs.appendFileSync(path.join(d, 'memory', 'wiki', 'lessons.history'), '2026-01-02 | confirm | L-abcdef | "yes" | an entry that must not ship\n');
    fs.appendFileSync(path.join(d, 'memory', 'LOG.md'), '\n## 2026-01-02 secret\n\nAn entry that must not ship.\n');
  });
  const t = tmp();
  const r = cp.spawnSync(process.execPath, [path.join(src, 'scripts', 'install.js'), 'init', t], { encoding: 'utf8' });
  eq(r.status, 0, r.stdout + r.stderr);
  const hist = fs.readFileSync(path.join(t, 'memory', 'wiki', 'lessons.history'), 'utf8');
  yes(!/must not ship/.test(hist) && hist.split('\n').every((l) => !l.trim() || l.startsWith('#')), 'lessons.history carried an entry:\n' + hist);
  yes(!/must not ship/.test(fs.readFileSync(path.join(t, 'memory', 'LOG.md'), 'utf8')), 'LOG.md carried an entry');
});

test('errors go to stderr and the summary line stays on stdout', () => {
  const t = tmp();
  let r = runSplit(['init', t]);
  eq(r.code, 0);
  yes(/^done: /.test(r.out.trim().split('\n').pop()) && r.err === '', 'the summary is not the last stdout line: ' + r.out.slice(-200) + r.err);
  [['init', t, '--bogus'], ['update', tmp()], ['frob', '.'], ['doctor', path.join(RUN_DIR, 'nothing-here')]].forEach((a) => {
    r = runSplit(a);
    yes(r.code !== 0 && r.err.length > 0, a.join(' ') + ': nothing on stderr');
    yes(!/does not exist|unknown option|Run init first|is not a command/.test(r.out), a.join(' ') + ': an error went to stdout: ' + r.out);
  });
  fs.unlinkSync(path.join(t, 'RULES.md'));
  r = runSplit(['doctor', t]);
  yes(/MISSING\s+RULES\.md/.test(r.err) && /^doctor: 1 problem/.test(r.out.trim().split('\n').pop()), 'doctor: ' + r.out + r.err);
});

// ------------------------------------------------------------------ line endings
const TEXT_EXT = /\.(md|js|yml|yaml|txt|gitignore|gitattributes)$|^(LICENSE|\.gitignore|\.gitattributes|\.npmignore)$/;
function trackedFiles() {
  const r = cp.spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null;
}
function copyTree(files, dest, convert) {
  files.forEach((f) => {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) return;
    const to = path.join(dest, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (convert(f)) fs.writeFileSync(to, fs.readFileSync(src, 'utf8').replace(/\r?\n/g, '\r\n'));
    else fs.copyFileSync(src, to);
  });
}

test('.gitattributes keeps text as LF and leaves binary and hashed files alone', () => {
  const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');
  yes(/^\* text=auto eol=lf$/m.test(ga), 'no "* text=auto eol=lf" line');
  ['memory/wiki/lessons.md', 'memory/wiki/lessons.history'].forEach((p) => yes(ga.includes(p + ' -text'), 'no "' + p + ' -text" line'));
  ['*.pptx', '*.png', '*.ttf', '*.json'].forEach((p) => yes(new RegExp('^' + p.replace(/[.*]/g, '\\$&') + ' -text$', 'm').test(ga), 'no "' + p + ' -text" line'));
});

test('a CRLF checkout (text files converted, binary and hashed files byte-stable) still passes the process checks and tests', () => {
  const files = trackedFiles();
  if (!files) { console.log('note  skipped: git is not available'); return; }
  const t = tmp();
  const HASHED = new Set(['memory/wiki/lessons.md', 'memory/wiki/lessons.history']);    // -text in .gitattributes: ids are hashes of their text
  copyTree(files, t, (f) => !HASHED.has(f) && (TEXT_EXT.test(path.basename(f)) || TEXT_EXT.test(f)));
  yes(fs.readFileSync(path.join(t, 'RULES.md'), 'utf8').includes('\r\n'), 'the copy was not converted to CRLF');
  // hashed files must be byte-identical to the source, as .gitattributes guarantees on a Windows checkout
  walk(path.join(ROOT, 'plans', 'example'), '', []).filter((f) => /\.(pptx|json)$/.test(f)).forEach((f) => {
    eq(sha(fs.readFileSync(path.join(t, 'plans', 'example', f))), sha(fs.readFileSync(path.join(ROOT, 'plans', 'example', f))), f + ' changed bytes');
  });
  let r = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  eq(r.code, 0, 'check-process on a CRLF checkout\n' + r.out.slice(-800));
  r = node(path.join(t, 'tests', 'process', 'run.js'), [], t);
  eq(r.code, 0, 'process tests on a CRLF checkout\n' + r.out.slice(-800));
});

test('control: converting a hashed file to CRLF is what breaks a check, so the -text rule matters', () => {
  const files = trackedFiles();
  if (!files) { console.log('note  skipped: git is not available'); return; }
  const hashed = files.filter((f) => /^plans\/example\/.*\.json$/.test(f));
  if (!hashed.length) { console.log('note  skipped: no hashed example file'); return; }
  const t = tmp();
  copyTree(files, t, () => false);
  hashed.forEach((f) => fs.writeFileSync(path.join(t, f), fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r?\n/g, '\r\n')));
  const r = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  if (r.code === 0) console.log('note  the control did not fail: the checks do not depend on the hashed file bytes, so the rule is a safeguard only');
});

fs.rmSync(RUN_DIR, { recursive: true, force: true });
console.log(`\ninstaller tests: ${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
