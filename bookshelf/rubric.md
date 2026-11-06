# Rubric: what a reviewer scores, and when to stop

Summary: twelve dimensions, floors, compound caps, severities and the stopping rule a reviewer uses when it judges a finished deck.

The reviewer scores the deck, never the builder. A score summarizes named defects. Every dimension below 9 traces to specific findings. The review itself runs in `commands/carousel-review.md`; this file says how the numbers work and when the loop ends.

## The twelve dimensions

| # | Dimension | Weight | 9 to 10 looks like | Floor |
|---|---|---:|---|---:|
| 1 | Question alignment | 15 | Every literal question answered first, in your framing, with the requester's names for categories and metrics | 8 |
| 2 | Strategic insight | 12 | The organizing idea makes the decision or next step clear | 7 |
| 3 | Narrative | 10 | The headlines alone make a complete, non-repetitive argument with a turn and an answer | 8 |
| 4 | Evidence | 15 | Every claim supported, fact apart from inference, counter-evidence shown | 8 |
| 5 | Slide-level clarity | 8 | Any slide alone makes its point to a stranger in 5 to 10 seconds | 7 |
| 6 | Information hierarchy | 5 | The eye lands on the most important thing first | 7 |
| 7 | Visual communication | 7 | Each representation chosen for speed of comprehension | 7 |
| 8 | Design quality | 7 | Restrained, anti-tells clean, one consistent system | 7 |
| 9 | Density | 4 | Every element earns its space | 6 |
| 10 | Credibility | 10 | A base beside every percent, accurate scope tags, one basis | 8 |
| 11 | Presentation readiness | 4 | Someone who did not build it could present it | 6 |
| 12 | Polish | 3 | No typos, aligned geometry, correct names, page numbers, source lines | 8 |

For a written answer with no slides, dimensions 6, 7 and 8 are struck and their weight moves to dimension 5.

Overall is the weighted mean, rounded to one decimal, then the caps below apply. The framing cap applies first, to dimension 1.

## Compound caps

- Framing: cap dimension 1 at 7 when the deck repeats the assignment instead of answering it, or leaves out a decision-relevant part of the question.
- Thinking: if the mean of dimensions 2 to 4 is below 8, overall is at most 7.
- Clarity: if the mean of dimensions 5 to 8 is below 7, overall is at most 7.
- Length: a deck over the agreed slide budget is at most 7 until it fits.
- Narrative: if dimension 3 is under its floor, overall is at most 6. Fix the storyboard, not the slides.

A deck at exactly its floors still trips the thinking cap. That is intended. When a cap binds, the reviewer names the dimensions that hold it.

## Severity

- P0 blocks delivery: a wrong or unsourced number, a corrupted quote, a contradiction between slides, a misspelled name, a claim stronger than its evidence.
- P1 must be fixed before delivery: a headline the evidence does not force, a missing base beside a percent, a scope-tag mismatch, an anti-tell, a dimension under its floor, the findings behind a binding cap.
- P2 is worth improving: hierarchy, density, representation.
- P3 is polish: micro-alignment, wording taste.

Severity follows impact. A defect that pushes any dimension under its floor is P1 whatever its topic.

## When to stop

Stop when no P0 and no P1 is open, every number is reconciled to its source, and quotes are exact. Do not stop at a score, and do not run another round to lift a score that already passes.

1. The review is one pass per build. Then fix the P0 and P1 findings, then confirm the final file once.
2. A P0 or P1 first seen at the final confirmation is fixed and confirmed once more. If it opens again, declare a blocker: name what prevents the bar (missing data, an unanswerable question, a deadline) and say so in the delivery note.
3. A second content rework (a new analysis or a new organizing idea) is itself a blocker to declare.
4. Every quantitative claim carries a check against the current slide and the current ledger row. Unverifiable never rounds up to verified: re-run the source analysis or weaken the claim to what you can prove.
5. Every region the render report lists as approximated is resolved: view it in a PDF export, rebuild it from kit components, or name it as unverified in the delivery note.

## Verdicts

The review stage records PASS, REJECT or UNVERIFIABLE. This rubric adds the plain-language reading:

- PASS: the stopping rule holds.
- PASS with a written list: only P2 and P3 are open. They ship as a list titled "what we would still improve", one line each: the slide, the finding in plain words, and the cost to fix. The person decides which to buy.
- REJECT: P0 or P1 open, or a cap binds. The finding list says exactly what.
- UNVERIFIABLE: the reviewer could not check something. It names what it needs.

## Draft versus final

You may hand over an explicitly labeled draft before the review finishes. Say what is verified and what is not, disclose any known unresolved content issue, and never present a claim you know is false. The P0 and P1 gates still hold for the final.
