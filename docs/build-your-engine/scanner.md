# The scanner

The scanner opens a finished deck file and measures it. It checks the exact file that will ship, whoever built it and whatever kit drew it, which makes it the one tool that can catch a defect introduced after the kit was done: a hand edit, an import into another app, a find-and-replace.

Write each check so it reads the file's XML or its parsed shapes, never a description of the deck. Write the report to a folder, and end with one summary line.

## Result levels

Every check reports one of three levels per slide.

- **PASS:** measured, and within the rule.
- **FAIL:** measured, and outside the rule. A FAIL blocks the check stage. Nobody loosens a threshold or changes an input to turn it into a PASS.
- **CANDIDATE:** the script found something that needs a human or reviewer to judge, such as a grid that might be a wall of numbers or empty space that might be intended. A CANDIDATE never blocks on its own, and every one gets a written ruling before the deck ships.

Add a fourth, NOT SCANNED, for a check that could not run on this file. Silence must never read as a pass.

## The families of checks

### Headlines
- Rendered line count, measured with the real font at the drawn size. FAIL past the cap.
- More than one text color in a headline or title. FAIL.
- A small caps or tracked label sitting above a headline. FAIL.
- The headlines read in order, written to the report, so a reviewer can test whether they form an argument.

Why: a checklist once told the reviewer to read a rendered line count from a script that emitted none. The rule was listed as covered and enforced by nothing.

### Density and number counts
- Words per slide, words per sentence.
- Numbers per slide, and how many of them carry emphasis. Past about twenty undifferentiated numbers, CANDIDATE.
- Numbers per deck, so a reviewer can see where the weight sits.

Why: a density rule that counted only prose pushed builders into tables of sixty equal figures.

### A number beside a number
- An ordinal ("1.", "01") next to a stat, or a numbered list whose items lead with a figure. FAIL.

Why: "59" beside "1." reads as one figure. A key-insights slide built as six numbered rows carried thirty figures with an index beside each.

### Unsourced numbers and ledger reconciliation
- A percentage with no base beside it.
- A data slide without the source line, or with a source line that differs from the deck's canonical one.
- Every number on a slide matched against the claim ledger. A number with no ledger row is a FAIL.
- The same entity and metric with different values or rounding on two slides.
- Quotes compared byte for byte against the ledger's quote table.

Why: one wrong reconciliation costs more trust than any number of missing ones.

### Contrast on every stop
- Every text color against the fill directly under it: the shape it sits in, or the ground. For a gradient ground, every stop.
- Labels inside native chart objects against their series fill.
- Thin marks (lines, markers) against the 3:1 graphics floor.

Why: an early scanner skipped text sitting over a box, so a heatmap shipped an ink label at 4.44:1 on its darkest cell. It also ignored transparency, so it invented a second accent color on a correct deck. Composite alpha before you measure.

### Request text echoed into the deliverable
- Any run of eight or more consecutive words from the client's request, found anywhere in the deck: slides, appendix and speaker notes. FAIL, with an exemption for runs made only of category, market and metric names.

Why: a client's email was quoted verbatim into a "question as asked" panel. A deck that pastes the question back reads as if nobody thought about it.

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

Why: a census of a built file once found ten bars that had silently reverted to a default tint. Nothing raised, nothing warned, and only counting found it.

### Empty space and fill
- Content that stops well short of the floor: CANDIDATE.
- Two containers sharing a top whose bottoms differ by more than a hair: FAIL.
- Text out of bounds or overlapping other text: FAIL.

### Chart label legibility
- Value labels present on every mark of every series, including the emphasized one. A bolding step once switched values off on the claim series while its test checked only that the label block existed.
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

One of my scans missed the exact incident it was written for, because it measured shapes and the defect lived in a native chart. Only running it on that deck would have shown it.

## Minimum version

- [ ] PASS, FAIL and CANDIDATE levels, exit codes 0, 1 and 2, one summary line.
- [ ] Headline line count and color count.
- [ ] Type sizes and colors counted against the tokens.
- [ ] Text contrast against the fill under it.
- [ ] A base beside every percentage, and the source line on every data slide.
- [ ] A deny-list name scan read from a private file.
- [ ] One fixture per check, made from a real failure.
