

class WeddingAnimations {
  constructor(config) {
    this.config = config;
  }


  initParallax() {
    if (!this.config.options.enableParallax) return;

    const heroImg = document.querySelector('.hero-img');
    if (!heroImg) return;


    window.addEventListener('mousemove', (e) => {
      const mouseX = (e.clientX / window.innerWidth - 0.5) * 20;
      const mouseY = (e.clientY / window.innerHeight - 0.5) * 20;
      heroImg.style.transform = `scale(1.05) translate(${mouseX}px, ${mouseY}px)`;
    });


    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        const tiltX = (e.gamma / 45) * 15;
        const tiltY = (e.beta / 90) * 15;
        heroImg.style.transform = `scale(1.05) translate(${tiltX}px, ${tiltY}px)`;
      }, true);
    }

    
  }


  initSmoothScroll() {
    if (!this.config.options.enableSmoothScroll) return;

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });

    
  }


  initScrollAnimations() {
    if (!this.config.options.animateOnScroll) return;


    this.splitText('.calendar-heading', 'char');
    this.splitText('.invitation-inner p', 'word');


    const rules = [

      { selector: '.names-container', class: 'reveal-heading', delay: 0 },
      { selector: '.date-container', class: 'reveal-text', delay: 300 },


      { selector: '.invitation-heading', class: 'reveal-heading' },
      { selector: '.invitation-inner p:not(.invitation-signature)', class: 'reveal-blur-word', stagger: 0 },
      { selector: '.invitation-signature', class: 'reveal-blur-word', delay: 2500 },


      { selector: '.photo-frame', class: 'reveal-left' },


      { selector: '.calendar-heading', class: 'reveal-blur-char', stagger: 0 },
      { selector: '.calendar-grid', class: 'reveal-card', delay: 100 },
      { selector: '.calendar-day', class: 'reveal-blur-day', stagger: 30 },


      { selector: '.location-heading', class: 'reveal-heading' },
      { selector: '.location-address', class: 'reveal-text', delay: 150 },
      { selector: '.location-button', class: 'reveal-card', delay: 300 },


      { selector: '.timeline-heading', class: 'reveal-heading' },
      { selector: '.timeline-track', class: 'reveal' },
      { selector: '.timeline-item', class: 'reveal-right', stagger: 150 },


      { selector: '.dresscode-heading', class: 'reveal-heading' },
      { selector: '.dresscode-text', class: 'reveal-text', delay: 100 },
      { selector: '.dresscode-circle', class: 'reveal-circle', stagger: 60 },


      { selector: '.rsvp-heading', class: 'reveal-heading' },
      { selector: '.rsvp-subtitle', class: 'reveal-text', delay: 100 },
      { selector: '.rsvp-card-container', class: 'reveal-card', delay: 200 }
    ];


    rules.forEach(rule => {
      const elements = document.querySelectorAll(rule.selector);
      elements.forEach((el, index) => {

        if (rule.class === 'reveal-blur-word') {
          el.classList.add('reveal-blur-wrapper');
          const words = el.querySelectorAll('.word');
          const baseDelay = rule.delay || 0;
          words.forEach((word, wIndex) => {
            word.style.animationDelay = `${baseDelay + (wIndex * 40)}ms`;
          });
        }

        else if (rule.class === 'reveal-blur-char') {
          el.classList.add('reveal-blur-wrapper');
          const chars = el.querySelectorAll('.char');
          const baseDelay = rule.delay || 0;
          chars.forEach((char, cIndex) => {
            char.style.animationDelay = `${baseDelay + (cIndex * 50)}ms`;
          });
        }

        else if (rule.class === 'reveal-blur-day') {
          el.classList.add('reveal-blur-day');
          el.style.animationDelay = `${index * rule.stagger}ms`;
        }

        else {
          const className = rule.customClass ? rule.customClass(el, index) : rule.class;
          if (className) el.classList.add(className);

          if (rule.stagger) el.style.transitionDelay = `${index * rule.stagger}ms`;
          else if (rule.delay) el.style.transitionDelay = `${rule.delay}ms`;
        }
      });
    });


    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px'
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = entry.target;


          if (target.classList.contains('reveal-blur-wrapper')) {
            target.classList.add('reveal-blur-active');
          }

          else if (target.classList.contains('reveal-blur-day')) {
            target.classList.add('reveal-blur-active');
          }

          else {
            target.classList.add('active');
          }

          observer.unobserve(target);
        }
      });
    }, observerOptions);


    const animatedElements = document.querySelectorAll(
      '.reveal, .reveal-heading, .reveal-text, .reveal-card, .reveal-circle, .reveal-left, .reveal-right, .reveal-blur-wrapper, .reveal-blur-day, .timeline-track'
    );

    animatedElements.forEach(el => observer.observe(el));

    
  }


  splitText(selector, type) {
    document.querySelectorAll(selector).forEach(el => {
      const text = el.textContent.trim();
      if (!text) return;
      if (type === 'word') {
        el.innerHTML = text.split(/\s+/).map(word => `<span class="word">${word}</span>`).join(' ');
      } else if (type === 'char') {
        el.innerHTML = text.split('').map(char => char === ' ' ? '&nbsp;' : `<span class="char">${char}</span>`).join('');
      }
    });
  }


  initHeroAnimation() {


  }


  init() {
    


    this.initSmoothScroll();
    this.initScrollAnimations();

    
  }
}


document.addEventListener('DOMContentLoaded', () => {

  setTimeout(() => {
    const animations = new WeddingAnimations(window.WEDDING_CONFIG);
    animations.init();
  }, 100);
});