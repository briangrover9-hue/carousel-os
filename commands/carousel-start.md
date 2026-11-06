# carousel-start

Job: open a session from files, choose the path, and record the direction in a new plan.
Reads: `memory/handoff.md`, the three newest entries of `memory/LOG.md`, `memory/wiki/INDEX.md`, the rules and lessons in `memory/wiki/lessons.md`.
Writes: `plans/<slug>.md` only (a copy of `plans/plan.template.md` with Direction filled and one line in Reports).
Exit check: `plans/<slug>.md` exists, its Direction is filled, and Reports holds the `Start report:` line.

## Guards

Start has no earlier stage, so it has no earlier report line to key on. Decline, name the cause, and stop when:
1. `RULES.md` or `memory/wiki/INDEX.md` is missing. Say the folder is not set up and name `node scripts/install.js`.
2. A plan with this slug exists. Read its Status line, say it, and name the next command. Start never resumes a plan.
3. The human gave no deck request and the handoff has no `Recommended focus`. Ask for the request in one sentence.

## Steps

1. Read `memory/handoff.md`.
   - It holds only the empty sentence: handoff is `none`.
   - Otherwise note its `Recommended focus`: handoff is `read`.
2. Choose the direction.
   - The human gave a request: use their words.
   - No request, a focus in the handoff: use the focus and write "taken from handoff".
3. Read the three newest log entries and the rules and lessons. Count the rules plus lessons: that is `lessons loaded`.
4. Run `node scripts/check-process.js`.
   - It fails: print the failing lines and stop.
5. Choose the path.
   - The human said light: `light`, Rounds 1.
   - Anything else: `full`, Rounds 3.
6. Pick a slug of lowercase words and hyphens. Copy `plans/plan.template.md` to `plans/<slug>.md`.
7. Fill Direction with the request, the reader and venue if stated, the path and why, and the files the human named. Write the Path and Rounds lines as plain values (`Path: full`, `Rounds: 3`).
8. Keep `Status: started`. Append the report line to Reports. Name the next command, `carousel-brief`.

## Report line

End with exactly this line, then add the same line to Reports:

`Start report: plan <path> created; path <full|light>; handoff <read|none>; lessons loaded <N>.`

## No-rubber-stamp guard

A fake start invents a direction the human never gave, such as a reader or a deadline. It reports `handoff read` without quoting the handoff's focus. It reports `lessons loaded 0` while the lessons file holds rules. It skips the process check because the last session was clean.

## Rationale

The handoff and the plan are the only things that cross sessions, so a session starts from files and never from what a chat remembers. The path is fixed once, here, so no later stage argues about round counts.
