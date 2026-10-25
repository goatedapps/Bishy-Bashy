export class SyncedClock {
  constructor() { this.samples = []; }

  add({ sent, received, serverReceived, serverSent }) {
    const rtt = (received - sent) - (serverSent - serverReceived);
    if (![sent, received, serverReceived, serverSent, rtt].every(Number.isFinite) || rtt < 0 || rtt > 5000) return;
    const offset = ((serverReceived - sent) + (serverSent - received)) / 2;
    this.samples = this.samples.filter(sample => received - sample.at < 30_000).slice(-19);
    this.samples.push({ at: received, rtt, offset });
  }

  estimate(now) {
    const recent = this.samples.filter(sample => now - sample.at < 20_000);
    if (!recent.length) return null;
    const best = [...recent].sort((a, b) => a.rtt - b.rtt).slice(0, 5);
    const offsets = best.map(sample => sample.offset).sort((a, b) => a - b);
    const offset = offsets[Math.floor(offsets.length / 2)];
    const jitter = Math.max(...best.map(sample => Math.abs(sample.offset - offset)));
    return { offset, rtt: best[0].rtt, uncertainty: best[0].rtt / 2 + jitter, count: recent.length, age: now - recent.at(-1).at };
  }
}
