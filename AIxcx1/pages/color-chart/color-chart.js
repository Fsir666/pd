let colorMapping = null;

Page({
  data: {
    fullList: [],
    displayList: [],
    searchQuery: '',
    loading: true,
    totalCount: 0,
    resultCount: 0,
    hasSearched: false,
    appliedQuery: '',
    seriesList: [],
    seriesChips: [],
    selectedSeries: 'ALL',
    showBackTop: false,
    guideExpanded: false
  },

  onLoad() {
    this.processData();
  },

  processData() {
    wx.showLoading({ title: '加载色卡...' });

    try {
      if (!colorMapping) {
        colorMapping = require('../../data/color-mapping.js');
      }
    } catch (e) {
      console.error('色卡数据加载失败', e);
      wx.hideLoading();
      this.setData({
        fullList: [],
        displayList: [],
        loading: false
      });
      wx.showToast({ title: '色卡数据加载失败', icon: 'none' });
      return;
    }
    
    const KEY_CUSTOM_BRANDS = 'custom_brands_v1';
    const customBrands = wx.getStorageSync(KEY_CUSTOM_BRANDS) || [];
    const combinedMap = {};

    // 1. Load standard mapping
    Object.keys(colorMapping).forEach(hex => {
      const info = colorMapping[hex];
      combinedMap[hex] = {
        hex: hex,
        brands: [
          { name: 'MARD', code: info.MARD || '-' },
          { name: 'COCO', code: info.COCO || '-' },
          { name: '漫漫', code: info['漫漫'] || '-' },
          { name: '盼盼', code: info['盼盼'] || '-' },
          { name: '咪小窝', code: info['咪小窝'] || '-' }
        ],
        mard: info.MARD // Keep for series logic
      };
    });

    // 2. Merge custom brands
    customBrands.forEach(brand => {
      if (brand.subSeries) {
        brand.subSeries.forEach(series => {
          if (series.colors) {
            series.colors.forEach(c => {
              const hex = (c.hex || '').toUpperCase();
              if (!hex) return;
              
              if (!combinedMap[hex]) {
                combinedMap[hex] = {
                  hex: hex,
                  brands: [
                    { name: 'MARD', code: '-' },
                    { name: 'COCO', code: '-' },
                    { name: '漫漫', code: '-' },
                    { name: '盼盼', code: '-' },
                    { name: '咪小窝', code: '-' }
                  ],
                  mard: '-'
                };
              }
              
              combinedMap[hex].brands.push({
                name: brand.name,
                code: c.code
              });
            });
          }
        });
      }
    });

    const list = Object.values(combinedMap).map(item => {
      return {
        hex: item.hex,
        isDark: this.isColorDark(item.hex),
        brands: item.brands,
        mard: item.mard,
        // Pre-compute search string
        searchStr: (item.hex + ' ' + item.brands.map(b => b.code).join(' ')).toUpperCase()
      };
    });

    const seriesSet = new Set();
    list.forEach(item => {
      const series = this.getMardSeries(item.mard);
      if (series) seriesSet.add(series);
    });
    const seriesList = Array.from(seriesSet).sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      return a.localeCompare(b);
    });
    const seriesChips = seriesList.map(series => ({
      series,
      label: this.getSeriesLabel(series)
    }));

    this.setData({
      fullList: list,
      displayList: list,
      loading: false,
      totalCount: list.length,
      resultCount: list.length,
      hasSearched: false,
      appliedQuery: '',
      seriesList,
      seriesChips,
      selectedSeries: 'ALL',
      hasCustomBrands: customBrands.length > 0
    });
    
    wx.hideLoading();
  },

  getMardSeries(mard) {
    if (!mard || mard === '-') return '';
    const match = String(mard).toUpperCase().match(/^[A-Z]+/);
    return match ? match[0] : '';
  },

  getSeriesLabel(series) {
    const key = String(series || '').toUpperCase();
    if (!key) return '';
    const map = {
      H: 'H 系列色卡（H1为透明色）',
      M: 'M 系列色卡（低饱和莫兰迪）',
      P: 'P 系列色卡（珠光）',
      Q: 'Q 系列色卡（温变）',
      R: 'R 系列色卡（透明果冻水晶）',
      T: 'T 系列色卡（透明）',
      Y: 'Y 系列色卡（夜光）',
      ZG: 'ZG 系列色卡（光变）'
    };
    return map[key] || `${key} 系列色卡`;
  },

  isColorDark(hex) {
    if (!hex) return false;
    const rgb = hex.replace('#', '');
    const r = parseInt(rgb.substr(0, 2), 16);
    const g = parseInt(rgb.substr(2, 2), 16);
    const b = parseInt(rgb.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  },

  applyFilters() {
    const series = this.data.selectedSeries;
    const query = (this.data.appliedQuery || '').trim().toUpperCase();
    let filtered = this.data.fullList;
    if (series && series !== 'ALL') {
      filtered = filtered.filter(item => this.getMardSeries(item.mard) === series);
    }
    if (query) {
      filtered = filtered.filter(item => {
        return item.searchStr && item.searchStr.includes(query);
      });
    }
    this.setData({
      displayList: filtered,
      resultCount: filtered.length
    });
  },

  onSearchInput(e) {
    const query = e.detail.value.trim().toUpperCase();
    this.setData({ searchQuery: query });
  },

  onSearchTap() {
    wx.vibrateShort({ type: 'light' });
    const query = (this.data.searchQuery || '').trim().toUpperCase();
    if (!query) {
      this.setData({
        appliedQuery: '',
        hasSearched: false
      });
      this.applyFilters();
      return;
    }
    this.setData({
      appliedQuery: query,
      hasSearched: true
    });
    this.applyFilters();
  },

  onClearTap() {
    wx.vibrateShort({ type: 'light' });
    this.setData({
      searchQuery: '',
      appliedQuery: '',
      hasSearched: false
    });
    this.applyFilters();
  },

  onSeriesTap(e) {
    const series = e.currentTarget.dataset.series;
    wx.vibrateShort({ type: 'light' });
    this.setData({ selectedSeries: series || 'ALL' });
    this.applyFilters();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  onPageScroll(e) {
    const show = e.scrollTop > 500;
    if (show !== this.data.showBackTop) {
      this.setData({ showBackTop: show });
    }
  },

  onBackTop() {
    wx.vibrateShort({ type: 'light' });
    wx.pageScrollTo({ scrollTop: 0, duration: 260 });
  },

  onToggleGuide() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ guideExpanded: !this.data.guideExpanded });
  },

  onCopy(e) {
    const text = e.currentTarget.dataset.text;
    if (!text || text === '-') return;
    
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
          duration: 1000
        });
      }
    });
  }
});
