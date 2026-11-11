
"use strict";

// Auxiliares de NEXUS - Emprendimiento IA
// Configuración inicial: todavía no ejecuta consultas.

const NEXUS_AUXILIARES = [
  {
    id: "explorer",
    nombre: "EXPLORER",
    cargo: "Investigador de productos",
    objetivo: "Investigar productos, mercados y proveedores."
  },
  {
    id: "analyst",
    nombre: "ANALYST",
    cargo: "Analista comercial",
    objetivo: "Calcular rentabilidad y comparar productos."
  },
  {
    id: "scout",
    nombre: "SCOUT",
    cargo: "Evaluador de riesgos",
    objetivo: "Identificar riesgos y evaluar evidencias."
  }
];

function renderNexusAuxiliares(target) {
  const titulo = document.createElement("h2");
  titulo.textContent = "Equipo de Investigación IA";
  target.appendChild(titulo);

  const descripcion = document.createElement("p");
  descripcion.textContent =
    "Auxiliares especializados bajo la coordinación de NEXUS.";
  target.appendChild(descripcion);

  const contenedor = document.createElement("div");
  contenedor.className = "nexus-auxiliares-container";

  NEXUS_AUXILIARES.forEach(auxiliar => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "nexus-auxiliar-card";

    const nombre = document.createElement("h3");
    nombre.textContent = auxiliar.nombre;

    const cargo = document.createElement("p");
    cargo.textContent = "Cargo: " + auxiliar.cargo;

    const objetivo = document.createElement("p");
    objetivo.textContent = "Objetivo: " + auxiliar.objetivo;

    const estado = document.createElement("small");
    estado.textContent = "Pendiente de conectar con Ollama";

    tarjeta.append(nombre, cargo, objetivo, estado);
    contenedor.appendChild(tarjeta);
  });

  target.appendChild(contenedor);
}

