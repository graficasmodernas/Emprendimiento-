from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.request import Request, urlopen
import json
import sys

base = (
    Path.home() / "Downloads" / "Empredimiento ia"
    / "Oficinas IA"
    / "d8f56ee7-8e88-405c-b626-bb76b3a5a797"
    / "Investigación"
)

origen = base / "EXPLORER" / "Google Trends"
destino = base / "ANALYST" / "Informes"

if not origen.is_dir() or not (base / "ANALYST").is_dir():
    sys.exit("ERROR: No se encontraron las memorias originales.")

archivos = sorted(
    origen.glob("Google-Trends-*.md"),
    key=lambda p: p.stat().st_mtime,
    reverse=True
)

if not archivos:
    sys.exit("EXPLORER no tiene investigaciones para analizar.")

documentos = []
for archivo in archivos:
    contenido = archivo.read_text(encoding="utf-8-sig")
    documentos.append(
        f"ARCHIVO: {archivo.name}\n{contenido[:12000]}"
    )

instruccion = """
Eres ANALYST, analista de tendencias de Emprendimiento IA.
Analiza exclusivamente los registros reales de Google Trends
proporcionados por EXPLORER.

Reglas:
- No inventes productos, cifras, fuentes ni resultados.
- Google Trends mide interés relativo, no ventas.
- Identifica crecimiento, estabilidad, caídas y datos parciales.
- No compares valores 0-100 de consultas independientes
  como si compartieran una escala absoluta.
- Selecciona HASTA 5 productos candidatos con evidencia.
- Si solamente hay un producto, analiza solamente ese.
- Si las pruebas son insuficientes, indícalo claramente.
- No afirmes rentabilidad sin datos de costos y ventas.
- Explica qué falta investigar.
- Responde en español con formato Markdown.

Entrega:
1. Resumen ejecutivo.
2. Productos candidatos y evidencia.
3. Limitaciones de los datos.
4. Recomendaciones para NEXUS.
"""

candidatos = []
for archivo in archivos:
    contenido = archivo.read_text(encoding="utf-8-sig")
    productos = contenido.split("Producto: ")[1:]
    for producto in productos:
        nombre, detalles = producto.split("\n", 1)
        fuente = contenido.split("Fuente: ")[1].split("\n")[0]
        datos = {
            "model": "qwen3:14b",
            "stream": False,
            "think": False,
            "messages": [
                {"role": "system", "content": instruccion},
                {"role": "user", "content": f"Producto: {nombre}\nFuente: {fuente}\n\n{detalles}"}
            ],
            "options": {"temperature": 0.2, "num_predict": 1800}
        }

        print(f"ANALYST: leyendo {archivo.name} para el producto {nombre}...")
        print("Consultando Ollama Qwen3:14b...")

        try:
            solicitud = Request(
                "http://127.0.0.1:11434/api/chat",
                data=json.dumps(datos).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urlopen(solicitud, timeout=300) as respuesta:
                resultado = json.load(respuesta)

            informe = resultado["message"]["content"].strip()
            if not informe:
                sys.exit("Ollama no devolvio un informe. No se guardo nada.")

            candidatos.append({
                "nombre": nombre,
                "fuente": fuente,
                "informe": informe
            })

        except Exception as error:
            print(f"ERROR: No fue posible analizar el producto {nombre} de {archivo.name}: {error}")

candidatos = candidatos[:5]

if not candidatos:
    sys.exit("No se encontraron productos candidatos para analizar.")

ahora = datetime.now(ZoneInfo("America/Bogota"))
destino.mkdir(parents=True, exist_ok=True)
nombre = "ANALYST-" + ahora.strftime("%Y%m%d-%H%M%S-%f") + ".md"

referencias = "\n".join(
    "- [[" + p.stem + "]]" for p in archivos
)

texto = (
    "# Informe ANALYST - Google Trends\n\n"
    "Fecha: " + ahora.isoformat(timespec="seconds") + "\n"
    "Modelo: Ollama Qwen3:14b\n"
    "Origen: investigaciones de EXPLORER\n\n"
    "## Investigaciones consultadas\n"
    + referencias + "\n\n"
    "## Productos candidatos\n\n"
)

for candidato in candidatos:
    texto += f"### {candidato['nombre']}\n\n"
    texto += f"**Fuente:** {candidato['fuente']}\n\n"
    texto += candidato['informe'] + "\n\n"

archivo_salida = destino / nombre
with archivo_salida.open("x", encoding="utf-8") as f:
    f.write(texto)

print("INFORME DE ANALYST GUARDADO CORRECTAMENTE")
print(archivo_salida)
