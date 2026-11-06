# What it costs

The full chain is slow and uses many tokens on purpose. Each stage re-reads sources and files so that a claim gets looked at more than once. I have not measured token counts for your setup, and I will not promise savings. This page says where the cost comes from so you can decide what to trim.

## Where it goes, largest first

1. **Review.** The reviewer starts with nothing, so it reads the deck, the ledger, the brief and every source the ledger names, and it recomputes every number. This is usually the biggest single bill, and it is the price of an independent read.
2. **Challenge rounds.** Each round re-opens the plan and re-verifies the claims it touches against their sources. Three rounds mean three passes over the weakest numbers.
3. **Build.** Every number gets re-derived once as its slide is finished, which doubles the reading of the sources.
4. **Check.** Your engine's tools run in seconds to minutes of machine time, and the plan gate reads the deck file in well under a second. Looking at a render costs tokens.
5. **Brief.** Cheap in tokens, and it costs the human's time. It also saves the most later.
6. **Start, wrap, handoff.** Small. They read a handful of short files.

## What keeps the context small

- `RULES.md` stays under 8000 bytes and each command under 7000. `node scripts/check-process.js` fails when one grows past its cap.
- A session loads `RULES.md`, then one command at a time. Bookshelf pages load when a stage names them. Wiki pages load through the index.
- The log rotates weekly, so the log you read at start holds this week only.

## Checks while working and at the end

Run a targeted check on the slide in front of you while you build, because an error found there costs one slide. Run one complete check at `carousel-check` and one at `carousel-wrap`. Running the complete check after every edit multiplies the cost for little gain, and skipping it at the two named points leaves holes.

## Where to trim, honestly

- The light path (`light-path.md`) cuts two critique rounds.
- Fewer slides means fewer ledger rows, fewer numbers to re-derive and a smaller review.
- A narrower evidence base, one source and one window, shrinks every re-verification.

Cutting the brief, the ledger or the review saves tokens and loses the point of the process.
