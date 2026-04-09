

(function () {
  'use strict';


  function initParticles() {
    const canvas = document.getElementById('hero-particles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    const PARTICLE_COUNT = 45;
    const particles = [];

    function resize() {
      const hero = canvas.closest('.hero');
      width = hero ? hero.offsetWidth : window.innerWidth;
      height = hero ? hero.offsetHeight : window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    }

    class Particle {
      constructor() { this.reset(true); }

      reset(initial) {
        this.x = Math.random() * width;
        this.y = initial ? Math.random() * height : height + 10;
        this.radius = Math.random() * 2.2 + 0.6;
        this.speedY = -(Math.random() * 0.35 + 0.1);
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.5 + 0.15;
        this.fadeDir = Math.random() > 0.5 ? 1 : -1;
        this.fadeSpeed = Math.random() * 0.003 + 0.001;

        const gold = Math.floor(Math.random() * 40) + 175;
        const green = Math.floor(Math.random() * 30) + 140;
        this.color = `${gold}, ${green}, 100`;
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.opacity += this.fadeDir * this.fadeSpeed;

        if (this.opacity >= 0.65) this.fadeDir = -1;
        if (this.opacity <= 0.08) this.fadeDir = 1;

        if (this.y < -10 || this.x < -10 || this.x > width + 10) {
          this.reset(false);
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
        ctx.fill();


        if (this.radius > 1.2) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${this.color}, ${this.opacity * 0.12})`;
          ctx.fill();
        }
      }
    }

    function init() {
      resize();
      for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => { p.update(); p.draw(); });
      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    init();
    animate();
  }


  function initCountdown() {
    const cfg = (typeof window.WEDDING_CONFIG !== 'undefined') ? WEDDING_CONFIG : null;
    if (!cfg || !cfg.couple || !cfg.couple.date) return;

    const target = new Date(cfg.couple.date + 'T00:00:00').getTime();
    const $d = document.getElementById('countdown-days');
    const $h = document.getElementById('countdown-hours');
    const $m = document.getElementById('countdown-minutes');
    const $s = document.getElementById('countdown-seconds');
    if (!$d || !$h || !$m || !$s) return;

    function tick() {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      $d.textContent = String(days).padStart(2, '0');
      $h.textContent = String(hours).padStart(2, '0');
      $m.textContent = String(mins).padStart(2, '0');
      $s.textContent = String(secs).padStart(2, '0');
    }

    tick();
    setInterval(tick, 1000);
  }


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    initParticles();
    initCountdown();
    
  }
})();
