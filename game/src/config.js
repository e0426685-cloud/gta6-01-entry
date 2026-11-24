// Palm Shores Heat — tuning constants and the sun-soaked palette.
// Everything numeric that another module needs lives here so the game can be
// rebalanced from one place.

export const VIEW_W = 1280;
export const VIEW_H = 800;

// City layout: a square grid of avenues. Roads are centred on multiples of
// PITCH, blocks sit between them.
export const ROAD_W = 76;
export const PITCH = 264;
export const ROAD_COUNT = 8; // avenues each way
export const WORLD_W = PITCH * (ROAD_COUNT - 1) + ROAD_W + 240;
export const WORLD_H = WORLD_W;

export const PLAYER = {
  radius: 11,
  walkSpeed: 168,
  runSpeed: 238,
  maxHealth: 100,
};

export const CAR = {
  radius: 17,
  length: 40,
  width: 20,
  accel: 320,
  brake: 460,
  maxSpeed: 340,
  maxReverse: 110,
  turnRate: 2.35,
  grip: 7.5,
};

export const WANTED = {
  maxStars: 5,
  pointsPerStar: 10,
  decayPerSecond: 0.55,
  sightRange: 360,
};

export const PALETTE = {
  sky: '#8fd8ef',
  grass: '#7ec850',
  sidewalk: '#e8dcc0',
  sidewalkEdge: '#cbb98f',
  road: '#4a4a52',
  roadLine: '#f5d76e',
  roadCross: '#e8e8e8',
  sand: '#f7e3ac',
  water: '#3fb6d9',
  palmTrunk: '#8a6b42',
  palmLeaf: '#2f9e4f',
  player: '#ff5964',
  playerSkin: '#f2c094',
  policeBody: '#274690',
  policeRoof: '#f4f6f8',
  taxiBody: '#ffc53d',
  shadow: 'rgba(40,30,10,0.25)',
  hudPanel: 'rgba(16,20,28,0.72)',
  hudText: '#ffffff',
  accent: '#ffb703',
  danger: '#ef476f',
  good: '#06d6a0',
};

export const BUILDING_COLORS = [
  '#f4a261', '#e76f51', '#ffd6a5', '#fdffb6', '#caffbf',
  '#9bf6ff', '#a0c4ff', '#ffc6ff', '#f1fa8c', '#e5989b',
  '#b5838d', '#ffb4a2', '#84a98c', '#f2cc8f', '#81b29a',
];

export const CAR_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#9d4edd', '#ffffff', '#22223b', '#06d6a0', '#ff8fa3',
];

export const PED_COLORS = [
  '#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#ffffff',
  '#f78c6b', '#c77dff', '#90be6d', '#f9c74f', '#43aa8b',
];

export const STORY_BLURB =
  'Palm Shores, 1986. You are Rico Vale, a wheelman down on his luck. ' +
  'An old friend, Marisol, runs a garage on the south side and has work for ' +
  'anyone who can drive fast and keep quiet. Run her jobs, dodge the PSPD, ' +
  'and build your name — one hot car at a time.';
