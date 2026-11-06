# Contributing

Open an issue before a large change. For a small one, open a pull request with a clear reason.

Before you push, run `npm run check`. It runs the process checks, the process tests, the installer tests, a link check and a leak scan.

Rules for changes:

- Every command ends with its exact report line, and `node scripts/check-process.js` holds it to that. Edit a command and its checks together.
- A new check needs a test that fails without it and passes with it.
- Write plain American English with no dashes as punctuation.
- Keep names of real clients, brands and people out of examples. Use invented ones.
- This repository ships the process and a blueprint for building your own engine. It does not ship an engine.
