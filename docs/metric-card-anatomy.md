# Metric card anatomy

**Status: proposed.** This is the target, not the current state. Nothing is built
against it yet — see "Gap against today" at the bottom for what actually ships
right now. Confirm before we migrate.

One primitive covers every dashboard metric. Five slots, in reading order:

```
┌──────────────────────────────────────────────┐
│  ╭───╮   Sessions today          ← 01 LABEL  │
│  │ 24│   of 34 booked            ← 03 CONTEXT│
│  ╰───╯   ▲ 12%  vs last week     ← 04 TREND  │
│    ↑                                         │
│  02 VALUE                          05 → ACTION│
└──────────────────────────────────────────────┘
```

---

## 01 · LABEL — what is being counted

Short, plain-language metric name. Sentence case, no jargon, no units (units
belong to the value).

Renders on one line and truncates with an ellipsis, so it has to survive at
roughly **22 characters**. Write "Sessions today", not "Total sessions
scheduled for today". If the label needs a qualifier to make sense, the
qualifier is CONTEXT, not part of the label.

Required. A card with no label is a number with no meaning.

## 02 · VALUE — the number itself

A count, money, a rate, or a status word.

The value has a **length budget** and it is the single most important
constraint in this component. When the card carries a ring meter the value sits
*inside* the ring, which fits about **four glyphs** — fine for `24`, `98%` or
`1.2k`, and wrong for `₹4,82,300`. When the value exceeds the budget it moves
outside the ring and renders large alongside it.

Rules:
- Counts render bare. No "24 sessions" — the label already said sessions.
- Money is abbreviated past 5 digits: `₹4.8L`, not `₹4,82,300`. Full precision
  belongs on the drill-down page.
- Rates carry their `%`. A bare `98` reads as a count.
- Zero renders as `0`, never as `—`. `—` means *not measured*; `0` means
  *measured, and it's none*. These are different facts and the difference
  matters on a governance card.

Required.

## 03 · CONTEXT — the baseline

The period or comparison the value is measured against: "of 34 booked", "vs
last month", "7-day window", "since Jan".

Optional in general, **required whenever the card draws a ring**. The arc
encodes `filled / of` and there is no legend anywhere on the card, so without
this line the ring is decoration and the user is guessing at the denominator.
That's the rule that gets broken most often — treat a meter with no context as
a bug.

## 04 · TREND — direction plus judgement

Two independent facts that must not be collapsed into one:

- **Direction** — the arrow and the delta. Purely arithmetic: did it go up?
- **Sentiment** — whether up is *good*. Editorial, and it does not follow from
  the sign.

Churn rising is bad. Retention rising is good. Headcount rising is neither.
If we infer colour from the sign of the delta we will render rising churn in
green, which is worse than showing no trend at all. So sentiment is declared by
the caller, never derived:

```ts
trend?: {
  delta: number;                            // signed; drives the arrow
  sentiment: "good" | "bad" | "neutral";    // drives the colour
  since?: string;                           // "vs last week"
}
```

Colour maps to the semantic tokens: `good → --green-text`, `bad → --red-text`,
`neutral → --neutral-text`. Never `--brand-text` — brand is identity, not
judgement.

A delta of exactly 0 renders as "no change" in neutral, with no arrow. Omit the
slot entirely when there is no prior period to compare against; a first-week
metric showing "▲ 100%" is noise.

## 05 · ACTION — the drill-down

Where the card goes when clicked. Optional.

When present the whole card is the hit target — not a "view more" link in the
corner — and it carries a trailing `→`. When absent the card is a plain
container with no affordance: no arrow, no pointer cursor, no hover state. A
card that looks clickable and isn't is the worst of the three states.

The destination should land on the **filtered view that produced the number**,
not the module's front page. "Sessions today" goes to sessions filtered to
today. If clicking makes the user re-apply the filter they just clicked
through, the drill-down is broken.

---

## Proposed props

```ts
{
  label: string;                      // 01
  value: string | number;             // 02
  sub?: string;                       // 03  — required when `meter` is set
  trend?: {                           // 04
    delta: number;
    sentiment: "good" | "bad" | "neutral";
    since?: string;
  };
  href?: string;                      // 05  — omit for a static card
  meter?: { of: number; filled: number };
  color?: string;                     // ring accent; defaults to brand
}
```

---

## Gap against today

Three things are true right now that this spec is not:

**There are two primitives, not one.** `MetricCard` (22 instances across 4
files) is the ring card on the role dashboards. `StatCard` (34 instances across
16 files) is the flat KPI card on leads, billing, HR and retention. 56 call
sites total.

**They disagree on slots 02 and 05.** MetricCard puts the value inside the ring
— hence the 4-glyph cap — and is always a `<Link>`, so `href` is mandatory.
StatCard renders the value at 22/800 with no cap and is a plain `<div>` with no
`href` at all; the leads page wraps it in an external `<Link>` to fake the
drill-down. That external wrap is the tell that these want to be one component.

**Slot 04 does not exist.** No component in the app renders a trend indicator
today. It is entirely new work, and it is the slot most likely to be got wrong,
because the sentiment/direction split above is easy to skip and produces
confidently-wrong green arrows when skipped.

## Migration, when approved

1. Add `trend` and make `href` optional on `MetricCard`; degrade to a `div`
   with no arrow when omitted.
2. Move the value outside the ring when it exceeds the glyph budget, so money
   can use the same primitive.
3. Codemod the 34 `StatCard` call sites; `badge` maps onto `color`.
4. Delete `StatCard`, and unwrap the leads page's external `<Link>`.
5. Audit every `meter` for a missing `sub` — that's the pre-existing bug this
   spec makes visible.
