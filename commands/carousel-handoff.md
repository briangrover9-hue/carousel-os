# carousel-handoff

Job: write the note the next session starts from, in the locked template.
Reads: the plan, today's entry in `memory/LOG.md` (including its `Needs the human:` line), open `NEEDS HUMAN:` markers in `plans/`.
Writes: `memory/handoff.md`, replacing the old one entirely, and a line in Reports.
Exit check: `node scripts/check-process.js` exits 0 with no flags, and Reports holds the `Handoff report:` line.

## Guards

Decline, name the cause, and stop when:
1. Reports' latest `Wrap report:` line is missing, or `memory/LOG.md` has no entry dated today with this plan's slug. Say to run `carousel-wrap`.

## Steps

1. Decide whether anything carries over.
   - Any open `NEEDS HUMAN:` marker in a plan, a last review verdict other than PASS, or a `Needs the human:` line in today's log entry: something carries over. Go to step 2.
   - None of those: write the heading `# Handoff` and the exact sentence `Nothing to hand off this time.` Go to step 6.
2. Write `# Handoff`, then one plain paragraph: where the deck stands and what changed this session.
3. Add at most 5 bullets for the human: decisions to make, things to know.
4. Write `## Agent half` with these lines in this order:
   - `Start with carousel-start.`
   - `Recommended focus: <one line>`. Choose exactly one. Two compete: pick the one that the open markers block least.
   - `Agent-doable:` with bullets for tasks the agent can finish with no new decision.
   - `Needs the human:` with bullets for decisions or files only the human can supply.
   - `Out of scope:` with bullets for what the next session leaves alone.
5. A task needs any decision: it goes under `Needs the human:`, never under `Agent-doable:`.
6. Replace the old file. Never append to it. The template with placeholders is `memory/handoff.template.md`.
7. Run `node scripts/check-process.js` with no flags. It must exit 0. Append the report line to Reports.

## Report line

End with exactly this line, then add the same line to Reports:

`Handoff report: memory/handoff.md written; <N> bullets; focus <one line or none>.`

## No-rubber-stamp guard

A fake handoff runs past five bullets, or names three focuses ("a few things"). It lists a task under Agent-doable that needs a decision. It uses the empty sentence while a marker, a REJECT or an UNVERIFIABLE verdict is open. It appends to the old handoff.

## Rationale

The next session reads this file first, so a fixed shape lets it find the focus in seconds and keeps the note from becoming a second log. Splitting the human half from the agent half stops the agent from picking up work that was waiting on a decision.
