import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { createShopifyHandler } from './shopify.mjs';
import worker from '../worker/index.mjs';

const SHOP = 'zoriana-test.myshopify.com';
const ORIGIN = 'https://zoriana-test.example';
const TOKEN = 'fixture-token';
const ENV = {
  ZORIANA_ADMIN_ORIGIN: ORIGIN, ZORIANA_SHOPIFY_SHOP: SHOP,
  SHOPIFY_CLIENT_ID: 'fixture-client', SHOPIFY_CLIENT_SECRET: 'fixture-secret',
  SUPABASE_PUBLISHABLE_KEY: 'fixture-key'
};
const HEADERS = { Origin: ORIGIN, Authorization: 'Bearer fixture.session',
  'oai-authenticated-user-id': 'visitor-a' };

function setup() {
  let upstream;
  let owner = 'owner-a';
  const reads = [];
  const handle = createShopifyHandler(async (url, options) => {
    if (url.includes('/auth/v1/user')) return Response.json({ id: owner });
    if (url.includes('/rest/v1/')) return Response.json([{ user_id: owner }]);
    assert.equal(new URL(url).hostname, SHOP);
    if (url.endsWith('/oauth/access_token')) {
      return Response.json({ access_token: TOKEN, scope: 'read_orders,read_products', expires_in: 1000 });
    }
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers['X-Shopify-Access-Token'], TOKEN);
    const input = JSON.parse(options.body);
    assert.match(input.query, /^query\b/);
    reads.push(input);
    return upstream(input);
  });
  const post = (path, cookie, body = {}, headers = {}) => handle(new Request(ORIGIN + '/api/shopify/' + path, {
    method: 'POST', headers: { ...HEADERS, Cookie: cookie || '', ...headers }, body: JSON.stringify(body)
  }), ENV);
  async function oauth(sign = true) {
    const start = await post('start');
    const target = new URL((await start.json()).authorizationUrl);
    assert.equal(target.searchParams.get('scope'), 'read_orders,read_products');
    assert.equal(target.searchParams.get('redirect_uri'), ORIGIN + '/api/shopify/callback');
    const params = new URLSearchParams({
      code: 'fixture-code', shop: SHOP, state: target.searchParams.get('state'),
      timestamp: Math.floor(Date.now() / 1000)
    });
    params.sort();
    params.set('hmac', sign ? createHmac('sha256', ENV.SHOPIFY_CLIENT_SECRET).update(params.toString()).digest('hex') : '0'.repeat(64));
    return handle(new Request(ORIGIN + '/api/shopify/callback?' + params, {
      headers: { ...HEADERS, Cookie: start.headers.getSetCookie()[0].split(';')[0] }
    }), ENV);
  }
  return { post, oauth, reads, setUpstream: fn => { upstream = fn; }, setOwner: id => { owner = id; },
    async connect() {
      const response = await oauth();
      assert.equal(response.status, 303);
      const header = response.headers.getSetCookie()[0];
      assert.match(header, /HttpOnly; Secure; SameSite=Lax/);
      assert.ok(!header.includes(TOKEN));
      return header.split(';')[0];
    }
  };
}

test('signed OAuth and protected shop reads require matching owner, visitor and origin', async () => {
  const app = setup();
  assert.equal((await app.oauth(false)).status, 403);
  assert.equal((await (await app.post('orders')).json()).error, 'authorization_required');
  const cookie = await app.connect();
  assert.equal((await app.post('orders', cookie, {}, { Origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await app.post('orders', cookie, {}, { 'oai-authenticated-user-id': '' })).status, 401);
  assert.equal((await (await app.post('orders', cookie, {}, { 'oai-authenticated-user-id': 'visitor-b' })).json()).error, 'authorization_required');
  app.setOwner('owner-b');
  assert.equal((await (await app.post('orders', cookie)).json()).error, 'authorization_required');
  assert.equal(app.reads.length, 0);
});

test('orders expose minimal read-only data, keep newer duplicates and accept an opaque cursor', async () => {
  const app = setup();
  const cookie = await app.connect();
  const order = { id: 'gid://shopify/Order/1', name: '#1001', createdAt: '2026-11-19T13:00:00Z',
    updatedAt: '2026-11-19T14:00:00Z', displayFinancialStatus: 'PAID', displayFulfillmentStatus: 'UNFULFILLED',
    currentTotalPriceSet: { shopMoney: { amount: '50000.00', currencyCode: 'COP' } }, email: 'private@example.test' };
  app.setUpstream(({ variables }) => Response.json({ data: { orders: {
    nodes: variables.after ? [] : [order, { ...order, updatedAt: '2026-11-19T13:00:00Z', displayFinancialStatus: 'PENDING' }],
    pageInfo: { hasNextPage: !variables.after, endCursor: 'fixture-cursor' }
  } } }));
  const response = await app.post('orders', cookie);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  const page = await response.json();
  assert.deepEqual(page.rows, [{
    id: order.id, name: order.name, createdAt: order.createdAt, updatedAt: order.updatedAt,
    financialStatus: 'PAID', fulfillmentStatus: 'UNFULFILLED', total: '50000.00', currency: 'COP'
  }]);
  assert.ok(Number.isFinite(Date.parse(page.checkedAt)));
  assert.equal(page.nextCursor, 'fixture-cursor');
  assert.deepEqual((await (await app.post('orders', cookie, { after: page.nextCursor })).json()).rows, []);
  assert.deepEqual((await (await app.post('orders', cookie)).json()).rows, page.rows);
  assert.deepEqual(app.reads.map(read => read.variables.after), [null, 'fixture-cursor', null]);
  assert.doesNotMatch(app.reads[0].query, /customer|address|email|mutation/i);
});

test('catalogue returns product identity and status without writing stock', async () => {
  const app = setup();
  const cookie = await app.connect();
  const product = { id: 'gid://shopify/Product/1', title: 'Producto de prueba', status: 'ACTIVE' };
  app.setUpstream(() => Response.json({ data: { products: {
    nodes: [product, product], pageInfo: { hasNextPage: false, endCursor: null }
  } } }));
  assert.deepEqual((await (await app.post('products', cookie)).json()).rows, [product]);
  assert.match(app.reads[0].query, /products\(first:/);
});

test('cursor errors, expired authorization, throttling and denied scopes surface safely', async () => {
  const app = setup();
  const cookie = await app.connect();
  assert.equal((await app.post('orders', cookie, { after: {} })).status, 400);
  assert.equal(app.reads.length, 0);
  for (const [status, code] of [[401, 'authorization_required'], [403, 'shopify_access_denied'], [429, 'shopify_throttled']]) {
    app.setUpstream(() => new Response('private upstream detail', { status }));
    const response = await app.post('orders', cookie);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: code });
  }
  app.setUpstream(() => Response.json({ errors: [{ message: 'private detail', extensions: { code: 'ACCESS_DENIED' } }], data: { orders: null } }));
  assert.equal((await app.post('orders', cookie)).status, 403);
  app.setUpstream(() => Response.json({ data: { orders: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'same' } } } }));
  assert.equal((await app.post('orders', cookie, { after: 'same' })).status, 502);
});

test('built worker serves the Shopify component and blocks unauthenticated API calls', async () => {
  const docs = await worker.fetch(new Request(ORIGIN), ENV);
  assert.match(await docs.text(), /shopify-read\.js/);
  const script = await worker.fetch(new Request(ORIGIN + '/shopify-read.js'), ENV);
  assert.equal(script.status, 200);
  assert.match(await script.text(), /function renderShopifyList/);
  const api = await worker.fetch(new Request(ORIGIN + '/api/shopify/orders', { method: 'POST' }), ENV);
  assert.equal(api.status, 401);
});

test('OAuth uses the existing administration origin and retains the legacy Sites URL', async () => {
  const app = createShopifyHandler(async (url) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'authorized-owner' });
    return Response.json([{ user_id: 'authorized-owner' }]);
  });
  const env = { ...ENV, ZORIANA_ADMIN_ORIGIN: undefined, ZORIANA_SHOPIFY_SHOP: undefined };
  for (const origin of ['https://administracion.zoriana.shop', 'https://zoriana-vista-tienda.graficasmodernasas.chatgpt.site']) {
    const response = await app(new Request(origin + '/api/shopify/start', {
      method: 'POST', headers: { ...HEADERS, Origin: origin }
    }), env);
    assert.equal(response.status, 200);
    const target = new URL((await response.json()).authorizationUrl);
    assert.equal(target.searchParams.get('redirect_uri'), origin + '/api/shopify/callback');
  }
  const origin = 'https://elsewhere.example';
  const response = await app(new Request(origin + '/api/shopify/start', {
    method: 'POST', headers: { ...HEADERS, Origin: origin }
  }), env);
  assert.equal(response.status, 403);
});
