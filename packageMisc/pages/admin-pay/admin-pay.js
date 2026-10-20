const STATES = { CREATING: '下单结果待确认', NOTPAY: '尚未付款', USERPAYING: '支付处理中', SUCCESS: '服务端已确认付款', CLOSED: '订单已关闭', REVOKED: '订单已撤销', PAYERROR: '支付失败', CREATE_FAILED: '未生成微信支付订单' };

Page({
  data: { loading: true, isAdmin: false, ready: false, checks: [], merchantId: '', error: '', paying: false, querying: false, order: null },
  onLoad() { this.loadConfig(); },
  onUnload() { this._disposed = true; clearTimeout(this._queryTimer); },

  async call(action, extra) {
    const response = await wx.cloud.callFunction({ name: 'template-api', data: Object.assign({ action }, extra || {}) });
    const result = response && response.result;
    if (!result || result.code !== 0) {
      const error = new Error(result && result.msg || '请求失败，请重试');
      error.data = result && result.data;
      error.code = result && result.code;
      throw error;
    }
    return result.data || {};
  },

  async loadConfig() {
    this.setData({ loading: true, error: '' });
    try {
      const data = await this.call('adminPayStatus');
      if (this._disposed) return;
      this._storageKey = 'admin_payment_test_' + data.accountKey;
      const saved = wx.getStorageSync(this._storageKey) || {};
      this._requestId = saved.requestId || '';
      this.setData({ loading: false, isAdmin: true, ready: data.ready, checks: data.checks, merchantId: data.merchantId });
      if (saved.outTradeNo) {
        this.showOrder(saved);
        if (data.ready) this.queryOrder();
      }
    } catch (error) {
      if (!this._disposed) this.setData({ loading: false, error: error.message, isAdmin: false });
    }
  },

  showOrder(order) {
    if (this._disposed) return;
    this.setData({ order: Object.assign({}, order, { stateText: STATES[order.state] || '等待查询确认' }) });
    wx.setStorageSync(this._storageKey, Object.assign({}, order, { requestId: this._requestId }));
  },

  pay() {
    if (!this.data.ready || !this.data.isAdmin || this.data.paying || this.data.querying) return;
    this.setData({ paying: true, error: '' });
    wx.showModal({
      title: '确认测试付款',
      content: '将向商户号 ' + this.data.merchantId + ' 实际支付 0.01 元，仅用于管理员联调，不购买商品或增加权益。',
      confirmText: '继续付款',
      success: result => {
        if (this._disposed) return;
        if (result.confirm) this.runPayment();
        else this.setData({ paying: false });
      },
      fail: () => { if (!this._disposed) this.setData({ paying: false }); }
    });
  },

  async runPayment() {
    const old = this.data.order;
    if (!this._requestId || (old && ['SUCCESS', 'CLOSED', 'REVOKED', 'PAYERROR', 'CREATE_FAILED'].includes(old.state))) {
      this._requestId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      wx.setStorageSync(this._storageKey, { requestId: this._requestId });
      this.setData({ order: null });
    }
    try {
      const data = await this.call('createPayJsapiTest', { requestId: this._requestId });
      if (this._disposed) return;
      if (data.order) this.showOrder(data.order);
      if (data.payment) {
        await new Promise((resolve, reject) => wx.requestPayment(Object.assign({}, data.payment, { success: resolve, fail: reject })));
      }
    } catch (error) {
      if (this._disposed) return;
      if (error.data && error.data.outTradeNo) this.showOrder({ outTradeNo: error.data.outTradeNo, state: 'CREATING' });
      const cancelled = /cancel/i.test(error.errMsg || '');
      this.setData({ error: cancelled ? '已取消付款，可以查询订单或继续支付。' : (error.message || '付款未完成，请查询订单确认结果。') });
    } finally {
      if (!this._disposed) {
        this.setData({ paying: false });
        if (this.data.order) this.queryOrder(0);
      }
    }
  },

  queryOrder(attempt) {
    if (typeof attempt !== 'number') attempt = 0;
    return this.refreshOrder('queryAdminPayTest', attempt);
  },

  async refreshOrder(action, attempt) {
    if (!this.data.order || this.data.querying || this.data.paying || !this.data.ready) return;
    clearTimeout(this._queryTimer);
    this.setData({ querying: true });
    try {
      const data = await this.call(action, { outTradeNo: this.data.order.outTradeNo });
      if (this._disposed) return;
      this.showOrder(data.order);
      if (data.order.state === 'SUCCESS') this.setData({ error: '' });
      if (attempt < 2 && ['NOTPAY', 'USERPAYING', 'CREATING'].includes(data.order.state)) {
        this._queryTimer = setTimeout(() => { if (!this._disposed) this.queryOrder(attempt + 1); }, 2000);
      }
    } catch (error) {
      if (!this._disposed) this.setData({ error: error.message || '查询失败，请重试' });
    } finally {
      if (!this._disposed) this.setData({ querying: false });
    }
  },

  closeOrder() {
    if (this.data.paying || this.data.querying) return;
    wx.showModal({ title: '关闭未付款测试单', content: '关闭后无法继续支付这笔订单，已成功付款的订单不会被关闭或退款。', success: result => { if (result.confirm && !this._disposed) this.refreshOrder('closeAdminPayTest', 2); } });
  }
});
