const assert = require('assert');
const { applyOrderedDitherRGBA, downsampleBoxRGBA, downsampleNearestRGBA, applyUnsharpMaskRGBA } = require('../utils/pixelate');

const makeRGBA = (w, h, fn) => {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const p = fn(x, y) || {};
      out[i] = p.r | 0;
      out[i + 1] = p.g | 0;
      out[i + 2] = p.b | 0;
      out[i + 3] = p.a == null ? 255 : (p.a | 0);
    }
  }
  return out;
};

(() => {
  const src = makeRGBA(8, 8, (x) => (x < 4 ? { r: 255, g: 255, b: 255, a: 255 } : { r: 0, g: 0, b: 0, a: 255 }));
  const out = downsampleBoxRGBA(src, 8, 8, 2, 2, 0.08);
  assert.strictEqual(out.length, 2 * 2 * 4);
  const tl = out.slice(0, 4);
  const tr = out.slice(4, 8);
  assert.deepStrictEqual(Array.from(tl), [255, 255, 255, 255]);
  assert.deepStrictEqual(Array.from(tr), [0, 0, 0, 255]);
})();

(() => {
  const src = makeRGBA(8, 8, (x, y) => {
    if (x < 4 && y < 4) return { r: 200, g: 100, b: 50, a: 255 };
    return { r: 200, g: 100, b: 50, a: 0 };
  });
  const out = downsampleBoxRGBA(src, 8, 8, 2, 2, 0.3);
  const tl = out.slice(0, 4);
  const tr = out.slice(4, 8);
  const bl = out.slice(8, 12);
  const br = out.slice(12, 16);
  assert.strictEqual(tl[3], 255);
  assert.strictEqual(tr[3], 0);
  assert.strictEqual(bl[3], 0);
  assert.strictEqual(br[3], 0);
})();

(() => {
  const src = makeRGBA(8, 8, () => ({ r: 120, g: 120, b: 120, a: 255 }));
  const out = applyOrderedDitherRGBA(src, 8, 8, 0.8);
  assert.strictEqual(out.length, src.length);
  for (let i = 0; i < out.length; i += 4) {
    assert.ok(out[i] >= 0 && out[i] <= 255);
    assert.ok(out[i + 1] >= 0 && out[i + 1] <= 255);
    assert.ok(out[i + 2] >= 0 && out[i + 2] <= 255);
    assert.strictEqual(out[i + 3], 255);
  }
  let min = 255;
  let max = 0;
  for (let i = 0; i < out.length; i += 4) {
    const v = out[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  assert.ok(max > min);
})();

(() => {
  const src = makeRGBA(8, 8, (x) => (x < 4 ? { r: 255, g: 255, b: 255, a: 255 } : { r: 0, g: 0, b: 0, a: 255 }));
  const out = downsampleNearestRGBA(src, 8, 8, 2, 2);
  assert.strictEqual(out.length, 2 * 2 * 4);
  const tl = out.slice(0, 4);
  const tr = out.slice(4, 8);
  assert.deepStrictEqual(Array.from(tl), [255, 255, 255, 255]);
  assert.deepStrictEqual(Array.from(tr), [0, 0, 0, 255]);
})();

(() => {
  const src = makeRGBA(8, 8, () => ({ r: 80, g: 80, b: 80, a: 255 }));
  const out = applyUnsharpMaskRGBA(src, 8, 8, 0.6);
  assert.strictEqual(out.length, src.length);
  for (let i = 0; i < out.length; i += 4) {
    assert.strictEqual(out[i], 80);
    assert.strictEqual(out[i + 1], 80);
    assert.strictEqual(out[i + 2], 80);
    assert.strictEqual(out[i + 3], 255);
  }
})();

(() => {
  const src = makeRGBA(8, 8, (x) => (x < 4 ? { r: 40, g: 40, b: 40, a: 255 } : { r: 200, g: 200, b: 200, a: 255 }));
  const out = applyUnsharpMaskRGBA(src, 8, 8, 0.6);
  let changed = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 3; x <= 4; x++) {
      const i = (y * 8 + x) * 4;
      if (out[i] !== src[i]) changed++;
    }
  }
  assert.ok(changed > 0);
})();

console.log('pixelate.test.js: OK');
