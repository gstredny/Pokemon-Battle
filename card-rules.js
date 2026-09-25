// Turns one Monster Card record into a Pokemon the battle can use.
// index.html loads this as a plain script; the Node tests require it.
(function () {
  // Every type index.html has colors and sounds for.
  const TYPES = ['fire', 'water', 'grass', 'electric', 'rock', 'psychic', 'ghost', 'fighting', 'fairy', 'normal', 'dragon', 'ice', 'flying', 'poison', 'ground', 'bug', 'steel', 'dark'];
  // Cries index.html knows how to play.
  const CRIES = ['mouse', 'dragon', 'canine', 'bird', 'turtle', 'frog', 'ghost', 'psychic', 'fighter', 'beast', 'rock', 'whale', 'fairy', 'plant', 'bug'];
  const STATS = ['hp', 'atk', 'def', 'spd'];
  // Most points one monster may have, so a sibling battle stays fair (Mewtwo has 480).
  const MAX_POINTS = 425;
  // What each Trick does in battle.
  const TRICK_EFFECTS = { burn: 'burn', freeze: 'frozen', zap: 'paralysis', poison: 'poison', sleep: 'sleep' };
  // What each Save-Me does in battle. copy turns into the foe, like Ditto's Transform.
  // A heal gives back 30%, not half: kids tap at random, and half made kid
  // monsters heal faster than they were hurt (see tests/card-rules.test.js).
  const SAVE_ME_FIELDS = { heal: { heal: 30 }, stronger: { boostAtk: true }, tougher: { boostDef: true }, faster: { boostSpd: true }, copy: { transform: true } };
  // What can surround a monster in the 3D battle, for a kid who drew it that way.
  const AURAS = ['flames'];

  // Records are typed in by hand, so check one before it can break the game.
  function checkCard(card) {
    const problems = [];
    const needText = (value, label) => {
      if (value === undefined || value === '') problems.push(`missing ${label}`);
      else if (typeof value !== 'string') problems.push(`${label} must be text`);
    };
    if (!/^[a-z0-9-]+$/.test(card.slug || '')) problems.push('slug must be lowercase letters, numbers and dashes');
    needText(card.name, 'name');
    needText(card.madeBy, 'madeBy');
    if (!TYPES.includes(card.type)) problems.push(`type "${card.type}" is not a game type`);
    if (!CRIES.includes(card.cry)) problems.push(`cry "${card.cry}" is not a known cry`);
    const stats = card.stats || {};
    for (const stat of STATS) {
      if (!Number.isInteger(stats[stat]) || stats[stat] < 1 || stats[stat] > 250) problems.push(`${stat} must be a whole number from 1 to 250`);
    }
    const total = STATS.reduce((sum, stat) => sum + (stats[stat] || 0), 0);
    if (total > MAX_POINTS) problems.push(`${total} points, only ${MAX_POINTS} allowed`);
    const powers = card.powers || {};
    needText(powers.bigHit, 'Big Hit name');
    needText(powers.fastHit, 'Fast Hit name');
    needText(powers.trick?.name, 'Trick name');
    if (!Object.hasOwn(TRICK_EFFECTS, powers.trick?.does)) problems.push(`trick "${powers.trick?.does}" is not a known Trick`);
    needText(powers.saveMe?.name, 'Save-Me name');
    if (!Object.hasOwn(SAVE_ME_FIELDS, powers.saveMe?.does)) problems.push(`save-me "${powers.saveMe?.does}" is not a known Save-Me`);
    if (card.aura !== undefined && !AURAS.includes(card.aura)) problems.push(`aura "${card.aura}" is not a known aura`);
    if (problems.length) throw new Error(`${typeof card.name === 'string' && card.name || card.slug}: ${problems.join('; ')}`);
  }

  function monsterFromCard(card, id) {
    checkCard(card);
    const { type, stats, powers } = card;
    return {
      id, name: card.name, madeBy: card.madeBy, type, cry: card.cry,
      hp: stats.hp, atk: stats.atk, def: stats.def, spd: stats.spd,
      img: `monsters/${card.slug}.png`,
      // Built in Blender from the picture (dev/monsters/); the 3D battle falls back to the picture.
      model: `models/monsters/${card.slug}.glb`,
      aura: card.aura,
      attacks: [
        { name: powers.bigHit, power: 110, accuracy: 75, type },
        { name: powers.fastHit, power: 40, accuracy: 100, type, priority: true },
        // A Trick hits too, and does its trick half the time, so a random tap still hurts.
        { name: powers.trick.name, power: 60, accuracy: 100, type, effect: TRICK_EFFECTS[powers.trick.does], effectChance: 50 },
        { name: powers.saveMe.name, power: 0, accuracy: 100, type, ...SAVE_ME_FIELDS[powers.saveMe.does] },
      ],
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { monsterFromCard };
  else window.monsterFromCard = monsterFromCard;
})();
