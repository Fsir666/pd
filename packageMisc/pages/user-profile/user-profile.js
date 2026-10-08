const app = getApp();

Page({
  data: {
    loading: true,
    profile: null,
    works: [],
    openid: '',
    isSelf: false,
    followLoading: false
  },

  onLoad(options) {
    const openid = options && options.openid ? decodeURIComponent(options.openid) : '';
    this.setData({ openid }, () => this.loadProfile());
  },

  async loadProfile() {
    const openid = this.data.openid;
    if (!openid) {
      this.setData({ loading: false, profile: null, works: [] });
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'template-api',
        data: { action: 'getUserProfile', openid }
      });
      const r = res && res.result;
      if (!r || r.code !== 0) throw new Error((r && r.msg) || 'load failed');

      const profile = r.data || null;
      const works = (profile && profile.works) ? profile.works : [];

      const fixed = await this.exchangeProfileUrls(profile, works);
      this.setData({
        profile: fixed.profile,
        works: fixed.works,
        isSelf: !!(fixed.profile && fixed.profile.isSelf),
        loading: false
      });
    } catch (e) {
      console.error('Load profile failed', e);
      this.setData({ loading: false, profile: null, works: [] });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async exchangeProfileUrls(profile, works) {
    const all = [];
    if (profile && profile.user && profile.user.avatarUrl && profile.user.avatarUrl.startsWith('cloud://')) {
      all.push(profile.user.avatarUrl);
    }
    (works || []).forEach((w) => {
      if (w && w.imageUrl && typeof w.imageUrl === 'string' && w.imageUrl.startsWith('cloud://')) all.push(w.imageUrl);
    });

    if (all.length === 0) return { profile, works };

    let urlMap = {};
    try {
      const res = await wx.cloud.getTempFileURL({ fileList: all });
      res.fileList.forEach((f) => {
        if (f.status === 0) urlMap[f.fileID] = f.tempFileURL;
      });
    } catch (e) {}

    const nextProfile = profile ? { ...profile } : null;
    if (nextProfile && nextProfile.user && nextProfile.user.avatarUrl && urlMap[nextProfile.user.avatarUrl]) {
      nextProfile.user = { ...nextProfile.user, avatarUrl: urlMap[nextProfile.user.avatarUrl] };
    }

    const nextWorks = (works || []).map((w) => {
      if (!w) return w;
      if (w.imageUrl && urlMap[w.imageUrl]) return { ...w, imageUrl: urlMap[w.imageUrl] };
      return w;
    });

    return { profile: nextProfile, works: nextWorks };
  },

  onToggleFollow() {
    if (!app.globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再关注',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' });
        }
      });
      return;
    }

    if (this.data.followLoading) return;

    const toOpenid = this.data.openid;
    if (!toOpenid) return;

    this.setData({ followLoading: true });

    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'toggleFollow', toOpenid }
    }).then((res) => {
      const r = res && res.result;
      if (!r || r.code !== 0) throw new Error((r && r.msg) || 'toggle failed');
      const next = { ...(this.data.profile || {}) };
      if (next) {
        next.isFollowing = !!(r.data && r.data.isFollowing);
        if (r.data && typeof r.data.followerCount === 'number') next.followerCount = r.data.followerCount;
      }
      this.setData({ profile: next });
    }).catch((e) => {
      console.error('Toggle follow failed', e);
      const msg = e && (e.errMsg || e.message) ? String(e.errMsg || e.message) : '';
      const isMissingCol = msg.includes('DATABASE_COLLECTION_NOT_EXIST') || msg.includes('db or table not exist') || msg.includes('user_follows');
      if (isMissingCol) {
        wx.showModal({
          title: '关注不可用',
          content: '你的云数据库缺少 user_follows 集合，所以无法关注。\n\n请在云开发控制台 -> 数据库 -> 集合管理 中创建集合：user_follows\n创建后再试即可。',
          showCancel: false
        });
        return;
      }
      wx.showToast({ title: msg || '操作失败', icon: 'none' });
    }).finally(() => {
      this.setData({ followLoading: false });
    });
  },

  goToWork(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(id)}` });
  },

  onPullDownRefresh() {
    this.loadProfile().finally(() => wx.stopPullDownRefresh());
  }
});
