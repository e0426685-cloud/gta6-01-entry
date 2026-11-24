// The story chain: four jobs for Marisol's garage, then free roam. Each
// mission is data (title, intro, objective) plus a small state machine in
// updateMissions that watches the world: reach a marker, carry a package,
// shake the heat, beat a clock. Completing one pays cash, plays the toast
// and arms the next.

import { dist } from './random.js';

export function createMissions(world) {
  const p = world.points;
  return [
    {
      id: 'wheels-up',
      title: 'Wheels Up',
      intro: 'Marisol: "Rico, I need a car — any car — in my garage. Steal one and bring it home."',
      reward: 500,
      steps: [
        { text: 'Steal a car (walk up and press E)', type: 'steal' },
        { text: "Deliver the car to Marisol's Garage", type: 'reach', point: p.garage, needCar: true },
      ],
    },
    {
      id: 'package-run',
      title: 'Package Run',
      intro: 'Marisol: "A package waits at the Sunset Diner. Grab it on foot and bring it back. Expect company."',
      reward: 800,
      steps: [
        { text: 'Pick up the package at the Sunset Diner (on foot)', type: 'reach', point: p.diner, needFoot: true, pickup: true },
        { text: 'Bring the package back to the garage', type: 'reach', point: p.garage },
      ],
    },
    {
      id: 'heat-escape',
      title: 'Heat Escape',
      intro: 'Marisol: "The PSPD is watching the garage. Draw their attention, then lose them at the North Lookout."',
      reward: 1000,
      steps: [
        { text: 'Get the police on your tail (reach 2 stars)', type: 'heat', stars: 2 },
        { text: 'Escape to the North Lookout', type: 'reach', point: p.lookout },
      ],
    },
    {
      id: 'final-drop',
      title: 'The Final Drop',
      intro: 'Marisol: "Last job. Take this car to the Coral Hotel — fast. The buyer leaves in two minutes."',
      reward: 1500,
      steps: [
        { text: 'Get in a car', type: 'steal' },
        { text: 'Reach the Coral Hotel before time runs out', type: 'reach', point: p.hotel, needCar: true, timeLimit: 120 },
      ],
    },
  ];
}

export function createMissionState(missions, startIndex = 0) {
  return {
    list: missions,
    index: startIndex,
    step: 0,
    timer: null, // seconds left on a timed step
    toast: null, // { title, sub, t }
    intro: null, // { text, t }
    done: startIndex >= missions.length,
  };
}

export function currentStep(state) {
  if (state.done) return null;
  return state.list[state.index].steps[state.step];
}

export function startMissionIntro(state) {
  if (state.done) return;
  state.intro = { text: state.list[state.index].intro, t: 6 };
  const step = currentStep(state);
  state.timer = step && step.timeLimit ? step.timeLimit : null;
}

// Advances the chain. `ctx` carries the live facts; `events` collects
// one-shot happenings (pickup, complete) for sound and crime effects.
// Returns true when a mission completed this call.
export function updateMissions(state, dt, ctx, events) {
  if (state.toast) {
    state.toast.t -= dt;
    if (state.toast.t <= 0) state.toast = null;
  }
  if (state.intro) {
    state.intro.t -= dt;
    if (state.intro.t <= 0) state.intro = null;
  }
  if (state.done) return false;
  const step = currentStep(state);
  if (!step) return false;

  if (step.timeLimit) {
    if (state.timer === null) state.timer = step.timeLimit;
    state.timer -= dt;
    if (state.timer <= 0) {
      // Failed the clock: restart this mission, keep the story position.
      state.step = 0;
      state.timer = null;
      state.toast = { title: 'OUT OF TIME', sub: 'The buyer left. Try the job again.', t: 3.5 };
      events.push('mission-failed');
      startMissionIntro(state);
      return false;
    }
  }

  let complete = false;
  if (step.type === 'steal') complete = Boolean(ctx.inCar);
  else if (step.type === 'heat') complete = ctx.stars >= step.stars;
  else if (step.type === 'reach') {
    const inZone = dist(ctx.x, ctx.y, step.point.x, step.point.y) < step.point.r;
    if (inZone && (!step.needCar || ctx.inCar) && (!step.needFoot || !ctx.inCar)) {
      complete = true;
      if (step.pickup) events.push('pickup');
    }
  }
  if (!complete) return false;

  const mission = state.list[state.index];
  state.step += 1;
  state.timer = null;
  if (state.step < mission.steps.length) {
    const next = currentStep(state);
    if (next && next.timeLimit) state.timer = next.timeLimit;
    events.push('step-done');
    return false;
  }
  // Mission complete.
  ctx.player.cash += mission.reward;
  events.push('mission-complete');
  state.toast = {
    title: 'MISSION COMPLETE',
    sub: `${mission.title} — +$${mission.reward}`,
    t: 4,
  };
  state.index += 1;
  state.step = 0;
  if (state.index >= state.list.length) {
    state.done = true;
    state.toast = {
      title: 'STORY COMPLETE',
      sub: 'You made your name in Palm Shores. Free roam — the city is yours.',
      t: 6,
    };
  } else {
    startMissionIntro(state);
  }
  return true;
}

// The one-line objective shown on the HUD, with the clock when timed.
export function objectiveText(state) {
  if (state.done) return 'Free roam — Palm Shores is yours. Cause trouble or cruise.';
  const mission = state.list[state.index];
  const step = currentStep(state);
  let text = `${mission.title}: ${step.text}`;
  if (step.timeLimit && state.timer !== null) {
    text += ` — ${Math.max(0, Math.ceil(state.timer))}s`;
  }
  return text;
}

export function markerFor(state) {
  const step = currentStep(state);
  if (!step || step.type !== 'reach') return null;
  return step.point;
}
