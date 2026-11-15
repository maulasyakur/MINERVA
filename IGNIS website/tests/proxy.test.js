// Tests for server/llm-proxy.js. Runs offline: the AI engine is replaced by a local stub server.
// Run from "IGNIS website":  node --test tests/proxy.test.js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

function startStub() {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      calls.push({ url: req.url, body: raw ? JSON.parse(raw) : {} });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url === '/ask') return res.end(JSON.stringify({ answer: 'stub answer', sources: [{ row_index: 1 }] }));
      if (req.url === '/columns/map') return res.end(JSON.stringify({ mapping: { o2: 'O2 (%)' }, method: 'rules' }));
      res.writeHead(404);
      res.end();
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () =>
    resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}` })));
}

function freePort() {
  return new Promise(resolve => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

function startProxy(port, env) {
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'llm-proxy.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('proxy did not start')), 10000);
    child.stdout.on('data', d => { if (String(d).includes('running')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', code => reject(new Error(`proxy exited with ${code}`)));
  });
}

async function post(base, route, body) {
  const r = await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

let stub, proxy, noEngine, base, baseNoEngine;

before(async () => {
  stub = await startStub();
  const port = await freePort();
  proxy = await startProxy(port, { AI_ENGINE_URL: stub.url });
  base = `http://127.0.0.1:${port}`;
  const port2 = await freePort();
  noEngine = await startProxy(port2, { AI_ENGINE_URL: '' });
  baseNoEngine = `http://127.0.0.1:${port2}`;
});

after(() => {
  proxy?.kill();
  noEngine?.kill();
  stub?.server.close();
});

test('ask forwards a valid question to the AI engine', async () => {
  const r = await post(base, '/api/ask', { question: 'Which runs used PMMA?', top_k: 3 });
  assert.equal(r.status, 200);
  assert.equal(r.json.answer, 'stub answer');
  const call = stub.calls.find(c => c.url === '/ask');
  assert.deepEqual(call.body, { question: 'Which runs used PMMA?', top_k: 3 });
});

test('ask rejects a short question and an out-of-range top_k', async () => {
  assert.equal((await post(base, '/api/ask', { question: 'ab' })).status, 400);
  assert.equal((await post(base, '/api/ask', { question: 'valid question', top_k: 99 })).status, 400);
  assert.equal((await post(base, '/api/ask', 'not json')).status, 400);
});

test('ask returns 503 when no AI engine is configured', async () => {
  const r = await post(baseNoEngine, '/api/ask', { question: 'Which runs used PMMA?' });
  assert.equal(r.status, 503);
});

test('columns map forwards valid headers and returns the mapping', async () => {
  const r = await post(base, '/api/columns/map', { headers: ['O2 (%)', 'Material'] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.mapping, { o2: 'O2 (%)' });
  const call = stub.calls.find(c => c.url === '/columns/map');
  assert.deepEqual(call.body.headers, ['O2 (%)', 'Material']);
});

test('columns map rejects empty or oversized header lists', async () => {
  assert.equal((await post(base, '/api/columns/map', { headers: [] })).status, 400);
  assert.equal((await post(base, '/api/columns/map', { headers: ['x'.repeat(101)] })).status, 400);
  assert.equal((await post(base, '/api/columns/map', { headers: Array(201).fill('a') })).status, 400);
});

test('model-backed routes are rate limited per client', async () => {
  // columns/map allows 30 per minute per client; 40 quick requests must hit the limit.
  const statuses = [];
  for (let i = 0; i < 40; i++) {
    statuses.push((await post(base, '/api/columns/map', { headers: ['O2 (%)'] })).status);
  }
  assert.ok(statuses.includes(429), 'expected at least one 429');
  assert.equal(statuses[statuses.length - 1], 429);
});

test('static server does not serve the proxy source', async () => {
  const r = await fetch(`${base}/server/llm-proxy.js`);
  assert.equal(r.status, 404);
});
