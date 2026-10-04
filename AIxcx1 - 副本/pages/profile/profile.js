const app = getApp();

Page({
  data: {
    isLogged: false,
    userInfo: null,
    showAuthModal: false,
    showEditModal: false,
    showCoinsModal: false,
    walletToday: '',
    walletStreak: 0,
    coinLedger: [],
    coinLedgerSkip: 0,
    coinLedgerHasMore: false,
    coinLedgerLoading: false,
    showDailyTasksModal: false,
    dailyTasks: [],
    dailyTaskDay: '',
    showInviteModal: false,
    inviteCode: '',
    invitedBy: '',
    invitedCount: 0,
    inviteInput: '',
    inviterReward: 50,
    inviteeReward: 100,
    inviteRecords: [],
    inviteRecordsSkip: 0,
    inviteRecordsHasMore: false,
    inviteRecordsLoading: false,
    followingCount: 0,
    followerCount: 0,
    registerForm: {
      avatarUrl: '',
      nickName: '',
      phone: ''
    },
    editForm: {
      avatarUrl: '',
      nickName: '',
      bio: ''
    },
    editSaving: false,
    currentTab: 3,
    cursorLeft: '75%',
    isDragging: false
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.windowWidth = sysInfo.windowWidth;
    
    // TabBar Metrics
    this.tabBarWidth = this.windowWidth * 0.9;
    this.tabBarLeft = this.windowWidth * 0.05;
  },

  onShow() {
    this.syncData();
    if (app.globalData.isLogged) {
      this.fetchFollowStats();
      this.fetchWallet();
      this.fetchInviteInfo();
    } else {
      this.setData({ followingCount: 0, followerCount: 0 });
    }

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      tabBar.setData({
        isDragging: true,
        selected: 3,
        cursorLeft: '75%',
        cursorWidth: '120rpx',
        hoverIndex: -1
      });
      wx.nextTick(() => {
        const tb = this.getTabBar && this.getTabBar();
        tb && tb.setData({ isDragging: false });
      });
    }
  },

  // TabBar Interaction
  // Removed custom implementation, now using custom-tab-bar component

  navigateToTab(index) {
    const urls = [
      '/pages/index/index',
      '/pages/mall/mall',
      '/pages/square/square',
      '/pages/profile/profile'
    ];
    
    if (index === 3) return; // Current page

    wx.switchTab({ url: urls[index] });
  },

  goToMyCollections() {
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({
      url: '/pages/my-collections/my-collections'
    });
  },

  goToMyWarehouse() {
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({
      url: '/pages/warehouse/warehouse'
    });
  },

  goToMyOrders() {
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({
      url: '/pages/my-orders/my-orders'
    });
  },

  goToContact() {
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({
      url: '/pages/contact/contact'
    });
  },

  goToMyWorks() {
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({
      url: '/pages/my-works/my-works'
    });
  },

  // switchTab removed, custom-tab-bar handles it internally

  // 同步全局数据
  syncData() {
    this.setData({
      isLogged: app.globalData.isLogged,
      userInfo: app.globalData.userInfo
    });
  },

  fetchFollowStats() {
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'getFollowStats' }
    }).then((res) => {
      const r = res && res.result;
      if (!r || r.code !== 0) throw new Error((r && r.msg) || 'load failed');
      const d = r.data || {};
      this.setData({
        followingCount: typeof d.followingCount === 'number' ? d.followingCount : 0,
        followerCount: typeof d.followerCount === 'number' ? d.followerCount : 0
      });
    }).catch(() => {
      this.setData({ followingCount: 0, followerCount: 0 });
    });
  },

  fetchWallet() {
    if (!app.globalData.isLogged) return Promise.resolve(false)
    return wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'getWallet' }
    }).then((res) => {
      const r = res && res.result
      if (!r || r.code !== 0) return false
      const d = r.data || {}
      const coins = typeof d.coins === 'number' ? d.coins : 0
      const energy = typeof d.energy === 'number' ? d.energy : 0
      const today = d.today ? String(d.today) : ''
      const streak = typeof d.checkinStreak === 'number' ? d.checkinStreak : 0
      app.updateUserInfo({ coins, energy })
      this.syncData()
      this.setData({ walletToday: today, walletStreak: streak })
      return true
    }).catch(() => false)
  },

  openCoins() {
    if (!this.data.isLogged) {
      this.onLoginTap()
      return
    }
    wx.vibrateShort({ type: 'light' })
    this.setData({
      showCoinsModal: true,
      showDailyTasksModal: false,
      showInviteModal: false
    })
    this.fetchWallet()
    this.fetchCoinLedger(true)
  },

  closeCoins() {
    this.setData({ showCoinsModal: false })
  },

  fetchCoinLedger(reset) {
    if (!app.globalData.isLogged) return Promise.resolve(false)
    const isReset = !!reset
    if (this.data.coinLedgerLoading) return Promise.resolve(false)
    const skip = isReset ? 0 : (typeof this.data.coinLedgerSkip === 'number' ? this.data.coinLedgerSkip : 0)
    const limit = 20
    this.setData({ coinLedgerLoading: true })
    return wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'getCoinLedger', skip, limit }
    }).then((res) => {
      const r = res && res.result
      if (!r) {
        this.setData({ coinLedgerLoading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
        return false
      }
      if (r.code === 401) {
        this.setData({ coinLedgerLoading: false })
        wx.showToast({ title: '请先登录', icon: 'none' })
        return false
      }
      if (r.code !== 0) {
        this.setData({ coinLedgerLoading: false })
        wx.showToast({ title: r.msg ? String(r.msg) : '加载失败', icon: 'none' })
        return false
      }
      const d = r.data || {}
      const list = Array.isArray(d.list) ? d.list : []
      const nextSkip = typeof d.nextSkip === 'number' ? d.nextSkip : (skip + list.length)
      const hasMore = !!d.hasMore
      const merged = isReset ? list : (this.data.coinLedger || []).concat(list)
      this.setData({
        coinLedger: merged,
        coinLedgerSkip: nextSkip,
        coinLedgerHasMore: hasMore,
        coinLedgerLoading: false
      })
      return true
    }).catch(() => {
      this.setData({ coinLedgerLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      return false
    })
  },

  loadMoreCoinLedger() {
    this.fetchCoinLedger(false)
  },

  onCheckinTap() {
    if (!this.data.isLogged) {
      this.onLoginTap()
      return
    }
    wx.vibrateShort({ type: 'light' })
    wx.showLoading({ title: '签到中...' })
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'dailyCheckin' }
    }).then((res) => {
      wx.hideLoading()
      const r = res && res.result
      if (!r) throw new Error('签到失败')
      if (r.code === 10002) {
        wx.showToast({ title: '今天已签到', icon: 'none' })
        return
      }
      if (r.code !== 0) throw new Error(r.msg || '签到失败')
      const d = r.data || {}
      const coins = typeof d.coins === 'number' ? d.coins : null
      const energy = typeof d.energy === 'number' ? d.energy : null
      const rewardCoins = typeof d.rewardCoins === 'number' ? d.rewardCoins : 0
      const rewardEnergy = typeof d.rewardEnergy === 'number' ? d.rewardEnergy : 0
      const streak = typeof d.streak === 'number' ? d.streak : 0
      const bonusCoins = typeof d.bonusCoins === 'number' ? d.bonusCoins : 0
      const next = {}
      if (typeof coins === 'number') next.coins = coins
      if (typeof energy === 'number') next.energy = energy
      app.updateUserInfo(next)
      this.syncData()
      if (this.data.showCoinsModal) {
        this.fetchWallet()
        this.fetchCoinLedger(true)
      }
      const extra = rewardEnergy > 0 ? `，体力+${rewardEnergy}` : ''
      const bonus = bonusCoins > 0 ? `（连签奖励+${bonusCoins}）` : ''
      const s = streak > 0 ? ` 连签${streak}天` : ''
      wx.showToast({ title: `豆豆+${rewardCoins}${bonus}${extra}${s}`, icon: 'none' })
    }).catch((e) => {
      wx.hideLoading()
      wx.showToast({ title: (e && e.message) ? e.message : '签到失败', icon: 'none' })
    })
  },

  openDailyTasks() {
    if (!this.data.isLogged) {
      this.onLoginTap()
      return
    }
    wx.vibrateShort({ type: 'light' })
    this.setData({ showDailyTasksModal: true, showCoinsModal: false })
    this.fetchDailyTasks()
  },

  closeDailyTasks() {
    this.setData({ showDailyTasksModal: false })
  },

  fetchDailyTasks() {
    if (!app.globalData.isLogged) return Promise.resolve(false)
    wx.showLoading({ title: '加载中...' })
    return wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'getDailyTasks' }
    }).then((res) => {
      wx.hideLoading()
      const r = res && res.result
      if (!r || r.code !== 0) throw new Error((r && r.msg) || '加载失败')
      const d = r.data || {}
      this.setData({
        dailyTaskDay: d.day || '',
        dailyTasks: Array.isArray(d.tasks) ? d.tasks : []
      })
      return true
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
      return false
    })
  },

  onClaimDailyTask(e) {
    const taskId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : ''
    if (!taskId) return
    wx.vibrateShort({ type: 'light' })
    wx.showLoading({ title: '领取中...' })
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'claimDailyTask', taskId }
    }).then((res) => {
      wx.hideLoading()
      const r = res && res.result
      if (!r) throw new Error('领取失败')
      if (r.code === 10003) {
        wx.showToast({ title: '任务未完成', icon: 'none' })
        return
      }
      if (r.code === 10004) {
        wx.showToast({ title: '已领取', icon: 'none' })
        return
      }
      if (r.code !== 0) throw new Error(r.msg || '领取失败')
      const d = r.data || {}
      const coins = typeof d.coins === 'number' ? d.coins : null
      if (typeof coins === 'number') app.updateUserInfo({ coins })
      this.syncData()
      const rewardCoins = typeof d.rewardCoins === 'number' ? d.rewardCoins : 0
      if (rewardCoins > 0) wx.showToast({ title: `领取成功 +${rewardCoins}`, icon: 'none' })
      this.fetchDailyTasks()
    }).catch((e2) => {
      wx.hideLoading()
      wx.showToast({ title: (e2 && e2.message) ? e2.message : '领取失败', icon: 'none' })
    })
  },

  openInvite() {
    if (!this.data.isLogged) {
      this.onLoginTap()
      return
    }
    wx.vibrateShort({ type: 'light' })
    this.setData({ showInviteModal: true, showCoinsModal: false })
    this.fetchInviteInfo()
    this.fetchInviteRecords(true)
  },

  closeInvite() {
    this.setData({ showInviteModal: false })
  },

  fetchInviteInfo() {
    if (!app.globalData.isLogged) return Promise.resolve(false)
    return wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'getInviteInfo' }
    }).then((res) => {
      const r = res && res.result
      if (!r || r.code !== 0) return false
      const d = r.data || {}
      const inviteCode = d.inviteCode ? String(d.inviteCode) : ''
      const invitedBy = d.invitedBy ? String(d.invitedBy) : ''
      const invitedCount = typeof d.invitedCount === 'number' ? d.invitedCount : 0
      const inviterReward = typeof d.inviterReward === 'number' ? d.inviterReward : this.data.inviterReward
      const inviteeReward = typeof d.inviteeReward === 'number' ? d.inviteeReward : this.data.inviteeReward
      const next = {}
      if (inviteCode) next.inviteCode = inviteCode
      if (invitedBy) next.invitedBy = invitedBy
      if (typeof invitedCount === 'number') next.invitedCount = invitedCount
      if (Object.keys(next).length) app.updateUserInfo(next)
      this.setData({ inviteCode, invitedBy, invitedCount, inviterReward, inviteeReward })
      return true
    }).catch(() => false)
  },

  fetchInviteRecords(reset) {
    if (!app.globalData.isLogged) return Promise.resolve(false)
    if (this.data.inviteRecordsLoading) return Promise.resolve(false)
    const skip = reset ? 0 : (typeof this.data.inviteRecordsSkip === 'number' ? this.data.inviteRecordsSkip : 0)
    const limit = 20
    if (reset) {
      this.setData({ inviteRecords: [], inviteRecordsSkip: 0, inviteRecordsHasMore: false })
    }
    this.setData({ inviteRecordsLoading: true })
    return wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'getInviteRecords', skip, limit }
    }).then((res) => {
      const r = res && res.result
      if (!r || r.code !== 0) throw new Error((r && r.msg) || '加载失败')
      const d = r.data || {}
      const list = Array.isArray(d.list) ? d.list : []
      const hasMore = !!d.hasMore
      const nextSkip = typeof d.nextSkip === 'number' ? d.nextSkip : (skip + list.length)
      this.setData({
        inviteRecords: reset ? list : [...this.data.inviteRecords, ...list],
        inviteRecordsHasMore: hasMore,
        inviteRecordsSkip: nextSkip,
        inviteRecordsLoading: false
      })
      return true
    }).catch(() => {
      this.setData({ inviteRecordsLoading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
      return false
    })
  },

  loadMoreInviteRecords() {
    this.fetchInviteRecords(false)
  },

  copyInviteCode() {
    const code = this.data.inviteCode ? String(this.data.inviteCode) : ''
    if (!code) return
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    })
  },

  onInviteInput(e) {
    const v = e && e.detail ? String(e.detail.value || '') : ''
    this.setData({ inviteInput: v.trim().toUpperCase().slice(0, 10) })
  },

  bindInvite() {
    const code = this.data.inviteInput ? String(this.data.inviteInput).trim().toUpperCase() : ''
    if (!code) {
      wx.showToast({ title: '请填写邀请码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '绑定中...' })
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'bindInvite', code }
    }).then((res) => {
      wx.hideLoading()
      const r = res && res.result
      if (!r) throw new Error('绑定失败')
      if (r.code === 10005) {
        wx.showToast({ title: '已绑定', icon: 'none' })
        this.fetchInviteInfo()
        return
      }
      if (r.code === 10006) {
        wx.showToast({ title: '不能填自己邀请码', icon: 'none' })
        return
      }
      if (r.code === 10007) {
        wx.showToast({ title: '邀请码无效', icon: 'none' })
        return
      }
      if (r.code !== 0) throw new Error(r.msg || '绑定失败')
      const d = r.data || {}
      const inviterOpenid = d.inviterOpenid ? String(d.inviterOpenid) : ''
      const walletCoins = d.wallet && typeof d.wallet.coins === 'number' ? d.wallet.coins : null
      const inviteeReward = typeof d.inviteeReward === 'number' ? d.inviteeReward : 0
      const next = {}
      if (inviterOpenid) next.invitedBy = inviterOpenid
      if (typeof walletCoins === 'number') next.coins = walletCoins
      if (Object.keys(next).length) app.updateUserInfo(next)
      this.syncData()
      this.setData({ invitedBy: inviterOpenid, inviteInput: '' })
      wx.showToast({ title: `绑定成功 +${inviteeReward}`, icon: 'none' })
      this.fetchInviteInfo()
    }).catch((e2) => {
      wx.hideLoading()
      wx.showToast({ title: (e2 && e2.message) ? e2.message : '绑定失败', icon: 'none' })
    })
  },

  goToFollowList(e) {
    if (!this.data.isLogged) {
      this.onLoginTap();
      return;
    }
    const type = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.type ? e.currentTarget.dataset.type : 'following';
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({
      url: `/pages/follow-list/follow-list?type=${encodeURIComponent(type)}`
    });
  },

  // 登录逻辑
  onLoginTap() {
    // loading 由 app.login() 内部处理
    app.login().then(user => {
      if (user) {
        wx.showToast({ title: '登录成功', icon: 'success' });
        this.syncData();
        this.fetchFollowStats();
        this.fetchWallet();
        this.fetchInviteInfo();
      } else {
        // 用户不存在，显示注册弹窗
        // 不预设信息，强制用户手动填写以触发校验
        this.setData({
          showAuthModal: true,
          'registerForm.avatarUrl': '',
          'registerForm.nickName': ''
        });
      }
    }).catch(err => {
      console.error('登录流程中断', err);
    });
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      'registerForm.avatarUrl': avatarUrl
    });
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({
      'registerForm.nickName': e.detail.value
    });
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({
      'registerForm.phone': e.detail.value
    });
  },

  // 获取微信手机号
  onGetPhoneNumber(e) {
    if (e.detail.code) {
      wx.showLoading({ title: '获取中...' });
      
      // 调用云函数换取手机号
      wx.cloud.callFunction({
        name: 'getMobile',
        data: {
          code: e.detail.code
        },
        success: res => {
          wx.hideLoading();
          if (res.result && res.result.phoneInfo && res.result.phoneInfo.phoneNumber) {
            this.setData({
              'registerForm.phone': res.result.phoneInfo.phoneNumber
            });
            wx.showToast({ title: '获取成功', icon: 'success' });
          } else {
            console.error('获取手机号失败:', res);
            wx.showModal({
              title: '获取失败',
              content: '无法获取手机号，请检查小程序认证状态（需非个人主体）。',
              showCancel: false
            });
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('调用云函数失败:', err);
          wx.showModal({
            title: '调用失败',
            content: '请确认 "getMobile" 云函数已部署 (右键上传)。',
            showCancel: false
          });
        }
      });
    } else {
      // 用户拒绝或其他错误
      wx.showToast({
        title: '未授权获取',
        icon: 'none'
      });
    }
  },

  // 关闭弹窗
  onCloseAuthModal() {
    this.setData({ showAuthModal: false });
  },

  onEditTap() {
    if (!this.data.isLogged || !this.data.userInfo) return;
    const u = this.data.userInfo || {};
    this.setData({
      showEditModal: true,
      editForm: {
        avatarUrl: u.avatarUrl || '',
        nickName: u.nickName || '',
        bio: u.bio || ''
      }
    });
  },

  onCloseEditModal() {
    if (this.data.editSaving) return;
    this.setData({ showEditModal: false });
  },

  onEditChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      'editForm.avatarUrl': avatarUrl
    });
  },

  onEditNicknameInput(e) {
    this.setData({
      'editForm.nickName': e.detail.value
    });
  },

  onEditBioInput(e) {
    this.setData({
      'editForm.bio': e.detail.value
    });
  },

  async onEditSave() {
    if (!this.data.isLogged) return;
    if (this.data.editSaving) return;

    const nickName = String(this.data.editForm.nickName || '').trim();
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'error' });
      return;
    }

    const bio = String(this.data.editForm.bio || '').trim();
    const avatarUrl = String(this.data.editForm.avatarUrl || '');

    this.setData({ editSaving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      let finalAvatarUrl = avatarUrl;
      if (finalAvatarUrl && (finalAvatarUrl.startsWith('http://tmp') || finalAvatarUrl.startsWith('wxfile://'))) {
        const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: finalAvatarUrl
        });
        finalAvatarUrl = uploadRes.fileID;
      }

      const payload = {
        action: 'updateMyProfile',
        nickName,
        bio,
        avatarUrl: finalAvatarUrl
      };

      let savedUser = null;
      try {
        const res = await wx.cloud.callFunction({
          name: 'template-api',
          data: payload
        });
        const r = res && res.result;
        if (!r || r.code !== 0) throw new Error((r && r.msg) || 'save failed');
        savedUser = (r.data && r.data.user) ? r.data.user : null;
      } catch (e) {
        const msg = e && (e.errMsg || e.message) ? (e.errMsg || e.message) : '';
        if (!msg.includes('Unknown action')) throw e;

        const u = app.globalData.userInfo || {};
        const userId = u._id;
        if (!userId) throw e;
        const openid = u._openid;

        const db = wx.cloud.database();
        const updateData = {
          nickName,
          bio,
          updateTime: db.serverDate()
        };
        if (finalAvatarUrl) updateData.avatarUrl = finalAvatarUrl;

        await db.collection('users').doc(userId).update({ data: updateData });
        if (openid) {
          const templateUpdate = {
            author: nickName,
            updateTime: db.serverDate(),
            ['userInfo.nickName']: nickName
          };
          if (finalAvatarUrl) templateUpdate['userInfo.avatarUrl'] = finalAvatarUrl;
          await db.collection('templates').where({ _openid: openid }).update({ data: templateUpdate }).catch(() => ({}));

          const postUpdate = {
            author: nickName,
            updateTime: db.serverDate()
          };
          if (finalAvatarUrl) postUpdate.authorAvatar = finalAvatarUrl;
          await db.collection('community_posts').where({ _openid: openid }).update({ data: postUpdate }).catch(() => ({}));
        }
        const userRes = await db.collection('users').doc(userId).get();
        savedUser = userRes && userRes.data ? userRes.data : null;
      }

      const nextUser = savedUser || { nickName, bio, avatarUrl: finalAvatarUrl };
      app.updateUserInfo(nextUser);
      this.syncData();
      this.setData({ showEditModal: false });
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      const msg = err && (err.errMsg || err.message) ? (err.errMsg || err.message) : '保存失败';
      if (msg.includes('Unknown action')) {
        wx.showModal({
          title: '云函数未更新',
          content: '保存接口尚未部署到云端。请在微信开发者工具中右键 cloudfunctions/template-api -> 上传并部署，然后重试。',
          showCancel: false
        });
        return;
      }
      wx.showToast({ title: msg, icon: 'none' });
    } finally {
      this.setData({ editSaving: false });
    }
  },

  // 提交注册
  async onRegisterSubmit() {
    const { avatarUrl, nickName, phone } = this.data.registerForm;
    
    // 1. 必填项单独校验与提醒
    if (!avatarUrl) {
      wx.showToast({
        title: '请选择头像',
        icon: 'error' // 使用 error 图标更醒目
      });
      return;
    }
    
    if (!nickName || nickName.trim() === '') {
      wx.showToast({
        title: '请填写昵称',
        icon: 'error'
      });
      return;
    }

    if (!phone) {
      wx.showToast({
        title: '请授权手机号',
        icon: 'error'
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      let finalAvatarUrl = avatarUrl;

      // 如果是临时文件（通常以 http://tmp 或 wxfile:// 开头），则上传到云存储
      if (avatarUrl.startsWith('http://tmp') || avatarUrl.startsWith('wxfile://')) {
        const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: avatarUrl, // 临时文件路径
        });
        finalAvatarUrl = uploadRes.fileID;
        console.log('头像上传成功:', finalAvatarUrl);
      }
      
      // 构造用户数据
      const userData = {
        avatarUrl: finalAvatarUrl,
        nickName,
        phone: phone || '' // 手机号选填
      };

      await app.registerUser(userData);
      
      wx.hideLoading();
      this.setData({ showAuthModal: false });
      this.syncData();
      this.fetchWallet();
      this.fetchInviteInfo();
      wx.showToast({ title: '注册成功', icon: 'success' });

    } catch (err) {
      console.error('注册流程失败', err);
      wx.hideLoading();
      
      // 提取错误信息
      const errMsg = err.errMsg || err.message || JSON.stringify(err);
      
      // 针对集合不存在的特定错误进行提示
      if (errMsg.includes('Collection not found') || errMsg.includes('not exist')) {
        wx.showModal({
          title: '配置缺失',
          content: '请在云开发控制台创建 "users" 集合。\n(Database -> + -> 集合名称: users)',
          showCancel: false
        });
      } else {
        // 其他错误显示详细信息
        wx.showModal({
          title: '注册失败',
          content: `错误信息: ${errMsg}\n\n请截图联系开发者或检查网络/数据库权限。`,
          showCancel: false
        });
      }
    }
  },

  // 退出登录
  onLogoutTap() {
    wx.vibrateShort({ type: 'medium' });
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.userInfo = null;
          app.globalData.isLogged = false;
          wx.removeStorageSync('userInfo');
          this.syncData();
        }
      }
    });
  }
})
