# Reference engine

A small engine you can read in one sitting, written to show what the [engine contract](../../../bookshelf/engine-contract.md) asks for. It has no dependencies beyond Node. Copy it, then replace it with your own.

| File | What it is |
|---|---|
| `scan.js` | A scanner. It opens a `.pptx` (a zip of XML), reads `tokens.json` and runs five checks. |
| `tokens.json` | Example design tokens: a small neutral palette by role, a type scale of six sizes, a headline limit and a contrast floor. |
| `render.js` | A stub renderer. It draws nothing and writes the text of each slide to `outline.txt`. It exists because the contract requires `engine.render` next to `engine.scan`. |
| `carousel.config.json` | The registration: both tools as shell templates with `{deck}` and `{out}`. |

## The five checks

1. Headline length. The headline is a shape named headline or title, or else the first sentence of the first text on the slide. FAIL past `headline.maxChars`, CANDIDATE within ten percent of it.
2. Type sizes. Every size in the file is compared with `type.scale`. FAIL on a size off the scale.
3. Colors. Every color in the file is compared with the palette. FAIL on a color off it.
4. Text contrast. A text run that has its own color and sits on a known fill (its shape's fill, or the slide background) is measured against `contrast.min`. FAIL under it. Runs with no color of their own or no known fill are counted as NOT SCANNED in the report, never passed.
5. Percentage with no base. A percent on a slide with no count beside it (`4,200`, `1204`, `n=300`; years do not count) is a FAIL.

The scan never edits the deck. It writes `scan-report.md` and `scan-report.json` into the out folder, prints its findings, ends with one line, `scan: N FAIL, M CANDIDATE`, and exits 0 (no FAIL), 1 (a FAIL) or 2 (the deck or the tokens are missing or unreadable).

## Register it in a project

From the root of a project that has Carousel OS installed and this folder copied in:

```
cp docs/build-your-engine/example/carousel.config.json carousel.config.json
```

Edit the paths in the two templates if you moved the files. Then run `carousel-check`. It runs `engine.scan` and `engine.render` in that order, pastes each tool's last line into Check, and records MISSING for exit 2. `node scripts/check-process.js` then compares Check with the config.

## Try it on the worked example

The worked example deck was built without an engine, and its plan took the rubric path. To see this scanner on that deck, run it by hand:

```
mkdir -p out
node docs/build-your-engine/example/scan.js plans/example/fernway-skip-cancel.pptx out/check
node docs/build-your-engine/example/render.js plans/example/fernway-skip-cancel.pptx out/check
```

The real output:

```
CANDIDATE slide 3 headline length: 71 characters, within 10 percent of the 72 limit
FAIL slide 4 headline length: 86 characters, limit 72: "About one in five of the members who answered the exit survey gave price as the reason"
FAIL slide 5 headline length: 74 characters, limit 72: "A one-month pause is worth testing for members who skip two boxes in a row"
FAIL slide 3 percentage base: 31.2%, 10.4% with no base (a count of what it is a percent of) on the slide
scan: 3 FAIL, 1 CANDIDATE
```

The exit code is 1. The deck is a plain text deck, so it has no colors and one type size (28 points, on the scale), and its six text runs are NOT SCANNED for contrast. The failures are real findings about the text: two headlines run past the limit, and slide 3 gives two percentages with no count beside them. Carousel OS does not ask you to fix the example, because its plan is finished and hashed.

## What it deliberately does not do

- It does not measure rendered line counts. It counts characters, which is a stand-in for the line cap.
- It does not read charts, tables, theme colors or inherited styles. A color set by the theme is invisible to it.
- It does not reconcile numbers with the ledger, compare quotes, scan for names or look for banned visual tells. `check-process.js` covers the ledger, and the [scanner page](../scanner.md) lists the rest.
- It does not draw, so `render.js` is a stub.
- It has no fixtures beyond the tests in `tests/example/`. A real scanner needs one fixture per incident.
