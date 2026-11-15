// Pictures live in public/mascot/
export const SPRITE_FILES = {
  idle: '/mascot/idle.png',
  studying: '/mascot/studying.png',
  sleeping: '/mascot/sleeping.png',
  happy: '/mascot/happy.png',
  curious: '/mascot/curious.png',
  peeking: '/mascot/peeking.png',
  cup: '/mascot/cup.png',
};

// Relative height of each picture (idle = 1).
// If a pose looks too big or too small on screen, change its number here.
export const SPRITE_SCALE = {
  idle: 1, studying: 0.62, sleeping: 0.55, happy: 0.62,
  curious: 0.62, peeking: 0.5, cup: 0.62,
};

export const BASE_HEIGHT = { desktop: 190, mobile: 130 }; // pixels

// state name -> [picture, CSS motion]
export const STATES = {
  idle: ['idle', 'm-breathe'],
  walking: ['idle', 'm-walk'],
  running: ['idle', 'm-run'],
  jumping: ['idle', 'm-jump'],
  sitting: ['studying', 'm-breathe'],
  studying: ['studying', 'm-study'],
  sleeping: ['sleeping', 'm-sleep'],
  peeking: ['peeking', 'm-peek'],
  celebrating: ['happy', 'm-celebrate'],
  // expressions
  happy: ['happy', 'm-breathe'],
  excited: ['happy', 'm-jump'],
  curious: ['curious', 'm-tilt'],
  confused: ['curious', 'm-wobble'],
  thinking: ['curious', 'm-breathe'],
  sad: ['idle', 'm-sad'],
  sleepy: ['sleeping', 'm-breathe'],
  surprised: ['happy', 'm-pop'],
  proud: ['cup', 'm-breathe'],
  encouraging: ['cup', 'm-bounce'],
};

// Events other parts of the app can trigger: react('homeworkDone')
export const REACTIONS = {
  greet: { state: 'excited', msg: 'mascot.greetName' },
  homeworkDone: { state: 'celebrating', msg: 'mascot.homeworkDone' },
  correct: { state: 'celebrating', msg: 'mascot.m3' },
  wrong: { state: 'encouraging', msg: 'mascot.m4' },
  lessonDone: { state: 'celebrating', msg: 'mascot.m3' },
  newMaterials: { state: 'excited', msg: 'mascot.m5' },
};

export const CLICK_MESSAGES = [
  'mascot.m1', 'mascot.m2', 'mascot.m3', 'mascot.m4',
  'mascot.m5', 'mascot.m6', 'mascot.m7', 'mascot.m8',
];