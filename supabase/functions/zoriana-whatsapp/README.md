# WhatsApp de prueba de Zoriana

La función verifica el webhook de Meta y genera borradores a partir de mensajes firmados del remitente autorizado. En Zoriana Desarrollo, con el número de prueba y el secreto `WHATSAPP_ACCESS_TOKEN`, envía una respuesta por borrador nuevo. Los borradores existentes no se reenvían.

Para validar en un proyecto Supabase de pruebas autorizado:

1. Aplicar únicamente la migración de borradores de WhatsApp en ese proyecto.
2. Configurar `WHATSAPP_VERIFY_TOKEN` (32 caracteres o más), `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TEST_SENDER` en los secretos del servidor. Usar el número de prueba de Meta y el remitente autorizado con código de país y sin el signo +.
3. Desplegar únicamente `zoriana-whatsapp` con `--no-verify-jwt`. Meta presenta el token de verificación en GET y la firma HMAC en POST.
4. En Meta, configurar el callback HTTPS de la función y suscribir el campo `messages` del objeto `whatsapp_business_account`.
5. Escribir «Hola» y «¿Dónde está mi guía?» desde el remitente autorizado al número de prueba. Verificar los borradores y las respuestas en el chat. Un evento repetido conserva una sola fila y no inicia otro envío. Los registros de la función indican si Meta aceptó la respuesta o devolvió un error.

Pruebas locales con datos simulados:

```sh
node --test supabase/functions/zoriana-whatsapp/handler.test.mjs
```
