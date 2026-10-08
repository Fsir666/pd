const presets = require('../../data/pattern-presets.js');

Page({
  data: {
    works: [],
    loading: true,
    userInfo: null,
    // 统计
    totalCount: 0,
    publicCount: 0,
    privateCount: 0,
    // 筛选：all / public / private
    filter: 'all'
  },

  onLoad() {
    const app = getApp();
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo });
    }
    this.fetchWorks();
  },

  onShow() {
    this.fetchWorks();
  },

  // 组内补充：内置图纸（seed_*）显示尺寸/色号，thumb 用本地图更清晰
  decorate(works) {
    return (works || []).map(w => {
      const id = String(w._id || '');
      const seedKey = id.indexOf('seed_') === 0 ? id.slice(5) : '';
      const p = seedKey ? presets.find(x => x.key === seedKey) : null;
      const author = w.author || '我';
      return Object.assign({}, w, {
        seedKey,
        thumb: p ? '/images/patterns/' + p.key + '.png' : (w.imageUrl || ''),
        sizeText: p ? (p.w + '×' + p.h + ' · ' + p.beadCount + ' 颗 · ' + p.palette.length + ' 色') : '',
        author,
        authorInitial: author.charAt(0),
        avatar: (w.userInfo && w.userInfo.avatarUrl) || (this.data.userInfo && this.data.userInfo.avatarUrl) || ''
      });
    });
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
        const all = this.decorate(res.result.data);
        this._all = all;
        const publicCount = all.filter(w => w.isPublic !== false).length;
        this.setData({
          works: this.applyFilter(all, this.data.filter),
          totalCount: all.length,
          publicCount,
          privateCount: all.length - publicCount,
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

  applyFilter(all, filter) {
    if (filter === 'public') return all.filter(w => w.isPublic !== false);
    if (filter === 'private') return all.filter(w => w.isPublic === false);
    return all;
  },

  switchFilter(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.filter) return;
    const all = this._all || [];
    this.setData({
      filter: key,
      works: this.applyFilter(all, key)
    });
    wx.vibrateShort({ type: 'light' });
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

    const applyPublic = val => {
      // 同时更新 _all（筛选源）和 works（当前列表），避免切筛选后状态丢失
      if (this._all) {
        const t = this._all.find(x => x._id === id);
        if (t) t.isPublic = val;
      }
      const works = this.data.works;
      if (works[index]) works[index].isPublic = val;
      const src = this._all || works;
      const publicCount = src.filter(w => w.isPublic !== false).length;
      this.setData({
        works,
        publicCount,
        privateCount: src.length - publicCount
      });
    };

    // 1. 乐观更新UI
    applyPublic(isPublic);

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
        applyPublic(!isPublic);
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
      applyPublic(!isPublic);
      wx.showToast({
        title: '网络错误: ' + (err.errMsg || err.message || '未知'),
        icon: 'none',
        duration: 3000
      });
    });
  }
});