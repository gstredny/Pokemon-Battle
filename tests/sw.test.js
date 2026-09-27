const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function worker(fetch) {
  const handlers = {};
  const added = [];
  const page = { page: true };
  const cache = { match: async () => null, add: async request => added.push(request) };
  const caches = {
    open: async () => cache,
    match: async request => request === 'index.html' ? page : null,
  };
  const context = vm.createContext({
    self: { addEventListener: (type, fn) => { handlers[type] = fn; } },
    caches, fetch, Request: class { constructor(url, options) { this.url = url; this.mode = options.mode; } }, console,
  });
  vm.runInContext(readFileSync('sw.js', 'utf8'), context);
  return { handlers, context, added, page };
}

test('offline cache saves boot libraries before optional assets', async () => {
  const { context, added } = worker(async () => ({ json: async () => ['index.html', 'battle3d.js'] }));
  await context.saveWholeGame();
  assert.deepEqual(added.slice(0, 3).map(request => request.url), [
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
  ]);
  assert.deepEqual(added.slice(0, 3).map(request => request.mode), ['cors', 'cors', 'cors']);
  assert.deepEqual(added.slice(3).map(request => request.url), ['index.html', 'battle3d.js']);
});

test('offline fallback serves the app for navigation, never for a missing script', async () => {
  const { handlers, page } = worker(async () => { throw Error('offline'); });
  const respond = request => {
    let response;
    handlers.fetch({ request, respondWith: promise => { response = promise; } });
    return response;
  };
  assert.equal(await respond({ method: 'GET', mode: 'navigate' }), page);
  await assert.rejects(respond({ method: 'GET', mode: 'cors' }), /offline/);
});
