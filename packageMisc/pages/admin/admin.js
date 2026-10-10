const app = getApp();

Page({
  data: {
    checking: true,
    isAdmin: false,
    loadError: ''
  },

  onLoad() {
    this.checkAdmin();
  },

  onShow() {
    // 从图纸库管理返回时保持状态，不重复拉
  },

  // 校验管理员身份：非管理员只显示无权限提示
  checkAdmin() {
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'checkAdmin' }
    }).then(res => {
      const r = (res && res.result) || {};
      const isAdmin = !!(r.data && r.data.isAdmin);
      this.setData({
        isAdmin,
        checking: false,
        loadError: isAdmin ? '' : '当前账号没有管理员权限'
      });
    }).catch(err => {
      console.error('[admin] checkAdmin fail', err);
      this.setData({
        isAdmin: false,
        checking: false,
        loadError: '网络错误，请重试'
      });
    });
  },

  // 进入图纸库管理
  goToDrafts() {
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({
      url: '/packageMisc/pages/admin-drafts/admin-drafts'
    });
  },

  goBack() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    return { title: '悠米拼豆 · 原创拼豆图纸', path: '/pages/index/index' };
  }
});
