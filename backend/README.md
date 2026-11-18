# Shopify OAuth — estado

Flujo OAuth de autorización de código para app externa. Reemplaza client_credentials.
Rutas: POST /api/shopify/start; GET /api/shopify/callback; POST /api/shopify/status.
URL de retorno a registrar en Shopify: https://zoriana-vista-tienda.graficasmodernasas.chatgpt.site/api/shopify/callback
Requiere secretos de runtime SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET y SUPABASE_PUBLISHABLE_KEY. No están incluidos en código.

Inicio requiere identidad Sites, sesión Supabase y autorización de dueño mediante RLS. Retorno valida dominio fijo, state ligado al visitante, caducidad y HMAC. Token en cookie cifrada AES-GCM, HttpOnly, Secure, SameSite=Lax, máxima duración 24 horas limitada por expires_in. No se guarda refresh token; al caducar se debe autorizar de nuevo. No es todavía una sincronización desatendida ni multidispositivo. No hay lecturas ni modificaciones de pedidos en esta etapa: solo identidad de tienda.

Pruebas simuladas aprobadas: identidad ausente, configuración ausente, origen ajeno, permisos solicitados, state ligado al visitante, firma inválida, token cifrado y verificación autenticada. Sin credenciales reales no está verificada la conexión en vivo.

El acceso privado de Sites se conserva: el retorno OAuth necesita la sesión del dueño en el navegador. No se debe hacer público el sitio ni generar un bypass para Shopify. Si el acceso de Sites interfiere con el retorno, detener y revisar el flujo, sin rebajar el acceso.

Documentación: https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps?lang=node
