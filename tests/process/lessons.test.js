'use strict';
const h = require('./harness');
const { assert, fs, path, test, done } = h;
const lessons = require(path.join(h.SCRIPTS, 'lessons.js'));

function fixture() {
  const dir = h.tmpDir();
  const file = path.join(dir, 'wiki', 'lessons.md');
  fs.mkdirSync(path.dirname(file));
  fs.writeFileSync(file, fs.readFileSync(path.join(h.ROOT, 'memory/wiki/lessons.md'), 'utf8').replace(/\r\n/g, '\n'));
  return { dir, file, hist: path.join(dir, 'history') };
}
const run = (f, args) => h.node(path.join(h.SCRIPTS, 'lessons.js'), args.concat(['--file', f.file]));
const text = (f) => fs.readFileSync(f.file, 'utf8');
const ID = (f) => /L-[0-9a-f]{6}/.exec(text(f))[0];
const TEXT = 'Put the base beside every percentage on the slide itself';
const H = ['--human-confirmed', 'yes, that is the same lesson'];
const hist = (f) => fs.readFileSync(path.join(path.dirname(f.file), 'lessons.history'), 'utf8');

test('the seed file validates and an empty list prints a friendly line', () => {
  const f = fixture();
  assert.deepStrictEqual(lessons.validate(text(f), '2026-11-05'), []);
  const r = run(f, ['list']);
  assert.strictEqual(r.code, 0);
  assert.ok(r.out.includes('No rules or lessons yet') && r.out.includes('lessons.js add'), r.out);
});

test('--help works and says what needs the human', () => {
  const r = h.node(path.join(h.SCRIPTS, 'lessons.js'), ['--help']);
  assert.strictEqual(r.code, 0);
  assert.ok(r.out.includes('--human-confirmed'), r.out);
});

test('add writes one dated line', () => {
  const f = fixture();
  const r = run(f, ['add', TEXT, '--date', '2026-11-05']);
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(/- L-[0-9a-f]{6} \| 2026-11-05 \| n=1 \| confirmed 2026-11-05 \| Put the base/.test(text(f)));
  assert.deepStrictEqual(lessons.validate(text(f), '2026-11-05'), []);
});

test('a likely repeat is reported and nothing is written, with exit 3', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  const before = text(f);
  const r = run(f, ['add', 'Always show the base next to each percentage on the slide', '--date', '2026-11-12']);
  assert.strictEqual(r.code, 3, r.out);
  assert.ok(r.out.includes('POSSIBLE REPEAT') && r.out.includes('--human-confirmed'), r.out);
  assert.strictEqual(text(f), before);
});

test('documented paraphrases match and documented opposites do not', () => {
  const same = [
    [TEXT, 'Always show the base next to each percentage on the slide'],
    ['Label the series on the chart itself', 'Label each series directly on the chart'],
  ];
  const opposite = [
    ['Put the base beside every percentage', 'Never put the base beside any percentage'],
    ['Put the base beside every percentage', 'Remove the base beside every percentage'],
    ['Always cite the source on the slide', 'Never cite the source on the slide'],
    ['Show the legend on every chart', 'Hide the legend on every chart'],
    ['Open every deck with the answer', 'Do not open every deck with the answer'],
    ['Add a source line to every slide', 'Cut the source line from every slide'],
  ];
  same.forEach(([a, b]) => assert.ok(lessons.similar(a, b), `should match: ${a} / ${b}`));
  opposite.forEach(([a, b]) => assert.ok(!lessons.similar(a, b), `must not match: ${a} / ${b}`));
});

test('an opposite instruction is added as its own lesson, never counted as a repeat', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  const r = run(f, ['add', 'Never put the base beside any percentage on the slide', '--date', '2026-11-06']);
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(lessons.parse(text(f)).lessons.length, 2);
});

test('--new records a lesson the human says is different', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  assert.strictEqual(run(f, ['add', TEXT + '.', '--new', '--date', '2026-11-06']).code, 0);
  const doc = lessons.parse(text(f));
  assert.strictEqual(doc.lessons.length, 2);
  assert.notStrictEqual(doc.lessons[0].id, doc.lessons[1].id);
});

test('repeat and promote refuse without --human-confirmed, and exit 3', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  const id = ID(f);
  const before = text(f);
  let r = run(f, ['repeat', id, '--date', '2026-11-06']);
  assert.strictEqual(r.code, 3, r.out);
  assert.ok(r.out.includes('NEEDS HUMAN'));
  assert.strictEqual(text(f), before);
  run(f, ['repeat', id, ...H, '--date', '2026-11-06']);
  assert.ok(text(f).includes('n=2'));
  const due = run(f, ['promote']);
  assert.ok(due.out.includes(`PROMOTE DUE: ${id}`), due.out);
  assert.strictEqual(run(f, ['promote', id]).code, 3);
  assert.ok(lessons.parse(text(f)).rules.length === 0);
  assert.strictEqual(run(f, ['promote', id, ...H, '--date', '2026-11-07']).code, 0);
  const doc = lessons.parse(text(f));
  assert.strictEqual(doc.rules.length, 1);
  assert.strictEqual(doc.lessons.length, 0);
  assert.ok(/R-[0-9a-f]{6} \| promoted 2026-11-07 \| reviewed 2026-11-07 \|/.test(text(f)));
});

test('a lesson corrected once cannot be promoted', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  assert.strictEqual(run(f, ['promote', ID(f), ...H]).code, 2);
});

test('a twice-corrected lesson warns for 14 days, then fails validation', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  run(f, ['repeat', ID(f), ...H, '--date', '2026-11-05']);
  assert.ok(lessons.validate(text(f), '2026-11-19').every((e) => e.startsWith('WARN ')));
  assert.ok(lessons.validate(text(f), '2026-11-20').some((e) => !e.startsWith('WARN ') && e.includes('not promoted')));
});

test('adding a lesson that is already a rule reports the rule and adds nothing', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  const id = ID(f);
  run(f, ['repeat', id, ...H]);
  run(f, ['promote', id, ...H]);
  const r = run(f, ['add', TEXT, '--date', '2026-11-20']);
  assert.ok(r.out.includes('RULE BROKEN AGAIN'), r.out);
  assert.strictEqual(lessons.parse(text(f)).lessons.length, 0);
});

test('the rule cap blocks a thirteenth rule, and retire frees a slot', () => {
  const f = fixture();
  const rules = [];
  for (let i = 0; i < 12; i++) rules.push(`- R-${String(i).padStart(6, '0')} | promoted 2026-11-05 | reviewed 2026-11-05 | Rule number ${i} says do thing ${i} every time`);
  fs.writeFileSync(f.file, text(f).replace('## Rules\n\n_None yet._', '## Rules\n\n' + rules.join('\n')).replace('## Lessons\n\n_None yet._', '## Lessons\n\n- L-abcdef | 2026-11-05 | n=2 | confirmed 2026-11-05 | Label every series on the chart'));
  assert.ok(lessons.validate(text(f), '2026-11-06').every((e) => e.startsWith('WARN ')));
  const r = run(f, ['promote', 'L-abcdef', ...H]);
  assert.strictEqual(r.code, 3, r.out);
  assert.ok(r.out.includes('cap'), r.out);
  assert.strictEqual(run(f, ['retire', 'R-000000', ...H, '--date', '2026-11-06']).code, 0);
  assert.ok(fs.readFileSync(path.join(f.hist, 'retired-rules.md'), 'utf8').includes('Rule number 0'));
  assert.strictEqual(run(f, ['promote', 'L-abcdef', ...H]).code, 0);
  fs.writeFileSync(f.file, text(f).replace('## Rules\n\n', '## Rules\n\n- R-ffffff | promoted 2026-11-05 | reviewed 2026-11-05 | One more rule makes thirteen\n'));
  assert.ok(lessons.validate(text(f), '2026-11-06').some((e) => e.includes('the cap is 12')));
});

test('a rule not reviewed for 180 days fails validation, and review restarts the clock', () => {
  const f = fixture();
  fs.writeFileSync(f.file, text(f).replace('## Rules\n\n_None yet._', '## Rules\n\n- R-aaaaaa | promoted 2026-01-01 | reviewed 2026-01-01 | Cite the source on every slide'));
  assert.deepStrictEqual(lessons.validate(text(f), '2026-06-30'), []);
  assert.ok(lessons.validate(text(f), '2026-07-01').some((e) => e.includes('not reviewed')));
  assert.strictEqual(run(f, ['review', 'R-aaaaaa', '--date', '2026-07-01']).code, 3);
  assert.strictEqual(run(f, ['review', 'R-aaaaaa', ...H, '--date', '2026-07-01']).code, 0);
  assert.deepStrictEqual(lessons.validate(text(f), '2026-07-01'), []);
});

test('expire is automatic: day 90 stays, day 91 goes to the archive', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-01-01']);
  assert.ok(run(f, ['expire', '--date', '2026-04-01']).out.includes('Expired 0.'));
  const r = run(f, ['expire', '--date', '2026-04-02']);
  assert.ok(r.out.includes('Expired 1.'), r.out);
  assert.strictEqual(lessons.parse(text(f)).lessons.length, 0);
  assert.ok(fs.readFileSync(path.join(f.hist, 'expired-lessons.md'), 'utf8').includes('Put the base'));
});

test('validation fails past 90 days, and confirm needs the human and restarts the clock', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-01-01']);
  assert.ok(lessons.validate(text(f), '2026-04-02').some((e) => e.includes('expire')));
  assert.strictEqual(run(f, ['confirm', ID(f), '--date', '2026-04-02']).code, 3);
  assert.strictEqual(run(f, ['confirm', ID(f), ...H, '--date', '2026-04-02']).code, 0);
  assert.deepStrictEqual(lessons.validate(text(f), '2026-04-02'), []);
  assert.strictEqual(run(f, ['confirm', 'L-000000', ...H]).code, 2);
});

test('list shows rules, lessons and time left', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  const r = run(f, ['list', '--date', '2026-11-15']);
  assert.ok(r.out.includes('RULES (0 of 12)') && r.out.includes('LESSONS (1)') && r.out.includes('expires in 80 days'), r.out);
});

test('dedupe only lists candidates until the human confirms, then merges and adds counts', () => {
  const f = fixture();
  fs.writeFileSync(f.file, text(f).replace('## Lessons\n\n_None yet._',
    '## Lessons\n\n- L-aaaaaa | 2026-11-01 | n=1 | confirmed 2026-11-01 | Label the series on the chart itself\n' +
    '- L-bbbbbb | 2026-11-03 | n=1 | confirmed 2026-11-04 | Label each series directly on the chart\n' +
    '- L-cccccc | 2026-11-03 | n=1 | confirmed 2026-11-03 | Cut slides that have no source'));
  const before = text(f);
  const r = run(f, ['dedupe']);
  assert.strictEqual(r.code, 3, r.out);
  assert.ok(r.out.includes('MERGE CANDIDATE: L-aaaaaa L-bbbbbb'), r.out);
  assert.strictEqual(text(f), before);
  assert.ok(run(f, ['dedupe', ...H]).out.includes('Merged 1 duplicates.'));
  const doc = lessons.parse(text(f));
  assert.strictEqual(doc.lessons.length, 2);
  const merged = doc.lessons.find((l) => l.id === 'L-aaaaaa');
  assert.strictEqual(merged.n, 2);
  assert.strictEqual(merged.confirmed, '2026-11-04');
});

test('bad input is refused: pipe, too short, too long, bad date, missing file, unknown command', () => {
  const f = fixture();
  assert.strictEqual(run(f, ['add', 'a | b | c d']).code, 2);
  assert.strictEqual(run(f, ['add', 'too short']).code, 2);
  assert.strictEqual(run(f, ['add', 'word '.repeat(60)]).code, 2);
  assert.strictEqual(run(f, ['add', TEXT, '--date', '2026-02-30']).code, 2);
  assert.strictEqual(h.node(path.join(h.SCRIPTS, 'lessons.js'), ['list', '--file', path.join(f.dir, 'nope.md')]).code, 2);
  assert.strictEqual(run(f, ['frobnicate']).code, 2);
});

test('a malformed lesson or rule line fails validation', () => {
  const seed = fs.readFileSync(path.join(h.ROOT, 'memory/wiki/lessons.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(lessons.validate(seed.replace('## Lessons\n\n_None yet._', '## Lessons\n\n- just some text'), '2026-11-05').some((e) => e.includes('malformed')));
  assert.ok(lessons.validate(seed.replace('## Rules\n\n_None yet._', '## Rules\n\n- R-aaaaaa | promoted 2026-11-05 | text without review'), '2026-11-05').some((e) => e.includes('malformed')));
});

test('every human-confirmed action appends the human\'s words to lessons.history, and the file reconciles', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  const id = ID(f);
  run(f, ['repeat', id, '--human-confirmed', 'yes, same lesson', '--date', '2026-11-06']);
  run(f, ['promote', id, '--human-confirmed', 'approved, make it a rule', '--date', '2026-11-07']);
  run(f, ['review', 'R-' + id.slice(2), '--human-confirmed', 'still true', '--date', '2026-11-08']);
  const lines = hist(f).split('\n').filter((l) => l && !l.startsWith('#'));
  assert.strictEqual(lines.length, 3);
  assert.ok(lines[0].startsWith('2026-11-06 | repeat | ' + id + ' | "yes, same lesson"'), lines[0]);
  assert.ok(lines[1].includes('"approved, make it a rule"') && lines[2].includes('"still true"'));
  assert.deepStrictEqual(lessons.validate(text(f), '2026-11-09', hist(f)), []);
});

test('the flag needs the human\'s words: a bare flag or an empty quote exits 2 and writes nothing', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  const before = text(f);
  assert.strictEqual(run(f, ['repeat', ID(f), '--human-confirmed']).code, 2);
  assert.strictEqual(run(f, ['repeat', ID(f), '--human-confirmed', '']).code, 2);
  assert.strictEqual(run(f, ['repeat', ID(f), '--human-confirmed', 'a | b']).code, 2);
  assert.strictEqual(text(f), before);
  assert.ok(!fs.existsSync(path.join(path.dirname(f.file), 'lessons.history')));
});

test('a lessons file that the history does not support fails reconciliation', () => {
  const f = fixture();
  run(f, ['add', TEXT, '--date', '2026-11-05']);
  const id = ID(f);
  const forged = text(f).replace('n=1', 'n=2');
  assert.ok(lessons.validate(forged, '2026-11-06', '# empty\n').some((e) => e.includes('supports n=1')));
  assert.ok(lessons.validate(text(f), '2026-11-06', '2026-11-06 | repeat | ' + id + ' | yes | n=2\n').some((e) => e.includes('must be quoted')));
  assert.ok(lessons.validate(text(f), '2026-11-06', '2026-11-09 | repeat | ' + id + ' | "yes" | n=2\n').some((e) => e.includes('dated in the future')));
  const rule = text(f).replace('## Rules\n\n_None yet._', '## Rules\n\n- R-' + id.slice(2) + ' | promoted 2026-11-06 | reviewed 2026-11-06 | ' + TEXT);
  assert.ok(lessons.validate(rule, '2026-11-07', '# empty\n').some((e) => e.includes('no human-confirmed promotion')));
});

test('dedupe merges are recorded with the words and the new count', () => {
  const f = fixture();
  fs.writeFileSync(f.file, text(f).replace('## Lessons\n\n_None yet._',
    '## Lessons\n\n- L-aaaaaa | 2026-11-01 | n=1 | confirmed 2026-11-01 | Label the series on the chart itself\n' +
    '- L-bbbbbb | 2026-11-03 | n=1 | confirmed 2026-11-04 | Label each series directly on the chart'));
  run(f, ['dedupe', '--human-confirmed', 'yes, merge them', '--date', '2026-11-10']);
  assert.ok(hist(f).includes('merge | L-aaaaaa | "yes, merge them" | n=2 confirmed 2026-11-04 | absorbed L-bbbbbb'), hist(f));
  assert.deepStrictEqual(lessons.validate(text(f), '2026-11-10', hist(f)).filter((e) => !e.startsWith('WARN')), []);
});

done();
