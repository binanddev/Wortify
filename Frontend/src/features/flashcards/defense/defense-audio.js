// Procedural, layered sound design: no downloads, no external audio service.
// Every voice has a short envelope and a limiter keeps overlapping effects comfortable.
export function defenseAudio() {
  let context,
    master,
    fx,
    compressor,
    noiseBuffer,
    enabled = true,
    volume = 0.55,
    lastSpeech = 0,
    lastKey = -Infinity,
    speechGeneration = 0;
  const voices = new Set();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  function unlock() {
    if (!AudioContext) return;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      fx = context.createGain();
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.knee.value = 15;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.16;
      fx.connect(compressor);
      compressor.connect(master);
      master.connect(context.destination);
      master.gain.value = enabled ? volume : 0;
      noiseBuffer = context.createBuffer(
        1,
        context.sampleRate,
        context.sampleRate,
      );
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    context.resume().catch(() => {});
  }
  function play({
    frequency = 440,
    end = frequency,
    duration = 0.1,
    gain = 0.08,
    type = "sine",
    delay = 0,
    noise = false,
    filter = 1800,
    pan = 0,
  }) {
    if (!enabled || !context || context.state !== "running" || voices.size > 48)
      return;
    const t = context.currentTime + delay,
      source = noise
        ? context.createBufferSource()
        : context.createOscillator(),
      envelope = context.createGain(),
      band = context.createBiquadFilter(),
      stereo = context.createStereoPanner();
    if (noise) source.buffer = noiseBuffer;
    else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, t);
      source.frequency.exponentialRampToValueAtTime(
        Math.max(20, end),
        t + duration,
      );
    }
    band.type = "lowpass";
    band.frequency.value = filter;
    stereo.pan.value = pan;
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(band);
    band.connect(envelope);
    envelope.connect(stereo);
    stereo.connect(fx);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      band.disconnect();
      envelope.disconnect();
      stereo.disconnect();
    };
    source.start(t);
    source.stop(t + duration + 0.02);
  }
  function typing(deleting = false) {
    if (!context) return;
    const now = context.currentTime;
    if (now - lastKey < 0.025) return;
    lastKey = now;
    // Soft mechanical contact, with a different pitch for backspace.
    play({
      noise: true,
      duration: 0.025,
      gain: 0.11,
      filter: deleting ? 950 : 2400,
    });
    play({
      frequency: deleting ? 310 : 650,
      end: deleting ? 200 : 410,
      duration: 0.045,
      gain: 0.06,
      type: "triangle",
    });
  }
  function tone(kind) {
    if (!enabled) return;
    if (kind === "hit") {
      play({
        frequency: 1200,
        end: 240,
        duration: 0.09,
        gain: 0.07,
        type: "triangle",
        filter: 2600,
      });
      return;
    }
    if (kind === "lock") {
      for (const [i, hz] of [540, 810].entries())
        play({ frequency: hz, duration: 0.095, gain: 0.1, delay: i * 0.065 });
      return;
    }
    if (kind === "wrong") {
      play({
        frequency: 155,
        end: 100,
        duration: 0.13,
        gain: 0.13,
        type: "triangle",
        filter: 600,
      });
      return;
    }
    if (kind === "armor") {
      play({ noise: true, duration: 0.16, gain: 0.18, filter: 3800 });
      for (const [i, hz] of [740, 1110, 1480].entries())
        play({
          frequency: hz,
          end: hz * 0.7,
          duration: 0.21,
          gain: 0.055,
          delay: i * 0.015,
        });
      return;
    }
    if (["destroy", "nuke", "impact"].includes(kind)) {
      const big = kind === "nuke";
      play({
        noise: true,
        duration: big ? 0.65 : 0.3,
        gain: big ? 0.3 : 0.22,
        filter: kind === "impact" ? 550 : 1900,
      });
      play({
        frequency: big ? 110 : 160,
        end: 32,
        duration: big ? 0.65 : 0.28,
        gain: 0.22,
        type: "sine",
      });
      if (kind !== "impact")
        play({
          frequency: 350,
          end: 900,
          duration: 0.07,
          gain: 0.08,
          type: "triangle",
        });
      return;
    }
    if (kind === "freeze") {
      for (const [i, hz] of [1568, 1175, 784].entries())
        play({
          frequency: hz,
          duration: 0.28,
          gain: 0.065,
          delay: i * 0.075,
          pan: (i - 1) * 0.35,
        });
      return;
    }
    if (kind === "health") {
      for (const [i, hz] of [523, 659, 784, 1046].entries())
        play({ frequency: hz, duration: 0.16, gain: 0.1, delay: i * 0.065 });
    }
  }
  function restoreFX() {
    if (context && fx) {
      fx.gain.cancelScheduledValues(context.currentTime);
      fx.gain.setTargetAtTime(1, context.currentTime, 0.08);
    }
  }
  function stop() {
    speechGeneration++;
    window.speechSynthesis?.cancel();
    restoreFX();
    for (const voice of voices) {
      try {
        voice.stop();
      } catch {}
    }
  }
  function speak(card, force = false) {
    if (!enabled || !window.speechSynthesis) return false;
    const now = Date.now();
    if (!force && (now - lastSpeech < 1800 || window.speechSynthesis.speaking))
      return false;
    lastSpeech = now;
    const generation = ++speechGeneration;
    window.speechSynthesis.cancel();
    if (context && fx) {
      fx.gain.cancelScheduledValues(context.currentTime);
      fx.gain.setTargetAtTime(0.22, context.currentTime, 0.03);
    }
    const utterance = new SpeechSynthesisUtterance(card.answer);
    utterance.lang = card.language;
    utterance.rate = 0.85;
    utterance.volume = volume;
    const ended = () => {
      if (generation === speechGeneration) restoreFX();
    };
    utterance.onend = ended;
    utterance.onerror = ended;
    window.speechSynthesis.speak(utterance);
    return true;
  }
  return {
    unlock,
    tone,
    typing,
    speak,
    stop,
    setVolume(value) {
      volume = Math.max(0, Math.min(1, Number(value) || 0));
      if (master && context)
        master.gain.setTargetAtTime(
          enabled ? volume : 0,
          context.currentTime,
          0.03,
        );
    },
    mute(value) {
      enabled = !value;
      if (value) stop();
      if (master && context)
        master.gain.setTargetAtTime(
          enabled ? volume : 0,
          context.currentTime,
          0.02,
        );
    },
    dispose() {
      stop();
      context?.close().catch(() => {});
    },
  };
}
