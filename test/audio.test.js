import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameAudio } from '../src/audio.js';
import { AUDIO_FILES, BEAT, LOOP_SECONDS } from '../scripts/audio/score.js';

class Parameter {
  constructor() { this.value = 1; this.events = []; }
  record(method, value, time, constant) { this.value = value; this.events.push({ method, value, time, constant }); return this; }
  setValueAtTime(value, time) { return this.record('set', value, time); }
  linearRampToValueAtTime(value, time) { return this.record('ramp', value, time); }
  setTargetAtTime(value, time, constant) { return this.record('target', value, time, constant); }
  cancelScheduledValues(time) { this.events = this.events.filter(event => event.time < time); return this; }
}
class AudioNode {
  constructor() { this.gain = new Parameter(); }
  connect(node) { return node; }
  disconnect() { this.disconnected = true; }
}
class Context {
  constructor() { this.currentTime = 100; this.state = 'running'; this.destination = {}; this.sources = []; }
  createGain() { return new AudioNode(); }
  createDynamicsCompressor() {
    const node = new AudioNode();
    for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = new Parameter();
    return node;
  }
  addEventListener(event, callback) { this.stateChange = callback; }
  async resume() { this.state = 'running'; this.stateChange?.(); }
  async decodeAudioData(data) {
    const view = new DataView(data);
    return { duration: view.getUint32(40, true) / view.getUint32(24, true) / 2 };
  }
  createBufferSource() {
    const source = new AudioNode();
    source.playbackRate = new Parameter();
    source.start = (at, offset) => { assert.equal(source.started, undefined); source.started = { at, offset }; };
    source.stop = at => { assert.ok(source.started, 'start() must be called before stop()'); source.stoppedAt = at; };
    this.sources.push(source);
    return source;
  }
}

function setup({ enabled = true, fetchFile, storage } = {}) {
  let time = 0, created = 0;
  const context = new Context();
  const values = new Map([['bb-sound', enabled ? 'on' : 'off']]);
  const requests = [];
  const audio = new GameAudio({
    storage: storage || { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    now: () => time,
    createContext: () => { created++; return context; },
    fetchFile: fetchFile || (async url => {
      requests.push(url);
      const bytes = await readFile(new URL(`../public/audio/${url.split('/').at(-1).split('?')[0]}`, import.meta.url));
      return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    }),
  });
  return { audio, context, values, requests, setTime: value => { time = value; }, get created() { return created; } };
}

test('audio is opt-in, loads once after a gesture, and preferences survive unavailable storage', async () => {
  const state = setup({ enabled: false });
  state.audio.scheduleRound('round', 5000, 50_000, true);
  assert.equal(await state.audio.unlock(), false);
  assert.equal(state.created, 0);
  state.audio.setEnabled(true);
  assert.equal(await state.audio.unlock(), true);
  await state.audio.unlock();
  assert.equal(state.created, 1);
  assert.equal(state.requests.length, Object.keys(AUDIO_FILES).length);
  state.audio.setPreferences({ musicVolume: 2, effectsVolume: -1, musicMode: 'off' });
  assert.deepEqual(JSON.parse(state.values.get('bb-audio')), { musicMode: 'off', musicVolume: 1, effectsVolume: 0 });
  const blocked = setup({ storage: { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } } });
  assert.doesNotThrow(() => blocked.audio.setEnabled(false));
});

test('countdown and music share the scheduled start without duplicating on redraw', async () => {
  const { audio, context } = setup();
  await audio.unlock();
  audio.scheduleRound('round', 5000, 50_000, true);
  const round = [...audio.voices].filter(voice => voice.group === 'round');
  assert.deepEqual(round.map(voice => voice.source.started.at), [102, 103, 104, 105]);
  const music = [...audio.voices].filter(voice => voice.group === 'music');
  assert.equal(music[0].source.started.at, 105);
  assert.equal(music[0].source.started.offset, 0);
  assert.equal(music[0].source.stoppedAt, 150.01);
  assert.equal(music[1].source.started.at, 105 + Math.ceil(35 / BEAT) * BEAT);
  const voices = context.sources.length;
  for (let index = 0; index < 10; index++) audio.scheduleRound('round', 5000, 50_000, true);
  assert.equal(context.sources.length, voices);
});

test('one-device music policy can be overridden without losing the round position', async () => {
  const { audio, setTime, context } = setup();
  await audio.unlock();
  setTime(12_000);
  audio.scheduleRound('round', 0, 45_000, false);
  assert.equal([...audio.voices].filter(voice => voice.group === 'music').length, 0);
  assert.equal([...audio.voices].filter(voice => voice.group === 'round').length, 0);
  audio.setPreferences({ musicMode: 'on' });
  let music = [...audio.voices].filter(voice => voice.group === 'music');
  assert.equal(music.length, 2);
  assert.equal(music[0].source.started.offset, 12 % LOOP_SECONDS);
  audio.setEnabled(false);
  assert.equal(audio.voices.size, 0);
  setTime(20_000); context.currentTime = 108;
  audio.setEnabled(true); await audio.unlock();
  music = [...audio.voices].filter(voice => voice.group === 'music');
  assert.equal(music[0].source.started.offset, 20 % LOOP_SECONDS);
  audio.setPreferences({ musicMode: 'off' });
  assert.equal([...audio.voices].filter(voice => voice.group === 'music').length, 0);
});

test('finishing and immediate results preserve the celebration tail', async () => {
  const { audio } = setup();
  await audio.unlock();
  audio.scheduleRound('round', 0, 45_000, true);
  audio.endPlayer();
  assert.equal(audio.target.playerDone, true);
  assert.equal([...audio.voices].filter(voice => voice.group === 'music').length, 2);
  audio.play('finish');
  const finish = [...audio.voices].find(voice => voice.id === 'finish');
  audio.stopRound();
  assert.equal(finish.stopped, false);
  assert.equal(audio.voices.size, 1);
  audio.cancel();
  assert.equal(finish.stopped, true);
});

test('rapid inputs are bounded and hiding or context interruption cancels scheduled audio', async () => {
  const { audio, context, setTime } = setup();
  await audio.unlock();
  audio.scheduleRound('round', 5000, 50_000, true);
  for (let index = 0; index < 100; index++) audio.play('hit', { color: index % 3 });
  assert.equal([...audio.voices].filter(voice => voice.group === 'effects').length, 8);
  context.state = 'suspended'; context.stateChange();
  assert.equal(audio.voices.size, 0);
  setTime(20_000); context.currentTime = 101;
  await context.resume();
  const music = [...audio.voices].find(voice => voice.id === 'music');
  assert.equal(music.source.started.offset, 15 % LOOP_SECONDS);
  assert.equal([...audio.voices].filter(voice => voice.group === 'round').length, 0);
  audio.cancel();
  assert.equal(audio.target, null);
  assert.equal(audio.voices.size, 0);
});

test('preview obeys mute, cancellation, and round-start races', async () => {
  const { audio } = setup({ enabled: false });
  await audio.preview();
  assert.equal(audio.previewing, true);
  audio.setEnabled(false);
  assert.equal(audio.previewing, false);
  assert.equal(audio.voices.size, 0);
  audio.setEnabled(true);
  const pending = audio.preview();
  audio.scheduleRound('round', 5000, 50_000, true);
  await pending;
  assert.equal(audio.previewing, false);
  assert.equal([...audio.voices].filter(voice => voice.group.startsWith('preview-')).length, 0);
});

test('failed audio downloads are retried and never prevent game scheduling', async () => {
  const { audio } = setup({ fetchFile: async () => ({ ok: false }) });
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.status, 'unavailable');
  assert.doesNotThrow(() => audio.scheduleRound('round', 5000, 50_000, true));
  audio.fetchFile = setup().audio.fetchFile;
  assert.equal(await audio.unlock(), true);
  assert.equal(audio.status, 'ready');
  assert.equal([...audio.voices].filter(voice => voice.group === 'music').length, 2);
});

test('music-off preview plays only effects and ends when its last cue ends', async () => {
  const { audio } = setup();
  audio.setPreferences({ musicMode: 'off' });
  await audio.preview();
  assert.equal(audio.previewing, true);
  assert.equal([...audio.voices].filter(voice => voice.group === 'preview-music').length, 0);
  for (const voice of [...audio.voices]) voice.source.onended();
  assert.equal(audio.previewing, false);
  assert.equal(audio.voices.size, 0);
});

test('authored PCM assets have headroom, quiet endpoints, and continuous equal-length loops', async () => {
  let bytesTotal = 0;
  for (const [id, file] of Object.entries(AUDIO_FILES)) {
    const bytes = await readFile(new URL(`../public/audio/${file}`, import.meta.url));
    bytesTotal += bytes.length;
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.readUInt16LE(22), 1);
    const length = bytes.readUInt32LE(40) / 2;
    let peak = 0, dc = 0;
    for (let index = 0; index < length; index++) { const sample = bytes.readInt16LE(44 + index * 2) / 32767; peak = Math.max(peak, Math.abs(sample)); dc += sample; }
    assert.ok(peak > .25 && peak < .71, `${id}: peak ${peak}`);
    assert.ok(Math.abs(dc / length) < .002, `${id}: excessive DC`);
    if (['music', 'urgency'].includes(id)) {
      assert.equal(length / bytes.readUInt32LE(24), LOOP_SECONDS);
      assert.ok(Math.abs(bytes.readInt16LE(44) - bytes.readInt16LE(bytes.length - 2)) / 32767 < .005, `${id}: loop seam`);
    } else {
      assert.ok(Math.abs(bytes.readInt16LE(44)) / 32767 < .001);
      assert.ok(Math.abs(bytes.readInt16LE(bytes.length - 2)) / 32767 < .001);
    }
  }
  assert.ok(bytesTotal < 2_500_000, `Audio download budget exceeded: ${bytesTotal}`);
});
