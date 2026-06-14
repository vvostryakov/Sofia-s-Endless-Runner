# Sofia's Endless Runner — Game Design Document

> **Status:** Living draft · **Last updated:** 2026-06-13
> This is the master design document. It describes the *product vision*, the
> reusable *runner engine*, and the design of the flagship game, **Sofia's
> Endless Runner**. Technical/architecture detail lives in [TDD.md](TDD.md);
> work sequencing lives in [ROADMAP.md](ROADMAP.md).
>
> Conventions: **Built** = exists in code today · **Planned** = agreed, not yet
> built · **Idea** = under consideration, not committed.

---

## 1. Vision

**Sofia's Endless Runner** began as a project between a father and his daughter,
Sofia. She kicked it off; she is the muse, the first player, and a character in
her own world. That origin stays at the heart of the project.

But the ambition is bigger than one game. The real asset we are building is a
**reliable, interesting, and extensible runner engine** — a solid core that can
spawn many games:

- **Visual variants** — the same engine reskinned into entirely different worlds,
  characters, and moods.
- **Genre mixes** — the runner core blended with other genres: runner + rhythm,
  runner + roguelike, and beyond.

Sofia's Endless Runner is the **flagship title** and the proving ground for that
engine. It is intended to be published and, eventually, monetized — so it must be
good enough for an audience well beyond the two of us.

### One-liner

> A pseudo-3D endless runner where Sofia dashes through living, themed worlds —
> built on an engine designed to become many games.

### Why this exists (in priority order)

1. **A project Sofia and her dad build together.** Joy first.
2. **A dependable engine** that makes new games cheap to produce.
3. **A publishable, eventually monetizable product.**

---

## 2. Audience

| Layer | Who | What they need |
|-------|-----|----------------|
| **Origin** | Sofia (and dad) | Fun, personal, something she sees herself in. Approachable difficulty, delight. |
| **Primary** | Casual players, kids & families | Easy to pick up, fair, charming, replayable in short sessions. |
| **Secondary** | Anyone on any screen | Works on the device they already have, no install friction. |

The game must be **broadly approachable** (a child can enjoy it) while still
offering depth for score-chasers. Tone: warm, bright, friendly — never punishing
or grim.

---

## 3. Platform reach

Goal: **as many platforms and screen sizes as is reasonable for a solo
developer.** One codebase, no per-platform forks.

- **Built:** Browser-native (no build step), PWA installable + offline-capable,
  fixed 400×700 logical surface scaled to any screen, touch + keyboard input,
  haptics where supported.
- **Design implication:** every feature must work with *both* touch and keyboard,
  and must read clearly at the 400×700 logical resolution. Anything that only
  works on one input type or one screen size is out of scope unless explicitly
  justified.

---

## 4. Design pillars

These are the lenses every feature is judged against. If a feature doesn't serve
a pillar, it needs a very good reason to exist.

1. **A solid engine first.** The runner core must be reliable, readable, and
   tunable before we pile on content. Reusability and clean seams beat one-off
   features. *(This is the top pillar right now.)*
2. **Built to remix.** Worlds, characters, modes, and rules should be data-driven
   and swappable, so new visual variants and genre mixes are cheap to produce.
3. **Fair, satisfying movement.** Responsive controls, forgiving timing, no cheap
   deaths. The run should feel good in the hand on any device.
4. **Warm and inviting.** Bright, charming, approachable for a child — delight
   over difficulty.

### Guiding principle: simple now, extensible always

> **Start simple and reliable — but architect so the complex version is cheap to
> add later.**

This governs every decision in this document. The shipped game stays small and
dependable, but each simple choice must leave a **clean seam** for its bigger
sibling, with no rewrite required:

| Simple now (Built / first) | Designed to become (later) |
|----------------------------|----------------------------|
| Pure endless score chase | + Missions / objectives / levels |
| One life, instant retry | + Revives, hearts/health, continues |
| Classic + Rhythm modes | + Genre mixes (roguelike, etc.) |
| Four hand-authored worlds | + Many data-driven worlds & reskins |

When a "simple now" choice would *block* a "later" sibling, we pay the small
architecture cost up front. When it merely *delays* it, we defer.

---

## 5. Core gameplay loop

The moment-to-moment loop (Built):

```
        ┌──────────────────────────────────────────────┐
        ▼                                                │
   RUN  ──►  read the lane ahead  ──►  dodge / jump /   │
            (obstacles & pickups)      slide / switch    │
                                            │            │
                                            ▼            │
                                     collect coins,      │
                                     build combos,       │
                                     grab power-ups      │
                                            │            │
                                            ▼            │
                                   speed & difficulty    │
                                       ramp up           │
                                            │            │
                            ┌───────────────┴────────┐   │
                            ▼                         ▼   │
                         survive                   crash  │
                            │                         │   │
                            └──► world changes        ▼   │
                                 every 4000      GAME OVER │
                                 score           (score,   │
                                                  coins,    │
                                                  records)  │
                                                     │      │
                                                     ▼      │
                                              tap to retry ─┘
```

**Session shape: difficulty builds with skill.** A beginner gets a short, gentle
run; a skilled player can ride a good run for several minutes. The *difficulty
curve does the gating* — not artificial time limits. The opening seconds are
always safe (`SAFE_START_MS`) so no run dies before the player is oriented.

**Goal — endless now, structured later.** The shipped backbone is a **pure
endless score chase**: go far, beat your best (tracked per mode/track). Missions,
objectives, and discrete levels are *not* in the first version, but the loop and
data model must leave room to layer them on (see TDD).

**Fail state — one life now, extensible later.** Today: hit a hazard → game over
→ instant retry. The hazard/collision and game-over flow must be built so that
**revives, hearts/health, and continues** can be added later as a layer, without
reworking the core. (Revives are also a future monetization hook — see §13.)

## 6. Mechanics

All mechanics below are **Built** unless noted. They split into what is naturally
**engine-core** (reusable by any variant) vs **flagship-flavoured** (Sofia's
world specifically) — a distinction the TDD will enforce in code.

### 6.1 Movement (engine-core)

| Move | Input (kbd / touch) | Behaviour |
|------|---------------------|-----------|
| Switch lane | ←→ / A D · swipe L/R | Snap between 3 lanes. Input is buffered so a press during a transition still registers. |
| Jump | ↑ / W / Space · swipe up | `JUMP_INIT` impulse vs `GRAVITY`. |
| Double jump | (in air) jump again | Second, smaller impulse (`DOUBLE_JUMP_INIT`). |
| Slide | ↓ / S · swipe down | Ducks for `SLIDE_DURATION`; the *only* way under low red gates. |
| Fast-drop | ↓ / S while airborne | Cancels upward velocity to land fast — for tight recoveries. |
| Ride wagon | land on a moving car | Stand on the roof of a train car for `WAGON_RIDE_MIN/MAX_MS`; roof carries coins. Landing has a small grace window. |

Three lanes (`LANE_SIDE = [-1,0,1]`) on a track that gently curves left/right
(`TURN_MAX_OFFSET`) for visual life — the curve is cosmetic, lanes stay fixed.

### 6.2 Hazards (engine-core shapes, flagship skins)

- **Low gates (red)** — must **slide** under. Standing/jumping into one ends the run.
- **Crates** — solid blocks; jump over or switch lanes. Tall/wide crate walls
  force a specific open lane.
- **Train cars / wagons** — ride the roof; hitting the side/front ends the run.

Hazards are never placed by raw RNG. They come from **designed spawn patterns**
(coin line, coin arc over a crate, slalom, gate gauntlet, double-gate corridor,
crate wall, train run, zig-zag sprint…). Every pattern **checks which lanes are
already threatened** and guarantees at least one survivable path — this is the
"fair, no cheap deaths" pillar enforced in code.

### 6.3 Pickups & scoring (engine-core)

- **Coins** — `COIN_SCORE` to run score *and* +1 to the persistent wallet
  (cosmetics currency, §9). Spawned in readable lines/arcs/weaves.
- **Combo** — collecting keeps a multiplier climbing (×1 → ×5). It drives both
  scoring and the audio intensity layers (§7) and visual aura. Lapses decay it.
- **Shield** (`SHIELD_SCORE`) — one charge; absorbs the next fatal hit instead of
  dying → triggers the **shadow-beast chase** (6.4).
- **Magnet** (`MAGNET_SCORE`, `MAGNET_DURATION`) — temporarily pulls nearby coins
  toward Sofia across adjacent lanes.

Run score also ticks up passively at `SCORE_PER_SECOND`.

### 6.4 The chaser (Planned redesign — currently "shadow beast")

**Built today:** when a shield saves you from a fatal hit, a *shadow beast*
surges up behind Sofia (`chaseT`) with a rising heartbeat and chases until you
recover or are caught ("Caught by the shadow beast!").

**Decision: redesign — too scary for the target audience.** We don't want kids
to feel afraid. The **Subway Surfers** model is the reference: a chaser is
**pressure, not horror** — a playful pursuer that is the *consequence of
crashing* rather than a monster that hunts you. Target redesign:

- A **friendly/comic chaser** (a character, not a beast) that appears when you
  crash and "catches up," ending the run with personality instead of dread.
- Keep it as a **pluggable near-death / catch module** so variants can swap the
  character or the trigger (crash-catch vs. recovery-window) without touching the
  core. *(See [ROADMAP.md](ROADMAP.md) for sequencing.)*

### 6.5 Difficulty ramp (engine-core)

- **Speed** scales from `BASE_SPEED` (480) toward `MAX_SPEED` (1080) over the run.
- **Level** = `1 + floor(distance / 4500)` — surfaced on the HUD.
- Patterns get tighter and spawn gaps shrink as level climbs.
- `SAFE_START_MS` guarantees a calm opening so no run dies before the player is
  oriented.

### 6.6 What "the engine" means (scope of the reliable core)

The current build is honestly a **proof of concept**. "The engine" — the thing
that must be rock-solid before we expand — is a deliberately small, dependable core:

**Engine core (must be reliable, kept simple):**

- **Track/road construction** — the pseudo-3D road, lanes, curves, world scroll,
  spawn placement — predictable and correct at every speed.
- **Character & movement** — running, lane switches, jump/double-jump,
  slide/fast-drop, wagon riding — responsive and bug-free.
- **Obstacles & fair spawning** — the designed-pattern system with guaranteed
  survivable paths.
- **Run lifecycle** — start → run → collide → game over → retry, with score/coins
  persistence.

**Built to grow into (not in the reliable core yet — clean seams required):**
power-ups & abilities · monsters/enemies · new obstacle types · richer worlds
(multiple lanes/levels, "3×3" world variety) · shops · coins & wallets ·
leaderboards · ghost runs · competitions · live events · quests/missions.

> The job right now: turn the PoC into a **reliable engine** for the core list,
> while leaving the seams that make the "grow into" list cheap. We do **not**
> build the grow-into features until the core is dependable.

### 6.7 The 3×3 play space (core engine model)

The fundamental play space is a **3×3 grid** — and it stays 3×3:

```
            LANE 0      LANE 1      LANE 2
          ┌──────────┬──────────┬──────────┐
  AIR     │  jump /  │  jump /  │  jump /  │   ← jump & double-jump
 (level2) │  dbl-jump│  dbl-jump│  dbl-jump│
          ├──────────┼──────────┼──────────┤
  TOP     │ on train │ on train │ on train │   ← riding atop a car/obstacle
 (level1) │   roof   │   roof   │   roof   │
          ├──────────┼──────────┼──────────┤
  GROUND  │  running │  running │  running │   ← default
 (level0) │          │          │          │
          └──────────┴──────────┴──────────┘
```

- **Horizontal: exactly 3 lanes.** More lanes hurt readability and control on a
  phone — this is a hard design constraint, not a limitation to remove later.
- **Vertical: 3 levels** — ground, on-top (train/obstacle roof), airborne. The
  Subway Surfers space. Jump/double-jump and riding move you between levels.
- The engine models the player's position as **(lane, level)** occupancy, and
  hazards/pickups occupy cells in this grid. This is what makes spawn fairness,
  collision, and future content (enemies, power-ups) tractable. *(See TDD.)*

## 7. Modes

| Mode | Status | Role |
|------|--------|------|
| **Classic** | Built | The flagship experience. Endless run on the 3×3 space across worlds. This is what "the engine" must nail. |
| **Rhythm Run** | Built (prototype) | **A proof that the engine can host genre mixes**, not a permanent flagship feature. Layers a 128 BPM track + beat-timed coins (Perfect/Good/Off-beat) over the runner. |

**Rhythm Run's real purpose** is to validate the "built to remix" pillar. It
should be kept playable now but **architected so it can graduate into its own
standalone variant** later, rather than living forever as a sub-mode. It is the
template for future genre mixes (runner + roguelike, etc.).

> Design implication: a "mode" is a **rules/extension layer** on top of the same
> engine core — it adds spawners, scoring rules, and audio, but does not fork the
> runner. If Rhythm Run can't be cleanly separated from Classic, the engine seams
> aren't good enough yet.

Future modes/mixes (Idea): runner + roguelike (run-scoped upgrades, branching
paths), daily challenge, time attack, boss runs. None committed.

## 8. Worlds & progression

### 8.1 The fantasy — *Sofia discovering places*

The through-line for all worlds is **Sofia exploring the world**: cities,
regions, countries — and, in expansions or sibling games, underworlds, underwater
realms, outer space, the world of dreams, the world of tales. This framing gives
near-infinite content combinations and a warm, aspirational tone (discovery, not
danger).

### 8.2 Two layers of progression

1. **Within a run (Built, keep & deepen).** The environment must keep evolving
   *during* a single run so a long run never feels static. Today worlds cycle
   every `WORLD_SCORE` (4000). Worlds today: Jungle → Savanna → Coral Reef →
   Deep Ocean, each with its own palette, sky, scenery, and accent colour.
2. **Across sessions (Planned).** Worlds/cities as a **meta-progression** layer:
   a mix of **unlockable** (by distance/coins/quests), **rotating** (e.g. a
   monthly featured world/city), **purchasable**, and **gifted**. Exactly which
   world uses which model is **undecided** — the engine should support all of
   them via data, and we decide per-world later.

### 8.3 Design implications for the engine

- Worlds are **pure data + scenery hooks** (palette, sky gradient, ground colours,
  accent, backdrop draw fn) — adding a world should not touch gameplay code.
  *(Largely true today; the TDD will formalize the world descriptor.)*
- The **in-run world sequence** and the **meta unlock/rotation state** are two
  separate systems; keep them decoupled.

## 9. Economy & cosmetics

### 9.1 Currency — single now, premium-ready

- **Built:** one **soft currency, "coins"**, earned by running (each coin = score
  + 1 to a persistent wallet), spent in the cosmetics shop.
- **Planned seam:** design the wallet, pricing, and shop so a **premium currency**
  (e.g. gems/keys — earned slowly or bought) can be added later **without
  rework**. The wallet abstraction should not assume a single currency.
- **Hard rule: never pay-to-win.** Currency and purchases buy *expression and
  variety*, not power that makes the leaderboard unfair. (Power-ups may be
  *upgradable*, but must stay reachable through play — see §13.)

### 9.2 What players acquire (catalog of "things you can own")

Built today: **6 outfits** (palette swaps on the player, 0–1000 coins; own +
equip persisted). Planned catalog, all as **data-driven owned items**:

| Category | Status | Notes |
|----------|--------|-------|
| **Characters** | Idea | Sofia + friends / other playable characters. Identity & collection (Subway-Surfers cast model). |
| **Outfits / skins / items** | Built (outfits) | Cosmetic looks & accessories per character. |
| **Pets / power-ups** | Idea | Companion pets and acquirable/upgradable power-ups. Perks allowed but **not pay-to-win**. |
| **Worlds / cities** | Idea | Tie into §8.2 meta-progression (unlock / rotate / buy / gift). |

> Design implication: outfits, characters, pets, power-ups, and worlds should all
> be the **same kind of "ownable, equippable catalog entry"** under the hood —
> one ownership/equip system, many item types. This is what keeps adding content
> cheap (the "built to remix" pillar).

### 9.3 Acquisition paths

Items can be **earned** (coins/quests/distance), **unlocked** (progression),
**rotated** (limited-time featured), **purchased** (premium currency / IAP), or
**gifted** (events, daily rewards). The engine should support all paths via data;
we choose per-item later.

<!-- SECTIONS BELOW ARE STILL TO BE INTERVIEWED:
    10. Presentation (art, audio, UI/UX, juice)
## 10. Presentation

### 10.1 Art direction (Recommended — open to your veto)

**Built today:** everything is drawn with **geometric code primitives** (no
sprite/image assets) — player, obstacles, coins, and four hand-drawn world
backdrops. Plus camera juice: pseudo-3D projection, curve bend, hills, distance
fog, combo auras, particles.

**Recommended direction: Hybrid, behind a skinnable render layer.**

- The load-bearing rule is **not** "primitives vs sprites" — it's that *all*
  rendering goes through an **asset/skin abstraction**, so a primitive is simply
  the first "skin backend." Swapping in sprite art later is then a data/asset
  change, not a gameplay rewrite. *(This is the visual half of "built to remix".)*
- **Keep the clean geometric look for worlds & track** — cheap, scalable, and
  the easiest thing to reskin per variant. It can be a deliberate signature.
- **Invest illustrated art where emotion lives:** characters (Sofia, friends),
  pets, and hero items. This is where Subway-Surfers-grade appeal pays off.
- No heavy asset pipeline until the engine is reliable; the abstraction is what
  lets us add it later without pain.

### 10.2 Audio direction (Recommended — open to your veto)

**Built today:** music and SFX are **fully procedural** Web Audio, including the
128 BPM Rhythm track and **adaptive intensity layers that follow the combo**
(hats join warm, arp joins hot).

**Recommended direction: Hybrid, procedural core.**

- **Keep procedural as the core.** It is essentially free, infinitely scalable,
  and *required* for adaptive layers and rhythm gameplay — a real differentiator.
- **Allow composed/licensed tracks as an optional per-world layer** later for
  ambience, declared in the world's data.
- One **audio abstraction** either way: a world/mode declares "procedural
  generator" or "track," gameplay code never cares which.

### 10.3 UI / UX

- **Built:** DOM/HTML+CSS UI overlay (`src/ui.js`, `ui.css`) on the 400×700
  surface, scaled to the canvas — menus, HUD (score/coins/combo/level, power-up
  timers, badges), pause, settings, how-to-play, game-over, shop. App version
  shown in menu.
- **Principles:** readable at a glance for a child; touch targets large; every
  action reachable by both touch and keyboard; HUD never obscures the play lane.

### 10.4 Juice & feel

Game feel is a pillar, not a nicety. Keep and extend: combo aura/energy,
collect/footstep pulses, beat pulse, camera bend, particles, haptics. New
mechanics ship *with* their feedback, never without.

## 11. Difficulty & tuning philosophy

- **Fair by construction.** Spawn patterns guarantee a survivable path; no cheap
  deaths. Reaction windows must be achievable at the current speed.
- **Difficulty is the pace-setter** (§5): the curve gates session length, not
  timers. Beginners get short, gentle runs; skilled players ride longer.
- **Calm opening** (`SAFE_START_MS`) every run.
- **Tunable, not hardcoded.** All feel/difficulty values live as named constants
  (`src/constants.js`) so tuning is a knob, not a code change. *(TDD formalizes a
  difficulty/tuning table.)*
- **Approachable ceiling.** A child should reach a satisfying score; mastery
  should still feel deep. Two audiences, one curve.

## 12. Success — what "good" means

This project is a success when:

1. **Sofia loves it.** The origin measure — she enjoys it and is proud of it.
2. **Players love it.** Real strangers play, enjoy, and come back (retention,
   word-of-mouth).
3. **It earns for the family.** Monetized ethically (§13), it makes money.
4. **It scales with ease — both axes:**
   - **Vertically** — adding depth/content (worlds, items, modes, power-ups) to
     the flagship is cheap and safe.
   - **Horizontally** — spinning up a *new variant* (reskin or genre mix) off the
     engine is cheap. Successfully shipping variant #2 proves the strategy.
5. **It stays improvable.** The codebase remains clean enough that the above
   never requires a rewrite.

> These map directly onto the pillars: #1–2 ← *fair movement* + *warm & inviting*;
> #4–5 ← *solid engine* + *built to remix*; #3 ← the monetization guardrails.

## 13. Monetization (later — design must not block it)

Not built, and **not a near-term priority**. The only job now is to **avoid
decisions that would block** these later. All three are acceptable; **pay-to-win
is explicitly rejected**.

- **Cosmetic IAP / premium currency** — sell cosmetics or premium currency that
  buys cosmetics. Always optional, always fair.
- **Opt-in rewarded ads** — player *chooses* to watch for revives, coin doublers,
  or free gifts. **No forced/interstitial ads.**
- **Premium / paid unlock** — one-time purchase (remove ads, unlock a variant, or
  a paid "full" version).

**Guardrails (these are design law):**

1. **Never pay-to-win.** Money buys expression, convenience, and variety — never a
   competitive scoring advantage. Upgradable power-ups must remain fully
   achievable through normal play.
2. **No dark patterns.** No forced ads, no manipulative timers, kid-safe by
   default (the audience includes young children).
3. **Monetization is a layer**, plugged into the economy/revive/shop seams — not
   woven through gameplay.

## 14. Scope & non-goals

### 14.1 In scope now (the reliable engine)

Hardening the **PoC into a dependable engine** (§6.6): solid track/road
construction, reliable character & movement, fair obstacle spawning, clean run
lifecycle, and the seams that make everything below cheap later.

### 14.2 Planned (clean seams required, build after the core is solid)

Missions/quests · revives & hearts/health · more worlds + meta-progression
(unlock/rotate/buy/gift) · characters, pets, power-ups as ownable catalog items ·
premium currency · the chaser redesign · leaderboards · ghosts · competitions ·
live events · illustrated character art · composed per-world tracks.

### 14.3 Non-goals (explicitly out — for now or forever)

- **More than 3 lanes.** Hard no — controllability (§6.7).
- **Pay-to-win** anything. Forever no (§13).
- **Scary/horror content.** Audience includes young kids (§6.4).
- **Forced/interstitial ads & dark patterns.** Forever no.
- **A native rewrite / leaving the web.** One web codebase; reach via PWA. No
  per-platform forks.
- **A build pipeline** before it's justified. Browser-native ES modules stay
  until complexity demands otherwise.
- **3D / realistic graphics.** Pseudo-3D + stylized is the lane.
- **Heavy narrative/story mode.** "Sofia discovering places" is a light framing,
  not a cutscene-driven campaign.

### 14.4 Open questions (decide later)

- Which worlds are unlock vs. rotate vs. buy vs. gift (§8.2).
- Exact chaser redesign (§6.4).
- When/whether Rhythm Run graduates to a standalone variant (§7).
- First premium-currency sink and pricing (§9).

---

*End of GDD. Companion docs: [TDD.md](TDD.md) (engine architecture) ·
[ROADMAP.md](ROADMAP.md) (sequencing).*
