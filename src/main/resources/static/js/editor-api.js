// ═══════════════════════════════════════════════════════════════════════════
// Editor API — HTTP client for templates, events, uploads
// ═══════════════════════════════════════════════════════════════════════════

const BASE_URL = '';

async function fetchTemplates() {
  const res = await fetch(`${BASE_URL}/api/organizer/templates`);
  if (!res.ok) throw new Error('Ошибка загрузки шаблонов');
  return res.json();
}

async function fetchEvent(id, phone) {
  const res = await fetch(`${BASE_URL}/api/organizer/events/${id}`, {
    headers: { 'X-User-Phone': phone },
  });
  if (!res.ok) throw new Error('Событие не найдено');
  return res.json();
}

async function saveEvent(phone, data, id = null) {
  const url    = id ? `${BASE_URL}/api/organizer/events/${id}` : `${BASE_URL}/api/organizer/events`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-User-Phone': phone },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Ошибка сохранения');
  }
  return res.json();
}

async function uploadPhoto(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE_URL}/api/organizer/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Ошибка загрузки');
  return (await res.json()).url;
}
