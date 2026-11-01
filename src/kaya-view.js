const node = (className) => { const element = document.createElement('span'); element.className = className; return element; };

export function kayaPortrait() {
  const portrait = node('kaya-sprite kaya-dog');
  portrait.setAttribute('role', 'img');
  portrait.setAttribute('aria-label', 'Kaya, a cheerful tan Singapore Special dog');
  return portrait;
}

export function kayaPositions(phase, reducedMotion = false) {
  const { puzzle } = phase.stage;
  const moving = phase.mode === 'turn';
  const before = moving ? puzzle.orders[phase.turn] : phase.mode === 'wait' || phase.mode === 'look' || phase.mode === 'cover' || phase.mode === 'covered' ? puzzle.initial : puzzle.orders.at(-1);
  const after = moving ? puzzle.orders[phase.turn + 1] : before;
  const progress = moving ? phase.progress : 0;
  const eased = reducedMotion ? progress : progress * progress * (3 - 2 * progress);
  return [0, 1, 2].map(identity => {
    const start = before.indexOf(identity), end = after.indexOf(identity);
    return { slot: start + (end - start) * eased,
      lift: reducedMotion || start === end ? 0 : Math.sin(progress * Math.PI) * (start < end ? -10 : 10),
      front: start > end };
  });
}

export class KayaScene {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'kaya-scene';
    this.element.setAttribute('role', 'group');
    this.subjects = [0, 1, 2].map(identity => {
      const actor = node('kaya-subject');
      const animal = identity === 0 ? kayaPortrait() : node('kaya-sprite kaya-kitten');
      if (identity !== 0) { animal.setAttribute('role', 'img'); animal.setAttribute('aria-label', 'Grey and cream kitten'); }
      const blanket = node('kaya-sprite kaya-blanket');
      blanket.setAttribute('role', 'img');
      blanket.setAttribute('aria-label', 'Covered animal');
      actor.append(animal, blanket);
      this.element.append(actor);
      return { actor, animal, blanket };
    });
    this.slots = [0, 1, 2].map(color => {
      const slot = node(`kaya-slot option-${color}`);
      slot.textContent = ['●', '▲', '◆'][color];
      slot.setAttribute('aria-hidden', 'true');
      this.element.append(slot);
      return slot;
    });
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  render(phase, result) {
    const revealed = phase.mode === 'reveal' || phase.mode === 'done';
    const covering = phase.mode === 'cover';
    const covered = !['wait', 'look'].includes(phase.mode) && !revealed;
    const positions = kayaPositions(phase, this.motion?.matches);
    this.subjects.forEach(({ actor, animal, blanket }, identity) => {
      actor.style.setProperty('--kaya-slot', String(positions[identity].slot));
      actor.style.setProperty('--kaya-lift', `${positions[identity].lift}cqh`);
      actor.style.zIndex = positions[identity].front ? '3' : '2';
      actor.hidden = phase.mode === 'wait';
      animal.hidden = covered && (!covering || phase.progress >= .75);
      blanket.hidden = !covered;
      blanket.style.transform = covering && !this.motion?.matches ? `translateY(${-130 * (1 - phase.progress)}%)` : '';
      actor.classList.toggle('kaya-found', Boolean(result && identity === 0));
    });
    this.slots.forEach((slot, color) => {
      slot.hidden = !['play', 'reveal', 'done'].includes(phase.mode);
      slot.classList.toggle('kaya-correct-slot', Boolean(result && color === phase.stage.puzzle.answer));
    });
    this.element.setAttribute('aria-label', phase.mode === 'look' ? `Kaya starts ${['left', 'in the middle', 'right'][phase.stage.puzzle.initial.indexOf(0)]}; remember the dog` : revealed ? `Kaya is ${['left', 'in the middle', 'right'][phase.stage.puzzle.answer]}` : phase.mode === 'play' ? 'Where is Kaya? Choose red for left, green for middle, blue for right' : 'Follow the three identical blankets');
  }
}
