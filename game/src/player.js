// The player: Rico on foot and Rico behind the wheel. On foot he walks or
// runs with WASD/arrows and aims with the mouse; in a car the same keys
// become throttle, brake/reverse and steering, with Space as handbrake.
// Shooting lives here too — a simple hitscan-feeling pistol with visible
// tracer bullets, a fire-rate cap and a small spread.

import { PLAYER, CAR } from './config.js';
import { collideCircle } from './world.js';
import { down } from './input.js';
import { clamp } from './random.js';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    cash: 0,
    car: null, // car object being driven, or null on foot
    weapon: 'Pistol',
    fireCooldown: 0,
    dead: false,
    walkPhase: 0,
  };
}

// The player's effective position/velocity — the car's, while driving.
export function playerPos(player) {
  if (player.car) return { x: player.car.x, y: player.car.y, vx: player.car.vx, vy: player.car.vy };
  return { x: player.x, y: player.y, vx: player.vx, vy: player.vy };
}

export function updatePlayerOnFoot(player, dt, world, cam, mouse) {
  let mx = 0;
  let my = 0;
  if (down('w', 'arrowup')) my -= 1;
  if (down('s', 'arrowdown')) my += 1;
  if (down('a', 'arrowleft')) mx -= 1;
  if (down('d', 'arrowright')) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  const speed = down('shift') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const pos = {
    x: player.x + (mx / len) * speed * (mx || my ? 1 : 0) * dt,
    y: player.y + (my / len) * speed * (mx || my ? 1 : 0) * dt,
  };
  collideCircle(world, pos, PLAYER.radius);
  player.vx = (pos.x - player.x) / Math.max(dt, 0.001);
  player.vy = (pos.y - player.y) / Math.max(dt, 0.001);
  player.x = pos.x;
  player.y = pos.y;
  if (mx || my) player.walkPhase += dt * 10;
  // Face the mouse (aiming), falling back to the move direction.
  const worldMouseX = cam.x + mouse.x;
  const worldMouseY = cam.y + mouse.y;
  player.angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
}

// Returns events { crashed: impactSpeed } so the caller can price the crime.
export function updatePlayerCar(player, dt, world) {
  const car = player.car;
  const events = { crashed: 0 };
  const forward = down('w', 'arrowup');
  const back = down('s', 'arrowdown');
  const left = down('a', 'arrowleft');
  const right = down('d', 'arrowright');
  const handbrake = down(' ');

  if (forward) car.speed += CAR.accel * dt;
  else if (back) {
    if (car.speed > 12) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.55 * dt;
  } else {
    car.speed -= car.speed * 0.55 * dt; // engine drag
  }
  if (handbrake) car.speed -= car.speed * 2.6 * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 4) {
    const grip = handbrake ? 1.5 : 1;
    car.angle += steer * CAR.turnRate * grip * dt * Math.sign(car.speed) *
      Math.min(1, Math.abs(car.speed) / 120);
  }

  const pos = {
    x: car.x + Math.cos(car.angle) * car.speed * dt,
    y: car.y + Math.sin(car.angle) * car.speed * dt,
  };
  const before = { x: car.x, y: car.y };
  const hit = collideCircle(world, pos, CAR.radius);
  if (hit && Math.abs(car.speed) > 90) {
    events.crashed = Math.abs(car.speed);
    car.health -= Math.abs(car.speed) * 0.06;
    car.speed *= -0.25;
  } else if (hit) {
    car.speed *= 0.6;
  }
  car.x = pos.x;
  car.y = pos.y;
  car.vx = (car.x - before.x) / Math.max(dt, 0.001);
  car.vy = (car.y - before.y) / Math.max(dt, 0.001);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return events;
}

// Try to fire the pistol toward the mouse. Pushes a bullet into `bullets`
// and returns true when a shot actually left the barrel.
export function tryShoot(player, bullets, cam, mouse, now) {
  if (player.car || player.fireCooldown > 0) return false;
  player.fireCooldown = 0.24;
  const tx = cam.x + mouse.x;
  const ty = cam.y + mouse.y;
  const angle = Math.atan2(ty - player.y, tx - player.x) + (Math.random() - 0.5) * 0.05;
  bullets.push({
    x: player.x + Math.cos(angle) * 14,
    y: player.y + Math.sin(angle) * 14,
    vx: Math.cos(angle) * 760,
    vy: Math.sin(angle) * 760,
    life: 0.55,
    fromPlayer: true,
    born: now,
  });
  return true;
}

export function updateBullets(bullets, dt, world, targets, onHit) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let remove = b.life <= 0;
    if (!remove) {
      for (const c of world.colliders) {
        if (Math.abs(b.x - c.x) < c.w / 2 && Math.abs(b.y - c.y) < c.h / 2) { remove = true; break; }
      }
    }
    if (!remove) {
      for (const t of targets) {
        if (t.dead || t.state === 'down') continue;
        const r = t.kind ? 20 : 11;
        if (Math.hypot(b.x - t.x, b.y - t.y) < r) {
          onHit(t, b);
          remove = true;
          break;
        }
      }
    }
    if (remove) bullets.splice(i, 1);
  }
}
