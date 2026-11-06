'use strict';
const h = require('./harness');
const { assert, fs, path, test, done } = h;
const cp = require(path.join(h.SCRIPTS, 'check-process.js'));

const good = () => JSON.parse(fs.readFileSync(path.join(h.ROOT, 'plans/example/fernway-skip-cancel.ledger.json'), 'utf8'));
const finalErrs = (o) => cp.validateLedger(o, { final: true });

test('the worked example ledger passes the final gate', () => {
  assert.deepStrictEqual(finalErrs(good()), []);
});

test('the template validates in template mode', () => {
  const t = JSON.parse(fs.readFileSync(path.join(h.ROOT, 'plans/ledger.template.json'), 'utf8'));
  assert.deepStrictEqual(cp.validateLedger(t, { template: true }), []);
});

test('checked without a named check fails', () => {
  const o = good(); o.slides[1].check = '';
  assert.ok(cp.validateLedger(o).some((e) => e.includes('named check')));
});

test('check text that says nothing is refused: verified, looks right, too short, no action', () => {
  ['verified', 'Looks right to me and we have verified every figure twice', 'looks good', 'recounted it', 'the figures were fine and nothing seemed off here'].forEach((t) => {
    const o = good(); o.slides[1].check = t;
    assert.ok(cp.validateLedger(o).some((e) => e.startsWith('slide s02:')), `should refuse: ${t}`);
  });
  assert.strictEqual(cp.checkTextProblem('recounted both figures from the two files and divided, 0.61'), null);
});

test('checked_on must be a real date', () => {
  ['2026-02-30', '2026-13-01', 'yesterday', '', null].forEach((d) => {
    const o = good(); o.slides[1].checked_on = d;
    assert.ok(cp.validateLedger(o).some((e) => e.includes('not a real date')), String(d));
  });
});

test('checked with an unreconciled number fails, even outside final mode', () => {
  const o = good(); o.slides[2].numbers[1].reconciled = false;
  assert.ok(cp.validateLedger(o).some((e) => e.includes('unreconciled')));
});

test('a number with no source fails', () => {
  const o = good(); o.slides[1].numbers[0].source = '';
  assert.ok(cp.validateLedger(o).some((e) => e.includes('no source')));
});

test('an open row passes normally and fails the final gate', () => {
  const o = good(); o.slides[1].status = 'open'; o.slides[1].check = null; o.slides[1].checked_on = null;
  assert.deepStrictEqual(cp.validateLedger(o), []);
  assert.ok(finalErrs(o).some((e) => e.includes('not checked')));
});

test('a rejected row needs a note, and fails the final gate', () => {
  const o = good(); o.slides[1].status = 'rejected';
  assert.ok(cp.validateLedger(o).some((e) => e.includes('without a note')));
  o.slides[1].note = 'number did not recompute';
  assert.deepStrictEqual(cp.validateLedger(o), []);
  assert.ok(finalErrs(o).length > 0);
});

test('a numbered slide with a different window fails the final gate', () => {
  const o = good(); o.slides[2].window = '26 weeks ending 2026-06-28';
  assert.ok(finalErrs(o).some((e) => e.includes('differs from the deck window')));
});

test('a framing slide may not carry numbers; a duplicate id fails; bad status fails', () => {
  let o = good(); o.slides[0].numbers = [{ value: '1', source: 'x', reconciled: true }];
  assert.ok(cp.validateLedger(o).some((e) => e.includes('framing')));
  o = good(); o.slides[1].id = 's01';
  assert.ok(cp.validateLedger(o).some((e) => e.includes('duplicate')));
  o = good(); o.slides[1].status = 'done';
  assert.ok(cp.validateLedger(o).some((e) => e.includes('status must be')));
});

test('CLI: --final exits 0 on the example and 1 on an open row; summary line is printed', () => {
  const ex = path.join(h.ROOT, 'plans/example/fernway-skip-cancel.ledger.json');
  const r = h.node(path.join(h.SCRIPTS, 'check-process.js'), ['--ledger', ex, '--final']);
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(r.out.includes('Ledger: 6 slides, 6 checked, 0 open, 0 rejected, 0 unreconciled numbers'), r.out);
  const o = good(); o.slides[3].status = 'open'; o.slides[3].check = null;
  const bad = path.join(h.tmpDir(), 'bad.ledger.json');
  fs.writeFileSync(bad, JSON.stringify(o));
  const r2 = h.node(path.join(h.SCRIPTS, 'check-process.js'), ['--ledger', bad, '--final']);
  assert.strictEqual(r2.code, 1, r2.out);
  assert.ok(r2.out.includes('FAIL ledger'), r2.out);
});

test('CLI: --ledger-md prints a pipe table with a Slide column and a VERIFIED stamp', () => {
  const ex = path.join(h.ROOT, 'plans/example/fernway-skip-cancel.ledger.json');
  const r = h.node(path.join(h.SCRIPTS, 'check-process.js'), ['--ledger-md', ex]);
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(r.out.startsWith('| Slide | Claim |') && /VERIFIED agent; .+; 2026-07-06/.test(r.out), r.out);
});

test('reportRegex turns placeholders into patterns', () => {
  const re = cp.reportRegex('Build report: <N> slides built, <M> ledger rows checked, <K> deviations logged.');
  assert.ok(re.test('Build report: 6 slides built, 6 ledger rows checked, 2 deviations logged.'));
  assert.ok(!re.test('Build report: six slides built, 6 ledger rows checked, 2 deviations logged.'));
});

test('handoff validator: empty sentence, full form and failures', () => {
  assert.deepStrictEqual(cp.validateHandoff('# Handoff\n\nNothing to hand off this time.\n'), []);
  const full = fs.readFileSync(path.join(h.ROOT, 'memory/handoff.template.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.deepStrictEqual(cp.validateHandoff(full), []);
  assert.ok(cp.validateHandoff(full.replace('- <Second bullet, if needed.>', '- b\n- c\n- d\n- e\n- f')).some((e) => e.includes('limit is 5')));
  assert.ok(cp.validateHandoff(full.replace('Start with carousel-start.\n', '')).length > 0);
  assert.ok(cp.validateHandoff(full.replace('Out of scope:\n- <What the next session should leave alone.>', '')).length > 0);
  assert.ok(cp.validateHandoff(full.replace('Recommended focus: <exactly one line>', 'Recommended focus:')).length > 0);
  assert.ok(cp.validateHandoff('# Handoff\n\nNothing to hand off this time. Maybe.\n').length > 0);
});

test('checked_on may not be later than today or earlier than the window end', () => {
  const o = good();
  assert.deepStrictEqual(cp.validateLedger(o, { today: '2026-07-06' }), []);
  assert.ok(cp.validateLedger(o, { today: '2026-07-05' }).some((e) => e.includes('later than today')));
  o.slides[1].checked_on = '2026-06-27';
  assert.ok(cp.validateLedger(o, { today: '2026-12-01' }).some((e) => e.includes('earlier than the window end (2026-06-28)')));
});

test('the action word test uses word boundaries', () => {
  assert.ok(cp.checkTextProblem('the dividends sat unchanged from last week') !== null);
  assert.ok(cp.checkTextProblem('the grandstand figures stayed as printed before') !== null);
  assert.strictEqual(cp.checkTextProblem('we ran the query again and the figure matches'), null);
});

test('number phrases: ratio words are found, and words on a number are checked against it', () => {
  assert.deepStrictEqual(cp.ratioPhrases('Six in ten left, three times as often, half of all, double skippers'), ['six in ten', 'three times', 'half']);
  const o = good();
  o.slides[1].numbers[2].words = ['six in ten'];
  assert.deepStrictEqual(cp.validateLedger(o, { today: '2026-12-01' }), []);
  o.slides[1].numbers[2].words = ['two in ten'];
  assert.ok(cp.validateLedger(o, { today: '2026-12-01' }).some((e) => e.includes('says 20% but the ledger says 61%')));
  o.slides[1].numbers[2].words = 'six in ten';
  assert.ok(cp.validateLedger(o, { today: '2026-12-01' }).some((e) => e.includes('words must be a list')));
});

done();
