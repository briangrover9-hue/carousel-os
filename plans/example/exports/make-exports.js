#!/usr/bin/env node
'use strict';
// make-exports: write the three invented exports the worked example cites. Zero dependencies.
//
//   node plans/example/exports/make-exports.js [--check]
//
// Wrenmoor Gyms is invented, and so is every row here. A fixed seed makes the output the same on every run, so
// --check rebuilds the files in memory and exits 1 if a committed file differs from what this script writes.
//
// The files, all for the window of 12 months ending 2026-06-30:
//   visits.csv        member_id,weeks_with_no_visit. One row per member, 23,962 rows. The second field lists, by
//                     the date of its Monday and separated by spaces, each calendar week (Monday to Sunday) with no
//                     visit to any club. Only the 51 weeks that fall wholly inside the window count, from the week of
//                     2025-07-07 to the week of 2026-06-22, and for a member who canceled, only the weeks that end
//                     before the cancellation date. An empty field means the member missed no week.
//   cancellations.csv member_id,canceled_on. One row per cancellation. A member cancels at most once.
//   exit-survey.csv   member_id,reason. One row per member who answered the exit survey, all of them members who
//                     canceled.
//
// Two missed weeks in a row are two listed Mondays seven days apart. A cancellation followed two missed weeks in a
// row when its member has such a pair, which the export lists only before the cancellation date.
// tests/process/example-exports.test.js recomputes every number in the example's ledger from these files.

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const DAY = 86400000;
const FIRST_MONDAY = Date.UTC(2025, 6, 7);   // 2025-07-07
const WEEKS = 51;                            // the last counted week starts 2026-06-22 and ends 2026-06-28
const WINDOW_START = Date.UTC(2025, 6, 1);   // 2025-07-01
const WINDOW_END = Date.UTC(2026, 5, 30);    // 2026-06-30

// Group sizes. Run: missed two weeks in a row at some point. Canceled: in cancellations.csv.
const GROUPS = { runCanceled: 2562, runStayed: 5650, otherCanceled: 1638, otherStayed: 14112 };
const SURVEY = { price: 300, 'moved away': 251, 'schedule changed': 334, 'not using it': 287, 'injury or health': 129, other: 127 };

// mulberry32: a small seeded generator, so the files are the same on every machine
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260630);
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));   // inclusive
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const monday = (w) => FIRST_MONDAY + w * 7 * DAY;
const sunday = (w) => monday(w) + 6 * DAY;

// Add up to n single missed weeks among weeks [0, last], none next to a week already missed.
function addSingles(set, n, last) {
  for (let tries = 0; n > 0 && tries < 200; tries++) {
    const w = int(0, last);
    if (set.has(w) || set.has(w - 1) || set.has(w + 1)) continue;
    set.add(w); n--;
  }
}

function build() {
  const kinds = [];
  Object.entries(GROUPS).forEach(([k, n]) => { for (let i = 0; i < n; i++) kinds.push(k); });
  shuffle(kinds);

  const visits = ['member_id,weeks_with_no_visit'];
  const cancels = [];
  kinds.forEach((kind, i) => {
    const id = 'M' + String(i + 1).padStart(5, '0');
    const missed = new Set();
    let canceledOn = null;
    let last = WEEKS - 1;   // the last week that counts for this member
    if (kind === 'runCanceled') {
      const len = rand() < 0.7 ? 2 : 3;
      const start = int(0, WEEKS - len - 1);
      for (let w = start; w < start + len; w++) missed.add(w);
      const end = sunday(start + len - 1);
      canceledOn = Math.min(end + int(1, 21) * DAY, WINDOW_END);
      last = start + len - 1;
      if (start >= 2) addSingles(missed, int(0, 1), start - 2);
    } else if (kind === 'runStayed') {
      const len = int(2, 4);
      const start = int(0, WEEKS - len);
      for (let w = start; w < start + len; w++) missed.add(w);
      addSingles(missed, int(0, 2), last);
    } else if (kind === 'otherCanceled') {
      canceledOn = WINDOW_START + int(0, (WINDOW_END - WINDOW_START) / DAY) * DAY;
      while (last >= 0 && sunday(last) >= canceledOn) last--;
      if (last >= 0) addSingles(missed, int(0, 2), last);
    } else {
      addSingles(missed, rand() < 0.55 ? 0 : int(1, 2), last);
    }
    visits.push(id + ',' + Array.from(missed).sort((a, b) => a - b).map((w) => iso(monday(w))).join(' '));
    if (canceledOn !== null) cancels.push({ id, on: canceledOn });
  });

  cancels.sort((a, b) => a.on - b.on || (a.id < b.id ? -1 : 1));
  const cancellations = ['member_id,canceled_on'].concat(cancels.map((c) => c.id + ',' + iso(c.on)));

  const reasons = [];
  Object.entries(SURVEY).forEach(([r, n]) => { for (let i = 0; i < n; i++) reasons.push(r); });
  shuffle(reasons);
  const answered = shuffle(cancels.map((c) => c.id)).slice(0, reasons.length).sort();
  const survey = ['member_id,reason'].concat(answered.map((id, i) => id + ',' + reasons[i]));

  const out = (rows) => rows.join('\n') + '\n';
  return { 'visits.csv': out(visits), 'cancellations.csv': out(cancellations), 'exit-survey.csv': out(survey) };
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) { console.log('usage: node plans/example/exports/make-exports.js [--check]'); process.exit(0); }
const files = build();
if (args.includes('--check')) {
  const stale = Object.keys(files).filter((f) => { try { return fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n') !== files[f]; } catch (e) { return true; } });
  stale.forEach((f) => console.error('make-exports: ' + f + ' differs from what the generator writes'));
  console.log(`make-exports: ${Object.keys(files).length - stale.length} of ${Object.keys(files).length} files match`);
  process.exit(stale.length ? 1 : 0);
}
Object.entries(files).forEach(([f, text]) => fs.writeFileSync(path.join(DIR, f), text));
console.log('make-exports: wrote ' + Object.keys(files).join(', '));
