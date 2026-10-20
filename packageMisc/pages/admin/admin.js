const app = getApp();

Page({
  data: {
    checking: true,
    isAdmin: false,
    blocked: false,
    needLogin: false,
    loadError: ''
  },

  onLoad() {
    this.checkAdmin();
  },

  onShow() {
    // 从图纸库管理返回时保持状态，不重复拉；
    // 但若上一次校验被拦，返回时重新校验一次
    if (this.data.blocked) {
      this.checkAdmin();
    }
  },

  // 校验管理员身份：非管理员只显示无权限提示
  checkAdmin() {
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'checkAdmin' }
    }).then(res => {
      const r = (res && res.result) || {};
      const d = r.data || {};
      const isAdmin = !!d.isAdmin;
      this.setData({
        isAdmin,
        checking: false,
        blocked: !isAdmin,
        needLogin: !!d.needLogin,
        loadError: isAdmin ? '' : (d.needLogin ? '请先登录后再访问' : '当前账号没有管理员权限')
      });
    }).catch(err => {
      console.error('[admin] checkAdmin fail', err);
      this.setData({
        isAdmin: false,
        checking: false,
        blocked: true,
        loadError: '网络错误，请重试'
      });
    });
  },

  // 进入图纸库管理（进前再校验一次，避免直接改 URL 绕过）
  goToDrafts() {
    wx.vibrateShort({ type: 'light' });
    if (!this.data.isAdmin) {
      wx.showToast({ title: '没有管理员权限', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/packageMisc/pages/admin-drafts/admin-drafts'
    });
  },

  goToPayTest() {
    if (!this.data.isAdmin) return;
    wx.navigateTo({ url: '/packageMisc/pages/admin-pay/admin-pay' });
  },

  goBack() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    return { title: '悠米拼豆 · 原创拼豆图纸', path: '/pages/index/index' };
  }
});
