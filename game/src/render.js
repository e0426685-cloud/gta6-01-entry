// World rendering: ground, roads with lane paint and crosswalks, sidewalks,
// flat-shaded buildings with drop shadows and window grids, palm trees,
// props, then every entity — cars, pedestrians, the player, bullets and the
// mission marker beacon. Everything is plain canvas shapes; no images.

import { PALETTE, PITCH, ROAD_W, ROAD_COUNT, VIEW_W, VIEW_H } from './config.js';
import { roadCenter } from './world.js';

export function drawWorld(ctx, world, cam, time) {
  // Grass base, then a sandy apron at the south edge for a beach feel.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(cam.x - 20, cam.y - 20, VIEW_W + 40, VIEW_H + 40);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(cam.x - 20, world.height - 130, VIEW_W + 40, 170);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(cam.x - 20, world.height - 44, VIEW_W + 40, 84);

  // Blocks: sidewalk slabs under the buildings.
  ctx.fillStyle = PALETTE.sidewalk;
  for (let bx = 0; bx < ROAD_COUNT - 1; bx++) {
    for (let by = 0; by < ROAD_COUNT - 1; by++) {
      const x = roadCenter(bx) + ROAD_W / 2 - 6;
      const y = roadCenter(by) + ROAD_W / 2 - 6;
      const s = PITCH - ROAD_W + 12;
      if (x + s < cam.x || y + s < cam.y || x > cam.x + VIEW_W || y > cam.y + VIEW_H) continue;
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = PALETTE.sidewalkEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    }
  }

  // Roads: verticals, horizontals, then intersection squares on top.
  ctx.fillStyle = PALETTE.road;
  for (let i = 0; i < ROAD_COUNT; i++) {
    const c = roadCenter(i);
    if (c + ROAD_W / 2 >= cam.x && c - ROAD_W / 2 <= cam.x + VIEW_W) {
      ctx.fillRect(c - ROAD_W / 2, cam.y - 20, ROAD_W, VIEW_H + 40);
    }
    if (c + ROAD_W / 2 >= cam.y && c - ROAD_W / 2 <= cam.y + VIEW_H) {
      ctx.fillRect(cam.x - 20, c - ROAD_W / 2, VIEW_W + 40, ROAD_W);
    }
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (let i = 0; i < ROAD_COUNT; i++) {
    const c = roadCenter(i);
    for (let d = -20; d < Math.max(VIEW_W, VIEW_H) + 40; d += 46) {
      if (c >= cam.x && c <= cam.x + VIEW_W) ctx.fillRect(c - 2, cam.y + d, 4, 26);
      if (c >= cam.y && c <= cam.y + VIEW_H) ctx.fillRect(cam.x + d, c - 2, 26, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = PALETTE.roadCross;
  for (let i = 0; i < ROAD_COUNT; i++) {
    for (let j = 0; j < ROAD_COUNT; j++) {
      const cx = roadCenter(i);
      const cy = roadCenter(j);
      if (cx < cam.x - 60 || cy < cam.y - 60 || cx > cam.x + VIEW_W + 60 || cy > cam.y + VIEW_H + 60) continue;
      for (let s = -30; s <= 30; s += 15) {
        ctx.fillRect(cx + s - 4, cy - ROAD_W / 2 + 3, 8, 12);
        ctx.fillRect(cx + s - 4, cy + ROAD_W / 2 - 15, 8, 12);
        ctx.fillRect(cx - ROAD_W / 2 + 3, cy + s - 4, 12, 8);
        ctx.fillRect(cx + ROAD_W / 2 - 15, cy + s - 4, 12, 8);
      }
    }
  }

  drawBuildings(ctx, world, cam);
  drawPropsAndTrees(ctx, world, cam, time);
}

function visible(x, y, cam, pad = 80) {
  return x > cam.x - pad && y > cam.y - pad && x < cam.x + VIEW_W + pad && y < cam.y + VIEW_H + pad;
}

function drawBuildings(ctx, world, cam) {
  for (const b of world.buildings) {
    if (!visible(b.x, b.y, cam, Math.max(b.w, b.h))) continue;
    const x = b.x - b.w / 2;
    const y = b.y - b.h / 2;
    // Drop shadow offset by the building's "height".
    const lift = 6 + b.floors * 2.2;
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(x + lift, y + lift, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(x + 5, y + 5, b.w - 10, b.h - 10);
    // Window grid on the roof slab (reads as a lit facade from above).
    ctx.fillStyle = 'rgba(70,90,110,0.55)';
    const cols = Math.max(1, Math.floor((b.w - 16) / 16));
    const rows = Math.max(1, Math.floor((b.h - 16) / 16));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.floors) % 3 === 0) continue;
        ctx.fillRect(x + 10 + i * 16, y + 10 + j * 16, 8, 8);
      }
    }
    // Shop awning stripe.
    if (b.kind === 'shop' || b.kind === 'cafe') {
      ctx.fillStyle = '#ef476f';
      ctx.fillRect(x, y + b.h - 12, b.w, 8);
    }
  }
  // Garage landmark gets a painted sign slab.
  const g = world.points.garage;
  if (visible(g.x, g.y, cam, 120)) {
    ctx.fillStyle = '#374151';
    ctx.fillRect(g.x - 52, g.y - 40, 104, 80);
    ctx.fillStyle = '#ffb703';
    ctx.fillRect(g.x - 52, g.y - 40, 104, 16);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GARAGE', g.x, g.y - 28);
  }
}

function drawPropsAndTrees(ctx, world, cam, time) {
  for (const p of world.props) {
    if (!visible(p.x, p.y, cam, 30)) continue;
    if (p.kind === 'hydrant') {
      ctx.fillStyle = '#e63946';
      ctx.fillRect(p.x - 3, p.y - 4, 6, 8);
    } else {
      ctx.fillStyle = '#b08968';
      ctx.fillRect(p.x - 6, p.y - 6, 12, 12);
      ctx.strokeStyle = '#7f5539';
      ctx.strokeRect(p.x - 6, p.y - 6, 12, 12);
    }
  }
  for (const t of world.trees) {
    if (!visible(t.x, t.y, cam, 40)) continue;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(t.x + 6, t.y + 7, 13 * t.s, 9 * t.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 4 * t.s;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.quadraticCurveTo(t.x + 3, t.y - 6, t.x + 6, t.y - 10);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.palmLeaf;
    ctx.lineWidth = 3 * t.s;
    const sway = Math.sin(time * 1.3 + t.x * 0.05) * 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + sway * 0.05;
      ctx.beginPath();
      ctx.moveTo(t.x + 6, t.y - 10);
      ctx.quadraticCurveTo(
        t.x + 6 + Math.cos(a) * 10, t.y - 10 + Math.sin(a) * 6 - 3,
        t.x + 6 + Math.cos(a) * 17, t.y - 10 + Math.sin(a) * 11 + 3,
      );
      ctx.stroke();
    }
  }
}

export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow first, unrotated-ish offset.
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(-17, -6, 42, 22);
  ctx.rotate(car.angle);
  const isPolice = car.kind === 'police';
  const body = isPolice ? PALETTE.policeBody : car.color;
  ctx.fillStyle = car.dead ? '#55565c' : body;
  roundRect(ctx, -20, -10, 40, 20, 6);
  ctx.fill();
  // Cabin / roof.
  ctx.fillStyle = isPolice ? PALETTE.policeRoof : 'rgba(30,40,55,0.85)';
  roundRect(ctx, -6, -8, 16, 16, 4);
  ctx.fill();
  // Windshield hint + headlights.
  ctx.fillStyle = 'rgba(180,230,255,0.8)';
  ctx.fillRect(9, -7, 3, 14);
  ctx.fillStyle = '#fff7ae';
  ctx.fillRect(19, -8, 3, 4);
  ctx.fillRect(19, 4, 3, 4);
  ctx.fillStyle = '#ff5964';
  ctx.fillRect(-21, -8, 3, 4);
  ctx.fillRect(-21, 4, 3, 4);
  // Wheels.
  ctx.fillStyle = '#15161a';
  ctx.fillRect(-14, -12, 9, 4);
  ctx.fillRect(6, -12, 9, 4);
  ctx.fillRect(-14, 8, 9, 4);
  ctx.fillRect(6, 8, 9, 4);
  if (isPolice) {
    const phase = Math.floor((car.phase || time * 9) % 2);
    ctx.fillStyle = phase ? '#ff2e4d' : '#3fa7ff';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 2, 10);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 2, 3);
  }
  ctx.restore();
  if (car.honk > 0) {
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HONK!', car.x, car.y - 24);
  }
}

export function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.color;
    roundRect(ctx, -11, -4, 22, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#f2c094';
    ctx.beginPath();
    ctx.arc(13, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(2, 4, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle);
  const step = Math.sin(ped.phase) * 3;
  ctx.fillStyle = '#2b2d42';
  ctx.fillRect(-2 + step * 0.4, -6, 4, 4); // legs scissor
  ctx.fillRect(-2 - step * 0.4, 2, 4, 4);
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c094';
  ctx.beginPath();
  ctx.arc(2, 0, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPlayer(ctx, player, time) {
  if (player.car) return; // the car is drawn by drawCar
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(player.angle);
  const step = Math.sin(player.walkPhase) * 3.4;
  ctx.fillStyle = '#1d3557';
  ctx.fillRect(-2 + step * 0.4, -7, 5, 5);
  ctx.fillRect(-2 - step * 0.4, 2, 5, 5);
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
  ctx.fill();
  // Gun arm toward the aim direction.
  ctx.fillStyle = PALETTE.playerSkin;
  ctx.fillRect(4, -2, 9, 4);
  ctx.fillStyle = '#22252b';
  ctx.fillRect(11, -1.6, 8, 3.2);
  ctx.fillStyle = PALETTE.playerSkin;
  ctx.beginPath();
  ctx.arc(2, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  void time;
}

export function drawBullets(ctx, bullets) {
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const b of bullets) {
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

export function drawMarker(ctx, point, time) {
  const bob = Math.sin(time * 3) * 5;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, point.r * 0.62 + Math.sin(time * 4) * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.accent;
  ctx.beginPath();
  ctx.moveTo(0, -26 + bob);
  ctx.lineTo(-10, -42 + bob);
  ctx.lineTo(10, -42 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111827';
  ctx.fillText(point.name || '', 0, 34);
  ctx.restore();
}

// Shared rounded-rectangle path helper for vehicle bodies and figures.
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
