"use strict";

// Auxiliares de NEXUS - Emprendimiento IA
// Configuración inicial: todavía no ejecuta consultas.

const NEXUS_AUXILIARES = [
  {
    id: "explorer",
    nombre: "EXPLORER",
    cargo: "Investigador de productos",
    objetivo: "Investigar productos, mercados y proveedores.",
    icono: "🔍"
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

function renderNexusAuxiliares(target) {
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
    estado.textContent = "Pendiente de conectar con Ollama";

    const abrirOficina = document.createElement("button");
    abrirOficina.textContent = "Abrir oficina";
    abrirOficina.addEventListener("click", () => {
      mostrarPanel(auxiliar);
    });

    tarjeta.append(nombre, icono, cargo, objetivo, estado, abrirOficina);
    contenedor.appendChild(tarjeta);
  });

  target.appendChild(contenedor);
}

function mostrarPanel(auxiliar) {
  const modal = document.createElement("div");
  modal.className = "nexus-auxiliar-modal";

  const cerrarModal = document.createElement("button");
  cerrarModal.textContent = "Volver a las suboficinas";
  cerrarModal.addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  const contenido = document.createElement("div");
  contenido.className = "nexus-auxiliar-modal-content";

  const nombre = document.createElement("h3");
  nombre.textContent = auxiliar.nombre;

  const cargo = document.createElement("p");
  cargo.textContent = "Cargo: " + auxiliar.cargo;

  const objetivo = document.createElement("p");
  objetivo.textContent = "Objetivo: " + auxiliar.objetivo;

  contenido.append(nombre, cargo, objetivo, cerrarModal);
  modal.appendChild(contenido);
  document.body.appendChild(modal);
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
`;
