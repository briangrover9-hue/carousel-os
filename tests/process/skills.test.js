'use strict';
// generate-skills: the stage sources in .agents/skills and their derived files stay in step.
const h = require('./harness');
const { assert, fs, path, edit, test, done } = h;
const gen = require(path.join(h.SCRIPTS, 'generate-skills.js'));

const GEN = path.join(h.SCRIPTS, 'generate-skills.js');
const write = (d) => h.node(GEN, ['--root', d], d);
const confirm = (d) => h.node(GEN, ['--confirm', '--root', d], d);
// A copy of the repository with every derived file written, whatever the copy started with.
const fresh = () => { const d = h.copyRepo(); assert.strictEqual(write(d).code, 0); return d; };
const NINE = ['start', 'brief', 'storyboard', 'challenge-plan', 'build', 'check', 'review', 'wrap', 'handoff'].map((n) => `carousel-${n}`);

test('this folder itself has no drift', () => {
  // A project installed with --no-agents has no .claude/ copies on purpose, so only the repository is held to them.
  if (!fs.existsSync(path.join(h.ROOT, '.claude/skills'))) return;
  const r = confirm(h.ROOT);
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(r.out.includes('PASS generate-skills'), r.out);
});

test('every stage has front matter with its name, its Job sentence and manual-only invocation', () => {
  const d = fresh();
  assert.deepStrictEqual(gen.stageNames(d), NINE.slice().sort());
  NINE.forEach((n) => {
    const text = fs.readFileSync(path.join(d, `.agents/skills/${n}/SKILL.md`), 'utf8');
    const { front, body } = gen.splitFrontMatter(text);
    assert.ok(front.includes(`name: ${n}\n`), n);
    assert.ok(front.includes('disable-model-invocation: true'), n);
    const job = body.split('\n').find((l) => l.startsWith('Job: ')).slice(5);
    const desc = /description: "(.*)"/.exec(front)[1];
    assert.ok(job.toLowerCase().startsWith(desc.slice(0, -1).toLowerCase()), `${n}: "${desc}" is not the first sentence of "${job}"`);
    assert.ok(/[.]$/.test(desc) && desc.split('. ').length === 1, `${n}: the description is not one sentence`);
  });
});

test('Codex gets an openai.yaml that turns off implicit invocation, and Claude Code gets byte-identical copies', () => {
  const d = fresh();
  NINE.forEach((n) => {
    assert.strictEqual(fs.readFileSync(path.join(d, `.agents/skills/${n}/agents/openai.yaml`), 'utf8'), 'policy:\n  allow_implicit_invocation: false\n');
    assert.ok(fs.readFileSync(path.join(d, `.agents/skills/${n}/SKILL.md`)).equals(fs.readFileSync(path.join(d, `.claude/skills/${n}/SKILL.md`))), n);
  });
  gen.agentNames(d).forEach((f) => assert.ok(fs.readFileSync(path.join(d, 'agents', f)).equals(fs.readFileSync(path.join(d, '.claude/agents', f))), f));
});

test('--confirm fails on an edited copy, a stale description, a missing yaml, a changed agent and a stale folder', () => {
  const cases = [
    (d) => edit(d, '.claude/skills/carousel-build/SKILL.md', (t) => t + '\nlocal edit\n'),
    (d) => edit(d, '.agents/skills/carousel-build/SKILL.md', (t) => t.replace(/^Job: build/m, 'Job: assemble')),
    (d) => fs.unlinkSync(path.join(d, '.agents/skills/carousel-wrap/agents/openai.yaml')),
    (d) => edit(d, '.agents/skills/carousel-wrap/SKILL.md', (t) => t.replace('disable-model-invocation: true', 'disable-model-invocation: false')),
    (d) => edit(d, 'agents/carousel-reviewer.md', (t) => t + '\nnew line\n'),
    (d) => edit(d, '.claude/skills/carousel-polish/SKILL.md', () => '# carousel-polish\n'),
  ];
  cases.forEach((mutate, i) => {
    const d = fresh();
    mutate(d);
    const r = confirm(d);
    assert.strictEqual(r.code, 1, `case ${i}: ${r.out}`);
    assert.ok(r.out.includes('FAIL generate-skills'), `case ${i}: ${r.out}`);
  });
});

test('a write run repairs drift in the derived files and leaves the body alone', () => {
  const d = fresh();
  const src = path.join(d, '.agents/skills/carousel-check/SKILL.md');
  const body = gen.splitFrontMatter(fs.readFileSync(src, 'utf8')).body;
  edit(d, '.claude/skills/carousel-check/SKILL.md', () => 'stale\n');
  edit(d, '.agents/skills/carousel-check/SKILL.md', (t) => t.replace(/^description: .*$/m, 'description: "old"'));
  assert.strictEqual(write(d).code, 0);
  assert.strictEqual(confirm(d).code, 0);
  assert.strictEqual(gen.splitFrontMatter(fs.readFileSync(src, 'utf8')).body, body);
});

test('a stage with no Job line or the wrong title is a problem the script will not paper over', () => {
  const d = fresh();
  edit(d, '.agents/skills/carousel-start/SKILL.md', (t) => t.replace(/^Job: .*\n/m, ''));
  assert.strictEqual(write(d).code, 1);
  assert.ok(confirm(d).out.includes('no "Job:" line'));
});

test('the reviewer agents are read-only, engine-agnostic and never round UNVERIFIABLE up', () => {
  ['carousel-reviewer.md', 'carousel-fidelity.md'].forEach((f) => {
    const text = fs.readFileSync(path.join(h.ROOT, 'agents', f), 'utf8');
    const { front, body } = gen.splitFrontMatter(text);
    assert.ok(front.includes(`name: ${f.replace(/\.md$/, '')}`), f);
    assert.ok(/^description: ".+"$/m.test(front), f);
    assert.strictEqual(/^tools: (.*)$/m.exec(front)[1], 'Read, Grep, Glob, Bash', f);
    ['PASS', 'REJECT', 'UNVERIFIABLE', 'never rounded up to PASS', 'pasted', "builder's reasoning", 'found <value>'].forEach((s) => assert.ok(body.includes(s), `${f} lacks: ${s}`));
    assert.ok(!/\bengine\b/i.test(body), `${f} assumes an engine`);
  });
  const review = fs.readFileSync(path.join(h.ROOT, '.agents/skills/carousel-review/SKILL.md'), 'utf8');
  ['agents/carousel-reviewer.md', 'agents/carousel-fidelity.md'].forEach((s) => assert.ok(review.includes(s), `carousel-review does not name ${s}`));
});

done();
