# Time and tokens

You expected a deck in ten minutes and the full run takes much longer. It is slow and uses many tokens because each stage re-reads sources and files, so a claim gets looked at more than once. I have not measured token counts for your setup, and I will not promise savings. This page says where the cost comes from so you can decide what to trim.

## Where it goes, largest first

1. **Review.** The two reviewers start with nothing, so they read the deck, the ledger, the brief and every source the ledger names, and the fidelity reviewer recomputes every number. This is usually the biggest single bill, and it is the price of an independent read.
2. **Critique rounds.** Each round reopens the plan and the sources behind the claims it touches. Three rounds mean three passes over the weakest numbers.
3. **Build.** Every number gets re-derived once as its slide is finished, which doubles the reading of the sources.
4. **Check.** Your engine's tools run in seconds to minutes of machine time, and the plan gate reads the deck file in well under a second. Looking at a render costs tokens.
5. **Brief.** Cheap in tokens, and it costs the human's time. It also saves the most later.
6. **Start, wrap, handoff.** Small. They read a handful of short files.

## What keeps the context small

- `RULES.md` and each stage file stay under the byte caps set in `scripts/check-process.js`, and that script fails when one grows past its cap.
- A session loads `RULES.md`, then one command at a time. Bookshelf pages load when a stage names them. Wiki pages load through the index.
- The log rotates weekly, so the log you read at start holds this week only.

## Checks while working and at the end

Run a targeted check on the slide in front of you while you build, because an error found there costs one slide. Run one complete check at `carousel-check` and one at `carousel-wrap`. Running the complete check after every edit multiplies the cost for little gain, and skipping it at the two named points leaves holes.

## Where to trim, honestly

- The short run (`short-run.md`) cuts two critique rounds.
- Fewer slides means fewer ledger rows, fewer numbers to re-derive and a smaller review.
- A narrower evidence base, one source and one window, shrinks every source a round reopens.

Cutting the brief, the ledger or the review saves tokens and loses the point of the process.
