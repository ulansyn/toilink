/**
 * ToiLink API Bridge — Template 1
 *
 * Fetches event data from the API and builds window.WEDDING_CONFIG,
 * then dynamically loads envelope.js and main.js in order.
 */
(async function () {
    const slug = location.pathname.split('/').filter(Boolean).pop();
    const guestToken = new URLSearchParams(location.search).get('token');

    try {
        const res = await fetch('/api/public/events/' + slug);
        if (!res.ok) { showError(); return; }
        const event = await res.json();

        let bc = {};
        try { bc = JSON.parse(event.blocksConfig || '{}'); } catch (_) {}

        // ─── Helpers
        const blockEnabled = (blockData) =>
            !blockData ? false : (blockData.enabled !== false);

        // ─── Schedule: "15:00 Сбор гостей\n16:00 Банкет" → [{time, title}]
        const scheduleItems = ((bc.schedule && bc.schedule.items) || '')
            .split('\n')
            .map(l => l.trim()).filter(Boolean)
            .map(line => {
                const m = line.match(/^(\d{1,2}:\d{2})\s+(.*)/);
                return m ? { time: m[1], title: m[2] } : { time: '', title: line };
            });

        // ─── Dresscode palette: "#hex1,#hex2,..." → array
        const palette = ((bc.dresscode && bc.dresscode.palette) || '#E8EBE6,#2C3531,#B9C4BC,#F2F4F1,#7C9082')
            .split(',').map(s => s.trim()).filter(Boolean);

        // ─── Date formatting
        const dateObj = event.eventDate ? new Date(event.eventDate) : null;
        const pad = n => String(n).padStart(2, '0');
        const dateDisplay = dateObj
            ? `${dateObj.getDate()} · ${pad(dateObj.getMonth() + 1)} · ${dateObj.getFullYear()}`
            : '';
        const dateShort = dateObj
            ? `${pad(dateObj.getDate())}.${pad(dateObj.getMonth() + 1)}.${dateObj.getFullYear()}`
            : '';

        // ─── Photos (new schema: hero.heroPhoto + carousel.photos array)
        const fallback = '/images/og-placeholder.svg';
        const heroPhoto = (bc.hero && bc.hero.heroPhoto) || fallback;

        // carousel.photos is stored as JSON array string: '["url1","url2"]'
        let carouselPhotos = [];
        try {
            const raw = bc.carousel && bc.carousel.photos;
            carouselPhotos = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
        } catch (_) { carouselPhotos = []; }

        const venuePhoto = (bc.location && bc.location.venuePhoto) || null;

        // ─── Build CONFIG
        window.WEDDING_CONFIG = {
            modules: {
                envelope:  true,
                music:     false,
                hero:      true,
                greeting:  blockEnabled(bc.greeting),
                countdown: !!event.eventDate,
                calendar:  !!event.eventDate,
                carousel:  blockEnabled(bc.carousel) && carouselPhotos.length > 0,
                schedule:  blockEnabled(bc.schedule) && scheduleItems.length > 0,
                location:  blockEnabled(bc.location) && !!(bc.location && (bc.location.placeName || bc.location.address || event.location)),
                dresscode: blockEnabled(bc.dresscode) && !!(bc.dresscode && bc.dresscode.text),
                quote:     blockEnabled(bc.quote) && !!(bc.quote && bc.quote.text),
                rsvp:      event.status !== 'CLOSED',
                footer:    true,
            },
            style: {
                primaryColor:    '#2C3531',
                secondaryColor:  '#5E6663',
                accentColor:     '#7C9082',
                backgroundColor: '#F2F4F1',
                goldColor:       '#C9A96E',
            },
            wedding: {
                groom:       event.person1 || 'Жених',
                bride:       event.person2 || 'Невеста',
                date:        event.eventDate || new Date(Date.now() + 30 * 86400000).toISOString(),
                dateDisplay: dateDisplay,
                dateShort:   dateShort,
            },
            audio: { url: '', autoplay: false, loop: true, volume: 0.5 },
            hero: {
                badge:      (bc.hero && bc.hero.badge)    || '✦ Свадьба ✦',
                subtitle:   (bc.hero && bc.hero.subtitle) || 'приглашают на торжество',
                scrollText: 'Листайте',
            },
            greeting: {
                title: (bc.greeting && bc.greeting.title) || 'Дорогие гости!',
                text:  (bc.greeting && bc.greeting.text)  || '',
            },
            photos: {
                photo1:      { src: heroPhoto, alt: 'Фото' },
                carousel:    carouselPhotos.map((src, i) => ({ src, alt: `Фото ${i + 1}` })),
                photoBottom: { src: carouselPhotos[0] || heroPhoto, alt: 'Фото' },
                venuePhoto:  venuePhoto,
            },
            schedule: scheduleItems,
            location: {
                title:     'Место проведения',
                placeName: (bc.location && bc.location.placeName) || '',
                address:   (bc.location && bc.location.address)   || event.location || '',
                mapLink:   (bc.location && bc.location.mapLink)   || '#',
                btnText:   'Показать на карте',
                venuePhoto: venuePhoto,
            },
            dresscode: {
                title:   'Дресс-код',
                text:    (bc.dresscode && bc.dresscode.text) || '',
                palette: palette,
            },
            quote: {
                text:   (bc.quote && bc.quote.text)   || '',
                author: (bc.quote && bc.quote.author) || '',
            },
            rsvp: {
                title:    'Подтверждение',
                subtitle: event.rsvpDeadline
                    ? 'Просим подтвердить присутствие до ' +
                      new Date(event.rsvpDeadline).toLocaleDateString('ru-RU')
                    : 'Просим подтвердить ваше присутствие',
                form: {
                    namePlaceholder: 'Ваше имя',
                    attendOptions:   ['Я приду', 'К сожалению, не смогу'],
                    guestOptions:    [1, 2, 3, 4, 5],
                    wishPlaceholder: 'Ваши пожелания (необязательно)',
                    btnText:         'Отправить',
                },
                messages: {
                    success:       'Спасибо, {name}! Ваш ответ принят.',
                    buttonSending: 'Отправка...',
                },
                attendQuestion: 'Планируете ли вы?',
                guestsQuestion: 'Кол-во гостей',
                // internal — used by patched RSVP handler in main.js
                _slug:       slug,
                _guestToken: guestToken,
            },
            footer:  { copyright: 'Создано с ToiLink' },
            manager: { name: '', contact: '' },
        };

        // Load scripts in order (envelope first, then main engine)
        await loadScript('/templates/template-1/envelope.js');
        await loadScript('/templates/template-1/js/main.js');

    } catch (e) {
        console.error('ToiLink bridge error:', e);
        showError();
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.body.appendChild(s);
        });
    }

    function showError() {
        document.body.style.cssText = 'margin:0;background:#F2F4F1;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif';
        document.body.innerHTML = `
            <div style="text-align:center;color:#2C3531;padding:40px">
                <p style="font-size:64px;opacity:0.15;margin:0">404</p>
                <p style="opacity:0.4;margin-top:8px">Приглашение не найдено</p>
            </div>`;
    }
})();
