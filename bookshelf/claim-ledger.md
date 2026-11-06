# The claim ledger

The ledger holds one entry per slide. It is how the deck proves that every number on it came from somewhere. It lives at `plans/<slug>.ledger.json`, opened by `carousel-storyboard` and worked by `carousel-build`. The blank form is `plans/ledger.template.json`.

## Fields

| Field | Meaning |
|---|---|
| `id` | Slide id such as `s03`. Unique. |
| `kind` | `claim` (default) or `framing`. A framing slide (cover, divider, agenda, close) carries no numbers. |
| `claim` | The one thing the slide asserts, as a sentence. |
| `source` | The file, query or page the numbers come from. Never "internal data" or "see appendix". |
| `window` | The time window of the numbers. Equal to the deck's window on every slide that has numbers. |
| `numbers` | Every figure on the slide: `value` as printed, `source` for that exact figure, and `reconciled`. |
| `status` | `open`, `checked` or `rejected`. |
| `check` | Once checked, the named check that passed, in a sentence. |
| `checked_on` | The date of that check. |
| `note` | Required when `rejected`. Marks an `open` row "uncertain" when a critique round demotes it. |

## Rules

- The agent sets `status` to `checked` only after the check named in `check` has passed, and only when every number in the row is `reconciled: true`.
- A check names what was done: "recomputed from the order file, column D, summed over the window, matches 42.1%". It has six words at least and names an action word (recomputed, recounted, compared, opened, ran, matches). `check-process` refuses "verified", "looks right" and phrases like them. `checked_on` must be a real date, no later than today and no earlier than the end of the window.
- Every number printed on a slide has a row entry. A figure on a slide that is missing from `numbers` is an unreconciled number. `check-process --plan` reads the slide text out of the .pptx file itself and compares it with the ledger in both directions. Every ledger value must be printed on its slide, and every figure printed must be a ledger value. It compares the same figures with the Build table too.
- A figure in words ("six in ten", "three times", "half") is a figure. Record it as `words` on the number it describes, as in `{"value": "61%", "words": ["six in ten"]}`. The words must be printed on the slide, must agree with the number (within 5 points for a percentage, 0.3 for a multiple), and a ratio phrase the ledger does not record fails the check. The ledger claim and the storyboard row for a slide must use the same ratio phrases.
- A figure that is a choice and not a measurement (a proposed trial length printed as digits) still gets an entry. Its source says "proposal parameter from the brief".
- A claim demoted to uncertainty stays `open` with a note until a later round resolves it.
- A slide whose claim fails its check becomes `rejected` with a note, and the slide gets fixed or cut. A rejected row is removed or reopened before the deck is done.
- Quotes may carry an optional `quote` field with the exact text. An engine's scan can compare it byte for byte.

## The final gate

`node scripts/check-process.js --ledger plans/<slug>.ledger.json --final` runs on every plan that has a review line. It exits non-zero when any row is not `checked` or any number is not `reconciled`. It also exits non-zero when a numbered slide's window differs from the deck window, or a checked row lacks its `check` text. `carousel-check` runs it, `carousel-review` runs it again, and the review fails on any unreconciled number.

`node scripts/check-process.js --ledger-md plans/<slug>.ledger.json` prints the same ledger as a pipe table, for an engine scan that reads one.

## One row

```json
{
  "id": "s04",
  "kind": "claim",
  "claim": "Members who miss two weeks in a row cancel within 60 days at three times the base rate.",
  "source": "visits.csv, cancellations.csv",
  "window": "12 months ending 2026-06-30",
  "numbers": [
    { "value": "3x", "source": "cancel rate 31.2% vs base 10.4%, computed in retention.py", "reconciled": true }
  ],
  "status": "checked",
  "check": "recomputed both rates from the two files, ratio 3.0",
  "checked_on": "2026-11-05",
  "note": ""
}
```
