// Keyboard and mouse state. The rest of the game polls this object; nothing
// else touches DOM events, which keeps the controls easy to remap and test.

export const input = {
  keys: new Set(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  pressed: new Set(), // keys that went down this frame
};

let attached = false;

export function attachInput(canvas) {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', (ev) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(ev.key)) {
      ev.preventDefault();
    }
    if (!input.keys.has(ev.key.toLowerCase())) input.pressed.add(ev.key.toLowerCase());
    input.keys.add(ev.key.toLowerCase());
    if (ev.key === 'Enter') input.pressed.add('enter');
  });
  window.addEventListener('keyup', (ev) => {
    input.keys.delete(ev.key.toLowerCase());
  });
  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((ev.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', () => { input.mouseDown = true; });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });
}

export function down(...names) {
  return names.some((n) => input.keys.has(n));
}

export function justPressed(...names) {
  return names.some((n) => input.pressed.has(n));
}

export function endFrame() {
  input.pressed.clear();
}
