# carousel-check

Job: run the complete check on the built deck, reading the deck itself, and record exact results.
Reads: the plan's Build section, the deck, the ledger, `carousel.config.json` when it exists, `bookshelf/engine-contract.md`.
Writes: Check in the plan (pasted gate output, tool results, hashes) and a line in Reports. Engine output goes to `decks/<slug>.check/`, with a `tools.json` results file. A second check needs a new Build first. Never edits the deck.
Exit check: Check holds the path, the plan and ledger gate output, one result line per registered tool (matching `tools.json`), four hash lines, and Reports holds the `Check report:` line.

## Guards

Decline, name the cause, and stop when:
1. The latest `Build report:` line is missing, or lines after it (a Check, a Review or a `Stopped at`) show this build was already checked. A re-check needs a new `carousel-build` first. Say to run it.
2. The deck file named on Build's `Deck:` line does not exist, or the ledger file is missing or does not parse (`node scripts/check-process.js --ledger plans/<slug>.ledger.json` says so).
3. The deck hash differs from Build's `Deck sha256 at build:` line. A changed deck needs a new Build.

## Steps

1. Hash first: `node scripts/check-process.js --hashes plans/<slug>.md`. Record its three lines, with the deck line renamed `Deck sha256 before tools:`.
2. Choose the path from `carousel.config.json`.
   - The file has an `engine` key: engine path. `bookshelf/engine-contract.md` defines the keys, and `carousel.config.example.json` is a sample.
   - No file, or no `engine` key: rubric path. Say so on the first line of Check.
3. Engine path: run `node scripts/run-tools.js plans/<slug>.md`. It runs each registered tool with `{deck}` and `{out}` set, maps each exit code itself, and writes `decks/<slug>.check/tools.json`.
   - Exit 0 is PASS, 1 is FAIL, 2 (the tool or its runtime is missing) is MISSING and goes under Deferred with what it needs, and any other code is FAIL. Never record exit 2 as PASS.
   - Paste its `Tool <name>: <PASS|FAIL|MISSING>: <exact result line>` lines into Check unchanged. A line you type yourself will not match `tools.json`.
   - No tool may edit the deck. `run-tools.js` hashes the deck before and after, and a difference is a finding.
4. Rubric path: no mechanical scan exists, and Check says so. Read `bookshelf/rubric.md` and `bookshelf/preflight.md`, and answer only the preflight items tagged (read) or (render). Then answer these ten items, each PASS or FAIL with a slide number and what you looked at: (1) literal ask on slide 1 or 2; (2) headlines-only read; (3) one window on every numbered slide; (4) a base beside every percentage; (5) a source line on every data slide; (6) quotes match the source byte for byte; (7) names spelled the same everywhere; (8) one type scale and one palette; (9) no clipped or overlapping text in a render; (10) slide count within budget.
   - You can export the deck to images or a PDF and look: answer item 9 from the render. The checklist has 10 items.
   - You cannot: drop item 9, write `checklist <N> of 9`, and list "item 9: no render" under Deferred.
5. Both paths, after the tools: run `node scripts/check-process.js --hashes plans/<slug>.md` again and record `Deck sha256:`, `Ledger sha256:` and `Build sha256:`.
   - `Deck sha256:` differs from the line before the tools: a tool edited the deck. Report `plan FAIL`, write the finding, and stop.
6. Both paths: run `node scripts/check-process.js --plan plans/<slug>.md`. It reads the slide text, and the values inside native charts, out of the deck file itself and compares every number with the ledger and the Build table. Paste its output, including `PASS plan` or `FAIL plan`.
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

The tools field is `none`, or a list such as `scan PASS, render PASS`. Engine path: checklist `n/a`. Rubric path: `<N> of 10`, or `<N> of 9` with item 9 under Deferred. `check-process` compares the tool lines in Check with `carousel.config.json` and with `tools.json`: every registered tool needs a result, and no result may exist for a tool that is not registered or that `run-tools.js` did not record.

## No-rubber-stamp guard

A fake check reports PASS after a tool exited non-zero, or after editing the thresholds or inputs it measures. It records PASS for a tool that exited 2, or types a Tool line instead of pasting the one `run-tools.js` printed. It records a tool that is not in the config, or leaves out one that is. It writes `Deferred: none` after skipping a step. It pastes a summary where the last output line belongs. It reports `plan PASS` without having run the plan gate on the deck file.

## Rationale

Exact lines are the evidence that survives a second reader, because a summary can say clean about anything. Reading the slide text from the deck file means the check looks at what the audience sees. The check never edits the deck, and the hashes tie it to one version of the deck.
