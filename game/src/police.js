// The wanted system and the Palm Shores PD. Crimes add heat; every ten heat
// points is a star (max five). Heat decays slowly while no officer can see
// the player. Police cars spawn at the map edge in proportion to the stars
// and chase to ram; on foot or at low speed, an officer in contact range
// fills the bust meter — fill it and the run ends BUSTED.

import { WANTED } from './config.js';
import { makeCar } from './traffic.js';
import { collideCircle } from './world.js';
import { clamp, dist } from './random.js';

export function createWanted() {
  return { heat: 0, stars: 0, lastCrime: -99, seen: false, bust: 0, spawnTimer: 0 };
}

export function addHeat(wanted, points, now) {
  wanted.heat = clamp(wanted.heat + points, 0, WANTED.pointsPerStar * WANTED.maxStars);
  wanted.lastCrime = now;
  wanted.stars = Math.floor(wanted.heat / WANTED.pointsPerStar);
}

export function clearHeat(wanted) {
  wanted.heat = 0;
  wanted.stars = 0;
  wanted.bust = 0;
}

export function updateWanted(wanted, dt, now, police, playerPos) {
  wanted.seen = police.some((c) => !c.dead && dist(c.x, c.y, playerPos.x, playerPos.y) < WANTED.sightRange);
  if (!wanted.seen && now - wanted.lastCrime > 4 && wanted.heat > 0) {
    wanted.heat = Math.max(0, wanted.heat - WANTED.decayPerSecond * dt);
    wanted.stars = Math.floor(wanted.heat / WANTED.pointsPerStar);
  }
  if (wanted.stars === 0) wanted.bust = 0;
}

// How many cruisers the dispatcher sends for a given star count.
export function desiredPolice(stars) {
  if (stars <= 0) return 0;
  return Math.min(6, stars + 1);
}

export function spawnPolice(world, playerPos, rng) {
  // Spawn just outside view, on a road near the world edge side closest to
  // the player, so the chase arrives quickly but visibly on the minimap.
  const side = Math.floor(rng() * 4);
  const margin = 60;
  let x = playerPos.x + (rng() - 0.5) * 500;
  let y = playerPos.y + (rng() - 0.5) * 500;
  if (side === 0) y = playerPos.y - 520;
  if (side === 1) y = playerPos.y + 520;
  if (side === 2) x = playerPos.x - 520;
  if (side === 3) x = playerPos.x + 520;
  x = clamp(x, margin, world.width - margin);
  y = clamp(y, margin, world.height - margin);
  const car = makeCar(x, y, 0, '#274690', 'police');
  car.health = 90;
  car.cruise = 330;
  return car;
}

// Chase steering: aim at the player's predicted position, slide along
// buildings, and ram on contact (the caller applies the shove/damage).
export function updatePoliceCar(car, dt, world, target) {
  if (car.dead) return;
  const lead = 0.35;
  const tx = target.x + (target.vx || 0) * lead;
  const ty = target.y + (target.vy || 0) * lead;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let d = want - car.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const dTarget = dist(car.x, car.y, tx, ty);
  const maxTurn = 2.6 * dt;
  car.angle += clamp(d, -maxTurn, maxTurn);
  const topSpeed = dTarget < 60 ? 120 : 348;
  car.speed += (topSpeed - car.speed) * Math.min(1, dt * 1.6);
  const pos = {
    x: car.x + Math.cos(car.angle) * car.speed * dt,
    y: car.y + Math.sin(car.angle) * car.speed * dt,
  };
  collideCircle(world, pos, 17);
  car.x = pos.x;
  car.y = pos.y;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  // Light bar phase for the renderer.
  car.phase = (car.phase || 0) + dt * 9;
}
