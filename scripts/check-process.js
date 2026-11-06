#!/usr/bin/env node
'use strict';
// check-process: mechanical checks for the Carousel OS process. Zero dependencies.
//
//   node scripts/check-process.js [--root DIR] [--config FILE] [--today YYYY-MM-DD]
//   node scripts/check-process.js --skip handoff          (carousel-wrap only)
//   node scripts/check-process.js --only budget           (one check by name)
//   node scripts/check-process.js --ledger FILE [--final]
//   node scripts/check-process.js --ledger-md FILE        (prints the ledger as a pipe table)
//   node scripts/check-process.js --help
//
// Checks: budget, deadrefs, wiki, contract, prose, state, handoff. Exit 1 when any fails.
// It works with or without an engine/ folder. It skips dot folders, folders the project's
// .gitignore names, and generated folders (out, build, decks, node_modules).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const rotate = require('./rotate-log.js');
const lessons = require('./lessons.js');
const runTools = require('./run-tools.js');
const skills = require('./generate-skills.js');

// Where each stage's single source lives (Cursor and Codex read this folder; Claude Code reads a generated copy).
const STAGE_DIR = skills.SKILLS;
const stageFile = (name) => `${STAGE_DIR}/${name}/SKILL.md`;
const STAGE_INDEX = `${STAGE_DIR}/README.md`;

// ---------------------------------------------------------------- contract

const CHECK_TEMPLATE = 'Check report: path <engine|rubric>; plan <PASS|FAIL>; ledger <PASS|FAIL>; tools <none or list>; checklist <N of M or n/a>; Deferred: <none or list>.';
const STOP_TEMPLATE = 'Stopped at <start|brief|storyboard|challenge-plan|build|check|review>: <reason>.';

// Each stage: its exact report line, the previous stage's line its Guards must name (guard), and
// strings that must stay in a named section (must). The strings pin the guards and prohibitions
// that make a stage refuse to run, so an edit cannot quietly drop one.
const STAGES = [
  {
    name: 'carousel-start', id: 'start', report: 'Start report: plan <path> created; path <full|light>; handoff <read|none>; lessons loaded <N>.', guard: [],
    must: { Guards: ['node scripts/install.js', 'Start never resumes a plan'], Steps: ['node scripts/check-process.js'] },
  },
  {
    name: 'carousel-brief', id: 'brief', report: 'Brief report: <N> questions asked, <M> answers recorded, <K> NEEDS HUMAN markers open.', guard: ['Start report:'],
    extra: ['NEEDS HUMAN:'], must: { Guards: ['NEEDS HUMAN:'], Steps: ['at most three'] },
  },
  {
    name: 'carousel-storyboard', id: 'storyboard', report: 'Storyboard report: <N> slides, headlines-only read <holds|does not hold>, ledger rows <N>.', guard: ['Brief report:'],
    must: { Guards: ['NEEDS HUMAN:'], Steps: ['Headlines only:', 'ledger'] },
  },
  {
    name: 'carousel-challenge-plan', id: 'round',
    report: 'Challenge round <R> of <T>: angle <name> (new). Re-verified <N> claims, demoted <M> to uncertainty.',
    guard: ['Storyboard report:'],
    extra: ['Addressed:', 'Deferred:', 'Kept as is:', 'Angle: <name> (new)', 'Parked claims'],
    must: { Guards: ['Rounds line'], Steps: ['Parked claims: none open', 'Never delete a parked entry'] },
  },
  {
    name: 'carousel-build', id: 'build', report: 'Build report: <N> slides built, <M> ledger rows checked, <K> deviations logged.', guard: ['Challenge round'],
    extra: ['Deviations'], must: { Guards: ['Parked claims: none open', 'Stopped at', 'holds a `NEEDS HUMAN:` marker'], Steps: ['open its source and recompute it', 'Never set', 'Deck sha256 at build:'] },
  },
  {
    name: 'carousel-check', id: 'check', report: CHECK_TEMPLATE, guard: ['Build report:'],
    extra: ['Deck sha256: <hex>', 'Ledger sha256: <hex>', 'Build sha256: <hex>', 'carousel.config.json', 'Deferred:', 'Tool <name>: <PASS|FAIL|MISSING>: <exact result line>', 'Deck sha256 before tools: <hex>', 'tools.json'],
    must: { Guards: ['latest `Build report:` line', 'needs a new `carousel-build`'], Steps: ['sha256', '--plan', 'scripts/run-tools.js', 'Never loosen', 'Never record exit 2 as PASS', 'No tool may edit the deck', 'differs from the line before the tools'] },
  },
  {
    name: 'carousel-review', id: 'review', report: 'Review verdict: <PASS|REJECT|UNVERIFIABLE>; unreconciled numbers <N>; findings <N>.',
    guard: ['Check report:'], extra: ['UNVERIFIABLE is never rounded up to PASS.', 'fresh context'],
    must: { Guards: ['sha256', 'latest `Check report:` line', 'two `Review verdict: REJECT`', 'a FAIL, a MISSING tool or a checklist short of its total'], Steps: ['recompute', '--plan', 'second REJECT', 'never rounded up', 'Withhold the Challenge log'] },
  },
  {
    name: 'carousel-wrap', id: 'wrap',
    report: 'Wrap report: check <PASS|FAIL|n/a>; log entry written; lessons added <N>; wiki pages touched <N>; entries rotated <N>.',
    guard: ['Review verdict: PASS', 'Stopped at'], extra: [STOP_TEMPLATE],
    must: { Guards: ['latest review line is `Review verdict: PASS`', 'Stopped at'], Steps: ['Never run `repeat`'] },
  },
  {
    name: 'carousel-handoff', id: 'handoff', report: 'Handoff report: memory/handoff.md written; <N> bullets; focus <one line or none>.',
    guard: ['Wrap report:'], extra: ['Nothing to hand off this time.', '## Agent half', 'Start with carousel-start.'],
    must: { Guards: ['latest `Wrap report:` line'], Steps: ['Never append'] },
  },
];
const STOP = { id: 'stopped', report: STOP_TEMPLATE };

const ANATOMY = ['## Guards', '## Steps', '## Report line', '## No-rubber-stamp guard', '## Rationale'];
const PLAN_SECTIONS = ['Direction', 'Brief', 'Storyboard', 'Challenge log', 'Deviations', 'Build', 'Check', 'Review', 'Reports'];
const EMPTY_HANDOFF = 'Nothing to hand off this time.';
const SKIP_DIRS = new Set(['node_modules', 'engine', 'tests', 'decks', 'out', 'build', 'dist', '__pycache__']);
const CHECKLIST_ITEMS = [10, 9];
const STOP_STAGE = { start: 'start', brief: 'brief', storyboard: 'storyboard', round: 'challenge-plan', build: 'build', check: 'check', review: 'review' };
const MAX_REJECTS = 2;
// Sentences in RULES.md that an edit must not drop.
const RULES_PINS = ['Never commit, push, send or publish a deck.', 'A tool that exits 2 is MISSING, never PASS.', 'self-attested', 'Only `carousel-brief` asks the human anything.'];

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Turn a report template into a regex: <N> style placeholders match digits, <a|b> matches one of
// the options, any other <word> matches free text.
function reportRegex(template) {
  let out = '';
  let last = 0;
  const re = /<([^>]*)>/g;
  let m;
  while ((m = re.exec(template))) {
    out += esc(template.slice(last, m.index));
    const g = m[1];
    if (g.includes('|')) out += '(?:' + g.split('|').map(esc).join('|') + ')';
    else if (/^[A-Z]$/.test(g)) out += '\\d+';
    else out += '.+?';
    last = m.index + m[0].length;
  }
  out += esc(template.slice(last));
  return new RegExp('^' + out + '$');
}

const FORMATS = STAGES.map((s) => ({ id: s.id, re: reportRegex(s.report) })).concat([{ id: STOP.id, re: reportRegex(STOP.report) }]);

// ---------------------------------------------------------------- helpers

function readIf(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}

function ignoredNames(root) {
  const names = new Set();
  const t = readIf(path.join(root, '.gitignore'));
  if (!t) return names;
  t.split('\n').forEach((raw) => {
    const l = raw.trim();
    if (!l || l.startsWith('#') || l.startsWith('!')) return;
    const bare = l.replace(/^\//, '').replace(/\/$/, '');
    if (bare && !/[*?[\]/]/.test(bare)) names.add(bare);
  });
  return names;
}

function walk(root, rel, ext, skip, out) {
  let names;
  try { names = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch (e) { return out; }
  names.forEach((d) => {
    const r = rel ? rel + '/' + d.name : d.name;
    if (d.isDirectory()) {
      if (!d.name.startsWith('.') && !skip.has(d.name)) walk(root, r, ext, skip, out);
    } else if (d.name.endsWith(ext)) out.push(r);
  });
  return out;
}

const walkMd = (root, skip) => walk(root, '', '.md', skip, []);
const walkAny = (root, rel, ext) => walk(root, rel, ext, new Set(), []);

function scanLines(text) {
  let fenced = false;
  return text.replace(/\r\n/g, '\n').split('\n').map((line, i) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return { n: i + 1, line, fence: true }; }
    return { n: i + 1, line, fenced };
  });
}

function headingsOf(text) {
  return scanLines(text)
    .filter((l) => !l.fenced && !l.fence)
    .map((l) => /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l.line))
    .filter(Boolean)
    .map((m) => m[2].replace(/`/g, ''));
}

function slug(h) {
  return h.toLowerCase().replace(/[^a-z0-9 _-]/g, '').replace(/ /g, '-');
}

function sectionText(text, heading) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n').trim();
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function realDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return rotate.parseIsoDate(s) !== null;
}

// ---------------------------------------------------------------- ledger

// A check text must say what was done. These phrases say nothing.
const EMPTY_CHECK = /\b(verified|looks? (right|good|fine|ok|okay|correct)|seems? (right|fine|ok|correct)|as expected|should be (fine|right|ok)|all good|trust me)\b/i;
const CHECK_VERB = /\b(recomputed|recounted|recalculated|re-?derived|compared|counted|summed|divided|multiplied|subtracted|opened|ran|reran|queried|matches|matched|equals|traced|read)\b/i;

function checkTextProblem(t) {
  if (typeof t !== 'string' || t.trim() === '') return 'checked without a named check';
  if (EMPTY_CHECK.test(t)) return `check text "${t.trim()}" says nothing about what was done`;
  if (t.trim().split(/\s+/).length < 6) return `check text "${t.trim()}" is too short to name a check (six words at least)`;
  if (!CHECK_VERB.test(t)) return `check text "${t.trim()}" names no action (recomputed, recounted, compared, opened, ran, matches)`;
  return null;
}

// Number words: a ratio, a percentage or a fraction written in words is a figure, so it needs a ledger entry.
const ONES = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const CARD = '(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|' + Object.keys(ONES).join('|') + ')';
const FRAC_N = '(?:a|one|two|three|four|five|six|seven|eight|nine)';
const FRAC_D = '(?:half|halves|third|thirds|quarter|quarters|fifth|fifths|tenth|tenths)';
const PHRASE_RE = new RegExp(
  `\\b(?:${CARD} (?:in|out of) ${CARD}|${CARD} times|(?:${CARD}|(?:one|a) hundred) percent|${FRAC_N} ${FRAC_D}|half|twice|doubled|tripled)\\b`, 'gi');

function cardinal(w) {
  w = w.toLowerCase();
  if (ONES[w]) return ONES[w];
  if (TENS[w]) return TENS[w];
  const m = /^(\w+)[- ](\w+)$/.exec(w);
  if (m && TENS[m[1]] && ONES[m[2]] && ONES[m[2]] < 10) return TENS[m[1]] + ONES[m[2]];
  return null;
}

function ratioPhrases(text) {
  return (String(text).match(PHRASE_RE) || []).map((x) => x.toLowerCase());
}

// What a number phrase claims: { kind: 'pct' | 'x', v, tol }.
function phraseValue(p) {
  let m = new RegExp(`^(${CARD}) (?:in|out of) (${CARD})$`).exec(p);
  if (m && cardinal(m[1]) && cardinal(m[2])) return { kind: 'pct', v: (cardinal(m[1]) / cardinal(m[2])) * 100, tol: 5 };
  m = new RegExp(`^(${CARD}) times$`).exec(p);
  if (m && cardinal(m[1])) return { kind: 'x', v: cardinal(m[1]), tol: 0.3 };
  m = new RegExp(`^(${CARD}|(?:one|a) hundred) percent$`).exec(p);
  if (m) return { kind: 'pct', v: /hundred/.test(m[1]) ? 100 : cardinal(m[1]), tol: 1 };
  m = new RegExp(`^(${FRAC_N}) (${FRAC_D})$`).exec(p);
  if (m) {
    const num = m[1] === 'a' ? 1 : ONES[m[1]];
    const den = { half: 2, halves: 2, third: 3, thirds: 3, quarter: 4, quarters: 4, fifth: 5, fifths: 5, tenth: 10, tenths: 10 }[m[2]];
    return { kind: 'pct', v: (num / den) * 100, tol: 5 };
  }
  if (p === 'half') return { kind: 'pct', v: 50, tol: 5 };
  if (p === 'twice' || p === 'doubled') return { kind: 'x', v: 2, tol: 0.3 };
  if (p === 'tripled') return { kind: 'x', v: 3, tol: 0.3 };
  return null;
}

function numericOf(value) {
  let m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(value);
  if (m) return { kind: 'pct', v: Number(m[1]) };
  m = /^\s*(\d+(?:\.\d+)?)\s*x\s*$/i.exec(value);
  if (m) return { kind: 'x', v: Number(m[1]) };
  return null;
}

function windowEnd(w) {
  const d = String(w || '').match(/\d{4}-\d{2}-\d{2}/g);
  return d ? d[d.length - 1] : null;
}

function validateLedger(obj, opts) {
  const o = opts || {};
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['ledger is not a JSON object'];
  const isStr = (v) => typeof v === 'string' && v.trim() !== '';
  if (!isStr(obj.deck)) errors.push('deck is missing');
  if (!isStr(obj.window)) errors.push('window is missing');
  if (!Array.isArray(obj.slides) || obj.slides.length === 0) { errors.push('slides is missing or empty'); return errors; }
  const wend = windowEnd(obj.window);
  const ids = new Set();
  obj.slides.forEach((s, i) => {
    const at = `slide ${s && s.id ? s.id : '#' + (i + 1)}`;
    if (!s || typeof s !== 'object') { errors.push(`${at}: not an object`); return; }
    if (!isStr(s.id)) errors.push(`${at}: id is missing`);
    else if (ids.has(s.id)) errors.push(`${at}: duplicate id`);
    else ids.add(s.id);
    if (!['claim', 'framing', undefined].includes(s.kind)) errors.push(`${at}: kind must be claim or framing`);
    if (!isStr(s.claim)) errors.push(`${at}: claim is missing`);
    if (!isStr(s.source)) errors.push(`${at}: source is missing`);
    if (!['open', 'checked', 'rejected'].includes(s.status)) errors.push(`${at}: status must be open, checked or rejected`);
    if (!Array.isArray(s.numbers)) { errors.push(`${at}: numbers must be an array`); return; }
    if (s.kind === 'framing' && s.numbers.length) errors.push(`${at}: a framing slide carries no numbers`);
    s.numbers.forEach((n, j) => {
      if (!n || !isStr(n.value)) errors.push(`${at}: number ${j + 1} has no value`);
      if (!n || !isStr(n.source)) errors.push(`${at}: number ${j + 1} has no source`);
      if (!n || typeof n.reconciled !== 'boolean') errors.push(`${at}: number ${j + 1} needs reconciled true or false`);
      if (n && n.words !== undefined) {
        if (!Array.isArray(n.words) || n.words.some((w) => !isStr(w))) errors.push(`${at}: number ${j + 1} words must be a list of phrases`);
        else if (!o.template) {
          const num = isStr(n.value) ? numericOf(n.value) : null;
          n.words.forEach((w) => {
            const pv = phraseValue(String(w).toLowerCase());
            if (!pv) { errors.push(`${at}: "${w}" is not a number phrase this check can read (six in ten, three times, sixty percent, a third, doubled)`); return; }
            if (!num || num.kind !== pv.kind) { errors.push(`${at}: "${w}" cannot describe ${n.value} (a percentage pairs with "six in ten", a multiple with "three times")`); return; }
            if (Math.abs(pv.v - num.v) > pv.tol) errors.push(`${at}: "${w}" says ${Math.round(pv.v * 10) / 10}${pv.kind === 'pct' ? '%' : 'x'} but the ledger says ${n.value}`);
          });
        }
      }
    });
    if (o.template) return;
    if (s.numbers.length && !isStr(s.window)) errors.push(`${at}: window is missing`);
    if (s.status === 'checked') {
      const bad = checkTextProblem(s.check);
      if (bad) errors.push(`${at}: ${bad}`);
      if (!realDate(s.checked_on)) errors.push(`${at}: checked_on "${s.checked_on}" is not a real date`);
      else {
        if (o.today && s.checked_on > o.today) errors.push(`${at}: checked_on ${s.checked_on} is later than today (${o.today})`);
        if (wend && s.checked_on < wend) errors.push(`${at}: checked_on ${s.checked_on} is earlier than the window end (${wend})`);
      }
      s.numbers.forEach((n, j) => {
        if (n && n.reconciled !== true) errors.push(`${at}: checked with unreconciled number ${j + 1} (${n.value})`);
      });
    }
    if (s.status === 'rejected' && !isStr(s.note)) errors.push(`${at}: rejected without a note`);
    if (o.final) {
      if (s.status !== 'checked') errors.push(`${at}: status is ${s.status}, not checked`);
      s.numbers.forEach((n, j) => {
        if (n && n.reconciled !== true) errors.push(`${at}: unreconciled number ${j + 1} (${n.value})`);
      });
      if (s.numbers.length && isStr(s.window) && isStr(obj.window) && s.window !== obj.window) {
        errors.push(`${at}: window "${s.window}" differs from the deck window "${obj.window}"`);
      }
    }
  });
  return errors;
}

function ledgerSummary(obj) {
  const slides = Array.isArray(obj && obj.slides) ? obj.slides : [];
  const count = (st) => slides.filter((s) => s && s.status === st).length;
  let unreconciled = 0;
  slides.forEach((s) => (s && Array.isArray(s.numbers) ? s.numbers : []).forEach((n) => { if (!n || n.reconciled !== true) unreconciled++; }));
  return `Ledger: ${slides.length} slides, ${count('checked')} checked, ${count('open')} open, ${count('rejected')} rejected, ${unreconciled} unreconciled numbers`;
}

function cell(s) {
  return String(s == null ? '' : s).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

function ledgerMd(obj) {
  const rows = ['| Slide | Claim | Source | Window | Quote | Verified |', '|---|---|---|---|---|---|'];
  obj.slides.forEach((s) => {
    const verified = s.status === 'checked' ? `VERIFIED agent; ${cell(s.check).replace(/;/g, ',')}; ${s.checked_on}` : '';
    rows.push(`| ${cell(s.id)} | ${cell(s.claim)} | ${cell(s.source)} | ${cell(s.window || obj.window)} | ${cell(s.quote)} | ${verified} |`);
  });
  return rows.join('\n') + '\n';
}

// ---------------------------------------------------------------- the deck itself: a .pptx is a zip of XML

const LIMITS = { maxFileBytes: 50 * 1024 * 1024, maxPartBytes: 32 * 1024 * 1024, maxTotalBytes: 128 * 1024 * 1024, maxEntries: 5000 };

class DeckError extends Error {}
const bad = (why) => new DeckError(`broken or unsupported .pptx (${why})`);

// Every read is bounds checked, so a corrupt file ends in one plain message and never a RangeError.
const u16 = (buf, off) => { if (off < 0 || off + 2 > buf.length) throw bad('truncated'); return buf.readUInt16LE(off); };
const u32 = (buf, off) => { if (off < 0 || off + 4 > buf.length) throw bad('truncated'); return buf.readUInt32LE(off); };

function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw bad('no zip end-of-directory record');
  const total = u16(buf, eocd + 10);
  const cdSize = u32(buf, eocd + 12);
  let off = u32(buf, eocd + 16);
  if (total === 0xffff || off === 0xffffffff || cdSize === 0xffffffff) throw bad('zip64 is not supported');
  if (total > LIMITS.maxEntries) throw bad(`more than ${LIMITS.maxEntries} parts`);
  if (off + cdSize > buf.length) throw bad('the directory runs past the end of the file');
  const out = new Map();
  for (let n = 0; n < total; n++) {
    if (u32(buf, off) !== 0x02014b50) throw bad('bad directory signature');
    const method = u16(buf, off + 10);
    const csize = u32(buf, off + 20);
    const nlen = u16(buf, off + 28);
    const elen = u16(buf, off + 30);
    const clen = u16(buf, off + 32);
    const lho = u32(buf, off + 42);
    if (csize === 0xffffffff || lho === 0xffffffff) throw bad('zip64 is not supported');
    if (off + 46 + nlen > buf.length) throw bad('truncated directory entry');
    out.set(buf.toString('utf8', off + 46, off + 46 + nlen), { method, csize, lho });
    off += 46 + nlen + elen + clen;
  }
  return out;
}

function zipRead(buf, e, budget) {
  if (u32(buf, e.lho) !== 0x04034b50) throw bad('bad part signature');
  const start = e.lho + 30 + u16(buf, e.lho + 26) + u16(buf, e.lho + 28);
  if (start + e.csize > buf.length) throw bad('a part runs past the end of the file');
  const data = buf.subarray(start, start + e.csize);
  let out;
  if (e.method === 0) out = data;
  else if (e.method === 8) {
    try { out = zlib.inflateRawSync(data, { maxOutputLength: LIMITS.maxPartBytes }); } catch (err) {
      throw bad(err && err.code === 'ERR_BUFFER_TOO_LARGE' ? `a part inflates past ${Math.round(LIMITS.maxPartBytes / 1048576)} MB` : 'corrupt compressed data');
    }
  } else throw bad(`compression method ${e.method}`);
  budget.used += out.length;
  if (budget.used > LIMITS.maxTotalBytes) throw bad(`the parts inflate past ${Math.round(LIMITS.maxTotalBytes / 1048576)} MB in all`);
  return out;
}

// The document properties of a .pptx, for the neutral-metadata check.
function pptxCoreProperties(file) {
  if (fs.statSync(file).size > LIMITS.maxFileBytes) throw bad(`larger than ${Math.round(LIMITS.maxFileBytes / 1048576)} MB`);
  try {
    const buf = fs.readFileSync(file);
    const entries = zipEntries(buf);
    const budget = { used: 0 };
    const get = (n) => (entries.has(n) ? zipRead(buf, entries.get(n), budget).toString('utf8') : '');
    const core = get('docProps/core.xml');
    const tag = (name) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(core); return m ? xmlText(m[1]) : ''; };
    return { creator: tag('dc:creator'), lastModifiedBy: tag('cp:lastModifiedBy'), text: core + get('docProps/app.xml'), thumbnail: entries.has('docProps/thumbnail.jpeg') || entries.has('docProps/thumbnail.jpg') };
  } catch (e) {
    if (e instanceof DeckError) throw e;
    throw bad(e && e.code ? e.code : 'unreadable');
  }
}

function xmlText(s) {
  return s.replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function chartText(xml) {
  const out = [];
  (xml.match(/<a:t\b[^>]*>[\s\S]*?<\/a:t>/g) || []).forEach((t) => out.push(xmlText(t.replace(/<[^>]+>/g, ''))));
  (xml.match(/<c:strCache>[\s\S]*?<\/c:strCache>/g) || []).forEach((c) => (c.match(/<c:v>([\s\S]*?)<\/c:v>/g) || []).forEach((v) => out.push(xmlText(v.replace(/<[^>]+>/g, '')))));
  (xml.match(/<c:numCache>[\s\S]*?<\/c:numCache>/g) || []).forEach((c) => {
    const fmt = (/<c:formatCode>([\s\S]*?)<\/c:formatCode>/.exec(c) || [])[1] || '';
    (c.match(/<c:v>([\s\S]*?)<\/c:v>/g) || []).forEach((v) => {
      let x = parseFloat(v.replace(/<[^>]+>/g, ''));
      if (Number.isNaN(x)) return;
      if (fmt.includes('%')) x *= 100;
      out.push(String(Math.round(x * 1e6) / 1e6));
    });
  });
  return out.join(' ');
}

// The text of each slide, in slide order, whitespace collapsed, native chart contents included. Notes pages are not read.
function readPptxDeck(file) {
  try {
    return readPptxDeckUnsafe(file);
  } catch (e) {
    if (e instanceof DeckError) throw e;
    throw bad(e && e.code ? e.code : 'unreadable');
  }
}

function readPptxDeckUnsafe(file) {
  if (fs.statSync(file).size > LIMITS.maxFileBytes) throw bad(`larger than ${Math.round(LIMITS.maxFileBytes / 1048576)} MB`);
  const buf = fs.readFileSync(file);
  const entries = zipEntries(buf);
  const budget = { used: 0 };
  const read = (name) => (entries.has(name) ? zipRead(buf, entries.get(name), budget).toString('utf8') : null);
  let names = [];
  const pres = read('ppt/presentation.xml');
  const rels = read('ppt/_rels/presentation.xml.rels');
  if (pres && rels) {
    const target = {};
    (rels.match(/<Relationship\b[^>]*>/g) || []).forEach((tag) => {
      const id = /\bId="([^"]+)"/.exec(tag);
      const t = /\bTarget="([^"]+)"/.exec(tag);
      if (id && t) target[id[1]] = t[1].replace(/^\/?(ppt\/)?/, 'ppt/');
    });
    names = [...pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => target[m[1]]).filter(Boolean);
  }
  if (!names.length) {
    names = [...entries.keys()].filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]));
  }
  if (!names.length) throw bad('the file holds no slides');
  return names.map((n) => {
    const xml = read(n);
    if (xml === null) throw bad(`slide part ${n} is missing`);
    const paras = (xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) || []).map((p) => xmlText(
      p.replace(/<a:br\s*\/>/g, '<a:t> </a:t>').replace(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g, '\u0001$1\u0002').replace(/<[^>]+>/g, '')
        .replace(/\u0002[^\u0001]*\u0001/g, '').replace(/[\u0001\u0002]/g, '')));
    // native charts: titles, category labels and the cached values behind the bars and lines
    const relsXml = read(n.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels'));
    const charts = relsXml ? [...relsXml.matchAll(/Target="([^"]*charts\/chart\d+\.xml)"/g)].map((m) => 'ppt/' + m[1].replace(/^(\.\.\/|\/ppt\/)/, '')) : [];
    const chart = charts.map((c) => { const cx = read(c); return cx ? chartText(cx) : ''; }).join(' ').replace(/\s+/g, ' ').trim();
    return { text: paras.join(' ').replace(/\s+/g, ' ').trim(), chart };
  });
}

function readPptxSlides(file) {
  return readPptxDeck(file).map((s) => (s.text + ' ' + s.chart).trim());
}

const NUM_TOKEN = /\d[\d,]*(?:\.\d+)?/g;
// "2,562" and "2562" are the same figure, so commas are dropped before two figures are compared.
const numTokens = (s) => (String(s).match(NUM_TOKEN) || []).map((t) => t.replace(/,/g, '').replace(/\.+$/, ''));

function buildTableRows(buildSection) {
  const rows = {};
  [...buildSection.matchAll(/^\|\s*(s\d+)\s*\|\s*(.*?)\s*\|\s*$/gim)].forEach((m) => { rows[m[1].toLowerCase()] = m[2]; });
  return rows;
}

// Read the deck and compare it with the ledger and the Build table. Returns problems as strings.
function planDeckProblems(ctx, rel, text, ledger) {
  const out = [];
  const build = sectionText(text, '## Build') || '';
  const deckM = /^Deck:\s*(.+?)\s*$/m.exec(build);
  if (!deckM) return ['Build needs a "Deck: <path>" line'];
  const deckRel = deckM[1].replace(/`/g, '');
  const deckPath = path.join(ctx.root, deckRel);
  if (!fs.existsSync(deckPath)) return [`the deck file ${deckRel} does not exist`];
  if (!ledger || !Array.isArray(ledger.slides)) return ['the ledger is missing, so the deck cannot be compared with it'];
  const atBuild = hexRe('Deck sha256 at build').exec(build);
  if (!atBuild) out.push('Build needs a "Deck sha256 at build:" line followed by 64 hex digits (node scripts/check-process.js --hashes prints it)');
  else if (sha256(fs.readFileSync(deckPath)) !== atBuild[1]) out.push('the deck changed after Build recorded its hash. A changed deck needs a new Build.');
  let slides;
  try { slides = readPptxDeck(deckPath); } catch (e) { return [`the deck ${deckRel} cannot be read: ${e.message}`]; }
  if (slides.length !== ledger.slides.length) out.push(`the deck has ${slides.length} slides and the ledger has ${ledger.slides.length}`);
  const table = buildTableRows(build);
  const boardRows = {};
  [...(sectionText(text, '## Storyboard') || '').matchAll(/^\|\s*(s\d+)\s*\|.*$/gim)].forEach((m) => { boardRows[m[1].toLowerCase()] = m[0]; });
  ledger.slides.forEach((s, i) => {
    const id = String(s.id);
    const deckText = slides[i] === undefined ? undefined : (slides[i].text + ' ' + slides[i].chart).trim();
    const chartTok = new Set(slides[i] === undefined ? [] : numTokens(slides[i].chart));
    const tableText = table[id.toLowerCase()];
    if (deckText === undefined) return;
    const strip = (t) => (ledger.window ? t.split(ledger.window).join(' ') : t);
    if (tableText === undefined) out.push(`Build must record the text printed on slide ${id} (a "Text on the slide" table)`);
    const nums = s.numbers || [];
    const allowed = new Set();
    nums.forEach((n) => {
      const vt = numTokens(n.value);
      if (!slides[i].text.includes(n.value) && !(vt.length && vt.every((t) => chartTok.has(t)))) out.push(`slide ${id}: ledger number "${n.value}" is not printed in the deck (slide ${i + 1})`);
      numTokens(n.value).forEach((x) => allowed.add(x));
      (n.words || []).forEach((w) => { if (!deckText.toLowerCase().includes(String(w).toLowerCase())) out.push(`slide ${id}: the ledger records "${w}" but the deck does not print it`); });
    });
    const deckTok = numTokens(strip(deckText));
    deckTok.forEach((t) => { if (!allowed.has(t)) out.push(`slide ${id}: the deck prints ${t}, which is not in the ledger`); });
    if (tableText !== undefined) {
      const tableTok = new Set(numTokens(strip(tableText)));
      const deckSet = new Set(deckTok);
      deckSet.forEach((t) => { if (!tableTok.has(t)) out.push(`slide ${id}: the deck prints ${t} but the Build table does not`); });
      tableTok.forEach((t) => { if (!deckSet.has(t)) out.push(`slide ${id}: the Build table shows ${t} but the deck does not print it`); });
    }
    const covered = new Set(nums.flatMap((n) => (n.words || []).map((w) => String(w).toLowerCase())));
    ratioPhrases(deckText).forEach((p) => { if (!covered.has(p)) out.push(`slide ${id}: the deck prints "${p}", which the ledger does not record as a figure (add it as words on the number it describes)`); });
    if (boardRows[id.toLowerCase()]) {
      const cells = boardRows[id.toLowerCase()].split('|').map((c) => c.trim());
      numTokens(strip(`${cells[2] || ''} ${cells[3] || ''}`)).forEach((t) => { if (!allowed.has(t)) out.push(`slide ${id}: the storyboard prints ${t}, which is not in the ledger`); });
    }
    numTokens(s.claim).forEach((t) => { if (!allowed.has(t)) out.push(`slide ${id}: the ledger claim holds ${t}, which is not among the slide's ledger numbers`); });
    if (boardRows[id.toLowerCase()] && s.kind !== 'framing') {
      const src = (boardRows[id.toLowerCase()].split('|')[4] || '').trim().toLowerCase();
      const ls = String(s.source || '').trim().toLowerCase();
      if (src && ls && !src.includes(ls) && !ls.includes(src)) out.push(`slide ${id}: the storyboard names the source "${src}" but the ledger says "${ls}"`);
    }
    const lp = [...new Set(ratioPhrases(s.claim))].sort();
    const bp = boardRows[id.toLowerCase()] ? [...new Set(ratioPhrases(boardRows[id.toLowerCase()]))].sort() : [];
    if (lp.length && bp.length && lp.join() !== bp.join()) out.push(`slide ${id}: the ledger claim says "${lp.join(', ')}" but the storyboard says "${bp.join(', ')}"`);
  });
  return out;
}

// ---------------------------------------------------------------- handoff

function validateHandoff(text) {
  const errors = [];
  const t = text.replace(/\r\n/g, '\n').trim();
  if (!t.startsWith('# Handoff')) return ['must start with "# Handoff"'];
  const body = t.slice('# Handoff'.length).trim();
  if (body === EMPTY_HANDOFF) return [];
  const idx = body.indexOf('\n## Agent half');
  if (idx < 0) return [`needs a "## Agent half" section, or the exact sentence "${EMPTY_HANDOFF}"`];
  const human = body.slice(0, idx).trim();
  const agent = body.slice(idx + '\n## Agent half'.length).trim();
  if (/^#{1,6} /m.test(human)) errors.push('the human half holds a heading');
  const blocks = human.split(/\n\s*\n/).filter((b) => b.trim() !== '');
  if (blocks.length === 0) errors.push('the human half needs one plain paragraph');
  else {
    if (blocks[0].split('\n').some((l) => l.startsWith('- '))) errors.push('the human half must start with a plain paragraph, not bullets');
    if (blocks.length > 2) errors.push('the human half is a paragraph and at most one bullet list');
    if (blocks[1]) {
      const bl = blocks[1].split('\n');
      if (!bl.every((l) => l.startsWith('- '))) errors.push('the human half bullets must all start with "- "');
      if (bl.length > 5) errors.push(`the human half has ${bl.length} bullets, the limit is 5`);
    }
  }
  const lines = agent.split('\n').map((l) => l.trim()).filter(Boolean);
  let i = 0;
  if (lines[i] !== 'Start with carousel-start.') errors.push('the agent half must open with "Start with carousel-start."');
  else i++;
  if (!/^Recommended focus: (.+)$/.exec(lines[i] || '')) errors.push('the agent half needs one "Recommended focus: <line>"');
  else i++;
  ['Agent-doable:', 'Needs the human:', 'Out of scope:'].forEach((label) => {
    if (lines[i] !== label) { errors.push(`the agent half needs "${label}" in order`); return; }
    i++;
    let bullets = 0;
    while (i < lines.length && lines[i].startsWith('- ')) { bullets++; i++; }
    if (bullets === 0) errors.push(`"${label}" needs at least one bullet`);
  });
  if (i < lines.length) errors.push(`unexpected line in the agent half: "${lines[i]}"`);
  return errors;
}

// ---------------------------------------------------------------- the engine contract: carousel.config.json

const TOOL_NAME = /^[a-z][a-z0-9_-]*$/;
const TOOL_STATUS = ['PASS', 'FAIL', 'MISSING'];

// carousel.config.json keys:
//   engine.scan    a shell template with {deck} and {out}
//   engine.render  a shell template with {deck} and {out}
//   engine.tools   optional object: tool name to a shell template with {deck} and {out}
// A tool exits 0 (PASS), 1 (FAIL) or 2 (the tool or its runtime is missing: MISSING).
function validateEngineConfig(obj) {
  const errors = [];
  const tools = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { errors: ['carousel.config.json must be a JSON object'], tools };
  if (obj.engine === undefined) return { errors, tools };
  const e = obj.engine;
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { errors: ['"engine" must be an object'], tools };
  const add = (name, cmd, where) => {
    if (!TOOL_NAME.test(name)) { errors.push(`${where}: tool name "${name}" must be lowercase letters, digits, hyphen or underscore`); return; }
    if (typeof cmd !== 'string' || !cmd.includes('{deck}') || !cmd.includes('{out}')) { errors.push(`${where}: the command for "${name}" must be a string holding both {deck} and {out}`); return; }
    if (tools[name]) { errors.push(`${where}: tool "${name}" is registered twice`); return; }
    tools[name] = cmd;
  };
  ['scan', 'render'].forEach((k) => {
    if (e[k] === undefined) errors.push(`engine.${k} is required when "engine" is present`);
    else add(k, e[k], `engine.${k}`);
  });
  if (e.tools !== undefined) {
    if (!e.tools || typeof e.tools !== 'object' || Array.isArray(e.tools)) errors.push('engine.tools must be an object of name to command');
    else Object.keys(e.tools).forEach((k) => add(k, e.tools[k], `engine.tools.${k}`));
  }
  Object.keys(e).forEach((k) => { if (!['scan', 'render', 'tools'].includes(k)) errors.push(`engine.${k} is not a key the process reads (scan, render, tools)`); });
  return { errors, tools };
}

// A plan reads the config at the project root. The worked example reads its own folder, so a project's config never changes it.
function configPathFor(root, rel, example) {
  return path.join(root, example ? path.posix.dirname(rel) : '', 'carousel.config.json');
}

function readEngineConfig(root, file) {
  const t = readIf(file || path.join(root, 'carousel.config.json'));
  if (t === null) return { present: false, errors: [], tools: {}, raw: null };
  let obj;
  try { obj = JSON.parse(t); } catch (e) { return { present: true, errors: [`carousel.config.json is not valid JSON (${e.message})`], tools: {}, raw: t }; }
  const v = validateEngineConfig(obj);
  return { present: true, errors: v.errors, tools: v.tools, raw: t };
}

// ---------------------------------------------------------------- plan: the Reports state machine

function parseReports(text) {
  const errors = [];
  const events = [];
  const body = sectionText(text, '## Reports');
  if (body === null) return { events, errors };
  body.split('\n').forEach((raw, i) => {
    const line = raw.trim().replace(/^- /, '').replace(/^`|`$/g, '');
    if (!line || /^<.*>$/.test(line)) return;
    const f = FORMATS.find((x) => x.re.test(line));
    if (!f) { errors.push(`Reports line ${i + 1} matches no report format: "${line}"`); return; }
    const e = { id: f.id, line, n: i + 1 };
    let m;
    if (f.id === 'round' && (m = /^Challenge round (\d+) of (\d+): angle (.+?) \(new\)\. Re-verified (\d+) claims, demoted (\d+) to uncertainty\.$/.exec(line))) {
      Object.assign(e, { r: +m[1], t: +m[2], angle: m[3], verified: +m[4], demoted: +m[5] });
    } else if (f.id === 'check' && (m = /^Check report: path (engine|rubric); plan (PASS|FAIL); ledger (PASS|FAIL); tools (.+?); checklist (.+?); Deferred: (.+)\.$/.exec(line))) {
      Object.assign(e, { path: m[1], plan: m[2], ledger: m[3], tools: m[4], checklist: m[5], deferred: m[6] });
    } else if (f.id === 'build' && (m = /^Build report: (\d+) slides built, (\d+) ledger rows checked, (\d+) deviations logged\.$/.exec(line))) {
      Object.assign(e, { slides: +m[1], checked: +m[2], deviations: +m[3] });
    } else if (f.id === 'storyboard' && (m = /^Storyboard report: (\d+) slides, headlines-only read (holds|does not hold), ledger rows (\d+)\.$/.exec(line))) {
      Object.assign(e, { slides: +m[1], holds: m[2] === 'holds', rows: +m[3] });
    } else if (f.id === 'review' && (m = /^Review verdict: (PASS|REJECT|UNVERIFIABLE); unreconciled numbers (\d+); findings (\d+)\.$/.exec(line))) {
      Object.assign(e, { verdict: m[1], unreconciled: +m[2], findings: +m[3] });
    } else if (f.id === 'brief' && (m = /^Brief report: (\d+) questions asked, (\d+) answers recorded, (\d+) NEEDS HUMAN markers open\.$/.exec(line))) {
      Object.assign(e, { open: +m[3] });
    } else if (f.id === 'handoff' && (m = /^Handoff report: memory\/handoff\.md written; (\d+) bullets; focus (.+)\.$/.exec(line))) {
      Object.assign(e, { bullets: +m[1], focus: m[2] });
    } else if (f.id === 'stopped' && (m = /^Stopped at (\S+?): (.+)\.$/.exec(line))) {
      Object.assign(e, { at: m[1] });
    }
    events.push(e);
  });
  return { events, errors };
}

// Evaluate one Check event: is it clean, and is it internally consistent?
function judgeCheck(e) {
  const problems = [];
  const tools = [];
  if (e.tools !== 'none') {
    e.tools.split(', ').forEach((t) => {
      const m = /^([a-z][a-z0-9_-]*) (PASS|FAIL|MISSING)$/.exec(t);
      if (!m) problems.push(`the tools field must be "none" or "name PASS, name FAIL, name MISSING": "${t}"`);
      else tools.push({ name: m[1], res: m[2] });
    });
  }
  let clean = e.plan === 'PASS' && e.ledger === 'PASS' && tools.every((t) => t.res === 'PASS');
  const cm = /^(\d+) of (\d+)$/.exec(e.checklist);
  if (e.path === 'engine') {
    if (!tools.length) problems.push('the engine path records at least one tool result');
    if (e.checklist !== 'n/a') problems.push('the engine path reports checklist n/a');
  } else {
    if (tools.length) problems.push('the rubric path runs no tools, so the tools field says none');
    if (!cm) problems.push('the rubric path carries the checklist count as "<N> of <M>"');
    else {
      const n = +cm[1]; const m = +cm[2];
      if (!CHECKLIST_ITEMS.includes(m)) problems.push(`the checklist has 10 items, or 9 when item 9 (the render) cannot run; got ${m}`);
      if (n > m) problems.push('checklist passes exceed its items');
      if (n < m) clean = false;
      if (m === 9 && /^none$/i.test(e.deferred)) problems.push('a 9 item checklist must list item 9 under Deferred');
    }
  }
  tools.filter((t) => t.res === 'MISSING').forEach((t) => { if (/^none$/i.test(e.deferred)) problems.push(`tool ${t.name} is MISSING, so Deferred cannot be none`); });
  return { clean: clean && problems.length === 0, problems, toolList: tools };
}

const STATUS_AFTER = { start: 'started', brief: 'briefed', storyboard: 'storyboarded', build: 'built', review: 'reviewed', wrap: 'wrapped', handoff: 'wrapped' };

function allowedAfter(prev, rejects) {
  if (!prev) return ['start'];
  switch (prev.id) {
    case 'start': return ['brief', 'stopped'];
    case 'brief': return ['storyboard', 'stopped'];
    case 'storyboard': return ['round', 'stopped'];
    case 'round': return [prev.r < prev.t ? 'round' : 'build', 'stopped'];
    case 'build': return ['check', 'stopped'];
    case 'check': return [prev.clean ? 'review' : 'build', 'stopped'];
    case 'review':
      if (prev.verdict === 'PASS') return ['wrap'];
      if (prev.verdict === 'REJECT') return rejects >= MAX_REJECTS ? ['stopped'] : ['build', 'stopped'];
      return ['review', 'build', 'stopped'];
    case 'stopped': return ['wrap'];
    case 'wrap': return ['handoff'];
    default: return [];
  }
}

const EVIDENCE_WORD = /\b(recomputed|recounted|opened|ran|compared|re-derived|matches|traced|read)\b/i;
const hexRe = (label) => new RegExp(`^${label}: ([0-9a-f]{64})\\s*$`, 'm');

function handoffFacts(text) {
  const t = text.replace(/\r\n/g, '\n').trim();
  const body = t.replace(/^# Handoff/, '').trim();
  if (body === EMPTY_HANDOFF) return { bullets: 0, focus: 'none' };
  const idx = body.indexOf('\n## Agent half');
  const human = idx >= 0 ? body.slice(0, idx) : body;
  const bullets = (human.match(/^- /gm) || []).length;
  const f = /^Recommended focus: (.+)$/m.exec(body);
  return { bullets, focus: f ? f[1].trim().replace(/\.$/, '') : 'none' };
}

// The three hashes carousel-check records. Build is hashed as the trimmed text of its section.
function planHashes(ctx, rel, text) {
  const build = sectionText(text, '## Build') || '';
  const deckM = /^Deck:\s*(.+?)\s*$/m.exec(build);
  const deckPath = deckM ? path.join(ctx.root, deckM[1].replace(/`/g, '')) : null;
  const ledgerRaw = readIf(path.join(ctx.root, rel.replace(/\.md$/, '.ledger.json')));
  return {
    deck: deckPath && fs.existsSync(deckPath) ? sha256(fs.readFileSync(deckPath)) : null,
    ledger: ledgerRaw === null ? null : sha256(ledgerRaw),
    build: sha256(build),
  };
}

function deckRelOf(text) {
  const m = /^Deck:\s*(.+?)\s*$/m.exec(sectionText(text, '## Build') || '');
  return m ? m[1].replace(/`/g, '') : '';
}

function analyzePlan(ctx, rel, text, example) {
  const out = [];
  const err = (m) => out.push(`${rel}: ${m}`);
  const lines = scanLines(text);
  const heads = lines.filter((l) => !l.fenced && !l.fence && /^## /.test(l.line)).map((l) => l.line.slice(3).trim());
  let pos = -1;
  PLAN_SECTIONS.forEach((s) => {
    const i = heads.indexOf(s, pos + 1);
    if (i < 0) err(`missing or out of order section "## ${s}"`);
    else pos = i;
  });
  const sec = (name) => sectionText(text, `## ${name}`) || '';
  const statusM = /^Status: (.+)$/m.exec(text);
  const status = statusM ? statusM[1].trim() : null;

  const rep = parseReports(text);
  rep.errors.forEach(err);
  const events = rep.events;
  events.forEach((e) => { if (e.id === 'check') Object.assign(e, judgeCheck(e)); });
  events.filter((e) => e.id === 'check').forEach((e) => e.problems.forEach((p) => err(`Check report: ${p}`)));

  // order, with the REJECT cap
  let prev = null;
  let orderOk = true;
  let rejects = 0;
  for (const e of events) {
    const allowed = allowedAfter(prev, rejects);
    if (!allowed.includes(e.id)) {
      const why = prev && prev.id === 'review' && prev.verdict === 'REJECT' && rejects >= MAX_REJECTS ? ` After the second REJECT the plan needs a "Stopped at review" line.` : '';
      err(`Reports line ${e.n}: "${e.id}" cannot follow "${prev ? prev.id : 'nothing'}". Allowed next: ${allowed.join(', ') || 'nothing'}.${why}`);
      orderOk = false;
      break;
    }
    if (e.id === 'round') {
      const expect = prev && prev.id === 'round' ? prev.r + 1 : 1;
      if (e.r !== expect) { err(`challenge rounds must be numbered in order: expected ${expect}, got ${e.r}`); orderOk = false; break; }
      if (prev && prev.id === 'round' && prev.t !== e.t) { err('challenge round lines disagree about the total'); orderOk = false; break; }
    }
    if (e.id === 'review' && e.verdict === 'REJECT') rejects++;
    if (e.id === 'stopped') {
      const last = [...events.slice(0, events.indexOf(e))].reverse().find((x) => x.id !== 'stopped');
      if (!last || STOP_STAGE[last.id] !== e.at) { err(`Stopped at ${e.at}, but the last stage reported was ${last ? STOP_STAGE[last.id] || last.id : 'none'}`); orderOk = false; break; }
    }
    prev = e;
  }
  const real = events.filter((e) => e.id !== 'stopped');
  const lastReal = real[real.length - 1] || null;

  // status
  if (!status) err('Status line is missing');
  else {
    let expected = 'started';
    if (lastReal) {
      expected = lastReal.id === 'round' ? (lastReal.r === lastReal.t ? 'challenged' : 'storyboarded')
        : lastReal.id === 'check' ? (lastReal.clean ? 'checked' : 'built') : STATUS_AFTER[lastReal.id];
    }
    if (orderOk && status !== expected) err(`Status is "${status}" but the last report line is ${lastReal ? lastReal.id : 'absent'}, which means "${expected}"`);
  }

  // path and rounds
  const pathM = /^Path: (full|light)\s*$/m.exec(text);
  const roundsM = /^Rounds: (\d+)\s*$/m.exec(text);
  if (!pathM) err('Path line must be "Path: full" or "Path: light"');
  if (!roundsM) err('Rounds line must be a number');
  const rounds = roundsM ? +roundsM[1] : null;
  const roundEvents = events.filter((e) => e.id === 'round');
  if (pathM && rounds !== null) {
    const base = pathM[1] === 'full' ? 3 : 1;
    if (rounds < base) err(`the ${pathM[1]} path runs at least ${base} challenge round${base > 1 ? 's' : ''}`);
    if (rounds > base && !/Finding ledger/i.test(sec('Challenge log'))) err(`${rounds} rounds need a "Finding ledger" in Challenge log`);
  }
  if (roundEvents.length) {
    const T = roundEvents[0].t;
    if (rounds !== null && T !== rounds) err(`round lines say ${T} rounds but the Rounds line says ${rounds}`);
    const names = roundEvents.map((e) => e.angle.toLowerCase());
    if (new Set(names).size !== names.length) err('a challenge angle repeats across rounds');
    const angleDoc = readIf(path.join(ctx.root, 'bookshelf/review-angles.md'));
    const known = angleDoc ? scanLines(angleDoc).map((l) => /^### \d+\. (.+)$/.exec(l.line)).filter(Boolean).map((m) => m[1].trim().toLowerCase()) : [];
    roundEvents.forEach((e) => {
      if (known.length && !known.includes(e.angle.toLowerCase())) err(`round ${e.r} angle "${e.angle}" is not in bookshelf/review-angles.md`);
      if (e.verified < 1) err(`round ${e.r} re-verified no claims`);
      if (e.demoted > e.verified) err(`round ${e.r} demoted more claims than it re-verified`);
      const parked = e.angle.toLowerCase() === 'parked claims';
      if (T >= 2 && e.r === T && !parked) err(`the last of ${T} rounds must take the angle Parked claims`);
      if (parked && !(T >= 2 && e.r === T)) err('the angle Parked claims belongs to the last round of a plan with two or more rounds');
    });
    const log = sec('Challenge log');
    const parts = log.split(/^### Round (\d+)\s*$/m);
    const bodies = {};
    for (let i = 1; i < parts.length; i += 2) bodies[+parts[i]] = parts[i + 1];
    roundEvents.forEach((e) => {
      const b = bodies[e.r];
      if (b === undefined) { err(`Challenge log has no "### Round ${e.r}" section`); return; }
      const am = /^Angle: (.+?) \(new\)\s*$/m.exec(b);
      if (!am || am[1].toLowerCase() !== e.angle.toLowerCase()) err(`Round ${e.r} in Challenge log must say "Angle: ${e.angle} (new)"`);
      const cm = /Re-verified (\d+) claims, demoted (\d+) to uncertainty\./.exec(b);
      if (!cm || +cm[1] !== e.verified || +cm[2] !== e.demoted) err(`Round ${e.r} count line in Challenge log does not match its report line`);
      const addressed = /^Addressed:/m.test(b);
      const deferred = /^Deferred:/m.test(b);
      const kept = b.split('\n').filter((l) => /^Kept as is:/.test(l));
      if (!addressed && !deferred && !kept.length) err(`Round ${e.r} has no diff summary (Addressed, Deferred or Kept as is)`);
      if (!addressed && !deferred && !kept.every((l) => EVIDENCE_WORD.test(l))) err(`Round ${e.r} changed nothing, so every Kept as is line must say what was checked`);
    });
    if (roundEvents.length === T) {
      const pk = [...log.matchAll(/^Parked claims:\s*(.*)$/gm)];
      if (!pk.length || !/^none open\b/i.test(pk[pk.length - 1][1])) err('after the last round, Challenge log must end with "Parked claims: none open"');
      const parkedIds = new Set();
      pk.forEach((m) => { if (!/^none open\b/i.test(m[1])) (m[1].match(/\bs\d+\b/gi) || []).forEach((x) => parkedIds.add(x.toLowerCase())); });
      const lastBody = bodies[T] || '';
      const resolved = lastBody.split('\n').filter((l) => /^(Addressed|Kept as is):/.test(l)).join('\n').toLowerCase();
      parkedIds.forEach((id) => { if (!new RegExp(`\\b${id}\\b`).test(resolved)) err(`parked claim ${id} is not resolved in the last round's Addressed or Kept as is lines`); });
    }
  }

  // ledger
  const ledgerRel = rel.replace(/\.md$/, '.ledger.json');
  const ledgerRaw = readIf(path.join(ctx.root, ledgerRel));
  let ledger = null;
  if (events.some((e) => e.id === 'storyboard')) {
    if (ledgerRaw === null) err(`the ledger ${ledgerRel} is missing`);
    else { try { ledger = JSON.parse(ledgerRaw); } catch (e) { err(`${ledgerRel} is not valid JSON`); } }
  }
  const sb = events.find((e) => e.id === 'storyboard');
  if (sb && ledger && Array.isArray(ledger.slides)) {
    const tableIds = [...sec('Storyboard').matchAll(/^\|\s*(s\d+)\s*\|/gim)].map((m) => m[1].toLowerCase());
    const ledgerIds = ledger.slides.map((s) => String(s.id).toLowerCase());
    if (tableIds.length !== sb.slides) err(`Storyboard report says ${sb.slides} slides but the storyboard table has ${tableIds.length} rows`);
    if (sb.rows !== ledgerIds.length) err(`Storyboard report says ${sb.rows} ledger rows but the ledger has ${ledgerIds.length}`);
    if (tableIds.slice().sort().join() !== ledgerIds.slice().sort().join()) err('ledger ids and storyboard table ids differ');
    if (sb.holds) {
      const hl = sec('Storyboard').split(/^Headlines only:?\s*$/m)[1];
      const count = hl ? (hl.match(/^\d+\. /gm) || []).length : 0;
      if (count !== sb.slides) err(`the Headlines only block has ${count} lines for ${sb.slides} slides`);
    }
    const brief = sec('Brief');
    ['Literal ask', 'Reader and venue', 'Evidence'].forEach((f) => {
      const m = new RegExp(`^${f}:[ \\t]*(.*)$`, 'm').exec(brief);
      if (!m || !m[1].trim()) err(`Brief field "${f}" is empty`);
      else if (/NEEDS HUMAN:/.test(m[1])) err(`Brief field "${f}" is still a NEEDS HUMAN marker`);
    });
  }
  const br = events.find((e) => e.id === 'brief');
  if (br && lastReal && lastReal.id === 'brief') {
    const open = (sec('Brief').match(/NEEDS HUMAN:/g) || []).length;
    if (open !== br.open) err(`Brief report says ${br.open} open markers but Brief holds ${open}`);
  }

  // build
  const builds = events.filter((e) => e.id === 'build');
  const lastBuild = builds[builds.length - 1];
  if (lastBuild) {
    if (ledger && Array.isArray(ledger.slides)) {
      if (lastBuild.slides !== ledger.slides.length) err(`Build report says ${lastBuild.slides} slides but the ledger has ${ledger.slides.length}`);
      if (lastBuild.checked > lastBuild.slides) err('Build report counts more checked rows than slides');
      const settled = lastReal && (lastReal.id === 'build' || lastReal.id === 'check' || (lastReal.id === 'review' && lastReal.verdict === 'PASS') || lastReal.id === 'wrap' || lastReal.id === 'handoff');
      const checkedNow = ledger.slides.filter((s) => s.status === 'checked').length;
      if (settled && lastBuild.checked !== checkedNow) err(`Build report says ${lastBuild.checked} ledger rows checked but the ledger has ${checkedNow}`);
    }
    const d = (sec('Deviations').match(/^\s*(?:- )?D\d+:/gm) || []).length;
    if (lastBuild.deviations !== d) err(`Build report says ${lastBuild.deviations} deviations but Deviations lists ${d}`);
  }

  // check: tool results, hashes, and the deck itself
  const ids = events.map((e) => e.id);
  const lastCheckAt = ids.lastIndexOf('check');
  const lastBuildAt = ids.lastIndexOf('build');
  if (lastCheckAt > lastBuildAt && lastBuildAt >= 0) {
    const c = events[lastCheckAt];
    const chk = sec('Check');
    const dm = hexRe('Deck sha256').exec(chk);
    const bm = hexRe('Deck sha256 before tools').exec(chk);
    const lm = hexRe('Ledger sha256').exec(chk);
    const bsm = hexRe('Build sha256').exec(chk);
    if (!dm) err('Check needs "Deck sha256:" followed by 64 hex digits');
    if (!bm) err('Check needs "Deck sha256 before tools:" followed by 64 hex digits');
    if (!lm) err('Check needs "Ledger sha256:" followed by 64 hex digits');
    if (!bsm) err('Check needs "Build sha256:" followed by 64 hex digits');
    if (dm && bm && dm[1] !== bm[1]) err('a tool edited the deck: Deck sha256 differs from Deck sha256 before tools');
    const builtAs = hexRe('Deck sha256 at build').exec(sec('Build'));
    if (builtAs && bm && builtAs[1] !== bm[1]) err('the deck changed between Build and Check without a new Build (Deck sha256 at build differs from Deck sha256 before tools)');
    const now = planHashes(ctx, rel, text);
    if (lm && now.ledger !== null && now.ledger !== lm[1]) err('the ledger changed after the check (Ledger sha256 differs)');
    if (bsm && now.build !== bsm[1]) err('the Build section changed after the check (Build sha256 differs)');
    if (now.deck === null) err('the deck file named on the Build "Deck:" line does not exist');
    else if (dm && now.deck !== dm[1]) err('the deck changed after the check (Deck sha256 differs)');
    if (now.deck !== null) planDeckProblems(ctx, rel, text, ledger).forEach((p) => err(`the deck against the ledger: ${p}`));
    if (c.plan === 'PASS' && !/^PASS plan$/m.test(chk)) err('Check reports plan PASS, so it must paste the line "PASS plan" from the plan gate');
    if (c.ledger === 'PASS' && !/^PASS ledger$/m.test(chk)) err('Check reports ledger PASS, so it must paste the line "PASS ledger" from the ledger gate');
    // every tool line, against the report line and the config
    const lineTools = {};
    [...chk.matchAll(/^Tool ([a-z][a-z0-9_-]*): (PASS|FAIL|MISSING): (.+)$/gm)].forEach((m) => { lineTools[m[1]] = { res: m[2], line: m[3].trim() }; });
    const reported = {};
    (c.toolList || []).forEach((t) => { reported[t.name] = t.res; });
    Object.keys(lineTools).forEach((n) => { if (reported[n] === undefined) err(`Check records a result for tool ${n} that the Check report line does not list`); });
    Object.keys(reported).forEach((n) => {
      if (!lineTools[n]) err(`the Check report lists tool ${n} but Check holds no "Tool ${n}:" result line`);
      else if (lineTools[n].res !== reported[n]) err(`tool ${n} is ${reported[n]} in the report line but ${lineTools[n].res} in Check`);
    });
    {
      const cfgFile = configPathFor(ctx.root, rel, example);
      const cfg = readEngineConfig(ctx.root, cfgFile);
      cfg.errors.forEach((e) => err(`carousel.config.json: ${e}`));
      const registered = Object.keys(cfg.tools).sort();
      const recorded = Object.keys(lineTools).sort();
      recorded.filter((n) => !registered.includes(n)).forEach((n) => err(`Check records a result for tool ${n}, which carousel.config.json does not register`));
      registered.filter((n) => !recorded.includes(n)).forEach((n) => err(`carousel.config.json registers tool ${n} but Check holds no result for it`));
      if (registered.length && c.path === 'rubric') err('carousel.config.json registers tools, so Check must take the engine path');
      if (!registered.length && c.path === 'engine') err('Check took the engine path but carousel.config.json registers no engine');
      // run-tools.js writes the exit codes it saw. The Check section must say what that file says.
      const resultsRel = `decks/${path.basename(rel, '.md')}.check/tools.json`;
      const rf = readIf(path.join(ctx.root, resultsRel));
      if (registered.length && rf === null) err(`${resultsRel} is missing: carousel-check runs node scripts/run-tools.js, which writes it`);
      if (rf !== null) {
        let rj = null;
        try { rj = JSON.parse(rf); } catch (e) { err(`${resultsRel} is not valid JSON`); }
        if (rj && Array.isArray(rj.tools)) {
          const byName = {};
          rj.tools.forEach((t) => { byName[t.name] = t; });
          if (cfg.raw !== null && rj.configSha256 !== sha256(cfg.raw)) err(`${resultsRel} was written for a different carousel.config.json`);
          if (bm && rj.deckBefore !== bm[1]) err(`${resultsRel}: the deck hash before the tools differs from "Deck sha256 before tools" in Check`);
          if (dm && rj.deckAfter !== dm[1]) err(`${resultsRel}: the deck hash after the tools differs from "Deck sha256" in Check`);
          registered.forEach((n) => { if (!byName[n]) err(`${resultsRel} holds no result for registered tool ${n}`); });
          rj.tools.forEach((t) => {
            if (runTools.statusFor(t.exit) !== t.status) err(`${resultsRel}: tool ${t.name} exited ${t.exit}, which is ${runTools.statusFor(t.exit)}, but the file says ${t.status}`);
            if (cfg.tools[t.name] && t.command !== runTools.expandCommand(cfg.tools[t.name], deckRelOf(text), `decks/${path.basename(rel, '.md')}.check`)) err(`${resultsRel}: tool ${t.name} ran a command that differs from the one in carousel.config.json`);
            const l = lineTools[t.name];
            if (!l) err(`${resultsRel} holds a result for tool ${t.name} that Check does not record`);
            else {
              if (l.res !== t.status) err(`Check records tool ${t.name} as ${l.res} but run-tools.js recorded ${t.status}`);
              if (l.line !== String(t.line).trim()) err(`Check records a result line for tool ${t.name} that differs from the one run-tools.js recorded`);
            }
          });
        }
      }
    }
  }

  // review
  const reviews = events.filter((e) => e.id === 'review');
  if (reviews.length) {
    if (ledger) validateLedger(ledger, { final: true, today: ctx.today }).forEach((e) => err(`${ledgerRel}: ${e}`));
    const lastRev = reviews[reviews.length - 1];
    if (lastRev.verdict === 'PASS') {
      if (lastRev.unreconciled !== 0) err('a PASS review cannot report unreconciled numbers');
      const full = sec('Review');
      const lastHead = full.lastIndexOf('\n### ');
      const rv = lastHead >= 0 ? full.slice(lastHead) : full;
      if (!/PASS ledger/.test(rv) || !/Ledger: \d+ slides, \d+ checked, 0 open, 0 rejected, 0 unreconciled numbers/.test(rv)) err('a PASS Review must paste the ledger gate output (the "Ledger:" line and "PASS ledger")');
      if (!/PASS plan/.test(rv)) err('a PASS Review must paste the plan gate output (the line "PASS plan")');
      if (ledger && Array.isArray(ledger.slides)) {
        ledger.slides.forEach((s) => (s.numbers || []).forEach((n) => {
          const m = new RegExp('^[-*] ' + esc(s.id) + ' ' + esc(n.value) + ':(.*)$', 'mi').exec(rv);
          if (!m) { err(`a PASS Review must hold a line "- ${s.id} ${n.value}: <what you did>, found <value>"`); return; }
          const f = /,\s*found (.+?)\s*$/.exec(m[1]);
          const found = f ? f[1].replace(/\.$/, '') : null;
          if (found !== n.value) err(`Review line for ${s.id} ${n.value} says found "${found}", which differs from the ledger value`);
        }));
      }
    }
    reviews.forEach((e) => { if (e.verdict === 'REJECT' && e.findings < 1 && e.unreconciled < 1) err('a REJECT names at least one finding'); });
  }

  // the worked example keeps its handoff in its own folder, and the report line must match it
  const hand = events.find((e) => e.id === 'handoff');
  if (hand && example) {
    const hf = readIf(path.join(ctx.root, rel.replace(/\.md$/, '.handoff.md')));
    if (hf === null) err(`the example's handoff ${rel.replace(/\.md$/, '.handoff.md')} is missing`);
    else {
      validateHandoff(hf).forEach((e) => err(`example handoff: ${e}`));
      const f = handoffFacts(hf);
      if (f.bullets !== hand.bullets) err(`Handoff report says ${hand.bullets} bullets but the handoff file has ${f.bullets}`);
      if (f.focus !== hand.focus) err(`Handoff report says focus "${hand.focus}" but the handoff file says "${f.focus}"`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- checks

function budget(ctx) {
  const out = [];
  const c = ctx.config;
  const size = (rel) => { const t = readIf(path.join(ctx.root, rel)); return t === null ? null : Buffer.byteLength(t); };
  const rules = size('RULES.md');
  if (rules === null) out.push('RULES.md is missing');
  else if (rules > c.rulesMaxBytes) out.push(`RULES.md is ${rules} bytes, the cap is ${c.rulesMaxBytes}`);
  ['AGENTS.md', 'CLAUDE.md'].forEach((f) => {
    const s = size(f);
    if (s === null) out.push(`${f} is missing`);
    else if (s > c.pointerMaxBytes) out.push(`${f} is ${s} bytes, the cap is ${c.pointerMaxBytes}`);
  });
  const stages = skills.stageNames(ctx.root);
  if (!stages.length) out.push(`${STAGE_DIR}/ holds no stage`);
  stages.map(stageFile).concat(skills.agentNames(ctx.root).map((f) => `${skills.AGENTS}/${f}`)).forEach((rel) => {
    const s = size(rel);
    if (s > c.stageMaxBytes) out.push(`${rel} is ${s} bytes, the cap is ${c.stageMaxBytes}`);
  });
  return out;
}

const PATH_TOKEN = /^(?:(?:bookshelf|\.agents|agents|docs|memory|plans|scripts|engine|tests)\/[^\s<>*]*|(?:RULES|AGENTS|CLAUDE|README|cheatsheet)\.md(?:#\S*)?)$/;

function deadrefs(ctx) {
  const out = [];
  const engine = fs.existsSync(path.join(ctx.root, 'engine'));
  const cmdNames = new Set();
  skills.stageNames(ctx.root).forEach((n) => cmdNames.add(n));
  skills.agentNames(ctx.root).forEach((f) => cmdNames.add(f.replace(/\.md$/, '')));
  const headingCache = new Map();
  const headingsFor = (rel) => {
    if (!headingCache.has(rel)) {
      const t = readIf(path.join(ctx.root, rel));
      headingCache.set(rel, t === null ? null : headingsOf(t));
    }
    return headingCache.get(rel);
  };
  const checkAnchor = (where, rel, frag) => {
    if (!frag || !rel.endsWith('.md')) return;
    const hs = headingsFor(rel);
    if (hs && !hs.some((h) => slug(h) === frag.toLowerCase())) out.push(`${where}: no heading "#${frag}" in ${rel}`);
  };
  const missingOk = (rel) => ctx.config.allowMissing.includes(rel);
  const checkToken = (where, raw) => {
    let tok = raw.replace(/^[("']+/, '').replace(/[.,;:)"']+$/, '');
    if (!PATH_TOKEN.test(tok)) return;
    if (/YYYY|\.\.\.|[{}]/.test(tok)) return;
    const frag = tok.includes('#') ? tok.split('#')[1] : '';
    tok = tok.split('#')[0];
    if (!engine && (tok.startsWith('engine/') || tok === 'scripts/engine.js' || (tok.startsWith('tests/') && !tok.startsWith('tests/process')))) return;
    if (missingOk(tok)) return;
    if (!fs.existsSync(path.join(ctx.root, tok))) { out.push(`${where}: \`${tok}\` does not exist`); return; }
    checkAnchor(where, tok, frag);
  };
  ctx.prose.forEach((rel) => {
    const text = readIf(path.join(ctx.root, rel));
    const dir = path.posix.dirname(rel);
    scanLines(text).forEach((l) => {
      const where = `${rel}:${l.n}`;
      if (l.fence) return;
      if (l.fenced) {
        const toks = l.line.trim().split(/\s+/);
        if (/^(node|python3)$/.test(toks[0]) || toks.length === 1) toks.forEach((t) => checkToken(where, t));
        return;
      }
      let m;
      const linkRe = /\[[^\]]*\]\(([^)\s]+)\)/g;
      while ((m = linkRe.exec(l.line))) {
        const href = m[1];
        if (/^[a-z]+:/i.test(href)) continue;
        const [p, frag] = href.split('#');
        const target = p === '' ? rel : path.posix.normalize(path.posix.join(dir, p));
        if (!fs.existsSync(path.join(ctx.root, target))) { if (!missingOk(target)) out.push(`${where}: link target ${href} does not exist`); continue; }
        checkAnchor(where, target, frag);
      }
      const spanRe = /`([^`]+)`/g;
      while ((m = spanRe.exec(l.line))) {
        const span = m[1];
        const cm = /^(carousel-[a-z-]+)$/.exec(span);
        if (cm && !cmdNames.has(cm[1]) && !ctx.config.nonCommandNames.includes(cm[1])) out.push(`${where}: \`${cm[1]}\` is not a stage in ${STAGE_DIR}/ or an agent in ${skills.AGENTS}/`);
        const toks = span.trim().split(/\s+/);
        if (toks.length === 1 || /^(node|python3)$/.test(toks[0])) toks.forEach((t) => checkToken(where, t));
      }
      const citeRe = /([A-Za-z0-9_.\/-]+\.md), "([^"]+)"/g;
      while ((m = citeRe.exec(l.line))) {
        let target = m[1];
        if (!fs.existsSync(path.join(ctx.root, target))) target = path.posix.join(dir, m[1]);
        if (!fs.existsSync(path.join(ctx.root, target))) { out.push(`${where}: cited file ${m[1]} does not exist`); continue; }
        const hs = headingsFor(target);
        if (hs && !hs.some((h) => h.toLowerCase() === m[2].toLowerCase())) out.push(`${where}: no heading "${m[2]}" in ${m[1]}`);
      }
    });
  });
  return out;
}

function wiki(ctx) {
  const out = [];
  const dir = path.join(ctx.root, 'memory/wiki');
  const index = readIf(path.join(dir, 'INDEX.md'));
  if (index === null) return ['memory/wiki/INDEX.md is missing'];
  const pages = walkAny(ctx.root, 'memory/wiki', '.md').map((p) => p.slice('memory/wiki/'.length)).filter((p) => p !== 'INDEX.md');
  const linked = new Set();
  const linkRe = /\[[^\]]*\]\(([^)\s]+)\)/g;
  let m;
  while ((m = linkRe.exec(index))) {
    const href = m[1];
    if (/^[a-z]+:/i.test(href)) continue;
    const target = path.posix.normalize(href.split('#')[0]);
    if (!fs.existsSync(path.join(dir, target))) out.push(`INDEX.md links to ${href}, which does not exist`);
    else linked.add(target);
  }
  pages.forEach((p) => { if (!linked.has(p)) out.push(`memory/wiki/${p} is not listed in INDEX.md`); });
  return out;
}

function contract(ctx) {
  const out = [];
  const rules = readIf(path.join(ctx.root, 'RULES.md')) || '';
  const readme = readIf(path.join(ctx.root, STAGE_INDEX)) || '';
  RULES_PINS.forEach((p) => { if (!rules.includes(p)) out.push(`RULES.md must keep: ${p}`); });
  STAGES.filter((x) => x.guard.length).forEach((x) => {
    const row = rules.split('\n').find((l) => l.startsWith(`| \`${x.name}\` |`));
    if (!row) out.push(`RULES.md chain table has no row for ${x.name}`);
    else if (!row.includes(x.guard[0])) out.push(`RULES.md chain table row for ${x.name} must key on: ${x.guard[0]}`);
  });
  STAGES.forEach((st) => {
    const file = stageFile(st.name);
    const raw = readIf(path.join(ctx.root, file));
    if (raw === null) { out.push(`${file} is missing`); return; }
    const text = skills.splitFrontMatter(raw).body;
    const lines = text.split('\n');
    if (lines[0].trim() !== `# ${st.name}`) out.push(`${file}: first line must be "# ${st.name}"`);
    const head = lines.slice(0, 10);
    ['Job: ', 'Reads: ', 'Writes: ', 'Exit check: '].forEach((p) => {
      const l = head.find((x) => x.startsWith(p));
      if (!l || l.length < p.length + 10) out.push(`${file}: needs a "${p.trim()}" line near the top`);
    });
    let pos = -1;
    ANATOMY.forEach((h) => {
      const at = lines.findIndex((l, i) => l.trim() === h && i > pos);
      if (at < 0) out.push(`${file}: missing or out of order: "${h}"`);
      else pos = at;
    });
    if (!text.includes(st.report)) out.push(`${file}: exact report string not found: ${st.report}`);
    (st.extra || []).forEach((s) => { if (!text.includes(s)) out.push(`${file}: required text not found: ${s}`); });
    const guards = sectionText(text, '## Guards');
    if (guards !== null) {
      if (!/Decline/.test(guards)) out.push(`${file}: Guards must say what the stage declines`);
      st.guard.forEach((g) => { if (!guards.includes(g)) out.push(`${file}: Guards must key on the previous stage's line: ${g}`); });
    }
    if (st.id !== 'brief') {
      const steps = sectionText(text, '## Steps') || '';
      if (/\bask(s)? (the human|the person|the reader|the user|you|them)\b/i.test(steps)) out.push(`${file}: Steps tell the stage to ask the human a question, and only carousel-brief asks questions`);
    }
    Object.keys(st.must || {}).forEach((name) => {
      const body = sectionText(text, `## ${name}`);
      if (body === null) return;
      st.must[name].forEach((s) => { if (!body.includes(s)) out.push(`${file}: ${name} must keep: ${s}`); });
    });
    const nrs = sectionText(text, '## No-rubber-stamp guard');
    if (nrs !== null && (nrs.length < 200 || !/fake/i.test(nrs))) out.push(`${file}: the No-rubber-stamp guard must name what a fake pass looks like (200+ characters, uses "fake")`);
    const why = sectionText(text, '## Rationale');
    if (why !== null && why.length < 100) out.push(`${file}: Rationale is too short`);
    if (!rules.includes(st.name)) out.push(`RULES.md does not name ${st.name}`);
    if (!readme.includes(`(${st.name}/SKILL.md)`)) out.push(`${STAGE_INDEX} does not link ${st.name}`);
  });
  return out;
}

// ---- spelling: American English. Quotes, code and proper nouns are left alone.

const AM_MAP = {
  colour: 'color', colours: 'colors', coloured: 'colored', colouring: 'coloring', colourful: 'colorful',
  behaviour: 'behavior', behaviours: 'behaviors', behavioural: 'behavioral',
  flavour: 'flavor', flavours: 'flavors', flavoured: 'flavored', flavouring: 'flavoring',
  favour: 'favor', favours: 'favors', favoured: 'favored', favourite: 'favorite', favourites: 'favorites',
  honour: 'honor', honours: 'honors', honoured: 'honored', labour: 'labor', humour: 'humor', odour: 'odor', savour: 'savor',
  rumour: 'rumor', vapour: 'vapor', neighbour: 'neighbor', endeavour: 'endeavor', armour: 'armor', harbour: 'harbor',
  organise: 'organize', organised: 'organized', organising: 'organizing', organisation: 'organization', organisations: 'organizations',
  optimise: 'optimize', optimised: 'optimized', optimising: 'optimizing', optimisation: 'optimization',
  normalise: 'normalize', normalised: 'normalized', normalising: 'normalizing', normalisation: 'normalization',
  standardise: 'standardize', standardised: 'standardized', customise: 'customize', customised: 'customized',
  prioritise: 'prioritize', prioritised: 'prioritized', summarise: 'summarize', summarised: 'summarized',
  categorise: 'categorize', categorised: 'categorized', recognise: 'recognize', recognises: 'recognizes',
  recognised: 'recognized', recognisable: 'recognizable', realise: 'realize', realised: 'realized', realising: 'realizing',
  analyse: 'analyze', analysed: 'analyzed', analysing: 'analyzing', emphasise: 'emphasize', apologise: 'apologize', utilise: 'use',
  centre: 'center', centres: 'centers', centred: 'centered', fibre: 'fiber', fibres: 'fibers', litre: 'liter', litres: 'liters',
  metre: 'meter', metres: 'meters', grey: 'gray', greyed: 'grayed',
  labelled: 'labeled', labelling: 'labeling', modelled: 'modeled', modelling: 'modeling',
  cancelled: 'canceled', cancelling: 'canceling', travelled: 'traveled', travelling: 'traveling',
  fuelled: 'fueled', signalled: 'signaled', totalled: 'totaled', programme: 'program', programmes: 'programs',
  licence: 'license', defence: 'defense', offence: 'offense', practise: 'practice', practised: 'practiced',
  sceptic: 'skeptic', sceptical: 'skeptical', scepticism: 'skepticism', whilst: 'while', amongst: 'among', maths: 'math',
  judgement: 'judgment', acknowledgement: 'acknowledgment', speciality: 'specialty', enquiry: 'inquiry', enquiries: 'inquiries',
  aluminium: 'aluminum', storey: 'story', kerb: 'curb', tyre: 'tire', cheque: 'check', draught: 'draft', plough: 'plow',
  aeroplane: 'airplane', moustache: 'mustache', pyjamas: 'pajamas',
};
const AM_ALLOW = ['colourpop', 'labour party', 'labour government', 'the colour run', 'world health organisation', 'centre for', 'theatre royal'];
const AM_WORDS = new RegExp('\\b(' + Object.keys(AM_MAP).sort((a, b) => b.length - a.length).join('|') + ')\\b', 'gi');
const AM_QUOTED = [/<blockquote>[\s\S]*?<\/blockquote>/gi, /"(?:verbatim|quote|text)"\s*:\s*"[^"]*"/gi, /^\s*>.*$/gm];
const AM_BAN = /\b(never|avoid|ban(ned)?|instead of|do not use|no)\b/i;
const blank = (m) => m.replace(/[^\n]/g, ' ');

function spellingProblems(text, extraAllow) {
  const allow = AM_ALLOW.concat((extraAllow || []).map((s) => s.toLowerCase()));
  let masked = scanLines(text).map((l) => (l.fence || l.fenced ? blank(l.line) : l.line.replace(/`[^`]*`/g, blank))).join('\n');
  AM_QUOTED.forEach((re) => { masked = masked.replace(re, blank); });
  const low = masked.toLowerCase();
  const allowed = [];
  allow.forEach((name) => { for (let i = low.indexOf(name); i !== -1; i = low.indexOf(name, i + 1)) allowed.push([i, i + name.length]); });
  const lineStarts = [0];
  masked.split('\n').forEach((l) => lineStarts.push(lineStarts[lineStarts.length - 1] + l.length + 1));
  const lineOf = (pos) => { let lo = 0; let hi = lineStarts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
  const perLine = {};
  const hits = [...masked.matchAll(AM_WORDS)];
  hits.forEach((m) => { const l = lineOf(m.index); perLine[l] = (perLine[l] || 0) + 1; });
  const out = [];
  hits.forEach((m) => {
    if (allowed.some(([a, b]) => a <= m.index && m.index < b)) return;
    const l = lineOf(m.index);
    const lineText = masked.slice(lineStarts[l], lineStarts[l + 1] === undefined ? undefined : lineStarts[l + 1] - 1);
    if (perLine[l] >= 5 || (perLine[l] >= 2 && AM_BAN.test(lineText)) || /spell-ok/.test(lineText)) return;
    const before = m.index ? masked[m.index - 1] : ' ';
    const after = masked[m.index + m[0].length] || ' ';
    if ('-_/.'.includes(before) || '-_/'.includes(after)) return;
    out.push({ line: l + 1, word: m[0], better: AM_MAP[m[0].toLowerCase()] });
  });
  return out;
}

function stripInline(line) {
  return line.replace(/`[^`]*`/g, '');
}

// ---- scrub: nothing in shipped prose may describe a particular private engine.

function jsonKeys(obj, out) {
  if (Array.isArray(obj)) obj.forEach((x) => jsonKeys(x, out));
  else if (obj && typeof obj === 'object') Object.keys(obj).forEach((k) => { out.add(k); jsonKeys(obj[k], out); });
  return out;
}

function scrubAllowed(ctx) {
  const ok = new Set(ctx.config.scrubAllow || []);
  ['carousel.config.example.json', 'plans/ledger.template.json'].forEach((f) => {
    const t = readIf(path.join(ctx.root, f));
    if (t === null) return;
    try { jsonKeys(JSON.parse(t), new Set()).forEach((k) => ok.add(k)); } catch (e) { /* reported by state */ }
  });
  return ok;
}

const SNAKE_SPAN = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g;

function scrubProblems(rel, text, allowed) {
  const out = [];
  scanLines(text).forEach((l) => {
    const where = `${rel}:${l.n}`;
    if (/deck_(kit|scan)/i.test(l.line)) out.push(`${where}: names a private engine module (deck_kit, deck_scan)`);
    if (/\bchecks? \d+[a-z]?\b/i.test(l.line)) out.push(`${where}: cites a scanner check by number`);
    if (/#[0-9a-fA-F]{6}\b/.test(l.line)) out.push(`${where}: a six digit hex color (colors belong in your own design tokens file)`);
    if (l.fence || l.fenced) return;
    let m;
    SNAKE_SPAN.lastIndex = 0;
    while ((m = SNAKE_SPAN.exec(l.line))) {
      if (!allowed.has(m[1])) out.push(`${where}: the identifier \`${m[1]}\` looks like a private engine name (add it to scrubAllow in the config if it is legitimate)`);
    }
  });
  return out;
}

// A range written with a hyphen between two numbers, such as 5-10, in prose. Dates and ids are left alone.
const NUM_RANGE = /(?<![\w./-])\d+(?:\.\d+)?-\d+(?:\.\d+)?(?![\w-])/;

function prose(ctx) {
  const out = [];
  const words = ctx.config.bannedWords.map((w) => ({ w, re: new RegExp('(^|[^A-Za-z0-9])' + esc(w) + '(?![A-Za-z0-9])', 'i') }));
  const pats = ctx.config.bannedPatterns.map((p) => ({ p, re: new RegExp(p, 'i') }));
  const allowed = scrubAllowed(ctx);
  ctx.prose.forEach((rel) => {
    const text = readIf(path.join(ctx.root, rel));
    scanLines(text).forEach((l) => {
      const where = `${rel}:${l.n}`;
      if (/[—–]/.test(l.line)) out.push(`${where}: em dash or en dash`);
      if (l.fence || l.fenced) return;
      const plain = stripInline(l.line);
      if (/(?<=\S) -{1,2} (?=\S)/.test(plain)) out.push(`${where}: spaced hyphen used as punctuation`);
      const rg = NUM_RANGE.exec(plain);
      if (rg) out.push(`${where}: hyphenated number range "${rg[0]}", write "${rg[0].replace('-', ' to ')}"`);
      words.forEach((b) => { if (b.re.test(plain)) out.push(`${where}: banned word "${b.w}"`); });
      pats.forEach((b) => { if (b.re.test(plain)) out.push(`${where}: banned pattern ${b.p}`); });
    });
    if (!rel.startsWith('docs/gallery/')) scrubProblems(rel, text, allowed).forEach((p) => out.push(p));
    spellingProblems(text, ctx.config.americanAllow).forEach((h) => out.push(`${rel}:${h.line}: British spelling "${h.word}", write "${h.better}"`));
  });
  return out;
}

function planFiles(ctx) {
  return walkAny(ctx.root, 'plans', '.md').filter((p) => p !== 'plans/plan.template.md' && !p.endsWith('.handoff.md'));
}

function state(ctx) {
  const out = [];
  const today = ctx.today;
  const log = readIf(path.join(ctx.root, 'memory/LOG.md'));
  if (log === null) out.push('memory/LOG.md is missing');
  else {
    rotate.checkLogText(log).forEach((e) => out.push(`memory/LOG.md: ${e}`));
    try { rotate.parseLog(log).entries.forEach((e) => { if (e.date > today) out.push(`memory/LOG.md: the entry dated ${e.date} is in the future (today is ${today})`); }); } catch (e) { /* reported above */ }
  }
  const logTemplate = readIf(path.join(ctx.root, 'memory/LOG.template.md'));
  if (logTemplate !== null) {
    try {
      if (rotate.parseLog(logTemplate).entries.length) out.push('memory/LOG.template.md must hold the header and format note only, no entries');
    } catch (e) { out.push(`memory/LOG.template.md: ${e.message}`); }
  }
  let handoff = null;
  ['memory/handoff.md', 'memory/handoff.template.md'].forEach((f) => {
    const t = readIf(path.join(ctx.root, f));
    if (t === null) { out.push(`${f} is missing`); return; }
    if (f === 'memory/handoff.md') handoff = t;
    validateHandoff(t).forEach((e) => out.push(`${f}: ${e}`));
  });
  const les = readIf(path.join(ctx.root, 'memory/wiki/lessons.md'));
  if (les === null) out.push('memory/wiki/lessons.md is missing');
  else {
    const hist = readIf(path.join(ctx.root, 'memory/wiki/lessons.history')) || '';
    const archiveIds = [];
    ['memory/history/expired-lessons.md', 'memory/history/retired-rules.md'].forEach((f) => {
      (readIf(path.join(ctx.root, f)) || '').split('\n').forEach((l) => { const m = /^- ([LR]-[0-9a-f]{6}) \|/.exec(l); if (m) archiveIds.push(m[1]); });
    });
    lessons.validate(les, today, hist, archiveIds).forEach((e) => out.push(e.startsWith('WARN ') ? e : (e.startsWith('lessons.history') ? `memory/wiki/${e}` : `memory/wiki/lessons.md: ${e}`)));
  }
  const doc = readIf(path.join(ctx.root, 'bookshelf/lessons.md'));
  [['EXPIRY_DAYS', ' days'], ['MAX_RULES', ' rules'], ['RULE_REVIEW_DAYS', ' days']].forEach(([k, unit]) => {
    if (doc !== null && !doc.includes(`${lessons[k]}${unit}`)) out.push(`bookshelf/lessons.md must state ${lessons[k]}${unit} (${k} in scripts/lessons.js)`);
  });
  const rules = readIf(path.join(ctx.root, 'RULES.md'));
  if (rules !== null && !rules.includes(`${lessons.EXPIRY_DAYS} days`)) out.push(`RULES.md must state the expiry period (${lessons.EXPIRY_DAYS} days)`);
  if (rules !== null && !/self-attested/.test(rules)) out.push('RULES.md must say that the human-confirmation flag is self-attested');
  const template = readIf(path.join(ctx.root, 'plans/plan.template.md'));
  if (template === null) out.push('plans/plan.template.md is missing');
  else {
    const heads = scanLines(template).filter((l) => !l.fenced && !l.fence && /^## /.test(l.line)).map((l) => l.line.slice(3).trim());
    if (heads.join('|') !== PLAN_SECTIONS.join('|')) out.push(`plans/plan.template.md sections must be: ${PLAN_SECTIONS.join(', ')}`);
  }
  ['carousel.config.json', 'carousel.config.example.json'].forEach((f) => {
    const t = readIf(path.join(ctx.root, f));
    if (t === null) return;
    try {
      const v = validateEngineConfig(JSON.parse(t));
      v.errors.forEach((e) => out.push(`${f}: ${e}`));
      if (f.endsWith('example.json') && !Object.keys(v.tools).length) out.push(`${f}: the sample must register a scan and a render command`);
    } catch (e) { out.push(`${f}: not valid JSON (${e.message})`); }
  });
  // a deck shipped in the repository must carry neutral document properties
  const neutral = ctx.config.neutralPptxCreator || 'Carousel OS example';
  ['plans', 'docs'].forEach((dir) => walkAny(ctx.root, dir, '.pptx').forEach((rel) => {
    try {
      const m = pptxCoreProperties(path.join(ctx.root, rel));
      if (m.creator !== neutral) out.push(`${rel}: docProps creator is "${m.creator}", and a shipped deck carries only "${neutral}"`);
      if (m.lastModifiedBy !== neutral) out.push(`${rel}: docProps lastModifiedBy is "${m.lastModifiedBy}", and a shipped deck carries only "${neutral}"`);
      if (/generated using|python-pptx/i.test(m.text)) out.push(`${rel}: the document properties hold a generator string`);
      if (m.thumbnail) out.push(`${rel}: the deck carries a template thumbnail image`);
    } catch (e) { out.push(`${rel}: ${e.message}`); }
  }));
  planFiles(ctx).forEach((rel) => {
    analyzePlan(ctx, rel, readIf(path.join(ctx.root, rel)), rel.startsWith('plans/example/')).forEach((e) => out.push(e));
  });
  const tl = readIf(path.join(ctx.root, 'plans/ledger.template.json'));
  if (tl === null) out.push('plans/ledger.template.json is missing');
  else {
    try { validateLedger(JSON.parse(tl), { template: true }).forEach((e) => out.push(`plans/ledger.template.json: ${e}`)); } catch (e) { out.push(`plans/ledger.template.json: ${e.message}`); }
  }
  walkAny(ctx.root, 'plans', '.ledger.json').forEach((rel) => {
    try {
      const obj = JSON.parse(readIf(path.join(ctx.root, rel)));
      validateLedger(obj, { today }).forEach((e) => out.push(`${rel}: ${e}`));
    } catch (e) { out.push(`${rel}: ${e.message}`); }
  });
  return out;
}

// The handoff may say "nothing to hand off" only when no plan holds open work.
function handoffCheck(ctx) {
  const handoff = readIf(path.join(ctx.root, 'memory/handoff.md'));
  if (handoff === null || !handoff.includes(EMPTY_HANDOFF) || validateHandoff(handoff).length) return [];
  const out = [];
  planFiles(ctx).filter((rel) => !rel.startsWith('plans/example/')).forEach((rel) => {
    const text = readIf(path.join(ctx.root, rel));
    const stripped = text.split('\n').filter((l) => !/RESOLVED:/.test(l)).join('\n');
    if (/NEEDS HUMAN:/.test(stripped)) out.push(`${rel} holds an open NEEDS HUMAN marker, so memory/handoff.md cannot say there is nothing to hand off`);
    const v = parseReports(text).events.filter((e) => e.id === 'review');
    if (v.length && v[v.length - 1].verdict !== 'PASS') out.push(`${rel} last review verdict is ${v[v.length - 1].verdict}, so memory/handoff.md cannot say there is nothing to hand off`);
  });
  return out;
}

// ---------------------------------------------------------------- run

const DEFAULTS = {
  // Byte budgets. RULES.md is loaded in every session, through AGENTS.md or CLAUDE.md. Codex reads only the first
  // 32 KiB of AGENTS.md by default, so a team that inlines these rules there, beside its own instructions, must still
  // fit. 9000 bytes keeps the rules under a third of that, with about 1,400 bytes of headroom over today's 7,600.
  // A stage file (.agents/skills/<name>/SKILL.md, or a reviewer in agents/) loads only while its stage runs. 8000
  // bytes keeps one procedure short enough to follow in one read, about 1,700 bytes over today's largest.
  // AGENTS.md and CLAUDE.md are pointers and stay tiny.
  rulesMaxBytes: 9000, stageMaxBytes: 8000, pointerMaxBytes: 1200,
  nonCommandNames: [], allowMissing: [], unchecked: [], bannedWords: [], bannedPatterns: [], americanAllow: [], scrubAllow: [],
};

function loadConfig(file) {
  const t = readIf(file);
  if (t === null) return Object.assign({}, DEFAULTS);
  return Object.assign({}, DEFAULTS, JSON.parse(t));
}

const CHECK_NAMES = ['budget', 'deadrefs', 'wiki', 'contract', 'prose', 'state', 'handoff'];

function runChecks(ctx) {
  const checks = [['budget', budget], ['deadrefs', deadrefs], ['wiki', wiki], ['contract', contract], ['prose', prose], ['state', state], ['handoff', handoffCheck]];
  const lines = [];
  let failed = 0;
  checks.forEach(([name, fn]) => {
    if (ctx.only && ctx.only !== name) return;
    if (ctx.skip.includes(name)) { lines.push(`SKIP ${name}`); return; }
    const all = fn(ctx);
    const warns = all.filter((p) => p.startsWith('WARN '));
    const problems = all.filter((p) => !p.startsWith('WARN '));
    if (problems.length) {
      failed++;
      lines.push(`FAIL ${name} (${problems.length})`);
      problems.forEach((p) => lines.push(`  ${p}`));
    } else lines.push(`PASS ${name}`);
    warns.forEach((w) => lines.push(`  ${w}`));
  });
  lines.push(`check-process: ${ctx.only ? 1 : checks.length - ctx.skip.length} checks, ${failed} failed`);
  return { lines, failed };
}

const HELP = [
  'check-process: mechanical checks for the Carousel OS process.',
  '  node scripts/check-process.js                      run every check in the current folder',
  '  node scripts/check-process.js --root DIR           run in another folder',
  '  node scripts/check-process.js --skip handoff       skip the handoff check (carousel-wrap only)',
  '  node scripts/check-process.js --only budget        run one check by name',
  '  node scripts/check-process.js --plan PLAN.md       read the deck itself and compare it with the ledger and the Build table',
  '  node scripts/check-process.js --hashes PLAN.md     print the Deck, Ledger and Build hashes for the Check section',
  '  node scripts/check-process.js --ledger FILE [--final]   check one ledger; --final needs every row checked',
  '  node scripts/check-process.js --ledger-md FILE     print a ledger as a pipe table',
  'Exit 0 means clean, 1 means a check failed, 2 means bad arguments or files.',
].join('\n');

function main(argv) {
  const opts = { root: process.cwd(), config: null, today: null, ledger: null, final: false, ledgerMd: null, plan: null, hashes: null, skip: [], only: null };
  const FLAGS = {
    '--root': ['a folder', (v) => { opts.root = path.resolve(v); }],
    '--config': ['a file', (v) => { opts.config = v; }],
    '--today': ['a date as YYYY-MM-DD', (v) => { opts.today = v; }],
    '--ledger': ['a ledger file', (v) => { opts.ledger = v; }],
    '--ledger-md': ['a ledger file', (v) => { opts.ledgerMd = v; }],
    '--plan': ['a plan file', (v) => { opts.plan = v; }],
    '--hashes': ['a plan file', (v) => { opts.hashes = v; }],
    '--skip': ['a check name', (v) => { opts.skip.push(v); }],
    '--only': ['a check name', (v) => { opts.only = v; }],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { console.log(HELP); return 0; }
    if (a === '--final') { opts.final = true; continue; }
    if (FLAGS[a]) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) { console.error(`check-process: ${a} needs a value: ${FLAGS[a][0]}. Run with --help for usage.`); return 2; }
      FLAGS[a][1](v);
      i++;
    } else { console.error(`check-process: unknown argument ${a}\n${HELP}`); return 2; }
  }
  const loadJson = (f) => {
    const t = readIf(f);
    if (t === null) { console.error(`check-process: ${f} does not exist`); return undefined; }
    try { return JSON.parse(t); } catch (e) { console.error(`check-process: ${f} is not valid JSON (${e.message})`); return undefined; }
  };
  let todayStr = opts.today;
  if (todayStr === null) {
    const n = new Date();
    const p = (x) => String(x).padStart(2, '0');
    todayStr = `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
  }
  if (!rotate.parseIsoDate(todayStr)) { console.error(`check-process: --today wants a real date, got "${todayStr}"`); return 2; }
  if (opts.ledgerMd) {
    const obj = loadJson(opts.ledgerMd);
    if (obj === undefined) return 2;
    const errs = validateLedger(obj, { today: todayStr });
    if (errs.length) { errs.forEach((e) => console.error(e)); return 1; }
    process.stdout.write(ledgerMd(obj));
    return 0;
  }
  if (opts.ledger) {
    const obj = loadJson(opts.ledger);
    if (obj === undefined) return 2;
    const errs = validateLedger(obj, { final: opts.final, today: todayStr });
    console.log(ledgerSummary(obj));
    errs.forEach((e) => console.log(`  ${e}`));
    console.log(errs.length ? `FAIL ledger (${errs.length})` : 'PASS ledger');
    return errs.length ? 1 : 0;
  }
  if (opts.plan || opts.hashes) {
    const file = path.resolve(opts.plan || opts.hashes);
    const text = readIf(file);
    if (text === null) { console.error(`check-process: ${file} does not exist`); return 2; }
    const rel = path.relative(opts.root, file).split(path.sep).join('/');
    const ctx = { root: opts.root };
    if (opts.hashes) {
      const h = planHashes(ctx, rel, text);
      if (h.deck === null || h.ledger === null) { console.error('check-process: the deck or the ledger the plan names does not exist'); return 2; }
      console.log(`Deck sha256: ${h.deck}\nLedger sha256: ${h.ledger}\nBuild sha256: ${h.build}`);
      return 0;
    }
    const ledgerRaw = readIf(path.join(opts.root, rel.replace(/\.md$/, '.ledger.json')));
    let ledger = null;
    try { ledger = ledgerRaw === null ? null : JSON.parse(ledgerRaw); } catch (e) { console.error('check-process: the ledger is not valid JSON'); return 2; }
    const problems = planDeckProblems(ctx, rel, text, ledger);
    console.log(`Plan: the deck read against ${ledger && ledger.slides ? ledger.slides.length : 0} ledger rows and the Build table`);
    problems.forEach((p) => console.log(`  ${p}`));
    console.log(problems.length ? `FAIL plan (${problems.length})` : 'PASS plan');
    return problems.length ? 1 : 0;
  }
  const configFile = opts.config || path.join(opts.root, 'scripts/check-process.config.json');
  let config;
  try { config = loadConfig(configFile); } catch (e) { console.error(`check-process: bad config ${configFile}: ${e.message}`); return 2; }
  if (opts.skip.some((n) => n !== 'handoff')) { console.error('check-process: only the handoff check may be skipped'); return 2; }
  if (opts.only && !CHECK_NAMES.includes(opts.only)) { console.error(`check-process: --only wants one of ${CHECK_NAMES.join(', ')}`); return 2; }
  const skip = new Set([...SKIP_DIRS, ...ignoredNames(opts.root)]);
  // walkMd skips dot folders, so the stage sources are added by name. The .claude/ copies are generated and skipped.
  const proseFiles = walkMd(opts.root, skip).concat(walkAny(opts.root, STAGE_DIR, '.md')).filter((p) => !config.unchecked.includes(p)).sort();
  const result = runChecks({ root: opts.root, config, today: todayStr, prose: proseFiles, skip: opts.skip, only: opts.only });
  console.log(result.lines.join('\n'));
  return result.failed ? 1 : 0;
}

module.exports = { LIMITS, DeckError, pptxCoreProperties, STAGES, reportRegex, validateLedger, validateHandoff, validateEngineConfig, readPptxSlides, ledgerMd, checkTextProblem, spellingProblems, ratioPhrases, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
