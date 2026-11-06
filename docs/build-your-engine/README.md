# Build your own engine

Carousel OS ships the process: the rules, the nine stage commands, the plan, the claim ledger, a reviewer with fresh context, and memory with a lessons loop. It does not ship an engine. This guide tells you how to build one for your own brand, and how to build the agent system around it, so the decks it produces hold up to a skeptical reader and look like someone chose every element.

I built my own engine over two months and 27 releases, and recorded 40 incidents along the way. Every rule in these pages came out of one of them. I have stripped out the brand, the clients and the specific values, and kept the principle and the failure that made it necessary.

## What an engine is

An engine is the part that draws the deck and the part that checks it. It has two halves:

- **A drawing kit.** Code that turns "a ranked bar chart of these six rows, emphasize row two" into shapes on a slide, using only the colors, sizes and layouts your design system allows. See [drawing-kit.md](drawing-kit.md).
- **A scanner.** Code that opens a finished deck file and measures it: headline length, contrast, type sizes, numbers without a base, names that should not be there. See [scanner.md](scanner.md).

Most teams also add a renderer that draws each slide to an image, so a reviewer can look at pixels without opening PowerPoint.

## Why the process needs one

The process runs without an engine. `carousel-check` falls back to a rubric path, where an agent reads the deck and answers ten checklist items by inspection. That works, and it has two weak spots.

- **Judgment drifts.** An agent asked "is every type size on the scale?" will look and say yes. A script that counts the sizes in the file will find the ninth one. Most of the defects my system shipped lived in the gap between what a file declared and what the code actually drew, and counting is what closed that gap.
- **Strong models get spent on cheap work.** Finding an em dash or a missing source line is a grep. Paying a reviewer model to read slide images for it wastes the review on what a script does for free, and leaves less attention for whether the argument holds.

With an engine, the mechanical checks close themselves and the reviewers spend their pass on judgment.

## How it plugs into Carousel OS

The process talks to your engine through commands it can run and exit codes it can record.

1. Register your commands in `carousel.config.json` at the project root: at minimum a scan command and a render command, each taking the deck path and an output folder. `commands/carousel-check.md` is the authority on which keys it reads and how it calls them.
2. `carousel-check` runs each registered command, records its exit code (0 is PASS, 1 is FAIL, 2 means the tool or its runtime is missing) and pastes the last line of its output into the plan.
3. The check also records a hash of the deck and the ledger, so the result binds to one exact version of the file.

Your engine's contract with the process is therefore small:

- [ ] Every tool takes a file path and an output folder, and writes its report there.
- [ ] Every tool exits 0, 1 or 2 with those meanings, and nothing else.
- [ ] The last line of output is a one-line summary a human can read ("scan: 0 FAIL, 3 CANDIDATE, 41 PASS").
- [ ] No tool edits the deck. Measuring and fixing stay apart, so the record shows what was found before anyone changed it.

## Build order

Start small. The order below gets you value from the first afternoon and never asks you to build something before the thing it depends on.

1. **Design tokens.** Write your palette, type scale and layout grid as code constants in one module, with each color named by its role. Nothing else can be checked until these exist. See [design-system.md](design-system.md).
2. **A scanner with five checks.** Headline length, type sizes off the scale, colors off the palette, text contrast, and a percentage with no base beside it. These catch the most common failures and need nothing but the deck file and your tokens.
3. **A few drawing components.** A content slide with the header and footer, a card, a table, a ranked bar chart. Make each one refuse inputs it cannot draw well.
4. **A renderer.** Even an approximate one. A reviewer who never sees pixels misses overlap, clipping and dead space.
5. **A golden gallery.** One deck with one example of every component, its per-slide digests pinned, so a change to the kit shows up as a diff. See [rigor.md](rigor.md).
6. **The agent roles.** Once the kit and scanner exist, split the work across a builder and reviewers with fresh context. See [agent-system.md](agent-system.md).

## The files in this guide

| File | What it covers |
|---|---|
| [design-system.md](design-system.md) | Color roles and budgets, the type scale, layout, components, chart rules, bans, and the budget census |
| [drawing-kit.md](drawing-kit.md) | How the kit should behave: refusals, fit guards, label contrast, de-collision, deterministic saves, data in the file |
| [scanner.md](scanner.md) | The families of checks a scanner needs, what each catches, and the PASS, FAIL and CANDIDATE levels |
| [agent-system.md](agent-system.md) | The roles, fresh context, model routing, gates, job tiers, the brief, the knowledge layer and connectors |
| [rigor.md](rigor.md) | Release discipline: incidents become tests, mutation testing, the golden gallery, leak scans, and the lessons behind them |

For pictures of slides my own engine drew, see [docs/gallery/](../gallery/).

## Minimum version

- [ ] One module of design tokens: palette by role, a type scale of six sizes or fewer, margins and a content region.
- [ ] A scanner with the five checks in step 2, exiting 0, 1 or 2.
- [ ] A content slide component and one chart component that use only the tokens.
- [ ] A scan command and a render command registered in `carousel.config.json`.
- [ ] One run of `carousel-check` on a real deck, with the result lines pasted into the plan.
