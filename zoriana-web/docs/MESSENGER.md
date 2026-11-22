# Messenger en Administración Zoriana

## Funcionamiento

La pantalla principal de Administración muestra **Bandeja de Messenger** después de iniciar sesión. La bandeja consulta Supabase con permisos de lectura exclusivos del propietario. Se actualiza mientras está abierta e incluye mensajes históricos, borradores y estados de envío.

Meta entrega eventos firmados a `/functions/v1/zoriana-messenger`. La función `/functions/v1/zoriana-messenger-reply` distingue el token de EXPLORER de la sesión Supabase del propietario. El token de página permanece en el servidor. El modo inicial es sugerencias. El envío automático exige una activación explícita y aplica a mensajes recibidos y enviados después de esa activación. Los procesos EXPLORER anteriores pueden dejar borradores. El proceso actualizado usa la revisión de configuración que recibió al consultar el mensaje.

**Guardar corrección** conserva el texto como ejemplo para el modelo sin enviar el mensaje. **Enviar por Messenger** envía el texto del editor. La casilla para guardar como ejemplo permite conservar una respuesta manual o editada tras la confirmación de Meta. EXPLORER usa hasta ocho ejemplos recientes y las instrucciones del panel para nuevas sugerencias. Los adjuntos se marcan para revisión humana y se consultan en Meta Business Suite.

En caso de una entrega incierta, verifica el chat en Meta antes de tomar otra acción. Si se interrumpe el proceso entre el envío y el registro de la confirmación, el estado puede quedar en «Enviando» y requiere revisar el chat en Meta.

## Actualizar EXPLORER en Windows

1. Abre **Motor de sugerencias · EXPLORER** en la bandeja y descarga **EXPLORER con Obsidian**.
2. Cierra el proceso anterior con Ctrl+C y guarda el archivo descargado en Descargas.
3. En la misma ventana de PowerShell que ya tenía la clave de EXPLORER, con Ollama abierto, ejecuta:

```powershell
$env:ZORIANA_OBSIDIAN_VAULT = "$env:USERPROFILE\Downloads\Emprendimiento ia"
node "$env:USERPROFILE\Downloads\zoriana-ollama-obsidian.mjs"
```

Si el proceso informa que falta el token, carga el valor vigente de `ZORIANA_OLLAMA_WORKER_TOKEN` sin mostrarlo en pantalla:

```powershell
$clave = Read-Host 'Pega la clave vigente de EXPLORER' -AsSecureString
$env:ZORIANA_OLLAMA_WORKER_TOKEN = [System.Net.NetworkCredential]::new('', $clave).Password
Remove-Variable clave
```

## Prueba con Messenger

1. Desde otro dispositivo envía a la página de Facebook **Zoriana** un mensaje identificable, por ejemplo «Prueba de bandeja · ¿Envían a Cali?».
2. Abre la bandeja. Verifica que aparece el mismo texto. En modo sugerencias, la otra cuenta solo recibe la respuesta del panel después de pulsar **Enviar por Messenger**. El saludo configurado en Meta Business Suite tiene su propio control.
3. Corrige la sugerencia si hace falta. Pulsa **Guardar corrección** para conservar el ejemplo y **Enviar por Messenger** cuando quieras responder. Confirma la llegada en el dispositivo de prueba.
4. Para probar el modo automático, actívalo y guarda la configuración. Envía un mensaje nuevo que la IA pueda responder. Comprueba que llega la respuesta desde la otra cuenta y que el panel muestra **Enviado**. Desactiva el modo cuando termine la prueba si prefieres revisar los borradores.
5. En desarrollo, usa una cuenta con rol en la app de Meta. Para probar con una cuenta de cliente común, completa la verificación y revisión de `pages_messaging` en Meta y publica la app.

Pruebas automatizadas: `node --test supabase/functions/zoriana-messenger-reply/handler.test.mjs`.
