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
    // 本页已并入「豆库管理」（pages/warehouse/manage/manage）。
    // 原先这里只是简易色号勾选，与豆库管理各存一套本地数据、互不互通，
    // 用户会以为库存录了没生效。所有入口已改指向豆库管理，
    // 这里再做一次兜底重定向，避免任何遗漏入口把用户带进这套废弃数据。
    wx.redirectTo({
      url: '/pages/warehouse/manage/manage',
      fail: () => {
        // 重定向失败（极低概率）时退回原逻辑，保证页面还能用
        this.loadColors();
      }
    });
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
