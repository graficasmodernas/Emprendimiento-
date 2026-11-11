"use strict";

// Auxiliares de NEXUS - Emprendimiento IA
// Configuración inicial: todavía no ejecuta consultas.

const NEXUS_AUXILIARES = [
  {
    id: "explorer",
    nombre: "EXPLORER",
    cargo: "Investigador de productos",
    objetivo: "Investigar productos, mercados y proveedores.",
    icono: "🔍",
    tendencias: {
      seccion: "Tendencias de Internet",
      botón: "Consultar tendencias",
      resultados: []
    }
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

  const tendencias = document.createElement("div");
  tendencias.className = "nexus-auxiliar-tendencias";

  const seccion = document.createElement("h4");
  seccion.textContent = auxiliar.tendencias.seccion;

  const botón = document.createElement("button");
  botón.textContent = auxiliar.tendencias.botón;
  botón.addEventListener("click", async () => {
    if (navigator.onLine) {
      try {
        const resultados = await obtenerTendencias(auxiliar.tendencias.seccion);
        auxiliar.tendencias.resultados = resultados;
        mostrarResultados(auxiliar);
      } catch (error) {
        mostrarError(auxiliar);
      }
    } else {
      mostrarError(auxiliar);
    }
  });

  tendencias.append(seccion, botón);
  contenido.append(nombre, cargo, objetivo, tendencias);

  modal.appendChild(contenido);
  document.body.appendChild(modal);
}

async function obtenerTendencias(seccion) {
  // Simulación de consulta a Google Trends
  // En un entorno real, aquí deberías hacer una solicitud a una API de Google Trends o un servicio local
  return [
    {
      nombre: "Producto 1",
      fuente: "Google Trends",
      fecha: "2023-04-01",
      enlace: "https://trends.google.com/trends/explore?q=Producto+1"
    },
    {
      nombre: "Producto 2",
      fuente: "Google Trends",
      fecha: "2023-04-01",
      enlace: "https://trends.google.com/trends/explore?q=Producto+2"
    }
  ];
}

function mostrarResultados(auxiliar) {
  const modal = document.querySelector(".nexus-auxiliar-modal");
  const contenido = modal.querySelector(".nexus-auxiliar-modal-content");

  contenido.innerHTML = `
    <h3>${auxiliar.nombre}</h3>
    <p>Cargo: ${auxiliar.cargo}</p>
    <p>Objetivo: ${auxiliar.objetivo}</p>
    <h4>Tendencias de Internet</h4>
    <ul>
      ${auxiliar.tendencias.resultados.map(result => `
        <li>
          <strong>${result.nombre}</strong>
          <p>Fuente: ${result.fuente}</p>
          <p>Fecha: ${result.fecha}</p>
          <a href="${result.enlace}" target="_blank">Ver enlace</a>
        </li>
      `).join('')}
    </ul>
    <button id="volver">Volver a las suboficinas</button>
  `;

  const volver = document.getElementById("volver");
  volver.addEventListener("click", () => {
    document.body.removeChild(modal);
  });
}

function mostrarError(auxiliar) {
  const modal = document.querySelector(".nexus-auxiliar-modal");
  const contenido = modal.querySelector(".nexus-auxiliar-modal-content");

  contenido.innerHTML = `
    <h3>${auxiliar.nombre}</h3>
    <p>Cargo: ${auxiliar.cargo}</p>
    <p>Objetivo: ${auxiliar.objetivo}</p>
    <h4>Tendencias de Internet</h4>
    <p>Fuente no conectada</p>
    <button id="volver">Volver a las suboficinas</button>
  `;

  const volver = document.getElementById("volver");
  volver.addEventListener("click", () => {
    document.body.removeChild(modal);
  });
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
