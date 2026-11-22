import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('Pedidos Shopify merges overlapping pages and preserves the last successful read on a temporary error', async () => {
  const source = readFileSync(new URL('../dist/shopify-read.js', import.meta.url), 'utf8');
  const node = (tag, text, onclick) => ({
    tag, textContent: text, onclick, isConnected: true, children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren() { this.children = []; },
    setAttribute() {}, removeAttribute() {}
  });
  const root = node('root');
  const old = { id: 'gid://shopify/Order/1', name: '#1001', financialStatus: 'PENDING', updatedAt: '2026-11-19T10:00:00Z' };
  const fresh = { ...old, financialStatus: 'PAID', updatedAt: '2026-11-19T11:00:00Z' };
  const checkedAt = '2026-11-19T12:00:00Z';
  const responses = [
    { rows: [fresh], nextCursor: 'next', checkedAt },
    { rows: [old, { ...fresh, id: 'gid://shopify/Order/2', name: '#1002' }], nextCursor: null, checkedAt },
    { error: 'shopify_throttled' },
    { error: 'authorization_required' }
  ];
  const cursors = [];
  const context = {
    ownerId: 'owner', element: node, btn: (text, fn) => node('button', text, fn),
    client: { auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) } },
    AbortSignal,
    fetch: async (path, options) => {
      assert.equal(path, '/api/shopify/orders');
      cursors.push(JSON.parse(options.body).after);
      return Response.json(responses.shift());
    },
    table: (target, headers, rows) => target.append(node('table', JSON.stringify(rows))),
    empty: (target, text) => target.append(node('p', text))
  };
  runInNewContext(source + "\nrenderShopifyList(root, 'orders');", { ...context, root });
  await new Promise(resolve => setImmediate(resolve));
  const [, , controls, status, stamp, results] = root.children[0].children;
  const [refresh, more, connect] = controls.children;
  assert.equal(more.hidden, false);
  await more.onclick();
  assert.deepEqual(JSON.parse(results.children[0].textContent).map(row => [row[0], row[2]]),
    [['#1001', 'Pagado'], ['#1002', 'Pagado']]);
  assert.equal(more.hidden, true);
  const savedStamp = stamp.textContent;
  await refresh.onclick();
  assert.match(status.textContent, /limitó las consultas/);
  assert.equal(stamp.textContent, savedStamp);
  assert.equal(results.children.length, 1);
  await refresh.onclick();
  assert.equal(results.children.length, 0);
  assert.equal(connect.hidden, false);
  assert.deepEqual(cursors, [null, 'next', null, null]);
});
