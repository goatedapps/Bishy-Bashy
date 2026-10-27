import { SAMPLE_RATE, BEAT, LOOP_SECONDS, ROOTS, CHORDS, MELODY } from './score.js';

const TAU = Math.PI * 2;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const attack = (time, length = .003) => Math.min(1, time / length);
const release = (time, duration, length = .025) => Math.min(1, Math.max(0, (duration - time) / length));

function random(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0xffffffff * 2 - 1; };
}

export function tone(note, duration, kind = 'lead') {
  const output = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
  const frequency = hz(note);
  for (let index = 0; index < output.length; index++) {
    const time = index / SAMPLE_RATE;
    const phase = TAU * frequency * time;
    let sample;
    if (kind === 'bass') sample = Math.sin(phase) + .48 * Math.exp(-time * 12) * Math.sin(2 * phase) + .23 * Math.exp(-time * 19) * Math.sin(3 * phase);
    else if (kind === 'chord') sample = Math.sin(phase + 1.6 * Math.exp(-time * 17) * Math.sin(phase * 2)) + .12 * Math.sin(phase * 3);
    else if (kind === 'wood') sample = Math.sin(phase + 2.5 * Math.exp(-time * 65) * Math.sin(phase * 2.76)) + .22 * Math.sin(phase * 3.98) * Math.exp(-time * 40);
    else sample = Math.sin(phase + .5 * Math.sin(TAU * 5.5 * time)) + .2 * Math.sin(2 * phase) + .12 * Math.sin(3 * phase);
    const decay = kind === 'bass' ? 9 : kind === 'wood' ? 26 : kind === 'chord' ? 12 : 8;
    output[index] = sample * attack(time) * Math.exp(-time * decay) * release(time, duration);
  }
  return output;
}

export function drum(kind, seed) {
  const duration = { kick: .2, snare: .16, hat: .055, clap: .13, tom: .16 }[kind];
  const output = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
  const noise = random(seed);
  let phase = 0, previous = 0, low = 0;
  for (let index = 0; index < output.length; index++) {
    const time = index / SAMPLE_RATE;
    const white = noise();
    const high = white - previous;
    previous = white;
    low += .4 * (white - low);
    let sample;
    if (kind === 'kick') {
      phase += TAU * (56 + 115 * Math.exp(-time * 55)) / SAMPLE_RATE;
      sample = Math.sin(phase) * Math.exp(-time * 23) + .08 * high * Math.exp(-time * 350);
    } else if (kind === 'snare') sample = .46 * (white - low) * Math.exp(-time * 27) + .35 * Math.sin(TAU * 185 * time) * Math.exp(-time * 40);
    else if (kind === 'hat') sample = .34 * high * Math.exp(-time * 95);
    else if (kind === 'clap') {
      const burst = [0, .014, .028].reduce((sum, start) => sum + (time >= start ? Math.exp(-(time - start) * 80) : 0), 0);
      sample = .23 * (white - low) * burst;
    } else {
      phase += TAU * (115 + 90 * Math.exp(-time * 18)) / SAMPLE_RATE;
      sample = Math.sin(phase) * Math.exp(-time * 24);
    }
    output[index] = sample * attack(time, .001) * release(time, duration, .01);
  }
  return output;
}

export function mix(target, source, seconds, gain = 1, loop = false) {
  const offset = Math.round(seconds * SAMPLE_RATE);
  source.forEach((sample, index) => {
    const destination = loop ? (offset + index) % target.length : offset + index;
    if (destination >= 0 && destination < target.length) target[destination] += sample * gain;
  });
}

export function normalize(samples, peak) {
  const measured = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
  const scale = measured ? peak / measured : 1;
  return samples.map(sample => sample * scale);
}

export function music({ perm = false } = {}) {
  const base = new Float32Array(Math.round(LOOP_SECONDS * SAMPLE_RATE));
  const urgency = new Float32Array(base.length);
  const stepSeconds = BEAT / 4;
  for (let bar = 0; bar < 8; bar++) {
    const root = ROOTS[bar];
    const backing = perm && bar % 2 === 0 ? .65 : 1;
    for (const step of perm ? [0, 3, 6, 7, 8, 10, 14] : [0, 2, 3, 6, 8, 10, 11, 14, 15]) {
      const note = root + ([2, 6, 10, 14].includes(step) ? 12 : step === 15 ? 7 : 0);
      mix(base, tone(note, step === 3 || step === 11 ? .12 : .2, 'bass'), (bar * 16 + step) * stepSeconds, (step % 4 === 0 ? .31 : .24) * backing, true);
    }
    for (const step of [2, 6, 10, 14]) for (const note of CHORDS[bar]) mix(base, tone(note, .21, 'chord'), (bar * 16 + step) * stepSeconds, .055, true);
    MELODY[perm ? (bar + 4) % 8 : bar].forEach((note, step) => {
      if (note === null) return;
      const time = (bar * 16 + step) * stepSeconds;
      if (!perm || bar % 2 === 1) mix(base, tone(note, .18), time, (step % 4 === 0 ? .19 : .145) * (perm ? .7 : 1), true);
      mix(urgency, tone(note + 12, .13, 'wood'), time, .1, true);
    });
    for (let step = 0; step < 16; step++) {
      const time = (bar * 16 + step) * stepSeconds;
      if (step % 4 === 0) mix(base, drum('kick', 100 + bar + step), time, .48, true);
      if (step === 4 || step === 12) {
        mix(base, drum('snare', 200 + bar + step), time, .42, true);
        mix(base, drum('clap', 300 + bar + step), time + .009, .3, true);
      }
      if (step % 2 === 0) mix(base, drum('hat', 400 + bar * 16 + step), time, step % 4 === 2 ? .32 : .2, true);
      else mix(urgency, drum('hat', 800 + bar * 16 + step), time, .27, true);
      if (bar % 2 === 1 && step >= 12) mix(urgency, drum('tom', 900 + step), time, .12, true);
    }
  }
  return { music: normalize(base.map(sample => Math.tanh(sample * 1.8)), .68), urgency: normalize(urgency, .3) };
}

export function effects() {
  const result = {};
  for (const [name, note] of [['red', 74], ['green', 78], ['blue', 81]]) {
    const samples = tone(note, .14, 'wood');
    mix(samples, drum('hat', note), 0, .06);
    result[name] = normalize(samples, .7);
  }
  const mistake = new Float32Array(SAMPLE_RATE * .32);
  let phase = 0;
  for (let index = 0; index < mistake.length; index++) {
    const time = index / SAMPLE_RATE;
    phase += TAU * (105 + 470 * Math.exp(-time * 14) + 28 * Math.sin(TAU * 17 * time) * Math.exp(-time * 9)) / SAMPLE_RATE;
    mistake[index] = Math.sin(phase + .55 * Math.sin(phase * 2)) * attack(time) * Math.exp(-time * 11) * release(time, .32);
  }
  result.mistake = normalize(mistake, .65);
  result.tick = normalize(tone(74, .12, 'wood'), .48);
  const go = new Float32Array(Math.round(SAMPLE_RATE * .45));
  for (const [index, note] of [62, 69, 74, 78].entries()) mix(go, tone(note, .35, 'chord'), index * .018, .27);
  mix(go, drum('kick', 9), 0, .2);
  result.go = normalize(go, .7);
  const finish = new Float32Array(Math.round(SAMPLE_RATE * 1.12));
  for (const [index, note] of [74, 78, 81, 86].entries()) mix(finish, tone(note, .36), index * .09, .3);
  for (const note of [62, 66, 69, 74]) mix(finish, tone(note, .55, 'chord'), .4, .16);
  result.finish = normalize(finish, .7);
  const timeout = new Float32Array(SAMPLE_RATE);
  for (const [index, note] of [69, 66, 62].entries()) mix(timeout, tone(note, .42, 'chord'), index * .16, .25);
  result.timeout = normalize(timeout, .55);
  const demo = tone(81, .14, 'wood');
  mix(demo, drum('clap', 120), 0, .28);
  result.permDemo = normalize(demo, .7);
  const hit = tone(78, .12, 'wood');
  mix(hit, drum('clap', 121), 0, .4);
  result.permHit = normalize(hit, .62);
  result.permMiss = normalize(tone(50, .15, 'bass'), .35);
  const grow = new Float32Array(SAMPLE_RATE * .4);
  [78, 81, 86].forEach((note, index) => mix(grow, tone(note, .2, 'wood'), index * .055, .3));
  result.permGrow = normalize(grow, .6);
  result.permGo = normalize(tone(86, .12, 'chord'), .48);
  return result;
}

export function inspect(samples, loop = false) {
  let squares = 0, peak = 0, dc = 0;
  for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); squares += sample * sample; dc += sample; }
  return { seconds: samples.length / SAMPLE_RATE, peak, rms: Math.sqrt(squares / samples.length), dc: dc / samples.length, ...(loop ? { seamDelta: Math.abs(samples[0] - samples.at(-1)) } : {}) };
}

export function wav(samples) {
  const output = Buffer.alloc(44 + samples.length * 2);
  output.write('RIFF'); output.writeUInt32LE(output.length - 8, 4); output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(1, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24); output.writeUInt32LE(SAMPLE_RATE * 2, 28);
  output.writeUInt16LE(2, 32); output.writeUInt16LE(16, 34); output.write('data', 36); output.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
  return output;
}
