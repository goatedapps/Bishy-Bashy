export class HeldInputs {
  constructor(onPress, onRelease) {
    this.onPress = onPress;
    this.onRelease = onRelease;
    this.sources = new Map();
    this.counts = [0, 0, 0];
  }
  press(source, color) {
    if (this.sources.has(source) || !Number.isInteger(color) || color < 0 || color > 2) return;
    this.sources.set(source, color);
    if (this.counts[color]++ === 0) this.onPress(color);
  }
  release(source, cancelled = false) {
    const color = this.sources.get(source);
    if (color === undefined) return;
    this.sources.delete(source);
    if (--this.counts[color] === 0) this.onRelease(color, cancelled);
  }
  clear() { for (const source of [...this.sources.keys()]) this.release(source, true); }
}
