# The design system, as code

A deck design system is a small set of decisions that every slide inherits: which colors mean what, which sizes text may take, where things sit, and which drawing forms exist. Write it as code constants in one module. A system kept in a style document drifts from what the code draws, and the drift is where defects live.

The principle behind every number here: contrast should come from structure and color more than from size. A headline that is one level of a header stack, over cards on a tinted ground with sign-colored data, reads stronger than a much larger headline alone on a white field. You enlarge the headline because the slide looks weak, and the slide looks worse.

## Color roles and budgets

Give each color a role and a budget, and keep the budgets separate. Chrome wants the fewest values a reader can tell apart. A data ramp wants enough distinct values to separate series. A shaded matrix wants one hue in a few fixed steps. Squeeze the ramp into the chrome budget and two series in a chart draw in one fill.

- [ ] **Core palette.** The only values allowed on text, chrome, containers and single-series data: white, ink, a secondary text gray, a hairline, a panel wash, one accent fill and one decline fill. Aim for under ten.
- [ ] **Sign colors with text partners.** Growth and decline each get a fill and a darker text partner. Fills that work as wide bars usually fail 4.5:1 as small text, so text in a sign color takes the partner. Split by role (fill or text), never by element size, so one stat never shows two shades of one green.
- [ ] **A series ramp with a fixed order.** Three or four values, used in the same order on every slide, so a series keeps one color across the deck. One series in two colors makes the reader learn two keys.
- [ ] **Light partners for de-emphasis.** Each data hue gets one derived light partner, computed by a single rule (move lightness toward the ground, scale chroma down, hold hue). A non-claim mark takes the partner. Derive it in code; a partner chosen at the call site is a second decision nobody reviews.
- [ ] **Line partners for thin marks.** A color that works as a bar can fall under the 3:1 non-text floor as a two-point line or a small marker. Give those hues a darker partner for lines, markers and their legend swatches only.
- [ ] **One scoped neutral.** If you need a neutral fill (the middle segment of a sentiment bar), register it for that job alone and make the kit refuse it anywhere else.
- [ ] **Heatmap steps.** Five fixed steps per hue instead of a continuous blend, so one shade reads as one value on every slide.
- [ ] **One ground.** One background for the whole deck, cover and dividers included. A dark divider among light slides reads as two systems.

**A color means one thing.** If the accent is also the growth sign, it never decorates. Gray is for rules and secondary text, so a bar carrying a claim value is never gray, because a gray claim bar nearly disappears.

**Measure contrast on every background stop.** If your ground is a gradient, measure every text color against every stop and against white. Importers flatten gradients to one stop, and the deck still has to read. Use WCAG 2: 4.5:1 for text, 3:1 for graphics. If you accept a value below the floor, name it in code as a narrow exemption and print the value on every mark that uses it.

## Type

- [ ] **A small fixed budget of sizes, each with a role.** Six sizes is enough on a 16:9 canvas: display, headline, stat, lead, body, micro. Every new component tempts you to add a size, and a dozen close sizes read as error.
- [ ] **Sizes live in one machine-read declaration.** Scripts read the scale from one line and nowhere else. A size named in prose can be mistaken for a declared size, so only the one declaration counts.
- [ ] **Stroke weights are separate constants.** A hairline and a caption are not two steps of one hierarchy.
- [ ] **Two typefaces at most.** A third reads as a template.

**Headline rules.** One color, because color is for data and a second color in a sentence competes with the chart. One rendered line as the target, with a second line allowed only as a stated exception the scanner prints. A claim the reader can disagree with ("Skip rates doubled on the annual plan"), never a label ("Skip rates by plan").

**Density caps.** Cap prose per slide (around 120 words), sentences (around 35 words), and undifferentiated numbers (around 20 before you change form). Without a number cap, builders escaping a prose cap pour everything into tables, and a slide with sixty equal numbers says nothing.

## Layout

- [ ] **Canvas and margins** as constants, with one content region every component stays inside.
- [ ] **A grid** of column widths that cards and charts snap to.
- [ ] **A header stack:** headline (the claim), a scope line under it (population, window, base, in gray sentence case), an optional subhead for method. Splitting the jobs is what lets the headline stay small.
- [ ] **A footer:** one canonical source line per deck naming the data system, population and window, pasted verbatim on every data slide, plus the page number on one baseline.
- [ ] **One gap after every container,** one corner radius, one card surface, one chart baseline. Two charts at the same height must share a baseline.
- [ ] **Containers side by side share a top and a bottom.** The lighter one spreads its content through the height. Padding it with filler is the opposite failure.

Why: readers judge a deck by what stays the same from slide to slide, and one grid, one gap and one baseline make the sameness visible.

## Components

Keep an inventory and a ceiling. A component is a drawing form a builder chooses between; primitives such as text boxes and rectangles are uncapped.

| Component | Use when |
|---|---|
| Card | Every chart, table and stat group needs a container |
| Table | The reader will look up a value by row |
| Stat card | One number must land, with its base and caption |
| Quote | A human voice, verbatim and attributed |
| Ranked bars | Comparing unlike things |
| Columns or a line | Change over time |
| 100% bar | How each row splits across the same parts (use this for pie data) |
| Dumbbell or slope | The same rows in two states |
| Shaded matrix | Entities against attributes, where the claim is a comparison |
| Waterfall | Where a change came from |
| Spaced list | Items in order, with no bullet glyphs |

Choose the form per slide from the shape of the claim. A table stores data; a comparison should be drawn. A deck whose evidence is table after table has stopped choosing.

## Chart rules

- [ ] **Series order is fixed** and every legend lists series in drawing order.
- [ ] **Emphasize by fading the rest.** The claim series keeps its full color; the others take their light partners and keep their identity.
- [ ] **Value labels sit on the marks,** in ink, on every mark. A pale mark never carries its number alone.
- [ ] **No decorative marks.** A bar or meter with no quantity behind it goes. So does a zero drawn as a bar.
- [ ] **Drawn shapes or native charts.** Shapes drawn by the kit render the same everywhere and can be measured by your renderer. Native chart objects keep an editable data sheet but render differently across apps and need a PDF export to verify. Default to drawn; use native when the client will maintain the numbers, and verify it.

Why: a reader decides within seconds which series carries the claim, and the chart has to say so without a trip to the legend.

## Bans

These four visual bans apply on every slide and override any template.

- [ ] No rails: no colored stripe or band across the top or bottom of a slide.
- [ ] No eyebrows: no small caps or tracked label above a headline. Context goes in the headline or the scope line under it.
- [ ] No colored edge stripes on cards. A card is a hairline border or a soft fill.
- [ ] No decorative bars, dot rows or marks with no data behind them.

The test for decoration: delete it. If a reader lost nothing, it was decoration.

The fit rule sits beside the bans: never shrink type to fit a slide. Cut a row and say which.

Why: a reader spends attention on every mark, so a mark that carries no information costs attention and returns nothing.

## The budget census

Count what the built file holds, because a spec can declare things that never reach the file. Build a reference deck that exercises every component, open the saved file, and count every type size, fill, text color and component. Fail when a count passes its budget. A counter that reads the declaration list measures the list.

Pair it with a rule: nothing enters a budget unless something leaves, or the budget's number rises in the same edit with a written reason.

## Restyling

Put every brand value in one module. Restyling means changing that module, the logo files and the style document, then rebuilding the gallery and the census. If restyling touches component code, a value has leaked out of the module.

## Minimum version

- [ ] Palette by role: ink, secondary gray, hairline, ground, one accent, growth and decline fills with text partners.
- [ ] Six type sizes or fewer, declared once, read by code.
- [ ] Contrast measured for every text color on every background stop.
- [ ] Margins, a content region, a header stack and a source line.
- [ ] The four visual bans and the fit rule written into the kit.
- [ ] A census that counts sizes and colors in a built file.
