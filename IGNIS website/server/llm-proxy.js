// Minerva local server: serves the static site and proxies POST /api/generate
// to a Gemma model running on RunPod behind vLLM (OpenAI-compatible API).
// The page builds the full prompt (scenario, evidence, output format); this
// server only forwards it, so the page's existing "Ask MINERVA AI" flow is reused.
//
// Env vars:
//   RUNPOD_BASE_URL  e.g. https://<pod-id>-8000.proxy.runpod.net/v1   (required for AI)
//   LLM_MODEL        default google/gemma-3-27b-it (must match the vLLM --model flag)
//   LLM_API_KEY      optional, only if vLLM was started with --api-key
//   PORT             default 8765
// Run: node server/llm-proxy.js   (from the "IGNIS website" folder)

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8765;
const HOST = process.env.HOST || '127.0.0.1';  // 0.0.0.0 inside Docker
const AI_ENGINE_URL = (process.env.AI_ENGINE_URL || '').replace(/\/+$/, '');  // e.g. http://ai-engine:8000
const BASE = (process.env.RUNPOD_BASE_URL || '').replace(/\/+$/, '');
const MODEL = process.env.LLM_MODEL || 'google/gemma-3-27b-it';
const KEY = process.env.LLM_API_KEY || '';
const MAX_PROMPT = 12000;

const SYSTEM = `Follow the user's instructions exactly. Base every claim on the RECORDED RUNS in the prompt. Never write that there is no evidence while runs are listed; compare the parameters that match and state what differs. Use only numbers given in the prompt. Plain text only: no LaTeX, no markdown.`;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'
};

function send(res, code, body, type = 'application/json') {
  const isBinary = Buffer.isBuffer(body) || typeof body === 'string';
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(isBinary ? body : JSON.stringify(body));
}

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { req.destroy(); reject(new Error('body too large')); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function callModel(prompt) {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt }
      ]
    }),
    signal: AbortSignal.timeout(90000)
  });
  if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);
  const j = await r.json();
  return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
}

async function handleGenerate(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { error: 'invalid request body' }); }
  const prompt = body && body.prompt;
  if (typeof prompt !== 'string' || prompt.length < 50 || prompt.length > MAX_PROMPT) {
    return send(res, 400, { error: 'prompt must be a string of 50 to 12000 characters' });
  }
  try {
    if (AI_ENGINE_URL) {
      // Docker/compose: hand the prompt to the ai-engine service, which talks to the model via the OpenAI SDK.
      const r = await fetch(`${AI_ENGINE_URL}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }), signal: AbortSignal.timeout(90000)
      });
      const j = await r.json().catch(() => ({}));
      return r.ok ? send(res, 200, j) : send(res, r.status, { error: j.error || 'AI unavailable', code: j.code || 'upstream' });
    }
    if (!BASE) return send(res, 503, { error: 'RUNPOD_BASE_URL is not set' });
    const text = await callModel(prompt);
    send(res, 200, { text, model: MODEL });
  } catch (e) {
    console.error('[generate]', e.message);
    send(res, 502, { error: 'model unavailable' });
  }
}

// Dataset Q&A: forwarded to the ai-engine /ask endpoint (needs AI_ENGINE_URL).
async function handleAsk(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { error: 'invalid request body' }); }
  const question = body && body.question;
  const topK = body && body.top_k == null ? 5 : body && body.top_k;
  if (typeof question !== 'string' || question.length < 3 || question.length > 500) {
    return send(res, 400, { error: 'question must be 3 to 500 characters' });
  }
  if (!Number.isInteger(topK) || topK < 1 || topK > 10) return send(res, 400, { error: 'top_k must be 1 to 10' });
  if (!AI_ENGINE_URL) return send(res, 503, { error: 'AI engine is not configured' });
  try {
    const r = await fetch(`${AI_ENGINE_URL}/ask`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, top_k: topK }), signal: AbortSignal.timeout(90000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return passError(r, res, 'AI unavailable');
    send(res, 200, j);
  } catch (e) {
    console.error('[ask]', e.message);
    send(res, 502, { error: 'AI unavailable' });
  }
}

// CSV header mapping: forwarded to the ai-engine /columns/map endpoint (needs AI_ENGINE_URL).
async function handleColumns(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { error: 'invalid request body' }); }
  const headers = body && body.headers;
  const ok = Array.isArray(headers) && headers.length >= 1 && headers.length <= 200 &&
    headers.every(h => typeof h === 'string' && h.length >= 1 && h.length <= 100);
  if (!ok) return send(res, 400, { error: 'headers must be 1 to 200 strings of 1 to 100 characters' });
  if (!AI_ENGINE_URL) return send(res, 503, { error: 'AI engine is not configured' });
  try {
    const r = await fetch(`${AI_ENGINE_URL}/columns/map`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, use_llm: body.use_llm !== false }), signal: AbortSignal.timeout(90000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return passError(r, res, 'mapping unavailable');
    send(res, 200, j);
  } catch (e) {
    console.error('[columns]', e.message);
    send(res, 502, { error: 'mapping unavailable' });
  }
}

// Pass an engine error through with its status and code. The engine already keeps details out of its messages.
async function passError(r, res, fallback) {
  const j = await r.json().catch(() => ({}));
  send(res, r.status, { error: j.error || fallback, code: j.code || 'upstream' });
}

// Word report for a scenario: forwarded to the ai-engine /report endpoint; the .docx is passed through.
async function handleReport(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { error: 'invalid request body' }); }
  const scenario = body && body.scenario;
  const narrative = body && body.narrative == null ? '' : body && body.narrative;
  if (!scenario || typeof scenario !== 'object') return send(res, 400, { error: 'scenario is required' });
  if (typeof narrative !== 'string' || narrative.length > 4000) return send(res, 400, { error: 'narrative must be a string of at most 4000 characters' });
  if (!AI_ENGINE_URL) return send(res, 503, { error: 'AI engine is not configured' });
  try {
    const r = await fetch(`${AI_ENGINE_URL}/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, narrative }), signal: AbortSignal.timeout(60000)
    });
    if (!r.ok) return passError(r, res, 'report unavailable');
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': r.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="minerva-scenario.docx"',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  } catch (e) {
    console.error('[report]', e.message);
    send(res, 502, { error: 'report unavailable' });
  }
}

// Coverage counts: forwarded to the ai-engine /coverage endpoint (needs AI_ENGINE_URL).
async function handleCoverage(res) {
  if (!AI_ENGINE_URL) return send(res, 503, { error: 'AI engine is not configured' });
  try {
    const r = await fetch(`${AI_ENGINE_URL}/coverage`, { signal: AbortSignal.timeout(30000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, 502, { error: 'coverage unavailable' });
    send(res, 200, j);
  } catch (e) {
    console.error('[coverage]', e.message);
    send(res, 502, { error: 'coverage unavailable' });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (p.startsWith('/server/')) return send(res, 404, 'not found', 'text/plain');
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
  });
}

// Per-client rate limit for the endpoints that spend model credits. Fixed window, in memory.
// Behind nginx, the client address comes from X-Forwarded-For (nginx sets it); otherwise the socket address.
const RATE = { windowMs: 60_000, limits: { '/api/generate': 20, '/api/ask': 30, '/api/report': 10, '/api/columns/map': 30 } };
const hits = new Map();
function rateLimited(req, route) {
  const limit = RATE.limits[route];
  if (!limit) return false;
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.socket.remoteAddress || 'unknown';
  const key = `${ip}|${route}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start >= RATE.windowMs) { hits.set(key, { start: now, count: 1 }); return false; }
  entry.count += 1;
  return entry.count > limit;
}
setInterval(() => {  // keep the map small
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start >= RATE.windowMs) hits.delete(k);
}, RATE.windowMs).unref();

http.createServer((req, res) => {
  if (req.method === 'POST' && RATE.limits[req.url] && rateLimited(req, req.url)) {
    return send(res, 429, { error: 'too many requests, try again in a minute' });
  }
  if (req.method === 'POST' && req.url === '/api/generate') return handleGenerate(req, res);
  if (req.method === 'POST' && req.url === '/api/ask') return handleAsk(req, res);
  if (req.method === 'POST' && req.url === '/api/columns/map') return handleColumns(req, res);
  if (req.method === 'POST' && req.url === '/api/report') return handleReport(req, res);
  if (req.method === 'GET' && req.url === '/api/coverage') return handleCoverage(res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  send(res, 405, 'method not allowed', 'text/plain');
}).listen(PORT, HOST, () => {
  console.log(`Minerva running at http://${HOST}:${PORT}`);
  console.log(AI_ENGINE_URL ? `AI via ai-engine at ${AI_ENGINE_URL}` : `AI model: ${MODEL} via ${BASE || '(RUNPOD_BASE_URL not set)'}`);
});
