window.__landingConfig = null;

    function lEsc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function lLines(value) {
        return lEsc(value).replace(/\n/g, '<br/>');
    }

    function lSetText(selector, value) {
        const el = document.querySelector(selector);
        if (el && value !== undefined && value !== null) el.textContent = value;
    }

    function lSetHtml(selector, value) {
        const el = document.querySelector(selector);
        if (el && value !== undefined && value !== null) el.innerHTML = lLines(value);
    }

    function lHeroBadgeText(value) {
        if (value === undefined || value === null) return value;
        return String(value).replace(/^[\s★☆⭐✦✭]+/, '').trimStart();
    }

    function lSection(name) {
        return document.querySelector(`[data-l-section="${name}"]`);
    }

    function lIdle(cb, timeout = 1200) {
        const run = () => {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(cb, { timeout });
            } else {
                window.setTimeout(cb, 1);
            }
        };
        if (document.readyState === 'complete') run();
        else window.addEventListener('load', run, { once: true });
    }

    function lApplySectionVisibility(sections = {}) {
        Object.entries(sections).forEach(([name, enabled]) => {
            const el = lSection(name);
            if (el) el.style.display = enabled === false ? 'none' : '';
        });
    }

    function lApplyMeta(meta = {}) {
        if (meta.title) document.title = meta.title;
        const desc    = document.querySelector('meta[name="description"]');
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDesc  = document.querySelector('meta[property="og:description"]');
        const ogImg   = document.querySelector('meta[property="og:image"]');
        if (desc    && meta.description)   desc.setAttribute('content', meta.description);
        if (ogTitle && meta.ogTitle)        ogTitle.setAttribute('content', meta.ogTitle);
        if (ogDesc  && meta.ogDescription) ogDesc.setAttribute('content', meta.ogDescription);
        if (ogImg   && meta.ogImage)        ogImg.setAttribute('content', meta.ogImage);
    }

    function lApplyBrand(brand = {}) {
        if (brand.primaryColor || brand.gradientEnd) {
            let style = document.getElementById('l-brand-override');
            if (!style) {
                style = document.createElement('style');
                style.id = 'l-brand-override';
                document.head.appendChild(style);
            }
            const p = brand.primaryColor || '#F93B7A';
            const g = brand.gradientEnd  || '#FF6D45';
            style.textContent = `:root{--color-accent:${p};--color-accent-2:${g};--color-accent-gradient:linear-gradient(135deg,${p} 0%,${g} 100%);}`;
        }
        if (brand.logoText) {
            document.querySelectorAll(
                'header a[href="/"] span.font-bold, [data-l-section="footer"] .flex.items-center span.font-bold'
            ).forEach(el => { el.textContent = brand.logoText; });
        }
    }

    function lApplyHero(hero = {}) {
        lSetText('[data-l-hero-badge-text]', lHeroBadgeText(hero.badge));
        lSetText('[data-l-section="hero"] h1 span.text-gray-900', hero.titleTop);
        lSetText('[data-l-section="hero"] h1 .grad-text', hero.titleAccent);
        lSetHtml('[data-l-section="hero"] p.fu-2', hero.subtitle);
        lSetText('[data-l-hero-primary-cta]', hero.primaryCta);
        lSetText('[data-l-hero-secondary-cta]', hero.secondaryCta);
        if (Array.isArray(hero.bullets)) {
            const wrap = document.querySelector('[data-l-section="hero"] .fu-4');
            if (wrap) wrap.innerHTML = hero.bullets.map(item => `
                <span class="inline-flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ${lEsc(item)}
                </span>
            `).join('');
        }
        const heroSection = lSection('hero');
        if (heroSection && hero.bgImage !== undefined) {
            heroSection.style.backgroundImage   = hero.bgImage ? `url(${hero.bgImage})` : '';
            heroSection.style.backgroundSize    = hero.bgImage ? 'cover' : '';
            heroSection.style.backgroundPosition = hero.bgImage ? 'center' : '';
        }
    }

    function lApplyMiniFeatures(items) {
        if (!Array.isArray(items)) return;
        document.querySelectorAll('[data-l-section="miniFeatures"] > div span').forEach((el, i) => {
            if (items[i]?.title) el.innerHTML = lLines(items[i].title);
        });
    }

    function lApplyPhoneMockup(mockup = {}) {
        if (!mockup.screenshotUrl) return;
        const img = document.querySelector('.ip-screenshot');
        if (img) img.src = mockup.screenshotUrl;
    }

    function lApplyStats(stats = {}) {
        lSetHtml('[data-l-section="stats"] .text-\\[11px\\].text-gray-800', stats.socialProof);
        if (Array.isArray(stats.items)) {
            document.querySelectorAll('[data-l-section="stats"] .grid.grid-cols-3 > div').forEach((el, i) => {
                const item = stats.items[i];
                if (!item) return;
                const valueEl = el.querySelector('div:first-child');
                const labelEl = el.querySelector('div:last-child');
                if (valueEl) valueEl.textContent = item.value || '';
                if (labelEl) labelEl.textContent = item.label || '';
            });
        }
    }

    function lRenderTrust(items) {
        if (!Array.isArray(items)) return;
        const track = document.querySelector('[data-l-section="trust"] .marquee-track');
        if (!track) return;
        const doubled = items.concat(items);
        track.innerHTML = doubled.map(item => `<span class="marquee-item">${lEsc(item)}</span>`).join('');
    }

    function lTitleHtml(value) {
        const text = String(value || '');
        const parts = text.split(' ');
        if (parts.length < 2) return lEsc(text);
        const accent = parts.slice(Math.ceil(parts.length / 2)).join(' ');
        const lead = parts.slice(0, Math.ceil(parts.length / 2)).join(' ');
        return `${lEsc(lead)} <span class="grad-text">${lEsc(accent)}</span>`;
    }

    function lRenderCategories(categories = {}) {
        const section = lSection('categories');
        if (!section) return;
        lSetText('[data-l-section="categories"] .sec-eyebrow', categories.eyebrow);
        if (categories.title) section.querySelector('.sec-h2').innerHTML = lTitleHtml(categories.title);
        const grid = section.querySelector('.grid');
        if (grid && Array.isArray(categories.items)) {
            grid.innerHTML = categories.items.map(item => `
                <div onclick="openAuth()" role="button" tabindex="0" class="cat-card cursor-pointer rounded-2xl p-5 flex flex-col gap-3 transition-all hover:-translate-y-1" style="background:linear-gradient(135deg,#FFF0F6 0%,#FFFAF8 100%); border:1px solid rgba(249,59,122,0.12);">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style="background:rgba(249,59,122,0.10);">${lEsc(item.emoji || '✦')}</div>
                    <div>
                        <div class="font-semibold text-[14px] text-gray-900">${lEsc(item.title)}</div>
                        <div class="text-[12px] text-gray-400 mt-0.5 leading-snug">${lEsc(item.text)}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    function lApplyHow(how = {}) {
        const section = lSection('how');
        if (!section) return;
        lSetText('[data-l-section="how"] .sec-eyebrow', how.eyebrow);
        if (how.title) section.querySelector('.sec-h2').innerHTML = lTitleHtml(how.title);
        lSetText('[data-l-section="how"] .sec-sub', how.subtitle);
        lSetText('[data-l-section="how"] .btn-pink', how.cta);
        if (Array.isArray(how.steps)) {
            const grid = section.querySelector('.grid');
            grid.innerHTML = how.steps.map((step, i) => `
                <div class="card-white p-5 reveal reveal-d${(i % 3) + 1} visible">
                    <div class="flex items-start gap-3">
                        <div class="step-num">${i + 1}</div>
                        <div>
                            <h3 class="font-semibold text-gray-900 text-[15px]">${lEsc(step.title)}</h3>
                            <p class="text-[13px] text-gray-500 mt-1 leading-relaxed">${lEsc(step.text)}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    function lApplyFeatureCopy(features = {}) {
        const section = lSection('features');
        if (!section) return;
        lSetText('[data-l-section="features"] .sec-eyebrow', features.eyebrow);
        if (features.title) section.querySelector('.sec-h2').innerHTML = lTitleHtml(features.title);
        lSetText('[data-l-section="features"] .sec-sub', features.subtitle);
        if (Array.isArray(features.items)) {
            section.querySelectorAll('.card-white:not(.overflow-hidden)').forEach((card, i) => {
                const item = features.items[i];
                if (!item) return;
                const title = card.querySelector('h3');
                const text = card.querySelector('p');
                if (title) title.textContent = item.title || '';
                if (text) text.textContent = item.text || '';
            });
        }
        const highlight = section.querySelector('.col-span-2');
        if (highlight) {
            const h = highlight.querySelector('h3');
            const p = highlight.querySelector('p');
            const btn = highlight.querySelector('button');
            if (h && features.highlightTitle) h.textContent = features.highlightTitle;
            if (p && features.highlightText) p.textContent = features.highlightText;
            if (btn && features.highlightCta) btn.childNodes[0].textContent = features.highlightCta + ' ';
        }
    }

    function lApplySimpleHeader(sectionName, data = {}) {
        const section = lSection(sectionName);
        if (!section) return;
        lSetText(`[data-l-section="${sectionName}"] .sec-eyebrow`, data.eyebrow);
        const h = section.querySelector('.sec-h2');
        if (h && data.title) h.innerHTML = lTitleHtml(data.title);
        lSetText(`[data-l-section="${sectionName}"] .sec-sub`, data.subtitle);
        const cta = section.querySelector('.btn-pink, .btn-outline-pink');
        if (cta && data.cta) cta.childNodes[0].textContent = data.cta + ' ';
    }

    function lRenderReviews(reviews = {}) {
        const section = lSection('reviews');
        if (!section) return;
        lSetText('[data-l-section="reviews"] .sec-eyebrow', reviews.eyebrow);
        if (reviews.title) section.querySelector('.sec-h2').innerHTML = lTitleHtml(reviews.title);
        const slides = document.getElementById('reviewSlides');
        const dots = document.getElementById('reviewDots');
        if (!slides || !dots || !Array.isArray(reviews.items)) return;
        slides.innerHTML = reviews.items.map(item => `
            <div class="review-slide card-white p-5 md:p-6" style="min-width:100%; box-sizing:border-box;">
                <div class="flex items-center gap-1 mb-3" style="color:#F59E0B;">★★★★★</div>
                <p class="text-[14px] md:text-[15px] leading-relaxed text-gray-800">«${lEsc(item.text)}»</p>
                <div class="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3">
                    ${item.photoUrl
                        ? `<img src="${lEsc(item.photoUrl)}" class="avatar" style="object-fit:cover;" alt="${lEsc(item.name)}" onerror="this.style.display='none'">`
                        : `<div class="avatar" style="background:#FCE7F3; color:#9D174D;">${lEsc(item.avatar || 'T')}</div>`}
                    <div>
                        <div class="font-semibold text-[13px] text-gray-900">${lEsc(item.name)}</div>
                        <div class="text-[11px] text-gray-500">${lEsc(item.meta)}</div>
                    </div>
                </div>
            </div>
        `).join('');
        dots.innerHTML = reviews.items.map((_, i) => `<button onclick="reviewGoTo(${i})" class="review-dot" aria-label="Отзыв ${i + 1}"></button>`).join('');
        const freshDots = dots.querySelectorAll('.review-dot');
        window.reviewGoTo = (i) => {
            const total = Math.max(1, freshDots.length);
            const current = ((i % total) + total) % total;
            slides.style.transform = 'translateX(-' + (current * 100) + '%)';
            freshDots.forEach((d, idx) => d.classList.toggle('active', idx === current));
        };
        window.reviewGoTo(0);
    }

    function lRenderPricing(pricing = {}) {
        const section = lSection('pricing');
        if (!section) return;
        lApplySimpleHeader('pricing', pricing);
        const grid = section.querySelector('.grid.md\\:grid-cols-2');
        if (grid && Array.isArray(pricing.plans)) {
            grid.innerHTML = pricing.plans.map((plan, idx) => {
                const premium = idx === 1;
                const features = Array.isArray(plan.features) ? plan.features : [];
                const card = `
                    ${plan.badge ? `<div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase text-white whitespace-nowrap" style="background:var(--color-dark);letter-spacing:0.12em;">${lEsc(plan.badge)}</div>` : ''}
                    <div class="bg-white p-6 md:p-8 flex flex-col h-full" style="border-radius:${premium ? '18px' : '20px'};">
                        <div class="flex items-baseline justify-between mb-1">
                            <h3 class="text-[18px] font-bold text-gray-900">${lEsc(plan.name)}</h3>
                            <span class="text-[11px] uppercase tracking-wider font-bold ${premium ? '' : 'text-gray-400'}" style="${premium ? 'color:#C71F5C;' : ''}">${lEsc(plan.tag)}</span>
                        </div>
                        <p class="text-[13px] text-gray-500 mb-6">${lEsc(plan.description)}</p>
                        <div class="flex items-baseline gap-2 mb-1">
                            <span class="text-[40px] font-extrabold text-gray-900 leading-none">${lEsc(plan.price)}</span>
                            <span class="text-[14px] font-medium text-gray-400">${lEsc(plan.currency)}</span>
                            ${plan.oldPrice ? `<span class="text-[14px] text-gray-400 line-through ml-1">${lEsc(plan.oldPrice)}</span>` : ''}
                        </div>
                        <div class="text-[12px] mb-6" style="${premium ? 'color:#C71F5C;font-weight:600;' : ''}">${lEsc(plan.note)}</div>
                        <ul class="space-y-3 mb-7 flex-1">
                            ${features.map(f => `<li class="flex items-start gap-2.5 text-[13.5px] text-gray-700"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>${lEsc(f)}</li>`).join('')}
                        </ul>
                        <button onclick="openAuth()" class="${premium ? 'btn-pink' : 'btn-outline-pink'} w-full py-3.5 text-[14px]" style="border-radius:14px;">${lEsc(plan.cta)}</button>
                    </div>`;
                return premium
                    ? `<div class="reveal reveal-d2 visible relative" style="border-radius:20px;background:linear-gradient(135deg,#F93B7A 0%,#FF6D45 100%);padding:2px;box-shadow:0 18px 40px rgba(249,59,122,0.22);">${card}</div>`
                    : `<div class="card-white p-0 reveal reveal-d1 visible flex flex-col">${card}</div>`;
            }).join('');
        }
        const badges = section.querySelector('.flex.flex-wrap.items-center.justify-center.gap-x-6');
        if (badges && Array.isArray(pricing.badges)) {
            badges.innerHTML = pricing.badges.map(item => `<span class="inline-flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>${lEsc(item)}</span>`).join('');
        }
    }

    function lRenderFaq(faq = {}) {
        const section = lSection('faq');
        if (!section) return;
        lSetText('[data-l-section="faq"] .sec-eyebrow', faq.eyebrow);
        if (faq.title) section.querySelector('.sec-h2').innerHTML = lTitleHtml(faq.title);
        const list = section.querySelector('.space-y-3');
        if (list && Array.isArray(faq.items)) {
            list.innerHTML = faq.items.map(item => `
                <div class="card-white overflow-hidden">
                    <button onclick="toggleFaq(this)" class="w-full text-left px-5 py-4 flex items-center justify-between text-[14px] font-semibold text-gray-900 cursor-pointer gap-3">
                        ${lEsc(item.question)}
                        <svg class="faq-chevron flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div class="faq-body"><p class="px-5 pb-5 text-[13px] md:text-[14px] text-gray-500 leading-relaxed">${lEsc(item.answer)}</p></div>
                </div>
            `).join('');
        }
    }

    function lApplyFinalCta(cta = {}) {
        lSetText('[data-l-section="finalCta"] .inline-flex.rounded-full', cta.badge);
        lSetHtml('[data-l-section="finalCta"] h2', cta.title);
        lSetHtml('[data-l-section="finalCta"] p', cta.subtitle);
        const buttons = document.querySelectorAll('[data-l-section="finalCta"] button, [data-l-section="finalCta"] a');
        if (buttons[0] && cta.primaryCta) buttons[0].childNodes[0].textContent = cta.primaryCta + ' ';
        if (buttons[1] && cta.secondaryCta) buttons[1].textContent = cta.secondaryCta;
        const bulletWrap = document.querySelector('[data-l-section="finalCta"] .mt-7');
        if (bulletWrap && Array.isArray(cta.bullets)) {
            bulletWrap.innerHTML = cta.bullets.map(item => `<span class="inline-flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>${lEsc(item)}</span>`).join('');
        }
    }

    function lApplyComparison(comparison = {}) {
        lApplySimpleHeader('comparison', comparison);
        if (!Array.isArray(comparison.rows) || comparison.rows.length === 0) return;
        const grid = document.querySelector('[data-l-section="comparison"] .grid');
        if (!grid) return;
        // Preserve the header row (first 3 children: empty cell + WhatsApp + ToiLink)
        const headerCells = Array.from(grid.children).slice(0, 3);
        grid.innerHTML = '';
        headerCells.forEach(c => grid.appendChild(c));

        comparison.rows.forEach((row, i) => {
            const last = i === comparison.rows.length - 1;
            const bdr  = last ? '' : 'border-b ';

            const renderCell = (val, accent) => {
                const bg  = accent ? ' style="background:rgba(249,59,122,0.04);"' : '';
                const cls = `p-3 md:p-4 ${bdr}border-gray-100 text-center${accent ? '' : ' border-r'}`;
                if (val === 'yes') {
                    const stroke = accent ? '#10B981' : '#D1D5DB';
                    const sw     = accent ? 3 : 2.5;
                    const sz     = accent ? 20 : 18;
                    return `<div class="${cls}"${bg}><svg class="mx-auto" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`;
                }
                if (val === 'no') {
                    return `<div class="${cls}"${bg}><svg class="mx-auto" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>`;
                }
                const textCls = accent ? 'text-[12px] md:text-[14px] font-bold text-emerald-600' : 'text-[11px] md:text-[13px] text-gray-500';
                return `<div class="${cls} ${textCls}"${bg}>${lEsc(val)}</div>`;
            };

            grid.insertAdjacentHTML('beforeend',
                `<div class="p-3 md:p-4 ${bdr}border-r border-gray-100 text-[12px] md:text-[14px] font-medium text-gray-700">${lEsc(row.feature)}</div>` +
                renderCell(row.whatsapp ?? '', false) +
                renderCell(row.toilink  ?? '', true)
            );
        });
    }

    function lApplyFooter(footer = {}) {
        lSetText('[data-l-section="footer"] .md\\:col-span-2 p', footer.text);
        const contacts = document.querySelectorAll('[data-l-section="footer"] .space-y-2\\.5 li');
        if (contacts[4] && footer.phone) contacts[4].textContent = footer.phone;
        if (contacts[5] && footer.email) contacts[5].textContent = footer.email;
        if (contacts[6] && footer.city)  contacts[6].textContent = footer.city;
        lSetText('[data-l-section="footer"] .mt-10 p', footer.copyright);
        // Social icon links (Instagram, WhatsApp, Telegram)
        const socials = document.querySelectorAll('[data-l-section="footer"] .mt-5 a');
        if (socials[0] && footer.instagram !== undefined) socials[0].href = footer.instagram || '#';
        if (socials[1] && footer.whatsapp  !== undefined) socials[1].href = footer.whatsapp  || '#';
        if (socials[2] && footer.telegram  !== undefined) socials[2].href = footer.telegram  || '#';
    }

    function applyLandingConfig(config) {
        window.__landingConfig = config;
        lApplyBrand(config.brand);
        lApplyMeta(config.meta);
        lApplySectionVisibility(config.sections);
        lApplyHero(config.hero);
        lApplyMiniFeatures(config.miniFeatures);
        lApplyPhoneMockup(config.phoneMockup);
        lApplyStats(config.stats);
        lRenderTrust(config.trust);
        lRenderCategories(config.categories);
        lApplyHow(config.how);
        lApplyFeatureCopy(config.features);
        lApplyComparison(config.comparison);
        lApplySimpleHeader('templates', config.templates);
        lRenderReviews(config.reviews);
        lRenderPricing(config.pricing);
        lRenderFaq(config.faq);
        lApplyFinalCta(config.finalCta);
        lApplyFooter(config.footer);
    }

    lIdle(() => {
        if (window.__leEditMode) return;
        fetch('/api/public/landing', { credentials: 'omit' })
            .then(res => res.ok ? res.json() : null)
            .then(config => { if (config) applyLandingConfig(config); })
            .catch(() => {});
    });

    /* ── Mobile menu ── */
    const mobileMenuPanel  = document.getElementById('mobileMenuPanel');
    const mobileMenuButton = document.getElementById('mobileMenuButton');

    function toggleMobileMenu(e) {
        if (e) e.stopPropagation();
        const willOpen = !mobileMenuPanel.classList.contains('open');
        mobileMenuPanel.classList.toggle('open', willOpen);
        mobileMenuButton.setAttribute('aria-expanded', String(willOpen));
    }

    function closeMobileMenu() {
        mobileMenuPanel.classList.remove('open');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
    }

    document.addEventListener('click', (e) => {
        if (!mobileMenuPanel.contains(e.target) && !mobileMenuButton.contains(e.target)) {
            closeMobileMenu();
        }
    });

    window.addEventListener('resize', () => { if (window.innerWidth >= 768) closeMobileMenu(); });

    /* ── Auth sheet ── */
    function openAuth() {
        closeMobileMenu();
        location.href = '/templates.html';
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeMobileMenu(); }
    });

    /* ── FAQ accordion ── */
    function toggleFaq(btn) {
        const body    = btn.nextElementSibling;
        const chevron = btn.querySelector('.faq-chevron');
        const isOpen  = body.classList.contains('open');

        document.querySelectorAll('.faq-body.open').forEach(b => {
            b.classList.remove('open');
            b.previousElementSibling.querySelector('.faq-chevron').style.transform = '';
        });

        if (!isOpen) {
            body.classList.add('open');
            chevron.style.transform = 'rotate(180deg)';
        }
    }

    /* ── Reveal on scroll ── */
    lIdle(() => {
        const revealItems = document.querySelectorAll('.reveal');
        if (!('IntersectionObserver' in window)) {
            revealItems.forEach(el => el.classList.add('visible'));
            return;
        }
        const revealObs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    revealObs.unobserve(e.target);
                }
            });
        }, { threshold: 0.12 });
        revealItems.forEach(el => revealObs.observe(el));
    });

    /* ── Reviews carousel ── */
    lIdle(() => {
        const slides = document.getElementById('reviewSlides');
        const dots   = document.querySelectorAll('.review-dot');
        const track  = document.getElementById('reviewTrack');
        if (!slides || !track || !dots.length) return;
        let current  = 0;
        let timer    = null;

        function goTo(i) {
            current = (i + dots.length) % dots.length;
            slides.style.transform = 'translateX(-' + (current * 100) + '%)';
            dots.forEach((d, idx) => d.classList.toggle('active', idx === current));
        }

        window.reviewGoTo = goTo;
        goTo(0);

        function next() { goTo(current + 1); }
        function startTimer() { timer = setInterval(next, 4000); }
        function stopTimer()  { clearInterval(timer); }

        startTimer();
        track.addEventListener('mouseenter', stopTimer);
        track.addEventListener('mouseleave', startTimer);

        let tx = 0;
        track.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
        track.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - tx;
            if (Math.abs(dx) > 40) goTo(dx < 0 ? current + 1 : current - 1);
        }, { passive: true });
    });
