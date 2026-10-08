Page({
  data: {
    allTools: [
      { id: 2, title: '抠图', desc: '图片去底', icon: '✂️', color: '#54A0FF', bg: '#E3F2FD', animClass: 'wiggle' },
      { id: 10, title: '拼豆计算器', desc: '成本估算', icon: '🧮', color: '#00C853', bg: '#E8F5E9', animClass: 'bounce' },
      { id: 4, title: '色卡对照表', desc: '色卡对照', icon: '🎨', color: '#FF6B6B', bg: '#FFEBEE', animClass: 'spin-slow' },
      { id: 11, title: '色卡表', desc: 'Excel下载', icon: '📊', color: '#20BF6B', bg: '#E8F5E9', animClass: 'pulse' },
      { id: 3, title: '我的仓库', desc: '管理色卡', icon: '🏰', color: '#AF52DE', bg: '#F3E5F5', animClass: 'breathe' },
      { id: 7, title: '收藏图纸', desc: '我的收藏', icon: '⭐', color: '#FF9F43', bg: '#FFF3E0', animClass: 'pulse' },
      { id: 5, title: '我的作品', desc: '查看创作', icon: '🧩', color: '#5F27CD', bg: '#EDE7F6', animClass: 'bounce' },
      { id: 6, title: '新手教程', desc: '入门指南', icon: '📚', color: '#48DBFB', bg: '#E1F5FE', animClass: 'float' },
      { id: 8, title: '我的订单', desc: '订单历史', icon: '🧾', color: '#54A0FF', bg: '#E3F2FD', animClass: 'wiggle' }
    ],
    isLogged: false
  },

  onLoad() {
    const app = getApp();
    if (app.globalData.isLogged) {
      this.setData({ isLogged: true });
    }
  },

  onShow() {
    const app = getApp();
    if (app.globalData.isLogged !== this.data.isLogged) {
      this.setData({ isLogged: app.globalData.isLogged });
    }
  },

  onToolTap(e) {
    const id = parseInt(e.currentTarget.dataset.id);
    
    // 检查登录状态
    const protectedIds = [1, 2, 3, 4, 5, 7];
    if (protectedIds.includes(id) && !this.data.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用该功能',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }

    wx.vibrateShort({ type: 'light' });
    
    switch (id) {
      case 1: // 生成像素图
        wx.navigateTo({ url: '/pages/generate/generate' });
        break;
      case 2: // 抠图
        wx.navigateTo({ url: '/pages/matting/matting' });
        break;
      case 9: // 转卡通
        wx.navigateTo({ url: '/pages/cartoon/cartoon' });
        break;
      case 10: // 拼豆计算器
        wx.showToast({ title: '计算器即将上线', icon: 'none' });
        break;
      case 11: // Excel 色卡表
        wx.navigateTo({ url: '/pages/color-list/color-list' });
        break;
      case 3: // 我的仓库
        // 直达「豆库管理」：原先的 warehouse 页只是简易色号勾选，
        // 与豆库管理各存一套本地数据、互不互通，容易让人以为库存录了没生效。
        wx.navigateTo({ url: '/pages/warehouse/manage/manage' });
        break;
      case 4: // 色卡表
        wx.navigateTo({ url: '/pages/color-chart/color-chart' });
        break;
      case 5: // 我的作品
        wx.navigateTo({ url: '/pages/my-works/my-works' });
        break;
      case 6: // 新手教程
        wx.navigateTo({ url: '/pages/beginner-guide/beginner-guide' });
        break;
      case 7: // 收藏图纸
        wx.navigateTo({ url: '/pages/my-collections/my-collections' });
        break;
      case 8: // 我的订单
        wx.navigateTo({ url: '/pages/my-orders/my-orders' });
        break;
      default:
        wx.showToast({ title: '功能开发中...', icon: 'none' });
    }
  }
});
