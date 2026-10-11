const presets = require('../../data/pattern-presets.js');

Page({
  data: {
    list: []
  },

  onLoad() {
    this.loadFromCloud();
  },

  // 图纸库改为云端拉取（owner_drafts 灌库后由 seedGallery 发布为 seed_<key>）
  loadFromCloud() {
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'listGallery' }
    }).then(res => {
      const r = (res && res.result) || {};
      console.log('[patterns] listGallery', JSON.stringify(r).slice(0, 200));
      const cloudList = Array.isArray(r.data) ? r.data : [];
      if (r.code !== 0 && r.code !== undefined) {
        wx.showToast({ title: '图纸库加载失败 ' + (r.code || ''), icon: 'none' });
      }
      if (cloudList.length) {
        this.setData({
          list: cloudList.map(p => ({
            key: p.key,
            name: p.name,
            w: p.w,
            h: p.h,
            beadCount: p.beadCount,
            thumb: p.imageUrl || '/images/patterns/' + p.key + '.png'
          }))
        });
        return;
      }
      // 云端为空时回退本地内置图纸
      this.loadFromPresets();
    }).catch(err => {
      console.error('[patterns] listGallery fail', err);
      wx.showToast({ title: '云端图纸库不可用', icon: 'none' });
      this.loadFromPresets();
    });
  },

  loadFromPresets() {
    const list = presets.map(p => ({
      key: p.key,
      name: p.name,
      w: p.w,
      h: p.h,
      beadCount: p.beadCount,
      thumb: '/images/patterns/' + p.key + '.png'
    }));
    this.setData({ list });
  },

  openDetail(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    wx.vibrateShort({ type: 'light' });
    // 统一作品页：内置图纸在云端以 _id = seed_<key> 存在
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent('seed_' + key) });
  },

  onShareAppMessage() {
    return {
      title: '拼豆图纸库 · 原创图纸免费拿',
      path: '/pages/patterns/patterns'
    };
  }
});
