let colorMapping = null;
const app = getApp();
const pixelate = require('../../utils/pixelate.js');
const colorData = require('../../data/color-data.js');
const colorMatching = require('../../utils/color-matching.js');
const KEY_CUSTOM_BRANDS = 'custom_brands_v1';

Page({
  data: {
    imageUrl: '',
    gridSize: 64, // Default grid size
    presetKey: 'auto',
    showAdvanced: false,
    ditherValue: 15,
    detailValue: 30,
    sampleMode: 'auto',
    processWidth: 64,
    processHeight: 64,
    displayW: 300,
    displayH: 300,
    isGenerated: false,
    generatedImagePath: '',
    showGrid: false,
    showRuler: false,
    auxGridIndex: 0, // 0: Off, 1: 5x5, 2: 10x10
    auxGridOptions: [0, 5, 10],
    selectedBrand: 'MARD',
    brandOptions: [
      { key: '', label: '空' }
    ],
    brandSeriesOptions: [],
    selectedBrandSeries: '',
    showCellCodes: false,
    statsSortMode: 'count',
    statsTotalBeads: 0,
    statsTotalColors: 0,
    statsList: [],
    exportW: 0,
    exportH: 0,
    isSaving: false
  },

  onLoad(options) {
    try {
      console.log('onLoad started', options);
      this._viewState = { scale: 1, tx: 0, ty: 0 };
      this._gesture = null;
      this._renderQueued = false;
      this._exportTimer = null;
      this._renderInfo = null;
      this._statsRawList = [];
      this._palette = null;
      this._paletteByHex = null;
      this._nearestCache = null;
      this._brandStatsRaw = null;
      this._hexStatsRaw = null;
      this._brandCodeByHex = null;
      this._pixelHexes = null;
      this._gridSrcData = null;
      this._gridSrcCols = null;
      this._gridSrcRows = null;
      this._gridBaseData = null;
      this._sampleData = null;
      this._sampleSide = null;
      this._isPixelArt = false;
      // 万能算法需要的变量
      this._origImgWidth = 0;
      this._origImgHeight = 0;
      this._origAspectRatio = 1;
      this._sampleImgW = 0;
      this._sampleImgH = 0;
      this._sampleImgDx = 0;
      this._sampleImgDy = 0;

      // Debug imports
      if (!colorData) console.error('colorData is missing');
      else console.log('colorData loaded, keys:', Object.keys(colorData));
      
      if (!pixelate) console.error('pixelate is missing');
      else console.log('pixelate loaded, keys:', Object.keys(pixelate));

      this._initBrandOptions();

      const aiPreset = app && app.globalData ? app.globalData.aiGeneratePreset : null;
      if (aiPreset && app && app.globalData) {
        app.globalData.aiGeneratePreset = null;
        const autoStart = !!aiPreset.autoStart;
        const presetKey = aiPreset.presetKey || this.data.presetKey;
        const gridSize = aiPreset.gridSize || this.data.gridSize;
        const defaults = this._defaultsForPreset(presetKey, gridSize);
        const ditherValue = typeof aiPreset.ditherValue === 'number' ? aiPreset.ditherValue : defaults.ditherValue;
        const detailValue = typeof aiPreset.detailValue === 'number' ? aiPreset.detailValue : defaults.detailValue;
        const sampleMode = aiPreset.sampleMode || defaults.sampleMode;
        this.setData({ presetKey, gridSize, ditherValue, detailValue, sampleMode, _autoStart: autoStart });
      }

      const importPath = app && app.globalData ? app.globalData.importImageUrl : '';
      if (importPath) {
        if (app && app.globalData) {
          app.globalData.importImageUrl = '';
        }
        this.setData({
          imageUrl: importPath,
          isGenerated: false,
          generatedImagePath: ''
        }, () => {
          if (this.data._autoStart) {
            this.setData({ _autoStart: false }, () => {
              if (typeof this.onGenerate === 'function') {
                this.onGenerate();
              } else {
                console.error('onGenerate is not a function');
              }
            });
          }
        });
      }
    } catch (err) {
      console.error('onLoad Error:', err);
      wx.showModal({
        title: '初始化失败',
        content: String(err),
        showCancel: false
      });
    }
  },

  onShow() {
    this._initBrandOptions();
  },

  _getBrandEntries() {
    const standard = [];
    const colorDataKeys = Object.keys(colorData || {});
    colorDataKeys.forEach(key => {
      const b = colorData[key];
      if (b) {
        standard.push({
          id: b.id || key,
          name: this._getBrandDisplayName(key),
          subSeries: b.subSeries || []
        });
      }
    });
    const custom = wx.getStorageSync(KEY_CUSTOM_BRANDS) || [];
    const merged = [...standard];
    custom.forEach(cb => {
      if (!merged.some(b => b.id === cb.id)) {
        merged.push(cb);
      } else {
        const index = merged.findIndex(b => b.id === cb.id);
        if (index >= 0) merged[index] = { ...merged[index], ...cb };
      }
    });
    return merged;
  },

  _getBrandDisplayName(brandKey) {
    const brandNames = {
      'mard': 'MARD',
      'coco': 'COCO',
      'manman': '漫漫',
      'panpan': '盼盼',
      'mixiaowo': '咪小窝',
      'hdds': 'H.D.D.S',
      'dodo': 'DODO',
      'xiaowu': '小窝',
      'kaka': 'KAKA',
      'youken': '优肯',
      'shishi': '诗诗',
      'tongqu': '童趣'
    };
    return brandNames[brandKey.toLowerCase()] || brandKey;
  },

  _initBrandOptions() {
    try {
      const entries = this._getBrandEntries();
      const options = [{ key: '', label: '空' }];
      // 手动添加完整的品牌选项
      const brandOptions = [
        { key: 'MARD', label: 'MARD' },
        { key: 'COCO', label: 'COCO' },
        { key: '漫漫', label: '漫漫' },
        { key: '盼盼', label: '盼盼' },
        { key: '咪小窝', label: '咪小窝' },
        { key: 'H.D.D.S', label: 'H.D.D.S' },
        { key: 'DODO', label: 'DODO' },
        { key: '小窝', label: '小窝' },
        { key: 'KAKA', label: 'KAKA' },
        { key: '优肯', label: '优肯' },
        { key: '诗诗', label: '诗诗' },
        { key: '童趣', label: '童趣' }
      ];
      options.push(...brandOptions);
      const current = this.data.selectedBrand;
      const valid = options.some(o => o.key === current);
      // 默认选择 MARD 品牌
      let nextSelected = 'MARD';
      if (valid) {
        nextSelected = current;
      } else if (!options.some(o => o.key === nextSelected)) {
        nextSelected = options[1] ? options[1].key : '';
      }
      this._brandEntries = entries;
      this._invalidatePaletteCache();
      this.setData(
        {
          brandOptions: options,
          selectedBrand: nextSelected
        },
        () => {
          try {
            this._updateBrandSeriesOptions(nextSelected);
            if (this.data.isGenerated) {
              if (this.data.imageUrl) {
                if (this._gridBaseData && this._gridSrcCols && this._gridSrcRows) {
                  this._rebuildFromGridSrc();
                } else {
                  // Only show loading if we are about to process
                  // wx.showLoading({ title: '正在生成...' }); 
                  // this.processImage(this.data.imageUrl);
                  // Defer processImage to avoid blocking UI or multiple calls
                }
              } else {
                this._applyBrandStats();
                this.redrawCanvas({ exportNow: false });
                this._scheduleExport();
              }
            }
          } catch (e) {
            console.error('_initBrandOptions callback error', e);
          }
        }
      );
    } catch (err) {
      console.error('_initBrandOptions error', err);
    }
  },

  _getBrandSeriesOptions(brandName) {
    const entries = this._brandEntries || this._getBrandEntries();
    // 查找品牌时不区分大小写
    const target = entries.find(b => b.name.toLowerCase() === brandName.toLowerCase());
    if (!target || !target.subSeries) return [];
    return target.subSeries.map(s => ({ key: s.id, label: s.name }));
  },

  _updateBrandSeriesOptions(brandName) {
    const options = brandName ? this._getBrandSeriesOptions(brandName) : [];
    const current = this.data.selectedBrandSeries;
    const valid = options.some(o => o.key === current);
    let nextSelected = valid ? current : (options[0] ? options[0].key : '');
    // 默认选择 MARD221 系列（兼容不同大小写）
    const normalizedBrandName = brandName.toLowerCase();
    if (normalizedBrandName === 'mard' && options.length > 0) {
      // 查找 MARD221 或 221 系列
      const mard221Option = options.find(o => 
        o.key.toLowerCase() === 'mard221' || 
        o.label.toLowerCase() === '221' ||
        o.label.toLowerCase() === 'mard-221'
      );
      if (mard221Option) {
        nextSelected = mard221Option.key;
      }
    }
    this.setData({
      brandSeriesOptions: options,
      selectedBrandSeries: nextSelected
    });
  },

  _invalidatePaletteCache() {
    this._palette = null;
    this._paletteNeutral = null;
    this._paletteByHex = null;
    this._nearestCache = null;
    this._brandCodeByHex = null;
    this._paletteBlack = null;
    this._paletteKey = '';
  },

  _getPaletteKey() {
    const brand = String(this.data.selectedBrand || '');
    const series = String(this.data.selectedBrandSeries || 'ALL');
    return `${brand}::${series}`;
  },

  _getSelectedSeriesColors() {
    const brandName = this.data.selectedBrand;
    const seriesId = this.data.selectedBrandSeries;
    if (!brandName || !seriesId) return [];
    const entries = this._brandEntries || this._getBrandEntries();
    const target = entries.find(b => b.name === brandName);
    if (!target || !target.subSeries) return [];
    const series = target.subSeries.find(s => s.id === seriesId);
    if (!series) return [];
    if (series.colors && series.colors.length) return series.colors;
    if (series.groups && series.groups.length) {
      return series.groups.reduce((acc, g) => {
        if (g.colors && g.colors.length) acc.push(...g.colors);
        return acc;
      }, []);
    }
    return [];
  },

  _getPaletteHexes() {
    const colors = this._getSelectedSeriesColors();
    if (colors.length) {
      const set = new Set();
      colors.forEach(c => {
        const hex = String(c.hex || '').toUpperCase();
        if (/^#[0-9A-F]{6}$/.test(hex)) set.add(hex);
      });
      return Array.from(set);
    }
    return Object.keys(colorMapping || {});
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

  _defaultsForPreset(presetKey, gridSize) {
    const g = Math.max(16, Math.min(128, Number(gridSize) || 64));
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
    if (k === 'vibe') {
      return { sampleMode: 'auto', ditherValue: small ? 30 : 25, detailValue: mid ? 20 : 12 };
    }
    return { sampleMode: 'auto', ditherValue: small ? 14 : 10, detailValue: small ? 38 : 30 };
  },



  onGridSizeChange(e) {
    const v = parseInt(e.detail.value, 10);
    const gridSize = Math.max(16, Math.min(128, Number.isFinite(v) ? v : 64));
    const presetKey = this.data.presetKey;
    const next = { gridSize, processWidth: gridSize, processHeight: gridSize };
    if (presetKey && presetKey !== 'custom') {
      const d = this._defaultsForPreset(presetKey, gridSize);
      next.ditherValue = d.ditherValue;
      next.detailValue = d.detailValue;
      next.sampleMode = d.sampleMode;
    }
    this.setData(next, () => {
      if (this.data.isGenerated && this.data.imageUrl) {
        if (this._sampleData && this._sampleSide) {
          this._rebuildFromSample();
        } else {
          wx.showLoading({ title: '正在生成...' });
          this.processImage(this.data.imageUrl);
        }
      }
    });
  },
  
  onGridSizeChanging(e) {
    const v = parseInt(e.detail.value, 10);
    const gridSize = Math.max(16, Math.min(128, Number.isFinite(v) ? v : 64));
    this.setData({ gridSize });
  },

  // 生成后调整尺寸（保持宽高比）
  onProcessSizeChange(e) {
    try {
      const v = parseInt(e.detail.value, 10);
      const newWidth = Math.max(16, Math.min(128, Number.isFinite(v) ? v : 64));
      
      // ✅ 关键：根据宽高比计算高度
      const newHeight = Math.round(newWidth / this._origAspectRatio);
      
      // 确保高度在合理范围内
      const finalHeight = Math.max(16, Math.min(128, newHeight));
      
      console.log('调整尺寸:', {
        width: newWidth,
        height: finalHeight,
        aspectRatio: this._origAspectRatio
      });
      
      wx.showLoading({ title: '正在调整...' });
      
      // 更新尺寸并重新处理图片
      this.setData({
        processWidth: newWidth,
        processHeight: finalHeight
      }, () => {
        // 重新处理图片（会使用新的 processWidth）
        if (this.data.imageUrl) {
          this.processImage(this.data.imageUrl);
        }
      });
      
    } catch (err) {
      console.error('onProcessSizeChange error:', err);
      wx.hideLoading();
      wx.showToast({ title: '调整失败啦，再试一次吧～', icon: 'none' });
    }
  },

  onProcessSizeChanging(e) {
    const v = parseInt(e.detail.value, 10);
    const newWidth = Math.max(16, Math.min(128, Number.isFinite(v) ? v : 64));
    
    // ✅ 关键：实时更新，保持宽高比
    const newHeight = Math.round(newWidth / this._origAspectRatio);
    const finalHeight = Math.max(16, Math.min(128, newHeight));
    
    // 只更新显示，不重新生成
    this.setData({ 
      processWidth: newWidth,
      processHeight: finalHeight
    });
  },

  _rebuildFromGridSrc() {
    const cols = this._gridSrcCols;
    const rows = this._gridSrcRows;
    const src = this._gridBaseData || this._gridSrcData;
    if (!cols || !rows || !src) return;

    try {
      const detail = Math.max(0, Math.min(1, (this.data.detailValue || 0) / 100));
      const strength = Math.max(0, Math.min(1, (this.data.ditherValue || 0) / 100));
      const base = (!this._isPixelArt && src === this._gridSrcData && strength > 0.15) ? pixelate.applyMedianFilterRGBA(src, cols, rows, 1) : src;
      const detailed = detail > 0 ? pixelate.applyUnsharpMaskRGBA(base, cols, rows, detail) : base;
      const dithered = strength > 0 ? pixelate.applyOrderedDitherRGBA(detailed, cols, rows, strength) : detailed;
      this._ensurePaletteReady();
      this._pixelData = this._mapPixelsToPalette(dithered);
      this._pixelCols = cols;
      this._pixelRows = rows;
      if (!this._isPixelArt) {
        this._pixelData = this._denoisePixelData(this._pixelData, cols, rows);
        this._pixelData = this._snapOutlines(this._pixelData, cols, rows);
      }
      this._pixelHexes = this._buildPixelHexes();
    } catch (e) {
      console.error('_rebuildFromGridSrc error', e);
      this._pixelData = null;
      this._pixelCols = null;
      this._pixelRows = null;
      this._pixelHexes = null;
      wx.showToast({ title: '生成失败啦，再试一次吧～', icon: 'none' });
    }

    this._computeStatsFromPixels();
    this.redrawCanvas({ exportNow: true });
    this._scheduleExport();
  },

  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          imageUrl: tempFilePath,
          isGenerated: false,
          generatedImagePath: ''
        });
        wx.showLoading({ title: '正在生成...' });
        this.processImage(tempFilePath);
      },
      fail: (err) => {
        console.error('chooseMedia failed', err);
      }
    });
  },

  onToggleGrid(e) {
    this.setData({ showGrid: e.detail.value }, () => {
        this.redrawCanvas({ exportNow: false });
        this._scheduleExport();
    });
  },

  onToggleRuler(e) {
    this.setData({ showRuler: e.detail.value }, () => {
        this.redrawCanvas({ exportNow: false });
        this._scheduleExport();
    });
  },

  onSetAuxGrid(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({ auxGridIndex: index }, () => {
        this.redrawCanvas({ exportNow: false });
        this._scheduleExport();
    });
  },

  redrawCanvas(options = {}) {
    const exportNow = !!options.exportNow;
    if (!this.data.isGenerated) return;
    // 使用实际的像素尺寸，而不是固定的 processWidth/processHeight
    const actualWidth = this._pixelCols || this.data.processWidth;
    const actualHeight = this._pixelRows || this.data.processHeight;
    const query = wx.createSelectorQuery();
    query.select('#processCanvas').fields({ node: true }).exec((res) => {
      if (res[0]) {
        this.drawToDisplay(res[0].node, actualWidth, actualHeight, { exportNow });
      }
    });
  },

  onStatsSortChange(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== 'count' && mode !== 'code') return;
    if (mode === this.data.statsSortMode) return;
    this.setData({ statsSortMode: mode }, () => {
      this._applyBrandStats();
    });
  },

  onBrandTap(e) {
    const brand = e.currentTarget.dataset.brand;
    if (brand === undefined || brand === this.data.selectedBrand) return;
    
    // 如果选择的是"空"，则取消色号的选择
    const wasCellCodesOpen = this.data.showCellCodes;
    const showCellCodes = brand ? this.data.showCellCodes : false;
    
    this.setData({ 
      selectedBrand: brand,
      showCellCodes: showCellCodes
    }, () => {
      this._updateBrandSeriesOptions(brand);
      this._invalidatePaletteCache();
      if (this.data.isGenerated && this.data.imageUrl) {
        if ((this._gridBaseData || this._gridSrcData) && this._gridSrcCols && this._gridSrcRows) {
          this._rebuildFromGridSrc();
        } else {
          wx.showLoading({ title: '正在生成...' });
          this.processImage(this.data.imageUrl);
        }
      }
      this._applyBrandStats();
      this.redrawCanvas({ exportNow: false });
      this._scheduleExport();
      
      // 如果选择的是"空"且之前色号是开启的，提示用户
      if (!brand && wasCellCodesOpen) {
        wx.showToast({ title: '色号已关闭', icon: 'none' });
      }
    });
  },

  onBrandSeriesTap(e) {
    const series = e.currentTarget.dataset.series;
    if (!series || series === this.data.selectedBrandSeries) return;
    this.setData({ selectedBrandSeries: series }, () => {
      this._invalidatePaletteCache();
      if (this.data.isGenerated && this.data.imageUrl) {
        if ((this._gridBaseData || this._gridSrcData) && this._gridSrcCols && this._gridSrcRows) {
          this._rebuildFromGridSrc();
        } else {
          wx.showLoading({ title: '正在生成...' });
          this.processImage(this.data.imageUrl);
        }
      }
    });
  },

  onToggleGrid() {
    this.setData({ showGrid: !this.data.showGrid }, () => {
      this.redrawCanvas({ exportNow: false });
    });
  },

  onToggleRuler() {
    this.setData({ showRuler: !this.data.showRuler }, () => {
      this.redrawCanvas({ exportNow: false });
    });
  },

  onToggleCellCodes() {
    // 如果当前品牌是"空"，且用户想要打开色号，则提示
    if (!this.data.selectedBrand && !this.data.showCellCodes) {
      wx.showToast({ title: '选择品牌色卡后才能显示色号哦～', icon: 'none' });
      return;
    }
    // 如果当前品牌是"空"，且色号已经打开，则关闭色号（不提示）
    if (!this.data.selectedBrand && this.data.showCellCodes) {
      this.setData({ showCellCodes: false }, () => {
        this.redrawCanvas({ exportNow: false });
      });
      return;
    }
    this.setData({ showCellCodes: !this.data.showCellCodes }, () => {
      this.redrawCanvas({ exportNow: false });
    });
  },

  onSetAuxGrid(e) {
    const idx = parseInt(e.currentTarget.dataset.index || 0, 10);
    if (idx === this.data.auxGridIndex) return;
    this.setData({ auxGridIndex: idx }, () => {
      this.redrawCanvas({ exportNow: false });
    });
  },

  onCompareStart() {
    if (this.data.isGenerated && this.data.imageUrl) {
      if (typeof wx.vibrateShort === 'function') {
        wx.vibrateShort({ type: 'light' });
      }
      this.setData({ isComparing: true });
    }
  },

  onCompareEnd() {
    if (this.data.isComparing) {
      this.setData({ isComparing: false });
    }
  },

  onGoToBeadMode() {
    if (!this.data.isGenerated || !this._pixelHexes) {
      wx.showToast({ title: '请先生成拼豆图哦～', icon: 'none' });
      return;
    }
    
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.beadSession = {
        pixelHexes: this._pixelHexes,
        gridSize: this.data.gridSize,
        showGrid: this.data.showGrid,
        showRuler: this.data.showRuler,
        showCellCodes: this.data.showCellCodes,
        selectedBrand: this.data.selectedBrand,
        statsSort: this.data.statsSortMode,
        highlightBeads: true,
        highlightMode: 'dim',
        symmetryMode: 'off'
      };
      
      wx.navigateTo({
        url: '/pages/bead-mode/bead-mode',
        fail: (err) => {
          console.error('Navigate failed', err);
          wx.showToast({ title: '无法进入沉浸模式呢', icon: 'none' });
        }
      });
    }
  },

  onSaveImage() {
    if (this.data.isSaving) return;
    if (typeof wx.vibrateShort === 'function') {
      wx.vibrateShort({ type: 'light' });
    }
    this.setData({ isSaving: true }, async () => {
      wx.showLoading({ title: '正在生成高清图...' });
      try {
        const path = await this._exportResultWithStats();
        if (!path) {
          wx.hideLoading();
          wx.showToast({ title: '导出失败啦，再试一次吧～', icon: 'none' });
          this.setData({ isSaving: false });
          return;
        }
        wx.showLoading({ title: '正在保存到相册...' });
        const ok = await this._saveToAlbum(path);
        if (ok) {
          wx.showToast({ title: '已保存到相册啦！✨', icon: 'success' });
        }
      } finally {
        wx.hideLoading();
        this.setData({ isSaving: false });
      }
    });
  },



  _exportResultWithStats() {
    return new Promise((resolve) => {
      if (!this.data.isGenerated) {
        resolve('');
        return;
      }

      const cols = this._pixelCols;
      const rows = this._pixelRows;
      const pixelData = this._pixelData;
      if (!cols || !rows || !pixelData) {
        resolve(this.data.generatedImagePath || '');
        return;
      }

      const systemInfo = wx.getSystemInfoSync();
      const dpr = systemInfo.pixelRatio;
      const hdScale = 2;

      const baseW = this.data.displayW || (systemInfo.windowWidth - 80);
      const targetCell = 28;
      const grid = Math.max(cols, rows);
      // Increased maxExportW limits for better resolution
      const maxExportW = grid >= 96 ? 4000 : (grid >= 80 ? 3200 : (grid >= 64 ? 2400 : 2000));
      const dW = Math.min(maxExportW, Math.max(baseW, cols * targetCell));
      const items = (this.data.statsList || []).slice();
      const outerPad = 18;
      const gapY = 14;
      const contentW = dW - outerPad * 2;
      const mosaicW = contentW;
      const mosaicH = contentW;
      const rowH = 52;
      const colCount = contentW >= 760 ? 4 : (contentW >= 560 ? 3 : (contentW >= 420 ? 2 : 1));
      const rowsCount = Math.ceil(Math.max(1, items.length) / colCount);
      const headerH = 56;
      const listH = rowsCount * rowH;
      const statsH = 16 + headerH + listH + 16;
      const exportH = Math.round(outerPad + mosaicH + gapY + statsH + outerPad);

      this.setData({ exportW: dW, exportH }, () => {
        const run = () => {
          const query = wx.createSelectorQuery();
          query.select('#exportCanvas').fields({ node: true, size: true }).exec((res) => {
            if (!res[0]) {
              resolve('');
              return;
            }

            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');

            // Try 8K texture limit for modern devices
            const maxTexPx = 8192;
            let renderScale = dpr * hdScale;
            // Allow higher renderScale for better quality
            renderScale = Math.min(renderScale, maxTexPx / Math.max(1, dW), maxTexPx / Math.max(1, exportH));
            renderScale = Math.floor(Math.max(1, renderScale)); // Ensure integer scale for sharp pixels

            const wPx = Math.round(dW * renderScale);
            const hPx = Math.round(exportH * renderScale);
            canvas.width = wPx;
            canvas.height = hPx;
            if (typeof ctx.resetTransform === 'function') {
              ctx.resetTransform();
            } else if (typeof ctx.setTransform === 'function') {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            
            // Disable smoothing for sharp pixels
            ctx.imageSmoothingEnabled = false;
            
            ctx.scale(renderScale, renderScale);
            ctx.clearRect(0, 0, dW, exportH);
            ctx.fillStyle = '#F2F4F8';
            ctx.fillRect(0, 0, dW, exportH);

            const mosaicLeft = outerPad;
            const mosaicTop = outerPad;

            ctx.fillStyle = '#FFFFFF';
            this._fillRoundRect(ctx, mosaicLeft, mosaicTop, mosaicW, mosaicH, 18);
            this._renderCompositeMosaic(ctx, mosaicLeft, mosaicTop, mosaicW, mosaicH, cols, rows, renderScale);

            const statsLeft = outerPad;
            const statsTop = mosaicTop + mosaicH + gapY;
            this._renderStatsSection(ctx, statsLeft, statsTop, contentW, statsH, items, colCount, rowH, renderScale);

            wx.canvasToTempFilePath({
              canvas,
              width: wPx,
              height: hPx,
              destWidth: wPx,
              destHeight: hPx,
              fileType: 'png',
              quality: 1,
              success: (r) => resolve(r.tempFilePath),
              fail: () => {
                // Fallback to lower resolution if 8K fails
                let lowScale = Math.max(1, Math.min(2, 4096 / Math.max(1, dW), 4096 / Math.max(1, exportH)));
                lowScale = Math.floor(lowScale); // Ensure integer scale

                if (lowScale >= renderScale) {
                  resolve('');
                  return;
                }
                canvas.width = Math.round(dW * lowScale);
                canvas.height = Math.round(exportH * lowScale);
                if (typeof ctx.resetTransform === 'function') {
                  ctx.resetTransform();
                } else if (typeof ctx.setTransform === 'function') {
                  ctx.setTransform(1, 0, 0, 1, 0, 0);
                }
                
                // Disable smoothing for sharp pixels
                ctx.imageSmoothingEnabled = false;

                ctx.scale(lowScale, lowScale);
                ctx.clearRect(0, 0, dW, exportH);
                ctx.fillStyle = '#F2F4F8';
                ctx.fillRect(0, 0, dW, exportH);
                ctx.fillStyle = '#FFFFFF';
                this._fillRoundRect(ctx, mosaicLeft, mosaicTop, mosaicW, mosaicH, 18);
                this._renderCompositeMosaic(ctx, mosaicLeft, mosaicTop, mosaicW, mosaicH, cols, rows, lowScale);
                this._renderStatsSection(ctx, statsLeft, statsTop, contentW, statsH, items, colCount, rowH, lowScale);
                wx.canvasToTempFilePath({
                  canvas,
                  width: Math.round(dW * lowScale),
                  height: Math.round(exportH * lowScale),
                  destWidth: Math.round(dW * lowScale),
                  destHeight: Math.round(exportH * lowScale),
                  fileType: 'png',
                  quality: 1,
                  success: (r2) => resolve(r2.tempFilePath),
                  fail: () => resolve('')
                });
              }
            });
          });
        };

        if (typeof wx.nextTick === 'function') wx.nextTick(run);
        else setTimeout(run, 16);
      });
    });
  },

  _saveToAlbum(filePath) {
    return new Promise((resolve) => {
      const path = String(filePath || '');
      if (!path) {
        resolve(false);
        return;
      }

      const openPermission = () => {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存到相册',
          confirmText: '去设置',
          cancelText: '取消',
          success: (res) => {
            if (!res.confirm) {
              resolve(false);
              return;
            }
            wx.openSetting({
              success: () => resolve(false),
              fail: () => resolve(false)
            });
          }
        });
      };

      const doSave = () => {
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: () => resolve(true),
          fail: (err) => {
            const msg = String((err && err.errMsg) || '');
            if (msg.includes('auth') || msg.includes('authorize') || msg.includes('denied') || msg.includes('deny')) {
              openPermission();
              return;
            }
            wx.showToast({ title: '保存失败啦，再试一次吧～', icon: 'none' });
            resolve(false);
          }
        });
      };

      wx.getSetting({
        success: (res) => {
          const auth = res && res.authSetting ? res.authSetting['scope.writePhotosAlbum'] : undefined;
          if (auth === true) {
            doSave();
            return;
          }
          if (auth === false) {
            openPermission();
            return;
          }
          if (typeof wx.authorize !== 'function') {
            doSave();
            return;
          }
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => doSave(),
            fail: () => openPermission()
          });
        },
        fail: () => doSave()
      });
    });
  },

  async processImage(src) {
    try {
      if (!src) {
        console.error('processImage called with empty src');
        return;
      }
      console.log('processImage started', src);

      const timeoutId = setTimeout(() => {
        wx.hideLoading();
        wx.showToast({ title: '生成超时啦，请重试哦～', icon: 'none' });
      }, 30000);

      const query = wx.createSelectorQuery();
      query.select('#processCanvas').fields({ node: true, size: true }).exec(async (res) => {
        if (!res || !res[0]) {
          clearTimeout(timeoutId);
          wx.hideLoading();
          console.error('Canvas not found #processCanvas');
          wx.showToast({ title: '初始化画布失败啦', icon: 'none' });
          return;
        }
        
        try {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          const img = canvas.createImage();
          
          img.onload = () => {
            try {
              clearTimeout(timeoutId);
              
              // ✅ 关键：使用 processWidth 作为基准尺寸
              // 这样调整尺寸后，会使用用户设置的宽度
              const baseSize = this.data.processWidth || 64;
              
              console.log('使用基准尺寸:', baseSize);
              
              // 使用新算法处理图片
              this._processImageWithNewAlgorithm(canvas, ctx, img, baseSize);
            } catch (innerErr) {
              clearTimeout(timeoutId);
              wx.hideLoading();
              console.error('Image processing error:', innerErr);
              wx.showToast({ title: '图片处理出错啦', icon: 'none' });
            }
          };

          img.onerror = (err) => {
            clearTimeout(timeoutId);
            wx.hideLoading();
            wx.showToast({ title: '图片加载失败啦', icon: 'none' });
            console.error('Image load error:', err);
          };

          img.src = src;
        } catch (ctxErr) {
           clearTimeout(timeoutId);
           wx.hideLoading();
           console.error('Context error:', ctxErr);
        }
      });
    } catch (e) {
      console.error('processImage outer error', e);
      wx.hideLoading();
    }
  },

  _processImageWithNewAlgorithm(canvas, ctx, img, baseSize) {
    try {
      console.log('_processImageWithNewAlgorithm started', {
        imgWidth: img.width,
        imgHeight: img.height,
        baseSize: baseSize
      });
      
      // ✅ 关键：保存原始图片信息和宽高比
      this._origImgWidth = img.width;
      this._origImgHeight = img.height;
      this._origAspectRatio = img.width / Math.max(1, img.height);
      
      console.log('原图宽高比:', this._origAspectRatio);
      
      // 1. 计算输出尺寸（根据图片宽高比）
      const outputSize = colorMatching.calculateOutputSize(img.width, img.height, baseSize);
      console.log('outputSize:', outputSize);
      
      // 2. 绘制图片到 canvas 获取 imageData
      const maxSampleSide = 1024;
      const maxSide = Math.max(img.width, img.height);
      const scale = Math.min(1, maxSampleSide / maxSide);
      const sampleWidth = Math.round(img.width * scale);
      const sampleHeight = Math.round(img.height * scale);
      
      console.log('sample dimensions:', { sampleWidth, sampleHeight, scale });
      
      canvas.width = sampleWidth;
      canvas.height = sampleHeight;
      
      ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);
      const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
      
      console.log('imageData obtained:', imageData.width, imageData.height);
      
      // 3. 获取品牌调色板
      const paletteColors = this._getPaletteColorsForMatching();
      
      console.log('paletteColors:', paletteColors.length);
      
      if (paletteColors.length === 0) {
        wx.hideLoading();
        wx.showToast({ title: '请先选择品牌色卡哦～', icon: 'none' });
        return;
      }
      
      // 4. 使用新算法处理图片
      console.log('calling processImageToBeads...');
      const result = colorMatching.processImageToBeads(
        imageData.data,
        sampleWidth,
        sampleHeight,
        paletteColors,
        baseSize
      );
      
      console.log('processImageToBeads result:', result);
      
      // 5. 保存结果数据
      this._pixelCols = result.width;
      this._pixelRows = result.height;
      this._pixelData = this._buildPixelDataFromBeads(result.beads, result.width, result.height);
      this._pixelHexes = this._buildPixelHexesFromBeads(result.beads);
      this._isPixelArt = false;
      
      // 6. 更新显示尺寸
      const systemInfo = wx.getSystemInfoSync();
      const maxW = systemInfo.windowWidth - 80;
      
      this.setData({
        processWidth: result.width,
        processHeight: result.height,
        displayW: maxW,
        displayH: maxW,
        generatedImagePath: ''
      });
      
      // 7. 计算统计数据
      this._computeStatsFromPixels();
      
      // 8. 标记为已生成并重绘
      this.setData({ isGenerated: true }, () => {
        this.redrawCanvas({ exportNow: true });
        this._scheduleExport();
        wx.hideLoading();
      });
      
    } catch (err) {
      console.error('_processImageWithNewAlgorithm error:', err);
      wx.hideLoading();
      wx.showToast({ title: '生成失败啦，再试一次吧～', icon: 'none' });
    }
  },

  _getPaletteColorsForMatching() {
    const brandName = this.data.selectedBrand;
    const seriesId = this.data.selectedBrandSeries;
    
    if (!brandName) return [];
    
    const brandKey = this._getBrandKeyByName(brandName);
    if (!brandKey || !colorData[brandKey]) return [];
    
    const brand = colorData[brandKey];
    const colors = [];
    
    if (brand.subSeries) {
      for (const series of brand.subSeries) {
        // 如果指定了系列，只获取该系列的颜色
        if (seriesId && series.id !== seriesId) continue;
        
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
    }
    
    return colors;
  },

  _getBrandKeyByName(brandName) {
    const brandMap = {
      'MARD': 'mard',
      'COCO': 'coco',
      '漫漫': 'manman',
      '盼盼': 'panpan',
      '咪小窝': 'mixiaowo',
      'H.D.D.S': 'hdds',
      'DODO': 'dodo',
      '小窝': 'xiaowu',
      'KAKA': 'kaka',
      '优肯': 'youken',
      '诗诗': 'shishi',
      '童趣': 'tongqu'
    };
    return brandMap[brandName];
  },

  _buildPixelDataFromBeads(beads, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (const bead of beads) {
      const idx = (bead.y * width + bead.x) * 4;
      const rgb = colorMatching.hexToRgb(bead.color.hex);
      data[idx] = rgb.r;
      data[idx + 1] = rgb.g;
      data[idx + 2] = rgb.b;
      data[idx + 3] = 255;
    }
    return data;
  },

  _buildPixelHexesFromBeads(beads) {
    const hexes = new Array(beads.length);
    for (let i = 0; i < beads.length; i++) {
      hexes[i] = beads[i].color.hex;
    }
    return hexes;
  },

  _computeStatsFromPixels() {
    const data = this._pixelData;
    const cols = this._pixelCols;
    const rows = this._pixelRows;
    if (!data || !cols || !rows) {
      this._statsRawList = [];
      this._brandStatsRaw = null;
      this.setData({
        statsTotalBeads: 0,
        statsTotalColors: 0,
        statsList: []
      });
      return;
    }

    const map = new Map();
    let total = 0;
    for (let i = 0; i < cols * rows; i++) {
      const idx = i * 4;
      const a = data[idx + 3];
      if (a === 0) continue;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const hex = this._rgbToHex(r, g, b);
      map.set(hex, (map.get(hex) || 0) + 1);
      total++;
    }

    this._ensurePaletteReady();
    this._hexStatsRaw = Array.from(map.entries()).map(([hex, count]) => ({ key: hex, hex, code: hex, count }));

    const brands = this._getActiveBrandKeys();
    const brandMaps = {};
    for (let i = 0; i < brands.length; i++) {
      brandMaps[brands[i]] = new Map();
    }

    for (const [hex, count] of map.entries()) {
      for (let i = 0; i < brands.length; i++) {
        const brand = brands[i];
        const codeMap = this._brandCodeByHex && this._brandCodeByHex[brand];
        const code = codeMap ? (codeMap.get(hex) || '') : '';
        const key = code || hex;
        const m = brandMaps[brand];
        const prev = m.get(key);
        if (prev) {
          prev.count += count;
        } else {
          m.set(key, { key, hex, code: code || '-', count });
        }
      }
    }

    const brandStatsRaw = {};
    for (let i = 0; i < brands.length; i++) {
      const brand = brands[i];
      brandStatsRaw[brand] = Array.from(brandMaps[brand].values());
    }
    this._brandStatsRaw = brandStatsRaw;

    this.setData({ statsTotalBeads: total }, () => {
      this._applyBrandStats();
    });
  },

  _applyBrandStats() {
    const brand = this.data.selectedBrand;
    const mode = this.data.statsSortMode || 'count';
    const listSource = brand ? (this._brandStatsRaw && this._brandStatsRaw[brand]) : this._hexStatsRaw;
    const list = (listSource || []).slice();
    if (mode === 'count') {
      list.sort((a, b) => b.count - a.count || this._compareBrandCode(a, b) || a.hex.localeCompare(b.hex));
    } else {
      list.sort((a, b) => this._compareBrandCode(a, b) || b.count - a.count || a.hex.localeCompare(b.hex));
    }
    this.setData({
      statsList: list,
      statsTotalColors: list.length
    });
  },

  _compareBrandCode(a, b) {
    const pa = this._parseBrandCode(a && a.code);
    const pb = this._parseBrandCode(b && b.code);
    if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix);
    if (pa.num !== pb.num) return pa.num - pb.num;
    if (pa.tail !== pb.tail) return pa.tail.localeCompare(pb.tail);
    const ca = String((a && a.code) || '');
    const cb = String((b && b.code) || '');
    return ca.localeCompare(cb);
  },

  _parseBrandCode(code) {
    const raw = String(code || '').trim().toUpperCase();
    if (!raw || raw === '-') return { prefix: 'ZZZZ', num: 0, tail: '' };
    const m = raw.match(/^([A-Z]+)?(\d+)?(.*)$/);
    const prefix = (m && m[1]) ? m[1] : '';
    const num = (m && m[2]) ? parseInt(m[2], 10) : 0;
    const tail = (m && m[3]) ? m[3] : '';
    return { prefix, num: Number.isFinite(num) ? num : 0, tail };
  },

  _rgbToHex(r, g, b) {
    const to = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${to(r)}${to(g)}${to(b)}`;
  },

  _ensurePaletteReady() {
    const paletteKey = this._getPaletteKey();
    if (this._palette && this._paletteByHex && this._nearestCache && this._brandCodeByHex && this._paletteNeutral && this._paletteKey === paletteKey) return;
    if (!colorMapping) {
      colorMapping = require('../../data/color-mapping.js');
    }

    const brands = this._getActiveBrandKeys();
    const paletteHexes = this._getPaletteHexes();
    const palette = [];
    const paletteNeutral = [];
    const paletteByHex = new Map();
    const brandCodeByHex = {};
    brands.forEach(b => {
      brandCodeByHex[b] = new Map();
    });
    for (let i = 0; i < paletteHexes.length; i++) {
      const hex = String(paletteHexes[i] || '').toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(hex)) continue;
      const rgb = this._hexToRgb(hex);
      const hsl = this._rgbToHsl(rgb.r, rgb.g, rgb.b);
      const lab = this._rgbToLab(rgb.r, rgb.g, rgb.b);
      const item = { hex, r: rgb.r, g: rgb.g, b: rgb.b, hslS: hsl.s, labL: lab.l, labA: lab.a, labB: lab.b };
      palette.push(item);
      if (hsl.s < 0.12) paletteNeutral.push(item);
      paletteByHex.set(hex, item);
      const entry = colorMapping[hex] || colorMapping[String(hex || '').toUpperCase()] || colorMapping[String(hex || '').toLowerCase()];
      if (entry) {
        const mapKey = this._getMappingKeyByBrand();
        brands.forEach(brand => {
          const key = mapKey[brand];
          if (!key) return;
          if (entry[key] != null) {
            brandCodeByHex[brand].set(hex, String(entry[key]));
          }
        });
      }
    }

    const entries = this._brandEntries || this._getBrandEntries();
    entries.forEach(brand => {
      const brandName = brand.name;
      const map = brandCodeByHex[brandName];
      if (!map) return;
      const colors = this._collectBrandColors(brand);
      colors.forEach(c => {
        const hex = String(c.hex || '').toUpperCase();
        const code = String(c.code || '').trim();
        if (!hex || !code || map.has(hex)) return;
        map.set(hex, code);
      });
    });

    this._palette = palette;
    this._paletteNeutral = paletteNeutral;
    this._paletteByHex = paletteByHex;
    this._nearestCache = new Map();
    this._brandCodeByHex = brandCodeByHex;
    this._paletteKey = paletteKey;
    this._paletteBlack = paletteNeutral.reduce((best, cur) => {
      if (!best) return cur;
      return cur.labL < best.labL ? cur : best;
    }, null) || palette.reduce((best, cur) => {
      if (!best) return cur;
      return cur.labL < best.labL ? cur : best;
    }, null);
  },

  _getActiveBrandKeys() {
    const options = this.data.brandOptions || [];
    return options.map(o => o.key).filter(k => k);
  },

  _getMappingKeyByBrand() {
    return {
      Mard: 'MARD',
      MARD: 'MARD',
      CoCo: 'COCO',
      COCO: 'COCO',
      漫漫: '漫漫',
      盼盼: '盼盼',
      咪小窝: '咪小窝'
    };
  },

  _collectBrandColors(brand) {
    const out = [];
    const list = (brand && brand.subSeries) ? brand.subSeries : [];
    list.forEach(series => {
      if (series.colors && series.colors.length) {
        out.push(...series.colors);
      } else if (series.groups && series.groups.length) {
        series.groups.forEach(group => {
          if (group.colors && group.colors.length) {
            out.push(...group.colors);
          }
        });
      }
    });
    return out;
  },

  _buildPixelHexes() {
    const data = this._pixelData;
    const cols = this._pixelCols;
    const rows = this._pixelRows;
    if (!data || !cols || !rows) return null;
    const out = new Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      const idx = i * 4;
      const a = data[idx + 3];
      if (a === 0) {
        out[i] = '';
        continue;
      }
      out[i] = this._rgbToHex(data[idx], data[idx + 1], data[idx + 2]);
    }
    return out;
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

      // Standard LAB distance finding
      const lab = this._rgbToLab(r, g, b);
      let best = palette[0];
      let bestD = Infinity;

      for (let p = 0; p < palette.length; p++) {
        const item = palette[p];
        const dl = lab.l - item.labL;
        const da = lab.a - item.labA;
        const db = lab.b - item.labB;
        const d = dl * dl + da * da + db * db;
        
        if (d < bestD) {
          bestD = d;
          best = item;
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

  _hexToRgb(hex) {
    const s = hex.replace('#', '');
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return { r, g, b };
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
  
  drawToDisplay(sourceCanvas, w, h, options = {}) {
      const exportNow = options.exportNow !== false;
      const query = wx.createSelectorQuery();
      query.select('#displayCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res[0]) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          const systemInfo = wx.getSystemInfoSync();
          const dpr = systemInfo.pixelRatio;
          const hdScale = 2;
          
          // Use calculated display dimensions
          const dW = this.data.displayW;
          const dH = this.data.displayH;
          
          let renderScale = dpr * hdScale;
          const maxCanvasPx = 2600;
          renderScale = Math.min(renderScale, maxCanvasPx / Math.max(1, dW), maxCanvasPx / Math.max(1, dH));
          renderScale = Math.floor(Math.max(1, renderScale)); // Ensure integer scale

          canvas.width = Math.round(dW * renderScale);
          canvas.height = Math.round(dH * renderScale);
          if (typeof ctx.resetTransform === 'function') {
              ctx.resetTransform();
          } else if (typeof ctx.setTransform === 'function') {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
          }
          ctx.scale(renderScale, renderScale);
          ctx.clearRect(0, 0, dW, dH);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, dW, dH);
          
          // Disable smoothing for sharp pixels
          ctx.imageSmoothingEnabled = false;

          const cols = w;
          const rows = h;

          let offsetX = 0;
          let offsetY = 0;
          let drawW = dW;
          let drawH = dH;
          let rulerFontSize = 0;

          if (this.data.showRuler) {
              const cell = dW / Math.max(1, cols);
              rulerFontSize = Math.max(8, Math.min(14, Math.floor(cell * 0.55)));
              const pad = Math.ceil(rulerFontSize * 2.4);
              offsetX = pad;
              offsetY = pad;
              drawW = Math.max(1, dW - pad);
              drawH = Math.max(1, dH - pad);
          }

          const cellPx = Math.max(1, Math.floor(Math.min(drawW / Math.max(1, cols), drawH / Math.max(1, rows))));
          const snappedW = cellPx * cols;
          const snappedH = cellPx * rows;
          offsetX = Math.floor(offsetX + (drawW - snappedW) / 2);
          offsetY = Math.floor(offsetY + (drawH - snappedH) / 2);
          drawW = snappedW;
          drawH = snappedH;

          if (!this._viewState) {
            this._viewState = { scale: 1, tx: 0, ty: 0 };
          }

          const minScale = 1;
          const maxScale = 8;
          let scale = Math.max(minScale, Math.min(maxScale, this._viewState.scale || 1));
          let tx = this._viewState.tx || 0;
          let ty = this._viewState.ty || 0;

          const scaledW = drawW * scale;
          const scaledH = drawH * scale;
          const minTx = Math.min(0, drawW - scaledW);
          const minTy = Math.min(0, drawH - scaledH);
          const maxTx = 0;
          const maxTy = 0;
          tx = Math.max(minTx, Math.min(maxTx, tx));
          ty = Math.max(minTy, Math.min(maxTy, ty));
          this._viewState = { scale, tx, ty };

          this._renderInfo = { offsetX, offsetY, drawW, drawH, cols, rows };

          ctx.save();
          ctx.translate(offsetX + tx, offsetY + ty);
          ctx.scale(scale, scale);
          this._drawPixelated(ctx, cols, rows, drawW, drawH, sourceCanvas);
          if (this.data.showGrid) {
              this.drawGrid(ctx, drawW, drawH, cols, rows, 0, 0, renderScale * scale, scale);
          }
          this._drawBrandCodes(ctx, cols, rows, drawW, drawH, scale, renderScale, true);
          ctx.restore();

          if (this.data.showRuler) {
              this.drawRuler(ctx, drawW, drawH, cols, rows, offsetX, offsetY, rulerFontSize, tx, ty, scale, renderScale);
          }

          // Export for preview
          if (exportNow) {
            setTimeout(() => {
                wx.canvasToTempFilePath({
                    canvas: canvas,
                    fileType: 'png',
                    success: (res) => {
                        const path = res.tempFilePath;
                        this.setData({ generatedImagePath: path });

                        if (this._exportResolver) {
                          const resolver = this._exportResolver;
                          this._exportResolver = null;
                          resolver(path);
                        }
                    }
                });
            }, 80);
          }
      });
  },

  _renderCompositeMosaic(ctx, left, top, width, height, cols, rows, renderScale) {
    const showRuler = !!this.data.showRuler;

    let offsetX = left;
    let offsetY = top;
    let drawW = width;
    let drawH = height;
    let rulerFontSize = 0;

    if (showRuler) {
      const cell = width / Math.max(1, cols);
      rulerFontSize = Math.max(8, Math.min(14, Math.floor(cell * 0.55)));
      const pad = Math.ceil(rulerFontSize * 2.4);
      offsetX += pad;
      offsetY += pad;
      drawW = Math.max(1, width - pad);
      drawH = Math.max(1, height - pad);
    }

    const cellPx = Math.max(1, Math.floor(Math.min(drawW / Math.max(1, cols), drawH / Math.max(1, rows))));
    const snappedW = cellPx * cols;
    const snappedH = cellPx * rows;
    offsetX = Math.floor(offsetX + (drawW - snappedW) / 2);
    offsetY = Math.floor(offsetY + (drawH - snappedH) / 2);
    drawW = snappedW;
    drawH = snappedH;

    const scale = 1;
    const tx = 0;
    const ty = 0;

    ctx.save();
    ctx.translate(offsetX + tx, offsetY + ty);
    ctx.scale(scale, scale);
    this._drawPixelated(ctx, cols, rows, drawW, drawH);
    if (this.data.showGrid) {
      this.drawGrid(ctx, drawW, drawH, cols, rows, 0, 0, renderScale * scale, scale);
    }
    this._drawBrandCodes(ctx, cols, rows, drawW, drawH, scale, renderScale, true);
    ctx.restore();

    if (showRuler) {
      this.drawRuler(ctx, drawW, drawH, cols, rows, offsetX, offsetY, rulerFontSize, tx, ty, scale, renderScale);
    }
  },

  _renderStatsSection(ctx, left, top, width, height, list, colCount, rowH, renderScale) {
    const pad = 16;
    const headerH = 56;
    const innerLeft = left + pad;
    const innerTop = top + pad;
    const innerRight = left + width - pad;

    ctx.fillStyle = '#FFFFFF';
    this._fillRoundRect(ctx, left, top, width, height, 18);

    ctx.fillStyle = '#111114';
    ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const brand = String(this.data.selectedBrand || '');
    const series = String(this.data.selectedBrandSeries || '');
    
    // 显示品牌色卡信息
    let title = '颜色清单';
    if (brand) {
      title = `${brand} 用色清单`;
      if (series) {
        // 如果有系列信息，也显示出来
        title = `${brand}·${series} 用色清单`;
      }
    }
    ctx.fillText(title, innerLeft, innerTop + 12);

    ctx.fillStyle = '#6e6e73';
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial';
    ctx.textAlign = 'right';
    const summary = `${this.data.statsTotalColors} 色 / ${this.data.statsTotalBeads} 颗`;
    ctx.fillText(summary, innerRight, innerTop + 12);

    const listTop = innerTop + headerH;
    const colW = (width - pad * 2) / Math.max(1, colCount);
    const cellPadX = 12;
    const cellPadY = 10;
    const sw = 16;
    const gap = 10;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < list.length; i++) {
      const col = i % colCount;
      const row = Math.floor(i / colCount);
      const x = innerLeft + col * colW;
      const y = listTop + row * rowH;
      const cardX = x + 6;
      const cardY = y + 6;
      const cardW = colW - 12;
      const cardH = rowH - 12;
      const cy = cardY + cardH / 2;

      ctx.fillStyle = 'rgba(17,17,20,0.04)';
      this._fillRoundRect(ctx, cardX, cardY, cardW, cardH, 14);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 14, cardY + cardH);
      ctx.lineTo(cardX + cardW - 14, cardY + cardH);
      ctx.stroke();

      const swX = cardX + cellPadX;
      const swY = cy - sw / 2;
      ctx.fillStyle = list[i].hex;
      this._fillRoundRect(ctx, swX, swY, sw, sw, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(swX, swY, sw, sw);

      const countText = `${list[i].count}颗`;
      ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial';
      const countW = ctx.measureText(countText).width;
      const pillW = Math.max(44, countW + 16);
      const pillH = 22;
      const pillX = cardX + cardW - pillW - cellPadX;
      const pillY = cy - pillH / 2;
      ctx.fillStyle = 'rgba(17,17,20,0.08)';
      this._fillRoundRect(ctx, pillX, pillY, pillW, pillH, 999);
      ctx.fillStyle = '#111114';
      ctx.textAlign = 'center';
      ctx.fillText(countText, pillX + pillW / 2, cy + 0.5);
      ctx.textAlign = 'left';

      const label = list[i].code && list[i].code !== '-' ? String(list[i].code) : String(list[i].hex || '');
      const hexText = String(list[i].hex || '');
      const textX = swX + sw + gap;
      const maxLabelW = Math.max(10, pillX - textX - 8);

      ctx.fillStyle = '#111114';
      ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial';
      const labelText = this._ellipsizeText(ctx, label, maxLabelW);
      ctx.fillText(labelText, textX, cy - 7);

      ctx.fillStyle = '#6e6e73';
      ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial';
      const hexDraw = this._ellipsizeText(ctx, hexText, maxLabelW);
      ctx.fillText(hexDraw, textX, cy + 9);
    }
  },
  
  drawGrid(ctx, width, height, cols, rows, offsetX = 0, offsetY = 0, renderScale = 1, viewScale = 1) {
      
      const cellW = width / cols;
      const cellH = height / rows;
      const cell = Math.min(cellW, cellH);
      const baseLineWidth = Math.max(0.5, Math.min(1, cell * 0.06)) / Math.max(1, viewScale);
      const auxLineWidth = Math.max(1, Math.min(2, baseLineWidth * 2)) / Math.max(1, viewScale);
      
      const auxStep = this.data.auxGridOptions[this.data.auxGridIndex];
      const snap = (v) => Math.round(v * renderScale) / renderScale;

      // Vertical Lines
      for (let i = 0; i <= cols; i++) {
          ctx.beginPath();
          
          if (auxStep > 0 && i % auxStep === 0 && i > 0 && i < cols) {
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
              ctx.lineWidth = auxLineWidth;
          } else {
              ctx.strokeStyle = 'rgba(128, 128, 128, 0.65)';
              ctx.lineWidth = baseLineWidth;
          }

          const x = snap(offsetX + i * cellW);
          ctx.moveTo(x, offsetY);
          ctx.lineTo(x, offsetY + height);
          ctx.stroke();
      }
      
      // Horizontal Lines
      for (let j = 0; j <= rows; j++) {
          ctx.beginPath();

          if (auxStep > 0 && j % auxStep === 0 && j > 0 && j < rows) {
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
              ctx.lineWidth = auxLineWidth;
          } else {
              ctx.strokeStyle = 'rgba(128, 128, 128, 0.65)';
              ctx.lineWidth = baseLineWidth;
          }

          const y = snap(offsetY + j * cellH);
          ctx.moveTo(offsetX, y);
          ctx.lineTo(offsetX + width, y);
          ctx.stroke();
      }
  },

  drawRuler(ctx, width, height, cols, rows, offsetX, offsetY, fontSize, tx, ty, scale, renderScale) {
      const cellW = width / cols;
      const cellH = height / rows;
      const padX = offsetX;
      const padY = offsetY;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;

      const snap = (v) => Math.round(v * renderScale) / renderScale;
      const stepX = cellW * scale;
      const stepY = cellH * scale;

      const leftEdge = -tx;
      const topEdge = -ty;
      const startCol = Math.max(0, Math.floor(leftEdge / stepX));
      const endCol = Math.min(cols - 1, Math.ceil((leftEdge + width) / stepX) - 1);
      const startRow = Math.max(0, Math.floor(topEdge / stepY));
      const endRow = Math.min(rows - 1, Math.ceil((topEdge + height) / stepY) - 1);

      const pickStep = (need) => {
        const steps = [1, 2, 5, 10, 20, 25, 50, 100];
        for (let i = 0; i < steps.length; i++) {
          if (steps[i] >= need) return steps[i];
        }
        return steps[steps.length - 1];
      };

      const xDigits = String(Math.max(1, cols)).length;
      const yDigits = String(Math.max(1, rows)).length;
      const xNeed = Math.ceil((fontSize * (xDigits + 0.8)) / Math.max(1, stepX));
      const yNeed = Math.ceil((fontSize * (yDigits + 0.8)) / Math.max(1, stepY));
      const xStep = pickStep(Math.max(1, xNeed));
      const yStep = pickStep(Math.max(1, yNeed));

      // 优化：让数字更靠近格子
      const topY = padY * 0.65;
      
      // 优化：显示所有刻度，每格都显示数字
      for (let x = startCol; x <= endCol; x++) {
          const px = snap(padX + tx + (x + 0.5) * stepX);
          if (px < padX || px > padX + width) continue;
          
          // 交替颜色显示
          let textColor = 'rgba(0, 0, 0, 0.4)'; // 默认浅灰色
          let textFont = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;
          
          if (x % 10 === 0) {
            // 每 10 格：深色，加粗
            textColor = 'rgba(0, 0, 0, 0.9)';
            textFont = `600 ${fontSize + 1}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;
          } else if (x % 5 === 0) {
            // 每 5 格：中等深度
            textColor = 'rgba(0, 0, 0, 0.7)';
            textFont = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;
          }
          
          ctx.fillStyle = textColor;
          ctx.font = textFont;
          ctx.fillText(String(x + 1), px, topY);
      }

      // 优化：让数字更靠近格子
      const leftX = padX * 0.65;
      
      // 优化：显示所有刻度，每格都显示数字
      for (let y = startRow; y <= endRow; y++) {
          const py = snap(padY + ty + (y + 0.5) * stepY);
          if (py < padY || py > padY + height) continue;
          
          // 交替颜色显示
          let textColor = 'rgba(0, 0, 0, 0.4)'; // 默认浅灰色
          let textFont = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;
          
          if (y % 10 === 0) {
            // 每 10 格：深色，加粗
            textColor = 'rgba(0, 0, 0, 0.9)';
            textFont = `600 ${fontSize + 1}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;
          } else if (y % 5 === 0) {
            // 每 5 格：中等深度
            textColor = 'rgba(0, 0, 0, 0.7)';
            textFont = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;
          }
          
          ctx.fillStyle = textColor;
          ctx.font = textFont;
          ctx.fillText(String(y + 1), leftX, py);
      }

      // 优化：左上角显示 1,1，字体稍大
      ctx.font = `600 ${fontSize + 1}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillText('1,1', leftX, topY);
      
      // 优化：添加刻度线，让标尺更清晰
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      
      // 顶部刻度线（每格都显示）
      for (let x = startCol; x <= endCol; x++) {
          const px = snap(padX + tx + x * stepX);
          if (px < padX || px > padX + width) continue;
          
          // 刻度线长度根据重要性不同
          let tickLength = Math.max(3, fontSize * 0.2);
          if (x % 10 === 0) {
            tickLength = Math.max(6, fontSize * 0.4);
          } else if (x % 5 === 0) {
            tickLength = Math.max(4, fontSize * 0.3);
          }
          
          ctx.beginPath();
          ctx.moveTo(px, padY);
          ctx.lineTo(px, padY + tickLength);
          ctx.stroke();
      }
      
      // 左侧刻度线（每格都显示）
      for (let y = startRow; y <= endRow; y++) {
          const py = snap(padY + ty + y * stepY);
          if (py < padY || py > padY + height) continue;
          
          // 刻度线长度根据重要性不同
          let tickLength = Math.max(3, fontSize * 0.2);
          if (y % 10 === 0) {
            tickLength = Math.max(6, fontSize * 0.4);
          } else if (y % 5 === 0) {
            tickLength = Math.max(4, fontSize * 0.3);
          }
          
          ctx.beginPath();
          ctx.moveTo(padX, py);
          ctx.lineTo(padX + tickLength, py);
          ctx.stroke();
      }
  },

  _drawPixelated(ctx, cols, rows, drawW, drawH, sourceCanvas) {
    const data = this._pixelData;
    const hasData = data && this._pixelCols === cols && this._pixelRows === rows;
    if (!hasData) {
      ctx.drawImage(sourceCanvas, 0, 0, drawW, drawH);
      return;
    }

    for (let y = 0; y < rows; y++) {
      const y0 = Math.round((y * drawH) / rows);
      const y1 = Math.round(((y + 1) * drawH) / rows);
      const h = y1 - y0;
      if (h <= 0) continue;
      for (let x = 0; x < cols; x++) {
        const x0 = Math.round((x * drawW) / cols);
        const x1 = Math.round(((x + 1) * drawW) / cols);
        const w = x1 - x0;
        if (w <= 0) continue;
        const i = (y * cols + x) * 4;
        const a = data[i + 3];
        if (a === 0) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
        ctx.fillRect(x0, y0, w, h);
      }
    }
  },

  _drawBrandCodes(ctx, cols, rows, drawW, drawH, viewScale, renderScale, force) {
    if (!this.data.showCellCodes) return;
    const brand = this.data.selectedBrand;
    if (!brand) return;
    const codeMap = this._brandCodeByHex && this._brandCodeByHex[brand];
    if (!codeMap) return;

    const cellW = drawW / Math.max(1, cols);
    const cellH = drawH / Math.max(1, rows);
    const baseCell = Math.min(cellW, cellH);
    const scale = Math.max(1, viewScale || 1);
    const screenCell = baseCell * scale;
    if (baseCell < 3) return;
    const isTiny = baseCell < 10;

    const data = this._pixelData;
    const hexes = this._pixelHexes;
    if (!data || !hexes || hexes.length !== cols * rows) return;

    const textAlign = isTiny ? 'left' : 'center';
    const textBaseline = isTiny ? 'top' : 'middle';
    const pad = Math.max(0.5, baseCell * 0.08);
    // Allow larger font size during export (force=true)
    const maxFont = force ? 48 : 11;
    const fontSize = Math.max(3, Math.floor(Math.min(baseCell * (isTiny ? 0.48 : 0.32), maxFont)));
    const fontWeight = isTiny ? 700 : 600;
    const font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;

    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.font = font;

    const lw = Math.max(0.4, Math.min(0.8, screenCell * 0.02)) / scale;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

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
        const a = data[idx + 3];
        if (a === 0) continue;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const textIsLight = lum < 140;
        const fill = textIsLight ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.72)';
        const stroke = textIsLight ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.28)';

        const text = String(code);
        let measuredW = measureCache.get(text);
        if (measuredW == null) {
          measuredW = ctx.measureText(text).width;
          measureCache.set(text, measuredW);
        }

        const scaleX = measuredW > maxW && measuredW > 0 ? Math.max(0.55, maxW / measuredW) : 1;
        const needClip = isTiny || scaleX < 1 || measuredW > cellW * 0.95;

        const cellX = x * cellW;
        const cellY = y * cellH;

        const cx = (x + 0.5) * cellW;
        const cy = (y + 0.5) * cellH;
        const px = isTiny ? (cellX + pad) : cx;
        const py = isTiny ? (cellY + pad) : cy;

        if (needClip || scaleX < 1) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(cellX, cellY, cellW, cellH);
          ctx.clip();
          ctx.translate(px, py);
          ctx.scale(scaleX, 1);
          ctx.lineWidth = lw;
          ctx.strokeStyle = stroke;
          ctx.fillStyle = fill;
          const needStroke = !isTiny && lum >= 110 && lum <= 180;
          if (needStroke) ctx.strokeText(text, 0, 0);
          ctx.fillText(text, 0, 0);
          ctx.restore();
        } else {
          ctx.lineWidth = lw;
          ctx.strokeStyle = stroke;
          ctx.fillStyle = fill;
          const needStroke = !isTiny && lum >= 110 && lum <= 180;
          if (needStroke) ctx.strokeText(text, px, py);
          ctx.fillText(text, px, py);
        }
      }
    }
  },

  _fillRoundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
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

  onCanvasTouchStart(e) {
    if (!this._viewState) {
      this._viewState = { scale: 1, tx: 0, ty: 0 };
    }

    const touches = e.touches || [];
    if (!touches.length) return;

    const info = this._renderInfo;
    if (!info) return;

    const getPoint = (t) => {
      if (typeof t.x === 'number' && typeof t.y === 'number') {
        return { x: t.x, y: t.y };
      }
      return { x: t.clientX, y: t.clientY };
    };

    if (touches.length === 1) {
      const p = getPoint(touches[0]);
      this._gesture = {
        type: 'pan',
        startX: p.x,
        startY: p.y,
        startTx: this._viewState.tx || 0,
        startTy: this._viewState.ty || 0
      };
      return;
    }

    if (touches.length >= 2) {
      const p1 = getPoint(touches[0]);
      const p2 = getPoint(touches[1]);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      this._gesture = {
        type: 'pinch',
        startDist: dist,
        startScale: this._viewState.scale || 1,
        startTx: this._viewState.tx || 0,
        startTy: this._viewState.ty || 0,
        focalX: mid.x,
        focalY: mid.y
      };
    }
  },

  onCanvasTouchMove(e) {
    const gesture = this._gesture;
    const info = this._renderInfo;
    if (!gesture || !info) return;

    const touches = e.touches || [];
    if (!touches.length) return;

    const getPoint = (t) => {
      if (typeof t.x === 'number' && typeof t.y === 'number') {
        return { x: t.x, y: t.y };
      }
      return { x: t.clientX, y: t.clientY };
    };

    const minScale = 1;
    const maxScale = 8;

    if (gesture.type === 'pan' && touches.length === 1) {
      const p = getPoint(touches[0]);
      const dx = p.x - gesture.startX;
      const dy = p.y - gesture.startY;
      let tx = (gesture.startTx || 0) + dx;
      let ty = (gesture.startTy || 0) + dy;

      const scale = Math.max(minScale, Math.min(maxScale, this._viewState.scale || 1));
      const scaledW = info.drawW * scale;
      const scaledH = info.drawH * scale;
      const minTx = Math.min(0, info.drawW - scaledW);
      const minTy = Math.min(0, info.drawH - scaledH);
      tx = Math.max(minTx, Math.min(0, tx));
      ty = Math.max(minTy, Math.min(0, ty));

      this._viewState = { scale, tx, ty };
      this._queueRender();
      return;
    }

    if (gesture.type === 'pinch' && touches.length >= 2) {
      const p1 = getPoint(touches[0]);
      const p2 = getPoint(touches[1]);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ratio = dist / (gesture.startDist || 1);

      let scale = (gesture.startScale || 1) * ratio;
      scale = Math.max(minScale, Math.min(maxScale, scale));

      const fx = gesture.focalX - info.offsetX;
      const fy = gesture.focalY - info.offsetY;

      const s0 = Math.max(minScale, Math.min(maxScale, gesture.startScale || 1));
      let tx = (gesture.startTx || 0) + (fx - (gesture.startTx || 0)) * (1 - scale / s0);
      let ty = (gesture.startTy || 0) + (fy - (gesture.startTy || 0)) * (1 - scale / s0);

      const scaledW = info.drawW * scale;
      const scaledH = info.drawH * scale;
      const minTx = Math.min(0, info.drawW - scaledW);
      const minTy = Math.min(0, info.drawH - scaledH);
      tx = Math.max(minTx, Math.min(0, tx));
      ty = Math.max(minTy, Math.min(0, ty));

      this._viewState = { scale, tx, ty };
      this._queueRender();
    }
  },

  onCanvasTouchEnd() {
    this._gesture = null;
    this._scheduleExport();
  },

  _queueRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    setTimeout(() => {
      this._renderQueued = false;
      this.redrawCanvas({ exportNow: false });
    }, 16);
  },

  _scheduleExport() {
    if (this._exportTimer) {
      clearTimeout(this._exportTimer);
    }
    this._exportTimer = setTimeout(() => {
      this.redrawCanvas({ exportNow: true });
    }, 240);
  }
});
