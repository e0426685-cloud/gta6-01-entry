# Palm Shores Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/e0426685-cloud/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/e0426685-cloud/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original top-down open-world crime game in the spirit of the classic 2D
era, built with vanilla JavaScript and a single canvas — no libraries, no
assets, no network. Welcome to Palm Shores, 1986: a sun-soaked grid of
avenues, palms and pastel rooftops where you are Rico Vale, a wheelman
running jobs for Marisol's garage while the Palm Shores PD does its best to
put your name on a cell door.

## Controls

- **WASD / Arrow keys** — move on foot, drive in a car
- **Shift** — run (on foot)
- **E** — steal / enter a car, exit a car
- **Mouse** — aim · **Click or Space** — shoot pistol (on foot)
- **Space** (in a car) — handbrake
- **Esc / P** — pause · **M** — mute · **Enter** — start / confirm

## Features

- Procedurally generated city (seeded): road grid, sidewalks, crosswalks,
  varied flat-shaded buildings with shadows, palm trees, props and collision
- Free-roam driving with acceleration, braking, reverse, steering and
  handbrake physics; parked cars to steal and live traffic AI on the avenues
- Pedestrians who stroll the sidewalks and flee from danger, gunfire and
  speeding cars
- A 0–5 star wanted system: carjacking, collisions, reckless driving and
  gunfire raise the heat; police cruisers spawn, chase and ram; get stopped
  and the bust meter fills — stay out of sight and the heat decays
- On-foot pistol combat with tracers, health for everyone, and downed
  characters who fall where they stand
- A four-mission story chain for Marisol's garage (steal & deliver, a package
  run under heat, a police escape, a timed final drop) with cash rewards,
  intro briefings, objective text and map markers — then free roam
- Full HUD: health, cash, wanted stars, weapon, objective line, and a live
  minimap with traffic, flashing police and the mission marker
- Title, pause, BUSTED and WASTED screens; progress (cash + story) saved to
  localStorage, with Continue on the title screen
- WebAudio-synthesised sound only: engine hum, sirens, gunshots, chimes and
  a looping bassline

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

Or open `game/index.html` through any static file server. To produce the
hand-in output (`game/`, `screenshots/` and `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
