---
name: carousel-challenge-plan
description: "Attack the plan from a new angle, fix what survives, and report the change as a diff summary."
disable-model-invocation: true
---

# carousel-challenge-plan

Job: attack the plan from a new angle, fix what survives, and report the change as a diff summary. One run is one round.
Reads: the whole plan, the ledger, `bookshelf/review-angles.md`.
Writes: edits Brief and Storyboard in place, appends a `### Round R` section to Challenge log, updates ledger rows, adds a line to Reports. Sets `Status: challenged` after the last round.
Exit check: Challenge log holds this round's section with a diff summary and count line, and Reports holds the `Challenge round` line.

## Guards

Decline, name the cause, and stop when:
1. Reports has no `Storyboard report:` line, or the ledger file is missing. Say to run `carousel-storyboard`.
2. The previous round's section lacks a diff summary or count line. Finish that round first.
3. Reports already holds as many `Challenge round` lines as the Rounds line. Say to run `carousel-build`.

## Steps

1. Read Challenge log and list the angles used.
2. Choose this round's angle.
   - It is the last round and Rounds is 2 or more: `Parked claims`. Review every claim earlier rounds parked: resolve it to checked evidence, reword it to "worth testing", or cut it. Never delete a parked entry without one of the three.
   - Otherwise: one angle from `bookshelf/review-angles.md` not yet used.
3. Write `### Round R` and `Angle: <name> (new)` at the top of the section.
4. Work the angle across the whole plan. On a flaw, search every other slide for it before you write the fix.
5. Re-verify each claim you touch: open the source file or run the query, then count it.
   - You cannot re-verify it: set its ledger row `open` with the note "uncertain", soften the slide wording, and add it to the `Parked claims:` list in Challenge log.
6. Edit the plan and the ledger. Why: a round that edits only the log changed nothing.
7. Write the diff summary, each entry with where (slide id or section):
   - `Addressed:` what changed.
   - `Deferred:` followed by the marker `NEEDS HUMAN: <question>`, left open. You cannot answer it, and the human answers it outside this round.
   - `Kept as is:` what you left, and the check you ran on it (recomputed, opened, matches).
8. Write `Re-verified <N> claims, demoted <M> to uncertainty.` as the last line of the section.
9. Last round, whatever the total (a one-round plan included): end Challenge log with `Parked claims: none open`. Every slide id on an earlier `Parked claims:` line must appear in this round's `Addressed:` or `Kept as is:` lines.
10. Append the report line to Reports.

## Report line

End each round with exactly this line, then add the same line to Reports:

`Challenge round <R> of <T>: angle <name> (new). Re-verified <N> claims, demoted <M> to uncertainty.`

## No-rubber-stamp guard

A fake round renames an old angle and calls it new. It edits only the log. It files every finding under Kept as is with no check named, or defers all of them. It reports a count equal to the ledger size without opening a source. The last round empties the parked list by deleting entries.

## Rationale

A second reader with the same eyes finds the same things, so each round comes from a different angle and the used list stops repeats. Counting re-verified claims forces the work to touch sources. The parked list stops a doubtful number from riding to the build.
