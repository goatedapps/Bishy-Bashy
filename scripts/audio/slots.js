import { SAMPLE_RATE, BEAT, LOOP_SECONDS } from './score.js';
import { tone, drum, mix, normalize } from './synthesis.js';

export function slotAudio() {
  const music = new Float32Array(Math.round(LOOP_SECONDS * SAMPLE_RATE));
  const urgency = new Float32Array(music.length);
  const roots = [48, 45, 53, 43, 48, 45, 53, 43];
  const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [60, 65, 69, 72], [59, 62, 67, 69]];
  const melody = [[76, 79, 84, 79, 81, 79, 76, 74], [72, 76, 79, 76, 81, 79, 76, 72], [77, 81, 84, 81, 86, 84, 81, 77], [79, 83, 86, 83, 81, 79, 74, 71]];
  for (let bar = 0; bar < 8; bar++) {
    for (let step = 0; step < 16; step++) {
      const at = (bar * 4 + step / 4) * BEAT;
      if ([0, 3, 6, 8, 11, 14].includes(step)) mix(music, tone(roots[bar] + (step === 6 || step === 14 ? 12 : 0), .18, 'bass'), at, .3, true);
      if ([2, 6, 10, 14].includes(step)) for (const note of chords[bar % 4]) mix(music, tone(note, .17, 'chord'), at, .055, true);
      if (step % 2 === 0) {
        mix(music, tone(melody[bar % 4][step / 2], .19, 'wood'), at, bar % 2 ? .2 : .16, true);
        mix(music, drum('hat', 1800 + bar * 16 + step), at, .23, true);
      }
      if (step % 4 === 0) mix(music, drum('kick', 1900 + step), at, .42, true);
      if (step === 4 || step === 12) mix(music, drum('clap', 2000 + bar), at, .5, true);
      if (step % 2) mix(urgency, drum('hat', 2100 + bar * 16 + step), at, .26, true);
      if ([3, 7, 11, 15].includes(step)) mix(urgency, tone(melody[bar % 4][Math.floor(step / 2)] + 12, .12, 'wood'), at, .15, true);
    }
  }
  const lock = new Float32Array(Math.round(.26 * SAMPLE_RATE));
  mix(lock, tone(84, .18, 'wood'), 0, .45); mix(lock, tone(88, .17, 'chord'), .035, .3);
  const miss = new Float32Array(Math.round(.3 * SAMPLE_RATE));
  mix(miss, tone(57, .17, 'bass'), 0, .4); mix(miss, tone(53, .19, 'chord'), .08, .24);
  const win = new Float32Array(Math.round(1.2 * SAMPLE_RATE));
  [72, 76, 79, 84, 88, 91].forEach((note, index) => mix(win, tone(note, .3, 'wood'), index * .06, .32));
  for (const note of [60, 64, 67, 72, 76]) mix(win, tone(note, .6, 'chord'), .45, .15);
  const go = new Float32Array(Math.round(.4 * SAMPLE_RATE));
  [72, 79, 84].forEach((note, index) => mix(go, tone(note, .24, 'wood'), index * .06, .33));
  return { slotMusic: normalize(music.map(sample => Math.tanh(sample * 1.6)), .65), slotUrgency: normalize(urgency, .27), slotLock: normalize(lock, .64), slotMiss: normalize(miss, .48), slotWin: normalize(win, .68), slotGo: normalize(go, .6) };
}
