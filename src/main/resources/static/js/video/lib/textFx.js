import { interpolate, easeOut, linear } from './interpolate.js';

export function drawBlurText(ctx, text, x, y, font, color, t, startT, options = {}) {
  const {
    letterDelay = 0.07,
    letterDur   = 0.4,
    blurMax     = 24,
    yOffset     = 16,
    alpha       = 1,
  } = options;

  if (alpha <= 0) return;

  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  let curX = x - totalWidth / 2;

  chars.forEach((char, i) => {
    const cs = startT + i * letterDelay;
    const ce = cs + letterDur;
    const p  = interpolate(t, [cs, ce], [0, 1], { easing: easeOut });

    const blur    = blurMax * (1 - p);
    const opacity = p * alpha;
    const dy      = yOffset * (1 - p);

    if (opacity <= 0.01) { curX += widths[i]; return; }

    ctx.save();
    ctx.globalAlpha   = opacity;
    ctx.fillStyle     = color;
    ctx.shadowColor   = color;
    ctx.shadowBlur    = blur;
    ctx.fillText(char, curX, y + dy);
    ctx.restore();

    curX += widths[i];
  });

  ctx.restore();
}

export function blurTextEndTime(text, startT, options = {}) {
  const { letterDelay = 0.07, letterDur = 0.4 } = options;
  return startT + ([...text].length - 1) * letterDelay + letterDur;
}

export function drawBlurTextWrapped(ctx, text, x, y, font, color, t, startT, options = {}, maxWidth) {
  ctx.save();
  ctx.font = font;
  const totalWidth = ctx.measureText(text).width;
  ctx.restore();

  if (!maxWidth || totalWidth <= maxWidth) {
    drawBlurText(ctx, text, x, y, font, color, t, startT, options);
    return;
  }

  const { letterDelay = 0.07 } = options;
  const words = text.split(' ');
  const lines = [];

  ctx.save();
  ctx.font = font;
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  ctx.restore();

  const fontSizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
  const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 40;
  const lh = options.lineHeight || fontSize * 1.4;

  const totalH = (lines.length - 1) * lh;
  let charOffset = 0;

  lines.forEach((line, i) => {
    const lineY = y - totalH / 2 + i * lh;
    const lineStartT = startT + charOffset * letterDelay;
    drawBlurText(ctx, line, x, lineY, font, color, t, lineStartT, options);
    charOffset += [...line].length + 1;
  });
}

export function blockAlpha(t, inStart, holdStart, outStart, outEnd) {
  if (t < inStart || t >= outEnd) return 0;
  if (t < holdStart) return interpolate(t, [inStart, holdStart], [0, 1], { easing: easeOut });
  if (t < outStart)  return 1;
  return interpolate(t, [outStart, outEnd], [1, 0], { easing: linear });
}
