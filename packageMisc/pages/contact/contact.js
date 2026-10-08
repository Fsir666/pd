Page({
  handleContact() {
    wx.showModal({
      title: '提示',
      content: '人工客服功能正在开发中，敬请期待',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onFaqTap(e) {
    const id = e.currentTarget.dataset.id;
    const answers = {
      '1': '点击底部的“+”号按钮，选择上传图片或绘制图纸即可发布。',
      '2': '通常在下单后 24 小时内发货，部分定制商品需 48 小时。',
      '3': '所有公开图纸仅供个人学习交流，未经授权不可用于商业用途。'
    };
    
    wx.showModal({
      title: '常见问题',
      content: answers[id],
      showCancel: false,
      confirmText: '知道了'
    });
  }
});