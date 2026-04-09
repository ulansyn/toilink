import { drawBlurTextWrapped, blockAlpha } from '../lib/textFx.js';

const easeOut = (t) => 1 - Math.pow(2, -10 * t);

export const premiumWedding = {
  id: 'wedding_luxury',
  label: 'Luxury Wedding (Gold & Particles)',
  duration: 20,
  fps: 60,
  width: 1080,
  height: 1920,

  draw: (ctx, t, params, bgImage) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const D = premiumWedding.duration;
    const maxW = W * 0.80;

    ctx.clearRect(0, 0, W, H);

    if (bgImage) {
      const progress = t / D;
      const scale = 1.05 + progress * 0.1;
      const driftY = progress * -30;

      const imgRatio = bgImage.width / bgImage.height;
      const canRatio = W / H;
      let dw, dh;

      if (imgRatio > canRatio) {
        dh = H; dw = H * imgRatio;
      } else {
        dw = W; dh = W / imgRatio;
      }

      ctx.save();
      ctx.translate(cx, cy + driftY);
      ctx.scale(scale, scale);
      ctx.drawImage(bgImage, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    } else {
      const bg = ctx.createRadialGradient(cx, cy, 100, cx, cy, H);
      bg.addColorStop(0, '#2c1e14');
      bg.addColorStop(1, '#000000');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    const overlay = ctx.createLinearGradient(0, 0, 0, H);
    overlay.addColorStop(0, 'rgba(0,0,0,0.4)');
    overlay.addColorStop(0.5, 'rgba(0,0,0,0.2)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    for (let i = 0; i < 40; i++) {
      const seed = i * 154.23;
      const x = (Math.sin(seed) * 0.5 + 0.5) * W;
      const yStart = (Math.cos(seed * 0.8) * 0.5 + 0.5) * H;
      const speed = 20 + (seed % 30);
      const y = (yStart - t * speed) % H;
      const size = 1 + (seed % 3);
      const opacity = (Math.sin(t + seed) * 0.5 + 0.5) * 0.4;

      ctx.beginPath();
      ctx.arc(x, y < 0 ? y + H : y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(228, 197, 144, ${opacity})`;
      ctx.fill();
    }
    ctx.restore();

    const serif = '"Cormorant Garamond", Georgia, serif';
    const sans  = '"Montserrat", sans-serif';
    const gold  = '#e4c590';
    const white = '#ffffff';

    const fsTitle = Math.round(W / 25);
    const fsNames = Math.round(W / 8);
    const fsSub   = Math.round(W / 30);
    const fsDate  = Math.round(W / 13.5);
    const fsTime  = Math.round(W / 21.6);
    const fsVenue = Math.round(W / 27);

    const t1in  = D * 0.025;
    const t1hi  = D * 0.075;
    const t1out = D * 0.200;
    const t1end = D * 0.250;

    const t2in  = D * 0.250;
    const t2hi  = D * 0.325;
    const t2out = D * 0.475;
    const t2end = D * 0.525;

    const t3in  = D * 0.525;
    const t3hi  = D * 0.600;

    const a1 = blockAlpha(t, t1in, t1hi, t1out, t1end);
    if (a1 > 0) {
      ctx.save();
      ctx.globalAlpha = a1;
      drawBlurTextWrapped(ctx, 'ПРИГЛАШЕНИЕ НА СВАДЬБУ', cx, H * 0.48, `300 ${fsTitle}px ${sans}`, gold, t, t1in,
        { letterDelay: 0.08, blurMax: 15, yOffset: 10 }, maxW);

      const lw = 120 * easeOut(Math.max(0, t - t1hi));
      ctx.strokeStyle = gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - lw, H * 0.52);
      ctx.lineTo(cx + lw, H * 0.52);
      ctx.stroke();
      ctx.restore();
    }

    const a2 = blockAlpha(t, t2in, t2hi, t2out, t2end);
    if (a2 > 0) {
      drawBlurTextWrapped(ctx, params.names || 'Александр & Мария', cx, H * 0.45, `italic ${fsNames}px ${serif}`, white, t, t2in + D * 0.01,
        { letterDelay: 0.1, blurMax: 30, yOffset: 30, alpha: a2 }, maxW);

      drawBlurTextWrapped(ctx, 'СОЗДАЮТ НОВУЮ ИСТОРИЮ', cx, H * 0.54, `400 ${fsSub}px ${sans}`, gold, t, t2in + D * 0.075,
        { letterDelay: 0.05, blurMax: 10, alpha: a2 }, maxW);
    }

    const a3 = blockAlpha(t, t3in, t3hi, 99, 100);
    if (a3 > 0) {
      const elapsed = Math.max(0, t - t3in);
      const slideIn = (1 - easeOut(elapsed * 0.5)) * 50;

      drawBlurTextWrapped(ctx, params.eventDate || '24 ИЮНЯ 2024', cx, H * 0.42 - slideIn, `300 ${fsDate}px ${sans}`, white, t, t3in + D * 0.015,
        { blurMax: 20, alpha: a3 }, maxW);

      drawBlurTextWrapped(ctx, params.eventTime || '16:00', cx, H * 0.50, `600 ${fsTime}px ${sans}`, gold, t, t3in + D * 0.05,
        { alpha: a3 }, maxW);

      drawBlurTextWrapped(ctx, params.venue || 'РЕСТОРАН "ВЕРСАЛЬ"', cx, H * 0.65 + slideIn, `400 ${fsVenue}px ${sans}`, white, t, t3in + D * 0.075,
        { blurMax: 10, alpha: a3 }, maxW);
    }

    const vignette = ctx.createRadialGradient(cx, cy, H * 0.3, cx, cy, H * 0.9);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  },
};
