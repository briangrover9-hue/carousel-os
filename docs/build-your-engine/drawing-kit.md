# The drawing kit

The kit is the code a builder calls to put things on a slide. Its job is to make the right slide easy and the wrong slide impossible. Every rule below exists because a kit that drew whatever it was asked produced a defect that only showed up later, in a render or in front of a client.

## Refuse instead of drawing wrong

When a call asks for something off the system, raise an error that names the problem and the fix. Do not draw it and hope a reviewer notices.

- [ ] Refuse a type size that is not on the scale. The kit should draw no text at a bare number; every size comes from a named constant.
- [ ] Refuse a color outside the palette, a gray claim bar, and a sign color used as a series color.
- [ ] Refuse a headline in two colors, an eyebrow argument, and a numbered label beside a stat.
- [ ] Refuse a percentage with no base, a quote with no attribution, and a grouping label with no definition.
- [ ] Refuse a chart form that cannot show the data honestly (negative values in a form that cannot draw them, too many series for the ramp).

Why: a refusal reports to whoever wrote the line, at the moment they wrote it. A warning in a report reaches a reviewer days later, if it is read at all.

Give the refusal a way out where one is legitimate. A deck may need a darker partner for one hue, or a larger body size for a reader who needs it. It registers the change through a named function that requires a written reason and replaces the default, so the deck never mixes two values. Every scan then discloses the override. Give test harnesses a separate escape hatch for building deliberately bad decks, and make it record every refusal it suspended.

**Guard at import, too.** Some defects can be reintroduced in one line: a neutral aliased to an accent, a budget that grew. Check those when the kit loads and refuse to load. A test watches for the defect when someone runs it; an import guard stops the line from running at all.

## Fit guards that measure

Text fit is the most common visual defect, and estimating it by character count is wrong often enough to matter.

- [ ] Measure text with the real font file at the size you will draw, including tracking.
- [ ] Count rendered lines. A guard that caps width and never counts lines lets a long table label wrap and print over the next row.
- [ ] Measure every text cell in a table, header included.
- [ ] Balance line breaks on titles and quotes so no word sits alone on the last line, measured at the drawn tracking so the break you plan is the break that renders.
- [ ] Refuse a headline that wraps past its cap instead of shrinking it.
- [ ] Bundle the font with the kit and check whether the host has it. A machine without the face substitutes another, and your measured fits no longer hold.

## Label contrast per fill

A label inside a mark (a stacked segment, a heatmap cell, a bar) must be readable on that fill.

- [ ] Choose ink or white by measured WCAG contrast against the actual fill, per label.
- [ ] Refuse the label if neither reaches 4.5:1, unless the fill is a named, accepted exemption.
- [ ] Apply the same function to every form that puts text on a fill, drawn and native alike. A fix that reaches the drawn bar and misses the native one still ships an unreadable label.

## De-collision with floors

Labels collide: line endpoints that end near each other, scatter points, short bars with outboard values.

- [ ] Nudge colliding labels apart with a minimum gap.
- [ ] Set a floor: when the labels cannot be separated without leaving their marks, refuse the chart and say why. Thinning category labels evenly is fine; keep the first and last.
- [ ] Keep the lowest plotted point above the axis by at least one line of text, so it never reads as zero.

## Deterministic saves

The same inputs should produce the same bytes.

- [ ] Fix every timestamp, revision number and generated ID in the saved file.
- [ ] Strip theme style references the library adds to shapes by default. A library may attach an effect reference to every shape, and one renderer draws it as a drop shadow under every table row.
- [ ] Size logos and images from their own aspect ratio, and never stretch one to fill a box.

Why: per-slide hashes are how review verdicts carry over between rounds, and how the golden gallery detects change. Noise in the bytes voids every verdict and hides real diffs.

## Data travels with the deck

A chart is a picture of numbers. Someone will ask for the numbers.

- [ ] Have each chart and table component record the values it drew.
- [ ] At save time, write them into the speaker notes of the slide as a plain table, or into a sidecar file next to the deck, or both.
- [ ] Recording must change nothing the component draws. Test that a deck built with and without recording is identical on the slides.
- [ ] Keep request text and private notes out of speaker notes. Notes ship inside the file and get read aloud.

## Cache invalidation

If you hash slides to reuse review verdicts, the hash must cover everything the slide inherits.

- [ ] Include the master, the layout, theme fonts, canvas size and inherited images in each slide's hash.
- [ ] Exclude what legitimately changes without changing the slide (page numbers, a save and reopen).
- [ ] Test both directions: an inherited change must change the hash, and a resave must not.

A hash that covered only the slide's own shapes would let a changed theme carry yesterday's PASS.

## A template generated from the kit

Teams want a template file to work in by hand. If someone draws it separately, it drifts from the kit within a release.

- [ ] Generate the template from the kit's own constants and components.
- [ ] Commit a manifest of what it contains, and add a `--check` mode that rebuilds it and fails if the committed file differs.
- [ ] Put the template's version in the file, so a stale copy is visible.

## Docstrings are the contract

Each component's docstring states its arguments, what it refuses and when it raises. Builders read the docstring before calling. When the contract changes, edit the docstring, and let other documents point to it, so the contract lives in one place.

## Minimum version

- [ ] Every size and color comes from a named constant; the kit raises on anything else.
- [ ] Text measured with the real font, with line counts checked.
- [ ] Label color chosen by measured contrast on each fill.
- [ ] Fixed timestamps and IDs, so a rebuild produces identical bytes.
- [ ] Chart values written to speaker notes.
- [ ] A template built from the kit, with a check that it matches.
