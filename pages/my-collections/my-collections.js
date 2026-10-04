Page({
  data: {
    collections: [],
    loading: true
  },

  onLoad(options) {
    this.fetchCollections();
  },

  onShow() {
    // 每次显示页面时刷新，以防用户在详情页取消收藏后返回
    this.fetchCollections();
  },

  fetchCollections() {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'getMyCollections'
      }
    }).then(res => {
      if (res.result.code === 0) {
        this.setData({
          collections: res.result.data,
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
    
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}&title=${encodeURIComponent(title)}&img=${encodeURIComponent(img)}`
    });
  },

  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});