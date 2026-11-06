# Plan: Why Wrenmoor members cancel (worked example, invented content)

Status: wrapped
Slug: wrenmoor-skip-cancel
Path: full
Rounds: 3

Wrenmoor Gyms is an invented gym chain, and every figure here is made up. A missed week is a calendar week with no visit to any club. This example was built without an engine. Its deck is a plain text deck, one text box per slide, made with a short script, so there is no design to judge and no tool results below. It took the rubric path, and its hashes are real. The handoff it wrote sits beside this file in `wrenmoor-skip-cancel.handoff.md`. The three exports it cites are invented too, and they sit in `plans/example/exports/`, so each path below that starts with exports/ is read from this folder. `plans/example/exports/make-exports.js` writes them from a fixed seed, and anyone can recount every number from them.

## Request

In the human's words: "Our cancellations went up and nobody can say why. Give me six slides for Thursday's leadership meeting."
Reader and venue: the three leaders of Wrenmoor, on a shared screen.
Path: full, because the deck drives a spending decision.
Starting material the human named: exports/visits.csv, exports/cancellations.csv, exports/exit-survey.csv.

## Brief

Literal ask: "Our cancellations went up and nobody can say why."
Decision: whether to fund a test of a freeze option next quarter.
Reader and venue: three leaders, shared screen in a meeting, no pre-read.
Evidence: the three exports above. One window: 12 months ending 2026-06-30. All members, all clubs.
Counting rule: each member cancels at most once in the window, so a count of cancellations is also a count of members, and the 2,562 cancellations on s02 are the same people as the 2,562 members on s03 and s05. The member base is 23,962 members: 8,212 who missed two weeks in a row and 15,750 others.
Claims allowed: descriptive claims about cancellations, visits and survey answers.
Claims banned: any claim that a missed week causes a cancellation, or that a freeze keeps members. Wording is "worth testing".
Slide budget: 6, no appendix.
Platform: PowerPoint.
Theme: none, a plain text deck.
Constraints: no member names. Any freeze the deck proposes is one month long: the human named a one-month freeze as the only length finance will price this quarter.
Not doing: pricing changes and personal training.

## Storyboard

| Slide | Headline | Claim | Evidence and source | Window | Layout |
|---|---|---|---|---|---|
| s01 | Why Wrenmoor members cancel, and one test worth funding | Framing | none | none | cover |
| s02 | Six in ten cancellations follow two missed weeks in a row | 2,562 of 4,200 cancellations followed two missed weeks in a row | exports/cancellations.csv, exports/visits.csv | 12 months ending 2026-06-30 | stat and caption |
| s03 | Members who miss two weeks in a row cancel at three times the rate of other members | 2,562 of 8,212 members who missed two weeks in a row canceled (31.2%), against 1,638 of 15,750 other members (10.4%) | exports/cancellations.csv, exports/visits.csv | 12 months ending 2026-06-30 | two bars |
| s04 | About one in five of the members who answered the exit survey gave price as the reason | 300 of 1,428 respondents, and 1,428 of 4,200 cancellations | exports/exit-survey.csv, exports/cancellations.csv | 12 months ending 2026-06-30 | one bar, both bases shown |
| s05 | A one-month freeze is worth testing for members who miss two weeks in a row | The same 2,562 members | exports/cancellations.csv, exports/visits.csv | 12 months ending 2026-06-30 | one idea, one number |
| s06 | The ask: approve a one-month freeze test next quarter | Framing | none | none | close |

Headlines only:
1. Why Wrenmoor members cancel, and one test worth funding
2. Six in ten cancellations follow two missed weeks in a row
3. Members who miss two weeks in a row cancel at three times the rate of other members
4. About one in five of the members who answered the exit survey gave price as the reason
5. A one-month freeze is worth testing for members who miss two weeks in a row
6. The ask: approve a one-month freeze test next quarter

## Critique log

### Round 1
Angle: Literal ask (new)
Fixed: the first draft led with the rate comparison. The missed-weeks share now opens on slide 2, so slide 2 answers what happened (s02, s03).
Waiting on you: ASK: Was the exit survey voluntary? Slide s04 reads differently if it was required (s04).
Verified unchanged: slide order after slide 3. Re-read the headlines alone and the argument holds (s04 to s06).
Fixed 1; waiting 1; verified 1; ledger rows open 0.

### Round 2
Angle: The unreconcilable number (new)
Fixed: s04 divided price answers by all 4,200 cancellations, but only 1,428 members (34%) answered the survey. Rebased the claim to 300 of 1,428 and printed both bases (s04).
Fixed: s03 compared two rates on different member bases. Recomputed both on one base of 23,962 members: 2,562 of 8,212 (31.2%) and 1,638 of 15,750 (10.4%) (s03).
Verified unchanged: s02, recounted 2,562 and 4,200 from both files and the figures match (s02).
Open rows: s05 says a freeze "would keep" members, and no source shows a retention effect (s05).
Fixed 2; waiting 0; verified 1; ledger rows open 1.

### Round 3
Angle: Open rows (new)
Fixed: s05 reworded to "worth testing", and the retention figure removed (s05).
Verified unchanged: s06, compared the ask with the brief's decision, and it holds no figure (s06).
Open rows: none open
Fixed 1; waiting 0; verified 1; ledger rows open 0.

## Calls made

D1: build, s04 reads "of the members who answered" and prints both bases, because the survey question in Round 1 is still open and this wording claims nothing about members who did not answer.
D2: build, a plain text deck with no theme and no logo, because the brief named neither.

## Build

Deck: plans/example/wrenmoor-skip-cancel.pptx
Deck sha256 at build: a08ad58d3903c0eb1883d7beb5fd8717a80237c5155b2b779089dbcf75cd3cb7
Fix pass after the first REJECT: s03 printed 31% and now prints 31.2%, the ledger's value.

| Slide | Text on the slide |
|---|---|
| s01 | Why Wrenmoor members cancel, and one test worth funding |
| s02 | Six in ten cancellations follow two missed weeks in a row. 2,562 of 4,200 cancellations (61%) followed two missed weeks in a row. 12 months ending 2026-06-30. Source: exports/cancellations.csv, exports/visits.csv |
| s03 | Members who miss two weeks in a row cancel at three times the rate of other members. 2,562 of the 8,212 members who missed two weeks in a row canceled (31.2%), against 1,638 of the 15,750 other members (10.4%), 3x. 12 months ending 2026-06-30. Source: exports/cancellations.csv, exports/visits.csv |
| s04 | About one in five of the members who answered the exit survey gave price as the reason. 300 of the 1,428 members who answered gave price (21.0%). 1,428 is 34% of the 4,200 who canceled. 12 months ending 2026-06-30. Source: exports/exit-survey.csv, exports/cancellations.csv |
| s05 | A one-month freeze is worth testing for members who miss two weeks in a row. 2,562 members canceled after two missed weeks in a row, and the test offers a one-month freeze at the second missed week. 12 months ending 2026-06-30. Source: exports/cancellations.csv, exports/visits.csv |
| s06 | The ask: approve a one-month freeze test next quarter. The freeze is a proposal, and this deck claims no result for it. |

## Check

Path: rubric. carousel.config.json registers no engine, so no tool ran and the tools field says none.
Checklist, 9 of 9 items pass. The checklist has 10 items, and item 9 (the render) is deferred, so the count is out of the 9 that could run.
1 PASS: slide 2 answers "nobody can say why" with the missed-weeks share.
2 PASS: the six headlines read as a beginning (s01, s02), a turn (s03, s04) and an answer (s05, s06).
3 PASS: every numbered slide carries "12 months ending 2026-06-30".
4 PASS: s02 shows 4,200 beside 61%. s03 shows 8,212 beside 31.2% and 15,750 beside 10.4%. s04 shows 1,428 beside 21.0%.
5 PASS: s02 to s05 each end with a source line.
6 PASS: the deck holds no quotes.
7 PASS: "Wrenmoor" and the three export names are spelled the same on every slide.
8 PASS: one type size and one color on every slide of the plain text deck.
10 PASS: 6 slides against a budget of 6.
Plan gate, node scripts/check-process.js --plan plans/example/wrenmoor-skip-cancel.md:
Plan: the deck read against 6 ledger rows and the Build table
PASS plan
Ledger gate, node scripts/check-process.js --ledger plans/example/wrenmoor-skip-cancel.ledger.json --final:
Ledger: 6 slides, 6 checked, 0 open, 0 rejected, 0 unreconciled numbers
PASS ledger
Waiting on you: item 9, no render available. It needs a PDF or image export of the deck.
Deck sha256 before tools: a08ad58d3903c0eb1883d7beb5fd8717a80237c5155b2b779089dbcf75cd3cb7
Deck sha256: a08ad58d3903c0eb1883d7beb5fd8717a80237c5155b2b779089dbcf75cd3cb7
Ledger sha256: 00c0fc2b97696b9278f090ac15f6b80b9009fe027c6afcdacb253d46ad803749
Build sha256: aa92981b9e5a059774aa4b1ab63213ef2f15231674224305f621fe41ca8576e2

## Review

### Pass 1: REJECT
The reviewer got the bar, the deck, the ledger, the three exports and the Brief section.
- s02 2,562: counted from both files, found 2,562.
- s02 4,200: row count of cancellations.csv is 4,200.
- s03 31.2%: recomputed from cancellations.csv and visits.csv, found 31.2%. The slide printed 31%. MISMATCH.
Finding: s03 printed 31% where the source and the ledger say 31.2%. One unreconciled number.

### Pass 2: PASS
After the fix pass and a new check, the reviewer recomputed every number from its source.
- s02 2,562: cancellations that followed two missed weeks in a row, matched across exports/cancellations.csv and exports/visits.csv, found 2,562.
- s02 4,200: row count of exports/cancellations.csv, found 4,200.
- s02 61%: 2,562 (exports/cancellations.csv, exports/visits.csv) over 4,200 (exports/cancellations.csv) is 0.61, found 61%.
- s03 2,562: members who missed two weeks in a row and canceled, matched across exports/cancellations.csv and exports/visits.csv (the same count as s02), found 2,562.
- s03 8,212: members who missed two weeks in a row, from exports/visits.csv, the base for the 2,562 in exports/cancellations.csv, found 8,212.
- s03 31.2%: 2,562 who canceled (exports/cancellations.csv) over 8,212 members (exports/visits.csv) is 0.312, found 31.2%.
- s03 1,638: all other members who canceled, exports/cancellations.csv less the 2,562 (so the two add to the 4,200 on s02), found 1,638.
- s03 15,750: all other members, from exports/visits.csv, the base for the 1,638 in exports/cancellations.csv (with the 8,212 they make 23,962 members, and 4,200 of 23,962 is 17.5% overall), found 15,750.
- s03 10.4%: 1,638 who canceled (exports/cancellations.csv) over 15,750 members (exports/visits.csv) is 0.104, found 10.4%.
- s03 3x: 31.2 over 10.4, the two rates from exports/cancellations.csv over exports/visits.csv, is 3.0, found 3x.
- s04 300: rows of exports/exit-survey.csv with reason price, found 300.
- s04 1,428: rows of exports/exit-survey.csv, found 1,428.
- s04 21.0%: 300 over 1,428, both from exports/exit-survey.csv, is 0.210, found 21.0%.
- s04 34%: 1,428 survey rows (exports/exit-survey.csv) over 4,200 cancellations (exports/cancellations.csv) is 0.34, found 34%.
- s04 4,200: row count of exports/cancellations.csv, the same count as s02, found 4,200.
- s05 2,562: same count as s02, matched across exports/cancellations.csv and exports/visits.csv, found 2,562.
Headlines alone: read as an argument. Literal ask: slide 2 answers it. One window: all four numbered slides carry it.
Output of node scripts/check-process.js --plan plans/example/wrenmoor-skip-cancel.md:
Plan: the deck read against 6 ledger rows and the Build table
PASS plan
Output of node scripts/check-process.js --ledger plans/example/wrenmoor-skip-cancel.ledger.json --final:
Ledger: 6 slides, 6 checked, 0 open, 0 rejected, 0 unreconciled numbers
PASS ledger
Render: none exists, so no render was opened. Item 9 stays deferred in Check.

## Reports

- Start report: plan plans/example/wrenmoor-skip-cancel.md created; path full; handoff read; lessons loaded 0.
- Brief report: 6 questions asked, 6 answers recorded, 0 ASK markers open.
- Storyboard report: 6 slides, headlines-only read holds, ledger rows 6.
- Critique round 1 of 3: angle Literal ask (new). Fixed 1; waiting 1; verified 1; ledger rows open 0.
- Critique round 2 of 3: angle The unreconcilable number (new). Fixed 2; waiting 0; verified 1; ledger rows open 1.
- Critique round 3 of 3: angle Open rows (new). Fixed 1; waiting 0; verified 1; ledger rows open 0.
- Build report: 6 slides built, 6 ledger rows checked, 2 calls logged.
- Check report: path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9; Waiting on you: item 9, no render available.
- Review verdict: REJECT; unreconciled numbers 1; findings 1.
- Build report: 6 slides built, 6 ledger rows checked, 2 calls logged.
- Check report: path rubric; plan PASS; ledger PASS; tools none; checklist 9 of 9; Waiting on you: item 9, no render available.
- Review verdict: PASS; unreconciled numbers 0; findings 0.
- Wrap report: check PASS; log entry written; lessons added 1; wiki pages touched 1; entries rotated 0.
- Handoff report: memory/handoff.md written; 2 bullets; focus confirm whether the exit survey was voluntary.
