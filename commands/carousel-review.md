# carousel-review

Job: have a reviewer with fresh context try to disprove the deck, and record PASS, REJECT or UNVERIFIABLE with pasted evidence.
Reads: Check in the plan, the deck, the ledger, the sources the ledger names, the Brief section.
Writes: Review in the plan (verdict, pasted evidence, findings), `Status: reviewed`, a line in Reports. The builder records what the reviewer returned and edits none of it.
Exit check: Review holds the reviewer's verdict with pasted evidence, and Reports holds the `Review verdict:` line.

## Guards

Decline, name the cause, and stop when:
1. Reports' latest `Check report:` line is missing, or it holds a FAIL, a MISSING tool or a checklist short of its total. Say to run `carousel-build`, then `carousel-check`.
2. The deck, ledger or Build sha256 differs from the hashes in Check (`node scripts/check-process.js --hashes plans/<slug>.md` prints them), or the plan has unsaved edits. Say to save and re-run `carousel-check`.
3. Reports already holds two `Review verdict: REJECT` lines. Say to run `carousel-wrap`.

## Steps

1. Run `node scripts/check-process.js --hashes plans/<slug>.md` and compare its three lines with Check.
2. Start the reviewer as a separate agent with none of this conversation (fresh context). Give it only the bar (`RULES.md, "The bar"` and `bookshelf/rubric.md`) and the file list: the deck, the ledger, the sources the ledger names, and the Brief section copied to a scratch file. Withhold the Challenge log, Deviations and your reasoning. Why: it must have nothing to be anchored by.
3. Tell it to try to disprove the deck. It must at least:
   - recompute every ledger number from its source;
   - run `node scripts/check-process.js --plan plans/<slug>.md`, which reads the slide text out of the deck file;
   - read the headlines alone;
   - test the literal ask against slides 1 and 2;
   - confirm one window;
   - run `node scripts/check-process.js --ledger plans/<slug>.ledger.json --final`;
   - open the render, when one exists.
   `bookshelf/review-angles.md` lists more angles it may add.
4. It returns one verdict.
   - Any number unreconciled, any slide contradicting the brief, or any bar item failing: REJECT.
   - Something it cannot check (a missing source, a render that will not open): UNVERIFIABLE, naming what it needs. UNVERIFIABLE is never rounded up to PASS.
   - Evidence pasted for every bar item and no failure: PASS. The evidence holds the `Ledger:` summary line, the lines `PASS ledger` and `PASS plan`, and one line per ledger number in the form `- <slide id> <value>: <what the reviewer did>, found <value>`. The found value equals the ledger value.
5. Paste the verdict and evidence into Review. List findings by slide. Set `Status: reviewed` and append the report line to Reports.
6. Choose the next step. After a first REJECT, the second review is the last.
   - PASS: the human runs `carousel-wrap`.
   - REJECT or UNVERIFIABLE: the human runs `carousel-build` and then `carousel-check`, and this stage again.
   - A second REJECT: append `Stopped at review: second REJECT, blocker.` to Reports and name `carousel-wrap`. The state check refuses anything else after it.

## Report line

End with exactly this line, then add the same line to Reports:

`Review verdict: <PASS|REJECT|UNVERIFIABLE>; unreconciled numbers <N>; findings <N>.`

## No-rubber-stamp guard

A fake review gives the reviewer the builder's reasoning, or runs in the builder's own context. It returns PASS with "looks good" and no pasted evidence. It re-runs scripts and never recomputes a number from its source. It treats UNVERIFIABLE as PASS because the gap was small. It edits the reviewer's words before recording them.

## Rationale

A builder grading their own deck finds what they already believe. A reviewer holding only the bar and the files, told to disprove, reads for failure. UNVERIFIABLE stays a separate verdict because "could not tell" and "all clear" lead to different next steps.
