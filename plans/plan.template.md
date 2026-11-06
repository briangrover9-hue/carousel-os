# Plan: <deck title>

Status: started
Slug: <slug>
Path: <full or short>
Rounds: <3 for full, 1 for short>

A section is empty while it holds only lines in angle brackets. Each stage fills its own section and appends its report line to Reports. `node scripts/check-process.js` reads this file as a state machine: the Status line, the Reports lines and the sections must agree.

## Request

<The deck request in the human's words. The reader and where it is read, if stated. The path and why. Files the human named as starting material.>

## Brief

<Written by carousel-brief. Labeled lines: Literal ask (verbatim), Decision, Reader and venue, Evidence (sources, one window, scope), Claims allowed, Claims banned, Slide budget, Platform, Theme, Constraints, Not doing.>

## Storyboard

<Written by carousel-storyboard. A table with ids s01, s02 and so on, then a Headlines only block of numbered lines.>

## Critique log

<Written by carousel-critique. One "### Round R" section per round, each with Angle, Fixed, Waiting on you, "Verified unchanged", an Open rows line and a count line. The last round's line reads "Open rows: none open". A Finding ledger when Rounds is above the default.>

## Calls made

<One line per conservative choice a later stage made, as D1: stage, choice, reason.>

## Build

<Written by carousel-build. A "Deck: <path>" line, then a table of the text printed on each slide.>

## Check

<Written by carousel-check. The path, the pasted plan and ledger gate output, one Tool line per registered tool, the Waiting on you field, and four hashes (deck before the tools, deck, ledger, Build).>

## Review

<Written by carousel-review. The verdict, the pasted evidence, the findings.>

## Reports

<One report line per stage, appended in order, in the exact formats from the command files.>
