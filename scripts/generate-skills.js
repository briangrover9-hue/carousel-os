#!/usr/bin/env node
'use strict';
// generate-skills: keep the stage skills and the reviewer agents in the shape each tool reads. Zero dependencies.
//
//   node scripts/generate-skills.js [--root DIR]             write what is derived
//   node scripts/generate-skills.js --confirm [--root DIR]   change nothing; exit 1 when anything would change
//
// The single source of each stage is .agents/skills/<name>/SKILL.md, where Cursor and Codex look. Its body (from the
// "# <name>" line down) is written by hand. Everything else is derived from it, and this script writes it:
//   - the front matter: name (the folder), description (the first sentence of the body's "Job:" line, with the
//     label dropped) and disable-model-invocation: true, so no tool starts a stage unasked;
//   - .agents/skills/<name>/agents/openai.yaml, which tells Codex the skill is manual-only;
//   - .claude/skills/<name>/SKILL.md, a byte-identical copy where Claude Code looks.
// The reviewer agents in agents/*.md are copied byte for byte to .claude/agents/.
// The stages and agents are the ones scripts/stages.json lists, the one list the package ships. Any other folder in
// .agents/skills/ (your own skill, or a stage an older version shipped and you kept) is never read, checked or
// written, even when its name starts with carousel-.
// In an installed project, a copy in .claude/skills or .claude/agents that the manifest (.carousel-install.json)
// does not record, as written by the installer or by this script, is yours: this script reports it and never writes
// over it. Every .claude/ file this script writes is recorded there under "generated".
// A folder in .claude/skills, or a file in .claude/agents, named for a stage or agent stages.json lists (shipped or
// retired) but with no source is reported as stale, unless the project is installed and its manifest records nothing
// there: then it is yours and left alone. Any other carousel-* name is never the tool's and never stale, whatever the
// manifest records.
// Before it overwrites a file whose bytes the tooling did not record as its own, this script saves that file as
// <file>.carousel-backup (then .carousel-backup2, and so on, never over an earlier backup) and prints "backup".
// It refuses, and writes nothing, when any path it would write resolves outside the project (a symlinked folder that
// points elsewhere), the same rule the installer applies.
// Exit 0 when clean or written, 1 when --confirm finds drift, 2 for bad arguments.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SKILLS = '.agents/skills';
const CLAUDE_SKILLS = '.claude/skills';
const AGENTS = 'agents';
const CLAUDE_AGENTS = '.claude/agents';
const OPENAI_YAML = 'policy:\n  allow_implicit_invocation: false\n';

// Split "---\n...\n---\n" front matter from the body. A file with no front matter has an empty one.
function splitFrontMatter(text) {
  const t = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n\n?/.exec(t);
  if (!m) return { front: null, body: t };
  return { front: m[1], body: t.slice(m[0].length) };
}

// The description: the first sentence of the "Job:" line, label dropped, first letter capitalized.
function describe(body) {
  const job = body.split('\n').find((l) => l.startsWith('Job: '));
  if (!job) return null;
  const rest = job.slice(5).trim();
  const end = rest.search(/\.(\s|$)/);
  const first = end < 0 ? rest : rest.slice(0, end + 1);
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function yamlString(s) { return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }

function skillText(name, body) {
  const d = describe(body);
  if (d === null) return null;
  return `---\nname: ${name}\ndescription: ${yamlString(d)}\ndisable-model-invocation: true\n---\n\n${body}`;
}

// The shipped list: scripts/stages.json under root, else the one beside this script.
const LIST = 'scripts/stages.json';
function shipped(root) {
  const at = [path.join(root, LIST), path.join(__dirname, 'stages.json')].find((f) => fs.existsSync(f));
  if (!at) throw new Error(`generate-skills: no ${LIST}`);
  const j = JSON.parse(fs.readFileSync(at, 'utf8'));
  const list = (k) => (Array.isArray(j[k]) ? j[k].slice() : []);
  return { stages: list('stages'), agents: list('agents'), retiredStages: list('retiredStages'), retiredAgents: list('retiredAgents'), retiredFiles: list('retiredFiles'),
    renamed: j.renamed && typeof j.renamed === 'object' ? Object.assign({}, j.renamed) : {} };
}

// The listed stages whose source exists under root.
function stageNames(root) {
  return shipped(root).stages.filter((n) => fs.existsSync(path.join(root, SKILLS, n, 'SKILL.md'))).sort();
}

// In an installed project, a .claude/ file that neither the installer (its "files") nor this script (its
// "generated") recorded in the manifest is the user's own file.
const MANIFEST = '.carousel-install.json';
function readManifest(root) {
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8')); } catch (e) { return null; }
  return shapeError(m) ? null : m;
}
// What is wrong with a manifest's shape, in plain words, or null when it is sound. A manifest of the wrong shape is
// never read as a record of anything.
function shapeError(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return 'it is not a JSON object';
  const map = (k) => m[k] === undefined || (typeof m[k] === 'object' && m[k] !== null && !Array.isArray(m[k]) && Object.keys(m[k]).every((x) => typeof m[k][x] === 'string'));
  const bad = ['files', 'generated', 'unverified'].find((k) => !map(k));
  if (bad) return `"${bad}" must be an object that maps each path to a hash`;
  if (m.deleted !== undefined && !(Array.isArray(m.deleted) && m.deleted.every((x) => typeof x === 'string'))) return '"deleted" must be a list of paths';
  if (m.agents !== undefined && typeof m.agents !== 'boolean') return '"agents" must be true or false';
  return null;
}
function manifestProblem(root) {
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8')); } catch (e) {
    return fs.existsSync(path.join(root, MANIFEST)) ? 'it is not valid JSON' : null;
  }
  return shapeError(m);
}
// The installer writes this format number into every manifest it writes. A manifest without it came from an older
// installer, which could run from inside a project and record the hashes of files the person had edited, so its
// hashes never prove the tool wrote a file.
const MANIFEST_FORMAT = 2;
function trusted(m) { return !!m && m.format === MANIFEST_FORMAT; }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
// True when a trusted manifest records this exact content at rel as written by the installer or this script. An
// "unverified" entry (carried over from an older manifest) marks a path as the tool's but never proves its bytes.
function toolWrote(root, rel, hash) {
  const m = readManifest(root);
  if (!trusted(m)) return false;
  return (m.files && m.files[rel] === hash) || (m.generated && m.generated[rel] === hash) || false;
}
// Copy a file to <file>.carousel-backup, or the first of .carousel-backup2, 3, ... that is free. A name taken by
// anything, a symlink included (even one that points nowhere), is skipped, and the copy is made with an exclusive
// create, so a backup never writes through a symlink or over an earlier backup. Given the project root, the backup's
// real location must also fall inside it, the same containment rule every other write follows.
// Returns the backup's path.
function taken(p) { try { fs.lstatSync(p); return true; } catch (e) { return false; } }
function saveBackup(file, root) {
  for (let n = 1; ; n++) {
    const b = file + '.carousel-backup' + (n === 1 ? '' : n);
    if (taken(b)) continue;
    if (root) {
      const bad = outsideProblem(root, path.relative(root, b));
      if (bad) throw Object.assign(new Error(bad), { outside: true });
    }
    try { fs.copyFileSync(file, b, fs.constants.COPYFILE_EXCL); } catch (e) { if (e.code === 'EEXIST') continue; throw e; }
    return b;
  }
}

function userOwned(root, rel) {
  if (!rel.startsWith(CLAUDE_SKILLS + '/') && !rel.startsWith(CLAUDE_AGENTS + '/')) return false;
  const m = readManifest(root);
  if (!m) return false;
  const ours = (m.files && m.files[rel]) || (m.generated && m.generated[rel]) || (m.unverified && m.unverified[rel]);
  return fs.existsSync(path.join(root, rel)) && !ours;
}
// A carousel-* folder or file in .claude/ with no source is yours when the manifest records nothing at or under it.
function userOwnedTree(root, rel) {
  const m = readManifest(root);
  if (!m || !fs.existsSync(path.join(root, rel))) return false;
  const keys = Object.keys(m.files || {}).concat(Object.keys(m.generated || {}), Object.keys(m.unverified || {}));
  return !keys.some((k) => k === rel || k.startsWith(rel + '/'));
}

// Record a .claude/ file this script wrote, so the next run keeps it in sync. Only in an installed project.
function recordGenerated(root, rels) {
  const m = readManifest(root);
  if (!m || !rels.length) return;
  m.generated = m.generated || {};
  rels.forEach((rel) => {
    m.generated[rel] = sha(fs.readFileSync(path.join(root, rel)));
    if (m.files) delete m.files[rel];
    if (m.unverified) delete m.unverified[rel];
  });
  if (m.unverified && !Object.keys(m.unverified).length) delete m.unverified;
  fs.writeFileSync(path.join(root, MANIFEST), JSON.stringify(m, null, 2) + '\n');
}

// The real path of p: resolve the deepest part of it that exists (following any symlink), then add the rest.
// install.js uses the same rule, so the two tools refuse the same writes.
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
  try { real = fs.realpathSync(probe); } catch (e) { return null; }
  return path.join(real, ...rest);
}
// Why a write to rel would land outside the project, in the installer's words, or null when it stays inside.
function outsideProblem(root, rel) {
  const top = realOf(root);
  const real = realOf(path.join(root, rel));
  if (top === null || real === null) return 'refusing to write outside the project: ' + path.join(root, rel) + ' cannot be resolved (a broken symlink?).';
  if (real !== top && !real.startsWith(top + path.sep)) return 'refusing to write outside the project: ' + path.join(root, rel) + ' resolves to ' + real + '.';
  return null;
}

function agentNames(root) {
  return shipped(root).agents.filter((f) => fs.existsSync(path.join(root, AGENTS, f))).sort();
}

// Every derived file and what it should hold. Problems are things this script cannot fix.
function plan(root) {
  const want = [];
  const problems = [];
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  stageNames(root).forEach((name) => {
    const src = `${SKILLS}/${name}/SKILL.md`;
    const { body } = splitFrontMatter(read(src));
    if (!body.startsWith(`# ${name}\n`)) { problems.push(`${src}: the body must start with "# ${name}"`); return; }
    const text = skillText(name, body);
    if (text === null) { problems.push(`${src}: no "Job:" line to take the description from`); return; }
    want.push({ rel: src, text });
    want.push({ rel: `${SKILLS}/${name}/agents/openai.yaml`, text: OPENAI_YAML });
    want.push({ rel: `${CLAUDE_SKILLS}/${name}/SKILL.md`, text });
  });
  agentNames(root).forEach((f) => want.push({ rel: `${CLAUDE_AGENTS}/${f}`, text: read(`${AGENTS}/${f}`) }));
  // Stale: a .claude/ copy of a stage or agent stages.json names (shipped or retired) whose source is gone. Any other
  // carousel-* name was never the tool's, whatever the manifest records, so it is never stale.
  const list = shipped(root);
  const toolStages = new Set(list.stages.concat(list.retiredStages));
  const toolAgents = new Set(list.agents.concat(list.retiredAgents));
  const stale = [];
  const names = new Set(stageNames(root));
  const cs = path.join(root, CLAUDE_SKILLS);
  if (fs.existsSync(cs)) fs.readdirSync(cs).filter((n) => toolStages.has(n) && !names.has(n)).forEach((n) => stale.push(`${CLAUDE_SKILLS}/${n}`));
  const ca = path.join(root, CLAUDE_AGENTS);
  const agents = new Set(agentNames(root));
  if (fs.existsSync(ca)) fs.readdirSync(ca).filter((n) => toolAgents.has(n) && !agents.has(n)).forEach((n) => stale.push(`${CLAUDE_AGENTS}/${n}`));
  // Only the tooling's own leftovers are stale; a folder or file the manifest never recorded is the user's.
  return { want, problems, stale: stale.filter((rel) => !userOwnedTree(root, rel)) };
}

// A checkout with CRLF line endings (git on Windows) is the same text: compare with LF on both sides.
const lf = (s) => s.replace(/\r\n/g, '\n');

function drift(root) {
  const p = plan(root);
  const out = p.problems.slice();
  const m = readManifest(root);
  const claude = (rel) => rel.startsWith(CLAUDE_SKILLS + '/') || rel.startsWith(CLAUDE_AGENTS + '/');
  p.want.forEach((w) => {
    const file = path.join(root, w.rel);
    if (userOwned(root, w.rel)) return;
    // After install --no-agents the .claude/ copies are optional: a missing one is not drift.
    if (!fs.existsSync(file)) { if (!(m && m.agents === false && claude(w.rel))) out.push(`${w.rel} is missing`); }
    else if (lf(fs.readFileSync(file, 'utf8')) !== lf(w.text)) out.push(`${w.rel} differs from what its source generates`);
  });
  p.stale.forEach((s) => out.push(`${s} has no source and is stale`));
  return out;
}

// The command that rebuilds the .claude/ copies of root, and the advice around it. check-process.js owns the rule
// (it names the project's own generate-skills.js only when that is this version's), so update, doctor and
// check-process print the same words. Required lazily: check-process.js requires this file.
function regenCommand(root) { return require('./check-process.js').regenAdvice(root); }

// A path as one shell word, the same rule as check-process.js: bare when safe, else quoted.
function shq(p) {
  const s = String(p);
  if (/^[A-Za-z0-9_\/.,:@%+=-]+$/.test(s)) return s;
  if (process.platform === 'win32') return '"' + s.replace(/"/g, '""') + '"';
  if (!/[$`"\\!]/.test(s)) return '"' + s + '"';
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function main(argv) {
  let root = path.resolve(__dirname, '..');
  let confirm = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--confirm') confirm = true;
    else if (argv[i] === '--root' && argv[i + 1]) root = path.resolve(argv[++i]);
    else if (argv[i] === '-h' || argv[i] === '--help') { console.log('usage: node scripts/generate-skills.js [--confirm] [--root DIR]'); return 0; }
    else { console.error(`generate-skills: unknown argument ${argv[i]}`); return 2; }
  }
  if (!stageNames(root).length) { console.error(`generate-skills: no ${SKILLS}/<name>/SKILL.md under ${root}`); return 2; }
  const bad = manifestProblem(root);
  if (bad) { console.error(`generate-skills: ${MANIFEST} cannot be read: ${bad}. Nothing was changed. Repair it, or run the installer's update, which says the same.`); return 2; }
  if (confirm) {
    const d = drift(root);
    plan(root).want.filter((w) => userOwned(root, w.rel)).forEach((w) => console.log(`yours    ${w.rel} (not written by the installer or this script; left alone)`));
    d.forEach((x) => console.log(`  ${x}`));
    // This very script is the one to run: name it by its absolute path, so the command works from any folder.
    console.log(d.length ? `FAIL generate-skills (${d.length}); run node ${shq(__filename)} --root ${shq(root)}` : 'PASS generate-skills');
    return d.length ? 1 : 0;
  }
  const p = plan(root);
  p.problems.forEach((x) => console.error(`  ${x}`));
  // What this run would write: every derived file that is not yours and does not already hold its text (a CRLF copy
  // of the same text counts as the same, so a Windows checkout is not rewritten).
  const writes = p.want.filter((w) => {
    const file = path.join(root, w.rel);
    if (userOwned(root, w.rel)) { console.log(`yours    ${w.rel} (not written by the installer or this script; left alone)`); return false; }
    return !fs.existsSync(file) || lf(fs.readFileSync(file, 'utf8')) !== lf(w.text);
  });
  // Containment before any write or backup: a path whose real location falls outside the project (a symlinked
  // folder pointing elsewhere) is refused, and nothing at all is written.
  const outside = writes.map((w) => outsideProblem(root, w.rel)).concat(writes.length ? [outsideProblem(root, MANIFEST)] : []).filter(Boolean);
  if (outside.length) {
    outside.forEach((x) => console.error(`generate-skills: ${x}`));
    console.error('generate-skills: nothing was written. Point that path at a plain folder inside the project, then run again.');
    return 1;
  }
  let wrote = 0;
  const claude = [];
  for (const w of writes) {
    const file = path.join(root, w.rel);
    if (fs.existsSync(file)) {
      const cur = fs.readFileSync(file);
      // A copy that differs from a recorded one only in its line endings is still the tool's: no backup needed.
      if (!toolWrote(root, w.rel, sha(cur)) && !toolWrote(root, w.rel, sha(Buffer.from(lf(cur.toString('utf8')))))) {
        let saved;
        try { saved = saveBackup(file, root); } catch (e) {
          if (!e.outside) throw e;
          recordGenerated(root, claude);
          console.error(`generate-skills: ${e.message} ${w.rel} and the files after it were not written.`);
          return 1;
        }
        console.log(`backup   ${w.rel} (your copy is saved as ${path.basename(saved)})`);
      }
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, w.text);
    if (w.rel.startsWith(CLAUDE_SKILLS + '/') || w.rel.startsWith(CLAUDE_AGENTS + '/')) claude.push(w.rel);
    console.log(`wrote    ${w.rel}`);
    wrote++;
  }
  recordGenerated(root, claude);
  p.stale.forEach((s) => console.log(`stale    ${s} (no source; remove it by hand)`));
  console.log(`generate-skills: ${wrote} written, ${p.problems.length} problem(s), ${p.stale.length} stale`);
  return p.problems.length ? 1 : 0;
}

module.exports = { regenCommand, realOf, outsideProblem, shapeError, splitFrontMatter, describe, skillText, shipped, stageNames, agentNames, userOwned, drift, saveBackup, toolWrote, trusted, MANIFEST_FORMAT, OPENAI_YAML, SKILLS, AGENTS };

if (require.main === module) process.exit(main(process.argv.slice(2)));
