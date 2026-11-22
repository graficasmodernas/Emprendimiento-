import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHandler } from './handler.mjs';

const token = 'x'.repeat(48);
const revision = 'cbccb0c3-00f5-4013-868b-dd24151834ac';
const adminJwt = 'abc.' + Buffer.from(JSON.stringify({ role: 'authenticated' })).toString('base64url') + '.abc';

function fixture({ automatic = false, owner = true, accepted = true, failure = false, receivedAt } = {}) {
  const config = { automatic, revision, instructions: 'Pregunta solo por los datos que faltan.',
    automatic_since: '2026-01-01T00:00:00Z' };
  const row = { status: 'pending', message_id: 'mid.test', sender_id: '123',
    message_text: '¿Envían a Cali?', received_at: receivedAt || new Date().toISOString(),
    sent_at: receivedAt || new Date().toISOString(), corrected: false };
  const graph = [];
  const env = {
    SUPABASE_SERVICE_ROLE_KEY: 'test-role', SUPABASE_URL: 'https://test.example',
    ZORIANA_OLLAMA_WORKER_TOKEN: token, META_PAGE_ACCESS_TOKEN: 'page-token',
  };
  const fetcher = async (url, options) => {
    const target = new URL(url);
    if (target.hostname === 'graph.facebook.com') {
      graph.push(JSON.parse(options.body));
      if (failure) throw new Error('timeout');
      return accepted ? Response.json({ message_id: 'outbound' }) :
        Response.json({ error: { code: 200 } }, { status: 403 });
    }
    const isSettings = target.pathname.endsWith('_settings');
    const params = target.searchParams;
    if (isSettings && options.headers.apikey === 'sb_publishable_test' && !owner) return Response.json([]);
    const value = isSettings ? config : row;
    const filters = ['status', 'corrected', 'revision', 'automatic'];
    for (const field of filters) {
      const query = params.get(field);
      if (query?.startsWith('eq.') && String(value[field]) !== query.slice(3)) return Response.json([]);
      if (query?.startsWith('in.(') && !query.slice(4, -1).split(',').includes(String(value[field]))) return Response.json([]);
    }
    if (options.method === 'PATCH') Object.assign(value, JSON.parse(options.body));
    return Response.json([value]);
  };
  const handle = createHandler({ getEnv: (name) => env[name], fetcher });
  async function call(payload, asOwner = false) {
    const response = await handle(new Request('https://test.example', {
      method: 'POST', headers: {
        authorization: 'Bearer ' + (asOwner ? adminJwt : token),
        ...(asOwner && { apikey: 'sb_publishable_test' }),
      }, body: JSON.stringify({ id: 'mid.test', ...payload }),
    }));
    return { http: response.status, ...await response.json() };
  }
  return { call, row, graph, config };
}

test('mode starts in drafts; owner can correct and send explicitly', async () => {
  const { call, row, graph } = fixture();
  assert.equal((await call({ action: 'finish', revision, answer: '¿En qué ciudad?' })).status, 'draft');
  assert.equal(graph.length, 0);
  assert.equal((await call({ action: 'correct', answer: '¿Qué producto te interesa?' }, true)).http, 200);
  assert.equal(row.example_text, '¿Qué producto te interesa?');
  assert.equal((await call({ action: 'send', answer: '¿Qué producto te interesa?' }, true)).status, 'sent');
  assert.equal(graph[0].message.text, '¿Qué producto te interesa?');
  assert.equal(row.outbound_id, 'outbound');
  assert.equal((await call({ action: 'send', answer: 'Otro' }, true)).http, 409);
  assert.equal(graph.length, 1);
});

test('explicit automatic mode, matching revision and fresh message are required', async () => {
  for (const [supplied, receivedAt, expected] of [
    [revision, null, 'sent'], [undefined, null, 'draft'],
    ['old-revision', null, 'draft'], [revision, '2025-01-01T00:00:00Z', 'draft'],
  ]) {
    const { call, graph } = fixture({ automatic: true, receivedAt });
    assert.equal((await call({ action: 'finish', revision: supplied, answer: 'Hola' })).status, expected);
    assert.equal(graph.length, expected === 'sent' ? 1 : 0);
  }
});

test('owner settings reject a stale revision and access by another account', async () => {
  const { call, config } = fixture();
  assert.equal((await call({ action: 'settings', revision: 'stale', instructions: 'Hola', automatic: true }, true)).http, 409);
  assert.equal((await call({ action: 'settings', revision, instructions: 'Hola', automatic: true }, true)).http, 200);
  assert.equal(config.automatic, true);
  const denied = fixture({ owner: false });
  assert.equal((await denied.call({ action: 'send', answer: 'Hola' }, true)).http, 403);
  assert.equal(denied.graph.length, 0);
});

test('ambiguous Meta delivery is not retried', async () => {
  const { call, graph, row } = fixture({ failure: true });
  assert.equal((await call({ action: 'send', answer: 'Hola' }, true)).status, 'failed');
  assert.equal(row.delivery_error, 'unknown');
  assert.equal((await call({ action: 'send', answer: 'Hola' }, true)).http, 409);
  assert.equal(graph.length, 1);
});

test('worker picks up editable instructions and corrections; a requested regeneration stays a draft', async () => {
  const { call, graph, row } = fixture({ automatic: true });
  row.status = 'draft';
  assert.equal((await call({ action: 'correct', answer: 'Ejemplo revisado' }, true)).status, 'draft');
  assert.equal((await call({ action: 'generate' }, true)).status, 'pending');
  const next = await call({ action: 'next', protocol: 2 });
  assert.match(next.instructions, /datos que faltan/);
  assert.equal(next.examples[0].reply, 'Ejemplo revisado');
  assert.equal((await call({ action: 'finish', revision, answer: 'Hola' })).status, 'draft');
  assert.equal(graph.length, 0);
});
