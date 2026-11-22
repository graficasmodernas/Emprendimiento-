const SHOP='wqa6y1-nv.myshopify.com';
const ORIGIN='https://zoriana-vista-tienda.graficasmodernasas.chatgpt.site';
const CUSTOM_ORIGIN='https://administracion.zoriana.shop';
const SUPABASE='https://lfivgvovbrpkxwviullh.supabase.co';
const SCOPES=['read_orders','read_products'];
const ALLOWED_SCOPES=new Set([...SCOPES,'write_app_proxy']);
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const MONEY_FIELDS = 'shopMoney { amount currencyCode }';
const READ_QUERIES = {
  orders: `query ZorianaOrders($after: String) {
    orders(first: 25, after: $after, sortKey: CREATED_AT, reverse: true) {
      nodes { id name createdAt updatedAt displayFinancialStatus displayFulfillmentStatus
        currentTotalPriceSet { ${MONEY_FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }`,
  products: `query ZorianaProducts($after: String) {
    products(first: 25, after: $after, sortKey: ID, reverse: true) {
      nodes { id title status }
      pageInfo { hasNextPage endCursor }
    }
  }`
};

async function readShopifyPage(request, timedFetch, shop, token, resource) {
  let after;
  try {
    const body = await request.text();
    if (body.length > 4096) return reply(400, { error: 'invalid_cursor' });
    after = JSON.parse(body || '{}')?.after ?? null;
  } catch {
    return reply(400, { error: 'invalid_cursor' });
  }
  if (after !== null && (typeof after !== 'string' || !after.length || after.length > 2048)) {
    return reply(400, { error: 'invalid_cursor' });
  }
  const response = await timedFetch('https://' + shop + '/admin/api/2026-10/graphql.json', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query: READ_QUERIES[resource], variables: { after } })
  });
  if (response.status === 401) return reply(401, { error: 'authorization_required' });
  if (response.status === 403) return reply(403, { error: 'shopify_access_denied' });
  if (response.status === 429) return reply(429, { error: 'shopify_throttled' });
  if (!response.ok) return reply(502, { error: 'shopify_read_failed' });

  const result = await response.json();
  if (result.errors?.length) {
    if (result.errors.some(e => e.extensions?.code === 'ACCESS_DENIED')) return reply(403, { error: 'shopify_access_denied' });
    if (result.errors.some(e => e.extensions?.code === 'THROTTLED')) return reply(429, { error: 'shopify_throttled' });
    return reply(502, { error: 'shopify_read_failed' });
  }
  const page = result.data?.[resource];
  const nextCursor = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
  const idPrefix = 'gid://shopify/' + (resource === 'orders' ? 'Order/' : 'Product/');
  if (!Array.isArray(page?.nodes) || typeof page.pageInfo?.hasNextPage !== 'boolean' ||
      (page.pageInfo.hasNextPage && (typeof nextCursor !== 'string' || !nextCursor || nextCursor === after)) ||
      page.nodes.some(row => typeof row?.id !== 'string' || !row.id.startsWith(idPrefix))) {
    return reply(502, { error: 'shopify_read_failed' });
  }
  const rows = new Map();
  for (const row of page.nodes) {
    const previous = rows.get(row.id);
    if (previous && String(previous.updatedAt) >= String(row.updatedAt)) continue;
    if (resource === 'orders') {
      rows.set(row.id, {
        id: row.id, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt,
        financialStatus: row.displayFinancialStatus, fulfillmentStatus: row.displayFulfillmentStatus,
        total: row.currentTotalPriceSet?.shopMoney?.amount,
        currency: row.currentTotalPriceSet?.shopMoney?.currencyCode
      });
    } else {
      rows.set(row.id, { id: row.id, title: row.title, status: row.status });
    }
  }
  return reply(200, { rows: [...rows.values()], nextCursor, checkedAt: new Date().toISOString() });
}

const encoder=new TextEncoder();
const cookie=(r,n)=>r.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(n+'='))?.slice(n.length+1);
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const unb64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function key(secret){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode('zoriana-oauth-v1:'+secret)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function seal(data,secret,name){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(name)},await key(secret),encoder.encode(JSON.stringify(data))))}
async function open(value,secret,name){try{const [iv,data]=value.split('.');const parsed=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:encoder.encode(name)},await key(secret),unb64(data))));return parsed.exp>Date.now()?parsed:null}catch{return null}}
const setCookie=(name,value,seconds)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
const ready=e=>Boolean(e.SHOPIFY_CLIENT_ID&&e.SHOPIFY_CLIENT_SECRET&&e.SUPABASE_PUBLISHABLE_KEY);
async function validHmac(url,secret){const raw=url.searchParams.get('hmac');if(!/^[a-f0-9]{64}$/i.test(raw||''))return false;const params=new URLSearchParams(url.search);params.delete('hmac');params.sort();const message=Array.from(params,([k,v])=>`${k}=${v}`).join('&');const k=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);return crypto.subtle.verify('HMAC',k,Uint8Array.from(raw.match(/../g),h=>parseInt(h,16)),encoder.encode(message))}
export function createShopifyHandler(fetcher=(url,options)=>globalThis.fetch(url,options)){
 async function timedFetch(url,options={},milliseconds=15000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),milliseconds);try{return await fetcher(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}
 async function owner(request,env){const auth=request.headers.get('Authorization')||'';if(!/^Bearer [\w.-]+$/.test(auth))return null;const headers={apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:auth};const options={headers,redirect:'manual'};const userResponse=await timedFetch(SUPABASE+'/auth/v1/user',options);if(!userResponse.ok)return null;const user=await userResponse.json();if(!user.id)return null;const access=await timedFetch(SUPABASE+'/rest/v1/emprendimiento_owner_access?select=user_id&user_id=eq.'+encodeURIComponent(user.id),options);if(!access.ok)return null;const rows=await access.json();return Array.isArray(rows)&&rows.some(r=>r.user_id===user.id)?user.id:null}
 return async(request,env)=>{const url=new URL(request.url),path=url.pathname,identity=request.headers.get('oai-authenticated-user-id');
 const shop = env.ZORIANA_SHOPIFY_SHOP || SHOP;
 const allowedOrigins = env.ZORIANA_ADMIN_ORIGIN ? [env.ZORIANA_ADMIN_ORIGIN] : [ORIGIN, CUSTOM_ORIGIN];
 const origin = url.origin;
 if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) return reply(503, {error:'credentials_not_configured'});
 const callback = origin + '/api/shopify/callback';
 if(!identity)return reply(401,{error:'platform_sign_in_required'});
 if(!['/api/shopify/start','/api/shopify/status','/api/shopify/callback','/api/shopify/orders','/api/shopify/products'].includes(path))return reply(404,{error:'not_found'});
 if(!allowedOrigins.includes(origin))return reply(403,{error:'origin_denied'});
 if(!ready(env))return reply(503,{connected:false,error:'credentials_not_configured'});
 try{
 if(path==='/api/shopify/callback'){
 if(request.method!=='GET')return reply(405,{error:'method_not_allowed'});
 for(const field of ['shop','state','code','hmac','timestamp'])if(url.searchParams.getAll(field).length!==1)return reply(400,{error:'invalid_callback'});
 const state=await open(cookie(request,'__Host-zoriana-state')||'',env.SHOPIFY_CLIENT_SECRET,'state');
 if(!state||state.visitor!==identity||(state.shop ?? SHOP)!==shop||state.nonce!==url.searchParams.get('state')||url.searchParams.get('shop')!==shop||!/^\d+$/.test(url.searchParams.get('timestamp'))||Math.abs(Date.now()/1000-Number(url.searchParams.get('timestamp')))>600||!await validHmac(url,env.SHOPIFY_CLIENT_SECRET))return reply(403,{error:'invalid_callback'});
 const response=await timedFetch('https://'+shop+'/admin/oauth/access_token',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.SHOPIFY_CLIENT_ID,client_secret:env.SHOPIFY_CLIENT_SECRET,code:url.searchParams.get('code'),expiring:'1'})});
 if(!response.ok)return reply(502,{error:'token_exchange_failed'});
 const token=await response.json(),scopes=String(token.scope||'').split(',').map(x=>x.trim());
 if(!token.access_token||SCOPES.some(s=>!scopes.includes(s))||scopes.some(s=>!ALLOWED_SCOPES.has(s)))return reply(403,{error:'unexpected_scopes'});
 const seconds=Math.min(Number(token.expires_in)||3600,86400);if(!(seconds>0))return reply(502,{error:'invalid_expiry'});
 const sealed=await seal({token:token.access_token,owner:state.owner,visitor:identity,shop,exp:Date.now()+seconds*1000},env.SHOPIFY_CLIENT_SECRET,'connection');
 const headers=new Headers({'Location':origin+'/#inicio','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});headers.append('Set-Cookie',setCookie('__Host-zoriana-connection',sealed,seconds));headers.append('Set-Cookie',setCookie('__Host-zoriana-state','',0));return new Response(null,{status:303,headers});
 }
 if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
 if(request.headers.get('Origin')!==origin)return reply(403,{error:'origin_denied'});
 const ownerId=await owner(request,env);if(!ownerId)return reply(403,{error:'owner_access_required'});
 if(path==='/api/shopify/start'){
 const nonce=b64(crypto.getRandomValues(new Uint8Array(32)));const state=await seal({nonce,owner:ownerId,visitor:identity,shop,exp:Date.now()+600000},env.SHOPIFY_CLIENT_SECRET,'state');
 const target=new URL('https://'+shop+'/admin/oauth/authorize');target.search=new URLSearchParams({client_id:env.SHOPIFY_CLIENT_ID,scope:SCOPES.join(','),redirect_uri:callback,state:nonce}).toString();
 const result=reply(200,{authorizationUrl:target.href});result.headers.append('Set-Cookie',setCookie('__Host-zoriana-state',state,600));return result;
 }
 const connection=await open(cookie(request,'__Host-zoriana-connection')||'',env.SHOPIFY_CLIENT_SECRET,'connection');
 if(!connection||connection.owner!==ownerId||connection.visitor!==identity||(connection.shop ?? SHOP)!==shop)return reply(200,{connected:false,error:'authorization_required'});
 if (path === '/api/shopify/orders' || path === '/api/shopify/products') {
   return await readShopifyPage(request, timedFetch, shop, connection.token, path.split('/').pop());
 }
 const response=await timedFetch('https://'+shop+'/admin/api/2026-10/graphql.json',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':connection.token},body:JSON.stringify({query:'query { shop { myshopifyDomain } }'})});
 if(!response.ok)return reply(502,{connected:false,error:'shopify_read_failed'});const result=await response.json();if(result.errors?.length||result.data?.shop?.myshopifyDomain!==shop)return reply(502,{connected:false,error:'shopify_verification_failed'});
 console.info(JSON.stringify({event:'shopify_verified',mode:'read_only'}));return reply(200,{connected:true,shop:shop,checkedAt:new Date().toISOString(),mode:'read_only'});
 } catch {
   console.error(JSON.stringify({event:'shopify_connection_error', route:path}));
   return reply(502,{connected:false,error:'connection_unavailable'});
 }
 };
}
export default {fetch:createShopifyHandler()};
