// Turns one Monster Card record into a Pokemon the battle can use.
// index.html loads this as a plain script; the Node tests require it.
(function () {
  // Every type index.html has colors and sounds for.
  const TYPES = ['fire', 'water', 'grass', 'electric', 'rock', 'psychic', 'ghost', 'fighting', 'fairy', 'normal', 'dragon', 'ice', 'flying', 'poison', 'ground', 'bug', 'steel', 'dark'];
  // Cries index.html knows how to play.
  const CRIES = ['mouse', 'dragon', 'canine', 'bird', 'turtle', 'frog', 'ghost', 'psychic', 'fighter', 'beast', 'rock', 'whale', 'fairy', 'plant', 'bug'];
  const STAR_ROWS = ['hp', 'strong', 'tough', 'fast'];
  // What each Trick does in battle.
  const TRICK_EFFECTS = { burn: 'burn', freeze: 'frozen', zap: 'paralysis', poison: 'poison', sleep: 'sleep' };
  // What each Save-Me does in battle.
  const SAVE_ME_FIELDS = { heal: { heal: 50 }, stronger: { boostAtk: true }, tougher: { boostDef: true }, faster: { boostSpd: true } };

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
    const stars = card.stars || {};
    for (const row of STAR_ROWS) {
      if (!Number.isInteger(stars[row]) || stars[row] < 0 || stars[row] > 5) problems.push(`${row} stars must be 0 to 5`);
    }
    const total = STAR_ROWS.reduce((sum, row) => sum + (stars[row] || 0), 0);
    if (total > 10) problems.push(`${total} stars, only 10 allowed`);
    const powers = card.powers || {};
    needText(powers.bigHit, 'Big Hit name');
    needText(powers.fastHit, 'Fast Hit name');
    needText(powers.trick?.name, 'Trick name');
    if (!Object.hasOwn(TRICK_EFFECTS, powers.trick?.does)) problems.push(`trick "${powers.trick?.does}" is not a known Trick`);
    needText(powers.saveMe?.name, 'Save-Me name');
    if (!Object.hasOwn(SAVE_ME_FIELDS, powers.saveMe?.does)) problems.push(`save-me "${powers.saveMe?.does}" is not a known Save-Me`);
    if (problems.length) throw new Error(`${typeof card.name === 'string' && card.name || card.slug}: ${problems.join('; ')}`);
  }

  function monsterFromCard(card, id) {
    checkCard(card);
    const { type, stars, powers } = card;
    return {
      id, name: card.name, madeBy: card.madeBy, type, cry: card.cry,
      hp: 80 + 25 * stars.hp,
      atk: 40 + 20 * stars.strong,
      def: 40 + 20 * stars.tough,
      spd: 40 + 20 * stars.fast,
      img: `monsters/${card.slug}.png`,
      attacks: [
        { name: powers.bigHit, power: 110, accuracy: 75, type },
        { name: powers.fastHit, power: 40, accuracy: 100, type, priority: true },
        { name: powers.trick.name, power: 0, accuracy: powers.trick.does === 'sleep' ? 75 : 90, type, effect: TRICK_EFFECTS[powers.trick.does], effectChance: 100 },
        { name: powers.saveMe.name, power: 0, accuracy: 100, type, ...SAVE_ME_FIELDS[powers.saveMe.does] },
      ],
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { monsterFromCard };
  else window.monsterFromCard = monsterFromCard;
})();
