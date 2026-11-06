#!/usr/bin/env node
'use strict';
// run-tools: run every engine tool registered in carousel.config.json against a plan's deck.
//
//   node scripts/run-tools.js plans/<slug>.md [--root DIR]
//
// For each tool (scan, render, then the names under engine.tools in alphabetical order) it replaces
// {deck} with the deck path named on the plan's Build "Deck:" line and {out} with decks/<slug>.check,
// runs the command in a shell from the project root, and maps the exit code itself:
// 0 is PASS, 1 is FAIL, 2 is MISSING (the tool or its runtime is missing), any other code is FAIL.
// It prints one "Tool <name>: <STATUS>: <last line of output>" line per tool, to paste into the
// plan's Check section, and writes decks/<slug>.check/tools.json with the exit codes it saw.
// check-process compares that file with the Check section, so a status typed by hand does not pass.
// The deck is hashed before and after the tools run. A tool may not edit the deck.
//
// With no engine registered it writes an empty results file and says the rubric path applies.
// Exit 0 when every tool passed or none is registered, 1 when a tool did not pass, 2 on bad input.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
// The config is text, hashed with LF line endings the way check-process hashes it, so a CRLF checkout agrees.
const textSha256 = (text) => sha256(String(text).replace(/\r\n/g, '\n'));

function statusFor(exit) {
  if (exit === 0) return 'PASS';
  if (exit === 2) return 'MISSING';
  return 'FAIL';
}

function shellQuote(s) {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function expandCommand(template, deck, out) {
  return template.split('{deck}').join(shellQuote(deck)).split('{out}').join(shellQuote(out));
}

function toolOrder(tools) {
  const rest = Object.keys(tools).filter((n) => n !== 'scan' && n !== 'render').sort();
  return ['scan', 'render'].filter((n) => tools[n]).concat(rest);
}

function lastLine(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : '';
}

const HELP = [
  'run-tools: run the engine tools registered in carousel.config.json against a plan\'s deck.',
  '  node scripts/run-tools.js plans/<slug>.md [--root DIR]',
  'Exit codes of a tool: 0 PASS, 1 FAIL, 2 MISSING, any other FAIL. Output: one Tool line per tool,',
  'and decks/<slug>.check/tools.json. Exit 0 when all passed or none registered, 1 otherwise, 2 on bad input.',
].join('\n');

function main(argv) {
  let root = process.cwd();
  let plan = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { console.log(HELP); return 0; }
    if (a === '--root') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) { console.error('run-tools: --root needs a folder. Run with --help for usage.'); return 2; }
      root = path.resolve(v); i++;
    } else if (a.startsWith('--')) { console.error(`run-tools: unknown argument ${a}\n${HELP}`); return 2; }
    else if (plan === null) plan = a;
    else { console.error(`run-tools: one plan at a time\n${HELP}`); return 2; }
  }
  if (!plan) { console.error(`run-tools: name a plan file\n${HELP}`); return 2; }
  const planFile = path.resolve(root, plan);
  if (!fs.existsSync(planFile)) { console.error(`run-tools: ${plan} does not exist`); return 2; }
  const text = fs.readFileSync(planFile, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Build');
  let end = lines.length;
  for (let i = start + 1; start >= 0 && i < lines.length; i++) if (/^## /.test(lines[i])) { end = i; break; }
  const dm = start >= 0 ? /^Deck:\s*(.+?)\s*$/m.exec(lines.slice(start + 1, end).join('\n')) : null;
  if (!dm) { console.error('run-tools: the plan has no Build section with a "Deck: <path>" line'); return 2; }
  const deckRel = dm[1].replace(/`/g, '');
  const deckFile = path.join(root, deckRel);
  if (!fs.existsSync(deckFile)) { console.error(`run-tools: the deck ${deckRel} does not exist`); return 2; }
  const slug = path.basename(planFile, '.md');
  const outRel = `decks/${slug}.check`;
  const configFile = path.join(root, 'carousel.config.json');
  const results = { plan: path.relative(root, planFile).split(path.sep).join('/'), deck: deckRel, configSha256: null, deckBefore: sha256(fs.readFileSync(deckFile)), deckAfter: null, tools: [] };
  let tools = {};
  if (fs.existsSync(configFile)) {
    const raw = fs.readFileSync(configFile, 'utf8');
    results.configSha256 = textSha256(raw);
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { console.error(`run-tools: carousel.config.json is not valid JSON (${e.message})`); return 2; }
    const e = obj && obj.engine;
    if (e) {
      if (typeof e.scan !== 'string' || typeof e.render !== 'string') { console.error('run-tools: engine.scan and engine.render are both required. See bookshelf/engine-contract.md.'); return 2; }
      tools = Object.assign({}, e.tools || {}, { scan: e.scan, render: e.render });
      for (const n of Object.keys(tools)) {
        if (typeof tools[n] !== 'string' || !tools[n].includes('{deck}') || !tools[n].includes('{out}')) { console.error(`run-tools: the command for "${n}" must hold {deck} and {out}`); return 2; }
      }
    }
  }
  fs.mkdirSync(path.join(root, outRel), { recursive: true });
  const names = toolOrder(tools);
  if (!names.length) {
    results.deckAfter = results.deckBefore;
    fs.writeFileSync(path.join(root, outRel, 'tools.json'), JSON.stringify(results, null, 2) + '\n');
    console.log('run-tools: no engine is registered in carousel.config.json, so the rubric path applies.');
    return 0;
  }
  names.forEach((name) => {
    const command = expandCommand(tools[name], deckRel, outRel);
    const r = cp.spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const exit = typeof r.status === 'number' ? r.status : 1;
    const line = lastLine(r.stdout) || lastLine(r.stderr) || '(no output)';
    results.tools.push({ name, command, exit, status: statusFor(exit), line });
  });
  results.deckAfter = sha256(fs.readFileSync(deckFile));
  fs.writeFileSync(path.join(root, outRel, 'tools.json'), JSON.stringify(results, null, 2) + '\n');
  results.tools.forEach((t) => console.log(`Tool ${t.name}: ${t.status}: ${t.line}`));
  if (results.deckAfter !== results.deckBefore) console.log('run-tools: a tool edited the deck. The hashes before and after differ. Report plan FAIL.');
  const bad = results.tools.filter((t) => t.status !== 'PASS').length || (results.deckAfter !== results.deckBefore ? 1 : 0);
  console.log(`run-tools: ${results.tools.length} tools, ${results.tools.filter((t) => t.status === 'PASS').length} PASS`);
  return bad ? 1 : 0;
}

module.exports = { statusFor, expandCommand, toolOrder, lastLine, shellQuote, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
