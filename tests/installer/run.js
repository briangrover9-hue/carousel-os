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
// The tools print paths as one shell word by this rule (double quotes on Windows), so expectations use it too.
const { shq } = require(path.join(ROOT, 'scripts', 'check-process.js'));
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

// The one list of what ships: scripts/stages.json.
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'stages.json'), 'utf8'));
const STAGES = LIST.stages;
const REVIEWERS = LIST.agents;
const skill = (dir, n) => `${dir}/${n}/SKILL.md`;

// ------------------------------------------------------------------ init and the argument rules
test('init installs the process, with no engine and no Python files', () => {
  const t = tmp();
  const r = run(['init', t]);
  eq(r.code, 0, 'exit code\n' + r.out);
  ['RULES.md', '.agents/skills/carousel-build/SKILL.md', 'agents/carousel-reviewer.md', 'plans/plan.template.md', 'memory/wiki/lessons.md', 'bookshelf/rubric.md', 'scripts/check-process.js', 'tests/process/run.js', '.carousel-install.json'].forEach((f) => yes(fs.existsSync(path.join(t, f)), 'missing ' + f));
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

test('update removes only an unedited file on the retiredFiles list; any other recorded file is forgotten and kept', () => {
  const t = tmp();
  run(['init', t]);
  const files = {
    'docs/light-path.md': 'old light path\n',          // retired, unedited: removed
    'commands/README.md': 'old commands\n',            // retired, edited below: kept
    'bookshelf/retired-a.md': 'old a\n',               // recorded with a matching hash, but not on the list: kept
    'engine/deck_kit.py': '# mine\n',                  // an engine copy an older install recorded: kept
  };
  const m = manifestOf(t);
  Object.keys(files).forEach((rel) => {
    fs.mkdirSync(path.dirname(path.join(t, rel)), { recursive: true });
    fs.writeFileSync(path.join(t, rel), files[rel]);
    m.files[rel] = sha(files[rel]);
  });
  m.files['plans/example/fernway-skip-cancel.md'] = sha('never existed\n');   // retired and already gone from disk
  writeManifest(t, m);
  fs.appendFileSync(path.join(t, 'commands/README.md'), 'my edit\n');
  yes(LIST.retiredFiles.includes('docs/light-path.md') && LIST.retiredFiles.includes('commands/README.md'), 'the test paths are not on the retired list');
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  yes(!fs.existsSync(path.join(t, 'docs/light-path.md')), 'an unedited retired file was not removed');
  yes(/remove\s+docs\/light-path\.md \(no longer shipped\)/.test(r.out), r.out);
  yes(fs.existsSync(path.join(t, 'commands/README.md')), 'an edited retired file was removed');
  yes(/kept\s+commands\/README\.md \(no longer shipped, but you edited it; it is yours now\)/.test(r.out), r.out);
  ['bookshelf/retired-a.md', 'engine/deck_kit.py'].forEach((rel) => {
    eq(fs.readFileSync(path.join(t, rel), 'utf8'), files[rel], rel + ' changed or was deleted');
    yes(new RegExp('forget\\s+' + rel.replace(/[./]/g, '\\$&') + ' \\(not a file this version retired; yours to keep\\)').test(r.out), r.out);
  });
  const after = manifestOf(t).files;
  Object.keys(files).concat(['plans/example/fernway-skip-cancel.md']).forEach((rel) => yes(!(rel in after), rel + ' stayed in the manifest, so a later update could still act on it'));
});

test('retiredFiles names no path this version installs', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const installed = new Set(walk(t, '', []));
  LIST.retiredFiles.forEach((rel) => yes(!installed.has(rel), rel + ' is both installed and retired'));
  yes(LIST.retiredFiles.includes('.agents/skills/carousel-challenge-plan/SKILL.md') && LIST.retiredFiles.includes('.claude/skills/carousel-challenge-plan/SKILL.md') && LIST.retiredFiles.includes('docs/light-path.md'), 'the list lacks a file ' + 'b3f1dde shipped');
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

// ------------------------------------------------------------------ stages, skills and reviewer agents
test('init installs the nine stages in .agents/skills, manual-only, with copies in .claude/skills that match byte for byte', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0);
  STAGES.forEach((n) => {
    const src = path.join(t, skill('.agents/skills', n));
    yes(fs.existsSync(src), 'missing ' + skill('.agents/skills', n));
    yes(fs.readFileSync(src).equals(fs.readFileSync(path.join(t, skill('.claude/skills', n)))), n + ' differs between .agents/skills and .claude/skills');
    yes(/^---\nname: carousel-[a-z-]+\ndescription: ".+"\ndisable-model-invocation: true\n---\n/.test(fs.readFileSync(src, 'utf8')), n + ' front matter');
    eq(fs.readFileSync(path.join(t, '.agents/skills', n, 'agents', 'openai.yaml'), 'utf8'), 'policy:\n  allow_implicit_invocation: false\n', n + ' openai.yaml');
  });
  const m = manifestOf(t);
  eq(m.agents, true, 'manifest does not record agents');
  yes(STAGES.every((n) => m.files[skill('.agents/skills', n)] && m.files[skill('.claude/skills', n)] && m.files[`.agents/skills/${n}/agents/openai.yaml`]), 'manifest does not track every stage file');
  yes(!fs.existsSync(path.join(t, '.claude', 'skills', 'README.md')), 'the stage index was copied as a skill');
  eq(node(path.join(t, 'scripts', 'check-process.js'), [], t).code, 0, 'the installed project does not pass its own checks');
});

test('init installs the reviewer agents in agents/ and .claude/agents/, tracked in the manifest', () => {
  const t = tmp();
  run(['init', t]);
  const m = manifestOf(t);
  REVIEWERS.forEach((f) => {
    yes(fs.readFileSync(path.join(t, 'agents', f)).equals(fs.readFileSync(path.join(t, '.claude', 'agents', f))), f + ' differs between agents/ and .claude/agents/');
    yes(/^tools: Read, Grep, Glob, Bash$/m.test(fs.readFileSync(path.join(t, 'agents', f), 'utf8')), f + ' is not limited to read-only tools');
    yes(m.files['agents/' + f] && m.files['.claude/agents/' + f], 'manifest does not track ' + f);
  });
});

test('--no-agents skips the .claude/ copies but keeps the stages and reviewers; an update keeps skipping', () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0);
  yes(!fs.existsSync(path.join(t, '.claude')), '.claude was created with --no-agents');
  yes(fs.existsSync(path.join(t, skill('.agents/skills', 'carousel-build'))) && fs.existsSync(path.join(t, 'agents', 'carousel-fidelity.md')), 'the process itself was skipped');
  run(['update', t]);
  yes(!fs.existsSync(path.join(t, '.claude')), 'an update added agents after --no-agents');
  run(['update', t, '--agents']);
  yes(fs.existsSync(path.join(t, skill('.claude/skills', 'carousel-build'))) && fs.existsSync(path.join(t, '.claude/agents/carousel-reviewer.md')), '--agents did not add them later');
});

test('a user file of the same name in .claude/skills, .claude/agents or .agents/skills is never replaced, even with --overwrite', () => {
  const t = tmp();
  const mine = [skill('.claude/skills', 'carousel-build'), '.claude/agents/carousel-reviewer.md', skill('.agents/skills', 'carousel-wrap')];
  mine.forEach((rel) => { fs.mkdirSync(path.dirname(path.join(t, rel)), { recursive: true }); fs.writeFileSync(path.join(t, rel), 'my own file\n'); });
  const r = run(['init', t]);
  mine.forEach((rel) => yes(new RegExp('exists\\s+' + rel.replace(/[.]/g, '\\.')).test(r.out), 'no "exists" line for ' + rel + ':\n' + r.out));
  run(['init', t, '--overwrite']);
  mine.forEach((rel) => eq(fs.readFileSync(path.join(t, rel), 'utf8'), 'my own file\n', '--overwrite replaced ' + rel));
  yes(fs.existsSync(path.join(t, skill('.claude/skills', 'carousel-check'))), 'the other skills were not installed');
});

test('your own carousel-* skill, agent and tool skill survive generate, --confirm, doctor and the process tests', () => {
  const t = tmp();
  const mine = {
    '.claude/skills/carousel-mine/SKILL.md': '# carousel-mine\n\nMine.\n',
    '.claude/agents/carousel-myagent.md': 'my agent\n',
    '.agents/skills/my-tool/SKILL.md': '# my-tool\n\nMine, with no front matter.\n',
    [skill('.claude/skills', 'carousel-build')]: 'my own build skill\n',
  };
  Object.keys(mine).forEach((rel) => { fs.mkdirSync(path.dirname(path.join(t, rel)), { recursive: true }); fs.writeFileSync(path.join(t, rel), mine[rel]); });
  const before = Object.keys(mine).map((rel) => sha(fs.readFileSync(path.join(t, rel))));
  eq(run(['init', t]).code, 0, 'init');
  const gen = path.join(t, 'scripts', 'generate-skills.js');
  let r = node(gen, [], t);
  eq(r.code, 0, 'generate-skills\n' + r.out);
  yes(!/stale/.test(r.out.replace(/\d+ stale/, '')), 'a file of yours was called stale:\n' + r.out);
  r = node(gen, ['--confirm'], t);
  eq(r.code, 0, 'generate-skills --confirm\n' + r.out);
  r = run(['doctor', t]);
  eq(r.code, 0, 'doctor\n' + r.out);
  r = node(path.join(t, 'tests', 'process', 'run.js'), [], t);
  eq(r.code, 0, "the installed project's own process tests\n" + r.out.slice(-800));
  Object.keys(mine).forEach((rel, i) => eq(sha(fs.readFileSync(path.join(t, rel))), before[i], rel + ' changed'));
});

test('an installed project whose Job line you rewrote still passes its own process tests', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const src = path.join(t, skill('.agents/skills', 'carousel-build'));
  fs.writeFileSync(src, fs.readFileSync(src, 'utf8').replace(/^Job: .*$/m, 'Job: Assemble the deck from the critiqued plan, one slide at a time.'));
  eq(node(path.join(t, 'scripts', 'generate-skills.js'), [], t).code, 0, 'generate-skills');
  const r = node(path.join(t, 'tests', 'process', 'run.js'), [], t);
  eq(r.code, 0, "the installed project's own process tests\n" + r.out.slice(-800));
});

test('an edited skill copy is kept on update; an unedited stale one is updated', () => {
  const t = tmp();
  run(['init', t]);
  const edited = path.join(t, skill('.claude/skills', 'carousel-wrap'));
  fs.appendFileSync(edited, '\nMy addition.\n');
  const stale = path.join(t, skill('.claude/skills', 'carousel-start'));
  fs.writeFileSync(stale, 'older text\n');
  const m = manifestOf(t);
  m.files[skill('.claude/skills', 'carousel-start')] = sha('older text\n');
  writeManifest(t, m);
  const r = run(['update', t]);
  yes(/kept\s+\.claude\/skills\/carousel-wrap\/SKILL\.md/.test(r.out), r.out);
  yes(fs.readFileSync(edited, 'utf8').includes('My addition.'), 'edit lost');
  yes(fs.readFileSync(stale, 'utf8') !== 'older text\n', 'stale skill not updated');
});

// ------------------------------------------------------------------ doctor
test('doctor passes on an install, and checks the files the stages call', () => {
  const t = tmp();
  run(['init', t]);
  const r = run(['doctor', t]);
  eq(r.code, 0, r.out);
  yes(/ok\s+\.agents\/skills: 9 stages/.test(r.out) && /ok\s+9 stages marked manual-only/.test(r.out) && /ok\s+agents: 2 reviewer agents/.test(r.out) && /ok\s+\.claude\/: 9 skills and 2 agents/.test(r.out), r.out);
  yes(!/MISSING/.test(r.out), r.out);
  fs.appendFileSync(path.join(t, skill('.agents/skills', 'carousel-check')), '\nRun `scripts/not_installed.js` and `tests/not_installed.js`.\n');
  const bad = run(['doctor', t]);
  eq(bad.code, 1, bad.out);
  yes(/MISSING\s+scripts\/not_installed\.js \(called by \.agents\/skills\/carousel-check\/SKILL\.md\)/.test(bad.out), bad.out);
  yes(/MISSING\s+tests\/not_installed\.js/.test(bad.out), bad.out);
  yes(/DIFFERS\s+\.claude\/skills\/carousel-check\/SKILL\.md differs from/.test(bad.out) && !/MISSING\s+\.claude/.test(bad.out), 'a drifted copy was not reported:\n' + bad.out);
});

test('doctor names what is missing: a stage, its Codex file, a reviewer and a Claude Code copy', () => {
  const t = tmp();
  run(['init', t]);
  fs.unlinkSync(path.join(t, 'RULES.md'));
  fs.unlinkSync(path.join(t, skill('.claude/skills', 'carousel-review')));
  fs.unlinkSync(path.join(t, '.agents/skills/carousel-brief/agents/openai.yaml'));
  fs.unlinkSync(path.join(t, 'agents/carousel-fidelity.md'));
  fs.rmSync(path.join(t, '.agents/skills/carousel-wrap'), { recursive: true });
  const r = run(['doctor', t]);
  eq(r.code, 1);
  yes(/MISSING\s+RULES\.md/.test(r.out), r.out);
  yes(/MISSING\s+\.agents\/skills: found 8 of 9 stages/.test(r.out), r.out);
  yes(/MISSING\s+\.agents\/skills: 1 stage\(s\) lack agents\/openai\.yaml/.test(r.out), r.out);
  yes(/MISSING\s+agents: found 1 of 2 reviewer agents/.test(r.out), r.out);
  yes(/MISSING\s+\.claude\/: found 10 of 11/.test(r.out), r.out);
});

test('doctor treats a missing .claude/ as optional after --no-agents', () => {
  const t = tmp();
  run(['init', t, '--no-agents']);
  const r = run(['doctor', t]);
  eq(r.code, 0, r.out);
  yes(/agents\s+\.claude\/ has 0 of 11/.test(r.out), r.out);
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
  fs.writeFileSync(path.join(b, 'bookshelf'), 'i am a file');
  r = run(['init', b]);
  eq(r.code, 1, r.out);
  yes(/expected a folder, found a file/.test(r.out) && !/\n\s+at /.test(r.out), r.out);
});

if (process.platform !== 'win32') {
  test('the installer refuses to write through a symlink: the target, a folder in it, or a file in it', () => {
    const outside = tmp();
    const link = path.join(tmp(), 'link');
    fs.symlinkSync(outside, link);
    let r = run(['init', link]);
    eq(r.code, 1, r.out);
    yes(/refusing to write through a symlink/.test(r.out) && /Point the target at a plain folder instead\./.test(r.out), r.out);
    eq(fs.readdirSync(outside).length, 0, 'files were written through the target symlink');
    const t = tmp();
    fs.symlinkSync(outside, path.join(t, 'bookshelf'));
    r = run(['init', t]);
    eq(r.code, 1, r.out);
    yes(/refusing to write through a symlink: .*bookshelf/.test(r.out), r.out);
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

if (process.platform !== 'win32') {
  test('the installer resolves real paths: a write whose real path leaves the project is refused, a project under a symlinked folder installs', () => {
    const { assertInside } = require(INSTALL);
    const outside = tmp();
    const t = tmp();
    fs.symlinkSync(outside, path.join(t, 'plans'));            // a symlinked ancestor of every file under plans/
    let threw = null;
    try { assertInside(t, 'plans/new/plan.md'); } catch (e) { threw = e; }
    yes(threw && /refusing to write outside the project/.test(threw.message), 'a path under a symlinked ancestor was allowed: ' + (threw && threw.message));
    assertInside(t, 'bookshelf/new/page.md');                   // a path that does not exist yet, inside the project
    const r = run(['init', t]);
    eq(r.code, 1, r.out);
    eq(fs.readdirSync(outside).length, 0, 'files were written through the symlinked ancestor');
    const real = tmp();
    const via = path.join(tmp(), 'via');
    fs.symlinkSync(real, via);                                  // the project sits under a symlinked folder: that is fine
    const r2 = run(['init', path.join(via, 'proj')]);
    eq(r2.code, 0, r2.out);
    yes(fs.existsSync(path.join(real, 'proj', 'RULES.md')), 'the install under a symlinked parent wrote nothing');
  });
}

test('a skill of your own in .agents/skills survives init, generate-skills, --confirm and doctor, and the process checks pass with it', () => {
  const t = tmp();
  const mine = path.join(t, '.agents/skills/my-tool/SKILL.md');
  const text = '# my-tool\n\nMy own skill, with no front matter and no Job line.\n';
  fs.mkdirSync(path.dirname(mine), { recursive: true });
  fs.writeFileSync(mine, text);
  eq(run(['init', t]).code, 0, 'init failed');
  const gen = path.join(t, 'scripts', 'generate-skills.js');
  let r = node(gen, ['--root', t], t);
  eq(r.code, 0, r.out);
  r = node(gen, ['--confirm', '--root', t], t);
  eq(r.code, 0, r.out);
  r = run(['doctor', t]);
  eq(r.code, 0, r.out);
  eq(fs.readFileSync(mine, 'utf8'), text, 'your skill was changed');
  yes(!fs.existsSync(path.join(t, '.agents/skills/my-tool/agents')), 'an openai.yaml was written for your skill');
  yes(!fs.existsSync(path.join(t, '.claude/skills/my-tool')), 'your skill was copied to .claude/skills');
  eq(node(path.join(t, 'scripts', 'check-process.js'), [], t).code, 0, 'the process checks fail with your skill present');
  r = node(path.join(t, 'tests', 'process', 'run.js'), [], t);
  eq(r.code, 0, r.out.split('\n').filter((l) => /FAIL|not ok/i.test(l)).join('\n'));
});

test('a .claude/ copy the installer marks as yours is never written by generate-skills, and doctor does not tell you to overwrite it', () => {
  const t = tmp();
  const yours = path.join(t, '.claude/skills/carousel-wrap/SKILL.md');
  fs.mkdirSync(path.dirname(yours), { recursive: true });
  fs.writeFileSync(yours, '# carousel-wrap\n\nmine\n');
  const i = run(['init', t]);
  yes(/exists\s+\.claude\/skills\/carousel-wrap\/SKILL\.md \(yours; never replaced\)/.test(i.out), i.out);
  const gen = path.join(t, 'scripts', 'generate-skills.js');
  let r = node(gen, ['--root', t], t);
  eq(r.code, 0, r.out);
  yes(/yours\s+\.claude\/skills\/carousel-wrap\/SKILL\.md/.test(r.out), r.out);
  eq(fs.readFileSync(yours, 'utf8'), '# carousel-wrap\n\nmine\n', 'generate-skills wrote over your file');
  r = node(gen, ['--confirm', '--root', t], t);
  eq(r.code, 0, r.out);
  r = run(['doctor', t]);
  eq(r.code, 0, r.out);
  yes(/yours\s+\.claude\/skills\/carousel-wrap\/SKILL\.md/.test(r.out) && !/generate-skills/.test(r.out), r.out);
});

test("the installed project's own process tests pass with a .claude/ copy of yours present", () => {
  const t = tmp();
  const yours = path.join(t, '.claude/skills/carousel-build/SKILL.md');
  fs.mkdirSync(path.dirname(yours), { recursive: true });
  fs.writeFileSync(yours, '# carousel-build\n\nmine\n');
  eq(run(['init', t]).code, 0, 'init failed');
  const r = node(path.join(t, 'tests', 'process', 'run.js'), [], t);
  eq(r.code, 0, r.out.split('\n').filter((l) => /FAIL|not ok/i.test(l)).join('\n'));
  eq(fs.readFileSync(yours, 'utf8'), '# carousel-build\n\nmine\n', 'the process tests changed your file');
});

test('after init --no-agents, the .claude/ copies generate-skills writes stay its own: a changed Job line is drift and gets rewritten', () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0, 'init failed');
  const gen = path.join(t, 'scripts', 'generate-skills.js');
  let r = node(gen, ['--root', t], t);
  eq(r.code, 0, r.out);
  yes(/wrote\s+\.claude\/skills\/carousel-build\/SKILL\.md/.test(r.out), r.out);
  r = node(gen, ['--root', t], t);
  eq(r.code, 0, r.out);
  yes(!/yours/.test(r.out), 'a second run calls the files it wrote yours:\n' + r.out);
  const src = path.join(t, '.agents/skills/carousel-build/SKILL.md');
  fs.writeFileSync(src, fs.readFileSync(src, 'utf8').replace(/^Job: build/m, 'Job: assemble'));
  r = node(gen, ['--confirm', '--root', t], t);
  eq(r.code, 1, r.out);
  yes(/\.claude\/skills\/carousel-build\/SKILL\.md differs/.test(r.out), 'drift in the .claude/ copy went undetected:\n' + r.out);
  r = node(gen, ['--root', t], t);
  eq(r.code, 0, r.out);
  yes(/wrote\s+\.claude\/skills\/carousel-build\/SKILL\.md/.test(r.out), 'the copy was not rewritten:\n' + r.out);
  yes(fs.readFileSync(src).equals(fs.readFileSync(path.join(t, '.claude/skills/carousel-build/SKILL.md'))), 'the copy does not match its source');
  eq(node(gen, ['--confirm', '--root', t], t).code, 0, 'drift remains after regeneration');
  r = run(['update', t]);
  eq(r.code, 0, r.out);
  yes(fs.existsSync(path.join(t, '.claude/skills/carousel-build/SKILL.md')), 'update removed a copy generate-skills wrote');
  yes(manifestOf(t).generated && manifestOf(t).generated['.claude/skills/carousel-build/SKILL.md'], 'update dropped the generated record');
});

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
  fs.writeFileSync(path.join(t, 'a.md'), 'Signups at Zorblax grew.\n');
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
  yes(/"frob" is not a command, and "\." is a folder/.test(r.out) && r.out.includes('init ' + shq(ROOT)), r.out);
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

test('each stage skill and reviewer agent obeys the skill upload rules: name, no angle brackets, 1024 characters or fewer', () => {
  STAGES.map((n) => [n, skill('.agents/skills', n)]).concat(REVIEWERS.map((f) => [f.replace(/\.md$/, ''), 'agents/' + f])).forEach(([name, rel]) => {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
    const fm = (/^---\n([\s\S]*?)\n---/.exec(text) || [])[1] || '';
    yes(new RegExp('^name:\\s*' + name + '\\s*$', 'm').test(fm), rel + ': the front matter name is not ' + name);
    const d = /^description:\s*"(.*)"\s*$/m.exec(fm);
    yes(d, rel + ': no quoted description');
    yes(!/[<>]/.test(d[1]), rel + ': the description has an angle bracket');
    yes(d[1].length <= 1024 && d[1].length >= 40, rel + ': the description is ' + d[1].length + ' characters');
  });
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
  fs.writeFileSync(path.join(t2, 'bookshelf'), 'a file');
  const r2 = runSplit(['init', t2]);
  eq(r2.code, 1, r2.err);
  yes(r2.err.includes(path.join(t2, 'bookshelf')) && /expected a folder, found a file/.test(r2.err), r2.err);
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

test('a file the tool installed and you never touched is replaced without a backup; --overwrite always saves one', () => {
  const src = sourceCopy();
  const t = tmp();
  const SRC_INSTALL = path.join(src, 'scripts', 'install.js');
  cp.spawnSync(process.execPath, [SRC_INSTALL, 'init', t], { encoding: 'utf8' });
  fs.appendFileSync(path.join(src, 'bookshelf', 'rubric.md'), '\nA newer line.\n');
  const r = cp.spawnSync(process.execPath, [SRC_INSTALL, 'update', t], { encoding: 'utf8' });
  eq(r.status, 0, r.stdout + r.stderr);
  yes(/update\s+bookshelf\/rubric\.md/.test(r.stdout) && !/backup/.test(r.stdout), r.stdout);
  yes(!fs.existsSync(path.join(t, 'bookshelf', 'rubric.md.carousel-backup')), 'a backup was made for an untouched file');
  // --overwrite trusts no record: a file that differs from the package's copy is saved first, whatever the manifest says.
  const before = fs.readFileSync(path.join(t, 'bookshelf', 'rubric.md'));
  fs.appendFileSync(path.join(src, 'bookshelf', 'rubric.md'), 'One more.\n');
  const o = cp.spawnSync(process.execPath, [SRC_INSTALL, 'update', t, '--overwrite'], { encoding: 'utf8' });
  eq(o.status, 0, o.stdout + o.stderr);
  yes(/backup\s+bookshelf\/rubric\.md \(your copy is saved as rubric\.md\.carousel-backup\)/.test(o.stdout), o.stdout);
  yes(fs.readFileSync(path.join(t, 'bookshelf', 'rubric.md.carousel-backup')).equals(before), 'the backup holds the wrong bytes');
});

test('a partial install records what it wrote, and a rerun after the fix recognizes its own files', () => {
  const t = tmp();
  fs.mkdirSync(path.join(t, 'bookshelf'));
  fs.mkdirSync(path.join(t, 'bookshelf', 'rubric.md'));                 // stops the install partway through bookshelf/
  let r = runSplit(['init', t]);
  eq(r.code, 1, r.err);
  const m = manifestOf(t);
  yes(m.files['RULES.md'] && m.files['cheatsheet.md'], 'the manifest does not hold the files written before the failure');
  yes(!m.files['bookshelf/rubric.md'], 'the manifest holds the file that failed');
  fs.rmSync(path.join(t, 'bookshelf', 'rubric.md'), { recursive: true });
  r = runSplit(['init', t]);
  eq(r.code, 0, r.err);
  yes(!/not installed by this tool/.test(r.out + r.err), 'the rerun did not recognize its own files:\n' + r.out);
  yes(/0 kept \(edited\), 0 left alone/.test(r.out), r.out);
  yes(fs.existsSync(path.join(t, 'bookshelf', 'rubric.md')), 'the rerun did not finish the install');
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

test('no .png ships in the npm package, and the gallery stays out of the package and out of installs', () => {
  const r = cp.spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.error) { console.log('note  skipped: npm is not available'); return; }
  eq(r.status, 0, 'npm pack --dry-run failed\n' + (r.stderr || '').slice(-800));
  const files = JSON.parse(r.stdout)[0].files.map((f) => f.path);
  yes(files.includes('README.md') && files.includes('scripts/install.js'), 'the pack listing looks wrong: ' + files.slice(0, 5).join(', '));
  const bad = files.filter((f) => /\.png$/i.test(f) || f.startsWith('docs/gallery/'));
  eq(bad.length, 0, 'these ship in the package: ' + bad.join(', '));
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  yes(!fs.existsSync(path.join(t, 'docs', 'gallery')), 'init copied docs/gallery into the project');
});

// ------------------------------------------------------------------ the project's own installer, and files the package does not ship
// A note of yours in plans/ (a .md there would be a plan, which check-process, and so doctor, reads and holds to the plan layout).
const USER_FILES = { '.agents/skills/my-tool/SKILL.md': '# my-tool\n\nMine.\n', 'plans/mydeck-notes.txt': 'My deck notes.\n' };
function addUserFiles(t) {
  Object.keys(USER_FILES).forEach((rel) => { fs.mkdirSync(path.dirname(path.join(t, rel)), { recursive: true }); fs.writeFileSync(path.join(t, rel), USER_FILES[rel]); });
  return Object.keys(USER_FILES).map((rel) => sha(fs.readFileSync(path.join(t, rel))));
}
function userFilesUnchanged(t, before, when) {
  Object.keys(USER_FILES).forEach((rel, i) => {
    yes(fs.existsSync(path.join(t, rel)), when + ': ' + rel + ' was deleted');
    eq(sha(fs.readFileSync(path.join(t, rel))), before[i], when + ': ' + rel + ' changed');
  });
}

test("the repro: a --no-agents install with files of yours, doctor's suggestion followed as printed, then an update from the package, keeps every file of yours", () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0, 'init');
  const before = addUserFiles(t);
  const own = path.join(t, 'scripts', 'install.js');
  // doctor as the project runs it: its own copy of the installer, from inside the project
  const d = node(own, ['doctor', '.'], t);
  eq(d.code, 0, d.out);
  yes(!/node scripts\/install\.js/.test(d.out), 'doctor still points at the project\'s own installer:\n' + d.out);
  const m = /your Carousel OS clone: (node <clone>\/scripts\/install\.js update \S+ --agents), or, once the package is published: npx carousel-os update \S+ --agents/.exec(d.out);
  yes(m, 'doctor does not print a command that runs the installer from a clone:\n' + d.out);
  // Followed as a person would: pasted into the platform's shell, from inside the project.
  const follow = viaShell(m[1].replace('<clone>/scripts/install.js', shq(INSTALL)), t);
  eq(follow.code, 0, 'the suggestion failed:\n' + follow.out);
  yes(fs.existsSync(path.join(t, skill('.claude/skills', 'carousel-build'))), 'the suggestion did not add the .claude/ copies');
  Object.keys(USER_FILES).forEach((rel) => yes(!(rel in manifestOf(t).files), rel + ' was recorded as the tool\'s own file'));
  const u = run(['update', t]);
  eq(u.code, 0, u.out);
  userFilesUnchanged(t, before, 'after the update from the package');
});

test("the project's own installer refuses to run: into the project itself, or from it into another folder", () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0, 'init');
  const before = addUserFiles(t);
  const manifestBefore = fs.readFileSync(path.join(t, '.carousel-install.json'), 'utf8');
  const own = path.join(t, 'scripts', 'install.js');
  let r = node(own, ['update', t, '--agents'], t);
  eq(r.code, 1, r.out);
  yes(/refusing to install a folder into itself/.test(r.out) && /Carousel OS clone/.test(r.out) && /npx carousel-os/.test(r.out), r.out);
  eq(fs.readFileSync(path.join(t, '.carousel-install.json'), 'utf8'), manifestBefore, 'the refused run changed the manifest');
  yes(!fs.existsSync(path.join(t, '.claude')), 'the refused run wrote .claude/');
  const other = tmp();
  r = node(own, ['init', other], t);
  eq(r.code, 1, r.out);
  yes(/refusing to run from an installed project/.test(r.out), r.out);
  eq(fs.readdirSync(other).length, 0, 'the refused run wrote into the other folder');
  eq(run(['update', t]).code, 0, 'update from the package');
  userFilesUnchanged(t, before, 'after the update from the package');
});

test('the installer never copies or records a file the package does not ship, even when the source folder holds one', () => {
  const extras = ['.agents/skills/my-tool/SKILL.md', 'agents/notes.md', 'plans/mydeck.md', 'memory/history/2026-W40.md', 'memory/wiki/drafts/x.md', 'bookshelf/picture.png'];
  const src = sourceCopy((d) => extras.forEach((rel) => { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), 'not shipped\n'); }));
  const t = tmp();
  const r = node(path.join(src, 'scripts', 'install.js'), ['init', t], src);
  eq(r.code, 0, r.out);
  const files = manifestOf(t).files;
  extras.forEach((rel) => {
    yes(!fs.existsSync(path.join(t, rel)), rel + ' was installed');
    yes(!(rel in files), rel + ' was recorded in the manifest');
  });
  yes(fs.existsSync(path.join(t, 'plans/plan.template.md')) && fs.existsSync(path.join(t, 'plans/example/wrenmoor-skip-cancel.md')) && fs.existsSync(path.join(t, '.agents/skills/README.md')), 'a shipped file was left out');
});

test('update keeps a file the manifest records but the package never ships, even when its hash matches, and forgets the entry', () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0, 'init');
  const before = addUserFiles(t);
  const m = manifestOf(t);
  Object.keys(USER_FILES).forEach((rel) => { m.files[rel] = sha(USER_FILES[rel]); });   // a manifest an older installer poisoned
  writeManifest(t, m);
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  userFilesUnchanged(t, before, 'after the update');
  Object.keys(USER_FILES).forEach((rel) => {
    yes(new RegExp('forget\\s+' + rel.replace(/[.]/g, '\\.') + ' \\(not a file this version retired; yours to keep\\)').test(r.out), r.out);
    yes(!(rel in manifestOf(t).files), rel + ' stayed in the manifest');
  });
});

test('doctor run from a clone names that clone in its suggestion', () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0, 'init');
  const r = run(['doctor', t]);
  eq(r.code, 0, r.out);
  yes(r.out.includes('node ' + shq(INSTALL) + ' update ' + shq(t) + ' --agents'), r.out);
});

test("doctor's .claude/ count leaves out files of yours", () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0, 'init');
  const mine = path.join(t, skill('.claude/skills', 'carousel-build'));
  fs.mkdirSync(path.dirname(mine), { recursive: true });
  fs.writeFileSync(mine, '# carousel-build\n\nmine\n');
  let r = run(['doctor', t]);
  eq(r.code, 0, r.out);
  yes(/agents\s+\.claude\/ has 0 of 11 skill and agent copies, plus 1 file\(s\) of yours in their place/.test(r.out), r.out);
  const t2 = tmp();
  const mine2 = path.join(t2, skill('.claude/skills', 'carousel-build'));
  fs.mkdirSync(path.dirname(mine2), { recursive: true });
  fs.writeFileSync(mine2, '# carousel-build\n\nmine\n');
  eq(run(['init', t2]).code, 0, 'init');
  r = run(['doctor', t2]);
  eq(r.code, 0, r.out);
  yes(/ok\s+\.claude\/: 8 skills and 2 agents, plus 1 file\(s\) of yours in their place/.test(r.out), r.out);
});

// ------------------------------------------------------------------ the shipped list, kept sources and upgrades
const GEN_ARGS = (t, extra) => [path.join(t, 'scripts', 'generate-skills.js')].concat(extra || []);
const confirmIn = (t) => node(GEN_ARGS(t)[0], ['--confirm'], t);

test('stages.json lists exactly the stage folders and reviewer agents the repository ships', () => {
  const folders = fs.readdirSync(path.join(ROOT, '.agents/skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  eq(JSON.stringify(folders), JSON.stringify(STAGES.slice().sort()), 'stage folders');
  const agents = fs.readdirSync(path.join(ROOT, 'agents')).filter((f) => f !== 'README.md').sort();
  eq(JSON.stringify(agents), JSON.stringify(REVIEWERS.slice().sort()), 'agents');
  (LIST.retiredStages || []).forEach((n) => yes(!STAGES.includes(n), n + ' is both shipped and retired'));
});

test('update drops paths this version never makes from "generated" and keeps the files, so generate-skills reports no folder of yours as stale', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const poison = { 'plans/mydeck.md': '# My deck\n', 'notes/x.md': 'x\n', '.claude/skills/carousel-mine/SKILL.md': '---\nname: carousel-mine\n---\n\n# carousel-mine\n' };
  const m = manifestOf(t);
  m.generated = m.generated || {};
  Object.keys(poison).forEach((rel) => {
    fs.mkdirSync(path.dirname(path.join(t, rel)), { recursive: true });
    fs.writeFileSync(path.join(t, rel), poison[rel]);
    m.generated[rel] = sha(poison[rel]);
  });
  writeManifest(t, m);
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  const after = manifestOf(t);
  Object.keys(poison).forEach((rel) => {
    eq(fs.readFileSync(path.join(t, rel), 'utf8'), poison[rel], rel + ' changed or was deleted');
    yes(!((after.generated || {})[rel]), rel + ' stayed in "generated"');
    yes(!(rel in after.files), rel + ' moved into "files"');
  });
  const c = confirmIn(t);
  eq(c.code, 0, c.out);
  yes(!/carousel-mine/.test(c.out.replace(/^yours .*$/gm, '')), 'generate-skills still names carousel-mine:\n' + c.out);
});

test('update leaves the .claude/ copy of a stage you edited and regenerated alone, and --confirm passes after it', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  fs.appendFileSync(path.join(t, skill('.agents/skills', 'carousel-wrap')), '\nMy own closing step.\n');
  eq(node(GEN_ARGS(t)[0], [], t).code, 0, 'generate-skills');
  const mine = fs.readFileSync(path.join(t, skill('.claude/skills', 'carousel-wrap')), 'utf8');
  yes(mine.includes('My own closing step.'), 'generate-skills did not regenerate the copy');
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  yes(/kept\s+\.agents\/skills\/carousel-wrap\/SKILL\.md/.test(r.out), r.out);
  eq(fs.readFileSync(path.join(t, skill('.claude/skills', 'carousel-wrap')), 'utf8'), mine, 'update replaced the regenerated copy');
  const c = confirmIn(t);
  eq(c.code, 0, c.out);
  // The same edit without a generate-skills run: update makes the copy from the kept source.
  const t2 = tmp();
  eq(run(['init', t2]).code, 0, 'init');
  fs.appendFileSync(path.join(t2, skill('.agents/skills', 'carousel-wrap')), '\nMy own closing step.\n');
  fs.appendFileSync(path.join(t2, 'agents/carousel-reviewer.md'), '\nMy own check.\n');
  const r2 = run(['update', t2]);
  eq(r2.code, 0, r2.out);
  yes(/follow\s+\.claude\/skills\/carousel-wrap\/SKILL\.md/.test(r2.out) && /follow\s+\.claude\/agents\/carousel-reviewer\.md/.test(r2.out), r2.out);
  const c2 = confirmIn(t2);
  eq(c2.code, 0, c2.out);
  eq(run(['doctor', t2]).code, 0, 'doctor');
});

// An install made by the commit before the critique stage was renamed. Needs this repository's git history; the npm
// package carries none, so there the test says so and passes.
const OLD = 'b3f1dde';
function oldInstall() {
  const has = cp.spawnSync('git', ['-C', ROOT, 'cat-file', '-e', OLD + '^{commit}'], { encoding: 'utf8' });
  if (has.status !== 0) return null;
  const src = tmp();
  const tar = cp.spawnSync('sh', ['-c', 'git -C "$1" archive "$2" | tar -x -C "$3"', 'sh', ROOT, OLD, src], { encoding: 'utf8' });
  if (tar.status !== 0) throw new Error('git archive failed: ' + tar.stderr);
  const t = tmp();
  const r = node(path.join(src, 'scripts', 'install.js'), ['init', t], src);
  if (r.code !== 0) throw new Error('the old init failed:\n' + r.out);
  return t;
}

test('upgrade from ' + OLD + ': an edited retired stage is kept and never counted, unedited handoff files move to the new layout, and every check passes', () => {
  const t = oldInstall();
  if (!t) { console.log('      (skipped: no git history for ' + OLD + ')'); return; }
  const old = path.join(t, skill('.agents/skills', 'carousel-challenge-plan'));
  fs.appendFileSync(old, '\nMy note.\n');
  eq(node(path.join(t, 'scripts', 'generate-skills.js'), [], t).code, 0, 'the old generate-skills');
  const kept = fs.readFileSync(old, 'utf8');
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  yes(/update\s+memory\/handoff\.template\.md/.test(r.out) && /update\s+memory\/handoff\.md/.test(r.out), 'the handoff files were not migrated:\n' + r.out);
  eq(fs.readFileSync(old, 'utf8'), kept, 'the edited old stage changed');
  const d = node(path.join(t, 'scripts', 'install.js'), ['doctor', '.'], t);
  eq(d.code, 0, d.out);
  yes(/doctor: all good/.test(d.out) && new RegExp('ok\\s+\\.agents/skills: ' + STAGES.length + ' stages').test(d.out), d.out);
  const c = confirmIn(t);
  eq(c.code, 0, c.out);
  yes(!fs.existsSync(path.join(t, '.agents/skills/carousel-challenge-plan/agents/openai.yaml')), 'a Codex file came back for the retired stage');
  const p = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  eq(p.code, 0, p.out);
  // Run again: nothing left to do.
  const again = run(['update', t]);
  eq(again.code, 0, again.out);
  yes(/ 0 added, 0 updated, /.test(again.out), again.out);
});

test('upgrade from ' + OLD + ': an edited handoff is kept, and update says how to bring it to the new layout', () => {
  const t = oldInstall();
  if (!t) { console.log('      (skipped: no git history for ' + OLD + ')'); return; }
  fs.appendFileSync(path.join(t, 'memory/handoff.md'), '\nMy open item.\n');
  const before = fs.readFileSync(path.join(t, 'memory/handoff.md'), 'utf8');
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  eq(fs.readFileSync(path.join(t, 'memory/handoff.md'), 'utf8'), before, 'the edited handoff changed');
  const line = (r.out.split('\n').find((l) => /^kept\s+memory\/handoff\.md /.test(l))) || '';
  yes(/Compare it with memory\/handoff\.template\.md in your project/.test(line), r.out);
  yes(line.includes('"## Next session"') && line.includes('"Open ASK markers:"') && line.includes('"Open ledger rows:"'), 'the headings are not shown inline:\n' + line);
  yes(!line.includes(ROOT) && !/package\//.test(line), 'the message points at a package path:\n' + line);
  yes(/update\s+memory\/handoff\.template\.md/.test(r.out), 'the unedited template was not written:\n' + r.out);
  // Once the person moves to the new layout, the note stops.
  fs.copyFileSync(path.join(t, 'memory/handoff.template.md'), path.join(t, 'memory/handoff.md'));
  yes(fs.readFileSync(path.join(t, 'memory/handoff.md'), 'utf8') !== fs.readFileSync(path.join(ROOT, 'memory/handoff.md'), 'utf8'), 'the migrated handoff matches the shipped one, so the test proves nothing');
  const r2 = run(['update', t]);
  eq(r2.code, 0, r2.out);
  yes(!/memory\/handoff\.md/.test(r2.out), 'update still talks about a handoff that now passes:\n' + r2.out);
});

// The reviewer's repro: files of yours in folders the package also ships into, recorded in a poisoned manifest.
const POISON = ['bookshelf/my-page.md', 'scripts/my-script.js', 'tests/process/my.test.js', 'docs/build-your-engine/my-engine-notes.md', 'plans/example/my-example.md', '.agents/skills/carousel-build/my-notes.md'];
test('a poisoned manifest that records files of yours in bookshelf/, scripts/, tests/process/, docs/build-your-engine/, plans/example/ and a stage folder never gets them deleted', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const m = manifestOf(t);
  POISON.forEach((rel) => {
    fs.mkdirSync(path.dirname(path.join(t, rel)), { recursive: true });
    fs.writeFileSync(path.join(t, rel), 'user content ' + rel + '\n');
    m.files[rel] = sha('user content ' + rel + '\n');
  });
  writeManifest(t, m);
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  yes(!/^remove /m.test(r.out), r.out);
  POISON.forEach((rel) => {
    eq(fs.readFileSync(path.join(t, rel), 'utf8'), 'user content ' + rel + '\n', rel + ' was deleted or changed');
    yes(!(rel in manifestOf(t).files), rel + ' stayed in the manifest');
  });
});

test('upgrade from ' + OLD + ' after the project ran its own installer (which records files of yours) removes only unedited retired files', () => {
  const t = oldInstall();
  if (!t) { console.log('      (skipped: no git history for ' + OLD + ')'); return; }
  fs.writeFileSync(path.join(t, 'bookshelf/my-page.md'), 'my page\n');
  fs.writeFileSync(path.join(t, 'scripts/my-script.js'), 'x\n');
  node(path.join(t, 'scripts', 'install.js'), ['update', t], t);      // the old installer, run from the project itself
  const poisoned = Object.keys(manifestOf(t).files).filter((k) => /my-page|my-script/.test(k));
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  ['bookshelf/my-page.md', 'scripts/my-script.js'].forEach((rel) => yes(fs.existsSync(path.join(t, rel)), rel + ' was deleted (the old manifest recorded ' + poisoned.length + ' of them)'));
  ['.agents/skills/carousel-challenge-plan/SKILL.md', '.agents/skills/carousel-challenge-plan/agents/openai.yaml', '.claude/skills/carousel-challenge-plan/SKILL.md'].forEach((rel) => {
    yes(!fs.existsSync(path.join(t, rel)), 'the unedited retired ' + rel + ' was not removed');
    yes(new RegExp('remove\\s+' + rel.replace(/[./]/g, '\\$&')).test(r.out), r.out);
  });
});

test('update never rewrites a .claude/ copy you edited, even when its source is kept, and says how to regenerate it', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  fs.appendFileSync(path.join(t, skill('.agents/skills', 'carousel-wrap')), 'user source note\n');
  fs.appendFileSync(path.join(t, skill('.claude/skills', 'carousel-wrap')), 'MY PRECIOUS CLAUDE EDIT\n');
  const before = fs.readFileSync(path.join(t, skill('.claude/skills', 'carousel-wrap')), 'utf8');
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  eq(fs.readFileSync(path.join(t, skill('.claude/skills', 'carousel-wrap')), 'utf8'), before, 'update rewrote the edited .claude/ copy');
  yes(/kept\s+\.claude\/skills\/carousel-wrap\/SKILL\.md \(you edited it; to rebuild it from \.agents\/skills\/carousel-wrap\/SKILL\.md: run node \S+[\\\/]scripts[\\\/]generate-skills\.js --root \S+; it saves your copy as a \.carousel-backup file first\)/.test(r.out), r.out);
  yes(!fs.readdirSync(path.join(t, '.claude/skills/carousel-wrap')).some((f) => f.includes('backup')), 'a backup was made without --overwrite');
  // --overwrite rebuilds it from the kept source and saves the edited copy first.
  const o = run(['update', t, '--overwrite']);
  eq(o.code, 0, o.out);
  yes(fs.readFileSync(path.join(t, skill('.claude/skills', 'carousel-wrap')) + '.carousel-backup', 'utf8') === before, 'no backup of the edited copy:\n' + o.out);
});

test('upgrade from ' + OLD + ': a kept stage you edited that names a retired stage makes doctor fail with a plain fix, the same as check-process', () => {
  const t = oldInstall();
  if (!t) { console.log('      (skipped: no git history for ' + OLD + ')'); return; }
  fs.appendFileSync(path.join(t, skill('.agents/skills', 'carousel-challenge-plan')), 'MY EDIT\n');
  fs.appendFileSync(path.join(t, skill('.agents/skills', 'carousel-build')), 'MY EDIT\n');
  eq(node(path.join(t, 'scripts', 'generate-skills.js'), [], t).code, 0, 'the old generate-skills');
  eq(run(['update', t]).code, 0, 'update');
  const p = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  eq(p.code, 1, 'check-process should fail here:\n' + p.out);
  const d = run(['doctor', t]);
  eq(d.code, 1, d.out);
  yes(!/doctor: all good/.test(d.out), d.out);
  yes(/fix\s+\.agents\/skills\/carousel-build\/SKILL\.md line \d+ names `carousel-challenge-plan`, a stage this version no longer ships; it is now `carousel-critique`\. Change that name to `carousel-critique`/.test(d.out), d.out);
  yes(/FAIL\s+check-process: deadrefs fails/.test(d.out), d.out);
});

// ------------------------------------------------------------------ backups: no tool destroys bytes you may have written
function shaFile(f) { return sha(fs.readFileSync(f)); }
// Every backup of rel in t (.carousel-backup, .carousel-backup2, ...) by hash.
function backupHashes(t, rel) {
  const dir = path.dirname(path.join(t, rel));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.startsWith(path.basename(rel) + '.carousel-backup')).map((n) => shaFile(path.join(dir, n)));
}
// The edit survives: still in place, or in a backup beside it.
function editKept(t, rel, h) {
  const f = path.join(t, rel);
  return (fs.existsSync(f) && shaFile(f) === h) || backupHashes(t, rel).includes(h);
}

test('generate-skills saves a .claude/ copy you edited as a backup before it rewrites it, and says so', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const rel = skill('.claude/skills', 'carousel-build');
  fs.appendFileSync(path.join(t, rel), 'my own edit\n');
  const h = shaFile(path.join(t, rel));
  const r = node(path.join(t, 'scripts', 'generate-skills.js'), [], t);
  eq(r.code, 0, r.out);
  yes(/backup\s+\.claude\/skills\/carousel-build\/SKILL\.md \(your copy is saved as SKILL\.md\.carousel-backup\)/.test(r.out), r.out);
  eq(shaFile(path.join(t, rel + '.carousel-backup')), h, 'the backup is not the edited copy');
  // A second edit and run keeps the first backup and adds a second.
  fs.appendFileSync(path.join(t, rel), 'again\n');
  const h2 = shaFile(path.join(t, rel));
  node(path.join(t, 'scripts', 'generate-skills.js'), [], t);
  eq(shaFile(path.join(t, rel + '.carousel-backup')), h, 'the first backup was overwritten');
  eq(shaFile(path.join(t, rel + '.carousel-backup2')), h2, 'no second backup');
  // A copy the tool wrote and nobody touched is rewritten with no backup.
  const src = path.join(t, skill('.agents/skills', 'carousel-check'));
  fs.writeFileSync(src, fs.readFileSync(src, 'utf8').replace(/^Job: /m, 'Job: Now, '));
  const r3 = node(path.join(t, 'scripts', 'generate-skills.js'), [], t);
  yes(/wrote\s+\.claude\/skills\/carousel-check\/SKILL\.md/.test(r3.out) && !/backup\s+\.claude\/skills\/carousel-check/.test(r3.out), r3.out);
});

test('an edited .claude/ copy: doctor says it differs (never MISSING) and that regenerating saves a backup; check-process, --confirm and doctor all fail, then all pass', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const rel = skill('.claude/skills', 'carousel-build');
  fs.appendFileSync(path.join(t, rel), 'my own edit\n');
  const d = run(['doctor', t]);
  eq(d.code, 1, d.out);
  yes(!/MISSING/.test(d.out), 'doctor calls an existing file missing:\n' + d.out);
  yes(/DIFFERS\s+\.claude\/skills\/carousel-build\/SKILL\.md differs from \.agents\/skills\/carousel-build\/SKILL\.md .*saves the current copy as a \.carousel-backup file/.test(d.out), d.out);
  const p = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  eq(p.code, 1, 'check-process passed with a drifted copy:\n' + p.out);
  yes(/FAIL skills/.test(p.out), p.out);
  eq(confirmIn(t).code, 1, '--confirm');
  // Follow the fix line as printed.
  eq(node(path.join(t, 'scripts', 'generate-skills.js'), ['--root', t], t).code, 0, 'generate');
  yes(fs.readFileSync(path.join(t, rel + '.carousel-backup'), 'utf8').endsWith('my own edit\n'), 'the edit was not saved');
  eq(node(path.join(t, 'scripts', 'check-process.js'), [], t).code, 0, 'check-process');
  eq(confirmIn(t).code, 0, '--confirm');
  eq(run(['doctor', t]).code, 0, 'doctor');
});

test('a --no-agents install passes check-process, --confirm and doctor with no .claude/ copies', () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0, 'init');
  const p = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  eq(p.code, 0, p.out);
  eq(confirmIn(t).code, 0, '--confirm');
  eq(run(['doctor', t]).code, 0, 'doctor');
});

test('new manifests carry the format field; one without it is untrusted until the first update rewrites it', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  eq(manifestOf(t).format, 2, 'no format field');
  // Strip it, as an older installer would have written it, and update an unedited old file.
  const m = manifestOf(t);
  delete m.format;
  const rel = 'bookshelf/design.md';
  fs.appendFileSync(path.join(t, rel), 'old shipped line\n');
  m.files[rel] = shaFile(path.join(t, rel));
  writeManifest(t, m);
  const h = shaFile(path.join(t, rel));
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  yes(/backup\s+bookshelf\/design\.md/.test(r.out), 'no backup against an untrusted manifest:\n' + r.out);
  yes(backupHashes(t, rel).includes(h), 'the backup is not the old file');
  eq(manifestOf(t).format, 2, 'update did not write the format field');
  // The rewritten manifest is trusted: the next update of an unedited file makes no backup.
  const m2 = manifestOf(t);
  fs.appendFileSync(path.join(t, rel), 'older again\n');
  m2.files[rel] = shaFile(path.join(t, rel));
  writeManifest(t, m2);
  const r2 = run(['update', t]);
  yes(/update\s+bookshelf\/design\.md/.test(r2.out) && !/backup/.test(r2.out), r2.out);
});

// The self-run repro: b3f1dde's installer, run from inside the project, recorded the hashes of files the person had
// edited, so a later update took them for unedited tool files.
const SELFRUN_EDITS = ['RULES.md', 'bookshelf/design.md', skill('.agents/skills', 'carousel-review')];
const SELFRUN_RETIRED = [skill('.agents/skills', 'carousel-challenge-plan'), skill('.claude/skills', 'carousel-challenge-plan')];
function selfRun(edits) {
  const t = oldInstall();
  if (!t) return null;
  const hashes = {};
  edits.forEach((rel) => { fs.appendFileSync(path.join(t, rel), '\nMy own edit to ' + rel + '.\n'); hashes[rel] = shaFile(path.join(t, rel)); });
  node(path.join(t, 'scripts', 'install.js'), ['update', t], t);      // the old installer, run from the project itself
  return { t, hashes };
}

test('selfrun: after ' + OLD + '\'s installer ran from inside the project, update keeps every edit in place or in a backup', () => {
  const s = selfRun(SELFRUN_EDITS);
  if (!s) { console.log('      (skipped: no git history for ' + OLD + ')'); return; }
  const r = run(['update', s.t]);
  eq(r.code, 0, r.out);
  SELFRUN_EDITS.forEach((rel) => {
    yes(editKept(s.t, rel, s.hashes[rel]), rel + ': the edit is gone, with no backup:\n' + r.out);
    if (shaFile(path.join(s.t, rel)) !== s.hashes[rel]) yes(new RegExp('backup\\s+' + rel.replace(/[./]/g, '\\$&')).test(r.out), 'no backup line for ' + rel);
  });
  // The second update behaves as before: the manifest now carries the format field, and nothing new is backed up.
  const again = run(['update', s.t]);
  eq(again.code, 0, again.out);
  yes(!/backup/.test(again.out), 'a second update made backups:\n' + again.out);
});

test('selfrun2: an edited retired stage recorded by a self-run is saved before update removes it', () => {
  const s = selfRun(SELFRUN_EDITS.concat(SELFRUN_RETIRED));
  if (!s) { console.log('      (skipped: no git history for ' + OLD + ')'); return; }
  const r = run(['update', s.t]);
  eq(r.code, 0, r.out);
  SELFRUN_EDITS.concat(SELFRUN_RETIRED).forEach((rel) => yes(editKept(s.t, rel, s.hashes[rel]), rel + ': the edit is gone, with no backup:\n' + r.out));
  SELFRUN_RETIRED.forEach((rel) => {
    if (!fs.existsSync(path.join(s.t, rel))) yes(new RegExp('remove\\s+' + rel.replace(/[./]/g, '\\$&') + '[^\\n]*\\nbackup\\s+' + rel.replace(/[./]/g, '\\$&')).test(r.out), 'remove without a backup line for ' + rel + ':\n' + r.out);
  });
  const again = run(['update', s.t]);
  eq(again.code, 0, again.out);
  yes(!/backup/.test(again.out), 'a second update made backups:\n' + again.out);
  // The backups left beside removed files never trip the project's own checks or tests.
  const t = node(path.join(s.t, 'tests', 'process', 'run.js'), [], s.t);
  eq(t.code, 0, "the project's own process tests\n" + t.out.split('\n').filter((l) => /FAIL/.test(l)).join('\n'));
});

test('init and update print no action for a folder they then refuse as a symlink', () => {
  const t = tmp();
  const elsewhere = tmp();
  fs.symlinkSync(elsewhere, path.join(t, 'bookshelf'));
  const i = run(['init', t]);
  eq(i.code, 1, i.out);
  yes(/refusing to write through a symlink/.test(i.out), i.out);
  yes(!/^(add|update)\s+bookshelf\//m.test(i.out), 'init printed an action for the symlinked folder:\n' + i.out);
  fs.unlinkSync(path.join(t, 'bookshelf'));
  eq(run(['init', t]).code, 0, 'init');
  fs.rmSync(path.join(t, 'bookshelf'), { recursive: true });
  fs.symlinkSync(elsewhere, path.join(t, 'bookshelf'));
  const r = run(['update', t, '--overwrite']);
  eq(r.code, 1, r.out);
  yes(/refusing to write through a symlink/.test(r.out), r.out);
  yes(!/^(add|update)\s+bookshelf\//m.test(r.out), 'an action was printed for the symlinked folder:\n' + r.out);
  eq(fs.readdirSync(elsewhere).length, 0, 'something was written through the symlink');
});

// ------------------------------------------------------------------ a fresh project's own tests, upgrades and plain errors
function processTestsPass(t, what) {
  const r = node(path.join(t, 'tests', 'process', 'run.js'), [], t);
  eq(r.code, 0, what + ": the installed project's process tests fail\n" + r.out.split('\n').filter((l) => /FAIL/.test(l)).slice(0, 8).join('\n'));
}

test("the installed project's own process tests pass after init --no-agents, with no .claude/ copies", () => {
  const t = tmp();
  eq(run(['init', t, '--no-agents']).code, 0, 'init');
  yes(!fs.existsSync(path.join(t, '.claude')), 'init --no-agents wrote .claude/');
  processTestsPass(t, '--no-agents');
});

test("the installed project's own process tests ignore a carousel.config.json and plans of the user's own, from either sample config", () => {
  ['carousel.config.example.json', 'docs/build-your-engine/example/carousel.config.json'].forEach((c) => {
    const t = tmp();
    eq(run(['init', t]).code, 0, 'init');
    fs.copyFileSync(path.join(t, c), path.join(t, 'carousel.config.json'));
    fs.writeFileSync(path.join(t, 'plans', 'my-deck.md'), '# Plan: mine\n\nStatus: started\n');
    processTestsPass(t, c);
  });
});

// The old manifest records the hash of each edit, as an installer run from inside the project once did.
function poisonedInstall(edits, agents) {
  const t = tmp();
  eq(run(['init', t].concat(agents === false ? ['--no-agents'] : [])).code, 0, 'init');
  const m = manifestOf(t);
  delete m.format;
  const hashes = {};
  edits.forEach((rel) => {
    fs.appendFileSync(path.join(t, rel), '\nMy own edit to ' + rel + '.\n');
    hashes[rel] = shaFile(path.join(t, rel));
    if (rel.startsWith('.claude/')) { m.generated = m.generated || {}; m.generated[rel] = hashes[rel]; delete m.files[rel]; } else m.files[rel] = hashes[rel];
  });
  writeManifest(t, m);
  return { t, hashes };
}
const proofOf = (m, rel) => (m.format === 2 ? (m.files || {})[rel] || (m.generated || {})[rel] : undefined);

test('an update that fails partway against an untrusted manifest never records an old hash as proof, so the rerun still saves every edit', () => {
  const late = ['scripts/lessons.js', 'tests/process/harness.js', 'docs/build-your-engine/rigor.md'];
  const s = poisonedInstall(['bookshelf/design.md'].concat(late));
  fs.rmSync(path.join(s.t, 'docs', 'cost.md'));
  fs.mkdirSync(path.join(s.t, 'docs', 'cost.md'));                 // stops the update partway, before the late files
  const r = run(['update', s.t]);
  eq(r.code, 1, r.out);
  const m = manifestOf(s.t);
  late.forEach((rel) => yes(proofOf(m, rel) !== s.hashes[rel], rel + ': the failed run wrote an untrusted hash as proof:\n' + JSON.stringify(m).slice(0, 400)));
  late.forEach((rel) => eq((m.unverified || {})[rel], s.hashes[rel], rel + ' is not kept as unverified'));
  fs.rmdirSync(path.join(s.t, 'docs', 'cost.md'));
  const r2 = run(['update', s.t]);
  eq(r2.code, 0, r2.out);
  Object.keys(s.hashes).forEach((rel) => yes(editKept(s.t, rel, s.hashes[rel]), rel + ': the edit is gone, with no backup:\n' + r2.out));
  late.forEach((rel) => yes(new RegExp('backup\\s+' + rel.replace(/[./]/g, '\\$&')).test(r2.out), 'no backup line for ' + rel + ':\n' + r2.out));
});

test('update --no-agents from an untrusted manifest carries no .claude/ hash as proof; generate-skills and update --agents then save the edited copy', () => {
  const rel = skill('.claude/skills', 'carousel-brief');
  ['generate-skills', 'update --agents'].forEach((then) => {
    const s = poisonedInstall([rel]);
    const r = run(['update', s.t, '--no-agents']);
    eq(r.code, 0, r.out);
    const m = manifestOf(s.t);
    yes(proofOf(m, rel) !== s.hashes[rel], 'update --no-agents recorded the edited copy as the tool\'s own');
    const r2 = then === 'generate-skills' ? node(path.join(s.t, 'scripts', 'generate-skills.js'), [], s.t) : run(['update', s.t, '--agents']);
    eq(r2.code, 0, r2.out);
    yes(editKept(s.t, rel, s.hashes[rel]), then + ': the edited copy is gone, with no backup:\n' + r2.out);
    yes(/backup\s+\.claude\/skills\/carousel-brief\/SKILL\.md/.test(r2.out), then + ': no backup line:\n' + r2.out);
    const c = node(path.join(s.t, 'scripts', 'generate-skills.js'), ['--confirm'], s.t);
    eq(c.code, 0, then + ': --confirm after\n' + c.out);
  });
});

const OLD_PLAN = ['# Plan: an old deck', '', 'Status: challenged', 'Slug: old-deck', 'Path: light', 'Rounds: 1', '', '## Direction', '', 'A deck.', '',
  '## Brief', '', 'Literal ask: NEEDS HUMAN: which quarter?', '', '## Storyboard', '', '## Challenge log', '', '### Round 1', '', 'Kept as is: s01.', 'Parked claims: none open', '',
  '## Deviations', '', '## Build', '', '## Check', '', '## Review', '', '## Reports', '', 'Start report: plan plans/old-deck.md created; path light; handoff none; lessons loaded 0.',
  'Challenge round 1 of 1: angle reader (new). Re-verified 2 claims, demoted 0 to uncertainty.', ''].join('\n');

test('a plan in the earlier layout gets one plain migration hint from check-process and doctor, and is never edited', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  fs.writeFileSync(path.join(t, 'plans', 'old-deck.md'), OLD_PLAN);
  const c = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  eq(c.code, 1, c.out);
  eq((c.out.match(/^HINT /gm) || []).length, 1, 'expected one hint:\n' + c.out);
  ['"## Direction" is now "## Request"', '"## Challenge log" is now "## Critique log"', '"## Deviations" is now "## Calls made"', '"Path: light" is now "Path: short"',
    'is now "Critique round R of T', '"NEEDS HUMAN: <question>" markers are now "ASK: <question>"'].forEach((x) => yes(c.out.includes(x), 'the hint lacks: ' + x + '\n' + c.out));
  const d = run(['doctor', t]);
  yes(/^fix\s+plans\/old-deck\.md uses the plan layout of an earlier version/m.test(d.out), 'doctor gives no hint:\n' + d.out);
  yes(d.out.includes('"## Direction" is now "## Request"'), 'doctor lists no renames:\n' + d.out);
  eq(fs.readFileSync(path.join(t, 'plans', 'old-deck.md'), 'utf8'), OLD_PLAN, 'the plan was edited');
  // A project with no old plan gets no hint.
  fs.rmSync(path.join(t, 'plans', 'old-deck.md'));
  yes(!/HINT/.test(node(path.join(t, 'scripts', 'check-process.js'), [], t).out), 'a hint with no old plan');
});

test('upgrade from ' + OLD + ' with --no-agents: update and doctor both name generate-skills first, and after it every check passes', () => {
  const t = oldInstall();
  if (!t) { console.log('      (skipped: no git history for ' + OLD + ')'); return; }
  const r = run(['update', t, '--no-agents']);
  eq(r.code, 0, r.out);
  yes(/^next\s+\d+ \.claude\/ copies differ[^\n]*generate-skills\.js/m.test(r.out), 'update does not name generate-skills:\n' + r.out);
  const d = run(['doctor', t]);
  eq(d.code, 1, d.out);
  const firstFix = d.out.split('\n').find((l) => /^fix /.test(l)) || '';
  yes(/generate-skills\.js --root/.test(firstFix), 'the first fix line is not generate-skills: ' + firstFix + '\n' + d.out);
  const g = node(path.join(t, 'scripts', 'generate-skills.js'), [], t);
  eq(g.code, 0, g.out);
  yes(/backup\s+\.claude\//.test(g.out), 'generate-skills saved no backup of an old copy:\n' + g.out);
  eq(node(path.join(t, 'scripts', 'check-process.js'), [], t).code, 0, 'check-process after generate-skills');
  const d2 = run(['doctor', t]);
  eq(d2.code, 0, d2.out);
});

test('doctor fix lines name the real file: a retired name in an edited RULES.md or cheatsheet.md, and a missing stage file', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  fs.appendFileSync(path.join(t, 'RULES.md'), '\nRun `carousel-challenge-plan` next.\n');
  fs.appendFileSync(path.join(t, 'cheatsheet.md'), '\nThen `carousel-challenge-plan`.\n');
  fs.rmSync(path.join(t, skill('.agents/skills', 'carousel-wrap')));
  const d = run(['doctor', t]);
  eq(d.code, 1, d.out);
  yes(/^fix\s+RULES\.md line \d+ names `carousel-challenge-plan`[^\n]*`carousel-critique`/m.test(d.out), 'no fix line for RULES.md:\n' + d.out);
  yes(/^fix\s+cheatsheet\.md line \d+ names `carousel-challenge-plan`/m.test(d.out), 'no fix line for cheatsheet.md:\n' + d.out);
  yes(/^fix\s+\.agents\/skills\/carousel-wrap\/SKILL\.md is missing\. [^\n]*--overwrite\. That replaces every file you edited[^\n]*\.carousel-backup/m.test(d.out), 'no plain fix line for the missing stage:\n' + d.out);
  yes(!/names `carousel-wrap`/.test(d.out), 'a shipped stage was called retired:\n' + d.out);
  yes(!/^fix\s+\S+ is missing does not/m.test(d.out), 'a garbled fix line:\n' + d.out);
});

test('a manifest of the wrong shape gets a plain error from update, doctor and generate-skills, and nothing changes', () => {
  [{ deleted: {} }, { files: 'abc' }, { generated: [1, 2] }, { agents: 'yes' }].forEach((bad) => {
    const t = tmp();
    eq(run(['init', t]).code, 0, 'init');
    writeManifest(t, Object.assign(manifestOf(t), bad));
    const before = fs.readFileSync(path.join(t, '.carousel-install.json'), 'utf8');
    const key = Object.keys(bad)[0];
    [run(['update', t]), run(['doctor', t])].forEach((r) => {
      eq(r.code, 1, JSON.stringify(bad) + '\n' + r.out);
      yes(r.out.includes('has the wrong shape: "' + key + '"'), JSON.stringify(bad) + ': no plain message:\n' + r.out);
      yes(!/TypeError|\n\s+at /.test(r.out), JSON.stringify(bad) + ': a stack trace:\n' + r.out);
    });
    const g = node(path.join(t, 'scripts', 'generate-skills.js'), [], t);
    eq(g.code, 2, g.out);
    yes(/cannot be read/.test(g.out) && !/\n\s+at /.test(g.out), g.out);
    eq(fs.readFileSync(path.join(t, '.carousel-install.json'), 'utf8'), before, 'the manifest changed');
  });
});

// ------------------------------------------------------------------ advice that names the right script, line endings, symlinks, engines
// Every generate-skills command update and doctor printed, run as printed from the project folder.
function followRegen(t, outs) {
  const cmds = Array.from(new Set([].concat(...outs.map((o) => o.match(/node \S*generate-skills\.js --root [^\s;),]+/g) || []))));
  cmds.forEach((c) => {
    const args = c.split(' ').slice(1);
    const r = cp.spawnSync(process.execPath, args, { encoding: 'utf8', cwd: t });
    if (r.error) throw r.error;
  });
  return cmds;
}
function toCrlf(t) {
  walk(t, '', []).filter((f) => /\.(md|js|yaml|history)$/.test(f)).forEach((f) => {
    const p = path.join(t, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
  });
}
const PKG_GEN = path.join(ROOT, 'scripts', 'generate-skills.js');
const REGEN_EDITS = [skill('.claude/skills', 'carousel-brief'), '.claude/agents/carousel-reviewer.md', skill('.claude/skills', 'carousel-check')];

[['an edited project generate-skills.js', false], ['a CRLF checkout', true]].forEach(([what, crlf]) => {
  test('upgrade from ' + OLD + ' with ' + what + ': update and doctor name the package\'s generate-skills, and following them loses no bytes', () => {
    const t = oldInstall();
    if (!t) { console.log('      (skipped: no git history for ' + OLD + ')'); return; }
    if (crlf) toCrlf(t);
    else fs.appendFileSync(path.join(t, 'scripts', 'generate-skills.js'), '\n// my own edit\n');
    const hashes = {};
    REGEN_EDITS.forEach((rel) => { fs.appendFileSync(path.join(t, rel), 'MY EDIT\n'); hashes[rel] = shaFile(path.join(t, rel)); });
    const u = run(['update', t]);
    eq(u.code, 0, u.out);
    const d = run(['doctor', t]);
    const cmds = followRegen(t, [u.out, d.out]);
    yes(cmds.length > 0, 'no generate-skills command was printed:\n' + u.out + d.out);
    // A printed command names the package's generator, or the project's only when it is this version's text.
    const lfText = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    cmds.forEach((c) => {
      const gen = c.split(' ')[1];
      yes(gen === PKG_GEN || lfText(gen) === lfText(PKG_GEN), 'a printed command runs a generator from another version: ' + c);
    });
    if (!crlf) yes(/the project's scripts\/generate-skills\.js is from another version and was left alone/.test(d.out), 'doctor does not say the project\'s copy is from another version:\n' + d.out);
    REGEN_EDITS.forEach((rel) => yes(editKept(t, rel, hashes[rel]), rel + ': the edit is gone, with no backup'));
    const c = node(PKG_GEN, ['--confirm', '--root', t], t);
    eq(c.code, 0, c.out);
  });
});

test('a fresh install checked out with CRLF (core.autocrlf=true, no .gitattributes) passes check-process, its process tests, --confirm and doctor', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  fs.rmSync(path.join(t, '.gitattributes'), { force: true });
  walk(t, '', []).filter((f) => !/\.pptx$/.test(f) && f !== '.carousel-install.json').forEach((f) => {
    const p = path.join(t, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
  });
  yes(fs.readFileSync(path.join(t, 'plans/example/wrenmoor-skip-cancel.ledger.json'), 'utf8').includes('\r\n'), 'the ledger was not converted');
  let r = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  eq(r.code, 0, 'check-process\n' + r.out.slice(-800));
  r = node(path.join(t, 'tests', 'process', 'run.js'), [], t);
  eq(r.code, 0, 'process tests\n' + r.out.slice(-1500));
  r = node(path.join(t, 'scripts', 'generate-skills.js'), ['--confirm'], t);
  eq(r.code, 0, '--confirm\n' + r.out);
  r = run(['doctor', t]);
  eq(r.code, 0, 'doctor\n' + r.out);
});

test('init writes a .gitattributes (deck binary, text LF) and records it, but never into a project that has one', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const ga = fs.readFileSync(path.join(t, '.gitattributes'), 'utf8');
  ['*.pptx binary', '* text=auto eol=lf'].forEach((l) => yes(ga.split('\n').includes(l), 'no "' + l + '" line'));
  eq(manifestOf(t).files['.gitattributes'], sha(ga), 'not recorded');
  const t2 = tmp();
  fs.writeFileSync(path.join(t2, '.gitattributes'), '* -text\n');
  eq(run(['init', t2]).code, 0, 'init');
  const u = run(['update', t2]);
  eq(u.code, 0, u.out);
  eq(fs.readFileSync(path.join(t2, '.gitattributes'), 'utf8'), '* -text\n', 'the project\'s own .gitattributes changed');
  yes(!('.gitattributes' in manifestOf(t2).files), 'the project\'s own .gitattributes was recorded');
});

test('generate-skills refuses to write through a symlinked folder that points outside the project, and writes nothing', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const ext = tmp();
  fs.writeFileSync(path.join(ext, 'SKILL.md'), 'OUTSIDE\n');
  const link = path.join(t, '.claude/skills/carousel-brief');
  fs.rmSync(link, { recursive: true });
  // Windows without the symlink privilege refuses a directory symlink; a junction is the same trap there.
  try { fs.symlinkSync(ext, link); } catch (e) { if (process.platform !== 'win32') throw e; fs.symlinkSync(ext, link, 'junction'); }
  const src = path.join(t, skill('.agents/skills', 'carousel-wrap'));
  fs.appendFileSync(src, '\nA change to regenerate.\n');
  const wrapCopy = fs.readFileSync(path.join(t, skill('.claude/skills', 'carousel-wrap')), 'utf8');
  const r = node(path.join(t, 'scripts', 'generate-skills.js'), [], t);
  eq(r.code, 1, r.out);
  yes(/refusing to write outside the project: \S+carousel-brief[\\/]SKILL\.md resolves to /.test(r.out), r.out);
  eq(fs.readdirSync(ext).join(','), 'SKILL.md', 'a file (a backup?) was written outside the project');
  eq(fs.readFileSync(path.join(ext, 'SKILL.md'), 'utf8'), 'OUTSIDE\n', 'the file outside the project changed');
  eq(fs.readFileSync(path.join(t, skill('.claude/skills', 'carousel-wrap')), 'utf8'), wrapCopy, 'it wrote inside the project before refusing');
});

test('doctor reports each registered engine command and whether its script exists; the root sample config runs the shipped example', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  let r = run(['doctor', t]);
  eq(r.code, 0, r.out);
  yes(/engine\s+none/.test(r.out), r.out);
  fs.copyFileSync(path.join(t, 'carousel.config.example.json'), path.join(t, 'carousel.config.json'));
  r = run(['doctor', t]);
  yes(/ok\s+engine scan: docs\/build-your-engine\/example\/scan\.js found/.test(r.out) && /ok\s+engine render: docs\/build-your-engine\/example\/render\.js found/.test(r.out), r.out);
  fs.writeFileSync(path.join(t, 'carousel.config.json'), JSON.stringify({ engine: { scan: 'python3 tools/scan.py {deck} {out}', render: 'node docs/build-your-engine/example/render.js {deck} {out}', tools: { budget: 'no-such-program-xyz {deck} {out}' } } }));
  r = run(['doctor', t]);
  eq(r.code, 1, r.out);
  yes(/engine scan: tools\/scan\.py not found/.test(r.out) && /engine budget: no-such-program-xyz not found on PATH/.test(r.out) && /ok\s+engine render:/.test(r.out), r.out);
});

test('install from a git clone never copies or records a file git does not track', () => {
  const src = sourceCopy();
  const g = (args) => cp.spawnSync('git', ['-C', src].concat(args), { encoding: 'utf8' });
  if (g(['init', '-q']).error) { console.log('note  skipped: git is not available'); return; }
  eq(g(['add', '-A']).status, 0, 'git add');
  fs.writeFileSync(path.join(src, 'bookshelf', 'zz-untracked.md'), '# Untracked\n');
  fs.writeFileSync(path.join(src, 'scripts', 'zz-untracked.js'), '// untracked\n');
  const t = tmp();
  const r = node(path.join(src, 'scripts', 'install.js'), ['init', t], src);
  eq(r.code, 0, r.out);
  ['bookshelf/zz-untracked.md', 'scripts/zz-untracked.js'].forEach((rel) => {
    yes(!fs.existsSync(path.join(t, rel)), rel + ' was installed');
    yes(!(rel in manifestOf(t).files), rel + ' was recorded');
  });
  yes(fs.existsSync(path.join(t, 'bookshelf/rubric.md')) && fs.existsSync(path.join(t, 'scripts/stages.json')), 'a tracked file was left out');
});

test('update says "yours, kept" for a handoff the tool never wrote, and the usage names --agents', () => {
  const t = tmp();
  fs.mkdirSync(path.join(t, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(t, 'memory', 'handoff.md'), '# Handoff\n\nMy own old notes.\n');
  eq(run(['init', t]).code, 0, 'init');
  const u = run(['update', t]);
  eq(u.code, 0, u.out);
  yes(/kept\s+memory\/handoff\.md \(yours, kept, and it does not match/.test(u.out), u.out);
  yes(!/memory\/handoff\.md \(you edited it/.test(u.out), u.out);
  const h = run(['--help']);
  yes(/--agents\|--no-agents/.test(h.out), h.out);
});

test('every relative link in the packed npm package resolves', () => {
  const r = cp.spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.error) { console.log('note  skipped: npm is not available'); return; }
  eq(r.status, 0, 'npm pack --dry-run failed');
  const dest = tmp();
  JSON.parse(r.stdout)[0].files.forEach((f) => {
    fs.mkdirSync(path.dirname(path.join(dest, f.path)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f.path), path.join(dest, f.path));
  });
  const c = node(path.join(ROOT, 'scripts', 'check-links.js'), ['--root', dest]);
  eq(c.code, 0, c.out);
});

// ------------------------------------------------------------------ printed advice, followed as printed, loses nothing
// Every file's hash, the manifest aside.
function snapshot(t) {
  const out = {};
  walk(t, '', []).filter((f) => f !== '.carousel-install.json' && !f.includes('.carousel-backup')).forEach((f) => { out[f] = shaFile(path.join(t, f)); });
  return out;
}
// The files whose bytes are gone: no longer at their path and in no backup beside it.
function lostFiles(t, before) {
  return Object.keys(before).filter((rel) => !editKept(t, rel, before[rel]));
}
// One shell word as printed: bare, "double quoted" or 'single quoted'.
const WORD = `(?:"[^"]*"|'[^']*'|[^\\s;),"'<]+)`;
// Run a printed command through a shell from a folder that is not the project.
// shell: true is /bin/sh -c on POSIX and cmd.exe /d /s /c on Windows, the shell each platform's user pastes into.
function viaShell(cmd, cwd) {
  const r = cp.spawnSync(cmd, { shell: true, encoding: 'utf8', cwd: cwd || os.tmpdir(), env: Object.assign({}, process.env, { PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH }) });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

test('upgrade from ' + OLD + ' with an edited generate-skills.js (L5): check-process, doctor and update give the same advice, never the project\'s copy, and following check-process\'s advice loses no bytes', () => {
  const t = oldInstall();
  if (!t) { console.log('      (skipped: no git history for ' + OLD + ')'); return; }
  fs.appendFileSync(path.join(t, 'scripts', 'generate-skills.js'), '\n// USER EDIT generate-skills\n');
  REGEN_EDITS.forEach((rel) => fs.appendFileSync(path.join(t, rel), 'MY EDIT\n'));
  const u = run(['update', t]);
  eq(u.code, 0, u.out);
  const before = snapshot(t);
  const p = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  const d = run(['doctor', t]);
  const SAME = 'the project\'s scripts/generate-skills.js is from another version and was left alone; run the generator from your Carousel OS clone or the package (';
  [['check-process', p.out], ['doctor', d.out]].forEach(([who, out]) => yes(out.includes(SAME), who + ' does not give the advice:\n' + out));
  [['check-process', p.out], ['doctor', d.out], ['update', u.out]].forEach(([who, out]) => {
    yes(!/node scripts\/generate-skills\.js/.test(out), who + ' names the project\'s own generator by a relative path:\n' + out);
    yes(!out.includes('node ' + path.join(t, 'scripts', 'generate-skills.js')), who + ' names the project\'s own generator:\n' + out);
  });
  eq(p.code, 1, 'check-process passed with a generator from another version:\n' + p.out);
  const m = new RegExp('\\((node <clone>/scripts/generate-skills\\.js --root ' + WORD + ')\\)').exec(p.out);
  yes(m, 'check-process prints no generator command:\n' + p.out);
  // Follow it as printed, with <clone> filled in, through a shell from another folder.
  const f = viaShell(m[1].replace('<clone>/scripts/generate-skills.js', shq(path.join(ROOT, 'scripts', 'generate-skills.js'))));
  eq(f.code, 0, 'the printed command failed:\n' + f.out);
  eq(lostFiles(t, before).join(', '), '', 'files lost by following check-process\'s generator advice');
  yes(fs.readFileSync(path.join(t, 'scripts', 'generate-skills.js'), 'utf8').includes('USER EDIT generate-skills'), 'the edited generator was changed');
  // The other half of the advice: update with --overwrite, which backs up. Still nothing lost, and then every check passes.
  const o = run(['update', t, '--overwrite']);
  eq(o.code, 0, o.out);
  eq(lostFiles(t, before).join(', '), '', 'files lost by update --overwrite');
  const p2 = node(path.join(t, 'scripts', 'check-process.js'), [], t);
  yes(!/generate-skills\.js is from another version/.test(p2.out), 'still from another version after --overwrite:\n' + p2.out);
});

test('printed commands quote paths with spaces and shell characters and run from any folder (SP2)', () => {
  const t = path.join(tmp(), 'my deck $HOME (copy)');
  eq(run(['init', t]).code, 0, 'init');
  const rel = skill('.claude/skills', 'carousel-build');
  fs.appendFileSync(path.join(t, rel), 'my own edit\n');
  const h = shaFile(path.join(t, rel));
  const d = run(['doctor', t]);
  eq(d.code, 1, d.out);
  const gen = new RegExp('(node ' + WORD + ' --root ' + WORD + ')[;)]').exec(d.out.split('\n').find((l) => /^DIFFERS/.test(l)) || '');
  yes(gen && /generate-skills\.js/.test(gen[1]), 'doctor prints no generator command:\n' + d.out);
  const chk = new RegExp('run (node ' + WORD + ' --root ' + WORD + ') to see each problem').exec(d.out);
  yes(chk, 'doctor prints no check-process command:\n' + d.out);
  const c = viaShell(chk[1]);
  eq(c.code, 1, 'the printed check-process command did not run the checks:\n' + c.out);
  yes(/FAIL skills/.test(c.out), c.out);
  const confirm = node(path.join(t, 'scripts', 'generate-skills.js'), ['--confirm'], t);
  const own = new RegExp('run (node ' + WORD + ' --root ' + WORD + ')$', 'm').exec(confirm.out);
  yes(own, '--confirm prints no command:\n' + confirm.out);
  const g = viaShell(gen[1]);
  eq(g.code, 0, 'the printed generator command failed:\n' + g.out);
  yes(backupHashes(t, rel).includes(h), 'the edit was not saved before the rewrite');
  eq(viaShell(chk[1]).code, 0, 'check-process after following the advice');
  eq(viaShell(own[1] + ' --confirm').code, 0, '--confirm as printed');
  // update's kept line, for a copy edited again under a kept source, follows the same rule.
  fs.appendFileSync(path.join(t, skill('.agents/skills', 'carousel-wrap')), 'user source note\n');
  fs.appendFileSync(path.join(t, skill('.claude/skills', 'carousel-wrap')), 'MINE\n');
  const u = run(['update', t]);
  const k = new RegExp('kept\\s+\\.claude/skills/carousel-wrap/SKILL\\.md \\(you edited it; to rebuild it from \\S+: run (node ' + WORD + ' --root ' + WORD + ');').exec(u.out);
  yes(k, 'update prints no runnable command:\n' + u.out);
  eq(viaShell(k[1]).code, 0, 'the command update printed failed');
});

test('a CRLF checkout of a fresh install (G1, G2) is unedited: update keeps nothing as edited and makes no backups, from an LF or a CRLF source', () => {
  // G1: the project's text turned CRLF after install.
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  walk(t, '', []).filter((f) => !/\.pptx$/.test(f) && f !== '.carousel-install.json').forEach((f) => {
    const p = path.join(t, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
  });
  const u = run(['update', t]);
  eq(u.code, 0, u.out);
  yes(/ 0 kept \(edited\), 0 left alone/.test(u.out), 'line endings alone made files "edited":\n' + u.out.split('\n').filter((l) => /^(kept|exists)/.test(l)).slice(0, 5).join('\n'));
  yes(!/^backup/m.test(u.out), 'a backup was made for a line-ending change:\n' + u.out);
  eq(run(['doctor', t]).code, 0, 'doctor');
  // G2: the source itself checked out with CRLF (cloned with core.autocrlf=true).
  const src = sourceCopy();
  walk(src, '', []).filter((f) => !/\.pptx$/.test(f) && !f.startsWith('.git/')).forEach((f) => {
    const p = path.join(src, f);
    const b = fs.readFileSync(p);
    if (!b.includes(0)) fs.writeFileSync(p, b.toString('utf8').replace(/\r?\n/g, '\r\n'));
  });
  const t2 = tmp();
  eq(node(path.join(src, 'scripts', 'install.js'), ['init', t2], src).code, 0, 'init from a CRLF source');
  const u2 = run(['update', t2]);
  eq(u2.code, 0, u2.out);
  yes(/ 0 kept \(edited\), 0 left alone/.test(u2.out) && !/^backup/m.test(u2.out), 'an install from a CRLF source counts as edited:\n' + u2.out.split('\n').filter((l) => /^(kept|exists|backup)/.test(l)).slice(0, 5).join('\n'));
  eq(run(['doctor', t2]).code, 0, 'doctor after an install from a CRLF source');
  eq(node(path.join(t2, 'scripts', 'check-process.js'), [], t2).code, 0, 'check-process after an install from a CRLF source');
});

test('update replaces a CRLF copy of an older shipped text with the package bytes and no backup, and keeps a real edit', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const rel = 'bookshelf/rubric.md';
  const old = '# An older rubric\n\nOld text.\n';
  fs.writeFileSync(path.join(t, rel), old.replace(/\n/g, '\r\n'));
  const m = manifestOf(t);
  m.files[rel] = sha(old);
  writeManifest(t, m);
  const r = run(['update', t]);
  eq(r.code, 0, r.out);
  yes(new RegExp('^update\\s+' + rel.replace(/[./]/g, '\\$&'), 'm').test(r.out), 'the CRLF copy of the old text was not updated:\n' + r.out);
  yes(!fs.existsSync(path.join(t, rel + '.carousel-backup')), 'a backup was made for text identical after line endings');
  yes(fs.readFileSync(path.join(t, rel)).equals(fs.readFileSync(path.join(ROOT, rel))), 'the package bytes were not written');
  fs.appendFileSync(path.join(t, rel), 'my edit\r\n');
  const k = run(['update', t]);
  yes(new RegExp('^kept\\s+' + rel.replace(/[./]/g, '\\$&'), 'm').test(k.out), 'a real edit was not kept:\n' + k.out);
});

test('a backup never writes through a symlink planted at its name (BK): update and generate-skills take the next free name', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  const outside = tmp();
  const rel = 'bookshelf/rubric.md';
  fs.writeFileSync(path.join(t, rel), 'my own rubric\n');
  const target = path.join(outside, 'stolen.md');
  fs.symlinkSync(target, path.join(t, rel + '.carousel-backup'));              // dangling: a plain copy would create it
  fs.writeFileSync(path.join(outside, 'kept.md'), 'outside\n');
  fs.symlinkSync(path.join(outside, 'kept.md'), path.join(t, rel + '.carousel-backup2'));   // points at a real file
  const r = run(['update', t, '--overwrite']);
  eq(r.code, 0, r.out);
  yes(!fs.existsSync(target), 'the backup was written through the symlink, outside the project');
  eq(fs.readFileSync(path.join(outside, 'kept.md'), 'utf8'), 'outside\n', 'a file outside the project changed');
  eq(fs.readFileSync(path.join(t, rel + '.carousel-backup3'), 'utf8'), 'my own rubric\n', 'the backup is not at the next free name');
  yes(fs.lstatSync(path.join(t, rel + '.carousel-backup3')).isFile(), 'the backup is not a plain file');
  // generate-skills, the same way.
  const copy = skill('.claude/skills', 'carousel-build');
  fs.appendFileSync(path.join(t, copy), 'my own edit\n');
  const h = shaFile(path.join(t, copy));
  const target2 = path.join(outside, 'stolen2.md');
  fs.symlinkSync(target2, path.join(t, copy + '.carousel-backup'));
  const g = node(path.join(t, 'scripts', 'generate-skills.js'), [], t);
  eq(g.code, 0, g.out);
  yes(!fs.existsSync(target2), 'generate-skills wrote its backup through the symlink');
  eq(shaFile(path.join(t, copy + '.carousel-backup2')), h, 'generate-skills did not save the edit at the next free name');
});

test('doctor reads quoted engine paths, -m modules and inline code without calling them missing, and agrees with check-process', () => {
  const t = tmp();
  eq(run(['init', t]).code, 0, 'init');
  fs.mkdirSync(path.join(t, 'my tools'));
  fs.writeFileSync(path.join(t, 'my tools', 'scan.py'), '# scan\n');
  fs.writeFileSync(path.join(t, 'carousel.config.json'), JSON.stringify({ engine: {
    scan: 'python3 "my tools/scan.py" {deck} {out}',
    render: 'python3 -m deckkit.render {deck} {out}',
    tools: { lint: "bash -c 'echo ok' {deck} {out}", req: 'node -r ./setup.js docs/build-your-engine/example/render.js {deck} {out}' } } }));
  const d = run(['doctor', t]);
  eq(d.code, 0, d.out);
  yes(!/MISSING/.test(d.out), d.out);
  yes(/ok\s+engine scan: my tools\/scan\.py found/.test(d.out), d.out);
  yes(/ok\s+engine render: python3 -m deckkit\.render \(a module, not a file/.test(d.out), d.out);
  yes(/ok\s+engine req: docs\/build-your-engine\/example\/render\.js found/.test(d.out), d.out);
  eq(node(path.join(t, 'scripts', 'check-process.js'), [], t).code, 0, 'check-process');
  // A quoted path that does not exist is still missing.
  fs.writeFileSync(path.join(t, 'carousel.config.json'), JSON.stringify({ engine: { scan: 'python3 "my tools/nope.py" {deck} {out}', render: 'node docs/build-your-engine/example/render.js {deck} {out}' } }));
  const d2 = run(['doctor', t]);
  yes(/MISSING\s+engine scan: my tools\/nope\.py not found/.test(d2.out), d2.out);
});

fs.rmSync(RUN_DIR, { recursive: true, force: true });
console.log(`\ninstaller tests: ${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
