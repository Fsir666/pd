const app = getApp();

const HISTORY_KEY = 'community_search_history';

Page({
  data: {
    query: '',
    focus: true,
    loading: false,
    tab: 'all',
    users: [],
    works: [],
    history: [],
    hasSearched: false
  },

  onLoad(options) {
    const history = this._loadHistory();
    const q = options && typeof options.q === 'string' ? decodeURIComponent(options.q) : '';
    this.setData({ history, query: q, focus: !q });
    if (q) this.doSearch(q);
  },

  onInput(e) {
    const value = (e && e.detail && typeof e.detail.value === 'string') ? e.detail.value : '';
    const q = value.trim();
    this.setData({ query: value });

    if (this._searchTimer) clearTimeout(this._searchTimer);
    if (!q) {
      this.setData({ users: [], works: [], loading: false, hasSearched: false });
      return;
    }

    this._searchTimer = setTimeout(() => {
      this.doSearch(q);
    }, 250);
  },

  onConfirm() {
    const q = (this.data.query || '').trim();
    if (!q) return;
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.doSearch(q);
  },

  onClear() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.setData({ query: '', users: [], works: [], loading: false, hasSearched: false, focus: true }, () => {
      setTimeout(() => this.setData({ focus: false }), 300);
    });
  },

  onTabTap(e) {
    const tab = e && e.currentTarget ? e.currentTarget.dataset.tab : '';
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab });
  },

  onHistoryTap(e) {
    const key = e && e.currentTarget ? e.currentTarget.dataset.key : '';
    const q = String(key || '').trim();
    if (!q) return;
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.setData({ query: q }, () => this.doSearch(q));
  },

  onClearHistory() {
    try {
      wx.setStorageSync(HISTORY_KEY, []);
    } catch (e) {}
    this.setData({ history: [] });
  },

  async exchangeUserAvatars(list) {
    if (!list || list.length === 0) return [];
    const fileList = list
      .filter(item => item.avatarUrl && item.avatarUrl.startsWith('cloud://'))
      .map(item => item.avatarUrl);
    if (fileList.length === 0) return list;

    try {
      const res = await wx.cloud.getTempFileURL({ fileList });
      const urlMap = {};
      (res.fileList || []).forEach(file => {
        if (file.status === 0) urlMap[file.fileID] = file.tempFileURL;
      });
      return list.map(item => ({
        ...item,
        avatarUrl: urlMap[item.avatarUrl] || item.avatarUrl
      }));
    } catch (e) {
      return list;
    }
  },

  async exchangeCloudUrls(list) {
    if (!list || list.length === 0) return [];
    const fileIdSet = new Set();
    list.forEach((item) => {
      if (item && item.imageUrl && item.imageUrl.startsWith('cloud://')) fileIdSet.add(item.imageUrl);
      if (item && item.authorAvatar && item.authorAvatar.startsWith('cloud://')) fileIdSet.add(item.authorAvatar);
    });
    const fileList = Array.from(fileIdSet);
    if (fileList.length === 0) return list;

    try {
      const res = await wx.cloud.getTempFileURL({ fileList });
      const urlMap = {};
      (res.fileList || []).forEach(file => {
        if (file.status === 0) urlMap[file.fileID] = file.tempFileURL;
      });

      return list.map(item => ({
        ...item,
        imageUrl: urlMap[item.imageUrl] || item.imageUrl,
        authorAvatar: urlMap[item.authorAvatar] || item.authorAvatar
      }));
    } catch (e) {
      return list;
    }
  },

  doSearch(keyword) {
    const q = String(keyword || '').trim();
    if (!q) return;
    this.setData({ loading: true, hasSearched: true });

    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'searchAll', keyword: q }
    }).then(async (res) => {
      const r = res && res.result;
      if (!r || r.code !== 0) throw new Error((r && r.msg) || 'search failed');

      const users = await this.exchangeUserAvatars((r.data && r.data.users) || []);
      const worksRaw = (r.data && r.data.works) || [];
      const works = await this.exchangeCloudUrls(worksRaw);

      this._addToHistory(q);
      this.setData({
        users,
        works,
        loading: false,
        history: this._loadHistory()
      });
    }).catch((err) => {
      const msg = err && (err.errMsg || err.message) ? (err.errMsg || err.message) : '';
      wx.showToast({ title: msg ? `搜索失败：${msg}` : '搜索失败', icon: 'none' });
      this.setData({ users: [], works: [], loading: false });
    });
  },

  onToggleFollow(e) {
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

    const toOpenid = e.currentTarget.dataset.openid;
    const index = Number(e.currentTarget.dataset.index);
    if (!toOpenid || Number.isNaN(index)) return;

    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'toggleFollow', toOpenid }
    }).then(res => {
      const r = res && res.result;
      if (!r || r.code !== 0) throw new Error((r && r.msg) || 'toggle failed');
      const next = this.data.users.slice();
      if (next[index]) next[index].isFollowing = !!(r.data && r.data.isFollowing);
      this.setData({ users: next });
    }).catch(() => {
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  goToUserProfile(e) {
    const openid = e.currentTarget.dataset.openid;
    if (!openid) return;
    wx.navigateTo({
      url: `/pages/user-profile/user-profile?openid=${encodeURIComponent(openid)}`
    });
  },

  goToDetail(e) {
    const { id, title, imageUrl, author, likes } = e.currentTarget.dataset;
    let url = `/pages/detail/detail?id=${id}`;
    if (title) url += `&title=${encodeURIComponent(title)}`;
    if (imageUrl) url += `&imageUrl=${encodeURIComponent(imageUrl)}`;
    if (author) url += `&author=${encodeURIComponent(author)}`;
    if (likes) url += `&likes=${likes}`;
    wx.navigateTo({ url });
  },

  _loadHistory() {
    try {
      const v = wx.getStorageSync(HISTORY_KEY);
      if (Array.isArray(v)) return v.filter(Boolean).map((s) => String(s)).slice(0, 12);
      return [];
    } catch (e) {
      return [];
    }
  },

  _addToHistory(keyword) {
    const k = String(keyword || '').trim();
    if (!k) return;
    const prev = this._loadHistory();
    const next = [k, ...prev.filter((x) => x !== k)].slice(0, 12);
    try {
      wx.setStorageSync(HISTORY_KEY, next);
    } catch (e) {}
  }
});
