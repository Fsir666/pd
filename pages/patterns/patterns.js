const presets = require('../../data/pattern-presets.js');

Page({
  data: {
    list: []
  },

  onLoad() {
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
