const presets = require('../../data/pattern-presets.js');

/**
 * 兼容页 / 重定向页（方案 A 合并后）
 *
 * 作品详情页已统一为 pages/detail/detail。本页仅用于不打破
 * 历史分享出去、或旧版入口发出的链接：
 *     /pages/pattern-detail/pattern-detail?key=cat
 *
 * 打开后立即 redirectTo 到统一作品页：
 *     /pages/detail/detail?id=seed_cat
 *
 * 若云端尚无 seed_<key> 记录（云端未发布），则退化为读本地预设兜底渲染，
 * 保证任何情况下「图能打开」。
 */
Page({
  data: {
    statusBarHeight: 20
  },

  onLoad(query) {
    const key = query && query.key ? String(query.key) : '';
    const inv = query && query.inv ? `&inv=${encodeURIComponent(query.inv)}` : '';
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: (sysInfo.statusBarHeight || 20) + 4 });

    if (!key) {
      // 无参数：回首页
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

    this._key = key;
    const targetId = 'seed_' + key;

    // 优先重定向到统一作品页（云端记录）
    wx.cloud.database().collection('templates').doc(targetId).get()
      .then((res) => {
        if (res && res.data) {
          this._redirect(targetId, inv);
        } else {
          this._fallbackToIndex();
        }
      })
      .catch(() => {
        // 云端没有该记录（或未初始化）：仍然尝试进 detail，由 detail 自行兜底
        this._redirect(targetId, inv, true);
      });
  },

  _redirect(targetId, inv, soft) {
    const url = `/pages/detail/detail?id=${encodeURIComponent(targetId)}${inv || ''}`;
    wx.redirectTo({
      url,
      fail: () => {
        if (soft) this._fallbackToIndex();
        else this._fallbackToIndex();
      }
    });
  },

  _fallbackToIndex() {
    // 兜底：内置图纸找不到时，回首页，不让用户卡在空白页
    wx.showToast({ title: '图纸不存在', icon: 'none' });
    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' });
    }, 800);
  },

  // 分享：仍按统一作品页分享，避免再产生 pattern-detail 链接
  onShareAppMessage() {
    const key = this._key || '';
    const targetId = key ? 'seed_' + key : '';
    const raw = presets.find((x) => x.key === key);
    const app = getApp();
    const inv = app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.inviteCode
      ? String(app.globalData.userInfo.inviteCode)
      : '';
    const invPart = inv ? `&inv=${encodeURIComponent(inv)}` : '';
    const path = targetId
      ? `/pages/detail/detail?id=${encodeURIComponent(targetId)}${invPart}`
      : '/pages/index/index';
    const out = { title: (raw && raw.name ? raw.name : '拼豆图纸') + ' 拼豆图纸', path };
    if (key) out.imageUrl = '/images/patterns/' + key + '.png';
    return out;
  }
});
