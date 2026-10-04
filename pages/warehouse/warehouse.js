const app = getApp();
const colorMap = require('../../data/color-mapping.js');

Page({
  data: {
    colors: [],
    ownedCount: 0,
    totalCount: 0,
    searchQuery: ''
  },

  onLoad() {
    this.loadColors();
  },

  loadColors() {
    const owned = wx.getStorageSync('owned_colors') || [];
    const colors = Object.entries(colorMap).map(([hex, brands]) => {
      return {
        hex,
        mard: brands['MARD'] || '',
        coco: brands['COCO'] || '',
        isOwned: owned.includes(brands['MARD']) // Use MARD as ID for now
      };
    });

    this.setData({
      colors,
      totalCount: colors.length,
      ownedCount: owned.length
    });
  },

  toggleOwned(e) {
    const index = e.currentTarget.dataset.index;
    const colors = this.data.colors;
    const item = colors[index];
    
    // Toggle state
    item.isOwned = !item.isOwned;
    
    // Update storage
    let owned = wx.getStorageSync('owned_colors') || [];
    if (item.isOwned) {
      if (!owned.includes(item.mard)) owned.push(item.mard);
    } else {
      owned = owned.filter(id => id !== item.mard);
    }
    wx.setStorageSync('owned_colors', owned);

    // Update UI
    this.setData({
      [`colors[${index}].isOwned`]: item.isOwned,
      ownedCount: owned.length
    });
    
    wx.vibrateShort({ type: 'light' });
  },

  onSearch(e) {
    this.setData({ searchQuery: e.detail.value });
  },

  onEnterWarehouse() {
    wx.navigateTo({ url: '/pages/warehouse/manage/manage' });
  }
});
