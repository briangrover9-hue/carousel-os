'use strict';
// The worked example's numbers, recomputed from the exports it cites. Every number in
// plans/example/wrenmoor-skip-cancel.ledger.json is computed here from plans/example/exports/*.csv and compared with
// the ledger's printed value, so a change to either side fails. The schema is in plans/example/exports/make-exports.js.
//
// Mutation, recorded so the next reader can repeat it: change the reason on one `price` row of
// plans/example/exports/exit-survey.csv to `other`. The ledger test fails, naming s04: the exports give 299 and 20.9%
// where the ledger says 300 and 21.0%. The generator test fails as well, because the file no longer matches what
// make-exports.js writes. Revert the row (or rerun make-exports.js) and both pass.
const h = require('./harness');
const { assert, fs, path, test, done } = h;

const EX = path.join(h.ROOT, 'plans', 'example');
const DIR = path.join(EX, 'exports');
const DAY = 86400000;

function csv(name) {
  const lines = fs.readFileSync(path.join(DIR, name), 'utf8').replace(/\r\n/g, '\n').split('\n').filter((l) => l !== '');
  const head = lines.shift().split(',');
  return lines.map((l) => {
    const cells = l.split(',');
    assert.strictEqual(cells.length, head.length, `${name}: a row has ${cells.length} fields, the header has ${head.length}: ${l}`);
    const row = {};
    head.forEach((k, i) => { row[k] = cells[i]; });
    return row;
  });
}
const ms = (d) => Date.parse(d + 'T00:00:00Z');
const count = (n) => n.toLocaleString('en-US');
const pct0 = (a, b) => Math.round((a / b) * 100) + '%';
const pct1 = (a, b) => ((a / b) * 100).toFixed(1) + '%';

// Recompute every figure from the three files, as the plan's Brief and the ledger's sources describe.
function recompute() {
  const visits = csv('visits.csv');
  const cancels = csv('cancellations.csv');
  const survey = csv('exit-survey.csv');

  const members = new Map();
  visits.forEach((r) => {
    assert.ok(!members.has(r.member_id), 'visits.csv lists ' + r.member_id + ' twice');
    members.set(r.member_id, r.weeks_with_no_visit ? r.weeks_with_no_visit.split(' ').map(ms) : []);
  });
  const canceled = new Map();
  cancels.forEach((r) => {
    assert.ok(members.has(r.member_id), 'cancellations.csv names ' + r.member_id + ', who is not in visits.csv');
    assert.ok(!canceled.has(r.member_id), r.member_id + ' cancels twice, and the Brief counts each member once');
    canceled.set(r.member_id, ms(r.canceled_on));
  });
  // The Monday of the second week of the earliest two missed weeks in a row, or null.
  const runEnd = (weeks) => {
    for (let i = 1; i < weeks.length; i++) {
      assert.strictEqual(new Date(weeks[i]).getUTCDay(), 1, 'a missed week is not listed by its Monday');
      if (weeks[i] - weeks[i - 1] === 7 * DAY) return weeks[i];
    }
    return null;
  };
  let run = 0; let runCanceled = 0; let afterRun = 0; let otherCanceled = 0;
  members.forEach((weeks, id) => {
    const end = runEnd(weeks);
    if (end !== null) run++;
    if (!canceled.has(id)) return;
    weeks.forEach((w) => assert.ok(w + 6 * DAY < canceled.get(id), id + ' has a missed week listed after canceling'));
    if (end === null) { otherCanceled++; return; }
    runCanceled++;
    if (end + 6 * DAY < canceled.get(id)) afterRun++;   // the pair's second Sunday falls before the cancellation
  });
  const answered = new Set();
  survey.forEach((r) => {
    assert.ok(canceled.has(r.member_id), 'exit-survey.csv names ' + r.member_id + ', who did not cancel');
    assert.ok(!answered.has(r.member_id), r.member_id + ' answered the survey twice');
    answered.add(r.member_id);
  });
  const price = survey.filter((r) => r.reason === 'price').length;
  return { members: members.size, run, others: members.size - run, cancels: canceled.size, runCanceled, afterRun, otherCanceled, answered: survey.length, price };
}

let c = null;
test('the three exports parse, and every member, cancellation and answer is consistent across them', () => { c = recompute(); });
if (!c) done();
const ledger = JSON.parse(fs.readFileSync(path.join(EX, 'wrenmoor-skip-cancel.ledger.json'), 'utf8'));
const rate31 = pct1(c.runCanceled, c.run);
const rate10 = pct1(c.otherCanceled, c.others);

// What each slide's numbers are, in the ledger's order, computed from the exports.
const want = {
  s01: [],
  s02: [count(c.afterRun), count(c.cancels), pct0(c.afterRun, c.cancels)],
  s03: [count(c.runCanceled), count(c.run), rate31, count(c.otherCanceled), count(c.others), rate10, Math.round(parseFloat(rate31) / parseFloat(rate10)) + 'x'],
  s04: [count(c.price), count(c.answered), pct1(c.price, c.answered), pct0(c.answered, c.cancels), count(c.cancels)],
  s05: [count(c.afterRun)],
  s06: [],
};

test('every ledger number for the worked example matches the exports it cites', () => {
  const ids = ledger.slides.map((s) => s.id);
  assert.deepStrictEqual(ids, Object.keys(want), 'the ledger slides changed; update this test with them');
  ledger.slides.forEach((s) => {
    const got = s.numbers.map((n) => n.value);
    assert.deepStrictEqual(want[s.id], got, `${s.id}: the exports give ${JSON.stringify(want[s.id])} and the ledger says ${JSON.stringify(got)}`);
  });
});

test('the counts the Brief and Review state outside the ledger also match the exports', () => {
  assert.strictEqual(count(c.members), '23,962', 'the member base');
  assert.strictEqual(c.run + c.others, c.members);
  assert.strictEqual(c.runCanceled, c.afterRun, 'every run member who canceled did so after the run, so s02 and s03 count the same people');
  assert.strictEqual(c.afterRun + c.otherCanceled, c.cancels, 'the two groups of cancellations add to the total');
  assert.strictEqual(pct1(c.cancels, c.members), '17.5%', 'the overall rate in the Review');
  const ratio = (c.runCanceled / c.run) / (c.otherCanceled / c.others);
  assert.strictEqual(ratio.toFixed(1), '3.0', 'the unrounded ratio of the two rates');
});

test('the plan and ledger cite the three exports, and the generator rebuilds them byte for byte', () => {
  const plan = fs.readFileSync(path.join(EX, 'wrenmoor-skip-cancel.md'), 'utf8');
  ['visits.csv', 'cancellations.csv', 'exit-survey.csv'].forEach((f) => {
    assert.ok(fs.existsSync(path.join(DIR, f)), 'plans/example/exports/' + f + ' is missing');
    assert.ok(plan.includes('exports/' + f), 'the plan does not cite exports/' + f);
  });
  const r = h.node(path.join(DIR, 'make-exports.js'), ['--check']);
  assert.strictEqual(r.code, 0, r.out);
});

done();
