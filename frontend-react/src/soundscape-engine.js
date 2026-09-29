// Short, finite notes with a smooth envelope: no continuous bass oscillators.
export function playAmbientNote(ctx, destination, frequency, active) {
  const oscillator = ctx.createOscillator(),
    envelope = ctx.createGain();
  const now = ctx.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(0.025, now + 0.08);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  envelope.gain.linearRampToValueAtTime(0, now + 2);
  oscillator.connect(envelope);
  envelope.connect(destination);
  active.add(oscillator);
  oscillator.onended = () => {
    active.delete(oscillator);
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(now);
  oscillator.stop(now + 2.05);
  return oscillator;
}
