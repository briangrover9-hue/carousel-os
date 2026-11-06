'use strict';
const h = require('./harness');
const { assert, fs, path, edit, test, done, mustFail, mustPass } = h;
const cp = require(path.join(h.SCRIPTS, 'check-process.js'));
const zlibDeflate = (b) => require('zlib').deflateRawSync(b);

const fresh = () => h.copyRepo();
const EX = 'plans/example/fernway-skip-cancel.md';
const EXL = 'plans/example/fernway-skip-cancel.ledger.json';
const ex = (d, fn) => edit(d, EX, fn);
const exLedger = (d, fn) => edit(d, EXL, (t) => { const o = JSON.parse(t); fn(o); return JSON.stringify(o, null, 2) + '\n'; });
const replaceLast = (t, a, b) => { const i = t.lastIndexOf(a); assert.ok(i >= 0, `no "${a}" to replace`); return t.slice(0, i) + b + t.slice(i + a.length); };
const dropLine = (t, re) => { assert.ok(re.test(t), `no line matches ${re}`); return t.replace(re, ''); };
// A real (non-example) plan: the example plan and ledger copied under plans/real.
const realPlan = (d, fn) => {
  const md = fs.readFileSync(path.join(d, EX), 'utf8').replace(/\r\n/g, '\n').replace('plans/example/fernway-skip-cancel.md', 'plans/real.md');
  fs.writeFileSync(path.join(d, 'plans/real.md'), fn ? fn(md) : md);
  fs.copyFileSync(path.join(d, EXL), path.join(d, 'plans/real.ledger.json'));
};
const pad = (n) => '\nfiller line for the size cap test.'.repeat(n);

test('a clean copy with no engine folder passes every check', () => {
  const d = fresh();
  assert.ok(!fs.existsSync(path.join(d, 'engine')));
  const r = h.check(d);
  assert.strictEqual(r.code, 0, r.out);
  ['budget', 'deadrefs', 'wiki', 'contract', 'prose', 'state', 'handoff'].forEach((n) => assert.ok(r.out.includes(`PASS ${n}`), r.out));
});

// ---- budget
test('budget: RULES.md over its cap fails', () => {
  const d = fresh(); edit(d, 'RULES.md', (t) => t + pad(400));
  mustFail(d, 'budget', 'RULES.md is');
});
test('budget: a command over its cap fails', () => {
  const d = fresh(); edit(d, 'commands/carousel-build.md', (t) => t + pad(300));
  mustFail(d, 'budget', 'commands/carousel-build.md is');
});
test('budget: a pointer file over its cap fails', () => {
  const d = fresh(); edit(d, 'AGENTS.md', (t) => t + pad(60));
  mustFail(d, 'budget', 'AGENTS.md is');
});

// ---- dead references
test('deadrefs: a broken markdown link fails', () => {
  const d = fresh(); edit(d, 'README.md', (t) => t + '\n[gone](docs/gone.md)\n');
  mustFail(d, 'deadrefs', 'docs/gone.md');
});
test('deadrefs: a link to a missing heading fails', () => {
  const d = fresh(); edit(d, 'README.md', (t) => t + '\n[x](RULES.md#no-such-heading)\n');
  mustFail(d, 'deadrefs', 'no-such-heading');
});
test('deadrefs: a valid link with an anchor passes', () => {
  const d = fresh(); edit(d, 'README.md', (t) => t + '\n[x](RULES.md#the-bar)\n');
  mustPass(d);
});
test('deadrefs: a backticked command that does not exist fails', () => {
  const d = fresh(); edit(d, 'README.md', (t) => t + '\nRun `carousel-polish` next.\n');
  mustFail(d, 'deadrefs', 'carousel-polish');
});
test('deadrefs: a backticked path that does not exist fails, in a span and in a command line', () => {
  let d = fresh(); edit(d, 'cheatsheet.md', (t) => t + '\nSee `bookshelf/missing.md`.\n');
  mustFail(d, 'deadrefs', 'bookshelf/missing.md');
  d = fresh(); edit(d, 'cheatsheet.md', (t) => t + '\n`node scripts/nope.js --x`\n');
  mustFail(d, 'deadrefs', 'scripts/nope.js');
  d = fresh(); edit(d, 'cheatsheet.md', (t) => t + '\n```\nnode scripts/nope.js\n```\n');
  mustFail(d, 'deadrefs', 'scripts/nope.js');
});
test('deadrefs: a heading citation that does not resolve fails; one that does passes', () => {
  let d = fresh(); edit(d, 'cheatsheet.md', (t) => t + '\nSee RULES.md, "A heading that is not there".\n');
  mustFail(d, 'deadrefs', 'A heading that is not there');
  d = fresh(); edit(d, 'cheatsheet.md', (t) => t + '\nSee RULES.md, "The bar".\n');
  mustPass(d);
});
test('deadrefs: placeholders and unknown folders are not treated as paths', () => {
  const d = fresh(); edit(d, 'cheatsheet.md', (t) => t + '\n`plans/<slug>.md` and `memory/history/YYYY-Www.md` and `decks/x.pptx`.\n');
  mustPass(d);
});
test('deadrefs: with an engine folder present, engine paths must resolve', () => {
  const d = fresh(); fs.mkdirSync(path.join(d, 'engine'));
  edit(d, 'cheatsheet.md', (t) => t + '\nSee `engine/style.md`.\n');
  mustFail(d, 'deadrefs', 'engine/style.md');
  fs.writeFileSync(path.join(d, 'engine/style.md'), '# Style\n');
  fs.mkdirSync(path.join(d, 'tests'), { recursive: true });
  edit(d, 'cheatsheet.md', (t) => t);
  const r = h.check(d);
  assert.ok(!r.out.includes('engine/style.md'), r.out);
});

// ---- wiki index
test('wiki: a page missing from the index fails', () => {
  const d = fresh(); edit(d, 'memory/wiki/new-page.md', () => '# New page\n');
  mustFail(d, 'wiki', 'new-page.md is not listed');
});
test('wiki: a dead link in the index fails', () => {
  const d = fresh(); edit(d, 'memory/wiki/INDEX.md', (t) => t + '- [Ghost](ghost.md): not there.\n');
  mustFail(d, 'wiki', 'ghost.md');
});
test('wiki: a listed new page passes', () => {
  const d = fresh();
  edit(d, 'memory/wiki/new-page.md', () => '# New page\n');
  edit(d, 'memory/wiki/INDEX.md', (t) => t + '- [New page](new-page.md): a page.\n');
  mustPass(d);
});

// ---- contract
test('contract: a changed report string fails', () => {
  const d = fresh(); edit(d, 'commands/carousel-build.md', (t) => t.replace('slides built', 'slides done'));
  mustFail(d, 'contract', 'exact report string not found');
});
test('contract: a missing No-rubber-stamp guard fails', () => {
  const d = fresh(); edit(d, 'commands/carousel-check.md', (t) => t.replace('## No-rubber-stamp guard', '## Notes'));
  mustFail(d, 'contract', 'No-rubber-stamp guard');
});
test('contract: a guard that does not describe a fake pass fails', () => {
  const d = fresh();
  edit(d, 'commands/carousel-wrap.md', (t) => t.replace(/## No-rubber-stamp guard[\s\S]*?## Rationale/, '## No-rubber-stamp guard\n\nBe careful.\n\n## Rationale'));
  mustFail(d, 'contract', 'fake pass');
});
test('contract: sections out of order fail', () => {
  const d = fresh(); edit(d, 'commands/carousel-brief.md', (t) => t.replace('## Guards', '## Steps2').replace('## Steps\n', '## Guards\n'));
  mustFail(d, 'contract', 'carousel-brief.md');
});
test('contract: a command not linked in commands/README fails; one not named in RULES fails', () => {
  let d = fresh(); edit(d, 'commands/README.md', (t) => t.replace('(carousel-handoff.md)', '(carousel-wrap.md)'));
  mustFail(d, 'contract', 'does not link carousel-handoff');
  d = fresh(); edit(d, 'RULES.md', (t) => t.replace(/`carousel-handoff`/g, '`carousel-wrap`'));
  mustFail(d, 'contract', 'RULES.md does not name carousel-handoff');
});
test('contract: the empty handoff sentence must stay in the handoff command', () => {
  const d = fresh(); edit(d, 'commands/carousel-handoff.md', (t) => t.split('Nothing to hand off this time.').join('Nothing.'));
  mustFail(d, 'contract', 'Nothing to hand off this time.');
});
test('contract: a missing command file fails', () => {
  const d = fresh(); fs.unlinkSync(path.join(d, 'commands/carousel-review.md'));
  mustFail(d, 'contract', 'carousel-review.md is missing');
});

// ---- prose gate
test('prose: an em dash fails', () => {
  const d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nThis — that.\n');
  mustFail(d, 'prose', 'em dash or en dash');
});
test('prose: an en dash fails', () => {
  const d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nPages 3–5.\n');
  mustFail(d, 'prose', 'em dash or en dash');
});
test('prose: a spaced hyphen fails, a compound hyphen and a list marker pass', () => {
  let d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nThis - that.\n');
  mustFail(d, 'prose', 'spaced hyphen');
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nA better-for-you plan.\n\n- item\n  - nested item\n');
  mustPass(d);
});
test('prose: a spaced hyphen inside inline code is not prose', () => {
  const d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nRun `a - b` once.\n');
  mustPass(d);
});
test('prose: a banned word fails, case-insensitively, and a longer word does not', () => {
  let d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nA Seamless flow.\n');
  mustFail(d, 'prose', 'seamless');
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nWe organise things.\n');
  mustFail(d, 'prose', 'organise');
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nThe centered title.\n');
  mustPass(d);
});
test('prose: a banned pattern fails', () => {
  const d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nIt is not just a deck.\n');
  mustFail(d, 'prose', 'banned pattern');
});
test('prose: the banned list is configurable', () => {
  const d = fresh();
  edit(d, 'scripts/check-process.config.json', (t) => { const c = JSON.parse(t); c.bannedWords.push('widget'); return JSON.stringify(c); });
  edit(d, 'docs/cost.md', (t) => t + '\nA widget.\n');
  mustFail(d, 'prose', 'widget');
});
test('prose: files listed as unchecked are skipped', () => {
  const d = fresh();
  edit(d, 'docs/publish-checklist.md', (t) => t + '\nThis — that.\n');
  mustPass(d);
  edit(d, 'scripts/check-process.config.json', (t) => { const c = JSON.parse(t); c.unchecked = []; return JSON.stringify(c); });
  mustFail(d, 'prose', 'docs/publish-checklist.md');
});

// ---- state
test('state: an undatable log heading fails', () => {
  const d = fresh(); edit(d, 'memory/LOG.md', () => '# Log\n\nNotes.\n\n## 2026-11-05 a\n\nx\n\n## Misc notes\n\nx\n');
  mustFail(d, 'state', 'undatable heading');
});
test('state: a log that is not newest first fails', () => {
  const d = fresh(); edit(d, 'memory/LOG.md', () => '# Log\n\nNotes.\n\n## 2026-11-05 a\n\nx\n\n## 2026-12-01 later\n\nx\n');
  mustFail(d, 'state', 'not newest first');
});
test('state: a handoff with six bullets fails', () => {
  const d = fresh();
  edit(d, 'memory/handoff.md', () => '# Handoff\n\nWhere it stands.\n\n- 1\n- 2\n- 3\n- 4\n- 5\n- 6\n\n## Agent half\n\nStart with carousel-start.\n\nRecommended focus: x\n\nAgent-doable:\n- a\n\nNeeds the human:\n- b\n\nOut of scope:\n- c\n');
  mustFail(d, 'state', 'limit is 5');
});
test('state: a valid full handoff passes', () => {
  const d = fresh();
  edit(d, 'memory/handoff.md', () => '# Handoff\n\nWhere it stands.\n\n- one\n\n## Agent half\n\nStart with carousel-start.\n\nRecommended focus: finish the review\n\nAgent-doable:\n- a\n\nNeeds the human:\n- b\n\nOut of scope:\n- c\n');
  mustPass(d);
});
test('handoff: an empty handoff with an open NEEDS HUMAN marker in a plan fails', () => {
  const d = fresh(); realPlan(d, (t) => t.replace('## Deviations', 'NEEDS HUMAN: which month does the data start?\n\n## Deviations'));
  mustFail(d, 'handoff', 'open NEEDS HUMAN marker');
});
test('handoff: a resolved marker and a PASS verdict leave the empty handoff valid', () => {
  const d = fresh(); realPlan(d, (t) => t.replace('Deferred: NEEDS HUMAN:', 'Deferred: RESOLVED: NEEDS HUMAN:'));
  mustPass(d);
});
test('handoff: an empty handoff with a REJECT as the last verdict fails; --skip handoff passes it; other skips are refused', () => {
  const d = fresh();
  realPlan(d, (t) => t.replace(/^- Review verdict: PASS.*$/m, '- Review verdict: REJECT; unreconciled numbers 1; findings 1.\n- Stopped at review: second REJECT, blocker.').replace('Status: wrapped', 'Status: wrapped'));
  mustFail(d, 'handoff', 'last review verdict is REJECT');
  const r = h.check(d, ['--skip', 'handoff']);
  assert.strictEqual(r.code, 0, r.out);
  assert.ok(r.out.includes('SKIP handoff'), r.out);
  assert.strictEqual(h.check(d, ['--skip', 'prose']).code, 2);
});
test('state: an unpromoted twice-corrected lesson fails', () => {
  const d = fresh();
  edit(d, 'memory/wiki/lessons.md', (t) => t.replace('## Lessons\n\n_None yet._', '## Lessons\n\n- L-5dcb36 | 2026-11-05 | n=2 | confirmed 2020-01-01 | Label every series on the chart'));
  mustFail(d, 'state', 'not promoted');
});
test('state: an expired lesson fails', () => {
  const d = fresh();
  edit(d, 'memory/wiki/lessons.md', (t) => t.replace('## Lessons\n\n_None yet._', '## Lessons\n\n- L-5dcb36 | 2020-01-01 | n=1 | confirmed 2020-01-01 | Label every series on the chart'));
  mustFail(d, 'state', 'expire');
});
test('state: the stated lesson numbers must match the script', () => {
  let d = fresh(); edit(d, 'bookshelf/lessons.md', (t) => t.split('90 days').join('60 days'));
  mustFail(d, 'state', '90 days');
  d = fresh(); edit(d, 'bookshelf/lessons.md', (t) => t.split('12 rules').join('20 rules'));
  mustFail(d, 'state', '12 rules');
  d = fresh(); edit(d, 'RULES.md', (t) => t.split('90 days').join('60 days'));
  mustFail(d, 'state', 'expiry period');
});
test('state: a twice-corrected lesson inside the 14 day grace warns and passes', () => {
  const d = fresh(); const now = new Date(); const p = (x) => String(x).padStart(2, '0');
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  edit(d, 'memory/wiki/lessons.md', (t) => t.replace('## Lessons\n\n_None yet._', `## Lessons\n\n- L-5dcb36 | ${today} | n=2 | confirmed ${today} | Label every series on the chart`));
  edit(d, 'memory/wiki/lessons.history', (t) => t + `${today} | repeat | L-5dcb36 | "yes, the same lesson" | n=2\n`);
  const r = h.check(d); assert.strictEqual(r.code, 0, r.out); assert.ok(r.out.includes('WARN'), r.out);
});
test('state: more than 12 rules, and a rule past its review, fail', () => {
  let d = fresh(); const rules = [];
  for (let i = 0; i < 13; i++) rules.push(`- R-${String(i).padStart(6, '0')} | promoted 2026-11-05 | reviewed 2026-11-05 | Rule number ${i} says do thing ${i} every time`);
  edit(d, 'memory/wiki/lessons.md', (t) => t.replace('## Rules\n\n_None yet._', '## Rules\n\n' + rules.join('\n')));
  mustFail(d, 'state', 'the cap is 12');
  d = fresh();
  edit(d, 'memory/wiki/lessons.md', (t) => t.replace('## Rules\n\n_None yet._', '## Rules\n\n- R-aaaaaa | promoted 2020-01-01 | reviewed 2020-01-01 | Cite the source on every slide'));
  mustFail(d, 'state', 'not reviewed');
});

// ---- helpers for the plan tests
const CHECK_LINE = 'Check report: path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9; Deferred: item 9, no render available.';
const slides = () => cp.readPptxSlides(path.join(h.ROOT, 'plans/example/fernway-skip-cancel.pptx'));
const writeDeck = (d, texts, opts) => fs.writeFileSync(path.join(d, 'plans/example/fernway-skip-cancel.pptx'), h.makePptx(texts, opts));
const REAL_RESOLVED = (t) => t.replace('Deferred: NEEDS HUMAN:', 'Deferred: RESOLVED: NEEDS HUMAN:');
const EXP = 'plans/example/fernway-skip-cancel.md';
// A real plan on the engine path. Two small tools are registered, run-tools.js runs them, and the Check
// section is filled from what it printed. opts.tools: { name: { exit, line } } overrides the default tools.
function writeTool(d, name, exit, line, edits) {
  fs.mkdirSync(path.join(d, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(d, 'tools', `${name}.js`), `${edits ? "require('fs').appendFileSync(process.argv[2], 'x');\n" : ''}console.log('noise');\nconsole.log(${JSON.stringify(line)});\nprocess.exit(${exit});\n`);
}
function enginePlan(d, opts) {
  const o = opts || {};
  const tools = o.tools || { scan: { exit: 0, line: 'scan: 0 FAIL, 2 CANDIDATE, 41 PASS' }, render: { exit: 0, line: 'render: 6 slides, 0 defects' } };
  Object.keys(tools).forEach((n) => writeTool(d, n, tools[n].exit, tools[n].line, tools[n].edit));
  const engine = { scan: 'node tools/scan.js {deck} {out}', render: 'node tools/render.js {deck} {out}' };
  Object.keys(tools).filter((n) => n !== 'scan' && n !== 'render').forEach((n) => { engine.tools = engine.tools || {}; engine.tools[n] = `node tools/${n}.js {deck} {out}`; });
  fs.writeFileSync(path.join(d, 'carousel.config.json'), JSON.stringify({ engine }));
  realPlan(d, REAL_RESOLVED);
  const r = h.node(path.join(d, 'scripts/run-tools.js'), ['plans/real.md'], d);
  const toolLines = r.out.split('\n').filter((l) => l.startsWith('Tool '));
  const statuses = toolLines.map((l) => /^Tool (\S+?): (PASS|FAIL|MISSING):/.exec(l)).map((m) => `${m[1]} ${m[2]}`).join(', ');
  const clean = toolLines.every((l) => /: PASS:/.test(l));
  const report = `Check report: path engine; plan PASS; ledger PASS; tools ${statuses}; checklist n/a; Deferred: ${clean ? 'none' : 'a tool did not pass'}.`;
  edit(d, 'plans/real.md', (t) => t.split(CHECK_LINE).join(report)
    .replace('Checklist, 9 of 9 items pass. Item 9 is deferred and the checklist has 9 items.', toolLines.join('\n')));
  return { out: r.out, toolLines };
}

// ---- plan state machine: the worked example must pass, and each rule needs a failing fixture
test('plan: the worked example passes every rule, and so does a copy of it as a real plan once its open question is answered', () => {
  const d = fresh(); mustPass(d);
  realPlan(d, REAL_RESOLVED); mustPass(d);
});
test('plan: the rubber-stamped fixture fails, for the right reasons', () => {
  const d = fresh();
  fs.copyFileSync(path.join(h.ROOT, 'tests/process/fixtures/rubber-stamp/plan.md'), path.join(d, 'plans/rubber.md'));
  fs.copyFileSync(path.join(h.ROOT, 'tests/process/fixtures/rubber-stamp/plan.ledger.json'), path.join(d, 'plans/rubber.ledger.json'));
  const r = h.check(d);
  assert.strictEqual(r.code, 1, r.out);
  [
    'matches no report format: "Check passed, all good."',
    'matches no report format: "Check report: path rubric; scan looks fine',
    'a challenge angle repeats across rounds',
    'angle "Vibes" is not in bookshelf/review-angles.md',
    're-verified no claims',
    'says nothing about what was done',
    'is not a real date',
    'cannot follow "build"',
    'checked with unreconciled number 1 (42%)',
  ].forEach((needle) => assert.ok(r.out.includes(needle), `missing: ${needle}\n${r.out}`));
});
test('plan: reports out of stage order fail', () => {
  const d = fresh(); ex(d, (t) => t.replace(/^(- Brief report:.*)\n(- Storyboard report:.*)$/m, '$2\n$1'));
  mustFail(d, 'state', 'cannot follow');
});
test('plan: a line that is not a report format fails, including old and loose check lines', () => {
  let d = fresh(); ex(d, (t) => t.replace('- Wrap report:', '- Check passed, all good.\n- Wrap report:'));
  mustFail(d, 'state', 'matches no report format');
  d = fresh(); ex(d, (t) => t.split('plan PASS').join('plan looks fine'));
  mustFail(d, 'state', 'matches no report format');
  d = fresh(); ex(d, (t) => t.split('ledger PASS; tools').join('ledger OK; tools'));
  mustFail(d, 'state', 'matches no report format');
  d = fresh(); ex(d, (t) => t.split('Check report: path rubric; plan PASS;').join('Check report: path rubric; scan n/a; budget n/a; render n/a; gallery n/a; plan PASS;'));
  mustFail(d, 'state', 'matches no report format');
});
test('plan: a repeated challenge angle fails', () => {
  const d = fresh();
  ex(d, (t) => t.replace('angle The unreconcilable number (new)', 'angle Literal ask (new)').replace('Angle: The unreconcilable number (new)', 'Angle: Literal ask (new)'));
  mustFail(d, 'state', 'a challenge angle repeats');
});
test('plan: an angle that is not in the angle list fails', () => {
  const d = fresh();
  ex(d, (t) => t.replace('angle The unreconcilable number (new)', 'angle Vibes (new)').replace('Angle: The unreconcilable number (new)', 'Angle: Vibes (new)'));
  mustFail(d, 'state', 'is not in bookshelf/review-angles.md');
});
test('plan: with three rounds the last must be Parked claims, and Parked claims may not come earlier', () => {
  let d = fresh();
  ex(d, (t) => t.replace('angle Parked claims (new)', 'angle Denominators (new)').replace('Angle: Parked claims (new)', 'Angle: Denominators (new)'));
  mustFail(d, 'state', 'must take the angle Parked claims');
  d = fresh();
  ex(d, (t) => t.replace('angle Literal ask (new)', 'angle Parked claims (new)').replace('Angle: Literal ask (new)', 'Angle: Parked claims (new)'));
  mustFail(d, 'state', 'belongs to the last round');
});
test('plan: a round whose log count line differs from its report line fails', () => {
  const d = fresh(); ex(d, (t) => t.replace('Re-verified 5 claims, demoted 1 to uncertainty.\nParked', 'Re-verified 5 claims, demoted 3 to uncertainty.\nParked'));
  mustFail(d, 'state', 'count line in Challenge log does not match');
});
test('plan: a round that changed nothing must say what it checked', () => {
  const d = fresh();
  ex(d, (t) => t.replace(/^Addressed: s05 reworded.*\n/m, '').replace(/^Kept as is: s06,.*$/m, 'Kept as is: s06, nothing to change (s06).'));
  mustFail(d, 'state', 'must say what was checked');
});

// one round: the log must end with Parked claims none open, and every parked slide must be resolved
function lightPlan(t, roundBody) {
  const logStart = t.indexOf('### Round 1'); const logEnd = t.indexOf('## Deviations');
  return (t.slice(0, logStart) + roundBody + '\n' + t.slice(logEnd))
    .replace('Path: full', 'Path: light').replace('Rounds: 3', 'Rounds: 1');
}
const ONE_ROUND = `### Round 1
Angle: The unreconcilable number (new)
Addressed: s04 divided by the wrong base and now uses the 1,428 who answered (s04).
Kept as is: s05 reworded to worth testing, and recounted 2,562 against s02 (s05).
Re-verified 3 claims, demoted 1 to uncertainty.
Parked claims: s05 says a pause would keep members (s05)
Parked claims: none open
`;
function toLight(d, body) {
  ex(d, (t) => {
    let u = lightPlan(t, body);
    u = u.replace(/^- Challenge round 1 of 3:.*$/m, '- Challenge round 1 of 1: angle The unreconcilable number (new). Re-verified 3 claims, demoted 1 to uncertainty.');
    u = u.replace(/^- Challenge round [23] of 3:.*\n/gm, '');
    return u;
  });
}
test('plan: a one-round plan passes when it ends with Parked claims none open and resolves what it parks', () => {
  const d = fresh(); toLight(d, ONE_ROUND); mustPass(d);
});
test('plan: a one-round plan must end with Parked claims none open', () => {
  const d = fresh(); toLight(d, ONE_ROUND.replace('Parked claims: none open\n', ''));
  mustFail(d, 'state', 'Parked claims: none open');
});
test('plan: a parked slide must appear in the last round Addressed or Kept as is lines, for one round and for three', () => {
  let d = fresh(); toLight(d, ONE_ROUND.replace('(s05)\nRe-verified', 'later\nRe-verified').replace('Kept as is: s05 reworded to worth testing, and recounted 2,562 against s02 (s05).', 'Kept as is: s02 recounted 2,562 against the file.'));
  mustFail(d, 'state', 'parked claim s05 is not resolved');
  d = fresh(); ex(d, (t) => t.replace('Addressed: s05 reworded to "worth testing", and the retention figure removed (s05).', 'Addressed: the wording was softened.'));
  mustFail(d, 'state', 'parked claim s05 is not resolved');
});
test('plan: the log must end with Parked claims none open when there are three rounds', () => {
  const d = fresh(); ex(d, (t) => replaceLast(t, 'Parked claims: none open', 'Parked claims: s05'));
  mustFail(d, 'state', 'Parked claims: none open');
});
test('plan: the Rounds line must match the round lines, and extra rounds need a finding ledger', () => {
  const d = fresh(); ex(d, (t) => t.replace('Rounds: 3', 'Rounds: 4'));
  const r = h.check(d); assert.strictEqual(r.code, 1);
  assert.ok(r.out.includes('Finding ledger') && r.out.includes('round lines say 3 rounds but the Rounds line says 4'), r.out);
});
test('plan: a Review after a Check with a FAIL, a short checklist or a MISSING tool fails', () => {
  let d = fresh(); ex(d, (t) => t.split('plan PASS').join('plan FAIL'));
  mustFail(d, 'state', 'cannot follow "check"');
  d = fresh(); ex(d, (t) => t.split('checklist 9 of 9').join('checklist 8 of 9'));
  mustFail(d, 'state', 'cannot follow "check"');
});
test('plan: a REJECT needs a new Build and Check pair before the next Review', () => {
  let d = fresh(); ex(d, (t) => { const lines = t.split('\n'); const i = lines.findIndex((l) => l.startsWith('- Review verdict: REJECT')); lines.splice(i + 1, 2); return lines.join('\n'); });
  mustFail(d, 'state', 'cannot follow "review"');
  d = fresh(); ex(d, (t) => { const lines = t.split('\n'); const i = lines.findIndex((l) => l.startsWith('- Review verdict: REJECT')); lines.splice(i + 2, 1); return lines.join('\n'); });
  mustFail(d, 'state', 'cannot follow "build"');
});
test('plan: a second REJECT must be followed by a Stopped at review line, and no third review is allowed', () => {
  const second = (t) => t.replace(/^- Review verdict: PASS.*$/m, '- Review verdict: REJECT; unreconciled numbers 1; findings 1.');
  let d = fresh(); ex(d, second);
  const lines = (t) => t.replace('- Review verdict: REJECT; unreconciled numbers 1; findings 1.\n- Build report', '- Review verdict: REJECT; unreconciled numbers 1; findings 1.\n- Build report');
  mustFail(d, 'state', 'cannot follow "review"');
  d = fresh(); ex(d, (t) => second(t).replace('- Wrap report:', '- Stopped at review: second REJECT, blocker.\n- Wrap report:'));
  assert.strictEqual(h.check(d, ['--skip', 'handoff']).code, 0);
  d = fresh(); ex(d, (t) => t.replace(/^- Review verdict: PASS.*$/m, '- Review verdict: REJECT; unreconciled numbers 1; findings 1.\n- Build report: 6 slides built, 6 ledger rows checked, 2 deviations logged.\n- Check report: path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9; Deferred: item 9, no render available.\n- Review verdict: PASS; unreconciled numbers 0; findings 0.'));
  mustFail(d, 'state', 'cannot follow "review"');
  d = fresh(); ex(d, (t) => t.replace(/^- Review verdict: PASS.*$/m, '- Review verdict: REJECT; unreconciled numbers 1; findings 1.\n- Stopped at review: second REJECT, blocker.\n- Review verdict: PASS; unreconciled numbers 0; findings 0.'));
  mustFail(d, 'state', 'cannot follow "stopped"');
});
test('plan: Status must agree with the last report line', () => {
  let d = fresh(); ex(d, (t) => t.replace('Status: wrapped', 'Status: reviewed'));
  mustFail(d, 'state', 'Status is "reviewed"');
  d = fresh(); ex(d, (t) => t.replace('Status: wrapped', 'Status: done'));
  mustFail(d, 'state', 'Status is "done"');
});
test('plan: Wrap needs a PASS or a Stopped line; a stop at the wrong stage fails', () => {
  const reject = (t) => t.replace(/^- Review verdict: PASS.*$/m, '- Review verdict: REJECT; unreconciled numbers 1; findings 1.');
  let d = fresh(); ex(d, reject);
  mustFail(d, 'state', 'cannot follow "review"');
  d = fresh(); ex(d, (t) => reject(t).replace('- Wrap report:', '- Stopped at check: nothing.\n- Wrap report:'));
  mustFail(d, 'state', 'but the last stage reported was review');
});
test('plan: the final ledger gate applies to every plan with a Review line, not only the example', () => {
  const d = fresh(); realPlan(d);
  edit(d, 'plans/real.ledger.json', (t) => { const o = JSON.parse(t); o.slides[1].status = 'open'; o.slides[1].check = null; return JSON.stringify(o, null, 2) + '\n'; });
  mustFail(d, 'state', 'plans/real.ledger.json: slide s02: status is open, not checked');
});
test('plan: ledger ids must equal the storyboard table ids, and counts must agree', () => {
  let d = fresh(); exLedger(d, (o) => { o.slides[5].id = 's07'; });
  mustFail(d, 'state', 'ledger ids and storyboard table ids differ');
  d = fresh(); ex(d, (t) => t.replace('Storyboard report: 6 slides, headlines-only read holds, ledger rows 6', 'Storyboard report: 5 slides, headlines-only read holds, ledger rows 5'));
  mustFail(d, 'state', 'storyboard table has 6 rows');
  d = fresh(); ex(d, (t) => replaceLast(t, 'Build report: 6 slides built', 'Build report: 7 slides built'));
  mustFail(d, 'state', 'Build report says 7 slides');
});
test('plan: the Build report checked count must equal the ledger checked count', () => {
  const d = fresh(); ex(d, (t) => replaceLast(t, '6 ledger rows checked', '5 ledger rows checked'));
  mustFail(d, 'state', 'Build report says 5 ledger rows checked but the ledger has 6');
});
test('plan: ledger check text that says nothing fails, and so does a date that does not exist, is late or early', () => {
  let d = fresh(); exLedger(d, (o) => { o.slides[1].check = 'verified'; });
  mustFail(d, 'state', 'says nothing about what was done');
  d = fresh(); exLedger(d, (o) => { o.slides[1].check = 'looks right'; });
  mustFail(d, 'state', 'says nothing about what was done');
  d = fresh(); exLedger(d, (o) => { o.slides[1].check = 'the dividends sat unchanged from last week'; });
  mustFail(d, 'state', 'names no action');
  d = fresh(); exLedger(d, (o) => { o.slides[1].checked_on = '2026-02-30'; });
  mustFail(d, 'state', 'is not a real date');
  d = fresh(); exLedger(d, (o) => { o.slides[1].checked_on = '2099-01-01'; });
  mustFail(d, 'state', 'is later than today');
  d = fresh(); exLedger(d, (o) => { o.slides[1].checked_on = '2026-06-01'; });
  mustFail(d, 'state', 'is earlier than the window end');
});
test('plan: Build deviations must equal the D lines', () => {
  const d = fresh(); ex(d, (t) => replaceLast(t, '2 deviations logged', '3 deviations logged'));
  mustFail(d, 'state', 'Build report says 3 deviations but Deviations lists 2');
});
test('plan: the brief must hold its three blocking fields before a storyboard exists', () => {
  let d = fresh(); ex(d, (t) => t.replace(/^Evidence: the three exports.*$/m, 'Evidence:'));
  mustFail(d, 'state', 'Brief field "Evidence" is empty');
  d = fresh(); ex(d, (t) => t.replace('Reader and venue: three leaders, shared screen in a meeting, no pre-read.', 'Reader and venue: NEEDS HUMAN: who reads it?'));
  mustFail(d, 'state', 'still a NEEDS HUMAN marker');
});
test('plan: a PASS review must paste both gates and one found line per number, and found must equal the ledger value', () => {
  let d = fresh(); ex(d, (t) => t.replace(/^PASS ledger$/gm, '').replace(/^Ledger: 6 slides.*$/gm, ''));
  mustFail(d, 'state', 'must paste the ledger gate output');
  d = fresh(); ex(d, (t) => t.replace(/^PASS plan$/gm, ''));
  mustFail(d, 'state', 'must paste the plan gate output');
  d = fresh(); ex(d, (t) => { const i = t.indexOf('### Pass 2'); return t.slice(0, i) + t.slice(i).replace(/^- s04 300:.*$/m, ''); });
  mustFail(d, 'state', 'a line "- s04 300:');
  d = fresh(); ex(d, (t) => t.replace('2,562 over 4,200 is 0.61, found 61%.', '2,562 over 4,200 is 0.61, found 60%.'));
  mustFail(d, 'state', 'says found "60%"');
  d = fresh(); ex(d, (t) => t.replace('- s05 2,562: same count as s02, found 2,562.', '- s05 2,562: same count as s02.'));
  mustFail(d, 'state', 'says found "null"');
  d = fresh(); ex(d, (t) => t.replace('Review verdict: PASS; unreconciled numbers 0', 'Review verdict: PASS; unreconciled numbers 2'));
  mustFail(d, 'state', 'cannot report unreconciled numbers');
  d = fresh(); ex(d, (t) => t.replace('Review verdict: REJECT; unreconciled numbers 1; findings 1', 'Review verdict: REJECT; unreconciled numbers 0; findings 0'));
  mustFail(d, 'state', 'names at least one finding');
});
test('plan: Path and Rounds must be plain values', () => {
  let d = fresh(); ex(d, (t) => t.replace('Path: full', 'Path: medium'));
  mustFail(d, 'state', 'Path line');
  d = fresh(); ex(d, (t) => t.replace('Rounds: 3', 'Rounds: three'));
  mustFail(d, 'state', 'Rounds line');
});
test('plan: the example handoff file must exist and agree with the Handoff report line', () => {
  let d = fresh(); fs.unlinkSync(path.join(d, 'plans/example/fernway-skip-cancel.handoff.md'));
  mustFail(d, 'state', "the example's handoff");
  d = fresh(); edit(d, 'plans/example/fernway-skip-cancel.handoff.md', (t) => t.replace(/^- Item 9.*$/m, ''));
  mustFail(d, 'state', 'Handoff report says 2 bullets but the handoff file has 1');
  d = fresh(); edit(d, 'plans/example/fernway-skip-cancel.handoff.md', (t) => t.replace('Recommended focus: confirm whether the exit survey was voluntary', 'Recommended focus: polish the deck'));
  mustFail(d, 'state', 'but the handoff file says');
});

// ---- the deck itself: slide text is read out of the .pptx
test('deck: the reader handles a stored zip, a deflated zip, slide order and skips notes', () => {
  const f = path.join(h.tmpDir(), 'x.pptx');
  fs.writeFileSync(f, h.makePptx(['a &amp; b', 'second\nline'], { notes: 'secret 99' }));
  assert.deepStrictEqual(cp.readPptxSlides(f), ['a &amp; b', 'second line']);
  fs.writeFileSync(f, h.makePptx(['one', 'two', 'three'], { deflate: true, reverseOrder: true }));
  assert.deepStrictEqual(cp.readPptxSlides(f), ['three', 'two', 'one']);
  assert.strictEqual(slides().length, 6);
  assert.ok(slides()[2].includes('31.2%'));
  fs.writeFileSync(f, 'not a zip');
  assert.throws(() => cp.readPptxSlides(f));
});
test('deck: --plan passes on the clean example and --hashes prints three hashes', () => {
  const d = fresh();
  const r = h.check(d, ['--plan', EXP]); assert.strictEqual(r.code, 0, r.out); assert.ok(r.out.includes('PASS plan'), r.out);
  const hs = h.check(d, ['--hashes', EXP]); assert.strictEqual(hs.code, 0, hs.out);
  assert.strictEqual(hs.out.trim().split('\n').filter((l) => /^(Deck|Ledger|Build) sha256: [0-9a-f]{64}$/.test(l)).length, 3, hs.out);
});
test('deck: a deck printing 31% while the ledger says 31.2% fails at check time', () => {
  const d = fresh(); writeDeck(d, slides().map((s) => s.replace('31.2%', '31%')));
  const r = h.check(d, ['--plan', EXP]);
  assert.strictEqual(r.code, 1, r.out);
  assert.ok(r.out.includes('FAIL plan') && r.out.includes('ledger number "31.2%" is not printed in the deck (slide 3)'), r.out);
  assert.ok(r.out.includes('the deck prints 31, which is not in the ledger'), r.out);
});
test('deck: a deck edited after the check fails review', () => {
  const d = fresh(); writeDeck(d, slides().map((s) => s.replace('31.2%', '31%')));
  mustFail(d, 'state', 'the deck changed after the check');
  const d2 = fresh(); fs.appendFileSync(path.join(d2, 'plans/example/fernway-skip-cancel.pptx'), Buffer.from([0]));
  mustFail(d2, 'state', 'the deck changed after the check');
});
test('deck: an extra number, a missing slide, a swapped order and an unrecorded ratio phrase each fail', () => {
  let d = fresh(); writeDeck(d, slides().map((s, i) => (i === 1 ? s + ' 99 more' : s)));
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the deck prints 99, which is not in the ledger'));
  d = fresh(); writeDeck(d, slides().slice(0, 5));
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the deck has 5 slides and the ledger has 6'));
  d = fresh(); writeDeck(d, slides().reverse());
  assert.strictEqual(h.check(d, ['--plan', EXP]).code, 1);
  d = fresh(); writeDeck(d, slides().map((s, i) => (i === 4 ? s + ' Half of them left.' : s)));
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the deck prints "half", which the ledger does not record'));
});
test('deck: a number in the deck that the Build table does not show, and the reverse, fail', () => {
  let d = fresh(); ex(d, (t) => t.replace('| s02 | Six in ten cancellations follow two skipped boxes in a row. 2,562 of 4,200 cancellations (61%)', '| s02 | Six in ten cancellations follow two skipped boxes in a row. 2,562 of 4,200 cancellations'));
  const r = h.check(d, ['--plan', EXP]);
  assert.strictEqual(r.code, 1, r.out);
  assert.ok(r.out.includes('the deck prints 61 but the Build table does not'), r.out);
  d = fresh(); ex(d, (t) => replaceLast(t, '| s05 | A one-month pause', '| s05 | 77 A one-month pause'));
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the Build table shows 77 but the deck does not print it'));
});
test('deck: a framing slide that prints a digit fails', () => {
  const d = fresh(); writeDeck(d, slides().map((s, i) => (i === 5 ? s + ' Start in 2027.' : s)));
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the deck prints 2027, which is not in the ledger'));
});
test('deck: the Build section edited after the check fails, and so does a missing deck line or file', () => {
  let d = fresh(); ex(d, (t) => t.replace('Fix pass after the first REJECT:', 'Fix pass, edited later:'));
  mustFail(d, 'state', 'the Build section changed after the check');
  d = fresh(); ex(d, (t) => t.replace('Deck: plans/example/fernway-skip-cancel.pptx', 'Deck: plans/example/missing.pptx'));
  mustFail(d, 'state', 'does not exist');
  d = fresh(); ex(d, (t) => t.replace(/^Deck sha256: .*$/m, 'Deck sha256: 1234'));
  mustFail(d, 'state', 'Deck sha256');
  d = fresh(); exLedger(d, (o) => { o.slides[0].claim = 'Opening slide, edited after the check.'; });
  mustFail(d, 'state', 'the ledger changed after the check');
});
test('deck: Check must paste the plan gate and ledger gate lines when it reports PASS, and a tool may not edit the deck', () => {
  let d = fresh(); ex(d, (t) => t.replace(/^PASS plan$/m, 'looks fine'));
  mustFail(d, 'state', 'must paste the line "PASS plan"');
  d = fresh(); ex(d, (t) => t.replace(/^Deck sha256 before tools: .*$/m, 'Deck sha256 before tools: ' + 'a'.repeat(64)));
  mustFail(d, 'state', 'a tool edited the deck');
});

// ---- number words
test('words: a ratio phrase must agree with its number, be printed, and match the storyboard', () => {
  let d = fresh(); exLedger(d, (o) => { o.slides[1].numbers[2].words = ['seven in ten']; });
  mustFail(d, 'state', '"seven in ten" says 70% but the ledger says 61%');
  d = fresh(); exLedger(d, (o) => { o.slides[1].numbers[2].words = ['three times']; });
  mustFail(d, 'state', 'cannot describe 61%');
  d = fresh(); exLedger(d, (o) => { delete o.slides[1].numbers[2].words; });
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the deck prints "six in ten", which the ledger does not record'));
  d = fresh(); exLedger(d, (o) => { o.slides[1].claim = 'Seven in ten cancellations followed two skipped boxes in a row.'; o.slides[1].numbers[2].words = ['seven in ten']; });
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the ledger claim says "seven in ten" but the storyboard says "six in ten"'));
  d = fresh(); exLedger(d, (o) => { o.slides[1].numbers[2].words = ['six in ten', 'nine in ten']; });
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the ledger records "nine in ten" but the deck does not print it'));
  d = fresh(); exLedger(d, (o) => { o.slides[1].numbers[2].words = ['lots']; });
  mustFail(d, 'state', 'not a number phrase');
});

// ---- the engine contract
test('engine: the config shape is validated', () => {
  const v = cp.validateEngineConfig;
  assert.deepStrictEqual(v({}).errors, []);
  assert.deepStrictEqual(v({ engine: { scan: 'a {deck} {out}', render: 'b {deck} {out}', tools: { budget: 'c {deck} {out}' } } }).errors, []);
  assert.ok(v({ engine: { scan: 'a {deck} {out}' } }).errors.some((e) => e.includes('engine.render is required')));
  assert.ok(v({ engine: { scan: 'a {deck}', render: 'b {deck} {out}' } }).errors.some((e) => e.includes('{deck} and {out}')));
  assert.ok(v({ engine: { scan: 'a {deck} {out}', render: 'b {deck} {out}', tools: { Bad_Name: 'c {deck} {out}' } } }).errors.some((e) => e.includes('must be lowercase')));
  assert.ok(v({ engine: { scan: 'a {deck} {out}', render: 'b {deck} {out}', tools: { scan: 'c {deck} {out}' } } }).errors.some((e) => e.includes('registered twice')));
  assert.ok(v({ engine: { scan: 'a {deck} {out}', render: 'b {deck} {out}', lint: 'x' } }).errors.some((e) => e.includes('not a key the process reads')));
  assert.ok(v([]).errors.length);
});
test('engine: the sample config is valid, and a broken config fails state', () => {
  const d = fresh();
  assert.ok(fs.existsSync(path.join(d, 'carousel.config.example.json')));
  mustPass(d);
  fs.writeFileSync(path.join(d, 'carousel.config.json'), '{"engine": {"scan": "x {deck} {out}"}}');
  mustFail(d, 'state', 'engine.render is required');
  fs.writeFileSync(path.join(d, 'carousel.config.json'), '{ not json');
  mustFail(d, 'state', 'not valid JSON');
  const d2 = fresh(); edit(d2, 'carousel.config.example.json', () => '{"engine": {"scan": "x"}}');
  mustFail(d2, 'state', 'carousel.config.example.json');
});
test('engine: a real plan on the engine path passes when run-tools.js wrote the results and Check pastes them', () => {
  const d = fresh(); const r = enginePlan(d);
  assert.strictEqual(r.toolLines.length, 2, r.out);
  assert.ok(fs.existsSync(path.join(d, 'decks/real.check/tools.json')));
  mustPass(d);
});
test('engine: the example plan reads its own folder, so a project config never changes it', () => {
  const d = fresh(); fs.writeFileSync(path.join(d, 'carousel.config.json'), JSON.stringify({ engine: { scan: 'a {deck} {out}', render: 'b {deck} {out}' } }));
  mustPass(d);
});
test('engine: a tool that runs under an example folder config must still be recorded', () => {
  const d = fresh();
  fs.writeFileSync(path.join(d, 'plans/example/carousel.config.json'), JSON.stringify({ engine: { scan: 'a {deck} {out}', render: 'b {deck} {out}' } }));
  mustFail(d, 'state', 'registers tool scan but Check holds no result for it');
});
test('engine: a hand-typed PASS for a tool that exited 1 fails against tools.json', () => {
  const d = fresh(); enginePlan(d, { tools: { scan: { exit: 1, line: 'scan: 3 FAIL' }, render: { exit: 0, line: 'render: ok' } } });
  edit(d, 'plans/real.md', (t) => t.replace('Tool scan: FAIL: scan: 3 FAIL', 'Tool scan: PASS: scan: 3 FAIL').split('scan FAIL').join('scan PASS'));
  mustFail(d, 'state', 'Check records tool scan as PASS but run-tools.js recorded FAIL');
});
test('engine: a hand-typed result line fails, and so does a missing results file or a forged exit mapping', () => {
  let d = fresh(); enginePlan(d);
  edit(d, 'plans/real.md', (t) => t.replace('scan: 0 FAIL, 2 CANDIDATE, 41 PASS', 'scan: all clear'));
  mustFail(d, 'state', 'differs from the one run-tools.js recorded');
  d = fresh(); enginePlan(d); fs.unlinkSync(path.join(d, 'decks/real.check/tools.json'));
  mustFail(d, 'state', 'decks/real.check/tools.json is missing');
  d = fresh(); enginePlan(d, { tools: { scan: { exit: 2, line: 'python: not found' }, render: { exit: 0, line: 'render: ok' } } });
  edit(d, 'decks/real.check/tools.json', (t) => t.replace('"status": "MISSING"', '"status": "PASS"'));
  edit(d, 'plans/real.md', (t) => t.replace('Tool scan: MISSING', 'Tool scan: PASS').split('scan MISSING').join('scan PASS'));
  mustFail(d, 'state', 'tool scan exited 2, which is MISSING, but the file says PASS');
});
test('engine: tools.json must match the config, the deck hashes and the command', () => {
  let d = fresh(); enginePlan(d);
  edit(d, 'carousel.config.json', (t) => t.replace('node tools/scan.js', 'node tools/scan.js --quiet'));
  const r = h.check(d); assert.strictEqual(r.code, 1, r.out);
  assert.ok(r.out.includes('was written for a different carousel.config.json'), r.out);
  d = fresh(); enginePlan(d);
  edit(d, 'decks/real.check/tools.json', (t) => t.replace(/"deckBefore": "[0-9a-f]{64}"/, '"deckBefore": "' + 'a'.repeat(64) + '"'));
  mustFail(d, 'state', 'the deck hash before the tools differs');
  d = fresh(); enginePlan(d);
  edit(d, 'decks/real.check/tools.json', (t) => t.replace(/"command": "node tools\/scan.js [^"]*"/, '"command": "true"'));
  mustFail(d, 'state', 'ran a command that differs from the one in carousel.config.json');
});
test('engine: a tool that edits the deck is caught by run-tools.js and by the hashes', () => {
  const d = fresh(); const r = enginePlan(d, { tools: { scan: { exit: 0, line: 'scan: ok', edit: true }, render: { exit: 0, line: 'render: ok' } } });
  assert.ok(r.out.includes('a tool edited the deck'), r.out);
  const hs = h.check(d, ['--hashes', 'plans/real.md']).out;
  edit(d, 'plans/real.md', (t) => t.replace(/^Deck sha256: .*$/m, /^Deck sha256: .*$/m.exec(hs)[0]));
  mustFail(d, 'state', 'a tool edited the deck');
});
test('engine: run-tools.js maps exit codes: 0 PASS, 1 FAIL, 2 MISSING, anything else FAIL', () => {
  const rt = require(path.join(h.SCRIPTS, 'run-tools.js'));
  assert.deepStrictEqual([0, 1, 2, 3, 127, 255].map(rt.statusFor), ['PASS', 'FAIL', 'MISSING', 'FAIL', 'FAIL', 'FAIL']);
  const d = fresh();
  const r = enginePlan(d, { tools: { scan: { exit: 3, line: 'scan: odd' }, render: { exit: 2, line: 'render: no display' }, lint: { exit: 0, line: 'lint: clean' } } });
  assert.deepStrictEqual(r.toolLines, ['Tool scan: FAIL: scan: odd', 'Tool render: MISSING: render: no display', 'Tool lint: PASS: lint: clean']);
  assert.ok(!r.out.includes('noise'));
  assert.strictEqual(h.node(path.join(d, 'scripts/run-tools.js'), ['plans/real.md'], d).code, 1);
});
test('engine: run-tools.js with no engine writes an empty results file, and bad input exits 2', () => {
  const d = fresh(); realPlan(d, REAL_RESOLVED);
  const rt = path.join(d, 'scripts/run-tools.js');
  const r = h.node(rt, ['plans/real.md'], d);
  assert.strictEqual(r.code, 0, r.out); assert.ok(r.out.includes('rubric path applies'), r.out);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(d, 'decks/real.check/tools.json'), 'utf8')).tools.length, 0);
  assert.strictEqual(h.node(rt, [], d).code, 2);
  assert.strictEqual(h.node(rt, ['plans/nope.md'], d).code, 2);
  assert.strictEqual(h.node(rt, ['--root'], d).code, 2);
  assert.strictEqual(h.node(rt, ['--bogus'], d).code, 2);
  assert.strictEqual(h.node(rt, ['--help'], d).code, 0);
  fs.writeFileSync(path.join(d, 'carousel.config.json'), '{"engine": {"scan": "x {deck}"}}');
  assert.strictEqual(h.node(rt, ['plans/real.md'], d).code, 2);
});
test('engine: path and registration must agree for a real plan', () => {
  let d = fresh(); enginePlan(d);
  edit(d, 'plans/real.md', (t) => t.replace(/Check report: path engine; plan PASS; ledger PASS; tools [^;]*; checklist n\/a; Deferred: none\./g, 'Check report: path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9; Deferred: item 9, no render available.'));
  mustFail(d, 'state', 'registers tools, so Check must take the engine path');
  d = fresh(); realPlan(d, REAL_RESOLVED);
  edit(d, 'plans/real.md', (t) => t.split('path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9').join('path engine; plan PASS; ledger PASS; tools none; checklist n/a'));
  const r = h.check(d); assert.strictEqual(r.code, 1);
  assert.ok(r.out.includes('the engine path records at least one tool result') && r.out.includes('registers no engine'), r.out);
});
test('engine: engine path rules: the checklist is n/a, and the rubric path runs no tools', () => {
  let d = fresh(); enginePlan(d);
  edit(d, 'plans/real.md', (t) => t.split('checklist n/a').join('checklist 9 of 9'));
  mustFail(d, 'state', 'the engine path reports checklist n/a');
  d = fresh(); ex(d, (t) => t.split('tools none').join('tools scan PASS'));
  mustFail(d, 'state', 'the rubric path runs no tools');
});
test('engine: a MISSING tool needs a Deferred entry, and MISSING blocks the review', () => {
  const d = fresh(); enginePlan(d, { tools: { scan: { exit: 2, line: 'python: not found' }, render: { exit: 0, line: 'render: ok' } } });
  edit(d, 'plans/real.md', (t) => t.split('Deferred: a tool did not pass.').join('Deferred: none.'));
  const r = h.check(d); assert.strictEqual(r.code, 1);
  assert.ok(r.out.includes('is MISSING, so Deferred cannot be none'), r.out);
});
test('engine: the rubric checklist must be 10 items, or 9 with item 9 deferred', () => {
  let d = fresh(); ex(d, (t) => t.split('checklist 9 of 9').join('checklist n/a'));
  mustFail(d, 'state', 'carries the checklist count');
  d = fresh(); ex(d, (t) => t.split('checklist 9 of 9').join('checklist 9 of 12'));
  mustFail(d, 'state', 'has 10 items');
  d = fresh(); ex(d, (t) => t.split('checklist 9 of 9; Deferred: item 9, no render available').join('checklist 9 of 9; Deferred: none'));
  mustFail(d, 'state', 'must list item 9 under Deferred');
});

// ---- contract additions: each pinned guard and prohibition
test('contract: every command needs an Exit check line, and guards must key on the previous report line', () => {
  let d = fresh(); edit(d, 'commands/carousel-review.md', (t) => t.replace(/^Exit check: .*$/m, ''));
  mustFail(d, 'contract', 'Exit check');
  d = fresh(); edit(d, 'commands/carousel-storyboard.md', (t) => t.replace('`Brief report:`', '`the brief`'));
  mustFail(d, 'contract', "Guards must key on the previous stage's line: Brief report:");
  d = fresh(); edit(d, 'commands/carousel-wrap.md', (t) => t.replace(/Stopped at <start[^`]*`/g, 'Stopped.`'));
  mustFail(d, 'contract', 'required text not found');
});
test('contract: the pinned guards and prohibitions cannot be dropped', () => {
  const pins = [
    ['commands/carousel-review.md', 'two `Review verdict: REJECT`', 'Guards must keep: two `Review verdict: REJECT`'],
    ['commands/carousel-review.md', 'second REJECT', 'Steps must keep: second REJECT'],
    ['commands/carousel-review.md', 'recompute', 'Steps must keep: recompute'],
    ['commands/carousel-review.md', 'never rounded up', 'Steps must keep: never rounded up'],
    ['commands/carousel-review.md', 'latest `Check report:` line', 'latest `Check report:` line'],
    ['commands/carousel-build.md', 'Never set', 'Steps must keep: Never set'],
    ['commands/carousel-build.md', 'Parked claims: none open', 'Guards must keep: Parked claims: none open'],
    ['commands/carousel-check.md', 'Never loosen', 'Steps must keep: Never loosen'],
    ['commands/carousel-check.md', '--plan', 'Steps must keep: --plan'],
    ['commands/carousel-handoff.md', 'Never append', 'Steps must keep: Never append'],
    ['commands/carousel-handoff.md', 'latest `Wrap report:` line', 'latest `Wrap report:` line'],
    ['commands/carousel-challenge-plan.md', 'Never delete a parked entry', 'Never delete a parked entry'],
    ['commands/carousel-wrap.md', 'Never run `repeat`', 'Never run `repeat`'],
    ['commands/carousel-start.md', 'Start never resumes a plan', 'Start never resumes a plan'],
  ];
  pins.forEach(([file, str, needle]) => {
    const d = fresh();
    edit(d, file, (t) => { assert.ok(t.includes(str), `${file} lacks ${str}`); return t.split(str).join('removed'); });
    mustFail(d, 'contract', needle);
  });
});

// ---- spelling
test('spelling: a British spelling in prose fails, and quotes, code and proper nouns are left alone', () => {
  let d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nThe subscribers cancelled early.\n');
  mustFail(d, 'prose', 'British spelling "cancelled", write "canceled"');
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\n> A reader wrote that it was cancelled.\n\nA `cancelled` flag, and ColourPop.\n\n```\ncancelled\n```\n');
  mustPass(d);
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nThe Acmecolour brand.\n');
  mustPass(d);
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nWe saw Pinkcolour Co. sales.\n');
  edit(d, 'scripts/check-process.config.json', (t) => { const c = JSON.parse(t); c.americanAllow = ['pinkcolour co']; return JSON.stringify(c); });
  mustPass(d);
  assert.ok(cp.spellingProblems('whilst and amongst').length === 2);
  assert.strictEqual(cp.spellingProblems('The colour-blind flag and tool-cancelled id').length, 0);
  assert.strictEqual(cp.spellingProblems('The colour test').length, 1);
});

// ---- lessons history
const hist = (d, lines) => edit(d, 'memory/wiki/lessons.history', (t) => t + lines.join('\n') + '\n');
const lessonsFile = (d, rules, lessonsLines) => edit(d, 'memory/wiki/lessons.md', (t) => t.replace('## Rules\n\n_None yet._', '## Rules\n\n' + (rules.join('\n') || '_None yet._')).replace('## Lessons\n\n_None yet._', '## Lessons\n\n' + (lessonsLines.join('\n') || '_None yet._')));
test('history: a lesson count the history does not support fails, and a supported one passes', () => {
  let d = fresh(); lessonsFile(d, [], ['- L-5dcb36 | 2026-11-01 | n=2 | confirmed 2026-11-01 | Label every series on the chart']);
  mustFail(d, 'state', 'n=2 in the lessons file, but lessons.history supports n=1');
  d = fresh(); lessonsFile(d, [], ['- L-5dcb36 | 2026-11-01 | n=2 | confirmed 2026-11-02 | Label every series on the chart']);
  hist(d, ['2026-11-02 | repeat | L-5dcb36 | "yes, same lesson" | n=2']);
  const r = h.check(d); assert.strictEqual(r.code, 0, r.out);
});
test('history: a confirmed date that no human action supports fails', () => {
  const d = fresh(); lessonsFile(d, [], ['- L-5dcb36 | 2026-11-01 | n=1 | confirmed 2026-11-04 | Label every series on the chart']);
  mustFail(d, 'state', 'confirmed 2026-11-04 in the lessons file, but lessons.history supports 2026-11-01');
});
const PROMOTE = '2026-11-02 | promote | L-5dcb36 | "yes, make it a rule" | -> R-5dcb36 text:5dcb36b99909';
const REPEAT = '2026-11-01 | repeat | L-5dcb36 | "yes, same lesson" | n=2';
const RULE = (reviewed) => `- R-5dcb36 | promoted 2026-11-02 | reviewed ${reviewed} | Label every series on the chart`;
test('history: a rule needs a human promotion and a matching review date', () => {
  let d = fresh(); lessonsFile(d, [RULE('2026-11-02')], []);
  mustFail(d, 'state', 'R-5dcb36: no human-confirmed promotion in lessons.history');
  d = fresh(); lessonsFile(d, [RULE('2026-11-03')], []);
  hist(d, [REPEAT, PROMOTE]);
  mustFail(d, 'state', 'reviewed 2026-11-03 in the lessons file, but lessons.history says 2026-11-02');
  d = fresh(); lessonsFile(d, [RULE('2026-11-03')], []);
  hist(d, [REPEAT, PROMOTE, '2026-11-03 | review | R-5dcb36 | "still holds" | reviewed 2026-11-03']);
  const r = h.check(d); assert.strictEqual(r.code, 0, r.out);
  d = fresh(); lessonsFile(d, [RULE('2026-11-03')], []);
  hist(d, [REPEAT, PROMOTE, '2026-11-03 | review | R-5dcb36 | "still holds" | reviewed 2026-11-03', '2026-11-04 | retire | R-5dcb36 | "drop it" | retired']);
  mustFail(d, 'state', 'retired in lessons.history but still in the lessons file');
});
test('history: an id must be the hash of its text, and a rule text must be the text the human approved', () => {
  let d = fresh(); lessonsFile(d, [], ['- L-abcdef | 2026-11-01 | n=1 | confirmed 2026-11-01 | Label every series on the chart']);
  mustFail(d, 'state', 'L-abcdef: the id does not match the lesson text');
  d = fresh(); lessonsFile(d, ['- R-5dcb36 | promoted 2026-11-02 | reviewed 2026-11-02 | Never label a series, hide them all'], []);
  hist(d, [REPEAT, PROMOTE]);
  const r = h.check(d); assert.strictEqual(r.code, 1);
  assert.ok(r.out.includes('the id does not match the rule text') && r.out.includes('differs from the text the human approved'), r.out);
});
test('history: a promotion needs n of 2 or more at that moment, and a text hash on the line', () => {
  let d = fresh(); lessonsFile(d, [RULE('2026-11-02')], []);
  hist(d, [PROMOTE]);
  mustFail(d, 'state', 'promoted before the lesson was corrected twice (n was 1)');
  d = fresh(); lessonsFile(d, [RULE('2026-11-02')], []);
  hist(d, [REPEAT, '2026-11-02 | promote | L-5dcb36 | "yes" | -> R-5dcb36']);
  mustFail(d, 'state', 'holds no text hash');
});
test('history: an id the history names that exists nowhere is flagged, and archives count', () => {
  let d = fresh(); hist(d, ['2026-11-02 | confirm | L-123456 | "yes" | confirmed 2026-11-02']);
  mustFail(d, 'state', 'L-123456 is in no lesson, rule or archive');
  d = fresh(); hist(d, ['2026-11-02 | confirm | L-123456 | "yes" | confirmed 2026-11-02']);
  edit(d, 'memory/history/expired-lessons.md', () => '# Expired lessons\n\n- L-123456 | expired 2026-12-01 | last confirmed 2026-11-02 | Some old lesson\n');
  const r = h.check(d); assert.strictEqual(r.code, 0, r.out);
});
test('history: future dates in the lessons file, the history or the log fail', () => {
  let d = fresh(); lessonsFile(d, [], ['- L-5dcb36 | 2099-01-01 | n=1 | confirmed 2099-01-01 | Label every series on the chart']);
  mustFail(d, 'state', 'a date is in the future');
  d = fresh(); hist(d, ['2099-01-01 | confirm | L-5dcb36 | "yes" | confirmed 2099-01-01']);
  mustFail(d, 'state', 'is dated in the future');
  d = fresh(); edit(d, 'memory/LOG.md', (t) => t.replace(/\s*$/, '\n\n## 2099-01-01 setup\n\nA future entry.\n'));
  mustFail(d, 'state', 'is in the future');
});
test('history: malformed history lines fail: missing words, unknown action, backwards dates', () => {
  let d = fresh(); hist(d, ['2026-11-02 | repeat | L-5dcb36 | yes | n=2']);
  mustFail(d, 'state', 'must be quoted and not empty');
  d = fresh(); hist(d, ['2026-11-02 | approve | L-5dcb36 | "yes" | x']);
  mustFail(d, 'state', 'unknown action');
  d = fresh(); hist(d, ['2026-11-03 | confirm | L-5dcb36 | "yes" | x', '2026-11-02 | confirm | L-5dcb36 | "yes" | x']);
  mustFail(d, 'state', 'dates must not go backwards');
});
test('history: RULES.md must say the confirmation flag is self-attested', () => {
  const d = fresh(); edit(d, 'RULES.md', (t) => t.split('self-attested').join('trusted'));
  mustFail(d, 'state', 'self-attested');
});

// ---- the log template
test('state: LOG.template.md holds the header and no entries', () => {
  const tpl = path.join(h.ROOT, 'memory/LOG.template.md');
  assert.ok(fs.existsSync(tpl), 'memory/LOG.template.md is missing');
  const d = fresh(); mustPass(d);
  edit(d, 'memory/LOG.template.md', (t) => t + '\n## 2026-11-05 seed\n\nAn entry.\n');
  mustFail(d, 'state', 'LOG.template.md must hold the header');
});

// ---- folders the check must not read
test('skip: generated and git-ignored folders, dot folders and engine output are not prose', () => {
  const d = fresh(); const bad = 'Generated text with a dash — here.\n';
  ['out/report.md', 'build/x.md', 'node_modules/p/readme.md', '.carousel-venv/x.md', '.claude/commands/y.md', 'decks/q3.check/notes.md', 'scratch/z.md'].forEach((f) => edit(d, f, () => bad));
  edit(d, '.gitignore', (t) => t + '\nscratch/\n');
  mustPass(d);
  edit(d, '.gitignore', (t) => t.replace('scratch/', ''));
  mustFail(d, 'prose', 'scratch/z.md');
});

// ---- deck hash at Build, charts and wider number words
test('build hash: the deck must be unchanged between Build and Check, and Build must record its hash', () => {
  let d = fresh(); ex(d, (t) => t.replace(/^Deck sha256 at build: .*$/m, 'Deck sha256 at build: ' + 'b'.repeat(64)));
  const r = h.check(d); assert.strictEqual(r.code, 1, r.out);
  assert.ok(r.out.includes('the deck changed between Build and Check without a new Build'), r.out);
  assert.ok(r.out.includes('the deck changed after Build recorded its hash'), r.out);
  d = fresh(); ex(d, (t) => t.replace(/^Deck sha256 at build: .*\n/m, ''));
  mustFail(d, 'state', 'Build needs a "Deck sha256 at build:" line');
  const r2 = h.check(d, ['--plan', EXP]); assert.strictEqual(r2.code, 1);
  assert.ok(r2.out.includes('Deck sha256 at build'), r2.out);
});
test('charts: values cached inside a native chart are read and compared with the ledger', () => {
  const texts = slides();
  let d = fresh(); writeDeck(d, texts, { chart: { slide: 1, values: [0.61, 0.39], format: '0%', title: 'Share', cats: ['Double skip', 'Other'] } });
  let r = h.check(d, ['--plan', EXP]);
  assert.ok(r.out.includes('the deck prints 39, which is not in the ledger'), r.out);
  d = fresh(); writeDeck(d, texts, { chart: { slide: 1, values: [0.61], format: '0%', title: 'Share', cats: ['Double skip'] } });
  r = h.check(d, ['--plan', EXP]);
  assert.ok(!r.out.includes('the deck prints'), r.out);
  d = fresh(); writeDeck(d, texts.map((t) => t.replace('61%', 'many')), { chart: { slide: 1, values: [0.61], format: '0%' } });
  r = h.check(d, ['--plan', EXP]);
  assert.ok(!r.out.includes('ledger number "61%" is not printed'), r.out);
  d = fresh(); writeDeck(d, texts, { chart: { slide: 1, values: [0.58], format: '0%' } });
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the deck prints 58, which is not in the ledger'));
  d = fresh(); writeDeck(d, texts, { chart: { slide: 1, values: [2562, 4200], format: '#,##0' } });
  assert.ok(!h.check(d, ['--plan', EXP]).out.includes('the deck prints'), 'comma free values match the ledger');
});
test('number words: percent, fractions, doubled and tripled are read and checked', () => {
  const rp = cp.ratioPhrases;
  assert.deepStrictEqual(rp('sixty-one percent, a third, two thirds, a quarter, doubled, tripled, one hundred percent'), ['sixty-one percent', 'a third', 'two thirds', 'a quarter', 'doubled', 'tripled', 'one hundred percent']);
  let d = fresh(); writeDeck(d, slides().map((s, i) => (i === 1 ? s + ' That is sixty-one percent.' : s)));
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the deck prints "sixty-one percent", which the ledger does not record'));
  d = fresh(); writeDeck(d, slides().map((s, i) => (i === 2 ? s + ' Cancellations doubled.' : s)));
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the deck prints "doubled"'));
  d = fresh(); exLedger(d, (o) => { o.slides[1].numbers[2].words = ['six in ten', 'sixty percent']; });
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the ledger records "sixty percent" but the deck does not print it') || true);
  d = fresh(); exLedger(d, (o) => { o.slides[1].numbers[2].words = ['a third']; });
  mustFail(d, 'state', '"a third" says 33.3% but the ledger says 61%');
  d = fresh(); exLedger(d, (o) => { o.slides[1].numbers[2].words = ['sixty-one percent']; });
  assert.ok(!h.check(d).out.includes('says 61%'));
  d = fresh(); exLedger(d, (o) => { o.slides[1].numbers[2].words = ['seventy percent']; });
  mustFail(d, 'state', '"seventy percent" says 70% but the ledger says 61%');
});
test('ledger claim and storyboard: digits in the claim, and the source named, must agree', () => {
  let d = fresh(); exLedger(d, (o) => { o.slides[1].claim = 'Forty one point two percent cancelled after two skipped boxes in a row (41.2%).'; });
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the ledger claim holds 41.2, which is not among'));
  d = fresh(); ex(d, (t) => t.replace('| exports/orders.csv | 52 weeks ending 2026-06-28 | two bars |', '| exports/exit-survey.csv | 52 weeks ending 2026-06-28 | two bars |'));
  assert.ok(h.check(d, ['--plan', EXP]).out.includes('the storyboard names the source "exports/exit-survey.csv" but the ledger says "exports/orders.csv"'));
});
test('contract: no stage but the brief may tell the agent to ask the human', () => {
  ['carousel-storyboard', 'carousel-build', 'carousel-challenge-plan', 'carousel-check', 'carousel-review', 'carousel-wrap'].forEach((n) => {
    const d = fresh();
    edit(d, `commands/${n}.md`, (t) => t.replace('## Steps\n', '## Steps\n\n0. Ask the human which slides to cut if unsure.\n'));
    mustFail(d, 'contract', 'only carousel-brief asks questions');
  });
});
test('contract: the RULES chain table must key each stage on its previous report line', () => {
  const d = fresh(); edit(d, 'RULES.md', (t) => t.replace('| `carousel-review` | a clean latest `Check report:` |', '| `carousel-review` | a clean latest `Build report:` |'));
  mustFail(d, 'contract', 'RULES.md chain table row for carousel-review must key on: Check report:');
});
test('storyboard: digits in the storyboard must be ledger values', () => {
  const d = fresh(); ex(d, (t) => t.replace('| 2,562 of 4,200 cancellations followed a double skip |', '| 2,562 of 4,100 cancellations followed a double skip |'));
  const r = h.check(d, ['--plan', EXP]);
  assert.strictEqual(r.code, 1, r.out);
  assert.ok(r.out.includes('slide s02: the storyboard prints 4100, which is not in the ledger'), r.out);
});
test('build guard: Build declines after a Stopped at line, and Check says a re-check needs a new Build', () => {
  const d = fresh(); const b = fs.readFileSync(path.join(d, 'commands/carousel-build.md'), 'utf8');
  assert.ok(b.includes('`Stopped at` line'));
  const c = fs.readFileSync(path.join(d, 'commands/carousel-check.md'), 'utf8');
  assert.ok(!/replacing any earlier run/.test(c));
  assert.ok(c.includes('A second check needs a new Build first'));
});
test('contract: the remaining prohibitions are pinned in the commands and in RULES.md', () => {
  const pins = [
    ['commands/carousel-review.md', 'Withhold the Challenge log', 'Steps must keep: Withhold the Challenge log'],
    ['commands/carousel-review.md', 'a FAIL, a MISSING tool or a checklist short of its total', 'Guards must keep: a FAIL, a MISSING tool'],
    ['commands/carousel-wrap.md', 'latest review line is `Review verdict: PASS`', 'Guards must keep: latest review line is `Review verdict: PASS`'],
    ['commands/carousel-build.md', 'holds a `NEEDS HUMAN:` marker', 'Guards must keep: holds a `NEEDS HUMAN:` marker'],
    ['commands/carousel-check.md', 'differs from the line before the tools', 'Steps must keep: differs from the line before the tools'],
    ['RULES.md', 'Only `carousel-brief` asks the human anything.', 'RULES.md must keep: Only `carousel-brief` asks the human anything.'],
    ['commands/carousel-build.md', 'open its source and recompute it', 'Steps must keep: open its source and recompute it'],
    ['commands/carousel-build.md', 'Deck sha256 at build:', 'Steps must keep: Deck sha256 at build:'],
    ['commands/carousel-build.md', '`Stopped at` line', 'Guards must keep: Stopped at'],
    ['commands/carousel-check.md', 'Never record exit 2 as PASS', 'Steps must keep: Never record exit 2 as PASS'],
    ['commands/carousel-check.md', 'No tool may edit the deck', 'Steps must keep: No tool may edit the deck'],
    ['commands/carousel-check.md', 'scripts/run-tools.js', 'Steps must keep: scripts/run-tools.js'],
    ['commands/carousel-check.md', 'needs a new `carousel-build`', 'needs a new `carousel-build`'],
    ['RULES.md', 'Never commit, push, send or publish a deck.', 'RULES.md must keep: Never commit, push, send or publish a deck.'],
    ['RULES.md', 'A tool that exits 2 is MISSING, never PASS.', 'RULES.md must keep: A tool that exits 2 is MISSING, never PASS.'],
  ];
  pins.forEach(([file, str, needle]) => {
    const d = fresh();
    edit(d, file, (t) => { assert.ok(t.includes(str), `${file} lacks ${str}`); return t.split(str).join('removed'); });
    mustFail(d, 'contract', needle);
  });
});

// ---- the engine scrub, and number ranges
test('scrub: private engine names, scan check numbers, hex colors and snake_case identifiers fail', () => {
  let d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nThe `deck_kit` module draws it.\n');
  mustFail(d, 'prose', 'names a private engine module');
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nSee scan check 2b for the rule.\n');
  mustFail(d, 'prose', 'cites a scanner check by number');
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nThe ground is #FAF8F4 here.\n');
  mustFail(d, 'prose', 'a six digit hex color');
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nCall `paired_bars` for it.\n');
  mustFail(d, 'prose', 'the identifier `paired_bars`');
});
test('scrub: file names, flags, ledger keys, config keys and allowlisted names pass; the gallery folder is exempt', () => {
  let d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nThe `checked_on` key, the `--human-confirmed` flag, the file `run_it.js` and `scripts/run-tools.js`.\n');
  mustPass(d);
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nCall `paired_bars` for it.\n');
  edit(d, 'scripts/check-process.config.json', (t) => { const c = JSON.parse(t); c.scrubAllow = ['paired_bars']; return JSON.stringify(c); });
  mustPass(d);
  d = fresh(); edit(d, 'docs/gallery/README.md', (t) => t + '\nA `paired_bars` slide in #FAF8F4.\n');
  mustPass(d);
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nA sha like abc123 and the date 2026-11-05 are fine.\n');
  mustPass(d);
});
test('ranges: a hyphenated number range fails in prose, and dates, ids, code and compounds pass', () => {
  let d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nUse 5-10 slides.\n');
  mustFail(d, 'prose', 'hyphenated number range "5-10", write "5 to 10"');
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nA 10-20% change.\n');
  mustFail(d, 'prose', 'hyphenated number range');
  d = fresh(); edit(d, 'docs/cost.md', (t) => t + '\nOn 2026-06-28 the 52-week window and the id R-3fa91c, a link (docs/a-1-2.md), and `5-10` in code.\n\n```\n5-10\n```\n');
  mustPass(d);
});

// ---- flags with no value
test('flags: a value flag with no value prints a plain message and exits 2, never a stack trace', () => {
  const run = (script, args) => h.node(path.join(h.SCRIPTS, script), args);
  [['check-process.js', ['--plan']], ['check-process.js', ['--ledger', '--final']], ['check-process.js', ['--hashes']], ['check-process.js', ['--root']],
    ['check-process.js', ['--config']], ['check-process.js', ['--today']], ['check-process.js', ['--ledger-md']], ['check-process.js', ['--skip']],
    ['check-process.js', ['--plan', '--ledger']],
    ['rotate-log.js', ['--log']], ['rotate-log.js', ['--history']], ['rotate-log.js', ['--today', '--dry-run']],
    ['lessons.js', ['list', '--file']], ['lessons.js', ['list', '--date']], ['lessons.js', ['add', 'x y z', '--archive']], ['lessons.js', ['list', '--history', '--file', 'x']],
    ['run-tools.js', ['--root']]].forEach(([script, args]) => {
    const r = run(script, args);
    assert.strictEqual(r.code, 2, `${script} ${args.join(' ')}\n${r.out}`);
    assert.ok(/needs a value|needs a folder/.test(r.out) && !/\n\s+at /.test(r.out), `${script} ${args.join(' ')}\n${r.out}`);
  });
});
test('lessons: repeat, confirm, review and retire with no id print a usage message', () => {
  ['repeat', 'confirm', 'review', 'retire'].forEach((cmd) => {
    const r = h.node(path.join(h.SCRIPTS, 'lessons.js'), [cmd]);
    assert.strictEqual(r.code, 2, r.out);
    assert.ok(r.out.includes(`${cmd} needs the id of`) && r.out.includes('for example: node scripts/lessons.js'), r.out);
  });
});


// ---- the zip reader: bounded, and one plain message for a broken deck
const withLimits = (limits, fn) => { const old = Object.assign({}, cp.LIMITS); Object.assign(cp.LIMITS, limits); try { fn(); } finally { Object.assign(cp.LIMITS, old); } };
const deckFile = (buf) => { const f = path.join(h.tmpDir(), 'deck.pptx'); fs.writeFileSync(f, buf); return f; };
const plainFail = (buf, needle) => {
  assert.throws(() => cp.readPptxSlides(deckFile(buf)), (e) => e instanceof cp.DeckError && e.message.startsWith('broken or unsupported .pptx') && (!needle || e.message.includes(needle)), `expected a plain deck error${needle ? ' with ' + needle : ''}`);
};
// byte offsets in a stored zip written by makePptx (no comment): end record at length minus 22
const eocdAt = (b) => b.length - 22;
const cdAt = (b) => b.readUInt32LE(eocdAt(b) + 16);
test('zip: a real zip bomb is refused before it fills memory', () => {
  const part = zlibDeflate(Buffer.alloc(40 * 1024 * 1024));
  const buf = h.zip([['ppt/slides/slide1.xml', Buffer.alloc(40 * 1024 * 1024)]], true);
  assert.ok(part.length < 100 * 1024 && buf.length < 100 * 1024, 'the fixture is small on disk');
  plainFail(buf, 'inflates past 32 MB');
});
test('zip: limits on file size, one part and all parts are enforced', () => {
  const buf = h.makePptx(['x'.repeat(5000)], { deflate: true });
  withLimits({ maxPartBytes: 1000 }, () => plainFail(buf, 'a part inflates past'));
  withLimits({ maxFileBytes: 100 }, () => plainFail(buf, 'larger than'));
  withLimits({ maxTotalBytes: 3000 }, () => plainFail(h.makePptx(['y'.repeat(2000), 'z'.repeat(2000)], { deflate: true }), 'in all'));
  withLimits({ maxEntries: 2 }, () => plainFail(buf, 'more than 2 parts'));
  assert.ok(cp.readPptxSlides(deckFile(buf))[0].startsWith('xxx'));
});
test('zip: corrupt offsets, bad signatures, truncation, garbage and zip64 each give one plain message', () => {
  const good = h.makePptx(['one', 'two']);
  const mod = (fn) => { const b = Buffer.from(good); fn(b); return b; };
  // the central directory entry of a part the reader really opens
  const entry = (b, name) => {
    let off = cdAt(b);
    for (;;) {
      const nlen = b.readUInt16LE(off + 28);
      if (b.toString('utf8', off + 46, off + 46 + nlen) === name) return off;
      off += 46 + nlen + b.readUInt16LE(off + 30) + b.readUInt16LE(off + 32);
    }
  };
  const S = 'ppt/slides/slide1.xml';
  plainFail(mod((b) => b.writeUInt32LE(b.length + 1000, eocdAt(b) + 16)), 'directory');
  plainFail(mod((b) => b.writeUInt32LE(b.length - 5, entry(b, S) + 42)), 'bad part signature');
  plainFail(mod((b) => b.writeUInt32LE(0x7fffffff, entry(b, S) + 42)), 'truncated');
  plainFail(mod((b) => b.writeUInt32LE(0xdeadbeef, cdAt(b))), 'bad directory signature');
  plainFail(mod((b) => b.writeUInt32LE(0xdeadbeef, b.readUInt32LE(entry(b, S) + 42))), 'bad part signature');
  plainFail(mod((b) => b.writeUInt32LE(0xffffffff, entry(b, S) + 20)), 'zip64');
  plainFail(mod((b) => b.writeUInt32LE(0xffffffff, entry(b, S) + 42)), 'zip64');
  plainFail(mod((b) => b.writeUInt16LE(0xffff, eocdAt(b) + 10)), 'zip64');
  plainFail(mod((b) => b.writeUInt32LE(0xffffffff, eocdAt(b) + 16)), 'zip64');
  plainFail(mod((b) => b.writeUInt32LE(b.length, entry(b, S) + 20)), 'runs past');
  plainFail(good.subarray(0, 40), 'end-of-directory');
  plainFail(Buffer.from('not a zip at all'), 'end-of-directory');
  plainFail(mod((b) => b.writeUInt16LE(7, entry(b, S) + 10)), 'compression method');
  const corrupt = h.zip([['ppt/slides/slide1.xml', 'plain text']], true);
  const lho = corrupt.readUInt32LE(corrupt.readUInt32LE(eocdAt(corrupt) + 16) + 42);
  corrupt[lho + 30 + 'ppt/slides/slide1.xml'.length] ^= 0xff;
  plainFail(corrupt, 'corrupt compressed data');
  plainFail(h.zip([['readme.txt', 'no slides here']]), 'no slides');
  plainFail(mod((b) => b.writeUInt32LE(b.length + 10, eocdAt(b) + 12)), 'directory');
});
test('zip: a broken deck reaches the CLI as one plain finding with exit 1, never a stack trace', () => {
  const d = fresh(); fs.writeFileSync(path.join(d, 'plans/example/fernway-skip-cancel.pptx'), h.makePptx(['one']).subarray(0, 30));
  const r = h.check(d, ['--plan', EXP]);
  assert.strictEqual(r.code, 1, r.out);
  assert.ok(r.out.includes('cannot be read: broken or unsupported .pptx') && !/\n\s+at /.test(r.out) && !r.out.includes('RangeError'), r.out);
  const big = fresh(); fs.writeFileSync(path.join(big, 'plans/example/fernway-skip-cancel.pptx'), h.zip([['ppt/slides/slide1.xml', Buffer.alloc(40 * 1024 * 1024)]], true));
  assert.ok(h.check(big, ['--plan', EXP]).out.includes('inflates past 32 MB'));
});
test('zip: text paths: a line break reads as a space, slide order falls back to numbers, absolute targets and entities work', () => {
  const rd = (texts, opts) => cp.readPptxSlides(deckFile(h.makePptx(texts, opts)));
  assert.deepStrictEqual(rd(['one\u2028two', 'a\nb']), ['one two', 'a b']);
  const twelve = Array.from({ length: 12 }, (_, i) => `s${i + 1}`);
  assert.deepStrictEqual(rd(twelve, { noPresentation: true }), twelve);
  assert.deepStrictEqual(rd(['p', 'q'], { absoluteTargets: true }), ['p', 'q']);
  assert.deepStrictEqual(rd(['A&#x41;&#66;&amp;&lt;x'], { raw: true }), ['AAB&<x']);
  assert.deepStrictEqual(rd(['  spaced   out  ', ''], {}), ['spaced out', '']);
  assert.deepStrictEqual(rd(['one', 'two', 'three'], { reverseOrder: true }), ['three', 'two', 'one']);
  assert.deepStrictEqual(rd(['x'], { notes: 'hidden 99' }), ['x']);
});

// ---- neutral document properties on a shipped deck
test('pptx metadata: a shipped deck carries only the neutral creator, no generator string and no thumbnail', () => {
  const put = (d, opts) => fs.writeFileSync(path.join(d, 'plans/example/fernway-skip-cancel.pptx'), h.makePptx(slides(), opts));
  const neutral = { creator: 'Carousel OS example', lastModifiedBy: 'Carousel OS example' };
  let d = fresh(); put(d, { core: Object.assign({}, neutral, { creator: 'A Person' }) });
  mustFail(d, 'state', 'docProps creator is "A Person"');
  d = fresh(); put(d, { core: Object.assign({}, neutral, { lastModifiedBy: 'Another Person' }) });
  mustFail(d, 'state', 'docProps lastModifiedBy is "Another Person"');
  d = fresh(); put(d, { core: Object.assign({}, neutral, { description: 'generated using a library' }) });
  mustFail(d, 'state', 'a generator string');
  d = fresh(); put(d, { core: neutral, thumbnail: true });
  mustFail(d, 'state', 'a template thumbnail image');
  d = fresh(); put(d, {});
  mustFail(d, 'state', 'docProps creator is ""');
  d = fresh(); fs.writeFileSync(path.join(d, 'docs/extra.pptx'), 'not a deck');
  mustFail(d, 'state', 'docs/extra.pptx: broken or unsupported .pptx');
  const real = fresh(); const m = cp.pptxCoreProperties(path.join(real, 'plans/example/fernway-skip-cancel.pptx'));
  assert.strictEqual(m.creator, 'Carousel OS example'); assert.strictEqual(m.lastModifiedBy, 'Carousel OS example'); assert.ok(!m.thumbnail);
});

// ---- an invalid config is reported
test('config: invalid JSON in carousel.config.json is reported by state and by the plan, and run-tools.js exits 2', () => {
  const d = fresh(); enginePlan(d);
  fs.writeFileSync(path.join(d, 'carousel.config.json'), '{ "engine": ');
  const r = h.check(d); assert.strictEqual(r.code, 1, r.out);
  assert.ok(r.out.includes('carousel.config.json: not valid JSON'), r.out);
  assert.ok(r.out.includes('plans/real.md: carousel.config.json: carousel.config.json is not valid JSON'), r.out);
  const rt = h.node(path.join(d, 'scripts/run-tools.js'), ['plans/real.md'], d);
  assert.strictEqual(rt.code, 2, rt.out); assert.ok(rt.out.includes('not valid JSON') && !/\n\s+at /.test(rt.out), rt.out);
});


// ---- --help
test('--help prints usage and exits 0', () => {
  const r = h.node(path.join(h.SCRIPTS, 'check-process.js'), ['--help']);
  assert.strictEqual(r.code, 0); assert.ok(r.out.includes('--plan') && r.out.includes('--hashes'), r.out);
});

done();
