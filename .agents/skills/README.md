# Stages

These stages run as one system, so install the whole thing with one of the [install options in the README](https://github.com/briangrover9-hue/carousel-os#install).

Nine stages, all started by the human. Each is a skill: `<stage>/SKILL.md` here is its one source, used as-is by Codex and Cursor. `node scripts/generate-skills.js` writes its front matter and its Codex settings file `<stage>/agents/openai.yaml`, and mirrors it into `.claude/skills/` for Claude Code. Edit the body only, below the front matter. `scripts/stages.json` lists the stages, so a folder is a stage only when that list names it. Your own skills can sit beside them, and the script never reads or writes them, nor a `.claude/` copy the installer reports as yours. Every file has the same parts in the same order. First comes the job with its Reads, Writes and Exit check lines, then a Guards section (what it declines, keyed on the previous stage's report line). The steps follow, then one report line to scan for, a Real-change check and a short "Why it works this way" section. `RULES.md` says what the rules are, and these files say how each stage runs.

| Stage | Job | Needs | Report line starts with |
|---|---|---|---|
| [carousel-start](carousel-start/SKILL.md) | Read the handoff, pick the path, open a plan | `RULES.md`, the wiki index | `Start report:` |
| [carousel-brief](carousel-brief/SKILL.md) | Interview the human, write the brief | Request | `Brief report:` |
| [carousel-storyboard](carousel-storyboard/SKILL.md) | One headline, claim and source per slide; open the ledger | Brief | `Storyboard report:` |
| [carousel-critique](carousel-critique/SKILL.md) | One critique round from a new angle | Storyboard, ledger | `Critique round` |
| [carousel-build](carousel-build/SKILL.md) | Build the deck, check each ledger row | Every critique round | `Build report:` |
| [carousel-check](carousel-check/SKILL.md) | The complete check, exact result lines | Build | `Check report:` |
| [carousel-review](carousel-review/SKILL.md) | Two fresh reviewers try to disprove it: one for the argument, one that recomputes every number | Check with no FAIL | `Review verdict:` |
| [carousel-wrap](carousel-wrap/SKILL.md) | One more check, lessons, wiki, log, rotation | Review | `Wrap report:` |
| [carousel-handoff](carousel-handoff/SKILL.md) | The note the next session starts from | The wrap entry | `Handoff report:` |

The plan file `plans/<slug>.md` carries the state. A stage fills its own section and appends its report line to Reports, and the next stage reads both before it runs.
