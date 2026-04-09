

class LuxuryEnvelope {
    constructor(config) {
        this.config = config;
    }

    createHTML() {
        const { name1, name2, dateDisplay } = this.config.couple;
        const locationText = this.config.location?.address || '';


        const i1 = name1.charAt(0).toUpperCase();
        const i2 = name2.charAt(0).toUpperCase();


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





        const topFlapPath = `M-5,-5 H105 V60 L53,92 Q50,94 47,92 L-5,60 Z`;


        const bottomFlapPath = `M-5,105 H105 V40 L53,8 Q50,6 47,8 L-5,40 Z`;


        const leftFlapPath = `M-5,-5 V105 H40 L92,53 Q94,50 92,47 L40,-5 Z`;


        const rightFlapPath = `M105,-5 V105 H60 L8,53 Q6,50 8,47 L60,-5 Z`;

        const html = `
            <div id="envelope-overlay" class="envelope-overlay">

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
                        <img src="images/waxsteal.png" alt="Wax Seal" class="seal-image" draggable="false">
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

    init() {

        if (this.config.sections && this.config.sections.envelope === false) {
            document.body.classList.remove('loading-active');
            return;
        }



        this.createHTML();

        const overlay = document.getElementById('envelope-overlay');
        const btn = document.getElementById('open-envelope');

        if (!overlay || !btn) {
            document.body.classList.remove('loading-active');
            return;
        }


        let idleTimer = setTimeout(() => {
            btn.classList.add('is-idle');
        }, 4000);

        btn.addEventListener('click', () => {
            clearTimeout(idleTimer);

            overlay.classList.add('animate-open');



            setTimeout(() => {

                overlay.classList.add('fade-out');


                setTimeout(() => {
                    overlay.remove();

                    document.body.classList.remove('loading-active');
                }, 800);
            }, 2500);
        });
    }
}


document.addEventListener('DOMContentLoaded', () => {

    if (typeof window.WEDDING_CONFIG !== 'undefined') {
        const envelope = new LuxuryEnvelope(window.WEDDING_CONFIG);
        envelope.init();
    } else {

    }
});