// Every element id that app.js looks up must exist in index.html. Catches a renamed or removed element
// before it reaches the browser as a null reference. Run: node --test tests/markup.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');

function idsInHtml() {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
}

function idsUsedByJs() {
  const ids = new Set();
  for (const m of js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)) ids.add(m[1]);
  for (const m of js.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)) ids.add(m[1]);
  return ids;
}

test('every element id used by app.js exists in index.html', () => {
  const present = idsInHtml();
  const missing = [...idsUsedByJs()].filter(id => !present.has(id)).sort();
  assert.deepEqual(missing, [], `ids used by app.js but missing from index.html: ${missing.join(', ')}`);
});

test('ids are unique in index.html', () => {
  const seen = new Map();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepEqual(dupes, [], `duplicate ids: ${dupes.join(', ')}`);
});

test('the scenario form and the dataset tools are wired', () => {
  for (const id of ['homeForm', 'askForm', 'csvHead', 'gapBtn', 'r-report', 'r-ai-btn']) {
    assert.ok(html.includes(`id="${id}"`), `${id} missing from index.html`);
  }
});
