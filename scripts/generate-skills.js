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
//     label dropped) and disable-model-invocation: true, so no tool starts a stage on its own;
//   - .agents/skills/<name>/agents/openai.yaml, which tells Codex the skill is manual-only;
//   - .claude/skills/<name>/SKILL.md, a byte-identical copy where Claude Code looks.
// The reviewer agents in agents/*.md are copied byte for byte to .claude/agents/.
// A carousel-* folder in .claude/skills, or a carousel-* file in .claude/agents, with no source is reported as stale.
// Exit 0 when clean or written, 1 when --confirm finds drift, 2 for bad arguments.

const fs = require('fs');
const path = require('path');

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

function stageNames(root) {
  const dir = path.join(root, SKILLS);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'SKILL.md'))).map((d) => d.name).sort();
}

function agentNames(root) {
  const dir = path.join(root, AGENTS);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^carousel-.*\.md$/.test(f)).sort();
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
  const stale = [];
  const names = new Set(stageNames(root));
  const cs = path.join(root, CLAUDE_SKILLS);
  if (fs.existsSync(cs)) fs.readdirSync(cs).filter((n) => /^carousel-/.test(n) && !names.has(n)).forEach((n) => stale.push(`${CLAUDE_SKILLS}/${n}`));
  const ca = path.join(root, CLAUDE_AGENTS);
  const agents = new Set(agentNames(root));
  if (fs.existsSync(ca)) fs.readdirSync(ca).filter((n) => /^carousel-.*\.md$/.test(n) && !agents.has(n)).forEach((n) => stale.push(`${CLAUDE_AGENTS}/${n}`));
  return { want, problems, stale };
}

// A checkout with CRLF line endings (git on Windows) is the same text: compare with LF on both sides.
const lf = (s) => s.replace(/\r\n/g, '\n');

function drift(root) {
  const p = plan(root);
  const out = p.problems.slice();
  p.want.forEach((w) => {
    const file = path.join(root, w.rel);
    if (!fs.existsSync(file)) out.push(`${w.rel} is missing`);
    else if (lf(fs.readFileSync(file, 'utf8')) !== lf(w.text)) out.push(`${w.rel} differs from what its source generates`);
  });
  p.stale.forEach((s) => out.push(`${s} has no source and is stale`));
  return out;
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
  if (confirm) {
    const d = drift(root);
    d.forEach((x) => console.log(`  ${x}`));
    console.log(d.length ? `FAIL generate-skills (${d.length}); run node scripts/generate-skills.js` : 'PASS generate-skills');
    return d.length ? 1 : 0;
  }
  const p = plan(root);
  p.problems.forEach((x) => console.error(`  ${x}`));
  let wrote = 0;
  p.want.forEach((w) => {
    const file = path.join(root, w.rel);
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === w.text) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, w.text);
    console.log(`wrote    ${w.rel}`);
    wrote++;
  });
  p.stale.forEach((s) => console.log(`stale    ${s} (no source; remove it by hand)`));
  console.log(`generate-skills: ${wrote} written, ${p.problems.length} problem(s), ${p.stale.length} stale`);
  return p.problems.length ? 1 : 0;
}

module.exports = { splitFrontMatter, describe, skillText, stageNames, agentNames, drift, OPENAI_YAML, SKILLS, AGENTS };

if (require.main === module) process.exit(main(process.argv.slice(2)));
