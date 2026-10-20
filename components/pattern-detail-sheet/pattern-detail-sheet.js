const detail = require('../../pages/detail/detail-model.js');
const DURATION = 280;
const methods = {};
Object.keys(detail).forEach(key => {
  if (typeof detail[key] === 'function' && !['onLoad', 'onReady', 'onShow'].includes(key)) methods[key] = detail[key];
});
Component({
  options: { styleIsolation: 'isolated' },
  properties: { launch: { type: Object, value: null } },
  data: Object.assign({}, detail.data, {
    embeddedDetail: true, expanded: false, settled: false, closing: false,
    mounted: false, backGuard: false,
    detailWidth: 375, detailHeight: 667,
    loadState: 'loading', loadError: '', detailScrollTop: 0, detailScrollTarget: '',
    showGestureHint: false, canGoPrevious: false, canGoNext: false
  }),
  lifetimes: {
    attached() { this._embedded = true; this._timers = []; },
    ready() {
      const launch = this.data.launch;
      if (!launch) return;
      this.setData({
        mounted: true, backGuard: true,
        detailWidth: launch.width, detailHeight: launch.height,
        title: launch.title,
        statusBarHeight: 12
      }, () => {
        const ids = launch.sequence || [];
        const index = ids.indexOf(String(launch.id));
        this._sequence = ids;
        this.setData({ canGoPrevious: index > 0, canGoNext: index >= 0 && index < ids.length - 1 });
        this._later(() => {
          this.setData({ expanded: true });
          this._later(() => {
            this.setData({ settled: true });
            if (!wx.getStorageSync('detail_swipe_hint_seen')) {
              this.setData({ showGestureHint: true });
              wx.setStorageSync('detail_swipe_hint_seen', true);
              this._later(() => this.setData({ showGestureHint: false }), 2400);
            }
          }, DURATION);
        }, 40);
      });
      // The host uses a native navigation bar; the close button sits inside its viewport.
      detail.onLoad.call(this, { id: launch.id });
      this.setData({ statusBarHeight: 12 });
    },
    detached() {
      this._disposed = true;
      (this._timers || []).forEach(clearTimeout);
    }
  },
  pageLifetimes: { show() { if (!this._disposed) detail.onShow.call(this); } },
  methods: Object.assign({}, methods, {
    noop() {},
    _later(fn, delay) {
      const timer = setTimeout(() => { if (!this._disposed) fn(); }, delay);
      this._timers.push(timer);
    },
    _onDetailLoaded() {
      this.setData({ loadState: 'ready', loadError: '' });
    },
    _onDetailError(message) {
      this.setData({ loadState: 'error', loadError: message });
    },
    retryLoad() {
      if (this.data.loadState === 'loading' || this.data.closing) return;
      this.setData({ loadState: 'loading', loadError: '' });
      this.fetchWorkDetails(this.data.id);
    },
    goBack() {
      if (!this.data.closing) this.triggerEvent('closerequest');
    },
    onNativeBack() { this.goBack(); },
    closeToCard() {
      if (this.data.closing) return;
      this._timers.forEach(clearTimeout);
      // Keep the detail at its real size throughout the transition.
      this.setData({ closing: true, expanded: false, settled: false, showGestureHint: false });
      this._later(() => {
        this.setData({ backGuard: false });
        this.triggerEvent('closed');
      }, DURATION);
    },
    onDetailScroll(event) {
      this._detailScrollTop = Math.max(0, Number(event.detail && event.detail.scrollTop) || 0);
    },
    onDetailTouchStart(event) {
      const touch = event.touches && event.touches[0];
      if (!touch || !this.data.settled || this.data.closing) return;
      this._detailTouchStart = { x: touch.clientX, y: touch.clientY, at: Date.now() };
    },
    onDetailTouchEnd(event) {
      const start = this._detailTouchStart;
      this._detailTouchStart = null;
      const touch = event.changedTouches && event.changedTouches[0];
      if (!start || !touch || !this.data.settled || this.data.closing) return;
      const dy = touch.clientY - start.y;
      const dx = Math.abs(touch.clientX - start.x);
      const duration = Date.now() - start.at;
      const threshold = duration < 260 ? 56 : 104;
      if (this._detailScrollTop <= 2 && dy > threshold && dx < Math.max(72, dy * 0.55)) this.goBack();
    },
    onDetailTouchCancel() { this._detailTouchStart = null; },
    focusComment() {
      this.setData({ detailScrollTarget: '' }, () => this.setData({ detailScrollTarget: 'detail-comments' }));
    },
    switchAdjacent(event) {
      const direction = event.currentTarget.dataset.direction === 'previous' ? -1 : 1;
      const ids = this._sequence || [];
      const current = ids.indexOf(String(this.data.id));
      const next = current + direction;
      if (current < 0 || next < 0 || next >= ids.length || this._switching || this.data.closing) return;
      this._switching = true;
      const id = ids[next];
      this.setData({
        id, loadState: 'loading', loadError: '', detailScrollTop: 0, detailScrollTarget: '',
        canGoPrevious: next > 0, canGoNext: next < ids.length - 1
      });
      this._later(() => { this._switching = false; }, 280);
      this.fetchWorkDetails(id);
      this.fetchUserStatus(id);
      this.fetchComments(id);
    }
  })
});
