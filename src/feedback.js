const COLORS = ['#f16a75', '#56bf88', '#65aaf1'];
const POP = [
  { scale: '1' },
  { scale: '1.14 .9', offset: .25 },
  { scale: '.97 1.05', offset: .65 },
  { scale: '1' },
];

// One animation per element; replacing a burst cancels it instead of accumulating work.
export class GameFeedback {
  constructor() {
    this.animations = new Map();
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.motion?.addEventListener('change', () => this.clear());
  }

  clear() {
    for (const animation of this.animations.values()) animation.cancel();
    this.animations.clear();
  }

  animate(element, frames, duration = 260) {
    if (!element?.animate || this.motion?.matches) return;
    this.animations.get(element)?.cancel();
    const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.16,.7,.3,1)' });
    this.animations.set(element, animation);
    const release = () => {
      if (this.animations.get(element) === animation) this.animations.delete(element);
    };
    animation.onfinish = release;
    animation.oncancel = release;
  }

  update(round, local, lane, time) {
    const run = local?.run;
    if (!run || !lane || round?.id !== local.id || round.phase === 'results' || document.hidden) {
      this.clear();
      this.run = null;
      return;
    }
    const snapshot = {
      cleared: run.cleared, mistakes: run.mistakes, feedback: run.feedback,
      mask: run.reelMask || 0, finished: local.done && local.status === 'finished',
    };
    if (this.run !== run) {
      this.clear();
      this.run = run;
      this.previous = snapshot;
      return;
    }
    const previous = this.previous;
    this.previous = snapshot;
    const gained = snapshot.cleared > previous.cleared;
    const missed = snapshot.mistakes > previous.mistakes;
    const feedback = snapshot.feedback !== previous.feedback && time - snapshot.feedback?.at < 200 ? snapshot.feedback : null;
    const finished = snapshot.finished && !previous.finished;
    if (!gained && !missed && !feedback && !finished) return;
    const game = round.game;
    const color = feedback?.color ?? (game === 'totem-shrinker' ? run.sequence[run.cleared - 1] : undefined);
    const perfect = feedback?.perfect || feedback?.kind === 'Perfect!';
    lane.effects.style.setProperty('--feedback-color', finished || perfect ? '#e7b33f' : missed ? '#cf6574' : COLORS[color] || '#58b786');
    lane.effects.dataset.game = game;

    if (finished || gained) this.animate(lane.remaining, POP, finished ? 420 : 260);
    if (game === 'facial-slot-machine') {
      lane.slots.reels.forEach((reel, index) => {
        if ((snapshot.mask & ~previous.mask) & (1 << index)) this.animate(reel.badge, POP, 340);
      });
    }
    if (game === 'perm-mania' && (gained || feedback && !missed)) {
      this.animate(lane.avatar.querySelector('.perm-dancer'), POP, gained ? 380 : 180);
    }
    if (game === 'mimicking-monkeys' && feedback?.kind === 'hit' && run.phase(time).mode === 'play') {
      this.animate(lane.monkeys.dots[run.entered - 1], POP, 180);
    }
    if (game === 'its-raining-coins' && gained) this.animate(lane.coins.sprite, POP, 220);
    if (game === 'dodge-or-die' && gained) this.animate(lane.dodge.line, [{ opacity: .4 }, { opacity: 1 }], 240);
    if (game === 'burger-girl' && gained) this.animate(lane.burger.stack, POP, 220);
    if (game === 'me-find-mistake' && gained && feedback) this.animate(lane.mistake.cards[feedback.color].picture, POP, 180);
    if (game === 'dice-dice-more-dice' && gained && feedback) this.animate(lane.dice.cards[feedback.color].face, POP, 180);
    if (game === 'facing-which-way' && gained) this.animate(lane.facing.cue, POP, 210);
    if (missed) {
      this.animate(lane.status, [{ opacity: .45 }, { opacity: 1 }], 220);
      return;
    }
    // Existing jump sparks and firework explosions already carry routine impacts.
    const burst = finished || gained && !['jump-for-the-meat', 'fireworks-craze', 'facial-slot-machine', 'me-find-mistake', 'dice-dice-more-dice', 'facing-which-way'].includes(game);
    if (!burst) return;
    const count = finished ? 12 : game === 'totem-shrinker' ? 4 : 6;
    lane.particles.forEach((particle, index) => {
      if (index >= count) return;
      const angle = index / count * Math.PI * 2;
      const distance = finished ? 44 : 24;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      this.animate(particle, [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { opacity: 1, offset: .12 },
        { transform: `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) rotate(${index * 47}deg) scale(.3)`, opacity: 0 },
      ], finished ? 620 : 320);
    });
    this.animate(lane.ring, [
      { transform: 'translate(-50%,-50%) scale(.35)', opacity: .8 },
      { transform: `translate(-50%,-50%) scale(${finished ? 1.8 : 1})`, opacity: 0 },
    ], finished ? 520 : 280);
  }
}
