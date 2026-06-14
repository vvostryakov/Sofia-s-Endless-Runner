# Sofia's Endless Runner — Roadmap

> **Status:** Living draft · **Last updated:** 2026-06-14
> Sequences the work from [GDD.md](GDD.md) (design) and [TDD.md](TDD.md)
> (architecture) into prioritized milestones.
>
> **Strategy (decided):** *Engine-first, but fix obvious pain alongside.* Hardening
> the core comes first; quick wins, bug fixes, and the chaser redesign run on a
> parallel track so progress never feels stalled.
> **Nearest milestone that matters most:** a **rock-solid playable core** (M1).

How to read: each milestone has a **Goal**, **Key work** (with refs to GDD §/TDD
step), and a **Definition of done**. Items: ✅ done · 🔄 doing · ⬜ todo · 💡 idea.

---

## M0 — Baseline (where we are today)

The PoC: a playable pseudo-3D 3-lane runner with jump/slide/wagons, designed
spawn patterns with fairness, coins/combo/shield/magnet, 4 cycling worlds, a
cosmetics shop, a Rhythm Run prototype, DOM UI, and PWA offline. Engine logic
lives in one ~1660-line `GameScene`. *See TDD §2.*

---

## M1 — Reliable core 🎯 (current priority)

**Goal:** the engine *feels* rock-solid to play and is safe to change — the
foundation done right, even if content stays modest. This is the milestone you
care about most.

**Key work** (engine-first track — TDD §6 steps 1–6):

- ⬜ **Safety net** — `tsc --checkJs` typecheck + Node `node:test` harness + CI
  check, no behavior change. *(TDD step 1, D3/D4)*
- ⬜ **Extract & test pure math** — `difficulty.js`, `economy.js`, confirm
  `projection.js`; unit tests. *(TDD step 2)*
- ⬜ **Extract `storage.js`** + save schema version & migration hook. *(TDD step 3)*
- ⬜ **3×3 grid collision model** (`grid.js`) replacing ad-hoc collision branches,
  with fairness tests. *(TDD step 4, GDD §6.7)*
- ⬜ **Extract `patterns.js` + `spawner.js`** as data + pure builders, with
  fairness tests. *(TDD step 5)*
- ⬜ **Carve out `player.js` + `track.js`**; `GameScene` becomes a thin host.
  *(TDD step 6)*
- ⬜ **Perf pass** — confirm 60fps mid-phone, no hot-path allocations. *(TDD §5.1)*

**Parallel track — quick wins & pain fixes** (allowed to interleave):

- ⬜ **Chaser redesign** — replace the "shadow beast" with a friendly/comic
  Subway-Surfers-style chaser; no scary content. Build as a pluggable module.
  *(GDD §6.4)*
- ⬜ Any obvious movement/feel/control bugs surfaced while refactoring.
- ⬜ Small readability/feedback wins (hit clarity, near-miss) if cheap. *(GDD §10.4)*

**Definition of done:**
- Plays reliably on phone + desktop; no known core bugs; consistent 60fps.
- Pure logic is unit-tested; typecheck + tests green in CI.
- `GameScene` no longer owns track/player/spawner/collision logic.
- The chaser is friendly, not scary.

---

## M2 — Remix-ready engine

**Goal:** the engine core is Phaser-free and content is data-driven, so a new
variant needs **no gameplay edits**. This unlocks horizontal scaling.

**Key work** (TDD §6 steps 7–9, D2/D5):

- ⬜ **Renderer adapter** (`platform/renderer.js`) with the primitive skin
  backend; engine emits draw-intents, stops importing Phaser. *(GDD §10.1)*
- ⬜ **Input adapter** (`platform/input.js`) — semantic actions, buffering inside
  the seam. *(TDD §5.2)*
- ⬜ **Audio adapter** (`platform/audioEngine.js`) — procedural core behind the
  cue interface. *(GDD §10.2)*
- ⬜ **Mode layer** — re-express Classic + Rhythm as `modes/*` plugins; verify
  Rhythm separates cleanly. *(GDD §7)*
- ⬜ **Data-driven catalogs** — world descriptors + the unified ownable-item
  catalog (one ownership/equip system). *(GDD §9.2, TDD §4.5)*

**Definition of done:**
- `engine/` imports nothing concrete from `platform/`.
- Adding a world or an item is a data change only.
- Classic and Rhythm are independent mode plugins on one core.

---

## M3 — Depth & progression (vertical scaling)

**Goal:** make the flagship rich and replayable — cheaply, on the clean engine.

**Key work** (GDD §8, §9, §6.6 grow-into list):

- ⬜ More worlds + **meta-progression** (unlock / rotate / buy / gift), framed as
  *Sofia discovering places*. *(GDD §8.1–8.2)*
- ⬜ **Characters & pets** as catalog items; **upgradable power-ups** (not
  pay-to-win). *(GDD §9.2)*
- ⬜ **Missions / quests / daily challenge** layer (seeded runs). *(GDD §5, TDD §5.3)*
- ⬜ **Revives & hearts/health** as an optional layer on the run lifecycle.
  *(GDD §5)*
- 💡 Leaderboards · ghosts · events. *(GDD §6.6)*

**Definition of done:** content additions are routine and safe; a fresh world or
item ships without touching gameplay code.

---

## M4 — Prove the variant model (horizontal scaling)

**Goal:** validate the entire engine-first bet. *(GDD §12.4)*

**Key work:**

- ⬜ Spin up a **second visual variant** (reskin: new worlds/characters/skin
  backend) with no gameplay edits.
- 💡 Extract **Rhythm Run into a standalone variant**, and/or prototype a
  **runner + roguelike** mix. *(GDD §7)*

**Definition of done:** a second variant exists, built mostly from data + a mode
plugin + a skin — proving "built to remix" is real.

---

## M5 — Publish & monetize (ethical)

**Goal:** something you'd proudly share, that can earn for the family. *(GDD §12,
§13)*

**Key work:**

- ⬜ **Onboarding / tutorial** for young first-time players. *(GDD §6 onboarding)*
- ⬜ Polish, store/PWA presentation, accessibility pass.
- ⬜ **Monetization layer** — cosmetic IAP / premium currency / opt-in rewarded
  ads / premium unlock — plugged into existing seams. **Never pay-to-win, no dark
  patterns.** *(GDD §13)*
- 💡 Analytics for retention (privacy-respecting). *(GDD §12)*

**Definition of done:** publicly shareable, monetization live and fair, retention
measurable.

---

## Backlog / icebox (unscheduled ideas)

Competitions · live events · social/sharing · more genre mixes · seeded daily
seeds shared between players · composed per-world music · illustrated art pipeline
· additional input schemes. Pull into a milestone when it earns priority.

---

## Guardrails (apply to every milestone)

- **Playable at every commit** — strangler refactor, never a long broken branch.
  *(TDD D1)*
- **Tests + typecheck green** before merge once M1's safety net exists.
- **No >3 lanes · no pay-to-win · no scary content · no dark patterns · no native
  rewrite.** *(GDD §14.3)*
- **Simple now, extensible always** — pay architecture cost only where a simple
  choice would block the bigger sibling. *(GDD §4)*

---

*End of ROADMAP. Companion docs: [GDD.md](GDD.md) · [TDD.md](TDD.md).*
