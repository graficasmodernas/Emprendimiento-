window.mountMessenger = (client) => {
  const panel = document.getElementById('messenger-panel');
  const list = document.getElementById('messenger-list');
  const detail = document.getElementById('messenger-detail');
  const search = document.getElementById('messenger-search');
  const count = document.getElementById('messenger-count');
  const filter = document.getElementById('messenger-filter');
  const settingsToggle = document.getElementById('messenger-config');
  const preferences = document.getElementById('messenger-preferences');
  const mode = document.getElementById('messenger-mode');
  const back = document.getElementById('messenger-back');
  const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  const status = document.getElementById('messenger-status');
  const form = document.getElementById('messenger-settings');
  const automatic = form.elements.automatic;
  const instructions = form.elements.instructions;
  const drafts = new Map();
  const stateLabels = {
    pending: 'Esperando sugerencia', draft: 'Borrador', human: 'Revisión humana',
    sending: 'Enviando', sent: 'Enviado', failed: 'Error de entrega',
  };
  let config;
  let owner;
  let busy = false;
  let rowsKey = '';
  let rows = [];
  let selectedId;
  let detailKey = '';
  let replyId;
  let refreshId = 0;

  function clear() {
    panel.hidden = true;
    closePreferences();
    mode.hidden = true;
    list.replaceChildren();
    detail.replaceChildren();
    filter.value = 'all';
    search.value = '';
    count.textContent = '';
    rows = [];
    selectedId = undefined;
    detailKey = '';
    delete panel.dataset.mobileView;
    refreshId++;
    form.reset();
    form.hidden = true;
    status.textContent = '';
    drafts.clear();
    config = null;
    rowsKey = '';
    replyId = undefined;
  }

  async function call(payload) {
    const { data, error } = await client.functions.invoke('zoriana-messenger-reply', { body: payload });
    if (error) {
      const details = await error.context?.json?.().catch(() => null);
      const messages = {
        failed: 'Meta rechazó el envío. Revisa la entrega antes de reintentar.',
        unavailable: 'El mensaje ya fue procesado o está fuera del plazo de respuesta.',
        unconfigured: 'Falta configurar el envío de Messenger.',
      };
      throw new Error(details?.delivery_error === 'unknown'
        ? 'No se pudo confirmar la entrega. Verifica el chat en Meta antes de enviar otro mensaje.'
        : messages[details?.status] || 'No se pudo completar la operación. Actualiza la bandeja e inténtalo de nuevo.');
    }
    return data;
  }

  function el(tag, text) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }

  function closePreferences() {
    preferences.hidden = true;
    settingsToggle.setAttribute('aria-expanded', 'false');
  }

  function badge(row) {
    const node = el('span', stateLabels[row.status] || row.status);
    node.className = 'messenger-badge messenger-badge-' + row.status;
    return node;
  }

  function bubble(label, text, direction) {
    const node = el('div');
    node.className = 'messenger-bubble messenger-bubble-' + direction;
    const body = el('p', text);
    body.className = 'messenger-text';
    node.append(el('strong', label), body);
    return node;
  }

  function normalizeSearch(text) {
    return (text || '').toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '');
  }

  const clientLabel = id => 'Cliente · ' + String(id).slice(-6);
  const dateLabel = row => dateFormat.format(new Date(row.sent_at));

  function visibleCustomers() {
    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(row.sender_id)) groups.set(row.sender_id, []);
      groups.get(row.sender_id).push(row);
    }
    const query = normalizeSearch(search.value.trim());
    return [...groups].filter(([id, messages]) => {
      const latest = messages[0];
      const inFilter = filter.value === 'all' || latest.status === filter.value ||
        (filter.value === 'open' && ['draft', 'pending', 'human'].includes(latest.status));
      return inFilter && (!query || normalizeSearch(clientLabel(id)).includes(query) ||
        messages.some(row => normalizeSearch(row.message_text).includes(query) ||
          normalizeSearch(row.response_text).includes(query)));
    });
  }

  function replyOptions(row) {
    const recent = Date.now() - Date.parse(row.sent_at) < 23.9 * 3600000;
    const canCorrect = ['draft', 'human'].includes(row.status);
    const canSend = recent && (['pending', 'draft', 'human'].includes(row.status) ||
      (row.status === 'failed' && row.delivery_error?.startsWith('meta_')));
    return { canSend, canCorrect };
  }

  function render(force = false, focusDetail = false) {
    const visible = visibleCustomers();
    count.textContent = visible.length.toLocaleString('es-CO');
    if (!visible.some(([id]) => id === selectedId)) {
      selectedId = visible[0]?.[0];
      replyId = undefined;
    }
    if (!selectedId) delete panel.dataset.mobileView;
    const previousFocus = document.activeElement?.dataset.customerId;
    const fragment = document.createDocumentFragment();
    if (!visible.length) {
      const empty = el('li', search.value.trim() ? 'No se encontraron clientes ni mensajes.' : 'No hay conversaciones en esta vista.');
      empty.className = 'messenger-empty';
      fragment.append(empty);
    }
    for (const [id, messages] of visible) {
      const row = messages[0];
      const item = el('li');
      const open = el('button');
      open.type = 'button';
      open.className = 'messenger-item';
      open.dataset.customerId = id;
      open.setAttribute('aria-current', id === selectedId ? 'true' : 'false');

      const icon = el('span');
      icon.className = 'messenger-item-icon';
      icon.setAttribute('aria-hidden', 'true');
      const content = el('span');
      content.className = 'messenger-item-content';
      const title = el('span', clientLabel(id));
      title.className = 'messenger-item-title';
      const preview = el('span', row.message_text || (row.has_attachments ? 'Mensaje con adjunto' : 'Mensaje sin texto'));
      preview.className = 'messenger-item-preview';
      const meta = el('span');
      meta.className = 'messenger-item-meta';
      meta.append(badge(row), el('small', dateLabel(row)));
      content.append(title, preview, meta);
      open.append(icon, content);
      open.onclick = () => {
        if (selectedId !== id) replyId = undefined;
        selectedId = id;
        panel.dataset.mobileView = 'detail';
        render(true, true);
      };
      item.append(open);
      fragment.append(item);
    }
    list.replaceChildren(fragment);
    if (previousFocus && !focusDetail) {
      [...list.querySelectorAll('button')].find(button => button.dataset.customerId === previousFocus)?.focus({ preventScroll: true });
    }

    const messages = visible.find(([id]) => id === selectedId)?.[1];
    const key = JSON.stringify(messages);
    if (!force && (key === detailKey || detail.contains(document.activeElement))) return;
    detailKey = key;
    if (!messages) {
      const empty = el('p', 'Selecciona un cliente para ver su conversación.');
      empty.className = 'messenger-empty';
      detail.replaceChildren(empty);
      return;
    }

    const current = messages.find(row => row.message_id === replyId) || messages[0];
    const previousThread = detail.querySelector('.messenger-thread');
    const keepPosition = previousThread?.dataset.customerId === selectedId && !focusDetail;
    const nearBottom = previousThread && previousThread.scrollHeight - previousThread.scrollTop - previousThread.clientHeight < 40;

    const card = el('article');
    card.className = 'messenger-card';
    const heading = el('div');
    heading.className = 'messenger-detail-heading';
    const title = el('h3', clientLabel(selectedId));
    title.tabIndex = -1;
    heading.append(title, badge(messages[0]), el('small', 'Messenger'));
    const thread = el('div');
    thread.className = 'messenger-thread';
    thread.dataset.customerId = selectedId;
    card.append(heading, thread);

    for (const row of [...messages].reverse()) {
      const incoming = bubble('Cliente', row.message_text || 'Mensaje sin texto', 'incoming');
      incoming.append(el('small', dateLabel(row)));
      if (row.has_attachments) incoming.append(el('p', 'Consulta los adjuntos en Meta Business Suite.'));
      if (row.status === 'failed' && row.delivery_error === 'unknown') {
        incoming.append(el('p', 'Entrega por confirmar en Meta Business Suite.'));
      }
      const options = replyOptions(row);
      if (row !== current && (options.canSend || options.canCorrect)) {
        const reply = el('button', 'Responder a este mensaje');
        reply.className = 'secondary messenger-reply-target';
        reply.onclick = () => {
          replyId = row.message_id;
          render(true);
          document.getElementById('messenger-reply')?.focus({ preventScroll: true });
        };
        incoming.append(reply);
      }
      thread.append(incoming);
      if (row.status === 'sent') {
        thread.append(bubble('Zoriana', row.response_text || 'El texto de este envío no está disponible.', 'outgoing'));
      }
    }
    const { canSend, canCorrect } = replyOptions(current);
    if (canSend || canCorrect) addEditor(card, current, canSend, canCorrect);
    else if (['pending', 'draft', 'human'].includes(current.status)) thread.append(el('p', 'Ventana de envío vencida.'));
    detail.replaceChildren(card);
    thread.scrollTop = keepPosition && !nearBottom ? previousThread.scrollTop : thread.scrollHeight;
    if (focusDetail) title.focus({ preventScroll: true });
  }

  function addEditor(card, row, canSend, canCorrect) {
    const editor = el('textarea');
    editor.rows = 3;
    editor.maxLength = 500;
    editor.id = 'messenger-reply';
    editor.placeholder = 'Escribe la respuesta de Zoriana…';
    const replyLabel = el('label', row.suggestion ? 'Sugerencia de IA · Puedes editarla' : 'Tu respuesta');
    replyLabel.htmlFor = editor.id;
    editor.value = drafts.get(row.message_id) ?? row.suggestion ?? '';
    editor.oninput = () => drafts.set(row.message_id, editor.value);
    const controls = el('div');
    controls.className = 'messenger-actions';
    const learn = el('input');
    learn.type = 'checkbox';
    learn.checked = drafts.get(row.message_id + '-learn') === true;
    learn.onchange = () => drafts.set(row.message_id + '-learn', learn.checked);
    const label = el('label');
    label.className = 'messenger-check';
    label.append(learn, ' Guardar como ejemplo al enviar');
    const run = (action) => async () => {
      const answer = editor.value.trim();
      if (!answer) {
        status.textContent = 'Escribe una respuesta antes de continuar.';
        editor.focus();
        return;
      }
      await mutate(async () => {
        await call({ action, id: row.message_id, answer, learn: learn.checked });
        drafts.delete(row.message_id);
        drafts.delete(row.message_id + '-learn');
        status.textContent = action === 'send' ? 'Meta confirmó el envío.' : 'Corrección guardada como ejemplo.';
      });
    };
    if (canSend && canCorrect) {
      const generate = el('button', 'Pedir sugerencia');
      generate.className = 'secondary';
      generate.onclick = () => mutate(async () => {
        await call({ action: 'generate', id: row.message_id });
        drafts.delete(row.message_id);
        drafts.delete(row.message_id + '-learn');
        status.textContent = 'Sugerencia solicitada a EXPLORER.';
      });
      controls.append(generate);
    }
    if (canSend) {
      const send = el('button', 'Enviar por Messenger');
      send.onclick = run('send');
      controls.append(send, label);
    }
    if (canCorrect) {
      const save = el('button', 'Guardar corrección');
      save.className = 'secondary';
      save.onclick = run('correct');
      controls.append(save);
    }
    const composer = el('div');
    composer.className = 'messenger-composer';
    composer.append(replyLabel, editor, controls);
    card.append(composer);
    composer.addEventListener('focusout', (event) => {
      if (!composer.contains(event.relatedTarget) && JSON.stringify(visibleCustomers().find(([id]) => id === selectedId)?.[1]) !== detailKey) {
        setTimeout(() => { if (!detail.contains(document.activeElement)) render(true); }, 0);
      }
    });
  }

  async function loadMessages(requestId) {
    const messages = [];
    const pageSize = 500;
    while (requestId === refreshId) {
      const { data, error } = await client.from('zoriana_messenger_inbox')
        .select('sender_id,message_id,message_text,has_attachments,sent_at,status,suggestion,response_text,delivery_error,corrected')
        .order('received_at', { ascending: false }).order('message_id')
        .range(messages.length, messages.length + pageSize - 1);
      if (error) return { error };
      messages.push(...data);
      if (data.length < pageSize) return { data: [...new Map(messages.map(row => [row.message_id, row])).values()] };
    }
    return { data: [] };
  }

  async function refresh(force = false) {
    if (!owner || panel.hidden || busy) return;
    const user = owner;
    const requestId = ++refreshId;
    const [settingsResult, inboxResult] = await Promise.all([
      client.from('zoriana_messenger_settings').select('automatic,instructions,revision').maybeSingle(),
      loadMessages(requestId),
    ]);
    if (requestId !== refreshId || user !== owner || panel.hidden || busy) return;
    if (settingsResult.error || inboxResult.error || !settingsResult.data) {
      status.textContent = 'No se pudo abrir la bandeja con esta sesión.';
      return;
    }
    if (!config) {
      config = settingsResult.data;
      automatic.checked = config.automatic;
      instructions.value = config.instructions;
      form.hidden = false;
    }
    mode.hidden = false;
    mode.dataset.active = String(settingsResult.data.automatic);
    mode.textContent = settingsResult.data.automatic ? 'Envío automático activo' : 'Modo sugerencias';
    const key = JSON.stringify(inboxResult.data);
    if (force || key !== rowsKey) {
      rows = inboxResult.data;
      rowsKey = key;
      render(force);
    }
  }

  async function mutate(work) {
    if (busy) return;
    busy = true;
    status.textContent = 'Guardando…';
    for (const button of panel.querySelectorAll('button')) button.disabled = true;
    try {
      await work();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      for (const button of panel.querySelectorAll('button')) button.disabled = false;
      await refresh(true);
    }
  }

  settingsToggle.onclick = () => {
    if (preferences.hidden) {
      preferences.hidden = false;
      settingsToggle.setAttribute('aria-expanded', 'true');
    } else closePreferences();
  };
  filter.onchange = () => {
    delete panel.dataset.mobileView;
    render(true);
  };
  search.oninput = filter.onchange;
  back.onclick = () => {
    delete panel.dataset.mobileView;
    list.querySelector('[aria-current="true"]')?.focus();
  };

  form.onsubmit = (event) => {
    event.preventDefault();
    if (automatic.checked && !config.automatic &&
      !window.confirm('¿Activar el envío automático de respuestas para los mensajes nuevos?')) return;
    mutate(async () => {
      const result = await call({ action: 'settings', automatic: automatic.checked, instructions: instructions.value, revision: config.revision });
      config = result.settings;
      status.textContent = 'Configuración guardada.';
    });
  };
  document.getElementById('messenger-refresh').onclick = () => {
    config = null;
    refresh(true);
  };
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
  return {
    setOwner(id) {
      if (id !== owner) {
        owner = id;
        clear();
      }
    },
    setVisible(visible, focus) {
      const open = Boolean(visible && owner);
      const changed = panel.hidden === open;
      panel.hidden = !open;
      if (!open && changed) refreshId++;
      if (open && (changed || focus)) refresh(true);
    },
  };
};
