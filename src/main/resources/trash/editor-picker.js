// ═══════════════════════════════════════════════════════════════════════════
// Editor Picker — Step 1: template selection UI
// Depends on: editor-utils.js (esc, CAT_LABEL, STEP1_CATEGORIES), APP global
// ═══════════════════════════════════════════════════════════════════════════

function renderTemplatePicker(templates) {
  const root = document.getElementById('step1');
  if (!root) return;

  if (!root.dataset.bound) {
    root.dataset.bound = '1';
    root.addEventListener('click', (e) => {
      const catBtn = e.target.closest('[data-cat]');
      if (catBtn) {
        const next = catBtn.getAttribute('data-cat');
        if (next && next !== APP.ui.step1Category) {
          APP.ui.step1Category = next;
          renderTemplatePicker(window._templates || []);
        }
        return;
      }
      const tplBtn = e.target.closest('[data-tpl-id]');
      if (tplBtn) {
        selectTemplate(parseInt(tplBtn.getAttribute('data-tpl-id'), 10));
        return;
      }
      const cont = e.target.closest('[data-step1-continue]');
      if (cont) goToEditor();
    });
  }

  const present = new Set((templates || []).map(t => t.category).filter(Boolean));
  const cats = STEP1_CATEGORIES.filter(c => c.key === 'ALL' || present.has(c.key));
  if (APP.ui.step1Category !== 'ALL' && !present.has(APP.ui.step1Category)) APP.ui.step1Category = 'ALL';

  const filtered = APP.ui.step1Category === 'ALL' ? templates : templates.filter(t => t.category === APP.ui.step1Category);
  if (APP.ui.selectedTemplate && !filtered.some(t => t.id === APP.ui.selectedTemplate.id)) {
    APP.ui.selectedTemplate = null;
  }

  root.innerHTML = `
    <section class="space-y-4">
      <div>
        <h2 class="font-cormorant text-[30px] font-semibold italic text-[#1E2820] leading-tight">Выберите шаблон</h2>
        <p class="text-[#6B6860] text-sm mt-1 leading-relaxed">Можно поменять позже — ссылка останется той же.</p>
      </div>
      <div class="relative -mx-4">
        <div class="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#FAFAF8] to-transparent z-10 pointer-events-none"></div>
        <div class="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[#FAFAF8] to-transparent z-10 pointer-events-none"></div>
        <div class="flex gap-2 px-4 overflow-x-auto" style="scrollbar-width:none">
          ${cats.map(c => {
            const active = c.key === APP.ui.step1Category;
            return `<button data-cat="${c.key}" class="flex-shrink-0 h-10 px-4 rounded-full text-xs font-semibold border transition-all active:scale-95
              ${active ? 'bg-[#1E2820] text-white border-[#1E2820]' : 'bg-white text-[#6B6860] border-[#E8E4DE]'}">${c.label}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${filtered.map(t => templateCard(t)).join('')}
      </div>
      <div class="h-28"></div>
    </section>
    <div class="fixed left-0 right-0 z-40 px-4" style="bottom:calc(64px + env(safe-area-inset-bottom,0px) + 12px)">
      <div class="max-w-2xl mx-auto">
        <button id="btn-next" data-step1-continue class="w-full h-14 rounded-2xl font-semibold text-[15px] text-white
          bg-gradient-to-r from-[#3D6B45] via-[#2E4F35] to-[#1E2820] shadow-[0_10px_30px_rgba(30,40,32,0.22)]
          active:scale-95 transition-transform disabled:opacity-40 disabled:shadow-none" ${APP.ui.selectedTemplate ? '' : 'disabled'}>
          Продолжить
        </button>
      </div>
    </div>`;
  initPreviewScales(root);
}

function templateCard(t) {
  const sel = APP.ui.selectedTemplate && APP.ui.selectedTemplate.id === t.id;
  const cat = CAT_LABEL[t.category] || t.category || '';
  const previewSrc = t.templatePath ? `/templates/${t.templatePath}/index.html?mode=preview` : null;
  const previewHtml = previewSrc
    ? `<div class="aspect-[9/16] relative overflow-hidden bg-[#F0EDE9]" data-preview-wrap>
         <div class="absolute inset-0 bg-gradient-to-br from-[#F0EDE9] to-[#E8E4DE]" data-preview-skeleton></div>
         <iframe src="${esc(previewSrc)}"
           style="position:absolute;top:0;left:0;width:375px;height:667px;transform-origin:top left;pointer-events:none;border:none;opacity:0;transition:opacity .4s"
           loading="lazy" sandbox="allow-scripts allow-same-origin"
           onload="this.style.opacity=1;this.previousElementSibling&&this.previousElementSibling.remove()"></iframe>
       </div>`
    : `<div class="aspect-[9/16]">${previewClassic()}</div>`;
  return `
    <button data-tpl-id="${t.id}" class="group relative w-full text-left rounded-3xl overflow-hidden bg-white border transition-all active:scale-95
      ${sel ? 'border-[#3D6B45] ring-2 ring-[#C2E0C6]' : 'border-[#E8E4DE]'}">
      ${previewHtml}
      <div class="absolute top-3 left-3">
        <span class="text-[10px] px-2.5 py-1 rounded-full bg-white/90 backdrop-blur border border-[#E8E4DE] font-semibold text-[#1E2820]">${cat}</span>
      </div>
      <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/55 via-black/5 to-transparent">
        <p class="text-white font-semibold text-[13px] leading-tight">${esc(t.name)}</p>
        ${t.description ? `<p class="text-white/70 text-[11px] mt-1 line-clamp-2">${esc(t.description)}</p>` : ''}
      </div>
      <div class="absolute top-3 right-3">
        <div class="w-8 h-8 rounded-full bg-white/90 backdrop-blur border border-[#E8E4DE] flex items-center justify-center transition-all
          ${sel ? 'text-[#3D6B45]' : 'text-[#6B6860] opacity-0 group-hover:opacity-100'}">
          ${sel
            ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
            : '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>'}
        </div>
      </div>
    </button>`;
}

function selectTemplate(id) {
  const templates = window._templates || [];
  const prev = APP.ui.selectedTemplate;
  APP.ui.selectedTemplate = templates.find(t => t.id === id) || null;

  if (prev) {
    const oldCard = document.querySelector(`[data-tpl-id="${prev.id}"]`);
    if (oldCard) {
      oldCard.classList.remove('border-[#3D6B45]', 'ring-2', 'ring-[#C2E0C6]');
      oldCard.classList.add('border-[#E8E4DE]');
      const check = oldCard.querySelector('.absolute.top-3.right-3 > div');
      if (check) { check.classList.remove('text-[#3D6B45]'); check.classList.add('text-[#6B6860]', 'opacity-0'); check.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>'; }
    }
  }
  if (APP.ui.selectedTemplate) {
    const newCard = document.querySelector(`[data-tpl-id="${APP.ui.selectedTemplate.id}"]`);
    if (newCard) {
      newCard.classList.add('border-[#3D6B45]', 'ring-2', 'ring-[#C2E0C6]');
      newCard.classList.remove('border-[#E8E4DE]');
      const check = newCard.querySelector('.absolute.top-3.right-3 > div');
      if (check) { check.classList.remove('text-[#6B6860]', 'opacity-0'); check.classList.add('text-[#3D6B45]'); check.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'; }
    }
  }
  const btn = document.getElementById('btn-next');
  if (btn) btn.disabled = !APP.ui.selectedTemplate;
}

async function goToEditor() {
  const tpl = APP.ui.selectedTemplate;
  if (!tpl) return;

  try {
    const schemaUrl = `/templates/${tpl.templatePath}/schema.json`;
    const schema = await fetch(schemaUrl).then(r => {
      if (!r.ok) throw new Error('Schema not found');
      return r.json();
    });

    // Preserve existing block data before re-initialising with new schema
    const oldBlocks = JSON.parse(JSON.stringify(APP.blocks));
    APP.schema = schema;
    initStateFromSchema(schema);
    migrateBlocks(oldBlocks, schema);

    APP.ui.activeBlock = schema.blocks[0]?.type || null;
    openEditorOverlay();
  } catch (err) {
    showToast('Не удалось загрузить схему шаблона', 'error');
    console.error(err);
  }
}

// Copy matching block/field data from old state into newly initialised APP.blocks.
// form-scoped fields (person1, person2, etc.) live in APP.form and are unaffected.
function migrateBlocks(oldBlocks, newSchema) {
  for (const blockDef of newSchema.blocks) {
    const type = blockDef.type;
    const old = oldBlocks[type];
    if (!old) continue;
    const cur = APP.blocks[type];
    if (!cur) continue;

    if (blockDef.toggleable && old.enabled !== undefined) {
      cur.enabled = old.enabled;
    }

    for (const section of blockDef.sections || []) {
      for (const field of section.fields || []) {
        if (field.type === 'info' || field.scope === 'form') continue;
        const key = field.key;
        if (old[key] !== undefined) cur[key] = old[key];
      }
    }
  }
}

function previewClassic() {
  return `<div class="w-full h-full bg-gradient-to-br from-[#1E2820] via-[#2E4331] to-[#3D6B45] relative">
    <div class="absolute inset-0 opacity-60" style="background:radial-gradient(ellipse at top,rgba(194,224,198,0.35) 0%,transparent 70%)"></div>
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
      <p class="text-white/65 text-[10px] tracking-[0.32em] uppercase">Приглашение</p>
      <p class="mt-2 font-cormorant italic text-white text-3xl leading-tight">Азамат</p>
      <p class="font-cormorant italic text-white/60 text-2xl">&amp;</p>
      <p class="font-cormorant italic text-white text-3xl leading-tight">Бегимай</p>
      <div class="mt-4 w-10 h-px bg-white/25"></div>
      <p class="mt-3 text-white/60 text-[11px] tracking-widest uppercase">20 · 12 · 2026</p>
    </div></div>`;
}

function initPreviewScales(root) {
  (root || document).querySelectorAll('[data-preview-wrap]').forEach(wrap => {
    const iframe = wrap.querySelector('iframe');
    if (!iframe) return;
    const scale = wrap.offsetWidth / 375;
    iframe.style.transform = `scale(${scale})`;
    // Also fix height so the container clips correctly
    iframe.style.height = `${Math.ceil((wrap.offsetWidth * 16 / 9) / scale)}px`;
  });
}
