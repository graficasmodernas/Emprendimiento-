// Public Meta ingress only. No sending or model execution in the webhook.
const PAGE_ID = '1388984880973050';
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
export function createHandler({getEnv,fetcher=fetch}) {
  async function db(path,options={}) {
    const base=getEnv('SUPABASE_URL');
    let key;try{key=JSON.parse(getEnv('SUPABASE_SECRET_KEYS')||'{}').default;}catch{}
    key ||=getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if(!base||!key)throw new Error('config');
    const headers={'apikey':key,...options.headers};
    if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
    const res=await fetcher(base+'/rest/v1/'+path,{...options,headers,redirect:'manual',signal:AbortSignal.timeout(10000)});
    if(!res.ok)throw new Error('database');return res;
  }
  return async function handler(req) {
    try {
      const url=new URL(req.url);
      if(req.method==='GET') {
        if(!url.searchParams.has('hub.mode'))return response(200,'ZORIANA Messenger receiver');
        for(const p of ['hub.mode','hub.verify_token','hub.challenge'])if(url.searchParams.getAll(p).length!==1)return response(400,'Invalid verification');
        const expected=getEnv('META_VERIFY_TOKEN')||'';
        if(expected.length<32)return response(503,'Verification not configured');
        const challenge=url.searchParams.get('hub.challenge');
        if(url.searchParams.get('hub.mode')!=='subscribe'||!challenge||challenge.length>256||!await equal(expected,url.searchParams.get('hub.verify_token')||''))return response(403,'Forbidden');
        return response(200,challenge);
      }
      if(req.method!=='POST')return response(405,'Method not allowed');
      const secret=getEnv('META_APP_SECRET');if(!secret)return response(503,'Receiver not configured');
      const sig=req.headers.get('x-hub-signature-256')||'';
      if(!/^sha256=[a-fA-F0-9]{64}$/.test(sig))return response(403,'Forbidden');
      const body=await readBounded(req);
      const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
      const bytes=Uint8Array.from(sig.slice(7).match(/../g),v=>parseInt(v,16));
      if(!await crypto.subtle.verify('HMAC',key,bytes,body))return response(403,'Forbidden');
      let data;try{data=JSON.parse(new TextDecoder().decode(body));}catch{return response(400,'Invalid JSON');}
      if(data.object!=='page'||!Array.isArray(data.entry))return response(400,'Invalid event');
      const rows=new Map();
      for(const entry of data.entry) {
        if(entry.id!==PAGE_ID||!Array.isArray(entry.messaging))continue;
        for(const event of entry.messaging) {
          const m=event.message;
          if(!m||m.is_echo||event.sender?.id===PAGE_ID||event.recipient?.id!==PAGE_ID)continue;
          if(typeof m.mid!=='string'||m.mid.length>512||!/^\d{1,32}$/.test(event.sender?.id||''))continue;
          const ts=event.timestamp;
          if(!Number.isSafeInteger(ts)||ts<0||ts>8640000000000000)continue;
          rows.set(m.mid,{page_id:PAGE_ID,message_id:m.mid,sender_id:event.sender.id,message_text:typeof m.text==='string'?m.text.slice(0,20000):null,has_attachments:Array.isArray(m.attachments)&&m.attachments.length>0,sent_at:new Date(ts).toISOString(),status:'pending'});
        }
      }
      if(rows.size)await db('zoriana_messenger_inbox?on_conflict=page_id,message_id',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([...rows.values()])});
      return response(200,'EVENT_RECEIVED');
    }catch(e){return response(e?.message==='large'?413:503,e?.message==='large'?'Payload too large':'Receiver temporarily unavailable');}
  };
}
