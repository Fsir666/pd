const presets = require('../../data/pattern-presets.js');

Page({
  data: {
    collections: [],
    loading: true,
    totalCount: 0,
    // 收藏页按「颗粒总数」给个统计，纯粹让用户有收藏量的感知
    totalBeads: 0
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
          beadCount: p.beadCount,
          colorCount: p.palette.length,
          sizeText: p.w + '×' + p.h,
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
      (cloudCards || []).forEach(c => {
        const id = String(c._id || '');
        const seedKey = id.indexOf('seed_') === 0 ? id.slice(5) : '';
        const p = seedKey ? presets.find(x => x.key === seedKey) : null;
        map[id] = Object.assign({}, c, {
          key: seedKey,
          thumb: p ? '/images/patterns/' + p.key + '.png' : c.imageUrl,
          beadCount: p ? p.beadCount : (c.spec && c.spec.beadCount) || 0,
          colorCount: p ? p.palette.length : 0,
          sizeText: p ? (p.w + '×' + p.h) : (c.spec ? (c.spec.cols + '×' + c.spec.rows) : ''),
          author: c.author || '冯'
        });
      });
      localCards.forEach(c => { map[c._id] = c; });
      const list = Object.keys(map).map(k => map[k]);

      const totalBeads = list.reduce((s, c) => s + (Number(c.beadCount) || 0), 0);

      this.setData({
        collections: list,
        totalCount: list.length,
        totalBeads,
        loading: false
      });
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
  },

  preventBubble() {
    // 阻止冒泡，避免点到分享按钮触发卡片跳转
  },

  // 分享卡片：带成品图 + 小程序入口 + 邀请码
  onShareAppMessage(e) {
    const ds = (e && e.target && e.target.dataset) || {};
    const id = ds.id || '';
    const key = ds.key || '';
    const title = ds.title || '拼豆图纸';
    const img = ds.img || '';

    const app = getApp();
    const inv = app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.inviteCode ? String(app.globalData.userInfo.inviteCode) : '';
    const invPart = inv ? `&inv=${encodeURIComponent(inv)}` : '';

    let path;
    if (key) {
      path = `/pages/pattern-detail/pattern-detail?key=${encodeURIComponent(key)}${invPart}`;
    } else if (id && String(id).indexOf('seed_') === 0) {
      path = `/pages/pattern-detail/pattern-detail?key=${encodeURIComponent(String(id).slice(5))}${invPart}`;
    } else if (id) {
      path = `/pages/detail/detail?id=${encodeURIComponent(id)}${invPart}`;
    } else {
      path = '/pages/index/index';
    }
    const out = { title, path };
    if (img) out.imageUrl = img;
    return out;
  }
});
