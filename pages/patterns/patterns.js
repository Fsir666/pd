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
    wx.navigateTo({ url: '/pages/pattern-detail/pattern-detail?key=' + key });
  },

  onShareAppMessage() {
    return {
      title: '拼豆图纸库 · 21 张原创图纸免费拿',
      path: '/pages/patterns/patterns'
    };
  }
});
