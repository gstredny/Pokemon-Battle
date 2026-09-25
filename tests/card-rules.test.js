const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monsterFromCard } = require('../card-rules.js');

const card = (overrides = {}) => ({
  slug: 'blaze-jaw', name: 'Blaze Jaw', madeBy: 'Sam', type: 'fire', cry: 'dragon',
  stars: { hp: 3, strong: 3, tough: 2, fast: 2 },
  powers: {
    bigHit: 'Lava Chomp', fastHit: 'Spark Nip',
    trick: { name: 'Smoke Puff', does: 'sleep' },
    saveMe: { name: 'Snack Time', does: 'heal' },
  },
  ...overrides,
});

test('stars become stats', () => {
  const m = monsterFromCard(card(), 1000);
  assert.deepEqual([m.hp, m.atk, m.def, m.spd], [155, 100, 80, 80]);
});

test('ten stars always total 400 to 425, like real Pokemon', () => {
  const total = s => { const m = monsterFromCard(card({ stars: s }), 1); return m.hp + m.atk + m.def + m.spd; };
  assert.equal(total({ hp: 0, strong: 0, tough: 5, fast: 5 }), 400);
  assert.equal(total({ hp: 5, strong: 5, tough: 0, fast: 0 }), 425);
});

test('the monster keeps its card details and drawing path', () => {
  const m = monsterFromCard(card(), 1000);
  assert.equal(m.id, 1000);
  assert.equal(m.name, 'Blaze Jaw');
  assert.equal(m.madeBy, 'Sam');
  assert.equal(m.type, 'fire');
  assert.equal(m.cry, 'dragon');
  assert.equal(m.img, 'monsters/blaze-jaw.png');
});

test('the four powers become the four moves', () => {
  const [big, fast, trick, save] = monsterFromCard(card(), 1).attacks;
  assert.deepEqual(big, { name: 'Lava Chomp', power: 110, accuracy: 75, type: 'fire' });
  assert.deepEqual(fast, { name: 'Spark Nip', power: 40, accuracy: 100, type: 'fire', priority: true });
  assert.deepEqual(trick, { name: 'Smoke Puff', power: 0, accuracy: 75, type: 'fire', effect: 'sleep', effectChance: 100 });
  assert.deepEqual(save, { name: 'Snack Time', power: 0, accuracy: 100, type: 'fire', heal: 50 });
});

test('power words map to battle effects', () => {
  const moves = (trickDoes, saveDoes) => monsterFromCard(card({ powers: { ...card().powers, trick: { name: 'T', does: trickDoes }, saveMe: { name: 'S', does: saveDoes } } }), 1).attacks;
  const [, , zap, faster] = moves('zap', 'faster');
  assert.equal(zap.effect, 'paralysis');
  assert.equal(zap.accuracy, 90);
  assert.equal(faster.boostSpd, true);
  assert.equal(moves('freeze', 'stronger')[2].effect, 'frozen');
  assert.equal(moves('freeze', 'stronger')[3].boostAtk, true);
  assert.equal(moves('burn', 'tougher')[3].boostDef, true);
});

test('any type the game knows is allowed', () => {
  assert.equal(monsterFromCard(card({ type: 'dark' }), 1).type, 'dark');
});

test('refuses more than 10 stars', () => {
  assert.throws(() => monsterFromCard(card({ stars: { hp: 3, strong: 3, tough: 3, fast: 2 } }), 1), /11 stars/);
});

test('refuses more than 5 stars in a row', () => {
  assert.throws(() => monsterFromCard(card({ stars: { hp: 6, strong: 2, tough: 1, fast: 1 } }), 1), /hp/);
});

test('refuses a type the game does not know', () => {
  assert.throws(() => monsterFromCard(card({ type: 'banana' }), 1), /type "banana"/);
});

test('refuses a Trick the game does not know', () => {
  assert.throws(() => monsterFromCard(card({ powers: { ...card().powers, trick: { name: 'T', does: 'confuse' } } }), 1), /trick "confuse"/);
});

test('refuses a Trick or Save-Me that only matches a built-in object property', () => {
  assert.throws(() => monsterFromCard(card({ powers: { ...card().powers, trick: { name: 'T', does: 'constructor' } } }), 1), /trick "constructor"/);
  assert.throws(() => monsterFromCard(card({ powers: { ...card().powers, saveMe: { name: 'S', does: 'toString' } } }), 1), /save-me "toString"/);
});

test('refuses names that are not text', () => {
  assert.throws(() => monsterFromCard(card({ name: { text: 'Probe' } }), 1), /name must be text/);
  assert.throws(() => monsterFromCard(card({ powers: { ...card().powers, bigHit: { name: 'Chomp' } } }), 1), /Big Hit name must be text/);
});

test('refuses a missing name', () => {
  assert.throws(() => monsterFromCard(card({ name: '' }), 1), /missing name/);
});
