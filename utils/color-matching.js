function rgbToXyz(r, g, b) {
  r = r / 255;
  g = g / 255;
  b = b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  r *= 100;
  g *= 100;
  b *= 100;

  return {
    x: r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    y: r * 0.2126729 + g * 0.7151522 + b * 0.0721750,
    z: r * 0.0193339 + g * 0.1191920 + b * 0.9503041
  };
}

function xyzToLab(x, y, z) {
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;

  x = x / refX;
  y = y / refY;
  z = z / refZ;

  x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);

  return {
    L: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z)
  };
}

function rgbToLab(r, g, b) {
  const xyz = rgbToXyz(r, g, b);
  return xyzToLab(xyz.x, xyz.y, xyz.z);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function hexToLab(hex) {
  const rgb = hexToRgb(hex);
  return rgbToLab(rgb.r, rgb.g, rgb.b);
}

function ciede2000(l1, a1, b1, l2, a2, b2) {
  const L1 = l1, a1_ = a1, b1_ = b1;
  const L2 = l2, a2_ = a2, b2_ = b2;

  const kL = 1, kC = 1, kH = 1;

  const C1 = Math.sqrt(a1_ * a1_ + b1_ * b1_);
  const C2 = Math.sqrt(a2_ * a2_ + b2_ * b2_);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1p = a1_ * (1 + G);
  const a2p = a2_ * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1_ * b1_);
  const C2p = Math.sqrt(a2p * a2p + b2_ * b2_);

  let h1p = Math.atan2(b1_, a1p) * 180 / Math.PI;
  if (h1p < 0) h1p += 360;

  let h2p = Math.atan2(b2_, a2p) * 180 / Math.PI;
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);

  const Lpbar = (L1 + L2) / 2;
  const Cpbar = (C1p + C2p) / 2;

  let Hpbar;
  if (C1p * C2p === 0) {
    Hpbar = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    Hpbar = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    Hpbar = (h1p + h2p + 360) / 2;
  } else {
    Hpbar = (h1p + h2p - 360) / 2;
  }

  const T = 1 - 0.17 * Math.cos((Hpbar - 30) * Math.PI / 180)
            + 0.24 * Math.cos(2 * Hpbar * Math.PI / 180)
            + 0.32 * Math.cos((3 * Hpbar + 6) * Math.PI / 180)
            - 0.20 * Math.cos((4 * Hpbar - 63) * Math.PI / 180);

  const SL = 1 + (0.015 * Math.pow(Lpbar - 50, 2)) / Math.sqrt(20 + Math.pow(Lpbar - 50, 2));
  const SC = 1 + 0.045 * Cpbar;
  const SH = 1 + 0.015 * Cpbar * T;

  const dTheta = 30 * Math.exp(-Math.pow((Hpbar - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cpbar, 7) / (Math.pow(Cpbar, 7) + Math.pow(25, 7)));
  const RT = -RC * Math.sin(2 * dTheta * Math.PI / 180);

  const dE = Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );

  return dE;
}

function kMeansCluster(pixels, k, maxIterations) {
  if (pixels.length === 0) {
    return { centroids: [{ r: 128, g: 128, b: 128 }], assignments: [] };
  }

  k = Math.min(k, pixels.length);

  let centroids = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    const idx = Math.min(i * step, pixels.length - 1);
    centroids.push({ ...pixels[idx] });
  }

  let assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let j = 0; j < k; j++) {
        const dr = pixels[i].r - centroids[j].r;
        const dg = pixels[i].g - centroids[j].g;
        const db = pixels[i].b - centroids[j].b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          minIdx = j;
        }
      }
      assignments[i] = minIdx;
    }

    const newCentroids = [];
    for (let j = 0; j < k; j++) {
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let i = 0; i < pixels.length; i++) {
        if (assignments[i] === j) {
          sumR += pixels[i].r;
          sumG += pixels[i].g;
          sumB += pixels[i].b;
          count++;
        }
      }
      if (count > 0) {
        newCentroids.push({
          r: Math.round(sumR / count),
          g: Math.round(sumG / count),
          b: Math.round(sumB / count)
        });
      } else {
        newCentroids.push(centroids[j]);
      }
    }

    let converged = true;
    for (let j = 0; j < k; j++) {
      if (newCentroids[j].r !== centroids[j].r ||
          newCentroids[j].g !== centroids[j].g ||
          newCentroids[j].b !== centroids[j].b) {
        converged = false;
        break;
      }
    }

    centroids = newCentroids;

    if (converged) break;
  }

  return { centroids, assignments };
}

function getMajorityColor(pixels) {
  if (pixels.length === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  const k = 3;
  const maxIterations = 10;
  const { centroids, assignments } = kMeansCluster(pixels, k, maxIterations);

  const counts = new Array(k).fill(0);
  for (let i = 0; i < assignments.length; i++) {
    counts[assignments[i]]++;
  }

  let maxCount = 0;
  let majorityIdx = 0;
  for (let j = 0; j < k; j++) {
    if (counts[j] > maxCount) {
      maxCount = counts[j];
      majorityIdx = j;
    }
  }

  return centroids[majorityIdx];
}

function downsampleImageKMeans(imageData, srcWidth, srcHeight, dstWidth, dstHeight) {
  const result = new Array(dstWidth * dstHeight);
  const blockWidth = srcWidth / dstWidth;
  const blockHeight = srcHeight / dstHeight;

  for (let dstY = 0; dstY < dstHeight; dstY++) {
    for (let dstX = 0; dstX < dstWidth; dstX++) {
      const startX = Math.floor(dstX * blockWidth);
      const startY = Math.floor(dstY * blockHeight);
      const endX = Math.floor((dstX + 1) * blockWidth);
      const endY = Math.floor((dstY + 1) * blockHeight);

      const pixels = [];

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * srcWidth + x) * 4;
          const r = imageData[idx];
          const g = imageData[idx + 1];
          const b = imageData[idx + 2];
          const a = imageData[idx + 3];

          if (a > 128) {
            pixels.push({ r, g, b });
          }
        }
      }

      const majorColor = getMajorityColor(pixels);
      result[dstY * dstWidth + dstX] = majorColor;
    }
  }

  return result;
}

function calculateOutputSize(imgWidth, imgHeight, baseSize) {
  const aspectRatio = imgWidth / imgHeight;

  let outputWidth, outputHeight;

  if (aspectRatio > 1) {
    outputWidth = baseSize;
    outputHeight = Math.round(baseSize / aspectRatio);
  } else if (aspectRatio < 1) {
    outputHeight = baseSize;
    outputWidth = Math.round(baseSize * aspectRatio);
  } else {
    outputWidth = baseSize;
    outputHeight = baseSize;
  }

  outputWidth = Math.max(8, Math.min(128, outputWidth));
  outputHeight = Math.max(8, Math.min(128, outputHeight));

  return { width: outputWidth, height: outputHeight };
}

function buildPaletteLabCache(paletteColors) {
  return paletteColors.map(color => {
    const rgb = hexToRgb(color.hex);
    const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
    return {
      ...color,
      lab
    };
  });
}

function findClosestColor(r, g, b, paletteLabCache) {
  const targetLab = rgbToLab(r, g, b);

  let minDeltaE = Infinity;
  let closestColor = null;

  for (const color of paletteLabCache) {
    const deltaE = ciede2000(
      targetLab.L, targetLab.a, targetLab.b,
      color.lab.L, color.lab.a, color.lab.b
    );

    if (deltaE < minDeltaE) {
      minDeltaE = deltaE;
      closestColor = color;
    }
  }

  return closestColor;
}

function processImageToBeads(imageData, srcWidth, srcHeight, paletteColors, baseSize) {
  const outputSize = calculateOutputSize(srcWidth, srcHeight, baseSize);
  const downsampled = downsampleImageKMeans(imageData, srcWidth, srcHeight, outputSize.width, outputSize.height);

  const paletteLabCache = buildPaletteLabCache(paletteColors);

  const w = outputSize.width;
  const h = outputSize.height;
  const result = {
    width: w,
    height: h,
    beads: [],
    srcGrid: null
  };

  // 构造降采样源数据的 RGBA 缓冲，供上层后处理管线（去噪/锐化/抖动）使用
  const srcGrid = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const color = downsampled[idx];
      const matchedColor = findClosestColor(color.r, color.g, color.b, paletteLabCache);

      result.beads.push({
        x: x,
        y: y,
        color: matchedColor
      });

      srcGrid[idx * 4] = color.r;
      srcGrid[idx * 4 + 1] = color.g;
      srcGrid[idx * 4 + 2] = color.b;
      srcGrid[idx * 4 + 3] = 255;
    }
  }

  result.srcGrid = srcGrid;
  return result;
}

function getBrandPalette(brandId, colorData) {
  const brand = colorData[brandId];
  if (!brand || !brand.subSeries) return [];

  const colors = [];
  for (const series of brand.subSeries) {
    if (series.colors) {
      for (const color of series.colors) {
        colors.push({
          hex: color.hex,
          code: color.code,
          series: color.series,
          brand: brand.name
        });
      }
    }
  }

  return colors;
}

module.exports = {
  rgbToXyz,
  xyzToLab,
  rgbToLab,
  hexToRgb,
  hexToLab,
  ciede2000,
  kMeansCluster,
  getMajorityColor,
  downsampleImageKMeans,
  calculateOutputSize,
  buildPaletteLabCache,
  findClosestColor,
  processImageToBeads,
  getBrandPalette
};
