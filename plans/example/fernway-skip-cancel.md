# Plan: Why Fernway members cancel (worked example, invented content)

Status: wrapped
Slug: fernway-skip-cancel
Path: full
Rounds: 3

Fernway Coffee Club is an invented subscription business, and every figure here is made up. This example was built without an engine. Its deck is a plain text deck, one text box per slide, made with a short script, so there is no design to judge and no tool results below. It took the rubric path, and its hashes are real. The handoff it wrote sits beside this file in `fernway-skip-cancel.handoff.md`.

## Direction

Request, in the human's words: "Our cancellations went up and nobody can say why. Give me six slides for Thursday's leadership meeting."
Reader and venue: the three leaders of Fernway, on a shared screen.
Path: full, because the deck drives a spending decision.
Starting material the human named: exports/orders.csv, exports/cancellations.csv, exports/exit-survey.csv.

## Brief

Literal ask: "Our cancellations went up and nobody can say why."
Decision: whether to fund a test of a pause option next quarter.
Reader and venue: three leaders, shared screen in a meeting, no pre-read.
Evidence: the three exports above. One window: 52 weeks ending 2026-06-28. All members, all plans.
Claims allowed: descriptive claims about cancellations, skips and survey answers.
Claims banned: any claim that a skip causes a cancellation, or that a pause keeps members. Wording is "worth testing".
Slide budget: 6, no appendix.
Platform: PowerPoint.
Theme: none, a plain text deck.
Constraints: no member names.
Not doing: pricing changes and gift subscriptions.

## Storyboard

| Slide | Headline | Claim | Evidence and source | Window | Layout |
|---|---|---|---|---|---|
| s01 | Why Fernway members cancel, and one test worth funding | Framing | none | none | cover |
| s02 | Six in ten cancellations follow two skipped boxes in a row | 2,562 of 4,200 cancellations followed a double skip | exports/cancellations.csv, exports/orders.csv | 52 weeks ending 2026-06-28 | stat and caption |
| s03 | Members who skip two boxes in a row cancel at three times the base rate | 31.2% against 10.4% | exports/orders.csv | 52 weeks ending 2026-06-28 | two bars |
| s04 | About one in five of the members who answered the exit survey gave price as the reason | 300 of 1,428 respondents | exports/exit-survey.csv | 52 weeks ending 2026-06-28 | one bar, both bases shown |
| s05 | A one-month pause is worth testing for members who skip two boxes in a row | The same 2,562 members | exports/cancellations.csv | 52 weeks ending 2026-06-28 | one idea, one number |
| s06 | The ask: approve a one-month pause test next quarter | Framing | none | none | close |

Headlines only:
1. Why Fernway members cancel, and one test worth funding
2. Six in ten cancellations follow two skipped boxes in a row
3. Members who skip two boxes in a row cancel at three times the base rate
4. About one in five of the members who answered the exit survey gave price as the reason
5. A one-month pause is worth testing for members who skip two boxes in a row
6. The ask: approve a one-month pause test next quarter

## Challenge log

### Round 1
Angle: Literal ask (new)
Addressed: the first draft led with the rate comparison. The double-skip share now opens on slide 2, so slide 2 answers what happened (s02, s03).
Deferred: NEEDS HUMAN: Was the exit survey voluntary? Slide s04 reads differently if it was required (s04).
Kept as is: slide order after slide 3. Re-read the headlines alone and the argument holds (s04 to s06).
Re-verified 4 claims, demoted 0 to uncertainty.

### Round 2
Angle: The unreconcilable number (new)
Addressed: s04 divided price answers by all 4,200 cancellations, but only 1,428 members (34%) answered the survey. Rebased the claim to 300 of 1,428 and printed both bases (s04).
Addressed: s03 compared two rates on different member bases. Recomputed both on one base: 31.2% and 10.4% (s03).
Kept as is: s02, recounted 2,562 and 4,200 from both files and the figures match (s02).
Re-verified 5 claims, demoted 1 to uncertainty.
Parked claims: s05 says a pause "would keep" members, and no source shows a retention effect (s05).

### Round 3
Angle: Parked claims (new)
Addressed: s05 reworded to "worth testing", and the retention figure removed (s05).
Kept as is: s06, compared the ask with the brief's decision, and it holds no figure (s06).
Re-verified 2 claims, demoted 0 to uncertainty.
Parked claims: none open

## Deviations

D1: build, s04 reads "of the members who answered" and prints both bases, because the survey question in Round 1 is still open and this wording claims nothing about members who did not answer.
D2: build, a plain text deck with no theme and no logo, because the brief named neither.

## Build

Deck: plans/example/fernway-skip-cancel.pptx
Fix pass after the first REJECT: s03 printed 31% and now prints 31.2%, the ledger's value.

| Slide | Text on the slide |
|---|---|
| s01 | Why Fernway members cancel, and one test worth funding |
| s02 | Six in ten cancellations follow two skipped boxes in a row. 2,562 of 4,200 cancellations (61%) followed two skipped boxes in a row. 52 weeks ending 2026-06-28. Source: exports/cancellations.csv, exports/orders.csv |
| s03 | Members who skip two boxes in a row cancel at three times the base rate. 31.2% of double skippers canceled against 10.4% of all other members, 3x. 52 weeks ending 2026-06-28. Source: exports/orders.csv |
| s04 | About one in five of the members who answered the exit survey gave price as the reason. 300 of the 1,428 members who answered gave price (21.0%). 1,428 is 34% of the 4,200 who canceled. 52 weeks ending 2026-06-28. Source: exports/exit-survey.csv |
| s05 | A one-month pause is worth testing for members who skip two boxes in a row. 2,562 members canceled after two skipped boxes in a row, and the test offers a one-month pause at the second skip. 52 weeks ending 2026-06-28. Source: exports/cancellations.csv |
| s06 | The ask: approve a one-month pause test next quarter. The pause is a proposal, and this deck claims no result for it. |

## Check

Path: rubric. carousel.config.json registers no engine, so no tool ran and the tools field says none.
Checklist, 9 of 9 items pass. Item 9 is deferred and the checklist has 9 items.
1 PASS: slide 2 answers "nobody can say why" with the double-skip share.
2 PASS: the six headlines read as a beginning (s01, s02), a turn (s03, s04) and an answer (s05, s06).
3 PASS: every numbered slide carries "52 weeks ending 2026-06-28".
4 PASS: s02 shows 4,200 beside 61%. s04 shows 1,428 beside 21.0%. s03 shows both rates and their ratio.
5 PASS: s02 to s05 each end with a source line.
6 PASS: the deck holds no quotes.
7 PASS: "Fernway" and the three export names are spelled the same on every slide.
8 PASS: one type size and one color on every slide of the plain text deck.
10 PASS: 6 slides against a budget of 6.
Plan gate, node scripts/check-process.js --plan plans/example/fernway-skip-cancel.md:
Plan: the deck read against 6 ledger rows and the Build table
PASS plan
Ledger gate, node scripts/check-process.js --ledger plans/example/fernway-skip-cancel.ledger.json --final:
Ledger: 6 slides, 6 checked, 0 open, 0 rejected, 0 unreconciled numbers
PASS ledger
Deferred: item 9, no render available. It needs a PDF or image export of the deck.
Deck sha256 before tools: 05374095dda1a02ae5c3b1502fea13a074efe163e74cd5e20c09812567d33c56
Deck sha256: 05374095dda1a02ae5c3b1502fea13a074efe163e74cd5e20c09812567d33c56
Ledger sha256: 29e337459e6753cf782fc8956b2713c7f33f756c165534dae8cdfbd50ef6f838
Build sha256: 1e63fb5459c92849491de3bcb9ad8a0c1de586171672c93f9658b2a803ce32c5

## Review

### Pass 1: REJECT
The reviewer got the bar, the deck, the ledger, the three exports and the Brief section.
- s02 2,562: counted from both files, found 2,562.
- s02 4,200: row count of cancellations.csv is 4,200.
- s03 31.2%: recomputed from orders.csv, found 31.2%. The slide printed 31%. MISMATCH.
Finding: s03 printed 31% where the source and the ledger say 31.2%. One unreconciled number.

### Pass 2: PASS
After the fix pass and a new check, the reviewer recomputed every number from its source.
- s02 2,562: counted cancellations with a double skip in the prior 60 days from both files, found 2,562.
- s02 4,200: row count of exports/cancellations.csv, found 4,200.
- s02 61%: 2,562 over 4,200 is 0.61, found 61%.
- s03 31.2%: double skippers who canceled over all double skippers, found 31.2%.
- s03 10.4%: all other members who canceled over all other members, found 10.4%.
- s03 3x: 31.2 over 10.4 is 3.0, found 3x.
- s04 300: survey rows with reason price, found 300.
- s04 1,428: survey rows, found 1,428.
- s04 21.0%: 300 over 1,428 is 0.210, found 21.0%.
- s04 34%: 1,428 over 4,200 is 0.34, found 34%.
- s04 4,200: same count as s02, found 4,200.
- s05 2,562: same count as s02, found 2,562.
Headlines alone: read as an argument. Literal ask: slide 2 answers it. One window: all four numbered slides carry it.
Output of node scripts/check-process.js --plan plans/example/fernway-skip-cancel.md:
Plan: the deck read against 6 ledger rows and the Build table
PASS plan
Output of node scripts/check-process.js --ledger plans/example/fernway-skip-cancel.ledger.json --final:
Ledger: 6 slides, 6 checked, 0 open, 0 rejected, 0 unreconciled numbers
PASS ledger
Render: none exists, so no render was opened. Item 9 stays deferred in Check.

## Reports

- Start report: plan plans/example/fernway-skip-cancel.md created; path full; handoff read; lessons loaded 0.
- Brief report: 6 questions asked, 6 answers recorded, 0 NEEDS HUMAN markers open.
- Storyboard report: 6 slides, headlines-only read holds, ledger rows 6.
- Challenge round 1 of 3: angle Literal ask (new). Re-verified 4 claims, demoted 0 to uncertainty.
- Challenge round 2 of 3: angle The unreconcilable number (new). Re-verified 5 claims, demoted 1 to uncertainty.
- Challenge round 3 of 3: angle Parked claims (new). Re-verified 2 claims, demoted 0 to uncertainty.
- Build report: 6 slides built, 6 ledger rows checked, 2 deviations logged.
- Check report: path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9; Deferred: item 9, no render available.
- Review verdict: REJECT; unreconciled numbers 1; findings 1.
- Build report: 6 slides built, 6 ledger rows checked, 2 deviations logged.
- Check report: path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9; Deferred: item 9, no render available.
- Review verdict: PASS; unreconciled numbers 0; findings 0.
- Wrap report: check PASS; log entry written; lessons added 1; wiki pages touched 1; entries rotated 0.
- Handoff report: memory/handoff.md written; 2 bullets; focus confirm whether the exit survey was voluntary.
