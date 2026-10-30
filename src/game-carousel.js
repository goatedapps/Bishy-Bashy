import { gsap } from 'gsap';
import { isRoundActive } from '../shared/games.js';
import './game-carousel.css';

export class GameCarousel {
  constructor(onChoose) {
    this.onChoose = onChoose;
    this.track = document.getElementById('game-picker');
    this.originals = [...this.track.children];
    this.originals.forEach(card => { card.dataset.copy = '1'; });
    const copies = copy => this.originals.map(card => {
      const clone = card.cloneNode(true);
      clone.dataset.copy = String(copy);
      return clone;
    });
    this.track.prepend(...copies(0));
    this.track.append(...copies(2));
    this.cards = [...this.track.children];
    this.active = false;
    this.canChoose = false;
    this.selected = null;
    this.center = null;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.shell = document.createElement('div');
    this.shell.className = 'game-carousel';
    this.shell.setAttribute('role', 'region');
    this.shell.setAttribute('aria-roledescription', 'carousel');
    this.shell.setAttribute('aria-label', 'Game posters');
    this.track.before(this.shell);
    this.previous = this.arrow('Previous game', '‹', -1);
    this.next = this.arrow('Next game', '›', 1);
    this.shell.append(this.previous, this.track, this.next);
    this.footer = document.createElement('div');
    this.footer.className = 'carousel-footer';
    this.position = document.createElement('span');
    this.position.setAttribute('role', 'status');
    this.note = document.createElement('span');
    this.note.className = 'carousel-host-note';
    this.footer.append(this.position, this.note);
    this.shell.after(this.footer);
    this.track.addEventListener('scroll', () => {
      if (!this.active) return;
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        if (this.drag) this.recenter(this.nearest());
        this.paint();
      });
      this.scheduleSettle();
    }, { passive: true });
    this.track.addEventListener('scrollend', () => this.settle());
    this.track.addEventListener('click', event => {
      const card = event.target.closest('.game-choice');
      if (!this.canChoose || !card || performance.now() < this.suppressClickUntil) return;
      this.programmatic = null;
      this.goTo(card, false);
      this.scheduleSettle();
    });
    this.track.addEventListener('keydown', event => {
      if (!this.canChoose || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const cards = this.visibleCards();
      const index = cards.indexOf(this.nearest());
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : 1);
      this.goTo(cards[(target + cards.length) % cards.length], false);
    });
    this.track.addEventListener('pointerdown', event => {
      if (this.canChoose) this.programmatic = null;
      if (!this.canChoose || event.button !== 0 || event.pointerType !== 'mouse') return;
      this.drag = { id: event.pointerId, start: event.clientX, left: this.track.scrollLeft, x: event.clientX, at: performance.now(), velocity: 0, moved: false };
      this.programmatic = null;
      clearTimeout(this.settleTimer);
    });
    this.track.addEventListener('pointermove', event => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.moved && Math.abs(event.clientX - drag.start) < 6) return;
      if (!drag.moved) {
        drag.moved = true;
        this.track.classList.add('is-dragging');
        this.track.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      const now = performance.now();
      drag.velocity = (drag.x - event.clientX) / Math.max(1, now - drag.at);
      drag.x = event.clientX; drag.at = now;
      this.track.scrollLeft = drag.left + drag.start - event.clientX;
    });
    const release = event => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      this.drag = null;
      this.track.classList.remove('is-dragging');
      if (this.track.hasPointerCapture(event.pointerId)) this.track.releasePointerCapture(event.pointerId);
      if (!drag.moved) return;
      this.suppressClickUntil = performance.now() + 350;
      const velocity = event.type === 'pointercancel' || performance.now() - drag.at > 100 ? 0 : drag.velocity;
      const momentum = Math.max(-this.track.clientWidth * 1.5, Math.min(this.track.clientWidth * 1.5, velocity * 150));
      this.goTo(this.nearest(this.track.scrollLeft + momentum), false);
    };
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    this.track.addEventListener('wheel', () => { if (this.canChoose) this.programmatic = null; }, { passive: true });
    this.track.addEventListener('dragstart', event => event.preventDefault());
    this.observer = new ResizeObserver(() => {
      if (this.active) this.goTo(this.originals.find(card => card.dataset.game === this.selected && !card.hidden) || this.visibleCards()[0], true, false);
    });
    this.observer.observe(this.track);
    this.reduced.addEventListener('change', () => this.animateCenter());
    document.addEventListener('visibilitychange', () => this.syncPlayback());
    document.addEventListener('focusin', () => this.syncPlayback());
  }

  arrow(label, text, direction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'carousel-arrow';
    button.setAttribute('aria-label', label);
    button.textContent = text;
    button.addEventListener('click', () => {
      if (!this.canChoose) return;
      const cards = this.visibleCards();
      this.goTo(cards[(cards.indexOf(this.nearest()) + direction + cards.length) % cards.length], false);
    });
    return button;
  }

  visibleCards() { return this.cards.filter(card => !card.hidden); }

  confirmSelection() {
    if (!this.active || !this.canChoose) return;
    const card = this.nearest();
    if (card && card.dataset.game !== this.selected) this.onChoose(card.dataset.game);
  }

  recenter(card) {
    if (!card || card.dataset.copy === '1') return card;
    const original = this.originals.find(item => item.dataset.game === card.dataset.game);
    const shift = original.offsetLeft - card.offsetLeft;
    this.track.scrollLeft += shift;
    if (this.drag) this.drag.left += shift;
    return original;
  }

  nearest(left = this.track.scrollLeft) {
    const middle = left + this.track.clientWidth / 2;
    return this.visibleCards().reduce((nearest, card) => !nearest || Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle) < Math.abs(nearest.offsetLeft + nearest.offsetWidth / 2 - middle) ? card : nearest, null);
  }

  goTo(card, programmatic, smooth = true) {
    if (!card || !this.active || !this.track.clientWidth) return;
    this.programmatic = programmatic ? card.dataset.game : null;
    this.track.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - this.track.clientWidth / 2, behavior: smooth && !this.reduced.matches ? 'smooth' : 'auto' });
    this.paint();
    this.scheduleSettle();
  }

  scheduleSettle() {
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.settle(), 180);
  }

  settle() {
    if (!this.active || this.drag) return;
    let card = this.nearest();
    if (!card) return;
    const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - this.track.clientWidth / 2 - this.track.scrollLeft);
    if (distance > 2) return;
    card = this.recenter(card);
    this.paint();
    if (this.programmatic || !this.canChoose) return;
    if (card.dataset.game !== this.selected && card.dataset.game !== this.submitted) {
      this.submitted = card.dataset.game;
      this.onChoose(card.dataset.game);
    }
  }

  paint() {
    const center = this.nearest();
    const visible = this.visibleCards();
    const index = visible.indexOf(center);
    this.cards.forEach(card => {
      card.classList.toggle('is-center', card === center);
      card.classList.toggle('is-before', visible.indexOf(card) < index);
      card.tabIndex = this.canChoose && card === center ? 0 : -1;
      card.setAttribute('aria-hidden', String(card !== center));
    });
    const games = this.originals.filter(card => !card.hidden);
    this.previous.disabled = this.next.disabled = !this.canChoose || games.length < 2;
    const position = `${games.findIndex(card => card.dataset.game === center?.dataset.game) + 1} / ${games.length}`;
    if (this.position.textContent !== position) this.position.textContent = position;
    if (center !== this.center) {
      this.center = center;
      this.animateCenter();
    }
  }

  stopIdle() {
    this.idle?.kill();
    if (this.animatedArt) gsap.set(this.animatedArt, { clearProps: 'transform' });
    this.animatedArt = null;
    this.idle = null;
  }

  animateCenter() {
    this.stopIdle();
    if (!this.active || this.reduced.matches || !this.center) return;
    this.animatedArt = this.center.querySelector('.game-art');
    this.idle = gsap.timeline({ repeat: -1, repeatDelay: 0.8 })
      .to(this.animatedArt, { y: -18, rotation: -7, scaleX: 0.88, scaleY: 1.12, duration: 0.35, ease: 'power2.out' })
      .to(this.animatedArt, { y: 0, rotation: 4, scaleX: 1.16, scaleY: 0.8, duration: 0.25, ease: 'power2.in' })
      .to(this.animatedArt, { rotation: 0, scaleX: 1, scaleY: 1, duration: 0.3, ease: 'back.out(2)' });
    this.syncPlayback();
  }

  syncPlayback() {
    this.idle?.paused(document.hidden || Boolean(document.querySelector('dialog[open]')));
  }

  filterChanged() {
    clearTimeout(this.filterTimer);
    clearTimeout(this.settleTimer);
    if (!this.active) return;
    const matches = this.originals.filter(card => !card.hidden);
    this.cards.filter(card => card.dataset.copy !== '1').forEach(card => {
      card.hidden = matches.length < 2 || !matches.some(original => original.dataset.game === card.dataset.game);
    });
    const card = this.originals.find(item => item.dataset.game === this.selected && !item.hidden) || matches[0];
    this.goTo(card, true, false);
    this.paint();
    this.filterTimer = setTimeout(() => {
      if (!this.active || !this.canChoose || !card || card.hidden) return;
      this.programmatic = null;
      this.submitted = null;
      this.settle();
    }, 250);
  }

  render(room, playerId) {
    const active = Boolean(room && !room.set && !isRoundActive(room.round) && room.mode === 'game-select' && room.gameChoosing);
    const entered = active && !this.active;
    const permissionsChanged = this.canChoose !== (active && room.hostId === playerId);
    this.active = active;
    this.canChoose = active && room.hostId === playerId;
    document.getElementById('game-search').disabled = !this.canChoose;
    this.shell.classList.toggle('is-readonly', !this.canChoose);
    this.track.tabIndex = this.canChoose ? 0 : -1;
    this.note.textContent = this.canChoose ? '' : 'Host is choosing';
    if (!active) {
      clearTimeout(this.filterTimer); clearTimeout(this.settleTimer);
      cancelAnimationFrame(this.frame);
      this.drag = null;
      this.track.classList.remove('is-dragging');
      this.stopIdle();
      return;
    }
    if (this.roomCode !== room.code) {
      this.roomCode = room.code;
      document.getElementById('game-search').value = '';
      this.cards.forEach(card => { card.hidden = false; });
      document.getElementById('game-empty').hidden = true;
    }
    if (entered || permissionsChanged || this.selected !== room.selectedGame) {
      this.drag = null;
      this.track.classList.remove('is-dragging');
      this.selected = room.selectedGame;
      this.submitted = null;
      const selected = this.originals.find(card => card.dataset.game === this.selected);
      if (!this.canChoose && selected?.hidden) {
        document.getElementById('game-search').value = '';
        this.cards.forEach(card => { card.hidden = false; });
        document.getElementById('game-empty').hidden = true;
      }
      this.goTo(selected?.hidden ? this.visibleCards()[0] : selected, true, !entered);
    }
    this.paint();
    if (!this.idle && !this.reduced.matches) this.animateCenter();
    this.syncPlayback();
  }
}
