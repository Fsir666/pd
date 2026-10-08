Component({
  data: {
    showPopup: false
  },

  lifetimes: {
    attached() {
      // 注册隐私授权监听：每次触发隐私接口时，微信会回调这里。
      // 说明：wx.onNeedPrivacyAuthorization 为全局单次注册，生效的始终是
      // 「最后一次注册」的回调；每个页面 attached 时都会把当前页实例注册上去，
      // 因此在本页触发的隐私接口一定能在本页弹出。
      if (wx.onNeedPrivacyAuthorization) {
        wx.onNeedPrivacyAuthorization((resolve) => {
          this._privacyResolve = resolve
          this.setData({ showPopup: true })
        })
      }
    },

    // 页面卸载时若仍有未处理的授权请求，主动放行，避免请求悬挂
    detached() {
      if (this._privacyResolve) {
        try {
          this._privacyResolve({ event: 'disagree' })
        } catch (e) { /* ignore */ }
        this._privacyResolve = null
      }
      this.setData({ showPopup: false })
    }
  },

  methods: {
    // 打开《用户隐私保护指引》
    openPrivacyContract() {
      wx.openPrivacyContract({
        fail: (err) => {
          console.warn('打开隐私保护指引失败', err)
        }
      })
    },

    // 用户点「同意」——由 open-type 按钮回调
    handleAgree(e) {
      this.setData({ showPopup: false })
      if (this._privacyResolve) {
        this._privacyResolve({
          buttonId: 'agree-btn',
          event: 'agree'
        })
        this._privacyResolve = null
      }
    },

    // 用户点「不同意」
    handleDisagree() {
      this.setData({ showPopup: false })
      if (this._privacyResolve) {
        this._privacyResolve({ event: 'disagree' })
        this._privacyResolve = null
      }
    },

    // 阻止滚动穿透
    preventMove() {}
  }
})
