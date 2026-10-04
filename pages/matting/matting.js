const app = getApp();

Page({
  data: {
    imageUrl: '',
    resultUrl: '',
    isProcessing: false,
    showIntro: true
  },

  onLoad(options) {

  },

  onChooseImage() {
    if (!app.globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用抠图功能',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' })
        }
      })
      return
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ 
          imageUrl: tempFilePath,
          showIntro: false,
          isProcessing: true
        });
        
        // Call actual API processing
        this.processMatting(tempFilePath);
      }
    });
  },

  processMatting(filePath) {
    const doWork = async () => {
      const ext = (() => {
        const m = String(filePath).match(/\.([a-zA-Z0-9]+)$/);
        const e = m && m[1] ? m[1].toLowerCase() : 'jpg';
        return ['png', 'jpg', 'jpeg', 'webp'].includes(e) ? e : 'jpg';
      })();
      const cloudPath = `matting_inputs/${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      });
      const fileID = uploadRes && uploadRes.fileID ? String(uploadRes.fileID) : '';
      if (!fileID) {
        throw new Error('图片上传失败');
      }

      const res = await wx.cloud.callFunction({
        name: 'ai-generator',
        data: {
          action: 'matting',
          fileID
        }
      });
      const result = res && res.result ? res.result : null;
      if (result && result.code === 401) {
        wx.showModal({
          title: '提示',
          content: '请先登录后再使用抠图功能',
          confirmText: '去登录',
          success: (r) => {
            if (r.confirm) wx.switchTab({ url: '/pages/profile/profile' })
          }
        })
        this.setData({ isProcessing: false })
        return
      }
      if (result && result.code === 10001) {
        const coins = result.data && typeof result.data.coins === 'number' ? result.data.coins : 0
        const need = result.data && typeof result.data.need === 'number' ? result.data.need : 0
        wx.showModal({
          title: '豆豆不足',
          content: `本次需要 ${need} 豆豆，你现在只有 ${coins}。`,
          confirmText: '去签到',
          success: (r) => {
            if (r.confirm) wx.switchTab({ url: '/pages/profile/profile' })
          }
        })
        this.setData({ isProcessing: false })
        return
      }
      const outFileID = result && result.code === 0 && result.data && result.data.fileID ? String(result.data.fileID) : '';
      if (!outFileID) {
        const msg = (result && result.msg) ? String(result.msg) : '抠图失败';
        const detail = (result && result.error) ? String(result.error) : '';
        throw new Error(detail ? `${msg}:${detail}` : msg);
      }

      const walletCoins = result && result.data && result.data.wallet && typeof result.data.wallet.coins === 'number' ? result.data.wallet.coins : null
      if (typeof walletCoins === 'number') {
        app.updateUserInfo({ coins: walletCoins })
      }

      const dl = await new Promise((resolve, reject) => {
        wx.cloud.downloadFile({
          fileID: outFileID,
          success: (r) => (r && r.tempFilePath ? resolve(r.tempFilePath) : reject(new Error('下载失败'))),
          fail: () => reject(new Error('下载失败'))
        });
      });

      this.setData({
        resultUrl: dl,
        isProcessing: false
      });
    };

    doWork().catch((e) => {
      this._handleError(e && e.message ? String(e.message) : '网络请求失败');
    });
  },

  _handleError(msg) {
    this.setData({ isProcessing: false });
    wx.showToast({
      title: msg,
      icon: 'none',
      duration: 3000
    });
  },

  onReUpload() {
    this.setData({
      imageUrl: '',
      resultUrl: '',
      showIntro: true,
      isProcessing: false
    });
  },

  onSaveImage() {
    if (!this.data.resultUrl) return;
    
    // Helper to save file path
    const saveToAlbum = (path) => {
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success: () => {
          wx.showToast({ title: '已保存', icon: 'success' });
        },
        fail: (err) => {
          if (err.errMsg.includes('auth')) {
            wx.openSetting();
          } else {
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        }
      });
    };

    // If URL is remote (http/https), download it first
    if (this.data.resultUrl.startsWith('http')) {
      wx.showLoading({ title: '下载中...' });
      wx.downloadFile({
        url: this.data.resultUrl,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            saveToAlbum(res.tempFilePath);
          } else {
            wx.showToast({ title: '下载失败', icon: 'none' });
          }
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '下载错误', icon: 'none' });
        }
      });
    } else {
      // Local path
      saveToAlbum(this.data.resultUrl);
    }
  }
});
