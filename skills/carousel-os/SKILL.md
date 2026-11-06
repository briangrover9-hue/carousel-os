---
name: carousel-os
description: "A process for building a deck from a request to a finished, checked PowerPoint. Nine stage commands (start, brief, storyboard, challenge-plan, build, check, review, wrap, handoff) run in order against a plan file, a claim ledger and a memory folder, and a reviewer with fresh context tries to disprove the deck before it ships. An engine you build or plug in yourself can add mechanical checks through a small config file. Use it when someone asks for a deck, a readout, slides or a one-page answer that must be accurate and repeatable, or says carousel, deck process or the name of any carousel stage. Do not use it for a chart with no deck, a quick sketch, or editing a deck in someone else's template."
---

# carousel-os

Run this decision list from the top each time.

1. Does `RULES.md` exist at the project root?
   - No: the process is not installed. Tell the human to run `node scripts/install.js <project folder>` from the carousel-os repository, and stop.
   - Yes: read it. It is the one rules file.
2. Did the human name a stage (start, brief, storyboard, challenge-plan, build, check, review, wrap or handoff)?
   - Yes: read `commands/carousel-<stage>.md` and run it.
   - No: go to step 3.
3. Does `plans/` hold a plan whose Status is not `wrapped`?
   - Yes: read its last line in `## Reports`. Name the next stage from `RULES.md, "The chain"` and ask the human to type it.
   - No: tell the human to type `carousel-start`.

Every command file has the same parts. The top lines give Job, Reads, Writes and Exit check. Guards names what the stage declines. Steps is the procedure. Report line is the exact line to print and append to Reports. The No-rubber-stamp guard names what a fake pass looks like. Run the stage, check yourself against its Exit check line, then print the report line.

The installer copies the nine commands to `.claude/commands/` where agents look, and keeps a plain copy in `commands/`. An engine is optional. When `carousel.config.json` registers one, `carousel-check` runs it. Without one, `carousel-check` takes the rubric path and says so.

Never skip the fresh-context reviewer. Never round UNVERIFIABLE up to PASS. Never start the next stage yourself.
