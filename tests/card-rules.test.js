const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monsterFromCard } = require('../card-rules.js');

const card = (overrides = {}) => ({
  slug: 'blaze-jaw', name: 'Blaze Jaw', madeBy: 'Sam', type: 'fire', cry: 'dragon',
  stats: { hp: 155, atk: 100, def: 80, spd: 80 },
  powers: {
    bigHit: 'Lava Chomp', fastHit: 'Spark Nip',
    trick: { name: 'Smoke Puff', does: 'sleep' },
    saveMe: { name: 'Snack Time', does: 'heal' },
  },
  ...overrides,
});

test('stats are real numbers, like every other Pokemon', () => {
  const m = monsterFromCard(card(), 1000);
  assert.deepEqual([m.hp, m.atk, m.def, m.spd], [155, 100, 80, 80]);
});

test('allows up to 425 points in total', () => {
  const m = monsterFromCard(card({ stats: { hp: 175, atk: 135, def: 90, spd: 25 } }), 1);
  assert.equal(m.hp + m.atk + m.def + m.spd, 425);
});

test('the monster keeps its card details and drawing path', () => {
  const m = monsterFromCard(card(), 1000);
  assert.equal(m.id, 1000);
  assert.equal(m.name, 'Blaze Jaw');
  assert.equal(m.madeBy, 'Sam');
  assert.equal(m.type, 'fire');
  assert.equal(m.cry, 'dragon');
  assert.equal(m.img, 'monsters/blaze-jaw.png');
  assert.equal(m.model, 'models/monsters/blaze-jaw.glb');   // the 3D battle shows this, or the picture if it is missing
});

test('the four powers become the four moves', () => {
  const [big, fast, trick, save] = monsterFromCard(card(), 1).attacks;
  assert.deepEqual(big, { name: 'Lava Chomp', power: 110, accuracy: 75, type: 'fire' });
  assert.deepEqual(fast, { name: 'Spark Nip', power: 40, accuracy: 100, type: 'fire', priority: true });
  assert.deepEqual(trick, { name: 'Smoke Puff', power: 60, accuracy: 100, type: 'fire', effect: 'sleep', effectChance: 50 });
  assert.deepEqual(save, { name: 'Snack Time', power: 0, accuracy: 100, type: 'fire', heal: 30 });
});

// Kids tap moves at random. With a Trick that did no damage and a heal of
// half their health, kid monsters healed faster than they were hurt: in the
// battle simulator, three kid monsters against three others took a median of
// 154 moves, and 3 in 10 battles never ended (George, 2026-09-25: "none of them
// are dying"). A Trick that also hits, and a smaller heal, bring it to about 50.
test('a Trick hits as well as doing its trick, so every move but Save-Me hurts', () => {
  const [, , trick] = monsterFromCard(card(), 1).attacks;
  assert.ok(trick.power > 0);
});

test('power words map to battle effects', () => {
  const moves = (trickDoes, saveDoes) => monsterFromCard(card({ powers: { ...card().powers, trick: { name: 'T', does: trickDoes }, saveMe: { name: 'S', does: saveDoes } } }), 1).attacks;
  const [, , zap, faster] = moves('zap', 'faster');
  assert.equal(zap.effect, 'paralysis');
  assert.equal(zap.accuracy, 100);
  assert.equal(faster.boostSpd, true);
  assert.equal(moves('freeze', 'stronger')[2].effect, 'frozen');
  assert.equal(moves('freeze', 'stronger')[3].boostAtk, true);
  assert.equal(moves('burn', 'tougher')[3].boostDef, true);
  assert.equal(moves('zap', 'copy')[3].transform, true);
});

test('a monster drawn inside flames keeps them in the 3D battle', () => {
  assert.equal(monsterFromCard(card({ aura: 'flames' }), 1).aura, 'flames');
  assert.equal(monsterFromCard(card(), 1).aura, undefined);
  assert.throws(() => monsterFromCard(card({ aura: 'rainbow' }), 1), /aura "rainbow"/);
});

test('any type the game knows is allowed', () => {
  assert.equal(monsterFromCard(card({ type: 'dark' }), 1).type, 'dark');
});

test('refuses more than 425 points in total', () => {
  assert.throws(() => monsterFromCard(card({ stats: { hp: 176, atk: 135, def: 90, spd: 25 } }), 1), /426 points/);
});

test('refuses a stat that is not a whole number from 1 to 250', () => {
  assert.throws(() => monsterFromCard(card({ stats: { hp: 0, atk: 100, def: 80, spd: 80 } }), 1), /hp must be/);
  assert.throws(() => monsterFromCard(card({ stats: { hp: 155, atk: 99.5, def: 80, spd: 80 } }), 1), /atk must be/);
  assert.throws(() => monsterFromCard(card({ stats: { hp: 155, atk: 100, def: 80 } }), 1), /spd must be/);
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
