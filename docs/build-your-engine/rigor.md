# Rigor: how the engine stays right

A deck engine is software, and it rots the way software rots: rules accrete, tests stop testing, fixes reach one case of many. These are the release rules I settled on after the engine shipped defects that passed every gate I had. Each names the failure that made it necessary.

## Incidents become tests, written by someone else

- [ ] Every defect found in the field gets an incident entry: what went wrong, what right looks like, the exact input that separates them, and the file and function to exercise.
- [ ] A different agent (or person) writes the test from that description alone, without seeing the fix.
- [ ] The test must catch the original incident before it is allowed to guard the fix.

Why: the test passes, the fix ships, and the same defect comes back, because whoever wrote the fix tests what they meant. Someone who has not seen the fix writes the test from the description.

## Mutation-test every fixture

- [ ] At creation, revert the fix the test guards. The test must fail, naming the case.
- [ ] Record the mutation in the test file's header, so the next reader can repeat it.
- [ ] For every budget a file declares, build an artifact at exactly that number and assert the tool accepts it, and one past it and assert the tool refuses.

Why: a suite can exit clean while running zero cases. A fixture that cannot fail is worse than none, because it reports coverage it does not give.

## A golden gallery

- [ ] Build one deck with one example of every component and pattern.
- [ ] Pin a digest per slide in a committed file.
- [ ] Every change runs the gallery and compares. A changed digest is either intended (rebuild the golden file on purpose, in the same commit, with a reason) or a regression.

Why: you refactor one helper and a color quietly changes across the deck. A pinned gallery shows it as a diff on the first run.

## A split gate for decks

The engine's self-test and the deck's check are two different questions.

- [ ] The golden gallery tests the kit. It says nothing about your deck.
- [ ] The deck's own checks (scan, census, render, ledger) run on the exact file that ships, bound to its hash.
- [ ] A change to the deck after the check voids the check.

## Leak scans before every push

- [ ] Before any push, scan every tracked file for names on a private deny list: clients, people, project code names, internal systems.
- [ ] The deny list lives outside the repo. Tests that need real names read the path from an environment variable and use invented names when it is unset.
- [ ] Squash history before publishing a repo that started private, so a name removed today is not in a commit from last month.
- [ ] Put the rule in every fixture author's brief, because a test author who writes a real name into a fixture ships it.

## One owner per rule

- [ ] Before writing a rule, name the one file that owns it. Every other mention is a pointer to that file.
- [ ] If a value must appear in two places (a size read by two scripts), mark the copy as a declared mirror and add a test that the two agree.
- [ ] Check the receiver: a rule is real only if the agent that must enforce it receives the file it lives in.

Why: two files each set half of a rule and neither names the other, so a value can satisfy both and still break the slide. An instruction that tells a reviewer to use output no tool produces never takes effect.

## Fix the class

- [ ] When you fix a defect, list every place the same mistake can occur and fix them all.
- [ ] Write the test against the class (every form that puts a label on a fill), with the incident as one case.

Why: a fix that reaches one chart form and misses its sibling leaves the defect in the deck, and a setting made per form drifts between forms.

## Measure

- [ ] Every claim about the output is backed by a number read from the built file: a contrast ratio, a size census, a line count, a digest.
- [ ] When a visual judgment is needed, render it and have a reviewer who did not build it look.

Why: declarations and eyes both miss what a count finds, and the gap between what a document says and what the file draws is where defects live.

## A finish line

- [ ] Stop at: no blocking defects open, every number verified, quotes exact. A score target keeps the loop running on a deck that is already sound.
- [ ] One confirmation pass, then fixes, then a final check. A defect found at the final check is fixed and confirmed once; if it reopens, declare a blocker.
- [ ] Minor findings ship as a written improvement list.
- [ ] Reuse verdicts for unchanged slides by hash. Voiding every verdict on any byte change sends reviewers back through slides that never changed.

## Honest reporting

- [ ] "Fixed" means the reported hole is closed and a test shows it. Name the residual risk beside it.
- [ ] Paste exact result lines. A summary can say clean about anything.
- [ ] UNVERIFIABLE never rounds up to PASS.

Why: the agent says it is fixed and it is not, because the word "fixed" claims more than the check certified and a rule written from one incident is narrower than its intent.

## Subtract

Give every budget (type sizes, colors, components) a declared number and a rule that an addition removes something or raises the number in the same edit with a written reason. Without a rule that subtracts, each release adds a size for its new component and the system turns to noise.

## Audit on cadence

Every third release, or any change touching three or more files, run a fresh-context audit of the rules and prompts themselves: contradictions, rules nobody receives, undeclared duplicates, dead sentences. A refactor is a generator like any other and gets the same adversarial review as a deck. A cleanup that removes contradictions can plant new ones, and the second pass is the one that finds them.

## The lessons that shaped this

- **A check that missed its own trigger.** You write a scan for a defect, run it, and it passes the deck that had the defect, because it measured shapes and the defect lived elsewhere. Run every new check on the deck that prompted it.
- **A test that cannot fail.** It was written by the author of the fix and never reverted, so it stays green on broken code. Separate the writer from the implementer and revert before you trust.
- **An instruction with no path to take effect.** You tell the agent to make the text bigger, and a pinned scale and two scanners quietly refuse. Before you write a rule, trace how it reaches the file, and give a legitimate change a registered override with a reason.
- **A required slot gets filler.** A layout that demands a line on every slide gets a line on every slide, mostly restating the headline. Make slots earned, and check that what fills them adds something.
- **A refactor deserves the review a deck gets.** Tidying structure moves rules, drops one and plants contradictions. Review the change with a fresh reader before it ships.

## Minimum version

- [ ] An incident log, one entry per field defect, with the input that reproduces it.
- [ ] One test per incident, written from the entry, reverted once to prove it fails.
- [ ] A golden gallery with pinned per-slide digests.
- [ ] A deny-list leak scan run before every push.
- [ ] A stop rule written down before the first review round.
