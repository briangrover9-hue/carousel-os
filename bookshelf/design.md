# Visual craft for slides

The design standard behind every deck this process builds. The anti-tells checklist in `bookshelf/preflight.md` is the enforcement layer; this file is the taste layer that decides what gets built in the first place.

The SYSTEM is not decided here and is not decided per deck: your design tokens file is the one style authority, and your engine reads it from one place. This file governs what you draw inside it.

## The stance

- Taste is trained, not innate: hold every slide against real, shipped, professional work, not against other AI output. Unseen details compound; a viewer cannot name the misaligned baseline or the doubled margin, but they feel that nobody chose it.
- Design succeeds when the point lands faster, and fails the moment a viewer notices the design instead of the point.
- Never settle for the first version. The one that lands is usually the third idea, not the third render. This is about ideas, not about when the user first sees a file: the rendered version 1 goes out early and keeps changing. Review renders with fresh eyes (a montage pass first, then per-slide inspection of suspects).
- Restraint is the default: one accent color that belongs to the subject, two typefaces maximum, a quiet ground, no decoration of any kind. If an element does not carry information, it comes off the slide. The ground is warm paper `#FAF8F4`, owned by your design tokens file, never white.

## Typography rules that transfer to slides

- Tracking is size-specific: tighten large display text slightly (negative tracking), keep body near zero. One fixed letter-spacing for all sizes is wrong somewhere.
- Leading tracks size inversely: tight on large headlines, looser on body and table text.
- Build hierarchy from weight + size + leading as a set, not size alone; emphasize with weight before color.
- One type scale in real numbers, applied everywhere; "big, medium, small" improvised per slide is a tell. SHORT is part of it: a professional deck on a 16:9 canvas runs four to six sizes, and nine steps between 7 and 11 points read as error rather than hierarchy. your design tokens file owns the count, holds the numbers, and carries the rule that an addition removes one or raises the count with a written reason.

## Layout rules

- The eye must land on the most important element first; everything else recedes. If a viewer cannot say what a slide is about in 5-10 seconds from across a room, the hierarchy failed.
- Proximity implies relationship: place labels, legends, and footnotes near what they describe.
- Vary panel and box sizes with importance; identical rectangles say none of them matters more.
- Dead space is a content shortage: fill it with content that earns its place or cut the slide's canvas usage down, never pad it with decoration.
- Never shrink type to rescue a fit; cut a row instead and say which one you cut.
- Cohesion beats novelty: the same chart style, the same table anatomy, the same source-line position on every slide. Borrow arrangements across slides, never whole templates across decks.

## Representation choice (pick per slide, for speed of comprehension)

| The point is... | Use |
|---|---|
| One fact that must land | Statement slide or single metric |
| A trend over time | Trend line (`trend_line`), or vertical bars for few periods |
| A ranking | Bars sorted by the story's key measure |
| Two series compared within each category (this year vs last across channels) | Grouped bars (`grouped_bars`), 2-4 series maximum |
| How each row splits across the same parts (occasions, sentiment, organic vs promoted) | 100% composition bar (`stacked_bar100`); this is the house form for pie and donut data, because rows stay comparable |
| Entities x attributes, where the claim is a comparison | Shaded matrix (`heatmap`): shading carries the picture, the claim cells outlined and bold |
| The same rows in two states (claim vs review, before vs after, two seasons) | Dumbbell (`dumbbell`) for the gap; slope chart (`slope`) when the CROSSINGS are the story ("trade places") |
| Two magnitudes per row where the RATIO is the claim (A dwarfs B everywhere) | Paired bars (`paired_bars`), values at the bar ends and an automatic 'NX GAP' note at 2x and up |
| A range and where the middle sits (p25-p75 and the median, min-max and a mean) | Range-dot plot (`range_dot`): a muted strip, a solid median dot, a round-numbered axis |
| Two or three trends compared on one scale (work vs non-work, this year vs last) | Multi-series line (`lines`); compose a grid of them for small multiples, one shared scale format |
| Where a change came from (growth decomposition, bridge to a total) | Waterfall (`waterfall`): the additive story drawn, the end computed from the steps |
| Two opposed magnitudes per row (complaints vs praise) | Butterfly (`butterfly`), mirrored around the label column |
| Values the reader will look up by row | Table, sorted by the story's key column, with the claim-carrying rows bold (`emphasis_rows`) |
| Two dimensions argued in words (effort vs impact, now vs later) | 2x2 card grid (compose from `panel`), all four quadrants labeled and populated |
| A sequence or dependency | Timeline or process, every arrow starting and ending somewhere |
| A human voice | Quote block, verbatim, attributed |
| Positioning across players | Positioning map (`quadrant`): labeled points, axes at the data midpoints, quadrants named |
| Items across several trailing windows with a direction of travel (52, 26 and 13 weeks) | Momentum table (`momentum_table`): growth beside its own window's sales, a drawn arrow and a word |
| Items placed on a curve by stage (emerging to mainstream) | Adoption stages (`adoption_stages`): one card per stage, each with its definition, size and growth printed |
| A zero or very small count that IS the finding | Big zero (`big_zero`): the figure, its base and a coverage line on one card, with up to three `support` comparison rows so the slide carries its evidence |
| Star rating against what the text says | Stars against text (`stars_vs_text`): a 2x2, the two mismatch cells emphasized, percentage and N in every cell |
| The same themes in two windows around a dated change | Before and after (`before_after`): rate, rate, change in points and N for each window; refuses a thin base |
| A path where each step keeps a share of the one before | Funnel (`journey_funnel`): bars scaled to the first stage, count and percent of the first printed |
| How the work was built and what it does not cover | Method slide (`method_slide`): one card of labeled rows ending in "Not here" |

Every row above names its drawn (shape-based) form, which is the default because only drawn forms are pixel-verified by the QA renderer. For the column, bar and 100% stacked families, `native_chart` builds the same picture as a REAL PowerPoint chart object with an editable data sheet; take it when the client will maintain the numbers in PowerPoint, and give that slide the LibreOffice PDF check the builder contract requires. A trend always draws with `lines` or `trend_line`, which print their values: `native_chart` has no line kind.

Pie and donut charts are deliberately absent: the same data reads faster and stays comparable across rows as a 100% composition bar, and a lone donut is the most recognizable template tell there is.

A table is the right form only when the reader needs to LOOK UP a value; when the point is a comparison, draw the comparison. This is the choice that decides whether a slide tells its story or merely stores its data, so make it per slide, on the story's shape, never by defaulting to whatever form the last slide used. A deck whose evidence is table after table has stopped choosing.

**The focus rule** (its testable thresholds are mirrored in preflight item 25, the rubric copy; edit the two together). Every number a reader needs to check the claim may stay, and the few numbers that CARRY the claim must be findable in ten seconds: emphasized by weight, outline, or shade while the rest recede. A grid where sixty numbers all weigh the same points the eye nowhere, and it fails even when every number is right. Past roughly twenty undifferentiated numbers, change form: shade the matrix, draw the two states, or keep the lead comparison on the slide and move the full grid to the appendix. Undifferentiated means neither emphasized nor shade-encoded; a shaded matrix with named claim cells satisfies the rule at any cell count.

The topic must be visible in the drawing: cover the words and the slide should still say what it is about. If only the title carries the meaning, the representation is wrong.

Chart-orientation rule: horizontal bars for comparing unlike things (categories, brands, themes), vertical bars for change over time, a table when the reader needs to look up per-row values, a line only for genuine trends with enough points. Every chart carries headers on its axes/columns, and a one-line method note under or beside the title (base, window, source) so the chart survives being screenshotted out of the deck.
