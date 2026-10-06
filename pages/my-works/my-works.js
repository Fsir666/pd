Page({
  data: {
    works: [],
    loading: true,
    userInfo: null
  },

  onLoad(options) {
    const app = getApp();
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo });
    }
    this.fetchWorks();
  },

  onShow() {
    this.fetchWorks();
  },

  fetchWorks() {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'getMyWorks'
      }
    }).then(res => {
      if (res.result.code === 0) {
        this.setData({
          works: res.result.data,
          loading: false
        });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
    }).catch(err => {
      console.error(err);
      wx.showToast({ title: '网络错误', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title;
    const img = e.currentTarget.dataset.img;

    // 内置图纸（seed_<key>）跳「图纸详情页」，跟发现页图纸卡保持一致：
    // 图纸页有网格图 + 色号矩阵 + 复制用料清单，比社区作品页更清晰。
    const seedKey = String(id || '').indexOf('seed_') === 0
      ? String(id).slice(5)
      : '';
    if (seedKey) {
      wx.navigateTo({
        url: `/pages/pattern-detail/pattern-detail?key=${encodeURIComponent(seedKey)}`
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}&title=${encodeURIComponent(title)}&img=${encodeURIComponent(img)}`
    });
  },

  goToCreate() {
    // Navigate to Game (Creation) Page
    wx.navigateTo({
      url: '/pages/game/game'
    });
  },

  preventBubble() {
    // 阻止冒泡
  },

  onPublicToggle(e) {
    const { id, index } = e.currentTarget.dataset;
    const isPublic = e.detail.value;
    
    // 1. 乐观更新UI
    const works = this.data.works;
    if (works[index]) {
        works[index].isPublic = isPublic;
        this.setData({ works });
    }
    
    // 2. 调用云函数
    wx.showLoading({ title: '处理中...', mask: true });
    
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'togglePublic',
        templateId: id,
        isPublic: isPublic
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.code === 0) {
        wx.showToast({
          title: isPublic ? '已公开' : '已私密',
          icon: 'success'
        });
      } else {
        // 失败回滚
        console.error('Toggle public failed:', res);
        const currentWorks = this.data.works;
        if (currentWorks[index]) {
            currentWorks[index].isPublic = !isPublic;
            this.setData({ works: currentWorks });
        }
        wx.showToast({
          title: '失败: ' + (res.result.msg || '未知错误'),
          icon: 'none',
          duration: 3000
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Toggle public network error:', err);
      // 失败回滚
      const currentWorks = this.data.works;
      if (currentWorks[index]) {
          currentWorks[index].isPublic = !isPublic;
          this.setData({ works: currentWorks });
      }
      wx.showToast({
        title: '网络错误: ' + (err.errMsg || err.message || '未知'),
        icon: 'none',
        duration: 3000
      });
    });
  }
});