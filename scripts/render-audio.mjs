import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AUDIO_FILES, SAMPLE_RATE, LOOP_SECONDS, BPM } from './audio/score.js';
import { music, effects, mix, inspect, wav } from './audio/synthesis.js';
import { slotAudio } from './audio/slots.js';

const output = new URL('../public/audio/', import.meta.url);
await mkdir(output, { recursive: true });
const perm = music({ perm: true });
const assets = { ...music(), ...effects(), permMusic: perm.music, permUrgency: perm.urgency, ...slotAudio() };
const report = { bpm: BPM, sampleRate: SAMPLE_RATE, loopSeconds: LOOP_SECONDS, files: {} };
for (const [id, samples] of Object.entries(assets)) {
  const file = AUDIO_FILES[id];
  await writeFile(new URL(file, output), wav(samples));
  report.files[id] = { file, ...inspect(samples, ['music', 'urgency', 'permMusic', 'permUrgency', 'slotMusic', 'slotUrgency'].includes(id)) };
}
await writeFile(new URL('analysis.json', output), JSON.stringify(report, null, 2) + '\n');

if (process.argv.includes('--preview')) {
  const preview = new Float32Array(Math.round(SAMPLE_RATE * (LOOP_SECONDS * 2 + 4.5)));
  for (let index = 0; index < 3; index++) mix(preview, assets.tick, index, .42);
  mix(preview, assets.go, 3, .48);
  for (let repeat = 0; repeat < 2; repeat++) mix(preview, assets.music, 3 + LOOP_SECONDS * repeat, .26);
  mix(preview, assets.urgency, 3 + LOOP_SECONDS, .26);
  for (let index = 0; index < 18; index++) mix(preview, assets[['red', 'green', 'blue'][index % 3]], 4 + index * .48, .384);
  mix(preview, assets.mistake, 10.2, .384);
  mix(preview, assets.finish, 3 + LOOP_SECONDS * 2, .384);
  const destination = process.argv[process.argv.indexOf('--preview') + 1];
  if (!destination) throw new Error('Provide an absolute WAV path after --preview.');
  await writeFile(destination, wav(preview));
  console.log('Preview:', destination, inspect(preview));
}
console.log('Rendered original audio:', fileURLToPath(output));
console.log(JSON.stringify(report, null, 2));
