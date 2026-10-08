const pixelate = require('../../../utils/pixelate.js');

Page({
  data: {
    gridSize: 32,
    pendingGridSize: 32,
    showSettings: false,
    boardSize: 320,
    rulerSize: 22,
    showGrid: true,
    showRuler: true,
    canEnterBeadMode: false,
    viewScale: 1,
    viewX: 0,
    viewY: 0,
    referenceImage: '',
    selectedBrand: 'MARD',
    brandOptions: [
      { key: 'MARD', label: 'MARD' },
      { key: 'COCO', label: 'COCO' },
      { key: '漫漫', label: '漫漫' },
      { key: '盼盼', label: '盼盼' },
      { key: '咪小窝', label: '咪小窝' }
    ],
    statsTotalBeads: 0,
    statsTotalColors: 0,
    statsSort: 'count',
    statsList: [],
    
    // New Settings
    presetKey: 'auto',
    ditherValue: 15,
    detailValue: 30,
    sampleMode: 'auto',
    auxGridIndex: 0,
    auxGridOptions: [0, 5, 10],
    showCellCodes: false
  },

  onLoad(options) {
    const sys = wx.getSystemInfoSync();
    const pxPerRpx = sys.windowWidth / 750;
    const pagePadPx = Math.round(28 * 2 * pxPerRpx);
    const shellPadPx = Math.round(18 * 2 * pxPerRpx);
    const rulerSize = 22;
    const boardSize = Math.max(220, Math.floor(sys.windowWidth - pagePadPx - shellPadPx - rulerSize));
    const next = { boardSize, rulerSize };
    if (options && options.size) {
      const size = parseInt(options.size, 10);
      if (Number.isFinite(size)) {
        next.gridSize = Math.max(16, Math.min(128, size));
        next.pendingGridSize = next.gridSize;
      }
    }
    if (options && options.imageUrl) {
      next.referenceImage = decodeURIComponent(options.imageUrl);
    }
    this.setData(next);
  },

  onReady() {
    this._initBoardCanvas();
    this._initProcessCanvas();
    this._initRulerCanvases();
  },

  onOpenSettings() {
    this.setData({ showSettings: true, pendingGridSize: this.data.gridSize });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  _defaultsForPreset(presetKey, gridSize) {
    const g = Math.max(16, Math.min(128, Number(gridSize) || 32));
    const small = g <= 48;
    const mid = g <= 72;
    const k = String(presetKey || 'auto');
    if (k === 'clear') {
      return { sampleMode: 'auto', ditherValue: small ? 5 : 0, detailValue: mid ? 25 : 18 };
    }
    if (k === 'real') {
      return { sampleMode: 'photo', ditherValue: small ? 20 : 15, detailValue: small ? 40 : 30 };
    }
    if (k === 'pixel') {
      return { sampleMode: 'pixel', ditherValue: 0, detailValue: 5 };
    }
    return { sampleMode: 'auto', ditherValue: small ? 18 : 12, detailValue: small ? 35 : 28 };
  },

  _markCustom() {
    if (this.data.presetKey === 'custom') return;
    this.setData({ presetKey: 'custom' });
  },

  _guessIsPixelArt(src, w, h) {
    const width = w | 0;
    const height = h | 0;
    if (!src || !width || !height) return false;
    const step = Math.max(1, Math.floor(Math.max(width, height) / 64));
    const colors = new Set();
    let sharp = 0;
    let soft = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const a = src[i + 3];
        if (a === 0) continue;
        const r = src[i] >> 3;
        const g = src[i + 1] >> 3;
        const b = src[i + 2] >> 3;
        colors.add((r << 10) | (g << 5) | b);
        const nx = Math.min(width - 1, x + step);
        const j = (y * width + nx) * 4;
        const na = src[j + 3];
        if (na === 0) continue;
        const d = Math.abs(src[i] - src[j]) + Math.abs(src[i + 1] - src[j + 1]) + Math.abs(src[i + 2] - src[j + 2]);
        if (d > 90) sharp++;
        else soft++;
      }
    }
    const c = colors.size;
    const edgeRatio = sharp / Math.max(1, sharp + soft);
    return c <= 96 && edgeRatio >= 0.35;
  },

  onPresetTap(e) {
    const presetKey = String(e.currentTarget.dataset.preset || '');
    if (!presetKey) return;
    if (presetKey === this.data.presetKey) return;
    const d = this._defaultsForPreset(presetKey, this.data.gridSize); // Use current gridSize, not pending
    this.setData({ presetKey, ditherValue: d.ditherValue, detailValue: d.detailValue, sampleMode: d.sampleMode }, () => {
      if (this.data.referenceImage) {
        wx.showLoading({ title: '调整中...' });
        this._processImageToMosaic(this.data.referenceImage).then(() => wx.hideLoading());
      }
    });
  },

  onSetSampleMode(e) {
    const mode = String(e.currentTarget.dataset.mode || '');
    if (mode !== 'auto' && mode !== 'photo' && mode !== 'pixel') return;
    if (mode === this.data.sampleMode) return;
    this._markCustom();
    this.setData({ sampleMode: mode }, () => {
      if (this.data.referenceImage) {
        wx.showLoading({ title: '调整中...' });
        this._processImageToMosaic(this.data.referenceImage).then(() => wx.hideLoading());
      }
    });
  },

  onDitherChange(e) {
    const v = parseInt(e.detail.value, 10);
    const ditherValue = Math.max(0, Math.min(80, Number.isFinite(v) ? v : 0));
    this._markCustom();
    this.setData({ ditherValue }, () => {
      this._rebuildFromGridSrc();
    });
  },

  onDitherChanging(e) {
    const v = parseInt(e.detail.value, 10);
    this.setData({ ditherValue: Math.max(0, Math.min(80, Number.isFinite(v) ? v : 0)) });
  },

  onDetailChange(e) {
    const v = parseInt(e.detail.value, 10);
    const detailValue = Math.max(0, Math.min(60, Number.isFinite(v) ? v : 0));
    this._markCustom();
    this.setData({ detailValue }, () => {
      this._rebuildFromGridSrc();
    });
  },

  onDetailChanging(e) {
    const v = parseInt(e.detail.value, 10);
    this.setData({ detailValue: Math.max(0, Math.min(60, Number.isFinite(v) ? v : 0)) });
  },

  onSetAuxGrid(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({ auxGridIndex: index }, () => {
      this._drawBoard();
    });
  },

  onToggleCellCodes(e) {
    this.setData({ showCellCodes: e.detail.value }, () => {
      this._drawBoard();
    });
  },

  _rebuildFromGridSrc() {
    const cols = this._gridSrcCols;
    const rows = this._gridSrcRows;
    const src = this._gridBaseData || this._gridSrcData;
    if (!cols || !rows || !src) return;

    try {
      const detail = Math.max(0, Math.min(1, (this.data.detailValue || 0) / 100));
      const detailed = detail > 0 ? pixelate.applyUnsharpMaskRGBA(src, cols, rows, detail) : src;
      const strength = Math.max(0, Math.min(1, (this.data.ditherValue || 0) / 100));
      const dithered = strength > 0 ? pixelate.applyOrderedDitherRGBA(detailed, cols, rows, strength) : detailed;
      
      this._ensurePaletteReady();
      this._pixelData = this._mapPixelsToPalette(dithered);
      this._pixelCols = cols;
      this._pixelRows = rows;
      
      if (!this._isPixelArt) {
        this._pixelData = this._denoisePixelData(this._pixelData, cols, rows);
        this._pixelData = this._snapOutlines(this._pixelData, cols, rows);
      }
      
      this._pixelHexes = this._buildPixelHexes(this._pixelData, cols, rows);
      this._recomputeStats();
      this._drawBoard();
    } catch (e) {
      console.error(e);
    }
  },

  onGridChanging(e) {
    const v = parseInt(e.detail.value, 10);
    const pendingGridSize = Math.max(16, Math.min(128, Number.isFinite(v) ? v : 32));
    this.setData({ pendingGridSize });
  },

  onGridChange(e) {
    const v = parseInt(e.detail.value, 10);
    const pendingGridSize = Math.max(16, Math.min(128, Number.isFinite(v) ? v : 32));
    this.setData({ pendingGridSize });
  },

  onPickGrid(e) {
    const v = parseInt(e.currentTarget.dataset.size, 10);
    const pendingGridSize = Math.max(16, Math.min(128, Number.isFinite(v) ? v : 32));
    this.setData({ pendingGridSize });
  },

  _denoisePixelData(srcData, cols, rows) {
    if (!srcData || !cols || !rows) return srcData;
    let out;
    try {
      out = new Uint8ClampedArray(srcData);
    } catch (e) {
      out = Array.from(srcData);
    }

    const getKey = (r, g, b) => ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
    const setFromKey = (idx, key, a) => {
      out[idx] = (key >> 16) & 255;
      out[idx + 1] = (key >> 8) & 255;
      out[idx + 2] = key & 255;
      out[idx + 3] = a;
    };
    const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = (y * cols + x) * 4;
        const a = srcData[idx + 3];
        if (a === 0) continue;
        const r = srcData[idx];
        const g = srcData[idx + 1];
        const b = srcData[idx + 2];
        if (luma(r, g, b) < 38) continue;

        const centerKey = getKey(r, g, b);
        const counts = new Map();
        let bestKey = centerKey;
        let bestCount = 0;

        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= rows) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= cols) continue;
            const nidx = (ny * cols + nx) * 4;
            const na = srcData[nidx + 3];
            if (na === 0) continue;
            const nr = srcData[nidx];
            const ng = srcData[nidx + 1];
            const nb = srcData[nidx + 2];
            const key = getKey(nr, ng, nb);
            const c = (counts.get(key) || 0) + 1;
            counts.set(key, c);
            if (c > bestCount) {
              bestCount = c;
              bestKey = key;
            }
          }
        }

        if (bestKey !== centerKey && bestCount >= 5) {
          setFromKey(idx, bestKey, a);
        }
      }
    }

    return out;
  },

  _snapOutlines(srcData, cols, rows) {
    this._ensurePaletteReady();
    const black = this._paletteBlack;
    if (!srcData || !cols || !rows || !black) return srcData;
    let out;
    try {
      out = new Uint8ClampedArray(srcData);
    } catch (e) {
      out = Array.from(srcData);
    }

    const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const isEdge = (x, y, centerL) => {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let i = 0; i < dirs.length; i++) {
        const nx = x + dirs[i][0];
        const ny = y + dirs[i][1];
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const nidx = (ny * cols + nx) * 4;
        const na = srcData[nidx + 3];
        if (na === 0) continue;
        const nr = srcData[nidx];
        const ng = srcData[nidx + 1];
        const nb = srcData[nidx + 2];
        const nl = luma(nr, ng, nb);
        if (nl - centerL > 90) return true;
      }
      return false;
    };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = (y * cols + x) * 4;
        const a = srcData[idx + 3];
        if (a === 0) continue;
        const r = srcData[idx];
        const g = srcData[idx + 1];
        const b = srcData[idx + 2];
        const sat = this._rgbSaturation(r, g, b);
        if (sat > 0.25) continue;
        const l = luma(r, g, b);
        if (l > 110) continue;
        if (!isEdge(x, y, l)) continue;
        out[idx] = black.r;
        out[idx + 1] = black.g;
        out[idx + 2] = black.b;
        out[idx + 3] = a;
      }
    }

    return out;
  },

  _rgbSaturation(r, g, b) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const d = max - min;
    if (d === 0) return 0;
    const l = (max + min) / 2;
    return d / (1 - Math.abs(2 * l - 1));
  },

  _rgbToLab(r, g, b) {
    const rl = this._srgbToLinear(r / 255);
    const gl = this._srgbToLinear(g / 255);
    const bl = this._srgbToLinear(b / 255);

    const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
    const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
    const z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

    const xn = 0.95047;
    const yn = 1.0;
    const zn = 1.08883;

    const fx = this._labF(x / xn);
    const fy = this._labF(y / yn);
    const fz = this._labF(z / zn);

    const l = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const bb2 = 200 * (fy - fz);
    return { l, a, b: bb2 };
  },

  _srgbToLinear(c) {
    if (c <= 0.04045) return c / 12.92;
    return Math.pow((c + 0.055) / 1.055, 2.4);
  },

  _labF(t) {
    if (t > 0.008856) return Math.pow(t, 1 / 3);
    return 7.787 * t + 16 / 116;
  },

  _rgbToHsl(r, g, b) {
    let rr = r / 255;
    let gg = g / 255;
    let bb = b / 255;

    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const d = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === rr) h = ((gg - bb) / d) % 6;
      else if (max === gg) h = (bb - rr) / d + 2;
      else h = (rr - gg) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }

    return { h, s, l };
  },

  _hexToRgb(hex) {
    const s = hex.replace('#', '');
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return { r, g, b };
  },

  onApplyGrid() {
    const gridSize = this.data.pendingGridSize;
    if (gridSize === this.data.gridSize) {
      this.setData({ showSettings: false });
      return;
    }
    this.setData({ gridSize, showSettings: false }, () => {
      this._resetView();
      if (this.data.referenceImage) {
        this._processImageToMosaic(this.data.referenceImage);
      } else {
        this._drawBoard();
      }
    });
  },

  onChooseImage() {
    const pickWithChooseImage = () => {
      if (typeof wx.chooseImage !== 'function') {
        wx.showToast({ title: '当前环境不支持上传', icon: 'none' });
        return;
      }
      wx.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const p = res && res.tempFilePaths && res.tempFilePaths[0] ? res.tempFilePaths[0] : '';
          if (!p) return;
          this.setData({ referenceImage: p }, async () => {
            this._resetView();
            wx.showLoading({ title: '生成中...' });
            console.log('开始处理图片:', p);
            const ok = await this._processImageToMosaic(p);
            console.log('处理结果:', ok);
            wx.hideLoading();
            if (!ok) wx.showToast({ title: '生成失败，请重试', icon: 'none' });
          });
        },
        fail: () => {
          wx.showToast({ title: '未选择图片', icon: 'none' });
        }
      });
    };

    if (typeof wx.chooseMedia !== 'function') {
      pickWithChooseImage();
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res && res.tempFiles && res.tempFiles[0] ? res.tempFiles[0] : null;
        const p = file && (file.tempFilePath || file.path) ? (file.tempFilePath || file.path) : '';
        if (!p) {
          pickWithChooseImage();
          return;
        }
        this.setData({ referenceImage: p }, async () => {
          this._resetView();
          wx.showLoading({ title: '生成中...' });
          console.log('开始处理图片(media):', p);
          const ok = await this._processImageToMosaic(p);
          console.log('处理结果(media):', ok);
          wx.hideLoading();
          if (!ok) wx.showToast({ title: '生成失败，请重试', icon: 'none' });
        });
      },
      fail: () => {
        pickWithChooseImage();
      }
    });
  },

  onEnterBeadMode() {
    const grid = Math.max(16, Math.min(128, this.data.gridSize));
    const hexes = this._pixelHexes;
    if (!hexes || hexes.length !== grid * grid) {
      wx.showToast({ title: '请先上传图片生成拼豆板', icon: 'none' });
      return;
    }
    const app = getApp();
    app.globalData = app.globalData || {};
    app.globalData.beadSession = {
      gridSize: grid,
      pixelHexes: hexes,
      selectedBrand: this.data.selectedBrand,
      statsSort: this.data.statsSort,
      showGrid: this.data.showGrid,
      showRuler: this.data.showRuler
    };
    wx.navigateTo({ url: '/packageGame/pages/bead-mode/bead-mode' });
  },

  onBrandTap(e) {
    const brand = e.currentTarget.dataset.brand;
    if (!brand || brand === this.data.selectedBrand) return;
    this.setData({ selectedBrand: brand }, () => {
      this._recomputeStats();
      this._drawBoard();
    });
  },

  onStatsSortTap(e) {
    const s = e && e.currentTarget ? e.currentTarget.dataset.sort : '';
    if (!s || s === this.data.statsSort) return;
    this.setData({ statsSort: s }, () => {
      this._recomputeStats();
    });
  },

  onToggleGrid(e) {
    const showGrid = !!(e && e.detail && e.detail.value);
    this.setData({ showGrid }, () => {
      this._drawBoard();
    });
  },

  onToggleRuler(e) {
    const showRuler = !!(e && e.detail && e.detail.value);
    this.setData({ showRuler }, () => {
      this._viewportRectDirty = true;
      this._resizeRulerCanvases();
      this._drawRulers();
    });
  },

  onTouchStart(e) {
    const touches = (e && e.touches) || [];
    if (!touches.length) return;
    this._ensureViewportRect(() => {
      if (touches.length >= 2) {
        const t0 = touches[0];
        const t1 = touches[1];
        const dx = t1.clientX - t0.clientX;
        const dy = t1.clientY - t0.clientY;
        this._touchMode = 'pinch';
        this._startDistance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        this._startScale = this.data.viewScale;
        this._startX = this.data.viewX;
        this._startY = this.data.viewY;
        this._pinchMid = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      } else {
        const t = touches[0];
        this._touchMode = 'pan';
        this._panLast = { x: t.clientX, y: t.clientY };
      }
    });
  },

  onTouchMove(e) {
    const touches = (e && e.touches) || [];
    if (!touches.length) return;
    if (this._touchMode === 'pinch' && touches.length >= 2) {
      const t0 = touches[0];
      const t1 = touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const s0 = this._startScale || 1;
      const ratio = dist / Math.max(1, this._startDistance || dist);
      const nextScale = this._clampScale(s0 * ratio);

      const rect = this._viewportRect;
      const mid = this._pinchMid || { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      const mx = mid.x - (rect ? rect.left : 0);
      const my = mid.y - (rect ? rect.top : 0);

      const tx0 = this._startX || 0;
      const ty0 = this._startY || 0;
      const k = nextScale / Math.max(0.0001, s0);
      let tx = tx0 + (mx - tx0) * (1 - k);
      let ty = ty0 + (my - ty0) * (1 - k);
      const clamped = this._clampTranslate(tx, ty, nextScale);
      this.setData({ viewScale: nextScale, viewX: clamped.x, viewY: clamped.y });
      this._scheduleRulerDraw();
      return;
    }

    if (this._touchMode === 'pan' && touches.length === 1) {
      const t = touches[0];
      const last = this._panLast || { x: t.clientX, y: t.clientY };
      const dx = t.clientX - last.x;
      const dy = t.clientY - last.y;
      this._panLast = { x: t.clientX, y: t.clientY };
      const s = this.data.viewScale;
      const clamped = this._clampTranslate(this.data.viewX + dx, this.data.viewY + dy, s);
      this.setData({ viewX: clamped.x, viewY: clamped.y });
      this._scheduleRulerDraw();
    }
  },

  onTouchEnd() {
    this._touchMode = '';
    this._panLast = null;
    this._pinchMid = null;
  },

  _initBoardCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#boardCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) return;
      this._canvas = res[0].node;
      this._ctx = this._canvas.getContext('2d');
      this._dpr = wx.getSystemInfoSync().pixelRatio || 1;
      this._resizeCanvas();
      this._drawBoard();
    });
  },

  _initProcessCanvas(callback) {
    const query = wx.createSelectorQuery();
    query.select('#pixelCanvas').fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        this._pixelCanvas = res[0].node;
        this._pixelCtx = this._pixelCanvas.getContext('2d');
      }
      
      if (callback) {
        callback();
      } else if (this.data.referenceImage) {
        this._processImageToMosaic(this.data.referenceImage);
      }
    });
  },

  _initRulerCanvases() {
    const query = wx.createSelectorQuery();
    query
      .select('#xRulerCanvas')
      .fields({ node: true, size: true })
      .select('#yRulerCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const xNode = res && res[0] ? res[0].node : null;
        const yNode = res && res[1] ? res[1].node : null;
        if (!xNode || !yNode) return;
        this._xRulerCanvas = xNode;
        this._xRulerCtx = xNode.getContext('2d');
        this._yRulerCanvas = yNode;
        this._yRulerCtx = yNode.getContext('2d');
        this._resizeRulerCanvases();
        this._drawRulers();
      });
  },

  _resizeRulerCanvases() {
    const dpr = this._dpr || wx.getSystemInfoSync().pixelRatio || 1;
    const boardSize = this.data.boardSize;
    const rulerSize = this.data.rulerSize;
    if (this._xRulerCanvas && this._xRulerCtx) {
      this._xRulerCanvas.width = Math.max(1, Math.round(boardSize * dpr));
      this._xRulerCanvas.height = Math.max(1, Math.round(rulerSize * dpr));
      const ctx = this._xRulerCtx;
      if (typeof ctx.resetTransform === 'function') ctx.resetTransform();
      else if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    if (this._yRulerCanvas && this._yRulerCtx) {
      this._yRulerCanvas.width = Math.max(1, Math.round(rulerSize * dpr));
      this._yRulerCanvas.height = Math.max(1, Math.round(boardSize * dpr));
      const ctx = this._yRulerCtx;
      if (typeof ctx.resetTransform === 'function') ctx.resetTransform();
      else if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  },

  _scheduleRulerDraw() {
    if (!this.data.showRuler) return;
    if (this._rulerDrawPending) return;
    this._rulerDrawPending = true;
    setTimeout(() => {
      this._rulerDrawPending = false;
      this._drawRulers();
    }, 16);
  },

  _pickRulerStep(cellPx) {
    if (cellPx >= 30) return 1;
    if (cellPx >= 18) return 2;
    if (cellPx >= 12) return 4;
    if (cellPx >= 8) return 8;
    return 16;
  },

  _drawRulers() {
    const xCtx = this._xRulerCtx;
    const yCtx = this._yRulerCtx;
    if (!xCtx || !yCtx) return;

    const show = !!this.data.showRuler;
    const boardSize = this.data.boardSize;
    const rulerSize = this.data.rulerSize;

    xCtx.clearRect(0, 0, boardSize, rulerSize);
    yCtx.clearRect(0, 0, rulerSize, boardSize);
    if (!show) return;

    const grid = Math.max(16, Math.min(128, this.data.gridSize));
    const cell = boardSize / grid;
    const scale = this.data.viewScale || 1;
    const tx = this.data.viewX || 0;
    const ty = this.data.viewY || 0;
    const step = this._pickRulerStep(cell * scale);

    xCtx.fillStyle = 'rgba(255,255,255,0.92)';
    xCtx.fillRect(0, 0, boardSize, rulerSize);
    xCtx.strokeStyle = 'rgba(0,0,0,0.08)';
    xCtx.lineWidth = 1;
    xCtx.beginPath();
    xCtx.moveTo(0, rulerSize - 0.5);
    xCtx.lineTo(boardSize, rulerSize - 0.5);
    xCtx.stroke();
    xCtx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial';
    xCtx.fillStyle = 'rgba(29,29,31,0.72)';
    xCtx.textAlign = 'center';
    xCtx.textBaseline = 'middle';

    const x0 = (-tx) / scale;
    const x1 = x0 + boardSize / scale;
    const startCol = Math.max(0, Math.floor(x0 / cell) - 1);
    const endCol = Math.min(grid - 1, Math.ceil(x1 / cell) + 1);
    const first = Math.ceil(startCol / step) * step;
    for (let i = first; i <= endCol; i += step) {
      const x = (i + 0.5) * cell * scale + tx;
      if (x < -20 || x > boardSize + 20) continue;
      xCtx.fillText(String(i), x, rulerSize / 2);
      xCtx.strokeStyle = 'rgba(0,0,0,0.10)';
      xCtx.beginPath();
      xCtx.moveTo(x + 0.5, rulerSize - 6);
      xCtx.lineTo(x + 0.5, rulerSize - 1);
      xCtx.stroke();
    }

    yCtx.fillStyle = 'rgba(255,255,255,0.92)';
    yCtx.fillRect(0, 0, rulerSize, boardSize);
    yCtx.strokeStyle = 'rgba(0,0,0,0.08)';
    yCtx.lineWidth = 1;
    yCtx.beginPath();
    yCtx.moveTo(rulerSize - 0.5, 0);
    yCtx.lineTo(rulerSize - 0.5, boardSize);
    yCtx.stroke();
    yCtx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial';
    yCtx.fillStyle = 'rgba(29,29,31,0.72)';
    yCtx.textAlign = 'center';
    yCtx.textBaseline = 'middle';

    const y0 = (-ty) / scale;
    const y1 = y0 + boardSize / scale;
    const startRow = Math.max(0, Math.floor(y0 / cell) - 1);
    const endRow = Math.min(grid - 1, Math.ceil(y1 / cell) + 1);
    const firstY = Math.ceil(startRow / step) * step;
    for (let j = firstY; j <= endRow; j += step) {
      const y = (j + 0.5) * cell * scale + ty;
      if (y < -20 || y > boardSize + 20) continue;
      yCtx.fillText(String(j), rulerSize / 2, y);
      yCtx.strokeStyle = 'rgba(0,0,0,0.10)';
      yCtx.beginPath();
      yCtx.moveTo(rulerSize - 6, y + 0.5);
      yCtx.lineTo(rulerSize - 1, y + 0.5);
      yCtx.stroke();
    }
  },

  _ensureViewportRect(done) {
    if (this._viewportRect && !this._viewportRectDirty) {
      done && done();
      return;
    }
    const query = wx.createSelectorQuery();
    query.select('#viewport').boundingClientRect().exec((res) => {
      this._viewportRect = res && res[0] ? res[0] : null;
      this._viewportRectDirty = false;
      done && done();
    });
  },

  _resetView() {
    this.setData({ viewScale: 1, viewX: 0, viewY: 0 });
    this._viewportRectDirty = true;
    this._scheduleRulerDraw();
  },

  _clampScale(s) {
    return Math.max(0.6, Math.min(12, s));
  },

  _clampTranslate(x, y, s) {
    const size = this.data.boardSize;
    const scaled = size * s;
    const min = size - scaled;
    const margin = 160;
    const minX = Math.min(0, min) - margin;
    const maxX = margin;
    const minY = Math.min(0, min) - margin;
    const maxY = margin;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y))
    };
  },

  _resizeCanvas() {
    const canvas = this._canvas;
    const ctx = this._ctx;
    if (!canvas || !ctx) return;

    const size = this.data.boardSize;
    const dpr = this._dpr || 1;

    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    if (typeof ctx.resetTransform === 'function') ctx.resetTransform();
    else if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.scale(dpr, dpr);
  },

  _processImageToMosaic(src) {
    if (!this._pixelCanvas || !this._pixelCtx) {
      console.error('Canvas未初始化，尝试重新初始化');
      return new Promise((resolve) => {
        this._initProcessCanvas(() => {
          if (!this._pixelCanvas || !this._pixelCtx) {
            console.error('Canvas初始化失败');
            resolve(false);
          } else {
            this._processImageToMosaic(src).then(resolve);
          }
        });
      });
    }
    const canvas = this._pixelCanvas;
    const ctx = this._pixelCtx;
    const size = Math.max(16, Math.min(128, this.data.gridSize));

    console.log('开始处理图片:', src, '目标尺寸:', size);

    return new Promise((resolve) => {
      const start = (path) => {
        const img = canvas.createImage();
        img.src = path;
        img.onload = () => {
          console.log('图片加载成功:', img.width, img.height);
          const maxSide = Math.max(1, img.width || 1, img.height || 1);
          const maxSample = Math.min(1024, maxSide);
          let scale = 8;
          while (scale > 2 && size * scale > maxSample) scale--;
          const sampleSide = Math.max(size, size * Math.max(2, scale));

          console.log('采样尺寸:', sampleSide);

          canvas.width = sampleSide;
          canvas.height = sampleSide;
          const mode = String(this.data.sampleMode || 'auto');
          
          try {
            ctx.imageSmoothingEnabled = mode === 'photo' || mode === 'auto';
            if ((mode === 'photo' || mode === 'auto') && 'imageSmoothingQuality' in ctx) {
              ctx.imageSmoothingQuality = 'high';
            }
          } catch (e) {
            console.warn('设置imageSmoothingEnabled失败:', e);
          }

          ctx.clearRect(0, 0, sampleSide, sampleSide);

          const aspect = img.width / img.height;
          let w, h, dx, dy;
          if (aspect > 1) {
            w = sampleSide;
            h = w / aspect;
            dx = 0;
            dy = (sampleSide - h) / 2;
          } else {
            h = sampleSide;
            w = h * aspect;
            dx = (sampleSide - w) / 2;
            dy = 0;
          }
          ctx.drawImage(img, dx, dy, w, h);

          let imageData;
          try {
            imageData = ctx.getImageData(0, 0, sampleSide, sampleSide);
          } catch (e) {
            console.error('getImageData失败:', e);
            resolve(false);
            return;
          }

          this._sampleData = imageData.data;
          this._sampleSide = sampleSide;
          this._gridSrcCols = size;
          this._gridSrcRows = size;

          let autoPixel = false;
          if (mode === 'auto') {
            autoPixel = this._guessIsPixelArt(this._sampleData, sampleSide, sampleSide);
            if (autoPixel) {
              console.log('自动检测为像素图');
              ctx.imageSmoothingEnabled = false;
              ctx.clearRect(0, 0, sampleSide, sampleSide);
              ctx.drawImage(img, dx, dy, w, h);
              try {
                const sample2 = ctx.getImageData(0, 0, sampleSide, sampleSide);
                this._sampleData = sample2.data;
              } catch (e) {}
            }
          }

          const isPixelArt = mode === 'pixel' || autoPixel;
          this._isPixelArt = isPixelArt;
          const down = isPixelArt ? pixelate.downsampleNearestRGBA : pixelate.downsampleBoxRGBA;
          
          try {
            this._gridSrcData = isPixelArt
              ? down(this._sampleData, sampleSide, sampleSide, size, size)
              : down(this._sampleData, sampleSide, sampleSide, size, size, 0.08);
          } catch (e) {
            console.error('下采样失败:', e);
            resolve(false);
            return;
          }

          this._gridBaseData = this._gridSrcData;

          try {
            const detail = Math.max(0, Math.min(1, (this.data.detailValue || 0) / 100));
            const detailed = detail > 0 ? pixelate.applyUnsharpMaskRGBA(this._gridBaseData, size, size, detail) : this._gridBaseData;
            const strength = Math.max(0, Math.min(1, (this.data.ditherValue || 0) / 100));
            const dithered = strength > 0 ? pixelate.applyOrderedDitherRGBA(detailed, size, size, strength) : detailed;

            this._ensurePaletteReady();
            this._pixelData = this._mapPixelsToPalette(dithered);
            this._pixelCols = size;
            this._pixelRows = size;

            if (!isPixelArt) {
              this._pixelData = this._denoisePixelData(this._pixelData, size, size);
              this._pixelData = this._snapOutlines(this._pixelData, size, size);
            }

            this._pixelHexes = this._buildPixelHexes(this._pixelData, size, size);
            this._recomputeStats();
            this._drawBoard();
            this._drawRulers();
            this.setData({ canEnterBeadMode: true });
            resolve(true);
          } catch (e) {
             console.error('图像处理/绘制失败:', e);
             resolve(false);
          }
        };
        img.onerror = (err) => {
          console.error('图片加载失败:', err);
          resolve(false);
        };
      };

      const raw = String(src || '');
      if (/^https?:\/\//i.test(raw)) {
        wx.getImageInfo({
          src: raw,
          success: (res) => start(res && res.path ? res.path : raw),
          fail: (err) => {
            console.error('getImageInfo失败:', err);
            start(raw);
          }
        });
        return;
      }
      start(raw);
    });
  },

  _ensurePaletteReady() {
    if (this._palette && this._paletteByHex && this._nearestCache && this._brandCodeByHex && this._paletteNeutral) return;
    const mapping = require('../../../data/color-mapping.js');
    
    const palette = [];
    const paletteNeutral = [];
    const paletteByHex = new Map();
    const brandCodeByHex = {
      MARD: new Map(),
      COCO: new Map(),
      '漫漫': new Map(),
      '盼盼': new Map(),
      '咪小窝': new Map()
    };
    const keys = Object.keys(mapping || {});
    for (let i = 0; i < keys.length; i++) {
      const hex = String(keys[i] || '').toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(hex)) continue;
      const rgb = this._hexToRgb(hex);
      const hsl = this._rgbToHsl(rgb.r, rgb.g, rgb.b);
      const lab = this._rgbToLab(rgb.r, rgb.g, rgb.b);
      const item = { hex, r: rgb.r, g: rgb.g, b: rgb.b, hslS: hsl.s, labL: lab.l, labA: lab.a, labB: lab.b };
      palette.push(item);
      if (hsl.s < 0.12) paletteNeutral.push(item);
      paletteByHex.set(hex, item);
      const entry = mapping[hex] || mapping[String(hex || '').toUpperCase()] || mapping[String(hex || '').toLowerCase()];
      if (entry) {
        if (entry.MARD != null) brandCodeByHex.MARD.set(hex, String(entry.MARD));
        if (entry.COCO != null) brandCodeByHex.COCO.set(hex, String(entry.COCO));
        if (entry['漫漫'] != null) brandCodeByHex['漫漫'].set(hex, String(entry['漫漫']));
        if (entry['盼盼'] != null) brandCodeByHex['盼盼'].set(hex, String(entry['盼盼']));
        if (entry['咪小窝'] != null) brandCodeByHex['咪小窝'].set(hex, String(entry['咪小窝']));
      }
    }

    this._mapping = mapping;
    this._palette = palette;
    this._paletteNeutral = paletteNeutral;
    this._paletteKeys = keys;
    this._paletteRGB = palette.map(p => ({ r: p.r, g: p.g, b: p.b })); // Keep for backward compatibility if needed, but we use palette objects now
    this._paletteByHex = paletteByHex;
    this._nearestCache = new Map();
    this._brandCodeByHex = brandCodeByHex;
    this._paletteBlack = paletteNeutral.reduce((best, cur) => {
      if (!best) return cur;
      return cur.labL < best.labL ? cur : best;
    }, null) || palette.reduce((best, cur) => {
      if (!best) return cur;
      return cur.labL < best.labL ? cur : best;
    }, null);
  },

  _mapPixelsToPalette(srcData) {
    const palette = this._palette || [];
    const paletteNeutral = this._paletteNeutral || [];
    const paletteByHex = this._paletteByHex;
    if (!srcData || !palette.length || !paletteByHex) return srcData;

    let out;
    try {
      out = new Uint8ClampedArray(srcData.length);
    } catch (e) {
      out = new Array(srcData.length);
    }
    const cache = this._nearestCache || new Map();

    for (let i = 0; i < srcData.length; i += 4) {
      const a = srcData[i + 3];
      if (a === 0) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0;
        continue;
      }

      const r = srcData[i];
      const g = srcData[i + 1];
      const b = srcData[i + 2];
      const hex = this._rgbToHex(r, g, b);
      const exact = paletteByHex.get(hex);
      if (exact) {
        out[i] = exact.r;
        out[i + 1] = exact.g;
        out[i + 2] = exact.b;
        out[i + 3] = a;
        continue;
      }

      const key = ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
      const cached = cache.get(key);
      if (cached) {
        out[i] = cached.r;
        out[i + 1] = cached.g;
        out[i + 2] = cached.b;
        out[i + 3] = a;
        continue;
      }

      const sat = this._rgbSaturation(r, g, b);
      const candidates = sat < 0.12 && paletteNeutral.length ? paletteNeutral : palette;
      const lab = this._rgbToLab(r, g, b);

      let best = candidates[0] || palette[0];
      let bestD = Infinity;
      for (let p = 0; p < candidates.length; p++) {
        const dl = lab.l - candidates[p].labL;
        const da = lab.a - candidates[p].labA;
        const db = lab.b - candidates[p].labB;
        const d = dl * dl + da * da + db * db;
        if (d < bestD) {
          bestD = d;
          best = candidates[p];
          if (d === 0) break;
        }
      }

      cache.set(key, best);
      out[i] = best.r;
      out[i + 1] = best.g;
      out[i + 2] = best.b;
      out[i + 3] = a;
    }

    this._nearestCache = cache;
    return out;
  },

  _buildPixelHexes(mapped, cols, rows) {
    const out = new Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      const idx = i * 4;
      const a = mapped[idx + 3];
      if (a === 0) {
        out[i] = '';
        continue;
      }
      const r = mapped[idx];
      const g = mapped[idx + 1];
      const b = mapped[idx + 2];
      out[i] = this._rgbToHex(r, g, b);
    }
    return out;
  },

  _rgbToHex(r, g, b) {
    return (
      '#' +
      [r, g, b]
        .map((v) => {
          const s = v.toString(16).toUpperCase();
          return s.length === 1 ? '0' + s : s;
        })
        .join('')
    );
  },

  _parseCode(raw) {
    const s = String(raw || '').trim();
    if (!s || s === '-') return { raw: s, empty: true, prefix: '', num: Infinity, isNum: false };
    if (/^\d+$/.test(s)) return { raw: s, empty: false, prefix: '', num: parseInt(s, 10), isNum: true };
    const m = s.match(/^([A-Za-z]+)?(\d+)?/);
    const prefix = (m && m[1]) ? m[1].toUpperCase() : '';
    const num = (m && m[2]) ? parseInt(m[2], 10) : Infinity;
    return { raw: s, empty: false, prefix, num, isNum: false };
  },

  _compareCodes(a, b) {
    const pa = this._parseCode(a);
    const pb = this._parseCode(b);
    if (pa.empty && pb.empty) return 0;
    if (pa.empty) return 1;
    if (pb.empty) return -1;
    if (pa.isNum && pb.isNum) return pa.num - pb.num;
    if (pa.isNum !== pb.isNum) return pa.isNum ? 1 : -1;
    if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix, 'en', { sensitivity: 'base' });
    if (pa.num !== pb.num) return pa.num - pb.num;
    return pa.raw.localeCompare(pb.raw, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
  },

  _sortStatsList(list) {
    const sort = this.data.statsSort;
    if (sort === 'code') {
      list.sort((a, b) => {
        const d = this._compareCodes(a.code, b.code);
        if (d !== 0) return d;
        return b.count - a.count;
      });
      return;
    }
    list.sort((a, b) => b.count - a.count);
  },

  _recomputeStats() {
    const hexes = this._pixelHexes;
    const mapping = this._mapping;
    const brand = this.data.selectedBrand;
    if (!hexes || !mapping || !brand) {
      this.setData({ statsTotalBeads: 0, statsTotalColors: 0, statsList: [] });
      return;
    }

    const countByHex = new Map();
    for (let i = 0; i < hexes.length; i++) {
      const hex = hexes[i];
      if (!hex) continue;
      countByHex.set(hex, (countByHex.get(hex) || 0) + 1);
    }

    const list = [];
    let total = 0;
    countByHex.forEach((count, hex) => {
      total += count;
      const codes = mapping[hex] || {};
      const code = codes[brand] || '-';
      list.push({ key: `${hex}-${code}`, hex, code, count });
    });

    this._sortStatsList(list);
    this.setData({ statsTotalBeads: total, statsTotalColors: list.length, statsList: list });
  },

  _ellipsizeText(ctx, text, maxWidth) {
    const s = String(text == null ? '' : text);
    if (!s) return s;
    if (ctx.measureText(s).width <= maxWidth) return s;
    const ell = '…';
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const t = s.slice(0, mid) + ell;
      if (ctx.measureText(t).width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return s.slice(0, Math.max(0, lo)) + ell;
  },

  _drawBrandCodes(ctx, cols, rows, drawW, drawH) {
    if (!this.data.showCellCodes) return;
    const brand = this.data.selectedBrand;
    if (!brand) return;
    const codeMap = this._brandCodeByHex && this._brandCodeByHex[brand];
    if (!codeMap) return;

    const cellW = drawW / Math.max(1, cols);
    const cellH = drawH / Math.max(1, rows);
    const baseCell = Math.min(cellW, cellH);
    if (baseCell < 10) return; // Only draw if cell is large enough

    const data = this._pixelData;
    const hexes = this._pixelHexes;
    if (!data || !hexes || hexes.length !== cols * rows) return;

    const fontSize = Math.max(8, Math.floor(baseCell * 0.32));
    const font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;

    const measureCache = new Map();
    const maxW = baseCell * 0.9;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const hex = hexes[i];
        if (!hex) continue;
        const code = codeMap.get(hex);
        if (!code) continue;

        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const textIsLight = lum < 140;
        const fill = textIsLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';

        const text = String(code);
        let measuredW = measureCache.get(text);
        if (measuredW == null) {
          measuredW = ctx.measureText(text).width;
          measureCache.set(text, measuredW);
        }

        const cx = (x + 0.5) * cellW;
        const cy = (y + 0.5) * cellH;

        if (measuredW > maxW) {
           // Skip if too wide to avoid clutter
           continue;
        }

        ctx.fillStyle = fill;
        ctx.fillText(text, cx, cy);
      }
    }
  },

  _drawBoard() {
    const ctx = this._ctx;
    if (!ctx) return;

    const size = this.data.boardSize;
    const grid = Math.max(16, Math.min(128, this.data.gridSize));
    const cell = size / grid;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const hexes = this._pixelHexes;
    if (hexes && hexes.length === grid * grid) {
      if (typeof ctx.imageSmoothingEnabled === 'boolean') ctx.imageSmoothingEnabled = false;
      const xs = new Array(grid + 1);
      const ys = new Array(grid + 1);
      for (let i = 0; i <= grid; i++) {
        xs[i] = Math.round(i * cell);
        ys[i] = Math.round(i * cell);
      }
      for (let y = 0; y < grid; y++) {
        for (let x = 0; x < grid; x++) {
          const hex = hexes[y * grid + x];
          if (!hex) continue;
          ctx.fillStyle = hex;
          const x0 = xs[x];
          const x1 = xs[x + 1];
          const y0 = ys[y];
          const y1 = ys[y + 1];
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

    if (this.data.showGrid) {
      const auxStep = this.data.auxGridOptions[this.data.auxGridIndex];
      
      for (let i = 1; i < grid; i++) {
        const p = i * cell;
        ctx.beginPath();
        if (auxStep > 0 && i % auxStep === 0) {
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1.5;
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
        }
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();
      }
    }

    // Draw Cell Codes
    this._drawBrandCodes(ctx, grid, grid, size, size);

    // Draw Holes (only if no codes and grid is sparse enough)
    const drawHoles = this.data.showGrid && !this.data.showCellCodes && grid <= 64 && cell >= 8;
    if (drawHoles) {
        const r = Math.max(2, Math.min(cell * 0.32, 7));
        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = Math.max(1, Math.min(1.6, cell * 0.08));
        ctx.beginPath();
        for (let y = 0; y < grid; y++) {
          const cy = (y + 0.5) * cell;
          for (let x = 0; x < grid; x++) {
            const cx = (x + 0.5) * cell;
            ctx.moveTo(cx + r, cy);
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
          }
        }
        ctx.stroke();
    }
    
    this._drawRulers();
  }
});
