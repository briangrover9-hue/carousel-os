#!/usr/bin/env node
'use strict';
// rotate-log: move log entries older than the current ISO week into memory/history/YYYY-Www.md.
//
//   node scripts/rotate-log.js [--log memory/LOG.md] [--history memory/history]
//                              [--today YYYY-MM-DD] [--dry-run]
//
// An entry starts at a heading "## YYYY-MM-DD <slug>". The date in the heading is the only date
// used. A "## " heading that cannot be dated (no date, or a date that does not exist) makes the
// script refuse to run and change nothing. Weeks are ISO weeks, and the week-year is the ISO
// year, so 2024-12-30 belongs to 2025-W01 and 2027-01-01 belongs to 2026-W53.

const fs = require('fs');
const path = require('path');

const HEADING = /^## (\d{4})-(\d{2})-(\d{2})(?:[ \t]+\S.*)?[ \t]*$/;

function parseDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function parseIsoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  return parseDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

function isoWeek(dt) {
  const d = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Monday is 1, Sunday is 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // move to the Thursday of this ISO week
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return { year, week };
}

function weekKey(w) {
  return `${w.year}-W${String(w.week).padStart(2, '0')}`;
}

function ymd(dt) {
  return dt.toISOString().slice(0, 10);
}

// Split a log into its preamble and entries. Throws on a "## " heading that cannot be dated.
function parseLog(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const preamble = [];
  const entries = [];
  let current = null;
  lines.forEach((line, i) => {
    if (line.startsWith('## ')) {
      const m = HEADING.exec(line);
      const dt = m ? parseDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
      if (!dt) {
        const err = new Error(`undatable heading at line ${i + 1}: "${line}"`);
        err.line = i + 1;
        throw err;
      }
      current = { date: ymd(dt), heading: line, lines: [line], line: i + 1 };
      entries.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  });
  return {
    preamble: preamble.join('\n').replace(/\s+$/, ''),
    entries: entries.map((e) => ({ date: e.date, heading: e.heading, line: e.line, text: e.lines.join('\n').replace(/\s+$/, '') })),
  };
}

function renderLog(preamble, entries) {
  const parts = [preamble].concat(entries.map((e) => e.text));
  return parts.filter((p) => p !== '').join('\n\n') + '\n';
}

// Decide what moves. Returns the log text to keep and the entries to move, grouped by week key.
function rotate(text, today) {
  const parsed = parseLog(text);
  const current = weekKey(isoWeek(today));
  const keep = [];
  const moves = new Map();
  parsed.entries.forEach((e) => {
    const key = weekKey(isoWeek(parseIsoDate(e.date)));
    if (key < current) {
      if (!moves.has(key)) moves.set(key, []);
      moves.get(key).push(e);
    } else {
      keep.push(e);
    }
  });
  let moved = 0;
  moves.forEach((v) => { moved += v.length; });
  return { kept: renderLog(parsed.preamble, keep), moves, moved };
}

// Merge moved entries into an existing history file's text, newest first, skipping exact duplicates.
function mergeHistory(existingText, key, newEntries) {
  let existing = [];
  if (existingText) {
    const body = existingText.replace(/^# History[^\n]*\n/, '');
    existing = parseLog(body).entries;
  }
  const seen = new Set(existing.map((e) => e.text));
  const all = existing.slice();
  newEntries.forEach((e) => {
    if (!seen.has(e.text)) { all.push(e); seen.add(e.text); }
  });
  const indexed = all.map((e, i) => ({ e, i }));
  indexed.sort((a, b) => (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : a.i - b.i));
  return `# History ${key}\n\n` + indexed.map((x) => x.e.text).join('\n\n') + '\n';
}

function checkLogText(text) {
  const errors = [];
  let parsed;
  try {
    parsed = parseLog(text);
  } catch (e) {
    return [e.message];
  }
  for (let i = 1; i < parsed.entries.length; i++) {
    if (parsed.entries[i].date > parsed.entries[i - 1].date) {
      errors.push(`entries are not newest first: ${parsed.entries[i].date} (line ${parsed.entries[i].line}) follows ${parsed.entries[i - 1].date}`);
    }
  }
  return errors;
}

function localToday() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

const HELP = [
  'rotate-log: move log entries older than the current ISO week into memory/history/YYYY-Www.md.',
  '  node scripts/rotate-log.js [--log memory/LOG.md] [--history memory/history] [--today YYYY-MM-DD] [--dry-run]',
  'An entry starts at "## YYYY-MM-DD <slug>". A "## " heading that cannot be dated stops the run and changes nothing.',
  'Exit 0 on success, 2 on a bad argument, a missing log or an undatable heading.',
].join('\n');

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); return 0; }
  const opts = { log: 'memory/LOG.md', history: 'memory/history', today: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--log') opts.log = argv[++i];
    else if (a === '--history') opts.history = argv[++i];
    else if (a === '--today') opts.today = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else { console.error(`rotate-log: unknown argument ${a}`); return 2; }
  }
  let today = localToday();
  if (opts.today !== null) {
    today = parseIsoDate(opts.today);
    if (!today) { console.error(`rotate-log: --today wants a real date as YYYY-MM-DD, got "${opts.today}"`); return 2; }
  }
  if (!fs.existsSync(opts.log)) { console.error(`rotate-log: ${opts.log} does not exist`); return 2; }
  let result;
  try {
    result = rotate(fs.readFileSync(opts.log, 'utf8'), today);
  } catch (e) {
    console.error(`rotate-log: refusing to run, ${e.message} in ${opts.log}. Nothing was changed.`);
    return 2;
  }
  if (result.moved === 0) {
    console.log('Rotated 0 entries into 0 files.');
    return 0;
  }
  if (opts.dryRun) {
    console.log(`Dry run: would rotate ${result.moved} entries into ${result.moves.size} files.`);
    return 0;
  }
  fs.mkdirSync(opts.history, { recursive: true });
  result.moves.forEach((entries, key) => {
    const file = path.join(opts.history, `${key}.md`);
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    fs.writeFileSync(file, mergeHistory(existing, key, entries));
  });
  fs.writeFileSync(opts.log, result.kept);
  console.log(`Rotated ${result.moved} entries into ${result.moves.size} files.`);
  return 0;
}

module.exports = { parseDate, parseIsoDate, isoWeek, weekKey, parseLog, rotate, mergeHistory, checkLogText, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
