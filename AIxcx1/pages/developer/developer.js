const app = getApp()

Page({
  data: {
    currentTab: -1,
    cursorLeft: '0%',
    isDragging: false
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.windowWidth = sysInfo.windowWidth;
    
    // TabBar Metrics
    this.tabBarWidth = this.windowWidth * 0.9;
    this.tabBarLeft = this.windowWidth * 0.05;
  },

  onShow() {
    if (typeof wx.hideTabBar === 'function') {
      wx.hideTabBar();
    }
    this.setData({ 
      currentTab: -1,
      cursorLeft: '0%'
    });
  },

  goToAddTemplate() {
    wx.navigateTo({
      url: '/pages/developer/add-template/add-template'
    });
  },

  handleTabStart(e) {
    this.setData({ isDragging: true });
  },

  handleTabDrag(e) {
    if (!this.windowWidth) return;
    
    const clientX = e.touches[0].clientX;
    let relativeX = clientX - this.tabBarLeft;
    let percent = (relativeX / this.tabBarWidth) * 100;
    
    let cursorLeft = percent - 12.5;
    
    if (cursorLeft < 0) cursorLeft = 0;
    if (cursorLeft > 75) cursorLeft = 75;
    
    this.setData({ 
      cursorLeft: cursorLeft + '%' 
    });
  },

  handleTabEnd(e) {
    let currentLeft = parseFloat(this.data.cursorLeft);
    let newTab = 0;
    
    if (currentLeft < 12.5) {
      newTab = 0;
    } else if (currentLeft < 37.5) {
      newTab = 1;
    } else if (currentLeft < 62.5) {
      newTab = 2;
    } else {
      newTab = 3;
    }
    
    wx.vibrateShort({ type: 'light' });
    
    this.setData({
      isDragging: false,
      currentTab: newTab,
      cursorLeft: (newTab * 25) + '%'
    });
    
    this.navigateToTab(newTab);
  },

  handleTabCancel() {
    const tab = typeof this.data.currentTab === 'number' && this.data.currentTab >= 0 ? this.data.currentTab : 0;
    this.setData({
      isDragging: false,
      cursorLeft: (tab * 25) + '%'
    });
  },

  navigateToTab(index) {
    const urls = [
      '/pages/index/index',
      '/pages/mall/mall',
      '/pages/square/square',
      '/pages/profile/profile'
    ];

    wx.switchTab({ url: urls[index] });
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.navigateToTab(index);
  }
});
