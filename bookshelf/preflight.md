# Preflight: the build-time checklist and the anti-tells

Summary: the numbered checklist a builder builds to and a reviewer grades against, plus the list of visual tells that mark a deck as machine made.

The engine's scan cites these item numbers in its output, so the numbers stay put. An item that does not apply to a written answer (no slides) is marked N-A, never failed. Factual accuracy, quote integrity, legibility and honest verification cannot be waived.

## A. Structure and flow

1. Story order follows the requester's question. Their literal ask is answered first, then evidence narrows from widest scope to narrowest and never widens again. Voice evidence (quotes, reviews) is its own lane.
2. The headline is one claim, said the way you would say it out loud, and it is a finding, not a topic label. One setting owns its size, length and color:
   - Size: 29pt Poppins Bold across the 12.03in content measure.
   - The cap: one rendered line, measured with the bundled font (`deck_kit.measure_headline`). A second line is a disclosed exception (`content_slide(two_lines="reason")`, printed by scan check 2b). Three lines never.
   - Word budget: about 8 words, 55 characters. This is derived guidance and sits short of the cap. A longer headline that still fits one line is fine.
   - One color: ink. Check 2c fails a headline, cover title or divider title with a second text color.
   - Test: say it on a phone call with no slide visible. If it needs the slide, it fails.
   - Banned forms: method mechanics, a statistic used as an adjective, an internal construct as the actor, referents the reader cannot resolve yet.
3. Your framing, their vocabulary. Their taxonomy names the category, brand and metric. Their request text never ships: no run of eight or more consecutive words from the request appears anywhere in the deliverable, notes included (check 3, fixture `tests/request_text_never_ships_probes.py`). Private asides are never reproduced.
4. No "what this is not" section at the front. State what the deck covers. Limits belong on the method slide and the source lines.
5. Every slide answers five questions: why it exists, what question it answers, the one thing to remember, why it sits here, what is lost if it is cut.
6. Every appendix slide names the slide it defends. An appendix slide defending nothing is cut.
7. The default slide ends with its evidence, with no bottom takeaway line. An earned takeaway is one sentence that adds an implication the headline lacks. Deletion test: cover the bottom line; if nothing is lost, cut it. A sentence that fails is cut, not moved into a callout.
8. Read the headlines alone, top to bottom. They make a complete, non-repetitive argument.

## B. Scope and taxonomy

9. Every data slide carries a scope tag naming exactly what its numbers cover. On a kit deck it is the gray scope line under the headline.
10. Use the source's own names for categories, brands and products, spelled as the source spells them, accents included. The market on the source line is named exactly as the data names it.
11. One measurement basis per deliverable: one window, one growth metric, one provenance, stated on every source line. Use the full standard window the source offers and label the true length when less exists.
12. Where the requester named categories or examples, show their list and what the wider sweep found, or say on the method slide why you did not widen.
13. Nothing is dismissed as expected on prevalence alone. Show the response evidence too.
14. Use metrics the audience already reads. Introduce no bespoke metric as a labeled column.

## C. Numbers

15. Every percent change has its base on the same slide: the total the growth is measured on, printed beside it.
16. Unit tiers: at or above 1,000 million write billions with one decimal ("$8.1B"); millions below that ("$412M"); below 1M use K or full digits.
17. Index columns carry a stated threshold. Growth is sign-colored the same way everywhere. A decline is never in a positive color.
18. Provenance is honest. What a product claims, what it contains and what people say are different lanes, from the matching fields, never blended into one number.
19. Overlapping segments are labeled as overlapping and never shown as summing to a total.
20. A note explaining how a figure was built must itself reconcile. Do the arithmetic before printing it.
21. Every named grouping prints its definition: the field it comes from, the rule or list, and what it leaves out.
22. Check coverage before showing a dramatic segment. A segment that looks empty because its records are missing is a data artifact. 22b: a growth over 500 percent, or a base under 1 percent of the category total, carries a small-base mark (`small_base` on `trend_line`).
23. The deck lands at or under the agreed slide budget. Overflow moves to the appendix.
24. A slide carries at most about 120 words of prose and three evidence blocks. 24b: a key-takeaways slide holds two to six takeaways and at most 8 numbers in all.
25. Comparisons are drawn, not narrated. A block whose prose carries three or more numbers becomes a chart, table or KPI band. A reader finds the claim-carrying numbers within ten seconds. A shaded matrix with named claim cells passes at any size.
26. Body sentences cap at about 35 words. Re-check after any text sweep.

## D. Voice and quotes

27. Quotes are byte-exact with attribution (rating or engagement, platform, date). Truncation is marked with an ellipsis, misspellings stay and are noted "spelling as written". Protect quotes during any text sweep.
28. A voice section leads with a quantified language hierarchy over a stated N, with the quotes as support.
29. Causal wording only where the evidence supports it. Otherwise say "worth testing". 29b, safe wording: no like-for-like claims, no "nobody noticed", no swearing in quotes (censor it), no mocking of weak results, no "exotic" framing of foods, no line saying the work was machine made, a year on every named month, no retailer named as the data source in a source line or table header, and no username or handle in a quote.

## E. Design

30. No caps or tracked label above a headline or title. No eyebrow, no kicker.
31. Headers on every table and chart. Page numbers. A source line on every data slide naming the window and the source.
32. The visual system is your design tokens file, always. There is no per-deck style spec. A deck needing another look needs another process.
33. Run the anti-tells below on every rendered slide. A clean checklist passes builds that are still not good, so a taste pass sits on top of these checks.

## F. Process

34. Presented decks carry speaker notes on every content slide: a two or three sentence talk track, the definition behind any named grouping, and the hardest likely question with its answer.
35. Snapshot (copy and hash) the file before and after every edit round. If the person changed the file in between, their version is the new base.
36. The builder renders every slide and looks at it before anyone else does. Code that is correct can still draw badly.
37. Never keep two copies of the same sentence. Notes point at the deliverable for wording.
38. When a reviewer is right, remove the overreach instead of adding a qualifier. Cutting is verifiable. Adding needs its own verification.
39. Final audit on the actual final file: regenerate the mechanical checks and confirm every required judgment has a current independent verdict.

## G. Pictures, native tables and data notes (scanned)

40. Every picture and native table carries alt text of 10 or more characters. A picture is drawn at the aspect of its cropped source, within 1 percent. No text frame overlaps a picture. Checks 40a to 40c.
42. A `native_table` has the house form: the "No Style, No Grid" style id, header row on, banding off, no merged cell, no cell fill, no vertical rule, the hairline as the only border. Check 42a reads the XML.
43. Where a deck carries data notes (`deck_kit.finish_deck`), each slide that prints a chart or table has a marked block in its speaker notes that restates only what the slide prints. Checks 43a to 43c.

Item 41 is held free.

---

# The anti-tells (signs of machine-made design)

Numbering runs 1 to 34 and is separate from the checklist above. Cite "anti-tell 33" or "item 33", never a bare number.

**Color and type**
1. Exactly one accent color, used with discipline everywhere it appears.
2. The accent belongs to the subject, not to habit or a template.
3. Color on glyphs only, never a fill, tint or pill behind a word.
4. Never two accented phrases in one headline, and never a generic word ("in", "to") accented.
5. Never a purple-to-blue gradient. The one ground gradient is the only gradient a deck carries; any other fails.
6. Two typefaces at most. The kit uses one family.
7. One type scale in real numbers, and a short one: six sizes. Nine steps between 7 and 11 points read as error.
8. Monospace only for a string you type or an interface you draw.
9. Italic only where the borrowed world uses it, never as your emphasis.

**Things to delete**
10. A colored strip down a card edge (top, left, right or bottom).
11. Emoji standing in for drawn icons.
12. The loop arrow.
13. A motivational band across the bottom. End on the last real row.
14. A bar or meter with no real quantity behind it, including a bar with a minimum width that betrays the scale, and zero drawn as a bar.
15. Stock imagery clichés.

**Layout**
16. Every row of a dense list fits one line.
17. Text evenly weighted: no orphan word on a last line, no hard break doing the wrapping.
18. Dead space is a content shortage, not a layout fault.
19. One full sentence per cell, or the cell reads half empty.
20. A device (arrow, flow, connector) starts somewhere and ends somewhere.
21. Arrowheads meet their line, and the line meets the box it points at.
22. The topic is visible in the drawing, and the title is not the only place it shows.
23. Never reduce type size to rescue a fit. Cut a row and say which.
24. Vary box sizes. Identical rectangles say none matters more.

**What matters most**
25. Nobody reads small text at a glance. They read the shape.
26. A clean checklist passes a build that is still not good.
27. Never ship the first version.
28. Multiple variants means multiple ideas, not one layout recolored.
29. One template reused for everybody makes yours look like theirs.
30. A wall of undifferentiated numbers: a grid where no cell is emphasized and the headline's own numbers hide among dozens of equal ones.
31. Representation monotony: a deck whose evidence is mostly numeric tables when the claims are comparisons.
32. The ritual takeaway strip: every slide ending in small-print insight sentences that restate the headline.
33. Repeated decoration: a brand element carrying no information, repeated on every slide. Deletion test: remove it, and if nothing a reader needs is lost, it goes.
34. A number beside a number: an ordinal label ("1.", "01") next to a stat, so "59" and "1." read as one figure. A stat card carries one number. The kit refuses the layout and scan Tell 34 fails it.
