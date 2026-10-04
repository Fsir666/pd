const _clamp8 = (n) => {
  if (n <= 0) return 0;
  if (n >= 255) return 255;
  return n | 0;
};

const _bayer4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5
];

const applyOrderedDitherRGBA = (src, width, height, strength) => {
  const w = width | 0;
  const h = height | 0;
  const s = Math.max(0, Math.min(1, Number(strength) || 0));
  if (!src || !w || !h || s <= 0) return src;

  let out;
  try {
    out = new Uint8ClampedArray(src);
  } catch (e) {
    out = Array.from(src);
  }

  const amp = 32 * s;
  for (let y = 0; y < h; y++) {
    const by = (y & 3) << 2;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = out[i + 3];
      if (a === 0) continue;
      const t = (_bayer4[by + (x & 3)] / 16) - 0.5;
      const d = t * amp;
      out[i] = _clamp8(out[i] + d);
      out[i + 1] = _clamp8(out[i + 1] + d);
      out[i + 2] = _clamp8(out[i + 2] + d);
    }
  }
  return out;
};

const downsampleBoxRGBA = (src, srcW, srcH, dstW, dstH, alphaCoverageThreshold) => {
  const sw = srcW | 0;
  const sh = srcH | 0;
  const dw = dstW | 0;
  const dh = dstH | 0;
  const covTh = Math.max(0, Math.min(1, Number(alphaCoverageThreshold)));
  if (!src || !sw || !sh || !dw || !dh) return src;

  let out;
  try {
    out = new Uint8ClampedArray(dw * dh * 4);
  } catch (e) {
    out = new Array(dw * dh * 4).fill(0);
  }

  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * sh) / dh);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * sw) / dw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
      const area = (x1 - x0) * (y1 - y0);

      let sumW = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;

      for (let sy = y0; sy < y1; sy++) {
        let idx = (sy * sw + x0) * 4;
        for (let sx = x0; sx < x1; sx++) {
          const a = src[idx + 3] / 255;
          if (a > 0) {
            sumW += a;
            sumR += src[idx] * a;
            sumG += src[idx + 1] * a;
            sumB += src[idx + 2] * a;
          }
          idx += 4;
        }
      }

      const o = (y * dw + x) * 4;
      const coverage = area > 0 ? (sumW / area) : 0;
      if (coverage <= covTh || sumW <= 1e-6) {
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
        out[o + 3] = 0;
        continue;
      }

      out[o] = _clamp8(Math.round(sumR / sumW));
      out[o + 1] = _clamp8(Math.round(sumG / sumW));
      out[o + 2] = _clamp8(Math.round(sumB / sumW));
      out[o + 3] = 255;
    }
  }

  return out;
};

const downsampleNearestRGBA = (src, srcW, srcH, dstW, dstH) => {
  const sw = srcW | 0;
  const sh = srcH | 0;
  const dw = dstW | 0;
  const dh = dstH | 0;
  if (!src || !sw || !sh || !dw || !dh) return src;

  let out;
  try {
    out = new Uint8ClampedArray(dw * dh * 4);
  } catch (e) {
    out = new Array(dw * dh * 4).fill(0);
  }

  for (let y = 0; y < dh; y++) {
    const sy = Math.max(0, Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / dh)));
    for (let x = 0; x < dw; x++) {
      const sx = Math.max(0, Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / dw)));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }

  return out;
};

const applyUnsharpMaskRGBA = (src, width, height, amount) => {
  const w = width | 0;
  const h = height | 0;
  const a = Math.max(0, Math.min(1, Number(amount) || 0));
  if (!src || !w || !h || a <= 0) return src;

  let out;
  try {
    out = new Uint8ClampedArray(src);
  } catch (e) {
    out = Array.from(src);
  }

  const idxOf = (x, y) => (y * w + x) * 4;
  for (let y = 0; y < h; y++) {
    const y0 = y > 0 ? y - 1 : 0;
    const y1 = y;
    const y2 = y + 1 < h ? y + 1 : h - 1;
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : 0;
      const x1 = x;
      const x2 = x + 1 < w ? x + 1 : w - 1;

      const i = idxOf(x, y);
      const alpha = src[i + 3];
      if (alpha === 0) continue;

      let sumW = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;

      const add = (xx, yy) => {
        const j = idxOf(xx, yy);
        const aa = src[j + 3] / 255;
        if (aa <= 0) return;
        sumW += aa;
        sumR += src[j] * aa;
        sumG += src[j + 1] * aa;
        sumB += src[j + 2] * aa;
      };

      add(x0, y0); add(x1, y0); add(x2, y0);
      add(x0, y1); add(x1, y1); add(x2, y1);
      add(x0, y2); add(x1, y2); add(x2, y2);

      if (sumW <= 1e-6) continue;

      const br = sumR / sumW;
      const bg = sumG / sumW;
      const bb = sumB / sumW;

      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      out[i] = _clamp8(Math.round(r + (r - br) * a));
      out[i + 1] = _clamp8(Math.round(g + (g - bg) * a));
      out[i + 2] = _clamp8(Math.round(b + (b - bb) * a));
      out[i + 3] = alpha;
    }
  }
  return out;
};

module.exports = {
  applyOrderedDitherRGBA,
  downsampleBoxRGBA,
  downsampleNearestRGBA,
  applyUnsharpMaskRGBA
};
