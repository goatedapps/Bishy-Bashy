import { AUDIO_FILES, BEAT, audioAssetIds } from '../scripts/audio/score.js';
import { COUNTDOWN_MS } from '../shared/games.js';
import { ARCADE_AUDIO_FILES } from '../scripts/audio/arcade.js';

const BASE_URL = import.meta.env?.BASE_URL || '/';
const DEFAULTS = { musicMode: 'auto', musicVolume: .65, effectsVolume: .8 };
const MUSIC_MODES = ['auto', 'on', 'off'];
const MENU_TRACKS = { menu: 'Background-ActionRock.mp3', instructions: 'game-instructions.mp3' };
const MENU_TRACK_GAINS = { menu: 1, instructions: 2 };
const EXTRA_AUDIO_FILES = { wrong: 'wrong.mp3', buttonPress: 'Button-Press.mp3', gameplayPress: 'Punch-button.mp3', instructionReveal: 'how-to-play.wav', countdown: 'countdown.mp3', podiumWinner: 'podium-winner.mp3', wheelSpin: 'roulette.mp3', gameSelect: 'Game-select.mp3' };
const GAME_AUDIO_FILES = { 'perm-mania': { ding: 'Ding.mp3' }, 'mimicking-monkeys': { ding: 'Ding.mp3' }, 'its-raining-coins': { ding: 'Ding.mp3' }, 'dodge-or-die': { ding: 'Ding.mp3' }, 'fireworks-craze': { fireworkLaunch: 'Fireworks.mp3', ding: 'Ding.mp3' }, 'burger-girl': { ding: 'Ding.mp3' }, 'me-find-mistake': { ding: 'Ding.mp3' }, 'dice-dice-more-dice': { ding: 'Ding.mp3' }, 'facing-which-way': { ding: 'Ding.mp3' } };
const PROFILES = {
  'dice-dice-more-dice': { music: 'music', urgency: 'urgency', go: 'go' },
  'facing-which-way': { music: 'music', urgency: 'urgency', go: 'go' },
  'burger-girl': { music: 'music', urgency: 'urgency', go: 'go' },
  'me-find-mistake': { music: 'music', urgency: 'urgency', go: 'go' },
  'jump-for-the-meat': { music: 'music', urgency: 'urgency', go: 'go' },
  'mimicking-monkeys': { music: 'music', urgency: 'urgency', go: 'go' },
  'fireworks-craze': { music: 'music', urgency: 'urgency', go: 'go' },
  'totem-shrinker': { music: 'music', urgency: 'urgency', go: 'go' },
  'perm-mania': { music: 'permMusic', urgency: 'permUrgency', go: 'permGo' },
  'facial-slot-machine': { music: 'slotMusic', urgency: 'slotUrgency', go: 'slotGo' },
};
const createMenuMedia = () => {
  const media = document.createElement('audio');
  media.hidden = true;
  document.body.append(media);
  return media;
};
const clamp = value => Math.max(0, Math.min(1, value));

export class GameAudio {
  constructor({ storage = globalThis.localStorage, createContext = () => new AudioContext(), createMedia = createMenuMedia, mediaUrl = file => `${BASE_URL}audio/${file}`, now = () => performance.now(), fetchFile = (url, options) => fetch(url, options), onChange = () => {} } = {}) {
    this.storage = storage;
    this.createContext = createContext;
    this.createMedia = createMedia;
    this.mediaUrl = mediaUrl;
    this.wheel = null;
    this.menu = { active: false, musicOwner: true, podiumId: null, track: 'menu' };
    this.menuTracks = new Map();
    this.menuPlaying = false;
    this.menuRequest = 0;
    this.podium = null;
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
    this.turnKey = null;
    this.turnNotes = new Set();
    this.buttonRequest = 0;
    this.launchKey = null;
    this.launchVoice = null;
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
        this.stopPodium();
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
      const resume = this.context.state !== 'running' ? this.context.resume() : null;
      // Issue media.play() in the gesture's call stack, before awaiting resume or decoding.
      this.synchronizeMenu(true);
      if (resume) await resume;
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
    const extraFiles = { ...EXTRA_AUDIO_FILES, ...ARCADE_AUDIO_FILES, ...GAME_AUDIO_FILES[bank] };
    const missing = [...audioAssetIds(bank), ...Object.keys(extraFiles)].filter(id => !this.buffers.has(id)).map(id => [id, AUDIO_FILES[id] || extraFiles[id]]);
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
      this.stopPodium();
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
      if (group === 'podium' && this.podium?.voice === voice) {
        this.podium.voice = null;
        this.synchronizeMenu();
      }
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
    if (id === 'stageComplete') id = 'ding';
    if (id === 'stageWrong' || id === 'mistake' && ['mimicking-monkeys', 'facing-which-way', 'dice-dice-more-dice', 'me-find-mistake'].includes(game)) id = 'wrong';
    if (id === 'jumpPerfect') id = 'permGrow';
    if (id === 'hit') id = ['burger-girl', 'me-find-mistake', 'dice-dice-more-dice', 'facing-which-way', 'its-raining-coins', 'dodge-or-die'].includes(game) ? 'ding' : game === 'perm-mania' ? 'permHit' : ['red', 'green', 'blue'][color] || 'red';
    if (id === 'mistake' && game === 'perm-mania') id = 'permMiss';
    const voice = this.source(id, { at, group, rate: ['red', 'green', 'blue'].includes(id) ? 1 + clamp(progress) * .04 : 1 });
    if (voice && group === 'effects') {
      const time = Math.max(this.context.currentTime, at);
      this.duck.gain.cancelScheduledValues(time);
      this.duck.gain.setValueAtTime(this.duck.gain.value, time);
      this.duck.gain.linearRampToValueAtTime(['mistake', 'wrong'].includes(id) ? .4 : .66, time + .012);
      this.duck.gain.setTargetAtTime(1, time + .09, .06);
    }
  }

  pressButton(kind = 'menu') {
    if (!this.enabled || this.preferences.effectsVolume === 0) return;
    const id = kind === 'instructions' ? 'instructionReveal' : kind === 'gameplay' ? 'gameplayPress' : 'buttonPress';
    const request = ++this.buttonRequest;
    if (this.context?.state === 'running' && this.buffers.has(id)) {
      this.play(id);
      return;
    }
    const pressedAt = this.now();
    // A loading bank must not release a backlog of clicks or play stale feedback.
    this.unlock().then(ready => {
      if (ready && request === this.buttonRequest && this.now() - pressedAt < 250) this.play(id);
    });
  }

  spinWheel(id, elapsed, duration, game = this.game, landingId = null) {
    if (!id || !this.enabled || this.context?.state !== 'running' || this.preferences.effectsVolume === 0) {
      const keepLanding = !id && landingId && this.wheel?.id === landingId && this.enabled && this.context?.state === 'running' && this.preferences.effectsVolume > 0;
      this.stopVoices(voice => voice.group === 'wheel' && (!keepLanding || voice.id === 'wheelSpin'));
      return;
    }
    if (this.wheel?.id !== id) {
      this.stopVoices(voice => voice.group === 'wheel');
      this.wheel = { id, landed: false };
    }
    if (elapsed >= duration) {
      this.stopVoices(voice => voice.group === 'wheel' && voice.id === 'wheelSpin');
      if (!this.wheel.landed) {
        this.wheel.landed = true;
        if (elapsed - duration < 250) {
          const at = this.context.currentTime;
          this.source('gameSelect', { at, group: 'wheel', end: at + 2 });
          this.source(`gameVoice:${game}`, { at, group: 'wheel' });
          this.source('applause', { at, group: 'wheel' });
        }
      }
      return;
    }
    if ([...this.voices].some(voice => voice.group === 'wheel' && voice.id === 'wheelSpin')) return;
    const buffer = this.buffers.get('wheelSpin');
    if (!buffer) return;
    this.source('wheelSpin', { group: 'wheel', loop: true, offset: Math.max(0, elapsed / 1000) % buffer.duration, end: this.context.currentTime + (duration - Math.max(0, elapsed)) / 1000 });
  }

  announceGame(id, game, visible = true, tailId = null) {
    if (!id) {
      const keepTail = visible && tailId && this.announcement?.id === tailId;
      if (!keepTail) this.stopVoices(voice => voice.group === 'announcement');
      if (this.announcement) this.announcement.done = true;
      return false;
    }
    if (this.announcement?.id !== id) {
      this.stopVoices(voice => voice.group === 'announcement');
      this.announcement = { id, started: false, done: false };
    }
    const state = this.announcement;
    if (state.done) return true;
    if (!visible || !this.enabled || this.preferences.effectsVolume === 0 || this.context?.state !== 'running') {
      this.stopVoices(voice => voice.group === 'announcement');
      return state.done = true;
    }
    if (state.started) return state.done = ![...this.voices].some(voice => voice.group === 'announcement');
    if (!this.buffers.has(`gameVoice:${game}`) || !this.buffers.has('applause')) return this.loadFailed ? state.done = true : false;
    state.started = true;
    this.stopMenu();
    const at = this.context.currentTime;
    this.source(`gameVoice:${game}`, { at, group: 'announcement' });
    this.source('applause', { at, group: 'announcement' });
    return false;
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

  facingTurns(run) {
    const key = `${run.id}/${run.cleared}/${run.demoVersion}`;
    if (key !== this.turnKey) {
      this.stopVoices(voice => voice.group === 'facing-demo');
      this.turnKey = key;
      this.turnNotes.clear();
    }
    if (!this.enabled || this.preferences.effectsVolume === 0 || this.context?.state !== 'running' || this.target?.game !== 'facing-which-way' || this.target.id !== run.id || this.target.playerDone || run.done) return;
    const now = this.now();
    run.cues.forEach((cue, index) => {
      const remaining = cue.at - now;
      if (remaining < 0 || remaining > 150 || cue.at >= run.end || this.turnNotes.has(index)) return;
      const voice = this.source('slotLock', { at: this.context.currentTime + remaining / 1000, group: 'facing-demo' });
      if (voice) this.turnNotes.add(index);
    });
  }

  fireworkLaunch(run) {
    if (!this.enabled || this.preferences.effectsVolume === 0 || this.context?.state !== 'running' || this.target?.game !== 'fireworks-craze' || this.target.id !== run.id || this.target.playerDone || run.done) return;
    const key = `${run.id}/${run.index}/${run.launchedAt}`;
    if (this.launchKey !== key) {
      this.stopVoices(voice => voice.id === 'fireworkLaunch');
      this.launchKey = key;
      this.launchNotes = new Set();
    }
    for (const rocket of run.rockets) {
      const remaining = rocket.launchAt - this.now();
      if (rocket.hit || remaining > 150 || remaining < -100 || rocket.launchAt >= this.target.end || this.launchNotes.has(rocket.slot)) continue;
      const voice = this.source('fireworkLaunch', { at: this.context.currentTime + Math.max(0, remaining) / 1000, group: 'round' });
      if (voice) this.launchNotes.add(rocket.slot);
    }
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

  setMenuScreen(active, musicOwner = true, podiumId = null, track = 'menu') {
    if (this.menu.active === active && this.menu.musicOwner === musicOwner && this.menu.podiumId === podiumId && this.menu.track === track) return;
    if (this.menu.track !== track) this.stopMenu();
    this.menu = { active, musicOwner, podiumId, track };
    if (!active || podiumId !== this.podium?.id) this.stopPodium();
    if (podiumId && podiumId !== this.podium?.id) this.podium = { id: podiumId, played: false, voice: null };
    this.synchronizeMenu();
  }

  stopPodium() {
    const voice = this.podium?.voice;
    if (!voice) return;
    this.podium.voice = null;
    this.stopVoice(voice);
  }

  synchronizePodium() {
    if (!this.menu.active || !this.menu.podiumId || !this.enabled || this.context?.state !== 'running' || this.previewing || this.preferences.effectsVolume === 0) {
      this.stopPodium();
      return false;
    }
    if (this.podium.voice) return true;
    if (this.podium.played) return false;
    if (!this.buffers.has('podiumWinner')) {
      if (!this.loadFailed) return true;
      this.podium.played = true;
      return false;
    }
    this.stopMenu();
    const voice = this.source('podiumWinner', { group: 'podium' });
    if (voice) { this.podium.voice = voice; this.podium.played = true; }
    return Boolean(voice);
  }

  synchronizeMenu(fromGesture = false) {
    const podiumPlaying = this.synchronizePodium();
    const allowed = this.preferences.musicMode === 'on' || this.preferences.musicMode === 'auto' && this.menu.musicOwner;
    if (podiumPlaying || !this.menu.active || !allowed || !this.enabled || this.preferences.musicVolume === 0 || this.previewing || !this.context || !fromGesture && this.context.state !== 'running') {
      this.stopMenu();
      return;
    }
    if (this.menuPlaying) return;
    try {
      const trackId = this.menu.track;
      if (!this.menuMedia) {
        // One gesture-authorized element survives track changes on tablet browsers.
        this.menuMedia = this.createMedia();
        this.menuMedia.loop = true;
        this.menuMedia.preload = 'auto';
        this.menuMedia.addEventListener('error', () => { this.menuPlaying = false; });
        this.menuMedia.addEventListener('loadedmetadata', () => {
          if (this.menuSeek !== null) {
            try { this.menuMedia.currentTime = this.menuSeek; this.menuSeek = null; } catch {}
          }
        });
        this.menuGain = this.context.createGain();
        this.context.createMediaElementSource(this.menuMedia).connect(this.menuGain).connect(this.musicBus);
      }
      if (this.menuMediaTrack !== trackId) {
        this.menuMediaTrack = trackId;
        this.menuMedia.src = this.mediaUrl(MENU_TRACKS[trackId] || MENU_TRACKS.menu);
        this.menuSeek = this.menuTracks.get(trackId) || 0;
        try { this.menuMedia.currentTime = this.menuSeek; } catch {}
      }
      const request = ++this.menuRequest;
      this.menuPlaying = true;
      const at = this.context.currentTime;
      this.menuGain.gain.cancelScheduledValues(at);
      this.menuGain.gain.setValueAtTime(0, at);
      this.menuGain.gain.linearRampToValueAtTime(MENU_TRACK_GAINS[trackId] || 1, at + .15);
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
    if (this.menuMedia) this.menuTracks.set(this.menuMediaTrack, this.menuMedia.currentTime);
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
    this.launchKey = null; this.launchVoice = null;
    this.target = null; this.musicKey = null; this.countdownKey = null;
    this.demonstrationKey = null; this.demonstrationNotes.clear();
    this.turnKey = null; this.turnNotes.clear();
    this.stopVoices(voice => voice.group === 'round' || voice.group === 'music' || voice.group === 'demonstration' || voice.group === 'facing-demo');
  }

  endPlayer() {
    if (this.target) this.target.playerDone = true;
    this.stopVoices(voice => voice.group === 'round' || voice.group === 'demonstration' || voice.group === 'facing-demo');
  }

  cancel() {
    this.announceGame(null);
    this.buttonRequest++;
    this.menu.active = false;
    this.stopPodium();
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
    const cues = game === 'facial-slot-machine' ? [['slotGo', .3], ['slotLock', 1.1], ['slotMiss', 1.8], ['slotLock', 3], ['slotWin', 4.5]] : game === 'perm-mania' ? [['permDemo', .5], ['permDemo', .5 + BEAT], ['permDemo', .5 + BEAT * 2], ['permDemo', .5 + BEAT * 3], ['permHit', .5 + BEAT * 4], ['permHit', .5 + BEAT * 5], ['permHit', .5 + BEAT * 6], ['permHit', .5 + BEAT * 7], ['stageComplete', .5 + BEAT * 8], ['finish', 6.3]] : [['red', .5], ['green', .8], ['blue', 1.1], ['mistake', 1.6], ['finish', 7.2]];
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
