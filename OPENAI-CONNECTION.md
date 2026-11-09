# Conexión de los seis agentes

Estado: preparada, NO activada. La función no se ha publicado porque la revisión automática de aprobación pidió autorización explícita del dueño para el componente servidor y el envío de datos a OpenAI. La página publicada en main continúa operativa con el guardado en Supabase.

## Flujo propuesto

1. El dueño inicia sesión con su cuenta existente.
2. Cada oficina incorpora una pestaña Agente IA. La consulta solo se inicia al pulsar Consultar.
3. La función valida la sesión con Supabase Auth y verifica la tabla de acceso del dueño. No confía en identificadores enviados desde el navegador.
4. Envía la tarea a la API de OpenAI. Los datos pertinentes del negocio y fragmentos de memoria solo se incluyen si el dueño marca esa opción. Se omiten alias de clientes del contexto automático.
5. Guarda respuestas, estado, tokens y estimaciones en una tabla privada. No modifica pedidos, campañas, mensajes, movimientos ni autorizaciones del negocio.
6. La clave OPENAI_API_KEY y la credencial interna de Supabase permanecen en el servidor. No se incluyen valores de secretos en este repositorio.

## Modelos

ATLAS, NEXUS y VÉRTICE: gpt-6.1-sol. PIXEL: gpt-6.1-terra. CLOSER y LOGIX: gpt-6-luna. No hay cambio automático de modelo si la cuenta no tiene acceso.

## Límites iniciales

Tres consultas por minuto, veinte por día y US$5 mensuales de estimación conservadora. Reservas atómicas e identificadores de consulta evitan repeticiones accidentales. Las reservas de resultados no confirmados se mantienen. Los importes son estimaciones y no sustituyen la factura del proveedor.

## Activación pendiente

Después de la autorización explícita del dueño: desplegar la función, configurar/verificar OPENAI_API_KEY en los secretos de Supabase, cambiar AI_BRIDGE_ENABLED a true y publicar el frontend. Probar una consulta con la sesión real antes de afirmar que la conexión está verificada. No pegar claves en el chat ni en el código.

## Validación completada

Pruebas simuladas del endpoint: autenticación, CORS, clave ausente, validación de oficina, formato Responses, extracción de texto, contexto opcional, tokens, idempotencia, respuestas parciales, errores y resultados inciertos. Pruebas SQL con rollback: RLS, privilegios, reserva, duplicados, concurrencia y límites diario y mensual. Recorrido de las 38 secciones del frontend con sincronización simulada. No se realizó ninguna consulta real a OpenAI.
