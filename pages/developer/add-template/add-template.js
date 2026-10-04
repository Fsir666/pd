const app = getApp()

Page({
  data: {
    form: {
      title: '',
      author: 'Trae',
      description: '',
      size: '32x32'
    },
    difficultyNum: 3,
    tempImagePath: '',
    loading: false
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`form.${field}`]: value
    });
  },

  onSliderChange(e) {
    this.setData({
      difficultyNum: e.detail.value
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          tempImagePath: tempFilePath
        });
      }
    });
  },

  submitTemplate() {
    if (!this.data.form.title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    if (!this.data.tempImagePath) {
      wx.showToast({ title: '请上传图片', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    // 1. Upload Image to Cloud Storage
    const cloudPath = `templates/${Date.now()}-${Math.floor(Math.random(1000))}.png`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: this.data.tempImagePath,
      success: res => {
        const fileID = res.fileID;
        this.addTemplateToDB(fileID);
      },
      fail: err => {
        console.error('Upload failed', err);
        wx.showToast({ title: '图片上传失败', icon: 'none' });
        this.setData({ loading: false });
      }
    });
  },

  addTemplateToDB(fileID) {
    const { title, author, description, size } = this.data.form;
    const difficultyMap = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
    const difficulty = difficultyMap[this.data.difficultyNum - 1];

    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'add',
        template: {
          title,
          author,
          description,
          size,
          difficulty,
          imageUrl: fileID,
          heat: 0,
          price: 0,
          time: '1h' // Default
        }
      },
      success: res => {
        if (res.result.code === 0) {
          wx.showToast({ title: '提交成功' });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({ title: '提交失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('Call function failed', err);
        wx.showToast({ title: '系统错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  }
});