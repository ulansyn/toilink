import { interpolate, easeOut } from '../lib/interpolate.js';
import { drawBlurText, blurTextEndTime } from '../lib/textFx.js';

export const birthday = {
  id: 'birthday',
  label: 'День рождения',
  duration: 12,
  fps: 30,

  draw(ctx, t, params, bgImage) {
    const W = 1080, H = 1920;

    if (bgImage) {
      drawCoverImage(ctx, bgImage, W, H);
      ctx.fillStyle = 'rgba(10,5,30,0.55)';
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8);
      g.addColorStop(0, '#1e0a3c');
      g.addColorStop(1, '#050510');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    drawConfetti(ctx, t, W, H);

    drawBlurText(ctx,
      'С Днём Рождения!',
      W / 2, H * 0.22,
      '700 108px Georgia, serif',
      '#ffe066',
      t, 0.2,
      { letterDelay: 0.07, letterDur: 0.4, blurMax: 20, yOffset: 14 },
    );

    const nameStart = 1.6;
    drawBlurText(ctx,
      params.names || 'Имя',
      W / 2, H / 2,
      'italic 700 152px Georgia, serif',
      '#ff9de2',
      t, nameStart,
      { letterDelay: 0.1, letterDur: 0.5, blurMax: 24, yOffset: 18 },
    );

    const nameEnd   = blurTextEndTime(params.names || 'Имя', nameStart, { letterDelay: 0.1 });
    const dateStart = nameEnd + 0.3;
    drawBlurText(ctx,
      formatDate(params.eventDate),
      W / 2, H * 0.72,
      '400 56px Georgia, serif',
      '#ffe066',
      t, dateStart,
      { letterDelay: 0.05, letterDur: 0.35, blurMax: 14, yOffset: 8 },
    );

    const dateEnd    = blurTextEndTime(formatDate(params.eventDate), dateStart, { letterDelay: 0.05 });
    const venueStart = dateEnd + 0.2;

    if (params.eventTime) {
      drawBlurText(ctx,
        `в ${params.eventTime}`,
        W / 2, H * 0.80,
        '300 42px Georgia, serif',
        '#e0c0f0',
        t, venueStart,
        { letterDelay: 0.04, letterDur: 0.3, blurMax: 10, yOffset: 6 },
      );
    }
    if (params.venue) {
      drawBlurText(ctx,
        params.venue,
        W / 2, H * 0.87,
        '300 42px Georgia, serif',
        '#e0c0f0',
        t, venueStart + 0.2,
        { letterDelay: 0.04, letterDur: 0.3, blurMax: 10, yOffset: 6 },
      );
    }

    const textStart = venueStart + 0.9;
    ctx.save();
    ctx.font = 'italic 300 48px Georgia, serif';
    const lines = wrapLines(ctx, params.inviteText, W * 0.55);
    lines.forEach((line, i) => {
      drawBlurText(ctx,
        line,
        W / 2, H * 0.55 + (i - (lines.length - 1) / 2) * 68,
        'italic 300 48px Georgia, serif',
        '#d0b0e8',
        t, textStart + i * 0.25,
        { letterDelay: 0.03, letterDur: 0.3, blurMax: 12, yOffset: 6 },
      );
    });
    ctx.restore();

    const fo = interpolate(t, [10.5, 12], [0, 1]);
    if (fo > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fo})`;
      ctx.fillRect(0, 0, W, H);
    }
  },
};

function drawConfetti(ctx, t, W, H) {
  const colors = ['#ffe066', '#ff9de2', '#66e0ff', '#b6ff66', '#ffb366'];
  ctx.save();
  for (let i = 0; i < 45; i++) {
    const x = fract(Math.sin(i * 71.3) * 43758.5) * W;
    const speed = 80 + (i % 5) * 25;
    const y = ((i * 60 + t * speed) % (H + 60)) - 30;
    const size = 12 + (i % 4) * 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 1.5 * ((i % 3) - 1));
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawCoverImage(ctx, img, W, H) {
  const r = img.width / img.height, cr = W / H;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (r > cr) { sw = sh * cr; sx = (img.width - sw) / 2; }
  else        { sh = sw / cr; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

function fract(x) { return x - Math.floor(x); }

function formatDate(val) {
  if (!val) return '';
  return new Date(val).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function wrapLines(ctx, text, maxW) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxW && line) { lines.push(line.trim()); line = w + ' '; }
    else line = test;
  }
  if (line) lines.push(line.trim());
  return lines;
}
