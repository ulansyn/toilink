

class WeddingMusic {
    constructor(config) {
        this.config = config.music;
        if (!this.config || !this.config.enabled) return;

        this.isPlaying = false;
        this.audioElement = null;
        this.toggleBtn = null;
    }

    init() {
        if (!this.config || !this.config.enabled) return;


        this.createElements();

        const envelopeBtn = document.getElementById('open-envelope');
        if (envelopeBtn) {

            envelopeBtn.addEventListener('click', () => {
                if (this.config.autoplayAfterEnvelope) {
                    this.playAudio();
                }

                setTimeout(() => {
                    this.toggleBtn.classList.add('is-visible');
                    this.toggleBtn.classList.add('hint-visible');


                    setTimeout(() => {
                        this.toggleBtn.classList.remove('hint-visible');
                    }, 5000);
                }, 2000);
            }, { once: true });
        } else {

            this.toggleBtn.classList.add('is-visible');
            this.toggleBtn.classList.add('hint-visible');
            setTimeout(() => {
                this.toggleBtn.classList.remove('hint-visible');
            }, 5000);

            if (this.config.autoplayAfterEnvelope) {
                document.addEventListener('click', () => this.playAudio(), { once: true });
            }
        }
    }

    createElements() {

        this.audioElement = document.createElement('audio');
        this.audioElement.id = 'bg-music';
        this.audioElement.loop = true;
        this.audioElement.src = this.config.url;
        document.body.appendChild(this.audioElement);


        this.toggleBtn = document.createElement('button');
        this.toggleBtn.className = 'music-toggle-btn';
        this.toggleBtn.setAttribute('aria-label', 'Toggle music');


        this.toggleBtn.innerHTML = `
            <svg class="icon-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <svg class="icon-pause" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            <span class="music-label">Включить музыку</span>
        `;


        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.appendChild(this.toggleBtn);
        } else {
            document.body.appendChild(this.toggleBtn);
        }


        this.toggleBtn.addEventListener('click', () => this.toggleAudio());
    }

    playAudio() {
        if (!this.audioElement) return;
        this.audioElement.play().then(() => {
            this.isPlaying = true;
            this.updateButtonState();
        }).catch(err => {
            
        });
    }

    toggleAudio() {
        if (!this.audioElement) return;

        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
        } else {
            this.audioElement.play();
            this.isPlaying = true;
        }
        this.updateButtonState();
    }

    updateButtonState() {
        if (!this.toggleBtn) return;


        this.toggleBtn.classList.remove('hint-visible');

        if (this.isPlaying) {
            this.toggleBtn.classList.add('is-playing');
        } else {
            this.toggleBtn.classList.remove('is-playing');
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.WEDDING_CONFIG !== 'undefined') {
        const music = new WeddingMusic(window.WEDDING_CONFIG);
        music.init();
    }
});
