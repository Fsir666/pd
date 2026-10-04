Component({
  data: {
    showPopup: false
  },

  lifetimes: {
    attached() {
      // 注册隐私授权监听：每次触发隐私接口时，微信会回调这里
      if (wx.onNeedPrivacyAuthorization) {
        wx.onNeedPrivacyAuthorization((resolve) => {
          this._privacyResolve = resolve
          this.setData({ showPopup: true })
        })
      }
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
