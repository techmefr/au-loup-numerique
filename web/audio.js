const chimes = {
  vote: [[440, 0, 0.13]],
  success: [[392, 0, 0.26], [494, 0.09, 0.27], [587, 0.18, 0.38]],
  setback: [[349, 0, 0.22], [294, 0.11, 0.31]],
  victory: [[392, 0, 0.25], [494, 0.09, 0.29], [587, 0.18, 0.34], [784, 0.28, 0.53]],
};

export function createGameAudio({ mute, effects, ambience }) {
  let context, effectBus, ambienceBus, water, paper;
  const saved = {};
  try { Object.assign(saved, JSON.parse(localStorage.getItem('loup.audio') ?? '{}')); } catch {}
  mute.checked = typeof saved.muted === 'boolean' ? saved.muted : true;
  effects.value = String(saved.effects ?? 62);
  ambience.value = String(saved.ambience ?? 0);

  function noise(duration, smoothing) {
    const samples = Math.round(duration * context.sampleRate);
    const buffer = context.createBuffer(1, samples, context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples; i++) {
      previous = previous * smoothing + (Math.random() * 2 - 1) * (1 - smoothing);
      data[i] = previous * Math.min(1, i / 320, (samples - 1 - i) / 320);
    }
    return buffer;
  }

  async function enable() {
    if (!context) {
      context = new AudioContext();
      effectBus = context.createGain();
      ambienceBus = context.createGain();
      effectBus.connect(context.destination);
      ambienceBus.connect(context.destination);
      paper = noise(0.3, 0.45);
    }
    if (context.state === 'suspended') await context.resume();
  }

  function updateLevels() {
    if (!context) return;
    const now = context.currentTime;
    effectBus.gain.setTargetAtTime(mute.checked ? 0 : Number(effects.value) / 100, now, 0.025);
    ambienceBus.gain.setTargetAtTime(mute.checked ? 0 : Number(ambience.value) / 100 * 0.26, now, 0.08);
    if (water || mute.checked || Number(ambience.value) === 0) return;
    water = context.createBufferSource();
    water.buffer = noise(3.7, 0.89);
    water.loop = true;
    const stream = context.createBiquadFilter();
    stream.type = 'bandpass';
    stream.frequency.value = 470;
    stream.Q.value = 0.45;
    water.connect(stream).connect(ambienceBus);
    water.start();
  }

  const saveLevels = () => {
    try {
      localStorage.setItem('loup.audio', JSON.stringify({
        muted: mute.checked, effects: Number(effects.value), ambience: Number(ambience.value),
      }));
    } catch {}
  };

  for (const control of [mute, effects, ambience]) {
    control.addEventListener('input', () => {
      saveLevels();
      if (mute.checked) updateLevels();
      else enable().then(updateLevels).catch(() => {});
    });
  }

  function envelope(source, start, length, peak, filter) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.026);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    if (filter) source.connect(filter).connect(gain);
    else source.connect(gain);
    gain.connect(effectBus);
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
    };
    source.start(start);
    source.stop(start + length);
  }

  function playChime(cue, at) {
    for (const [pitch, offset, length] of chimes[cue]) {
      const tone = context.createOscillator();
      tone.type = 'triangle';
      tone.frequency.value = pitch;
      const softened = context.createBiquadFilter();
      softened.frequency.value = 980;
      envelope(tone, at + offset, length, 0.085, softened);
    }
  }

  function playPaper(cue, at) {
    const shuffle = context.createBufferSource();
    shuffle.buffer = paper;
    const brush = context.createBiquadFilter();
    brush.type = 'bandpass';
    brush.frequency.value = cue === 'card' ? 920 : 690;
    brush.Q.value = 0.65;
    envelope(shuffle, at, cue === 'card' ? 0.125 : 0.23, cue === 'card' ? 0.34 : 0.48, brush);
  }

  function playBleat(at) {
    const note = context.createOscillator();
    note.type = 'triangle';
    const pitch = Float32Array.from({ length: 28 }, (_, i) => 290 - i * 3 + Math.sin(i * 0.8) * 20);
    note.frequency.setValueCurveAtTime(pitch, at, 0.29);
    const warmth = context.createBiquadFilter();
    warmth.frequency.value = 720;
    envelope(note, at, 0.29, 0.13, warmth);
  }

  return async function play(cue) {
    if (mute.checked || Number(effects.value) === 0) return;
    try {
      await enable();
      updateLevels();
      if (mute.checked || context.state !== 'running') return;
      const at = context.currentTime + 0.015;
      if (cue === 'bleat') playBleat(at);
      else if (cue === 'card' || cue === 'place') playPaper(cue, at);
      else if (chimes[cue]) playChime(cue, at);
    } catch {
      // The visual cue still plays if the browser blocks audio.
    }
  };
}
