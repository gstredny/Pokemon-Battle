const { test } = require('node:test');
const assert = require('node:assert/strict');
const { noteFrequency, compileSong, SONGS } = require('../music.js');

const near = (a, b) => Math.abs(a - b) < 0.01;

test('notes turn into the right pitch', () => {
  assert.equal(noteFrequency('A4'), 440);
  assert.ok(near(noteFrequency('C5'), 523.25));
  assert.ok(near(noteFrequency('F#2'), 92.5));
  assert.ok(near(noteFrequency('Bb3'), 233.08));
  assert.ok(Number.isNaN(noteFrequency('H4')));
});

test('a dash holds the note before it, a dot is a rest', () => {
  const steps = compileSong({ tracks: [{ voice: 'lead', notes: 'C5 - - . E5' }] });
  assert.equal(steps.length, 5);
  assert.deepEqual(steps[0], [{ voice: 'lead', tok: 'C5', dur: 3 }]);
  assert.deepEqual(steps[3], []);
  assert.deepEqual(steps[4], [{ voice: 'lead', tok: 'E5', dur: 1 }]);
});

test('a short track repeats under a longer one', () => {
  const steps = compileSong({ tracks: [
    { voice: 'lead', notes: 'C5 D5 E5 F5' },
    { voice: 'drum', notes: 'k .' },
  ] });
  assert.equal(steps.length, 4);
  assert.deepEqual(steps[2].map(e => e.tok), ['E5', 'k']);
});

test('every song is whole bars and uses only real notes', () => {
  assert.deepEqual(Object.keys(SONGS).sort(), ['battle', 'menu', 'title', 'victory']);
  for (const [name, song] of Object.entries(SONGS)) {
    const length = compileSong(song).length;
    for (const t of song.tracks) {
      const toks = t.notes.trim().split(/\s+/);
      assert.equal(toks.length % 16, 0, `${name} ${t.voice}: ${toks.length} steps is not whole bars`);
      if (t.voice !== 'drum') assert.equal(toks.length, length, `${name} ${t.voice} is shorter than the song`);
      for (const tok of toks) {
        if (tok === '-' || tok === '.') continue;
        if (t.voice === 'drum') assert.match(tok, /^[ksh]$/, `${name}: bad drum ${tok}`);
        else assert.ok(Number.isFinite(noteFrequency(tok)), `${name} ${t.voice}: bad note ${tok}`);
      }
    }
  }
});
