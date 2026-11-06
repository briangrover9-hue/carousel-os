---
name: carousel-brief
description: "Interview the human until the deck's question, reader and evidence are written down."
disable-model-invocation: true
---

# carousel-brief

Job: interview the human until the deck's question, reader and evidence are written down. It is the only stage that asks questions.
Reads: the plan's Direction, `bookshelf/ask-first.md`, wiki pages the index lists for this audience or source.
Writes: `plans/<slug>.md`: Brief, `Status: briefed`, a line in Reports.
Exit check: Brief holds Literal ask, Reader and venue and Evidence with no open marker, or each is a `NEEDS HUMAN:` marker, and Reports holds the `Brief report:` line.

## Guards

Decline, name the cause, and stop when:
1. Reports has no `Start report:` line, or Direction is empty. Say to run `carousel-start`.
2. The human is not there to answer. Write the questions as `NEEDS HUMAN: <question>` markers in Brief, report them in the K count, and stop. Do not fill the brief from guesses.

## Steps

1. Read `bookshelf/ask-first.md`. Answer each question from the plan, the wiki and the files the human named before you ask it.
2. For each question still open, in the order that file gives:
   - Ask at most three per turn, the one that blocks the most work first.
   - Write the answer as the human wrote it.
3. Write Brief with these labeled lines, each starting at the beginning of its line: `Literal ask:` (verbatim, in quotation marks), `Decision:`, `Reader and venue:`, `Evidence:` (sources, one window, scope), `Claims allowed:`, `Claims banned:`, `Slide budget:`, `Platform:`, `Theme:`, `Constraints:`, `Not doing:`.
4. Read the brief back as one paragraph. Edit in place after each correction.
5. For a question the human cannot answer now, write `NEEDS HUMAN: <question>` on the field's line.
   - A marker on `Literal ask:`, `Reader and venue:` or `Evidence:` blocks the storyboard. Say so.
   - A marker on any other field does not block. Name the conservative default from `bookshelf/ask-first.md`.
6. Set `Status: briefed`. Append the report line to Reports. K counts the markers still open in Brief.

## Report line

End with exactly this line, then add the same line to Reports:

`Brief report: <N> questions asked, <M> answers recorded, <K> NEEDS HUMAN markers open.`

## No-rubber-stamp guard

A fake brief answers its own questions. It fills a field with "standard" or "TBD". It rewords the literal ask so it reads better. It reports zero questions asked when the start message left fields open. It writes "internal data" as the evidence with no window.

## Rationale

Every later stage runs without the human, so an ambiguity left here becomes a silent assumption downstream. The literal ask stays verbatim because slide 1 is judged against it.
