Page({
  data: {
    showIntro: true
  },

  onLoad() {},

  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.navigateTo({
          url: `/packageTool/pages/cartoon-generate/cartoon-generate?src=${encodeURIComponent(tempFilePath)}`
        });
      }
    });
  }
});
