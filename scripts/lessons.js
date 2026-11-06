#!/usr/bin/env node
'use strict';
// lessons: keep memory/wiki/lessons.md. Zero dependencies.
//
//   node scripts/lessons.js add "<one line>" [--new] [--date YYYY-MM-DD]
//   node scripts/lessons.js list [--date YYYY-MM-DD]
//   node scripts/lessons.js repeat <id> --human-confirmed "<the human's words>"
//   node scripts/lessons.js confirm <id> --human-confirmed "<words>"
//   node scripts/lessons.js promote [<id> --human-confirmed "<words>"]
//   node scripts/lessons.js review <rule id> --human-confirmed "<words>"
//   node scripts/lessons.js retire <rule id> --human-confirmed "<words>"
//   node scripts/lessons.js expire [--date YYYY-MM-DD]
//   node scripts/lessons.js dedupe [--human-confirmed "<words>"]
//
// Options for any command: --file <path> (default memory/wiki/lessons.md), --archive <path>,
// --history <path> (default lessons.history beside the file).
//
// Anything that changes what counts as a repeat, a rule or a kept lesson needs --human-confirmed
// with the human's own words in quotes. Every such action is appended to lessons.history, and
// check-process reconciles the lessons file against that history. The flag is self-attested: this
// script cannot tell a human from an agent typing it, so the history exists for a person to read.
// Exit 3 means "ask the human first". Expiry is automatic because it needs no judgment.
//
// File format:
//   ## Rules
//   - R-3fa91c | promoted 2026-11-05 | reviewed 2026-11-05 | text
//   ## Lessons
//   - L-3fa91c | 2026-11-05 | n=1 | confirmed 2026-11-05 | text

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXPIRY_DAYS = 90;
const MAX_RULES = 12;
const RULE_REVIEW_DAYS = 180;
const PROMOTE_GRACE_DAYS = 14;
const SIMILARITY = 0.7;
const MAX_LEN = 240;
const MIN_WORDS = 3;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LESSON_LINE = /^- (L-[0-9a-f]{6}) \| (\d{4}-\d{2}-\d{2}) \| n=(\d+) \| confirmed (\d{4}-\d{2}-\d{2}) \| (.+)$/;
const RULE_LINE = /^- (R-[0-9a-f]{6}) \| promoted (\d{4}-\d{2}-\d{2}) \| reviewed (\d{4}-\d{2}-\d{2}) \| (.+)$/;
const NONE = '_None yet._';

// ---------------------------------------------------------------- dates

function validDate(s) {
  if (!DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function daysBetween(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

function localToday() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

// ---------------------------------------------------------------- what counts as the same lesson

const STOP = new Set(['a', 'an', 'the', 'on', 'in', 'of', 'to', 'itself', 'always', 'please', 'make', 'sure', 'you', 'we',
  'it', 'is', 'are', 'be', 'that', 'this', 'for', 'with', 'at', 'as', 'and', 'or', 'directly', 'just', 'then']);
const NEGATIONS = new Set(['never', 'not', 'no', 'dont', 'doesnt', 'stop', 'avoid', 'without', 'cannot', 'cant', 'nothing',
  'none', 'isnt', 'arent', 'wont', 'shouldnt']);
const SYNONYMS = {
  each: 'every', all: 'every', next: 'beside', beside: 'beside', alongside: 'beside', near: 'beside', adjacent: 'beside',
  display: 'show', put: 'show', place: 'show', print: 'show', write: 'show', percent: 'percentage', pct: 'percentage',
};
const ANTONYMS = [['add', 'remove'], ['add', 'cut'], ['add', 'delete'], ['keep', 'cut'], ['keep', 'drop'], ['include', 'omit'],
  ['include', 'exclude'], ['before', 'after'], ['more', 'fewer'], ['more', 'less'], ['larger', 'smaller'], ['increase', 'decrease'],
  ['first', 'last'], ['open', 'close'], ['show', 'hide'], ['show', 'remove'], ['show', 'cut'], ['show', 'drop'], ['show', 'delete'],
  ['widest', 'narrowest'], ['wide', 'narrow'], ['long', 'short'], ['same', 'different'], ['one', 'many'], ['over', 'under'],
  ['before', 'after'], ['early', 'late'], ['ask', 'assume'], ['cite', 'omit'], ['above', 'below'], ['left', 'right'], ['top', 'bottom'],
  ['default', 'custom'], ['dark', 'light'], ['biggest', 'smallest'], ['largest', 'smallest'], ['big', 'small'], ['high', 'low'],
  ['up', 'down'], ['start', 'end'], ['begin', 'end'], ['inside', 'outside'], ['whole', 'decimal'], ['bold', 'plain'], ['full', 'empty'],
  ['internal', 'external'], ['public', 'private'], ['single', 'multiple'], ['fewer', 'more'], ['lead', 'trail']];

function stem(w) {
  if (w.length > 4 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function words(text) {
  return text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

function normalize(text) {
  return words(text).join(' ');
}

function canon(text) {
  const out = [];
  let negations = 0;
  words(text).forEach((raw) => {
    if (NEGATIONS.has(raw)) { negations++; return; }
    let w = SYNONYMS[raw] || SYNONYMS[stem(raw)] || stem(raw);
    w = SYNONYMS[w] || w;
    if (!STOP.has(raw) && !STOP.has(w)) out.push(w);
  });
  return { tokens: new Set(out), negations, sequence: out };
}

// Words whose meaning depends on which thing comes first: "answer before evidence" is not "evidence before answer".
const ORDER_WORDS = new Set(['before', 'after', 'above', 'below', 'left', 'right', 'over', 'under', 'first', 'last', 'then', 'top', 'bottom', 'lead']);

function lcsRatio(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return a.length && b.length ? dp[a.length][b.length] / Math.max(a.length, b.length) : 1;
}

function opposite(a, b) {
  return ANTONYMS.some(([p, q]) => {
    const aP = a.has(p); const aQ = a.has(q); const bP = b.has(p); const bQ = b.has(q);
    return (aP && !aQ && bQ && !bP) || (aQ && !aP && bP && !bQ);
  });
}

// Same lesson: the same wording, or a paraphrase with the same direction. A flipped instruction
// (never against always, add against remove) is a different lesson, however many words it shares.
function similar(a, b) {
  if (normalize(a) === normalize(b)) return true;
  const ca = canon(a);
  const cb = canon(b);
  if (ca.negations % 2 !== cb.negations % 2) return false;
  if (opposite(ca.tokens, cb.tokens)) return false;
  const ordered = ca.sequence.some((t) => ORDER_WORDS.has(t)) || cb.sequence.some((t) => ORDER_WORDS.has(t));
  if (ordered && lcsRatio(ca.sequence, cb.sequence) < 0.8) return false;
  let inter = 0;
  ca.tokens.forEach((t) => { if (cb.tokens.has(t)) inter++; });
  const union = ca.tokens.size + cb.tokens.size - inter;
  return union > 0 && inter / union >= SIMILARITY;
}

function textHash(text) {
  return crypto.createHash('sha1').update(normalize(text)).digest('hex').slice(0, 12);
}

// An id is the first six hex digits of the text hash, with a salt of "#2", "#3" and so on when two lessons collide.
function idMatches(prefix, id, text) {
  for (const salt of ['', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9']) {
    if (id === `${prefix}-${crypto.createHash('sha1').update(normalize(text) + salt).digest('hex').slice(0, 6)}`) return true;
  }
  return false;
}

function idFor(prefix, text, taken) {
  let salt = '';
  for (let i = 2; ; i++) {
    const id = `${prefix}-${crypto.createHash('sha1').update(normalize(text) + salt).digest('hex').slice(0, 6)}`;
    if (!taken || !taken.has(id)) return id;
    salt = '#' + i;
  }
}

// ---------------------------------------------------------------- history

const ACTIONS = ['repeat', 'confirm', 'promote', 'review', 'retire', 'merge', 'drop'];
const HISTORY_HEADER = '# Append-only. One line per human-confirmed action: date | action | id | "the human\'s words" | detail\n';

function parseHistory(text) {
  const entries = [];
  const errors = [];
  (text || '').replace(/\r\n/g, '\n').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split(' | ');
    if (parts.length < 4) { errors.push(`line ${i + 1}: needs date | action | id | "words" | detail`); return; }
    const [date, action, id, quote] = parts;
    const detail = parts.slice(4).join(' | ');
    if (!validDate(date)) errors.push(`line ${i + 1}: "${date}" is not a real date`);
    else if (!ACTIONS.includes(action)) errors.push(`line ${i + 1}: unknown action "${action}"`);
    else if (!/^"[^"]+"$/.test(quote)) errors.push(`line ${i + 1}: the human's words must be quoted and not empty`);
    else entries.push({ date, action, id, quote, detail, n: i + 1 });
  });
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].date < entries[i - 1].date) errors.push(`line ${entries[i].n}: dates must not go backwards (append-only)`);
  }
  return { entries, errors };
}

// Replay the history and compare what it says with what the lessons file says.
// archiveIds: ids found in the expired-lessons and retired-rules archives.
function reconcile(doc, entries, archiveIds) {
  const errors = [];
  const archive = new Set(archiveIds || []);
  const stateAt = (id, upTo) => {
    let n = 1;
    for (let i = 0; i < upTo; i++) {
      const e = entries[i];
      if (e.id !== id) continue;
      if (e.action === 'repeat') n += 1;
      else if (e.action === 'merge') { const m = /n=(\d+) confirmed/.exec(e.detail); if (m) n = Number(m[1]); }
    }
    return n;
  };
  doc.lessons.forEach((l) => {
    if (!idMatches('L', l.id, l.text)) errors.push(`${l.id}: the id does not match the lesson text (an id is a hash of the text)`);
    let n = 1;
    let confirmed = l.date;
    entries.filter((e) => e.id === l.id).forEach((e) => {
      if (e.action === 'repeat') { n += 1; confirmed = e.date; }
      else if (e.action === 'confirm') confirmed = e.date;
      else if (e.action === 'merge') {
        const m = /n=(\d+) confirmed (\d{4}-\d{2}-\d{2})/.exec(e.detail);
        if (m) { n = Number(m[1]); confirmed = m[2]; }
      }
    });
    if (l.n !== n) errors.push(`${l.id}: n=${l.n} in the lessons file, but lessons.history supports n=${n}`);
    if (l.confirmed !== confirmed) errors.push(`${l.id}: confirmed ${l.confirmed} in the lessons file, but lessons.history supports ${confirmed}`);
  });
  doc.rules.forEach((r) => {
    if (!idMatches('R', r.id, r.text)) errors.push(`${r.id}: the id does not match the rule text (an id is a hash of the text)`);
    const lid = 'L-' + r.id.slice(2);
    const idx = entries.findIndex((e, i) => e.action === 'promote' && e.id === lid && entries.slice(i + 1).every((x) => !(x.action === 'promote' && x.id === lid)));
    if (idx < 0) { errors.push(`${r.id}: no human-confirmed promotion in lessons.history`); return; }
    const promo = entries[idx];
    if (r.promoted !== promo.date) errors.push(`${r.id}: promoted ${r.promoted} in the lessons file, but lessons.history says ${promo.date}`);
    const th = /text:([0-9a-f]{12})/.exec(promo.detail);
    if (!th) errors.push(`${r.id}: the promotion line in lessons.history holds no text hash`);
    else if (th[1] !== textHash(r.text)) errors.push(`${r.id}: the rule text differs from the text the human approved (hash ${th[1]})`);
    if (stateAt(lid, idx) < 2) errors.push(`${r.id}: promoted before the lesson was corrected twice (n was ${stateAt(lid, idx)})`);
    const reviews = entries.filter((e) => e.action === 'review' && e.id === r.id).map((e) => e.date);
    const reviewed = reviews.length ? reviews[reviews.length - 1] : promo.date;
    if (r.reviewed !== reviewed) errors.push(`${r.id}: reviewed ${r.reviewed} in the lessons file, but lessons.history says ${reviewed}`);
    const retired = entries.filter((e) => e.action === 'retire' && e.id === r.id && e.date >= promo.date);
    if (retired.length) errors.push(`${r.id}: retired in lessons.history but still in the lessons file`);
  });
  // every id the history names must exist somewhere: a lesson, a rule, an archive, or a merge
  const known = new Set(archive);
  doc.lessons.forEach((l) => known.add(l.id));
  doc.rules.forEach((r) => { known.add(r.id); known.add('L-' + r.id.slice(2)); });
  archive.forEach((id) => { if (id.startsWith('R-')) known.add('L-' + id.slice(2)); });
  entries.forEach((e) => { if (e.action === 'merge') (e.detail.match(/L-[0-9a-f]{6}/g) || []).forEach((x) => known.add(x)); });
  entries.forEach((e) => {
    if (e.action === 'drop') return;
    if (!known.has(e.id)) errors.push(`lessons.history line ${e.n}: ${e.id} is in no lesson, rule or archive`);
  });
  return errors;
}

// ---------------------------------------------------------------- file

function parse(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const head = [];
  const rules = [];
  const lessons = [];
  const errors = [];
  let section = null;
  let seenRules = false;
  let seenLessons = false;
  lines.forEach((line, i) => {
    if (/^## Rules\s*$/.test(line)) { section = 'rules'; seenRules = true; return; }
    if (/^## Lessons\s*$/.test(line)) { section = 'lessons'; seenLessons = true; return; }
    if (/^## /.test(line)) { section = 'other'; return; }
    if (section === null) { head.push(line); return; }
    if (!line.startsWith('- ')) return;
    if (section === 'rules') {
      const m = RULE_LINE.exec(line);
      if (!m) { errors.push(`line ${i + 1}: malformed rule`); return; }
      rules.push({ id: m[1], promoted: m[2], reviewed: m[3], text: m[4] });
    } else if (section === 'lessons') {
      const m = LESSON_LINE.exec(line);
      if (!m) { errors.push(`line ${i + 1}: malformed lesson`); return; }
      lessons.push({ id: m[1], date: m[2], n: Number(m[3]), confirmed: m[4], text: m[5] });
    }
  });
  if (!seenRules) errors.push('missing "## Rules" section');
  if (!seenLessons) errors.push('missing "## Lessons" section');
  return { head: head.join('\n').replace(/\s+$/, ''), rules, lessons, errors };
}

function serialize(doc) {
  const rules = doc.rules.length
    ? doc.rules.map((r) => `- ${r.id} | promoted ${r.promoted} | reviewed ${r.reviewed} | ${r.text}`).join('\n')
    : NONE;
  const lessons = doc.lessons.length
    ? doc.lessons.map((l) => `- ${l.id} | ${l.date} | n=${l.n} | confirmed ${l.confirmed} | ${l.text}`).join('\n')
    : NONE;
  return `${doc.head}\n\n## Rules\n\n${rules}\n\n## Lessons\n\n${lessons}\n`;
}

const ageOf = (l, today) => daysBetween(l.confirmed, today);

// Strings starting with "WARN " are notices. Anything else is a failure.
function validate(text, today, historyText, archiveIds) {
  const doc = parse(text);
  const errors = doc.errors.slice();
  const ids = new Set();
  doc.rules.concat(doc.lessons).forEach((x) => {
    if (ids.has(x.id)) errors.push(`duplicate id ${x.id}`);
    ids.add(x.id);
  });
  doc.lessons.forEach((l) => {
    if (!validDate(l.date) || !validDate(l.confirmed)) { errors.push(`${l.id}: a date does not exist`); return; }
    if (l.date > today || l.confirmed > today) { errors.push(`${l.id}: a date is in the future (today is ${today})`); return; }
    if (l.n >= 2) {
      const msg = `${l.id}: corrected ${l.n} times and not promoted. Ask the human, then run: node scripts/lessons.js promote ${l.id} --human-confirmed`;
      errors.push(ageOf(l, today) > PROMOTE_GRACE_DAYS ? msg : `WARN ${msg}`);
    } else if (ageOf(l, today) > EXPIRY_DAYS) {
      errors.push(`${l.id}: not reconfirmed for ${ageOf(l, today)} days, past ${EXPIRY_DAYS}. Run: node scripts/lessons.js expire`);
    }
  });
  if (doc.rules.length > MAX_RULES) errors.push(`${doc.rules.length} rules, the cap is ${MAX_RULES}. Retire or merge one: node scripts/lessons.js retire <id> --human-confirmed`);
  doc.rules.forEach((r) => {
    if (!validDate(r.promoted) || !validDate(r.reviewed)) { errors.push(`${r.id}: a date does not exist`); return; }
    if (r.promoted > today || r.reviewed > today) { errors.push(`${r.id}: a date is in the future (today is ${today})`); return; }
    if (daysBetween(r.reviewed, today) > RULE_REVIEW_DAYS) {
      errors.push(`${r.id}: not reviewed for ${daysBetween(r.reviewed, today)} days, past ${RULE_REVIEW_DAYS}. Ask the human: keep it (review ${r.id} --human-confirmed) or retire it`);
    }
  });
  if (historyText !== undefined) {
    const h = parseHistory(historyText);
    h.errors.forEach((e) => errors.push(`lessons.history: ${e}`));
    h.entries.filter((e) => e.date > today).forEach((e) => errors.push(`lessons.history: line ${e.n} is dated in the future (today is ${today})`));
    if (!h.errors.length) reconcile(doc, h.entries, archiveIds).forEach((e) => errors.push(e));
  }
  return errors;
}

function checkText(text) {
  if (!text || text.length > MAX_LEN) return `lesson text must be 1 to ${MAX_LEN} characters`;
  if (/[|\n]/.test(text)) return 'lesson text must be one line with no pipe character';
  if (text.trim().split(/\s+/).length < MIN_WORDS) return `lesson text needs at least ${MIN_WORDS} words`;
  return null;
}

function parseArgs(argv) {
  const opts = { file: 'memory/wiki/lessons.md', archive: null, history: null, date: null, human: false, quote: '', humanBad: false, fresh: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--file', '--archive', '--history', '--date'].includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) { opts.argError = `${a} needs a value. Run with --help for usage.`; break; }
      opts[a.slice(2)] = v;
      i++;
    } else if (a === '--human-confirmed') {
      opts.human = true;
      const q = argv[i + 1];
      if (q === undefined || q.startsWith('--')) opts.humanBad = true;
      else { opts.quote = q.trim(); i++; if (!opts.quote || /[|\n"]/.test(opts.quote) || opts.quote.length > 240) opts.humanBad = true; }
    }
    else if (a === '--new') opts.fresh = true;
    else rest.push(a);
  }
  return { opts, rest };
}

function appendArchive(file, header, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : header;
  fs.writeFileSync(file, old.replace(/\s+$/, '') + '\n' + line + '\n');
}

function needHuman(what) {
  console.log(`NEEDS HUMAN: ${what}. Ask the human. After a yes, run the command again with --human-confirmed "<their words>".`);
  return 3;
}

const HELP = [
  'lessons: keep memory/wiki/lessons.md (rules and lessons).',
  '  add "<one line>" [--new]        record a correction; a likely repeat is reported, never merged',
  '  list                            show rules and lessons with time left',
  '  repeat <id> --human-confirmed "<words>"   count a confirmed repeat (a lesson corrected twice is due for promotion)',
  '  promote [<id> --human-confirmed "<words>"]  with no id, list what is due; with an id and approval, make it a rule',
  '  confirm <id> --human-confirmed "<words>"  restart a lesson\'s expiry clock',
  '  review <rule id> / retire <rule id>   each with --human-confirmed "<words>"',
  '  expire                          archive lessons nobody reconfirmed in ' + EXPIRY_DAYS + ' days',
  '  dedupe [--human-confirmed]      list merge candidates; merge them after approval',
  '--human-confirmed takes the human\'s own words in quotes and appends them to lessons.history. The flag is self-attested.',
  'Options: --file <path> --date YYYY-MM-DD --archive <path> --history <path>. Exit 3 means ask the human first.',
].join('\n');

function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) { console.log(HELP); return argv.length === 0 ? 2 : 0; }
  const { opts, rest } = parseArgs(argv);
  if (opts.argError) { console.error(`lessons: ${opts.argError}`); return 2; }
  const cmd = rest[0];
  const today = opts.date || localToday();
  if (!validDate(today)) { console.error(`lessons: --date wants a real date as YYYY-MM-DD, got "${today}"`); return 2; }
  if (!['add', 'list', 'repeat', 'confirm', 'promote', 'review', 'retire', 'expire', 'dedupe'].includes(cmd)) {
    console.error('usage: lessons.js add|list|repeat|confirm|promote|review|retire|expire|dedupe [args] [--file F] [--date D]');
    return 2;
  }
  const NEEDS_ID = { repeat: 'repeat L-3fa91c', confirm: 'confirm L-3fa91c', review: 'review R-3fa91c', retire: 'retire R-3fa91c' };
  if (NEEDS_ID[cmd] && !rest[1]) {
    console.error(`lessons: ${cmd} needs the id of ${cmd === 'review' || cmd === 'retire' ? 'a rule' : 'a lesson'}, for example: node scripts/lessons.js ${NEEDS_ID[cmd]} --human-confirmed "<their words>"`);
    return 2;
  }
  if (!fs.existsSync(opts.file)) { console.error(`lessons: ${opts.file} does not exist`); return 2; }
  const doc = parse(fs.readFileSync(opts.file, 'utf8'));
  if (doc.errors.length) { console.error(`lessons: ${opts.file} is malformed: ${doc.errors.join('; ')}`); return 2; }
  const save = () => fs.writeFileSync(opts.file, serialize(doc));
  const histDir = path.join(path.dirname(opts.file), '..', 'history');
  if (opts.human && opts.humanBad) { console.error('lessons: --human-confirmed needs the human\'s own words next to it, in quotes (no pipe, no double quote, 240 characters at most)'); return 2; }
  const historyFile = opts.history || path.join(path.dirname(opts.file), 'lessons.history');
  const record = (action, id, detail) => {
    if (!fs.existsSync(historyFile)) fs.writeFileSync(historyFile, HISTORY_HEADER);
    const old = fs.readFileSync(historyFile, 'utf8');
    fs.writeFileSync(historyFile, old.replace(/\s+$/, '') + '\n' + [today, action, id, `"${opts.quote}"`, detail].join(' | ') + '\n');
  };

  if (cmd === 'add') {
    const text = (rest[1] || '').trim();
    const bad = checkText(text);
    if (bad) { console.error(`lessons: ${bad}`); return 2; }
    const rule = doc.rules.find((r) => similar(r.text, text));
    if (rule) {
      console.log(`RULE BROKEN AGAIN: ${rule.id} already says this. Nothing added. Tell the human the rule did not hold.`);
      return 0;
    }
    const hit = doc.lessons.find((l) => similar(l.text, text));
    if (hit && !opts.fresh) {
      console.log(`POSSIBLE REPEAT of ${hit.id}: "${hit.text}". Nothing written.`);
      console.log(`Ask the human whether this is the same lesson. If yes: node scripts/lessons.js repeat ${hit.id} --human-confirmed`);
      console.log('If no: run add again with --new.');
      return 3;
    }
    const taken = new Set(doc.rules.concat(doc.lessons).map((x) => x.id));
    const lesson = { id: idFor('L', text, taken), date: today, n: 1, confirmed: today, text };
    doc.lessons.unshift(lesson);
    save();
    console.log(`Added ${lesson.id}.`);
    return 0;
  }

  if (cmd === 'list') {
    if (!doc.rules.length && !doc.lessons.length) {
      console.log('No rules or lessons yet. Add the first one with: node scripts/lessons.js add "<one line>"');
      return 0;
    }
    console.log(`RULES (${doc.rules.length} of ${MAX_RULES})`);
    doc.rules.forEach((r) => console.log(`  ${r.id}  promoted ${r.promoted}  reviewed ${r.reviewed}  ${r.text}`));
    console.log(`LESSONS (${doc.lessons.length})`);
    doc.lessons.forEach((l) => {
      const left = EXPIRY_DAYS - ageOf(l, today);
      console.log(`  ${l.id}  n=${l.n}  ${left < 0 ? 'EXPIRED' : `expires in ${left} days`}  ${l.text}`);
    });
    return 0;
  }

  if (cmd === 'repeat' || cmd === 'confirm') {
    const l = doc.lessons.find((x) => x.id === rest[1]);
    if (!l) { console.error(`lessons: no lesson with id ${rest[1]}`); return 2; }
    if (!opts.human) return needHuman(cmd === 'repeat' ? `confirm that this correction repeats ${l.id}` : `confirm that ${l.id} still holds`);
    if (cmd === 'repeat') l.n += 1;
    l.confirmed = today;
    record(cmd, l.id, cmd === 'repeat' ? `n=${l.n}` : `confirmed ${today}`);
    save();
    console.log(cmd === 'repeat'
      ? (l.n >= 2 ? `Lesson ${l.id} is now n=${l.n}. PROMOTE DUE: ask the human, then run node scripts/lessons.js promote ${l.id} --human-confirmed` : `Lesson ${l.id} updated (n=${l.n}).`)
      : `Confirmed ${l.id} on ${today}.`);
    return 0;
  }

  if (cmd === 'promote') {
    if (!rest[1]) {
      const due = doc.lessons.filter((l) => l.n >= 2);
      console.log(due.length ? `PROMOTE DUE: ${due.map((l) => l.id).join(' ')}` : 'Nothing is due for promotion.');
      return 0;
    }
    const l = doc.lessons.find((x) => x.id === rest[1]);
    if (!l) { console.error(`lessons: no lesson with id ${rest[1]}`); return 2; }
    if (l.n < 2) { console.error(`lessons: ${l.id} has been corrected ${l.n} time. A rule needs two.`); return 2; }
    if (!opts.human) return needHuman(`approve making ${l.id} a rule: "${l.text}"`);
    if (doc.rules.length >= MAX_RULES) return needHuman(`the rule cap of ${MAX_RULES} is reached. Retire or merge a rule first with retire <id>`);
    doc.lessons.splice(doc.lessons.indexOf(l), 1);
    doc.rules.unshift({ id: 'R-' + l.id.slice(2), promoted: today, reviewed: today, text: l.text });
    record('promote', l.id, `-> R-${l.id.slice(2)} text:${textHash(l.text)}`);
    save();
    console.log('Promoted 1.');
    return 0;
  }

  if (cmd === 'review' || cmd === 'retire') {
    const r = doc.rules.find((x) => x.id === rest[1]);
    if (!r) { console.error(`lessons: no rule with id ${rest[1]}`); return 2; }
    if (!opts.human) return needHuman(cmd === 'review' ? `confirm that ${r.id} still holds` : `approve retiring ${r.id}: "${r.text}"`);
    record(cmd, r.id, cmd === 'review' ? `reviewed ${today}` : 'retired');
    if (cmd === 'review') r.reviewed = today;
    else {
      doc.rules.splice(doc.rules.indexOf(r), 1);
      appendArchive(opts.archive || path.join(histDir, 'retired-rules.md'), '# Retired rules\n',
        `- ${r.id} | retired ${today} | promoted ${r.promoted} | ${r.text}`);
    }
    save();
    console.log(cmd === 'review' ? `Reviewed ${r.id} on ${today}.` : `Retired ${r.id}.`);
    return 0;
  }

  if (cmd === 'expire') {
    const gone = doc.lessons.filter((l) => l.n < 2 && ageOf(l, today) > EXPIRY_DAYS);
    const waiting = doc.lessons.filter((l) => l.n >= 2);
    if (waiting.length) console.log(`Skipped ${waiting.length} lessons due for promotion. Ask the human.`);
    if (gone.length) {
      const lines = gone.map((l) => `- ${l.id} | expired ${today} | last confirmed ${l.confirmed} | ${l.text}`).join('\n');
      appendArchive(opts.archive || path.join(histDir, 'expired-lessons.md'),
        `# Expired lessons\n\nRemoved because nobody reconfirmed them within ${EXPIRY_DAYS} days.\n`, lines);
      doc.lessons = doc.lessons.filter((l) => !gone.includes(l));
      save();
    }
    console.log(`Expired ${gone.length}.`);
    return 0;
  }

  if (cmd === 'dedupe') {
    const groups = [];
    const dropped = [];
    doc.lessons.forEach((l) => {
      if (doc.rules.some((r) => similar(r.text, l.text))) { dropped.push(l); return; }
      const g = groups.find((x) => similar(x[0].text, l.text));
      if (g) g.push(l); else groups.push([l]);
    });
    const dupes = groups.filter((g) => g.length > 1);
    dupes.forEach((g) => console.log(`MERGE CANDIDATE: ${g.map((l) => l.id).join(' ')}`));
    dropped.forEach((l) => console.log(`ALREADY A RULE: ${l.id}`));
    const count = dupes.reduce((n, g) => n + g.length - 1, 0) + dropped.length;
    if (!count) { console.log('Merged 0 duplicates.'); return 0; }
    if (!opts.human) return needHuman(`approve merging ${count} duplicate lessons`);
    const kept = [];
    groups.forEach((g) => {
      const first = g[0];
      g.slice(1).forEach((l) => {
        first.n += l.n;
        if (l.date < first.date) first.date = l.date;
        if (l.confirmed > first.confirmed) first.confirmed = l.confirmed;
      });
      if (g.length > 1) record('merge', first.id, `n=${first.n} confirmed ${first.confirmed} | absorbed ${g.slice(1).map((l) => l.id).join(' ')}`);
      kept.push(first);
    });
    dropped.forEach((l) => record('drop', l.id, 'duplicate of a rule'));
    doc.lessons = kept.filter((l) => !dropped.includes(l));
    save();
    console.log(`Merged ${count} duplicates.`);
    return 0;
  }
  return 2;
}

module.exports = { EXPIRY_DAYS, MAX_RULES, RULE_REVIEW_DAYS, PROMOTE_GRACE_DAYS, parse, serialize, validate, parseHistory, reconcile, similar, normalize, idFor, textHash, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
