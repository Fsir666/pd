const colorData = require('../../../data/color-data.js');

Page({
  data: {
    brandId: '',
    brandName: '',
    currentSeriesId: '', // 当前选中的小色卡表ID (如 mard-24)
    subSeriesList: [], // 小色卡表列表
    groupedColors: [] // 按系列分组后的颜色数据
  },

  onLoad(options) {
    // Load custom brands
    const customBrands = wx.getStorageSync('custom_brands_v1') || [];
    customBrands.forEach(cb => {
      if (!colorData[cb.id]) {
        colorData[cb.id] = cb;
      } else {
        Object.assign(colorData[cb.id], cb);
      }
    });

    const { id, name } = options;
    this.setData({
      brandId: id,
      brandName: name
    });
    
    wx.setNavigationBarTitle({
      title: name ? `${name} 色卡库` : '色卡库'
    });

    this.loadBrandData(id);
  },

  onShow() {
    // 每次显示页面时更新库存数据
    if (this.data.groupedColors.length > 0) {
      this.updateInventory();
    }
  },

  _mergeInventory(groupedColors) {
    const inv = wx.getStorageSync('warehouse_inventory_v1') || {};
    const brandInv = inv[this.data.brandName] || {};
    
    return groupedColors.map(group => {
      const newList = group.list.map(color => ({
        ...color,
        count: brandInv[color.code] || 0
      }));
      return { ...group, list: newList };
    });
  },

  updateInventory() {
    if (this.data.groupedColors.length > 0) {
      const grouped = this._mergeInventory(this.data.groupedColors);
      this.setData({ groupedColors: grouped });
    }
  },

  loadBrandData(brandId) {
    const brandData = colorData[brandId];
    
    if (brandData && brandData.subSeries && brandData.subSeries.length > 0) {
      // 默认选中第一个子系列
      const firstSeries = brandData.subSeries[0];
      
      this.setData({
        subSeriesList: brandData.subSeries,
        currentSeriesId: firstSeries.id
      });
      
      // 加载第一个系列的颜色
      this.loadColors(firstSeries.id);
    } else {
      // 如果没有数据，清空
      this.setData({
        subSeriesList: [],
        currentSeriesId: '',
        groupedColors: []
      });
      wx.showToast({
        title: '暂无该品牌数据',
        icon: 'none'
      });
    }
  },

  loadColors(seriesId) {
    // 从当前品牌的子系列中找到选中的系列
    const brandData = colorData[this.data.brandId];
    if (!brandData) return;
    
    const series = brandData.subSeries.find(s => s.id === seriesId);
    
    if (series && series.colors) {
      // 分组处理
      let grouped = this.groupColorsBySeries(series.colors);
      // 合并库存数据
      grouped = this._mergeInventory(grouped);
      
      this.setData({
        groupedColors: grouped
      });
    }
  },

  // 切换小色卡表 (如 Mard-24 -> Mard-48)
  onSwitchSeries(e) {
    const seriesId = e.currentTarget.dataset.id;
    if (seriesId === this.data.currentSeriesId) return;

    this.setData({ currentSeriesId: seriesId });
    this.loadColors(seriesId);
  },

  // 按系列分组 (A系, B系...)
  groupColorsBySeries(colors) {
    const groups = {};
    // 先分组
    colors.forEach(color => {
      const seriesName = color.series || '其它'; // 比如 "A系"
      if (!groups[seriesName]) {
        groups[seriesName] = [];
      }
      groups[seriesName].push(color);
    });

    // 转为数组并排序
    return Object.keys(groups).sort().map(key => ({
      name: key,
      list: groups[key],
      expanded: false // 默认折叠
    }));
  },

  // 切换分组展开/折叠
  toggleGroup(e) {
    const index = e.currentTarget.dataset.index;
    const key = `groupedColors[${index}].expanded`;
    this.setData({
      [key]: !this.data.groupedColors[index].expanded
    });
  }
});