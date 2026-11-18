const page = '1388984880973050';
const inbox = 'zoriana_messenger_inbox';
const encoder = new TextEncoder();
const reply = (status, data) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function matches(a, b) {
  const hash = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
  const [left, right] = await Promise.all([hash(a), hash(b)]);
  return left.reduce((diff, byte, index) => diff | (byte ^ right[index]), 0) === 0;
}

export function createHandler({ getEnv, fetcher = fetch }) {
  async function db(params, patch) {
    const key = JSON.parse(getEnv('SUPABASE_SECRET_KEYS') || '{}').default || getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const headers = { apikey: key };
    if (!key.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + key;
    if (patch) Object.assign(headers, { 'Content-Type': 'application/json', Prefer: 'return=representation' });
    const query = new URLSearchParams({ page_id: 'eq.' + page, ...params });
    const result = await fetcher(getEnv('SUPABASE_URL') + '/rest/v1/' + inbox + '?' + query, {
      headers, method: patch ? 'PATCH' : 'GET', body: patch && JSON.stringify(patch),
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    if (!result.ok) throw new Error('Database request failed');
    return result.json();
  }

  return async (req) => {
    const secret = getEnv('ZORIANA_OLLAMA_WORKER_TOKEN') || '';
    const token = req.headers.get('authorization') || '';
    if (secret.length < 32 || !await matches(token, 'Bearer ' + secret)) return reply(401, { error: 'Unauthorized' });
    try {
      if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
      const { action, since, id, answer } = await req.json();
      const earliest = Date.now() - 23 * 60 * 60 * 1000;
      const cutoff = new Date(Math.max(earliest, Date.parse(since) || earliest)).toISOString();
      if (action === 'next') {
        const [message] = await db({
          status: 'eq.pending', sent_at: 'gte.' + cutoff, order: 'sent_at.asc', limit: '1',
          select: 'message_id,message_text,has_attachments',
        });
        return reply(200, { message: message || null });
      }
      if (action !== 'finish' || typeof id !== 'string' || !id || id.length > 512 ||
          (answer !== null && (typeof answer !== 'string' || !answer.trim() || answer.length > 500))) {
        return reply(400, { error: 'Invalid request' });
      }
      const pageToken = getEnv('META_PAGE_ACCESS_TOKEN');
      const version = getEnv('META_GRAPH_API_VERSION') || 'v25.0';
      if (answer && (!pageToken || !/^v\d+\.0$/.test(version))) return reply(503, { error: 'Messenger sending is not configured' });
      const filter = { message_id: 'eq.' + id };
      const [claimed] = await db({ ...filter, status: 'eq.pending', sent_at: 'gte.' + cutoff }, {
        status: answer ? 'draft' : 'human',
      });
      if (!claimed) return reply(200, { status: 'already_handled' });
      if (!answer) return reply(200, { status: 'human' });

      let status = 'failed';
      try {
        const result = await fetcher('https://graph.facebook.com/' + version + '/' + page + '/messages', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: { Authorization: 'Bearer ' + pageToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: { id: claimed.sender_id }, messaging_type: 'RESPONSE', message: { text: answer } }),
        });
        if (result.ok && (await result.json()).message_id) status = 'sent';
      } catch {
        // An ambiguous delivery stays out of the automatic retry queue.
      }
      await db({ ...filter, status: 'eq.draft' }, { status });
      return reply(200, { status });
    } catch {
      return reply(503, { error: 'Worker temporarily unavailable' });
    }
  };
}
