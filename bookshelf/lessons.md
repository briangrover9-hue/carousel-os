# Lessons

A lesson is a correction, written down the day it happened so nobody makes it twice. `memory/wiki/lessons.md` holds them, and `node scripts/lessons.js` is the only thing that edits that file. The agent adds lessons. The human decides what counts as a repeat, what becomes a rule, and what a rule still deserves, and each such decision is recorded with the human's own words in `memory/wiki/lessons.history`.

## The loop

1. The human corrects something. The agent runs `node scripts/lessons.js add "<one line>"`.
2. If `add` finds a likely repeat it writes nothing and exits 3 with `POSSIBLE REPEAT of <id>`. The agent records the lesson with `--new` and tells the human. Only the human confirms a repeat, with `repeat <id> --human-confirmed "<their words>"`.
3. A lesson confirmed as corrected twice shows `PROMOTE DUE`. The human approves with `promote <id> --human-confirmed "<their words>"`. It moves to the top of the file as a rule.
4. Rules apply to every session, and `carousel-start` loads them. The file holds 12 rules at most. At the cap, the human retires or merges one first.
5. Every rule needs a human review within 180 days (`review <id> --human-confirmed "<words>"`) or it is retired. Why: a rule nobody rereads turns into folklore.
6. A lesson not reconfirmed within 90 days expires: `node scripts/lessons.js expire` moves it to `memory/history/expired-lessons.md`. `confirm <id> --human-confirmed "<words>"` restarts the 90 days.
7. `dedupe` lists merge candidates. It merges only after `--human-confirmed "<words>"`.

Every `--human-confirmed` action appends a line to `memory/wiki/lessons.history` (date, action, id, the human's words in quotes, detail). `check-process` replays that file and compares it with the lessons file: a repeat count, a confirmed date, a promotion or a review date that the history does not support is an error, and so is a date in the future. The flag is self-attested. The script cannot tell a human from an agent that types it, so the history is there for a person to read.

`node scripts/check-process.js` fails on a lesson past 90 days, on a rule past its review, on more than 12 rules, and on a twice-corrected lesson still unpromoted after 14 days. Inside the 14 days it prints a notice.

## What counts as the same lesson

The match ignores filler words, treats each, all and every as one word, and reads beside, next to and alongside as one word. It never matches a flip. Never against always, add against remove, show against hide: these are different lessons even when they share most words.

Same lesson:
- "Put the base beside every percentage on the slide itself" and "Always show the base next to each percentage on the slide".
- "Label the series on the chart itself" and "Label each series directly on the chart".

Different lessons:
- "Put the base beside every percentage" and "Never put the base beside any percentage".
- "Put the base beside every percentage" and "Remove the base beside every percentage".

A paraphrase the match misses becomes a second lesson. The human merges it with `dedupe`.

## File format

```
## Rules

- R-3fa91c | promoted 2026-11-05 | reviewed 2026-11-05 | text

## Lessons

- L-3fa91c | 2026-11-05 | n=1 | confirmed 2026-11-05 | text
```

The id is a short hash of the text. A lesson has no pipe character, 3 to 240 characters.

## A good lesson

- It says what to do, as a command, in one line. "Put the base beside every percentage on the slide itself" works. "Be careful with percentages" does not.
- It names the situation: "On a chart with two series, label the series on the chart, not in a legend."
- It records the correction and leaves out the story, which belongs in the log.

## What does not belong

A fact about a reader, source or window is knowledge, so it goes in a wiki page. A choice for one deck goes in that plan's Deviations.
