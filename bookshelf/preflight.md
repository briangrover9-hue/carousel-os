# Preflight: the build-time checklist and the anti-tells

Summary: a numbered checklist for the person or agent building a deck and for the reviewer grading it, plus a list of visual tells that mark a deck as machine made.

Each item ends with a tag that says how it can be checked.

- (read) Answerable by reading the deck text, the ledger and the Build table.
- (render) Needs a rendered image of the slide, from an export or your engine's renderer.
- (scan) Needs a measurement a person cannot make by eye, such as a contrast ratio or a count of type sizes. Your own scanner answers it. Without one, leave it out of the rubric path and say so.

`carousel-check` on the rubric path asks only for items tagged read or render. An item that does not apply to a written answer with no slides is marked N-A. Factual accuracy, quote integrity, legibility and honest verification cannot be waived.

## A. Structure and flow

1. Story order follows the requester's question. Their literal ask is answered first, then evidence narrows from widest scope to narrowest and stays narrow. Voice evidence (quotes, survey comments, support tickets) is its own lane. (read)
2. The headline is one claim, said the way you would say it out loud, and it is a finding with a subject and a verb. (read)
   - Test: say it on a phone call with no slide visible. If it needs the slide, rewrite it.
   - Length: it fits on one rendered line at the size your design tokens set. About 8 words is a good target. A second line needs a stated reason, and three lines is too many. (render)
   - Color: one text color for every headline and title. (scan)
   - Avoid method mechanics, a statistic used as an adjective, an internal construct as the actor, and referents the reader cannot resolve yet.
3. Use your framing and the requester's vocabulary. Their taxonomy names the segment, program and metric. Their request text never ships: no run of eight or more consecutive words from the request appears anywhere in the deck, notes included. Private asides are never reproduced. (read)
4. The front of the deck states what it covers. A "what this is not" section waits for the method slide and the source lines. (read)
5. Every slide answers five questions: why it exists, what question it answers, the one thing to remember, why it sits here, and what is lost if it is cut. (read)
6. Every appendix slide names the slide it defends. An appendix slide that defends nothing is cut. (read)
7. A slide ends with its evidence. An earned takeaway line is one sentence that adds an implication the headline lacks. Deletion test: cover the bottom line, and if nothing is lost, cut it. (read)
8. The headlines read alone, top to bottom, make a complete argument without repeating each other. (read)

## B. Scope and taxonomy

9. Every data slide carries a scope tag that names exactly what its numbers cover. (read)
10. Segments, programs and plans use the source's own names, spelled as the source spells them, accents included. The population on the source line is named exactly as the data names it. (read)
11. One measurement basis per deck: one window, one growth metric, one provenance, stated on every source line. Use the full standard window the source offers, and label the true length when less exists. (read)
12. Where the requester named segments or examples, show their list and what the wider sweep found, or say on the method slide why you did not widen. (read)
13. A finding is never dismissed as expected on prevalence alone. Show the response evidence too. (read)
14. Use metrics the audience already reads. A metric you made up does not become a labeled column. (read)

## C. Numbers

15. Every percent change has its base on the same slide: the total the growth is measured on, printed beside it. (read)
16. Unit tiers are fixed for the deck: at or above 1,000 million write billions with one decimal ("$2.3B"), write millions below that ("$146M"), and write K or full digits below 1M. (read)
17. An index column carries a stated threshold. Growth takes the same sign color everywhere, and a decline never takes a positive color. (render)
18. Provenance stays honest. What a service promises, what its logs record and what people say about it are different lanes, built from matching fields and never blended into one number. (read)
19. Overlapping segments are labeled as overlapping and never shown as summing to a total. (read)
20. A note that explains how a figure was built must reconcile itself. Do the arithmetic before printing it. (read)
21. Every named grouping prints its definition: the field it comes from, the rule or list, and what it leaves out. (read)
22. Check coverage before showing a dramatic segment, because a segment that looks empty may be missing records. A growth above 500 percent, or a base under 1 percent of the whole population, carries a small-base mark. (read)
23. The deck lands at or under the agreed slide budget. Overflow moves to the appendix. (read)
24. A slide carries at most about 120 words of prose and three evidence blocks. A key-takeaways slide holds two to six takeaways and at most eight numbers in all. (read)
25. Draw comparisons instead of narrating them. A block whose prose carries three or more numbers becomes a chart, a table or a KPI band. A reader finds the numbers that carry the claim within ten seconds. Past about twenty numbers of equal weight on one slide, emphasize the few that matter or shade the grid. (render)
26. Body sentences run to about 35 words at most. Check again after any text sweep. (read)

## D. Voice and quotes

27. Quotes are byte-exact with attribution (source, score or engagement, date). A truncation gets an ellipsis, and a misspelling stays with the note "spelling as written". Protect quotes during any text sweep. (read)
28. A voice section leads with a quantified language hierarchy over a stated N, with the quotes as support. (read)
29. Causal wording needs causal evidence. Otherwise write "worth testing". (read)
30. Safe wording: no like-for-like claims, no "nobody noticed", no mocking of weak results and no "exotic" framing of a place or culture. Censor swearing in quotes, and keep usernames and handles out of them. Put a year on every named month. No line says the work was machine made, and no source line or table header names a partner or vendor as the data source. (read)

## E. Design

31. No caps or tracked label sits above a headline or title. No eyebrow, no kicker. (render)
32. Every table and chart has headers. Every slide has a page number. Every data slide has a source line that names the window and the source. (render)
33. The visual system is your design tokens file. There is no per-deck style spec, and a deck that needs another look needs another process. (scan)
34. Run the anti-tells below on every rendered slide. A clean checklist passes decks that are still weak, so a taste pass sits on top. (render)

## F. Process

35. A presented deck carries speaker notes on every content slide: a two or three sentence talk track, the definition behind any named grouping, and the hardest likely question with its answer. (read)
36. Copy and hash the file before and after every edit round. If the person changed the file in between, their version is the new base. (read)
37. The builder renders every slide and looks at it before anyone else does. Code that is correct can still draw badly. (render)
38. Keep one copy of each sentence. Speaker notes point at the deck for wording. (read)
39. When a reviewer is right, remove the overreach instead of adding a qualifier. Cutting is verifiable, and adding needs its own verification. (read)
40. The final audit runs on the actual final file. Regenerate the mechanical checks and confirm that every judgment has a current independent verdict. (read)

## G. Pictures, tables and data notes

41. Every picture and native table carries alt text of 10 or more characters. A picture is drawn at the aspect of its cropped source, within 1 percent, and no text frame overlaps it. (scan)
42. A native table is plain: a header row, no banding, no merged cell, no cell fill, no vertical rule, and a hairline as the only border. (scan)
43. Where a deck carries data notes, each slide that prints a chart or table has a marked block in its speaker notes that restates only what the slide prints. (scan)

---

# The anti-tells (signs of machine-made design)

The numbering runs 1 to 34 and is separate from the checklist above. Cite "anti-tell 33" or "item 33", never a bare number. Each tell is answered by looking at a rendered slide unless it is tagged (scan).

**Color and type**
1. One accent color, used with discipline everywhere it appears.
2. The accent belongs to the subject of the deck, and a habit or a template does not choose it.
3. Color sits on glyphs only. No fill, tint or pill behind a word.
4. No headline carries two accented phrases, and no generic word ("in", "to") takes the accent.
5. No purple-to-blue gradient. The ground may carry one gradient, and any other gradient is a fail.
6. Two typefaces at most. A deck with one family is stronger. (scan)
7. One type scale in real numbers, and a short one of six sizes at most. Nine steps between 7 and 11 points read as error. (scan)
8. Monospace marks a string you type or an interface you draw, and nothing else.
9. Italic appears only where the world it borrows from uses it, and never as your own emphasis.

**Things to delete**
10. A colored strip down a card edge, whether top, left, right or bottom.
11. Emoji standing in for drawn icons.
12. The loop arrow.
13. A motivational band across the bottom. End on the last real row.
14. A bar or meter with no real quantity behind it. That includes a bar with a minimum width that distorts the scale, and zero drawn as a bar.
15. Stock imagery clichés.

**Layout**
16. Every row of a dense list fits on one line.
17. Text is evenly weighted: no orphan word on a last line, and no hard break doing the wrapping.
18. Dead space signals a content shortage and is rarely a layout fault. Add content that earns its place or shrink the canvas use.
19. One full sentence per cell, so no cell reads half empty.
20. A device such as an arrow, a flow or a connector starts somewhere and ends somewhere.
21. Arrowheads meet their line, and the line meets the box it points at.
22. The topic shows in the drawing, and the title is one place among several where it appears.
23. Cut a row and say which one you cut. Shrinking type to rescue a fit is the wrong repair.
24. Vary box sizes. Identical rectangles say that no box matters more.

**What matters most**
25. Nobody reads small text at a glance. They read the shape.
26. A clean checklist passes a build that is still weak.
27. The first version is a draft. Keep going until the slide earns its place.
28. Several variants mean several ideas. One layout recolored is a single idea.
29. A template reused for everybody makes your deck look like theirs.
30. A wall of undifferentiated numbers: a grid where no cell is emphasized and the headline's own numbers hide among dozens of equal ones.
31. Representation monotony: a deck whose evidence is mostly numeric tables when the claims are comparisons.
32. The ritual takeaway strip: every slide ending in small-print sentences that restate the headline.
33. Repeated decoration: a brand element that carries no information, repeated on every slide. Deletion test: remove it, and if nothing a reader needs is lost, it goes.
34. A number beside a number: an ordinal label ("1.", "01") next to a stat, so "59" and "1." read as one figure. A stat card carries one number. A drawing kit should refuse this layout and a scanner should fail it. (scan)
