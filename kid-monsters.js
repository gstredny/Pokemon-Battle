// Every Monster Card the kids have drawn, newest last. The kid draws and names
// it; the type, stars and powers are picked to match what they said it can do.
// card-rules.js turns each one into a Pokemon. How to add one: README.md.
//
// Shape of one card:
// {
//   slug: 'blaze-jaw', name: 'Blaze Jaw', madeBy: 'Sam', type: 'fire', cry: 'dragon',
//   stars: { hp: 3, strong: 3, tough: 2, fast: 2 },
//   powers: {
//     bigHit: 'Lava Chomp', fastHit: 'Spark Nip',
//     trick: { name: 'Smoke Puff', does: 'sleep' },
//     saveMe: { name: 'Snack Time', does: 'heal' },
//   },
// }
globalThis.KID_CARDS = [
  // "It can fly. It can peck you, blow wind at you, and escape very quickly.
  // It'll be hard to attack, so very fast."
  {
    slug: 'swortos', name: 'Swortos', madeBy: 'Daddy', type: 'flying', cry: 'bird',
    stars: { hp: 1, strong: 3, tough: 1, fast: 5 },
    powers: {
      bigHit: 'Mega Peck', fastHit: 'Gust',
      trick: { name: 'Icy Wind', does: 'freeze' },
      saveMe: { name: 'Zoom Away', does: 'faster' },
    },
  },
  // "Obviously an electric Pokemon. It's also very fast; it can kind of shock you."
  {
    slug: 'legtro', name: 'Legtro', madeBy: 'Daddy', type: 'electric', cry: 'dragon',
    stars: { hp: 2, strong: 3, tough: 1, fast: 4 },
    powers: {
      bigHit: 'Mega Shock', fastHit: 'Spark Tail',
      trick: { name: 'Static Wrap', does: 'zap' },
      saveMe: { name: 'Recharge', does: 'heal' },
    },
  },
  // "Very slow but very very strong, hard to defeat because he's a rock, and
  // he can throw rocks."
  {
    slug: 'mega', name: 'Mega', madeBy: 'Daddy', type: 'rock', cry: 'rock',
    stars: { hp: 2, strong: 5, tough: 3, fast: 0 },
    powers: {
      bigHit: 'Boulder Throw', fastHit: 'Pebble Toss',
      trick: { name: 'Rock Trap', does: 'zap' },
      saveMe: { name: 'Stone Wall', does: 'tougher' },
    },
  },
];
