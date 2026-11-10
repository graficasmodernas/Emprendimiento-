# Desarrollo local de Emprendimiento IA (Windows)

Esta guía describe cómo continuar el desarrollo desde GitHub sin alterar la rama principal `main`.

## 1. Obtener el código

Abre **PowerShell** y comprueba que Git esté instalado:

```powershell
git --version
```

Si Git está instalado, ejecuta:

```powershell
cd "$env:USERPROFILE\Documents"
git clone https://github.com/graficasmodernas/Emprendimiento-.git Emprendimiento-IA-Codigo
cd .\Emprendimiento-IA-Codigo
git switch dev/emprendimiento-local
git status
```

Si la carpeta `Emprendimiento-IA-Codigo` ya existe, **no repitas el clon**: abre esa carpeta y comprueba primero `git status`.

La carpeta del proyecto y la bóveda de Obsidian deben mantenerse separadas. No sobrescribas las notas existentes.

## 2. Abrir el proyecto como sitio local

El frontend actual está en `index.html` y no necesita `npm install` para la interfaz estática.

Inicia un servidor web local desde la carpeta del repositorio:

```powershell
py -m http.server 5500
```

Abre **http://localhost:5500** en el navegador. Deja la consola de este servidor abierta mientras lo usas.

Si `py` no está disponible, puedes probar `python -m http.server 5500` si tienes Python instalado.

**Atención:** aunque abras la interfaz localmente, esta versión utiliza Supabase para autenticación y sincronización de datos; no es una aplicación completamente sin conexión.

## 3. Ollama y Qwen3:14b

Comprueba en otra consola:

```powershell
ollama --version
ollama list
```

Si el modelo `qwen3:14b` no aparece en la lista, puedes descargarlo con `ollama pull qwen3:14b` (la descarga puede ser grande).

La aplicación consulta Ollama en **http://localhost:11434**, con el modelo **qwen3:14b**.

Si el navegador informa un bloqueo de origen, añade los orígenes usados por la aplicación en el entorno de usuario:

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "http://localhost:5500,https://graficasmodernas.github.io", "User")
```

Después cierra Ollama por completo desde el área de notificación de Windows y vuelve a abrirlo. No abras ni reenvíes el puerto 11434 en tu router. Si el navegador solicita permiso de acceso a la red local, revísalo y autorízalo solo si corresponde.

En una oficina IA, selecciona **Ollama local** y pulsa **Verificar Ollama**.

Usar Ollama local evita cargos por consultas a una API de OpenAI, pero consume recursos del PC y sigue procesando tokens localmente.

## 4. Obsidian

El código ofrece una conexión opcional con una carpeta de Obsidian tras iniciar sesión. Debes aceptar el acceso en el navegador. El guardado automático funciona mientras la página esté abierta y tenga permiso; no sustituye un servicio de sincronización permanente.

No elijas la carpeta del código como bóveda salvo que realmente quieras mezclar código y notas.

## 5. Guardar cambios en una rama

```powershell
git status
git add .
git commit -m "Descripción breve del cambio"
git push -u origin dev/emprendimiento-local
```

Antes de hacer `git add .`, revisa `git status` para no subir datos privados por accidente. Crea un Pull Request desde `dev/emprendimiento-local` hacia `main` cuando los cambios estén probados.

## Seguridad

El repositorio está publicado como **público** en GitHub. Nunca guardes contraseñas, tokens privados, claves `service_role`, archivos `.env`, copias de datos de clientes ni notas sensibles en este repositorio. Las claves Supabase publicables del navegador no equivalen a secretos de servidor, pero las políticas de acceso y los permisos deben verificarse.

## Componentes encontrados en el repositorio

- `index.html`: interfaz y lógica del cliente
- `supabase/functions/emprendimiento-ai/index.ts`: función de servidor para IA
- `supabase/workspace-schema.sql`: esquema de referencia de la base de datos (no volver a ejecutar sobre tablas existentes)

Última revisión: 9 de noviembre de 2026.
