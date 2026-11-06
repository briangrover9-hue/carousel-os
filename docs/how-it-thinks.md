# How it thinks

Carousel OS is a process that takes a deck request from nothing to a finished and checked deck. It is nine commands, a plan file per deck, a claim ledger, a memory, and a few scripts that enforce the parts instructions cannot. An engine is optional: a program that draws slides or checks them, which you build or plug in through a small config file (`bookshelf/engine-contract.md`). The carousel-os repository holds a blueprint for building one in its build-your-engine docs.

## Same look, same thinking

A deck should look the same every time, and it should also think the same way every time. An engine handles the look: one kit, one type scale, one palette, and scans that fail when a slide leaves them. The process handles the thinking: a brief that settles the question before anyone draws, a ledger that ties numbers to sources, critique rounds that each attack from a new angle, and a reviewer who has not seen the work. Consistent looks with inconsistent thinking gives you handsome decks that fall over in the room.

## Why one prompt does not hold

A single prompt asks one pass to interpret the request, pick a story, find the numbers, draw the slides and judge the result. The errors that pass makes go into the deck, and the same pass that made them checks them. Splitting the work into stages gives each a narrow job, a file it must read, a file it must write, and a line that proves it ran. The human starts each stage, so the human sees each artifact before the next one builds on it.

## What each mechanism is for

| Mechanism | The failure it targets |
|---|---|
| A stage declines without its predecessor's artifact | Skipping the brief and storyboarding from a vibe |
| The brief is the only interview | Later stages stalling, or guessing silently |
| The Deviations list | Conservative choices that nobody reviews |
| One new angle per critique round | Three rounds that find the same thing |
| The diff summary and count line | A round that talks and changes nothing |
| The claim ledger and the deck reader | A number on a slide with no source, or one that differs from its source |
| A fresh-context reviewer | The builder grading their own work |
| UNVERIFIABLE as its own verdict | "Could not tell" rounded up to "all clear" |
| The lessons loop | Making the same correction every week |
| A log and a wiki, kept apart | Facts buried in a diary, events cluttering the facts |
| Byte caps, dead-reference and prose checks | The rules file growing until nobody reads it, and links that rot |

## Where the agent still does the work

The agent finds the story, chooses the evidence, writes the headlines and builds the slides. The process does not make those choices for it. It makes them visible and checkable. What you get is a loop you can trust. There is no one-click button. You will read the brief back, skim the Deviations, glance at each round's diff summary, and decide what to do about a REJECT.

## Limits

- The deck targets PowerPoint and Google Slides. Other formats are out of scope.
- It is slow on purpose, and it uses a lot of tokens. `cost.md` says where they go.
- The checks catch what they were built to catch. A deck can pass every one and still be dull or wrong in a way no check anticipated. That is why a human reads it before it leaves.
- An engine is yours to supply. The process checks the deck file and the ledger with or without one, and the blueprint says what a good engine should check.
