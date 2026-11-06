# Commands

Nine stages, all started by the human. Every file has the same parts in the same order: the job with its Reads, Writes and Exit check lines, a Guards section (what it declines, keyed on the previous stage's report line), the steps, one report line to scan for, a No-rubber-stamp guard, and a short Rationale. `RULES.md` says what the rules are. These files say how each stage runs.

| Command | Job | Needs | Report line starts with |
|---|---|---|---|
| [carousel-start](carousel-start.md) | Read the handoff, pick the path, open a plan | `RULES.md`, the wiki index | `Start report:` |
| [carousel-brief](carousel-brief.md) | Interview the human, write the brief | Direction | `Brief report:` |
| [carousel-storyboard](carousel-storyboard.md) | One headline, claim and source per slide; open the ledger | Brief | `Storyboard report:` |
| [carousel-challenge-plan](carousel-challenge-plan.md) | One critique round from a new angle | Storyboard, ledger | `Challenge round` |
| [carousel-build](carousel-build.md) | Build the deck, check each ledger row | Every challenge round | `Build report:` |
| [carousel-check](carousel-check.md) | The complete check, exact result lines | Build | `Check report:` |
| [carousel-review](carousel-review.md) | A fresh reviewer tries to disprove it | Check with no FAIL | `Review verdict:` |
| [carousel-wrap](carousel-wrap.md) | One more check, lessons, wiki, log, rotation | Review | `Wrap report:` |
| [carousel-handoff](carousel-handoff.md) | The note the next session starts from | The wrap entry | `Handoff report:` |

The plan file `plans/<slug>.md` carries the state. A stage fills its own section and appends its report line to Reports, and the next stage reads both before it runs.
