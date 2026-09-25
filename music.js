// The game's background music. Songs are written as notes and played live by
// the browser's synthesizer (Web Audio), so they work offline with no music files.
//   Music.play('title' | 'menu' | 'battle' | 'victory')  switch songs
//   Music.setMuted(true)                                  silence the whole game
//   Music.context()                                       the AudioContext every game sound shares
(function () {
  // One token per sixteenth note: 'C5' plays a note, '-' holds the note before
  // it, '.' is a rest. Drums use k (kick), s (snare) and h (hi-hat).
  const bars = (...b) => b.join(' ');
  const times = (s, n) => Array(n).fill(s).join(' ');
  const arp = (a, b, c, d, n = 4) => times(`${a} ${b} ${c} ${d}`, n);
  const octave = (lo, hi) => `${lo} - ${hi} - ${lo} - ${hi} -`;
  const pump = (lo, hi, n = 4) => times(`${lo} ${lo} ${hi} ${lo}`, n);

  const SONGS = {
    // Heroic and bright, for the intro and title.
    title: { bpm: 140, loop: true, tracks: [
      { voice: 'lead', notes: bars(
        'C5 - - - G4 - - C5 E5 - - - G5 - - -', 'A5 - - - G5 - F5 - E5 - - - D5 - - -',
        'F5 - - - E5 - D5 - C5 - - - E5 - G5 -', 'D5 - - - - - - - G4 - A4 - B4 - D5 -',
        'C5 - - - G4 - - C5 E5 - - - G5 - - -', 'A5 - - - B5 - C6 - B5 - A5 - G5 - - -',
        'F5 - A5 - G5 - E5 - D5 - - - E5 - D5 -', 'C5 - - - - - - - . . . . G4 - - -') },
      { voice: 'harm', notes: bars(
        arp('C4', 'E4', 'G4', 'E4'), arp('F4', 'A4', 'C5', 'A4'),
        arp('D4', 'F4', 'A4', 'F4', 2), arp('C4', 'E4', 'G4', 'E4', 2), arp('G3', 'B3', 'D4', 'B3'),
        arp('C4', 'E4', 'G4', 'E4'), arp('F4', 'A4', 'C5', 'A4'),
        arp('D4', 'F4', 'A4', 'F4', 2), arp('G3', 'B3', 'D4', 'B3', 2), arp('C4', 'E4', 'G4', 'E4')) },
      { voice: 'bass', notes: bars(
        octave('C3', 'C4'), octave('C3', 'C4'), octave('F2', 'F3'), octave('F2', 'F3'),
        octave('D3', 'D4'), octave('C3', 'C4'), octave('G2', 'G3'), 'G2 - G3 - B2 - D3 -',
        octave('C3', 'C4'), octave('C3', 'C4'), octave('F2', 'F3'), octave('F2', 'F3'),
        octave('D3', 'D4'), octave('G2', 'G3'), 'C3 - C4 - C3 - - - . . . . G2 - - -') },
      { voice: 'drum', notes: 'k . h . s . h . k . k h s . h .' },
    ] },

    // Bouncy and light, for picking trainers, Pokemon and the battle scene.
    menu: { bpm: 126, loop: true, tracks: [
      { voice: 'lead', notes: bars(
        'G5 - E5 - D5 - B4 - D5 - - - B4 - G4 -', 'A4 - B4 - C5 - E5 - D5 - - - - - - -',
        'G5 - E5 - D5 - B4 - D5 - - - B4 - G4 -', 'A4 - C5 - B4 - A4 - G4 - - - - - - -',
        'C5 - E5 - G5 - E5 - D5 - B4 - G4 - B4 -', 'C5 - E5 - G5 - A5 - G5 - - - - - - -',
        'F#5 - - - E5 - D5 - C5 - B4 - A4 - B4 -', 'G4 - - - - - - - . . . . D5 - - -') },
      { voice: 'bass', notes: bars(
        'G2 - . . D3 - . . G2 - . . D3 - . .', 'A2 - . . E3 - . . D3 - . . A2 - . .',
        'G2 - . . D3 - . . G2 - . . D3 - . .', 'D3 - . . A2 - . . G2 - . . D3 - . .',
        'C3 - . . G2 - . . C3 - . . G2 - . .', 'C3 - . . G2 - . . A2 - . . E3 - . .',
        'D3 - . . A2 - . . D3 - . . F#2 - . .', 'G2 - . . D3 - . . G2 - - - . . . .') },
      { voice: 'drum', notes: 'k . h . s . h h k . h . s . h .' },
    ] },

    // Fast and dark, for the fight.
    battle: { bpm: 152, loop: true, tracks: [
      { voice: 'lead', notes: bars(
        'A4 - - - C5 - - - E5 - - - A5 - G5 -', 'F5 - - - E5 - D5 - E5 - - - - - - -',
        'A4 - - - C5 - - - E5 - - - A5 - B5 -', 'C6 - - - B5 - A5 - G5 - - - E5 - - -',
        'F5 - - - F5 - G5 - A5 - - - F5 - - -', 'G5 - - - G5 - A5 - B5 - - - G5 - - -',
        'A5 - G5 - E5 - C5 - D5 - E5 - G#5 - - -', 'A5 - - - - - - - E5 - D5 - C5 - B4 -') },
      { voice: 'bass', notes: bars(
        pump('A2', 'A3'), pump('D3', 'D4'), pump('A2', 'A3'), pump('A2', 'A3', 2), pump('E2', 'E3', 2),
        pump('F2', 'F3'), pump('G2', 'G3'), pump('A2', 'A3', 2), pump('E2', 'E3', 2), pump('A2', 'A3')) },
      { voice: 'drum', notes: 'k . h k s . h . k k h . s . h h' },
    ] },

    // A fanfare for the winner, played once.
    victory: { bpm: 120, loop: false, tracks: [
      { voice: 'lead', notes: bars(
        'G4 - C5 - E5 - G5 - - - E5 - G5 - - -', 'A5 - - - F5 - A5 - C6 - - - - - - -',
        'B5 - - - G5 - B5 - D6 - - - C6 - B5 -', 'C6 - - - - - - - - - - - . . . .') },
      { voice: 'harm', notes: bars(
        arp('C4', 'E4', 'G4', 'E4'), arp('F4', 'A4', 'C5', 'A4'), arp('G4', 'B4', 'D5', 'B4'),
        'C4 E4 G4 C5 E5 G5 C6 - - - - - . . . .') },
      { voice: 'bass', notes: bars(
        times('C3 - - -', 4), times('F2 - - -', 4), times('G2 - - -', 4), 'C3 - - - - - - - - - - - . . . .') },
      { voice: 'drum', notes: bars(times('k . . . s . . . k . k . s . s s', 3), 'k . . . . . . . . . . . . . . .') },
    ] },
  };

  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const noteFrequency = (tok) => {
    const m = /^([A-G])([#b]?)(\d)$/.exec(tok);
    if (!m) return NaN;
    const midi = (Number(m[3]) + 1) * 12 + NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  };

  // Turns a song into steps; each step lists the notes that start on it and how
  // many steps each one lasts. A short track repeats under a longer one.
  const compileSong = (song) => {
    const tracks = song.tracks.map(t => ({ voice: t.voice, toks: t.notes.trim().split(/\s+/) }));
    const length = Math.max(...tracks.map(t => t.toks.length));
    const steps = Array.from({ length }, () => []);
    for (const { voice, toks } of tracks) {
      for (let s = 0; s < length; s++) {
        const tok = toks[s % toks.length];
        if (tok === '-' || tok === '.') continue;
        let dur = 1;
        while (dur < toks.length && toks[(s + dur) % toks.length] === '-') dur++;
        steps[s].push({ voice, tok, dur });
      }
    }
    return steps;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { noteFrequency, compileSong, SONGS };
    return;
  }

  // Let game sound play even when the iPhone's ring/silent switch is on silent;
  // the mute button is the game's own off switch.
  if (navigator.audioSession) navigator.audioSession.type = 'playback';

  const LOOKAHEAD = 0.15; // seconds of notes scheduled ahead of time
  const VOLUME = 0.35;    // music sits under the sound effects
  const VOICES = {
    lead: { wave: 'square', vol: 0.13 },
    harm: { wave: 'square', vol: 0.045 },
    bass: { wave: 'triangle', vol: 0.3 },
  };

  let ctx = null, noise = null, muted = false;
  try { muted = localStorage.getItem('muted') === '1'; } catch (e) {}
  let song = null, songName = null, steps = [], step = 0, nextTime = 0, timer = null, bus = null, tone = null;

  const context = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      if (muted) ctx.suspend();
    }
    if (!muted && ctx.state !== 'running') ctx.resume();
    return ctx;
  };

  const drum = (tok, t) => {
    if (tok === 'k') {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(t);
      osc.stop(t + 0.17);
      return;
    }
    const snare = tok === 's';
    const len = snare ? 0.12 : 0.04;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = noise;
    filter.type = 'highpass';
    filter.frequency.value = snare ? 1200 : 7000;
    gain.gain.setValueAtTime(snare ? 0.22 : 0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start(t, Math.random() * 0.5, len + 0.01);
  };

  const playNote = ({ voice, tok }, t, len) => {
    if (voice === 'drum') return drum(tok, t);
    const v = VOICES[voice];
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    const end = t + len * 0.92;
    osc.type = v.wave;
    osc.frequency.value = noteFrequency(tok);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(v.vol, t + 0.008);
    gain.gain.setTargetAtTime(v.vol * 0.6, t + 0.008, 0.1);
    gain.gain.setTargetAtTime(0, end - 0.02, 0.01);
    osc.connect(gain);
    gain.connect(tone);
    osc.start(t);
    osc.stop(end + 0.06);
  };

  // Schedules the next few notes ahead of time so the beat stays steady.
  const tick = () => {
    const now = ctx.currentTime;
    const stepLen = 60 / song.bpm / 4;
    if (nextTime < now) nextTime = now + 0.02; // woke up late: skip ahead instead of rushing
    while (nextTime < now + LOOKAHEAD) {
      for (const note of steps[step]) playNote(note, nextTime, note.dur * stepLen);
      nextTime += stepLen;
      step += 1;
      if (step < steps.length) continue;
      if (!song.loop) { clearInterval(timer); timer = null; return; }
      step = 0;
    }
  };

  const stop = () => {
    clearInterval(timer);
    timer = null;
    songName = null;
    if (!bus) return;
    const old = bus;
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => old.disconnect(), 500);
    bus = null;
  };

  const play = (name) => {
    if (name === songName && timer) return;
    stop();
    context();
    song = SONGS[name];
    steps = compileSong(song);
    songName = name;
    bus = ctx.createGain();
    bus.gain.value = VOLUME;
    bus.connect(ctx.destination);
    tone = ctx.createBiquadFilter(); // softens the square waves
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    tone.connect(bus);
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    timer = setInterval(tick, 25);
    tick();
  };

  const setMuted = (value) => {
    muted = value;
    try { localStorage.setItem('muted', value ? '1' : '0'); } catch (e) {}
    if (ctx) value ? ctx.suspend() : ctx.resume();
  };

  // Phones only let sound start from a tap, and pause it while the app is hidden.
  ['touchend', 'click'].forEach(type => document.addEventListener(type, () => {
    if (ctx && !muted) ctx.resume();
  }, true));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (!muted) ctx.resume();
  });

  window.Music = {
    play, stop, setMuted, context,
    get muted() { return muted; },
    get playing() { return timer ? songName : null; },
  };
})();
