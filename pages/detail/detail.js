const app = getApp();
const db = wx.cloud.database();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 1. 图纸模型 (Product Schema)
    id: '',
    title: '',
    imageUrl: '',
    description: '',
    tags: [],
    author: {
      nickname: '',
      avatar: '/images/default-avatar.png'
    },
    authorOpenid: '',
    board: null,
    spec: null,
    stats: {
      likes: 0,
      collects: 0,
      views: 0
    },

    // 2. 交互状态
    isLiked: false,
    isCollected: false,
    isCollecting: false, // 收藏请求锁
    isFollowingAuthor: false,
    followLoading: false,
    authorFollowerCount: 0,
    statusBarHeight: 20,
    heroStyle: '',
    recommendWorks: [],
    loadingRecommend: false,
    
    // 4. 评论系统 (Comment System)
    commentContent: '',
    commentImage: '', // 当前选中的评论配图
    activeTab: 0, // 0:最新, 1:最热
    comments: [],
    allComments: [], // 原始评论（按排序方式派生 comments）
    
    // 5. 粒子特效
    particleList: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight + 4
    });

    if (options.id) {
      this.setData({ id: options.id });
      this.fetchWorkDetails(options.id);
      this.fetchComments(options.id);
      this.fetchUserStatus(options.id);
    }
  },

  // 获取用户对该作品的状态 (是否收藏)
  fetchUserStatus(id) {
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'getUserStatus',
        templateId: id
      }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        this.setData({
          isCollected: res.result.data.isCollected
        });
      }
    }).catch(err => {
      console.error('获取用户状态失败', err);
    });
  },

  // 获取作品详情
  fetchWorkDetails(id) {
    wx.showLoading({ title: '加载中...' });

    // 把云端数据映射到页面字段（source: 'template' | 'post'）
    const applyData = (data, source) => {
      if (!data) {
        wx.hideLoading();
        wx.showToast({ title: '内容不存在或已删除', icon: 'none' });
        return;
      }

      let authorObj = { nickname: '未知作者', avatar: '/images/default-avatar.png' };
      let title = '';
      let imageUrl = '';
      let description = '暂无描述';
      let tags = [];
      let board = null;
      let spec = null;
      let likes = 0;

      if (source === 'post') {
        // 社区帖（community_posts）：标题=content，点赞数在 likes 字段
        title = data.content || '未命名作品';
        imageUrl = data.imageUrl || '';
        description = data.description || '暂无描述';
        authorObj.nickname = data.author || '未知作者';
        authorObj.avatar = data.authorAvatar || '/images/default-avatar.png';
        likes = data.likes || 0;
        if (Array.isArray(data.tags)) tags = data.tags.slice();
      } else {
        // 模板（templates）
        if (data.userInfo && (data.userInfo.avatarUrl || data.userInfo.nickName)) {
          authorObj.nickname = data.userInfo.nickName || data.author || '未知作者';
          authorObj.avatar = data.userInfo.avatarUrl || '/images/default-avatar.png';
        } else if (typeof data.author === 'string') {
          authorObj.nickname = data.author;
        } else if (typeof data.author === 'object') {
          authorObj = data.author;
        }
        if (data.difficulty) tags.push(`难度: ${data.difficulty}`);
        if (data.size) tags.push(data.size);
        if (data.time) tags.push(data.time);
        if (data.tags && Array.isArray(data.tags)) tags = tags.concat(data.tags);
        title = data.title;
        imageUrl = data.imageUrl;
        description = data.description || '暂无描述';
        board = data.board || null;
        spec = data.spec || null;
        likes = data.heat || data.likeCount || 0;
      }

      this.setData({
        title,
        imageUrl,
        description,
        tags,
        author: authorObj,
        authorOpenid: data._openid || (data.userInfo && data.userInfo.openid) || '',
        board,
        spec,
        stats: {
          likes,
          collects: 0,
          views: 0
        }
      });
      wx.hideLoading();
      this.fetchAuthorProfile();
      this.fetchRecommendations();
    };

    // 先读模板；读不到（社区帖没有对应模板）再兜底读 community_posts，确保页面一定能打开
    db.collection('templates').doc(id).get()
      .then(res => applyData(res.data, 'template'))
      .catch(() => {
        db.collection('community_posts').doc(id).get()
          .then(res => applyData(res.data, 'post'))
          .catch(err => {
            console.error('获取作品详情失败', err);
            wx.hideLoading();
            wx.showToast({ title: '加载失败', icon: 'none' });
          });
      });
  },

  fetchAuthorProfile() {
    const openid = this.data.authorOpenid;
    if (!openid) return;
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'getUserProfile', openid }
    }).then((res) => {
      const r = res && res.result;
      if (!r || r.code !== 0) return;
      const p = r.data || {};
      this.setData({
        isFollowingAuthor: !!p.isFollowing,
        authorFollowerCount: typeof p.followerCount === 'number' ? p.followerCount : 0
      });
    }).catch(() => {});
  },

  goToAuthor() {
    const openid = this.data.authorOpenid;
    if (!openid) return;
    wx.navigateTo({
      url: `/pages/user-profile/user-profile?openid=${encodeURIComponent(openid)}`
    });
  },

  onToggleFollowAuthor() {
    if (!app.globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再关注',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' });
        }
      });
      return;
    }
    if (this.data.followLoading) return;
    const toOpenid = this.data.authorOpenid;
    if (!toOpenid) return;
    this.setData({ followLoading: true });
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'toggleFollow', toOpenid }
    }).then((res) => {
      const r = res && res.result;
      if (!r || r.code !== 0) throw new Error((r && r.msg) || 'toggle failed');
      this.setData({
        isFollowingAuthor: !!(r.data && r.data.isFollowing),
        authorFollowerCount: (r.data && typeof r.data.followerCount === 'number') ? r.data.followerCount : this.data.authorFollowerCount
      });
    }).catch((e) => {
      const msg = e && (e.errMsg || e.message) ? String(e.errMsg || e.message) : '';
      const isMissingCol = msg.includes('DATABASE_COLLECTION_NOT_EXIST') || msg.includes('db or table not exist') || msg.includes('user_follows');
      if (isMissingCol) {
        wx.showModal({
          title: '关注不可用',
          content: '你的云数据库缺少 user_follows 集合，所以无法关注。\n\n请在云开发控制台 -> 数据库 -> 集合管理 中创建集合：user_follows\n创建后再试即可。',
          showCancel: false
        });
        return;
      }
      wx.showToast({ title: msg || '操作失败', icon: 'none' });
    }).finally(() => {
      this.setData({ followLoading: false });
    });
  },

  // 获取评论列表
  fetchComments(id) {
    db.collection('comments').where({
      templateId: id
    }).orderBy('createTime', 'desc').get().then(async res => {
      const rawComments = res.data;
      
      // 提取所有评论者的 _openid (去重)
      const openids = [...new Set(rawComments.map(c => c._openid))].filter(id => id);

      // 建立 openid -> userInfo 的映射
      let userMap = {};
      if (openids.length > 0) {
        try {
          // 批量查询 users 集合
          const userRes = await db.collection('users').where({
            _openid: db.command.in(openids)
          }).get();
          
          userRes.data.forEach(u => {
            userMap[u._openid] = {
              nickname: u.nickName || '匿名用户',
              avatar: u.avatarUrl || '/images/default-avatar.png'
            };
          });
        } catch (err) {
          console.error('获取用户信息失败', err);
        }
      }

      // 格式化评论数据，合并用户信息
      const comments = rawComments.map(item => {
        // 优先使用 users 表里的信息，其次使用评论里自带的，最后使用默认
        const dbUser = userMap[item._openid];
        const localUser = item.userInfo || {};
        
        const displayUser = {
          nickname: dbUser?.nickname || localUser.nickname || '匿名用户',
          avatar: dbUser?.avatar || localUser.avatar || '/images/default-avatar.png'
        };

        // 简单处理时间格式
        let timeStr = '刚刚';
        if (item.createTime) {
           const date = new Date(item.createTime);
           timeStr = `${date.getMonth() + 1}-${date.getDate()}`;
        }

        return {
          ...item,
          userInfo: displayUser, // 覆盖 userInfo
          image: (item.images && item.images.length > 0) ? item.images[0] : '',
          createTime: timeStr
        };
      });

      this.setData({
        comments: comments,
        allComments: comments
      }, () => this._applyCommentSort());
    }).catch(err => {
      console.error('获取评论失败', err);
    });
  },

  // 按当前 tab 对评论排序：最新=创建时间倒序（云端已排好），最热=点赞数倒序
  _applyCommentSort() {
    const list = (this.data.allComments || []).slice();
    if (this.data.activeTab === 1) {
      list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    this.setData({ comments: list });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 预览大图
  previewImage() {
    if (this.data.imageUrl) {
      wx.previewImage({
        current: this.data.imageUrl,
        urls: [this.data.imageUrl]
      });
    }
  },

  previewCommentImage(e) {
    const src = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.src : '';
    if (!src) return;
    wx.previewImage({ current: src, urls: [src] });
  },

  // 视差滚动监听
  onPageScroll(e) {
    const scrollTop = e.scrollTop;
    if (scrollTop < 0) return;
    const translateY = scrollTop * 0.5;
    this.setData({
      heroStyle: `transform: translateY(${translateY}px);`
    });
  },

  // --- 评论交互逻辑 ---

  // 选择评论图片
  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          commentImage: res.tempFiles[0].tempFilePath
        });
      }
    });
  },

  // 删除已选图片
  onDeleteImage() {
    this.setData({ commentImage: '' });
  },

  // 输入监听
  onInput(e) {
    this.setData({ commentContent: e.detail.value });
  },

  // 提交评论
  onSubmitComment() {
    const { commentContent, commentImage, id } = this.data;

    // 校验：文本和图片不能同时为空
    if (!commentContent.trim() && !commentImage) {
      wx.showToast({
        title: '请输入评论内容或上传图片',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    // 内容安全审核
    this._checkContentSecurity(commentContent, commentImage).then(() => {
      // 审核通过，继续提交
      this._doSubmitComment(commentContent, commentImage, id);
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({
        title: err.message || '内容含有违规信息，请修改',
        icon: 'none'
      });
    });
  },

  // 内容安全审核
  _checkContentSecurity(text, imageFilePath) {
    return new Promise(async (resolve, reject) => {
      try {
        // 1. 审核文本内容
        if (text && text.trim()) {
          const textCheckRes = await wx.cloud.callFunction({
            name: 'security-api',
            data: {
              action: 'msgSecCheck',
              content: text.trim(),
              scene: 2,  // 评论场景
              openid: app.globalData.userInfo && app.globalData.userInfo.openid
            }
          });

          if (textCheckRes.result && textCheckRes.result.errCode !== 0) {
            reject({ message: textCheckRes.result.errMsg || '评论内容含有违规信息' });
            return;
          }
        }

        // 2. 审核图片内容（异步审核，提交后继续）
        if (imageFilePath) {
          // 先上传图片到云存储获取临时链接
          const cloudPath = `comment-images/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
          const uploadRes = await new Promise((resolveUpload, rejectUpload) => {
            wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: imageFilePath,
              success: res => resolveUpload(res),
              fail: err => rejectUpload(err)
            });
          });

          // 获取临时链接
          const urlRes = await wx.cloud.getTempFileURL({
            fileList: [uploadRes.fileID]
          });

          if (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) {
            const mediaUrl = urlRes.fileList[0].tempFileURL;

            // 提交图片审核（异步）
            await wx.cloud.callFunction({
              name: 'security-api',
              data: {
                action: 'mediaCheck',
                mediaUrl: mediaUrl,
                mediaType: 2,  // 图片
                scene: 2,  // 评论场景
                openid: app.globalData.userInfo && app.globalData.userInfo.openid
              }
            });
          }
        }

        resolve();
      } catch (err) {
        console.error('内容安全审核失败', err);
        // 审核接口失败时，允许通过（可选）
        resolve();
      }
    });
  },

  // 执行评论提交
  _doSubmitComment(commentContent, commentImage, id) {
    // 定义提交逻辑
    const submitToDB = (fileID = '') => {
      db.collection('comments').add({
        data: {
          templateId: id,
          content: commentContent,
          images: fileID ? [fileID] : [],
          // 如果 app.globalData.userInfo 存在则使用，否则使用默认
          userInfo: app.globalData.userInfo || { 
            nickname: '我 (当前用户)', 
            avatar: '/images/default-avatar.png' 
          },
          createTime: db.serverDate(),
          likes: 0
        }
      }).then(res => {
        wx.hideLoading();
        wx.showToast({
          title: '评价成功',
          icon: 'success'
        });
        wx.vibrateShort({ type: 'medium' });

        // 清空输入并重新获取评论列表
        this.setData({
          commentContent: '',
          commentImage: ''
        });
        this.fetchComments(id);

      }).catch(err => {
        wx.hideLoading();
        console.error('评论提交失败', err);
        wx.showToast({ title: '提交失败', icon: 'none' });
      });
    };

    // 如果有图片，先上传图片
    if (commentImage) {
      const cloudPath = `comment-images/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: commentImage,
        success: res => {
          submitToDB(res.fileID);
        },
        fail: err => {
          wx.hideLoading();
          console.error('图片上传失败', err);
          wx.showToast({ title: '图片上传失败', icon: 'none' });
        }
      });
    } else {
      submitToDB();
    }
  },

  // 切换评论排序
  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.activeTab) return;
    this.setData({ activeTab: index }, () => this._applyCommentSort());
  },

  // 底部「评论」按钮：滚动到评论区
  focusComment() {
    wx.pageScrollTo({ selector: '.comment-section', duration: 300 });
  },

  // --- 底部栏交互 ---

  onLike(e) {
    // 检查登录状态
    if (!app.globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再点赞',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }

    // 连续点赞模式：不再切换 isLiked 状态，而是每次点击都增加
    const newLikes = this.data.stats.likes + 1;

    this.setData({
      isLiked: true, // 点赞后高亮
      'stats.likes': newLikes
    });
    wx.vibrateShort({ type: 'medium' });

    // --- 粒子特效逻辑 ---
    const emojis = ['❤️', '✨', '🌸', '🐰', '🐱', '🍭', '🎀', '🦄', '🍓', '🔥'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    // 获取点击位置
    let touchX = 0;
    let touchY = 0;
    if (e && e.touches && e.touches.length > 0) {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    } else if (e && e.detail && e.detail.x) {
      touchX = e.detail.x;
      touchY = e.detail.y;
    } else {
       // Fallback if no touch info (e.g. programmatically called)
       // Approximate position: bottom right area
       const sysInfo = wx.getSystemInfoSync();
       touchX = sysInfo.windowWidth * 0.7; 
       touchY = sysInfo.windowHeight - 80;
    }

    // 随机参数生成 (X轴偏移、动画时长)
    // X轴偏移范围扩大到 +/- 80rpx
    const randomX = (Math.random() - 0.5) * 160; 
    
    // 随机起跳高度 (Y轴)：范围 -150rpx 到 -450rpx
    const jumpHeight = -150 - Math.random() * 300;
    
    // 随机旋转：方向与X偏移一致 (模拟滚动效果)，范围 +/- 360deg 到 720deg
    const direction = randomX > 0 ? 1 : -1;
    const rotation = direction * (360 + Math.random() * 360);

    // 动画时长增加到 1.5s - 2.5s，确保粒子有足够时间掉出屏幕
    const duration = 1.5 + Math.random() * 1.0;
    
    const newParticle = {
      id: Date.now() + Math.random(),
      emoji: randomEmoji,
      // 使用 CSS 变量传递动态参数
      style: `left: ${touchX}px; top: ${touchY}px; --tx: ${randomX}rpx; --ty: ${jumpHeight}rpx; --rot: ${rotation}deg; --duration: ${duration}s;`
    };

    const list = this.data.particleList;
    list.push(newParticle);
    this.setData({ particleList: list });

    // 自动清理 (时长稍微设长一点以确保动画播完)
    setTimeout(() => {
      const currentList = this.data.particleList;
      const index = currentList.findIndex(p => p.id === newParticle.id);
      if (index !== -1) {
        currentList.splice(index, 1);
        this.setData({ particleList: currentList });
      }
    }, duration * 1000 + 100);

    // --- 同步数据库 ---
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'likeTemplate', // 使用 likeTemplate 接口 (支持每日限额)
        templateId: this.data.id
      }
    }).then(res => {
      if (res.result && res.result.code === 1001) {
        // 每日点赞额度用完（每天最多 100 个作品）
        this.setData({ 'stats.likes': newLikes - 1, isLiked: false });
        wx.showToast({ title: res.result.msg || '这个作品你今天已经点满 100 次啦', icon: 'none', duration: 2000 });
        return;
      }
      if (res.result && res.result.code !== 0) {
        throw new Error(res.result.msg || 'Cloud function error');
      }
    }).catch(err => {
      console.error('点赞同步失败', err);
      // 回滚本地状态
      this.setData({
        'stats.likes': newLikes - 1
      });
    });
  },

  onCollect() {
    // 防止快速点击
    if (this.data.isCollecting) return;
    
    // 检查参数
    if (!this.data.id) {
        wx.showToast({ title: '参数错误: ID为空', icon: 'none' });
        return;
    }

    const isCollected = !this.data.isCollected;
    // 收藏数暂不显示或暂无字段，仅切换状态
    
    this.setData({
      isCollected,
      isCollecting: true
    });
    wx.vibrateShort({ type: 'light' });

    // 同步到数据库
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'toggleCollect',
        templateId: this.data.id
      }
    }).then(res => {
      this.setData({ isCollecting: false });
      if (res.result && res.result.code === 0) {
        // 确保状态一致
        this.setData({
          isCollected: res.result.data.isCollected
        });
        wx.showToast({
           title: res.result.data.isCollected ? '已收藏' : '已取消收藏',
           icon: 'none'
        });
      } else {
        throw new Error((res.result && res.result.msg) || 'Cloud function error');
      }
    }).catch(err => {
      console.error('收藏同步失败', err);
      // 回滚
      this.setData({
        isCollected: !isCollected,
        isCollecting: false
      });
      wx.showToast({ title: '失败: ' + (err.message || '未知错误'), icon: 'none' });
    });
  },

  fetchRecommendations() {
    const id = this.data.id;
    if (!id || this.data.loadingRecommend) return;

    const board = this.data.board || {};
    const spec = this.data.spec || {};
    const gridSize = Number(board.gridSize || spec.gridSize || 0);
    const hasGrid = Number.isFinite(gridSize) && gridSize > 0;

    this.setData({ loadingRecommend: true });

    const loadSameGrid = () => {
      if (!hasGrid) return Promise.resolve({ data: [] });
      return db.collection('templates').where({
        isPublic: true,
        'board.gridSize': gridSize
      }).orderBy('heat', 'desc').limit(12).get().catch(() => ({ data: [] }));
    };

    const loadHot = () => {
      return db.collection('templates').where({ isPublic: true }).orderBy('heat', 'desc').limit(24).get().catch(() => ({ data: [] }));
    };

    Promise.all([loadSameGrid(), loadHot()]).then(([sameRes, hotRes]) => {
      const same = (sameRes && sameRes.data) ? sameRes.data : [];
      const hot = (hotRes && hotRes.data) ? hotRes.data : [];
      const out = [];
      const seen = new Set();
      const push = (t) => {
        if (!t || !t._id || t._id === id) return;
        if (seen.has(t._id)) return;
        seen.add(t._id);
        out.push({
          _id: t._id,
          title: t.title || '未命名',
          imageUrl: t.imageUrl || '',
          author: t.author || (t.userInfo && t.userInfo.nickName) || '匿名用户',
          heat: t.heat || t.likeCount || 0
        });
      };
      same.forEach(push);
      hot.forEach(push);
      this.setData({ recommendWorks: out.slice(0, 12) });
    }).finally(() => {
      this.setData({ loadingRecommend: false });
    });
  },

  goToRecommendWork(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : '';
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(id)}` });
  },

  _getReverseCodeMapMard() {
    if (this._reverseMard) return this._reverseMard;
    let mapping = {};
    try {
      mapping = require('../../data/color-mapping.js') || {};
    } catch (e) {
      mapping = {};
    }
    const rev = Object.create(null);
    Object.keys(mapping).forEach((hex) => {
      const m = mapping[hex];
      const code = m && typeof m.MARD === 'string' ? String(m.MARD).trim() : '';
      if (!code) return;
      if (!rev[code]) rev[code] = String(hex || '').toUpperCase();
    });
    this._reverseMard = rev;
    return rev;
  },

  _buildPixelHexesFromCodesMard(codes, gridSize) {
    const g = Number(gridSize || 0);
    if (!Number.isFinite(g) || g <= 0) return null;
    const list = Array.isArray(codes) ? codes : [];
    if (list.length !== g * g) return null;
    const rev = this._getReverseCodeMapMard();
    const out = new Array(list.length);
    for (let i = 0; i < list.length; i++) {
      const raw = list[i];
      const code = raw != null ? String(raw).trim() : '';
      if (!code) {
        out[i] = '';
        continue;
      }
      out[i] = rev[code] || '';
    }
    return out;
  },

  _trackAchievement(key) {
    if (!key) return;
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'trackAchievement', key }
    }).then((res) => {
      const r = res && res.result;
      if (!r || r.code !== 0) return;
      if (r.data && r.data.unlocked && r.data.title) {
        wx.showToast({ title: `解锁勋章：${r.data.title}`, icon: 'none' });
      }
    }).catch(() => {});
  },

  onCopyMaterialList() {
    const board = this.data.board || {};
    const grid = Number(board.gridSize || (this.data.spec && this.data.spec.gridSize) || 0);
    const codes = board.codesMard;
    if (!grid || !Array.isArray(codes) || codes.length !== grid * grid) {
      wx.showToast({ title: '暂无用料数据', icon: 'none' });
      return;
    }

    const counts = Object.create(null);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i] != null ? String(codes[i]).trim() : '';
      if (!c) continue;
      counts[c] = (counts[c] || 0) + 1;
    }

    const rows = Object.keys(counts).map((code) => ({ code, count: counts[code] || 0 }));
    rows.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.code.localeCompare(b.code);
    });

    const title = String(this.data.title || '未命名');
    const brand = board.brand || 'MARD';
    const header = `${title}\n规格：${grid}x${grid}\n品牌：${brand}`;
    const body = rows.length ? rows.map(r => `${r.code} × ${r.count}`).join('\n') : '（无颜色）';
    const text = `${header}\n\n${body}`;

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制用料清单', icon: 'success' });
        this._trackAchievement('copy_material');
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  onRemix() {
    const board = this.data.board || {};
    const spec = this.data.spec || {};
    
    // 优先使用 beadColors 格式（新格式）
    if (board.beadColors && Object.keys(board.beadColors).length > 0) {
      const gridWidth = Number(board.gridWidth || spec.cols || 32);
      const gridHeight = Number(board.gridHeight || spec.rows || 32);
      
      const appInst = getApp();
      appInst.globalData = appInst.globalData || {};
      appInst.globalData.beadSession = {
        gridSize: gridWidth,
        gridHeight: gridHeight,
        beadColors: board.beadColors,
        selectedBrand: board.brand || 'MARD',
        statsSort: 'count',
        showGrid: true,
        showRuler: true,
        showCellCodes: true
      };
      this._trackAchievement('remix');
      wx.navigateTo({ url: '/pages/bead-mode/bead-mode' });
      return;
    }
    
    // 兼容旧的 codesMard 格式
    const grid = Number(board.gridSize || spec.gridSize || 0);
    const codes = board.codesMard;
    if (!grid || !Array.isArray(codes) || codes.length !== grid * grid) {
      wx.navigateTo({
        url: `/pages/game/game?imageUrl=${encodeURIComponent(this.data.imageUrl)}&size=32`
      });
      return;
    }

    const pixelHexes = this._buildPixelHexesFromCodesMard(codes, grid);
    if (!pixelHexes) {
      wx.navigateTo({
        url: `/pages/game/game?imageUrl=${encodeURIComponent(this.data.imageUrl)}&size=32`
      });
      return;
    }

    const appInst = getApp();
    appInst.globalData = appInst.globalData || {};
    appInst.globalData.beadSession = {
      gridSize: grid,
      pixelHexes,
      selectedBrand: 'MARD',
      statsSort: 'count',
      showGrid: true,
      showRuler: true,
      showCellCodes: true
    };
    this._trackAchievement('remix');
    wx.navigateTo({ url: '/pages/bead-mode/bead-mode' });
  },

  onShareAppMessage() {
    this._trackAchievement('share')
    const id = this.data.id || ''
    if (app && app.globalData && app.globalData.isLogged && id) {
      wx.cloud.callFunction({
        name: 'template-api',
        data: { action: 'recordShare', templateId: id }
      }).then((res) => {
        const r = res && res.result
        if (!r || r.code !== 0) return
        const coins = r.data && typeof r.data.coins === 'number' ? r.data.coins : null
        if (typeof coins === 'number') app.updateUserInfo({ coins })
        const rewardCoins = r.data && typeof r.data.rewardCoins === 'number' ? r.data.rewardCoins : 0
        if (rewardCoins > 0) wx.showToast({ title: `分享奖励 +${rewardCoins}`, icon: 'none' })
      }).catch(() => {})
    }

    const title = this.data.title ? String(this.data.title) : '拼豆作品'
    const inv = app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.inviteCode ? String(app.globalData.userInfo.inviteCode) : ''
    const invPart = inv ? `&inv=${encodeURIComponent(inv)}` : ''
    const path = id ? `/pages/detail/detail?id=${encodeURIComponent(id)}${invPart}` : '/pages/index/index'
    const imageUrl = this.data.imageUrl ? String(this.data.imageUrl) : ''
    const out = { title, path }
    if (imageUrl) out.imageUrl = imageUrl
    return out
  }
});
