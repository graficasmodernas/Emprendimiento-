const page = '1388984880973050';
const inbox = 'zoriana_messenger_inbox';
const settings = 'zoriana_messenger_settings';
const ownerFields = 'automatic,instructions,revision,automatic_since';
const origins = new Set([
  'https://administracion.zoriana.shop',
  'https://zoriana-vista-tienda.graficasmodernasas.chatgpt.site',
]);
const timeout = (ms = 10000) => ({ signal: AbortSignal.timeout(ms), redirect: 'error' });
const clean = (value) => typeof value === 'string' ? value.trim() : '';
const earliest = () => new Date(Date.now() - 23.9 * 60 * 60 * 1000).toISOString();

async function matches(a, b) {
  const encoder = new TextEncoder();
  const hash = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
  const [left, right] = await Promise.all([hash(a), hash(b)]);
  return left.reduce((diff, byte, index) => diff | (byte ^ right[index]), 0) === 0;
}

export function createHandler({ getEnv, fetcher = fetch }) {
  async function db(table, params, { patch, owner } = {}) {
    const key = owner?.apikey || JSON.parse(getEnv('SUPABASE_SECRET_KEYS') || '{}').default ||
      getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const headers = { apikey: key };
    if (owner) headers.Authorization = owner.token;
    else if (!key.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + key;
    if (patch) Object.assign(headers, { 'Content-Type': 'application/json', Prefer: 'return=representation' });
    const query = new URLSearchParams({ page_id: 'eq.' + page, ...params });
    const response = await fetcher(getEnv('SUPABASE_URL') + '/rest/v1/' + table + '?' + query, {
      headers, method: patch ? 'PATCH' : 'GET', body: patch && JSON.stringify(patch), ...timeout(),
    });
    if (owner && [401, 403].includes(response.status)) return [];
    if (!response.ok) throw new Error('Database request failed');
    return response.json();
  }

  async function deliver(filter, text, states, correction, automaticRevision) {
    const token = getEnv('META_PAGE_ACCESS_TOKEN');
    const version = getEnv('META_GRAPH_API_VERSION') || 'v25.0';
    if (!token || !/^v\d+\.0$/.test(version)) return { status: 'unconfigured' };
    const [claimed] = await db(inbox, {
      ...filter, status: 'in.(' + states + ')', sent_at: 'gte.' + earliest(),
    }, { patch: { status: 'sending', response_text: text, delivery_error: null } });
    if (!claimed) return { status: 'unavailable' };
    const sending = { ...filter, status: 'eq.sending' };
    if (automaticRevision) {
      const [current] = await db(settings, { automatic: 'eq.true', revision: 'eq.' + automaticRevision });
      if (!current) {
        await db(inbox, sending, { patch: { status: 'draft', response_text: null } });
        return { status: 'draft' };
      }
    }

    let outboundId;
    let error = 'unknown';
    try {
      const response = await fetcher('https://graph.facebook.com/' + version + '/' + page + '/messages', {
        method: 'POST', ...timeout(),
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: claimed.sender_id }, messaging_type: 'RESPONSE', message: { text } }),
      });
      const payload = await response.json();
      if (response.ok) outboundId = clean(payload.message_id);
      else if (response.status < 500 && payload.error) error = 'meta_' + (Number(payload.error.code) || response.status);
    } catch {
      // An ambiguous delivery requires checking Messenger before sending again.
    }

    const patch = outboundId ? { status: 'sent', outbound_id: outboundId } :
      { status: 'failed', delivery_error: error };
    if (outboundId && correction) Object.assign(patch, { example_text: text, corrected: true, corrected_at: new Date().toISOString() });
    await db(inbox, sending, { patch });
    return { status: patch.status, delivery_error: patch.delivery_error };
  }

  async function complete(filter, answer, revision) {
    const [row] = await db(inbox, { ...filter, status: 'eq.pending' }, {
      patch: { status: answer ? 'draft' : 'human', suggestion: answer },
    });
    if (!row) return { status: 'already_handled' };
    if (answer && !row.draft_only && clean(revision)) {
      const [config] = await db(settings, { select: ownerFields });
      if (config?.automatic && config.revision === revision &&
          Date.parse(row.received_at) >= Date.parse(config.automatic_since) &&
          Date.parse(row.sent_at) >= Date.parse(config.automatic_since)) {
        const result = await deliver(filter, answer, 'draft', false, revision);
        if (result.status !== 'unconfigured') return result;
      }
    }
    return { status: row.status };
  }

  async function context() {
    const [[config], examples] = await Promise.all([
      db(settings, { select: ownerFields }),
      db(inbox, {
        corrected: 'eq.true', order: 'corrected_at.desc', limit: '8',
        select: 'message_text,example_text',
      }),
    ]);
    return {
      instructions: config.instructions,
      revision: config.revision,
      examples: examples.map((example) => ({
        message: clean(example.message_text).slice(0, 500), reply: clean(example.example_text),
      })),
    };
  }

  return async (req) => {
    const origin = req.headers.get('origin');
    const cors = origins.has(origin) ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
      'Access-Control-Allow-Methods': 'POST,OPTIONS', Vary: 'Origin',
    } : {};
    const reply = (status, data) => Response.json(data, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
    if (req.method === 'OPTIONS' && origins.has(origin)) return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
    const token = req.headers.get('authorization') || '';
    if (!token.startsWith('Bearer ')) return reply(401, { error: 'Unauthorized' });
    try {
      const secret = getEnv('ZORIANA_OLLAMA_WORKER_TOKEN') || '';
      const worker = secret.length >= 32 && await matches(token, 'Bearer ' + secret);
      let config;
      if (!worker) {
        const apikey = req.headers.get('apikey');
        // Use the configured publishable key. A caller-supplied elevated API key must never grant owner access.
        if (!token.match(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/) || !apikey?.startsWith('sb_publishable_')) {
          return reply(403, { error: 'Owner access required' });
        }
        let role;
        try {
          const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
          role = JSON.parse(atob(base64)).role;
        } catch { return reply(403, { error: 'Owner access required' }); }
        if (role !== 'authenticated') return reply(403, { error: 'Owner access required' });
        [config] = await db(settings, { select: ownerFields }, { owner: { apikey, token } });
        if (!config) return reply(403, { error: 'Owner access required' });
      }
      const raw = await req.text();
      if (raw.length > 16000) return reply(413, { error: 'Request too large' });
      let data;
      try { data = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON' }); }
      const { action, id, since, revision } = data || {};
      const answer = clean(data?.answer);
      if (worker && action === 'next') {
        const cutoff = earliest();
        const [message] = await db(inbox, {
          status: 'eq.pending', sent_at: 'gte.' + (data.protocol === 2 ? cutoff :
            new Date(Math.max(Date.parse(cutoff), Date.parse(since) || 0)).toISOString()), order: 'sent_at.asc', limit: '1',
          select: 'message_id,message_text,has_attachments',
        });
        return reply(200, message ? { message, ...await context() } : { message: null });
      }
      if (!worker && action === 'settings') {
        const instructions = clean(data.instructions);
        if (revision !== config.revision) return reply(409, { error: 'Settings changed. Reload.' });
        if (typeof data.automatic !== 'boolean' || typeof data.instructions !== 'string' || instructions.length > 4000) {
          return reply(400, { error: 'Invalid settings' });
        }
        const [updated] = await db(settings, { revision: 'eq.' + config.revision, select: ownerFields }, {
          patch: {
            instructions, automatic: data.automatic, revision: crypto.randomUUID(),
            automatic_since: data.automatic ? config.automatic_since || new Date().toISOString() : null,
          },
        });
        return updated ? reply(200, { settings: updated }) : reply(409, { error: 'Settings changed. Reload.' });
      }
      if (typeof id !== 'string' || !id || id.length > 512 || answer.length > 500) {
        return reply(400, { error: 'Invalid message' });
      }
      const filter = { message_id: 'eq.' + id };
      if (!worker && action === 'generate') {
        const [row] = await db(inbox, { ...filter, status: 'in.(human,draft)', sent_at: 'gte.' + earliest() }, {
          patch: { status: 'pending', suggestion: null, draft_only: true },
        });
        return row ? reply(200, { status: 'pending' }) : reply(409, { status: 'unavailable' });
      }
      if (worker && action === 'finish' && (data.answer === null || answer)) {
        return reply(200, await complete({ ...filter, sent_at: 'gte.' + earliest() }, answer || null, revision));
      }
      if (!worker && action === 'send' && answer) {
        const [row] = await db(inbox, filter);
        if (!row || ['sending', 'sent'].includes(row.status) ||
            (row.status === 'failed' && !row.delivery_error?.startsWith('meta_'))) {
          return reply(409, { error: 'Message unavailable for sending' });
        }
        const correction = data.learn === true && (!!answer && answer !== row.suggestion);
        const result = await deliver(filter, answer, row.status, correction);
        return reply(result.status === 'sent' ? 200 : 409, result);
      }
      if (!worker && action === 'correct' && answer) {
        const [row] = await db(inbox, { ...filter, status: 'in.(draft,human)' }, {
          patch: { status: 'draft', suggestion: answer, example_text: answer, corrected: true, corrected_at: new Date().toISOString() },
        });
        return row ? reply(200, { status: 'draft' }) : reply(409, { error: 'Message unavailable for correction' });
      }
      return reply(400, { error: 'Invalid action' });
    } catch {
      return reply(503, { error: 'Messenger temporarily unavailable' });
    }
  };
}
