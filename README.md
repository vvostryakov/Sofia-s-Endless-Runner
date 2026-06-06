# Sofia's Endless Runner

A browser-based endless runner MVP prototype built with Phaser 3. The project intentionally keeps visuals simple while focusing on run flow, controls, progression, and UX.

## Play

Once GitHub Pages is enabled, play at:  
`https://vvostryakov.github.io/sofia-s-endless-runner/`

## MVP flow

- Main menu with best score, best coin run, sound toggle, and how-to-play screen.
- Endless run with three lanes, jump physics, obstacles, wagons, score, coins, combo rewards, speed scaling, and safe early spawn timing.
- Pause/resume screen for keyboard and mobile.
- Game-over screen with reason, score, coins, persisted records, replay, and main-menu actions.

## Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Lane left | `←` or `A` | Swipe left |
| Lane right | `→` or `D` | Swipe right |
| Jump | `↑`, `W`, or `Space` | Swipe up |
| Pause | `P` or `Esc` | Pause button |
| Start / retry | `Enter` or `Space` | Tap button |

## Enable GitHub Pages

1. Go to **Settings → Pages** in this repo
2. Set **Source** to `GitHub Actions`
3. Push any commit — the workflow deploys automatically

## Dev

No build step. Edit `game.js`, `audio.js`, or `index.html` and refresh the browser.

Useful local checks:

```bash
node --check game.js
node --check audio.js
```
