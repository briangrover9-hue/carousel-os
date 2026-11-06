# Carousel OS

![Carousel OS: example slides arranged around the title](docs/hero.png)

A deck process for agents, with a ledger for every number.

Every number printed on a slide gets an entry in a claim ledger: its source, its window, and a check that has to pass before the entry counts. A script then reads the slide text out of the deck file and compares it with the ledger, so a slide that prints 31% against a ledger value of 31.2% fails the check.

I built a deck by hand, swore I would never do it that way again, and turned the habits I had picked up into this process.

## Who it is for

People who ship decks with numbers in them: analysts, consultants, product and strategy leads, anyone who presents a readout to readers who will ask where a figure came from. It runs inside an agent such as Claude Code and needs Node 18 or newer.

## What you get

- A finished, checked deck in PowerPoint or Google Slides.
- A claim ledger for it: one entry per slide, each number with its source and window, each marked checked only after someone recomputed it.
- A plan file that records every stage, so you can read how the deck got made.
- A memory that carries your corrections from one deck to the next.

## The problem

A deck with numbers fails quietly. Slide 3 says 31% and slide 9 says 31.2%. A percentage has its base on one slide and none on the next. The headlines read in order stop making an argument halfway down. Nobody caught any of it because the same person drew the deck and judged it.

The process makes the builder one checker among several, and gives every number a row that says where it came from.

## How it works

You type nine commands, one at a time. No command starts the next, and each declines to run until the previous stage's report line is in the plan.

1. `carousel-start` reads what the last session left and opens a plan.
2. `carousel-brief` interviews you. It is the only stage that asks questions.
3. `carousel-storyboard` writes one headline, claim and source per slide, and opens the ledger.
4. `carousel-challenge-plan` attacks the plan from a new angle, three rounds on the full path.
5. `carousel-build` builds the deck and checks each ledger row as its slide is finished.
6. `carousel-check` reads the deck file, runs any engine you registered, and pastes exact results.
7. `carousel-review` hands the deck to a reviewer with fresh context who tries to disprove it.
8. `carousel-wrap` runs one more check, logs the session and records lessons.
9. `carousel-handoff` writes the note the next session starts from.

One prompt cannot do this job. It would interpret the request, pick the story, find the numbers, draw the slides and grade itself in a single pass, so its mistakes go into the deck with its own approval. [How it thinks](docs/how-it-thinks.md) explains what each piece of the process prevents. A short internal deck can take the [light path](docs/light-path.md): the same nine stages with one critique round.

## What a run looks like

These are real report lines from the [worked example](plans/example/fernway-skip-cancel.md), an invented subscription business. The critique round caught a survey percentage divided by the wrong base, and the first review rejected a slide that printed 31% where the source says 31.2%. The example deck is a plain text deck built without an engine, so it shows the process and has no design to judge.

```
Start report: plan plans/example/fernway-skip-cancel.md created; path full; handoff read; lessons loaded 0.
Brief report: 6 questions asked, 6 answers recorded, 0 NEEDS HUMAN markers open.
Storyboard report: 6 slides, headlines-only read holds, ledger rows 6.
Challenge round 1 of 3: angle Literal ask (new). Re-verified 4 claims, demoted 0 to uncertainty.
Challenge round 2 of 3: angle The unreconcilable number (new). Re-verified 5 claims, demoted 1 to uncertainty.
Challenge round 3 of 3: angle Parked claims (new). Re-verified 2 claims, demoted 0 to uncertainty.
Build report: 6 slides built, 6 ledger rows checked, 2 deviations logged.
Check report: path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9; Deferred: item 9, no render available.
Review verdict: REJECT; unreconciled numbers 1; findings 1.
Build report: 6 slides built, 6 ledger rows checked, 2 deviations logged.
Check report: path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9; Deferred: item 9, no render available.
Review verdict: PASS; unreconciled numbers 0; findings 0.
Wrap report: check PASS; log entry written; lessons added 1; wiki pages touched 1; entries rotated 0.
Handoff report: memory/handoff.md written; 2 bullets; focus confirm whether the exit survey was voluntary.
```

## Evidence you can read

- [The plan](plans/example/fernway-skip-cancel.md) holds the brief, storyboard, three critique rounds with their diff summaries, the pasted check output and the reviewer's evidence.
- [The ledger](plans/example/fernway-skip-cancel.ledger.json) holds 12 numbers across 6 slides, each with its source and the check that confirmed it.
- `node scripts/check-process.js` reads that plan as a state machine and opens the deck file. It fails when a report line is out of order, when a number printed in the deck is missing from the ledger, when a deck changes after its check, or when a review passes without pasted evidence. `node tests/process/run.js` holds the broken variants it must reject, including a plan that was rubber-stamped from start to finish.

## Bring your own engine

An engine is a program that draws slides, checks them, or both: a scanner that counts type sizes and colors, a renderer that turns the deck into images, a drawing kit that refuses what it cannot draw well. Carousel OS does not ship one. It ships the process and a blueprint, and it works without an engine, using a written checklist instead.

You can build your own, or plug in one you already have. Register it in `carousel.config.json` with a scan command and a render command, each a shell template that takes `{deck}` and `{out}`, plus any other named tools. A tool exits 0 for PASS, 1 for FAIL and 2 when it or its runtime is missing, and `carousel-check` records the last line of its output. The sample is [carousel.config.example.json](carousel.config.example.json) and the keys are defined in [the engine contract](bookshelf/engine-contract.md).

- [Build your engine](docs/build-your-engine/README.md) says what a good engine checks and in what order to build it.
- [The gallery](docs/gallery/README.md) shows slides drawn by the author's own engine. The engine is not included.

## What it costs

The full chain is slow and uses many tokens, on purpose. The review costs the most because the reviewer re-reads everything with no shared context. [What it costs](docs/cost.md) says where the tokens go and what you can trim. I make no promise of savings. Run targeted checks while you work, and one complete check at check and one at wrap.

## Limits

- The agent still does the thinking and the storytelling. The process makes its work visible and checkable, and you remain the person who decides.
- The checks catch what they were built to catch. A deck can pass every one and still be dull or wrong in a way none of them anticipated, so read it before it leaves.
- The plan gate reads the text in a .pptx file. It does not read text inside images, charts drawn as pictures or speaker notes.
- Without an engine, the check is a written checklist that the agent answers, which is weaker than a program that counts.
- The targets are PowerPoint and Google Slides. For Slides, export a .pptx before the check.
- It is slow on purpose.

## Getting started

```
git clone https://github.com/briangrover9-hue/carousel-os.git
cd carousel-os
node scripts/install.js init path/to/your-project
```

That copies the process into your project and leaves any file you already have alone. Open the project in your agent and type `carousel-start`. `node scripts/install.js doctor path/to/your-project` lists anything missing, and `update` brings a newer copy of the process across without touching files you edited. A one-line install through a package registry is planned and does not exist yet.

## How an agent picks up the commands

`init` copies the nine commands into `.claude/commands/` in your project, where Claude Code looks for them, and keeps a plain copy in `commands/` for any other agent. Pass `--no-agents` to skip the first copy. `AGENTS.md` and `CLAUDE.md` both point the agent to `RULES.md`, which holds the rules and the order of the stages.

## If you edit anything

One rule has one owner: `RULES.md` owns rules, each command owns its procedure, each bookshelf page owns its reference. Change a rule in one place. Then run `node scripts/check-process.js` and `node tests/process/run.js`. The first checks the byte budgets, links, the wiki index, the report formats, the plan state machine, the deck file against the ledger, the prose and spelling rules, and your log, lessons and ledgers. The second proves each of those checks can fail.

## License

MIT. See the LICENSE file. Author: Brian Grover.

## Reference

**Commands**

- **[carousel-start](commands/carousel-start.md)**: read the handoff, pick the path, open a plan.
- **[carousel-brief](commands/carousel-brief.md)**: interview you and write the brief.
- **[carousel-storyboard](commands/carousel-storyboard.md)**: one headline, claim and source per slide, and the ledger.
- **[carousel-challenge-plan](commands/carousel-challenge-plan.md)**: one critique round from a new angle.
- **[carousel-build](commands/carousel-build.md)**: build the deck and check each ledger row.
- **[carousel-check](commands/carousel-check.md)**: read the deck, run your engine, paste exact results.
- **[carousel-review](commands/carousel-review.md)**: a fresh reviewer tries to disprove the deck.
- **[carousel-wrap](commands/carousel-wrap.md)**: one more check, lessons, wiki, log, rotation.
- **[carousel-handoff](commands/carousel-handoff.md)**: the next session's starting note.

**Bookshelf**

- **[ask-first](bookshelf/ask-first.md)**: the brief's questions in order, and the default for each gap.
- **[lessons](bookshelf/lessons.md)**: how corrections become lessons and rules, and who decides.
- **[claim-ledger](bookshelf/claim-ledger.md)**: the ledger's fields, the rule for `checked`, the final gate.
- **[review-angles](bookshelf/review-angles.md)**: the master list of critique angles for decks.
- **[engine-contract](bookshelf/engine-contract.md)**: the config file and exit codes for plugging in your own engine.
- **[rubric](bookshelf/rubric.md)**: review dimensions, floors, caps, and what P0 and P1 mean.
- **[preflight](bookshelf/preflight.md)**: the checklist by section and the anti-tells.
- **[design](bookshelf/design.md)**: the taste layer behind what gets drawn.
- **[writing](bookshelf/writing.md)**: the writing standard for slide text.
- **[narrative-devices](bookshelf/narrative-devices.md)**: named slide beats for the storyboard.

Also: [RULES.md](RULES.md), [cheatsheet.md](cheatsheet.md), [bookshelf index](bookshelf/README.md), [light path](docs/light-path.md), [cost](docs/cost.md).
