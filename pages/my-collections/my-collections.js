const presets = require('../../data/pattern-presets.js');

Page({
  data: {
    collections: [],
    loading: true
  },

  onLoad() {
    this.fetchCollections();
  },

  onShow() {
    // 每次显示页面时刷新，以防用户在详情页取消收藏后返回
    this.fetchCollections();
  },

  // 本地内置图纸收藏 -> 卡片结构
  localFavCards() {
    const favs = wx.getStorageSync('pattern_favs') || [];
    return favs
      .map(key => {
        const p = presets.find(x => x.key === key);
        if (!p) return null;
        return {
          _id: 'seed_' + p.key,
          key: p.key,
          title: p.name,
          imageUrl: '/images/patterns/' + p.key + '.png',
          author: '冯',
          heat: 0,
          fromLocal: true
        };
      })
      .filter(Boolean);
  },

  fetchCollections() {
    this.setData({ loading: true });

    const localCards = this.localFavCards();

    const finish = cloudCards => {
      // 云端 seed_* 与本地合并，按 _id 去重（本地优先，缩略图更清晰）
      const map = {};
      (cloudCards || []).forEach(c => { map[c._id] = c; });
      localCards.forEach(c => { map[c._id] = c; });
      const list = Object.keys(map).map(k => map[k]);

      this.setData({ collections: list, loading: false });
    };

    if (!wx.cloud) {
      finish([]);
      return;
    }

    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'getMyCollections' }
    }).then(res => {
      if (res && res.result && res.result.code === 0) {
        finish(res.result.data);
      } else {
        // 云端失败也要把本地收藏显示出来
        console.warn('getMyCollections failed:', res && res.result);
        finish([]);
      }
    }).catch(err => {
      console.error(err);
      finish([]);
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    const key = e.currentTarget.dataset.key;
    const title = e.currentTarget.dataset.title;
    const img = e.currentTarget.dataset.img;

    // 内置图纸 -> 干净的图纸详情页（西瓜风格）
    if (key) {
      wx.navigateTo({
        url: `/pages/pattern-detail/pattern-detail?key=${encodeURIComponent(key)}`
      });
      return;
    }

    // 社区作品 seed_* 也走图纸页
    if (String(id || '').indexOf('seed_') === 0) {
      wx.navigateTo({
        url: `/pages/pattern-detail/pattern-detail?key=${encodeURIComponent(String(id).slice(5))}`
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}&title=${encodeURIComponent(title || '')}&img=${encodeURIComponent(img || '')}`
    });
  },

  goToHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
