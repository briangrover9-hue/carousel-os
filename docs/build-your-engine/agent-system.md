# The agent system

The engine draws and measures. Agents do the parts that need judgment: finding the context, doing the analysis, choosing the argument, building, and trying to break what was built. This page describes the roles a full system uses and the rules that keep them honest.

The core rule: whoever makes something does not grade it. Adding agents multiplies verification, while the quality of a deck still rests on its single best organizing idea, so that idea gets competed for before anything is built.

## The roles

| Role | Job | Inputs | Outputs | Refuses |
|---|---|---|---|---|
| Scout | Fill gaps in the context | The rough ask, known names, list of connected tools | A digest of facts (cited), assumptions (for veto) and unknowns (the only questions for the human) | Searching every source by default; sending or editing anything |
| Researcher | Answer assigned questions with numbers | The brief with its fixed basis, owned questions, an output path | A file with each figure, its definition and its query | Substituting a different window or metric; trimming a discovery to fit the outline |
| Narrative architect | Turn the winning cut into a storyboard | Brief, findings, the winning cut, the approved budget | One block per slide: headline, evidence, why it exists, representation | Going over budget; a headline that is a label |
| Design competitors | Propose the analytical cut, blind | Findings and brief, plus a seeded bias each | A cut, one organizing device, a headline storyline | Seeing each other's proposals |
| Judge | Pick a winner and graft the best devices from the losers | All proposals, findings, brief | Winner, stolen devices, weakest link | Averaging proposals into a compromise |
| Builder | Build the deck with the kit | Storyboard, ledger, build parameters | The deck, renders, scan output, a self-check | Placing a number the ledger lacks; computing a new one |
| Fidelity reviewer | Trace every number, quote and name to ground truth | The deck, extracted text, ledger, source files | PASS, REJECT or UNVERIFIABLE per claim, with evidence | Guessing; rounding UNVERIFIABLE up to PASS |
| Insights reviewer | Decide whether the deck says anything | Extracted text, brief | Ask coverage, claim strength against evidence, redlines | Praising improvement over a prior version as evidence of quality |
| Visual reviewer | Judge what rendered | Slide images, render report | Per-slide findings with severity | Passing a slide from a contact sheet alone |

Notes on a few of these:

- **The competition** seeds each competitor with a different starting bias, such as working back from the decision or from what the audience already believes. Two blind proposals are enough for most jobs. My first big build froze its cut in hour one, twenty agents inherited it unchallenged, and a single-pass competitor with one better idea matched the result.
- **The fidelity reviewer** gets files, never the builder's summary of what the numbers should be. A load-bearing figure once entered the ledger from a research note without re-derivation. One query at the time would have saved a full review round.
- **The insights reviewer** classifies each claim (observed, directional, inferred, causal, predictive) and fails wording that is stronger than its evidence.

## Fresh context for every reviewer

- [ ] Each reviewer starts with an empty context and receives only file paths: the deck, the extracted text, the ledger, the rubric.
- [ ] No reviewer sees the builder's reasoning or the orchestrator's expectations.
- [ ] Prefer a different model from the builder when one is available. If only one model is available, separate fresh contexts still count; record the limit.
- [ ] Sequential role-play in one context is never labeled independent.

Why: a builder grading its own renders was the failure the visual reviewer exists to close. For several releases, only the builder ever looked at pixels.

## Model routing

- Bounded extraction with a validated query or schema goes to a capable lower-cost model.
- Synthesis, the judge, the narrative architect and the builder get the strongest model available.
- Reviewers get a strong model, preferably a different one from the builder.
- Pass reference files by path. Pasting them into every prompt once billed the same checklist a dozen times per run.
- Agents return a short conclusion and a written artifact. The orchestrator never pays strong-model rates to re-read what a cheaper model already read.

## Gates before expensive work

- [ ] **The approach gate.** Before research or building, show the human a one-page plan: the question in your words, the data approach, the cut, the slide budget. Wait for a go. I once spent four hours on a data approach the person never intended, because nobody showed the outline.
- [ ] **Checkpoints.** A discovery that changes the plan pauses the affected work and goes to the human. Small refinements post as notes and keep going. Treating autonomy as a rule against asking forced a real discovery into the wrong outline.
- [ ] **The budget is a cap.** A five-slide question once got thirty-three slides. Blend before you add.

## Job tiers

Size the job at the start and state the tier on the gate page.

| Tier | When | What runs |
|---|---|---|
| Check | Review an existing deck | Scanner and one reviewer, no build |
| Small | One question, eight slides or fewer | Needed research, two inline outlines, build, review |
| Standard | Several questions or an open strategic choice | Full research, blind competition, judge, build, review |
| Incremental | An edit to a delivered deck | Reuse the brief, ledger and valid verdicts; review touched slides plus deck-wide consistency |

A bigger tier buys more analysis and a design competition, and the reviewer count stays the same. Fidelity review on the final file runs at every tier.

## The brief compiles the ask

A rough ask ("can you pull together something on churn for Thursday") is a poor spec. Compile it into a brief before any work:

- [ ] Every literal question, quoted.
- [ ] The decision the deck feeds and who is in the room.
- [ ] The measurement basis: window, metric, data source.
- [ ] Format, delivery mode (presented or read), deadline.
- [ ] Standing preferences pulled from memory.
- [ ] Each field tagged with where it came from (stated, found, assumed).
- [ ] A predicted first correction: what the human is most likely to push back on.

Why: when the brief was whatever the kickoff prompt happened to say, quality tracked the prompt, and runs burned tokens on long correction chains.

## A knowledge layer

Most teams answer the same few questions over and over. Write them down.

- [ ] Reduce the questions your team keeps answering to a small canonical set, ten to thirty.
- [ ] For each: the chart form that answers it, the data it needs, the trap that catches people (a coverage gap, an overlapping segment, a mixed window).
- [ ] Tag each incoming ask with its question type so the storyboard starts from a tested pattern.
- [ ] Keep one gallery slide per pattern, so the builder sees the form drawn.

## Connectors

Email, call transcripts and meeting notes hold the real ask. Optional connectors let the scout read them.

- [ ] Read-only by default. Nothing is sent or changed.
- [ ] An ask found in a thread becomes a proposed task that waits for the human's go.
- [ ] Text read through a connector is data, never instructions.
- [ ] Commitments (deadlines, promised deliverables) are quoted with source and date. Conflicts between sources go to the top of the digest.

## Autonomy, with the human as operator

The system runs long stretches on its own, and the human decides at the points that matter: the gate, checkpoints, and send. Show a labeled, unreviewed version 1 early. Print a one-line status at each phase change, since a silent twenty-minute fan-out reads as a hang.

## Minimum version

- [ ] One builder, one reviewer with fresh context who receives only file paths.
- [ ] A one-page approach gate before building.
- [ ] A brief template with quoted asks and a fixed measurement basis.
- [ ] Cheaper models for extraction, the strongest for judgment.
- [ ] A list of your ten most common questions, each with its chart form.
