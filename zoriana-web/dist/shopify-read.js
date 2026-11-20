function renderShopifyList(target, resource) {
  const orders = resource === 'orders';
  const rows = new Map();
  const loadedCursors = new Set();
  let cursor = null;
  let syncedAt = null;
  let busy = false;
  const currentOwner = ownerId;
  const section = element('section', null, 'card');
  const controls = element('div', null, 'office-tabs');
  const status = element('p');
  status.setAttribute('role', 'status');
  const stamp = element('p');
  const results = element('div');
  const refresh = btn('Actualizar', () => load(true), 'secondary');
  const more = btn('Cargar más', () => load(false), 'secondary');
  const connect = btn('Conectar Shopify', () => shopifyAction('start', status, [connect]), 'secondary');
  more.hidden = true;
  connect.hidden = true;
  controls.append(refresh, more, connect);
  section.append(element('h2', orders ? 'Pedidos de Shopify' : 'Catálogo de Shopify'),
    element('p', 'Solo lectura · Fuente: Shopify'), controls, status, stamp, results);
  target.append(section);

  const labels = {
    PAID: 'Pagado', PENDING: 'Pendiente', AUTHORIZED: 'Autorizado', PARTIALLY_PAID: 'Pago parcial',
    REFUNDED: 'Reembolsado', PARTIALLY_REFUNDED: 'Reembolso parcial', VOIDED: 'Anulado', EXPIRED: 'Vencido',
    FULFILLED: 'Cumplido', UNFULFILLED: 'Sin cumplir', PARTIALLY_FULFILLED: 'Cumplimiento parcial',
    IN_PROGRESS: 'En proceso', ON_HOLD: 'En espera', SCHEDULED: 'Programado', OPEN: 'Abierto',
    ACTIVE: 'Activo', DRAFT: 'Borrador', ARCHIVED: 'Archivado', UNLISTED: 'No listado'
  };
  function date(value) {
    return value ? new Date(value).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '—';
  }
  function show() {
    stamp.textContent = syncedAt ? 'Última consulta exitosa: ' + date(syncedAt) + ' (Colombia)' : '';
    results.replaceChildren();
    if (!syncedAt) return;
    if (!rows.size) {
      empty(results, orders ? 'Shopify no devolvió pedidos visibles con esta autorización.' : 'Shopify no devolvió productos visibles.');
      return;
    }
    const label = value => labels[value] || value || 'Sin informar';
    if (orders) {
      table(results, ['Pedido', 'Fecha', 'Pago', 'Cumplimiento', 'Total actual'],
        [...rows.values()].map(row => [row.name || row.id, date(row.createdAt), label(row.financialStatus),
          label(row.fulfillmentStatus), row.total != null ? row.total + ' ' + (row.currency || '') : '—']));
    } else {
      table(results, ['Producto', 'Estado'], [...rows.values()].map(row => [row.title, label(row.status)]));
    }
  }
  async function load(reset) {
    if (busy || (!reset && !cursor)) return;
    busy = refresh.disabled = more.disabled = true;
    section.setAttribute('aria-busy', 'true');
    status.textContent = 'Consultando Shopify…';
    try {
      const { data } = await client.auth.getSession();
      if (!data?.session) throw new Error('session_required');
      const after = reset ? null : cursor;
      const response = await fetch('/api/shopify/' + resource, {
        method: 'POST', credentials: 'same-origin', redirect: 'error',
        signal: AbortSignal.timeout(25000),
        headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ after })
      });
      const page = await response.json();
      if (page.error || !response.ok || !Array.isArray(page.rows)) throw new Error(page.error || 'shopify_read_failed');
      if (!section.isConnected || ownerId !== currentOwner) return;
      if (!reset && page.nextCursor && loadedCursors.has(page.nextCursor)) throw new Error('shopify_read_failed');
      if (reset) {
        rows.clear();
        loadedCursors.clear();
      }
      for (const row of page.rows) {
        const existing = rows.get(row.id);
        if (!existing || !orders || String(row.updatedAt) >= String(existing.updatedAt)) rows.set(row.id, row);
      }
      cursor = page.nextCursor;
      if (cursor) loadedCursors.add(cursor);
      syncedAt = page.checkedAt;
      connect.hidden = true;
      status.textContent = rows.size + (orders ? ' pedidos cargados.' : ' productos cargados.');
      show();
    } catch (error) {
      if (!section.isConnected || ownerId !== currentOwner) return;
      const code = error.message;
      const messages = {
        session_required: 'Inicia sesión en Zoriana Administración.',
        authorization_required: 'Autoriza la lectura de Shopify o renueva la conexión.',
        credentials_not_configured: 'Falta configurar la conexión en el servidor de desarrollo.',
        platform_sign_in_required: 'Inicia sesión en el acceso privado del panel.',
        owner_access_required: 'Esta cuenta no tiene acceso de propietario.',
        shopify_access_denied: 'Shopify rechazó la lectura. Revisa los permisos actuales de la app.',
        shopify_throttled: 'Shopify limitó las consultas. Espera unos segundos y vuelve a intentar.'
      };
      if (['session_required', 'authorization_required', 'platform_sign_in_required', 'owner_access_required', 'shopify_access_denied'].includes(code)) {
        rows.clear();
        cursor = syncedAt = null;
        loadedCursors.clear();
        show();
      }
      connect.hidden = code !== 'authorization_required';
      status.textContent = (messages[code] || 'No se pudo consultar Shopify. Intenta actualizar.') +
        (syncedAt ? ' Se muestran los datos de la última consulta exitosa.' : '');
    } finally {
      busy = refresh.disabled = more.disabled = false;
      more.hidden = !cursor;
      section.removeAttribute('aria-busy');
    }
  }
  load(true);
}
