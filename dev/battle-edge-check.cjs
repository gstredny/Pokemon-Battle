// Exercise the real battle callbacks without a browser when graphics are unavailable.
// Requires the @babel/standalone package used by dev/play-check.mjs.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/standalone');

const html = readFileSync(process.env.BATTLE_HTML || 'index.html', 'utf8');
const script = html.split('<script type="text/babel">')[1].split('</script>')[0];
const names = [...script.split('function PokemonBattle() {')[1].split('const scene3dRef')[0]
  .matchAll(/const \[(\w+), \w+\] = useState/g)].map(match => match[1]);
const exposed = script.replace('if (showVS) return', 'window.doAttackForCheck = doAttack; if (showVS) return') +
  '\nwindow.PokemonBattleForCheck = PokemonBattle; window.pokemonForCheck = POKEMON;';
const compiled = babel.transform(exposed, { presets: ['react'] }).code;

function battle(attackerName, defenderName, attackerHP, defenderHP, defenderStatus = null) {
  const states = [];
  const calls = {};
  const timers = [];
  let cursor = 0;
  let now = 0;
  const React = {
    Fragment: 'fragment', createElement: () => ({}),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => {
        states[index] = typeof value === 'function' ? value(states[index]) : value;
        const name = names[index];
        calls[name] = (calls[name] || 0) + 1;
      }];
    },
    useRef: value => ({ current: value }), useEffect: () => {},
  };
  const randomMath = Object.create(Math);
  randomMath.random = () => 0.5;
  const window = { innerWidth: 844, innerHeight: 390 };
  const context = vm.createContext({
    React, window, Math: randomMath, Date, console,
    KID_CARDS: [], Music: { muted: true }, Sounds: { play: () => false },
    document: { getElementById: () => ({}) },
    ReactDOM: { createRoot: () => ({ render() {} }) },
    setTimeout: (fn, delay) => { timers.push({ at: now + delay, fn }); },
    clearTimeout: () => {},
  });
  vm.runInContext(compiled, context);
  window.PokemonBattleForCheck(); // establish the component's initial state
  const find = name => window.pokemonForCheck.find(p => p.name === name);
  const attacker = find(attackerName), defender = find(defenderName);
  assert.ok(attacker && defender, 'fixture Pokemon exist');
  const set = (name, value) => { states[names.indexOf(name)] = value; };
  const get = name => states[names.indexOf(name)];
  set('phase', 'battle');
  set('trainer1', { name: 'Ash', color: '#fff' });
  set('trainer2', { name: 'Misty', color: '#fff' });
  set('player1Team', [attacker, attacker, attacker]);
  set('player2Team', [defender, defender, defender]);
  set('player1HP', attackerHP);
  set('player2HP', defenderHP);
  set('player2Status', [defenderStatus, null, null]);
  set('scene', { id: 'volcano' });
  cursor = 0;
  window.PokemonBattleForCheck();

  return {
    attack: name => window.doAttackForCheck(attacker.attacks.find(a => a.name === name)),
    get, calls, defender,
    advance(target) {
      while (timers.some(timer => timer.at <= target)) {
        timers.sort((a, b) => a.at - b.at);
        const timer = timers.shift();
        now = timer.at;
        timer.fn();
      }
      now = target;
    },
  };
}

const poisoned = battle('Pikachu', 'Mew', [100, 0, 0], [50, 0, 0], 'poison');
poisoned.attack('Quick Attack');
poisoned.advance(500);
const afterHit = poisoned.get('player2HP')[0];
poisoned.advance(1200);
assert.equal(poisoned.get('player2HP')[0], afterHit - Math.floor(poisoned.defender.hp / 8));
console.log('PASS: poison follows the hit without restoring HP');

const explosion = battle('Golem', 'Mew', [1, 0, 0], [1, 0, 0]);
explosion.attack('Explosion');
explosion.advance(3000);
assert.equal(explosion.get('winner'), 0);
assert.equal(explosion.get('phase'), 'gameover');
assert.equal(explosion.calls.winner, 1);
console.log('PASS: explosion knocks out both last Pokemon for one draw');

const recoil = battle('Arcanine', 'Mew', [1, 0, 0], [1, 0, 0]);
recoil.attack('Flare Blitz');
recoil.advance(3000);
assert.equal(recoil.get('winner'), 0);
assert.equal(recoil.calls.winner, 1);
console.log('PASS: recoil knocks out both last Pokemon for one draw');
