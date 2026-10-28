import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameAudio } from '../src/audio.js';
import { AUDIO_FILES, BEAT, LOOP_SECONDS, audioAssetIds } from '../scripts/audio/score.js';
import { demoCues } from '../shared/perm.js';

test('Jump loads an existing flourish for perfect landings without requiring the full Perm bank', async () => {
  const { audio, requests } = setup();
  audio.selectGame('jump-for-the-meat');
  await audio.unlock();
  assert.ok(requests.some(url => url.includes('perm-grow.wav')));
  assert.ok(!requests.some(url => url.includes('perm-groove.wav')));
  audio.play('jumpPerfect', { game: 'jump-for-the-meat' });
  assert.equal([...audio.voices].at(-1).id, 'permGrow');
});

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
  createMediaElementSource(media) { this.media = media; return new AudioNode(); }
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

function setup({ enabled = true, fetchFile, storage, createMedia } = {}) {
  let time = 0, created = 0;
  const context = new Context();
  const values = new Map([['bb-sound', enabled ? 'on' : 'off']]);
  const requests = [];
  const audio = new GameAudio({
    storage: storage || { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    now: () => time,
    createContext: () => { created++; return context; },
    ...(createMedia ? { createMedia } : {}),
    fetchFile: fetchFile || (async url => {
      requests.push(url);
      const bytes = await readFile(new URL(`../public/audio/${url.split('/').at(-1).split('?')[0]}`, import.meta.url));
      return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    }),
  });
  return { audio, context, values, requests, setTime: value => { time = value; }, get created() { return created; } };
}

class MenuMedia {
  constructor() { this.plays = 0; this.pauses = 0; this.currentTime = 0; }
  addEventListener() {}
  async play() { this.plays++; }
  pause() { this.pauses++; }
}

test('menu track streams after unlock, survives menu changes, and yields to rounds without restarting its position', async () => {
  const media = new MenuMedia();
  const { audio, requests, context } = setup({ createMedia: () => media });
  audio.setMenuScreen(true);
  assert.equal(media.plays, 0);
  await audio.unlock();
  assert.equal(media.plays, 1);
  assert.equal(media.src, '/audio/Background-ActionRock.mp3');
  assert.equal(media.loop, true);
  assert.equal(context.media, media);
  assert.ok(!requests.some(url => url.endsWith('.mp3')));
  media.currentTime = 32;
  audio.selectGame('facial-slot-machine');
  audio.setMenuScreen(true);
  audio.synchronize();
  assert.equal(media.plays, 1);
  audio.scheduleRound('slots', 5000, 50000, true, false, { game: 'facial-slot-machine' });
  assert.equal(audio.menuPlaying, false);
  assert.equal(media.pauses, 1);
  audio.stopRound();
  audio.setMenuScreen(true);
  assert.equal(media.plays, 2);
  assert.equal(media.currentTime, 32);
});

test('menu music honors room ownership, personal overrides, mute, volume, interruption, and previews', async () => {
  const media = new MenuMedia();
  const { audio, context } = setup({ createMedia: () => media });
  audio.setMenuScreen(true, false);
  await audio.unlock();
  assert.equal(media.plays, 0);
  audio.setPreferences({ musicMode: 'on' });
  assert.equal(media.plays, 1);
  audio.setPreferences({ musicVolume: 0 });
  assert.equal(audio.menuPlaying, false);
  audio.setPreferences({ musicVolume: .5 });
  assert.equal(audio.menuPlaying, true);
  assert.equal(audio.musicBus.gain.value, .25);
  audio.setEnabled(false);
  assert.equal(audio.menuPlaying, false);
  audio.setEnabled(true);
  await audio.unlock();
  assert.equal(audio.menuPlaying, true);
  context.state = 'suspended'; context.stateChange();
  assert.equal(audio.menuPlaying, false);
  await context.resume();
  assert.equal(audio.menuPlaying, true);
  await audio.preview();
  assert.equal(audio.menuPlaying, false);
  for (const voice of [...audio.voices]) if (voice.group.startsWith('preview-')) voice.source.onended();
  assert.equal(audio.menuPlaying, true);
  audio.cancel();
  assert.equal(audio.menuPlaying, false);
  audio.setMenuScreen(true, true);
  assert.equal(audio.menuPlaying, true);
  audio.setPreferences({ musicMode: 'off' });
  assert.equal(audio.menuPlaying, false);
});

test('denied menu playback can retry on the next gesture and stale rejections cannot stop newer playback', async () => {
  const media = new MenuMedia();
  let rejectPlay;
  media.play = () => new Promise((resolve, reject) => { rejectPlay = reject; });
  const { audio } = setup({ createMedia: () => media });
  audio.setMenuScreen(true);
  await audio.unlock();
  const rejectOld = rejectPlay;
  audio.setMenuScreen(false);
  audio.setMenuScreen(true);
  rejectOld(new Error('Interrupted'));
  await Promise.resolve();
  assert.equal(audio.menuPlaying, true);
  rejectPlay(new Error('Autoplay denied'));
  await Promise.resolve();
  assert.equal(audio.menuPlaying, false);
  media.play = async () => {};
  await audio.unlock();
  assert.equal(audio.menuPlaying, true);
});

test('memory demos schedule color tones once from local time and skip old notes after mute or interruption', async () => {
  const { audio, context, setTime } = setup();
  audio.selectGame('mimicking-monkeys');
  await audio.unlock();
  audio.scheduleRound('memory', 1000, 46000, true, false, { game: 'mimicking-monkeys' });
  const cues = [{ color: 2, at: 1550 }, { color: 0, at: 2200 }];
  setTime(1400);
  audio.demonstrate('memory/1', cues);
  let notes = [...audio.voices].filter(voice => voice.group === 'demonstration');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].id, 'blue');
  assert.equal(notes[0].source.started.at, context.currentTime + .15);
  audio.demonstrate('memory/1', cues);
  assert.equal([...audio.voices].filter(voice => voice.group === 'demonstration').length, 1);
  audio.setEnabled(false);
  assert.ok(notes[0].stopped);
  setTime(1600);
  audio.setEnabled(true);
  await audio.unlock();
  audio.demonstrate('memory/1', cues);
  assert.equal([...audio.voices].filter(voice => voice.group === 'demonstration').length, 0);
  setTime(2050);
  audio.demonstrate('memory/1', cues);
  notes = [...audio.voices].filter(voice => voice.group === 'demonstration');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].id, 'red');
  context.state = 'suspended'; context.stateChange();
  assert.ok(notes[0].stopped);
  setTime(2150); await context.resume();
  audio.demonstrate('memory/1', cues);
  assert.equal([...audio.voices].filter(voice => voice.group === 'demonstration').length, 1);
  audio.demonstrate('memory/2', [{ color: 1, at: 2250 }]);
  notes = [...audio.voices].filter(voice => voice.group === 'demonstration');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].id, 'green');
  audio.endPlayer();
  assert.ok(notes[0].stopped);
  audio.demonstrate('memory/2', [{ color: 1, at: 2250 }]);
  assert.equal([...audio.voices].filter(voice => voice.group === 'demonstration').length, 0);
  audio.stopRound();
  assert.equal(audio.demonstrationKey, null);
});

test('audio is opt-in, loads once after a gesture, and preferences survive unavailable storage', async () => {
  const state = setup({ enabled: false });
  state.audio.scheduleRound('round', 5000, 50_000, true);
  assert.equal(await state.audio.unlock(), false);
  assert.equal(state.created, 0);
  state.audio.setEnabled(true);
  assert.equal(await state.audio.unlock(), true);
  await state.audio.unlock();
  assert.equal(state.created, 1);
  assert.equal(state.requests.length, audioAssetIds().length);
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
  const sizes = {};
  for (const [id, file] of Object.entries(AUDIO_FILES)) {
    const bytes = await readFile(new URL(`../public/audio/${file}`, import.meta.url));
    bytesTotal += bytes.length;
    sizes[id] = bytes.length;
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.readUInt16LE(22), 1);
    const length = bytes.readUInt32LE(40) / 2;
    let peak = 0, dc = 0;
    for (let index = 0; index < length; index++) { const sample = bytes.readInt16LE(44 + index * 2) / 32767; peak = Math.max(peak, Math.abs(sample)); dc += sample; }
    assert.ok(peak > .25 && peak < .71, `${id}: peak ${peak}`);
    assert.ok(Math.abs(dc / length) < .002, `${id}: excessive DC`);
    if (['music', 'urgency', 'permMusic', 'permUrgency', 'slotMusic', 'slotUrgency'].includes(id)) {
      assert.equal(length / bytes.readUInt32LE(24), LOOP_SECONDS);
      assert.ok(Math.abs(bytes.readInt16LE(44) - bytes.readInt16LE(bytes.length - 2)) / 32767 < .005, `${id}: loop seam`);
    } else {
      assert.ok(Math.abs(bytes.readInt16LE(44)) / 32767 < .001);
      assert.ok(Math.abs(bytes.readInt16LE(bytes.length - 2)) / 32767 < .001);
    }
  }
  assert.ok(bytesTotal < 6_500_000, `Audio library budget exceeded: ${bytesTotal}`);
  for (const game of ['totem-shrinker', 'perm-mania', 'facial-slot-machine']) assert.ok(audioAssetIds(game).reduce((sum, id) => sum + sizes[id], 0) < 2_500_000, `${game}: audio bank budget exceeded`);
});

test('Perm Mania loads its own bank and schedules each demonstration on the audio clock', async () => {
  const { audio, context, requests } = setup();
  audio.selectGame('perm-mania');
  await audio.unlock();
  assert.equal(audio.buffers.has('music'), false);
  assert.equal(audio.buffers.has('permMusic'), true);
  assert.equal(requests.length, audioAssetIds('perm-mania').length);
  const cues = demoCues(123);
  audio.scheduleRound('perm', 5000, 35_000, true, false, { game: 'perm-mania', cues });
  const guide = [...audio.voices].filter(voice => voice.id === 'permDemo');
  assert.equal(guide.length, cues.length);
  assert.deepEqual(guide.map(voice => voice.source.started.at), cues.map(at => context.currentTime + 5 + at / 1000));
  assert.equal([...audio.voices].filter(voice => voice.id === 'permMusic').length, 1);
  const count = audio.voices.size;
  audio.synchronize();
  assert.equal(audio.voices.size, count);
  audio.play('hit', { game: 'perm-mania' });
  assert.ok([...audio.voices].some(voice => voice.id === 'permHit'));
  audio.stopRound();
  assert.equal([...audio.voices].filter(voice => voice.group === 'round').length, 0);
});

test('faster Perm rounds speed up backing tracks and preserve the correct phase after unmuting', async () => {
  const { audio, context, setTime } = setup();
  audio.selectGame('perm-mania');
  await audio.unlock();
  audio.scheduleRound('fast', 0, 24_000, true, false, { game: 'perm-mania', bpm: 160, cues: demoCues(123, 160) });
  const backing = [...audio.voices].find(voice => voice.id === 'permMusic');
  assert.equal(backing.source.playbackRate.value, 1.25);
  audio.setEnabled(false);
  setTime(12_000); context.currentTime += 12;
  audio.setEnabled(true); await audio.unlock();
  const resumed = [...audio.voices].find(voice => voice.id === 'permMusic');
  assert.equal(resumed.source.playbackRate.value, 1.25);
  assert.equal(resumed.source.started.offset, 0);
  assert.ok([...audio.voices].filter(voice => voice.id === 'permDemo').every(voice => voice.source.started.at >= context.currentTime));
});

test('Facial Slot Machine uses its own bank, bounded match feedback, and a finish tail across results', async () => {
  const { audio, requests } = setup();
  audio.selectGame('facial-slot-machine');
  await audio.unlock();
  assert.equal(requests.length, audioAssetIds('facial-slot-machine').length);
  assert.equal(audio.buffers.has('music'), false);
  assert.equal(audio.buffers.has('permMusic'), false);
  audio.scheduleRound('slots', 5000, 35_000, true, false, { game: 'facial-slot-machine' });
  assert.equal([...audio.voices].filter(voice => voice.id === 'slotMusic').length, 1);
  assert.equal([...audio.voices].filter(voice => voice.id === 'slotGo').length, 1);
  for (let index = 0; index < 20; index++) audio.play(index % 2 ? 'slotMiss' : 'slotLock');
  assert.equal([...audio.voices].filter(voice => voice.group === 'effects').length, 8);
  audio.endPlayer(); audio.play('slotWin'); audio.stopRound();
  assert.equal([...audio.voices].filter(voice => voice.group === 'music' || voice.group === 'round').length, 0);
  assert.equal([...audio.voices].filter(voice => voice.id === 'slotWin').length, 1);
  audio.cancel();
  assert.equal(audio.voices.size, 0);
});
