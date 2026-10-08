const app = getApp();

Page({
  data: {
    type: 'following',
    list: [],
    loading: false,
    hasMore: true,
    skip: 0,
    limit: 20
  },

  onLoad(options) {
    const type = options && (options.type === 'followers' || options.type === 'following') ? options.type : 'following';
    this.setData({ type });
    wx.setNavigationBarTitle({ title: type === 'following' ? '关注' : '粉丝' });
    this.loadList(true);
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.loading || !this.data.hasMore) return;
    this.loadList(false);
  },

  onSwitchType(e) {
    const type = e && e.currentTarget ? e.currentTarget.dataset.type : '';
    if (type !== 'following' && type !== 'followers') return;
    if (type === this.data.type) return;
    wx.vibrateShort({ type: 'light' });
    this.setData({ type });
    wx.setNavigationBarTitle({ title: type === 'following' ? '关注' : '粉丝' });
    this.loadList(true);
  },

  loadList(reset) {
    if (!app.globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后查看',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' });
        }
      });
      return Promise.resolve();
    }

    const nextSkip = reset ? 0 : this.data.skip;
    if (reset) {
      this.setData({ list: [], skip: 0, hasMore: true });
    }
    this.setData({ loading: true });

    return wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'getFollowList',
        type: this.data.type,
        skip: nextSkip,
        limit: this.data.limit
      }
    }).then((res) => {
      const r = res && res.result;
      if (!r || r.code !== 0) throw new Error((r && r.msg) || 'load failed');
      const d = r.data || {};
      const rows = Array.isArray(d.list) ? d.list : [];
      const next = reset ? rows : this.data.list.concat(rows);
      this.setData({
        list: next,
        skip: nextSkip + rows.length,
        hasMore: !!d.hasMore
      });
    }).catch((e) => {
      const msg = e && (e.errMsg || e.message) ? String(e.errMsg || e.message) : '';
      const isMissingCol = msg.includes('DATABASE_COLLECTION_NOT_EXIST') || msg.includes('db or table not exist') || msg.includes('user_follows');
      if (isMissingCol) {
        wx.showModal({
          title: '列表不可用',
          content: '你的云数据库缺少 user_follows 集合。\n\n请在云开发控制台 -> 数据库 -> 集合管理 中创建集合：user_follows\n创建后再试即可。',
          showCancel: false
        });
        return;
      }
      wx.showToast({ title: msg || '加载失败', icon: 'none' });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  goToUserProfile(e) {
    const openid = e && e.currentTarget ? e.currentTarget.dataset.openid : '';
    if (!openid) return;
    wx.navigateTo({
      url: `/packageMisc/pages/user-profile/user-profile?openid=${encodeURIComponent(openid)}`
    });
  }
});

