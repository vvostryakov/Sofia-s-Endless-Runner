# Sofia's Endless Runner — Technical Design Document

> **Status:** Living draft · **Last updated:** 2026-06-14
> This document describes *how the engine is built* and *how it should evolve*. It
> turns the vision in [GDD.md](GDD.md) into an architecture. Work sequencing lives
> in [ROADMAP.md](ROADMAP.md).
>
> Conventions: **As-is** = how the code works today · **Target** = where we are
> taking it · **Decision** = a committed technical choice with rationale.

---

## 1. Purpose & guiding constraints

The GDD's central ambition is an **extensible runner engine** that spawns visual
reskins and genre mixes cheaply, while staying **simple and reliable**. This TDD
exists to make that real in code. Every decision here is judged against:

- **Reliability first.** The core (track, character, obstacles, run lifecycle)
  must be dependable before features pile on.
- **Built to remix.** New worlds, items, modes, and whole variants should be
  *data + small plugins*, not forks of gameplay code.
- **Simple now, extensible always.** Pay architecture cost only where a simple
  choice would *block* the bigger sibling; otherwise defer.
- **Solo-dev reasonable.** No ceremony that one person can't sustain. Zero build
  step stays until complexity truly demands otherwise.

---

## 2. Current architecture (As-is)

A browser-native **Phaser 3** game, no build step, ES modules, vendored Phaser.

### 2.1 File map

| File | Responsibility |
|------|----------------|
| `index.html` | Mount point (`#game-container`), loads modules, registers SW. |
| `src/main.js` | Phaser `Game` config + entry. FIT scale at `W*DPR × H*DPR`. |
| `src/constants.js` | Tuning constants + `localStorage` persistence helpers. |
| `src/projection.js` | Pseudo-3D camera: `z → screen`, shared `cam3 {x,bend,hill}`, fog. |
| `src/worlds.js` | World theme data + per-world backdrop draw functions. |
| `src/cosmetics.js` | Outfit catalog + wallet + owned/equipped persistence. |
| `src/audio.js` | Procedural Web Audio music (adaptive layers) + SFX. |
| `src/ui.js` + `ui.css` | DOM/HTML UI overlay (menus, HUD, modals) on the 400×700 surface. |
| `src/scenes/BootScene.js` | Animated menu backdrop scene. |
| `src/scenes/GameScene.js` | **Everything else** — the gameplay monolith (~1660 lines). |
| `vendor/phaser.min.js` | Vendored Phaser 3.60. |
| `sw.js`, `manifest.webmanifest`, `version.js` | PWA offline + install + version stamp. |

### 2.2 What's already good (keep & build on)

- **`projection.js` is a clean, reusable seam.** All geometry reads one shared
  `cam3`, so track, scenery, obstacles, and coins follow the same bend/hill/strafe
  with no per-call-site work. This is the model for the whole engine.
- **Object pooling** (`_acquire`/`_releaseObj` + `_pCircle/_pRect/_pEllipse/_pGfx`)
  avoids GC churn.
- **Designed-pattern spawner** with **lane-fairness checks** (`_blockedLanesNear`,
  `_freeLanes`) — fairness is already enforced in code, not hoped for.
- **Worlds are largely data** (`worlds.js`) — partial proof of data-driven content.
- **Persistence is guarded** (falls back to in-memory Map if `localStorage` is
  blocked).

### 2.3 The core problem

`GameScene.js` (~1660 lines) interleaves **track, camera, player, input,
spawners, collision, pooling, rhythm, HUD sync, and run lifecycle**. There is no
boundary between *engine* (reusable) and *flagship* (Sofia-specific), so:

- A new variant would mean copying or forking `GameScene`.
- Pure logic (projection math, fairness, difficulty, economy) can't be tested in
  isolation.
- Phaser is referenced throughout, coupling all logic to the framework.

Dissolving this monolith into systems is the spine of this TDD.

---

## 3. Key technical decisions

| # | Decision | Rationale |
|---|----------|-----------|
| **D1** | **Incremental "strangler" refactor.** Define the target architecture, then extract one system at a time; the game stays playable at every commit. | Safest for a solo dev on a live PoC. Matches "simple and reliable." No big-bang risk. |
| **D2** | **Keep Phaser, isolate it behind adapters.** Engine *logic* is Phaser-free; rendering, input, audio, and the loop sit behind thin `platform/` adapters. | Pragmatic (Phaser is proven) yet keeps the core portable. Avoids the cost of going fully engine-agnostic now while not letting Phaser leak everywhere. |
| **D3** | **Plain JS + JSDoc types + `tsc --checkJs`. No build step.** Type-check in editor/CI only. | Preserves the zero-build non-goal (GDD §14.3) while gaining real type safety and refactor confidence. Full TypeScript revisited only if it earns its keep. |
| **D4** | **Unit-test pure logic with Node's built-in `node:test`.** No deps, no build, no browser. | A "reliable engine" needs a safety net. Pure modules (projection, fairness, difficulty, economy) give the most value for the least ceremony. |
| **D5** | **Everything content is data-driven** (worlds, items, spawn patterns, tuning, modes). Code consumes data; designers/variants edit data. | The "built to remix" pillar lives or dies here. |

---

## 4. Target architecture

Four layers, dependencies point **downward only** (upper layers may use lower;
never the reverse):

```
┌──────────────────────────────────────────────────────────────┐
│  GAME / VARIANT          flagship "Sofia's Runner" + variants  │
│  worlds · items · chaser · modes (classic, rhythm) · UI screens│
├──────────────────────────────────────────────────────────────┤
│  MODE / RULES LAYER      pluggable rule sets on the engine core │
│  spawners · scoring rules · win/lose · power-up sets            │
├──────────────────────────────────────────────────────────────┤
│  ENGINE CORE  (Phaser-free)   the reliable, reusable runner    │
│  run loop/state · track+projection · player+movement (3×3) ·   │
│  spawner+fairness · collision grid · pickups · difficulty ·    │
│  economy/wallet · save · event bus                             │
├──────────────────────────────────────────────────────────────┤
│  PLATFORM ADAPTERS  (the only place Phaser/DOM/WebAudio live)  │
│  renderer · input · audio engine · clock/loop · storage        │
└──────────────────────────────────────────────────────────────┘
```

**The rule that makes variants cheap:** *Engine Core never imports Phaser.* It
talks to a `Renderer` interface, an `Input` interface, an `Audio` interface, a
`Clock`. A variant = new **data** (Game layer) + optionally a new **Mode** plugin
+ optionally a new **skin** for the renderer. Gameplay code is not touched.

### 4.1 Target directory layout (Target)

```
src/
  platform/        # D2 — the ONLY Phaser/DOM/WebAudio code
    renderer.js    #   draw primitives/sprites; the "skin backend" seam (GDD §10.1)
    input.js       #   keyboard + touch → semantic actions
    audioEngine.js #   procedural + (later) track playback (GDD §10.2)
    clock.js       #   frame loop / dt source
    storage.js     #   guarded localStorage (moved out of constants.js)
  engine/          # Phaser-free core
    run.js         #   run lifecycle + state machine (start→run→over→retry)
    track.js       #   road construction, lanes, curve/hill, world scroll
    projection.js  #   (already clean) z→screen, cam3, fog
    player.js      #   movement on the 3×3 grid
    grid.js        #   the 3×3 occupancy model + collision queries
    spawner.js     #   schedule + emit objects
    patterns.js    #   designed patterns + fairness (pure, testable)
    pickups.js     #   coins, shield, magnet, combo
    difficulty.js  #   speed/level curve (pure, testable)
    economy.js     #   wallet, prices, ownership (pure, testable)
    events.js      #   tiny event bus for decoupled cross-system signals
  modes/           # rules layers
    classic.js
    rhythm.js      #   genre-mix proof; extractable to a variant (GDD §7)
  game/            # flagship content (mostly data)
    worlds.js      #   world descriptors (data + scenery hooks)
    items.js       #   ownable catalog: outfits/characters/pets/power-ups
    chaser.js      #   the (redesigned) catch mechanic, as a plugin
  ui/              # DOM UI (from src/ui.js)
  data/            # pure data: patterns, tuning tables, item/world catalogs
  bootstrap.js     # wires platform + engine + chosen game/mode together
```

> Migration note (D1): we do **not** create all of this at once. §6 sequences the
> extraction. `projection.js` already lives at the target boundary.

### 4.2 The 3×3 play space in code (GDD §6.7)

The engine models the player and every hazard/pickup as occupying cells of a
fixed grid:

- **lane** ∈ {0,1,2} (horizontal — hard cap at 3)
- **level** ∈ {0:ground, 1:on-top, 2:air}

```js
/** @typedef {{lane:0|1|2, level:0|1|2}} Cell */
```

- **Player state** is `(lane, level)` plus transition timers (jumping, sliding,
  riding). `level` is *derived* from physics today (y-position / on-wagon /
  sliding); the Target makes it an explicit, queryable value.
- **Collision** becomes a grid query: at the hit plane, does the player's
  `(lane, level)` intersect a solid object's occupied cells? A low gate occupies
  `level 0` (slide → you're below it); a crate occupies `0–1`; a wagon side
  occupies `0`, its roof is rideable `level 1`.
- This turns today's ad-hoc `if (sliding) … else if (airborne) …` collision
  checks (`GameScene` ~1264–1306) into one uniform, testable rule, and makes
  future content (enemies, multi-cell obstacles, power-ups) trivial to place.

### 4.3 Render / skin abstraction (D2 + GDD §10.1)

```
engine ──draw(cmd)──►  Renderer (interface)
                         ├── PhaserPrimitiveRenderer   (today's primitives)
                         └── PhaserSpriteRenderer       (later: illustrated art)
```

- Engine emits **semantic draw intents** ("draw player at cell with outfit X",
  "draw coin at z"), never Phaser calls.
- A **skin** maps intents → concrete visuals. Primitives are simply the *first
  skin backend*; sprites drop in later as another backend with no gameplay change.
- This is the technical expression of GDD §10.1's "skinnable render layer."

### 4.4 Audio abstraction (D2 + GDD §10.2)

```
engine/mode ──cue(event)──►  AudioEngine (interface)
                               ├── ProceduralAudio  (today: adaptive layers, 128 BPM)
                               └── TrackAudio        (later: composed per-world tracks)
```

A world/mode declares either a procedural generator or a track; gameplay emits
abstract cues (`coin`, `combo↑`, `beat`, `gameOver`) and never knows which backend
plays them. Procedural stays the core (required for Rhythm + adaptive layers).

### 4.5 Data model (D5)

All content is plain data objects, validated by JSDoc typedefs:

- **World descriptor** — `{ id, name, palette, sky, ground, accent, backdrop, audio? }`
  (extends today's `worlds.js`). Adding a world = adding a descriptor.
- **Catalog item** — `{ id, type:'outfit'|'character'|'pet'|'powerup', name,
  price, currency, acquire:'earn'|'unlock'|'rotate'|'buy'|'gift', payload }`.
  One ownership/equip system, many item types (GDD §9.2).
- **Spawn pattern** — `{ id, weight, minDifficulty?, extraGap?, build(ctx) }`
  where `build` only calls fairness-aware spawn primitives (today's `_patternTable`).
- **Tuning table** — today's `constants.js` values, grouped (movement, speed,
  durations, scoring) so difficulty is a knob, not a code edit (GDD §11).

### 4.6 Persistence / save schema

- **As-is:** flat `localStorage` keys (`ser_*`) for bests, mute, volumes,
  haptics, wallet, owned/equipped outfits.
- **Target:** keep the keys (backward compatible) but route through
  `platform/storage.js` + an `engine/economy.js` + a small `save` module, with a
  **schema version** and a migration hook, so adding premium currency / new item
  types / new modes doesn't break existing players' saves.

---

## 5. Cross-cutting concerns

### 5.1 Performance budget

- **Target: 60 fps** on a mid-range phone; never below 30.
- Render at device resolution capped at **2× DPR** (already done) — logic stays in
  400×700 space.
- **Pooling is mandatory** for anything spawned per-run (already in place); extend
  it through the refactor — no per-frame allocations in the hot path.
- Distance fog + culling: objects beyond `SPAWN_Z` / behind the camera are
  released, not drawn.
- Budget guard: the refactor must not regress frame time; spot-check with the
  in-browser perf overlay before/after each extraction.

### 5.2 Input

- One **semantic action set**: `left, right, jump, slide, pause, confirm`.
- `platform/input.js` maps keyboard *and* touch/swipe to those actions; the engine
  never sees raw keys or pointers. **Input buffering** (today's `_bufferInput`/
  `_consumeBufferedInput`) moves into the player/input seam so a press during a
  transition still registers — a fairness feature, keep it.

### 5.3 Determinism & testability

- Pure logic modules (`patterns`, `difficulty`, `economy`, `projection`, `grid`)
  take inputs and return outputs with **no Phaser, no globals, no `Date.now()`**
  (time is passed in). This is what makes D4's unit tests possible.
- Consider a **seeded RNG** passed into the spawner so runs can be reproduced in
  tests and (later) shared as "daily challenge" seeds. *(Idea — not required day 1,
  but cheap to thread through now.)*

### 5.4 PWA / offline

- Keep SW offline caching + version stamping. The refactor must keep the cached
  asset list correct; the deploy workflow's cache-bust query stays.

---

## 6. Migration plan (D1 — strangler, in order)

Each step ends with a **playable game** and, where noted, **tests**. Steps are
roughly independent and small enough to ship one at a time.

1. **Safety net first.** Add `tsc --checkJs` config (D3) + Node `node:test`
   harness (D4) + a CI check. No behavior change.
2. **Extract pure math.** Move/confirm `projection.js`, extract `difficulty.js`
   and `economy.js` (from `constants.js`/`cosmetics.js`) as pure modules **with
   tests**. Lowest risk, immediate value.
3. **Extract `storage.js`** out of `constants.js` behind a tiny interface; add
   save schema version + migration hook.
4. **Introduce the `grid.js` 3×3 model** and route collision through it
   (§4.2) — replaces the ad-hoc collision branches **with tests for fairness**.
5. **Extract `patterns.js` + `spawner.js`** (from `_patternTable`/`_spawnPattern`)
   as data + pure builders **with fairness tests**.
6. **Carve `player.js` + `track.js`** out of `GameScene`, leaving `GameScene` as a
   thin Phaser host that wires systems together.
7. **Introduce `platform/renderer.js`** (primitive skin backend) and move draw
   calls behind draw-intents (§4.3). Engine core stops importing Phaser.
8. **Introduce `platform/input.js` + `audioEngine.js`** adapters (§5.2, §4.4).
9. **Formalize the Mode layer**: re-express Classic + Rhythm as `modes/*` plugins
   (§4 / GDD §7). Validate by checking Rhythm cleanly separates.
10. **Prove it:** stand up a trivial second "skin" (reskinned world set) or a
    stub variant to confirm a variant needs *no* gameplay edits (GDD §12.4).

> If at any step the seam fights us, that's information — re-cut it before
> proceeding. The goal is clean seams, not adherence to this exact list.

---

## 7. Coding conventions

- **ES modules**, browser-native, no bundler (until justified). Match existing
  style (the codebase is terse and dense — keep comment density similar).
- **JSDoc types** on public module surfaces; `tsc --checkJs` must pass.
- **Engine core imports nothing from `platform/` concretely** — only interfaces /
  injected dependencies.
- **Constants stay named and grouped** (no magic numbers in logic).
- **No new runtime dependencies** without a clear reason (vendored, not CDN).
- Keep `node --check` green; add `npm test` (Node test runner) and
  `npm run typecheck` (tsc) — both runnable without a build.

---

## 8. Open technical questions

- **Seeded RNG now or later?** (cheap to thread through during step 5; enables
  reproducible tests + daily seeds). *Leaning: thread it through now.*
- **Renderer intent granularity** — how coarse/fine the draw-intent vocabulary
  should be (affects how much a sprite skin can diverge). Decide at step 7.
- **Mode plugin contract** — exact hooks a mode can override (spawn, score,
  win/lose, audio). Firm up at step 9 once two modes exist.
- **Save migration policy** — silent best-effort vs. explicit versioned migrations.
  Decide at step 3.
- **Where the chaser lives** — pure-ish plugin in `game/chaser.js` vs. an engine
  "pursuer" primitive. Decide alongside the GDD §6.4 redesign.

---

*End of TDD. Companion docs: [GDD.md](GDD.md) (design) · [ROADMAP.md](ROADMAP.md)
(sequencing).*
