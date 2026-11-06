#!/usr/bin/env node
'use strict';
// A STUB renderer, here so the example config has the two tools the contract requires. It draws nothing.
// It writes the text of each slide to outline.txt in the out folder, so a person has something to read, and
// exits 0. A real renderer writes one image per slide and flags slides that overflow or collide.
//
//   node render.js <deck.pptx> <out-folder>
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function slides(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file');
  const found = [];
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    const nameLen = buf.readUInt16LE(off + 28);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const e = { method: buf.readUInt16LE(off + 10), size: buf.readUInt32LE(off + 20), header: buf.readUInt32LE(off + 42) };
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) found.push([parseInt(name.match(/\d+/)[0], 10), e]);
    off += 46 + nameLen + buf.readUInt16LE(off + 30) + buf.readUInt16LE(off + 32);
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, e]) => {
    const start = e.header + 30 + buf.readUInt16LE(e.header + 26) + buf.readUInt16LE(e.header + 28);
    const raw = buf.subarray(start, start + e.size);
    const xml = (e.method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
    return (xml.match(/<a:p>[\s\S]*?<\/a:p>/g) || []).map((p) => (p.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')).filter(Boolean);
  });
}

const [deck, out] = process.argv.slice(2);
if (!deck || !out) { console.log('render stub: MISSING, usage: node render.js <deck.pptx> <out-folder>'); process.exit(2); }
try {
  const all = slides(fs.readFileSync(deck));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'outline.txt'), 'STUB: text only, no pixels were drawn.\n\n' + all.map((p, i) => `Slide ${i + 1}\n${p.join('\n')}\n`).join('\n'));
  console.log(`render stub: wrote ${all.length} slide outlines to outline.txt (text only, no pixels)`);
} catch (e) { console.log('render stub: MISSING, cannot read deck ' + deck + ' (' + e.message + ')'); process.exit(2); }
