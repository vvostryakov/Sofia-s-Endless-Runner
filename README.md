# Sofia's Endless Runner

A browser-based endless runner MVP prototype built with Phaser 3. The project intentionally keeps visuals simple while focusing on run flow, controls, progression, and UX.

## Play

Once GitHub Pages is enabled, play at:  
`https://vvostryakov.github.io/sofia-s-endless-runner/`

## MVP flow

- Main menu with best score, best coin run, sound toggle, how-to-play screen, and a separate Rhythm Run prototype entry.
- Rhythm Run mode layers a simple 128 BPM procedural track over the runner, spawns glowing beat coins on timed downbeats, and awards Perfect/Good beat bonuses for collecting coins near the pulse.
- Endless run with three lanes, subtle left/right track turns, jump and double-jump physics, slide/fast-drop moves, low gates, crates, wagons, loose coin trails, combo rewards, shield and magnet pickups, speed/level scaling, and safe early spawn timing.
- Pause/resume screen for keyboard and mobile.
- Game-over screen with reason, score, coins, persisted records, replay, and main-menu actions.

## Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Lane left | `←` or `A` | Swipe left |
| Lane right | `→` or `D` | Swipe right |
| Jump / double jump | `↑`, `W`, or `Space` | Swipe up |
| Slide / fast-drop | `↓` or `S` | Swipe down |
| Pause | `P` or `Esc` | Pause button |
| Start / retry | `Enter` or `Space` | Tap button |

## Rhythm Run prototype

Choose **RHYTHM RUN** from the main menu to start the same runner with a built-in beat-game layer. A simple Web Audio loop plays at 128 BPM. Glowing coins are scheduled to reach Sofia on the beat, so switching lanes to collect them near the yellow pulse gives extra timing feedback: **Perfect beat!**, **Good beat**, or **Off beat**. Purple blockers occasionally appear away from the target coin lane so the prototype still feels like an endless runner.

## Enable GitHub Pages

1. Go to **Settings → Pages** in this repo
2. Set **Source** to `GitHub Actions`
3. Push any commit — the workflow deploys automatically

## App version

The main menu shows `Version: ...` at the bottom of the screen. Locally this uses the committed `version.js` fallback, while the GitHub Pages deploy workflow rewrites `version.js` with the current commit SHA and UTC deploy timestamp before publishing. The same workflow also adds the commit SHA as a cache-busting query string for app scripts. This makes every deployed PR or branch commit visibly identifiable in the app.

## Dev

No build step — the game uses browser-native ES modules. Edit files under `src/` and refresh the browser (serve the folder over HTTP, e.g. `python3 -m http.server 8765`, since modules don't load from `file://`).

Layout:

- `src/main.js` — Phaser config + entry point
- `src/constants.js` — tuning constants and persistent-storage helpers
- `src/projection.js` — pseudo-3D camera math (z → screen)
- `src/worlds.js` — world themes and scenery drawing
- `src/audio.js` — procedural Web Audio music + SFX
- `src/scenes/BootScene.js`, `src/scenes/GameScene.js` — menu and gameplay
- `vendor/phaser.min.js` — vendored Phaser 3.60 (no CDN dependency)

Optional syntax check (if Node is installed): `node --check src/scenes/GameScene.js` etc.
