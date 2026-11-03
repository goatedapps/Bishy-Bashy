import { createWitchGauge } from './witch-gauge.js';
import { WitchRun, replayWitch, witchPose, WITCH_ROAD, FROG_SPACING, WITCH_GOAL, WITCH_GRAVITY, WITCH_THROW_SCALE, witchFlight } from '../shared/witch.js';
import { characterPortrait } from './characters.js';
const node = (tag, className, text) => {
  const element = document.createElement(tag); element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
export function witchPortrait(kind = 'witch') {
  const element = node('span', `witch-sprite witch-${kind}`);
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', { witch: 'Apprentice witch', frog: 'Frog', prince: 'Transformed prince', puff: 'Colorful magic', broom: 'Broom with a potion', potion: 'Flying potion' }[kind]);
  return element;
}
export class WitchStage {
  constructor() {
    this.element = node('section', 'witch-stage');
    this.scene = node('div', 'witch-scene');
    this.village = node('div', 'witch-village'); this.village.setAttribute('aria-hidden', 'true');
    this.hud = node('div', 'witch-hud');
    this.speed = node('strong', 'witch-speed'); this.gauge = createWitchGauge();
    this.hud.append(this.gauge.element);
    this.hud.hidden = this.speed.hidden = true;
    this.roof = node('div', 'witch-roof'); this.roof.append(node('span', 'witch-edge', 'EDGE'));
    this.actor = witchPortrait(); this.broom = witchPortrait('broom'); this.potion = witchPortrait('potion');
    this.prince = witchPortrait('prince'); this.puff = witchPortrait('puff');
    this.frogs = Array.from({ length: 128 }, () => witchPortrait('frog'));
    this.flightCount = node('div', 'witch-flight-count'); this.flightCount.hidden = true;
    this.flightCount.setAttribute('aria-live', 'off');
    this.flightNumber = node('strong', ''); this.flightCount.append(this.flightNumber, node('span', '', 'frogs passed'));
    this.caption = node('strong', 'witch-caption'); this.caption.setAttribute('role', 'status');
    this.scene.append(this.village, this.roof, ...this.frogs, this.actor, this.broom, this.potion, this.prince, this.puff, this.speed, this.hud, this.flightCount, this.caption);
    this.element.append(this.scene);
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (globalThis.ResizeObserver) {
      this.resize = new ResizeObserver(() => {
        if (this.lastRender && this.scene.clientWidth > 0 && this.scene.clientHeight > 0) this.render(...this.lastRender);
      });
      this.resize.observe(this.scene);
    }
  }
  render(round, source, time) {
    this.lastRender = [round, source, time];
    if (this.scene.clientWidth === 0 || this.scene.clientHeight === 0) { this.hud.hidden = this.speed.hidden = this.flightCount.hidden = true; return; }
    const run = source ? witchPose(source, time) : new WitchRun({}, time);
    const width = this.scene.clientWidth || 800, height = this.scene.clientHeight || 400;
    const baseline = height * .1;
    const flight = run.launchAt !== null;
    const velocity = run.power * WITCH_THROW_SCALE;
    const vertical = velocity * Math.sin(run.angle * Math.PI / 180);
    const apex = (run.launchHeight || 34) + vertical * vertical / (2 * WITCH_GRAVITY);
    const runUnit = Math.min(width / 110, height / 80), flightUnit = Math.min(width / 140, (height - baseline - 12) / Math.max(150, apex + 14));
    const zoomProgress = flight ? Math.min(1, Math.max(0, (time - run.launchAt) / 350)) : 0;
    const zoom = this.motion?.matches ? Number(flight) : 1 - (1 - zoomProgress) ** 3;
    const unit = runUnit + (flightUnit - runUnit) * zoom;
    const path = witchFlight(run, time);
    const potionX = path?.x ?? run.x + 16;
    const potionY = path?.y ?? 34;
    this.flightCount.hidden = !['fly', 'land'].includes(run.state);
    this.flightNumber.textContent = String(path?.passed ?? 0);
    const focus = flight ? potionX : run.x, camera = Math.max(-30, focus - width / unit * .35);
    const place = (element, x, y, size) => {
      element.style.left = `${(x - camera) * unit}px`; element.style.bottom = `${baseline + y * unit}px`;
      element.style.width = `${size * unit}px`; element.style.height = `${size * unit}px`;
    };
    this.speed.textContent = `${['aim', 'fly', 'land'].includes(run.state) ? 'Run speed' : 'Speed'} ${(['aim', 'fly', 'land'].includes(run.state) ? run.power : run.speed).toFixed(1)}`;
    this.gauge.update(run.angle);
    const hudWidth = Math.min(142, Math.max(105, width * .16), Math.max(56, (height - 36) * .72));
    this.hud.style.width = this.speed.style.width = `${hudWidth}px`;
    this.speed.style.fontSize = `${Math.max(8, Math.min(15, hudWidth / 9.5))}px`;
    const edgeX = (WITCH_ROAD - camera) * unit;
    this.hud.style.left = `${Math.max(8, Math.min(width - hudWidth - 8, edgeX + 12 * unit + 12))}px`;
    this.hud.style.bottom = `${Math.max(4, Math.min(baseline + 14 * unit, height - hudWidth * 136 / 132 - 8))}px`;
    this.speed.style.left = `${Math.max(8, Math.min(width - hudWidth - 8, (run.x - camera) * unit - hudWidth / 2))}px`;
    this.speed.style.bottom = `${Math.min(height - 25, baseline + 55 * unit)}px`;
    const hideReadings = flight || ['fall', 'failed'].includes(run.state);
    this.hud.hidden = hideReadings || edgeX < 0 || edgeX > width - 8;
    this.speed.hidden = hideReadings;
    const panoramaWidth = width * 2.8;
    const scroll = Math.min(panoramaWidth - width, Math.max(0, focus) * width / 110 * .3);
    this.village.style.backgroundSize = `${panoramaWidth}px auto`;
    this.village.style.backgroundPosition = `${-scroll}px bottom`;
    this.roof.style.left = `${-camera * unit}px`; this.roof.style.width = `${WITCH_ROAD * unit}px`;
    this.roof.style.bottom = `${baseline - 6 * unit}px`; this.roof.style.height = `${16 * unit}px`;
    const stepping = run.state === 'run' && !this.motion?.matches && Math.floor(time / Math.max(65, 200 - run.speed * 3)) % 2;
    this.actor.className = `witch-sprite witch-witch${stepping ? ' witch-stride' : ''}`;
    const fall = ['fall', 'failed'].includes(run.state) ? Math.min(1, Math.max(0, (time - (run.landAt || time) + 900) / 900)) : 0;
    place(this.actor, run.x - 22, 10 - fall * 35, 44);
    this.actor.hidden = flight && potionX - run.x > width / unit;
    place(this.broom, run.x - 20, 10, 43);
    this.broom.style.transform = `rotate(${-run.angle}deg)`;
    this.broom.hidden = fall > 0 || flight;
    place(this.potion, potionX - 5, potionY, 12);
    this.potion.hidden = !flight || run.state === 'land';
    const first = Math.max(0, Math.floor((camera - WITCH_ROAD) / FROG_SPACING) - 1);
    const landed = run.state === 'land';
    this.frogs.forEach((frog, slot) => {
      const index = first + slot, x = WITCH_ROAD + (index + 1) * FROG_SPACING;
      frog.hidden = index > (round.goal || WITCH_GOAL) || landed && index === run.cleared;
      place(frog, x - 7, 0, 14);
    });
    const rescue = run.state === 'failed' && run.failure === 'overrun';
    const age = landed || rescue ? time - run.landAt : Infinity;
    place(this.prince, run.targetX - 18, 0, 36);
    this.prince.hidden = !landed || age < 180;
    this.prince.style.opacity = String(Math.min(1, Math.max(0, (age - 180) / 220)));
    const pop = this.motion?.matches ? 1 : 1 + .25 * Math.sin(Math.min(1, age / 700) * Math.PI);
    this.prince.style.transform = `scale(${pop})`;
    place(this.puff, (rescue ? run.x : run.targetX) - 25, -2, 50);
    this.puff.hidden = !(landed || rescue) || age < 0 || age > 950;
    this.puff.style.opacity = String(Math.max(0, 1 - age / 950));
    this.puff.style.transform = `scale(${this.motion?.matches ? 1 : .65 + Math.min(1, age / 280) * .7})`;
    this.caption.textContent = run.failure === 'timeout' ? 'Spell time’s up!' : landed ? '' : run.state === 'failed' || run.state === 'fall' ? 'Off the roof! Magical rescue…' : run.state === 'aim' ? 'AIM' : run.state === 'fly' ? '' : 'RUN';
    this.scene.dataset.phase = run.state;
  }
  dispose() { this.resize?.disconnect(); }
}
export class WitchArena {
  constructor() {
    this.element = node('section', 'witch-arena'); this.header = node('h3', 'witch-turn-heading');
    this.stage = new WitchStage(); this.scores = node('div', 'witch-scores');
    this.seats = Array.from({ length: 4 }, () => {
      const element = node('div', 'witch-seat'), name = node('span', 'witch-seat-name'), score = node('strong', '');
      this.scores.append(element); return { element, name, score, character: null };
    });
    this.element.append(this.header, this.stage.element, this.scores);
  }
  render(room, playerId, local, time, serverTime) {
    const turn = room.round.witch;
    this.clockOffset = serverTime - time;
    if (!turn) return;
    const active = room.players.find(player => player.id === turn.playerId);
    this.header.textContent = `${active?.name || 'Departed player'}${turn.playerId === playerId ? ' · Your turn' : ' · Casting a spell'}`;
    let run, sceneTime;
    if (local?.turn === turn.index && local.run.actions.length) { run = local.run; sceneTime = time; }
    else {
      const key = `${room.round.id}/${turn.index}/${turn.scene.sample}`;
      if (key !== this.key) { this.key = key; this.remote = replayWitch(turn.scene.actions, turn.scene.sample); }
      run = this.remote;
      const elapsed = Math.max(0, serverTime - turn.startAt);
      sceneTime = run?.launchAt !== null || run?.done ? elapsed : Math.min(elapsed, turn.scene.sample + 500);
    }
    this.stage.render(room.round, run, sceneTime);
    if (active?.result && active.result.status !== 'finished') this.stage.caption.textContent = 'No throw · Next witch…';
    this.seats.forEach((seat, index) => {
      const player = room.players[index];
      if (player && seat.character !== player.characterId) {
        seat.element.replaceChildren(characterPortrait(player.characterId), seat.name, seat.score); seat.character = player.characterId;
      }
      seat.element.classList.toggle('active', player?.id === turn.playerId);
      seat.name.textContent = player?.name || 'Open spot';
      seat.score.textContent = !player ? '—' : player.result ? player.result.status === 'finished' ? `${player.result.cleared} frogs` : 'No throw' : player.id === turn.playerId ? 'Playing' : 'Waiting';
    });
  }
}
