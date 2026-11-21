// WhatsApp test ingress. Acknowledges events only after draft storage.
const LIMIT = 1024 * 1024;
const enc = new TextEncoder();
const response = (status, text) => new Response(text, {status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function equal(a,b) {
  const digest=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(v)));
  const [x,y]=await Promise.all([digest(a),digest(b)]);
  let diff=0; for(let i=0;i<x.length;i++)diff|=x[i]^y[i]; return diff===0;
}
async function readBounded(req) {
  if(Number(req.headers.get('content-length'))>LIMIT)throw new Error('large');
  const reader=req.body?.getReader(); if(!reader)return new Uint8Array();
  const chunks=[];let size=0;
  try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT){await reader.cancel();throw new Error('large');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}

function draftFor(text) {
  const normalized = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (/\b(asesor[ae]?|humano|persona|reclamo|reclamacion|devolucion)\b/u.test(normalized)) {
    return { draft: 'Gracias por escribirnos. Un asesor puede ayudarte con tu solicitud.', needs_human: true };
  }
  if (/\b(pedido|guia|seguimiento|rastreo)\b/u.test(normalized)) {
    return { draft: 'Con gusto te ayudamos a revisar el envío. ¿Cuál es tu número de pedido?', needs_human: true };
  }
  return {
    draft: 'Hola, gracias por escribir a Zoriana. Puedes ver nuestro catálogo en https://zoriana.shop. Cuéntanos qué producto te interesa o cómo podemos ayudarte.',
    needs_human: false,
  };
}

export function createHandler({ getEnv, fetcher = fetch, replyScope }) {
  return async function handler(req) {
    try {
      const params = new URL(req.url).searchParams;
      if (req.method === 'GET') {
        const token = getEnv('WHATSAPP_VERIFY_TOKEN') || '';
        const challenge = params.get('hub.challenge');
        if (token.length < 32) return response(503, 'Verification unavailable');
        if (params.get('hub.mode') !== 'subscribe' || !/^\d{1,64}$/.test(challenge || '')
            || !await equal(token, params.get('hub.verify_token') || '')) {
          return response(403, 'Forbidden');
        }
        return response(200, challenge);
      }
      if (req.method !== 'POST') return response(405, 'Method not allowed');

      const secret = getEnv('WHATSAPP_APP_SECRET');
      const numberId = getEnv('WHATSAPP_PHONE_NUMBER_ID');
      const allowedSender = getEnv('WHATSAPP_TEST_SENDER');
      if (!secret || !numberId || !allowedSender) return response(503, 'Receiver unavailable');
      const signature = req.headers.get('x-hub-signature-256') || '';
      if (!/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return response(403, 'Forbidden');
      const body = await readBounded(req);
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const digest = Uint8Array.from(signature.slice(7).match(/../g), pair => parseInt(pair, 16));
      if (!await crypto.subtle.verify('HMAC', key, digest, body)) return response(403, 'Forbidden');

      let data;
      try { data = JSON.parse(new TextDecoder().decode(body)); }
      catch { return response(400, 'Invalid JSON'); }
      if (data?.object !== 'whatsapp_business_account' || !Array.isArray(data.entry)) {
        return response(400, 'Invalid event');
      }

      const drafts = new Map();
      for (const entry of data.entry) {
        for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
          const value = change?.value;
          if (change?.field !== 'messages' || value?.metadata?.phone_number_id !== numberId
              || !Array.isArray(value.messages)) continue;
          for (const message of value.messages) {
            if (message?.from !== allowedSender || message.type !== 'text'
                || typeof message.id !== 'string' || !message.id || message.id.length > 512
                || typeof message.text?.body !== 'string' || !message.text.body.trim()) continue;
            drafts.set(message.id, { phone_number_id: numberId, message_id: message.id, ...draftFor(message.text.body) });
          }
        }
      }
      if (!drafts.size) return response(200, 'EVENT_RECEIVED');

      const base = getEnv('SUPABASE_URL');
      let dbKey;
      try { dbKey = JSON.parse(getEnv('SUPABASE_SECRET_KEYS') || '{}').default; } catch {}
      dbKey ||= getEnv('SUPABASE_SERVICE_ROLE_KEY');
      if (!base || !dbKey) return response(503, 'Storage unavailable');
      const canReply = base === replyScope?.projectUrl && numberId === replyScope?.phoneNumberId;
      const accessToken = canReply ? getEnv('WHATSAPP_ACCESS_TOKEN')?.trim() : '';
      const headers = {
        apikey: dbKey, 'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=' + (accessToken ? 'representation' : 'minimal'),
      };
      if (!dbKey.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + dbKey;
      const result = await fetcher(base + '/rest/v1/zoriana_whatsapp_test_drafts?on_conflict=phone_number_id,message_id', {
        method: 'POST', headers, body: JSON.stringify([...drafts.values()]),
        redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (!result.ok) return response(503, 'Storage unavailable');
      if (canReply && !accessToken) console.warn('WhatsApp test reply skipped: access token missing');
      if (accessToken) {
        // Only the invocation that inserted a new draft may attempt its reply.
        for (const row of await result.json()) {
          try {
            const sent = await fetcher('https://graph.facebook.com/v27.0/' + numberId + '/messages', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: allowedSender,
                type: 'text',
                text: { body: row.draft },
              }),
              redirect: 'error',
              signal: AbortSignal.timeout(5000),
            });
            const receipt = await sent.json();
            if (sent.ok && receipt.messages?.[0]?.id) {
              console.info('WhatsApp test reply accepted by Meta');
            } else {
              const code = Number.isInteger(receipt.error?.code) ? receipt.error.code : 'unknown';
              console.warn('WhatsApp test reply rejected', sent.status, code);
            }
          } catch {
            // An ambiguous send is never automatically repeated.
            console.warn('WhatsApp test reply outcome unknown');
          }
        }
      }
      return response(200, 'EVENT_RECEIVED');
    } catch (error) {
      return error?.message === 'large' ? response(413, 'Payload too large') : response(503, 'Receiver unavailable');
    }
  };
}
