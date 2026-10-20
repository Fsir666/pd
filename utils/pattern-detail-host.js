// Keep the list mounted: its scroll, filters and card layout survive the detail sheet.
function tabVisibility(page, hidden) {
  const tab = typeof page.getTabBar === 'function' && page.getTabBar();
  if (tab) tab.setData({ detailHidden: hidden });
}
function measure(page, selector) {
  return new Promise(resolve => {
    const q = page.createSelectorQuery();
    q.select(selector).boundingClientRect();
    q.select(selector + ' .detail-cover-source').boundingClientRect();
    q.exec(rows => resolve(rows || []));
  });
}
function snapshot(page, canvasId) {
  if (!canvasId) return Promise.resolve('');
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => finish(''), 350);
    page.createSelectorQuery().select('#' + canvasId).fields({ node: true, size: true }).exec(rows => {
      const canvas = rows && rows[0] && rows[0].node;
      if (!canvas) return finish('');
      wx.canvasToTempFilePath({ canvas, success: r => finish(r.tempFilePath), fail: () => finish('') });
    });
  });
}
async function open(page, event, id) {
  if (!id || page._detailOpening || page.data.detailOpen) return;
  page._detailOpening = true;
  const ds = event.currentTarget.dataset;
  const selector = event.currentTarget.id ? '#' + event.currentTarget.id : '';
  try {
    const results = await Promise.all([
      selector ? measure(page, selector) : Promise.resolve([]),
      snapshot(page, ds.canvasId)
    ]);
    const rect = results[0][0];
    const cover = results[0][1];
    // A missing/offscreen card still opens, using a short centered expansion.
    const win = wx.getSystemInfoSync();
    const origin = rect && rect.width > 0 ? rect : {
      left: win.windowWidth * .1, top: win.windowHeight * .2,
      width: win.windowWidth * .8, height: win.windowHeight * .45
    };
    page._detailSelector = selector;
    const sourceList = page._pool || page.data.hotTemplates || [];
    const sequence = [];
    (sourceList || []).forEach(item => {
      if (!item) return;
      const itemId = item.type === 'pattern' && item.key ? 'seed_' + item.key : (item._id || item.id || '');
      if (itemId && sequence.indexOf(String(itemId)) < 0) sequence.push(String(itemId));
    });
    if (sequence.indexOf(String(id)) < 0) sequence.push(String(id));
    tabVisibility(page, true);
    page.setData({
      detailOpen: true,
      activeDetailCard: event.currentTarget.id || '',
      detailLaunch: {
        id: String(id), title: ds.title || '', sequence, coverMode: ds.canvasId ? 'aspectFit' : 'aspectFill',
        // Rankings show pixel canvases, so never replace them with an unrelated photo.
        image: results[1] || (ds.canvasId ? '' : (ds.imageUrl || '')),
        origin, coverHeight: cover ? cover.height : origin.width,
        coverRatio: (cover ? cover.height : origin.width) / origin.height,
        radius: (Number(ds.radius) || 28) * win.windowWidth / 750,
        width: win.windowWidth, height: win.windowHeight
      }
    });
  } catch (err) {
    tabVisibility(page, false);
    wx.showToast({ title: '暂时无法打开，请重试', icon: 'none' });
  } finally { page._detailOpening = false; }
}
module.exports = {
  open,
  methods: {
    async onDetailCloseRequest() {
      if (this._detailClosing) return;
      const detail = this.selectComponent('#pattern-detail-sheet');
      if (!detail) return;
      this._detailClosing = true;
      let rect = null;
      try {
        const rows = this._detailSelector ? await measure(this, this._detailSelector) : [];
        rect = rows[0];
      } catch (err) { /* Fade out if the original card no longer exists. */ }
      detail.closeToCard(rect);
    },
    onDetailClosed() {
      this.setData({ detailOpen: false, activeDetailCard: '', detailLaunch: null });
      this._detailClosing = false;
      tabVisibility(this, false);
    },
    detailShareMessage() {
      const detail = this.data.detailOpen && this.selectComponent('#pattern-detail-sheet');
      return detail ? detail.onShareAppMessage() : null;
    }
  }
};
