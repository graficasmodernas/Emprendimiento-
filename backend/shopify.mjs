const SHOP='wqa6y1-nv.myshopify.com';
const ORIGIN='https://zoriana-vista-tienda.graficasmodernasas.chatgpt.site';
const SUPABASE='https://lfivgvovbrpkxwviullh.supabase.co';
const SCOPES=['read_orders','read_products'];
const CALLBACK=ORIGIN+'/api/shopify/callback';
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
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
 if(!identity)return reply(401,{error:'platform_sign_in_required'});
 if(!['/api/shopify/start','/api/shopify/status','/api/shopify/callback'].includes(path))return reply(404,{error:'not_found'});
 if(!ready(env))return reply(503,{connected:false,error:'credentials_not_configured'});
 try{
 if(path==='/api/shopify/callback'){
 if(request.method!=='GET')return reply(405,{error:'method_not_allowed'});
 for(const field of ['shop','state','code','hmac','timestamp'])if(url.searchParams.getAll(field).length!==1)return reply(400,{error:'invalid_callback'});
 const state=await open(cookie(request,'__Host-zoriana-state')||'',env.SHOPIFY_CLIENT_SECRET,'state');
 if(!state||state.visitor!==identity||state.nonce!==url.searchParams.get('state')||url.searchParams.get('shop')!==SHOP||Math.abs(Date.now()/1000-Number(url.searchParams.get('timestamp')))>600||!await validHmac(url,env.SHOPIFY_CLIENT_SECRET))return reply(403,{error:'invalid_callback'});
 const response=await timedFetch('https://'+SHOP+'/admin/oauth/access_token',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.SHOPIFY_CLIENT_ID,client_secret:env.SHOPIFY_CLIENT_SECRET,code:url.searchParams.get('code'),expiring:'1'})});
 if(!response.ok)return reply(502,{error:'token_exchange_failed'});
 const token=await response.json(),scopes=String(token.scope||'').split(',').map(x=>x.trim());
 if(!token.access_token||SCOPES.some(s=>!scopes.includes(s))||scopes.some(s=>!SCOPES.includes(s)))return reply(403,{error:'unexpected_scopes'});
 const seconds=Math.min(Number(token.expires_in)||3600,86400);if(!(seconds>0))return reply(502,{error:'invalid_expiry'});
 const sealed=await seal({token:token.access_token,owner:state.owner,visitor:identity,exp:Date.now()+seconds*1000},env.SHOPIFY_CLIENT_SECRET,'connection');
 const headers=new Headers({'Location':ORIGIN+'/#inicio','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});headers.append('Set-Cookie',setCookie('__Host-zoriana-connection',sealed,seconds));headers.append('Set-Cookie',setCookie('__Host-zoriana-state','',0));return new Response(null,{status:303,headers});
 }
 if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
 if(request.headers.get('Origin')!==ORIGIN)return reply(403,{error:'origin_denied'});
 const ownerId=await owner(request,env);if(!ownerId)return reply(403,{error:'owner_access_required'});
 if(path==='/api/shopify/start'){
 const nonce=b64(crypto.getRandomValues(new Uint8Array(32)));const state=await seal({nonce,owner:ownerId,visitor:identity,exp:Date.now()+600000},env.SHOPIFY_CLIENT_SECRET,'state');
 const target=new URL('https://'+SHOP+'/admin/oauth/authorize');target.search=new URLSearchParams({client_id:env.SHOPIFY_CLIENT_ID,scope:SCOPES.join(','),redirect_uri:CALLBACK,state:nonce}).toString();
 const result=reply(200,{authorizationUrl:target.href});result.headers.append('Set-Cookie',setCookie('__Host-zoriana-state',state,600));return result;
 }
 const connection=await open(cookie(request,'__Host-zoriana-connection')||'',env.SHOPIFY_CLIENT_SECRET,'connection');
 if(!connection||connection.owner!==ownerId||connection.visitor!==identity)return reply(200,{connected:false,error:'authorization_required'});
 const response=await timedFetch('https://'+SHOP+'/admin/api/2026-10/graphql.json',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':connection.token},body:JSON.stringify({query:'query { shop { myshopifyDomain } }'})});
 if(!response.ok)return reply(502,{connected:false,error:'shopify_read_failed'});const result=await response.json();if(result.errors?.length||result.data?.shop?.myshopifyDomain!==SHOP)return reply(502,{connected:false,error:'shopify_verification_failed'});
 console.info(JSON.stringify({event:'shopify_verified',mode:'read_only'}));return reply(200,{connected:true,shop:SHOP,checkedAt:new Date().toISOString(),mode:'read_only'});
 }catch(error){let detail=String(error?.message||'Unknown failure');for(const secret of [env.SHOPIFY_CLIENT_SECRET,env.SHOPIFY_CLIENT_ID,env.SUPABASE_PUBLISHABLE_KEY,request.headers.get('Authorization')])if(secret)detail=detail.split(secret).join('[redacted]');detail=detail.replace(/https?:\/\/[^\s]+/g,'[url]').replace(/[A-Za-z0-9_-]{24,}/g,'[redacted]').slice(0,240);console.error(JSON.stringify({event:'shopify_connection_error',detail,route:path,errorType:typeof error?.name==='string'?error.name:'Error',reason:['Illegal invocation','Invalid URL','Failed to fetch','fetch failed','not a function','Invalid invocation','disallowed','Network connection lost'].find(x=>String(error?.message).includes(x))||'unclassified'}));return reply(502,{connected:false,error:'connection_unavailable'})}
 };
}
export default {fetch:createShopifyHandler()};
