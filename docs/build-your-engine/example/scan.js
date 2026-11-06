#!/usr/bin/env node
'use strict';
// A reference scanner for Carousel OS. Zero dependencies. It reads a finished .pptx and checks five things
// against tokens.json: headline length, type sizes, colors, text contrast and percentages with no base.
//
//   node scan.js <deck.pptx> <out-folder> [--tokens tokens.json]
//
// It never edits the deck. It writes scan-report.md and scan-report.json into the out folder, prints a last
// line "scan: N FAIL, M CANDIDATE", and exits 0 (no FAIL), 1 (a FAIL) or 2 (deck or tokens missing or unreadable).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- a .pptx is a zip of XML: read the central directory, inflate what we need
function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const entries = new Map();
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('broken zip directory');
    const nameLen = buf.readUInt16LE(off + 28);
    const skip = nameLen + buf.readUInt16LE(off + 30) + buf.readUInt16LE(off + 32);
    entries.set(buf.toString('utf8', off + 46, off + 46 + nameLen), {
      method: buf.readUInt16LE(off + 10), size: buf.readUInt32LE(off + 20), header: buf.readUInt32LE(off + 42),
    });
    off += 46 + skip;
  }
  return entries;
}

function zipRead(buf, e) {
  const start = e.header + 30 + buf.readUInt16LE(e.header + 26) + buf.readUInt16LE(e.header + 28);
  const data = buf.subarray(start, start + e.size);
  if (e.method === 0) return data;
  if (e.method === 8) return zlib.inflateRawSync(data);
  throw new Error('unsupported zip compression ' + e.method);
}

// ---- slides: regular expressions are enough for the few tags these checks need
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attr = (tag, name) => { const m = new RegExp(name + '="([^"]*)"').exec(tag); return m ? m[1] : null; };
const hexIn = (xml) => { const m = /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(xml); return m ? m[1].toUpperCase() : null; };

function parseSlide(xml, n) {
  const bg = /<p:bg>[\s\S]*?<\/p:bg>/.exec(xml);
  const shapes = (xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || []).map((sp) => {
    const spPr = /<p:spPr>[\s\S]*?<\/p:spPr>/.exec(sp);
    const paras = (sp.match(/<a:p>[\s\S]*?<\/a:p>/g) || []).map((p) => (p.match(/<a:r>[\s\S]*?<\/a:r>/g) || []).map((r) => {
      const rPr = /<a:rPr[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/.exec(r);
      const size = rPr ? attr(rPr[0], 'sz') : null;
      return { text: unescape((/<a:t>([\s\S]*?)<\/a:t>/.exec(r) || [, ''])[1]), size: size ? Number(size) / 100 : null, color: rPr ? hexIn(rPr[0]) : null };
    }));
    return {
      name: attr(/<p:cNvPr[^>]*>/.exec(sp)[0], 'name') || '',
      placeholder: attr((/<p:ph[^>]*>/.exec(sp) || [''])[0], 'type'),
      fill: spPr && /<a:solidFill>/.test(spPr[0].replace(/<a:ln[\s\S]*?<\/a:ln>/, '')) ? hexIn(spPr[0].replace(/<a:ln[\s\S]*?<\/a:ln>/, '')) : null,
      paras: paras.filter((p) => p.length),
    };
  });
  const text = shapes.map((s) => s.paras.map((p) => p.map((r) => r.text).join('')).join('\n')).join('\n');
  return { n, xml, shapes, text, background: bg ? hexIn(bg[0]) : null };
}

// ---- the five checks. Each returns findings: { check, slide, level: 'FAIL' | 'CANDIDATE', message }
function luminance(hex) {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// A headline is a shape named headline or title, or the first sentence of the first text on the slide.
function headlineOf(slide) {
  const shape = slide.shapes.find((s) => /^(headline|title)/i.test(s.name) || /title/i.test(s.placeholder || '')) || slide.shapes.find((s) => s.paras.length);
  if (!shape) return null;
  const first = shape.paras[0].map((r) => r.text).join('').trim();
  const named = shape === slide.shapes.find((s) => /^(headline|title)/i.test(s.name) || /title/i.test(s.placeholder || ''));
  return (named ? first : first.split(/(?<=[.!?])\s/)[0]).replace(/[.!?]$/, '');
}

function checkHeadlines(slides, tokens) {
  const out = [];
  slides.forEach((s) => {
    const h = headlineOf(s);
    if (!h) return;
    const max = tokens.headline.maxChars;
    if (h.length > max) out.push({ check: 'headline length', slide: s.n, level: 'FAIL', message: `${h.length} characters, limit ${max}: "${h}"` });
    else if (h.length > 0.9 * max) out.push({ check: 'headline length', slide: s.n, level: 'CANDIDATE', message: `${h.length} characters, within 10 percent of the ${max} limit` });
  });
  return out;
}

function checkSizes(slides, tokens) {
  const out = [];
  slides.forEach((s) => {
    const sizes = new Set();
    (s.xml.match(/<a:(?:rPr|defRPr)[^>]*>/g) || []).forEach((t) => { const v = attr(t, 'sz'); if (v) sizes.add(Number(v) / 100); });
    sizes.forEach((z) => { if (!tokens.type.scale.includes(z)) out.push({ check: 'type sizes', slide: s.n, level: 'FAIL', message: `${z}pt is not on the scale ${tokens.type.scale.join(', ')}` }); });
  });
  return out;
}

function checkColors(slides, tokens) {
  const allowed = new Set(Object.values(tokens.palette).map((h) => h.toUpperCase()));
  const out = [];
  slides.forEach((s) => {
    const seen = new Set((s.xml.match(/<a:srgbClr val="[0-9A-Fa-f]{6}"/g) || []).map((m) => m.slice(-7, -1).toUpperCase()));
    seen.forEach((c) => { if (!allowed.has(c)) out.push({ check: 'colors', slide: s.n, level: 'FAIL', message: `#${c} is not in the palette` }); });
  });
  return out;
}

// Only a run with a color of its own, sitting on a known fill, can be measured. The rest are counted as not scanned.
function checkContrast(slides, tokens) {
  const out = [];
  let unscanned = 0;
  slides.forEach((s) => s.shapes.forEach((sh) => sh.paras.forEach((p) => p.forEach((r) => {
    const under = sh.fill || s.background;
    if (!r.color || !under || !r.text.trim()) { if (r.text.trim()) unscanned++; return; }
    const ratio = contrast(r.color, under);
    if (ratio < tokens.contrast.min) out.push({ check: 'text contrast', slide: s.n, level: 'FAIL', message: `#${r.color} on #${under} is ${ratio.toFixed(2)}:1, under ${tokens.contrast.min}:1: "${r.text.slice(0, 40)}"` });
  }))));
  return { findings: out, unscanned };
}

// A percentage needs a count beside it on the same slide: 4,200 or 1204 or n=300. Years do not count.
function checkBases(slides) {
  const out = [];
  slides.forEach((s) => {
    const pct = s.text.match(/\d+(?:\.\d+)?%/g);
    if (!pct) return;
    const counts = (s.text.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d{3,}\b|\bn\s*=\s*\d+/g) || []).filter((c) => !/^(19|20)\d\d$/.test(c));
    if (!counts.length) out.push({ check: 'percentage base', slide: s.n, level: 'FAIL', message: `${pct.join(', ')} with no base (a count of what it is a percent of) on the slide` });
  });
  return out;
}

// ---- run
function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const t = argv.indexOf('--tokens');
  const tokensPath = t >= 0 ? argv[t + 1] : path.join(__dirname, 'tokens.json');
  const [deckPath, outDir] = args.filter((a) => a !== tokensPath);
  if (!deckPath || !outDir) { console.log('usage: node scan.js <deck.pptx> <out-folder> [--tokens tokens.json]\nscan: MISSING, no deck or out folder given'); return 2; }
  let tokens, slides;
  try { tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8')); } catch (e) { console.log('scan: MISSING, cannot read tokens ' + tokensPath); return 2; }
  try {
    const buf = fs.readFileSync(deckPath);
    const entries = zipEntries(buf);
    slides = [...entries.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
      .map((k, i) => parseSlide(zipRead(buf, entries.get(k)).toString('utf8'), i + 1));
    if (!slides.length) throw new Error('no slides found');
  } catch (e) { console.log('scan: MISSING, cannot read deck ' + deckPath + ' (' + e.message + ')'); return 2; }

  const contrastResult = checkContrast(slides, tokens);
  const findings = [].concat(checkHeadlines(slides, tokens), checkSizes(slides, tokens), checkColors(slides, tokens), contrastResult.findings, checkBases(slides));
  const fails = findings.filter((f) => f.level === 'FAIL').length;
  const cands = findings.length - fails;

  fs.mkdirSync(outDir, { recursive: true });
  const lines = [`# Scan report`, '', `Deck: ${deckPath}`, `Slides: ${slides.length}`, `Tokens: ${path.relative(process.cwd(), tokensPath) || tokensPath}`, ''];
  ['headline length', 'type sizes', 'colors', 'text contrast', 'percentage base'].forEach((c) => {
    const mine = findings.filter((f) => f.check === c);
    lines.push(`## ${c}: ${mine.some((f) => f.level === 'FAIL') ? 'FAIL' : mine.length ? 'CANDIDATE' : 'PASS'}`);
    mine.forEach((f) => lines.push(`- ${f.level} slide ${f.slide}: ${f.message}`));
    if (c === 'text contrast') lines.push(`- ${contrastResult.unscanned} text runs have no color of their own or sit on no known fill: NOT SCANNED`);
    lines.push('');
  });
  fs.writeFileSync(path.join(outDir, 'scan-report.md'), lines.join('\n'));
  fs.writeFileSync(path.join(outDir, 'scan-report.json'), JSON.stringify({ slides: slides.length, findings, notScanned: contrastResult.unscanned }, null, 2) + '\n');
  findings.forEach((f) => console.log(`${f.level} slide ${f.slide} ${f.check}: ${f.message}`));
  console.log(`scan: ${fails} FAIL, ${cands} CANDIDATE`);
  return fails ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
