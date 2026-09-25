// The game's real sound effects: CC0 recordings in sounds/ (credits in
// sounds/LICENSES.md, built by dev/sounds/build_sounds.py), played through the
// AudioContext every game sound shares (music.js), so the mute button
// silences them too. Each file loads the first time it is asked for.
//   Sounds.play('move-fire')        true if it played; false while it loads (use a stand-in)
//   Sounds.loop('place-ocean', 0.4) starts a place's sound; returns a function that stops it
(function () {
  const buffers = new Map();   // name -> AudioBuffer, or a Promise while loading, or null if missing

  const load = name => {
    if (buffers.has(name)) return buffers.get(name);
    const ctx = Music.context();
    const loading = fetch(`sounds/${name}.mp3`)
      .then(r => { if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.arrayBuffer(); })
      .then(bytes => new Promise((ok, fail) => ctx.decodeAudioData(bytes, ok, fail)))
      .then(buffer => { buffers.set(name, buffer); return buffer; },
            err => { console.warn('Sounds:', err.message || err); buffers.set(name, null); return null; });
    buffers.set(name, loading);
    return loading;
  };

  const start = (buffer, volume, rate, loop) => {
    const ctx = Music.context();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    return { source, gain };
  };

  const play = (name, { volume = 0.8, rate = 1 } = {}) => {
    if (Music.muted) return true;
    const buffer = load(name);
    if (!(buffer instanceof AudioBuffer)) return false;
    start(buffer, volume, rate * (0.95 + Math.random() * 0.1), false);
    return true;
  };

  const loop = (name, volume = 0.4) => {
    let playing = null, stopped = false;
    Promise.resolve(load(name)).then(buffer => {
      if (!buffer || stopped) return;
      playing = start(buffer, 0, 1, true);
      playing.gain.gain.setTargetAtTime(volume, Music.context().currentTime, 0.8);   // fade in
    });
    return () => {
      stopped = true;
      if (!playing) return;
      const { source, gain } = playing, ctx = Music.context();
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      source.stop(ctx.currentTime + 1.5);
    };
  };

  // Load the short sounds early, so the first attack of each kind is heard.
  const warm = () => ['hit', 'hit-big', 'miss', 'throw', 'ball-open', 'faint', 'cheer'].forEach(load);

  window.Sounds = { play, loop, load, warm };
})();
