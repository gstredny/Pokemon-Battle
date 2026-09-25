const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { monsterFromCard } = require('../card-rules.js');
require('../kid-monsters.js');

const root = path.join(__dirname, '..');
const assets = JSON.parse(fs.readFileSync(path.join(root, 'assets.json'), 'utf8'));
const cards = globalThis.KID_CARDS;
const drawings = cards.map((card, i) => monsterFromCard(card, 1000 + i).img);

test('every kid card has its own slug', () => {
  const slugs = cards.map(c => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('every drawing is on disk', () => {
  for (const file of drawings) assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);
});

test('every drawing is cached for offline play', () => {
  for (const file of drawings) assert.ok(assets.includes(file), `${file} is not in assets.json`);
});

test('the card scripts are cached for offline play', () => {
  for (const file of ['card-rules.js', 'kid-monsters.js']) assert.ok(assets.includes(file), `${file} is not in assets.json`);
});
