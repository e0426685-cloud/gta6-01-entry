// Procedural city generation for Palm Shores plus the collision queries
// every mover uses. The city is a grid of avenues; between them sit blocks
// with a sidewalk rim, one to four flat-shaded buildings, palm trees and
// street props. Generation is seeded, so a seed always yields the same city.

import { PITCH, ROAD_W, ROAD_COUNT, WORLD_W, WORLD_H, BUILDING_COLORS } from './config.js';
import { makeRng, randRange, randInt, pick, clamp } from './random.js';

// World-space centre line of avenue i (same for x and y).
export function roadCenter(i) {
  return ROAD_W / 2 + 120 + i * PITCH;
}

export function isOnRoad(x, y) {
  const half = ROAD_W / 2;
  for (let i = 0; i < ROAD_COUNT; i++) {
    const c = roadCenter(i);
    if (Math.abs(x - c) <= half || Math.abs(y - c) <= half) return true;
  }
  return false;
}

export function createWorld(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const buildings = [];
  const trees = [];
  const props = [];
  const colliders = []; // solid rectangles: {x, y, w, h} centred

  for (let bx = 0; bx < ROAD_COUNT - 1; bx++) {
    for (let by = 0; by < ROAD_COUNT - 1; by++) {
      const x0 = roadCenter(bx) + ROAD_W / 2;
      const y0 = roadCenter(by) + ROAD_W / 2;
      const size = PITCH - ROAD_W; // block interior edge to edge
      // Split the block into a 2x2 arrangement with jitter; some lots stay
      // open as parking or plaza.
      const lots = [
        { x: x0 + 14, y: y0 + 14, w: size / 2 - 22, h: size / 2 - 22 },
        { x: x0 + size / 2 + 8, y: y0 + 14, w: size / 2 - 22, h: size / 2 - 22 },
        { x: x0 + 14, y: y0 + size / 2 + 8, w: size / 2 - 22, h: size / 2 - 22 },
        { x: x0 + size / 2 + 8, y: y0 + size / 2 + 8, w: size / 2 - 22, h: size / 2 - 22 },
      ];
      for (const lot of lots) {
        if (rng() < 0.16) continue; // open lot
        const inset = randRange(rng, 0, 10);
        const b = {
          x: lot.x + inset + (lot.w - inset * 2) / 2,
          y: lot.y + inset + (lot.h - inset * 2) / 2,
          w: lot.w - inset * 2,
          h: lot.h - inset * 2,
          color: pick(rng, BUILDING_COLORS),
          roof: pick(rng, ['#d9c7a7', '#b08968', '#e5e5e5', '#9c6644', '#ced4da']),
          floors: randInt(rng, 2, 9),
          kind: pick(rng, ['shop', 'office', 'hotel', 'apartments', 'cafe']),
        };
        buildings.push(b);
        colliders.push({ x: b.x, y: b.y, w: b.w, h: b.h });
      }
      // Palms along the sidewalk corners and mid-edges.
      const spots = [
        [x0 + 8, y0 + 8], [x0 + size - 8, y0 + 8],
        [x0 + 8, y0 + size - 8], [x0 + size - 8, y0 + size - 8],
        [x0 + size / 2, y0 + 8], [x0 + size / 2, y0 + size - 8],
      ];
      for (const [tx, ty] of spots) {
        if (rng() < 0.72) trees.push({ x: tx + randRange(rng, -3, 3), y: ty + randRange(rng, -3, 3), s: randRange(rng, 0.8, 1.25) });
      }
      // Props: crates, hydrants and newspaper boxes near corners.
      if (rng() < 0.6) {
        props.push({ x: x0 + 12, y: y0 + size - 12, kind: 'hydrant' });
        colliders.push({ x: x0 + 12, y: y0 + size - 12, w: 8, h: 8 });
      }
      if (rng() < 0.5) {
        props.push({ x: x0 + size - 12, y: y0 + 12, kind: 'crate' });
        colliders.push({ x: x0 + size - 12, y: y0 + 12, w: 12, h: 12 });
      }
    }
  }

  // Landmarks the story uses. The garage sits by the second avenue from the
  // south-west; other points are spread so missions cross the whole map.
  const garage = { x: roadCenter(1) + 70, y: roadCenter(ROAD_COUNT - 2) + 60, r: 46, name: "Marisol's Garage" };
  const points = {
    garage,
    diner: { x: roadCenter(3), y: roadCenter(1) - 70, r: 34, name: 'Sunset Diner' },
    docks: { x: roadCenter(ROAD_COUNT - 2) + 60, y: roadCenter(1) + 60, r: 40, name: 'Palm Docks' },
    hotel: { x: roadCenter(ROAD_COUNT - 2), y: roadCenter(ROAD_COUNT - 2) - 80, r: 40, name: 'Coral Hotel' },
    lookout: { x: roadCenter(0) + 60, y: roadCenter(0) + 60, r: 40, name: 'North Lookout' },
  };

  return {
    seed,
    width: WORLD_W,
    height: WORLD_H,
    buildings,
    trees,
    props,
    colliders,
    points,
    spawn: { x: roadCenter(1) + 66, y: roadCenter(ROAD_COUNT - 2) - 40 },
  };
}

// Push a circle (x, y, r) out of every solid rectangle and the world edge.
// Mutates and returns the position object {x, y, hit}.
export function collideCircle(world, pos, r) {
  let hit = false;
  pos.x = clamp(pos.x, r, world.width - r);
  pos.y = clamp(pos.y, r, world.height - r);
  for (const c of world.colliders) {
    const hw = c.w / 2;
    const hh = c.h / 2;
    const dx = pos.x - c.x;
    const dy = pos.y - c.y;
    if (Math.abs(dx) < hw + r && Math.abs(dy) < hh + r) {
      hit = true;
      const pushX = hw + r - Math.abs(dx);
      const pushY = hh + r - Math.abs(dy);
      if (pushX < pushY) pos.x = c.x + (dx >= 0 ? hw + r : -hw - r);
      else pos.y = c.y + (dy >= 0 ? hh + r : -hh - r);
    }
  }
  return hit;
}

// Cheap yes/no overlap test used by bullets and spawn checks.
export function circleHitsBuilding(world, x, y, r) {
  for (const c of world.colliders) {
    if (Math.abs(x - c.x) < c.w / 2 + r && Math.abs(y - c.y) < c.h / 2 + r) return true;
  }
  return false;
}
