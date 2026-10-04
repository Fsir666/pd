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
  const covRaw = Number(alphaCoverageThreshold);
  const covTh = Number.isFinite(covRaw) ? Math.max(0, Math.min(1, covRaw)) : 0;
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

const downsampleMinMaxRGBA = (src, srcW, srcH, dstW, dstH) => {
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
  
    // Precompute luminance - not needed for this algo but useful ref
    // const getLuma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

    for (let y = 0; y < dh; y++) {
      const y0 = Math.floor((y * sh) / dh);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
      
      for (let x = 0; x < dw; x++) {
        const x0 = Math.floor((x * sw) / dw);
        const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
        
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        
        // First pass: calculate average to determine variance
        for (let sy = y0; sy < y1; sy++) {
            let idx = (sy * sw + x0) * 4;
            for (let sx = x0; sx < x1; sx++) {
                if (src[idx + 3] > 0) {
                    sumR += src[idx];
                    sumG += src[idx + 1];
                    sumB += src[idx + 2];
                    count++;
                }
                idx += 4;
            }
        }

        const o = (y * dw + x) * 4;

        if (count === 0) {
             out[o] = 0; out[o+1] = 0; out[o+2] = 0; out[o+3] = 0;
             continue;
        }

        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;
        
        let bestDist = -1;
        let bestIdx = -1;

        // Second pass: find pixel furthest from average (feature preserving)
        for (let sy = y0; sy < y1; sy++) {
            let idx = (sy * sw + x0) * 4;
            for (let sx = x0; sx < x1; sx++) {
                if (src[idx + 3] > 0) {
                   const r = src[idx];
                   const g = src[idx + 1];
                   const b = src[idx + 2];
                   const dist = Math.abs(r - avgR) + Math.abs(g - avgG) + Math.abs(b - avgB);
                   if (dist > bestDist) {
                       bestDist = dist;
                       bestIdx = idx;
                   }
                }
                idx += 4;
            }
        }

        if (bestIdx !== -1) {
            out[o] = src[bestIdx];
            out[o + 1] = src[bestIdx + 1];
            out[o + 2] = src[bestIdx + 2];
            out[o + 3] = src[bestIdx + 3];
        } else {
             // Fallback to average if something went wrong
             out[o] = _clamp8(Math.round(avgR));
             out[o + 1] = _clamp8(Math.round(avgG));
             out[o + 2] = _clamp8(Math.round(avgB));
             out[o + 3] = 255;
        }
      }
    }
  
    return out;
};

const downsampleModeRGBA = (src, srcW, srcH, dstW, dstH) => {
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
      const y0 = Math.floor((y * sh) / dh);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
      
      for (let x = 0; x < dw; x++) {
        const x0 = Math.floor((x * sw) / dw);
        const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
        
        let maxCount = 0;
        let bestKey = -1;
        const counts = new Map();

        // Count color frequency in the grid cell
        for (let sy = y0; sy < y1; sy++) {
            let idx = (sy * sw + x0) * 4;
            for (let sx = x0; sx < x1; sx++) {
                if (src[idx + 3] > 0) {
                   const r = (src[idx] / 8 | 0) * 8; // Quantize slightly to group similar colors
                   const g = (src[idx + 1] / 8 | 0) * 8;
                   const b = (src[idx + 2] / 8 | 0) * 8;
                   const key = ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
                   const next = (counts.get(key) || 0) + 1;
                   counts.set(key, next);
                   if (next > maxCount) {
                       maxCount = next;
                       bestKey = key;
                   }
                }
                idx += 4;
            }
        }

        const o = (y * dw + x) * 4;
        if (bestKey !== -1) {
            out[o] = (bestKey >> 16) & 255;
            out[o + 1] = (bestKey >> 8) & 255;
            out[o + 2] = bestKey & 255;
            out[o + 3] = 255;
        } else {
             out[o] = 0; out[o+1] = 0; out[o+2] = 0; out[o+3] = 0;
        }
      }
    }
  
    return out;
};

const downsampleMedianRGBA = (src, srcW, srcH, dstW, dstH) => {
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
      const y0 = Math.floor((y * sh) / dh);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
      
      for (let x = 0; x < dw; x++) {
        const x0 = Math.floor((x * sw) / dw);
        const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
        
        const rs = [];
        const gs = [];
        const bs = [];
        let aSum = 0;
        let count = 0;

        for (let sy = y0; sy < y1; sy++) {
            let idx = (sy * sw + x0) * 4;
            for (let sx = x0; sx < x1; sx++) {
                if (src[idx + 3] > 0) {
                    rs.push(src[idx]);
                    gs.push(src[idx + 1]);
                    bs.push(src[idx + 2]);
                    aSum += src[idx + 3];
                    count++;
                }
                idx += 4;
            }
        }

        const o = (y * dw + x) * 4;
        if (count > 0) {
            rs.sort((a, b) => a - b);
            gs.sort((a, b) => a - b);
            bs.sort((a, b) => a - b);
            
            const mid = Math.floor(rs.length / 2);
            out[o] = rs[mid];
            out[o + 1] = gs[mid];
            out[o + 2] = bs[mid];
            out[o + 3] = Math.round(aSum / count); // Average alpha
        } else {
             out[o] = 0; out[o+1] = 0; out[o+2] = 0; out[o+3] = 0;
        }
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

const applyMedianFilterRGBA = (src, width, height, radius) => {
  const w = width | 0;
  const h = height | 0;
  const r = Math.max(1, Math.min(2, Number(radius) || 1));
  if (!src || !w || !h) return src;

  let out;
  try {
    out = new Uint8ClampedArray(src);
  } catch (e) {
    out = Array.from(src);
  }

  const get = (x, y, c) => {
    const i = (y * w + x) * 4 + c;
    return src[i];
  };

  const getA = (x, y) => {
    const i = (y * w + x) * 4 + 3;
    return src[i];
  };

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const a = getA(x, y);
      if (a === 0) continue;

      const rs = [];
      const gs = [];
      const bs = [];
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const aa = getA(xx, yy);
          if (aa === 0) continue;
          rs.push(get(xx, yy, 0));
          gs.push(get(xx, yy, 1));
          bs.push(get(xx, yy, 2));
        }
      }

      if (!rs.length) continue;
      rs.sort((a1, a2) => a1 - a2);
      gs.sort((a1, a2) => a1 - a2);
      bs.sort((a1, a2) => a1 - a2);
      const mid = (rs.length / 2) | 0;
      const i = (y * w + x) * 4;
      out[i] = rs[mid];
      out[i + 1] = gs[mid];
      out[i + 2] = bs[mid];
      out[i + 3] = a;
    }
  }

  return out;
};

module.exports = {
  applyOrderedDitherRGBA,
  downsampleBoxRGBA,
  downsampleNearestRGBA,
  downsampleMinMaxRGBA,
  downsampleModeRGBA,
  downsampleMedianRGBA,
  applyUnsharpMaskRGBA,
  applyMedianFilterRGBA
};
