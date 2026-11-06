# The engine contract

An engine is a program you write or plug in that draws slides, checks them, or both. Carousel OS does not ship one. It talks to yours through shell commands and exit codes, so any language works. This page is the one authority for the config keys and exit codes. `commands/carousel-check.md` is the procedure that uses them, and the build-your-engine docs in the carousel-os repository say what an engine should check.

## carousel.config.json

The file sits at the project root and is optional. `carousel.config.example.json`, in the carousel-os repository, is a sample to copy.

| Key | Meaning |
|---|---|
| `engine.scan` | Required when `engine` is present. A shell template that checks the deck. |
| `engine.render` | Required when `engine` is present. A shell template that renders the deck for a person to look at. |
| `engine.tools` | Optional. An object of tool name to shell template, for any other check. Names are lowercase letters, digits, hyphen or underscore, and may not repeat `scan` or `render`. |

Every template must hold `{deck}` (the path named on Build's `Deck:` line) and `{out}` (the folder `decks/<slug>.check`, created before the tool runs). No other key under `engine` is read.

## What a tool does

- It reads the deck and writes its report into `{out}`. It never edits the deck, so the record shows what was found before anyone changed it.
- Its last non-empty line of output is a one-line summary a person can read, such as `scan: 0 FAIL, 3 CANDIDATE, 1 NOT SCANNED, 41 PASS`.
- It exits with one of three codes.

| Exit code | Recorded as | Use it when |
|---|---|---|
| 0 | PASS | The tool ran and found no FAIL. CANDIDATE and NOT SCANNED results still exit 0, and the counts in the last line carry them to the reader. |
| 1 | FAIL | The tool ran and found at least one FAIL. Any code other than 0 and 2 is recorded as FAIL too. |
| 2 | MISSING | The tool or its runtime is missing, or it could not start. It is never recorded as PASS. |

## How the process runs and records it

`carousel-check` calls `node scripts/run-tools.js plans/<slug>.md`. That script expands the templates, runs each tool from the project root, maps the exit codes with the table above, prints `Tool <name>: <PASS|FAIL|MISSING>: <exact last line>` for each, and writes the codes it saw to `decks/<slug>.check/tools.json`. The deck is hashed before and after, and a difference is a finding.

The Check section holds the same lines. Four hashes sit beside them: the deck before the tools ran, the deck after, the ledger and the Build section.

`node scripts/check-process.js` compares Check with the config and with `tools.json`. Every registered tool needs a result. A result from an unregistered tool is an error, and so is a status that differs from the recorded exit code. So are a command that differs from the config and a deck whose hash changed while the tools ran. A config that registers tools makes the rubric path an error, and an engine path with no registered engine is an error. The check trusts the results file, so an agent that writes both by hand can defeat it. The reviewer and the human are the backstop.

## Without an engine

With no `engine` key, `carousel-check` runs the rubric path: a ten item checklist that the agent answers by reading and rendering the deck. The plan gate and the ledger gate run on both paths. An engine adds checks that count and measure where the agent would only look.
