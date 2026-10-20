// Keep the list mounted: its scroll, filters and card layout survive the detail sheet.
function tabVisibility(page, hidden) {
  const tab = typeof page.getTabBar === 'function' && page.getTabBar();
  if (tab) tab.setData({ detailHidden: hidden });
}
function open(page, event, id) {
  if (!id || page._detailOpening || page.data.detailOpen) return;
  page._detailOpening = true;
  const ds = event.currentTarget.dataset;
  try {
    const win = wx.getSystemInfoSync();
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
      activeDetailCard: '',
      detailLaunch: {
        id: String(id), title: ds.title || '', sequence,
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
    onDetailCloseRequest() {
      if (this._detailClosing) return;
      const detail = this.selectComponent('#pattern-detail-sheet');
      if (!detail) return;
      this._detailClosing = true;
      detail.closeToCard();
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
