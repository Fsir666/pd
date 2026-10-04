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
    
    const list = Object.keys(colorMapping).map(hex => {
      const info = colorMapping[hex];
      return {
        hex: hex,
        isDark: this.isColorDark(hex),
        mard: info.MARD || '-',
        coco: info.COCO || '-',
        manman: info['漫漫'] || '-',
        panpan: info['盼盼'] || '-',
        miwo: info['咪小窝'] || '-'
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
      selectedSeries: 'ALL'
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
        if (item.hex.toUpperCase().includes(query)) return true;
        if (item.mard.toUpperCase().includes(query)) return true;
        if (item.coco.toUpperCase().includes(query)) return true;
        if (item.manman.toUpperCase().includes(query)) return true;
        if (item.panpan.toUpperCase().includes(query)) return true;
        if (item.miwo.toUpperCase().includes(query)) return true;
        return false;
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
