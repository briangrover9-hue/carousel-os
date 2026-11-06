# Changelog

## 0.1.0

The first release. It ships the process, the checks that hold an agent to it, and a blueprint for building your own engine. It ships no engine.

- **Nine stages.** `carousel-start` through `carousel-handoff`, each a skill in `.agents/skills/<name>/SKILL.md` with a fixed report line, guards keyed on the previous stage's line, and a No-rubber-stamp guard. Every stage is manual-only: the front matter sets `disable-model-invocation: true` and each stage's `.agents/skills/<name>/agents/openai.yaml` sets `allow_implicit_invocation: false`, so no tool starts a stage on its own.
- **Three tools.** Cursor and Codex read `.agents/skills/`. Claude Code reads byte-identical copies in `.claude/skills/`, written by `scripts/generate-skills.js`. `AGENTS.md` and `CLAUDE.md` point every tool to `RULES.md`.
- **Two reviewer agents.** `agents/carousel-reviewer.md` tries to disprove the deck against the bar. `agents/carousel-fidelity.md` recomputes every number on the slides from the ledger's sources. Both start with fresh context, are limited to read-only tools, and return PASS, REJECT or UNVERIFIABLE with pasted evidence. Claude Code finds them in `.claude/agents/`, and any other tool can take the body as instructions.
- **A claim ledger.** One entry per slide, each number with its source and window, `checked` only after a recorded recomputation. `node scripts/check-process.js --plan` reads the slide text and native chart values out of the .pptx and compares them with the ledger.
- **A plan state machine.** `node scripts/check-process.js` checks report lines, stage order, hashes from Build to Check to Review, the REJECT cap, the prose and spelling rules, and the byte budgets for `RULES.md` and each stage file.
- **A lessons loop.** `node scripts/lessons.js` logs corrections, and only a human promotes one to a rule.
- **An installer.** `node scripts/install.js init`, `update` and `doctor`, with a manifest that never replaces a file you edited or a file of yours with the same name. `--no-agents` skips the `.claude/` copies.
- **A worked example.** An invented subscription business, a deck that was rejected once and then passed, with its plan, ledger and handoff.
- **Build your engine.** A blueprint for a scanner, renderer and drawing kit, with a small reference scanner in `docs/build-your-engine/example`.
- **A small package.** The npm package carries no images. The hero image and the gallery stay on GitHub, the README loads its image from there, and the installer leaves `docs/gallery/` out of your project.
