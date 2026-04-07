/**
 * ═══════════════════════════════════════════
 * 🚀 WEDDING INVITATION ENGINE
 * ═══════════════════════════════════════════
 * 
 * Этот файл — «движок». Он берёт ВСЕ данные из config.js
 * и заполняет HTML-каркас, чтобы ничего не менять в index.html.
 * 
 * НЕ ТРОГАЙТЕ этот файл, если не знаете JS.
 * Все изменения — через config.js!
 */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ─── Load config ───
    const C = window.WEDDING_CONFIG;
    if (!C) {
        console.error("❌ config.js не найден! Убедитесь, что js/config.js подключён перед main.js");
        return;
    }

    // ═══════════════════════════════════════════
    // HELPER: safe set text/html/attr
    // ═══════════════════════════════════════════
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el && text != null) el.textContent = text;
    }
    function setHTML(id, html) {
        const el = document.getElementById(id);
        if (el && html != null) el.innerHTML = html;
    }
    function setAttr(id, attr, value) {
        const el = document.getElementById(id);
        if (el && value != null) el.setAttribute(attr, value);
    }
    function setVisible(id, visible) {
        const el = document.getElementById(id);
        if (el) {
            // Default to visible if value is missing/undefined
            if (visible === false) el.style.display = 'none';
            else el.style.display = '';
        }
    }
    // Same as setVisible but works by CSS selector (for elements without id)
    function setVisibleBySelector(selector, visible) {
        const el = document.querySelector(selector);
        if (el) {
            if (!visible) el.style.display = 'none';
            else el.style.display = '';
        }
    }

    // ═══════════════════════════════════════════
    // 0. 🎨 APPLY THEME & MODULES
    // ═══════════════════════════════════════════
    if (C.style) {
        const r = document.documentElement;
        if (C.style.primaryColor) r.style.setProperty('--c-text-primary', C.style.primaryColor);
        if (C.style.secondaryColor) r.style.setProperty('--c-text-secondary', C.style.secondaryColor);
        if (C.style.accentColor) r.style.setProperty('--c-sage-accent', C.style.accentColor);
        if (C.style.backgroundColor) r.style.setProperty('--c-bg', C.style.backgroundColor);
        if (C.style.goldColor) r.style.setProperty('--c-gold', C.style.goldColor);
    }

    // ─── Module Visibility ───
    if (C.modules) {
        setVisible('musicBtn', C.modules.music);
        setVisible('hero', C.modules.hero);
        setVisible('greeting', C.modules.greeting);
        setVisible('countdown', C.modules.countdown);
        setVisible('calendar', C.modules.calendar);
        setVisible('carousel', C.modules.carousel);
        setVisible('schedule', C.modules.schedule);
        setVisible('location', C.modules.location);
        setVisible('dresscode', C.modules.dresscode);
        setVisible('quote', C.modules.quote);
        setVisible('rsvp', C.modules.rsvp);
        setVisibleBySelector('footer.footer', C.modules.footer);

        // Also hide photo blocks if hero is off
        if (!C.modules.hero) {
            setVisibleBySelector('.photo-block--full', false);
            setVisibleBySelector('.hero-divider', false);
        }
        // Hide bottom photo if quote is off
        if (!C.modules.quote) {
            setVisibleBySelector('.photo-block--round', false);
        }
    }

    // ═══════════════════════════════════════════
    // 1. 📄 PAGE TITLE & META
    // ═══════════════════════════════════════════
    if (C.wedding) {
        document.title = `${C.wedding.groom} & ${C.wedding.bride} — Свадебное приглашение`;
        setAttr('metaDescription', 'content',
            `Приглашение на свадьбу ${C.wedding.groom} и ${C.wedding.bride}. ${C.wedding.dateDisplay}.`);
    }

    // ═══════════════════════════════════════════
    // 2. 🏠 HERO SECTION
    // ═══════════════════════════════════════════
    if (C.wedding) {
        setText('heroGroom', C.wedding.groom);
        setText('heroBride', C.wedding.bride);
        setText('heroDate', C.wedding.dateDisplay);
    }
    if (C.hero) {
        setText('heroSubtitle', C.hero.subtitle);
        if (C.hero.badge) setText('heroBadge', C.hero.badge);

        // Scroll text update if element exists
        const scrollTextEl = document.querySelector('.hero__scroll-text');
        if (scrollTextEl && C.hero.scrollText) scrollTextEl.textContent = C.hero.scrollText;
    }

    // ═══════════════════════════════════════════
    // 3. 📸 PHOTOS + CAROUSEL
    // ═══════════════════════════════════════════
    if (C.photos) {
        if (C.photos.photo1) {
            setAttr('photo1', 'src', C.photos.photo1.src);
            setAttr('photo1', 'alt', C.photos.photo1.alt);
        }
        if (C.photos.carousel && C.photos.carousel.length >= 3) {
            setAttr('carouselImg1', 'src', C.photos.carousel[0].src);
            setAttr('carouselImg1', 'alt', C.photos.carousel[0].alt);
            setAttr('carouselImg2', 'src', C.photos.carousel[1].src);
            setAttr('carouselImg2', 'alt', C.photos.carousel[1].alt);
            setAttr('carouselImg3', 'src', C.photos.carousel[2].src);
            setAttr('carouselImg3', 'alt', C.photos.carousel[2].alt);
        } else if (C.photos.carousel && C.photos.carousel.length > 0) {
            // Handle variable number of carousel images
            C.photos.carousel.forEach((photo, i) => {
                setAttr(`carouselImg${i + 1}`, 'src', photo.src);
                setAttr(`carouselImg${i + 1}`, 'alt', photo.alt);
            });
        } else {
            // Fallback to old config structure
            if (C.photos.photo1) setAttr('carouselImg1', 'src', C.photos.photo1.src);
            if (C.photos.photo2) setAttr('carouselImg2', 'src', C.photos.photo2.src);
            if (C.photos.photo3) setAttr('carouselImg3', 'src', C.photos.photo3.src);
        }

        if (C.photos.photoBottom) {
            setAttr('photo3', 'src', C.photos.photoBottom.src);
            setAttr('photo3', 'alt', C.photos.photoBottom.alt);
        } else if (C.photos.photo3 && typeof C.photos.photo3 === 'object') {
            setAttr('photo3', 'src', C.photos.photo3.src);
        }
    }

    // ─── Carousel Interactivity ───
    const carouselTrack = document.getElementById('carouselTrack');
    const carouselDots = document.querySelectorAll('.carousel__dot');
    const carouselCurrent = document.getElementById('carouselCurrent');

    if (carouselTrack && carouselDots.length) {
        function updateCarouselUI() {
            const scrollLeft = carouselTrack.scrollLeft;
            const slideWidth = carouselTrack.offsetWidth;
            const activeIndex = Math.round(scrollLeft / slideWidth);

            carouselDots.forEach((dot, i) => {
                dot.classList.toggle('carousel__dot--active', i === activeIndex);
            });
            if (carouselCurrent) carouselCurrent.textContent = activeIndex + 1;
        }

        carouselTrack.addEventListener('scroll', updateCarouselUI, { passive: true });
        carouselDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.dataset.index);
                carouselTrack.scrollTo({ left: index * carouselTrack.offsetWidth, behavior: 'smooth' });
            });
        });

        // Autoplay
        let autoplayInterval = setInterval(() => {
            const slideWidth = carouselTrack.offsetWidth;
            const maxScroll = carouselTrack.scrollWidth - slideWidth;
            const nextScroll = carouselTrack.scrollLeft + slideWidth;
            carouselTrack.scrollTo({
                left: nextScroll > maxScroll ? 0 : nextScroll,
                behavior: 'smooth'
            });
        }, 5000);

        carouselTrack.addEventListener('touchstart', () => clearInterval(autoplayInterval), { passive: true });
    }

    // ═══════════════════════════════════════════
    // 4. 💌 GREETING
    // ═══════════════════════════════════════════
    if (C.greeting) {
        setText('greetingTitle', C.greeting.title);

        const greetingEl = document.getElementById('greetingText');
        if (greetingEl) {
            const rawHTML = C.greeting.text;
            const parts = rawHTML.split(/(<br\s*\/?>)/gi);
            let wordIndex = 0;
            let finalHTML = '';
            parts.forEach(part => {
                if (part.match(/<br\s*\/?>/i)) {
                    finalHTML += part;
                } else {
                    const words = part.trim().split(/\s+/);
                    words.forEach(word => {
                        if (word) {
                            finalHTML += `<span class="word-reveal" style="transition-delay:${wordIndex * 0.07}s">${word}</span> `;
                            wordIndex++;
                        }
                    });
                }
            });
            greetingEl.innerHTML = finalHTML;
        }
    }

    // ═══════════════════════════════════════════
    // 5. 💬 QUOTE
    // ═══════════════════════════════════════════
    if (C.quote) {
        setText('quoteText', C.quote.text);
        setText('quoteAuthor', C.quote.author);
    }

    // ═══════════════════════════════════════════
    // 6. 📍 LOCATION
    // ═══════════════════════════════════════════
    if (C.location) {
        setText('locationTitle', C.location.title || C.location.sectionTitle);
        setText('locationName', C.location.placeName || C.location.name);
        setText('locationAddress', C.location.address);
        setAttr('locationMapBtn', 'href', C.location.mapLink);
        setAttr('locationMapBtn', 'target', '_blank');
        setAttr('locationMapBtn', 'rel', 'noopener noreferrer');
        setText('locationMapText', C.location.btnText || C.location.mapButtonText);
    }

    // ═══════════════════════════════════════════
    // 7. 👔 DRESSCODE
    // ═══════════════════════════════════════════
    if (C.dresscode) {
        setText('dresscodeTitle', C.dresscode.title || C.dresscode.sectionTitle);

        const dressText = C.dresscode.text || C.dresscode.hint;
        setHTML('dresscodeHint', dressText);

        const palette = document.getElementById('dresscodePalette');
        if (palette && (C.dresscode.palette || C.dresscode.colors)) {
            palette.innerHTML = '';
            const colors = C.dresscode.palette || C.dresscode.colors;
            colors.forEach(color => {
                const div = document.createElement('div');
                div.className = 'dresscode__color';
                div.style.background = color;
                palette.appendChild(div);
            });
        }
    }

    // ═══════════════════════════════════════════
    // 8. ⏰ SCHEDULE
    // ═══════════════════════════════════════════
    const timeline = document.getElementById('scheduleTimeline');
    if (timeline && C.schedule) {
        timeline.innerHTML = '';
        C.schedule.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'schedule__card reveal' + (index > 0 ? ` reveal-delay-${Math.min(index, 4)}` : '');
            div.innerHTML = `
                <div class="schedule__card-content">
                    <div class="schedule__card-time">${item.time}</div>
                    <div class="schedule__card-event">${item.title}</div>
                </div>
            `;
            timeline.appendChild(div);
        });
    }

    // ═══════════════════════════════════════════
    // 9. 📋 RSVP
    // ═══════════════════════════════════════════
    if (C.rsvp) {
        const rsvp = C.rsvp;
        const form = rsvp.form || rsvp;
        const msgs = rsvp.messages || {};

        setText('rsvpTitle', rsvp.title || rsvp.sectionTitle);
        setText('rsvpSubtitle', rsvp.subtitle);
        setAttr('rsvpName', 'placeholder', form.namePlaceholder);
        setAttr('rsvpWish', 'placeholder', form.wishPlaceholder);
        setText('rsvpBtn', form.btnText || form.submitText);

        const attendSelect = document.getElementById('rsvpAttend');
        if (attendSelect && form.attendOptions) {
            attendSelect.innerHTML = '';
            const optDefault = document.createElement('option');
            optDefault.value = '';
            optDefault.disabled = true;
            optDefault.selected = true;
            optDefault.textContent = rsvp.attendQuestion || "Планируете ли вы?";
            attendSelect.appendChild(optDefault);

            const optYes = document.createElement('option');
            optYes.value = 'yes';
            optYes.textContent = form.attendOptions[0];
            attendSelect.appendChild(optYes);

            const optNo = document.createElement('option');
            optNo.value = 'no';
            optNo.textContent = form.attendOptions[1];
            attendSelect.appendChild(optNo);
        }

        const guestsSelect = document.getElementById('rsvpGuests');
        if (guestsSelect && form.guestOptions) {
            guestsSelect.innerHTML = '';
            const optDefault = document.createElement('option');
            optDefault.value = '';
            optDefault.disabled = true;
            optDefault.selected = true;
            optDefault.textContent = rsvp.guestsQuestion || "Гостей";
            guestsSelect.appendChild(optDefault);

            form.guestOptions.forEach(num => {
                const opt = document.createElement('option');
                opt.value = num;
                opt.textContent = num;
                guestsSelect.appendChild(opt);
            });
        }
    }

    // ═══════════════════════════════════════════
    // 10. 📱 FOOTER
    // ═══════════════════════════════════════════
    if (C.wedding) {
        const groomInitial = C.wedding.groom.charAt(0);
        const brideInitial = C.wedding.bride.charAt(0);
        setText('footerNames', `${groomInitial} & ${brideInitial}`);
        setText('footerDate', C.wedding.dateShort);
    }
    if (C.footer) {
        setText('footerCopy', C.footer.copyright);
    }

    // ═══════════════════════════════════════════
    // 11. ✨ PARTICLES ANIMATION
    // ═══════════════════════════════════════════
    // Particles always run — config is in C.style, not C.theme
    (function initParticles() {
        const canvas = document.getElementById('particles');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let particles = [];
        const PARTICLE_COUNT = 40;
        // Derive particle color from accent color or use a default sage green
        const accentHex = (C.style && C.style.accentColor) || '#7C9082';
        // Convert hex to RGB for rgba() usage
        const r = parseInt(accentHex.slice(1, 3), 16);
        const g = parseInt(accentHex.slice(3, 5), 16);
        const b = parseInt(accentHex.slice(5, 7), 16);
        const RGB_COLOR = `${r}, ${g}, ${b}`;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 3 + 1;
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = Math.random() * -0.5 - 0.1;
                this.opacity = Math.random() * 0.4 + 0.1;
                this.life = Math.random() * 200 + 100;
                this.maxLife = this.life;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.life--;
                if (this.life <= 0 || this.y < -10) this.reset();
                this.y = this.y < -10 ? canvas.height + 10 : this.y;
            }
            draw() {
                const fade = this.life / this.maxLife;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${RGB_COLOR}, ${this.opacity * fade})`;
                ctx.fill();
            }
        }

        for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
    })();

    // ═══════════════════════════════════════════
    // 12. 📜 HEADER SCROLL EFFECT
    // ═══════════════════════════════════════════
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) header.classList.add('visible');
            else header.classList.remove('visible');
        }, { passive: true });
    }

    // ═══════════════════════════════════════════
    // 13. 👁️ SCROLL REVEAL ANIMATION
    // ═══════════════════════════════════════════
    function initRevealObserver() {
        const reveals = document.querySelectorAll('.reveal');
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        reveals.forEach(el => revealObserver.observe(el));
    }

    // ─── Word-by-word reveal observer ───
    function initWordReveal() {
        const greetingSection = document.querySelector('.greeting');
        if (!greetingSection) return;
        const wordObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.querySelectorAll('.word-reveal').forEach(w => {
                        w.classList.add('word-visible');
                    });
                    wordObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        wordObserver.observe(greetingSection);
    }

    // ─── Calendar cascading reveal ───
    function initCalendarReveal() {
        const calSection = document.getElementById('calendar');
        if (!calSection) return;
        const calObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        const days = calSection.querySelectorAll('.calendar__day:not(.calendar__day--empty)');
                        days.forEach((day, i) => {
                            setTimeout(() => {
                                day.classList.add('calendar__day--visible');
                                if (day.classList.contains('calendar__day--highlight')) {
                                    setTimeout(() => {
                                        day.classList.add('calendar__day--accent');
                                    }, 400);
                                }
                            }, i * 45);
                        });
                    }, 400);
                    calObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        calObserver.observe(calSection);
    }

    // Delay slightly so dynamically inserted elements get caught
    setTimeout(() => {
        initRevealObserver();
        initWordReveal();
        initCalendarReveal();
    }, 50);

    // ═══════════════════════════════════════════
    // 14. ⏱️ COUNTDOWN TIMER
    // ═══════════════════════════════════════════
    if (C.wedding && C.wedding.date) {
        const weddingDate = new Date(C.wedding.date).getTime();
        const daysEl = document.getElementById('cd-days');
        const hoursEl = document.getElementById('cd-hours');
        const minsEl = document.getElementById('cd-mins');
        const secsEl = document.getElementById('cd-secs');

        if (daysEl && hoursEl && minsEl && secsEl) {
            function updateCountdown() {
                const now = Date.now();
                const diff = weddingDate - now;

                if (diff <= 0) {
                    daysEl.textContent = '0';
                    hoursEl.textContent = '00';
                    minsEl.textContent = '00';
                    secsEl.textContent = '00';
                    return;
                }

                daysEl.textContent = Math.floor(diff / 86400000);
                hoursEl.textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
                minsEl.textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
                secsEl.textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
            }
            updateCountdown();
            setInterval(updateCountdown, 1000);
        }
    }

    // ═══════════════════════════════════════════
    // 15. 📅 DYNAMIC CALENDAR
    // ═══════════════════════════════════════════
    const calGrid = document.getElementById('calendarGrid');
    if (calGrid && C.wedding && C.wedding.date) {
        const targetDate = new Date(C.wedding.date);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();
        const targetDay = targetDate.getDate();

        // Update Calendar Title
        const monthNames = [
            "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
            "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
        ];
        setText('calendarTitle', `${monthNames[targetMonth]} ${targetYear}`);

        // Day name headers
        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayNames.forEach(d => {
            const el = document.createElement('div');
            el.className = 'calendar__day-name';
            el.textContent = d;
            calGrid.appendChild(el);
        });

        // Calculate empty slots (Monday-start calendar)
        let firstDayIndex = new Date(targetYear, targetMonth, 1).getDay();
        if (firstDayIndex === 0) firstDayIndex = 7;
        const emptySlots = firstDayIndex - 1;

        // Days in month
        const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

        // Empty slots
        for (let i = 0; i < emptySlots; i++) {
            const el = document.createElement('div');
            el.className = 'calendar__day calendar__day--empty';
            calGrid.appendChild(el);
        }

        // Day numbers — start hidden for cascade animation
        for (let d = 1; d <= daysInMonth; d++) {
            const el = document.createElement('div');
            el.className = 'calendar__day';
            if (d === targetDay) el.classList.add('calendar__day--highlight');
            el.textContent = d;
            calGrid.appendChild(el);
        }
    }

    // ═══════════════════════════════════════════
    // 16. 📋 RSVP FORM HANDLER
    // ═══════════════════════════════════════════
    const rsvpForm = document.getElementById('rsvpForm');
    if (rsvpForm) {
        rsvpForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const nameInput = document.getElementById('rsvpName');
            const btn = document.getElementById('rsvpBtn');

            if (nameInput && btn) {
                const name = nameInput.value.trim();
                if (!name) return;

                // Get message templates from config
                const msgs = (C.rsvp && C.rsvp.messages) || {};
                const successMsg = msgs.success || 'Спасибо, {name}! Ваше подтверждение принято.';
                const sendingMsg = msgs.buttonSending || 'Отправка...';

                // Show sending state
                btn.textContent = sendingMsg;
                btn.disabled = true;

                // Log the submission
                const attendValue = document.getElementById('rsvpAttend')?.value || '';
                const guestsValue = document.getElementById('rsvpGuests')?.value || '';
                const wishValue = document.getElementById('rsvpWish')?.value || '';

                console.log(`📋 RSVP Submitted:`, {
                    name,
                    attend: attendValue,
                    guests: guestsValue,
                    wish: wishValue
                });

                // Show success after brief delay
                setTimeout(() => {
                    const wrap = document.getElementById('rsvpFormWrap');
                    const success = document.getElementById('rsvpSuccess');

                    if (wrap && success) {
                        wrap.classList.add('is-hidden');
                        success.classList.add('is-visible');

                        // Start RSVP Timer
                        if (C.wedding && C.wedding.date) {
                            const targetDate = new Date(C.wedding.date).getTime();
                            if (!isNaN(targetDate)) {
                                const updateTimer = () => {
                                    const now = new Date().getTime();
                                    const diff = targetDate - now;

                                    if (diff <= 0) return;

                                    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                                    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                    const s = Math.floor((diff % (1000 * 60)) / 1000);

                                    const dEl = document.getElementById('rsvp-d');
                                    const hEl = document.getElementById('rsvp-h');
                                    const mEl = document.getElementById('rsvp-m');
                                    const sEl = document.getElementById('rsvp-s');

                                    if (dEl) dEl.textContent = d;
                                    if (hEl) hEl.textContent = h;
                                    if (mEl) mEl.textContent = m;
                                    if (sEl) sEl.textContent = s.toString().padStart(2, '0');
                                };
                                updateTimer();
                                setInterval(updateTimer, 1000);
                            }
                        }
                    } else {
                        btn.textContent = successMsg.replace('{name}', name);
                        btn.style.background = 'linear-gradient(135deg, #4a7c4e, #6da86f)';
                    }
                }, 800);
            }
        });
    }

    // ═══════════════════════════════════════════
    // 17. 🎵 MUSIC PLAYER
    // ═══════════════════════════════════════════
    const musicBtn = document.getElementById('musicBtn');
    if (musicBtn && C.audio) {
        let audio = null;
        let musicOn = false;

        // Create audio element from config
        function getAudio() {
            if (!audio) {
                audio = new Audio(C.audio.url);
                audio.loop = C.audio.loop !== false; // default true
                audio.volume = C.audio.volume != null ? C.audio.volume : 0.5;
                audio.preload = 'auto';
            }
            return audio;
        }

        musicBtn.addEventListener('click', () => {
            musicOn = !musicOn;
            const span = musicBtn.querySelector('span');

            if (musicOn) {
                const player = getAudio();
                player.play().then(() => {
                    if (span) span.textContent = '■';
                    musicBtn.style.background = 'rgba(35, 42, 80, 0.15)';
                }).catch(err => {
                    console.warn('🎵 Music playback blocked:', err.message);
                    musicOn = false;
                });
            } else {
                if (audio) {
                    audio.pause();
                }
                if (span) span.textContent = '♪';
                musicBtn.style.background = 'rgba(104, 105, 116, 0.1)';
            }
        });
    } else if (musicBtn) {
        // No audio config — just toggle icon visually
        let musicOn = false;
        musicBtn.addEventListener('click', () => {
            musicOn = !musicOn;
            const span = musicBtn.querySelector('span');
            if (span) span.textContent = musicOn ? '■' : '♪';
            musicBtn.style.background = musicOn
                ? 'rgba(35, 42, 80, 0.15)'
                : 'rgba(104, 105, 116, 0.1)';
        });
    }

    // ═══════════════════════════════════════════
    // 18. 🍔 NAVIGATION MENU TOGGLE
    // ═══════════════════════════════════════════
    const menuBtn = document.getElementById('menuBtn');
    const navOverlay = document.getElementById('navOverlay');
    const navClose = document.getElementById('navClose');
    const navLinks = document.querySelectorAll('.nav-link');

    if (menuBtn && navOverlay) {
        const toggleMenu = (state) => {
            navOverlay.classList.toggle('active', state);
            document.body.style.overflow = state ? 'hidden' : '';
        };

        menuBtn.addEventListener('click', () => toggleMenu(true));
        if (navClose) navClose.addEventListener('click', () => toggleMenu(false));

        navLinks.forEach(link => {
            link.addEventListener('click', () => toggleMenu(false));
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') toggleMenu(false);
        });
    }

    console.log(`✅ Wedding invitation loaded: ${C.wedding.groom} & ${C.wedding.bride}`);
});
