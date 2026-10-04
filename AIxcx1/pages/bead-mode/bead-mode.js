const colorData = require('../../data/color-data.js');
const colorMatching = require('../../utils/color-matching.js');

Page({
  data: {
    cellSize: 24,
    canvasWidth: 0,
    canvasHeight: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    safeAreaTop: 0,
    safeAreaBottom: 0,
    safeAreaLeft: 0,
    headerHeight: 44,
    headerBarHeight: 44,
    canvasContainerLeft: 0,
    canvasContainerTop: 0,
    yAxisWidth: 30,
    xAxisHeight: 40,
    showColorPalette: false,
    brands: [],
    selectedBrand: null,
    selectedSeries: null,
    selectedColor: null,
    currentSeriesList: [],
    currentColorList: [],
    expandedSeries: {},
    expandedBrands: {},
    groupedColors: [],
    isDrawMode: false,
    eraserMode: false,
    eyedropperMode: false,
    gridWidth: 32,
    gridHeight: 32,
    previewSize: { width: 120, height: 120 },
    gridCycleInterval: 5,
    beadColors: {},
    beadColorCodes: {},
    recentColors: [],
    touchStartTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    isLoading: false,
    paletteIconColor: '#8e8e93',
    paletteColorCode: '',
    isSearching: false,
    searchKeyword: '',
    searchResults: [],
    allColors: [],
    brandColumnExpanded: true,
    currentCoordX: 0,
    currentCoordY: 0,
    xAxisLabels: [],
    yAxisLabels: [],
    exportStatsTotal: 0,
    exportPreviewScale: 100,
    exportShowHexCode: false,
    exportFontSize: 'medium',
    showSettings: false,
    showGridLines: true,
    showCenterCross: true,
    showAuxiliaryLines: true,
    showAreaBorder: true,
    showColorCodes: false,
    areaBorderColor: 'blue',
    gridLineColor: 'light',
    beadShape: 'square',
    showMiniMap: true,
    miniMapSize: 100,
    miniMapScale: 1,
    miniMapOffsetX: 0,
    miniMapOffsetY: 0,
    miniMapBeadCount: 0,
    undoStack: [],
    redoStack: [],
    maxHistory: 30,
    toolbarExpanded: false,
    quickButtons: {
      left: { id: 'palette', iconClass: 'icon-palette', name: '色盘' },
      center: { id: 'brush', iconClass: 'icon-brush-5', name: '画笔' },
      right: { id: 'eraser', iconClass: 'icon-eraser', name: '橡皮' }
    },
    // 魔棒工具相关
    magicWandMode: false,  // 是否启用魔棒模式
    selection: null,  // 当前选区
    selectionMenuVisible: false,  // 选区菜单是否显示
    selectionMenuX: 0,  // 菜单位置
    selectionMenuY: 0,
    clipboard: null,  // 剪贴板
    // 手势识别相关
    touchStartTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    isLongPress: false,
    longPressTimer: null,
    hasMoved: false,
    // 框选相关
    isSelecting: false,
    selectStartX: 0,
    selectStartY: 0,
    selectEndX: 0,
    selectEndY: 0,
    
    // 导出相关
    showExportModal: false,
    exportShowGrid: true,
    exportShowRuler: true,
    exportShowColorCode: false,
    exportAuxGridIndex: 1,  // 0: 无, 1: 5格, 2: 10格
    exportGridSize: 5,
    exportPreviewUrl: '',
    isExporting: false,
    exportStatsList: [],  // 颜色统计列表
    
    toolbarTools: [
      { id: 'magic', iconClass: 'icon-magic', name: '魔棒' },
      { id: 'brush', iconClass: 'icon-brush-5', name: '画笔' },
      { id: 'eraser', iconClass: 'icon-eraser', name: '橡皮' },
      { id: 'palette', iconClass: 'icon-palette', name: '色盘' },
      { id: 'importImage', iconClass: 'icon-image', name: '导入' },
      { id: 'export', iconClass: 'icon-export', name: '导出' },
      { id: 'publish', iconClass: 'icon-share', name: '发布' },
      { id: 'eyedropper', iconClass: 'icon-eyedropper', name: '取色' },
      { id: 'undo', iconClass: 'icon-undo', name: '撤销' },
      { id: 'redo', iconClass: 'icon-redo', name: '重做' },
      { id: 'zoomIn', iconClass: 'icon-zoom-in', name: '放大' },
      { id: 'zoomOut', iconClass: 'icon-zoom-out', name: '缩小' },
      { id: 'origin', iconClass: 'icon-origin', name: '原点' },
      { id: 'settings', iconClass: 'icon-settings', name: '设置' }
    ],
    draggingTool: null,
    dragStartX: 0,
    dragStartY: 0,
    dragCurrentX: 0,
    dragCurrentY: 0,
    dragTarget: null,
    showTooltip: false,
    tooltipText: '',
    tooltipSide: '',
    scrollEnabled: true,
    // 发布弹窗
    showPublishModal: false,
    publishTitle: '',
    publishDescription: '',
    publishIsPublic: true,
    publishPreviewUrl: '',
    isPublishing: false,
    // 画笔设置
    showBrushSettings: false,
    brushSettingsTarget: null, // 'brush' 或 'eraser'
    brushSettingsX: 0, // 面板显示位置X
    brushSettingsY: 0, // 面板显示位置Y
    brushSize: 1, // 1, 2, 3
    // 选择器弹窗
    showColorPicker: false,
    showShapePicker: false,
    showSizePicker: false,
    showIntervalPicker: false,
    showBorderColorPicker: false,
    showHighlightColorPicker: false,
    showHighlightStylePicker: false,
    // 颜色名称映射
    gridLineColorName: '浅灰',
    // 颜色值映射
    gridColors: {
      light: '#e5e5ea',
      dark: '#c7c7cc',
      blue: '#007aff',
      green: '#34c759',
      pink: '#ff2d55',
      purple: '#af52de',
      orange: '#ff9500',
      red: '#ff3b30'
    },
    // 颜色名称映射
    gridColorNames: {
      light: '浅灰',
      dark: '深灰',
      blue: '蓝色',
      green: '绿色',
      pink: '粉色',
      purple: '紫色',
      orange: '橙色',
      red: '红色'
    },
    // 边框颜色
    areaBorderColors: {
      blue: '#007aff',
      green: '#34c759',
      pink: '#ff2d55',
      purple: '#af52de',
      orange: '#ff9500',
      red: '#ff3b30',
      gray: '#8e8e93',
      black: '#1c1c1e'
    },
    // 边框颜色名称
    areaBorderColorNames: {
      blue: '蓝色',
      green: '绿色',
      pink: '粉色',
      purple: '紫色',
      orange: '橙色',
      red: '红色',
      gray: '灰色',
      black: '黑色'
    },
    // 形状名称
    beadShapeName: '方形',
    brushShape: 'square', // 'square', 'cross'
    symmetryMode: 'none', // 'none', 'horizontal', 'vertical', 'quad'
    // 导入图片相关
    showImportImage: false,
    importImageSrc: '',
    importImageWidth: 0,
    importImageHeight: 0,
    importBrand: 'mard',
    importBrandIndex: 0,
    importBrandName: 'MARD',
    importBaseSize: 32,
    importPreviewWidth: 32,
    importPreviewHeight: 32,
    isProcessing: false,
    processProgress: 0,
    // 坐标高亮相关
    highlightedCols: [],
    highlightedRows: [],
    // 高亮样式配置
    highlightStyle: {
      type: 'both',  // 'fill' | 'border' | 'both'
      fillOpacity: 0.1,
      borderWidth: 2,
      borderColor: '#007aff',
      fillColor: '#007aff',
      animation: false  // 是否启用动画
    }
  },

  canvas: null,
  ctx: null,
  miniMapCanvas: null,
  miniMapCtx: null,
  lastTouchX: 0,
  lastTouchY: 0,
  lastDistance: 0,
  isDragging: false,
  lastScale: 1,
  lastAxisUpdateTime: 0,

  onLoad(options) {
    const res = wx.getSystemInfoSync();
    const recentColors = wx.getStorageSync('recent_bead_colors') || [];
    
    const rpxToPx = res.windowWidth / 750;
    // 修正：header-bar 高度 88rpx + padding-bottom 12rpx = 100rpx
    const headerBarHeight = Math.round(100 * rpxToPx);
    const headerHeight = headerBarHeight + res.safeArea.top;
    const yAxisWidth = Math.round(60 * rpxToPx);
    const xAxisHeight = 40;
    
    const canvasWidth = res.windowWidth - yAxisWidth;
    const canvasHeight = res.windowHeight - headerHeight - xAxisHeight;

    this.setData({
      canvasWidth,
      canvasHeight,
      windowWidth: res.windowWidth,
      windowHeight: res.windowHeight,
      safeAreaTop: res.safeArea.top,
      safeAreaBottom: res.screenHeight - res.safeArea.bottom,
      safeAreaLeft: res.safeArea.left,
      pixelRatio: rpxToPx,
      dpr: res.pixelRatio,
      recentColors,
      headerHeight,
      headerBarHeight,
      yAxisWidth,
      xAxisHeight
    });

    this.initBrands();
    this.initAllColors();
    this.loadSettings();
    this.loadQuickButtons();
    this.initCanvas();
    this.initMiniMap();
    
    // 检查是否有从作品详情页传入的数据
    this.loadBeadSession();
  },
  
  loadBeadSession() {
    const appInst = getApp();
    const session = appInst.globalData && appInst.globalData.beadSession;
    
    if (!session) return;
    
    console.log('加载 beadSession', session);
    
    // 清除 globalData 中的 beadSession，避免重复加载
    appInst.globalData.beadSession = null;
    
    // 设置网格大小
    const gridSize = session.gridSize || session.gridWidth || 32;
    const gridHeight = session.gridHeight || gridSize;
    
    // 设置品牌
    const selectedBrand = session.selectedBrand || 'MARD';
    
    // 加载 beadColors 数据
    if (session.beadColors && Object.keys(session.beadColors).length > 0) {
      this.setData({
        gridWidth: gridSize,
        gridHeight: gridHeight,
        selectedBrand: selectedBrand,
        beadColors: session.beadColors,
        showGrid: session.showGrid !== false,
        showRuler: session.showRuler !== false,
        showCellCodes: session.showCellCodes !== false
      });
      
      // 重新初始化画布
      this.initCanvas();
      
      // 重绘
      setTimeout(() => {
        this.redrawAll();
        wx.showToast({ title: '作品已加载', icon: 'success' });
      }, 300);
    }
    // 兼容旧的 pixelHexes 格式
    else if (session.pixelHexes && session.pixelHexes.length > 0) {
      const beadColors = {};
      const size = gridSize;
      
      for (let i = 0; i < session.pixelHexes.length; i++) {
        const hex = session.pixelHexes[i];
        if (hex) {
          const x = (i % size) + 1;
          const y = Math.floor(i / size) + 1;
          beadColors[`${x},${y}`] = hex;
        }
      }
      
      this.setData({
        gridWidth: gridSize,
        gridHeight: gridHeight,
        selectedBrand: selectedBrand,
        beadColors: beadColors,
        showGrid: session.showGrid !== false,
        showRuler: session.showRuler !== false,
        showCellCodes: session.showCellCodes !== false
      });
      
      // 重新初始化画布
      this.initCanvas();
      
      // 重绘
      setTimeout(() => {
        this.redrawAll();
        wx.showToast({ title: '作品已加载', icon: 'success' });
      }, 300);
    }
  },

  initBrands() {
    const brands = Object.keys(colorData).map(key => {
      const brand = colorData[key];
      const previewColors = this.getBrandPreviewColors(brand);
      const seriesList = brand.subSeries ? brand.subSeries.map(s => ({
        id: s.id,
        name: s.name,
        colors: s.colors ? s.colors.length : 0,
        previewColors: s.colors ? s.colors.slice(0, 8).map(c => c.hex) : []
      })) : [];
      return {
        id: brand.id,
        name: brand.name,
        seriesCount: brand.subSeries ? brand.subSeries.length : 0,
        isCustom: false,
        previewColors,
        seriesList
      };
    });

    const customInventory = wx.getStorageSync('warehouse_inventory_v1') || [];
    if (customInventory.length > 0) {
      const customBrandNames = [...new Set(customInventory.map(item => item.brand))];
      customBrandNames.forEach(name => {
        if (!brands.find(b => b.name === name)) {
          const colors = customInventory.filter(item => item.brand === name);
          brands.push({
            id: `custom_${name}`,
            name: name,
            seriesCount: 1,
            isCustom: true,
            previewColors: colors.slice(0, 4).map(c => c.hex),
            seriesList: [{
              id: 'custom_series',
              name: '我的库存',
              colors: colors.length,
              previewColors: colors.slice(0, 8).map(c => c.hex)
            }]
          });
        }
      });
    }

    this.setData({ brands });
  },

  getBrandPreviewColors(brand) {
    const colors = [];
    if (brand.subSeries) {
      for (const series of brand.subSeries) {
        if (series.colors) {
          for (const color of series.colors) {
            if (colors.length >= 4) break;
            colors.push(color.hex);
          }
        }
        if (colors.length >= 4) break;
      }
    }
    while (colors.length < 4) {
      colors.push('#8e8e93');
    }
    return colors;
  },

  initAllColors() {
    const allColors = [];
    Object.keys(colorData).forEach(key => {
      const brand = colorData[key];
      if (brand.subSeries) {
        brand.subSeries.forEach(series => {
          if (series.colors) {
            series.colors.forEach(color => {
              allColors.push({
                ...color,
                brand: brand.name,
                brandId: brand.id,
                seriesId: series.name,
                seriesName: series.name
              });
            });
          }
        });
      }
    });
    this.setData({ allColors });
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#beadBoard')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;

        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this.canvas = canvas;
        this.ctx = ctx;

        const actualWidth = res[0].width;
        const actualHeight = res[0].height;
        
        this.setData({
          canvasWidth: actualWidth,
          canvasHeight: actualHeight
        });

        // 获取 canvas 容器的实际位置
        const containerQuery = wx.createSelectorQuery().in(this);
        containerQuery.select('.canvas-container').boundingClientRect((rect) => {
          if (rect) {
            this.setData({
              canvasContainerLeft: rect.left,
              canvasContainerTop: rect.top
            });
          }
        }).exec();

        this.drawGrid();
        this.updateAxisLabels();
      });
  },

  initMiniMap() {
    const query = wx.createSelectorQuery();
    query.select('#miniMapCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return;
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;

        canvas.width = this.data.miniMapSize * dpr;
        canvas.height = this.data.miniMapSize * dpr;
        ctx.scale(dpr, dpr);

        this.miniMapCanvas = canvas;
        this.miniMapCtx = ctx;
      });
  },

  updateMiniMapBounds() {
    const { beadColors } = this.data;
    const keys = Object.keys(beadColors);
    
    if (keys.length === 0) {
      this.setData({ miniMapBeadCount: 0 });
      return;
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    keys.forEach(key => {
      const [col, row] = key.split(',').map(Number);
      minX = Math.min(minX, col);
      maxX = Math.max(maxX, col);
      minY = Math.min(minY, row);
      maxY = Math.max(maxY, row);
    });

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const { miniMapSize } = this.data;
    const padding = 10;
    const availableSize = miniMapSize - padding * 2;
    
    const scale = Math.min(availableSize / width, availableSize / height, 4);
    
    this.setData({
      miniMapScale: scale,
      miniMapOffsetX: minX,
      miniMapOffsetY: minY,
      miniMapBeadCount: keys.length
    });
  },

  drawMiniMap() {
    const { beadColors, miniMapSize, miniMapScale, miniMapOffsetX, miniMapOffsetY, miniMapBeadCount, canvasWidth, canvasHeight, cellSize, scale, offsetX, offsetY } = this.data;
    
    if (!this.miniMapCtx || miniMapBeadCount === 0) return;

    const ctx = this.miniMapCtx;
    ctx.clearRect(0, 0, miniMapSize, miniMapSize);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(0, 0, miniMapSize, miniMapSize);

    const centerX = miniMapSize / 2;
    const centerY = miniMapSize / 2;

    Object.keys(beadColors).forEach(key => {
      const [col, row] = key.split(',').map(Number);
      const color = beadColors[key];

      const x = centerX + (col - miniMapOffsetX - (Object.keys(beadColors).length > 0 ? 0 : 0)) * miniMapScale;
      const y = centerY + (row - miniMapOffsetY) * miniMapScale;

      ctx.fillStyle = color;
      const dotSize = Math.max(miniMapScale * 0.8, 2);
      ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
    });

    const actualCellSize = cellSize * scale;
    const viewportWidth = (canvasWidth / actualCellSize) * miniMapScale;
    const viewportHeight = (canvasHeight / actualCellSize) * miniMapScale;
    const viewportX = centerX + (offsetX / actualCellSize) * miniMapScale - viewportWidth / 2;
    const viewportY = centerY + (offsetY / actualCellSize) * miniMapScale - viewportHeight / 2;

    ctx.strokeStyle = '#007aff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);
  },

  onMiniMapTap(e) {
    const { miniMapSize, miniMapScale, cellSize, canvasWidth, canvasHeight, miniMapOffsetX, miniMapOffsetY } = this.data;
    
    const rect = e.detail;
    const tapX = e.detail.x || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const tapY = e.detail.y || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    const query = wx.createSelectorQuery();
    query.select('.mini-map-container').boundingClientRect((rect) => {
      if (!rect) return;
      
      const localX = tapX - rect.left;
      const localY = tapY - rect.top;
      
      const centerX = miniMapSize / 2;
      const centerY = miniMapSize / 2;
      
      const actualCellSize = cellSize * this.data.scale;
      const newOffsetX = -(localX - centerX) / miniMapScale * actualCellSize;
      const newOffsetY = -(localY - centerY) / miniMapScale * actualCellSize;

      this.data.offsetX = newOffsetX;
      this.data.offsetY = newOffsetY;

      this.setData({ offsetX: newOffsetX, offsetY: newOffsetY });
      this.drawGrid();
      this.updateAxisLabels();
      this.drawMiniMap();
    }).exec();
  },

  toggleMiniMap() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ showMiniMap: !this.data.showMiniMap });
  },

  getLabelInterval(actualCellSize) {
    if (actualCellSize >= 40) return 1;
    if (actualCellSize >= 20) return 5;
    if (actualCellSize >= 10) return 10;
    return 20;
  },

  drawGrid() {
    const { ctx, canvas, data } = this;
    if (!ctx || !canvas) return;

    const { cellSize, canvasWidth, canvasHeight, beadColors, showGridLines, showAxis, showCenterCross, gridLineColor } = data;
    const scale = data.scale;
    const offsetX = data.offsetX;
    const offsetY = data.offsetY;
    const actualCellSize = cellSize * scale;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const originX = canvasWidth / 2 + offsetX;
    const originY = canvasHeight / 2 + offsetY;

    const startCol = Math.floor(-originX / actualCellSize);
    const endCol = Math.ceil((canvasWidth - originX) / actualCellSize);
    const startRow = Math.floor(-originY / actualCellSize);
    const endRow = Math.ceil((canvasHeight - originY) / actualCellSize);

    const gridColors = {
      light: '#e5e5ea',
      dark: '#c7c7cc',
      blue: '#007aff',
      green: '#34c759',
      pink: '#ff2d55',
      purple: '#af52de',
      orange: '#ff9500',
      red: '#ff3b30'
    };

    // 1. 先画中心十字线（在最底层）
    if (showCenterCross) {
      // 十字线显示在坐标(0.5, 0.5)位置，即0和1中间
      const crossX = originX + 0.5 * actualCellSize;
      const crossY = originY + 0.5 * actualCellSize;
      
      ctx.strokeStyle = '#ff9500';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(crossX, 0);
      ctx.lineTo(crossX, canvasHeight);
      ctx.moveTo(0, crossY);
      ctx.lineTo(canvasWidth, crossY);
      ctx.stroke();
      ctx.setLineDash([]);
    }



    // 3. 画拼豆格子（在中间层）
    // 优化：直接遍历有颜色的格子，而不是遍历整个画布范围
    const beadKeys = Object.keys(beadColors);
    if (beadKeys.length > 0) {
      for (let i = 0; i < beadKeys.length; i++) {
        const key = beadKeys[i];
        const color = beadColors[key];
        if (color) {
          const [col, row] = key.split(',').map(Number);
          
          // 只绘制可见范围内的格子
          if (col >= startCol && col <= endCol && row >= startRow && row <= endRow) {
            const cellX = originX + col * actualCellSize;
            const cellY = originY + row * actualCellSize;
            ctx.fillStyle = color;
            if (data.beadShape === 'square') {
              // 格子多画 1 像素重叠，消除空隙
              const squareSize = actualCellSize + 1;
              ctx.fillRect(cellX - squareSize / 2, cellY - squareSize / 2, squareSize, squareSize);
            } else {
              ctx.beginPath();
              ctx.arc(cellX, cellY, actualCellSize * 0.45, 0, 2 * Math.PI);
              ctx.fill();
            }
          }
        }
      }
    }

    // 3.5 画色号（在拼豆格子上面，网格线下面）
    // 放大时显示色号，缩小时（格子太小）不显示
    if (data.showColorCodes && beadKeys.length > 0 && actualCellSize >= 14) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 色号大小随格子大小变化：始终是格子大小的 35%
      const fontSize = actualCellSize * 0.35;
      
      // 设置一次字体即可，避免在循环中重复设置
      ctx.font = `${fontSize}px SF Mono, 'Menlo', 'Monaco', monospace`;
      
      // 只遍历有颜色的格子
      for (let i = 0; i < beadKeys.length; i++) {
        const key = beadKeys[i];
        const color = beadColors[key];
        if (color) {
          const [col, row] = key.split(',').map(Number);
          
          // 只绘制可见范围内的格子
          if (col >= startCol && col <= endCol && row >= startRow && row <= endRow) {
            const cellX = originX + col * actualCellSize;
            const cellY = originY + row * actualCellSize;
            
            // 根据背景色决定文字颜色
            const rgb = this.hexToRgb(color);
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
            
            // 获取色号
            const colorCode = data.beadColorCodes[key];
            
            if (colorCode) {
              ctx.fillText(colorCode, cellX, cellY);
            }
          }
        }
      }
    }

    // 4. 画网格线（在最上层，覆盖在格子上面）
    if (showGridLines) {
      // 获取网格尺寸和循环间隔
      const gridW = this.data.gridWidth;
      const gridH = this.data.gridHeight;
      const cycleInterval = this.data.gridCycleInterval || 5;
      const doubleInterval = cycleInterval * 2;

      // 计算拼豆区域的边界坐标（拼豆区域从1,1开始）
      const areaLeftX = originX + 0.5 * actualCellSize;
      const areaRightX = originX + (gridW + 0.5) * actualCellSize;
      const areaTopY = originY + 0.5 * actualCellSize;
      const areaBottomY = originY + (gridH + 0.5) * actualCellSize;

      // 4.1 先画所有网格线的淡色版本（整个画布）
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();

      for (let col = startCol; col <= endCol + 1; col++) {
        const x = originX + (col + 0.5) * actualCellSize;
        if (x >= 0 && x <= canvasWidth) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasHeight);
        }
      }

      for (let row = startRow; row <= endRow + 1; row++) {
        const y = originY + (row + 0.5) * actualCellSize;
        if (y >= 0 && y <= canvasHeight) {
          ctx.moveTo(0, y);
          ctx.lineTo(canvasWidth, y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 4.2 画区域内的普通网格线（正常透明度，跳过虚线和实线位置，如果辅助线开启）
      ctx.strokeStyle = gridColors[gridLineColor] || '#e5e5ea';
      ctx.lineWidth = 0.5;
      ctx.beginPath();

      for (let col = 1; col <= gridW; col++) {
        const mod = ((col - 1) % doubleInterval + doubleInterval) % doubleInterval;
        // 如果辅助线开启，跳过虚线和实线位置；如果关闭，画所有线条
        if (this.data.showAuxiliaryLines && (mod === cycleInterval - 1 || mod === doubleInterval - 1)) continue;
        const x = originX + (col + 0.5) * actualCellSize;
        if (x >= 0 && x <= canvasWidth) {
          ctx.moveTo(x, Math.max(0, areaTopY));
          ctx.lineTo(x, Math.min(canvasHeight, areaBottomY));
        }
      }

      for (let row = 1; row <= gridH; row++) {
        const mod = ((row - 1) % doubleInterval + doubleInterval) % doubleInterval;
        // 如果辅助线开启，跳过虚线和实线位置；如果关闭，画所有线条
        if (this.data.showAuxiliaryLines && (mod === cycleInterval - 1 || mod === doubleInterval - 1)) continue;
        const y = originY + (row + 0.5) * actualCellSize;
        if (y >= 0 && y <= canvasHeight) {
          ctx.moveTo(Math.max(0, areaLeftX), y);
          ctx.lineTo(Math.min(canvasWidth, areaRightX), y);
        }
      }
      ctx.stroke();

    // 4.3 画高亮列（支持多种样式）- 在网格线之后，拼豆之前绘制
    if (this.data.highlightedCols.length > 0) {
      const style = this.data.highlightStyle;
      // 计算拼豆区域的边界
      const boardTop = originY + 0.5 * actualCellSize;
      const boardBottom = originY + (this.data.gridHeight - 0.5) * actualCellSize;
      const boardHeight = this.data.gridHeight * actualCellSize;
      
      this.data.highlightedCols.forEach(col => {
        const x = originX + (col - 1 + 0.5) * actualCellSize;
        if (x + actualCellSize >= 0 && x <= canvasWidth) {
          // 填充样式 - 只在拼豆区域内填充
          if (style.type === 'fill' || style.type === 'both') {
            ctx.save();  // 保存当前状态
            ctx.fillStyle = style.fillColor || '#007aff';
            ctx.globalAlpha = style.fillOpacity || 0.1;
            ctx.fillRect(x, boardTop, actualCellSize, boardHeight);
            ctx.restore();  // 恢复状态
          }
          
          // 边框样式
          if (style.type === 'border' || style.type === 'both') {
            ctx.save();  // 保存当前状态
            ctx.strokeStyle = style.borderColor || '#007aff';
            ctx.lineWidth = style.borderWidth || 2;
            ctx.globalAlpha = 0.8;
            ctx.strokeRect(x, boardTop, actualCellSize, boardHeight);
            ctx.restore();  // 恢复状态
          }
        }
      });
    }

    // 4.4 画高亮行（支持多种样式）- 在网格线之后，拼豆之前绘制
    if (this.data.highlightedRows.length > 0) {
      const style = this.data.highlightStyle;
      // 计算拼豆区域的边界
      const boardLeft = originX + 0.5 * actualCellSize;
      const boardRight = originX + (this.data.gridWidth - 0.5) * actualCellSize;
      const boardWidth = this.data.gridWidth * actualCellSize;
      
      this.data.highlightedRows.forEach(row => {
        const y = originY + (row - 1 + 0.5) * actualCellSize;
        if (y + actualCellSize >= 0 && y <= canvasHeight) {
          // 填充样式 - 只在拼豆区域内填充
          if (style.type === 'fill' || style.type === 'both') {
            ctx.save();  // 保存当前状态
            ctx.fillStyle = style.fillColor || '#007aff';
            ctx.globalAlpha = style.fillOpacity || 0.1;
            ctx.fillRect(boardLeft, y, boardWidth, actualCellSize);
            ctx.restore();  // 恢复状态
          }
          
          // 边框样式
          if (style.type === 'border' || style.type === 'both') {
            ctx.save();  // 保存当前状态
            ctx.strokeStyle = style.borderColor || '#007aff';
            ctx.lineWidth = style.borderWidth || 2;
            ctx.globalAlpha = 0.8;
            ctx.strokeRect(boardLeft, y, boardWidth, actualCellSize);
            ctx.restore();  // 恢复状态
          }
        }
      });
    }

    // 4.5 画区域外的虚线（淡淡的，整个画布）- 辅助线
    if (this.data.showAuxiliaryLines) {
        ctx.strokeStyle = '#c0c0c0';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();

        for (let col = startCol; col <= endCol + 1; col++) {
          const mod = ((col - 1) % doubleInterval + doubleInterval) % doubleInterval;
          if (mod !== cycleInterval - 1) continue;
          const x = originX + (col + 0.5) * actualCellSize;
          if (x >= 0 && x <= canvasWidth) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
          }
        }

        for (let row = startRow; row <= endRow + 1; row++) {
          const mod = ((row - 1) % doubleInterval + doubleInterval) % doubleInterval;
          if (mod !== cycleInterval - 1) continue;
          const y = originY + (row + 0.5) * actualCellSize;
          if (y >= 0 && y <= canvasHeight) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // 4.4 画区域内的虚线（正常透明度）- 辅助线
        ctx.strokeStyle = '#a0a0a0';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();

        for (let col = 1; col <= gridW; col++) {
          const mod = ((col - 1) % doubleInterval + doubleInterval) % doubleInterval;
          if (mod !== cycleInterval - 1) continue;
          const x = originX + (col + 0.5) * actualCellSize;
          if (x >= 0 && x <= canvasWidth) {
            ctx.moveTo(x, Math.max(0, areaTopY));
            ctx.lineTo(x, Math.min(canvasHeight, areaBottomY));
          }
        }

        for (let row = 1; row <= gridH; row++) {
          const mod = ((row - 1) % doubleInterval + doubleInterval) % doubleInterval;
          if (mod !== cycleInterval - 1) continue;
          const y = originY + (row + 0.5) * actualCellSize;
          if (y >= 0 && y <= canvasHeight) {
            ctx.moveTo(Math.max(0, areaLeftX), y);
            ctx.lineTo(Math.min(canvasWidth, areaRightX), y);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 4.5 画区域外的实线（淡淡的，整个画布）- 辅助线
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();

        for (let col = startCol; col <= endCol + 1; col++) {
          const mod = ((col - 1) % doubleInterval + doubleInterval) % doubleInterval;
          if (mod !== doubleInterval - 1) continue;
          const x = originX + (col + 0.5) * actualCellSize;
          if (x >= 0 && x <= canvasWidth) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
          }
        }

        for (let row = startRow; row <= endRow + 1; row++) {
          const mod = ((row - 1) % doubleInterval + doubleInterval) % doubleInterval;
          if (mod !== doubleInterval - 1) continue;
          const y = originY + (row + 0.5) * actualCellSize;
          if (y >= 0 && y <= canvasHeight) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
          }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 4.6 画区域内的实线（正常透明度）- 辅助线
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let col = 1; col <= gridW; col++) {
          const mod = ((col - 1) % doubleInterval + doubleInterval) % doubleInterval;
          if (mod !== doubleInterval - 1) continue;
          const x = originX + (col + 0.5) * actualCellSize;
          if (x >= 0 && x <= canvasWidth) {
            ctx.moveTo(x, Math.max(0, areaTopY));
            ctx.lineTo(x, Math.min(canvasHeight, areaBottomY));
          }
        }

        for (let row = 1; row <= gridH; row++) {
          const mod = ((row - 1) % doubleInterval + doubleInterval) % doubleInterval;
          if (mod !== doubleInterval - 1) continue;
          const y = originY + (row + 0.5) * actualCellSize;
          if (y >= 0 && y <= canvasHeight) {
            ctx.moveTo(Math.max(0, areaLeftX), y);
            ctx.lineTo(Math.min(canvasWidth, areaRightX), y);
          }
        }
        ctx.stroke();
      }
    }

    // 4.5 画拼豆区域高亮边框
    // 使用 this.data 获取最新的 gridWidth 和 gridHeight
    const finalGridWidth = this.data.gridWidth;
    const finalGridHeight = this.data.gridHeight;

    // 计算拼豆区域的四个边界（从1,1开始）
    const leftX = originX + 0.5 * actualCellSize;
    const rightX = originX + (finalGridWidth + 0.5) * actualCellSize;
    const topY = originY + 0.5 * actualCellSize;
    const bottomY = originY + (finalGridHeight + 0.5) * actualCellSize;

    // 绘制拼豆区域边框
    if (this.data.showAreaBorder) {
      const areaBorderColors = this.data.areaBorderColors;
      ctx.strokeStyle = areaBorderColors[this.data.areaBorderColor] || '#007aff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      // 左边框
      if (leftX >= 0 && leftX <= canvasWidth) {
        ctx.moveTo(leftX, Math.max(0, topY));
        ctx.lineTo(leftX, Math.min(canvasHeight, bottomY));
      }
      // 右边框
      if (rightX >= 0 && rightX <= canvasWidth) {
        ctx.moveTo(rightX, Math.max(0, topY));
        ctx.lineTo(rightX, Math.min(canvasHeight, bottomY));
      }
      // 上边框
      if (topY >= 0 && topY <= canvasHeight) {
        ctx.moveTo(Math.max(0, leftX), topY);
        ctx.lineTo(Math.min(canvasWidth, rightX), topY);
      }
      // 下边框
      if (bottomY >= 0 && bottomY <= canvasHeight) {
        ctx.moveTo(Math.max(0, leftX), bottomY);
        ctx.lineTo(Math.min(canvasWidth, rightX), bottomY);
      }
      ctx.stroke();
    }

    // 5. 绘制选区（虚线框 + 半透明填充）
    if (this.data.selection && this.data.selection.cells && this.data.selection.cells.length > 0) {
      const { bounds } = this.data.selection;
      // 选区边界计算：豆子从 (1,1) 开始，每个豆子占据 actualCellSize 的空间
      // bounds.left/right/top/bottom 是豆子的行列号（从 1 开始）
      const selectionLeft = originX + (bounds.left - 1) * actualCellSize;
      const selectionRight = originX + bounds.right * actualCellSize;
      const selectionTop = originY + (bounds.top - 1) * actualCellSize;
      const selectionBottom = originY + bounds.bottom * actualCellSize;
      const selectionWidth = selectionRight - selectionLeft;
      const selectionHeight = selectionBottom - selectionTop;
      
      // 5.1 绘制半透明填充
      ctx.save();
      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';  // 金色半透明
      ctx.fillRect(selectionLeft, selectionTop, selectionWidth, selectionHeight);
      ctx.restore();
      
      // 5.2 绘制虚线边框
      ctx.save();
      ctx.strokeStyle = '#FFD700';  // 金色
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);  // 虚线样式
      ctx.globalAlpha = 0.9;
      ctx.strokeRect(selectionLeft, selectionTop, selectionWidth, selectionHeight);
      ctx.restore();
      
      // 5.3 在四个角绘制小方块标记
      const cornerSize = 6;
      ctx.save();
      ctx.fillStyle = '#FFD700';
      // 左上角
      ctx.fillRect(selectionLeft - cornerSize/2, selectionTop - cornerSize/2, cornerSize, cornerSize);
      // 右上角
      ctx.fillRect(selectionRight - cornerSize/2, selectionTop - cornerSize/2, cornerSize, cornerSize);
      // 左下角
      ctx.fillRect(selectionLeft - cornerSize/2, selectionBottom - cornerSize/2, cornerSize, cornerSize);
      // 右下角
      ctx.fillRect(selectionRight - cornerSize/2, selectionBottom - cornerSize/2, cornerSize, cornerSize);
      ctx.restore();
    }
    
    // 6. 绘制框选预览（拖动过程中的虚线框）
    if (this.data.isSelecting && this.data.magicWandMode) {
      const { selectStartX, selectStartY, selectEndX, selectEndY, canvasContainerLeft, canvasContainerTop } = this.data;
      
      // 使用保存的 canvas 容器位置
      const previewLeft = Math.min(selectStartX, selectEndX) - canvasContainerLeft;
      const previewRight = Math.max(selectStartX, selectEndX) - canvasContainerLeft;
      const previewTop = Math.min(selectStartY, selectEndY) - canvasContainerTop;
      const previewBottom = Math.max(selectStartY, selectEndY) - canvasContainerTop;
      const previewWidth = previewRight - previewLeft;
      const previewHeight = previewBottom - previewTop;
      
      // 绘制虚线预览框
      ctx.save();
      ctx.strokeStyle = '#FFD700';  // 金色
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);  // 虚线样式
      ctx.globalAlpha = 0.6;  // 半透明
      ctx.strokeRect(previewLeft, previewTop, previewWidth, previewHeight);
      
      // 绘制半透明填充
      ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
      ctx.fillRect(previewLeft, previewTop, previewWidth, previewHeight);
      ctx.restore();
    }

    this.updateAxisLabelsThrottled();
  },

  updateAxisLabelsThrottled() {
    const now = Date.now();
    if (now - this.lastAxisUpdateTime < 16) return;
    this.lastAxisUpdateTime = now;
    this.updateAxisLabels();
  },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  },

  updateAxisLabels() {
    const { canvasWidth, canvasHeight, cellSize, scale, offsetX, offsetY, yAxisWidth, xAxisHeight } = this.data;
    const actualCellSize = cellSize * scale;

    const containerScreenX = yAxisWidth;
    const containerScreenY = xAxisHeight;
    
    const originScreenX = containerScreenX + canvasWidth / 2 + offsetX;
    const originScreenY = containerScreenY + canvasHeight / 2 + offsetY;

    const startCol = Math.floor((containerScreenX - originScreenX) / actualCellSize);
    const endCol = Math.ceil((containerScreenX + canvasWidth - originScreenX) / actualCellSize);
    const startRow = Math.floor((containerScreenY - originScreenY) / actualCellSize);
    const endRow = Math.ceil((containerScreenY + canvasHeight - originScreenY) / actualCellSize);

    const xAxisLabels = [];
    const yAxisLabels = [];
    
    // 根据缩放级别决定显示哪些刻度
    // 主刻度：每 10 格
    // 次刻度：每 5 格
    // 微刻度：每 1 格（仅在放大时显示）
    const showMicroTicks = actualCellSize > 20; // 放大时显示微刻度（降低阈值）
    const showMinorTicks = actualCellSize > 10; // 中等缩放显示次刻度（降低阈值）
    
    for (let col = startCol; col <= endCol; col++) {
      const screenX = originScreenX + col * actualCellSize;
      if (screenX < containerScreenX || screenX > containerScreenX + canvasWidth) continue;
      
      const isMajor = col % 10 === 0;
      const isMinor = col % 5 === 0;
      
      if (isMajor) {
        // 主刻度：显示数字（大字体）
        xAxisLabels.push({ 
          value: col, 
          screenX,
          tickType: 'major',
          isMajor: true,
          isMinor: false,
          isHighlighted: this.data.highlightedCols.indexOf(col) > -1
        });
      } else if (isMinor && showMinorTicks) {
        // 次刻度：显示数字（中等字体）
        xAxisLabels.push({ 
          value: col, 
          screenX,
          tickType: 'minor',
          isMajor: false,
          isMinor: true,
          isHighlighted: this.data.highlightedCols.indexOf(col) > -1
        });
      } else if (showMicroTicks) {
        // 微刻度：显示数字（小字体）
        xAxisLabels.push({ 
          value: col, 
          screenX,
          tickType: 'micro',
          isMajor: false,
          isMinor: false,
          isHighlighted: this.data.highlightedCols.indexOf(col) > -1
        });
      }
    }

    for (let row = startRow; row <= endRow; row++) {
      const screenY = originScreenY + row * actualCellSize;
      if (screenY < containerScreenY || screenY > containerScreenY + canvasHeight) continue;
      
      const isMajor = row % 10 === 0;
      const isMinor = row % 5 === 0;
      
      if (isMajor) {
        // 主刻度：显示数字（大字体）
        yAxisLabels.push({ 
          value: row, 
          screenY, 
          relativeY: screenY - containerScreenY,
          tickType: 'major',
          isMajor: true,
          isMinor: false,
          isHighlighted: this.data.highlightedRows.indexOf(row) > -1
        });
      } else if (isMinor && showMinorTicks) {
        // 次刻度：显示数字（中等字体）
        yAxisLabels.push({ 
          value: row, 
          screenY, 
          relativeY: screenY - containerScreenY,
          tickType: 'minor',
          isMajor: false,
          isMinor: true,
          isHighlighted: this.data.highlightedRows.indexOf(row) > -1
        });
      } else if (showMicroTicks) {
        // 微刻度：显示数字（小字体）
        yAxisLabels.push({ 
          value: row, 
          screenY, 
          relativeY: screenY - containerScreenY,
          tickType: 'micro',
          isMajor: false,
          isMinor: false,
          isHighlighted: this.data.highlightedRows.indexOf(row) > -1
        });
      }
    }

    this.setData({ xAxisLabels, yAxisLabels });
  },

  onTouchStart(e) {
    const touches = e.touches;
    const now = Date.now();
    this.setData({
      touchStartTime: now,
      touchStartX: touches[0].clientX,
      touchStartY: touches[0].clientY
    });

    // 重置连续绘制状态
    this.isContinuousDrawing = false;
    this.continuousDrawTriggered = false;

    if (touches.length === 1) {
      this.isDragging = true;
      this.lastTouchX = touches[0].clientX;
      this.lastTouchY = touches[0].clientY;

      // 如果在画笔模式，启动长按检测定时器
      if (this.data.isDrawMode && (this.data.selectedColor || this.data.eraserMode)) {
        this.continuousDrawTimer = setTimeout(() => {
          // 长按500ms后进入连续绘制模式
          this.isContinuousDrawing = true;
          this.continuousDrawTriggered = true;
          this.lastHistorySave = JSON.stringify(this.data.beadColors);
          wx.vibrateShort({ type: 'light' });
          wx.showToast({ title: '连续绘制模式', icon: 'none', duration: 800 });
        }, 500);
      }
    } else if (touches.length === 2) {
      this.isDragging = true;
      this.clearContinuousDrawTimer();
      this.lastDistance = this.calculateDistance(touches[0], touches[1]);
      this.lastScale = this.data.scale;
      // 记录双指中心点用于拖动
      this.lastCenterX = (touches[0].clientX + touches[1].clientX) / 2;
      this.lastCenterY = (touches[0].clientY + touches[1].clientY) / 2;
    }
  },

  clearContinuousDrawTimer() {
    if (this.continuousDrawTimer) {
      clearTimeout(this.continuousDrawTimer);
      this.continuousDrawTimer = null;
    }
  },

  onTouchMove(e) {
    const touches = e.touches;

    // 魔棒模式 - 框选处理
    if (this.data.magicWandMode && touches.length === 1) {
      const touch = touches[0];
      const deltaX = Math.abs(touch.clientX - this.data.touchStartX);
      const deltaY = Math.abs(touch.clientY - this.data.touchStartY);
      
      // 移动超过 10 像素，开始框选
      if ((deltaX > 10 || deltaY > 10) && !this.data.isSelecting) {
        this.setData({
          isSelecting: true,
          selectStartX: this.data.touchStartX,
          selectStartY: this.data.touchStartY,
          selectEndX: touch.clientX,
          selectEndY: touch.clientY
        }, () => {
          this.drawGrid();
        });
        wx.vibrateShort({ type: 'light' });
        wx.showToast({ title: '框选区域', icon: 'none', duration: 1000 });
      }
      
      // 更新框选范围并重绘
      if (this.data.isSelecting) {
        this.setData({
          selectEndX: touch.clientX,
          selectEndY: touch.clientY
        }, () => {
          this.drawGrid();
        });
      }
      return;
    }

    // 如果在画笔模式且移动距离超过阈值，取消长按定时器
    if (touches.length === 1 && this.data.isDrawMode && (this.data.selectedColor || this.data.eraserMode)) {
      const deltaX = Math.abs(touches[0].clientX - this.data.touchStartX);
      const deltaY = Math.abs(touches[0].clientY - this.data.touchStartY);
      if ((deltaX > 10 || deltaY > 10) && !this.isContinuousDrawing) {
        this.clearContinuousDrawTimer();
      }
    }

    // 只有在长按进入连续绘制模式后才连续绘制
    if (touches.length === 1 && this.isDragging && this.isContinuousDrawing && this.data.isDrawMode && (this.data.selectedColor || this.data.eraserMode)) {
      this.continuousDraw(touches[0].clientX, touches[0].clientY);
    } else if (touches.length === 1 && this.isDragging) {
      // 单指拖动 - 移动画布（包括画笔模式下未进入连续绘制时）
      const deltaX = touches[0].clientX - this.lastTouchX;
      const deltaY = touches[0].clientY - this.lastTouchY;

      this.lastTouchX = touches[0].clientX;
      this.lastTouchY = touches[0].clientY;

      this.data.offsetX += deltaX;
      this.data.offsetY += deltaY;

      this.drawGrid();
    } else if (touches.length === 2) {
      // 双指操作 - 同时处理缩放和拖动
      const currentDistance = this.calculateDistance(touches[0], touches[1]);
      const currentCenterX = (touches[0].clientX + touches[1].clientX) / 2;
      const currentCenterY = (touches[0].clientY + touches[1].clientY) / 2;

      // 处理缩放
      if (this.lastDistance > 0) {
        const scaleFactor = currentDistance / this.lastDistance;
        const newScale = Math.max(0.1, Math.min(4, this.lastScale * scaleFactor));
        this.data.scale = newScale;
      }

      // 处理拖动（双指中心点的移动）
      if (this.lastCenterX !== undefined && this.lastCenterY !== undefined) {
        const deltaX = currentCenterX - this.lastCenterX;
        const deltaY = currentCenterY - this.lastCenterY;
        this.data.offsetX += deltaX;
        this.data.offsetY += deltaY;
      }

      // 更新状态
      this.lastScale = this.data.scale;
      this.lastDistance = currentDistance;
      this.lastCenterX = currentCenterX;
      this.lastCenterY = currentCenterY;

      this.drawGrid();
    }
  },

  continuousDraw(clientX, clientY) {
    const { cellSize, scale, offsetX, offsetY, beadColors, selectedColor, canvasWidth, canvasHeight, headerHeight, yAxisWidth, xAxisHeight, eraserMode, brushSize, brushShape, symmetryMode } = this.data;

    const actualCellSize = cellSize * scale;
    const containerScreenX = yAxisWidth;
    const containerScreenY = headerHeight + xAxisHeight;

    const originScreenX = containerScreenX + canvasWidth / 2 + offsetX;
    const originScreenY = containerScreenY + canvasHeight / 2 + offsetY;

    const centerCol = Math.round((clientX - originScreenX) / actualCellSize);
    const centerRow = Math.round((clientY - originScreenY) / actualCellSize);

    // 获取要绘制的所有格子坐标
    const cellsToDraw = this.getBrushCells(centerCol, centerRow, brushSize, brushShape);

    // 应用对称模式
    const allCells = this.applySymmetry(cellsToDraw, symmetryMode);

    let hasChanged = false;
    const newBeadColors = { ...beadColors };

    if (eraserMode) {
      // 橡皮模式：删除所有范围内的格子
      allCells.forEach(({ col, row }) => {
        const key = `${col},${row}`;
        if (newBeadColors[key]) {
          delete newBeadColors[key];
          delete this.data.beadColorCodes[key];
          hasChanged = true;
        }
      });
    } else if (selectedColor) {
      // 画笔模式：绘制所有范围内的格子
      allCells.forEach(({ col, row }) => {
        const key = `${col},${row}`;
        if (newBeadColors[key] !== selectedColor.hex) {
          newBeadColors[key] = selectedColor.hex;
          hasChanged = true;
        }
        // 同时存储色号
        if (selectedColor.code) {
          this.data.beadColorCodes[key] = selectedColor.code;
        }
      });
    }

    if (hasChanged) {
      this.data.beadColors = newBeadColors;
      this.setData({ beadColors: newBeadColors });
      this.drawGrid();
    }
  },

  // 获取画笔范围内的所有格子
  getBrushCells(centerCol, centerRow, size, shape) {
    const cells = [];

    if (shape === 'square') {
      // 方形：填充整个区域
      // 计算起始和结束偏移量，确保大小准确
      const startOffset = -Math.floor((size - 1) / 2);
      const endOffset = Math.floor(size / 2);

      for (let r = startOffset; r < startOffset + size; r++) {
        for (let c = startOffset; c < startOffset + size; c++) {
          cells.push({ col: centerCol + c, row: centerRow + r });
        }
      }
    } else if (shape === 'cross') {
      // 十字：只绘制横竖线
      const radius = Math.floor((size - 1) / 2);

      // 横线
      for (let c = -radius; c <= radius; c++) {
        cells.push({ col: centerCol + c, row: centerRow });
      }
      // 竖线
      for (let r = -radius; r <= radius; r++) {
        if (r !== 0) { // 避免中心点重复
          cells.push({ col: centerCol, row: centerRow + r });
        }
      }
    }

    return cells;
  },

  // 应用对称模式
  applySymmetry(cells, mode) {
    if (mode === 'none') return cells;

    const allCells = [...cells];
    const uniqueKeys = new Set(cells.map(c => `${c.col},${c.row}`));

    cells.forEach(({ col, row }) => {
      let mirrored = [];

      if (mode === 'horizontal' || mode === 'quad') {
        // 水平对称（左右）
        mirrored.push({ col: -col, row });
      }
      if (mode === 'vertical' || mode === 'quad') {
        // 垂直对称（上下）
        mirrored.push({ col, row: -row });
      }
      if (mode === 'quad') {
        // 四象限对称（对角）
        mirrored.push({ col: -col, row: -row });
      }

      mirrored.forEach(m => {
        const key = `${m.col},${m.row}`;
        if (!uniqueKeys.has(key)) {
          uniqueKeys.add(key);
          allCells.push(m);
        }
      });
    });

    return allCells;
  },

  onTouchEnd(e) {
    const { touchStartTime, touchStartX, touchStartY, isDrawMode, selectedColor, eraserMode, magicWandMode } = this.data;
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;

    // 清除长按定时器
    this.clearContinuousDrawTimer();

    // 魔棒模式处理
    if (magicWandMode) {
      const touch = e.changedTouches[0];
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);

      // 短按且移动距离小，执行点选或框选
      if (touchDuration < 500 && deltaX < 10 && deltaY < 10) {
        // 单击 - 点选同色
        this.handleMagicWandTap(touch.clientX, touch.clientY);
      } else if (touchDuration >= 500 || deltaX > 10 || deltaY > 10) {
        // 长按或拖动 - 框选区域
        this.handleMagicWandSelectEnd(touch.clientX, touch.clientY);
      }
      return;
    }

    if (isDrawMode && (selectedColor || eraserMode) && e.changedTouches && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);

      // 短按（小于 500ms）且移动距离小，认为是单击，放置单个拼豆
      if (touchDuration < 500 && deltaX < 10 && deltaY < 10 && !this.continuousDrawTriggered) {
        this.placeBead(touch.clientX, touch.clientY);
      } else if (this.lastHistorySave) {
        // 连续绘制结束，保存历史记录
        const currentColors = JSON.stringify(this.data.beadColors);
        if (currentColors !== this.lastHistorySave) {
          const { undoStack, maxHistory } = this.data;
          undoStack.push(this.lastHistorySave);
          if (undoStack.length > maxHistory) {
            undoStack.shift();
          }
          this.setData({ undoStack, redoStack: [] });
        }
        this.lastHistorySave = null;
      }
    }

    // 重置状态
    this.isContinuousDrawing = false;
    this.continuousDrawTriggered = false;

    this.setData({
      offsetX: this.data.offsetX,
      offsetY: this.data.offsetY,
      scale: this.data.scale
    });

    this.updateAxisLabels();
    this.updateMiniMapBounds();
    this.drawMiniMap();
    this.isDragging = false;
    this.lastDistance = 0;
  },

  placeBead(clientX, clientY) {
    const { cellSize, scale, offsetX, offsetY, beadColors, selectedColor, canvasWidth, canvasHeight, headerHeight, yAxisWidth, xAxisHeight, eraserMode, brushSize, brushShape, symmetryMode, eyedropperMode, colorList } = this.data;

    const actualCellSize = cellSize * scale;
    const containerScreenX = yAxisWidth;
    const containerScreenY = headerHeight + xAxisHeight;

    const originScreenX = containerScreenX + canvasWidth / 2 + offsetX;
    const originScreenY = containerScreenY + canvasHeight / 2 + offsetY;

    const centerCol = Math.round((clientX - originScreenX) / actualCellSize);
    const centerRow = Math.round((clientY - originScreenY) / actualCellSize);

    // 取色模式
    if (eyedropperMode) {
      const key = `${centerCol},${centerRow}`;
      const colorHex = beadColors[key];
      if (colorHex) {
        // 从颜色列表中找到对应的颜色对象
        const foundColor = colorList.find(c => c.hex === colorHex);
        if (foundColor) {
          this.setData({
            selectedColor: foundColor,
            eyedropperMode: false
          });
          wx.showToast({ title: `已取色: ${foundColor.name}`, icon: 'none', duration: 1500 });
        } else {
          // 如果颜色不在列表中，创建新的颜色对象
          const newColor = { hex: colorHex, name: colorHex };
          this.setData({
            selectedColor: newColor,
            eyedropperMode: false
          });
          wx.showToast({ title: `已取色: ${colorHex}`, icon: 'none', duration: 1500 });
        }
      } else {
        wx.showToast({ title: '该位置没有颜色', icon: 'none', duration: 1000 });
      }
      return;
    }

    // 获取要绘制的所有格子坐标
    const cellsToDraw = this.getBrushCells(centerCol, centerRow, brushSize, brushShape);

    // 应用对称模式
    const allCells = this.applySymmetry(cellsToDraw, symmetryMode);

    const newBeadColors = { ...beadColors };
    let hasChanged = false;

    if (eraserMode) {
      // 橡皮模式：删除所有范围内的格子
      allCells.forEach(({ col, row }) => {
        const key = `${col},${row}`;
        if (newBeadColors[key]) {
          delete newBeadColors[key];
          delete this.data.beadColorCodes[key];
          hasChanged = true;
        }
      });
    } else {
      // 画笔模式：绘制所有范围内的格子
      allCells.forEach(({ col, row }) => {
        const key = `${col},${row}`;
        if (newBeadColors[key] !== selectedColor.hex) {
          newBeadColors[key] = selectedColor.hex;
          hasChanged = true;
        }
        // 同时存储色号
        if (selectedColor.code) {
          this.data.beadColorCodes[key] = selectedColor.code;
        }
      });
    }

    if (hasChanged) {
      this.saveToHistory(beadColors, newBeadColors);

      this.setData({
        beadColors: newBeadColors,
        currentCoordX: centerCol,
        currentCoordY: centerRow
      });
      this.drawGrid();
      this.updateMiniMapBounds();
      this.drawMiniMap();
    }
  },

  saveToHistory(oldColors, newColors) {
    const { undoStack, redoStack, maxHistory } = this.data;
    
    if (JSON.stringify(oldColors) === JSON.stringify(newColors)) {
      return;
    }

    undoStack.push(JSON.stringify(oldColors));
    if (undoStack.length > maxHistory) {
      undoStack.shift();
    }
    
    this.setData({ undoStack, redoStack: [] });
  },

  undo() {
    const { undoStack, beadColors, maxHistory } = this.data;
    
    if (undoStack.length === 0) {
      wx.showToast({ title: '没有可撤销的操作', icon: 'none', duration: 1000 });
      return;
    }

    const previousState = JSON.parse(undoStack.pop());
    this.data.redoStack.push(JSON.stringify(beadColors));
    if (this.data.redoStack.length > maxHistory) {
      this.data.redoStack.shift();
    }

    this.setData({
      beadColors: previousState,
      undoStack: this.data.undoStack,
      redoStack: this.data.redoStack
    });
    this.drawGrid();
    this.updateMiniMapBounds();
    this.drawMiniMap();
    wx.vibrateShort({ type: 'light' });
  },

  redo() {
    const { redoStack, beadColors, maxHistory } = this.data;
    
    if (redoStack.length === 0) {
      wx.showToast({ title: '没有可重做的操作', icon: 'none', duration: 1000 });
      return;
    }

    const nextState = JSON.parse(redoStack.pop());
    this.data.undoStack.push(JSON.stringify(beadColors));
    if (this.data.undoStack.length > maxHistory) {
      this.data.undoStack.shift();
    }

    this.setData({
      beadColors: nextState,
      undoStack: this.data.undoStack,
      redoStack: this.data.redoStack
    });
    this.drawGrid();
    this.updateMiniMapBounds();
    this.drawMiniMap();
    wx.vibrateShort({ type: 'light' });
  },

  toggleEraserMode() {
    wx.vibrateShort({ type: 'light' });

    if (this.data.eraserMode) {
      // 当前是橡皮擦模式，取消橡皮擦，同时退出画笔模式
      this.setData({
        eraserMode: false,
        isDrawMode: false,
        eyedropperMode: false
      });
      wx.showToast({ title: '已退出橡皮擦模式', icon: 'none', duration: 1000 });
    } else {
      // 当前不是橡皮擦模式，切换到橡皮擦模式
      this.setData({
        eraserMode: true,
        isDrawMode: true,
        eyedropperMode: false
      });
      wx.showToast({ title: '已切换到橡皮擦模式', icon: 'none', duration: 1000 });
    }
  },

  toggleEyedropperMode() {
    wx.vibrateShort({ type: 'light' });

    if (this.data.eyedropperMode) {
      this.setData({
        eyedropperMode: false
      });
      wx.showToast({ title: '已退出取色模式', icon: 'none', duration: 1000 });
    } else {
      this.setData({
        eyedropperMode: true,
        isDrawMode: false,
        eraserMode: false,
        magicWandMode: false
      });
      wx.showToast({ title: '已开启取色模式', icon: 'success', duration: 1500 });
    }
  },

  toggleMagicWandMode() {
    wx.vibrateShort({ type: 'light' });

    if (this.data.magicWandMode) {
      // 退出魔棒模式
      this.setData({
        magicWandMode: false,
        selection: null,
        selectionMenuVisible: false
      });
      wx.showToast({ title: '已退出魔棒模式', icon: 'none', duration: 1000 });
    } else {
      // 进入魔棒模式
      this.setData({
        magicWandMode: true,
        isDrawMode: false,
        eraserMode: false,
        eyedropperMode: false
      });
      wx.showToast({ title: '已开启魔棒模式 - 单击点选，长按框选', icon: 'success', duration: 1500 });
    }
  },

  // 魔棒工具 - 单击点选同色
  handleMagicWandTap(clientX, clientY) {
    console.log('魔棒单击', clientX, clientY);
    const { cellSize, scale, offsetX, offsetY, beadColors, canvasWidth, canvasHeight, canvasContainerLeft, canvasContainerTop } = this.data;
    
    // 计算点击的坐标
    const originX = canvasWidth / 2 + offsetX;
    const originY = canvasHeight / 2 + offsetY;
    const actualCellSize = cellSize * scale;
    
    // 使用 canvas 容器的实际位置计算网格坐标
    const col = Math.floor((clientX - canvasContainerLeft - originX) / actualCellSize + 0.5);
    const row = Math.floor((clientY - canvasContainerTop - originY) / actualCellSize + 0.5);
    
    console.log('点击坐标', col, row);
    
    // 检查是否在拼豆区域内
    if (col < 1 || col > this.data.gridWidth || row < 1 || row > this.data.gridHeight) {
      wx.showToast({ title: '请点击拼豆区域', icon: 'none' });
      return;
    }
    
    // 获取点击位置的颜色
    const key = `${col},${row}`;
    const color = beadColors[key];
    
    if (!color) {
      wx.showToast({ title: '该位置没有豆子', icon: 'none' });
      return;
    }
    
    // 选中所有相同颜色的豆子
    const selectedCells = [];
    for (let k in beadColors) {
      if (beadColors[k] === color) {
        const [x, y] = k.split(',').map(Number);
        selectedCells.push({ x, y, color: beadColors[k] });
      }
    }
    
    console.log('选中了', selectedCells.length, '个豆子');
    
    // 计算选区边界
    const cols = selectedCells.map(c => c.x);
    const rows = selectedCells.map(c => c.y);
    const bounds = {
      left: Math.min(...cols),
      top: Math.min(...rows),
      right: Math.max(...cols),
      bottom: Math.max(...rows)
    };
    
    // 更新选区
    this.setData({
      selection: {
        cells: selectedCells,
        bounds: bounds,
        mode: 'color'
      }
    });
    
    wx.showToast({ title: `选中了${selectedCells.length}个豆子`, icon: 'success', duration: 1500 });
    this.drawGrid();
  },

  // 魔棒工具 - 框选结束
  handleMagicWandSelectEnd(clientX, clientY) {
    console.log('框选结束', clientX, clientY);
    
    if (!this.data.isSelecting) {
      return;
    }
    
    const { selectStartX, selectStartY } = this.data;
    const selectEndX = clientX;
    const selectEndY = clientY;
    
    // 计算选区边界（转换为网格坐标）
    const { cellSize, scale, offsetX, offsetY, canvasWidth, canvasHeight, canvasContainerLeft, canvasContainerTop } = this.data;
    const originX = canvasWidth / 2 + offsetX;
    const originY = canvasHeight / 2 + offsetY;
    const actualCellSize = cellSize * scale;
    
    // 使用 canvas 容器的实际位置计算网格坐标
    const startCol = Math.floor((selectStartX - canvasContainerLeft - originX) / actualCellSize + 0.5);
    const startRow = Math.floor((selectStartY - canvasContainerTop - originY) / actualCellSize + 0.5);
    const endCol = Math.floor((selectEndX - canvasContainerLeft - originX) / actualCellSize + 0.5);
    const endRow = Math.floor((selectEndY - canvasContainerTop - originY) / actualCellSize + 0.5);
    
    console.log('框选范围', startCol, startRow, endCol, endRow);
    
    // 获取选区内的所有豆子
    const selectedCells = [];
    const { beadColors } = this.data;
    const left = Math.min(startCol, endCol);
    const right = Math.max(startCol, endCol);
    const top = Math.min(startRow, endRow);
    const bottom = Math.max(startRow, endRow);
    
    for (let col = left; col <= right; col++) {
      for (let row = top; row <= bottom; row++) {
        const key = `${col},${row}`;
        if (beadColors[key]) {
          selectedCells.push({ x: col, y: row, color: beadColors[key] });
        }
      }
    }
    
    console.log('框选了', selectedCells.length, '个豆子');
    
    if (selectedCells.length === 0) {
      wx.showToast({ title: '选区内没有豆子', icon: 'none' });
      this.setData({ isSelecting: false });
      return;
    }
    
    // 更新选区
    this.setData({
      isSelecting: false,
      selection: {
        cells: selectedCells,
        bounds: { left, top, right, bottom },
        mode: 'rect'
      }
    });
    
    // 显示选区菜单
    const menuX = (selectStartX + selectEndX) / 2;
    const menuY = Math.min(selectStartY, selectEndY) - 20;
    
    this.setData({
      selectionMenuVisible: true,
      selectionMenuX: menuX,
      selectionMenuY: menuY
    });
    
    wx.showToast({ title: `选中了${selectedCells.length}个豆子`, icon: 'success', duration: 1500 });
    this.drawGrid();
  },

  calculateDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  onBack() {
    wx.vibrateShort({ type: 'light' });
    wx.navigateBack({ delta: 1 });
  },

  zoomIn() {
    wx.vibrateShort({ type: 'light' });
    const targetScale = Math.min(this.data.scale * 1.2, 4);
    this.data.scale = targetScale;
    this.setData({ scale: targetScale });
    this.drawGrid();
    this.updateAxisLabels();
  },

  zoomOut() {
    wx.vibrateShort({ type: 'light' });
    const targetScale = Math.max(this.data.scale / 1.2, 0.3);
    this.data.scale = targetScale;
    this.setData({ scale: targetScale });
    this.drawGrid();
    this.updateAxisLabels();
  },

  resetView() {
    wx.vibrateShort({ type: 'light' });
    this.data.offsetX = 0;
    this.data.offsetY = 0;
    this.data.scale = 1;
    this.setData({ offsetX: 0, offsetY: 0, scale: 1 });
    this.drawGrid();
    this.updateAxisLabels();
  },

  openColorPalette() {
    wx.vibrateShort({ type: 'medium' });
    this.setData({
      showColorPalette: true,
      selectedBrand: null,
      selectedSeries: null,
      currentSeriesList: [],
      currentColorList: [],
      groupedColors: [],
      expandedBrands: {},
      expandedSeries: {},
      isSearching: false,
      searchKeyword: '',
      searchResults: []
    });
  },

  closeColorPalette() {
    wx.vibrateShort({ type: 'light' });
    this.setData({
      showColorPalette: false,
      isSearching: false,
      searchKeyword: '',
      searchResults: []
    });
  },

  preventTouchMove() {},

  startSearch() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ isSearching: true });
  },

  clearSearch() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ searchKeyword: '', searchResults: [] });
  },

  onSearchInput(e) {
    const keyword = e.detail.value.toUpperCase().trim();
    this.setData({ searchKeyword: keyword });

    if (keyword.length === 0) {
      this.setData({ searchResults: [] });
      return;
    }

    const results = this.data.allColors.filter(color => {
      return color.code && color.code.toUpperCase().includes(keyword);
    }).slice(0, 20);

    this.setData({ searchResults: results });
  },

  selectBrand(e) {
    wx.vibrateShort({ type: 'light' });
    const brandId = e.currentTarget.dataset.id;
    const brandName = e.currentTarget.dataset.name;

    this.setData({
      selectedBrand: { id: brandId, name: brandName },
      selectedSeries: null,
      currentSeriesList: this.getBrandSeries(brandId),
      currentColorList: [],
      groupedColors: []
    });
  },

  getBrandSeries(brandId) {
    if (brandId.startsWith('custom_')) {
      const brandName = brandId.replace('custom_', '');
      const customInventory = wx.getStorageSync('warehouse_inventory_v1') || [];
      const colors = customInventory.filter(item => item.brand === brandName);
      return [{
        id: 'custom_series',
        name: '我的库存',
        colors: colors.length,
        previewColors: colors.slice(0, 8).map(c => c.hex)
      }];
    }

    // 修复：查找品牌时同时检查键名和id属性
    let brand = colorData[brandId];
    if (!brand) {
      // 如果通过键名找不到，遍历查找id匹配的品牌
      for (const key in colorData) {
        if (colorData[key].id === brandId) {
          brand = colorData[key];
          break;
        }
      }
    }

    if (!brand || !brand.subSeries) return [];

    return brand.subSeries.map(s => ({
      id: s.id,
      name: s.name,
      colors: s.colors ? s.colors.length : 0,
      previewColors: s.colors ? s.colors.slice(0, 8).map(c => c.hex) : []
    }));
  },

  selectSeries(e) {
    wx.vibrateShort({ type: 'light' });
    const seriesId = e.currentTarget.dataset.id;
    const seriesName = e.currentTarget.dataset.name;

    const colors = this.getSeriesColors(seriesId);
    const groupedColors = this.groupColorsBySeries(colors);

    this.setData({
      selectedSeries: { id: seriesId, name: seriesName },
      currentColorList: colors,
      groupedColors
    });
  },

  getSeriesColors(seriesId) {
    const brandId = this.data.selectedBrand.id;

    if (brandId.startsWith('custom_')) {
      const brandName = this.data.selectedBrand.name;
      const customInventory = wx.getStorageSync('warehouse_inventory_v1') || [];
      return customInventory
        .filter(item => item.brand === brandName)
        .map(item => ({
          series: item.series || '默认',
          code: item.code,
          hex: item.hex
        }));
    }

    const brand = colorData[brandId];
    if (!brand || !brand.subSeries) return [];

    const series = brand.subSeries.find(s => s.id === seriesId);
    return series ? series.colors : [];
  },

  groupColorsBySeries(colors) {
    const groups = {};
    colors.forEach(color => {
      const seriesName = color.series || '其他';
      if (!groups[seriesName]) {
        groups[seriesName] = [];
      }
      groups[seriesName].push(color);
    });

    return Object.keys(groups).map(name => ({
      name,
      colors: groups[name],
      expanded: true
    }));
  },

  toggleSeriesExpand(e) {
    wx.vibrateShort({ type: 'light' });
    const seriesName = e.currentTarget.dataset.series;
    const groupedColors = this.data.groupedColors.map(group => {
      if (group.name === seriesName) {
        return { ...group, expanded: !group.expanded };
      }
      return group;
    });
    this.setData({ groupedColors });
  },

  toggleBrandExpand(e) {
    wx.vibrateShort({ type: 'light' });
    const brandId = e.currentTarget.dataset.id;
    const brandName = e.currentTarget.dataset.name;
    const expandedBrands = { ...this.data.expandedBrands };
    expandedBrands[brandId] = !expandedBrands[brandId];

    let selectedBrand = this.data.selectedBrand;
    let selectedSeries = this.data.selectedSeries;
    let currentSeriesList = this.data.currentSeriesList;
    let groupedColors = this.data.groupedColors;

    if (expandedBrands[brandId]) {
      selectedBrand = { id: brandId, name: brandName };
      currentSeriesList = this.getBrandSeries(brandId);
      selectedSeries = null;
      groupedColors = [];
    } else if (this.data.selectedBrand && this.data.selectedBrand.id === brandId) {
      selectedBrand = null;
      selectedSeries = null;
      currentSeriesList = [];
      groupedColors = [];
    }

    this.setData({
      expandedBrands,
      selectedBrand,
      selectedSeries,
      currentSeriesList,
      groupedColors
    });
  },

  toggleBrandColumn() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ brandColumnExpanded: !this.data.brandColumnExpanded });
  },

  selectColor(e) {
    const { hex, code, series } = e.currentTarget.dataset;
    
    if (!hex || !code) {
      wx.showToast({ title: '颜色数据错误', icon: 'none' });
      return;
    }
    
    const selectedColor = { hex, code, series };

    let recentColors = [...this.data.recentColors];
    recentColors = recentColors.filter(c => c.hex !== hex);
    recentColors.unshift(selectedColor);
    recentColors = recentColors.slice(0, 10);

    this.setData({
      selectedColor,
      recentColors,
      isDrawMode: true,
      showColorPalette: false,
      paletteIconColor: hex,
      paletteColorCode: code,
      isSearching: false,
      searchKeyword: '',
      searchResults: []
    });

    wx.setStorageSync('recent_bead_colors', recentColors);
    wx.vibrateShort({ type: 'light' });
    wx.showToast({ title: `已选择 ${code}`, icon: 'success', duration: 1000 });
  },

  toggleDrawMode() {
    wx.vibrateShort({ type: 'light' });

    if (!this.data.selectedColor) {
      wx.showToast({ title: '请先从色盘选择颜色', icon: 'none', duration: 1500 });
      return;
    }

    this.setData({ 
      isDrawMode: !this.data.isDrawMode,
      eraserMode: false
    });
  },

  preventClose() {},

  onDocTap() {
    wx.showToast({ title: '导出功能开发中', icon: 'none' });
  },

  onSaveTap() {
    wx.showToast({ title: '保存功能开发中', icon: 'none' });
  },

  openSettings() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ showSettings: true });
  },

  closeSettings() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ showSettings: false });
  },

  toggleGridLines() {
    const showGridLines = !this.data.showGridLines;
    this.setData({ showGridLines });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
  },

  toggleCenterCross() {
    const showCenterCross = !this.data.showCenterCross;
    this.setData({ showCenterCross });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
  },

  toggleMiniMapSwitch() {
    const showMiniMap = !this.data.showMiniMap;
    this.setData({ showMiniMap });
    this.saveSettings();
    wx.vibrateShort({ type: 'light' });
  },

  toggleAuxiliaryLines() {
    const showAuxiliaryLines = !this.data.showAuxiliaryLines;
    this.setData({ showAuxiliaryLines });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
  },

  toggleAreaBorder() {
    const showAreaBorder = !this.data.showAreaBorder;
    this.setData({ showAreaBorder });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
  },

  toggleColorCodes() {
    const showColorCodes = !this.data.showColorCodes;
    this.setData({ showColorCodes });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
  },

  // 高亮样式相关方法
  openHighlightStylePicker() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ showHighlightStylePicker: true });
  },

  closeHighlightStylePicker() {
    this.setData({ showHighlightStylePicker: false });
  },

  selectHighlightStyle(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      'highlightStyle.type': type
    });
    wx.vibrateShort({ type: 'light' });
    this.closeHighlightStylePicker();
    this.drawGrid();
  },

  openHighlightColorPicker() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ showHighlightColorPicker: true });
  },

  closeHighlightColorPicker() {
    this.setData({ showHighlightColorPicker: false });
  },

  selectHighlightColor(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      'highlightStyle.fillColor': color,
      'highlightStyle.borderColor': color
    });
    wx.vibrateShort({ type: 'light' });
    this.closeHighlightColorPicker();
    this.drawGrid();
  },

  onHighlightOpacityChange(e) {
    const opacity = parseFloat(e.detail.value);
    this.setData({
      'highlightStyle.fillOpacity': opacity
    });
    this.drawGrid();
  },

  onHighlightBorderWidthChange(e) {
    const width = parseInt(e.detail.value);
    this.setData({
      'highlightStyle.borderWidth': width
    });
    this.drawGrid();
  },

  // 选区菜单相关方法
  closeSelectionMenu() {
    this.setData({ selectionMenuVisible: false });
  },

  preventClose() {
    // 阻止关闭
  },

  onSelectionCopy() {
    const { selection } = this.data;
    if (!selection || !selection.cells || selection.cells.length === 0) {
      wx.showToast({ title: '没有选中的豆子', icon: 'none' });
      return;
    }
    
    // 复制到剪贴板
    this.setData({
      clipboard: {
        cells: selection.cells,
        bounds: selection.bounds
      }
    });
    
    wx.showToast({ title: `已复制${selection.cells.length}个豆子`, icon: 'success' });
    this.closeSelectionMenu();
  },

  onSelectionCut() {
    const { selection, beadColors } = this.data;
    if (!selection || !selection.cells || selection.cells.length === 0) {
      wx.showToast({ title: '没有选中的豆子', icon: 'none' });
      return;
    }
    
    // 保存到剪贴板
    this.setData({
      clipboard: {
        cells: selection.cells,
        bounds: selection.bounds
      }
    });
    
    // 删除选中的豆子
    const newBeadColors = { ...beadColors };
    selection.cells.forEach(cell => {
      const key = `${cell.x},${cell.y}`;
      delete newBeadColors[key];
    });
    
    // 清空选区
    this.setData({
      beadColors: newBeadColors,
      selection: null
    });
    
    wx.showToast({ title: `已剪切${selection.cells.length}个豆子`, icon: 'success' });
    this.closeSelectionMenu();
    this.drawGrid();
  },

  onSelectionDelete() {
    const { selection, beadColors } = this.data;
    if (!selection || !selection.cells || selection.cells.length === 0) {
      wx.showToast({ title: '没有选中的豆子', icon: 'none' });
      return;
    }
    
    // 删除选中的豆子
    const newBeadColors = { ...beadColors };
    selection.cells.forEach(cell => {
      const key = `${cell.x},${cell.y}`;
      delete newBeadColors[key];
    });
    
    // 清空选区
    this.setData({
      beadColors: newBeadColors,
      selection: null
    });
    
    wx.showToast({ title: `已删除${selection.cells.length}个豆子`, icon: 'success' });
    this.closeSelectionMenu();
    this.drawGrid();
  },

  onSelectionClear() {
    this.setData({
      selection: null,
      selectionMenuVisible: false
    });
    this.drawGrid();
  },

  // ==================== 导出功能 ====================
  
  openExportModal() {
    if (!this.data.beadColors || Object.keys(this.data.beadColors).length === 0) {
      wx.showToast({ title: '画布是空的，先画点豆子吧～', icon: 'none' });
      return;
    }
    
    // 计算颜色统计
    const { statsList, total } = this._calculateColorStats();
    
    this.setData({
      showExportModal: true,
      exportStatsList: statsList,
      exportStatsTotal: total,
      exportPreviewScale: 100,
      exportPreviewUrl: ''
    }, () => {
      // 生成预览图
      this._generateExportPreview();
    });
  },

  closeExportModal() {
    this.setData({ showExportModal: false });
  },

  onExportToggleGrid(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ exportShowGrid: value }, () => {
      this._generateExportPreview();
    });
  },

  onExportToggleRuler(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ exportShowRuler: value }, () => {
      this._generateExportPreview();
    });
  },

  onExportToggleColorCode(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ exportShowColorCode: value }, () => {
      this._generateExportPreview();
    });
  },

  onExportSetAuxGrid(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const gridSizes = [0, 5, 10];
    this.setData({ 
      exportAuxGridIndex: index,
      exportGridSize: gridSizes[index]
    }, () => {
      this._generateExportPreview();
    });
  },

  onExportToggleHexCode(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ exportShowHexCode: value }, () => {
      this._generateExportPreview();
    });
  },

  onExportSetFontSize(e) {
    const size = e.currentTarget.dataset.size;
    this.setData({ exportFontSize: size }, () => {
      this._generateExportPreview();
    });
  },

  onPreviewZoomIn() {
    const scale = Math.min(300, this.data.exportPreviewScale + 25);
    this.setData({ exportPreviewScale: scale });
  },

  onPreviewZoomOut() {
    const scale = Math.max(50, this.data.exportPreviewScale - 25);
    this.setData({ exportPreviewScale: scale });
  },

  onPreviewZoomReset() {
    this.setData({ exportPreviewScale: 100 });
  },

  _calculateColorStats() {
    const { beadColors } = this.data;
    if (!beadColors || Object.keys(beadColors).length === 0) return { statsList: [], total: 0 };
    
    const colorCount = {};
    let total = 0;
    
    for (let key in beadColors) {
      const color = beadColors[key];
      if (color) {
        colorCount[color] = (colorCount[color] || 0) + 1;
        total++;
      }
    }
    
    const statsList = Object.entries(colorCount)
      .map(([color, count]) => ({
        color,
        count,
        percentage: ((count / total) * 100).toFixed(1),
        brandInfo: this._findBrandInfo(color)
      }))
      .sort((a, b) => b.count - a.count);
    
    return { statsList, total };
  },

  _findBrandInfo(hexColor) {
    if (!colorData) return null;
    
    const normalizedHex = hexColor.toUpperCase();
    
    for (let brandKey in colorData) {
      const brand = colorData[brandKey];
      if (!brand || !brand.subSeries) continue;
      
      for (let series of brand.subSeries) {
        const colors = series.colors || [];
        for (let c of colors) {
          if (c.hex && c.hex.toUpperCase() === normalizedHex) {
            return {
              brand: brandKey,
              brandName: this._getBrandDisplayName(brandKey),
              code: c.code,
              name: c.name
            };
          }
        }
      }
    }
    
    return null;
  },

  _getBrandDisplayName(key) {
    const names = {
      'MARD': 'MARD',
      'COCO': 'COCO',
      'MANMAN': '漫漫',
      'PANPAN': '盼盼',
      'MIXIAOWO': '咪小窝',
      'HDDS': 'H.D.D.S',
      'DODO': 'DODO'
    };
    return names[key] || key;
  },

  _getContrastColor(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  },

  _generateExportPreview() {
    const { gridWidth, gridHeight, beadColors, exportShowGrid, exportShowRuler, exportShowColorCode, exportGridSize } = this.data;
    
    console.log('开始生成预览', { gridWidth, gridHeight, beadColors: Object.keys(beadColors || {}).length });
    
    if (!beadColors || Object.keys(beadColors).length === 0) {
      console.error('没有拼豆数据');
      this.setData({ exportPreviewUrl: '' });
      return;
    }
    
    const cols = gridWidth;
    const rows = gridHeight;
    const grid = Math.max(cols, rows);
    
    const previewW = 800;
    const targetCell = 20;
    const baseW = Math.min(previewW, Math.max(400, cols * targetCell));
    
    const statsList = this.data.exportStatsList || [];
    const outerPad = 12;
    const gapY = 10;
    
    let rulerSize = 0;
    if (exportShowRuler) {
      const maxNum = Math.max(cols, rows);
      const digits = maxNum.toString().length;
      const baseFontSize = Math.max(6, Math.min(12, targetCell * 0.4));
      const maxTextWidth = baseFontSize * 1.5 * digits;
      rulerSize = Math.max(22, Math.min(40, Math.max(maxTextWidth + 8, targetCell * 0.8)));
    }
    
    const dW = baseW + rulerSize * 2;
    const contentW = baseW - outerPad * 2;
    
    const gridRatio = cols / rows;
    let mosaicW, mosaicH;
    if (gridRatio >= 1) {
      mosaicW = contentW;
      mosaicH = contentW / gridRatio;
    } else {
      mosaicH = contentW;
      mosaicW = contentW * gridRatio;
    }
    
    const scale = 0.8;
    const cardHeight = 70 * scale;
    const cardGap = 8 * scale;
    const colCount = contentW >= 500 ? 5 : (contentW >= 400 ? 4 : 3);
    const rowsCount = Math.ceil(Math.max(1, statsList.length) / colCount);
    const statsH = 45 * scale + rowsCount * (cardHeight + cardGap) + 35 * scale;
    const exportH = Math.round(outerPad + rulerSize + mosaicH + rulerSize + gapY + statsH + outerPad);
    
    const rowH = 0;
    
    const query = wx.createSelectorQuery();
    query.select('#exportCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) {
        console.error('未找到导出画布');
        this.setData({ exportPreviewUrl: '' });
        return;
      }
      
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      
      const dpr = 1;
      const wPx = Math.round(dW * dpr);
      const hPx = Math.round(exportH * dpr);
      canvas.width = wPx;
      canvas.height = hPx;
      
      if (typeof ctx.resetTransform === 'function') {
        ctx.resetTransform();
      } else if (typeof ctx.setTransform === 'function') {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      
      ctx.imageSmoothingEnabled = false;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, dW, exportH);
      ctx.fillStyle = '#F2F4F8';
      ctx.fillRect(0, 0, dW, exportH);
      
      const mosaicLeft = outerPad + rulerSize + (contentW - mosaicW) / 2;
      const mosaicTop = outerPad + rulerSize;
      ctx.fillStyle = '#FFFFFF';
      this._fillRoundRect(ctx, mosaicLeft, mosaicTop, mosaicW, mosaicH, 12);
      
      this._renderBeadMosaic(ctx, mosaicLeft, mosaicTop, mosaicW, mosaicH, cols, rows, {
        showGrid: exportShowGrid,
        showRuler: exportShowRuler,
        showColorCode: exportShowColorCode,
        showHexCode: this.data.exportShowHexCode,
        fontSize: this.data.exportFontSize,
        gridSize: exportGridSize
      });
      
      const statsLeft = outerPad;
      const statsTop = mosaicTop + mosaicH + rulerSize + gapY;
      
      console.log('准备渲染颜色统计', {
        statsLeft,
        statsTop,
        width: dW - outerPad * 2,
        statsH,
        statsListLength: statsList ? statsList.length : 0,
        colCount,
        scale: 0.8
      });
      
      try {
        this._renderStatsSection(ctx, statsLeft, statsTop, dW - outerPad * 2, statsH, statsList, colCount, rowH, this.data.exportShowHexCode, 0.8);
      } catch (err) {
        console.error('渲染颜色统计失败', err);
      }
      
      wx.canvasToTempFilePath({
        canvas,
        width: wPx,
        height: hPx,
        destWidth: wPx,
        destHeight: hPx,
        fileType: 'png',
        quality: 1,
        success: (r) => {
          this.setData({ exportPreviewUrl: r.tempFilePath });
        },
        fail: (err) => {
          console.error('生成预览失败', err);
          this.setData({ exportPreviewUrl: '' });
        }
      });
    });
  },

  async onSaveExportImage() {
    if (this.data.isExporting) return;
    
    this.setData({ isExporting: true });
    wx.showLoading({ title: '正在生成高清图...' });
    
    try {
      const path = await this._exportBeadImage();
      if (!path) {
        wx.hideLoading();
        wx.showToast({ title: '导出失败，请重试', icon: 'none' });
        this.setData({ isExporting: false });
        return;
      }
      
      wx.showLoading({ title: '正在保存到相册...' });
      const ok = await this._saveToAlbum(path);
      if (ok) {
        wx.showToast({ title: '已保存到相册！✨', icon: 'success' });
        this.closeExportModal();
      }
    } catch (err) {
      console.error('导出失败', err);
      wx.showToast({ title: '导出失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ isExporting: false });
    }
  },

  _exportBeadImage() {
    return new Promise((resolve) => {
      const { gridWidth, gridHeight, beadColors, exportShowGrid, exportShowRuler, exportShowColorCode, exportGridSize } = this.data;
      
      if (!beadColors || Object.keys(beadColors).length === 0) {
        console.error('没有拼豆数据');
        resolve('');
        return;
      }
      
      const systemInfo = wx.getSystemInfoSync();
      const dpr = systemInfo.pixelRatio || 2;
      const hdScale = 2;
      
      const targetCell = 28;
      const cols = gridWidth;
      const rows = gridHeight;
      const grid = Math.max(cols, rows);
      
      const maxExportW = grid >= 96 ? 4000 : (grid >= 80 ? 3200 : (grid >= 64 ? 2400 : 2000));
      const baseW = Math.min(maxExportW, Math.max(800, cols * targetCell));
      
      const statsList = this.data.exportStatsList || [];
      const outerPad = 18;
      const gapY = 14;
      
      let rulerSize = 0;
      if (exportShowRuler) {
        const maxNum = Math.max(cols, rows);
        const digits = maxNum.toString().length;
        const baseFontSize = Math.max(6, Math.min(12, targetCell * 0.4));
        const maxTextWidth = baseFontSize * 1.5 * digits;
        rulerSize = Math.max(22, Math.min(40, Math.max(maxTextWidth + 8, targetCell * 0.8)));
      }
      
      const dW = baseW + rulerSize * 2;
      const contentW = baseW - outerPad * 2;
      
      const gridRatio = cols / rows;
      let mosaicW, mosaicH;
      if (gridRatio >= 1) {
        mosaicW = contentW;
        mosaicH = contentW / gridRatio;
      } else {
        mosaicH = contentW;
        mosaicW = contentW * gridRatio;
      }
      
      const scale = 1;
      const cardHeight = 60 * scale;
      const cardGap = 8 * scale;
      const colCount = contentW >= 700 ? 6 : (contentW >= 550 ? 5 : (contentW >= 400 ? 4 : 3));
      const rowsCount = Math.ceil(Math.max(1, statsList.length) / colCount);
      const statsH = 45 * scale + rowsCount * (cardHeight + cardGap) + 35 * scale;
      const exportH = Math.round(outerPad + rulerSize + mosaicH + rulerSize + gapY + statsH + outerPad);
      
      // rowH 已废弃，Pantone 风格使用 cardHeight
      const rowH = 0;
      
      const query = wx.createSelectorQuery();
      query.select('#exportCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0]) {
          console.error('未找到导出画布');
          resolve('');
          return;
        }
        
        const canvas = res[0].node;
        if (!canvas) {
          console.error('画布节点无效');
          resolve('');
          return;
        }
        
        const ctx = canvas.getContext('2d');
        
        const maxTexPx = 4096;
        let renderScale = Math.min(dpr * hdScale, maxTexPx / Math.max(1, dW), maxTexPx / Math.max(1, exportH));
        renderScale = Math.floor(Math.max(1, renderScale));
        
        const wPx = Math.round(dW * renderScale);
        const hPx = Math.round(exportH * renderScale);
        
        console.log('导出尺寸:', wPx, 'x', hPx, 'renderScale:', renderScale);
        
        canvas.width = wPx;
        canvas.height = hPx;
        
        if (typeof ctx.resetTransform === 'function') {
          ctx.resetTransform();
        } else if (typeof ctx.setTransform === 'function') {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        
        ctx.imageSmoothingEnabled = false;
        ctx.scale(renderScale, renderScale);
        ctx.clearRect(0, 0, dW, exportH);
        ctx.fillStyle = '#F2F4F8';
        ctx.fillRect(0, 0, dW, exportH);
        
        const mosaicLeft = outerPad + rulerSize + (contentW - mosaicW) / 2;
        const mosaicTop = outerPad + rulerSize;
        ctx.fillStyle = '#FFFFFF';
        this._fillRoundRect(ctx, mosaicLeft, mosaicTop, mosaicW, mosaicH, 18);
        
        this._renderBeadMosaic(ctx, mosaicLeft, mosaicTop, mosaicW, mosaicH, cols, rows, {
          showGrid: exportShowGrid,
          showRuler: exportShowRuler,
          showColorCode: exportShowColorCode,
          showHexCode: this.data.exportShowHexCode,
          fontSize: this.data.exportFontSize,
          gridSize: exportGridSize
        });
        
        const statsLeft = outerPad;
        const statsTop = mosaicTop + mosaicH + rulerSize + gapY;
        
        try {
          this._renderStatsSection(ctx, statsLeft, statsTop, dW - outerPad * 2, statsH, statsList, colCount, rowH, this.data.exportShowHexCode, 1);
        } catch (err) {
          console.error('渲染颜色统计失败（高清）', err);
        }
        
        wx.canvasToTempFilePath({
          canvas,
          width: wPx,
          height: hPx,
          destWidth: wPx,
          destHeight: hPx,
          fileType: 'png',
          quality: 1,
          success: (r) => {
            console.log('导出成功:', r.tempFilePath);
            resolve(r.tempFilePath);
          },
          fail: (err) => {
            console.error('canvasToTempFilePath失败:', err);
            resolve('');
          }
        });
      });
    });
  },

  _renderBeadMosaic(ctx, left, top, width, height, cols, rows, options) {
    const { showGrid, showRuler, showColorCode, gridSize } = options;
    const cellW = width / cols;
    const cellH = height / rows;
    const { beadColors } = this.data;
    
    for (let key in beadColors) {
      const [x, y] = key.split(',').map(Number);
      if (x < 1 || x > cols || y < 1 || y > rows) continue;
      
      const color = beadColors[key];
      const px = left + (x - 1) * cellW;
      const py = top + (y - 1) * cellH;
      
      ctx.fillStyle = color;
      ctx.fillRect(px, py, cellW, cellH);
      
      if (showColorCode && cellW >= 20 && cellH >= 20) {
        const brandInfo = this._findBrandInfo(color);
        if (brandInfo && brandInfo.code) {
          const textColor = this._getContrastColor(color);
          ctx.fillStyle = textColor;
          
          const fontSizeMap = { small: 0.6, medium: 1, large: 1.4 };
          const fontSizeMultiplier = fontSizeMap[options.fontSize] || 1;
          const baseFontSize = Math.max(8, Math.min(16, cellW / 3.5));
          const fontSize = Math.round(baseFontSize * fontSizeMultiplier);
          
          ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          ctx.fillText(brandInfo.code, px + cellW / 2, py + cellH / 2);
        }
      }
    }
    
    // 绘制网格
    if (showGrid) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 0.5;
      
      for (let i = 0; i <= cols; i++) {
        const x = left + i * cellW;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, top + height);
        ctx.stroke();
      }
      
      for (let i = 0; i <= rows; i++) {
        const y = top + i * cellH;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + width, y);
        ctx.stroke();
      }
      
      // 绘制辅助粗线
      if (gridSize > 0) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1.5;
        
        for (let i = 0; i <= cols; i += gridSize) {
          const x = left + i * cellW;
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x, top + height);
          ctx.stroke();
        }
        
        for (let i = 0; i <= rows; i += gridSize) {
          const y = top + i * cellH;
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(left + width, y);
          ctx.stroke();
        }
      }
    }
    
    // 绘制标尺
    if (showRuler) {
      const maxNum = Math.max(cols, rows);
      const digits = maxNum.toString().length;
      const baseFontSize = Math.max(6, Math.min(12, cellW * 0.4));
      const maxTextWidth = baseFontSize * 1.5 * digits;
      const rulerSize = Math.max(22, Math.min(40, Math.max(maxTextWidth + 8, cellW * 0.8)));
      
      ctx.save();
      ctx.beginPath();
      ctx.rect(left - rulerSize, top, rulerSize, height);
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.fillRect(left - rulerSize, top, rulerSize, height);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left - rulerSize, top, rulerSize, height);
      
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i <= rows; i++) {
        const y = top + i * cellH;
        ctx.beginPath();
        ctx.moveTo(left - rulerSize, y);
        ctx.lineTo(left, y);
        ctx.stroke();
      }
      
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (let i = 1; i <= rows; i++) {
        const x = left - rulerSize / 2;
        const y = top + (i - 0.5) * cellH;
        
        let fontSize = baseFontSize;
        let fontWeight = 'normal';
        let textColor = '#666';
        
        if (i % 10 === 0) {
          fontWeight = 'bold';
          textColor = '#000';
          fontSize = Math.min(fontSize * 1.2, 12);
        } else if (i % 5 === 0) {
          fontWeight = '600';
          textColor = '#333';
          fontSize = Math.min(fontSize * 1.1, 11);
        }
        
        ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(i.toString(), x, y);
      }
      ctx.restore();
      
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top - rulerSize, width, rulerSize);
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.fillRect(left, top - rulerSize, width, rulerSize);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left, top - rulerSize, width, rulerSize);
      
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i <= cols; i++) {
        const x = left + i * cellW;
        ctx.beginPath();
        ctx.moveTo(x, top - rulerSize);
        ctx.lineTo(x, top);
        ctx.stroke();
      }
      
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (let i = 1; i <= cols; i++) {
        const x = left + (i - 0.5) * cellW;
        const y = top - rulerSize / 2;
        
        let fontSize = baseFontSize;
        let fontWeight = 'normal';
        let textColor = '#666';
        
        if (i % 10 === 0) {
          fontWeight = 'bold';
          textColor = '#000';
          fontSize = Math.min(fontSize * 1.2, 12);
        } else if (i % 5 === 0) {
          fontWeight = '600';
          textColor = '#333';
          fontSize = Math.min(fontSize * 1.1, 11);
        }
        
        ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(i.toString(), x, y);
      }
      ctx.restore();
      
      // 右侧标尺
      ctx.save();
      ctx.beginPath();
      ctx.rect(left + width, top, rulerSize, height);
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.fillRect(left + width, top, rulerSize, height);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left + width, top, rulerSize, height);
      
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i <= rows; i++) {
        const y = top + i * cellH;
        ctx.beginPath();
        ctx.moveTo(left + width, y);
        ctx.lineTo(left + width + rulerSize, y);
        ctx.stroke();
      }
      
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (let i = 1; i <= rows; i++) {
        const x = left + width + rulerSize / 2;
        const y = top + (i - 0.5) * cellH;
        
        let fontSize = baseFontSize;
        let fontWeight = 'normal';
        let textColor = '#666';
        
        if (i % 10 === 0) {
          fontWeight = 'bold';
          textColor = '#000';
          fontSize = Math.min(fontSize * 1.2, 12);
        } else if (i % 5 === 0) {
          fontWeight = '600';
          textColor = '#333';
          fontSize = Math.min(fontSize * 1.1, 11);
        }
        
        ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(i.toString(), x, y);
      }
      ctx.restore();
      
      // 底部标尺
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top + height, width, rulerSize);
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.fillRect(left, top + height, width, rulerSize);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left, top + height, width, rulerSize);
      
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i <= cols; i++) {
        const x = left + i * cellW;
        ctx.beginPath();
        ctx.moveTo(x, top + height);
        ctx.lineTo(x, top + height + rulerSize);
        ctx.stroke();
      }
      
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (let i = 1; i <= cols; i++) {
        const x = left + (i - 0.5) * cellW;
        const y = top + height + rulerSize / 2;
        
        let fontSize = baseFontSize;
        let fontWeight = 'normal';
        let textColor = '#666';
        
        if (i % 10 === 0) {
          fontWeight = 'bold';
          textColor = '#000';
          fontSize = Math.min(fontSize * 1.2, 12);
        } else if (i % 5 === 0) {
          fontWeight = '600';
          textColor = '#333';
          fontSize = Math.min(fontSize * 1.1, 11);
        }
        
        ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(i.toString(), x, y);
      }
      ctx.restore();
    }
  },

  _renderStatsSection(ctx, left, top, width, height, items, colCount, rowH, showHexCode, scale = 1) {
    const cardPadding = 10 * scale;
    const cardGap = 8 * scale;
    const actualColCount = Math.max(1, colCount || 1);
    const cardWidth = (width - cardPadding * 2 - cardGap * (actualColCount - 1)) / actualColCount;
    const cardHeight = 70 * scale;
    const colorBlockHeight = 36 * scale;
    const infoHeight = cardHeight - colorBlockHeight;
    const borderRadius = 8 * scale;
    const fontSize1 = Math.round(16 * scale);
    const fontSize2 = Math.round(12 * scale);
    const fontSize3 = Math.round(11 * scale);
    const fontSize4 = Math.round(10 * scale);
    const fontSize5 = Math.round(9 * scale);
    
    if (cardWidth <= 0 || !items || items.length === 0) {
      ctx.fillStyle = '#F8F9FA';
      this._fillRoundRect(ctx, left, top, width, height, 18 * scale);
      ctx.fillStyle = '#999';
      ctx.font = `${fontSize2}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('暂无颜色统计', left + width / 2, top + height / 2);
      return;
    }
    
    const total = items.reduce((sum, item) => sum + item.count, 0);
    const rowsCount = Math.ceil(Math.max(1, items.length) / actualColCount);
    const totalHeight = 45 * scale + rowsCount * (cardHeight + cardGap) + 35 * scale;
    
    ctx.fillStyle = '#F8F9FA';
    this._fillRoundRect(ctx, left, top, width, totalHeight, 18 * scale);
    
    ctx.fillStyle = '#1c1c1e';
    ctx.font = `bold ${fontSize1}px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('颜色统计', left + cardPadding, top + 28 * scale);
    
    ctx.font = `${fontSize2}px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8e8e93';
    ctx.fillText(`共 ${total} 个豆子`, left + width - cardPadding, top + 28 * scale);
    
    const startY = top + 45 * scale;
    
    items.forEach((item, index) => {
      const col = index % actualColCount;
      const row = Math.floor(index / actualColCount);
      const x = left + cardPadding + col * (cardWidth + cardGap);
      const y = startY + row * (cardHeight + cardGap);
      
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
      ctx.shadowBlur = 6 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1 * scale;
      
      ctx.fillStyle = '#FFFFFF';
      this._fillRoundRect(ctx, x, y, cardWidth, cardHeight, borderRadius);
      
      ctx.restore();
      
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cardWidth, colorBlockHeight);
      ctx.clip();
      
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, cardWidth, colorBlockHeight);
      
      ctx.restore();
      
      ctx.beginPath();
      ctx.moveTo(x, y + colorBlockHeight);
      ctx.lineTo(x + cardWidth, y + colorBlockHeight);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      const infoY = y + colorBlockHeight + 14 * scale;
      ctx.textAlign = 'left';
      
      if (item.brandInfo) {
        ctx.fillStyle = '#1c1c1e';
        ctx.font = `bold ${fontSize3}px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif`;
        ctx.fillText(`${item.brandInfo.code}`, x + 6 * scale, infoY);
        
        ctx.fillStyle = '#8e8e93';
        ctx.font = `${fontSize4}px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif`;
        ctx.fillText(item.brandInfo.brandName, x + 6 * scale, infoY + 12 * scale);
      } else {
        ctx.fillStyle = '#1c1c1e';
        ctx.font = `bold ${fontSize3}px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif`;
        ctx.fillText(item.color.toUpperCase(), x + 6 * scale, infoY);
      }
      
      ctx.fillStyle = '#1c1c1e';
      ctx.font = `${fontSize3}px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`${item.count}`, x + cardWidth - 6 * scale, infoY);
      
      ctx.fillStyle = '#8e8e93';
      ctx.font = `${fontSize5}px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif`;
      ctx.fillText(`${item.percentage}%`, x + cardWidth - 6 * scale, infoY + 12 * scale);
      
      if (showHexCode) {
        ctx.fillStyle = '#c7c7cc';
        ctx.font = `${fontSize5}px SF Mono, Monaco, monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(item.color.toUpperCase(), x + 6 * scale, infoY + 24 * scale);
      }
    });
    
    const footerY = startY + rowsCount * (cardHeight + cardGap) + 8 * scale;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + cardPadding, footerY);
    ctx.lineTo(left + width - cardPadding, footerY);
    ctx.stroke();
    
    ctx.fillStyle = '#8e8e93';
    ctx.font = `${fontSize4}px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`共 ${items.length} 种颜色 · ${total} 个豆子`, left + width / 2, footerY + 18 * scale);
  },

  _fillRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  },

  _saveToAlbum(filePath) {
    return new Promise((resolve) => {
      const path = String(filePath || '');
      if (!path) {
        console.error('保存路径为空');
        wx.showToast({ title: '图片路径无效', icon: 'none' });
        resolve(false);
        return;
      }
      
      console.log('准备保存图片到相册:', path);
      
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
          success: () => {
            console.log('保存成功');
            resolve(true);
          },
          fail: (err) => {
            console.error('保存失败:', err);
            const msg = String((err && err.errMsg) || '');
            if (msg.includes('auth') || msg.includes('authorize') || msg.includes('denied') || msg.includes('deny')) {
              openPermission();
              return;
            }
            wx.showToast({ title: '保存失败: ' + (err.errMsg || '未知错误'), icon: 'none', duration: 2000 });
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

  openBorderColorPicker() {
    this.setData({ showBorderColorPicker: true });
  },

  onXAxisTap(e) {
    console.log('点击了 X 轴坐标');
    const value = parseInt(e.currentTarget.dataset.value);
    const { highlightedCols } = this.data;
    
    const index = highlightedCols.indexOf(value);
    if (index > -1) {
      highlightedCols.splice(index, 1);
    } else {
      highlightedCols.push(value);
    }
    
    this.setData({ highlightedCols });
    wx.vibrateShort({ type: 'light' });
    this.drawGrid();
  },

  onYAxisTap(e) {
    const value = parseInt(e.currentTarget.dataset.value);
    const { highlightedRows } = this.data;
    
    const index = highlightedRows.indexOf(value);
    if (index > -1) {
      highlightedRows.splice(index, 1);
    } else {
      highlightedRows.push(value);
    }
    
    this.setData({ highlightedRows });
    wx.vibrateShort({ type: 'light' });
    this.drawGrid();
  },

  openBorderColorPicker() {
    this.setData({ showBorderColorPicker: true });
  },

  closeBorderColorPicker() {
    this.setData({ showBorderColorPicker: false });
  },

  selectBorderColor(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      areaBorderColor: color,
      showBorderColorPicker: false
    });
    wx.vibrateShort({ type: 'light' });
    this.drawGrid();
  },

  setGridLineColor(e) {
    const gridLineColor = e.currentTarget.dataset.color;
    this.setData({ gridLineColor });
    this.saveSettings();
    this.drawGrid();
  },

  setBeadShape(e) {
    const beadShape = e.currentTarget.dataset.shape;
    this.setData({ beadShape });
    this.saveSettings();
    this.drawGrid();
  },

  // 滑动条拖动中（实时更新预览）
  onGridWidthChanging(e) {
    const value = e.detail.value;
    this.setData({
      gridWidth: value,
      previewSize: this.calculatePreviewSize(value, this.data.gridHeight)
    });
  },

  onGridHeightChanging(e) {
    const value = e.detail.value;
    this.setData({
      gridHeight: value,
      previewSize: this.calculatePreviewSize(this.data.gridWidth, value)
    });
  },

  // 滑动条拖动结束（保存并刷新画布）
  onGridWidthChange(e) {
    const value = e.detail.value;
    this.setData({
      gridWidth: value,
      previewSize: this.calculatePreviewSize(value, this.data.gridHeight)
    });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
  },

  onGridHeightChange(e) {
    const value = e.detail.value;
    this.setData({
      gridHeight: value,
      previewSize: this.calculatePreviewSize(this.data.gridWidth, value)
    });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
  },

  // 计算预览框尺寸
  calculatePreviewSize(width, height) {
    const maxSize = 200;
    const minSize = 80;
    const ratio = Math.min(maxSize / width, maxSize / height, 10);
    return {
      width: Math.max(minSize, width * ratio * 0.5),
      height: Math.max(minSize, height * ratio * 0.5)
    };
  },

  // 设置预设尺寸
  setPresetSize(e) {
    const { w, h } = e.currentTarget.dataset;
    this.setData({
      gridWidth: parseInt(w),
      gridHeight: parseInt(h),
      previewSize: this.calculatePreviewSize(parseInt(w), parseInt(h))
    });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
    wx.showToast({ title: `已设置为 ${w}×${h}`, icon: 'none', duration: 1000 });
  },

  // 设置循环间隔
  onCycleIntervalChange(e) {
    const value = parseInt(e.detail.value);
    this.setData({ gridCycleInterval: value });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
  },

  setCycleInterval(e) {
    const value = parseInt(e.currentTarget.dataset.value);
    this.setData({ gridCycleInterval: value });
    this.saveSettings();
    this.drawGrid();
    wx.vibrateShort({ type: 'light' });
  },

  saveSettings() {
    const settings = {
      showGridLines: this.data.showGridLines,
      showCenterCross: this.data.showCenterCross,
      showAuxiliaryLines: this.data.showAuxiliaryLines,
      showAreaBorder: this.data.showAreaBorder,
      showColorCodes: this.data.showColorCodes,
      areaBorderColor: this.data.areaBorderColor,
      gridLineColor: this.data.gridLineColor,
      beadShape: this.data.beadShape,
      showMiniMap: this.data.showMiniMap,
      gridWidth: this.data.gridWidth,
      gridHeight: this.data.gridHeight,
      gridCycleInterval: this.data.gridCycleInterval
    };
    wx.setStorageSync('bead_mode_settings', settings);
  },

  loadSettings() {
    const settings = wx.getStorageSync('bead_mode_settings');
    if (settings) {
      this.setData({
        showGridLines: settings.showGridLines !== false,
        showCenterCross: settings.showCenterCross !== false,
        showAuxiliaryLines: settings.showAuxiliaryLines !== false,
        showAreaBorder: settings.showAreaBorder !== false,
        showColorCodes: settings.showColorCodes || false,
        areaBorderColor: settings.areaBorderColor || 'blue',
        gridLineColor: settings.gridLineColor || 'light',
        beadShape: settings.beadShape || 'square',
        showMiniMap: settings.showMiniMap !== false,
        gridWidth: settings.gridWidth || 32,
        gridHeight: settings.gridHeight || 32,
        gridCycleInterval: settings.gridCycleInterval || 5
      });
    }
  },

  onUnload() {},

  loadQuickButtons() {
    const saved = wx.getStorageSync('bead_quick_buttons');
    if (saved) {
      this.setData({ quickButtons: saved });
    }
  },

  saveQuickButtons() {
    wx.setStorageSync('bead_quick_buttons', this.data.quickButtons);
  },

  toggleToolbar() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ toolbarExpanded: !this.data.toolbarExpanded });
  },

  onQuickButtonTap(e) {
    const side = e.currentTarget.dataset.side;
    const quickBtn = this.data.quickButtons[side];
    if (quickBtn) {
      this.executeTool(quickBtn.id);
    }
  },

  onToolbarToolTap(e) {
    const toolId = e.currentTarget.dataset.id;
    this.executeTool(toolId);
  },

  executeTool(toolId) {
    wx.vibrateShort({ type: 'light' });
    switch (toolId) {
      case 'magic':
        this.toggleMagicWandMode();
        break;
      case 'brush':
        this.toggleDrawMode();
        break;
      case 'eraser':
        this.toggleEraserMode();
        break;
      case 'undo':
        this.undo();
        break;
      case 'redo':
        this.redo();
        break;
      case 'zoomIn':
        this.zoomIn();
        break;
      case 'zoomOut':
        this.zoomOut();
        break;
      case 'origin':
        this.resetView();
        break;
      case 'settings':
        this.openSettings();
        break;
      case 'palette':
        this.openColorPalette();
        break;
      case 'eyedropper':
        this.toggleEyedropperMode();
        break;
      case 'importImage':
        this.openImportImage();
        break;
      case 'export':
        this.openExportModal();
        break;
      case 'publish':
        this.openPublishModal();
        break;
    }
  },

  onToolLongPress(e) {
    const toolId = e.currentTarget.dataset.id;
    const tool = this.data.toolbarTools.find(t => t.id === toolId);
    if (!tool) return;

    // 获取手指位置
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;

    // 如果是画笔或橡皮，显示设置面板
    if (toolId === 'brush' || toolId === 'eraser') {
      wx.vibrateShort({ type: 'light' });
      this.setData({
        showBrushSettings: true,
        brushSettingsTarget: toolId,
        brushSettingsX: touchX,
        brushSettingsY: touchY,
        scrollEnabled: false,
        draggingTool: tool,
        dragStartX: touchX,
        dragStartY: touchY,
        dragCurrentX: touchX,
        dragCurrentY: touchY
      });
    } else {
      // 其他工具直接开始拖拽
      wx.vibrateShort({ type: 'medium' });
      this.setData({
        scrollEnabled: false,
        draggingTool: tool,
        dragStartX: touchX,
        dragStartY: touchY,
        dragCurrentX: touchX,
        dragCurrentY: touchY
      });
    }
  },

  onToolTouchMove(e) {
    if (!this.data.draggingTool) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = Math.abs(currentX - this.data.dragStartX);
    const deltaY = Math.abs(currentY - this.data.dragStartY);

    // 如果移动超过10像素且设置面板显示中，隐藏设置面板
    if ((deltaX > 10 || deltaY > 10) && this.data.showBrushSettings) {
      this.setData({
        showBrushSettings: false
      });
    }

    this.setData({
      dragCurrentX: currentX,
      dragCurrentY: currentY
    });
    this.checkDragTarget(currentX, currentY);
  },

  onToolTouchEnd(e) {
    if (!this.data.draggingTool) return;
    const { draggingTool, dragTarget, quickButtons, toolbarTools, showBrushSettings } = this.data;

    // 如果设置面板显示中，且没有发生拖拽操作，保持面板显示
    if (showBrushSettings && !dragTarget) {
      // 只是松手了，没有拖拽到其他位置，保持设置面板显示
      this.setData({
        scrollEnabled: true,
        draggingTool: null,
        dragTarget: null
      });
      return;
    }

    // 先保存需要的数据，再清除状态
    const savedDraggingTool = { ...draggingTool };
    const savedDragTarget = dragTarget;

    // 清除拖拽状态
    this.setData({
      draggingTool: null,
      dragTarget: null
    });

    if (savedDragTarget === 'left' || savedDragTarget === 'center' || savedDragTarget === 'right') {
      const newQuickButtons = { ...quickButtons };
      newQuickButtons[savedDragTarget] = savedDraggingTool;
      this.setData({ quickButtons: newQuickButtons });
      this.saveQuickButtons();
      const sideName = savedDragTarget === 'left' ? '左' : (savedDragTarget === 'center' ? '中' : '右');
      wx.showToast({ title: `已设为${sideName}快捷键`, icon: 'none', duration: 1000 });
    } else if (savedDragTarget && savedDragTarget.startsWith('tool_')) {
      const targetId = savedDragTarget.replace('tool_', '');
      const targetIndex = toolbarTools.findIndex(t => t.id === targetId);
      const sourceIndex = toolbarTools.findIndex(t => t.id === savedDraggingTool.id);
      if (targetIndex !== -1 && sourceIndex !== -1 && targetIndex !== sourceIndex) {
        const newTools = [...toolbarTools];
        [newTools[sourceIndex], newTools[targetIndex]] = [newTools[targetIndex], newTools[sourceIndex]];
        this.setData({ toolbarTools: newTools });
      }
    }

    // 确保所有状态都被清除
    this.setData({
      showBrushSettings: false,
      brushSettingsTarget: null,
      scrollEnabled: true
    });
  },

  checkDragTarget(x, y) {
    const query = wx.createSelectorQuery();
    query.selectAll('.quick-btn-left, .quick-btn-center, .quick-btn-right, .toolbar-tool').fields({
      rect: true,
      dataset: true
    });
    query.exec((res) => {
      if (!res[0] || !this.data.draggingTool) return;
      let foundTarget = null;
      for (const rect of res[0]) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          if (rect.dataset && rect.dataset.side) {
            foundTarget = rect.dataset.side;
          } else if (rect.dataset && rect.dataset.id) {
            // 排除正在拖拽的工具本身
            if (rect.dataset.id !== this.data.draggingTool.id) {
              foundTarget = 'tool_' + rect.dataset.id;
            }
          }
          break;
        }
      }
      if (foundTarget !== this.data.dragTarget) {
        this.setData({ dragTarget: foundTarget });
      }
    });
  },

  onQuickButtonLongPress(e) {
    const side = e.currentTarget.dataset.side;
    const quickBtn = this.data.quickButtons[side];
    if (!quickBtn) return;

    // 获取手指位置
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;

    // 如果是画笔或橡皮，显示设置面板
    if (quickBtn.id === 'brush' || quickBtn.id === 'eraser') {
      wx.vibrateShort({ type: 'light' });
      this.setData({
        showBrushSettings: true,
        brushSettingsTarget: quickBtn.id,
        brushSettingsX: touchX,
        brushSettingsY: touchY,
        scrollEnabled: false,
        draggingTool: quickBtn,
        dragStartX: touchX,
        dragStartY: touchY,
        dragCurrentX: touchX,
        dragCurrentY: touchY
      });
    } else {
      // 其他按钮显示提示
      wx.vibrateShort({ type: 'medium' });
      this.setData({
        scrollEnabled: false,
        showTooltip: true,
        tooltipText: quickBtn.name,
        tooltipSide: side,
        draggingTool: quickBtn,
        dragStartX: touchX,
        dragStartY: touchY,
        dragCurrentX: touchX,
        dragCurrentY: touchY
      });
      setTimeout(() => {
        if (this.data.showTooltip) {
          this.setData({ showTooltip: false });
        }
      }, 1500);
    }
  },

  onQuickButtonTouchMove(e) {
    if (!this.data.draggingTool) return;
    this.setData({
      showTooltip: false,
      dragCurrentX: e.touches[0].clientX,
      dragCurrentY: e.touches[0].clientY
    });
    this.checkDragTarget(e.touches[0].clientX, e.touches[0].clientY);
  },

  onQuickButtonTouchEnd(e) {
    this.setData({ showTooltip: false });
    this.onToolTouchEnd(e);
  },

  // 画笔设置相关方法
  closeBrushSettings() {
    this.setData({
      showBrushSettings: false,
      brushSettingsTarget: null
    });
  },

  onBrushSizeChange(e) {
    const size = e.detail.value;
    this.setData({ brushSize: size });
    wx.vibrateShort({ type: 'light' });
  },

  onBrushSizeChanging(e) {
    const size = e.detail.value;
    this.setData({ brushSize: size });
  },

  setBrushShape(e) {
    const shape = e.currentTarget.dataset.shape;
    this.setData({ brushShape: shape });
    wx.vibrateShort({ type: 'light' });
  },

  setSymmetryMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ symmetryMode: mode });
    wx.vibrateShort({ type: 'light' });
  },

  selectBrushStyle(e) {
    const style = e.currentTarget.dataset.style;
    // 更新画笔图标为选中的风格
    const newToolbarTools = this.data.toolbarTools.map(tool => {
      if (tool.id === 'brush') {
        return { ...tool, iconClass: `icon-brush-${style}` };
      }
      return tool;
    });
    
    // 同时更新快捷按钮中的画笔
    const newQuickButtons = { ...this.data.quickButtons };
    Object.keys(newQuickButtons).forEach(key => {
      if (newQuickButtons[key].id === 'brush') {
        newQuickButtons[key] = { ...newQuickButtons[key], iconClass: `icon-brush-${style}` };
      }
    });
    
    this.setData({ 
      toolbarTools: newToolbarTools,
      quickButtons: newQuickButtons
    });
    
    wx.vibrateShort({ type: 'light' });
    wx.showToast({ title: `已选择画笔${style}`, icon: 'none', duration: 1000 });
  },

  // 选择器相关方法
  openColorPicker() {
    this.setData({ showColorPicker: true });
  },

  closeColorPicker() {
    this.setData({ showColorPicker: false });
  },

  selectGridLineColor(e) {
    const color = e.currentTarget.dataset.color;
    const colorName = this.data.gridColorNames[color];
    this.setData({
      gridLineColor: color,
      gridLineColorName: colorName,
      showColorPicker: false
    });
    wx.vibrateShort({ type: 'light' });
    this.drawGrid();
  },

  openShapePicker() {
    this.setData({ showShapePicker: true });
  },

  closeShapePicker() {
    this.setData({ showShapePicker: false });
  },

  selectShape(e) {
    const shape = e.currentTarget.dataset.shape;
    const shapeName = shape === 'square' ? '方形' : '圆形';
    this.setData({
      beadShape: shape,
      beadShapeName: shapeName,
      showShapePicker: false
    });
    wx.vibrateShort({ type: 'light' });
    this.drawGrid();
  },

  openSizePicker() {
    this.setData({ showSizePicker: true });
  },

  closeSizePicker() {
    this.setData({ showSizePicker: false });
  },

  selectSize(e) {
    const w = parseInt(e.currentTarget.dataset.w);
    const h = parseInt(e.currentTarget.dataset.h);
    this.setData({
      gridWidth: w,
      gridHeight: h,
      showSizePicker: false
    });
    wx.vibrateShort({ type: 'light' });
    this.initCanvas();
  },

  onWidthInput(e) {
    const value = parseInt(e.detail.value) || 5;
    const clampedValue = Math.max(5, Math.min(128, value));
    this.setData({ gridWidth: clampedValue });
  },

  onHeightInput(e) {
    const value = parseInt(e.detail.value) || 5;
    const clampedValue = Math.max(5, Math.min(128, value));
    this.setData({ gridHeight: clampedValue });
  },

  openIntervalPicker() {
    this.setData({ showIntervalPicker: true });
  },

  closeIntervalPicker() {
    this.setData({ showIntervalPicker: false });
  },

  selectInterval(e) {
    const value = parseInt(e.currentTarget.dataset.value);
    this.setData({
      gridCycleInterval: value,
      showIntervalPicker: false
    });
    wx.vibrateShort({ type: 'light' });
    this.drawGrid();
  },

  onIntervalChange(e) {
    const value = e.detail.value;
    this.setData({ gridCycleInterval: value });
    this.drawGrid();
  },

  // 导入图片相关方法
  openImportImage() {
    const mardIndex = this.data.brands.findIndex(b => b.id === 'mard');
    this.setData({
      showImportImage: true,
      importImageSrc: '',
      importImageWidth: 0,
      importImageHeight: 0,
      importBrand: 'mard',
      importBrandIndex: mardIndex >= 0 ? mardIndex : 0,
      importBrandName: 'MARD',
      importBaseSize: 32,
      importPreviewWidth: 32,
      importPreviewHeight: 32
    });
  },

  closeImportImage() {
    this.setData({ showImportImage: false });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        wx.getImageInfo({
          src: tempFilePath,
          success: (info) => {
            const outputSize = colorMatching.calculateOutputSize(info.width, info.height, this.data.importBaseSize);
            
            this.setData({
              importImageSrc: tempFilePath,
              importImageWidth: info.width,
              importImageHeight: info.height,
              importPreviewWidth: outputSize.width,
              importPreviewHeight: outputSize.height
            });
          }
        });
      }
    });
  },

  onImportBrandChange(e) {
    const index = parseInt(e.detail.value);
    const brand = this.data.brands[index];
    if (brand) {
      this.setData({
        importBrandIndex: index,
        importBrandName: brand.name,
        importBrand: brand.id
      });
    }
  },

  onImportBaseSizeChange(e) {
    const baseSize = parseInt(e.detail.value);
    const { importImageWidth, importImageHeight } = this.data;
    
    if (importImageWidth > 0 && importImageHeight > 0) {
      const outputSize = colorMatching.calculateOutputSize(importImageWidth, importImageHeight, baseSize);
      this.setData({
        importBaseSize: baseSize,
        importPreviewWidth: outputSize.width,
        importPreviewHeight: outputSize.height
      });
    } else {
      this.setData({ importBaseSize: baseSize });
    }
  },

  confirmImportImage() {
    const { importImageSrc, importBrand, importBaseSize } = this.data;
    
    if (!importImageSrc) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    this.setData({ isProcessing: true, processProgress: 0 });

    const query = wx.createSelectorQuery();
    query.select('#importCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          this.setData({ isProcessing: false });
          wx.showToast({ title: '画布初始化失败', icon: 'none' });
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        const img = canvas.createImage();
        img.onload = () => {
          const imgWidth = img.width;
          const imgHeight = img.height;
          
          canvas.width = imgWidth;
          canvas.height = imgHeight;
          ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

          this.setData({ processProgress: 30 });

          setTimeout(() => {
            try {
              const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);
              const pixels = imageData.data;

              this.setData({ processProgress: 50 });

              const palette = colorMatching.getBrandPalette(importBrand, colorData);
              
              if (palette.length === 0) {
                this.setData({ isProcessing: false });
                wx.showToast({ title: '未找到该品牌的颜色数据', icon: 'none' });
                return;
              }

              setTimeout(() => {
                try {
                  const result = colorMatching.processImageToBeads(
                    pixels,
                    imgWidth,
                    imgHeight,
                    palette,
                    importBaseSize
                  );

                  this.setData({ processProgress: 80 });

                  const newBeadColors = {};
                  const newBeadColorCodes = {};
                  
                  for (const bead of result.beads) {
                    const col = bead.x + 1;
                    const row = bead.y + 1;
                    const key = `${col},${row}`;
                    
                    if (bead.color) {
                      newBeadColors[key] = bead.color.hex;
                      newBeadColorCodes[key] = bead.color.code;
                    }
                  }

                  this.setData({
                    beadColors: newBeadColors,
                    beadColorCodes: newBeadColorCodes,
                    gridWidth: result.width,
                    gridHeight: result.height,
                    previewSize: this.calculatePreviewSize(result.width, result.height),
                    isProcessing: false,
                    processProgress: 100,
                    showImportImage: false
                  });

                  this.saveSettings();
                  this.drawGrid();
                  this.updateAxisLabels();
                  this.updateMiniMapBounds();
                  this.drawMiniMap();

                  wx.showToast({ title: `已导入 ${result.width}×${result.height}`, icon: 'success' });
                } catch (err) {
                  console.error('处理图片失败:', err);
                  this.setData({ isProcessing: false });
                  wx.showToast({ title: '处理图片失败', icon: 'none' });
                }
              }, 50);
            } catch (err) {
              console.error('获取像素数据失败:', err);
              this.setData({ isProcessing: false });
              wx.showToast({ title: '获取像素数据失败', icon: 'none' });
            }
          }, 50);
        };

        img.onerror = (err) => {
          console.error('图片加载失败:', err);
          this.setData({ isProcessing: false });
          wx.showToast({ title: '图片加载失败', icon: 'none' });
        };

        img.src = importImageSrc;
      });
  },

  // 发布功能相关方法
  openPublishModal() {
    console.log('openPublishModal called');
    
    if (!this.data.beadColors || Object.keys(this.data.beadColors).length === 0) {
      wx.showToast({ title: '画布是空的，先画点豆子吧～', icon: 'none' });
      return;
    }
    
    // 先显示弹窗，再生成预览图
    this.setData({
      showPublishModal: true,
      publishPreviewUrl: '',
      publishTitle: '',
      publishDescription: '',
      publishIsPublic: true
    });
    
    // 异步生成预览图
    this._generatePublishPreview().then(previewUrl => {
      console.log('预览图生成结果:', previewUrl);
      if (previewUrl) {
        this.setData({ publishPreviewUrl: previewUrl });
      }
    }).catch(err => {
      console.error('生成预览图失败:', err);
    });
  },
  
  closePublishModal() {
    this.setData({ showPublishModal: false });
  },
  
  onPublishTitleInput(e) {
    this.setData({ publishTitle: e.detail.value });
  },
  
  onPublishDescInput(e) {
    this.setData({ publishDescription: e.detail.value });
  },
  
  onPublishPublicChange(e) {
    this.setData({ publishIsPublic: e.detail.value });
  },
  
  _generatePublishPreview() {
    return new Promise((resolve, reject) => {
      const { gridWidth, gridHeight, beadColors } = this.data;
      
      console.log('_generatePublishPreview', { gridWidth, gridHeight, beadColorsLength: Object.keys(beadColors || {}).length });
      
      if (!beadColors || Object.keys(beadColors).length === 0) {
        console.log('beadColors为空');
        resolve('');
        return;
      }
      
      if (!gridWidth || !gridHeight || gridWidth <= 0 || gridHeight <= 0) {
        console.log('gridWidth或gridHeight无效');
        resolve('');
        return;
      }
      
      const previewSize = 300;
      const cellW = previewSize / gridWidth;
      const cellH = previewSize / gridHeight;
      
      // 使用旧版 canvas API
      const ctx = wx.createCanvasContext('publishPreviewCanvas', this);
      
      // 绘制白色背景
      ctx.setFillStyle('#FFFFFF');
      ctx.fillRect(0, 0, previewSize, previewSize);
      
      // 绘制色块
      let count = 0;
      for (let key in beadColors) {
        const [x, y] = key.split(',').map(Number);
        const color = beadColors[key];
        
        const px = (x - 1) * cellW;
        const py = (y - 1) * cellH;
        
        ctx.setFillStyle(color);
        ctx.fillRect(px, py, cellW, cellH);
        count++;
      }
      
      console.log('绘制了', count, '个色块');
      
      // 导出图片
      ctx.draw(false, () => {
        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvasId: 'publishPreviewCanvas',
            width: previewSize,
            height: previewSize,
            fileType: 'png',
            quality: 1,
            success: (r) => {
              console.log('生成预览图成功', r.tempFilePath);
              resolve(r.tempFilePath);
            },
            fail: (err) => {
              console.error('生成预览图失败', err);
              resolve('');
            }
          }, this);
        }, 100);
      });
    });
  },
  
  async onConfirmPublish() {
    if (this.data.isPublishing) return;
    
    if (!this.data.publishTitle.trim()) {
      wx.showToast({ title: '请输入作品标题', icon: 'none' });
      return;
    }
    
    if (!this.data.publishPreviewUrl) {
      wx.showToast({ title: '预览图生成中，请稍候', icon: 'none' });
      return;
    }
    
    this.setData({ isPublishing: true });
    wx.showLoading({ title: '发布中...' });
    
    try {
      // 检查云开发是否初始化
      if (!wx.cloud) {
        throw new Error('请先初始化云开发环境');
      }
      
      console.log('开始上传图片...');
      
      // 上传图片到云存储
      const cloudPath = `works/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: this.data.publishPreviewUrl
      });
      
      console.log('图片上传结果:', uploadResult);
      
      if (!uploadResult || !uploadResult.fileID) {
        throw new Error('图片上传失败');
      }
      
      console.log('开始保存到数据库...');
      
      // 使用云函数保存作品（保存到 templates 集合）
      const res = await wx.cloud.callFunction({
        name: 'template-api',
        data: {
          action: 'saveMyWork',
          title: this.data.publishTitle.trim(),
          description: this.data.publishDescription.trim(),
          imageUrl: uploadResult.fileID,
          isPublic: this.data.publishIsPublic,
          timestampMs: Date.now(),
          board: {
            gridWidth: this.data.gridWidth,
            gridHeight: this.data.gridHeight,
            beadColors: this.data.beadColors
          },
          spec: {
            cols: this.data.gridWidth,
            rows: this.data.gridHeight
          }
        }
      });
      
      console.log('云函数保存结果:', res);
      
      if (res.result && res.result.code === 0) {
        wx.hideLoading();
        wx.showToast({ title: '发布成功！', icon: 'success' });
        this.closePublishModal();
      } else {
        throw new Error(res.result?.msg || '保存失败');
      }
      
    } catch (err) {
      console.error('发布失败:', err);
      wx.hideLoading();
      
      let errorMsg = '发布失败，请重试';
      if (err.errMsg) {
        if (err.errMsg.includes('cloud init')) {
          errorMsg = '云开发未初始化';
        } else if (err.errMsg.includes('collection')) {
          errorMsg = '数据库集合不存在';
        } else if (err.errMsg.includes('permission')) {
          errorMsg = '没有权限';
        }
      }
      
      wx.showToast({ title: errorMsg, icon: 'none', duration: 2000 });
    } finally {
      this.setData({ isPublishing: false });
    }
  }
});
