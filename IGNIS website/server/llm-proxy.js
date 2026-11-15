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
      return send(res, r.ok ? 200 : r.status === 503 ? 503 : 502, r.ok ? j : { error: 'model unavailable' });
    }
    if (!BASE) return send(res, 503, { error: 'RUNPOD_BASE_URL is not set' });
    const text = await callModel(prompt);
    send(res, 200, { text, model: MODEL });
  } catch (e) {
    console.error('[generate]', e.message);
    send(res, 502, { error: 'model unavailable' });
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

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') return handleGenerate(req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  send(res, 405, 'method not allowed', 'text/plain');
}).listen(PORT, HOST, () => {
  console.log(`Minerva running at http://${HOST}:${PORT}`);
  console.log(AI_ENGINE_URL ? `AI via ai-engine at ${AI_ENGINE_URL}` : `AI model: ${MODEL} via ${BASE || '(RUNPOD_BASE_URL not set)'}`);
});
