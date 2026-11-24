// Screenshot staging for ?shot=start|play|chase|end&seed=N. Each scene is
// built from the real game state (same world, traffic, peds and HUD the
// player sees), posed deterministically, stepped a fixed number of frames
// so motion blur of life — walking peds, rolling traffic — is in the frame,
// then frozen. The renderer draws exactly what is staged here.

import { roadCenter } from './world.js';
import { makeCar } from './traffic.js';
import { addHeat } from './police.js';
import { dist } from './random.js';

// Ring the `count` closest entities around a point so a still looks alive.
function placeNear(list, x, y, count, radius) {
  // Nudge the `count` closest entities to ring the point so the frame is busy.
  const sorted = [...list].sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
  for (let i = 0; i < Math.min(count, sorted.length); i++) {
    const a = (i / Math.max(1, count)) * Math.PI * 2;
    sorted[i].x = x + Math.cos(a) * radius * (0.6 + (i % 3) * 0.25);
    sorted[i].y = y + Math.sin(a) * radius * (0.6 + (i % 3) * 0.25);
    if (sorted[i].waypoint) sorted[i].waypoint = null;
  }
}

export function stageShot(game, scene) {
  const { world, player } = game;
  const cx = roadCenter(3);
  const cy = roadCenter(4);

  if (scene === 'start') {
    game.state = 'title';
    // Camera over a lively midtown intersection behind the title panel.
    game.cam.x = cx - 640;
    game.cam.y = cy - 400;
    placeNear(game.peds, cx, cy, 8, 130);
    placeNear(game.traffic, cx, cy, 5, 170);
    return;
  }

  if (scene === 'play') {
    game.state = 'play';
    // Rico on foot at a busy intersection, first mission armed, peds and
    // traffic all around, a parked car waiting to be stolen.
    player.x = cx + 58;
    player.y = cy + 62;
    player.angle = -0.6;
    game.cam.x = player.x - 640;
    game.cam.y = player.y - 400;
    placeNear(game.peds, player.x, player.y, 9, 150);
    placeNear(game.traffic, cx, cy, 6, 190);
    const parked = game.parked[0];
    if (parked) { parked.x = player.x + 66; parked.y = player.y - 30; parked.angle = 0; }
    return;
  }

  if (scene === 'chase') {
    game.state = 'play';
    // Rico fleeing down an avenue at speed, three cruisers on his tail,
    // three stars on the HUD and the minimap lit up with police.
    const car = game.parked[0] || game.traffic[0];
    const ax = roadCenter(4);
    player.car = car;
    car.parked = false;
    car.driver = true;
    car.x = ax - 19;
    car.y = roadCenter(5);
    car.angle = -Math.PI / 2;
    car.speed = 265;
    car.axis = 'y';
    car.dir = -1;
    player.x = car.x;
    player.y = car.y;
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(ax + (i === 1 ? 19 : -19), car.y + 120 + i * 74, -Math.PI / 2, '#274690', 'police');
      cop.health = 90;
      cop.speed = 250;
      cop.phase = i * 1.7;
      game.police.push(cop);
    }
    addHeat(game.wanted, 34, game.time);
    game.wanted.stars = 3;
    placeNear(game.traffic, car.x, car.y - 260, 3, 130);
    placeNear(game.peds, car.x + 90, car.y - 120, 4, 90);
    game.cam.x = car.x - 640;
    game.cam.y = car.y - 430;
    return;
  }

  // 'end': the story-complete celebration frame at the garage — cash banked,
  // toast on screen, Rico parked up outside Marisol's.
  game.state = 'play';
  const g = world.points.garage;
  player.cash = 3800;
  player.x = g.x - 30;
  player.y = g.y + 66;
  player.angle = -Math.PI / 2;
  const car = game.parked[0];
  if (car) { car.x = g.x + 44; car.y = g.y + 60; car.angle = 0.3; }
  game.missions.done = true;
  game.missions.index = game.missions.list.length;
  game.missions.toast = {
    title: 'STORY COMPLETE',
    sub: 'You made your name in Palm Shores. Free roam — the city is yours.',
    t: 999,
  };
  placeNear(game.peds, g.x, g.y, 7, 130);
  game.cam.x = player.x - 640;
  game.cam.y = player.y - 400;
}
