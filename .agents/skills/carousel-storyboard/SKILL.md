---
name: carousel-storyboard
description: "Turn the brief into one headline, claim, source and window per slide, and open the claim ledger."
disable-model-invocation: true
---

# carousel-storyboard

Job: turn the brief into one headline, claim, source and window per slide, and open the claim ledger.
Reads: the plan's Brief, `bookshelf/narrative-devices.md`, `bookshelf/writing.md`, `bookshelf/claim-ledger.md`.
Writes: `plans/<slug>.md`: Storyboard, `Status: storyboarded`, a line in Reports. Creates `plans/<slug>.ledger.json` from `plans/ledger.template.json`.
Exit check: the storyboard table ids equal the ledger ids, a `Headlines only:` block lists every headline, and Reports holds the `Storyboard report:` line.

## Guards

Decline, name the cause, and stop when:
1. Reports has no `Brief report:` line. Say to run `carousel-brief`.
2. Brief's `Literal ask:`, `Reader and venue:` or `Evidence:` is empty or holds a `NEEDS HUMAN:` marker. Name the field.

## Steps

1. Write the answer to the literal ask as slide 1 or 2, in our words. Why: pasting their wording back answers nothing.
2. Write every headline as a full-sentence claim. A topic label is not a headline.
3. Order slides widest scope first, narrowest last, unless Brief says otherwise. Use a beat from `bookshelf/narrative-devices.md` only when the evidence earns it.
4. For each slide, decide its kind.
   - Cover, divider, agenda or close: `framing`. It carries no digits.
   - Anything else: `claim`. Give it one claim, its source and its window. No source: cut the slide, or mark it `GAP` and name the source it needs.
5. Write the table `| Slide | Headline | Claim | Evidence and source | Window | Layout |` with ids `s01`, `s02` and so on. The ids are the ledger's ids.
6. Write `Headlines only:` followed by every headline as a numbered line. Read them in order.
   - Beginning, turn and answer are all there: report `holds`.
   - Any is missing: rewrite once. If it still fails, report `does not hold` and name the weak slide.
7. Create the ledger with one row per slide, every number planned for the slide listed with its source, every status `open`.
8. Compare the slide count with the budget. Over: merge slides, or move them to an appendix and log the appendix under Deviations.
9. Set `Status: storyboarded`. Append the report line to Reports.

## Report line

End with exactly this line, then add the same line to Reports:

`Storyboard report: <N> slides, headlines-only read <holds|does not hold>, ledger rows <N>.`

## Real-change check

A fake storyboard has topic labels for headlines. Its ledger rows carry "internal data" or "see appendix" as the source, or leave the window blank on a slide with numbers. It says the read holds with no `Headlines only:` block. It copies one placeholder number into every row so the counts match.

## Rationale

Story order is settled before layout exists, because a rearranged argument costs far more once slides are drawn. The ledger opens here so the build cannot add a number that has no source.
