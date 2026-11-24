// Pedestrians: they stroll the sidewalk lines around each block, pause at
// corners, and run from danger — a fast-approaching car, a gunshot, or a
// chase unfolding next to them. Downed pedestrians fall and stay down
// (non-graphic: they simply lie flat and fade from the simulation).

import { PITCH, ROAD_W, ROAD_COUNT, PED_COLORS } from './config.js';
import { roadCenter, collideCircle } from './world.js';
import { randRange, pick, dist } from './random.js';

// Sidewalk walking lines sit just outside the road edge.
const WALK_OFF = ROAD_W / 2 + 9;

export function spawnPeds(world, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const avenue = Math.floor(rng() * (ROAD_COUNT - 1));
    const along = randRange(rng, 60, world.width - 60);
    const vertical = rng() < 0.5;
    const side = rng() < 0.5 ? -1 : 1;
    let x, y;
    if (vertical) {
      x = roadCenter(avenue) + side * WALK_OFF;
      y = along;
    } else {
      x = along;
      y = roadCenter(avenue) + side * WALK_OFF;
    }
    peds.push({
      x, y,
      angle: randRange(rng, 0, Math.PI * 2),
      speed: 0,
      walkSpeed: randRange(rng, 42, 72),
      color: pick(rng, PED_COLORS),
      health: 30,
      state: 'walk', // walk | flee | down
      panic: 0,
      waypoint: null,
      retarget: randRange(rng, 0, 3),
      phase: randRange(rng, 0, Math.PI * 2),
    });
  }
  return peds;
}

function pickWaypoint(ped, world, rng) {
  // A new target somewhere along the sidewalk network: same line, random
  // distance, so peds drift along streets and around corners naturally.
  const t = randRange(rng, 120, 420);
  const a = ped.angle + (rng() < 0.35 ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : 0);
  ped.waypoint = {
    x: Math.max(20, Math.min(world.width - 20, ped.x + Math.cos(a) * t)),
    y: Math.max(20, Math.min(world.height - 20, ped.y + Math.sin(a) * t)),
  };
}

// A loud or violent event sends everyone in earshot running.
export function scarePeds(peds, x, y, radius) {
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.panic = randRange(Math.random, 1.6, 3.2);
      ped.angle = Math.atan2(ped.y - y, ped.x - x) + randRange(Math.random, -0.5, 0.5);
    }
  }
}

export function updatePed(ped, dt, world, rng, threats) {
  if (ped.state === 'down') return;
  ped.phase += dt * (ped.state === 'flee' ? 13 : 8);

  // Notice fast cars bearing down on them.
  if (ped.state !== 'flee') {
    for (const t of threats) {
      const speed = Math.hypot(t.vx || 0, t.vy || 0);
      if (speed > 130 && dist(ped.x, ped.y, t.x, t.y) < 74) {
        ped.state = 'flee';
        ped.panic = 1.8;
        ped.angle = Math.atan2(ped.y - t.y, ped.x - t.x);
        break;
      }
    }
  }

  let speed = ped.walkSpeed;
  if (ped.state === 'flee') {
    ped.panic -= dt;
    speed = 168;
    if (ped.panic <= 0) { ped.state = 'walk'; ped.waypoint = null; }
  } else {
    ped.retarget -= dt;
    if (!ped.waypoint || ped.retarget <= 0 || dist(ped.x, ped.y, ped.waypoint.x, ped.waypoint.y) < 10) {
      pickWaypoint(ped, world, rng);
      ped.retarget = randRange(rng, 4, 9);
    }
    const want = Math.atan2(ped.waypoint.y - ped.y, ped.waypoint.x - ped.x);
    let d = want - ped.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    ped.angle += d * Math.min(1, dt * 6);
  }

  const pos = { x: ped.x + Math.cos(ped.angle) * speed * dt, y: ped.y + Math.sin(ped.angle) * speed * dt };
  collideCircle(world, pos, 9);
  // If a building shoved us sideways, re-aim a little so we don't grind.
  if (Math.abs(pos.x - ped.x) < 0.01 && Math.abs(pos.y - ped.y) < 0.01) {
    ped.angle += 1.2 * dt + 0.02;
  }
  ped.x = pos.x;
  ped.y = pos.y;
  ped.speed = speed;
}
