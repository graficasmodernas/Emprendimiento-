/* Memoria local de Emprendimiento IA para Obsidian y Ollama.
   Respaldo limitado a Oficinas IA/<usuario>; sin publicar notas ni secretos. */
(function () {
  "use strict";
  const OFFICES=Object.freeze([
    {agent:"ATLAS",folder:"Gerencia",color:"#9165E8"},
    {agent:"NEXUS",folder:"Investigación",color:"#4B91EB"},
    {agent:"PIXEL",folder:"Marketing",color:"#EF75B5"},
    {agent:"CLOSER",folder:"Ventas",color:"#45B985"},
    {agent:"LOGIX",folder:"Pedidos",color:"#EE9C4B"},
    {agent:"VÉRTICE",folder:"Finanzas",color:"#E6C34A"}
  ]);
  const MAX_FILES=180,MAX_FILE_BYTES=24000,MAX_RESULTS=3,MAX_CONTEXT_CHARS=3500;
  const STOP=new Set(["para","como","donde","cuando","sobre","quiero","puedes","hacer","dame","esta","este","cual","desde","entre","tengo","tiene","todo","todos","todas","nuestro","nuestra","ahora","despues","necesito","proyecto","oficina","emprendimiento","consulta"]);
  function normalize(v){return String(v||"").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
  function terms(v){return [...new Set(normalize(v).match(/[a-z0-9]{4,}/g)||[])].filter(w=>!STOP.has(w)).slice(0,18);}
  function validOwner(id){if(!/^[a-zA-Z0-9_-]{6,80}$/.test(String(id||"")))throw Error("Identificador de usuario no válido.");return String(id);}
  function officeFor(office){
    if(Number.isInteger(office)&&office>=0&&office<OFFICES.length)return OFFICES[office];
    const q=normalize(office);
    return OFFICES.find(o=>normalize(o.agent)===q||normalize(o.folder)===q)||OFFICES[0];
  }
  function safeTitle(v){
    let s=String(v||"").replace(/[\r\n]+/g," ").replace(/[<>:"/\\|?*\x00-\x1f]/g," ").replace(/\[\[|\]\]/g,"").replace(/\s+/g," ").replace(/[. ]+$/g,"").trim();
    if(/^(con|nul|prn|aux|com[1-9]|lpt[1-9])$/i.test(s))s="Nota "+s;
    return (s||"Nota de oficina").slice(0,65).trim();
  }
  function titleFor(message,office){
    const text=String(message||"").trim(),q=normalize(text);
    if(q.includes("pedidos pendientes"))return "Pedidos pendientes";
    if(q.includes("estrategia de ventas"))return "Estrategia de ventas";
    if(q.includes("reunion")||q.includes("hola "+normalize(office.agent)))return "Reunión con "+office.agent;
    if(/\b(proveedor|proveedores|investigar nichos|producto rentable|investigacion de productos)\b/.test(q))return "Investigación de productos y proveedores";
    if(/\b(campana|campanas|publicidad|anuncios publicitarios)\b/.test(q))return "Campañas de marketing";
    if(/\b(presupuesto|rentabilidad|flujo de caja|margen)\b/.test(q))return "Presupuesto y rentabilidad";
    if(/\b(pedidos|envios|despachos|guias)\b/.test(q))return "Seguimiento de pedidos";
    if(/\b(ventas|clientes|oportunidades comerciales)\b/.test(q))return "Estrategia comercial";
    if(/\b(tareas|pendientes|prioridades)\b/.test(q))return "Plan de tareas";
    const simplified=text.replace(new RegExp("^\\s*"+office.agent+"\\s*[:,.\\-]?\\s*","i"),"").replace(/^(hola|por favor|quiero que|necesito que|me ayudas a)\s*/i,"");
    return safeTitle(simplified||"Conversación con "+office.agent);
  }
  async function ownFolder(vault,ownerId,create){
    const owner=validOwner(ownerId);
    const root=await vault.getDirectoryHandle("Oficinas IA",{create:!!create});
    return root.getDirectoryHandle(owner,{create:!!create});
  }
  async function canRead(vault){return !!(vault&&await vault.queryPermission({mode:"read"})==="granted");}
  async function canWrite(vault){return !!(vault&&await vault.queryPermission({mode:"readwrite"})==="granted");}
  async function writeOnce(dir,name,content){
    let file;
    try{
      file=await dir.getFileHandle(name);
      if(await (await file.getFile()).text()!==content)throw Error("Una nota de Obsidian cambió y no se sobrescribirá: "+name);
      return false;
    }catch(e){if(e.name!=="NotFoundError")throw e;}
    file=await dir.getFileHandle(name,{create:true});
    const writer=await file.createWritable();
    try{await writer.write(content);await writer.close();}
    catch(e){try{await writer.abort();}catch{}throw e;}
    return true;
  }
  function officeLink(owner,office){
    return "[[Oficinas IA/"+owner+"/"+office.folder+"/Índice - "+office.folder+"|"+office.folder+" ("+office.agent+")]]";
  }
  function panelLink(owner){return "[[Oficinas IA/"+owner+"/Mapa - Oficinas IA|Mapa de oficinas IA]]";}
  async function ensureIndexes(vault,ownerId){
    const owner=validOwner(ownerId),root=await ownFolder(vault,owner,true);
    await writeOnce(root,"Mapa - Oficinas IA.md",
      "# Mapa de Oficinas IA\n\nMemoria local de Emprendimiento IA.\n\n"+
      OFFICES.map(o=>"- "+officeLink(owner,o)).join("\n")+
      "\n\nLas conversaciones nuevas enlazan a su oficina y a este mapa. Los colores se configuran en la vista gráfica de Obsidian mediante grupos por carpeta.\n");
    for(const office of OFFICES){
      const dir=await root.getDirectoryHandle(office.folder,{create:true});
      await writeOnce(dir,"Índice - "+office.folder+".md",
        "# "+office.folder+" · "+office.agent+"\n\nVolver a "+panelLink(owner)+
        "\n\nOficina: "+office.folder+"\n\nRevisa los vínculos de entrada para consultar las conversaciones y notas de esta oficina.\n");
    }
    return root;
  }
  async function digest(v){
    const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));
    return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
  }
  function datePart(date){
    const d=String(date||new Date().toISOString()).slice(0,10);
    return /^\d{4}-\d\d-\d\d$/.test(d)?d:new Date().toISOString().slice(0,10);
  }
  async function saveMemoryNote(vault,ownerId,note,markdown){
    if(!await canWrite(vault))return {saved:false,reason:"Obsidian sin permiso de escritura."};
    const owner=validOwner(ownerId),office=officeFor(note.office);
    const root=await ensureIndexes(vault,owner),dir=await root.getDirectoryHandle(office.folder,{create:true});
    const title=titleFor(note.name||note.description,office);
    const original=String(markdown||"");
    const hash=(await digest(String(note.id)+"\n"+original)).slice(0,10);
    const name=safeTitle(title)+" - "+datePart(note.createdAt)+" - "+hash+".md";
    const content=original.trim()+"\n\n---\n\nOficina: "+officeLink(owner,office)+
      "\nMapa general: "+panelLink(owner)+
      "\n\n<!-- Copia automática del espacio de trabajo. No modificar el archivo original en Supabase. -->\n";
    await writeOnce(dir,name,content);
    return {saved:true,filename:name,office:office.folder};
  }
  async function collectFiles(dir,depth,found){
    if(found.length>=350)return;
    for await(const [name,handle] of dir.entries()){
      if(found.length>=350)break;
      if(handle.kind==="file"&&/\.md$/i.test(name))found.push({name,handle});
      else if(handle.kind==="directory"&&depth<2)await collectFiles(handle,depth+1,found);
    }
  }
  async function relevant(vault,ownerId,prompt,agent){
    if(!await canRead(vault))return [];
    const words=terms(prompt);if(!words.length)return [];
    let dir;try{dir=await ownFolder(vault,ownerId,false);}catch(e){if(e.name==="NotFoundError")return [];throw e;}
    const found=[];await collectFiles(dir,0,found);
    const matches=[];
    for(const item of found.sort((a,b)=>b.name.localeCompare(a.name)).slice(0,MAX_FILES)){
      let file;try{file=await item.handle.getFile();}catch{continue;}
      if(file.size>MAX_FILE_BYTES)continue;
      const content=await file.text(),plain=normalize(content),hits=words.filter(w=>plain.includes(w));
      if(!hits.length)continue;
      const title=content.match(/^#\s+([^\r\n]+)/m)?.[1]?.slice(0,110)||item.name.slice(0,75);
      const bonus=agent&&plain.includes(normalize(agent))?1:0;
      const first=hits.map(w=>plain.indexOf(w)).filter(n=>n>=0).sort((a,b)=>a-b)[0]||0;
      matches.push({title,score:hits.length*3+bonus,excerpt:content.slice(Math.max(0,first-180),Math.max(0,first-180)+1000),name:item.name});
    }
    matches.sort((a,b)=>b.score-a.score||b.name.localeCompare(a.name));
    let used=0;
    return matches.slice(0,MAX_RESULTS).map(x=>{
      const block="Fuente: "+x.title+"\n"+x.excerpt,available=MAX_CONTEXT_CHARS-used;
      if(available<=0)return "";
      used+=Math.min(block.length,available);
      return block.slice(0,available);
    }).filter(Boolean);
  }
  async function saveTurn(vault,ownerId,turn){
    if(!await canWrite(vault))return {saved:false,reason:"Conecta y autoriza Obsidian para guardar automáticamente."};
    const owner=validOwner(ownerId),office=officeFor(turn.office);
    const root=await ensureIndexes(vault,owner);
    const parent=await root.getDirectoryHandle(office.folder,{create:true});
    const dir=await parent.getDirectoryHandle("Conversaciones",{create:true});
    const timestamp=new Date().toISOString();
    const unique=typeof crypto.randomUUID==="function"?crypto.randomUUID().slice(0,8):Math.random().toString(36).slice(2,10);
    const title=titleFor(turn.prompt,office);
    const filename=safeTitle(title)+" - "+timestamp.slice(0,16).replace(/:/g,"-")+" - "+unique+".md";
    const content=[
      "# "+title,
      "",
      "Fecha: "+timestamp,
      "Oficina: "+officeLink(owner,office),
      "Mapa: "+panelLink(owner),
      "Motor: Ollama local · "+String(turn.model||"Qwen3:14b").slice(0,60),
      "Tokens: entrada "+String(turn.inputTokens??"—")+", salida "+String(turn.outputTokens??"—"),
      "",
      "## Pregunta",
      String(turn.prompt||"").slice(0,6000),
      "",
      "## Respuesta",
      String(turn.answer||"").slice(0,20000),
      ""
    ].join("\n");
    await writeOnce(dir,filename,content);
    return {saved:true,filename,office:office.folder};
  }
  function graphGroups(ownerId){
    const owner=validOwner(ownerId);
    return OFFICES.map(o=>({...o,query:'path:"Oficinas IA/'+owner+'/'+o.folder+'/"'}));
  }
  window.ObsidianContextBridge=Object.freeze({relevant,saveTurn,saveMemoryNote,ensureIndexes,graphGroups,titleFor});
})();