Page({
  data: {
    currentTab: 2,
    cursorLeft: '50%',
    isDragging: false,
    posterSrc: '/广场宣传图.jpg',
    comingSoonVisible: false
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.windowWidth = sysInfo.windowWidth;
    this.tabBarWidth = this.windowWidth * 0.9;
    this.tabBarLeft = this.windowWidth * 0.05;
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      tabBar.setData({
        isDragging: true,
        selected: 2,
        cursorLeft: '50%',
        cursorWidth: '120rpx',
        hoverIndex: -1
      });
      wx.nextTick(() => {
        const tb = this.getTabBar && this.getTabBar();
        tb && tb.setData({ isDragging: false });
      });
    }
  },

  onCtaTap() {
    this.showComingSoon();
  },

  showComingSoon() {
    if (this.comingSoonTimer) clearTimeout(this.comingSoonTimer);
    this.setData({ comingSoonVisible: true });
    this.comingSoonTimer = setTimeout(() => {
      this.setData({ comingSoonVisible: false });
    }, 2300);
  },

  hideComingSoon() {
    if (this.comingSoonTimer) clearTimeout(this.comingSoonTimer);
    this.setData({ comingSoonVisible: false });
  },

  // Removed custom implementation, now using custom-tab-bar component

  navigateToTab(index) {
    const urls = [
      '/pages/index/index',
      '/pages/mall/mall',
      '/pages/square/square',
      '/pages/profile/profile'
    ];

    if (index === 2) return;
    wx.switchTab({ url: urls[index] });
  }
});
