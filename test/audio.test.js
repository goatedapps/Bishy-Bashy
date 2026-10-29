import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameAudio } from '../src/audio.js';
import { AUDIO_FILES, BEAT, LOOP_SECONDS, audioAssetIds } from '../scripts/audio/score.js';
import { demoCues } from '../shared/perm.js';
import { FireworkRun } from '../shared/fireworks.js';
import { roundSettings } from '../shared/games.js';
import { FacingRun } from '../shared/facing.js';
import { ARCADE_AUDIO_FILES, ARCADE_VOICE_FILES } from '../scripts/audio/arcade.js';
import { GAMES } from '../shared/games.js';

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
    if (view.getUint32(0) !== 0x52494646) return { duration: 3 };
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

test('Burger, picture, dice, and direction successes reuse one Ding MP3, while Totem retains its colored hit cues', async () => {
  const { audio, requests } = setup();
  audio.selectGame('burger-girl');
  await audio.unlock();
  audio.play('hit', { game: 'burger-girl' });
  assert.equal([...audio.voices].at(-1).id, 'ding');
  audio.selectGame('me-find-mistake');
  await audio.load();
  audio.play('hit', { game: 'me-find-mistake' });
  assert.equal([...audio.voices].at(-1).id, 'ding');
  for (const game of ['dice-dice-more-dice', 'facing-which-way', 'its-raining-coins', 'dodge-or-die']) {
    audio.selectGame(game);
    await audio.load();
    audio.play('hit', { game });
    assert.equal([...audio.voices].at(-1).id, 'ding');
  }
  assert.equal(requests.filter(url => url.includes('Ding.mp3')).length, 1);
  audio.play('hit', { game: 'totem-shrinker', color: 2 });
  assert.equal([...audio.voices].at(-1).id, 'blue');
  audio.setEnabled(false);
  audio.play('hit', { game: 'burger-girl' });
  assert.equal(audio.voices.size, 0);
});

test('Perm and Monkey stage successes preload Ding, preserve input cues, and honor finish and mute lifecycle', async () => {
  const { audio, context, requests } = setup();
  for (const [game, inputCue] of [['perm-mania', 'permHit'], ['mimicking-monkeys', 'green']]) {
    audio.selectGame(game);
    await audio.unlock();
    assert.ok(audio.buffers.has('ding'));
    audio.play('hit', { game, color: 1 });
    assert.equal([...audio.voices].at(-1).id, inputCue);
    audio.play('stageComplete', { game });
    const success = [...audio.voices].at(-1);
    assert.equal(success.id, 'ding');
    assert.equal(success.group, 'effects');
    audio.endPlayer();
    audio.play('finish');
    assert.ok(audio.voices.has(success), 'the final stage Ding must finish alongside the finish cue');
    audio.setPreferences({ effectsVolume: 0 });
    assert.equal(audio.effectsBus.gain.events.at(-1).value, 0);
    audio.setPreferences({ effectsVolume: .8 });
    audio.cancel();
    assert.equal(audio.voices.size, 0);
    audio.setEnabled(false);
    audio.play('stageComplete', { game });
    assert.equal(audio.voices.size, 0);
    audio.setEnabled(true);
    context.state = 'suspended';
    audio.play('stageComplete', { game });
    assert.equal(audio.voices.size, 0);
    context.state = 'running';
    assert.equal(audio.voices.size, 0, 'resuming must not replay a skipped success');
  }
  assert.equal(requests.filter(url => url.includes('Ding.mp3')).length, 1);
});

test('incorrect sets use the supplied Wrong cue while correct sets use Ding', async () => {
  const { audio, requests } = setup();
  for (const game of ['perm-mania', 'mimicking-monkeys', 'facing-which-way', 'fireworks-craze', 'dice-dice-more-dice', 'me-find-mistake']) {
    audio.selectGame(game);
    await audio.unlock();
    audio.play('stageWrong', { game });
    assert.equal([...audio.voices].at(-1).id, 'wrong');
    if (!['perm-mania', 'fireworks-craze'].includes(game)) {
      audio.play('mistake', { game });
      assert.equal([...audio.voices].at(-1).id, 'wrong');
    }
    audio.play('stageComplete', { game });
    assert.equal([...audio.voices].at(-1).id, 'ding');
  }
  assert.equal(requests.filter(url => url.includes('wrong.mp3')).length, 1);
});

test('Game Select announces once and waits for both voice and applause to actually end', async () => {
  const { audio } = setup();
  await audio.unlock();
  const game = 'totem-shrinker';
  assert.equal(audio.announceGame('set-one', game), false);
  const voices = [...audio.voices].filter(voice => voice.group === 'announcement');
  assert.deepEqual(voices.map(voice => voice.id), [`gameVoice:${game}`, 'applause']);
  audio.announceGame('set-one', game);
  assert.equal([...audio.voices].filter(voice => voice.group === 'announcement').length, 2);
  voices[0].source.onended();
  assert.equal(audio.announceGame('set-one', game), false);
  voices[1].source.onended();
  assert.equal(audio.announceGame('set-one', game), true);
  assert.equal(audio.announceGame('set-one', game), true);
  assert.equal([...audio.voices].filter(voice => voice.group === 'announcement').length, 0);
  audio.announceGame('set-two', game);
  audio.cancel();
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.announceGame('set-two', game), true);
  audio.setEnabled(false);
  assert.equal(audio.announceGame('muted', game), true);
  audio.setEnabled(true);
  assert.equal(audio.announceGame('muted', game), true);
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.announceGame('hidden', game, false), true);
  assert.equal(audio.announceGame('hidden', game, true), true);
  assert.equal(audio.voices.size, 0);
});

test('the two-second announcement screen lets its matching audio tail finish across instructions', async () => {
  const { audio } = setup();
  await audio.unlock();
  audio.announceGame('intro', 'totem-shrinker');
  const voices = [...audio.voices].filter(voice => voice.group === 'announcement');
  audio.announceGame(null, 'totem-shrinker', true, 'intro');
  assert.ok(voices.every(voice => !voice.stopped && audio.voices.has(voice)));
  audio.announceGame(null, 'totem-shrinker', true, 'intro');
  assert.equal([...audio.voices].filter(voice => voice.group === 'announcement').length, 2);
  audio.announceGame(null, 'totem-shrinker', true, 'another-round');
  assert.ok(voices.every(voice => voice.stopped));
  assert.equal([...audio.voices].filter(voice => voice.group === 'announcement').length, 0);
});

test('facing turns reuse slot-lock audio at local cue times and cancel old cues on replay, mute, and finish', async () => {
  const { audio, context, requests, setTime } = setup();
  const round = { id: 'facing', game: 'facing-which-way', ...roundSettings('facing-which-way', 123) };
  const run = new FacingRun(round, 1000);
  audio.selectGame(round.game);
  await audio.unlock();
  assert.ok(requests.some(url => url.includes('slot-lock.wav')));
  assert.ok(!requests.some(url => url.includes('slot-carousel.wav')));
  audio.scheduleRound(run.id, run.start, run.end, true, false, { game: round.game });
  setTime(run.turnsAt - 100);
  audio.facingTurns(run);
  const voices = () => [...audio.voices].filter(voice => voice.group === 'facing-demo');
  assert.equal(voices().length, 1);
  assert.equal(voices()[0].id, 'slotLock');
  assert.equal(voices()[0].source.started.at, context.currentTime + .1);
  audio.facingTurns(run);
  assert.equal(voices().length, 1);
  const at = run.playAt;
  run.tap((run.puzzle.answer + 1) % 3, at);
  setTime(at);
  audio.facingTurns(run);
  assert.equal(voices().length, 0);
  setTime(run.turnsAt - 100);
  audio.facingTurns(run);
  assert.equal(voices().length, 1);
  audio.setEnabled(false);
  assert.equal(voices().length, 0);
  audio.setEnabled(true);
  await audio.unlock();
  setTime(run.turnsAt + 300);
  audio.facingTurns(run);
  assert.equal(voices().length, 0);
  setTime(run.cues[1].at - 100);
  audio.facingTurns(run);
  assert.equal(voices().length, 1);
  audio.endPlayer();
  assert.equal(voices().length, 0);
});

test('wheel audio follows the current spin, never duplicates on redraw, and stops on navigation or mute', async () => {
  const { audio } = setup();
  await audio.unlock();
  audio.spinWheel('spin-1', 1000, 5500);
  const voice = [...audio.voices].find(item => item.group === 'wheel');
  assert.equal(voice.id, 'wheelSpin');
  assert.equal(voice.source.started.offset, 1);
  audio.spinWheel('spin-1', 1100, 5500);
  assert.equal([...audio.voices].filter(item => item.group === 'wheel').length, 1);
  audio.spinWheel(null, 0, 0);
  assert.equal([...audio.voices].filter(item => item.group === 'wheel').length, 0);
  audio.spinWheel('spin-1', 4200, 5500);
  assert.equal([...audio.voices].filter(item => item.group === 'wheel').length, 1);
  assert.equal([...audio.voices].find(item => item.group === 'wheel').source.loop, true);
  assert.ok(Math.abs([...audio.voices].find(item => item.group === 'wheel').source.started.offset - 1.2) < .001);
  audio.spinWheel('spin-1', 5501, 5500);
  assert.deepEqual([...audio.voices].filter(item => item.group === 'wheel').map(item => item.id), ['gameSelect', 'gameVoice:totem-shrinker', 'applause']);
  audio.spinWheel('spin-1', 5510, 5500);
  assert.equal([...audio.voices].filter(item => item.group === 'wheel').length, 3);
  audio.spinWheel(null, 0, 0);
  audio.spinWheel('spin-1', 5550, 5500);
  assert.equal([...audio.voices].filter(item => item.group === 'wheel').length, 0);
  audio.spinWheel('spin-2', 0, 5500);
  audio.setEnabled(false);
  assert.equal(audio.voices.size, 0);
});

test('returning after a reel landing skips stale selection audio', async () => {
  const { audio } = setup();
  await audio.unlock();
  audio.spinWheel('late-selection', 6000, 4700);
  assert.equal([...audio.voices].filter(voice => voice.group === 'wheel').length, 0);
  audio.spinWheel('next-selection', 0, 4700);
  assert.equal([...audio.voices].filter(voice => voice.id === 'wheelSpin').length, 1);
  audio.spinWheel('next-selection', 4700, 4700);
  assert.deepEqual([...audio.voices].filter(voice => voice.group === 'wheel').map(voice => voice.id), ['gameSelect', 'gameVoice:totem-shrinker', 'applause']);
  audio.setEnabled(false);
  assert.equal([...audio.voices].filter(voice => voice.group === 'wheel').length, 0);
});

test('every Arcade game announces the selected game with simultaneous applause, once per landing', async () => {
  const { audio, context, requests } = setup();
  await audio.unlock();
  assert.deepEqual(Object.keys(ARCADE_VOICE_FILES).sort(), Object.keys(GAMES).sort());
  for (const [game, file] of Object.entries(ARCADE_VOICE_FILES)) {
    assert.ok(requests.some(url => url.includes(`/${file}?`)), file);
    audio.spinWheel(game, 4700, 4700, game);
    const voices = [...audio.voices].filter(voice => voice.group === 'wheel');
    assert.deepEqual(voices.map(voice => voice.id), ['gameSelect', `gameVoice:${game}`, 'applause']);
    assert.ok(voices.every(voice => voice.source.started.at === context.currentTime));
    const count = context.sources.length;
    audio.spinWheel(game, 4710, 4700, game);
    assert.equal(context.sources.length, count);
    audio.spinWheel(null, 0, 0);
    assert.ok(voices.every(voice => voice.stopped));
  }
  audio.setPreferences({ effectsVolume: 0 });
  audio.spinWheel('silent-selection', 4700, 4700, 'perm-mania');
  assert.equal(audio.voices.size, 0);
});

test('landing voices finish across the matching instructions transition but cancel on interruption or navigation', async () => {
  const { audio, context } = setup();
  await audio.unlock();
  audio.spinWheel('landing', 4700, 4700, 'dice-dice-more-dice');
  const voices = [...audio.voices].filter(voice => ['applause', 'gameVoice:dice-dice-more-dice'].includes(voice.id));
  assert.ok(voices.every(voice => voice.source.stoppedAt === undefined));
  const count = context.sources.length;
  audio.spinWheel(null, 0, 0, undefined, 'landing');
  assert.equal(context.sources.length, count);
  assert.ok(voices.every(voice => !voice.stopped));
  audio.spinWheel(null, 0, 0, undefined, 'different-round');
  assert.ok(voices.every(voice => voice.stopped));
  audio.spinWheel('new-landing', 4700, 4700, 'perm-mania');
  context.state = 'suspended';
  audio.spinWheel(null, 0, 0, undefined, 'new-landing');
  assert.equal(audio.voices.size, 0);
});

test('a missing landing buffer cannot replay applause or announce a stale selection after loading', async () => {
  const { audio, context } = setup();
  await audio.unlock();
  const buffer = audio.buffers.get('gameSelect');
  audio.buffers.delete('gameSelect');
  audio.spinWheel('partial-load', 4700, 4700, 'facing-which-way');
  assert.deepEqual([...audio.voices].map(voice => voice.id), ['gameVoice:facing-which-way', 'applause']);
  const count = context.sources.length;
  audio.buffers.set('gameSelect', buffer);
  audio.spinWheel('partial-load', 4750, 4700, 'facing-which-way');
  assert.equal(context.sources.length, count);
  audio.spinWheel('late-landing', 6000, 4700, 'perm-mania');
  assert.equal(audio.voices.size, 0);
});

test('instructions reuse the gesture-authorized media element on first entry and preserve each track position', async () => {
  const media = new MenuMedia();
  let creations = 0;
  const { audio } = setup({ createMedia: () => { creations++; return media; } });
  await audio.unlock();
  audio.setMenuScreen(true);
  media.currentTime = 20;
  audio.setMenuScreen(true, true, null, 'instructions');
  assert.equal(creations, 1);
  assert.equal(media.src, '/audio/game-instructions.mp3');
  assert.equal(media.currentTime, 0);
  assert.equal(audio.menuGain.gain.value, 2);
  assert.equal(media.plays, 2);
  media.currentTime = 2;
  audio.setMenuScreen(true, true, null, 'instructions');
  assert.equal(media.plays, 2);
  audio.scheduleRound('round', 3000, 48000, true);
  assert.equal(audio.menuPlaying, false);
  audio.stopRound();
  audio.setMenuScreen(true, true, 'round');
  assert.ok(audio.podium.voice);
  audio.podium.voice.source.onended();
  assert.equal(media.src, '/audio/Background-ActionRock.mp3');
  assert.equal(media.currentTime, 20);
  audio.setMenuScreen(true, true, null, 'instructions');
  assert.equal(media.currentTime, 2);
  assert.equal(creations, 1);
  audio.setEnabled(false);
  assert.equal(audio.menuPlaying, false);
});

test('each podium plays one winner cue before menu music, preserving accepted finish cues', async () => {
  const media = new MenuMedia();
  const { audio } = setup({ createMedia: () => media });
  await audio.unlock();
  audio.setMenuScreen(true);
  assert.equal(media.plays, 1);
  audio.play('finish');
  const finish = [...audio.voices].find(voice => voice.id === 'finish');
  audio.setMenuScreen(true, true, 'round-one');
  const podium = [...audio.voices].find(voice => voice.id === 'podiumWinner');
  assert.ok(podium);
  assert.equal(podium.group, 'podium');
  assert.equal(audio.menuPlaying, false);
  assert.equal(finish.stopped, false);
  for (let index = 0; index < 10; index++) {
    audio.setMenuScreen(true, true, 'round-one');
    audio.synchronize();
  }
  assert.equal([...audio.voices].filter(voice => voice.id === 'podiumWinner').length, 1);
  assert.equal(media.plays, 1);
  podium.source.onended();
  assert.equal(audio.menuPlaying, true);
  assert.equal(media.plays, 2);
  audio.setMenuScreen(true, true, 'round-one');
  assert.equal([...audio.voices].filter(voice => voice.id === 'podiumWinner').length, 0);
  audio.setMenuScreen(true, true, 'round-two');
  assert.equal([...audio.voices].filter(voice => voice.id === 'podiumWinner').length, 1);
  assert.equal(audio.menuPlaying, false);
});

test('podium navigation and mute cancel the cue without stale replay or a late music restart during gameplay', async () => {
  const media = new MenuMedia();
  const { audio } = setup({ createMedia: () => media });
  await audio.unlock();
  audio.setMenuScreen(true, true, 'round-one');
  const first = audio.podium.voice;
  audio.setMenuScreen(false);
  assert.equal(first.stopped, true);
  first.source.onended();
  assert.equal(media.plays, 0);
  audio.setMenuScreen(true, true, 'round-two');
  const second = audio.podium.voice;
  audio.setEnabled(false);
  assert.equal(second.stopped, true);
  audio.setEnabled(true); await audio.unlock();
  assert.equal(audio.podium.voice, null);
  assert.equal(audio.menuPlaying, true);
  assert.equal([...audio.voices].filter(voice => voice.id === 'podiumWinner').length, 0);
  audio.setMenuScreen(true, true, 'round-three');
  assert.ok(audio.podium.voice);
  audio.cancel();
  assert.equal(audio.podium.voice, null);
  assert.equal(audio.menuPlaying, false);
});

test('podium effects follow effects volume and never permanently block music after a failed load', async () => {
  const media = new MenuMedia();
  const { audio } = setup({ createMedia: () => media });
  await audio.unlock();
  audio.setPreferences({ effectsVolume: 0 });
  audio.setMenuScreen(true, true, 'quiet-podium');
  assert.equal(audio.podium.voice, null);
  assert.equal(audio.menuPlaying, true);
  audio.setPreferences({ effectsVolume: .5 });
  assert.ok(audio.podium.voice);
  audio.setMenuScreen(true);
  audio.buffers.delete('podiumWinner');
  audio.loadFailed = true;
  audio.setMenuScreen(true, true, 'failed-podium');
  assert.equal(audio.podium.voice, null);
  assert.equal(audio.menuPlaying, true);
});

test('button presses share one cached MP3 across games and use bounded effects with mute and volume controls', async () => {
  const { audio, requests } = setup();
  await audio.unlock();
  audio.pressButton();
  assert.equal([...audio.voices].at(-1).id, 'buttonPress');
  assert.equal([...audio.voices].at(-1).group, 'effects');
  audio.selectGame('perm-mania');
  await audio.load();
  assert.equal(requests.filter(url => url.includes('Button-Press.mp3')).length, 1);
  for (let index = 0; index < 30; index++) audio.pressButton();
  assert.equal([...audio.voices].filter(voice => voice.group === 'effects').length, 8);
  audio.setPreferences({ effectsVolume: 0 });
  const count = audio.context.sources.length;
  audio.pressButton();
  assert.equal(audio.context.sources.length, count);
  audio.setEnabled(false);
  audio.pressButton();
  assert.equal(audio.voices.size, 0);
});

test('loading button feedback never catches up after interruption or a slow download', async () => {
  const { audio, setTime } = setup();
  audio.pressButton();
  audio.cancel();
  await audio.unlock();
  assert.ok(![...audio.voices].some(voice => voice.id === 'buttonPress'));
  audio.buffers.delete('buttonPress');
  audio.pressButton();
  setTime(300);
  await audio.load();
  await Promise.resolve();
  assert.ok(![...audio.voices].some(voice => voice.id === 'buttonPress'));
  audio.pressButton();
  assert.equal([...audio.voices].at(-1).id, 'buttonPress');
});

test('gameplay presses use a separate cached punch effect and obey effects volume, mute, and voice limits', async () => {
  const { audio, requests } = setup();
  await audio.unlock();
  audio.pressButton();
  assert.equal([...audio.voices].at(-1).id, 'buttonPress');
  audio.pressButton('gameplay');
  assert.equal([...audio.voices].at(-1).id, 'gameplayPress');
  assert.equal([...audio.voices].at(-1).group, 'effects');
  audio.selectGame('facial-slot-machine');
  await audio.load();
  assert.equal(requests.filter(url => url.includes('Punch-button.mp3')).length, 1);
  for (let index = 0; index < 30; index++) audio.pressButton('gameplay');
  assert.equal([...audio.voices].filter(voice => voice.group === 'effects').length, 8);
  audio.setPreferences({ effectsVolume: 0 });
  const count = audio.context.sources.length;
  audio.pressButton('gameplay');
  assert.equal(audio.context.sources.length, count);
  audio.setEnabled(false);
  audio.pressButton('gameplay');
  assert.equal(audio.voices.size, 0);
});

test('instruction reveals use their own WAV without changing menu or gameplay button sounds', async () => {
  const { audio, requests } = setup();
  await audio.unlock();
  audio.pressButton('instructions');
  assert.equal([...audio.voices].at(-1).id, 'instructionReveal');
  audio.pressButton();
  assert.equal([...audio.voices].at(-1).id, 'buttonPress');
  audio.pressButton('gameplay');
  assert.equal([...audio.voices].at(-1).id, 'gameplayPress');
  audio.selectGame('perm-mania'); await audio.load();
  assert.equal(requests.filter(url => url.includes('how-to-play.wav')).length, 1);
  audio.setEnabled(false);
  audio.pressButton('instructions');
  assert.equal(audio.voices.size, 0);
});

test('firework launch sounds load only for Fireworks and follow each local launch and retry once', async () => {
  const { audio, context, requests, setTime } = setup();
  await audio.unlock();
  assert.ok(!requests.some(url => url.includes('Fireworks.mp3')));
  audio.selectGame('fireworks-craze');
  await audio.unlock();
  assert.equal(requests.filter(url => url.includes('Fireworks.mp3')).length, 1);
  const round = { id: 'rockets', game: 'fireworks-craze', ...roundSettings('fireworks-craze', 123) };
  const run = new FireworkRun(round, 1000);
  audio.scheduleRound(round.id, run.start, run.end, true, false, { game: round.game });
  setTime(849); audio.fireworkLaunch(run);
  assert.ok(![...audio.voices].some(voice => voice.id === 'fireworkLaunch'));
  setTime(850); audio.fireworkLaunch(run);
  const first = [...audio.voices].find(voice => voice.id === 'fireworkLaunch');
  assert.equal(first.source.started.at, context.currentTime + .15);
  audio.fireworkLaunch(run);
  assert.equal([...audio.voices].filter(voice => voice.id === 'fireworkLaunch').length, 1);
  const hitAt = run.rockets[0].launchAt;
  setTime(hitAt); run.tap(run.rockets[0].color, hitAt); audio.fireworkLaunch(run);
  assert.equal(first.stopped, true);
  setTime(run.launchedAt - 100); audio.fireworkLaunch(run);
  const second = [...audio.voices].find(voice => voice.id === 'fireworkLaunch');
  assert.notEqual(second, first);
  assert.equal(second.source.started.at, context.currentTime + .1);
  audio.fireworkLaunch(run);
  assert.equal([...audio.voices].find(voice => voice.id === 'fireworkLaunch'), second);
  setTime(run.rockets[1].launchAt - 100); audio.fireworkLaunch(run);
  assert.equal([...audio.voices].filter(voice => voice.id === 'fireworkLaunch').length, 2);
  const missAt = run.rockets[0].launchAt + run.rockets[0].airMs;
  run.advance(missAt);
  setTime(run.launchedAt - 100); audio.fireworkLaunch(run);
  assert.equal(second.stopped, true);
  assert.equal([...audio.voices].filter(voice => voice.id === 'fireworkLaunch').length, 1);
  audio.endPlayer();
  assert.equal([...audio.voices].filter(voice => voice.id === 'fireworkLaunch').length, 0);
});

test('firework launches stay silent after mute, expired attempts, results, and interruptions', async () => {
  const { audio, context, setTime } = setup();
  audio.selectGame('fireworks-craze');
  await audio.unlock();
  const round = { id: 'rockets', game: 'fireworks-craze', ...roundSettings('fireworks-craze', 123) };
  const run = new FireworkRun(round, 1000);
  audio.scheduleRound(round.id, run.start, run.end, true, false, { game: round.game });
  audio.setEnabled(false);
  setTime(1000); audio.fireworkLaunch(run);
  assert.ok(![...audio.voices].some(voice => voice.id === 'fireworkLaunch'));
  setTime(1200); audio.setEnabled(true); await audio.unlock(); audio.fireworkLaunch(run);
  assert.ok(![...audio.voices].some(voice => voice.id === 'fireworkLaunch'));
  run.advance(run.rockets[0].launchAt + run.rockets[0].airMs);
  setTime(run.launchedAt); audio.fireworkLaunch(run);
  assert.equal([...audio.voices].filter(voice => voice.id === 'fireworkLaunch').length, 1);
  context.state = 'suspended'; context.stateChange();
  setTime(run.launchedAt + 200); await context.resume(); audio.fireworkLaunch(run);
  assert.ok(![...audio.voices].some(voice => voice.id === 'fireworkLaunch'));
  audio.stopRound(); audio.fireworkLaunch(run);
  assert.ok(![...audio.voices].some(voice => voice.id === 'fireworkLaunch'));
});

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
  assert.equal(state.requests.length, audioAssetIds().length + 8 + Object.keys(ARCADE_AUDIO_FILES).length);
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
  assert.deepEqual(round.map(voice => voice.source.started.at), [102]);
  assert.deepEqual(round.map(voice => voice.id), ['countdown']);
  assert.equal(round[0].source.stoppedAt, undefined);
  const music = [...audio.voices].filter(voice => voice.group === 'music');
  assert.equal(music[0].source.started.at, 105);
  assert.equal(music[0].source.started.offset, 0);
  assert.equal(music[0].source.stoppedAt, 150.01);
  assert.equal(music[1].source.started.at, 105 + Math.ceil(35 / BEAT) * BEAT);
  const voices = context.sources.length;
  for (let index = 0; index < 10; index++) audio.scheduleRound('round', 5000, 50_000, true);
  assert.equal(context.sources.length, voices);
});

test('a late or resumed three-second countdown seeks forward, preserves its tail, and never replays after GO', async () => {
  const { audio, context, setTime, requests } = setup();
  await audio.unlock();
  assert.ok(requests.some(url => url.includes('countdown.mp3')));
  assert.ok(!requests.some(url => url.includes('countdown.wav')));
  setTime(4500);
  audio.scheduleRound('late', 6000, 51000, true);
  let countdown = [...audio.voices].find(voice => voice.id === 'countdown');
  assert.equal(countdown.source.started.at, context.currentTime);
  assert.equal(countdown.source.started.offset, 1.5);
  assert.equal(countdown.source.stoppedAt, undefined);
  audio.setEnabled(false);
  setTime(5000);
  audio.setEnabled(true);
  await audio.unlock();
  countdown = [...audio.voices].find(voice => voice.id === 'countdown');
  assert.equal(countdown.source.started.offset, 2);
  audio.setEnabled(false);
  setTime(6001);
  audio.setEnabled(true);
  await audio.unlock();
  assert.ok(![...audio.voices].some(voice => voice.group === 'round'));
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
  assert.equal(requests.length, audioAssetIds('perm-mania').length + 9 + Object.keys(ARCADE_AUDIO_FILES).length);
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
  assert.equal(requests.length, audioAssetIds('facial-slot-machine').length + 8 + Object.keys(ARCADE_AUDIO_FILES).length);
  assert.equal(audio.buffers.has('music'), false);
  assert.equal(audio.buffers.has('permMusic'), false);
  audio.scheduleRound('slots', 5000, 35_000, true, false, { game: 'facial-slot-machine' });
  assert.equal([...audio.voices].filter(voice => voice.id === 'slotMusic').length, 1);
  assert.equal([...audio.voices].filter(voice => voice.id === 'slotGo').length, 0);
  assert.equal([...audio.voices].filter(voice => voice.id === 'countdown').length, 1);
  for (let index = 0; index < 20; index++) audio.play(index % 2 ? 'slotMiss' : 'slotLock');
  assert.equal([...audio.voices].filter(voice => voice.group === 'effects').length, 8);
  audio.endPlayer(); audio.play('slotWin'); audio.stopRound();
  assert.equal([...audio.voices].filter(voice => voice.group === 'music' || voice.group === 'round').length, 0);
  assert.equal([...audio.voices].filter(voice => voice.id === 'slotWin').length, 1);
  audio.cancel();
  assert.equal(audio.voices.size, 0);
});

test('first menu playback is issued before awaiting a suspended audio context resume', async () => {
  let resumed = false, requested = false, finishResume;
  const media = new MenuMedia();
  media.play = () => { requested = true; assert.equal(resumed, false); return Promise.resolve(); };
  const { audio, context } = setup({createMedia:()=>media});
  context.state='suspended';
  context.resume=()=>new Promise(resolve=>{finishResume=()=>{resumed=true;context.state='running';resolve();};});
  audio.setMenuScreen(true,true,null,'instructions');
  const unlocking=audio.unlock();
  assert.equal(requested,true);
  finishResume();await unlocking;
  assert.equal(audio.menuPlaying,true);
  assert.equal(media.src,'/audio/game-instructions.mp3');
});
