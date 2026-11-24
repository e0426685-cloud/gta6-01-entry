// HUD and minimap. The HUD is drawn in screen space after the world:
// health bar, cash, wanted stars, weapon, the mission objective line and any
// intro/toast banners. The minimap is a corner panel on the same canvas
// showing the road grid, traffic, police in flashing blue/red, the player
// arrow and the yellow mission marker.

import { PALETTE, VIEW_W, VIEW_H, ROAD_COUNT } from './config.js';
import { roadCenter } from './world.js';
import { objectiveText } from './missions.js';

const MAP_W = 188;
const MAP_H = 188;

export function drawMinimap(ctx, game) {
  const x0 = VIEW_W - MAP_W - 14;
  const y0 = 14;
  const scale = MAP_W / game.world.width;
  ctx.save();
  ctx.fillStyle = 'rgba(20,26,20,0.82)';
  ctx.fillRect(x0 - 4, y0 - 4, MAP_W + 8, MAP_H + 8);
  ctx.fillStyle = '#5da24a';
  ctx.fillRect(x0, y0, MAP_W, MAP_H);
  // Roads.
  ctx.strokeStyle = '#3c3f45';
  ctx.lineWidth = Math.max(2, (76 * scale));
  ctx.beginPath();
  for (let i = 0; i < ROAD_COUNT; i++) {
    const c = roadCenter(i) * scale;
    ctx.moveTo(x0 + c, y0);
    ctx.lineTo(x0 + c, y0 + MAP_H);
    ctx.moveTo(x0, y0 + c);
    ctx.lineTo(x0 + MAP_W, y0 + c);
  }
  ctx.stroke();
  const px = (wx) => x0 + wx * scale;
  const py = (wy) => y0 + wy * scale;
  // Traffic as pale dots.
  ctx.fillStyle = '#e5e7eb';
  for (const car of game.traffic) {
    ctx.fillRect(px(car.x) - 1.5, py(car.y) - 1.5, 3, 3);
  }
  for (const car of game.parked) {
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(px(car.x) - 1.5, py(car.y) - 1.5, 3, 3);
  }
  // Police flash blue/red.
  const flash = Math.floor(game.time * 3) % 2 === 0;
  for (const cop of game.police) {
    ctx.fillStyle = flash ? '#3fa7ff' : '#ff2e4d';
    ctx.beginPath();
    ctx.arc(px(cop.x), py(cop.y), 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker in yellow.
  if (game.marker) {
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.arc(px(game.marker.x), py(game.marker.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  // Player arrow.
  const pos = game.playerPos;
  ctx.save();
  ctx.translate(px(pos.x), py(pos.y));
  ctx.rotate(game.player.car ? game.player.car.angle : game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// Five star glyphs, lit gold up to the current wanted level.
function starRow(ctx, stars, x, y) {
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd60a' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', x + i * 28, y);
  }
}

export function drawHUD(ctx, game) {
  const { player, wanted } = game;
  // Top-left panel: health + cash + weapon.
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(14, 14, 252, 96);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 26, 38);
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(96, 26, 156, 14);
  ctx.fillStyle = player.health > 30 ? PALETTE.good : PALETTE.danger;
  ctx.fillRect(96, 26, 156 * Math.max(0, player.health) / 100, 14);
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(`CASH  $${player.cash}`, 26, 66);
  ctx.fillText(`WEAPON  ${player.car ? '— (driving)' : player.weapon}`, 26, 92);
  if (game.muted) {
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText('MUTED (M)', 170, 92);
  }

  // Wanted stars under the minimap.
  starRow(ctx, wanted.stars, VIEW_W - MAP_W - 8, 232);
  if (wanted.bust > 0.05 && wanted.stars > 0) {
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(VIEW_W - MAP_W - 12, 244, MAP_W, 16);
    ctx.fillStyle = PALETTE.danger;
    ctx.fillRect(VIEW_W - MAP_W - 12, 244, MAP_W * Math.min(1, wanted.bust), 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('BUSTED METER', VIEW_W - MAP_W - 6, 256);
  }

  drawMinimap(ctx, game);

  // Objective line, bottom centre.
  const objective = objectiveText(game.missions);
  ctx.font = 'bold 17px system-ui, sans-serif';
  const w = Math.min(VIEW_W - 40, ctx.measureText(objective).width + 36);
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect((VIEW_W - w) / 2, VIEW_H - 52, w, 36);
  ctx.fillStyle = PALETTE.accent;
  ctx.textAlign = 'center';
  ctx.fillText(objective, VIEW_W / 2, VIEW_H - 28);

  // Controls hint, bottom-left, small.
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const hint = player.car
    ? 'WASD drive · Space handbrake · E exit car · Esc pause'
    : 'WASD move · Shift run · Mouse aim · Click/Space shoot · E enter car';
  ctx.fillText(hint, 16, VIEW_H - 12);

  // Mission intro banner (top centre).
  if (game.missions.intro) {
    ctx.font = 'italic 16.5px system-ui, sans-serif';
    const text = game.missions.intro.text;
    const bw = Math.min(VIEW_W - 120, ctx.measureText(text).width + 40);
    ctx.fillStyle = 'rgba(16,20,28,0.85)';
    ctx.fillRect((VIEW_W - bw) / 2, 18, bw, 40);
    ctx.fillStyle = '#ffe66d';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW_W / 2, 44);
  }

  // Toast (mission complete etc.), centre.
  if (game.missions.toast) {
    const toast = game.missions.toast;
    ctx.fillStyle = 'rgba(16,20,28,0.88)';
    ctx.fillRect(VIEW_W / 2 - 280, 120, 560, 96);
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(VIEW_W / 2 - 280, 120, 560, 96);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(toast.title, VIEW_W / 2, 164);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(toast.sub, VIEW_W / 2, 194);
  }

  // "Press E" prompt when a car is in reach on foot.
  if (game.nearCar && !player.car) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText('Press E to steal this car', VIEW_W / 2, VIEW_H - 120);
  }
}
