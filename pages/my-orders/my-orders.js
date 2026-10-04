const app = getApp();

Page({
  data: {
    paying: false
  },

  onEnterOrders() {
    wx.showModal({
      title: '温馨提示',
      content: '这个功能正在开发，已进入收尾状态，敬请期待！',
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#54A0FF'
    });
  },

  async onTestPay() {
    if (this.data.paying) return;

    if (!app.globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再测试支付',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }

    this.setData({ paying: true });
    wx.showLoading({ title: '下单中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'template-api',
        data: {
          action: 'createPayJsapiTest',
          totalFee: 1,
          body: '测试支付（拼豆图纸）'
        }
      });

      wx.hideLoading();

      if (!res.result || res.result.code !== 0) {
        const detail = res && res.result ? JSON.stringify(res.result) : '无返回'
        wx.showModal({
          title: '下单失败',
          content: (res?.result?.msg || '下单失败') + '\n' + detail,
          showCancel: false
        })
        return
      }

      const payment = res.result.data && res.result.data.payment;
      if (!payment) {
        const detail = res && res.result ? JSON.stringify(res.result) : '无返回'
        wx.showModal({
          title: '下单异常',
          content: '缺少 payment 参数\n' + detail,
          showCancel: false
        })
        return
      }

      await new Promise((resolve, reject) => {
        wx.requestPayment({
          ...payment,
          success: resolve,
          fail: reject
        });
      });

      wx.showToast({ title: '支付成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      const errMsg = err && typeof err.errMsg === 'string' ? err.errMsg : ''
      if (/cancel/i.test(errMsg)) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
        return
      }

      const content = typeof err === 'string' ? err : JSON.stringify(err || {})
      wx.showModal({ title: '支付失败', content, showCancel: false })
    } finally {
      this.setData({ paying: false });
    }
  }
});
