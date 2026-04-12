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
  const resizedFile = await resizeImage(file);
  const fd = new FormData();
  fd.append('file', resizedFile);
  const res = await fetch(`${BASE_URL}/api/organizer/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Ошибка загрузки');
  return (await res.json()).url;
}

// Resize image to max 1920px width, JPEG quality 0.85
async function resizeImage(file, maxWidth = 1920, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Only resize if wider than maxWidth
      if (width <= maxWidth) { resolve(file); return; }
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const resizedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        resolve(resizedFile);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
