# carousel-check

Job: run the complete check on the built deck, reading the deck itself, and record exact results.
Reads: the plan's Build section, the deck, the ledger, `carousel.config.json` when it exists, `bookshelf/engine-contract.md`.
Writes: Check in the plan (pasted gate output, tool results, hashes), replacing any earlier run, and a line in Reports. Never edits the deck.
Exit check: Check holds the path, the plan and ledger gate output, one result line per registered tool, four hashes, and Reports holds the `Check report:` line.

## Guards

Decline, name the cause, and stop when:
1. Reports' latest `Build report:` line is missing, or the deck file named on Build's `Deck:` line does not exist. Say to run `carousel-build`.
2. The ledger file is missing or does not parse (`node scripts/check-process.js --ledger plans/<slug>.ledger.json` says so).

## Steps

1. Hash first: `node scripts/check-process.js --hashes plans/<slug>.md`. Record its three lines, with the deck line renamed `Deck sha256 before tools:`.
2. Choose the path from `carousel.config.json`.
   - The file has an `engine` key: engine path. Its keys: `engine.scan` and `engine.render` (both required) and `engine.tools` (optional, tool name to command). Each command is a shell template that holds `{deck}` and `{out}`. The sample is `carousel.config.example.json`, and `bookshelf/engine-contract.md` defines the contract.
   - No file, or no `engine` key: rubric path. Say so on the first line of Check.
3. Engine path: run `mkdir -p decks/<slug>.check`, then each tool in this order: `scan`, `render`, then the names under `engine.tools` alphabetically. Replace `{deck}` with the deck path and `{out}` with `decks/<slug>.check`.
   - Exit 0: PASS. Exit 1: FAIL. Exit 2 (the tool or its runtime is missing): MISSING, listed under Deferred with what it needs. Any other exit code: FAIL.
   - Paste the last non-empty line of the tool's output exactly, as `Tool <name>: <PASS|FAIL|MISSING>: <exact result line>`, one line per tool. A tool that prints nothing gets `(no output)`.
   - Every tool must write its report into `{out}`. No tool may edit the deck.
4. Rubric path: no mechanical scan exists, and Check says so. Read `bookshelf/rubric.md` and `bookshelf/preflight.md` sections A to D and F. Answer these ten items, each PASS or FAIL with a slide number and what you looked at: (1) literal ask on slide 1 or 2; (2) headlines-only read; (3) one window on every numbered slide; (4) a base beside every percentage; (5) a source line on every data slide; (6) quotes match the source byte for byte; (7) names spelled the same everywhere; (8) one type scale and one palette; (9) no clipped or overlapping text in a render; (10) slide count within budget.
   - You can export the deck to images or a PDF and look: answer item 9 from the render. The checklist has 10 items.
   - You cannot: drop item 9, write `checklist <N> of 9`, and list "item 9: no render" under Deferred.
5. Both paths, after the tools: run `node scripts/check-process.js --hashes plans/<slug>.md` again and record `Deck sha256:`, `Ledger sha256:` and `Build sha256:`.
   - `Deck sha256:` differs from the line before the tools: a tool edited the deck. Report `plan FAIL`, write the finding, and stop.
6. Both paths: run `node scripts/check-process.js --plan plans/<slug>.md`. It reads the slide text out of the deck file itself and compares every number with the ledger and the Build table. Paste its output, including `PASS plan` or `FAIL plan`.
7. Both paths: run `node scripts/check-process.js --ledger plans/<slug>.ledger.json --final` and paste its output, including `PASS ledger`.
8. A FAIL goes into Check with its slide, and `carousel-build` fixes it. Never loosen a threshold, skip a flag or change an input to turn a FAIL into a PASS.
9. A check you need does not exist: build it (a script, a query, a written test), register it under `engine.tools`, and run it. Never write "worth a manual check".
10. Everything passes and the checklist is complete: `Status: checked`. Otherwise leave `Status: built`. Append the report line to Reports.

## Report line

End with exactly these lines, then add the first to Reports:

`Check report: path <engine|rubric>; plan <PASS|FAIL>; ledger <PASS|FAIL>; tools <none or list>; checklist <N of M or n/a>; Deferred: <none or list>.`
`Deck sha256 before tools: <hex>`
`Deck sha256: <hex>`
`Ledger sha256: <hex>`
`Build sha256: <hex>`

The tools field is `none`, or a list such as `scan PASS, render PASS`. Engine path: checklist `n/a`. Rubric path: `<N> of 10`, or `<N> of 9` with item 9 under Deferred. `check-process` compares the tool lines in Check with `carousel.config.json`: every registered tool needs a result, and no result may exist for a tool that is not registered.

## No-rubber-stamp guard

A fake check reports PASS after a tool exited non-zero, or after editing the thresholds or inputs it measures. It records PASS for a tool that exited 2. It records a tool that is not in the config, or leaves out one that is. It writes `Deferred: none` after skipping a step. It pastes a summary where the last output line belongs. It reports `plan PASS` without having run the plan gate on the deck file.

## Rationale

Exact lines are the evidence that survives a second reader, because a summary can say clean about anything. Reading the slide text from the deck file means the check looks at what the audience sees. The check never edits the deck, and the hashes tie it to one version of the deck.
