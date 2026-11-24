// Civilian traffic and parked cars. Moving cars follow the avenue grid in
// right-hand lanes, pick a new direction at intersections, slow for the car
// ahead and stop (briefly) when the player steps in front of them. Parked
// cars line the kerbs and are the usual way the player gets wheels.

import { ROAD_COUNT, CAR_COLORS, WORLD_W } from './config.js';
import { roadCenter } from './world.js';
import { makeRng, randRange, pick } from './random.js';

const LANE = 19; // lane offset from the avenue centre line

export function makeCar(x, y, angle, color, kind = 'civilian') {
  return {
    x, y, angle,
    vx: 0, vy: 0, speed: 0,
    color, kind,
    health: 60,
    driver: kind !== 'parked',
    parked: kind === 'parked',
    // AI state for grid driving
    axis: Math.abs(Math.sin(angle)) > 0.5 ? 'y' : 'x',
    dir: 1,
    cruise: randRange(Math.random, 95, 150),
    turnCooldown: 0,
    honk: 0,
    dead: false,
  };
}

function laneTarget(car) {
  // The point the car steers for: far ahead on its current avenue lane.
  if (car.axis === 'x') {
    return { x: car.x + car.dir * 300, y: Math.round((car.y - 120) / 1) };
  }
  return { x: car.x, y: car.y + car.dir * 300 };
}

export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const avenue = Math.floor(rng() * ROAD_COUNT);
    const along = randRange(rng, 80, world.width - 80);
    const dir = rng() < 0.5 ? 1 : -1;
    let x, y, angle;
    if (vertical) {
      // Right-hand traffic: heading +y uses the lane west... east of centre.
      x = roadCenter(avenue) + (dir > 0 ? -LANE : LANE);
      y = along;
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = along;
      y = roadCenter(avenue) + (dir > 0 ? LANE : -LANE);
      angle = dir > 0 ? 0 : Math.PI;
    }
    const car = makeCar(x, y, angle, pick(rng, CAR_COLORS), rng() < 0.14 ? 'taxi' : 'civilian');
    if (car.kind === 'taxi') car.color = '#ffc53d';
    car.axis = vertical ? 'y' : 'x';
    car.dir = dir;
    car.speed = car.cruise * 0.7;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(world, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < count * 30) {
    const avenue = Math.floor(rng() * ROAD_COUNT);
    const along = randRange(rng, 90, world.width - 90);
    const vertical = rng() < 0.5;
    const side = rng() < 0.5 ? -1 : 1;
    let x, y, angle;
    if (vertical) {
      x = roadCenter(avenue) + side * 30;
      y = along;
      angle = Math.PI / 2;
    } else {
      x = along;
      y = roadCenter(avenue) + side * 30;
      angle = 0;
    }
    // Keep kerbs near intersections and the spawn clear.
    let clear = true;
    for (let i = 0; i < ROAD_COUNT; i++) {
      if (Math.abs((vertical ? y : x) - roadCenter(i)) < 52) clear = false;
    }
    if (Math.hypot(x - world.spawn.x, y - world.spawn.y) < 60) clear = false;
    if (!clear) continue;
    cars.push(makeCar(x, y, angle, pick(rng, CAR_COLORS), 'parked'));
  }
  return cars;
}

function nearestAvenue(value) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < ROAD_COUNT; i++) {
    const d = Math.abs(value - roadCenter(i));
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Advance one AI car. `blockers` are things worth braking for (other cars,
// the player). Returns nothing; the car is mutated.
export function updateTrafficCar(car, dt, blockers, rng) {
  if (car.parked || car.dead) return;
  car.turnCooldown -= dt;
  car.honk = Math.max(0, car.honk - dt);

  // At an intersection, maybe turn onto the crossing avenue.
  const ax = nearestAvenue(car.x);
  const ay = nearestAvenue(car.y);
  const nearCrossX = Math.abs(car.x - roadCenter(ax)) < 6;
  const nearCrossY = Math.abs(car.y - roadCenter(ay)) < 6;
  if (car.turnCooldown <= 0 && nearCrossX && nearCrossY) {
    car.turnCooldown = 1.2;
    if (rng() < 0.4) {
      if (car.axis === 'x') {
        car.axis = 'y';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.x = roadCenter(ax) + (car.dir > 0 ? -LANE : LANE);
      } else {
        car.axis = 'x';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.y = roadCenter(ay) + (car.dir > 0 ? LANE : -LANE);
      }
    }
  }

  // Snap gently toward the correct lane for the current avenue/direction.
  let targetSpeed = car.cruise;
  if (car.axis === 'x') {
    const laneY = roadCenter(ay) + (car.dir > 0 ? LANE : -LANE);
    car.y += (laneY - car.y) * Math.min(1, dt * 3);
    car.angle = car.dir > 0 ? 0 : Math.PI;
  } else {
    const laneX = roadCenter(ax) + (car.dir > 0 ? -LANE : LANE);
    car.x += (laneX - car.x) * Math.min(1, dt * 3);
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  // Brake for anything close ahead.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const b of blockers) {
    if (b === car) continue;
    const dx = b.x - car.x;
    const dy = b.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (ahead > 0 && ahead < 52 && side < 20) {
      targetSpeed = 0;
      if (b.isPlayer && car.honk <= 0) car.honk = 0.9;
    }
  }

  if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 130 * dt);
  else car.speed = Math.max(targetSpeed, car.speed - 320 * dt);
  car.x += fx * car.speed * dt;
  car.y += fy * car.speed * dt;
  car.vx = fx * car.speed;
  car.vy = fy * car.speed;

  // At the world edge, turn around onto the opposite lane of the avenue.
  if (car.axis === 'x' && (car.x < 44 || car.x > WORLD_W - 44)) {
    car.dir *= -1;
    car.x = Math.max(44, Math.min(WORLD_W - 44, car.x));
  }
  if (car.axis === 'y' && (car.y < 44 || car.y > WORLD_W - 44)) {
    car.dir *= -1;
    car.y = Math.max(44, Math.min(WORLD_W - 44, car.y));
  }
}

export function trafficRng(seed) {
  return makeRng(seed * 31 + 7);
}
export { laneTarget };
