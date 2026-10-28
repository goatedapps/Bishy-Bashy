const GAPS_MS = [325, 375, 450, 450];

export class InstructionSequence {
  constructor({ onReveal = () => {} } = {}) {
    this.onReveal = onReveal;
    this.cancel();
  }

  start(key, elements, time) {
    if (this.key === key) return;
    this.key = key;
    this.elements = elements;
    this.revealed = 0;
    this.nextAt = time;
    for (const element of elements) {
      element.classList.add('instruction-step');
      element.classList.remove('is-revealed');
      element.setAttribute('aria-hidden', 'true');
    }
  }

  get complete() { return this.key !== null && this.revealed === this.elements.length; }

  advance(time, visible = true) {
    if (this.key === null || this.complete) return;
    if (!visible) { this.nextAt = null; return; }
    if (this.nextAt !== null && time < this.nextAt) return;
    const element = this.elements[this.revealed];
    element.classList.add('is-revealed');
    element.setAttribute('aria-hidden', 'false');
    this.onReveal(this.revealed);
    // Delayed frames reveal one step, rather than playing a backlog of reveal sounds.
    this.nextAt = time + (GAPS_MS[this.revealed] ?? 450);
    this.revealed++;
  }

  cancel() {
    this.key = null;
    this.elements = [];
    this.revealed = 0;
    this.nextAt = null;
  }
}
