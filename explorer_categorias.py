import requests
import pytrends.request as pytrends
import time
import os
import json
from pytrends.request import TrendReq
from argparse import ArgumentParser

# Configuración de Ollama Qwen3:14b
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"

# Configuración de Google Trends
GEO = "CO"
TIMEFRAME = "today 6-m"

# Ruta para guardar las notas
NOTES_PATH = r"C:\Users\User\Downloads\Empredimiento ia\Oficinas IA\d8f56ee7-8e88-405c-b626-bb76b3a5a797\Investigación\EXPLORER\Google Trends"

def obtener_productos_ollama(categoria, limite=15):
    payload = {
        "model": "qwen3:14b",
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "user", "content": f"Propón hasta {limite} productos físicos relacionados con la categoría '{categoria}'"}
        ]
    }
    response = requests.post(OLLAMA_URL, json=payload, timeout=10)
    if response.status_code == 200:
        productos = response.json().get("message", {}).get("content", "").split("\n")
        productos = list(set(productos))[:limite]
        return productos
    else:
        return []

def obtener_tendencias(producto):
    pytrends.build_payload([producto], geo=GEO, timeframe=TIMEFRAME)
    data = pytrends.interest_over_time()
    return data[producto].to_dict()

def guardar_nota(producto, tendencias):
    filename = os.path.join(NOTES_PATH, f"{producto.replace(' ', '_')}.md")
    if not os.path.exists(NOTES_PATH):
        os.makedirs(NOTES_PATH)
    if not os.path.exists(filename):
        with open(filename, "x", encoding="utf-8") as file:
            file.write(f"# {producto}\n\n")
            file.write(f"Fecha: {time.strftime('%Y-%m-%d')}\n\n")
            file.write(f"Tendencias:\n")
            for date, value in tendencias.items():
                file.write(f"- {date}: {value}\n")
            file.write(f"\nEnlace de Google Trends: [Ver en Google Trends](https://trends.google.com/trends/explore?q={producto})\n")
    else:
        print(f"La nota para '{producto}' ya existe.")

def explorar_categoria(categoria, limite=15):
    productos = obtener_productos_ollama(categoria, limite)
    for producto in productos:
        try:
            tendencias = obtener_tendencias(producto)
            guardar_nota(producto, tendencias)
            time.sleep(2)  # Pausa de 2 segundos entre consultas
        except Exception as e:
            print(f"Error al procesar '{producto}': {e}")

if __name__ == "__main__":
    parser = ArgumentParser(description="Explorador de categorías para Emprendimiento IA")
    parser.add_argument("categoria", help="Categoría comercial a explorar")
    parser.add_argument("--limite", type=int, default=15, help="Número máximo de productos a explorar (default: 15)")
    args = parser.parse_args()
    explorar_categoria(args.categoria, args.limite)
