export function interpolate(t, inputRange, outputRange, options = {}) {
  const [i0, i1] = inputRange;
  const [o0, o1] = outputRange;
  const easing = options.easing ?? easeInOut;

  let progress = (t - i0) / (i1 - i0);
  progress = Math.max(0, Math.min(1, progress));
  progress = easing(progress);

  return o0 + progress * (o1 - o0);
}

export const easeInOut = (x) =>
  x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

export const easeOut = (x) => 1 - Math.pow(1 - x, 3);
export const easeIn  = (x) => x * x * x;
export const linear  = (x) => x;
