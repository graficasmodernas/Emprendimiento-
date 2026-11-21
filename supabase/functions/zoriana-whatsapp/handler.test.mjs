import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createHandler } from './handler.mjs';

const env = {
  WHATSAPP_VERIFY_TOKEN: 'v'.repeat(32),
  WHATSAPP_APP_SECRET: 'simulated-secret',
  WHATSAPP_PHONE_NUMBER_ID: '100',
  WHATSAPP_TEST_SENDER: '57000',
  SUPABASE_URL: 'https://db.example.test',
  SUPABASE_SERVICE_ROLE_KEY: 'simulated-key',
};
const url = 'https://example.test/webhook';

function event(from = '57000', number = '100') {
  const message = { id: 'test-id', from, type: 'text', text: { body: '¿Dónde está mi guía?' } };
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: number }, messages: [message, message],
    } }] }],
  });
}

function request(body, signature = createHmac('sha256', env.WHATSAPP_APP_SECRET).update(body).digest('hex')) {
  return new Request(url, { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=' + signature } });
}

function handler(fetcher) {
  return createHandler({ getEnv: key => env[key], fetcher });
}

test('verifies the Meta challenge only with the configured token', async () => {
  const handle = handler();
  const query = '?hub.mode=subscribe&hub.challenge=123&hub.verify_token=';
  assert.equal(await (await handle(new Request(url + query + env.WHATSAPP_VERIFY_TOKEN))).text(), '123');
  assert.equal((await handle(new Request(url + query + 'invalid'))).status, 403);
});

test('rejects bad signatures and ignores unexpected senders or recipients', async () => {
  const handle = handler(() => assert.fail('storage should not be called'));
  assert.equal((await handle(request(event(), '0'.repeat(64)))).status, 403);
  assert.equal((await handle(request(event('57001')))).status, 200);
  assert.equal((await handle(request(event('57000', '101')))).status, 200);
});

test('stores one draft per message with conflict protection and flags tracking for human review', async () => {
  const handle = handler((target, options) => {
    assert.match(target, /on_conflict=phone_number_id,message_id$/);
    assert.match(options.headers.Prefer, /ignore-duplicates/);
    const rows = JSON.parse(options.body);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].needs_human, true);
    assert.match(rows[0].draft, /número de pedido/);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['draft', 'message_id', 'needs_human', 'phone_number_id']);
    return new Response(null, { status: 201 });
  });
  assert.equal((await handle(request(event()))).status, 200);
});

test('asks Meta to retry when storage fails', async () => {
  const handle = handler(() => new Response(null, { status: 500 }));
  assert.equal((await handle(request(event()))).status, 503);
});

test('sends only newly inserted replies within the configured test scope', async () => {
  let stored = [];
  let sends = 0;
  const handle = createHandler({
    getEnv: key => key === 'WHATSAPP_ACCESS_TOKEN' ? 'fake-access-token' : env[key],
    replyScope: { projectUrl: env.SUPABASE_URL, phoneNumberId: '100' },
    fetcher(target, options) {
      if (target.startsWith(env.SUPABASE_URL)) {
        assert.match(options.headers.Prefer, /return=representation/);
        const fresh = stored.length ? [] : JSON.parse(options.body);
        stored.push(...fresh);
        return Response.json(fresh);
      }
      assert.equal(target, 'https://graph.facebook.com/v27.0/100/messages');
      assert.equal(options.headers.Authorization, 'Bearer fake-access-token');
      assert.equal(JSON.parse(options.body).to, env.WHATSAPP_TEST_SENDER);
      assert.equal(JSON.parse(options.body).text.body, stored[0].draft);
      sends++;
      return Response.json({ messages: [{ id: 'fake-id' }] });
    },
  });
  assert.equal((await handle(request(event()))).status, 200);
  assert.equal((await handle(request(event()))).status, 200);
  assert.equal((await handle(request(event('57001')))).status, 200);
  assert.equal(sends, 1);
});
