# Six Mental Models for Distance–Rate–Time Problems

*How to translate a word problem into algebra — and why the translation works*

---

## Why models instead of steps

A procedure tells you what to do. A mental model tells you what's *true*, which means it keeps working when the problem doesn't match the template you memorized.

The gap most people hit with d = rt isn't the formula. It's the moment after reading the problem when they have numbers on the page and no idea what equation to write. That gap is a translation failure, not a math failure. These six models close it.

They stack. Model 1 makes the formula intuitive. Model 2 changes what you think the formula is *for*. Model 3 produces the equation. Model 4 tells you it's a small space. Model 5 tells you where to put the letter. Model 6 handles the exception and the trap.

---

## Model 1 — A rate is an exchange rate, not a measurement

### The idea

"60 mph" is not a description of how the car feels. It's a **currency conversion between hours and miles**: one hour buys sixty miles.

Once you hold it that way, you never have to remember whether to multiply or divide, because you already know how conversions work:

- You have 3 hours, you want miles → multiply by the rate → 180 miles
- You have 180 miles, you want hours → divide by the rate → 3 hours

Identical to converting dollars to pesos. You don't memorize "multiply for pesos, divide for dollars." You just know which direction you're going.

### Why this works

The unit *is* the operation. "Miles per hour" literally reads as *miles divided by hours* — the word "per" is a division sign written in English. So the units carry the arithmetic:

| Setup | Units | Result |
|---|---|---|
| 120 miles ÷ 3 hours | miles/hour | a rate ✓ |
| 40 miles/hour × 3 hours | (miles/hour)·hour → hours cancel → miles | a distance ✓ |
| 40 miles/hour × 45 minutes | (miles/hour)·minutes → **nothing cancels** | nonsense ✗ |

That third row is the whole reason unit conversion matters, and it's why "always convert first" stops feeling like a rule and starts feeling obvious. You'd never convert 45 *euros* using a dollars-to-pesos rate. Feeding minutes into a miles-per-*hour* rate is the same category of error.

### What it fixes

- The multiply-or-divide hesitation
- Unit mismatch, because mismatch now *looks* wrong rather than being technically wrong
- Reversed setups — if your answer comes out in "hours per mile squared," you inverted something

### Working it

**Convert before you compute, every time.** Minutes → hours means divide by 60:

| Minutes | Hours |
|---|---|
| 15 | 0.25 |
| 20 | 1/3 ≈ 0.333 |
| 30 | 0.5 |
| 40 | 2/3 ≈ 0.667 |
| 45 | 0.75 |
| 50 | 5/6 ≈ 0.833 |
| 90 | 1.5 |

*A runner averages 8 mph. How far in 45 minutes?*
45 min = 0.75 h. Then 8 × 0.75 = **6 miles**. Using 45 raw gives 360 — off by exactly the factor of 60 you failed to divide by.

*A car covers 15 miles in 20 minutes. Rate in mph?*
20 min = 1/3 h. 15 ÷ (1/3) = **45 mph**.

Distance units mismatch too. 1 mile = 5,280 ft; 1 km = 1,000 m. Handy: **60 mph = 88 ft/s** (60 × 5280 ÷ 3600).

### Habit

Write the unit next to every number you record. If two rows disagree in the same column, stop and convert before writing any algebra.

---

## Model 2 — d = rt is a vocabulary, not an equation

### The idea

This is the model that unlocks the rest, and it's the one almost nobody is taught explicitly.

In a problem with two movers, **d = rt is never the equation you solve.** It's how you *name* each traveler's distance in terms of a single unknown.

Kayla's distance is not a number sitting somewhere in the problem waiting to be found. It's the phrase `1.2(r + 35)`. You're not solving anything yet. You're translating each mover into a sentence written in the language of one variable.

### Why people get stuck without it

They read the problem hunting for numbers, find that some quantities are missing, and conclude the problem is under-specified. It isn't. Those quantities aren't missing — they're **expressions**, and you build them.

The Distance column is never given and never guessed. It's always manufactured: `rate × time` for that row, whatever those happen to be, including messy things like `(r + 35)` and `(t − 2)`.

### Seeing it work

> *Jose left the airport driving toward the mountains. Kayla left 2.1 hours later, traveling 35 mph faster in an effort to catch up. After 1.2 hours of driving, Kayla caught him. Find Jose's average speed.*

Nothing here looks like a distance. That's fine — you're going to build both.

Let r = Jose's rate. Kayla drove 1.2 h; Jose had been driving 2.1 + 1.2 = 3.3 h.

| | Rate | Time | Distance (built) |
|---|---|---|---|
| Jose | r | 3.3 | 3.3r |
| Kayla | r + 35 | 1.2 | 1.2(r + 35) |

Both distances now exist, both written in the same letter. **Translation complete.** Still no equation.

The equation comes from Model 3.

### The mistake this prevents

Trying to write the equation while you're still reading. You can't. The equation is a statement about the relationship *between* the two phrases, so it doesn't exist until both phrases do. If you feel yourself reaching for an equals sign before both rows are full, stop and finish translating.

---

## Model 3 — Freeze the clock at the instant the problem describes

### The idea

Every one of these problems names one specific moment: *when they meet*, *when she catches him*, *when they're 300 miles apart*, *when he gets home*.

Stop the movie at that frame. Ask one question:

> **What is physically true right now?**

Your answer to that question is your equation.

### Reading the frame

| The frozen moment | What's physically true | Equation |
|---|---|---|
| "She catches him" | They are standing in the same spot, having started from the same spot | d₁ = d₂ |
| "They are 300 miles apart" | The gap measures 300 | d₁ + d₂ = 300 |
| "The towns are 180 miles apart and they meet" | Together they've closed the whole gap | d₁ + d₂ = 180 |
| "The round trip took 5 hours" | The stopwatch reads 5 | t₁ + t₂ = 5 |
| "They left at the same time" | Both stopwatches read the same | t₁ = t₂ (just use one `t`) |

Notice you didn't apply a rule. You looked at the frame and read off a fact. That's the difference between recalling and understanding — and it's why this survives problems you've never seen.

### Why the diagram earns its thirty seconds

The stick-figure sketch isn't decoration. It's the device that produces the frozen frame:

- Arrows pointing **apart** → the gap is the sum of what each covered → distances add
- Arrows pointing **toward each other** → same thing, gap closes → distances add
- Arrows pointing **the same direction** → at catch-up they're at one point on one road → distances equal
- **Out and back on the same line** → same road both ways → distances equal, and the clock ran through both → times add

Draw it and the add-or-equate question answers itself. Skip it and you're guessing.

### Seeing it work

**Apart.** *A bus (50 mph) and a car (55 mph) leave the same place at the same time in opposite directions. When are they 210 miles apart?*

Same start time → one `t` for both. Distances: 50t and 55t.
Freeze the frame: the gap is 210, and the gap is what each of them contributed.

50t + 55t = 210 → 105t = 210 → **t = 2 hours**
*Check:* 100 + 110 = 210 ✓

**Catch-up.** *You drive 60 mph. Two hours later your wife leaves the same house at 90 mph on the same road. When does she catch you, and where?*

Let t = your driving time; hers is t − 2. Distances: 60t and 90(t − 2).
Freeze the frame at the catch: **you are in the same place, and you both started from the house.** So you've covered the same distance.

60t = 90(t − 2) → 60t = 90t − 180 → 180 = 30t → **t = 6 hours** (yours), 4 hours of hers
Distance: 60 × 6 = **360 miles**. Check with her row: 90 × 4 = 360 ✓

Both problems have two people and two rates. The equations are completely different, and the *only* thing that determined which one to write was the frozen frame.

### Finishing Model 2's example

Back to Jose and Kayla. Frozen frame: "Kayla caught him" → same spot, same start → distances equal.

3.3r = 1.2(r + 35) → 3.3r = 1.2r + 42 → 2.1r = 42 → **r = 20 mph**

---

## Model 4 — Two quantities, two ways to combine. That's the entire space.

### The idea

Only two things in these problems ever combine: **distance** and **time**. And each one combines in exactly one of two ways: it either **matches** or it **sums**.

That's four cells. Every DRT problem in Algebra 1 is one of them, or two of them at once.

| | **They match** | **They sum** |
|---|---|---|
| **Distance** | catch-up, overtake, round trip, "same route" | apart, meet, toward each other |
| **Time** | "left at the same time," "arrive together" | "the round trip took," "back within 3 hours" |

### Why this matters psychologically

Being stuck feels like being lost in an infinite space. You aren't. You are choosing among four things, and Model 3 tells you which. Reframing "I have no idea what to do" into "it's one of these four, and the frozen frame decides" is most of the battle.

### The one archetype that uses two cells

Round trips fire **distance-match and time-sum simultaneously** — the route is identical both ways *and* you're given a total elapsed time. That double constraint is why round trips feel harder than they look, and knowing it's structurally two conditions rather than one removes the surprise.

> *A boy rides away from home at 28 mph and walks back at 4 mph. The round trip takes 2 hours. How far does he ride?*

Distance matches → call it `d` for both legs.
Time sums → that's the equation.

| | Rate | Time (built) | Distance |
|---|---|---|---|
| Out | 28 | d/28 | d |
| Back | 4 | d/4 | d |

d/28 + d/4 = 2 → multiply everything by 28 → d + 7d = 56 → **d = 7 miles**
*Check:* 0.25 h riding + 1.75 h walking = 2 h ✓

### What's conspicuously missing

**Rate is not in the table.** Rates almost never combine — you don't add two people's speeds and you never average them. That absence is deliberate, and Model 6 explains both the one exception and the trap it creates.

---

## Model 5 — Put the variable on the quantity the two rows share

### The idea

You'll always have two rows and want one letter. So look for the quantity that appears **identically in both rows** — and put your variable there, or on the thing that lets you *express* it.

The shared quantity is what collapses two unknowns into one. Everything else gets built from it via Model 2.

### The tell

Find the column with a shared or symmetric value. Then:

- If the shared thing is what you're solving for, name it directly and let d = rt fill the other column
- If the shared thing is given, put the variable in the other column

**Round trip:** the distance out equals the distance back, and you're given both rates → let `d` be the one-way distance, and *build* the times as `d/28` and `d/4`. (That's the boy-on-the-bike setup above.)

**Catch-up:** the distances are also equal, but here you're *given* the rates → so time is the free parameter, and the head start becomes `t` and `t − 2`.

Same distance-match condition, opposite variable placement. What flipped was which column already had numbers in it.

### The head-start sub-model

> **"Later" is a fact about the Time column. It is never a distance you add.**

A head start doesn't hand someone bonus miles in your equation — it means they've been moving *longer*. Encode it in time:

- Let t = the first person's time → the second person's time is `t − k`
- Or let t = the second person's time → the first person's is `t + k`

Both are correct. Pick one and **write down in words whose time it is**: "t = Sue's time." Skipping that line is where a large share of otherwise-correct solutions die — you solve perfectly and then report the wrong person's number.

### Clock times are durations in disguise

"Left at 9:00, the other left at 10:30" is a 1.5-hour head start. Convert clock times to elapsed durations immediately; the algebra only ever cares about how long each person has been moving.

### The last line of every solution

Reread the question before you write the answer. These problems routinely ask for something other than the variable you solved for — you find `t` but they want the distance, you find one person's rate but they want the other's. Solving is not finishing.

---

## Model 6 — Rates only combine when the ground itself is moving

### Part A: the exception (current and wind)

Wind and current are the one place rates genuinely add, and there's a physical reason rather than a rule to memorize.

The boat moves at 10 mph **relative to the water**. The water moves at 2 mph **relative to the shore**. You're measuring the trip against the shore. So you stack the layers:

- **With the current** (downstream, tailwind): effective rate = `b + c`
- **Against it** (upstream, headwind): effective rate = `b − c`

Write those two effective rates and you're back in an ordinary round-trip problem. Nothing new happens after that step.

**When both are unknown**, this becomes a two-equation system with a standard finish:

> *A boat travels 48 miles downstream in 3 hours. The return upstream takes 6 hours. Find the boat's still-water speed and the current.*

| | Rate | Time | Distance |
|---|---|---|---|
| Down | b + c | 3 | 3(b + c) = 48 |
| Up | b − c | 6 | 6(b − c) = 48 |

Simplify: **b + c = 16** and **b − c = 8**
Add the equations — the c's cancel: 2b = 24 → **b = 12 mph**, so **c = 4 mph**

That "add to cancel the current" move shows up every single time. Expect it.

### Part B: the trap (average rate)

> **You cannot average rates. Ever.**

Rate isn't a quantity that accumulates — it's a *ratio* between two things that do. Distance accumulates. Time accumulates. Rate is what falls out when you divide them **once, at the end**.

> *A car drives 60 miles at 30 mph, then 60 miles at 60 mph. Average rate for the trip?*

**Wrong:** (30 + 60)/2 = 45 mph ✗
**Right:** rebuild both accumulators.

- Leg 1 time: 60/30 = 2 hours
- Leg 2 time: 60/60 = 1 hour
- Total distance 120, total time 3
- Average = 120/3 = **40 mph** ✓

The reason it's 40 and not 45: **you spent twice as long at the slower speed.** The slow leg occupies more of the clock, so it gets more of the vote. For equal distances, the true average is always pulled toward the slower rate — a free sanity check on any answer you produce here.

This is the most-missed problem in the topic among people who otherwise have it cold, because the intuitive answer is confidently wrong.

---

## Putting all six on one problem

> *A cyclist leaves at 9:00 AM riding 12 mph. At 10:30 AM a friend leaves the same point driving 30 mph to catch up. How far from the start does the friend catch the cyclist?*

**Model 1** — Units. Rates are per hour; the clock times need to become durations. 9:00 to 10:30 is a **1.5-hour head start**. Everything now agrees.

**Model 5** — Where's the variable? The shared quantity is distance (same road, same start), but the rates are given — so time is the free parameter. Let **t = the friend's driving time**, written down in words. The cyclist has been riding `t + 1.5`.

**Model 2** — Translate, don't solve. Build both distance phrases:

| | Rate | Time | Distance (built) |
|---|---|---|---|
| Cyclist | 12 | t + 1.5 | 12(t + 1.5) |
| Friend | 30 | t | 30t |

**Model 3** — Freeze the clock at "catches up." What's true? They're at the same point, having started from the same point. Same distance.

**Model 4** — Confirms the cell: distances match, same direction. Not a sum.

30t = 12(t + 1.5)
30t = 12t + 18
18t = 18
**t = 1 hour**

**Model 6** — No current, no average-rate question. Doesn't apply here.

**Model 5's last line** — The question asks *how far*, not *how long*. Answer: 30 × 1 = **30 miles from the start** (at 11:30 AM). Check the other row: 12 × 2.5 = 30 ✓

---

## Diagnostic: which model is failing?

When you're stuck or wrong, the symptom tells you which model didn't fire.

| Symptom | Failed model | Fix |
|---|---|---|
| Unsure whether to multiply or divide | 1 | Read the units as a conversion |
| Answer off by a factor of 60 | 1 | Minutes weren't converted |
| "The problem doesn't give me enough information" | 2 | The missing quantity is an expression — build it |
| Numbers on the page, no equation | 2 → 3 | Finish translating both rows, *then* freeze the clock |
| Added distances in a catch-up problem | 3 | Draw the arrows; same direction means same distance |
| Set distances equal in an "apart" problem | 3 | Draw the arrows; apart means the gap is the sum |
| Feels like infinite possibilities | 4 | It's four cells. Pick one |
| Gave both travelers the same time despite a head start | 5 | "Later" lives in the Time column |
| Got the right number for the wrong person | 5 | Label whose `t` it is, in words |
| Solved for `t` when they asked for distance | 5 | Reread the question before the final line |
| Averaged two speeds | 6 | Total distance ÷ total time, divided once at the end |

---

## The compressed loop

> **Translate each mover into a phrase using d = rt → freeze the clock at the named moment → read off what's physically true → that's the equation.**

Everything else is bookkeeping.

The single failure mode to watch for in yourself: **reaching for the equals sign while you're still reading.** The equation is a statement about the relationship *between* two phrases. It cannot exist until both phrases do. Finish the translation first — every time, even when the problem looks easy.
