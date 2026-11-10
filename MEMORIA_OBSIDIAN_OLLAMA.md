# Memoria Obsidian + Ollama — versión de prueba

## Alcance

Esta función se incorpora únicamente a la rama `feature/obsidian-contexto-ollama`. No se ha fusionado a `main` ni a `dev/emprendimiento-local`.

Al entrar en Emprendimiento IA desde Chrome/Edge, conectar Obsidian y autorizar la carpeta:

1. Las consultas nuevas a las seis oficinas con **Ollama local / Qwen3:14b** generan automáticamente una nota Markdown por pregunta y respuesta bajo:
   `<bóveda>/Oficinas IA/<id-de-usuario>/Conversaciones/`.
2. Si la casilla **Incluir contexto** está marcada, antes de cada consulta la página lee solo las notas Markdown dentro de `Oficinas IA/<id-de-usuario>` (incluidas las conversaciones). Selecciona hasta 3 fragmentos relacionados con la pregunta, con un máximo de aproximadamente 3500 caracteres.
3. La memoria guardada por la interfaz en **Memoria compartida** conserva su respaldo anterior en Obsidian y puede servir como referencia a Ollama.
4. Todas las conversaciones nuevas con Ollama se guardan **automáticamente** en Memoria compartida (sin un segundo clic) y se sincronizan con Supabase cuando esté disponible. Cuando Obsidian está autorizado, también se escribe una bitácora completa en la bóveda.
5. Si la nube no permite guardar la nota, la respuesta ofrece **Reintentar guardar en memoria**. Si Obsidian no tiene permiso, mostrará el estado del respaldo sin detener la respuesta.
6. El botón de cada agente ahora muestra únicamente **Consultar**.

## Privacidad y límites

- **Solo lectura/escritura en la carpeta autorizada** `Oficinas IA/<id-de-usuario>`. No analiza las demás carpetas de tu Obsidian.
- Los fragmentos recuperados de Obsidian viajan únicamente al proceso Ollama que corre en `localhost:11434` desde este navegador; no se envían automáticamente a OpenAI ni a GitHub.
- La memoria de **Memoria compartida** ya usa Supabase en esta aplicación. Esta nueva bitácora local es independiente.
- **No** realiza importación de conversaciones antiguas de ChatGPT, WhatsApp, Gmail u otros servicios.
- **No** guarda automáticamente acciones ajenas al chat de Ollama, como todos los pedidos o documentos de proveedores; esos datos permanecen en el espacio existente y su copia debe gestionarse aparte.
- No existe memoria infinita: Qwen3:14b dispone de una ventana de contexto limitada y esta versión usa una búsqueda sencilla por palabras, no embeddings vectoriales.
- No envíes contraseñas o claves API al chat: las preguntas y respuestas nuevas quedan en archivos Markdown en tu computador.
- **No subas la carpeta de Obsidian a GitHub**: el repositorio de Emprendimiento IA es público.

## Prueba desde Windows

Con el servidor Python detenido (Ctrl+C) y estando dentro de `C:\Users\User\Documents\Emprendimiento-IA-Codigo`:

```powershell
git fetch origin
git switch --track origin/feature/obsidian-contexto-ollama
py -m http.server 5500
```

Abre `http://localhost:5500`, inicia sesión y conecta Obsidian si el navegador lo solicita.

En **Gerencia → Agente IA**, marca **Incluir contexto**, pregunta a ATLAS algo sobre tu proyecto y comprueba que la respuesta indique **Conversación respaldada automáticamente en Obsidian**. La nota debería aparecer en **Oficinas IA → <id-de-usuario> → Conversaciones**.

Luego haz una pregunta que contenga palabras específicas de esa respuesta, por ejemplo sobre `proveedores`, `publicidad` o `costos`, para comprobar que la respuesta puede utilizar información guardada.

## Regresar a la rama de desarrollo anterior

Si se detecta un problema, detén el servidor con Ctrl+C y ejecuta:

```powershell
git switch dev/emprendimiento-local
py -m http.server 5500
```

La carpeta de Obsidian y sus archivos permanecen intactos. Si hay modificaciones locales sin guardar, revisa `git status` antes de cambiar de rama.

## Revisión pendiente antes de publicar

- Prueba manual real en Edge con la bóveda existente.
- Comprobar la relevancia de notas y que no se elijan resultados de otra oficina cuando no correspondan.
- Añadir una exportación resumida de actividades del negocio a la bóveda, si se desea guardar también todos los registros.
- Considerar búsqueda semántica local para una bóveda grande y pruebas automatizadas del lector de archivos.
