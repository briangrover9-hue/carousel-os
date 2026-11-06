---
name: carousel-wrap
description: "Close the session with one complete check, the session's lessons, wiki updates, a log entry and log rotation."
disable-model-invocation: true
---

# carousel-wrap

Job: close the session with one complete check, the session's lessons, wiki updates, a log entry and log rotation.
Reads: the plan, this session's corrections, `memory/LOG.md`, `memory/wiki/lessons.md`, `bookshelf/lessons.md`.
Writes: `memory/LOG.md` (one entry), `memory/wiki/lessons.md` through `node scripts/lessons.js`, wiki pages and `memory/wiki/INDEX.md` when something durable was learned, `memory/history/` through `node scripts/rotate-log.js`, `Status: wrapped`, a line in Reports.
Exit check: the log holds today's `## YYYY-MM-DD <slug>` entry, `node scripts/check-process.js --skip handoff` exits 0, and Reports holds the `Wrap report:` line.

## Guards

Decline, name the cause, and stop unless one of these holds:
1. Reports' latest review line is `Review verdict: PASS`.
2. Reports holds a `Stopped at` line.
3. The human says the session ends now. Append `Stopped at <stage>: <reason>.` to Reports first, where the stage is the last one reported, and say that no verdict exists.

Otherwise say to run `carousel-review`.

## Steps

1. A deck exists: run the complete check again with the commands in `carousel-check` and compare the result lines with Check. Say what differs. No deck: the check result is `n/a`.
2. List every correction the human made this session, or write that there were none. For each, run `node scripts/lessons.js add "<one line>"`.
   - Output `Added`: done.
   - Output `POSSIBLE REPEAT of <id>` (exit 3): run it again with `--new`, and note `possible repeat of <id>` for step 4. Never run `repeat` or `promote` yourself. Why: only the human decides what counts as the same lesson or a rule, and every such action is logged with the human's words.
3. Run `node scripts/lessons.js promote` with no id and `node scripts/lessons.js expire`. Note any due promotion for step 4.
4. Add or edit a wiki page for each durable fact (a reader, a source, a window rule). Facts go in the wiki and events go in the log. List each new page in `memory/wiki/INDEX.md`.
5. Write the log entry at the top of `memory/LOG.md` under `## YYYY-MM-DD <slug>`: one plain paragraph of what happened, what was decided and what is open. Add `Friction:` only when something slowed the work. Add `Needs the human:` with the notes from steps 2 and 3, when there are any.
6. Run `node scripts/rotate-log.js`. It refuses a heading it cannot date: fix the heading and run it again.
7. Run `node scripts/check-process.js --skip handoff`. It must exit 0. Why: `carousel-handoff` runs the skipped check in full.
8. Set `Status: wrapped`. Append the report line to Reports.

## Report line

End with exactly this line, then add the same line to Reports:

`Wrap report: check <PASS|FAIL|n/a>; log entry written; lessons added <N>; wiki pages touched <N>; entries rotated <N>.`

Stop line, written under guard 3 or after a second REJECT:

`Stopped at <start|brief|storyboard|challenge-plan|build|check|review>: <reason>.`

## Real-change check

A fake wrap writes a log paragraph that says the session went well and names no decision. It reports `lessons added 0` after the human corrected something. It counts an edit to the index alone as a wiki page touched. It reports `check n/a` while a deck exists. It skips rotation because nothing seems old, or runs `repeat` or `promote` without the human.

## Rationale

Sessions end with the most knowledge in context and the least time to write it down, so the writing is a stage with a report line. The check at wrap catches a deck that changed after review. A correction logged the same day keeps its exact words.
