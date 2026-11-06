# Visual craft for slides

The design standard behind every deck this process builds. The anti-tells in `bookshelf/preflight.md` enforce it. This file is the taste layer that decides what gets built in the first place.

Your design tokens file is the one style authority, for every deck. This file covers what you draw inside it.

## The stance

- Taste comes from practice. Hold each slide against real, shipped, professional work and keep other machine output out of the comparison. Small details add up: a viewer cannot name a misaligned baseline or a doubled margin, but they feel that nobody chose it.
- A design succeeds when the point lands faster. It fails the moment a viewer notices the design before the point.
- The first version is a draft. The one that lands is usually the third idea, which can take fewer than three renders. Show a rendered draft early and keep changing it. Review renders with fresh eyes, starting with a contact sheet and then looking closely at the slides that look suspect.
- Restraint is the default: one accent color that belongs to the subject, two typefaces at most, a quiet ground and no decoration. An element that carries no information comes off the slide. Your tokens file names the ground color, and the ground is never plain white.

## Typography that carries over to slides

- Tracking depends on size. Tighten large display text slightly and keep body text near zero. One letter-spacing for every size is wrong somewhere.
- Leading shrinks as size grows: tight on large headlines, looser on body and table text.
- Set rank with weight first, then size, and adjust leading to match. Reach for weight before color when you emphasize.
- Use one type scale in real numbers everywhere, and keep it short. A 16:9 deck runs four to six sizes. Sizes improvised per slide ("big, medium, small") are a tell, and nine steps between 7 and 11 points read as error. Your tokens file owns the count and the numbers. Adding a size means removing one, or raising the count with a written reason.

## Layout

- The eye lands on the most important element first, and everything else recedes. If a viewer cannot say what a slide is about within 5 to 10 seconds from across a room, the hierarchy failed.
- Proximity implies relationship, so place labels, legends and footnotes next to what they describe.
- Vary box sizes with importance. Identical rectangles say that none of them matters more.
- Dead space signals a content shortage. Fill it with content that earns its place, or give the slide a smaller canvas. Decoration is the wrong filler.
- Cut a row, and say which one, when a slide runs out of room. Shrinking type to rescue a fit makes a smaller problem for the reader.
- Cohesion beats novelty: the same chart style, the same table anatomy and the same source-line position on every slide. Borrow arrangements across slides and keep whole templates inside one deck.

## Choosing a representation

Pick the form per slide, for speed of comprehension. Each row names the form, and your drawing kit decides how it is built.

| The point is | Use |
|---|---|
| One fact that must land | A statement slide or a single large metric |
| A trend over time | A line chart with printed values, or vertical bars for a few periods |
| A ranking | Horizontal bars sorted by the story's key measure |
| Two series compared inside each group | Grouped bars, two to four series at most |
| How each row splits across the same parts | A 100 percent stacked bar, which keeps rows comparable and replaces pie and donut data |
| Entities against attributes, where the claim is a comparison | A shaded matrix, with the claim cells outlined and bold |
| The same rows in two states | A dumbbell for the gap, or a slope chart when the crossings are the story |
| Two magnitudes per row where the ratio is the claim | Paired bars with the values at the bar ends and a printed note for gaps of 2x and more |
| A range and where the middle sits | A range plot: a muted strip, a solid median dot, a round-numbered axis |
| Two or three trends on one scale | A multi-series line, or a grid of small multiples sharing one scale |
| Where a change came from | A waterfall, with the end computed from the steps |
| Two opposed magnitudes per row | Mirrored bars around a label column |
| Values the reader will look up by row | A table sorted by the key column, with the claim-carrying rows bold |
| Two dimensions argued in words | A 2x2 grid with all four quadrants labeled and populated |
| A sequence or dependency | A timeline or process, with every arrow starting and ending somewhere |
| A human voice | A quote block, verbatim and attributed |
| Positioning across players | A positioning map with labeled points, axes at the data midpoints and named quadrants |
| Items across several trailing windows | A momentum table: growth beside its own window's total, with a drawn arrow and a word |
| A zero or very small count that is the finding | One card holding the figure, its base and a coverage line, with up to three comparison rows |
| A score against what the comments say | A 2x2 of score against comment sentiment, with the two mismatch cells emphasized and the percent and N in every cell |
| The same themes in two windows around a dated change | A before and after table: both rates, the change in points and the N for each window |
| A path where each step keeps a share of the one before | A funnel with bars scaled to the first stage and the count and percent printed |
| How the work was built and what it leaves out | A method slide: one card of labeled rows that ends with what is not covered |

Draw shapes by default, because a scanner or a render can verify a drawn shape. A native chart object suits the case where the person will maintain the numbers in PowerPoint, and then it needs its own render check. Draw trends as lines with printed values.

Pie and donut charts stay out. The same data reads faster and compares across rows as a 100 percent stacked bar, and a lone donut is the most recognizable template tell there is.

A table is the right form when the reader needs to look up a value. When the point is a comparison, draw the comparison. Make that choice per slide, on the shape of the story. A deck whose evidence is table after table has stopped choosing.

**The focus rule** (preflight item 25 holds the testable threshold, so edit the two together). A reader may check every number that supports the claim. The few numbers that carry the claim must be findable in ten seconds, emphasized by weight, outline or shade while the rest recede. A grid where sixty numbers weigh the same points the eye nowhere, even when every number is right. Past about twenty numbers of equal weight, change the form: shade the matrix, draw the two states, or keep the lead comparison on the slide and move the full grid to the appendix. A shaded matrix with named claim cells meets the rule at any size.

The topic shows in the drawing. Cover the words, and the slide should still say what it is about. If only the title carries the meaning, the representation is wrong.

Chart orientation: horizontal bars compare unlike things (groups, programs, themes), vertical bars show change over time, a table serves lookups, and a line serves a true trend with enough points. Every chart carries headers on its axes or columns and a one-line method note under or beside the title (base, window, source), so it survives a screenshot out of the deck.
