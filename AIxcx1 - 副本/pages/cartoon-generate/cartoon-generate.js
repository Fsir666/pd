const app = getApp();

Page({
  data: {
    src: '',
    ratioOptions: ['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9'],
    ratioValue: '1:1',
    resolutionOptions: [
      { label: '2K', value: '2K' },
      { label: '4K', value: '4K' }
    ],
    resolutionValue: '4K',
    isGenerating: false,
    resultUrl: '',
    resultFileID: '',
    resultTempPath: ''
  },

  onLoad(options) {
    const src = options && options.src ? decodeURIComponent(options.src) : '';
    this.setData({ src });
  },

  onRatioChange(e) {
    this.setData({ ratioValue: e.detail.value });
  },

  onResolutionChange(e) {
    this.setData({ resolutionValue: e.detail.value });
  },

  async onSubmit() {
    if (this.data.isGenerating) return;
    if (!this.data.src) return;
    if (!app.globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用转卡通功能',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' })
        }
      })
      return
    }

    this.setData({ isGenerating: true, resultUrl: '', resultFileID: '', resultTempPath: '' });

    try {
      const filePath = this.data.src;
      const ext = (() => {
        const m = String(filePath).match(/\.([a-zA-Z0-9]+)$/);
        const e = m && m[1] ? m[1].toLowerCase() : 'jpg';
        return ['png', 'jpg', 'jpeg', 'webp'].includes(e) ? e : 'jpg';
      })();
      const cloudPath = `cartoon_inputs/${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      });

      const fileID = uploadRes && uploadRes.fileID ? uploadRes.fileID : '';
      if (!fileID) {
        throw new Error('图片上传失败');
      }

      const taskId = await this._createDoubaoTask({
        fileID,
        ratio: this.data.ratioValue,
        resolution: this.data.resolutionValue
      });

      this._kickoffDoubaoTask(taskId);
      await this._sleep(500);

      const result = await this._pollDoubaoTaskResult(taskId);
      const resultUrl = result && result.url ? String(result.url) : '';
      const resultFileID = result && result.fileID ? String(result.fileID) : '';

      const tempPath = resultFileID ? await this._downloadCloudFile(resultFileID) : await this._downloadToTemp(resultUrl);

      this.setData({
        resultUrl,
        resultFileID,
        resultTempPath: tempPath
      });
      wx.showToast({ title: '生成完成', icon: 'success' });
    } catch (e) {
      if (e && e.code === 401) {
        wx.showModal({
          title: '提示',
          content: '请先登录后再使用转卡通功能',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' })
          }
        })
      } else if (e && e.code === 10001) {
        const coins = e.data && typeof e.data.coins === 'number' ? e.data.coins : 0
        const need = e.data && typeof e.data.need === 'number' ? e.data.need : 0
        wx.showModal({
          title: '豆豆不足',
          content: `本次需要 ${need} 豆豆，你现在只有 ${coins}。`,
          confirmText: '去签到',
          success: (res) => {
            if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' })
          }
        })
      } else {
        wx.showToast({ title: e.message || '生成失败', icon: 'none' });
      }
    } finally {
      this.setData({ isGenerating: false });
    }
  },

  onPreviewResult() {
    const p = this.data.resultTempPath || this.data.resultUrl;
    if (!p) return;
    wx.previewImage({ urls: [p] });
  },

  async onSaveResult() {
    const p = this.data.resultTempPath || this.data.resultUrl;
    if (!p) return;
    wx.showLoading({ title: '正在保存到相册...' });
    try {
      await this._saveToAlbum(p);
      wx.hideLoading();
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  async onImportToGenerate() {
    const p = this.data.resultTempPath || this.data.resultUrl;
    if (!p) return;
    wx.showLoading({ title: '正在导入...' });
    try {
      app.globalData.importImageUrl = p;
      wx.hideLoading();
      wx.navigateTo({ url: '/pages/generate/generate?from=cartoon' });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '导入失败', icon: 'none' });
    }
  },

  _downloadToTemp(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200 && res.tempFilePath) {
            resolve(res.tempFilePath);
          } else {
            reject(new Error(this._formatDownloadFailMsg(url)));
          }
        },
        fail: () => reject(new Error(this._formatDownloadFailMsg(url)))
      });
    });
  },

  _formatDownloadFailMsg(targetUrl) {
    const host = this._getHost(targetUrl);
    if (host) {
      return `下载失败:请配置downloadFile合法域名(${host})`;
    }
    return '下载失败:请配置downloadFile合法域名';
  },

  _getHost(targetUrl) {
    try {
      const u = String(targetUrl || '');
      const m = u.match(/^https?:\/\/([^\/?#]+)/i);
      return m && m[1] ? m[1] : '';
    } catch (e) {
      return '';
    }
  },

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  async _createDoubaoTask({ fileID, ratio, resolution }) {
    const res = await wx.cloud.callFunction({
      name: 'ai-generator',
      data: {
        action: 'createDoubaoTask',
        fileID,
        ratio,
        resolution
      }
    });
    const result = res && res.result ? res.result : null;
    if (result && (result.code === 401 || result.code === 10001)) {
      const err = new Error(result.msg || '生成失败')
      err.code = result.code
      err.data = result.data || {}
      throw err
    }
    const walletCoins = result && result.code === 0 && result.data && result.data.wallet && typeof result.data.wallet.coins === 'number' ? result.data.wallet.coins : null
    if (typeof walletCoins === 'number') {
      app.updateUserInfo({ coins: walletCoins })
    }
    const taskId = result && result.code === 0 && result.data && result.data.taskId ? String(result.data.taskId) : '';
    if (!taskId) {
      const msg = (result && result.msg) ? String(result.msg) : '生成失败';
      const detail = (result && result.error) ? String(result.error) : '';
      throw new Error(detail ? `${msg}:${detail}` : msg);
    }
    return taskId;
  },

  async _pollDoubaoTaskResult(taskId) {
    const start = Date.now();
    const maxMs = 6 * 60 * 1000;
    let lastStatus = '';
    let hasKickoffRetry = false;
    while (Date.now() - start < maxMs) {
      const task = await this._getDoubaoTask(taskId);
      const status = String((task && task.status) || '');
      lastStatus = status;
      if (status === 'success') {
        const url = task && task.resultUrl ? String(task.resultUrl) : '';
        const fileID = task && task.resultFileID ? String(task.resultFileID) : '';
        if (fileID || url) return { url, fileID };
        throw new Error('生成失败');
      }
      if (status === 'failed') {
        throw new Error((task && task.errorMessage) ? String(task.errorMessage) : '生成失败');
      }
      if (!hasKickoffRetry && status === 'pending' && Date.now() - start > 4000) {
        hasKickoffRetry = true;
        this._kickoffDoubaoTask(taskId);
      }
      await this._sleep(1500);
    }
    if (lastStatus === 'pending') {
      throw new Error('任务一直未开始处理：请检查触发器是否生效、ai-generator 超时是否≥60s');
    }
    throw new Error('生成超时，请稍后重试');
  },

  _downloadCloudFile(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.downloadFile({
        fileID,
        success: (res) => {
          if (res && res.tempFilePath) {
            resolve(res.tempFilePath);
          } else {
            reject(new Error('下载失败'));
          }
        },
        fail: () => reject(new Error('下载失败'))
      });
    });
  },

  _kickoffDoubaoTask(taskId) {
    if (!taskId) return Promise.resolve(false);
    return wx.cloud.callFunction({
      name: 'ai-generator',
      data: {
        action: 'processDoubaoTask',
        taskId
      }
    }).then(() => true).catch(() => false);
  },

  async _getDoubaoTask(taskId) {
    const db = wx.cloud.database();
    try {
      const snap = await db.collection('doubao_tasks').doc(taskId).get();
      return snap && snap.data ? snap.data : null;
    } catch (e) {
      const res = await wx.cloud.callFunction({
        name: 'ai-generator',
        data: {
          action: 'getDoubaoTask',
          taskId
        }
      });
      const result = res && res.result ? res.result : null;
      if (!result || result.code !== 0) {
        const msg = (result && result.msg) ? String(result.msg) : '生成失败';
        throw new Error(msg);
      }
      return result.data || null;
    }
  },

  _saveToAlbum(filePath) {
    const doSave = () => new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: () => resolve(true),
        fail: (err) => reject(err)
      });
    });

    const openSetting = () => new Promise((resolve) => {
      wx.showModal({
        title: '需要相册权限',
        content: '请在设置中允许保存到相册',
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
          if (!res.confirm) {
            resolve(false);
            return;
          }
          wx.openSetting({
            success: () => resolve(true),
            fail: () => resolve(false)
          });
        }
      });
    });

    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: async (res) => {
          const auth = res && res.authSetting ? res.authSetting['scope.writePhotosAlbum'] : undefined;
          if (auth === false) {
            const ok = await openSetting();
            if (!ok) {
              reject(new Error('未授权相册权限'));
              return;
            }
          }
          try {
            await doSave();
            resolve(true);
          } catch (e) {
            reject(new Error('保存失败'));
          }
        },
        fail: async () => {
          try {
            await doSave();
            resolve(true);
          } catch (e) {
            reject(new Error('保存失败'));
          }
        }
      });
    });
  }
});
