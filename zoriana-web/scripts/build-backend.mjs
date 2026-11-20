import {readFile,writeFile,mkdir} from 'node:fs/promises';
const assets={};
for(const name of ['index.html','admin.css','obsidian-memory.js','nexus-auxiliares.js','messenger.js','shopify-read.js']) assets['/'+name]=await readFile('dist/'+name,'utf8');
for (const name of ['zoriana-ollama.mjs', 'zoriana-ollama-obsidian.mjs']) {
  assets['/descargas/' + name] = await readFile('scripts/' + name, 'utf8');
}
// An isolated bundle must point at a separate Supabase project.
const devUrl = process.env.ZORIANA_DEV_SUPABASE_URL;
const devKey = process.env.ZORIANA_DEV_SUPABASE_PUBLISHABLE_KEY;
const productionSupabase = 'https://lfivgvovbrpkxwviullh.supabase.co';
if (devUrl || devKey) {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(devUrl || '') || devUrl === productionSupabase ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(devKey || '')) {
    throw new Error('Usa un proyecto Supabase separado y su clave publicable.');
  }
  for (const path of Object.keys(assets)) assets[path] = assets[path].replaceAll(productionSupabase, devUrl);
  assets['/index.html'] = assets['/index.html'].replace(/"sb_publishable_[A-Za-z0-9_-]+"/, JSON.stringify(devKey));
}
let backend=(await readFile('backend/shopify.mjs','utf8')).replace('export function createShopifyHandler','function createShopifyHandler').replace('export default {fetch:createShopifyHandler()};','');
if (devUrl) {
  backend = backend.replace(productionSupabase, devUrl).replace(
    'const shop = env.ZORIANA_SHOPIFY_SHOP || SHOP;',
    `if (!env.ZORIANA_SHOPIFY_SHOP || env.ZORIANA_SHOPIFY_SHOP === SHOP ||
        !env.ZORIANA_ADMIN_ORIGIN || env.ZORIANA_ADMIN_ORIGIN === ORIGIN ||
        env.ZORIANA_ADMIN_ORIGIN === CUSTOM_ORIGIN ||
        env.SUPABASE_PUBLISHABLE_KEY !== ${JSON.stringify(devKey)}) {
      return reply(503, {error: 'credentials_not_configured'});
    }
    const shop = env.ZORIANA_SHOPIFY_SHOP;`);
}
const wrapper=`\nconst assets=${JSON.stringify(assets)};\nconst verify=createShopifyHandler();\nexport default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/')){if(!request.headers.get('oai-authenticated-user-id'))return reply(401,{error:'platform_sign_in_required'});return verify(request,env)}if(!['GET','HEAD'].includes(request.method))return reply(405,{error:'method_not_allowed'});const path=url.pathname==='/'?'/index.html':url.pathname;if(!(path in assets))return reply(404,{error:'not_found'});const type=path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript';return new Response(request.method==='HEAD'?null:assets[path],{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(path.startsWith('/descargas/') ? {'Content-Disposition':'attachment; filename='+path.split('/').pop()} : {})}})}};`;
await mkdir('worker',{recursive:true});await writeFile('worker/index.mjs',backend+wrapper);await mkdir('dist/server',{recursive:true});await writeFile('dist/server/index.js',backend+wrapper);
console.log('Worker prepared locally; hosting manifest unchanged; no secrets embedded.');
