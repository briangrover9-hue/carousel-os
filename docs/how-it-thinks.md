# How it thinks

You ask an agent for a deck. It comes back fast, the slides look right, and then you find a number on slide 9 that disagrees with slide 3. You say so. The agent says it is fixed, and it is not. Carousel OS is the process I built to stop that sequence. It is nine commands, a plan file per deck, a claim ledger, a memory, and a few scripts that enforce what instructions alone cannot. An engine is optional: a program that draws slides or checks them, which you build or plug in through a small config file (`bookshelf/engine-contract.md`). The carousel-os repository holds a blueprint for building one in its build-your-engine docs.

## Why one prompt does not hold

A single prompt asks one pass to interpret the request, pick a story, find the numbers, draw the slides and judge the result. The errors that pass makes go into the deck, and the same pass that made them checks them. Splitting the work into stages gives each a narrow job, a file it must read, a file it must write, and a line that proves it ran. The human starts each stage, so the human sees each artifact before the next one builds on it.

## Same look, same thinking

A deck should look the same every time, and it should think the same way every time. An engine handles the look: one set of type sizes, one palette, and scans that fail when a slide leaves them. The process handles the thinking. A brief settles the question before anyone draws, a ledger ties numbers to sources, each critique round attacks from a new angle, and a reviewer reads work they have not seen. A consistent look over inconsistent thinking gives you handsome decks that fall over in the room.

## What each mechanism is for

Each row starts from a moment you have probably felt.

| The moment | What stops it |
|---|---|
| You skipped the interview and the deck answers a different question | A stage declines to run without the previous stage's report line |
| The agent stalls on a question halfway through the build, or guesses without telling you | The brief is the only interview, and later stages log each guess under Calls made |
| Three review rounds find the same thing | Each round must declare an angle nobody has used |
| A round reports progress and changes nothing | The change list and the count line |
| A number on a slide has no source, or differs from it | The claim ledger, and a script that reads the deck file against it |
| The check passes and the mistake is still there | A reviewer with fresh context who tries to disprove the deck |
| "Could not tell" gets reported as "all clear" | UNVERIFIABLE is its own verdict |
| You tell it the same thing every week | The lessons loop |
| You cannot find what you decided last month | A dated log of each session, kept apart from a wiki of facts that stay true |
| Rules pile up past what anyone reads | Byte caps, and checks for dead references and prose |

## Where the agent still does the work

The agent finds the story, chooses the evidence, writes the headlines and builds the slides. The process leaves those choices to the agent and makes them visible and checkable. You get a loop you can trust, and your part stays small: you read the brief back, skim the Calls made, glance at each round's change list, and decide what to do about a REJECT.

## Limits

- The deck targets PowerPoint and Google Slides. Other formats are out of scope.
- It is slow and it uses a lot of tokens. `cost.md` says where they go.
- The checks catch what they were built to catch. A deck can pass every one and still be dull or wrong in a way no check anticipated, which is why a human reads it before it leaves.
- An engine is yours to supply. The process checks the deck file and the ledger with or without one, and the blueprint says what a good engine should check.
