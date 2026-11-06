# Carousel OS rules

This is the one rules file. `AGENTS.md` and `CLAUDE.md` point here. Read it at the start of every session, then read only the stage file for the stage the human started.

## The chain

The human types every command. No stage starts the next one. Each stage runs only when the previous stage's report line is in the plan's `## Reports`.

| Command | Runs after the report line | Writes |
|---|---|---|
| `carousel-start` | none | `plans/<slug>.md` (Direction) |
| `carousel-brief` | `Start report:` | Brief |
| `carousel-storyboard` | `Brief report:` | Storyboard, `plans/<slug>.ledger.json` |
| `carousel-challenge-plan` | `Storyboard report:` | Challenge log, edits to the plan |
| `carousel-build` | the last `Challenge round` | the deck, Build |
| `carousel-check` | the latest `Build report:` | Check |
| `carousel-review` | a clean latest `Check report:` | Review |
| `carousel-wrap` | a latest `Review verdict: PASS`, or a `Stopped at` line | `memory/LOG.md`, wiki, lessons |
| `carousel-handoff` | `Wrap report:` | `memory/handoff.md` |

The short run keeps all nine stages and runs one challenge round (`docs/short-run.md`). An engine is optional and yours to build or plug in (`bookshelf/engine-contract.md`).

## The bar

A deck is done when all five hold.

1. The literal ask is answered on slide 1 or 2, in our words.
2. Read by headlines alone, the deck is an argument with a beginning, a turn and an answer.
3. One evidence window and one source family cover every number.
4. Every number printed on a slide is in the ledger, its row is `checked`, and the deck file itself shows the same numbers.
5. `carousel-check` is clean and a fresh-context reviewer returned PASS.

## Standing rules

1. **Predecessors.** If the previous stage's report line is missing, decline, name it, and stop. Why: a stage built on a missing artifact guesses.
2. **Questions.** Only `carousel-brief` asks the human anything. Any later gap: take the conservative option (the smaller claim, fewer slides, a plain theme) and log `D<n>: stage, choice, reason` under `## Deviations`.
3. **Report lines.** End every stage with its exact report line from its stage file, and append it to `## Reports`. The format is fixed. Why: the human scans for it and a script parses it.
4. **Real-change check.** Before you report a stage as passed, read the Real-change check in its stage file and hold your work up against it.
5. **Ledger.** One row per slide (`bookshelf/claim-ledger.md`). Set `checked` only after the row's named check passes. Print no number, in digits or words, that is not in the ledger. `check-process --plan` reads the slide text out of the .pptx and compares it.
6. **Critique.** Each challenge round takes an angle not used before (`bookshelf/review-angles.md`), edits the plan, and reports Addressed, Deferred and Kept as is, each with where.
7. **Checks.** Never change a check to fit the deck. When a check is missing, build it. Report anything that did not run under `Deferred`. Run targeted checks while building, one complete check at `carousel-check` and one at `carousel-wrap`. A tool that exits 2 is MISSING, never PASS.
8. **Review.** A fresh-context reviewer gets the bar and the file list only, tries to disprove, and returns PASS, REJECT or UNVERIFIABLE with pasted evidence. UNVERIFIABLE is never rounded up to PASS. It runs only after state is saved. A second REJECT stops the plan at review.
9. **Lessons.** Log each human correction with `node scripts/lessons.js add`. Only the human confirms a repeat, promotes a rule or keeps one, and passes their own words with `--human-confirmed`, which `lessons.js` appends to `memory/wiki/lessons.history`. The flag is self-attested: no script can tell a human from an agent typing it. Lessons expire after 90 days unless reconfirmed. The cap is 12 rules.
10. **Memory.** `memory/LOG.md` is what happened: newest first, one plain paragraph per session. `memory/wiki/` is what we know, and `memory/wiki/INDEX.md` lists every page. Entries older than the current ISO week rotate into `memory/history/`.
11. **Sources.** Numbers come from the sources named in the brief, and any number from elsewhere carries the label external. Quote exactly, with attribution. Write "worth testing" unless the evidence shows cause.
12. **Writing.** Plain American English, active voice, short words. No em dashes, en dashes or spaced hyphens as punctuation. No negation-reframes, runs of short fragments, rule-of-three rhythm or closing pronouncements. The banned words are in `scripts/check-process.config.json`.
13. **Context budget.** This file and each stage file stay under the byte caps in `scripts/check-process.js`. Load a stage file only when its stage runs, and a wiki page only through the index.
14. **Hands off.** Never commit, push, send or publish a deck. The human does.
15. **Engine.** Register your own in `carousel.config.json`. `bookshelf/engine-contract.md` is the one authority for its keys and exit codes. `carousel-check` runs it through `node scripts/run-tools.js`. With no engine it takes the rubric path and says so. Both paths read the deck file.

## Where things live

```
RULES.md  README.md  cheatsheet.md
.agents/skills/  one SKILL.md per stage, the single source; copied to .claude/skills/
agents/          the two reviewer agents that carousel-review starts
plans/           one plan and one ledger per deck, templates, a worked example
memory/          LOG.md, handoff.md, wiki/, history/
bookshelf/       reference pages the stages read
docs/            how it thinks, short run, cost
scripts/         helper scripts, each with a usage comment and --help
```

## Enforcement

`node scripts/check-process.js` is the mechanical check, and `node tests/process/run.js` proves each part can fail. The script covers:
- Rules 1 and 3: report lines match their formats, appear in stage order, and agree with the Status line.
- Rule 5: ledger shape, check text, dates, and the numbers and number words in the deck file, including native chart values, against the ledger, the storyboard and the Build table.
- Rule 6: unique angles from the angle list, the last round on Parked claims, a count line per round, parked slides resolved.
- Rule 7: the Check section against `carousel.config.json` and the `tools.json` that `run-tools.js` wrote.
- Rule 8: the deck, ledger and Build hashes, the deck unchanged from Build to Check, pasted evidence in a PASS, and the REJECT cap.
- Rule 9: lesson format, expiry, review and cap, and a replay of `lessons.history` against the lessons file.
- Rules 10, 12 and 13: log and handoff shape, the wiki index, the prose and spelling gates, the byte caps. Rule 4: that each stage file has a Real-change check that describes a fake pass.

The script cannot see the following, so a person or the reviewer is the backstop:
- Rule 2: whether a choice was truly conservative. The human reads Deviations.
- Rule 7: whether a check was weakened, and whether an engine checks what matters. Tool exit codes are verified only through `run-tools.js` results, so an agent that writes `tools.json` and Check by hand can defeat it.
- Rule 8: whether the reviewer really started fresh, and whether a human typed the words in `lessons.history`. Evidence lines are typed text.
- Rule 5: text inside images, charts drawn as pictures, speaker notes, whether a named source holds the figure, and quantities written in words outside the phrases the check reads.
- Rule 11 (causal wording), the quality of prose, and rule 14.

## If you edit anything

One rule has one owner: this file owns rules, a stage file owns its procedure, a bookshelf page owns reference detail. Change a rule here and delete it elsewhere. Cite a heading as the file name, a comma, and the heading in quotation marks, such as `RULES.md, "The bar"`. Run both scripts before you finish.
