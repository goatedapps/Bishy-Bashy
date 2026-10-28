import { AUDIO_FILES, BEAT, audioAssetIds } from '../scripts/audio/score.js';
import { COUNTDOWN_MS } from '../shared/games.js';

const BASE_URL = import.meta.env?.BASE_URL || '/';
const DEFAULTS = { musicMode: 'auto', musicVolume: .65, effectsVolume: .8 };
const MUSIC_MODES = ['auto', 'on', 'off'];
const EXTRA_AUDIO_FILES = { buttonPress: 'Button-Press.mp3', countdown: 'countdown.mp3' };
const PROFILES = {
  'jump-for-the-meat': { music: 'music', urgency: 'urgency', go: 'go' },
  'mimicking-monkeys': { music: 'music', urgency: 'urgency', go: 'go' },
  'fireworks-craze': { music: 'music', urgency: 'urgency', go: 'go' },
  'totem-shrinker': { music: 'music', urgency: 'urgency', go: 'go' },
  'perm-mania': { music: 'permMusic', urgency: 'permUrgency', go: 'permGo' },
  'facial-slot-machine': { music: 'slotMusic', urgency: 'slotUrgency', go: 'slotGo' },
};
const clamp = value => Math.max(0, Math.min(1, value));

export class GameAudio {
  constructor({ storage = globalThis.localStorage, createContext = () => new AudioContext(), createMedia = () => new Audio(), now = () => performance.now(), fetchFile = (url, options) => fetch(url, options), onChange = () => {} } = {}) {
    this.storage = storage;
    this.createContext = createContext;
    this.createMedia = createMedia;
    this.menu = { active: false, musicOwner: true };
    this.menuPlaying = false;
    this.menuRequest = 0;
    this.now = now;
    this.fetchFile = fetchFile;
    this.onChange = onChange;
    this.enabled = this.read('bb-sound') === 'on';
    let saved;
    try { saved = JSON.parse(this.read('bb-audio') || '{}'); } catch { saved = {}; }
    this.preferences = {
      musicMode: MUSIC_MODES.includes(saved.musicMode) ? saved.musicMode : DEFAULTS.musicMode,
      musicVolume: Number.isFinite(saved.musicVolume) ? clamp(saved.musicVolume) : DEFAULTS.musicVolume,
      effectsVolume: Number.isFinite(saved.effectsVolume) ? clamp(saved.effectsVolume) : DEFAULTS.effectsVolume,
    };
    this.context = null;
    this.buffers = new Map();
    this.voices = new Set();
    this.target = null;
    this.countdownKey = null;
    this.musicKey = null;
    this.loading = null;
    this.loadFailed = false;
    this.previewing = false;
    this.previewRequest = 0;
    this.game = 'totem-shrinker';
    this.demonstrationKey = null;
    this.demonstrationNotes = new Set();
    this.buttonRequest = 0;
  }

  read(key) { try { return this.storage?.getItem(key); } catch { return null; } }
  write(key, value) { try { this.storage?.setItem(key, value); } catch {} }
  get status() { return !this.enabled ? 'off' : this.loading ? 'loading' : this.loadFailed ? 'unavailable' : this.buffers.size && this.context?.state === 'running' ? 'ready' : 'waiting'; }

  initialize() {
    this.context = this.createContext();
    this.master = this.context.createGain();
    this.effectsBus = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.duck = this.context.createGain();
    this.limiter = this.context.createDynamicsCompressor();
    this.master.gain.value = .8;
    this.limiter.threshold.value = -5;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = .003;
    this.limiter.release.value = .12;
    this.effectsBus.connect(this.master);
    this.musicBus.connect(this.duck).connect(this.master);
    this.master.connect(this.limiter).connect(this.context.destination);
    this.applyVolumes();
    this.context.addEventListener('statechange', () => {
      if (this.context.state !== 'running') {
        this.stopVoices(() => true, true);
        this.stopMenu();
      }
      this.countdownKey = null; this.musicKey = null; this.demonstrationNotes.clear();
      if (this.context.state === 'running') this.synchronize();
      this.onChange();
    });
  }

  async unlock() {
    if (!this.enabled) return false;
    try {
      if (!this.context) this.initialize();
      if (this.context.state !== 'running') await this.context.resume();
      this.synchronizeMenu();
      await this.load();
      this.synchronize();
      return this.context.state === 'running' && this.buffers.size > 0;
    } catch {
      this.loadFailed = true;
      this.onChange();
      return false;
    }
  }

  async load() {
    if (this.loading) { await this.loading; return this.load(); }
    const bank = this.game;
    const missing = [...audioAssetIds(bank), ...Object.keys(EXTRA_AUDIO_FILES)].filter(id => !this.buffers.has(id)).map(id => [id, AUDIO_FILES[id] || EXTRA_AUDIO_FILES[id]]);
    if (!missing.length) { this.loadFailed = false; return; }
    this.loading = Promise.allSettled(missing.map(async ([id, file]) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await this.fetchFile(`${BASE_URL}audio/${file}?v=1`, { signal: controller.signal });
        if (!response.ok) throw new Error('Audio download failed');
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(id, buffer);
      } finally { clearTimeout(timeout); }
    }));
    this.onChange();
    const result = await this.loading;
    this.loadFailed = result.some(item => item.status === 'rejected');
    this.loading = null;
    this.countdownKey = null;
    this.demonstrationNotes.clear();
    this.stopVoices(voice => voice.group === 'demonstration');
    this.stopVoices(voice => voice.group === 'round');
    this.onChange();
    if (bank !== this.game) return this.load();
  }

  selectGame(game) {
    if (this.game === game) return;
    this.game = game;
    this.stopPreview();
    if (this.enabled && this.context) this.load().then(() => this.synchronize());
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.write('bb-sound', this.enabled ? 'on' : 'off');
    if (!this.enabled) {
      this.buttonRequest++;
      this.stopMenu();
      this.stopPreview();
      this.stopVoices(() => true);
      this.countdownKey = null; this.musicKey = null; this.demonstrationNotes.clear();
    }
    this.onChange();
  }

  toggle() { this.setEnabled(!this.enabled); }

  setPreferences(changes) {
    if (MUSIC_MODES.includes(changes.musicMode)) this.preferences.musicMode = changes.musicMode;
    for (const key of ['musicVolume', 'effectsVolume']) if (Number.isFinite(changes[key])) this.preferences[key] = clamp(changes[key]);
    this.write('bb-audio', JSON.stringify(this.preferences));
    this.applyVolumes();
    if (this.preferences.musicMode === 'off' || this.preferences.musicVolume === 0) this.stopVoices(voice => voice.group === 'preview-music');
    this.synchronize();
    this.onChange();
  }

  applyVolumes() {
    if (!this.context) return;
    const at = this.context.currentTime;
    this.effectsBus.gain.setTargetAtTime(this.preferences.effectsVolume * .6, at, .015);
    this.musicBus.gain.setTargetAtTime(this.preferences.musicVolume * .5, at, .025);
  }

  source(id, { at = this.context?.currentTime, group = 'effects', offset = 0, loop = false, end = null, rate = 1 } = {}) {
    const buffer = this.buffers.get(id);
    if (!this.enabled || this.context?.state !== 'running' || !buffer) return null;
    if (group === 'effects') {
      const effects = [...this.voices].filter(voice => voice.group === group);
      if (effects.length >= 8) this.stopVoice(effects[0]);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.loop = loop;
    if (loop) { source.loopStart = 0; source.loopEnd = buffer.duration; }
    const start = Math.max(this.context.currentTime, at);
    gain.gain.setValueAtTime(loop ? 0 : 1, start);
    if (loop) gain.gain.linearRampToValueAtTime(1, start + .08);
    if (end !== null) {
      gain.gain.setValueAtTime(1, Math.max(start, end - .1));
      gain.gain.linearRampToValueAtTime(0, end);
    }
    source.connect(gain).connect(group === 'music' || group === 'preview-music' ? this.musicBus : this.effectsBus);
    const voice = { source, gain, group, id, stopped: false };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect(); gain.disconnect();
      if (group.startsWith('preview-') && ![...this.voices].some(other => other.group.startsWith('preview-'))) {
        this.previewing = false;
        this.synchronizeMenu();
        this.onChange();
      }
    };
    source.start(start, offset);
    if (end !== null) source.stop(end + .01);
    return voice;
  }

  play(id, { color = 0, progress = 0, at = this.context?.currentTime, group = 'effects', game = this.game } = {}) {
    if (id === 'jumpPerfect') id = 'permGrow';
    if (id === 'hit') id = game === 'perm-mania' ? 'permHit' : ['red', 'green', 'blue'][color] || 'red';
    if (id === 'mistake' && game === 'perm-mania') id = 'permMiss';
    const voice = this.source(id, { at, group, rate: ['red', 'green', 'blue'].includes(id) ? 1 + clamp(progress) * .04 : 1 });
    if (voice && group === 'effects') {
      const time = Math.max(this.context.currentTime, at);
      this.duck.gain.cancelScheduledValues(time);
      this.duck.gain.setValueAtTime(this.duck.gain.value, time);
      this.duck.gain.linearRampToValueAtTime(id === 'mistake' ? .4 : .66, time + .012);
      this.duck.gain.setTargetAtTime(1, time + .09, .06);
    }
  }

  pressButton() {
    if (!this.enabled || this.preferences.effectsVolume === 0) return;
    const request = ++this.buttonRequest;
    if (this.context?.state === 'running' && this.buffers.has('buttonPress')) {
      this.play('buttonPress');
      return;
    }
    const pressedAt = this.now();
    // A loading bank must not release a backlog of clicks or play stale feedback.
    this.unlock().then(ready => {
      if (ready && request === this.buttonRequest && this.now() - pressedAt < 250) this.play('buttonPress');
    });
  }

  demonstrate(key, cues) {
    if (this.demonstrationKey !== key) {
      this.stopVoices(voice => voice.group === 'demonstration');
      this.demonstrationKey = key;
      this.demonstrationNotes.clear();
    }
    if (!this.enabled || this.context?.state !== 'running' || !this.target || this.target.playerDone || this.target.game !== 'mimicking-monkeys') return;
    const now = this.now();
    cues.forEach((cue, index) => {
      const remaining = cue.at - now;
      // Look ahead on the audio clock without scheduling a whole sequence of future voices.
      if (remaining < 0 || remaining > 150 || cue.at >= this.target.end || this.demonstrationNotes.has(index)) return;
      const voice = this.source(['red', 'green', 'blue'][cue.color], { at: this.context.currentTime + remaining / 1000, group: 'demonstration' });
      if (voice) this.demonstrationNotes.add(index);
    });
  }

  scheduleRound(id, start, end, musicOwner, playerDone = false, { game = this.game, cues = [], bpm = 128 } = {}) {
    this.setMenuScreen(false, musicOwner);
    this.selectGame(game);
    if (this.target?.id !== id) {
      this.stopRound();
      this.stopPreview();
      this.target = { id, start, end, musicOwner, playerDone, game, cues, bpm };
    } else Object.assign(this.target, { musicOwner, playerDone });
    this.synchronize();
  }

  synchronize() {
    this.synchronizeMenu();
    if (!this.enabled || this.context?.state !== 'running' || !this.target || !this.buffers.size) return;
    const { id, start, end, musicOwner, playerDone, game, cues, bpm } = this.target;
    const perm = game === 'perm-mania';
    const profile = PROFILES[game] || PROFILES['totem-shrinker'];
    const rate = perm ? bpm / 128 : 1;
    const now = this.now();
    if (now >= end) { this.stopRound(); return; }
    const audioNow = this.context.currentTime;
    if (!playerDone && this.countdownKey !== id) {
      this.countdownKey = id;
      if (now < start) {
        const countdownAt = start - COUNTDOWN_MS;
        const offset = Math.max(0, (now - countdownAt) / 1000);
        // The clip's final beat lands on GO; preserve its decay without a second GO cue.
        if (offset < (this.buffers.get('countdown')?.duration || 0)) this.source('countdown', {
          at: audioNow + Math.max(0, (countdownAt - now) / 1000), offset,
          group: 'round',
        });
      }
      if (!this.buffers.has('countdown') && now <= start) this.play(profile.go, { at: audioNow + (start - now) / 1000, group: 'round' });
      if (perm) for (const cue of cues) {
        const remaining = (start + cue - now) / 1000;
        if (remaining >= 0) this.play('permDemo', { at: audioNow + remaining, group: 'round' });
      }
    }
    const allowed = this.preferences.musicMode === 'on' || this.preferences.musicMode === 'auto' && musicOwner;
    if (!allowed || this.preferences.musicVolume === 0) {
      this.stopVoices(voice => voice.group === 'music');
      this.musicKey = null;
      return;
    }
    const baseId = profile.music;
    const urgencyId = profile.urgency;
    const musicKey = `${id}:${baseId}:${this.buffers.has(urgencyId)}:${rate}`;
    if (this.musicKey === musicKey || !this.buffers.has(baseId)) return;
    this.stopVoices(voice => voice.group === 'music');
    this.musicKey = musicKey;
    const elapsed = Math.max(0, (now - start) / 1000);
    const at = audioNow + Math.max(0, (start - now) / 1000);
    const audioEnd = audioNow + (end - now) / 1000;
    const base = this.buffers.get(baseId);
    this.source(baseId, { at, group: 'music', loop: true, offset: elapsed * rate % base.duration, end: audioEnd, rate });
    const beat = BEAT / rate;
    const urgencyBeat = Math.ceil(Math.max(0, (end - start - 10_000) / 1000) / beat) * beat;
    const urgentAt = Math.max(now, start + urgencyBeat * 1000);
    const urgency = this.buffers.get(urgencyId);
    if (urgency) this.source(urgencyId, {
      at: audioNow + (urgentAt - now) / 1000, group: 'music', loop: true,
      offset: ((urgentAt - start) / 1000 * rate) % urgency.duration, end: audioEnd, rate,
    });
  }

  setMenuScreen(active, musicOwner = true) {
    if (this.menu.active === active && this.menu.musicOwner === musicOwner) return;
    this.menu = { active, musicOwner };
    this.synchronizeMenu();
  }

  synchronizeMenu() {
    const allowed = this.preferences.musicMode === 'on' || this.preferences.musicMode === 'auto' && this.menu.musicOwner;
    if (!this.menu.active || !allowed || !this.enabled || this.preferences.musicVolume === 0 || this.previewing || this.context?.state !== 'running') {
      this.stopMenu();
      return;
    }
    if (this.menuPlaying) return;
    try {
      if (!this.menuMedia) {
        // Stream the full-length MP3 instead of retaining a decoded music buffer on every phone.
        this.menuMedia = this.createMedia();
        this.menuMedia.src = `${BASE_URL}audio/Background-ActionRock.mp3`;
        this.menuMedia.loop = true;
        this.menuMedia.preload = 'none';
        this.menuMedia.addEventListener('error', () => { this.menuPlaying = false; });
        this.menuGain = this.context.createGain();
        this.context.createMediaElementSource(this.menuMedia).connect(this.menuGain).connect(this.musicBus);
      }
      const request = ++this.menuRequest;
      this.menuPlaying = true;
      const at = this.context.currentTime;
      this.menuGain.gain.cancelScheduledValues(at);
      this.menuGain.gain.setValueAtTime(0, at);
      this.menuGain.gain.linearRampToValueAtTime(1, at + .15);
      Promise.resolve(this.menuMedia.play()).catch(() => {
        if (request === this.menuRequest) this.menuPlaying = false;
      });
    } catch {
      this.menuPlaying = false;
    }
  }

  stopMenu() {
    if (!this.menuPlaying) return;
    this.menuRequest++;
    this.menuPlaying = false;
    this.menuMedia?.pause();
  }

  stopVoice(voice, immediate = false) {
    if (voice.stopped) return;
    voice.stopped = true;
    const at = this.context.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(at);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
      voice.gain.gain.linearRampToValueAtTime(0, at + (immediate ? 0 : .025));
      voice.source.stop(at + (immediate ? 0 : .03));
    } catch {}
    this.voices.delete(voice);
  }

  stopVoices(predicate, immediate = false) {
    for (const voice of this.voices) if (predicate(voice)) this.stopVoice(voice, immediate);
  }

  stopRound() {
    this.target = null; this.musicKey = null; this.countdownKey = null;
    this.demonstrationKey = null; this.demonstrationNotes.clear();
    this.stopVoices(voice => voice.group === 'round' || voice.group === 'music' || voice.group === 'demonstration');
  }

  endPlayer() {
    if (this.target) this.target.playerDone = true;
    this.stopVoices(voice => voice.group === 'round' || voice.group === 'demonstration');
  }

  cancel() {
    this.buttonRequest++;
    this.menu.active = false;
    this.stopMenu();
    this.stopRound();
    this.stopPreview();
    this.stopVoices(() => true);
  }

  async preview(game = this.game) {
    if (this.target) return;
    this.selectGame(game);
    const request = ++this.previewRequest;
    this.previewing = true;
    this.stopMenu();
    this.setEnabled(true);
    if (!await this.unlock() || request !== this.previewRequest || !this.enabled || this.target) {
      if (request === this.previewRequest) this.stopPreview();
      return;
    }
    this.stopPreview(false);
    this.previewing = true;
    this.stopMenu();
    const at = this.context.currentTime + .03;
    if (this.preferences.musicMode !== 'off' && this.preferences.musicVolume > 0) this.source((PROFILES[game] || PROFILES['totem-shrinker']).music, { at, group: 'preview-music', loop: true, end: at + 8 });
    const cues = game === 'facial-slot-machine' ? [['slotGo', .3], ['slotLock', 1.1], ['slotMiss', 1.8], ['slotLock', 3], ['slotWin', 4.5]] : game === 'perm-mania' ? [['permDemo', .5], ['permDemo', .5 + BEAT], ['permDemo', .5 + BEAT * 2], ['permDemo', .5 + BEAT * 3], ['permHit', .5 + BEAT * 4], ['permHit', .5 + BEAT * 5], ['permHit', .5 + BEAT * 6], ['permHit', .5 + BEAT * 7], ['permGrow', .5 + BEAT * 8], ['finish', 6.3]] : [['red', .5], ['green', .8], ['blue', 1.1], ['mistake', 1.6], ['finish', 7.2]];
    if (!['facial-slot-machine', 'perm-mania'].includes(game)) this.source('countdown', { at: at + 2.5, group: 'preview-effects' });
    for (const [id, delay] of cues) this.play(id, { at: at + delay, group: 'preview-effects' });
    this.onChange();
  }

  stopPreview(invalidate = true) {
    if (invalidate) this.previewRequest++;
    this.stopVoices(voice => voice.group.startsWith('preview-'));
    this.previewing = false;
    if (invalidate) this.synchronizeMenu();
    this.onChange();
  }
}
