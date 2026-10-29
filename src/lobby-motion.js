import { gsap } from 'gsap';
import { isRoundActive } from '../shared/games.js';
import { gameArt } from './game-art.js';
import './lobby.css';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const MASCOTS = ['jump-for-the-meat', 'mimicking-monkeys', 'facing-which-way', 'dice-dice-more-dice'];

export class LobbyMotion {
  constructor() {
    this.active = false;
    this.players = [];
    this.modeLoops = [];
    this.dances = [];
    this.arrivals = [];
    this.decor = node('div', 'lobby-confetti');
    this.decor.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 10; index++) {
      const piece = node('span', '', ['★', '●', '▲', '◆'][index % 4]);
      piece.style.setProperty('--piece', index);
      piece.style.left = `${3 + index * 37 % 94}%`;
      this.decor.append(piece);
    }
    document.body.prepend(this.decor);
    const arcade = document.querySelector('.arcade-card');
    const visual = node('span', 'lobby-mode-visual');
    visual.setAttribute('aria-hidden', 'true');
    const cabinet = node('span', 'lobby-cabinet');
    const lamps = node('span', 'lobby-cabinet-lamps');
    lamps.append(...Array.from({ length: 8 }, () => node('i', '')));
    const screen = node('span', 'lobby-cabinet-screen');
    screen.append(...MASCOTS.slice(0, 3).map(gameArt));
    const deck = node('span', 'lobby-cabinet-deck');
    deck.append(node('i', 'lobby-joystick'), ...Array.from({ length: 3 }, () => node('i', 'lobby-mini-button')));
    cabinet.append(lamps, screen, deck);
    visual.append(cabinet);
    arcade.prepend(visual);
    const fan = node('span', 'lobby-mode-visual lobby-fan');
    fan.setAttribute('aria-hidden', 'true');
    for (const game of ['burger-girl', 'dice-dice-more-dice', 'mimicking-monkeys']) {
      const card = node('span', 'lobby-fan-card');
      card.append(gameArt(game));
      fan.append(card);
    }
    document.querySelector('.select-card').prepend(fan);
    this.seats = [...document.querySelectorAll('#player-lanes .lane')].map((lane, index) => {
      const stage = node('div', 'lobby-seat-stage');
      stage.setAttribute('aria-hidden', 'true');
      const ring = node('span', 'lobby-open-ring');
      const avatar = node('span', 'lobby-avatar');
      const shadow = node('span', 'lobby-avatar-shadow');
      const burst = node('span', 'lobby-join-burst');
      burst.append(...Array.from({ length: 6 }, () => node('i', '', '★')));
      avatar.append(gameArt(MASCOTS[index]));
      stage.append(ring, shadow, avatar, burst);
      lane.insertBefore(stage, lane.querySelector('.tower-zone'));
      return { lane, stage, avatar, shadow, burst };
    });
    this.syncPlayback = () => {
      const quiet = document.hidden || Boolean(document.querySelector('dialog[open]'));
      if (quiet && this.entrance?.progress() < 1) this.entrance.progress(1);
      this.ambient?.paused(quiet);
      this.lamps?.paused(quiet);
      this.modeLoops.forEach(loop => loop.paused(quiet));
      this.dances.forEach((dance, index) => dance.paused(quiet || !this.players[index]?.connected));
      this.arrivals.forEach(arrival => { if (quiet && arrival.isActive()) arrival.progress(1); });
    };
    document.addEventListener('visibilitychange', this.syncPlayback);
    document.addEventListener('focusin', this.syncPlayback);
  }

  render(room) {
    const active = Boolean(room && !room.set && !isRoundActive(room.round));
    document.body.classList.toggle('is-lobby', active);
    if (active !== this.active) {
      this.active = active;
      this.media?.revert();
      this.entrance = this.ambient = this.lamps = null;
      this.modeLoops = []; this.dances = []; this.arrivals = [];
      this.seatIds = []; this.mode = null;
      if (active) this.startMotion();
    }
    if (!active) return;
    this.players = room.players;
    this.seats.forEach((seat, index) => {
      const player = this.players[index];
      seat.stage.classList.toggle('is-occupied', Boolean(player));
      seat.stage.classList.toggle('is-reconnecting', Boolean(player && !player.connected));
      if (player?.id && player.id !== this.seatIds[index]) this.arrivals[index]?.restart();
      this.seatIds[index] = player?.id;
    });
    if (this.mode !== room.mode) {
      if (this.mode) this.selections?.[room.mode]?.restart();
      this.mode = room.mode;
      this.lamps?.timeScale(room.mode === 'arcade' ? 1.15 : 0.7);
      this.modeLoops.forEach((loop, index) => loop.timeScale((index === 0) === (room.mode === 'arcade') ? 1.15 : 0.7));
    }
    this.syncPlayback();
  }

  startMotion() {
    this.media = gsap.matchMedia();
    this.media.add({ motion: '(prefers-reduced-motion: no-preference)', compact: '(max-width: 620px)' }, context => {
      if (!context.conditions.motion) return;
      const compact = context.conditions.compact;
      this.entrance = gsap.timeline()
        .from('.mode-card', { x: index => index ? 45 : -45, y: 20, rotation: index => index ? 4 : -4, opacity: 0, duration: 0.65, stagger: 0.12, ease: 'back.out(2)', clearProps: 'transform,opacity' })
        .from('#play-view', { y: 18, opacity: 0, duration: 0.35, clearProps: 'transform,opacity' }, 0.3);
      this.ambient = gsap.timeline({ repeat: -1, yoyo: true })
        .to('.lobby-confetti span', { y: index => index % 2 ? -25 : 30, rotation: index => index % 2 ? 35 : -35, duration: 3, stagger: 0.12, ease: 'sine.inOut' }, 0)
        .to('.lobby-open-ring', { rotation: 180, duration: 5, ease: 'none' }, 0);
      this.lamps = gsap.to('.lobby-cabinet-lamps i', { opacity: 0.25, scale: 0.7, duration: 0.32, stagger: { each: 0.09, repeat: -1, yoyo: true }, ease: 'sine.inOut' });
      const cabinet = gsap.timeline({ repeat: -1 });
      const portraits = [...document.querySelectorAll('.lobby-cabinet-screen > .game-art')];
      portraits.forEach((art, index) => {
        cabinet.set(portraits, { opacity: 0 }, index * 1.2)
          .fromTo(art, { y: 22, rotation: -9, scale: 0.65, opacity: 0 }, { y: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.38, ease: 'back.out(2.5)', immediateRender: false }, index * 1.2)
          .to(art, { y: -8, duration: 0.2, repeat: 1, yoyo: true }, index * 1.2 + 0.65);
      });
      cabinet.to('.lobby-joystick', { rotation: -23, duration: 0.18, repeat: 3, yoyo: true }, 0.45);
      const cards = document.querySelectorAll('.lobby-fan-card');
      const spread = compact ? 28 : 43;
      const fan = gsap.timeline({ repeat: -1, repeatDelay: 0.65 })
        .to(cards, { x: index => (index - 1) * spread, rotation: index => (index - 1) * 20, y: index => index === 1 ? -18 : 0, duration: 0.55, ease: 'back.out(2)' })
        .to('.lobby-fan-card:last-child .game-art', { y: -18, scaleX: 0.86, scaleY: 1.14, duration: 0.25, ease: 'power2.out' })
        .to('.lobby-fan-card:last-child .game-art', { y: 0, scaleX: 1.16, scaleY: 0.8, duration: 0.2, ease: 'power2.in' })
        .to('.lobby-fan-card:last-child .game-art', { scaleX: 1, scaleY: 1, duration: 0.2 })
        .to(cards, { x: index => (index - 1) * 9, y: 0, rotation: index => (index - 1) * 5, duration: 0.4, ease: 'power2.inOut' }, '+=0.5');
      this.modeLoops = [cabinet, fan];
      this.selections = Object.fromEntries(['arcade', 'game-select'].map(mode => [mode,
        gsap.timeline({ paused: true }).to(`[data-mode="${mode}"] .lobby-mode-visual`, { scale: 1.12, duration: 0.15, repeat: 1, yoyo: true, ease: 'power2.out' }),
      ]));
      this.seats.forEach((seat, index) => {
        const art = seat.avatar.querySelector('.game-art');
        const height = compact ? 22 : 36;
        const dance = gsap.timeline({ repeat: -1, repeatDelay: 0.65 + index * 0.15, delay: 0.3 + index * 0.3 })
          .to(art, { scaleX: 1.2, scaleY: 0.76, rotation: 5, duration: 0.18 })
          .to(art, { y: -height, rotation: [-12, 13, -9, 16][index], scaleX: 0.87, scaleY: 1.15, duration: 0.3, ease: 'power2.out' })
          .to(art, { y: 0, rotation: -5, scaleX: 1.25, scaleY: 0.73, duration: 0.25, ease: 'power2.in' })
          .to(art, { scaleX: 1, scaleY: 1, rotation: 0, duration: 0.22, ease: 'back.out(2)' })
          .to(art, { rotation: index % 2 ? -10 : 10, x: index % 2 ? 5 : -5, duration: 0.22, repeat: 1, yoyo: true });
        dance.fromTo(seat.shadow, { scale: 1, opacity: 0.22 }, { scale: 0.6, opacity: 0.1, duration: 0.3, repeat: 1, yoyo: true, immediateRender: false }, 0.18);
        this.dances.push(dance);
        const arrival = gsap.timeline({ paused: true })
          .fromTo(seat.avatar, { y: -65, scaleX: 0.8, scaleY: 1.2, opacity: 0 }, { y: 0, scaleX: 1.22, scaleY: 0.76, opacity: 1, duration: 0.38, ease: 'power2.in' })
          .to(seat.avatar, { scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1,0.4)' })
          .fromTo(seat.burst.children, { x: 0, y: 0, opacity: 1, scale: 0.5 }, { x: i => Math.cos(i * Math.PI / 3) * (compact ? 27 : 45), y: i => Math.sin(i * Math.PI / 3) * (compact ? 27 : 45) - 10, opacity: 0, scale: 1.1, rotation: 90, duration: 0.55, immediateRender: false }, 0.35);
        this.arrivals.push(arrival);
      });
      this.seatIds = [];
      this.mode = null;
      return () => {
        this.modeLoops = []; this.dances = []; this.arrivals = [];
        this.entrance = this.ambient = this.lamps = this.selections = null;
      };
    });
  }
}
