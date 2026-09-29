// Accumulate only visible, active time. Long idle answers are excluded server-side.
export class ActiveClock {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.total = 0;
    this.started = null;
  }
  resume() {
    if (this.started === null) this.started = this.now();
  }
  pause() {
    if (this.started !== null) {
      this.total += Math.max(0, this.now() - this.started);
      this.started = null;
    }
  }
  read() {
    return Math.round(
      this.total +
        (this.started === null ? 0 : Math.max(0, this.now() - this.started)),
    );
  }
}
