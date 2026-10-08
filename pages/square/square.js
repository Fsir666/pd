Page({
  data: {
    comingSoonVisible: false
  },

  onLoad() {},

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected(2);
    }
  },

  // 跳转到拼豆模式
  goToBeadMode() {
    // 历史 bug：这里跳的是首页（switchTab index），但入口文案明明是
    // 「🎨 拼豆模式 / 自由创作拼豆作品」和「开始创作」，点完却回到首页，答非所问。
    // bead-mode 不传 beadSession 时即为空白画板，本地创作无需登录，可直接进。
    wx.navigateTo({
      url: '/packageGame/pages/bead-mode/bead-mode',
      fail: () => {
        wx.showToast({ title: '打开失败，请重试', icon: 'none' });
      }
    });
  },

  // 跳转到图纸库
  goToMall() {
    wx.switchTab({ url: '/pages/mall/mall' });
  },

  // 跳转到我的
  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  // 跳转到抠图功能
  goToCutout() {
    wx.navigateTo({ url: '/packageTool/pages/matting/matting' });
  },

  // 跳转到色卡对照表
  goToColorChart() {
    wx.navigateTo({ url: '/packageTool/pages/color-chart/color-chart' });
  },

  // 跳转到新手教程
  goToTutorial() {
    wx.navigateTo({ url: '/packageMisc/pages/beginner-guide/beginner-guide' });
  },

  // 显示即将上线弹窗
  showComingSoon() {
    if (this.comingSoonTimer) clearTimeout(this.comingSoonTimer);
    this.setData({ comingSoonVisible: true });
    this.comingSoonTimer = setTimeout(() => {
      this.setData({ comingSoonVisible: false });
    }, 3000);
  },

  // 隐藏即将上线弹窗
  hideComingSoon() {
    if (this.comingSoonTimer) clearTimeout(this.comingSoonTimer);
    this.setData({ comingSoonVisible: false });
  },

  onShareAppMessage() {
    return {
      title: '拼豆广场 - 公告与教程',
      path: '/pages/square/square',
      imageUrl: '/images/share-cover.png'
    };
  },

  onShareTimeline() {
    return {
      title: '拼豆广场 - 公告与教程',
      query: '',
      imageUrl: '/images/share-cover.png'
    };
  }
});
