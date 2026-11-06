# Rigor: how the engine stays right

A deck engine is software, and it rots the way software rots: rules accrete, tests stop testing, fixes reach one case of many. These are the release rules I settled on after the engine shipped defects that passed every gate I had. Each names the failure that made it necessary.

## Incidents become tests, written by someone else

- [ ] Every defect found in the field gets an incident entry: what went wrong, what right looks like, the exact input that separates them, and the file and function to exercise.
- [ ] A different agent (or person) writes the test from that description alone, without seeing the fix.
- [ ] The test must catch the original incident before it is allowed to guard the fix.

Why: three rounds running, tests written by the agent that wrote the fix passed vacuously, including the test written to close the previous round's worst defect. The author reads what they meant, so the author's test checks what they meant.

## Mutation-test every fixture

- [ ] At creation, revert the fix the test guards. The test must fail, naming the case.
- [ ] Record the mutation in the test file's header, so the next reader can repeat it.
- [ ] For every budget a file declares, build an artifact at exactly that number and assert the tool accepts it, and one past it and assert the tool refuses.

Why: one of my regression suites exited clean while running zero cases. A fixture that cannot fail is worse than none, because it reports coverage it does not give.

## A golden gallery

- [ ] Build one deck with one example of every component and pattern.
- [ ] Pin a digest per slide in a committed file.
- [ ] Every change runs the gallery and compares. A changed digest is either intended (rebuild the golden file on purpose, in the same commit, with a reason) or a regression.

Why: a refactor of one helper changed the resolution path for light partners, and ten bars in a real deck went back to the default tint. A pinned gallery shows that as a diff on the first run.

## A split gate for decks

The engine's self-test and the deck's check are two different questions.

- [ ] The golden gallery tests the kit. It says nothing about your deck.
- [ ] The deck's own checks (scan, census, render, ledger) run on the exact file that ships, bound to its hash.
- [ ] A change to the deck after the check voids the check.

## Leak scans before every push

- [ ] Before any push, scan every tracked file for names on a private deny list: clients, people, products, internal systems.
- [ ] The deny list lives outside the repo. Tests that need real names read the path from an environment variable and use invented names when it is unset.
- [ ] Squash history before publishing a repo that started private, so a name removed today is not in a commit from last month.
- [ ] Give every fixture author the rule in their brief. Three times, a test author wrote real client names into a shipped test.

## One owner per rule

- [ ] Before writing a rule, name the one file that owns it. Every other mention is a pointer to that file.
- [ ] If a value must appear in two places (a size read by two scripts), mark the copy as a declared mirror and add a test that the two agree.
- [ ] Check the receiver: a rule is real only if the agent that must enforce it receives the file it lives in.

Why: a headline's size lived in one file and its word budget in another, and neither named the other, so a size that guaranteed three-line headlines passed both. Separately, an instruction told a reviewer to use output that no tool produced. It had no path to take effect.

## Fix the class

- [ ] When you fix a defect, list every place the same mistake can occur and fix them all.
- [ ] Write the test against the class (every form that puts a label on a fill), with the incident as one case.

Why: in one review round, a contrast fix reached the drawn bar and missed the native one, a fade rule reached four chart forms and missed a fifth, and an axis offset was set per form so two charts at the same height drew baselines apart.

## Measure

- [ ] Every claim about the output is backed by a number read from the built file: a contrast ratio, a size census, a line count, a digest.
- [ ] When a visual judgment is needed, render it and have a reviewer who did not build it look.

Why: every defect my system shipped lived in the gap between what a document declared and what the code drew. Eyes and declarations both missed them; counting found them.

## A finish line

- [ ] Stop at: no blocking defects open, every number verified, quotes exact. A score target keeps the loop running on a deck that is already sound.
- [ ] One confirmation pass, then fixes, then a final check. A defect found at the final check is fixed and confirmed once; if it reopens, declare a blocker.
- [ ] Minor findings ship as a written improvement list.
- [ ] Reuse verdicts for unchanged slides by hash. Voiding every verdict on any byte change once sent three reviewers through seventeen unchanged slides to check three, four rounds running.

## Honest reporting

- [ ] "Fixed" means the reported hole is closed and a test shows it. Name the residual risk beside it.
- [ ] Paste exact result lines. A summary can say clean about anything.
- [ ] UNVERIFIABLE never rounds up to PASS.

Why: the hardest feedback I got early was that I kept calling things fixed when they were not. Rules written from incidents were narrower than their intent, and the word "fixed" claimed more than the check certified.

## Subtract

Give every budget (type sizes, colors, components) a declared number and a rule that an addition removes something or raises the number in the same edit with a written reason. Without a rule that subtracts, each release adds a size for its new component and the system turns to noise.

## Audit on cadence

Every third release, or any change touching three or more files, run a fresh-context audit of the rules and prompts themselves: contradictions, rules nobody receives, undeclared duplicates, dead sentences. A refactor is a generator like any other and gets the same adversarial review as a deck. My first refactor removed five contradictions and introduced four defects; the second audit round caught them.

## The lessons that shaped this

Generalized from the incident log:

- **A scan that missed its own incident.** The check measured drawn shapes, and the defect lived in a native chart. Run every new check on the deck that prompted it.
- **Tests that could not fail.** Written by the fix's author, never mutation-tested, green on reverted code. Separate the writer from the implementer and revert before you trust.
- **An instruction with no path to take effect.** A request to "make the fonts bigger" could not take effect against a pinned scale and two scanners that refused a seventh size. The fix was a registered override with a reason, passed to every tool. Before writing a rule, trace how it reaches the file.
- **A rule that mandates a slot gets filler.** The house layout required a takeaway line on every slide, so every slide got one, mostly restating the headline, and the real recommendation sat in the smallest type. Make slots earned, and check that what fills them adds something.
- **A refactor needs the same review as a deck.** Cleaning up structure moved rules, dropped one, and planted contradictions. Review the change with a fresh reader before it ships.

## Minimum version

- [ ] An incident log, one entry per field defect, with the input that reproduces it.
- [ ] One test per incident, written from the entry, reverted once to prove it fails.
- [ ] A golden gallery with pinned per-slide digests.
- [ ] A deny-list leak scan run before every push.
- [ ] A stop rule written down before the first review round.
