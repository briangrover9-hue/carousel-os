# Ask first, then stop asking

`carousel-brief` is the one place the agent interviews the human. Every question below gets asked there, or it gets decided conservatively later and logged. This page lists the questions in order, what each protects, and the conservative default a later stage uses when the answer never came.

## How to ask

- Look first. If the plan, the wiki or a file the human named already answers a question, write the answer down and move on.
- Ask at most three questions per turn. Put the one that blocks the most work first.
- Offer a default only when the wiki holds one. Say where it came from.
- Quote the answer as written. Do not tidy the literal ask.
- Stop when the three blocking fields are filled: Literal ask, Reader and venue, evidence window. Fill the rest as far as the human can.

## The questions

| # | Ask | Protects | Conservative default if never answered |
|---|---|---|---|
| 1 | What exactly were you asked, word for word? | Slide 1 answers the real question | None. Blocks the storyboard. |
| 2 | Who reads this, and where: screen share, emailed file, printed, on a stage? | Density, type size, notes | None. Blocks the storyboard. |
| 3 | What sources and what time window? | The one-window rule | None. Blocks the storyboard. |
| 4 | What decision should the deck help someone make? | The organizing idea | The literal ask is the decision. |
| 5 | How many slides, and is an appendix allowed? | Length | 12 content slides, appendix allowed. |
| 6 | Which claims are you comfortable making, and which are off limits? | Overreach | Descriptive claims only. Causal claims read "worth testing". |
| 7 | PowerPoint or Google Slides? | The build target | PowerPoint. |
| 8 | Default theme or your own? | The look | Your engine's default theme, or the platform's plain theme. |
| 9 | Names, organizations or figures that must not appear? | Confidentiality | Anonymize every name that is not in the sources. |
| 10 | What is out of scope? | Scope creep | Anything the brief does not mention. |

## After the interview

Later stages meet gaps the interview missed. They never ask. They take the conservative default from this table, or the smaller claim when the table is silent, and add a line to Calls made. The human reads Calls made at handoff and overturns what they disagree with.

## What makes a fake interview

Questions answered by the agent, answers paraphrased until they sound better, or a brief written before any question was asked. `carousel-brief` names these in its guard.
