/**
 * LuxuryEnvelope - Elegant Wedding Envelope Splash Screen
 * Uses WEDDING_CONFIG for all data
 * Seamless transition to site content (no black flash)
 */

class LuxuryEnvelope {
    constructor(config) {
        this.config = config;
    }

    createHTML() {
        const { groom, bride, dateDisplay } = this.config.wedding;
        const name1 = groom;
        const name2 = bride;
        const locationText = this.config.location?.address || '';

        // Инициалы для монограммы
        const i1 = name1.charAt(0).toUpperCase();
        const i2 = name2.charAt(0).toUpperCase();

        // Элегантный SVG: веточка оливы с золотыми акцентами
        const leafSVG = `
            <svg viewBox="0 0 100 100" class="seal-icon">
                <path d="M50 88 Q50 65 48 45 Q46 25 50 8" 
                      stroke-width="2" fill="none" stroke-linecap="round"/>
                <ellipse cx="36" cy="20" rx="11" ry="5" transform="rotate(-55 36 20)" fill="none" stroke-width="1.5"/>
                <ellipse cx="33" cy="35" rx="10" ry="4.5" transform="rotate(-50 33 35)" fill="none" stroke-width="1.5"/>
                <ellipse cx="35" cy="50" rx="10" ry="4.5" transform="rotate(-45 35 50)" fill="none" stroke-width="1.5"/>
                <ellipse cx="38" cy="65" rx="9" ry="4" transform="rotate(-40 38 65)" fill="none" stroke-width="1.5"/>
                <ellipse cx="64" cy="18" rx="11" ry="5" transform="rotate(55 64 18)" fill="none" stroke-width="1.5"/>
                <ellipse cx="67" cy="33" rx="10" ry="4.5" transform="rotate(50 67 33)" fill="none" stroke-width="1.5"/>
                <ellipse cx="65" cy="48" rx="10" ry="4.5" transform="rotate(45 65 48)" fill="none" stroke-width="1.5"/>
                <ellipse cx="62" cy="63" rx="9" ry="4" transform="rotate(40 62 63)" fill="none" stroke-width="1.5"/>
            </svg>
        `;

        // SVG Flap Paths with Enhanced Rounding
        // Using smoother cubic Bezier curves for elegant rounded tips

        // Top: Clean pentagonal flap with tight rounded tip
        const topFlapPath = `M-5,-5 H105 V60 L53,92 Q50,94 47,92 L-5,60 Z`;

        // Bottom: Clean pentagonal flap pointing up
        const bottomFlapPath = `M-5,105 H105 V40 L53,8 Q50,6 47,8 L-5,40 Z`;

        // Left: Clean pentagonal flap pointing right
        const leftFlapPath = `M-5,-5 V105 H40 L92,53 Q94,50 92,47 L40,-5 Z`;

        // Right: Clean pentagonal flap pointing left
        const rightFlapPath = `M105,-5 V105 H60 L8,53 Q6,50 8,47 L60,-5 Z`;

        const html = `
            <div id="envelope-overlay" class="envelope-overlay">
                
                <!-- Minimal Luxury Frame -->
                <div class="luxury-frame-outer"></div>
                <div class="luxury-frame-inner"></div>

                <!-- Sparkle Effects -->
                <div class="sparkles-container"></div>

                <div class="flap top-flap">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="flap-svg">
                        <path d="${topFlapPath}" />
                    </svg>
                    <div class="flap-content">
                        <div class="monogram-box">
                            <span class="monogram-text">${i1}<br>&<br>${i2}</span>
                        </div>
                        <h1 class="title-script">Приглашение</h1>
                        <p class="subtitle-serif">на свадьбу</p>
                    </div>
                </div>

                <div class="flap bottom-flap">
                     <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="flap-svg">
                        <path d="${bottomFlapPath}" />
                    </svg>
                    <div class="flap-content bottom-content">
                        <div class="info-block">
                            <p class="date">${dateDisplay}</p>
                            ${locationText ? `<p class="location">${locationText}</p>` : ''}
                        </div>
                    </div>
                </div>

                <div class="flap left-flap">
                     <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="flap-svg">
                        <path d="${leftFlapPath}" />
                    </svg>
                    <div class="flap-content left-content">
                    </div>
                </div>

                <div class="flap right-flap">
                     <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="flap-svg">
                        <path d="${rightFlapPath}" />
                    </svg>
                    <div class="flap-content right-content">
                    </div>
                </div>

                <button class="wax-seal-btn" id="open-envelope" aria-label="Открыть конверт">
                    <div class="seal-inner">
                        ${leafSVG}
                    </div>
                    <div class="click-hint">
                        <span>↑</span>
                        <span>открыть</span>
                    </div>
                </button>
            </div>
        `;

        document.body.insertAdjacentHTML('afterbegin', html);
    }

    addSparkles() {
        // Generate random sparkles
        const container = document.querySelector('.sparkles-container');
        if (!container) return;

        const count = 25; // Number of sparkles
        for (let i = 0; i < count; i++) {
            const sparkle = document.createElement('div');
            sparkle.classList.add('sparkle');

            // Random position
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.top = Math.random() * 100 + '%';

            // Random size
            const size = Math.random() * 3 + 1; // 1px to 4px
            sparkle.style.width = size + 'px';
            sparkle.style.height = size + 'px';

            // Random delay
            sparkle.style.animationDelay = Math.random() * 4 + 's';

            container.appendChild(sparkle);
        }
    }

    init() {
        // Проверка: если открытка отключена в конфиге, не показываем
        // Поддержка обоих вариантов: modules.envelope и sections.envelope
        const modules = this.config.modules || this.config.sections || {};
        if (modules.envelope === false) {
            document.body.classList.remove('loading-active');
            return;
        }

        // Всегда показываем оверлей при загрузке (для удобства настройки)
        // Для возврата к скрытию после открытия, расскомментируйте код ниже:
        // if (sessionStorage.getItem('envelopeOpened') === 'true') {
        //     document.body.classList.add('content-reveal-active');
        //     return;
        // }

        this.createHTML();
        this.addSparkles();

        const overlay = document.getElementById('envelope-overlay');
        const btn = document.getElementById('open-envelope');

        if (!overlay || !btn) {
            document.body.classList.add('content-reveal-active');
            document.body.classList.remove('loading-active');
            return;
        }

        btn.addEventListener('click', () => {
            // 1. Начинаем анимацию открытия клапанов (2.5с в CSS)
            overlay.classList.add('animate-open');
            sessionStorage.setItem('envelopeOpened', 'true');

            // Trigger content reveal animation
            document.body.classList.add('content-reveal-active');

            // 2. Ждем окончания разъезда клапанов (2.5с)
            setTimeout(() => {
                // Добавляем класс для плавного исчезновения всего оверлея
                overlay.classList.add('fade-out');

                // Удаляем из DOM только после завершения fade-out (еще 0.5с)
                setTimeout(() => {
                    overlay.remove();
                    document.body.classList.remove('loading-active');
                }, 800);
            }, 2500);
        });
    }
}

// Запуск немедленно — работает и при динамической загрузке (api-bridge), и при <script> в конце body
if (typeof WEDDING_CONFIG !== 'undefined') {
    const envelope = new LuxuryEnvelope(WEDDING_CONFIG);
    envelope.init();
} else {
    console.warn('[Envelope] WEDDING_CONFIG not found. Ensure config.js or api-bridge.js loads first.');
}