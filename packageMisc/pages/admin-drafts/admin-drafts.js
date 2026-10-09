const app = getApp();

Page({
  data: {
    loading: true,
    isAdmin: false,
    drafts: [],          // 图纸库列表
    selected: {},        // key -> true
    selectedCount: 0,
    isPublic: true,      // 认领后是否公开
    submitting: false,
    seeded: false,
    loadError: ''
  },

  onLoad() {
    this.checkAndLoad();
  },

  onShow() {
    // 从详情返回时保持状态，不重复拉
  },

  // 1. 校验管理员身份
  checkAndLoad() {
    wx.showLoading({ title: '加载中...', mask: true });
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'checkAdmin' }
    }).then(res => {
      const r = (res && res.result) || {};
      const isAdmin = !!(r.data && r.data.isAdmin);
      this.setData({ isAdmin });
      if (!isAdmin) {
        wx.hideLoading();
        this.setData({ loading: false, loadError: '当前账号不是管理员' });
        return;
      }
      // 管理员：先确保图纸库已灌入（幂等），再拉列表
      return this.ensureSeeded().then(() => this.loadDrafts());
    }).catch(err => {
      wx.hideLoading();
      console.error('[admin-drafts] checkAdmin fail', err);
      this.setData({ loading: false, loadError: '网络错误，请重试' });
    });
  },

  // 2. 首次进入自动灌库（幂等，服务端按 key 去重）
  ensureSeeded() {
    return wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'seedDrafts' }
    }).then(res => {
      const r = (res && res.result) || {};
      if (r.code === 0 && r.data) {
        this.setData({ seeded: (r.data.seeded || 0) > 0 });
      }
      return true;
    }).catch(() => true);
  },

  // 3. 拉图纸库
  loadDrafts() {
    return wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'listDrafts' }
    }).then(res => {
      wx.hideLoading();
      const r = (res && res.result) || {};
      const list = (r.data || []).map(d => ({
        key: d.key,
        name: d.name || d.title || d.key,
        tags: d.tags || [],
        sizeText: `${d.w || '?'}×${d.h || '?'}`,
        beadCount: d.beadCount || 0,
        paletteCount: (d.palette && d.palette.length) || 0,
        thumb: d.imageUrl || d.image || '',
        claimed: !!d.claimed,
        checked: false
      }));
      this.setData({ drafts: list, loading: false, loadError: '' });
    }).catch(err => {
      wx.hideLoading();
      console.error('[admin-drafts] listDrafts fail', err);
      this.setData({ loading: false, loadError: '加载图纸库失败' });
    });
  },

  // 勾选 / 取消
  toggleSelect(e) {
    const key = e.currentTarget.dataset.key;
    const list = this.data.drafts;
    const idx = list.findIndex(d => d.key === key);
    if (idx === -1) return;
    const checked = !list[idx].checked;
    list[idx].checked = checked;
    const selected = Object.assign({}, this.data.selected);
    if (checked) selected[key] = true; else delete selected[key];
    this.setData({
      drafts: list,
      selected,
      selectedCount: Object.keys(selected).length
    });
    wx.vibrateShort({ type: 'light' });
  },

  // 全选 / 取消全选
  toggleSelectAll() {
    const all = this.data.drafts.length > 0 && this.data.drafts.every(d => d.checked);
    const list = this.data.drafts.map(d => Object.assign({}, d, { checked: !all }));
    const selected = {};
    if (!all) list.forEach(d => { selected[d.key] = true; });
    this.setData({
      drafts: list,
      selected,
      selectedCount: Object.keys(selected).length
    });
  },

  // 切换公开/私密
  setPublic(e) {
    const v = e.currentTarget.dataset.v === 'public';
    this.setData({ isPublic: v });
  },

  // 预览大图
  previewThumb(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  // 确认认领
  confirmClaim() {
    const keys = Object.keys(this.data.selected);
    if (!keys.length) {
      wx.showToast({ title: '请先勾选图纸', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;

    const pubText = this.data.isPublic ? '公开' : '私密';
    wx.showModal({
      title: '确认添加',
      content: `将 ${keys.length} 张图纸添加到你的名下（${pubText}）？`,
      confirmText: '确认',
      success: (res) => {
        if (res.confirm) this.doClaim(keys);
      }
    });
  },

  doClaim(keys) {
    this.setData({ submitting: true });
    wx.showLoading({ title: '处理中...', mask: true });
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'claimDrafts',
        keys,
        isPublic: this.data.isPublic
      }
    }).then(res => {
      wx.hideLoading();
      this.setData({ submitting: false });
      const r = (res && res.result) || {};
      if (r.code === 0) {
        const ok = (r.data && r.data.ok) || [];
        const failed = (r.data && r.data.failed) || [];
        let msg = `成功添加 ${ok.length} 张`;
        if (failed.length) msg += `，${failed.length} 张失败`;
        wx.showToast({ title: msg, icon: 'none', duration: 2500 });
        // 清空勾选 & 刷新
        this.setData({ selected: {}, selectedCount: 0 });
        this.loadDrafts();
      } else {
        wx.showToast({ title: r.msg || '添加失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('[admin-drafts] claimDrafts fail', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  goBack() {
    wx.navigateBack();
  },

  // 去「我的作品」看结果
  goMyWorks() {
    wx.navigateTo({ url: '/pages/my-works/my-works' });
  },

  // 单张删除
  // 已添加到名下的图纸直接拦截：后端 deleteDraft 对已发布的会执行「撤回发布」，
  // 会把名下作品一起下架。在拿到支持「仅移出图纸库」的云函数前，前端先挡住。
  deleteItem(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const item = this.data.drafts.find(d => d.key === key);
    if (item && item.claimed) {
      wx.showToast({ title: '该图纸已添加到名下，暂不能删除', icon: 'none', duration: 2200 });
      wx.vibrateShort({ type: 'medium' });
      return;
    }
    wx.showModal({
      title: '删除图纸',
      content: '确定从图纸库删除这张图纸吗？',
      confirmText: '删除',
      confirmColor: '#E2677A',
      success: (res) => { if (res.confirm) this.doDelete([key]); }
    });
  },

  // 批量删除选中
  // 勾选中只要混入已添加到名下的图纸，一律拦下，避免连带撤回
  deleteSelected() {
    const keys = Object.keys(this.data.selected);
    if (!keys.length) {
      wx.showToast({ title: '请先勾选图纸', icon: 'none' });
      return;
    }
    const claimedCount = this.data.drafts.filter(
      d => this.data.selected[d.key] && d.claimed
    ).length;
    if (claimedCount > 0) {
      wx.showToast({
        title: `勾选中有 ${claimedCount} 张已添加到名下，不能删除`,
        icon: 'none',
        duration: 2200
      });
      wx.vibrateShort({ type: 'medium' });
      return;
    }
    wx.showModal({
      title: '删除图纸',
      content: `确定从图纸库删除 ${keys.length} 张图纸吗？`,
      confirmText: '删除',
      confirmColor: '#E2677A',
      success: (res) => { if (res.confirm) this.doDelete(keys); }
    });
  },

  doDelete(keys) {
    wx.showLoading({ title: '处理中...', mask: true });
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'deleteDraft', keys }
    }).then(res => {
      wx.hideLoading();
      const r = (res && res.result) || {};
      if (r.code === 0) {
        const ok = (r.data && r.data.ok) || [];
        const failed = (r.data && r.data.failed) || [];
        let msg = `已删除 ${ok.length} 张`;
        if (failed.length) msg += `，${failed.length} 张失败`;
        wx.showToast({ title: msg, icon: 'none', duration: 2500 });
        this.setData({ selected: {}, selectedCount: 0 });
        this.loadDrafts();
      } else {
        wx.showToast({ title: r.msg || '删除失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('[admin-drafts] deleteDraft fail', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  onShareAppMessage() {
    return { title: '悠米拼豆 · 精品图纸库', path: '/pages/index/index' };
  }
});
