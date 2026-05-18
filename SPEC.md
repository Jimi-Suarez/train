# SPEC · Train · Jimi

The detailed specification. Every screen, every interaction, every decision and its rationale. Read `README.md` first for the principles; come here for the detail.

**Status:** v1 design complete. All major decisions locked through 7 rounds of design Q&A. Ready to build.

---

## Table of contents

1. [Data model](#1-data-model)
2. [The Today screen](#2-the-today-screen)
3. [The Gym screen](#3-the-gym-screen)
4. [The Food screen](#4-the-food-screen)
5. [The Trends screen](#5-the-trends-screen)
6. [The ISAK screen](#6-the-isak-screen)
7. [The Levels screen](#7-the-levels-screen)
8. [The Drawer (settings, Why, review)](#8-the-drawer)
9. [Cross-cutting features](#9-cross-cutting-features)
10. [Seed data](#10-seed-data)
11. [Decision log](#11-decision-log)

---

## 1. Data model

All data persists in `localStorage` under a single root key: `train.jimi.v1`. Stored as JSON, single object.

### Root state shape

```js
{
  version: 1,

  // Lift state — keyed by liftId (e.g. "incline-bb")
  lifts: {
    [liftId]: {
      weight: number,           // current working weight (kg)
      level: number,            // starts at 1, increments on level-up
      streakAtMax: number,      // 0, 1, or 2 — consecutive max sessions
      lastSession: SessionEntry | null,
      history: SessionEntry[]
    }
  },

  // Sessions — keyed by ISO date "yyyy-mm-dd"
  sessions: {
    [date]: {
      sessionId: 'push' | 'pull' | 'legs' | 'full',
      startedAt: timestamp,
      completedAt: timestamp | null,
      deload: boolean,           // bad sleep flag
      lifts: {
        [liftId]: SessionEntry
      },
      deferred: liftId[],        // lifts skipped, may return
      note: string | null
    }
  },

  // Meals — keyed by ISO date
  meals: {
    [date]: {
      [mealId]: 'eaten' | 'cheat' | 'skipped' | 'replaced' | null,
      familyMeal: { replacing: mealId } | null,
      bites: number              // counter, increments per tap
    }
  },

  // ISAK measurements — keyed by ISO date
  isak: {
    [date]: ISAKMeasurement     // see ISAK section for full shape
  },

  // Sunday reviews — keyed by ISO week (e.g. "2026-W18")
  reviews: {
    [week]: {
      sessions: number,           // pulled from sessions, but stored at submission time
      proteinHit: boolean,
      waistFeel: 'better' | 'same' | 'worse',
      energy: 1 | 2 | 3 | 4 | 5,
      disruptions: string[],      // multi-select tags
      note: string | null
    }
  },

  // Habit ticks — daily/per-event flags
  habits: {
    [date]: {
      kitLaidOut: boolean,        // night before training
      mobility: boolean,          // dead hangs / mobility done
      run: { distance: km, mood: '😌'|'😐'|'😣' } | null
    }
  },

  // Photo log — base64 data URLs, keyed by month "yyyy-mm"
  photos: {
    [yearMonth]: { dataUrl: string, takenAt: timestamp }
  },

  // Disruption log — captured when a session is missed or scores low
  disruptions: {
    [date]: {
      reason: 'bad-sleep' | 'work' | 'family' | 'illness' | 'travel' | 'didnt-feel-it',
      sessionId: string | null
    }
  },

  // Settings
  settings: {
    proteinTarget: 150,
    kcalTarget: 2050,
    accountabilityContact: string | null,   // for share-sheet defaults
    startedAt: ISO date            // for "Week N" display
  }
}
```

### SessionEntry shape

```js
{
  date: 'yyyy-mm-dd',
  sets: [
    { weight: number, reps: number, increment: number, points: number }
  ],
  score: number,
  max: number,                  // sets * rangeSize
  deload: boolean,
  warmupSkipped: boolean
}
```

### Variant lift state

Three lifts — `incline-bb`, `db-shoulder-press`, and `flat-db` — store separate BB and DB progressions. Their entry in `lifts` is:

```js
{
  bb: liftState | null,   // barbell progression
  db: liftState | null    // dumbbell progression
}
```

Where each `liftState` has the same flat shape as all other lifts (weight, lastReps, consecutiveTopOfRange, lastSession, history). A null slot means that variant has never been started.

**Migration:** on first load, any existing flat state for these three lifts is moved into the `bb` slot with `db: null`. The migration is idempotent — it checks for the presence of `bb`/`db` keys before touching anything. New installs are seeded directly into the variant shape. All other lifts keep the flat shape.

### Single source of truth

All reads/writes go through `store.js`. View files never touch `localStorage` directly. This makes export/import trivial: serialise the in-memory state, deserialise on import.

---

## 2. The Today screen

The first thing the user sees. Sets the tone of the day.

### Layout (top to bottom)

```
↓ pull for the why                        ← discoverable, not pushed
─────────────────────────────────────────
Monday · 4 May
WEEK 18  ████████░░░░░░░░ 32%
1 of 4 sessions · 60% protein

THE BIG FOUR                              ← KPI lifts panel
  Incline    L4  ·  62.5kg   ●○
  Deadlift   L6  ·  120kg    ●● ⚡         ← ⚡ = ready to level up
  Squat      L3  ·  80kg     ○○
  Pull-ups   L2  ·  +5kg     ○○

TODAY
┌─────────────────────────────────┐
│  ⤒  PUSH DAY                    │
│      5 lifts · ~60 min          │
│      Start session →            │
└─────────────────────────────────┘

NEXT MEAL · 13:30                          ← only shown if a meal is "due"
Lunch — protein + carbs + veg
[ ✓ Eaten ]  [ ⚠ Cheat ]  [ ✕ Skip ]

Today's meals  2 of 5
●●○○○ · See all →

[Today] [Gym] [Food] [Trends] [ISAK]      ← tab bar
```

### The pull-down Why

A subtle "↓ pull for the why" hint at the very top, dismissable but always reappears. Drag down → full-screen takeover with:

> **My daughters will look back at photos of me and see a father who took care of himself.**
>
> On every hard morning at 5am, the question is not: do I feel like it. The question is: what do I want my daughters to see.

Tap anywhere or pull up → returns to Today. No timer, no auto-dismiss. Available 365 days a year.

**Rationale:** User said the Why should hit them first, but only when pulled down. Hidden behind a deliberate gesture keeps it sacred — seen when sought, not shouted.

### Week progress bar

Two metrics shown together:
- **Sessions completed this week** (e.g. "1 of 4")
- **Protein adherence** (rolling % across the week so far)

Combined into a single bar where filled = (sessions% + protein%) / 2. Not sophisticated; just gives a sense of "how's the week going."

Week starts Monday. Resets Monday 00:00 local time.

### The Big Four panel

Always shows: Incline Press, Deadlift, Back Squat, Pull-ups.

Each row:
- Lift name
- Level (e.g. L4)
- Current weight
- Streak dots (●○ = 1 max session, ●● = 2 = next session levels up)
- ⚡ icon if `streakAtMax === 2` (i.e. ready to level up next session)

Tap any row → goes to that lift's history view (in Levels screen).

### Today's session card

Reads the day of week, picks the session:
- Mon → Push
- Tue → Pull
- Wed → Legs
- Thu → Full Body
- Fri → "Friday flex — choose: cardio / extra session / rest"
- Sat → "Easy run · 45 min · the weekend ritual"
- Sun → "Rest day. Big day tomorrow."

Card shows: icon, session name, lift count, estimated duration, "Start session →" CTA.

For the run on Saturday: tapping it opens a simple log (distance + mood emoji + start timer for outdoor run).

### Next meal block

Only appears within a 90-minute window before/after a meal's default time. Logic:
- 04:30–05:30 → show pre-train shake row
- 06:30–07:30 → show breakfast row
- 13:00–14:00 → show lunch row
- 20:00–21:00 → show dinner row
- 21:30–22:30 → show dessert row
- Outside windows → block hidden

Three big buttons: **Eaten / Cheat / Skip.** Tap → updates meal state, block disappears.

### Today's meals summary

Five dots (`●●○○○`) showing today's meal states:
- ● filled = eaten
- ⚠ amber = cheat
- ✕ red = skipped
- ○ empty = not yet

Tap → opens Food tab.

### Sunday banner (Sunday only)

On Sundays, a banner appears above the Big Four:

```
SUNDAY · 3 minutes for the weekly review
[ Open review → ]
```

Tap → opens the Sunday review (see Drawer section).

### Monday banner (Monday only, shown until dismissed)

```
LAST WEEK · The verdict
80% on plan. Strong week.  [ See details → ]
```

Tap → expands to show the full Last Week panel (see Food section). Dismissable for the rest of the day.

### ISAK eve banner (day before measurement)

If the next ISAK appointment is tomorrow:
```
TOMORROW · ISAK with Ximena
Walk in without fear.
```

Soft, no buttons. Just there. **Rationale:** Captures the framework's emotional weight around the first measurement.

---

## 3. The Gym screen

The most important screen in the app. Where the work happens.

### Phone behaviour
- Wake Lock API requested on session start to keep screen on
- Released on session end or tab change
- Phone is on a bench/floor, big touch targets throughout

### Density: one thing at a time
Full-screen focused view. The user is not scrolling through a spreadsheet — they're being walked through a guided flow.

---

### 3.1 Pre-session screen

Reached from Today's session card "Start session →" or directly from the Gym tab.

```
PUSH DAY
Monday · Week 18

Today's lifts:
  Incline Barbell Press     L4 · 62.5kg · 4×8-10
  Seated DB Shoulder Press  L2 · 14kg   · 3×10-12
  Cable Chest Fly           L1 · 12kg   · 3×12-15
  Lateral Raises            L1 · 8kg    · 3×12-15
  Tricep Rope Pushdown      L2 · 22.5kg · 3×10-12

[ Bad sleep last night? ] toggle

[ Start session → ]
```

If "Bad sleep" toggled: all weights immediately drop 20% (rounded to 2.5kg) on display, "DELOAD" badge appears next to each lift. User confirms with the same Start button.

**BB/DB toggle for variant lifts:** The three press lifts that track separate barbell and dumbbell progressions (`incline-bb`, `db-shoulder-press`, `flat-db`) show a BB / DB toggle on the pre-session screen. The default is whichever variant was used most recently by session date; if neither has any history, BB is the default. The chosen variant carries through the entire session for that lift and is stored on the lift's session entry. The lift header shows the variant (e.g. "Incline Press · BB") and the end-of-session summary row appends a small BB/DB tag.

### 3.2 General mobility (5 minutes)

Auto-cycling timer through 4 movements:

| Time | Movement |
|---|---|
| 90s | 90/90 hip flow — rotate between positions |
| 90s | World's Greatest Stretch — lunge + T-spine, 5 each side |
| 60s | Band pull-aparts / shoulder rolls |
| 60s | Goblet squat hold |

Big timer, exercise name, brief instruction. Auto-advances. "Skip mobility" button always available.

### 3.3 Lift-specific warmup (first lift only)

Per the research: warmup sets are needed only on the heaviest compound lift of the day. That's the first lift in every session.

Format: **2-set ramp** (auto-calculated from working weight)

For incline press at 60kg working:
- Empty bar (~20kg) × 5
- ~30kg (50% rounded to 2.5kg) × 5

Display:
```
INCLINE PRESS · WARMUP

Set 1: Empty bar × 5
[ Tap when done ]

Set 2: 30 kg × 5
[ Tap when done ]
```

No rep entry, no logging, no scoring. Just confirms you've warmed up.

For pull-ups: warmup is 5 band-assisted pulls or 5 hanging scapula retractions, single tap.

For Full Body day: a single feeler set (1 set at 50% of flat DB press working weight) is offered between deadlift and flat press, since the movement plane changes. Single tap, skippable.

**"Skip warmup" available throughout.** Honest — not all sessions need it.

### 3.4 Lift screen (the main loop)

This is where most of the session is spent.

```
INCLINE BARBELL PRESS              [skip lift →]
Level 4 · 62.5kg · Streak ●○

Last time: 60kg → 9, 8, 8, 7  (1 pt)
Suggested: hit 10s on every set to level up

────────────────────────────────────────
              SET 2 of 4
              62.5 kg                       ← editable
                10                          ← huge digit
              [-]  [+]
       [  Set complete  ]                   ← fat primary CTA
────────────────────────────────────────

Sets done: ●● ●○                            Score: 2 / 8

[ ?  Why this lift ]
```

**The header**:
- Lift name
- Level + current weight + streak dots
- "skip lift →" link (top right)

**The "Last time" line — context-aware copy**:
- New lift, no history: *"First time on this lift. Pick a weight you can do for 8 reps."*
- Last sub-max: *"Last time: 60kg, 9-8-8-7 (1pt). Same weight today — push for 10s."*
- Last max: *"Last time: PERFECT 8/8. Hit max again today and you level up."*
- Two max ago, new weight: *"Two perfect sessions. New weight today: 62.5kg. Aim for 8 reps."*
- Deload day: *"Deload day: 50kg (20% off). Just complete the reps."*

**The set input**:
- Big "SET X of Y"
- Weight (big, tap to edit if dropping mid-lift)
- Reps as a huge number, defaulting to **top of rep range** (the optimistic target)
- `[ - ]` and `[ + ]` buttons either side of the rep number to adjust
- "Set complete" button — fat, full-width, primary lime colour

**isTime lifts (the plank):** Lifts with `isTime: true` suppress the weight field entirely — no kg input, no kg label, no deload weight shown. The big editable number becomes seconds held, labelled "sec". The `+` / `−` buttons adjust seconds. Scoring is unchanged: `sessionState` compares total seconds the same way it compares reps across all other lifts. The pre-session screen shows the plank as "3 × 30–60 sec" (never with a kg value).

**The footer**:
- "Sets done" dots — one per planned set, fills as you log
- "Score" — running total for this lift this session
- "? Why this lift" — tappable, opens a small modal with the framework's `note` text and form cues

### 3.5 Tap "Set complete" → rest screen

```
        REST
        2:00                                ← huge countdown
        ▓▓▓▓▓▓▓░░░░░░░░                    ← visual progress bar

  Next: Set 3 of 4 · 62.5kg · target 10

  [ +30s ]   [ −30s ]   [ Skip rest ]
```

Rest length is **smart by lift type**:
- Squat / Deadlift → **3:00**
- Compound (incline, flat press, OHP, row, RDL) → **2:00**
- Isolation (curls, raises, face pulls, pushdowns, fly) → **1:30**

Auto-starts on "Set complete" tap.

**At 30 seconds remaining**: full screen flashes amber, big "30 SECONDS" overlay text, fades back to countdown after 1.5s. Visual only — no sound, no vibration.

**At zero**: full screen flashes lime green, big "GO" overlay. Settles into a "Ready" state, dismissable.

**Tap anywhere outside buttons** → dismiss rest, return to lift screen ready for next set.

### 3.6 Lift complete → between lifts

After the final set of a lift:

```
INCLINE BARBELL PRESS · Done
Score: 6 / 8                Streak: ●○

[ Next lift: Seated DB Shoulder Press → ]
[ ← Go back to a previous lift ]
```

If a lift was skipped earlier, "Go back" surfaces it. If `streakAtMax === 2`, an extra line shows: *"⚡ LEVEL UP NEXT SESSION — 65kg"*.

### 3.7 Skip-ahead handling

Tap "skip lift →" on any lift screen:
- Lift goes into a "deferred" pile (stored in session.deferred array)
- User moves to the next lift in the programme
- After the last programme lift, app shows: *"Cable Fly still open — try now?"*
- User taps yes → returns to that lift screen
- User taps "End session early" → session closes, skipped lifts score 0 for the day

**Skipped-and-not-returned lifts**:
- Score 0 (counted in weekly total)
- Don't break the streak (per locked decision)
- Logged with `null` sets, marked skipped

### 3.8 Time-pressed mode

Toggle on the pre-session screen:
```
[ Time-pressed mode? ]
```

When enabled: user picks 2-3 lifts from the day's session (the compound is auto-pre-selected, user adds 1-2 isolation lifts). Other lifts are skipped automatically with a "time-pressed" tag — they don't count against streak. Logs the session honestly as a partial.

**Rationale:** Newborn-disrupted weeks where 60 minutes isn't possible. Better than a missed session, better than a guilt-driven full session on no sleep.

### 3.9 Substitutions

Equipment unavailable (broken, taken, gym closed):
- Each lift has a small `[ ⇄ Substitute ]` link
- Tap → list of approved subs for that lift (e.g. Incline BB → Incline DB)
- The substitute is logged with a note, scoring works the same way against the substitute's own progression

Approved substitution list (in `programme.js`):
```js
{
  'incline-bb': ['incline-db', 'machine-incline-press'],
  'pullup':     ['lat-pulldown', 'assisted-pullup'],
  'squat':      ['goblet-squat', 'leg-press-heavy'],
  'deadlift':   ['trap-bar-deadlift', 'rdl-heavy'],
  // ...
}
```

Default: no sub. The framework rule is "do not change exercises." Subs are a release valve, not a feature to be encouraged.

### 3.10 End-of-session summary

```
PUSH DAY · Done
─────────────────────────────────
Session score: 26 / 40

Incline Press      6/8   ●●  ⚡ LEVEL UP NEXT
DB Shoulder Press  4/6   ●○
Cable Fly          5/9   ○○
Lateral Raises     7/9   ○○
Tricep Pushdown    4/6   ●○

This week: 26 / 180  (Mon 1 of 4)

What got in the way?                        ← only shown if score < 50% of max
[ Nothing ] [ Bad sleep ] [ Work ]
[ Family ] [ Illness ] [ Travel ] [ Didn't feel it ]

[ Send accountability message ]
[ Add a note ]
[ Done ]
```

**Score breakdown**: per-lift score and streak dots. ⚡ badge on any lift that hit second consecutive max.

**Weekly running total**: shows where this session takes the weekly score and out of how many sessions.

**"What got in the way?" prompt**: only shown if total session score is <50% of max possible OR a session was skipped entirely. Quick-tap categories. Selection is logged silently in `disruptions[date]`. Used in Trends to surface patterns ("3 of last 4 missed sessions were 'didn't feel it'").

**Send accountability message**: opens phone share sheet with pre-written one-liner: *"Push day done — 26/40, 1/4 sessions this week."* User picks a contact and sends.

**Add a note**: free text, optional, stored on the session record.

### 3.11 Pre-session accountability message

A subtle prompt **before** starting the session (just before the "Start session" button):

```
[ Tell someone you're training → ]
```

Tap → share sheet with pre-written: *"Going in for Push day. Back in 60."*

**Rationale:** Goggins' rule — external accountability removes the option to bail. Framework calls for this every training morning. Optional, never blocking.

---

## 4. The Food screen

Tick-box meal logging. The user knows what they're eating; the app records adherence.

### 4.1 Day view

```
TODAY · 4 May
─────────────────────────────────
Protein  ███████░░░░  98 / 150g
Meals    ●●○○○         2 of 5 on plan
Bites    🍪🍪🍪          3 today
─────────────────────────────────

05:00  Pre-train shake               [✓] [⚠] [✕]
07:00  Pa amb tomàquet + 4 eggs      [✓] [⚠] [✕]
13:30  Lunch — protein + carbs + veg [✓] [⚠] [✕]    ← prominent if it's near 13:30
20:30  Yogurt bowl                   [✓] [⚠] [✕]
21:30  Dark chocolate + nuts         [✓] [⚠] [✕]

─────────────────────────────────
[ 🍽️  Family meal ]    [ 🍪 Bite (×3 today) ]
─────────────────────────────────

[ ‹ Yesterday ]  [ Today ]  [ Tomorrow › ]
```

### 4.2 Meal states

Each meal cycles through: **null → eaten → cheat → skipped → null** on repeated taps, OR direct selection via the three buttons.

| State | Symbol | Counts toward protein? | Counts as on plan? |
|---|---|---|---|
| null (not yet logged) | ○ | No | Not yet counted |
| Eaten | ✓ green | **Yes** | **Yes** |
| Cheat | ⚠ amber | No | No |
| Skipped | ✕ red | No | No |
| Replaced (by family meal) | 🍽️ | No | No (tracked separately) |

### 4.3 Family meal flow

Tap **🍽️ Family meal** button:

```
Which meal does this replace?
[ Lunch ]  [ Dinner ]  [ Dessert ]  [ Cancel ]
```

Selected meal flips to `replaced` state. Family meal is logged on the day.

Limit: 1-2/week is fine, 3+ flagged in Last Week panel.

### 4.4 Bite counter

Tap **🍪 Bite** button: increments the day's bite count by 1. Visible counter on the button.

For now: no kcal/protein impact. Just a count. Reviewed at the next ISAK measurement to decide if the model needs refining.

### 4.5 Daily summary panel (top of view)

Three rows:
- **Protein bar**: filled = sum of (eaten meals' protein), target = 150g
- **Meals**: 5 dots reflecting state
- **Bites**: emoji count

### 4.6 Day navigation

Arrow buttons to navigate between days. User can backdate logs (forgot to tick yesterday's breakfast → no problem).

### 4.7 Last Week panel

**Permanent** at the top of the Food tab (above the day view). Always shows the **most recent completed week**.

```
LAST WEEK · 28 Apr – 4 May

PLANNED MEALS  35 total
✓ Eaten        28  (80%)
⚠ Cheat         4  (11%)
✕ Skipped       3  ( 9%)

OFF PLAN
🍽️  Family meals: 1   ✓ on target
🍪 Bites: 11          ⚠ creeping up

THE VERDICT
80% on plan. 1 family meal.
Bites averaging 1.5/day — watch this.

[ Show last 4 weeks → ]
```

**Verdict logic**:
- ≥85% on plan → *"Strong week. Keep going."*
- 70–84% → *"On the line. 80/20 holding."*
- <70% → *"Below target. Reset this week."*
- Family meals >2 → ⚠ flag
- Bites >7/week → ⚠ flag (rough threshold, adjustable)

**No cheerleading.** Truth, sometimes uncomfortable.

### 4.8 Last 4 weeks expand

Tap "Show last 4 weeks" → shows compact table:

```
Week     On plan  Family  Bites
W18      80%      1       11
W17      88%      2       6
W16      72%      3       14   ⚠
W15      85%      0       8
```

Trends visible at a glance.

### 4.9 Data retention

**All time, stored locally.** Last Week panel can scroll back through every week ever logged. Nothing gets deleted automatically. Export captures everything.

---

## 5. The Trends screen

Long-term progress visible. Built for honest reflection, not motivation.

### 5.1 Sections

#### Weekly score graph
Line chart, X = week number, Y = total weekly score. 12 weeks visible, scrollable for more. The Musk graph.

```
WEEKLY SCORE                           [ all-time | 12w | 4w ]

  180 ┤                              ●
  150 ┤                  ●     ●  ●  
  120 ┤    ●  ●        ●          
   90 ┤ ●     
   60 ┤
      └─────────────────────────────────
       W6  W7  W8  W9  W10 W11 W12 W13 W14
```

Tap a point → shows the week's breakdown.

#### Per-lift weight progression
A panel per KPI lift showing weight over time:

```
INCLINE PRESS
50kg ──→ 62.5kg over 8 weeks  (+12.5kg)
[mini sparkline]
```

Tap → expands to full lift history (level-ups marked).

#### Nutrition adherence
Line chart of weekly on-plan %. Same time-axis as score graph. Easy to spot when food and training correlate.

#### Disruption patterns
A small panel showing what's been getting in the way:

```
DISRUPTIONS · last 8 weeks
Bad sleep    ████████  8
Work         ████      4
Didn't feel  ██        2
Family       █         1
```

**Rationale:** "Didn't feel it" data shows when motivation is the actual problem vs life is. Useful for Sunday review honesty.

### 5.2 Body composition trend
Brief mini-chart of waist + ratio from ISAK history. Tap → goes to ISAK tab.

---

## 6. The ISAK screen

Body composition tracking. The honest mirror of the framework.

### 6.1 Headline (top of screen)

Six big metric cards, two per row:

```
WAIST           RATIO
91.0 cm         0.57
↓ 4.0 since     ↓ 0.10 since
Apr-25          Apr-25
                ⚠ ↑ from 0.54
                  peak

FAT MASS        MUSCLE MASS
20.33 kg        35.88 kg
↓ 2.98 since    ↑ 1.28 since
Apr-25          Apr-25

Σ6 SKINFOLDS    WEIGHT
87.0 mm         87.2 kg
↓ 18 since      ↓ 3.3 since
Apr-25          Apr-25
```

Each card:
- Big current value
- Δ since first measurement
- ⚠ peak warning if current is worse than best-ever (specifically the November 2025 peak for ratio/fat/skinfolds)

### 6.2 Trend chart

One full-width chart below the cards. Six toggle buttons above:

```
[ Waist ] [ Ratio ] [ Fat ] [ Muscle ] [ Σ6 ] [ Weight ]
```

Tap one → chart redraws. X-axis = date (8 dots minimum from seed data). Y-axis auto-scales.

Overlay lines (dashed):
- November 2025 peak (purple)
- 3-month target (amber)
- 6-month target (orange)
- 12-month target (red)

Tap a dot → tooltip with date + value.

### 6.3 Targets panels

Two stacked tables.

**Return to peak (interim)**:
```
RETURN TO NOV 2025 PEAK
Ratio:       0.57 → 0.54
Fat mass:    20.33 → 19.33 kg
Σ6 skinfolds: 87 → 81 mm
```

**Forward path** (recalibrated from 28-Apr-2026 baseline):
```
              Now    3mo    6mo    12mo
Waist        91.0   87     84     80
Ratio        0.57   0.54   0.50   0.46
Fat mass     20.3   17.5   14.5   12.0
Weight       87.2   85     82     79
```

3-month ratio target adjusted from framework's 0.52-0.54 (too aggressive while cutting) to **0.54** — return to peak first, then push.

### 6.4 Expand panel (collapsible)

```
[ ▽ Show all measurements ]
```

Expanded → shows everything else from the PDF:
- Individual 6 skinfolds
- Hips, mid-thigh, calf, arm-relaxed, arm-flexed perimeters
- BMI, waist/height, waist/hip ratios
- Faulkner fat mass + fat-free mass (alternative methods)
- Date + days since previous

Each metric shows current value + Δ from previous measurement.

### 6.5 Add measurement form

```
[ + Add new measurement ]
```

Opens a form:
```
Date:      [ 28 Apr 2026 ]
Weight:    [ 87.2 ] kg
Waist:     [ 91.0 ] cm
Σ6 skinfolds: [ 87.0 ] mm           ← single field, read off PDF
Fat mass (Kerr): [ 20.33 ] kg
Muscle mass (Lee): [ 35.88 ] kg

[ ▽ More details (optional) ]
  → Hips, height, individual skinfolds, perimeters

[ Save measurement ]
```

On save: recomputes ratio, deltas, peak comparisons, redraws chart.

### 6.6 Excluded from UI (in data model only)

- BMI as headline (framework: "ignore this number")
- Z-scores
- Basal metabolism, surface area, heat loss index
- Pie charts (replaced by trend lines)
- Brazo/muslo/pierna corregido perimeters

These can live in the data model for completeness but don't pollute the UI.

---

## 7. The Levels screen

Full breakdown of all 20 lifts. Long-term sense of growth.

### 7.1 Layout

```
LEVELS

Sort by: [ Recent ] [ Closest to level up ] [ By session ]

⚡ READY TO LEVEL UP                       ← only shown if any lift ●●
  Deadlift           L6 → L7   120 → 125kg

CLOSE                                      ← lifts at ●○
  Incline Press      L4 ●○    62.5kg
  Tricep Pushdown    L2 ●○    22.5kg

ALL LIFTS
  Push:
    Incline Press      L4    62.5kg
    DB Shoulder Press  L2    14kg
    Cable Fly          L1    12kg
    Lateral Raises     L1    8kg
    Tricep Pushdown    L2    22.5kg

  Pull:
    Pull-ups           L2    +5kg
    Cable Row          L3    50kg
    DB Row             L2    20kg
    Face Pulls         L1    14kg
    DB Curl            L1    10kg

  Legs:
    [...]

  Full Body:
    [...]
```

**Variant lifts in the list:** `incline-bb`, `db-shoulder-press`, and `flat-db` each appear as a single row. The row shows the most-recently-used variant's weight, last result, and last reps, with a small BB or DB tag appended to the lift name. There are no split rows.

### 7.2 Lift detail (tap any row)

Full history for that lift:
- Current level + weight + streak
- Chart of weight over time with level-up markers
- Last 10 sessions: weight, reps per set, score, deload flag
- The lift's framework note + form cues

**Variant lift detail:** For `incline-bb`, `db-shoulder-press`, and `flat-db`, the detail view shows BB and DB tab buttons below the lift name. Tapping a tab switches the entire detail view — weight, history, mission line — to that variant's progression. The "Bump weight" sheet writes back to the active variant only.

---

## 8. The Drawer

Accessed from the menu icon in the top bar. Slides up from bottom.

### 8.1 Sections

**The Why**
> *My daughters will look back at photos of me and see a father who took care of himself.*
>
> On every hard morning at 5am, the question is not: do I feel like it. The question is: what do I want my daughters to see.

**Sunday review** (only on Sundays, or "Last review: W18 ✓" otherwise)
Tap → opens 5-question form:
1. Sessions completed this week — yes/no (auto-filled from data)
2. Protein target hit most days — yes/no (auto-filled from data)
3. Waist feel — better / same / worse
4. Energy levels — 1 to 5
5. Did anything disrupt the plan? — multi-select tags + free text

Submit → stored in reviews[week].

**Habits**
- ✓ Kit laid out for tomorrow (only shown evenings before training days)
- ✓ Mobility done today (dead hangs, twice/week)

**Photo log**
"Last photo: 1 month ago. [ Take new photo ]"
Camera input, stores base64 to localStorage. Monthly cadence.

**Backup**
- Export JSON (downloads a .json file)
- Import JSON (file picker, replaces current state with confirmation)

**Reset**
- Wipe all data (with confirmation modal)

**About**
- Version, build date, link to framework doc

---

## 9. Cross-cutting features

### 9.1 Wake Lock
Active during gym sessions only. Released on tab change or session end. Falls back gracefully if Wake Lock API unavailable.

### 9.2 Hash routing
- `#/today`
- `#/gym` → session picker if no active session, else current session screen
- `#/food`
- `#/trends`
- `#/isak`
- `#/levels`

### 9.3 Date/time handling
- All dates stored as ISO `yyyy-mm-dd` (no timezone drift)
- Weeks computed as ISO weeks (Mon start)
- All timestamps in UTC, displayed in local time

### 9.4 Bad sleep deload
- Toggle on pre-session screen
- All weights × 0.8, rounded to 2.5kg
- Session flagged `deload: true`
- Scoring works normally
- **Level-up streak does NOT advance from deload sessions**

### 9.5 Accessibility
- Min 48px touch targets
- High contrast (dark BG, light text, lime accent)
- Visible focus states
- No essential info conveyed by colour alone

### 9.6 Performance
- No external dependencies unless absolutely needed
- Inline SVG for charts (no chart library if avoidable)
- `localStorage` writes debounced (per logical action, not per keystroke)
- View transitions are instant (no animations beyond essential feedback)

---

## 10. Seed data

The app ships with the user's existing 8 ISAK measurements pre-loaded.

### 10.1 ISAK seed (in `data/seed.json`)

```json
{
  "isak": {
    "2025-04-08": {
      "weight": 90.5, "waist": 95.0, "fatMass": 23.31, "muscleMass": 34.60,
      "skinfoldSum": 105, "height": 169
    },
    "2025-07-24": {
      "weight": 87.8, "waist": 93.3, "fatMass": 21.65, "muscleMass": 34.22,
      "skinfoldSum": 95, "height": 169
    },
    "2025-08-29": {
      "weight": 86.5, "waist": 91.0, "fatMass": 20.99, "muscleMass": 33.93,
      "skinfoldSum": 91, "height": 169
    },
    "2025-11-05": {
      "weight": 90.0, "waist": 90.5, "fatMass": 19.33, "muscleMass": 36.02,
      "skinfoldSum": 81, "height": 169
    },
    "2025-12-13": {
      "weight": 89.0, "waist": 92.0, "fatMass": 19.66, "muscleMass": 35.09,
      "skinfoldSum": 83, "height": 169
    },
    "2026-01-17": {
      "weight": 89.0, "waist": 92.0, "fatMass": 19.66, "muscleMass": 35.09,
      "skinfoldSum": 83, "height": 169
    },
    "2026-03-19": {
      "weight": 88.8, "waist": 89.9, "fatMass": 20.25, "muscleMass": 34.70,
      "skinfoldSum": 86.5, "height": 169
    },
    "2026-04-28": {
      "weight": 87.2, "waist": 91.0, "fatMass": 20.33, "muscleMass": 35.88,
      "skinfoldSum": 87.0, "height": 169
    }
  }
}
```

(Note: 2025-12-13 and 2026-01-17 share the same numbers — the Jan report uses Dec as "previo." May be one measurement double-recorded. Dedupe in code if desired.)

### 10.2 Programme seed
The full lift catalogue is defined in `programme.js` (see appendix below). No DB seed needed for lifts — they're code constants.

### 10.3 First-run lift weights
On first session of any lift, user enters their starting weight. App initialises that lift's state with `level: 1, weight: <entered>, streakAtMax: 0`.

Suggested starting weights (in `programme.js` as defaults the user can override):

| Lift | Suggested start |
|---|---|
| Incline BB Press | 40-50kg |
| DB Shoulder Press | 12-16kg |
| Cable Fly | 10-12kg |
| Lateral Raises | 6-8kg |
| Tricep Pushdown | 18-22kg |
| Pull-ups / Pulldown | bodyweight / 50-60kg |
| Cable Row | 40-50kg |
| DB Row | 18-22kg |
| Face Pulls | 12-15kg |
| DB Curl | 8-12kg |
| Squat | 50-60kg |
| RDL | 50-60kg |
| Leg Press | 80-100kg |
| Back Extensions | bodyweight |
| Leg Curl | 30-40kg |
| Deadlift | 70-90kg |
| Flat DB Press | 16-22kg |
| BB Row | 40-50kg |
| Standing OHP | 16-22kg |
| Plank | 30-45sec |

These are starting points only — user adjusts on first session.

---

## 11. Decision log

Every meaningful design decision and why it was made. **Don't reverse without updating this section.**

| # | Decision | Rationale |
|---|---|---|
| 1 | Plain HTML/CSS/JS, no build step | Maintainability, GitHub Pages deploy, user wants clean code |
| 2 | localStorage only, JSON export | Simplicity, no backend, full data ownership |
| 3 | 6 tabs (Today/Gym/Food/Trends/ISAK/Levels) | Each tab has a clear job; no overlap |
| 4 | Double progression with 2-max streak | Research-backed for early intermediate on a deficit; user explicitly rejected linear +2.5kg/session as fantasy |
| 5 | Per-rep granular scoring (reps − repsMin) | User chose this over simple 0/1/2 or % models |
| 6 | Skipped lift doesn't break level-up streak | User's call — sometimes runs out of time, shouldn't be punished |
| 7 | Bad sleep deload doesn't advance streak | Prevents gaming the system |
| 8 | Per-lift increments by category | Research: lower compounds tolerate +5kg, upper +2.5kg, isolation +1kg |
| 9 | Warmup ramp on first lift only | Research: only heaviest compound needs it; respect 60-min budget |
| 10 | Smart rest timer per lift type (3/2/1.5min) | Standard sport-science recommendations |
| 11 | Visual-only timer alerts (no sound/vibration) | User in noisy gym, doesn't want to be rude |
| 12 | Auto-start rest on "Set complete" | Zero friction — user just rests |
| 13 | Pre-set 5 meals, tick-box only | User knows what they eat; app's job is adherence tracking |
| 14 | Three meal states: Eaten/Cheat/Skip | Captures the three real outcomes |
| 15 | Family meal replaces a planned slot | Asks user which slot, keeps the math honest |
| 16 | Bite is a counter, no kcal/protein | Start simple, decide at next ISAK if more is needed |
| 17 | Monday morning Last Week banner | User said "maybe Monday morning" — Saturday/Sunday are sacred |
| 18 | All-time meal data retention | User's call — wants to compare W18 vs W4 vs W50 |
| 19 | Why hidden behind pull-down | User wants it sacred, not wallpaper |
| 20 | Big Four KPI lifts on Today | Single panel, not all 20; KPIs are the long-term progress signal |
| 21 | Weekly score = sum of all set points Mon-Sun | Single number, motivates the week |
| 22 | Lift levels never reset | Slow, durable, satisfying long-term progress |
| 23 | ISAK headline = 6 cards (all 6 metrics) | User chose this over minimal-3 |
| 24 | Both peak-return + forward targets shown | User chose both — peak is the honest stepping stone |
| 25 | Manual ISAK entry (no PDF parsing) | User said "I'll add it by code" — simpler v1 |
| 26 | Photo log added | Framework's emotional core is "daughters look at photos" — needs actual photos |
| 27 | Pre- AND post-session accountability | Framework intent is pre, user wanted post; both is correct |
| 28 | Time-pressed mode | Newborn-disrupted weeks need a release valve |
| 29 | "What got in the way?" on missed/low sessions | Builds disruption pattern data over 12 weeks |
| 30 | Substitutions list (limited, locked) | Equipment edge cases shouldn't kill a session |
| 31 | Kit-laid-out check | Mourinho's rule, framework says it prevents 80% of skipped sessions |
| 32 | Sunday review banner on Sundays | User wants it more prominent than just in drawer |
| 33 | Run logging with mood emoji | Framework: run is sacred, captures mental state too |
| 34 | Dead hang / mobility daily checkbox | Framework calls this "non-negotiable for joint health" |
| 35 | Exercise instruction popups | Cheap, valuable, especially weeks 1-4 |
| 36 | No streaks-with-fire, badges, chimes | User chose "Light gamification" |
| 37 | No RPE input | User's words: "RPE is nonsense" |
| 38 | No BMI as primary metric | Framework: "ignore this number" |
| 39 | BB/DB variant tracking for `incline-bb`, `db-shoulder-press`, `flat-db` | Barbell and dumbbell are mechanically different lifts — loads, range of motion, and stabiliser demand differ enough that they cannot share a weight or progression streak. Merging them would corrupt the double-progression model. |
| 40 | Variant lifts appear as a single row in Big Four and Levels | Splitting them would double the catalogue length and clutter both screens. The most-recently-used variant is shown with a small tag so the user always knows which they're looking at. |
| 41 | isTime lifts (plank) render in seconds with no weight field | A plank is held for time, not loaded. Showing a kg field or a deload weight is meaningless and confusing. The existing double-progression scoring works fine with seconds as the unit. |
| 42 | The variant and isTime changes were made mid-programme by explicit decision, with SPEC and code updated together | Avoids spec drift. Future readers should treat these as first-class design decisions, not workarounds. |

---

## Appendix A: Full lift catalogue

```js
// programme.js
export const SESSIONS = {
  push: {
    id: 'push', name: 'Push', day: 1,
    subtitle: 'Chest · Shoulders · Triceps',
    icon: '⤒',
    note: 'Priority: upper chest and shoulders.',
    lifts: [
      { id: 'incline-bb', name: 'Incline Barbell Press',
        sets: 4, repsMin: 8, repsMax: 10, increment: 2.5, kpi: true,
        firstLift: true, note: 'Upper chest priority. 30-45° incline.' },
      { id: 'db-shoulder-press', name: 'Seated DB Shoulder Press',
        sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,
        note: 'Builds shoulder width.' },
      { id: 'cable-fly', name: 'Cable Chest Fly (low to high)',
        sets: 3, repsMin: 12, repsMax: 15, increment: 2.5,
        note: 'Cable set low, pull upward.' },
      { id: 'lat-raise', name: 'Lateral Raises',
        sets: 3, repsMin: 12, repsMax: 15, increment: 1,
        note: 'Lighter weight, full control.' },
      { id: 'tricep-pushdown', name: 'Tricep Rope Pushdown',
        sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,
        note: 'Keep elbows pinned.' }
    ]
  },
  pull: {
    id: 'pull', name: 'Pull', day: 2,
    subtitle: 'Back · Biceps',
    icon: '⤓',
    note: 'A strong back pulls posture up.',
    lifts: [
      { id: 'pullup', name: 'Pull-ups / Lat Pulldown',
        sets: 4, repsMin: 6, repsMax: 10, increment: 2.5, kpi: true,
        firstLift: true, bodyweight: true,
        note: 'Pull-ups: max reps. Pulldown: 4 challenging sets.' },
      { id: 'cable-row', name: 'Seated Cable Row',
        sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,
        note: 'Squeeze shoulder blades.' },
      { id: 'db-row', name: 'Single-Arm DB Row',
        sets: 3, repsMin: 8, repsMax: 10, increment: 2.5,
        note: 'Brace on bench. Pull elbow to hip.' },
      { id: 'face-pull', name: 'Face Pulls',
        sets: 3, repsMin: 12, repsMax: 15, increment: 1,
        note: 'Shoulder health essential.' },
      { id: 'db-curl', name: 'DB Bicep Curl',
        sets: 3, repsMin: 10, repsMax: 12, increment: 1,
        note: 'No swinging. 3 seconds down.' }
    ]
  },
  legs: {
    id: 'legs', name: 'Legs', day: 3,
    subtitle: 'Squats · Hinges · Posterior',
    icon: '⤳',
    note: 'Biggest muscles = biggest calorie burn.',
    lifts: [
      { id: 'squat', name: 'Back Squat / Goblet Squat',
        sets: 4, repsMin: 8, repsMax: 10, increment: 5, kpi: true,
        firstLift: true, note: 'Goblet if technique needs work. Depth over weight.' },
      { id: 'rdl', name: 'Romanian Deadlift',
        sets: 3, repsMin: 8, repsMax: 10, increment: 2.5,
        note: 'Hinge at hips, soft knee.' },
      { id: 'leg-press', name: 'Leg Press',
        sets: 3, repsMin: 10, repsMax: 12, increment: 5,
        note: 'High foot placement. Push through heels.' },
      { id: 'back-ext', name: 'Back Extensions',
        sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,
        note: 'Slow, controlled. No hyperextension.' },
      { id: 'leg-curl', name: 'Leg Curl',
        sets: 3, repsMin: 10, repsMax: 12, increment: 2.5,
        note: 'Hamstring isolation. 3 seconds down.' }
    ]
  },
  full: {
    id: 'full', name: 'Full Body', day: 4,
    subtitle: 'Heavy · Functional',
    icon: '⊕',
    note: 'Heavy and functional. Your strongest session.',
    lifts: [
      { id: 'deadlift', name: 'Deadlift',
        sets: 4, repsMin: 5, repsMax: 6, increment: 5, kpi: true,
        firstLift: true, note: 'The king. Your primary KPI lift.' },
      { id: 'flat-db', name: 'Flat DB Press',
        sets: 3, repsMin: 8, repsMax: 10, increment: 2.5,
        feelerWarmup: true,
        note: 'Lower chest and overall thickness.' },
      { id: 'bb-row', name: 'Barbell Row',
        sets: 3, repsMin: 8, repsMax: 10, increment: 2.5,
        note: 'Bent over, bar to belly button.' },
      { id: 'standing-press', name: 'Standing DB Shoulder Press',
        sets: 3, repsMin: 8, repsMax: 10, increment: 2.5,
        note: 'Standing engages core.' },
      { id: 'plank', name: 'Plank',
        sets: 3, repsMin: 30, repsMax: 60, increment: 0, isTime: true,
        note: 'Reps = seconds held.' }
    ]
  }
};
```

---

## Appendix B: Scoring functions reference

```js
// scoring.js

export function setPoints(reps, lift) {
  if (reps == null || reps < lift.repsMin) return 0;
  const rangeSize = lift.repsMax - lift.repsMin;
  return Math.min(reps - lift.repsMin, rangeSize);
}

export function liftScore(sets, lift) {
  return sets.reduce((sum, set) => sum + setPoints(set.reps, lift), 0);
}

export function maxLiftScore(lift) {
  return lift.sets * (lift.repsMax - lift.repsMin);
}

export function isLiftMax(sets, lift) {
  return liftScore(sets, lift) === maxLiftScore(lift);
}

export function shouldLevelUp(liftState) {
  return liftState.streakAtMax >= 2;
}

export function nextWeight(liftState, lift) {
  if (shouldLevelUp(liftState)) {
    return liftState.weight + lift.increment;
  }
  return liftState.weight;
}

export function applyDeload(weight) {
  // 20% off, rounded to 2.5kg
  const reduced = weight * 0.8;
  return Math.round(reduced / 2.5) * 2.5;
}

export function weeklyScore(sessions, weekStart, weekEnd) {
  return Object.entries(sessions)
    .filter(([date]) => date >= weekStart && date <= weekEnd)
    .reduce((total, [_, session]) => {
      return total + Object.values(session.lifts || {})
        .reduce((s, e) => s + (e.score || 0), 0);
    }, 0);
}
```

---

End of spec. Build with care.
