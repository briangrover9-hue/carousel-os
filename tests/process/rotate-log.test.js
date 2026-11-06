'use strict';
const h = require('./harness');
const { assert, fs, path, test, done } = h;
const rotate = require(path.join(h.SCRIPTS, 'rotate-log.js'));

const wk = (s) => rotate.weekKey(rotate.isoWeek(rotate.parseIsoDate(s)));

test('ISO week and year edge cases', () => {
  const cases = {
    '2024-12-30': '2025-W01', '2024-12-29': '2024-W52', '2025-12-29': '2026-W01',
    '2026-12-31': '2026-W53', '2027-01-01': '2026-W53', '2027-01-03': '2026-W53', '2027-01-04': '2027-W01',
    '2021-01-03': '2020-W53', '2020-12-31': '2020-W53', '2023-01-01': '2022-W52',
    '2024-01-01': '2024-W01', '2019-12-30': '2020-W01', '2026-11-05': '2026-W45',
  };
  Object.keys(cases).forEach((d) => assert.strictEqual(wk(d), cases[d], d));
});

test('a date that does not exist is rejected', () => {
  assert.strictEqual(rotate.parseIsoDate('2026-02-30'), null);
  assert.strictEqual(rotate.parseIsoDate('2026-13-01'), null);
  assert.ok(rotate.parseIsoDate('2024-02-29'));
});

function fixture(entries, preamble) {
  const dir = h.tmpDir();
  const log = path.join(dir, 'LOG.md');
  fs.writeFileSync(log, (preamble || '# Log\n\nNewest first.') + '\n\n' + entries.join('\n\n') + '\n');
  return { dir, log, hist: path.join(dir, 'history') };
}
const run = (f, today, extra) => h.node(path.join(h.SCRIPTS, 'rotate-log.js'), ['--log', f.log, '--history', f.hist, '--today', today].concat(extra || []));

test('moves entries older than the current ISO week and keeps the rest', () => {
  const f = fixture(['## 2026-11-05 now\n\nCurrent week.', '## 2026-10-20 old\n\nOld one.', '## 2026-10-19 older\n\nOlder one.']);
  const r = run(f, '2026-11-05');
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(r.out.includes('Rotated 2 entries into 1 files.'), r.out);
  const log = fs.readFileSync(f.log, 'utf8');
  assert.ok(log.includes('Current week.') && !log.includes('Old one.') && log.startsWith('# Log'));
  const hist = fs.readFileSync(path.join(f.hist, '2026-W43.md'), 'utf8');
  assert.ok(hist.startsWith('# History 2026-W43') && hist.indexOf('Old one.') < hist.indexOf('Older one.'));
});

test('ISO-year edge: 2026-12-31 and 2027-01-01 share 2026-W53, and 2027-01-04 stays', () => {
  const f = fixture(['## 2027-01-04 monday\n\nNew year.', '## 2027-01-01 friday\n\nB.', '## 2026-12-31 thursday\n\nA.']);
  const r = run(f, '2027-01-04');
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(fs.existsSync(path.join(f.hist, '2026-W53.md')));
  assert.deepStrictEqual(fs.readdirSync(f.hist), ['2026-W53.md']);
  assert.ok(fs.readFileSync(f.log, 'utf8').includes('New year.'));
});

test('ISO-year edge: 2024-12-30 sits in 2025-W01 so it stays on 2025-01-02, while 2024-12-29 moves', () => {
  const f = fixture(['## 2024-12-30 a\n\nStays.', '## 2024-12-29 b\n\nMoves.']);
  const r = run(f, '2025-01-02');
  assert.strictEqual(r.code, 0, r.out);
  assert.deepStrictEqual(fs.readdirSync(f.hist), ['2024-W52.md']);
  assert.ok(fs.readFileSync(f.log, 'utf8').includes('Stays.'));
});

test('refuses a heading it cannot date and changes nothing', () => {
  ['## Notes\n\nNo date.', '## 2026-02-30 slug\n\nNo such day.', '## 2026-11-02slug\n\nNo space.'].forEach((bad) => {
    const f = fixture(['## 2026-10-01 old\n\nOld.', bad]);
    const before = fs.readFileSync(f.log, 'utf8');
    const r = run(f, '2026-11-05');
    assert.strictEqual(r.code, 2, r.out);
    assert.ok(r.out.includes('refusing to run'), r.out);
    assert.strictEqual(fs.readFileSync(f.log, 'utf8'), before);
    assert.ok(!fs.existsSync(f.hist));
  });
});

test('merges into an existing history file and is safe to run twice', () => {
  const f = fixture(['## 2026-10-21 later\n\nLater.']);
  fs.mkdirSync(f.hist);
  fs.writeFileSync(path.join(f.hist, '2026-W43.md'), '# History 2026-W43\n\n## 2026-10-20 earlier\n\nEarlier.\n');
  assert.strictEqual(run(f, '2026-11-05').code, 0);
  const hist = fs.readFileSync(path.join(f.hist, '2026-W43.md'), 'utf8');
  assert.ok(hist.indexOf('Later.') < hist.indexOf('Earlier.'));
  const again = run(f, '2026-11-05');
  assert.ok(again.out.includes('Rotated 0 entries into 0 files.'), again.out);
  assert.strictEqual(fs.readFileSync(path.join(f.hist, '2026-W43.md'), 'utf8'), hist);
});

test('a duplicate entry already in history is not written twice', () => {
  const f = fixture(['## 2026-10-20 same\n\nSame text.']);
  fs.mkdirSync(f.hist);
  fs.writeFileSync(path.join(f.hist, '2026-W43.md'), '# History 2026-W43\n\n## 2026-10-20 same\n\nSame text.\n');
  assert.strictEqual(run(f, '2026-11-05').code, 0);
  const hist = fs.readFileSync(path.join(f.hist, '2026-W43.md'), 'utf8');
  assert.strictEqual(hist.split('Same text.').length - 1, 1);
});

test('--dry-run writes nothing', () => {
  const f = fixture(['## 2026-10-20 old\n\nOld.']);
  const before = fs.readFileSync(f.log, 'utf8');
  const r = run(f, '2026-11-05', ['--dry-run']);
  assert.ok(r.out.includes('Dry run'), r.out);
  assert.strictEqual(fs.readFileSync(f.log, 'utf8'), before);
  assert.ok(!fs.existsSync(f.hist));
});

test('bad --today and a missing log both exit 2', () => {
  const f = fixture(['## 2026-10-20 old\n\nOld.']);
  assert.strictEqual(run(f, '2026-02-30').code, 2);
  fs.unlinkSync(f.log);
  assert.strictEqual(run(f, '2026-11-05').code, 2);
});

test('checkLogText flags an entry that is not newest first', () => {
  assert.deepStrictEqual(rotate.checkLogText('# Log\n\n## 2026-11-05 a\n\nx\n\n## 2026-11-01 b\n\ny\n'), []);
  assert.strictEqual(rotate.checkLogText('# Log\n\n## 2026-11-01 a\n\nx\n\n## 2026-11-05 b\n\ny\n').length, 1);
  assert.strictEqual(rotate.checkLogText('# Log\n\n## Today\n\nx\n').length, 1);
});

test('--help prints usage and exits 0', () => {
  const r = h.node(path.join(h.SCRIPTS, 'rotate-log.js'), ['--help']);
  assert.strictEqual(r.code, 0);
  assert.ok(r.out.includes('--dry-run'), r.out);
});

done();
