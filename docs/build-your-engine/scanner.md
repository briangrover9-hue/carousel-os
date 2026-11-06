# The scanner

The scanner opens a finished deck file and measures it. It checks the exact file that will ship, whoever built it and whatever kit drew it, which makes it the one tool that can catch a defect introduced after the kit was done: a hand edit, an import into another app, a find-and-replace.

Write each check so it reads the file's XML or its parsed shapes, never a description of the deck. Write the report to a folder, and end with one summary line.

## Result levels

Every check reports one of four levels per slide, and the scanner maps them to its exit code as follows. [bookshelf/engine-contract.md](../../bookshelf/engine-contract.md) holds the exit codes themselves.

| Level | Meaning | Effect on the exit code |
|---|---|---|
| PASS | Measured, and within the rule. | None. |
| FAIL | Measured, and outside the rule. A FAIL blocks the check stage, and nobody loosens a threshold or changes an input to turn it into a PASS. | Exit 1. |
| CANDIDATE | The script found something a person must judge, such as a grid that might be a wall of numbers. It never blocks on its own, and every one gets a written ruling before the deck ships. | Exit 0, with the CANDIDATE count in the last line. |
| NOT SCANNED | The check could not run on this file, for example a chart check on a deck with no charts. | Exit 0, with the NOT SCANNED count in the last line, so silence never reads as a pass. |

The scanner exits 2 only when the scanner itself cannot run: a missing runtime, an unreadable file, a crash. The last line of output always reads like `scan: 0 FAIL, 3 CANDIDATE, 1 NOT SCANNED, 41 PASS`.

## The families of checks

### Headlines
- Rendered line count, measured with the real font at the drawn size. FAIL past the cap.
- More than one text color in a headline or title. FAIL.
- A small caps or tracked label sitting above a headline. FAIL.
- The headlines read in order, written to the report, so a reviewer can test whether they form an argument.

Why: you trust a rule because the checklist lists it, and a rule the scanner never emits is covered in name only.

### Density and number counts
- Words per slide, words per sentence.
- Numbers per slide, and how many of them carry emphasis. More than 20 undifferentiated numbers on one slide: CANDIDATE.
- Numbers per deck, so a reviewer can see where the weight sits.

Why: a density rule that counts only prose sends builders into tables of sixty equal figures, and nobody can find the claim.

### A number beside a number
- An ordinal ("1.", "01") next to a stat, or a numbered list whose items lead with a figure. FAIL.

Why: "59" beside "1." reads as one figure, and the reader quotes the wrong number.

### Unsourced numbers and ledger reconciliation
- A percentage with no base beside it.
- A data slide without the source line, or with a source line that differs from the deck's canonical one.
- Every number on a slide matched against the claim ledger. A number with no ledger row is a FAIL.
- The same entity and metric with different values or rounding on two slides.
- Quotes compared byte for byte against the ledger's quote table.

Why: one number that fails to match its source costs more trust than a dozen missing footnotes.

### Contrast on every stop
- Every text color against the fill directly under it: the shape it sits in, or the ground. For a gradient ground, every stop.
- Labels inside native chart objects against their series fill.
- Thin marks (lines, markers) against the 3:1 graphics floor.

Why: a label that is hard to read on its own background is the defect a reader notices first, and a scanner that checks only the slide ground misses it. Composite transparency before you measure.

### Request text echoed into the deliverable
- Any run of eight or more consecutive words from the client's request, found anywhere in the deck: slides, appendix and speaker notes. FAIL, with an exemption for runs made only of category, market and metric names.

Why: a deck that pastes the question back to the person who asked it reads as if nobody thought about it.

### Private names leaking
- Scan all text, notes included, for names on a deny list. FAIL on any hit.
- Read the deny list from a private file named by an environment variable. When it is unset, run against an invented list so the check still exercises its code.

Why: the scanner cannot catch a name it does not know, and the list of names you must never ship is itself something you must never ship.

### Banned visual tells
- Bands or rails across a slide, colored edge stripes on cards, eyebrows.
- A gradient other than the ground.
- Repeated decoration: the same ornament in the same place on every slide, carrying nothing.
- Emoji, loop arrows, a second typeface beyond the budget.

### Type sizes off budget
- Every size in the file counted against the declared scale. FAIL on any size off it.
- Every fill and text color counted against the palette, printed as a census.

Why: a color can drift to a default without any warning, and only counting what reached the file shows it.

### Empty space and fill
- Content whose lowest edge sits more than 15 percent of the slide height above the content region's bottom: CANDIDATE. Measure the lowest shape bottom against the region's bottom.
- Two containers sharing a top whose bottoms differ by more than 0.02 inch (about 1.5 points): FAIL.
- Text out of bounds or overlapping other text: FAIL.

### Chart label legibility
- Value labels present on every mark of every series, including the emphasized one. The test counts the labels and compares the count with the marks.
- Label size on the scale, label contrast on its fill, labels not colliding.

### Structure
- Every content slide has a scope line, a page number and, when presented, speaker notes.
- A per-slide hash manifest, written for verdict reuse.

## Every check is tested against its incident

A check you have never seen fail certifies nothing. For each one:

- [ ] Keep the input that caused the incident (or a minimal reconstruction) as a fixture.
- [ ] Assert the check FAILs on it, naming the slide.
- [ ] Assert it PASSes on the corrected version.
- [ ] Revert the check and confirm the fixture goes red.

Run each new check on the deck that prompted it. A scan can pass the file it was written for when it measures shapes and the defect lives somewhere else, such as a native chart.

## Minimum version

- [ ] PASS, FAIL, CANDIDATE and NOT SCANNED levels. Exit 0 when there is no FAIL, 1 on any FAIL and 2 when the scanner cannot run, with the CANDIDATE and NOT SCANNED counts in the one summary line.
- [ ] Headline line count and color count.
- [ ] Type sizes and colors counted against the tokens.
- [ ] Text contrast against the fill under it.
- [ ] A base beside every percentage, and the source line on every data slide.
- [ ] A deny-list name scan read from a private file.
- [ ] One fixture per check, made from a real failure.
