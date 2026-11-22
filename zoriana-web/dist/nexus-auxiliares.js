"use strict";

// Auxiliares de NEXUS - Emprendimiento IA
// Mensajería de recepción: lectura real de Messenger; respuestas automáticas pendientes.

const NEXUS_AUXILIARES = [
  {
    id: "explorer",
    nombre: "EXPLORER",
    cargo: "Recepcionista de mensajes",
    objetivo: "Recibir consultas, identificar lo que necesita cada cliente y orientar la atención.",
    icono: "🎧"
  },
  {
    id: "analyst",
    nombre: "ANALYST",
    cargo: "Analista comercial",
    objetivo: "Calcular rentabilidad y comparar productos.",
    icono: "📈"
  },
  {
    id: "scout",
    nombre: "SCOUT",
    cargo: "Evaluador de riesgos",
    objetivo: "Identificar riesgos y evaluar evidencias.",
    icono: "🔍"
  }
];

function renderNexusAuxiliares(target, opciones = {}) {
  const titulo = document.createElement("h2");
  titulo.textContent = "Departamento de Auxiliares IA";
  target.appendChild(titulo);

  const descripcion = document.createElement("p");
  descripcion.textContent =
    "Suboficinas especializadas bajo la coordinación de NEXUS.";
  target.appendChild(descripcion);

  const contenedor = document.createElement("div");
  contenedor.className = "nexus-auxiliares-container";

  NEXUS_AUXILIARES.forEach(auxiliar => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "nexus-auxiliar-card";

    const nombre = document.createElement("h3");
    nombre.textContent = auxiliar.nombre;

    const icono = document.createElement("span");
    icono.textContent = auxiliar.icono;
    icono.className = "nexus-auxiliar-icon";

    const cargo = document.createElement("p");
    cargo.textContent = "Cargo: " + auxiliar.cargo;

    const objetivo = document.createElement("p");
    objetivo.textContent = "Objetivo: " + auxiliar.objetivo;

    const estado = document.createElement("small");
    estado.textContent = auxiliar.id === "explorer" ? "Messenger recibe mensajes · Respuestas automáticas pendientes" : "Pendiente de conectar con Ollama";

    const abrirOficina = document.createElement("button");
    abrirOficina.textContent = "Abrir oficina";
    abrirOficina.addEventListener("click", () => {
      mostrarPanel(auxiliar, opciones);
    });

    tarjeta.append(nombre, icono, cargo, objetivo, estado, abrirOficina);
    contenedor.appendChild(tarjeta);
  });

  target.appendChild(contenedor);
}

function mostrarPanel(auxiliar, opciones = {}) {
  const modal = document.createElement("div");
  modal.className = "nexus-auxiliar-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Oficina de " + auxiliar.nombre);
  const contenido = document.createElement("div");
  contenido.className = "nexus-auxiliar-modal-content";
  const cerrar = document.createElement("button");
  cerrar.textContent = "Volver a las suboficinas";
  const anterior = document.activeElement;
  let cerrado = false;
  const salir = () => { cerrado = true; modal.remove(); document.removeEventListener("keydown", teclado); anterior?.focus(); };
  const teclado = event => { if(event.key === "Escape") salir(); };
  cerrar.addEventListener("click", salir);
  document.addEventListener("keydown", teclado);
  const titulo = document.createElement("h3");
  titulo.textContent = auxiliar.nombre;
  const cargo = document.createElement("p");
  cargo.textContent = "Cargo: " + auxiliar.cargo;
  const objetivo = document.createElement("p");
  objetivo.textContent = "Objetivo: " + auxiliar.objetivo;
  contenido.append(cerrar, titulo, cargo, objetivo);
  if (auxiliar.id === "explorer") {
    const encabezado = document.createElement("h4");
    encabezado.textContent = "Mensajes recibidos · Messenger";
    const aviso = document.createElement("p");
    aviso.textContent = "EXPLORER será el primer contacto: recibirá, clasificará y derivará consultas. Por ahora puedes consultar los mensajes; la clasificación y las respuestas con Ollama aún no están conectadas.";
    const actualizar = document.createElement("button");
    actualizar.textContent = "Actualizar mensajes";
    const estado = document.createElement("p");
    estado.setAttribute("role", "status");
    const lista = document.createElement("div");
    lista.className = "explorer-inbox";
    const estados = {pending:"Pendiente de atención",draft:"Borrador preparado",human:"Atención humana",sent:"Respondido",failed:"Revisar envío"};
    async function cargar() {
      actualizar.disabled = true;
      estado.textContent = "Consultando mensajes…";
      lista.replaceChildren();
      try {
        if(typeof opciones.cargarMensajes !== "function") throw new Error("unavailable");
        const mensajes = await opciones.cargarMensajes();
        if(cerrado) return;
        estado.textContent = mensajes.length ? "Últimos " + mensajes.length + " mensajes recibidos." : "Todavía no hay mensajes recibidos.";
        for (const mensaje of mensajes) {
          const tarjeta = document.createElement("article");
          tarjeta.className = "explorer-message";
          const meta = document.createElement("p");
          const fecha = new Date(mensaje.received_at);
          meta.textContent = "Messenger · " + (isNaN(fecha.getTime()) ? "Fecha no disponible" : fecha.toLocaleString("es-CO",{timeZone:"America/Bogota"}));
          const texto = document.createElement("p");
          texto.textContent = mensaje.message_text || (mensaje.has_attachments ? "Mensaje con archivo adjunto. Revisa el archivo en Messenger." : "Mensaje sin texto.");
          const situacion = document.createElement("small");
          situacion.textContent = estados[mensaje.status] || "Por revisar";
          tarjeta.append(meta, texto, situacion);
          lista.append(tarjeta);
        }
      } catch {
        if(!cerrado) estado.textContent = "No se pudieron consultar los mensajes. Comprueba tu sesión y vuelve a intentar.";
      } finally { if(!cerrado) actualizar.disabled = false; }
    }
    actualizar.addEventListener("click", cargar);
    contenido.append(encabezado, aviso, actualizar, estado, lista);
    cargar();
  } else {
    const aviso = document.createElement("p");
    aviso.textContent = "Herramientas del auxiliar pendientes de conectar.";
    contenido.append(aviso);
  }
  modal.append(contenido);
  document.body.append(modal);
  cerrar.focus();
}

// Estilos CSS
document.head.appendChild(document.createElement("style"));
document.head.lastChild.textContent = `
  .nexus-auxiliares-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }

  .nexus-auxiliar-card {
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 16px;
    margin: 16px;
    width: 300px;
    text-align: center;
  }

  .nexus-auxiliar-icon {
    font-size: 2em;
    margin-bottom: 16px;
  }

  .nexus-auxiliar-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .nexus-auxiliar-modal-content {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  }

  .nexus-auxiliar-tendencias {
    margin-top: 24px;
  }

  .nexus-auxiliar-tendencias ul {
    list-style-type: none;
    padding: 0;
  }

  .nexus-auxiliar-tendencias li {
    border-bottom: 1px solid #ccc;
    padding: 12px 0;
  }

  .nexus-auxiliar-tendencias li:last-child {
    border-bottom: none;
  }

  .nexus-auxiliar-tendencias a {
    color: #007bff;
    text-decoration: none;
  }

  .nexus-auxiliar-tendencias a:hover {
    text-decoration: underline;
  }
`;

