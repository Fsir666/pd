Page({
  data: {
    gridSize: 32,
    boardSize: 320,
    rulerSize: 22,
    boardWrapSize: 342,
    sideWidth: 320,
    toolbarWidth: 320,
    toolbarExpandedWidth: 320,
    toolbarCollapsedWidth: 56,
    toolbarCollapsed: true,
    rightPage: 'tools',
    statsColumns: 2,
    statusBarHeight: 0,
    headerHeight: 44,
    showGrid: true,
    showRuler: true,
    showCellCodes: false,
    viewScale: 1,
    viewX: 0,
    viewY: 0,
    zoomMinPercent: 60,
    zoomMaxPercent: 1200,
    zoomPercent: 100,
    zoomBarLeft: 0,
    zoomBarTop: 0,
    zoomBarHeight: 0,
    zoomHandleTop: 0,
    selectedBrand: 'MARD',
    brandOptions: ['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'],
    statsTotalBeads: 0,
    statsTotalColors: 0,
    statsSort: 'count',
    statsList: [],
    brushHex: '',
    brushCode: '',
    brushTextColor: '#FFFFFF',
    activeTool: 'brush',
    activeToolLabel: '画笔',
    leftDockCollapsed: true,
    leftDockLeft: 14,
    leftDockToggleLeft: 14,
    useShortLeftToggleLabel: false,
    useShortRightToggleLabel: false,
    exportShowGrid: true,
    exportShowRuler: true,
    exportShowCodes: false,
    exportSpecOptions: [
      { key: 'off', label: '不添加' },
      { key: 'grid', label: '仅格数' },
      { key: 'cm', label: '格数 + 厘米' }
    ],
    exportSpecIndex: 2,
    exportBeadMm: '5',
    continuousMode: false,
    replacePhase: 0,
    replaceSourceHex: '',
    undoCount: 0,
    redoCount: 0,
    paletteList: [],
    brushQuery: '',
    brushPaletteList: [],
    brushSeriesKey: 'ALL',
    brushSeriesOptions: [],
    showBrushPicker: false,
    showHelpDialog: false,
    showHistoryDialog: false,
    historyUndoList: [],
    showWorkSaveDialog: false,
    workSaveTitle: '',
    workSaveDesc: '',
    workSavePublic: false,
    workSaveSubmitting: false,
    safeInsetLeft: 0,
    safeInsetRight: 0,
    safeInsetTop: 0,
    safeInsetBottom: 0,
    leftDockExpandedWidth: 260,
    boardCenterLeft: 0,
    helpBtnLeft: 0,
    helpBtnTop: 0,
    highlightBeads: true,
    highlightMode: 'dim',
    highlightFocusHex: '',
    highlightFocusHexes: [],
    highlightFocusMap: {},
    selectionCount: 0,
    symmetryMode: 'off',
    recentHexes: [],
    favoriteHexes: [],
    favoriteMap: {},
    quickRecentList: [],
    quickFavoriteList: []
  },

  onLoad() {
    const app = getApp();
    const session = app && app.globalData ? app.globalData.beadSession : null;
    if (!session || !session.pixelHexes || !session.gridSize) {
      wx.navigateBack({ delta: 1 });
      return;
    }

    const sys = wx.getSystemInfoSync();
    const rulerSize = 22;
    const statusBarHeight = Math.max(0, Math.floor(sys.statusBarHeight || 0));
    const headerHeight = statusBarHeight + 44;
    const safe = sys && sys.safeArea ? sys.safeArea : null;
    const safeInsetLeft = safe ? Math.max(0, Math.floor(safe.left || 0)) : 0;
    const safeInsetRight = safe ? Math.max(0, Math.floor((sys.windowWidth || 0) - (safe.right || sys.windowWidth || 0))) : 0;
    const safeInsetTop = safe ? Math.max(0, Math.floor(safe.top || 0)) : 0;
    const safeInsetBottom = safe ? Math.max(0, Math.floor((sys.windowHeight || 0) - (safe.bottom || sys.windowHeight || 0))) : 0;
    const layoutW = safe ? Math.max(0, Math.floor((safe.right || sys.windowWidth || 0) - (safe.left || 0))) : (sys.windowWidth || 0);
    const toolbarExpandedWidth = Math.max(260, Math.min(340, Math.floor(layoutW * 0.28)));
    const useShortRightToggleLabel = layoutW <= 720;
    const useShortLeftToggleLabel = layoutW <= 720;
    const leftDockLeft = Math.max(14, safeInsetLeft + 14);
    const leftDockToggleLeft = leftDockLeft;
    const leftDockExpandedWidth = Math.max(200, Math.min(300, Math.floor(layoutW * 0.28)));

    this._pixelHexes = session.pixelHexes;
    this._ensurePaletteReady();
    this._undoStack = [];
    this._redoStack = [];

    const quick = this._loadQuickPalette();
    const recentHexes = quick && Array.isArray(quick.recentHexes) ? quick.recentHexes : [];
    const favoriteHexes = quick && Array.isArray(quick.favoriteHexes) ? quick.favoriteHexes : [];
    const favoriteMap = Object.create(null);
    favoriteHexes.forEach((h) => { favoriteMap[String(h)] = true; });

    const next = {
      gridSize: Math.max(16, Math.min(128, session.gridSize)),
      rulerSize,
      statusBarHeight,
      headerHeight,
      safeInsetLeft,
      safeInsetRight,
      safeInsetTop,
      safeInsetBottom,
      toolbarExpandedWidth,
      toolbarCollapsed: true,
      leftDockCollapsed: true,
      sideWidth: this.data.toolbarCollapsedWidth,
      toolbarWidth: this.data.toolbarCollapsedWidth,
      useShortRightToggleLabel,
      leftDockLeft,
      leftDockToggleLeft,
      leftDockExpandedWidth,
      useShortLeftToggleLabel,
      showGrid: session.showGrid !== false,
      showRuler: session.showRuler !== false,
      showCellCodes: session.showCellCodes !== false,
      selectedBrand: session.selectedBrand || 'MARD',
      statsSort: session.statsSort || 'count',
      activeToolLabel: this._toolLabel(this.data.activeTool),
      exportShowGrid: session.showGrid !== false,
      exportShowRuler: session.showRuler !== false,
      exportShowCodes: session.showCellCodes !== false,
      highlightBeads: session.highlightBeads !== false,
      highlightMode: session.highlightMode === 'hide' ? 'hide' : 'dim',
      highlightFocusHex: '',
      highlightFocusHexes: [],
      highlightFocusMap: {},
      symmetryMode: session.symmetryMode === 'h' || session.symmetryMode === 'v' || session.symmetryMode === 'hv' ? session.symmetryMode : 'off',
      recentHexes,
      favoriteHexes,
      favoriteMap,
      quickRecentList: [],
      quickFavoriteList: []
    };
    this.setData(next, () => {
      this._reflowLayout();
      this._recomputeStats();
      this._refreshBrushCode();
      this._ensurePaletteList();
      this._refreshQuickPalette();
    });
  },

  onOpenHelp() {
    this.setData({ showHelpDialog: true })
  },

  onCloseHelp() {
    this.setData({ showHelpDialog: false })
  },

  onReady() {
    this._initBoardCanvas();
    this._initRulerCanvases();
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onToggleLeftDock() {
    const next = !this.data.leftDockCollapsed;
    this.setData({ leftDockCollapsed: next }, () => {
      this._reflowLayout();
    });
  },

  onToggleToolbar() {
    const next = !this.data.toolbarCollapsed;
    const toolbarWidth = next ? this.data.toolbarCollapsedWidth : this.data.toolbarExpandedWidth;
    this.setData({ toolbarCollapsed: next, toolbarWidth, sideWidth: toolbarWidth }, () => {
      this._reflowLayout();
    });
  },

  onRightNavTap(e) {
    const page = e && e.currentTarget ? e.currentTarget.dataset.page : '';
    if (!page || page === this.data.rightPage) return;
    this.setData({ rightPage: page });
  },

  onBrandTap(e) {
    const brand = e.currentTarget.dataset.brand;
    if (!brand || brand === this.data.selectedBrand) return;
    this.setData({ selectedBrand: brand }, () => {
      this._recomputeStats();
      this._refreshBrushCode();
      this._ensurePaletteList();
      this._refreshQuickPalette();
      if (this.data.showBrushPicker) this._applyBrushFilter();
    });
  },

  onStatsSortTap(e) {
    const s = e && e.currentTarget ? e.currentTarget.dataset.sort : '';
    if (!s || s === this.data.statsSort) return;
    this.setData({ statsSort: s }, () => {
      this._recomputeStats();
    });
  },

  onStatsCardTap(e) {
    if (!this.data.highlightBeads) return;
    const hex = e && e.currentTarget ? String(e.currentTarget.dataset.hex || '') : '';
    if (!hex) return;
    const prev = Array.isArray(this.data.highlightFocusHexes) ? this.data.highlightFocusHexes : [];
    const set = new Set(prev);
    if (set.has(hex)) set.delete(hex);
    else set.add(hex);
    const highlightFocusHexes = Array.from(set);
    const highlightFocusHex = highlightFocusHexes.length === 1 ? highlightFocusHexes[0] : '';
    const highlightFocusMap = Object.create(null);
    highlightFocusHexes.forEach((h) => { highlightFocusMap[h] = true; });
    this.setData({ highlightFocusHex, highlightFocusHexes, highlightFocusMap }, () => {
      this._drawBoard();
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
    const boardWrapSize = this.data.boardSize + (showRuler ? this.data.rulerSize : 0);
    this.setData({ showRuler, boardWrapSize }, () => {
      this._viewportRectDirty = true;
      this._reflowLayout();
      if (showRuler && (!this._xRulerCanvas || !this._yRulerCanvas || !this._xRulerCtx || !this._yRulerCtx)) {
        this._initRulerCanvases();
      } else {
        this._resizeRulerCanvases();
        this._drawRulers();
      }
    });
  },

  onToggleCellCodes(e) {
    const showCellCodes = !!(e && e.detail && e.detail.value);
    this.setData({ showCellCodes }, () => {
      this._drawBoard();
    });
  },

  onToggleHighlightBeads(e) {
    const highlightBeads = !!(e && e.detail && e.detail.value);
    const highlightFocusHex = highlightBeads ? this.data.highlightFocusHex : '';
    const highlightFocusHexes = highlightBeads ? (Array.isArray(this.data.highlightFocusHexes) ? this.data.highlightFocusHexes : []) : [];
    const highlightFocusMap = highlightBeads ? (this.data.highlightFocusMap || {}) : {};
    this.setData({ highlightBeads, highlightFocusHex, highlightFocusHexes, highlightFocusMap }, () => {
      this._drawBoard();
    });
  },

  onHighlightModeTap(e) {
    if (!this.data.highlightBeads) return;
    const mode = e && e.currentTarget ? String(e.currentTarget.dataset.mode || '') : '';
    if (mode !== 'dim' && mode !== 'hide') return;
    if (mode === this.data.highlightMode) return;
    this.setData({ highlightMode: mode }, () => {
      this._drawBoard();
    });
  },

  onClearHighlights() {
    if (!this.data.highlightBeads) return;
    if (!this.data.highlightFocusHex && (!this.data.highlightFocusHexes || !this.data.highlightFocusHexes.length)) return;
    this.setData({ highlightFocusHex: '', highlightFocusHexes: [], highlightFocusMap: {} }, () => {
      this._drawBoard();
    });
  },

  onExportToggleGrid(e) {
    const exportShowGrid = !!(e && e.detail && e.detail.value);
    this.setData({ exportShowGrid });
  },

  onExportToggleRuler(e) {
    const exportShowRuler = !!(e && e.detail && e.detail.value);
    this.setData({ exportShowRuler });
  },

  onExportToggleCodes(e) {
    const exportShowCodes = !!(e && e.detail && e.detail.value);
    this.setData({ exportShowCodes });
  },

  onExportSpecChange(e) {
    const v = e && e.detail ? Number(e.detail.value) : 0;
    const max = (this.data.exportSpecOptions || []).length - 1;
    const exportSpecIndex = Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));
    this.setData({ exportSpecIndex });
  },

  onExportBeadInput(e) {
    const exportBeadMm = e && e.detail && e.detail.value != null ? String(e.detail.value) : '';
    this.setData({ exportBeadMm });
  },

  onExportSaveTap() {
    wx.showLoading({ title: '保存中', mask: true });
    this._ensureExportCanvasReady((ok) => {
      if (!ok) {
        wx.hideLoading();
        wx.showToast({ title: '导出失败', icon: 'none' });
        return;
      }
      this._exportToTempFilePath((err, filePath) => {
        if (err || !filePath) {
          wx.hideLoading();
          wx.showToast({ title: '导出失败', icon: 'none' });
          return;
        }
        this._saveImageToAlbum(filePath, (saveErr) => {
          wx.hideLoading();
          if (saveErr) {
            wx.showToast({ title: '保存失败', icon: 'none' });
            return;
          }
          wx.showToast({ title: '已保存到相册', icon: 'success' });
        });
      });
    });
  },

  onExportSaveToWorksTap() {
    const grid = this.data.gridSize || 32;
    const seedTitle = `我的拼豆 ${grid}x${grid}`;
    this.setData({
      showWorkSaveDialog: true,
      workSaveTitle: this.data.workSaveTitle || seedTitle,
      workSaveDesc: this.data.workSaveDesc || '',
      workSavePublic: !!this.data.workSavePublic
    });
  },

  onWorkSaveTitleInput(e) {
    const v = e && e.detail && e.detail.value != null ? String(e.detail.value) : '';
    this.setData({ workSaveTitle: v });
  },

  onWorkSaveDescInput(e) {
    const v = e && e.detail && e.detail.value != null ? String(e.detail.value) : '';
    this.setData({ workSaveDesc: v });
  },

  onWorkSavePublicChange(e) {
    const v = !!(e && e.detail && e.detail.value);
    this.setData({ workSavePublic: v });
  },

  onWorkSaveCancelTap() {
    if (this.data.workSaveSubmitting) return;
    this.setData({ showWorkSaveDialog: false });
  },

  onWorkSaveConfirmTap() {
    if (this.data.workSaveSubmitting) return;
    const title = String(this.data.workSaveTitle || '').trim();
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    this.setData({ workSaveSubmitting: true });

    wx.showLoading({ title: '保存中', mask: true });
    this._ensureExportCanvasReady((ok) => {
      if (!ok) {
        wx.hideLoading();
        this.setData({ workSaveSubmitting: false });
        wx.showToast({ title: '导出失败', icon: 'none' });
        return;
      }
      this._exportToTempFilePath((err, filePath) => {
        if (err || !filePath) {
          wx.hideLoading();
          this.setData({ workSaveSubmitting: false });
          wx.showToast({ title: '导出失败', icon: 'none' });
          return;
        }

        const now = new Date();
        const pad2 = (n) => String(n).padStart(2, '0');
        const ts = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
        const rand = Math.floor(Math.random() * 1000000);
        const cloudPath = `myworks/${ts}-${rand}.png`;

        const grid = this.data.gridSize || 32;
        const selectedBrand = this.data.selectedBrand || 'MARD';
        const specOpt = (this.data.exportSpecOptions && this.data.exportSpecOptions[this.data.exportSpecIndex]) ? this.data.exportSpecOptions[this.data.exportSpecIndex] : { key: 'off', label: '不添加' };
        const beadMm = Number(this.data.exportBeadMm || 0);
        const sizeCm = Number.isFinite(beadMm) && beadMm > 0 ? (grid * beadMm / 10) : null;

        const mapping = require('../../data/color-mapping.js');
        const hexes = Array.isArray(this._pixelHexes) ? this._pixelHexes : [];
        const codes = [];
        for (let i = 0; i < hexes.length; i++) {
          const hex = hexes[i];
          if (!hex) {
            codes.push('');
            continue;
          }
          const m = mapping[hex];
          const mard = m && typeof m.MARD === 'string' ? m.MARD : '';
          codes.push(mard || '');
        }

        wx.cloud.uploadFile({
          cloudPath,
          filePath
        }).then((upRes) => {
          const fileID = upRes && upRes.fileID ? upRes.fileID : '';
          if (!fileID) throw new Error('Missing fileID');

          return wx.cloud.callFunction({
            name: 'template-api',
            data: {
              action: 'saveMyWork',
              title,
              description: String(this.data.workSaveDesc || '').trim(),
              imageUrl: fileID,
              isPublic: !!this.data.workSavePublic,
              timestampMs: Date.now(),
              authorInfo: getApp().globalData.userInfo,
              board: {
                gridSize: grid,
                brand: selectedBrand,
                codesMard: codes
              },
              spec: {
                gridSize: grid,
                specKey: specOpt.key,
                beadMm: String(this.data.exportBeadMm || ''),
                sizeCm
              }
            }
          });
        }).then((res) => {
          const r = res && res.result ? res.result : null;
          if (!r || r.code !== 0) throw new Error((r && r.msg) || 'Cloud error');
          wx.hideLoading();
          this.setData({ showWorkSaveDialog: false, workSaveSubmitting: false });
          wx.showToast({ title: '已保存到我的作品', icon: 'success' });
        }).catch((err) => {
          console.error('Save failed:', err);
          wx.hideLoading();
          this.setData({ workSaveSubmitting: false });
          wx.showToast({ title: '保存失败: ' + (err.errMsg || err.message || '未知错误'), icon: 'none' });
        });
      });
    });
  },

  onOpenBrushPicker() {
    this._ensureBrushSeriesOptions();
    this.setData({ showBrushPicker: true, brushQuery: '', brushSeriesKey: 'ALL' }, () => {
      this._applyBrushFilter();
      this._refreshQuickPalette();
    });
  },

  onCloseBrushPicker() {
    this.setData({ showBrushPicker: false });
  },

  onBrushQueryInput(e) {
    const brushQuery = e && e.detail ? String(e.detail.value || '') : '';
    this.setData({ brushQuery }, () => {
      this._applyBrushFilter();
    });
  },

  onBrushSearch() {
    this._applyBrushFilter();
  },

  onBrushSeriesTap(e) {
    const key = e && e.currentTarget ? String(e.currentTarget.dataset.key || '') : '';
    if (!key || key === this.data.brushSeriesKey) return;
    this.setData({ brushSeriesKey: key }, () => {
      this._applyBrushFilter();
    });
  },

  onPickColor(e) {
    const hex = e && e.currentTarget ? e.currentTarget.dataset.hex : '';
    const code = e && e.currentTarget ? e.currentTarget.dataset.code : '';
    if (!hex) return;
    const brushTextColor = this._getTextColorForHex(hex);
    const nextBrush = { brushHex: hex, brushCode: code || '', brushTextColor, showBrushPicker: false };
    const shouldCommitReplace = this.data.activeTool === 'replace' && this.data.replacePhase === 2 && this.data.replaceSourceHex;
    this.setData(nextBrush, () => {
      this._addRecentHex(String(hex));
      if (shouldCommitReplace) {
        const dstCode = this._getCodeForHex(hex, this.data.selectedBrand) || '未知';
        wx.showToast({ title: `目标色 ${dstCode}，待确认`, icon: 'none' });
        this._commitReplaceTo(hex);
      }
    });
    if (typeof wx.vibrateShort === 'function') wx.vibrateShort({ type: 'light' });
  },

  onPickQuickColor(e) {
    const hex = e && e.currentTarget ? String(e.currentTarget.dataset.hex || '') : '';
    if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return;
    const code = this._getCodeForHex(hex, this.data.selectedBrand) || '';
    const brushTextColor = this._getTextColorForHex(hex);
    const shouldCommitReplace = this.data.activeTool === 'replace' && this.data.replacePhase === 2 && this.data.replaceSourceHex;
    this.setData({ brushHex: hex, brushCode: code, brushTextColor, showBrushPicker: false }, () => {
      this._addRecentHex(hex);
      if (shouldCommitReplace) this._commitReplaceTo(hex);
    });
    if (typeof wx.vibrateShort === 'function') wx.vibrateShort({ type: 'light' });
  },

  onToggleFavoriteColor(e) {
    const hex = e && e.currentTarget ? String(e.currentTarget.dataset.hex || '') : '';
    if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return;
    const prev = Array.isArray(this.data.favoriteHexes) ? this.data.favoriteHexes : [];
    const set = new Set(prev);
    const nextOn = !set.has(hex);
    if (nextOn) set.add(hex);
    else set.delete(hex);
    const favoriteHexes = Array.from(set);
    const favoriteMap = Object.create(null);
    favoriteHexes.forEach((h) => { favoriteMap[String(h)] = true; });
    this.setData({ favoriteHexes, favoriteMap }, () => {
      this._saveQuickPalette();
      this._refreshQuickPalette();
    });
    wx.showToast({ title: nextOn ? '已收藏' : '已取消收藏', icon: 'none' });
    if (typeof wx.vibrateShort === 'function') wx.vibrateShort({ type: 'light' });
  },

  onClearRecentColors() {
    if (!this.data.recentHexes || !this.data.recentHexes.length) return;
    this.setData({ recentHexes: [], quickRecentList: [] }, () => {
      this._saveQuickPalette();
    });
    wx.showToast({ title: '已清空最近使用', icon: 'none' });
  },

  onBrushTap() {
    if (this.data.activeTool === 'replace' && this.data.replacePhase === 2 && this.data.replaceSourceHex) {
      this.onOpenBrushPicker();
      return;
    }
    if (this.data.activeTool === 'brush') {
      if (this.data.showBrushPicker) {
        this.setData({ showBrushPicker: false }, () => {
          this._setActiveTool('');
        });
      } else {
        this.onOpenBrushPicker();
      }
      return;
    }
    this._setActiveTool('brush');
    this.onOpenBrushPicker();
  },

  onToggleContinuousMode() {
    const next = !this.data.continuousMode;
    this.setData({ continuousMode: next });
    wx.showToast({ title: next ? '连续模式已开启' : '连续模式已关闭', icon: 'none' });
  },

  onSymmetryTap(e) {
    const mode = e && e.currentTarget ? String(e.currentTarget.dataset.mode || '') : '';
    const next = mode === 'h' || mode === 'v' || mode === 'hv' ? mode : 'off';
    if (next === this.data.symmetryMode) return;
    this.setData({ symmetryMode: next });
    const app = getApp();
    if (app && app.globalData && app.globalData.beadSession) app.globalData.beadSession.symmetryMode = next;
    const label = next === 'h' ? '左右对称' : next === 'v' ? '上下对称' : next === 'hv' ? '四向对称' : '关闭';
    wx.showToast({ title: `对称绘制：${label}`, icon: 'none' });
  },

  onEraseTap() {
    if (this.data.activeTool === 'erase') {
      this._setActiveTool('');
      return;
    }
    this._setActiveTool('erase');
    this.setData({ showBrushPicker: false });
  },

  onSelectTap() {
    if (this.data.activeTool === 'select') {
      this._setActiveTool('');
      this._clearSelection();
      return;
    }
    this._setActiveTool('select');
    this.setData({ showBrushPicker: false });
    wx.showToast({ title: '选区：拖动框选，点一下按颜色选', icon: 'none' });
  },

  onPickerTap() {
    if (this.data.activeTool === 'picker') {
      this._setActiveTool('');
      return;
    }
    this._setActiveTool('picker');
    this.setData({ showBrushPicker: false });
    wx.showToast({ title: '吸管：点画板取色', icon: 'none' });
  },

  onSelectionFillTap() {
    if (!this._selectionSet || !this._selectionSet.size) return;
    const hex = this.data.brushHex;
    if (!/^#([0-9a-fA-F]{6})$/.test(String(hex || ''))) {
      wx.showToast({ title: '请先选择画笔颜色', icon: 'none' });
      this.onOpenBrushPicker();
      return;
    }
    const changes = [];
    this._selectionSet.forEach((index) => {
      const prev = this._pixelHexes[index] || '';
      const next = hex;
      if (prev === next) return;
      changes.push({ index, prev, next });
      this._pixelHexes[index] = next;
    });
    if (!changes.length) return;
    this._pushAction(changes, '选区填充');
    this._recomputeStats();
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
  },

  onSelectionClearTap() {
    if (!this._selectionSet || !this._selectionSet.size) return;
    const changes = [];
    this._selectionSet.forEach((index) => {
      const prev = this._pixelHexes[index] || '';
      const next = '';
      if (prev === next) return;
      changes.push({ index, prev, next });
      this._pixelHexes[index] = next;
    });
    if (!changes.length) return;
    this._pushAction(changes, '选区清空');
    this._recomputeStats();
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
  },

  onSelectionCancelTap() {
    this._clearSelection();
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
  },

  onDeleteTap() {
    if (this.data.activeTool === 'delete') {
      this._setActiveTool('');
      return;
    }
    this._setActiveTool('delete');
    this.setData({ showBrushPicker: false });
    wx.showToast({ title: '批量删除同色：点一个色块删除同色', icon: 'none' });
  },

  onReplaceTap() {
    if (this.data.activeTool === 'replace') {
      this._setActiveTool('');
      this.setData({ showBrushPicker: false, replacePhase: 0, replaceSourceHex: '' });
      return;
    }
    this._setActiveTool('replace');
    this.setData({ showBrushPicker: false, replacePhase: 1, replaceSourceHex: '' });
    wx.showToast({ title: '批量换色：先点要替换的颜色', icon: 'none' });
  },

  onUndoTap() {
    this._applyUndoSteps(1);
  },

  onRedoTap() {
    this._applyRedoSteps(1);
  },

  onOpenHistory() {
    this._refreshHistoryList();
    this.setData({ showHistoryDialog: true });
  },

  onCloseHistory() {
    this.setData({ showHistoryDialog: false });
  },

  onHistoryUndoToTap(e) {
    const targetLen = Number(e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.target : NaN);
    if (!Number.isFinite(targetLen)) return;
    this._undoToLength(targetLen);
    this._refreshHistoryList();
  },

  onHistoryRedoAllTap() {
    const redoLen = this._redoStack ? this._redoStack.length : 0;
    if (!redoLen) return;
    this._applyRedoSteps(redoLen);
    this._refreshHistoryList();
  },

  onFlipHorizontal() {
    this._flipBoard('h');
  },

  onFlipVertical() {
    this._flipBoard('v');
  },

  onZoomTouchStart(e) {
    const touches = (e && e.touches) || [];
    if (!touches.length) return;
    this._zoomDragging = true;
    console.log('Zoom Touch Start', e);
    // Force ensure rect synchronously if possible or async
    this._ensureZoomRect(() => {
      const t = touches[0];
      this._updateZoomByClientY(t.clientY);
    });
  },

  _flipBoard(dir) {
    const grid = Math.max(16, Math.min(128, Number(this.data.gridSize) || 32));
    const hexes = Array.isArray(this._pixelHexes) ? this._pixelHexes : [];
    if (hexes.length !== grid * grid) return;

    const nextHexes = new Array(hexes.length);
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const srcIndex = r * grid + c;
        const dstIndex = dir === 'v' ? ((grid - 1 - r) * grid + c) : (r * grid + (grid - 1 - c));
        nextHexes[dstIndex] = hexes[srcIndex] || '';
      }
    }

    const changes = [];
    for (let i = 0; i < hexes.length; i++) {
      const prev = hexes[i] || '';
      const next = nextHexes[i] || '';
      if (prev !== next) changes.push({ index: i, prev, next });
    }

    if (!changes.length) {
      wx.showToast({ title: '无需镜像', icon: 'none' });
      return;
    }

    this._pixelHexes = nextHexes;
    this._pushAction(changes);
    this._recomputeStats();
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
    wx.showToast({ title: dir === 'v' ? '已纵向镜像' : '已横向镜像', icon: 'none' });
  },

  onZoomTouchMove(e) {
    if (!this._zoomDragging) return;
    const touches = (e && e.touches) || [];
    if (!touches.length) return;
    const t = touches[0];
    this._updateZoomByClientY(t.clientY);
  },

  onZoomTouchEnd() {
    this._zoomDragging = false;
  },

  onTouchStart(e) {
    const touches = (e && e.touches) || [];
    if (!touches.length) return;
    this._ensureViewportRect(() => {
      this._clearLongPressTimer();
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
        if (this.data.activeTool === 'select') {
          const hit = this._hitTestCellClamped(t.clientX, t.clientY);
          if (!hit) return;
          this._touchMode = 'select';
          this._selectStartHit = hit;
          this._selectStartClient = { x: t.clientX, y: t.clientY };
          this._selectMoved = false;
          this._selectPreview = null;
          return;
        }
        if (this.data.continuousMode && this._canPaintDrag()) {
          if (this.data.activeTool === 'brush' && !/^#([0-9a-fA-F]{6})$/.test(String(this.data.brushHex || ''))) {
            wx.showToast({ title: '请先选择画笔颜色', icon: 'none' });
            this.onOpenBrushPicker();
            this._touchMode = 'pan';
            this._panStart = { x: t.clientX, y: t.clientY, t: Date.now() };
            this._panLast = { x: t.clientX, y: t.clientY };
            this._panMoved = false;
            return;
          }
          this._touchMode = 'paint';
          this._paintLastIndex = -1;
          this._beginPaintStroke();
          this._applyPaintAtClient(t.clientX, t.clientY);
          return;
        }

        this._touchMode = 'pan';
        this._panStart = { x: t.clientX, y: t.clientY, t: Date.now() };
        this._panLast = { x: t.clientX, y: t.clientY };
        this._panMoved = false;
        this._startLongPressTimer(t.clientX, t.clientY);
      }
    });
  },

  onTouchMove(e) {
    const touches = (e && e.touches) || [];
    if (!touches.length) return;

    if (this._touchMode === 'paint' && touches.length === 1) {
      const t = touches[0];
      this._applyPaintAtClient(t.clientX, t.clientY);
      return;
    }

    if (this._touchMode === 'select' && touches.length === 1) {
      const t = touches[0];
      const start = this._selectStartClient || { x: t.clientX, y: t.clientY };
      const dx0 = t.clientX - start.x;
      const dy0 = t.clientY - start.y;
      if (!this._selectMoved && (dx0 * dx0 + dy0 * dy0) < 64) {
        return;
      }
      this._selectMoved = true;
      const a = this._selectStartHit;
      const b = this._hitTestCellClamped(t.clientX, t.clientY);
      if (!a || !b) return;
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      this._selectPreview = { minX, maxX, minY, maxY };
      this._scheduleBoardDraw();
      this._scheduleRulerDraw();
      return;
    }

    if (this._touchMode === 'pinch' && touches.length >= 2) {
      this._clearLongPressTimer();
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
      const zoomPercent = this._scaleToZoomPercent(nextScale);
      this.setData({ viewScale: nextScale, viewX: clamped.x, viewY: clamped.y, zoomPercent }, () => {
        this._syncZoomHandle();
      });
      this._scheduleBoardDraw();
      this._scheduleRulerDraw();
      return;
    }

    if (this._touchMode === 'pan' && touches.length === 1) {
      const t = touches[0];
      const start = this._panStart || { x: t.clientX, y: t.clientY };
      const dx0 = t.clientX - start.x;
      const dy0 = t.clientY - start.y;
      if (!this._panMoved && (dx0 * dx0 + dy0 * dy0) < 64) {
        this._panLast = { x: t.clientX, y: t.clientY };
        return;
      }
      if (!this._panMoved) {
        this._clearLongPressTimer();
        this._panMoved = true;
        this._panLast = { x: t.clientX, y: t.clientY };
        return;
      }
      const last = this._panLast || { x: t.clientX, y: t.clientY };
      const dx = t.clientX - last.x;
      const dy = t.clientY - last.y;
      this._panLast = { x: t.clientX, y: t.clientY };
      const s = this.data.viewScale;
      const clamped = this._clampTranslate(this.data.viewX + dx, this.data.viewY + dy, s);
      this.setData({ viewX: clamped.x, viewY: clamped.y });
      this._scheduleBoardDraw();
      this._scheduleRulerDraw();
    }
  },

  onTouchEnd(e) {
    this._clearLongPressTimer();
    if (this._touchMode === 'paint') {
      this._endPaintStroke();
    } else if (this._touchMode === 'select') {
      const start = this._selectStartHit;
      const moved = !!this._selectMoved;
      const preview = this._selectPreview;
      this._selectStartHit = null;
      this._selectStartClient = null;
      this._selectMoved = false;
      this._selectPreview = null;
      if (!start) {
        this._touchMode = '';
        return;
      }
      if (!moved) {
        const hex = start.hex || '';
        if (!hex) this._clearSelection();
        else this._selectByColor(hex);
      } else if (preview) {
        this._selectByRect(preview.minX, preview.minY, preview.maxX, preview.maxY);
      }
      this._scheduleBoardDraw();
      this._scheduleRulerDraw();
    } else if (this._touchMode === 'pan' && !this._panMoved) {
      const touches = (e && e.changedTouches) || [];
      if (touches && touches.length) {
        const t = touches[0];
        this._handleBoardTap(t.clientX, t.clientY);
      }
    }
    this._touchMode = '';
    this._panLast = null;
    this._panStart = null;
    this._panMoved = false;
    this._pinchMid = null;
    this._paintLastIndex = -1;
  },

  _clearSelection() {
    this._selectionSet = null;
    this._selectionBounds = null;
    this._selectPreview = null;
    if (this.data.selectionCount) this.setData({ selectionCount: 0 });
  },

  _selectByColor(hex) {
    const target = String(hex || '');
    const hexes = Array.isArray(this._pixelHexes) ? this._pixelHexes : [];
    const set = new Set();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const grid = Math.max(16, Math.min(128, Number(this.data.gridSize) || 32));
    for (let i = 0; i < hexes.length; i++) {
      if (hexes[i] !== target) continue;
      set.add(i);
      const x = i % grid;
      const y = Math.floor(i / grid);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    this._selectionSet = set.size ? set : null;
    this._selectionBounds = set.size ? { minX, minY, maxX, maxY } : null;
    this.setData({ selectionCount: set.size });
  },

  _selectByRect(x0, y0, x1, y1) {
    const grid = Math.max(16, Math.min(128, Number(this.data.gridSize) || 32));
    const minX = Math.max(0, Math.min(grid - 1, Math.floor(Math.min(x0, x1))));
    const maxX = Math.max(0, Math.min(grid - 1, Math.floor(Math.max(x0, x1))));
    const minY = Math.max(0, Math.min(grid - 1, Math.floor(Math.min(y0, y1))));
    const maxY = Math.max(0, Math.min(grid - 1, Math.floor(Math.max(y0, y1))));
    const set = new Set();
    for (let y = minY; y <= maxY; y++) {
      const row = y * grid;
      for (let x = minX; x <= maxX; x++) {
        set.add(row + x);
      }
    }
    this._selectionSet = set.size ? set : null;
    this._selectionBounds = set.size ? { minX, minY, maxX, maxY } : null;
    this.setData({ selectionCount: set.size });
  },

  _clientToBoardXY(clientX, clientY) {
    const rect = this._viewportRect;
    if (!rect) return null;
    const grid = Math.max(16, Math.min(128, this.data.gridSize));
    const size = this.data.boardSize;
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    const scale = this.data.viewScale || 1;
    const tx = this.data.viewX || 0;
    const ty = this.data.viewY || 0;
    const bx = (lx - tx) / Math.max(0.0001, scale);
    const by = (ly - ty) / Math.max(0.0001, scale);
    return { bx, by, grid, size };
  },

  _hitTestCellClamped(clientX, clientY) {
    const info = this._clientToBoardXY(clientX, clientY);
    if (!info) return null;
    const grid = info.grid;
    const size = info.size;
    const cell = size / grid;
    const bx = Math.max(0, Math.min(size - 0.0001, info.bx));
    const by = Math.max(0, Math.min(size - 0.0001, info.by));
    const x = Math.max(0, Math.min(grid - 1, Math.floor(bx / cell)));
    const y = Math.max(0, Math.min(grid - 1, Math.floor(by / cell)));
    const index = y * grid + x;
    const hex = this._pixelHexes ? this._pixelHexes[index] : '';
    return { x, y, index, hex };
  },

  _handleBoardTap(clientX, clientY) {
    const tool = this.data.activeTool;
    if (!tool) return;
    this._ensureViewportRect(() => {
      const hit = this._hitTestCell(clientX, clientY);
      if (!hit) return;
      this._applyToolAt(hit.index, hit.hex);
    });
  },

  _hitTestCell(clientX, clientY) {
    const rect = this._viewportRect;
    if (!rect) return null;
    const grid = Math.max(16, Math.min(128, this.data.gridSize));
    const size = this.data.boardSize;
    const cell = size / grid;
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    const scale = this.data.viewScale || 1;
    const tx = this.data.viewX || 0;
    const ty = this.data.viewY || 0;
    const bx = (lx - tx) / Math.max(0.0001, scale);
    const by = (ly - ty) / Math.max(0.0001, scale);
    if (bx < 0 || by < 0 || bx >= size || by >= size) return null;
    const x = Math.floor(bx / cell);
    const y = Math.floor(by / cell);
    if (x < 0 || y < 0 || x >= grid || y >= grid) return null;
    const index = y * grid + x;
    const hex = this._pixelHexes ? this._pixelHexes[index] : '';
    return { x, y, index, hex };
  },

  _toolLabel(tool) {
    const t = String(tool || '');
    if (t === 'brush') return '画笔';
    if (t === 'erase') return '擦除';
    if (t === 'delete') return '删色';
    if (t === 'replace') return '换色';
    if (t === 'select') return '选区';
    if (t === 'picker') return '吸管';
    return '未选择';
  },

  _setActiveTool(tool) {
    const next = String(tool || '');
    const prev = this.data.activeTool;
    const data = { activeTool: next, activeToolLabel: this._toolLabel(next) };
    if (next !== 'replace') data.replacePhase = 0;
    if (next !== 'replace') data.replaceSourceHex = '';
    this.setData(data);
    if (!next) wx.showToast({ title: '已取消选中', icon: 'none' });
    if (next === 'brush') wx.showToast({ title: '画笔已选中（长按拖动可连续涂抹）', icon: 'none' });
    if (next === 'erase') wx.showToast({ title: '擦除已选中（长按拖动可连续擦除）', icon: 'none' });
    if (next === 'delete') wx.showToast({ title: '批量删除同色已选中', icon: 'none' });
    if (next === 'replace') wx.showToast({ title: '批量换色已选中', icon: 'none' });
    if (next === 'select') wx.showToast({ title: '选区已选中', icon: 'none' });
    if (prev === 'select' && next !== 'select') this._clearSelection();
  },

  _pushAction(changes, title) {
    const arr = Array.isArray(changes) ? changes : [];
    if (!arr.length) return;
    this._undoStack = this._undoStack || [];
    this._redoStack = [];
    const tool = this.data.activeTool;
    const toolLabel = this.data.activeToolLabel || this._toolLabel(tool);
    const nextTitle = title || (toolLabel ? toolLabel : '操作');
    this._undoStack.push({ changes: arr, title: nextTitle, ts: Date.now() });
    this.setData({ undoCount: this._undoStack.length, redoCount: 0 });
  },

  _applyUndoSteps(stepCount) {
    const count = Math.max(0, Math.floor(Number(stepCount) || 0));
    if (!count) return;
    if (!this._undoStack || !this._undoStack.length) return;
    const steps = Math.min(count, this._undoStack.length);
    this._redoStack = this._redoStack || [];
    for (let i = 0; i < steps; i++) {
      const action = this._undoStack.pop();
      if (action && Array.isArray(action.changes)) {
        action.changes.forEach((c) => {
          this._pixelHexes[c.index] = c.prev;
        });
      }
      this._redoStack.push(action);
    }
    this.setData({ undoCount: this._undoStack.length, redoCount: this._redoStack.length });
    this._recomputeStats();
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
  },

  _applyRedoSteps(stepCount) {
    const count = Math.max(0, Math.floor(Number(stepCount) || 0));
    if (!count) return;
    if (!this._redoStack || !this._redoStack.length) return;
    const steps = Math.min(count, this._redoStack.length);
    this._undoStack = this._undoStack || [];
    for (let i = 0; i < steps; i++) {
      const action = this._redoStack.pop();
      if (action && Array.isArray(action.changes)) {
        action.changes.forEach((c) => {
          this._pixelHexes[c.index] = c.next;
        });
      }
      this._undoStack.push(action);
    }
    this.setData({ undoCount: this._undoStack.length, redoCount: this._redoStack.length });
    this._recomputeStats();
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
  },

  _undoToLength(targetUndoLen) {
    const target = Math.max(0, Math.floor(Number(targetUndoLen) || 0));
    const cur = this._undoStack ? this._undoStack.length : 0;
    if (target === cur) return;
    if (target < cur) {
      this._applyUndoSteps(cur - target);
      return;
    }
    const redoLen = this._redoStack ? this._redoStack.length : 0;
    const need = Math.min(target - cur, redoLen);
    if (need) this._applyRedoSteps(need);
  },

  _refreshHistoryList() {
    const undo = Array.isArray(this._undoStack) ? this._undoStack : [];
    const list = undo
      .slice()
      .reverse()
      .map((a, i) => {
        const index = undo.length - 1 - i;
        return {
          key: `u_${index}`,
          title: a && a.title ? a.title : '操作',
          count: a && Array.isArray(a.changes) ? a.changes.length : 0,
          targetUndoLen: index + 1
        };
      });
    this.setData({ historyUndoList: list });
  },

  _applyToolAt(index, currentHex) {
    const tool = this.data.activeTool;
    if (tool === 'picker') {
      const hex = String(currentHex || '');
      if (!hex) {
        wx.showToast({ title: '该格无颜色', icon: 'none' });
        return;
      }
      const code = this._getCodeForHex(hex, this.data.selectedBrand) || '';
      const brushTextColor = this._getTextColorForHex(hex);
      this.setData({ brushHex: hex, brushCode: code, brushTextColor, showBrushPicker: false }, () => {
        this._addRecentHex(hex);
        this._setActiveTool('brush');
      });
      wx.showToast({ title: `已取色 ${code || hex}`, icon: 'none' });
      if (typeof wx.vibrateShort === 'function') wx.vibrateShort({ type: 'light' });
      return;
    }
    if (tool === 'brush') {
      const hex = this.data.brushHex;
      if (!/^#([0-9a-fA-F]{6})$/.test(String(hex || ''))) {
        wx.showToast({ title: '请先选择画笔颜色', icon: 'none' });
        this.onOpenBrushPicker();
        return;
      }
      this._applyCellChange(index, hex);
      return;
    }
    if (tool === 'erase') {
      this._applyCellChange(index, '');
      return;
    }
    if (tool === 'delete') {
      if (!currentHex) {
        wx.showToast({ title: '该色块没有颜色', icon: 'none' });
        return;
      }
      this._bulkClearColor(currentHex);
      return;
    }
    if (tool === 'replace') {
      this._handleReplaceTap(currentHex);
    }
  },

  _applyCellChange(index, nextHex) {
    const hexes = this._pixelHexes;
    if (!hexes || index < 0 || index >= hexes.length) return;
    const next = nextHex || '';
    const indices = this._getSymmetryIndices(index);
    const changes = [];
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (idx < 0 || idx >= hexes.length) continue;
      const prev = hexes[idx] || '';
      if (prev === next) continue;
      hexes[idx] = next;
      changes.push({ index: idx, prev, next });
    }
    if (!changes.length) return;
    this._pushAction(changes);
    this._recomputeStats();
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
  },

  _getSymmetryIndices(index) {
    const g = Math.max(0, Math.floor(Number(this.data.gridSize) || 0));
    if (!g) return [index];
    const mode = String(this.data.symmetryMode || 'off');
    if (!mode || mode === 'off') return [index];
    const x = index % g;
    const y = Math.floor(index / g);
    const set = new Set([index]);
    const mx = g - 1 - x;
    const my = g - 1 - y;
    if (mode === 'h' || mode === 'hv') set.add(y * g + mx);
    if (mode === 'v' || mode === 'hv') set.add(my * g + x);
    if (mode === 'hv') set.add(my * g + mx);
    return Array.from(set);
  },

  _bulkClearColor(targetHex) {
    const hexes = this._pixelHexes;
    if (!hexes || !targetHex) return;
    const changes = [];
    for (let i = 0; i < hexes.length; i++) {
      if (hexes[i] === targetHex) {
        changes.push({ index: i, prev: targetHex, next: '' });
        hexes[i] = '';
      }
    }
    this._pushAction(changes);
    this._recomputeStats();
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
    const code = this._getCodeForHex(targetHex, this.data.selectedBrand);
    const label = code ? code : '未知';
    wx.showToast({ title: changes.length ? `${label} 已删除${changes.length}个` : '没有可删除的色块', icon: 'none' });
  },

  _handleReplaceTap(currentHex) {
    const phase = this.data.replacePhase || 1;
    if (phase === 1) {
      if (!currentHex) {
        wx.showToast({ title: '请点一个有颜色的色块', icon: 'none' });
        return;
      }
      this.setData({ replacePhase: 2, replaceSourceHex: currentHex });
      const code = this._getCodeForHex(currentHex, this.data.selectedBrand);
      const label = code ? code : '未知';
      wx.showToast({ title: `已选源色 ${label}，选目标色`, icon: 'none' });
      return;
    }
    if (phase === 2) {
      if (!currentHex) {
        wx.showToast({ title: '请点一个有颜色的色块', icon: 'none' });
        return;
      }
      this._commitReplaceTo(currentHex);
    }
  },

  _commitReplaceTo(targetHex) {
    const sourceHex = this.data.replaceSourceHex;
    if (!sourceHex || !targetHex || sourceHex === targetHex) {
      this.setData({ replacePhase: 1, replaceSourceHex: '' });
      wx.showToast({ title: '未发生替换', icon: 'none' });
      return;
    }
    this._showReplaceConfirm(sourceHex, targetHex);
  },

  _showReplaceConfirm(sourceHex, targetHex) {
    if (this._replaceConfirming) return;
    const hexes = this._pixelHexes;
    if (!hexes || !hexes.length) return;
    const srcCode = this._getCodeForHex(sourceHex, this.data.selectedBrand) || '未知';
    const dstCode = this._getCodeForHex(targetHex, this.data.selectedBrand) || '未知';
    let count = 0;
    for (let i = 0; i < hexes.length; i++) {
      if (hexes[i] === sourceHex) count++;
    }
    this._replaceConfirming = true;
    wx.showModal({
      title: '确认批量换色',
      content: `源色号：${srcCode}\n目标色号：${dstCode}\n预计替换：${count}个`,
      confirmText: '替换',
      cancelText: '取消',
      success: (res) => {
        this._replaceConfirming = false;
        if (res && res.confirm) {
          this._applyReplaceNow(sourceHex, targetHex, srcCode, dstCode);
        }
      },
      fail: () => {
        this._replaceConfirming = false;
      }
    });
  },

  _applyReplaceNow(sourceHex, targetHex, srcCode, dstCode) {
    const hexes = this._pixelHexes;
    if (!hexes || !hexes.length) return;
    const changes = [];
    for (let i = 0; i < hexes.length; i++) {
      if (hexes[i] === sourceHex) {
        changes.push({ index: i, prev: sourceHex, next: targetHex });
        hexes[i] = targetHex;
      }
    }
    this._pushAction(changes);
    this._recomputeStats();
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
    this.setData({ replacePhase: 1, replaceSourceHex: '' });
    const sc = srcCode || (this._getCodeForHex(sourceHex, this.data.selectedBrand) || '未知');
    const dc = dstCode || (this._getCodeForHex(targetHex, this.data.selectedBrand) || '未知');
    wx.showToast({ title: changes.length ? `${sc}→${dc} ${changes.length}个` : `${sc}→${dc} 0个`, icon: 'none' });
  },

  _canPaintDrag() {
    const tool = this.data.activeTool;
    return tool === 'brush' || tool === 'erase';
  },

  _startLongPressTimer(clientX, clientY) {
    if (this.data.continuousMode) return;
    if (!this._canPaintDrag()) return;
    const tool = this.data.activeTool;
    if (tool === 'brush' && !/^#([0-9a-fA-F]{6})$/.test(String(this.data.brushHex || ''))) return;
    this._longPressTimer = setTimeout(() => {
      if (this._touchMode !== 'pan') return;
      if (this._panMoved) return;
      if (!this._canPaintDrag()) return;
      this._touchMode = 'paint';
      this._paintLastIndex = -1;
      this._beginPaintStroke();
      this._applyPaintAtClient(clientX, clientY);
    }, 260);
  },

  _clearLongPressTimer() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  },

  _beginPaintStroke() {
    const tool = this.data.activeTool;
    if (tool === 'brush') {
      const hex = this.data.brushHex;
      if (!/^#([0-9a-fA-F]{6})$/.test(String(hex || ''))) {
        wx.showToast({ title: '请先选择画笔颜色', icon: 'none' });
        this.onOpenBrushPicker();
        this._touchMode = 'pan';
        return;
      }
      this._strokeNextHex = hex;
    } else {
      this._strokeNextHex = '';
    }
    this._strokeChanges = [];
    this._strokeChangeMap = Object.create(null);
    this._strokeDirtyStats = false;
  },

  _endPaintStroke() {
    if (this._strokeChanges && this._strokeChanges.length) {
      this._pushAction(this._strokeChanges);
    }
    if (this._strokeDirtyStats) this._recomputeStats();
    this._strokeChanges = null;
    this._strokeChangeMap = null;
    this._strokeDirtyStats = false;
    this._strokeNextHex = null;
  },

  _applyPaintAtClient(clientX, clientY) {
    const hit = this._hitTestCell(clientX, clientY);
    if (!hit) return;
    if (hit.index === this._paintLastIndex) return;
    this._paintLastIndex = hit.index;
    const tool = this.data.activeTool;
    if (tool !== 'brush' && tool !== 'erase') return;
    const nextHex = tool === 'brush' ? this._strokeNextHex : '';
    this._applyCellChangeInStroke(hit.index, nextHex);
  },

  _applyCellChangeInStroke(index, nextHex) {
    const hexes = this._pixelHexes;
    if (!hexes || index < 0 || index >= hexes.length) return;
    const next = nextHex || '';
    const map = this._strokeChangeMap || (this._strokeChangeMap = Object.create(null));
    const indices = this._getSymmetryIndices(index);
    let changed = false;
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (idx < 0 || idx >= hexes.length) continue;
      const prev = hexes[idx] || '';
      if (prev === next) continue;
      hexes[idx] = next;
      const key = String(idx);
      if (!map[key]) {
        const c = { index: idx, prev, next };
        map[key] = c;
        (this._strokeChanges || (this._strokeChanges = [])).push(c);
      } else {
        map[key].next = next;
      }
      changed = true;
    }
    if (!changed) return;
    this._strokeDirtyStats = true;
    this._scheduleBoardDraw();
    this._scheduleRulerDraw();
  },

  _getCodeForHex(hex, brand) {
    this._ensurePaletteReady();
    const h = String(hex || '');
    const b = String(brand || '');
    const mapping = this._mapping || {};
    const code = (mapping[h] && mapping[h][b]) ? mapping[h][b] : '';
    return String(code || '').trim();
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

  _ensureExportCanvasReady(done) {
    if (this._exportCanvas && this._exportCtx) {
      done(true);
      return;
    }
    const query = wx.createSelectorQuery();
    query.select('#exportCanvas').fields({ node: true, size: true }).exec((res) => {
      const node = res && res[0] ? res[0].node : null;
      if (!node) {
        done(false);
        return;
      }
      this._exportCanvas = node;
      this._exportCtx = node.getContext('2d');
      this._exportDpr = wx.getSystemInfoSync().pixelRatio || 1;
      done(true);
    });
  },

  _exportToTempFilePath(done) {
    const ctx = this._exportCtx;
    const canvas = this._exportCanvas;
    if (!ctx || !canvas) {
      done(new Error('no export canvas'));
      return;
    }

    const grid = Math.max(16, Math.min(128, this.data.gridSize));
    const hexes = this._pixelHexes;
    if (!hexes || hexes.length !== grid * grid) {
      done(new Error('no pixels'));
      return;
    }

    const dpr = Math.max(1, Math.min(3, this._exportDpr || 1));
    const targetBoard = 1080;
    const cellPx = Math.max(10, Math.min(42, Math.floor(targetBoard / grid)));
    const boardPx = cellPx * grid;
    const pad = 24;
    const showRuler = !!this.data.exportShowRuler;
    const rulerPx = showRuler ? Math.max(28, Math.round(cellPx * 1.25)) : 0;

    const specOpt = (this.data.exportSpecOptions || [])[this.data.exportSpecIndex] || { key: 'cm' };
    const footerH = specOpt.key && specOpt.key !== 'off' ? 38 : 0;
    const outW = pad * 2 + rulerPx + boardPx;
    const outH = pad * 2 + rulerPx + boardPx + footerH;

    canvas.width = Math.max(1, Math.round(outW * dpr));
    canvas.height = Math.max(1, Math.round(outH * dpr));
    if (typeof ctx.resetTransform === 'function') ctx.resetTransform();
    else if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, outW, outH);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outW, outH);

    const ox = pad + rulerPx;
    const oy = pad + rulerPx;

    if (showRuler) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(pad + rulerPx, pad, boardPx, rulerPx);
      ctx.fillRect(pad, pad + rulerPx, rulerPx, boardPx);

      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad + rulerPx, pad + rulerPx - 0.5);
      ctx.lineTo(pad + rulerPx + boardPx, pad + rulerPx - 0.5);
      ctx.moveTo(pad + rulerPx - 0.5, pad + rulerPx);
      ctx.lineTo(pad + rulerPx - 0.5, pad + rulerPx + boardPx);
      ctx.stroke();

      const step = this._pickRulerStep(cellPx);
      const fontSize = Math.max(10, Math.min(14, Math.round(rulerPx * 0.38)));
      ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial`;
      ctx.fillStyle = 'rgba(29,29,31,0.72)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      for (let i = 0; i < grid; i += step) {
        const x = ox + (i + 0.5) * cellPx;
        ctx.fillText(String(i), x, pad + rulerPx / 2);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, pad + rulerPx - Math.max(6, Math.round(rulerPx * 0.28)));
        ctx.lineTo(x + 0.5, pad + rulerPx - 1);
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < grid; i += step) {
        const y = oy + (i + 0.5) * cellPx;
        ctx.fillText(String(i), pad + rulerPx / 2, y);
        ctx.beginPath();
        ctx.moveTo(pad + rulerPx - Math.max(6, Math.round(rulerPx * 0.28)), y + 0.5);
        ctx.lineTo(pad + rulerPx - 1, y + 0.5);
        ctx.stroke();
      }
    }

    const showCodes = !!this.data.exportShowCodes;
    const brand = showCodes ? this.data.selectedBrand : null;
    if (showCodes) {
      this._ensurePaletteReady();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.max(8, Math.floor(cellPx * 0.42))}px sans-serif`;
    }

    const showGrid = !!this.data.exportShowGrid;

    for (let y = 0; y < grid; y++) {
      const y0 = oy + y * cellPx;
      for (let x = 0; x < grid; x++) {
        const hex = hexes[y * grid + x];
        if (!hex) continue;
        const x0 = ox + x * cellPx;
        ctx.fillStyle = hex;
        ctx.fillRect(x0, y0, cellPx, cellPx);

        if (showCodes && brand) {
          const code = this._getCodeForHex(hex, brand);
          if (code) {
            ctx.fillStyle = this._getTextColorForHex(hex);
            ctx.fillText(code, x0 + cellPx / 2, y0 + cellPx / 2);
          }
        }
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, boardPx - 1, boardPx - 1);

    if (showGrid) {
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < grid; i++) {
        const p = i * cellPx;
        ctx.moveTo(ox + p + 0.5, oy);
        ctx.lineTo(ox + p + 0.5, oy + boardPx);
        ctx.moveTo(ox, oy + p + 0.5);
        ctx.lineTo(ox + boardPx, oy + p + 0.5);
      }
      ctx.stroke();
    }

    if (specOpt.key && specOpt.key !== 'off') {
      const lines = [];
      lines.push(`规格：${grid}×${grid} 格`);
      if (specOpt.key === 'cm') {
        const beadMmRaw = this.data.exportBeadMm;
        const beadMm = Math.max(1, Math.min(20, Number(beadMmRaw) || 5));
        const cm = (grid * beadMm) / 10;
        lines.push(`约 ${cm.toFixed(1)}×${cm.toFixed(1)} cm（${beadMm}mm/颗）`);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(29,29,31,0.74)';
      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial';
      const lineH = 16;
      const x = outW - pad;
      let y = outH - pad;
      for (let i = lines.length - 1; i >= 0; i--) {
        ctx.fillText(lines[i], x, y);
        y -= lineH;
      }
    }

    wx.canvasToTempFilePath({
      canvas,
      fileType: 'png',
      quality: 1,
      success: (res) => {
        done(null, res ? res.tempFilePath : '');
      },
      fail: (err) => {
        done(err || new Error('canvasToTempFilePath fail'));
      }
    });
  },

  _saveImageToAlbum(filePath, done) {
    wx.getSetting({
      success: (res) => {
        const ok = res && res.authSetting ? !!res.authSetting['scope.writePhotosAlbum'] : false;
        if (ok) {
          wx.saveImageToPhotosAlbum({
            filePath,
            success: () => done(null),
            fail: (err) => done(err || new Error('save fail'))
          });
          return;
        }
        wx.authorize({
          scope: 'scope.writePhotosAlbum',
          success: () => {
            wx.saveImageToPhotosAlbum({
              filePath,
              success: () => done(null),
              fail: (err) => done(err || new Error('save fail'))
            });
          },
          fail: () => {
            wx.openSetting({
              success: () => {
                wx.getSetting({
                  success: (res2) => {
                    const ok2 = res2 && res2.authSetting ? !!res2.authSetting['scope.writePhotosAlbum'] : false;
                    if (!ok2) {
                      done(new Error('no auth'));
                      return;
                    }
                    wx.saveImageToPhotosAlbum({
                      filePath,
                      success: () => done(null),
                      fail: (err) => done(err || new Error('save fail'))
                    });
                  },
                  fail: () => done(new Error('no auth'))
                });
              },
              fail: () => done(new Error('no auth'))
            });
          }
        });
      },
      fail: () => done(new Error('no setting'))
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

  _scheduleBoardDraw() {
    if (this._boardDrawPending) return;
    this._boardDrawPending = true;
    setTimeout(() => {
      this._boardDrawPending = false;
      this._drawBoard();
    }, 16);
  },

  _reflowLayout() {
    const sys = wx.getSystemInfoSync();
    const pad = 14;
    const headerHeight = this.data.headerHeight || 44;
    const safe = sys && sys.safeArea ? sys.safeArea : null;
    const safeInsetLeft = safe ? Math.max(0, Math.floor(safe.left || 0)) : 0;
    const safeInsetRight = safe ? Math.max(0, Math.floor((sys.windowWidth || 0) - (safe.right || sys.windowWidth || 0))) : 0;
    const safeInsetTop = safe ? Math.max(0, Math.floor(safe.top || 0)) : 0;
    const safeInsetBottom = safe ? Math.max(0, Math.floor((sys.windowHeight || 0) - (safe.bottom || sys.windowHeight || 0))) : 0;
    const layoutW = safe ? Math.max(0, Math.floor((safe.right || sys.windowWidth || 0) - (safe.left || 0))) : (sys.windowWidth || 0);

    const toolbarExpandedWidth = Math.max(260, Math.min(340, Math.floor(layoutW * 0.28)));
    const toolbarWidth = this.data.toolbarCollapsed ? this.data.toolbarCollapsedWidth : toolbarExpandedWidth;
    const useShortRightToggleLabel = layoutW <= 720;
    const useShortLeftToggleLabel = layoutW <= 720;

    const leftDockLeft = Math.max(14, safeInsetLeft + 14);
    const leftDockToggleLeft = leftDockLeft;
    const leftDockExpandedWidth = Math.max(200, Math.min(300, Math.floor(layoutW * 0.28)));
    const leftDockOccupied = this.data.leftDockCollapsed ? 0 : leftDockExpandedWidth;

    const rightPanelRight = safeInsetRight + 14;
    const rightOccupied = this.data.toolbarCollapsed ? 0 : toolbarWidth;
    const rightPanelLeft = sys.windowWidth - rightPanelRight - rightOccupied;
    const gap = 12;
    const baseLeft = safeInsetLeft + pad;
    const baseRight = (safe ? Math.floor(safe.right || sys.windowWidth || 0) : sys.windowWidth) - pad;
    let leftBound = Math.max(baseLeft, leftDockLeft + leftDockOccupied + (leftDockOccupied ? gap : 0));
    let rightBound = rightOccupied ? Math.min(baseRight, rightPanelLeft - gap) : baseRight;
    if (rightBound - leftBound < 240) {
      leftBound = baseLeft;
      rightBound = baseRight;
    }

    const rulerPad = this.data.showRuler ? this.data.rulerSize : 0;
    const availableW = Math.max(1, rightBound - leftBound) - rulerPad - 24;
    const availableH = sys.windowHeight - headerHeight - pad * 2 - 24;
    const boardSize = Math.max(240, Math.floor(Math.min(availableW, availableH)));
    const boardWrapSize = boardSize + rulerPad;
    const statsColumns = this.data.toolbarCollapsed ? 1 : 2;
    const landW = Math.max(1, sys.windowWidth - pad * 2);
    const landH = Math.max(1, sys.windowHeight - headerHeight - pad * 2);
    const boardCenterXWindow = Math.round((leftBound + rightBound) / 2);
    const boardCenterLeft = Math.round(boardCenterXWindow - pad);
    const boardLeft = Math.round(boardCenterLeft - boardWrapSize / 2);
    const boardTop = Math.round((landH - boardWrapSize) / 2);
    const zoomBarWidth = 44;
    const zoomBarLeft = Math.max(0, boardLeft - zoomBarWidth);
    const zoomBarTop = Math.max(0, boardTop);
    const zoomBarHeight = Math.max(120, boardWrapSize);
    const helpSize = 36;
    const helpLeftBase = boardLeft + boardWrapSize + 18;
    const helpBtnLeft = Math.max(0, Math.min(landW - helpSize, helpLeftBase));
    const helpTopBase = boardTop + 40;
    const helpBtnTop = Math.max(0, Math.min(landH - helpSize, helpTopBase));
    this._zoomRectDirty = true;
    this.setData(
      {
        boardSize,
        boardWrapSize,
        boardCenterLeft,
        helpBtnLeft,
        helpBtnTop,
        safeInsetLeft,
        safeInsetRight,
        safeInsetTop,
        safeInsetBottom,
        toolbarWidth,
        toolbarExpandedWidth,
        sideWidth: toolbarWidth,
        statsColumns,
        zoomBarLeft,
        zoomBarTop,
        zoomBarHeight,
        useShortRightToggleLabel,
        leftDockLeft,
        leftDockToggleLeft,
        leftDockExpandedWidth,
        useShortLeftToggleLabel
      },
      () => {
      this._syncZoomHandle();
      this._viewportRectDirty = true;
      this._resizeCanvas();
      this._resizeRulerCanvases();
      this._ensureZoomRect();
      this._drawBoard();
      this._drawRulers();
      }
    );
  },

  _ensureZoomRect(done) {
    if (this._zoomRect && !this._zoomRectDirty) {
      done && done();
      return;
    }
    const query = wx.createSelectorQuery();
    query.select('#zoomBar').boundingClientRect().exec((res) => {
      if (res && res[0]) {
        this._zoomRect = res[0];
        this._zoomRectDirty = false;
        console.log('ZoomBar Rect updated:', res[0]);
      } else {
        console.error('ZoomBar Rect not found');
      }
      done && done();
    });
  },

  _clampZoomPercent(p) {
    const min = this.data.zoomMinPercent || 60;
    const max = this.data.zoomMaxPercent || 1200;
    const v = Math.round(Number(p) || 0);
    return Math.max(min, Math.min(max, v));
  },

  _scaleToZoomPercent(scale) {
    return this._clampZoomPercent((Number(scale) || 1) * 100);
  },

  _syncZoomHandle() {
    const h = Math.max(1, Number(this.data.zoomBarHeight) || 0);
    const handleSize = 18;
    const min = this.data.zoomMinPercent || 60;
    const max = this.data.zoomMaxPercent || 1200;
    const v = this._clampZoomPercent(this.data.zoomPercent);
    const ratio = (max - v) / Math.max(1, max - min);
    const top = Math.round(ratio * Math.max(0, h - handleSize));
    if (top !== this.data.zoomHandleTop || v !== this.data.zoomPercent) {
      this.setData({ zoomHandleTop: top, zoomPercent: v });
    }
  },

  _updateZoomByClientY(clientY) {
    const rect = this._zoomRect;
    if (!rect) return;
    const min = this.data.zoomMinPercent || 60;
    const max = this.data.zoomMaxPercent || 1200;
    const handleSize = 18;
    const range = Math.max(1, rect.height - handleSize);
    const y = Math.max(0, Math.min(range, (clientY - rect.top) - handleSize / 2));
    const ratio = y / range;
    const percent = this._clampZoomPercent(max - ratio * (max - min));
    const nextScale = this._clampScale(percent / 100);
    const clamped = this._clampTranslate(this.data.viewX || 0, this.data.viewY || 0, nextScale);
    this.setData({ zoomPercent: percent, viewScale: nextScale, viewX: clamped.x, viewY: clamped.y }, () => {
      this._syncZoomHandle();
      this._scheduleBoardDraw();
      this._scheduleRulerDraw();
    });
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
      const scale = this.data.viewScale || 1;
      const tx = this.data.viewX || 0;
      const ty = this.data.viewY || 0;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);
      
      const showCodes = this.data.showCellCodes;
      const mapping = showCodes ? (this._mapping || {}) : null;
      const brand = showCodes ? this.data.selectedBrand : null;
      const highlightBeads = !!this.data.highlightBeads;
      const focusHex = highlightBeads ? String(this.data.highlightFocusHex || '') : '';
      const focusHexes = highlightBeads
        ? (Array.isArray(this.data.highlightFocusHexes) ? this.data.highlightFocusHexes : (focusHex ? [focusHex] : []))
        : [];
      const focusMap = highlightBeads ? (this.data.highlightFocusMap || {}) : null;
      const hasFocus = highlightBeads && !!focusHexes.length;
      const highlightMode = highlightBeads ? String(this.data.highlightMode || 'dim') : 'dim';
      const alphaAll = 0.45;
      const alphaOther = 0.22;
      
      if (showCodes) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${cell * 0.4}px sans-serif`;
      }

      for (let y = 0; y < grid; y++) {
        for (let x = 0; x < grid; x++) {
          const hex = hexes[y * grid + x];
          if (!hex) continue;
          const isFocus = hasFocus && focusMap && !!focusMap[hex];
          if (highlightBeads && hasFocus && isFocus) continue;
          if (!highlightBeads) ctx.globalAlpha = alphaAll;
          else if (hasFocus) {
            if (highlightMode === 'hide') continue;
            ctx.globalAlpha = alphaOther;
          }
          else ctx.globalAlpha = 1;
          ctx.fillStyle = hex;
          const x0 = xs[x];
          const x1 = xs[x + 1];
          const y0 = ys[y];
          const y1 = ys[y + 1];
          const w = x1 - x0;
          const h = y1 - y0;
          ctx.fillRect(x0, y0, w, h);

          if (showCodes && mapping && brand) {
            const code = (mapping[hex] && mapping[hex][brand]) ? mapping[hex][brand] : '';
            if (code) {
              const textColor = this._getTextColorForHex(hex);
              ctx.fillStyle = textColor;
              ctx.fillText(code, x0 + w / 2, y0 + h / 2);
            }
          }
        }
      }

      if (highlightBeads && hasFocus) {
        ctx.globalAlpha = 1;
        for (let y = 0; y < grid; y++) {
          for (let x = 0; x < grid; x++) {
            const hex = hexes[y * grid + x];
            if (!hex || !focusMap || !focusMap[hex]) continue;
            ctx.fillStyle = hex;
            const x0 = xs[x];
            const x1 = xs[x + 1];
            const y0 = ys[y];
            const y1 = ys[y + 1];
            const w = x1 - x0;
            const h = y1 - y0;
            ctx.fillRect(x0, y0, w, h);

            const lw = 2 / Math.max(0.0001, scale);
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(255,106,0,0.92)';
            ctx.lineWidth = lw;
            ctx.strokeRect(x0 + lw / 2, y0 + lw / 2, w - lw, h - lw);
            ctx.restore();

            if (showCodes && mapping && brand) {
              const code = (mapping[hex] && mapping[hex][brand]) ? mapping[hex][brand] : '';
              if (code) {
                const textColor = this._getTextColorForHex(hex);
                ctx.fillStyle = textColor;
                ctx.fillText(code, x0 + w / 2, y0 + h / 2);
              }
            }
          }
        }
      }

      const sel = this._selectionBounds;
      if (sel && Number.isFinite(sel.minX) && Number.isFinite(sel.minY) && Number.isFinite(sel.maxX) && Number.isFinite(sel.maxY)) {
        const x0 = xs[Math.max(0, Math.min(grid, sel.minX))];
        const x1 = xs[Math.max(0, Math.min(grid, sel.maxX + 1))];
        const y0 = ys[Math.max(0, Math.min(grid, sel.minY))];
        const y1 = ys[Math.max(0, Math.min(grid, sel.maxY + 1))];
        const lw = 2 / Math.max(0.0001, scale);
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,106,0,0.92)';
        ctx.lineWidth = lw;
        ctx.strokeRect(x0 + lw / 2, y0 + lw / 2, (x1 - x0) - lw, (y1 - y0) - lw);
        ctx.restore();
      }

      const preview = this._selectPreview;
      if (preview && Number.isFinite(preview.minX) && Number.isFinite(preview.minY) && Number.isFinite(preview.maxX) && Number.isFinite(preview.maxY)) {
        const x0 = xs[Math.max(0, Math.min(grid, preview.minX))];
        const x1 = xs[Math.max(0, Math.min(grid, preview.maxX + 1))];
        const y0 = ys[Math.max(0, Math.min(grid, preview.minY))];
        const y1 = ys[Math.max(0, Math.min(grid, preview.maxY + 1))];
        const lw = 2 / Math.max(0.0001, scale);
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,106,0,0.45)';
        ctx.lineWidth = lw;
        ctx.strokeRect(x0 + lw / 2, y0 + lw / 2, (x1 - x0) - lw, (y1 - y0) - lw);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

    if (this.data.showGrid) {
      ctx.save();
      const scale = this.data.viewScale || 1;
      const tx = this.data.viewX || 0;
      const ty = this.data.viewY || 0;
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1 / Math.max(0.0001, scale);
      ctx.beginPath();
      for (let i = 1; i < grid; i++) {
        const p = i * cell;
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
      }
      ctx.stroke();
      ctx.restore();
    }

    this._drawRulers();
  },

  _ensurePaletteReady() {
    if (this._mapping) return;
    this._mapping = require('../../data/color-mapping.js');
  },

  _ensurePaletteList() {
    this._ensurePaletteReady();
    const brand = this.data.selectedBrand;
    const cache = this._paletteListCache || (this._paletteListCache = {});
    if (cache[brand]) {
      if (this.data.paletteList !== cache[brand]) {
        this.setData({ paletteList: cache[brand] }, () => {
          if (this.data.showBrushPicker) this._applyBrushFilter();
        });
      } else if (this.data.showBrushPicker) {
        this._applyBrushFilter();
      }
      return;
    }
    const mapping = this._mapping || {};
    const list = Object.keys(mapping).map((hex) => {
      const code = (mapping[hex] && mapping[hex][brand]) ? mapping[hex][brand] : '-';
      return { key: `${hex}-${code}`, hex, code };
    });
    list.sort((a, b) => this._compareCodes(a.code, b.code));
    cache[brand] = list;
    this.setData({ paletteList: list }, () => {
      if (this.data.showBrushPicker) this._applyBrushFilter();
    });
  },

  _parseSeriesKey(code) {
    const s = String(code || '').trim();
    if (!s || s === '-') return 'OTHER';
    const m = s.match(/^([A-Za-z]{1,2})/);
    if (!m) return 'OTHER';
    return String(m[1] || '').toUpperCase();
  },

  _ensureBrushSeriesOptions() {
    this._ensurePaletteReady();
    const seriesOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M', 'P', 'Q', 'R', 'T', 'Y', 'ZG'];
    const seriesDesc = {
      H: '（H1为透明色）',
      M: '（低饱和莫兰迪）',
      P: '（珠光）',
      Q: '（温变）',
      R: '（透明果冻水晶）',
      T: '（透明）',
      Y: '（夜光）',
      ZG: '（光变）'
    };
    if (this._brushSeriesOptionsBuilt) return;
    const options = [{ key: 'ALL', label: '全部色卡' }];
    seriesOrder.forEach((k) => {
      const desc = seriesDesc[k] ? seriesDesc[k] : '';
      options.push({ key: k, label: `${k} 系列色卡${desc}` });
    });
    options.push({ key: 'OTHER', label: '其它' });
    this._brushSeriesOptionsBuilt = true;
    this.setData({ brushSeriesOptions: options });
  },

  _ensureBrushPaletteListForBrand(brand) {
    this._ensurePaletteReady();
    const mapping = this._mapping || {};
    const b = String(brand || '');
    const cache = this._brushListCache || (this._brushListCache = {});
    if (cache[b]) return cache[b];

    const seriesOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M', 'P', 'Q', 'R', 'T', 'Y', 'ZG'];
    const list = Object.keys(mapping).map((hex) => {
      const mardCode = (mapping[hex] && mapping[hex].MARD) ? mapping[hex].MARD : '-';
      const code = (mapping[hex] && mapping[hex][b]) ? mapping[hex][b] : '-';
      const seriesKey = this._parseSeriesKey(mardCode);
      return { key: `${b}-${hex}-${code}`, hex, code, seriesKey };
    }).filter((it) => it.code && it.code !== '-');

    list.sort((a, b2) => {
      const ia = seriesOrder.indexOf(a.seriesKey);
      const ib = seriesOrder.indexOf(b2.seriesKey);
      const da = ia === -1 ? 999 : ia;
      const db = ib === -1 ? 999 : ib;
      if (da !== db) return da - db;
      return this._compareCodes(a.code, b2.code);
    });

    cache[b] = list;
    return list;
  },

  _applyBrushFilter() {
    this._ensureBrushSeriesOptions();
    const brand = this.data.selectedBrand;
    const base = this._ensureBrushPaletteListForBrand(brand);
    const seriesKey = String(this.data.brushSeriesKey || 'ALL');
    const seriesFiltered = seriesKey && seriesKey !== 'ALL'
      ? base.filter((it) => String(it.seriesKey) === seriesKey)
      : base;
    const raw = String(this.data.brushQuery || '').trim();
    if (!raw) {
      this.setData({ brushPaletteList: seriesFiltered });
      return;
    }
    const q = raw.toLowerCase();
    const next = seriesFiltered.filter((it) => {
      const code = String(it && it.code ? it.code : '').toLowerCase();
      const hex = String(it && it.hex ? it.hex : '').toLowerCase();
      return code.includes(q) || hex.includes(q);
    });
    this.setData({ brushPaletteList: next });
  },

  _loadQuickPalette() {
    try {
      const raw = wx.getStorageSync('bead_quick_palette_v1');
      if (!raw) return { recentHexes: [], favoriteHexes: [] };
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const recentHexes = obj && Array.isArray(obj.recentHexes) ? obj.recentHexes : [];
      const favoriteHexes = obj && Array.isArray(obj.favoriteHexes) ? obj.favoriteHexes : [];
      return { recentHexes, favoriteHexes };
    } catch (e) {
      return { recentHexes: [], favoriteHexes: [] };
    }
  },

  _saveQuickPalette() {
    try {
      const recentHexes = Array.isArray(this.data.recentHexes) ? this.data.recentHexes : [];
      const favoriteHexes = Array.isArray(this.data.favoriteHexes) ? this.data.favoriteHexes : [];
      wx.setStorageSync('bead_quick_palette_v1', { recentHexes, favoriteHexes });
    } catch (e) {
    }
  },

  _refreshQuickPalette() {
    const brand = this.data.selectedBrand;
    const toItem = (hex, idx, prefix) => {
      const h = String(hex || '');
      if (!/^#([0-9a-fA-F]{6})$/.test(h)) return null;
      const code = this._getCodeForHex(h, brand) || h;
      return { key: `${prefix}-${idx}-${h}`, hex: h, code };
    };
    const favoriteHexes = Array.isArray(this.data.favoriteHexes) ? this.data.favoriteHexes : [];
    const recentHexes = Array.isArray(this.data.recentHexes) ? this.data.recentHexes : [];
    const quickFavoriteList = [];
    const quickRecentList = [];
    for (let i = 0; i < favoriteHexes.length && quickFavoriteList.length < 12; i++) {
      const it = toItem(favoriteHexes[i], i, 'fav');
      if (it) quickFavoriteList.push(it);
    }
    for (let i = 0; i < recentHexes.length && quickRecentList.length < 12; i++) {
      const it = toItem(recentHexes[i], i, 'rec');
      if (it) quickRecentList.push(it);
    }
    this.setData({ quickFavoriteList, quickRecentList });
  },

  _addRecentHex(hex) {
    const h = String(hex || '');
    if (!/^#([0-9a-fA-F]{6})$/.test(h)) return;
    const prev = Array.isArray(this.data.recentHexes) ? this.data.recentHexes : [];
    const next = [h, ...prev.filter((x) => String(x) !== h)].slice(0, 20);
    this.setData({ recentHexes: next }, () => {
      this._saveQuickPalette();
      this._refreshQuickPalette();
    });
  },

  _getTextColorForHex(hex) {
    const h = String(hex || '');
    if (!/^#([0-9a-fA-F]{6})$/.test(h)) return '#FFFFFF';
    const r = parseInt(h.slice(1, 3), 16) / 255;
    const g = parseInt(h.slice(3, 5), 16) / 255;
    const b = parseInt(h.slice(5, 7), 16) / 255;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L > 0.62 ? '#1D1D1F' : '#FFFFFF';
  },

  _refreshBrushCode() {
    this._ensurePaletteReady();
    const hex = this.data.brushHex;
    const brand = this.data.selectedBrand;
    const mapping = this._mapping || {};
    const code = (mapping[hex] && mapping[hex][brand]) ? mapping[hex][brand] : '';
    const brushTextColor = this._getTextColorForHex(hex);
    this.setData({ brushCode: code, brushTextColor });
  },

  _parseCode(raw) {
    const s = String(raw || '').trim();
    if (!s || s === '-') return { raw: s, empty: true, prefix: '', num: Infinity, isNum: false };
    if (/^\d+$/.test(s)) return { raw: s, empty: false, prefix: '', num: parseInt(s, 10), isNum: true };
    const m = s.match(/^([A-Za-z]+)?(\d+)?/);
    const prefix = m && m[1] ? m[1].toUpperCase() : '';
    const num = m && m[2] ? parseInt(m[2], 10) : Infinity;
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
    this.setData({ statsTotalBeads: total, statsTotalColors: list.length, statsList: list }, () => {
      this._drawBoard();
    });
  }
});
