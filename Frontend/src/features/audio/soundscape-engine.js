// Short, finite notes with a smooth envelope: no continuous bass oscillators.
export function playAmbientNote(
  ctx,
  destination,
  frequency,
  active,
  { duration = 2, type = "sine" } = {},
) {
  const oscillator = ctx.createOscillator(),
    envelope = ctx.createGain();
  const now = ctx.currentTime;
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(
    0.025,
    now + Math.min(0.08, duration / 5),
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.9);
  envelope.gain.linearRampToValueAtTime(0, now + duration);
  oscillator.connect(envelope);
  envelope.connect(destination);
  active.add(oscillator);
  oscillator.onended = () => {
    active.delete(oscillator);
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(now);
  oscillator.stop(now + duration + 0.05);
  return oscillator;
}
