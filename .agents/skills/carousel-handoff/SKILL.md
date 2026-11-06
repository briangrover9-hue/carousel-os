---
name: carousel-handoff
description: "Write the note the next session starts from, in the fixed shape of `memory/handoff.template.md`."
disable-model-invocation: true
---

# carousel-handoff

Job: write the note the next session starts from, in the fixed shape of `memory/handoff.template.md`.
Reads: the plan, its ledger, today's entry in `memory/LOG.md` (including its `Waiting on you:` line), open `ASK:` markers in `plans/`.
Writes: `memory/handoff.md`, replacing the old one entirely, and a line in Reports.
Exit check: `node scripts/check-process.js` exits 0 with no flags, and Reports holds the `Handoff report:` line.

## Guards

Decline, name the cause, and stop when:
1. Reports' latest `Wrap report:` line is missing, or `memory/LOG.md` has no entry dated today with this plan's slug. Say to run `carousel-wrap`.

## Steps

1. Decide whether anything carries over.
   - Any open `ASK:` marker in a plan, a last review verdict other than PASS, or a `Waiting on you:` line in today's log entry: something carries over. Go to step 2.
   - None of those: write the heading `# Handoff` and the exact sentence `No open items. The next session starts clean.` Go to step 6.
2. Write `# Handoff`, then `## Next session` with these lines in this order:
   - `Next focus: <one line>`. Choose exactly one. When two compete, pick the one the open markers block least.
   - `Deck state: <N> slides built; ledger rows checked <C> of <T>; last verdict <PASS|REJECT|UNVERIFIABLE|none>`. N is the latest `Build report:` count (write `0 slides built` before a build), C and T count the ledger's `checked` rows and all its rows, and the verdict is the latest `Review verdict:` (`none` before a review).
   - `Open ASK markers:` with one bullet per `ASK:` marker still open in a plan: where it sits and the question. Write `- none` when there is none.
   - `Open ledger rows:` with one bullet per ledger row that is not `checked`: its slide id and why. Write `- none` when every row is checked.
3. Copy every value from the plan and the ledger as they stand. Why: the next session trusts these lines without reopening the plan.
4. Below that block, write one plain paragraph for the human: where the deck stands and what changed this session.
5. Add at most 5 bullets for the human: decisions to make, things to know.
6. Never append to the old file: replace it. The template with placeholders is `memory/handoff.template.md`.
7. Run `node scripts/check-process.js` with no flags, which must exit 0, then append the report line to Reports.

## Report line

End with exactly this line, then add the same line to Reports:

`Handoff report: memory/handoff.md written; <N> bullets; focus <one line or none>.`

## Real-change check

A fake handoff runs past five bullets, or names three focuses ("a few things"). Its Deck state disagrees with the plan or the ledger, or it writes `- none` under a list that has entries. It uses the empty sentence while a marker, a REJECT or an UNVERIFIABLE verdict is open. It appends to the old handoff.

## Why it works this way

The next session reads this file first, so a fixed shape lets it find the focus in seconds and keeps the note from becoming a second log. The block reads off the deck's own state, the slides built, the ledger and the last verdict, so the next session sees what is unproven before it reads the note. Keeping the note for the human apart from that block keeps opinion out of the state.
