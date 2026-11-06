# Contributing

Open an issue before a large change. For a small one, open a pull request with a clear reason.

Before you push, run `npm run check`. It runs the process checks, the byte budgets, the skill copy check, the tests, a link check and a leak scan.

Rules for changes:

- Every stage ends with its exact report line, and `node scripts/check-process.js` holds it to that. Edit a stage and its checks together.
- Edit a stage only in `.agents/skills/<name>/SKILL.md`, below its front matter, and then run `node scripts/generate-skills.js`. It writes the front matter, the Codex settings file and the copy in `.claude/skills/`. The same run copies `agents/` to `.claude/agents/`.
- A new check needs a test that fails without it and passes with it.
- Write plain American English with no dashes as punctuation.
- Keep names of real clients, companies and people out of examples. Use invented ones.
- This repository ships the process and a blueprint for building your own engine. It does not ship an engine.
