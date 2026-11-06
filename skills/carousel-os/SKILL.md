---
name: carousel-os
description: "Set up Carousel OS and point the human to its first stage. Use when the human is building a presentation with an AI agent and wants the story planned and critiqued, every number traced to a source and two reviewers who did not build it to pass it, or when the human asks to set up or install Carousel OS in a project."
---

# carousel-os

Carousel OS is an operating system for building presentations with an AI agent. Nine stages carry a deck from brief to review, every number on a slide is traced to its source in a ledger, two reviewers who did not build the deck have to pass it, and your corrections carry to the next deck.

This skill is the front door. It installs the whole system into a project and points the human to the first stage. It never runs a stage.

## Step 1: check the project

Look in the current project folder for both of these files:

- `RULES.md`
- `.agents/skills/carousel-start/SKILL.md`

If both exist, Carousel OS is installed. Go to Step 3.

## Step 2: install, only with a yes

Ask the human once whether to install Carousel OS in this folder, and show the exact command:

```
npx carousel-os init .
```

Say that it needs Node 20 or newer and leaves any file they already have alone. Never install without a clear yes. If the answer is no, stop.

After a yes, run the command, then run:

```
npx carousel-os doctor .
```

Report the last line doctor prints. If it names a problem, show it and stop.

## Step 3: hand over to the stages

Tell the human the nine stages, in order: `carousel-start`, `carousel-brief`, `carousel-storyboard`, `carousel-critique`, `carousel-build`, `carousel-check`, `carousel-review`, `carousel-wrap`, `carousel-handoff`.

Tell them the human starts each stage, and the first one is `carousel-start` (in Claude Code, type `/carousel-start`). `RULES.md` is the one rules file every stage follows.

Do not run any stage yourself, and do not start building the deck here.

## Learn more

The repository: https://github.com/briangrover9-hue/carousel-os
