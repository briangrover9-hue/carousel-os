# Cheatsheet

Type each command yourself. The last line a stage prints is the one to look for, and it is also the last line the stage adds to Reports in the plan.

| Command | Look for | Writes |
|---|---|---|
| `carousel-start` | `Start report: plan <path> created; ...` | `plans/<slug>.md` |
| `carousel-brief` | `Brief report: <N> questions asked, ...` | Brief |
| `carousel-storyboard` | `Storyboard report: <N> slides, headlines-only read holds, ...` | Storyboard, `plans/<slug>.ledger.json` |
| `carousel-critique` | `Critique round <R> of <T>: angle <name> (new). ...` | Critique log, plan edits |
| `carousel-build` | `Build report: <N> slides built, ...` | the deck, ledger statuses, Build |
| `carousel-check` | `Check report: path <engine or rubric>; plan <result>; ...` and four hash lines | Check |
| `carousel-review` | `Review verdict: PASS, REJECT or UNVERIFIABLE; ...` | Review |
| `carousel-wrap` | `Wrap report: check <result>; log entry written; ...` | `memory/LOG.md`, wiki, lessons |
| `carousel-handoff` | `Handoff report: memory/handoff.md written; ...` | `memory/handoff.md` |

## Paths

Full: three critique rounds, the last on Open rows. Short run (`Path: short`): one round, same stages otherwise. Set it at start.

Engine: optional. Register your own in `carousel.config.json` (sample: `carousel.config.example.json`). Without one, `carousel-check` takes the rubric path.

## When something goes wrong

- A stage declines: it names the missing report line. Run the earlier stage.
- Check shows a FAIL, a MISSING tool or a short checklist: run `carousel-build` on the findings, then `carousel-check`.
- Review says REJECT: build, check, review again. A second REJECT stops at review (a `Stopped at review` line) and goes to wrap.
- Review says UNVERIFIABLE: supply what it names. It is never a pass.
- Ending early: tell `carousel-wrap` the session ends now. It writes a `Stopped at` line.
- A marker reads `ASK: <question>`: answer it, then change the line to `RESOLVED: <question> -> <answer>`.
- A lesson reads `POSSIBLE REPEAT` or `PROMOTE DUE`: only you decide. Run `node scripts/lessons.js repeat <id> --human-confirmed "<your words>"` or `promote <id> --human-confirmed "<your words>"`. Your words go in `memory/wiki/lessons.history`.

## Scripts

Each script prints usage with `--help`.
- `node scripts/check-process.js`: every process check. Exit 0 means clean.
- `node scripts/check-process.js --plan plans/<slug>.md`: read the deck file and compare it with the ledger.
- `node scripts/check-process.js --hashes plans/<slug>.md`: print the deck, ledger and Build hashes for the plan.
- `node scripts/run-tools.js plans/<slug>.md`: run the engine tools registered in `carousel.config.json` and print their Tool lines.
- `node scripts/check-process.js --ledger plans/<slug>.ledger.json --final`: the ledger gate.
- `node scripts/lessons.js list`: rules and lessons with time left.
- `node scripts/rotate-log.js`: move old log entries to `memory/history/`.
- `node tests/process/run.js`: prove the checks can fail.

## Files

`plans/<slug>.md` holds the state. `plans/<slug>.ledger.json` holds the claims. `memory/LOG.md` records each session by date. `memory/wiki/` holds facts that stay true across decks. `memory/handoff.md` is where the next session starts.
