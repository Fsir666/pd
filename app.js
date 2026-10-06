App({
  onLaunch(options) {
    console.log('App Launch');
    
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: 'cloudbase-d3ghdhcts9aad4fec',
        traceUser: true,
      });
    }

    const inv = options && options.query && typeof options.query.inv === 'string' ? options.query.inv.trim() : ''
    if (inv) {
      wx.setStorageSync('pendingInviteCode', inv.toUpperCase())
    }

    // 一次性：把内置图纸库发布到冯账号（template-api 的 seedPresets 动作内已做全局幂等锁，
    // 任意用户首次打开都会触发，但只写一次；写的是固定 _id，与触发者无关）
    if (!wx.getStorageSync('seedPresetsTriggered')) {
      wx.cloud.callFunction({ name: 'template-api', data: { action: 'seedPresets' } })
        .then(() => wx.setStorageSync('seedPresetsTriggered', true))
        .catch(() => {})
    }

    // 尝试从本地存储恢复登录状态
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLogged = true;
      if (!userInfo.inviteCode) {
        wx.cloud.callFunction({
          name: 'template-api',
          data: { action: 'getInviteInfo' }
        }).then((res) => {
          const r = res && res.result
          if (!r || r.code !== 0) return
          const d = r.data || {}
          const inviteCode = d.inviteCode ? String(d.inviteCode) : ''
          const invitedBy = d.invitedBy ? String(d.invitedBy) : ''
          const invitedCount = typeof d.invitedCount === 'number' ? d.invitedCount : 0
          const next = {}
          if (inviteCode) next.inviteCode = inviteCode
          if (invitedBy) next.invitedBy = invitedBy
          if (typeof invitedCount === 'number') next.invitedCount = invitedCount
          if (Object.keys(next).length) this.updateUserInfo(next)
        }).catch(() => {})
      }
    }
  },
  
  // 登录方法
  login() {
    return new Promise((resolve, reject) => {
      // 如果已有用户信息且已登录，直接返回
      if (this.globalData.isLogged && this.globalData.userInfo) {
        resolve(this.globalData.userInfo);
        return;
      }

      wx.showLoading({ title: '登录中...' });
      
      // 1. 调用云函数获取 OpenID
      wx.cloud.callFunction({
        name: 'login',
        data: {},
        success: async res => {
          console.log('[云函数] [login] user openid: ', res.result.openid);
          const openid = res.result.openid;
          
          // 2. 查询云数据库
          const db = wx.cloud.database();
          try {
            const dbRes = await db.collection('users').where({
              _openid: openid
            }).get();

            if (dbRes.data.length > 0) {
              // 2.1 用户已存在
              console.log('用户已存在:', dbRes.data[0]);
              const user = dbRes.data[0];
              this.globalData.userInfo = user;
              this.globalData.isLogged = true;
              wx.setStorageSync('userInfo', user);
              await this.tryBindPendingInvite().catch(() => null);
              wx.hideLoading();
              resolve(user);
            } else {
              // 2.2 用户不存在，需要注册
              console.log('新用户，需完善信息');
              wx.hideLoading();
              // 返回 null 表示需要注册
              resolve(null);
            }
          } catch (err) {
            console.error('查询数据库失败', err);
            wx.hideLoading();
            // 如果集合不存在（错误代码 -502001），或者其他错误，降级处理
            // 这里为了演示，如果查询失败（比如没创建集合），暂时回退到本地模拟逻辑
            // 但为了响应用户“保存到云数据库”的需求，我们最好提示用户
            if (err.errMsg && err.errMsg.includes('Collection not found')) {
               wx.showModal({
                 title: '开发提示',
                 content: '请在云开发控制台创建 "users" 集合',
                 showCancel: false
               });
            }
            reject(err);
          }
        },
        fail: err => {
          console.error('[云函数] [login] 调用失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '登录失败，请检查网络',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  },

  // 注册/保存新用户到云数据库
  async registerUser(userData) {
    try {
      wx.showLoading({ title: '注册中...' });
      
      // 调用云函数创建用户（自动生成唯一8位ID）
      const res = await wx.cloud.callFunction({
        name: 'createUser',
        data: {
          userData: userData
        }
      });

      if (!res.result.success) {
        throw new Error(res.result.message || '注册失败');
      }

      console.log('注册成功', res.result.data);
      const newUser = res.result.data;
      
      // 更新本地状态
      // 注意：云函数返回的 createTime/updateTime 是字符串或特殊对象，本地可能需要转换，但直接存一般没问题
      this.globalData.userInfo = newUser;
      this.globalData.isLogged = true;
      wx.setStorageSync('userInfo', newUser);

      await this.tryBindPendingInvite().catch(() => null);
      
      wx.hideLoading();
      return newUser;
    } catch (err) {
      console.error('注册失败', err);
      wx.hideLoading();
      
      // 错误处理
      wx.showToast({
        title: '注册失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
      throw err;
    }
  },

  // 更新全局数据（例如消费豆子后）
  updateUserInfo(newInfo) {
    this.globalData.userInfo = { ...this.globalData.userInfo, ...newInfo };
    wx.setStorageSync('userInfo', this.globalData.userInfo);
  },

  tryBindPendingInvite() {
    const code = wx.getStorageSync('pendingInviteCode') || ''
    const inv = typeof code === 'string' ? code.trim().toUpperCase() : ''
    if (!inv) return Promise.resolve(false)
    if (!this.globalData.isLogged || !this.globalData.userInfo) return Promise.resolve(false)
    if (this.globalData.userInfo.invitedBy) {
      wx.removeStorageSync('pendingInviteCode')
      return Promise.resolve(false)
    }

    return wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'bindInvite', code: inv }
    }).then((res) => {
      wx.removeStorageSync('pendingInviteCode')
      const r = res && res.result
      if (!r || r.code !== 0) return false
      const coins = r.data && r.data.wallet && typeof r.data.wallet.coins === 'number' ? r.data.wallet.coins : null
      const inviterOpenid = r.data && typeof r.data.inviterOpenid === 'string' ? r.data.inviterOpenid : ''
      const next = {}
      if (typeof coins === 'number') next.coins = coins
      if (inviterOpenid) next.invitedBy = inviterOpenid
      if (Object.keys(next).length) this.updateUserInfo(next)
      return true
    }).catch(() => {
      wx.removeStorageSync('pendingInviteCode')
      return false
    })
  },

  globalData: {
    userInfo: null,
    isLogged: false
  }
})
