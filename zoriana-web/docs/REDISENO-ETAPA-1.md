# ZORIANA — Rediseño administrativo, etapa 1

Estado: implementación local de prueba. Sin publicación, cambios DNS, migraciones ni cambios en servicios conectados.

## Fuente y respaldo

Repositorio de origen: https://github.com/graficasmodernas/Emprendimiento-, rama feature/zoriana-diseno; revisión auditada 26ad51dad4fadb60187501a2a90c219614943c21.
Checkout de publicación existente: zoriana-web, base c039cdceec22620c132e11b31772eed29dd37dd0. El despliegue usa dist y .openai/hosting.json; Site appgprj_6af9599e324c8191a34584cbbd5e7fe1. La consulta actual devuelve versión 4; no se generó un despliegue nuevo.

Respaldo local: backup/antes-panel-administrativo-20261115. Rama de trabajo local: feature/panel-administrativo-prueba. Ninguna rama se ha enviado al remoto.

Este respaldo cubre código, no datos de Supabase ni archivos de Obsidian. No se han exportado, borrado ni modificado datos del negocio. La copia de registros del usuario continúa disponible dentro de su sesión.

## Propuesta visual implementada

Cabecera con marca existente y acceso privado, navegación lateral, panel de prioridades, cuatro indicadores calculados desde registros internos y siete tarjetas de oficina. Colores: Gerencia morado; Investigación azul; Marketing #EF75B5; Ventas verde; Pedidos naranja; Logística turquesa; Finanzas amarillo. Vista adaptable mediante CSS para móvil.

Retirados del documento y ejecución: buscador público, carrito de demostración, categorías, promociones, catálogo y sus scripts. No se borró el almacenamiento anterior del carrito ni información comercial. El formulario de autenticación usa los mismos identificadores y proveedor.

Conservados: seis índices originales de oficina, formatos de almacenamiento, aprobaciones, formularios, exportación, memoria, cliente Supabase y puentes Obsidian/Ollama. Logística es una ruta de lectura adicional que comparte orders/incidents; no añade un séptimo índice que pudiera desplazar las memorias existentes. Sus formularios de guía y novedad reutilizan el módulo operativo original y mantienen las validaciones de guardado existentes.

propuesta.html es una maqueta estática sin registros, sesiones, scripts de negocio ni persistencia. Sus enlaces conducen a index.html, que requiere autenticación. No permite entrar a los registros sin sesión.

## Arquitectura posterior propuesta

- Shopify: fuente comercial de productos vendidos, pedidos y pagos.
- Dropi: proveedores, despachos y estados logísticos según capacidades y permisos que se verifiquen.
- ZORIANA: lectura, análisis, decisiones y controles administrativos.
- Backend privado: credenciales en variables de entorno, validación de webhooks según documentación oficial, reintentos y registro de errores.
- Persistencia futura: integraciones, mapeos de IDs, pedidos, eventos de sincronización y auditoría. Claves únicas por proveedor + tienda/cuenta + ID externo; deduplicación de eventos y procesamiento idempotente. Sin crear pedidos nuevos al recibir una actualización.
- Mantener separados estado financiero, estado comercial Shopify, estado logístico Dropi y estado administrativo interno. No inferir entrega, pago ni utilidad real de un estado interno.
- Finanzas: separar ingresos cobrados, montos pendientes, costos estimados y liquidados; indicadores con fuente y fecha de sincronización. El COD no se considera caja cobrada antes de su conciliación.
- Acceso: conservar autorización actual de dueño y evaluar políticas desplegadas antes de ampliar usuarios. Roles futuros con permisos de servidor y RLS, no solamente ocultación de botones. Auditoría de cambios privilegiados.
- Ollama y Python: análisis local, sin dependencia para la disponibilidad de la tienda Shopify. Obsidian: memoria complementaria; no base transaccional.

No se implementaron ni probaron APIs Shopify/Dropi, webhooks, nuevos roles, administración de usuarios ni auditoría de servidor en esta etapa. Que Shopify y Dropi estén conectados entre sí no verifica una conexión con ZORIANA.

## Validación y límites

Comprobadas sintaxis JavaScript, IDs únicos, ausencia de componentes comerciales y conservación exacta de ocho funciones operativas principales. Navegación de maqueta a formulario de acceso comprobada en navegador; no se inició sesión, no se envió un pedido ni se escribió un registro. Diseño de escritorio inspeccionado visualmente. CSS móvil preparado; prueba real en dispositivo móvil pendiente. Ollama, Obsidian y sincronización autenticada requieren prueba del dueño en su equipo; no se afirma una nueva validación de esas conexiones.

## Siguientes etapas

2: probar cada oficina con sesión autorizada; corregir los problemas previamente detectados en auxiliares de Investigación; implementar permisos y usuarios con migraciones revisadas y respaldo de datos.
3: verificar permisos y APIs oficiales Shopify/Dropi; sincronización de lectura con un registro controlado, deduplicación y separación de estados; solo después considerar operaciones de escritura expresamente autorizadas.

Publicación, cambios productivos y nuevas conexiones requieren autorización del dueño. Para revertir esta prueba, volver a la rama de respaldo; producción permanece en su versión previa.
