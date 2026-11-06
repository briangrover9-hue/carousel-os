#!/usr/bin/env node
'use strict';
// make-release-zip: build dist/carousel-os-<version>.zip, the file attached to a GitHub release. Zero dependencies;
// it calls the system `zip` command and stops with a plain message when there is none.
//
//   node scripts/make-release-zip.js [--out DIR]
//
// The zip holds exactly what `init` installs into an empty project, at the zip root, including the
// .carousel-install.json manifest, so a later `update` treats the unzipped files as the tool's own.
// Repository only: the installer never copies this script into a project.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const USAGE = 'usage: node scripts/make-release-zip.js [--out DIR]';

class ZipError extends Error { constructor(msg, code) { super(msg); this.code = code || 1; } }
// Thrown, so the temp folder is still removed on the way out.
function fail(msg, code) { throw new ZipError(msg, code); }

function main(argv) {
  let outDir = path.join(ROOT, 'dist');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1] && !argv[i + 1].startsWith('--')) outDir = path.resolve(argv[++i]);
    else if (argv[i] === '-h' || argv[i] === '--help') { console.log(USAGE); return 0; }
    else fail((argv[i] === '--out' ? '--out needs a folder' : 'unknown argument ' + argv[i]) + '\n' + USAGE, 2);
  }
  const probe = cp.spawnSync('zip', ['-v'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) fail('the `zip` command was not found. Install zip, then run this again.');

  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-zip-'));
  try {
    const project = path.join(stage, 'project');
    fs.mkdirSync(project);
    const init = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'install.js'), 'init', project], { encoding: 'utf8' });
    if (init.status !== 0) fail('the installer failed:\n' + (init.stdout || '') + (init.stderr || ''));

    fs.mkdirSync(outDir, { recursive: true });
    const zipFile = path.join(outDir, `carousel-os-${version}.zip`);
    fs.rmSync(zipFile, { force: true });
    // -X leaves out extra file attributes, -q keeps it quiet, -r takes every file, dot files included.
    const z = cp.spawnSync('zip', ['-X', '-q', '-r', zipFile, '.'], { cwd: project, encoding: 'utf8' });
    if (z.status !== 0) fail('zip failed:\n' + (z.stdout || '') + (z.stderr || ''));

    const count = (function walk(dir) {
      return fs.readdirSync(dir, { withFileTypes: true }).reduce((n, d) => n + (d.isDirectory() ? walk(path.join(dir, d.name)) : 1), 0);
    })(project);
    const bytes = fs.statSync(zipFile).size;
    console.log(`make-release-zip: wrote ${path.relative(process.cwd(), zipFile) || zipFile} (${count} files, ${bytes} bytes)`);
    return 0;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); } catch (e) {
    if (!(e instanceof ZipError)) throw e;
    process.stderr.write('make-release-zip: ' + e.message + '\n');
    process.exit(e.code);
  }
}
module.exports = { main };
