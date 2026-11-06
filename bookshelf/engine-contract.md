# The engine contract

An engine is a program you write or plug in that draws slides, checks them, or both. Carousel OS does not ship one. It talks to yours through shell commands and exit codes, so any language works. `commands/carousel-check.md` is the procedure. This page is the reference for the file it reads. What an engine should check is in the build-your-engine docs in the carousel-os repository.

## carousel.config.json

The file sits at the project root and is optional. `carousel.config.example.json`, in the carousel-os repository, is a sample to copy.

| Key | Meaning |
|---|---|
| `engine.scan` | Required when `engine` is present. A shell template that checks the deck. |
| `engine.render` | Required when `engine` is present. A shell template that renders the deck for a person to look at. |
| `engine.tools` | Optional. An object of tool name to shell template, for any other check. Names are lowercase letters, digits, hyphen or underscore, and may not repeat `scan` or `render`. |

Every template must hold `{deck}` (the path to the .pptx named on Build's `Deck:` line) and `{out}` (the folder `decks/<slug>.check`, created before the tool runs). No other key under `engine` is read.

## What a tool does

- It reads the deck and writes its report into `{out}`. It never edits the deck, so the record shows what was found before anyone changed it.
- It exits 0 for PASS, 1 for FAIL, and 2 when the tool or its runtime is missing. `carousel-check` records 2 as MISSING and never as PASS. Any other exit code counts as FAIL.
- Its last non-empty line of output is a one-line summary a person can read.

## What gets recorded

For each tool, Check holds `Tool <name>: <PASS|FAIL|MISSING>: <exact last line>`. The Check report line lists the same results. Four hashes are recorded too: the deck before the tools ran, the deck after, the ledger and the Build section.

`node scripts/check-process.js` compares Check with the config. Every registered tool needs a result line. A result for a tool that is not registered is an error. A config that registers tools makes the rubric path an error, and an engine path with no registered engine is an error. A deck whose hash changed during the tools is an error.

## Without an engine

With no `engine` key, `carousel-check` runs the rubric path: a ten item checklist that the agent answers by reading the deck. The plan gate and the ledger gate run on both paths. The engine adds checks that count and measure where the agent would only look.
