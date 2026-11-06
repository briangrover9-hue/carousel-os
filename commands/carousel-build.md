# carousel-build

Job: build the deck from the challenged plan, one slide at a time, checking each ledger row as its slide is finished.
Reads: the plan, the ledger, `bookshelf/design.md`, `bookshelf/writing.md`, `bookshelf/claim-ledger.md`, and `engine/style.md` when the engine exists.
Writes: the deck file, Build in the plan (deck path and slide text), ledger statuses, new `D<n>:` lines under Deviations, `Status: built`, a line in Reports.
Exit check: every ledger row is `checked` or `rejected` with a note, Build names the deck and holds the slide text table, and Reports holds the `Build report:` line.

## Guards

Decline, name the cause, and stop when:
1. Reports holds fewer `Challenge round` lines than the Rounds line, or Challenge log does not end with `Parked claims: none open`. Say to run `carousel-challenge-plan`.
2. The ledger file is missing. Say to run `carousel-storyboard`.
3. Brief's `Literal ask:`, `Reader and venue:` or `Evidence:` holds a `NEEDS HUMAN:` marker.

A `NEEDS HUMAN:` marker on one slide does not stop the build. Build that slide conservatively and log it.

## Steps

1. Read `carousel.config.json` if it exists. Note which engine commands are registered, so you draw with the kit they check.
2. Decide the mode.
   - The Check section lists FAIL findings, or the last review verdict is REJECT: fix pass. Work only those findings, slide by slide, and say so in Build.
   - Otherwise: a full build.
3. For each slide in storyboard order:
   1. Draw it. Print only the storyboard's text, and only numbers that sit in its ledger row. Draw with your own engine when you have one, and with the platform's own tools when you do not.
   2. Check it. For each number, open its source and recompute it. Write in the row's `check` field one sentence that names the action, the source and the value found. Why: a row that says "verified" cannot be audited.
   3. Every number matches its printed value: set `reconciled: true` on it, then set the row `checked` with today's date in `checked_on` (the date must fall after the window ends). Never set `checked` before its recompute is done. Any mismatch: set the row `rejected` with a note, then fix or cut the slide.
   4. A figure in words ("six in ten", "three times") goes in the row too, as `words` on the number it describes. The words must agree with the number.
   5. The slide has a `NEEDS HUMAN:` marker: drop the claim or the number, keep the framing, and log a `D<n>:` line.
4. For every other open decision, take the conservative option (the smaller claim, fewer slides, the default theme) and log `D<n>: build, <choice>, <reason>` under Deviations.
5. Fill Build. Line one is `Deck: <path to a .pptx file>`. Why: `carousel-check` reads the slide text out of that file. For a Google Slides deck, export a .pptx and record that path, and put the link in a Notes line. Then add the table `| Slide | Text on the slide |` with one row per slide holding every printed word and number. Why: the check and the review compare it with the ledger.
6. Add speaker notes when Brief says the deck is presented.
7. Set `Status: built`. Append the report line to Reports. M equals the number of `checked` rows in the ledger. K equals the number of `D<n>:` lines in Deviations.

## Report line

End with exactly this line, then add the same line to Reports:

`Build report: <N> slides built, <M> ledger rows checked, <K> deviations logged.`

## No-rubber-stamp guard

A fake build marks rows checked from memory of the number, or because the slide looks right. It leaves `check` empty or writes "verified". It reports `deviations logged 0` while markers exist. It adds slides the storyboard did not list. It edits a scan input or threshold so a check passes.

## Rationale

Checking each row right after its slide keeps the source in view, so an error costs one slide and not a review round. Conservative choices keep the build moving without the human, and the Deviations list gives the human a short list to overturn.
