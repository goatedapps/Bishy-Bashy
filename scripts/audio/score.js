export const SAMPLE_RATE = 32_000;
export const BPM = 128;
export const BEAT = 60 / BPM;
export const LOOP_SECONDS = BEAT * 32;
export const ROOTS = [50, 47, 43, 45, 50, 47, 43, 45];
export const CHORDS = [
  [62, 66, 69, 73], [59, 62, 66, 69], [59, 62, 66, 67], [61, 64, 67, 69],
  [62, 66, 69, 73], [59, 62, 66, 69], [59, 62, 66, 67], [61, 64, 67, 69],
];
export const MELODY = [
  [74, null, 78, null, 81, null, 78, 76, 74, null, 78, null, 81, null, 83, 81],
  [78, null, null, 76, 74, null, 71, null, 74, null, 78, null, 76, null, null, null],
  [79, null, 78, null, 76, null, 74, null, 71, null, 74, null, 78, null, 79, 78],
  [76, null, 73, null, 69, null, 73, null, 76, null, 78, 76, 73, null, null, null],
  [74, null, 78, 81, null, 78, 76, null, 74, null, 78, null, 81, 83, 85, 81],
  [83, null, 81, null, 78, null, 74, 78, 81, null, 78, null, 76, null, 74, null],
  [79, null, 83, null, 86, null, 83, 81, 79, null, 78, null, 76, 78, 79, 81],
  [81, null, 79, 78, 76, null, 73, null, 76, null, 81, null, 73, 76, 81, null],
];

export const AUDIO_FILES = {
  red: 'hit-red.wav', green: 'hit-green.wav', blue: 'hit-blue.wav',
  mistake: 'mistake.wav', tick: 'countdown.wav', go: 'go.wav',
  finish: 'finish.wav', timeout: 'timeout.wav',
  music: 'totem-party.wav', urgency: 'totem-party-urgency.wav',
  permMusic: 'perm-groove.wav', permUrgency: 'perm-groove-urgency.wav',
  permDemo: 'perm-demo.wav', permHit: 'perm-hit.wav', permMiss: 'perm-miss.wav', permGrow: 'perm-grow.wav', permGo: 'perm-go.wav',
  slotMusic: 'slot-carousel.wav', slotUrgency: 'slot-carousel-urgency.wav',
  slotLock: 'slot-lock.wav', slotMiss: 'slot-miss.wav', slotWin: 'slot-win.wav', slotGo: 'slot-go.wav',
};

export function audioAssetIds(game = 'totem-shrinker') {
  const shared = ['finish', 'timeout'];
  if (game === 'facing-which-way') return [...shared, 'red', 'green', 'blue', 'mistake', 'go', 'music', 'urgency', 'slotLock'];
  if (game === 'jump-for-the-meat') return [...shared, 'red', 'green', 'blue', 'mistake', 'go', 'music', 'urgency', 'permGrow'];
  if (game === 'facial-slot-machine') return [...shared, 'slotMusic', 'slotUrgency', 'slotLock', 'slotMiss', 'slotWin', 'slotGo'];
  return [...shared, ...(game === 'perm-mania' ? ['permMusic', 'permUrgency', 'permDemo', 'permHit', 'permMiss', 'permGrow', 'permGo'] : ['red', 'green', 'blue', 'mistake', 'go', 'music', 'urgency'])];
}
