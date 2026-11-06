---
name: carousel-critique
description: "Attack the plan from a new angle, fix what survives, and report the change as a change list."
disable-model-invocation: true
---

# carousel-critique

Job: attack the plan from a new angle, fix what survives, and report the change as a change list. One run is one round.
Reads: the whole plan, the ledger, `bookshelf/review-angles.md`.
Writes: edits Brief and Storyboard in place, appends a `### Round R` section to Critique log, updates ledger rows, adds a line to Reports. Sets `Status: critiqued` after the last round.
Exit check: Critique log holds this round's section with a change list and count line, and Reports holds the `Critique round` line.

## Guards

Decline, name the cause, and stop when:
1. Reports has no `Storyboard report:` line, or the ledger file is missing. Say to run `carousel-storyboard`.
2. The previous round's section lacks a change list or count line. Finish that round first.
3. Reports already holds as many `Critique round` lines as the Rounds line. Say to run `carousel-build`.

## Steps

1. Read Critique log and write down which angles earlier rounds took.
2. Choose this round's angle.
   - It is the last round and Rounds is 2 or more: `Open rows`. Review every row earlier rounds left open: resolve it to checked evidence, reword it to "worth testing", or cut it. Never drop an open row without one of the three.
   - Otherwise: one angle from `bookshelf/review-angles.md` not yet used.
3. Write `### Round R` and `Angle: <name> (new)` at the top of the section.
4. Work the angle across the whole plan. On a flaw, search every other slide for it before you write the fix.
5. For each claim you touch, reopen its source: open the file or run the query, then count it.
   - The source does not confirm it: set its ledger row `open` with the note "unconfirmed", soften the slide wording, and leave it open on this round's `Open rows:` line.
6. Edit the plan and the ledger. Why: a round that edits only the log changed nothing.
7. Write the change list, each entry with where (slide id or section):
   - `Fixed:` what changed.
   - `Waiting on you:` a question you cannot answer, written as the marker `ASK: <question>` and left open for the human to answer outside this round.
   - `Verified unchanged:` what you left, and the check you ran on it (recomputed, opened, matches).
8. Write `Open rows: <slide ids, each with why>` listing every ledger row still open with the note "unconfirmed" after this round, earlier rounds' included, or `Open rows: none open`. Each id must be a ledger row.
9. Write the count line `Fixed <F>; waiting <W>; verified <V>; ledger rows open <O>.` as the last line of the section:
   - F is the number of `Fixed:` lines in this round's change list, W the number of `Waiting on you:` lines, V the number of `Verified unchanged:` lines.
   - O is the number of slide ids on this round's `Open rows:` line, 0 for `none open`. It equals the ledger rows set `open` with the note "unconfirmed" when the round ends.
   - F plus V is at least 1. Why: a round that only asks questions touched no source.
10. Last round, whatever the total (a one-round plan included): its `Open rows:` line reads `Open rows: none open`, so O is 0. Every slide id on an earlier `Open rows:` line must appear in this round's `Fixed:` or `Verified unchanged:` lines.
11. The Rounds line is above the path's default (3 on full, 1 on short): Critique log needs a `Finding ledger:` line above `### Round 1`, with one bullet per finding from every round so far: `- R<n> <slide id>: <finding>; <Fixed, Waiting on you or Verified unchanged>`. Start it in round 1 and add each round's findings to it. `node scripts/check-process.js` fails such a plan without it. Why: extra rounds pay off only when you can see what each one found.
12. Append the report line to Reports.

## Report line

End each round with exactly this line, then add the same line to Reports:

`Critique round <R> of <T>: angle <name> (new). Fixed <F>; waiting <W>; verified <V>; ledger rows open <O>.`

## Real-change check

A fake round reruns an angle from the used list under a new name. It edits only the log. It files every finding under "Verified unchanged" with no check named, or files all of them under Waiting on you. Its counts disagree with its change list, or it leaves a row open in the ledger without naming it. The last round empties the open rows by deleting them.

## Why it works this way

A second reader with the same eyes finds the same things, so each round comes from a different angle and the used list stops repeats. Counts taken from the change list and the ledger show what the round did, and `check-process` recounts both. The open rows stop a doubtful number from riding to the build.
