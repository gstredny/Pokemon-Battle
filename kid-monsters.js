// Every Monster Card the kids have drawn, newest last. The kid draws and names
// it; the type, stats and powers are picked to match what they said it can do.
// Stats are real numbers like every other Pokemon, at most 425 points in total.
// card-rules.js turns each one into a Pokemon. How to add one: README.md.
//
// Shape of one card:
// {
//   slug: 'blaze-jaw', name: 'Blaze Jaw', madeBy: 'Sam', type: 'fire', cry: 'dragon',
//   stats: { hp: 155, atk: 100, def: 80, spd: 80 },
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
    slug: 'swortos', name: 'Swortos', madeBy: 'George', type: 'flying', cry: 'bird',
    stats: { hp: 95, atk: 115, def: 55, spd: 160 },
    powers: {
      bigHit: 'Mega Peck', fastHit: 'Gust',
      trick: { name: 'Sky Grab', does: 'zap' },
      saveMe: { name: 'Zoom Away', does: 'faster' },
    },
  },
  // "Obviously an electric Pokemon. It's also very fast; it can kind of shock you."
  {
    slug: 'legtro', name: 'Legtro', madeBy: 'George', type: 'electric', cry: 'dragon',
    stats: { hp: 100, atk: 125, def: 65, spd: 135 },
    powers: {
      bigHit: 'Mega Shock', fastHit: 'Spark Tail',
      trick: { name: 'Static Wrap', does: 'zap' },
      saveMe: { name: 'Recharge', does: 'heal' },
    },
  },
  // "Very slow but very very strong, hard to defeat because he's a rock, and
  // he can throw rocks."
  {
    slug: 'mega', name: 'Mega', madeBy: 'George', type: 'rock', cry: 'rock',
    stats: { hp: 175, atk: 135, def: 90, spd: 25 },
    powers: {
      bigHit: 'Boulder Throw', fastHit: 'Pebble Toss',
      trick: { name: 'Rock Trap', does: 'zap' },
      saveMe: { name: 'Stone Wall', does: 'tougher' },
    },
  },
  // Dora: "Froggy is a grass Pokemon. He's very fast and has a strong kick."
  {
    slug: 'froggy', name: 'Froggy', madeBy: 'Dora', type: 'grass', cry: 'frog',
    stats: { hp: 90, atk: 125, def: 55, spd: 155 },
    powers: {
      bigHit: 'Mega Kick', fastHit: 'Leaf Hop',
      trick: { name: 'Sticky Tongue', does: 'zap' },
      saveMe: { name: 'Lily Pad Nap', does: 'heal' },
    },
  },
  // "An electric Pokemon, similar in power and ability to a Pikachu, but also
  // like a Ditto-ish Pokemon."
  {
    slug: 'allymon', name: 'Allymon', madeBy: 'Dora', type: 'electric', cry: 'mouse',
    stats: { hp: 95, atk: 60, def: 45, spd: 100 },
    powers: {
      bigHit: 'Thunder Squish', fastHit: 'Spark Hug',
      trick: { name: 'Jelly Zap', does: 'zap' },
      saveMe: { name: 'Copy Me', does: 'copy' },
    },
  },
  // "Also hard to hit, and a fire Pokemon."
  {
    slug: 'smore', name: 'S’more', madeBy: 'Dora', type: 'fire', cry: 'fairy',
    aura: 'flames',   // drawn inside a ring of fire; the 3D model burns the same way
    stats: { hp: 100, atk: 110, def: 75, spd: 140 },
    powers: {
      bigHit: 'Campfire Blast', fastHit: 'Ember Puff',
      trick: { name: 'Hot Goo', does: 'burn' },
      saveMe: { name: 'Toasty Shield', does: 'tougher' },
    },
  },
  // Georgie: "Whaley is a water Pokemon, he's big, not super fast, but can have
  // a big hit and it shoots sonic waves with its sound like whale sounds."
  {
    slug: 'whalley', name: 'Whalley', madeBy: 'Georgie', type: 'water', cry: 'whale',
    stats: { hp: 170, atk: 130, def: 85, spd: 40 },
    powers: {
      bigHit: 'Sonic Wave', fastHit: 'Water Splash',
      trick: { name: 'Whale Song', does: 'sleep' },
      saveMe: { name: 'Deep Breath', does: 'heal' },
    },
  },
  // "The grass Pokemon, it's kind of slow but it has like kind of a hypnosis
  // for type of attacks."
  {
    slug: 'grassmic', name: 'Grassmic', madeBy: 'Georgie', type: 'grass', cry: 'plant',
    stats: { hp: 140, atk: 100, def: 125, spd: 60 },
    powers: {
      bigHit: 'Leaf Storm', fastHit: 'Vine Whip',
      trick: { name: 'Hypno Leaves', does: 'sleep' },
      saveMe: { name: 'Sunshine Snack', does: 'heal' },
    },
  },
  // "Electric, similar to most electric Pokemon."
  {
    slug: 'alltrik', name: 'Alltrik', madeBy: 'Georgie', type: 'electric', cry: 'canine',
    stats: { hp: 100, atk: 115, def: 70, spd: 140 },
    powers: {
      bigHit: 'Thunder Spikes', fastHit: 'Spark Dash',
      trick: { name: 'Static Shock', does: 'zap' },
      saveMe: { name: 'Supercharge', does: 'stronger' },
    },
  },
];
