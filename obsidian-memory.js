/* Memoria local de Obsidian para las consultas manuales de Ollama.
   Solo lee/escribe en Oficinas IA/<usuario>; nunca sube archivos a GitHub ni Supabase. */
(function () {
  "use strict";

  const MAX_FILES = 180;
  const MAX_FILE_BYTES = 24000;
  const MAX_RESULTS = 3;
  const MAX_CONTEXT_CHARS = 3500;
  const STOP = new Set(["para","como","donde","cuando","sobre","quiero","puedes","hacer","dame","esta","este","cual","desde","entre","tengo","tiene","hacer","todo","todos","todas","nuestro","nuestra","ahora","despues","necesito","proyecto","oficina","emprendimiento"]);

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function terms(value) {
    return [...new Set(normalize(value).match(/[a-z0-9]{4,}/g) || [])].filter(w => !STOP.has(w)).slice(0, 18);
  }
  function validOwner(ownerId) {
    if (!/^[a-zA-Z0-9_-]{6,80}$/.test(String(ownerId || ""))) throw Error("Identificador de usuario no válido.");
    return String(ownerId);
  }
  async function ownFolder(vaultHandle, ownerId, create) {
    const owner = validOwner(ownerId);
    const base = await vaultHandle.getDirectoryHandle("Oficinas IA", {create: Boolean(create)});
    return base.getDirectoryHandle(owner, {create: Boolean(create)});
  }
  async function canRead(vaultHandle) {
    return Boolean(vaultHandle && await vaultHandle.queryPermission({mode: "read"}) === "granted");
  }
  async function canWrite(vaultHandle) {
    return Boolean(vaultHandle && await vaultHandle.queryPermission({mode: "readwrite"}) === "granted");
  }

  async function collectFiles(dir, depth, found) {
    if (found.length >= 350) return;
    for await (const [name, handle] of dir.entries()) {
      if (found.length >= 350) break;
      if (handle.kind === "file" && /\.md$/i.test(name)) found.push({name, handle});
      else if (handle.kind === "directory" && depth < 2) await collectFiles(handle, depth + 1, found);
    }
  }

  async function relevant(vaultHandle, ownerId, prompt, officeName) {
    if (!await canRead(vaultHandle)) return [];
    const keywords = terms(prompt);
    if (!keywords.length) return [];
    let dir;
    try { dir = await ownFolder(vaultHandle, ownerId, false); }
    catch (e) { if (e.name === "NotFoundError") return []; throw e; }

    const found = [];
    await collectFiles(dir, 0, found);
    // Conversation filenames begin with ISO dates; prefer recent ones when notes accumulate.
    const ranked = found.sort((a,b) => b.name.localeCompare(a.name)).slice(0, MAX_FILES);
    const matches = [];
    for (const item of ranked) {
      let file;
      try { file = await item.handle.getFile(); } catch { continue; }
      if (file.size > MAX_FILE_BYTES) continue;
      const content = await file.text();
      const plain = normalize(content);
      const hits = keywords.filter(k => plain.includes(k));
      if (!hits.length) continue;
      const title = content.match(/^#\s+([^\r\n]+)/m)?.[1]?.slice(0,110) || item.name.slice(0,75);
      const officeBonus = officeName && plain.includes(normalize(officeName)) ? 1 : 0;
      const first = hits.map(k => plain.indexOf(k)).filter(i => i >= 0).sort((a,b) => a-b)[0] || 0;
      const start = Math.max(0,first-180);
      const excerpt = content.slice(start,start+1000);
      matches.push({title,score:hits.length * 3 + officeBonus, excerpt, name:item.name});
    }
    matches.sort((a,b) => b.score-a.score || b.name.localeCompare(a.name));
    let used = 0;
    return matches.slice(0,MAX_RESULTS).map(x=>{
      const block = "Fuente: "+x.title+"\n"+x.excerpt;
      const remaining = MAX_CONTEXT_CHARS - used;
      if (remaining <= 0) return "";
      used += Math.min(block.length, remaining);
      return block.slice(0,remaining);
    }).filter(Boolean);
  }

  async function saveTurn(vaultHandle, ownerId, turn) {
    if (!await canWrite(vaultHandle)) return {saved:false,reason:"Conecta y autoriza Obsidian para guardar automáticamente."};
    const dir = await ownFolder(vaultHandle, ownerId, true);
    const logs = await dir.getDirectoryHandle("Conversaciones", {create:true});
    const timestamp = new Date().toISOString();
    const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
    const filename = timestamp.slice(0,19).replace(/:/g,"-")+"-"+id+".md";
    const heading = String(turn.office || "Oficina IA").replace(/[\r\n]/g," ").slice(0,60);
    const content = [
      "# Conversación con "+heading,
      "",
      "Fecha: "+timestamp,
      "Motor: Ollama local · "+String(turn.model || "Qwen3:14b").slice(0,60),
      "Tokens: entrada "+String(turn.inputTokens ?? "—")+", salida "+String(turn.outputTokens ?? "—"),
      "",
      "## Pregunta",
      String(turn.prompt || "").slice(0,6000),
      "",
      "## Respuesta",
      String(turn.answer || "").slice(0,20000),
      ""
    ].join("\n");

    // Jamás reemplazar archivos existentes.
    try {
      await logs.getFileHandle(filename);
      throw Error("Ya existe una conversación con ese nombre. No se sobrescribió.");
    } catch(e) { if(e.name !== "NotFoundError") throw e; }

    const handle = await logs.getFileHandle(filename, {create:true});
    const writer = await handle.createWritable();
    try { await writer.write(content); await writer.close(); }
    catch(e) { try { await writer.abort(); } catch {} throw e; }
    return {saved:true,filename};
  }

  window.ObsidianContextBridge = Object.freeze({relevant, saveTurn});
})();