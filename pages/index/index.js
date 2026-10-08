const app = getApp();

// 工具箱的小工具列表（收起时整块隐藏，点「全部工具」果冻动画展开）
// 注意：id 1 / 9 / 13 / 4 已在首页快捷工具栏，此处不再重复
// iconClass 对应 app.wxss 里的全局线性图标（不再用 emoji，全站风格统一）
const ALL_SMALL_TOOLS = [
  { id: 2, title: '抠图', desc: '图片去底', iconClass: 'ico-scissors', size: 'small' },
  { id: 11, title: '色卡表', desc: 'Excel下载', iconClass: 'ico-sheet', size: 'small' },
  { id: 3, title: '我的仓库', desc: '管理色卡', iconClass: 'ico-box', size: 'small' },
  { id: 7, title: '收藏图纸', desc: '我的收藏', iconClass: 'ico-star' },
  { id: 5, title: '我的作品', desc: '查看创作', iconClass: 'ico-grid' },
  { id: 6, title: '新手教程', desc: '入门指南', iconClass: 'ico-book' },
  { id: 8, title: '我的订单', desc: '订单历史', iconClass: 'ico-receipt' }
];

Page({
  data: {
    userInfo: {
      coins: 0,
      energy: 0
    },
    isLogged: false,
    isRefreshing: false,
    banners: [
      { id: 1, color: '#D89A5C', color2: '#E8B27E', icon: '🌟', title: '新手拼豆指南', sub: '3 分钟上手不踩坑' },
      { id: 2, color: '#7A9E7E', color2: '#9DBB9F', icon: '🔥', title: '本周热门图纸', sub: '大家都在拼的款' },
      { id: 3, color: '#D4607A', color2: '#E88FA1', icon: '🏆', title: '拼豆作品大赛', sub: '晒作品赢豆币' }
    ],
    hotTemplates: [], // Keep for compatibility if needed
    leftTemplates: [],
    rightTemplates: [],
    // 工具箱：allSmallTools 是全部，toolsExpanded 控制整块网格的展开/收起
    allSmallTools: ALL_SMALL_TOOLS,
    toolsExpanded: false,
    currentTab: 0,
    cursorLeft: '0%', // 初始光标位置
    isDragging: false, // 是否正在拖拽
    isStretching: false, // 是否正在弹性形变
    tabScales: [1.1, 1, 1, 1], // 初始缩放，Tab 0 激活
    particles: [], // 粒子数组
    isDevtools: false,
  },
  
  onLoad() {
    console.log('Page Load');
    this.fetchHotTemplates();
    
    // Get window width for tabbar drag calculation
    const sysInfo = wx.getSystemInfoSync();
    this.windowWidth = sysInfo.windowWidth;
    this.setData({ isDevtools: sysInfo && sysInfo.platform === 'devtools' });
    
    // TabBar Metrics (assuming 90% width, centered)
    this.tabBarWidth = this.windowWidth * 0.9;
    this.tabBarLeft = this.windowWidth * 0.05;

    // Initialize drag variables
    this._lastX = 0;
    this._lastTime = 0;

    // 初始化刷新音效
    this.refreshAudio = wx.createInnerAudioContext();
    // 提示：如果项目中没有此文件，请添加 audio/ding.mp3，或者修改此处为存在的音频文件
    this.refreshAudio.src = '/audio/ding.mp3'; 
  },

  // ... (keeping existing methods)

  // TabBar Interaction
  // Removed custom implementation, now using custom-tab-bar component

  navigateToTab(index) {
    if (index === 0) {
      // 已经在首页，滚动到顶部
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
      return;
    }
    
    if (index === 1) {
      wx.switchTab({ url: '/pages/mall/mall' });
      return;
    }
    
    if (index === 2) {
      wx.switchTab({ url: '/pages/square/square' });
      return;
    }

    if (index === 3) {
      wx.switchTab({ url: '/pages/profile/profile' });
      return;
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected(0);
    }

  // 每次显示页面时同步最新数据
  this.updateLocalUserData();
  if (app.globalData.isLogged) {
    this.fetchWallet();
  }
  // 切回首页时 canvas 内容可能被回收，重绘榜单像素图
  if (this._rankPixels && Object.keys(this._rankPixels).length) {
    setTimeout(() => this.drawRankCanvases(), 120);
  }
},

  // ===== 榜单像素方块渲染 =====
  // board（beadColors / codesMard）→ { w, h, hexes[] }，无数据返回 null
  _buildBoardPixels(board) {
    if (!board) return null;
    let w = Number(board.gridWidth);
    let h = Number(board.gridHeight);
    let hexes = null;
    if (board.beadColors && Object.keys(board.beadColors).length) {
      if (!Number.isFinite(w) || w <= 0) w = 32;
      if (!Number.isFinite(h) || h <= 0) h = 32;
      hexes = new Array(w * h).fill('');
      Object.keys(board.beadColors).forEach((key) => {
        const parts = key.split(',');
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const idx = (y - 1) * w + (x - 1);
        if (idx < 0 || idx >= w * h) return;
        hexes[idx] = board.beadColors[key] || '';
      });
    } else if (Array.isArray(board.codesMard) && Number(board.gridSize) > 0) {
      const g = Number(board.gridSize);
      w = g; h = g;
      const rev = this._getMardRevMap();
      hexes = new Array(g * g).fill('');
      for (let i = 0; i < board.codesMard.length; i++) {
        const code = board.codesMard[i] != null ? String(board.codesMard[i]).trim() : '';
        if (code) hexes[i] = rev[code] || '';
      }
    }
    if (!hexes) return null;
    return { w, h, hexes };
  },

  // MARD 色号 → hex（旧版 codesMard 数据用）
  _getMardRevMap() {
    if (this._mardRev) return this._mardRev;
    let mapping = {};
    try { mapping = require('../../data/color-mapping.js') || {}; } catch (e) { mapping = {}; }
    const rev = Object.create(null);
    Object.keys(mapping).forEach((hex) => {
      const m = mapping[hex];
      const code = m && typeof m.MARD === 'string' ? String(m.MARD).trim() : '';
      if (code && !rev[code]) rev[code] = String(hex || '').toUpperCase();
    });
    this._mardRev = rev;
    return rev;
  },

  // 把有图纸数据的榜单卡片画成小方块
  drawRankCanvases() {
    const pixelsMap = this._rankPixels || {};
    const ranks = Object.keys(pixelsMap);
    if (!ranks.length) return;
    const q = wx.createSelectorQuery();
    ranks.forEach((r) => {
      q.select('#rankcv-' + r).fields({ node: true, size: true });
    });
    q.exec((resList) => {
      if (!resList) return;
      resList.forEach((info, i) => {
        if (!info || !info.node || !info.width) return;
        this._paintRankCanvas(pixelsMap[ranks[i]], info);
      });
    });
  },

  _paintRankCanvas(p, info) {
    const canvas = info.node;
    const ctx = canvas.getContext('2d');
    const dpr = (wx.getSystemInfoSync().pixelRatio || 2);
    const W = info.width;
    const H = info.height;
    if (!W || !H) return;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // 底色与卡片图区一致
    ctx.fillStyle = '#F5EDE6';
    ctx.fillRect(0, 0, W, H);

    // 图案等比居中
    const cell = Math.min(W / p.w, H / p.h);
    const ox = (W - cell * p.w) / 2;
    const oy = (H - cell * p.h) / 2;
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const hex = p.hexes[y * p.w + x];
        if (!hex) continue;
        ctx.fillStyle = hex;
        // +0.5 防止浮点误差出现发丝缝
        ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.5, cell + 0.5);
      }
    }
  },

  fetchHotTemplates(isRefresh = false) {
    if (!isRefresh) {
      wx.showLoading({ title: '加载榜单...' });
    }
    
    // 直接查询 templates 集合（排除已设为私密的作品）
    const db = wx.cloud.database();
    const _ = db.command;
    return db.collection('templates')
      .where({ isPublic: _.neq(false) })
      .orderBy('heat', 'desc')
      .limit(10)
      .get()
      .then(async res => {
        if (!isRefresh) {
          wx.hideLoading();
        }

        // 批量换取临时链接 (解决部分云图片加载问题)
        const fileList = res.data
          .filter(item => item.imageUrl && item.imageUrl.startsWith('cloud://'))
          .map(item => item.imageUrl);
          
        let urlMap = {};
        if (fileList.length > 0) {
          try {
            const urlRes = await wx.cloud.getTempFileURL({ fileList });
            urlRes.fileList.forEach(file => {
              if (file.status === 0) {
                urlMap[file.fileID] = file.tempFileURL;
              }
            });
          } catch (e) {
            console.error('换取链接失败', e);
          }
        }
        
        // 格式化数据以匹配UI
        const rankPixels = {};
        const templates = res.data.map((item, index) => {
          // 尝试使用 HTTP 链接
          const realUrl = (item.imageUrl && urlMap[item.imageUrl]) ? urlMap[item.imageUrl] : item.imageUrl;
          const rank = index + 1;
          const pixels = this._buildBoardPixels(item.board);
          if (pixels) rankPixels[rank] = pixels;

          return {
            ...item,
            id: item._id, // 映射 _id 到 id
            rank,
            // 确保字段存在
            image: item.image || '🎨', // 如果没有 icon，给个默认
            imageUrl: realUrl, // 更新为 HTTP 链接
            time: item.time || '-',
            size: item.size || '32x32',
            hasBoard: !!pixels // 有图纸数据就用像素方块 canvas 渲染
          };
        });
        this._rankPixels = rankPixels;
        
        const leftTemplates = [];
        const rightTemplates = [];
        
        templates.forEach((item, index) => {
          if (index % 2 === 0) {
            leftTemplates.push(item);
          } else {
            rightTemplates.push(item);
          }
        });

        this.setData({
          hotTemplates: templates,
          leftTemplates,
          rightTemplates
        });
        // 榜单像素方块渲染（canvas 2d）
        setTimeout(() => this.drawRankCanvases(), 80);
        return { ok: true };
      }).catch(err => {
        if (!isRefresh) {
          wx.hideLoading();
        }
        console.error('获取热门榜单失败', err);
        if (!isRefresh) {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
        return { ok: false, err };
      });
  },

  onRefresh() {
    if (this._freshing) return;
    this._freshing = true;
    
    const startAt = Date.now();
    const minDuration = 300;

    this.setData({ isRefreshing: true });

    const like = this.selectComponent('.home-like');
    if (like && typeof like.refreshAnimated === 'function') {
      like.refreshAnimated();
    }

    const finish = (ok) => {
      const elapsed = Date.now() - startAt;
      const delay = Math.max(0, minDuration - elapsed);
      setTimeout(() => {
        this.setData({ isRefreshing: false });
        this._freshing = false;

        if (!ok) {
          wx.showToast({ title: '刷新失败', icon: 'none' });
          return;
        }

        if (this.refreshAudio) {
          this.refreshAudio.play();
        }

        wx.vibrateShort({
          type: 'medium',
          fail: () => {
            wx.vibrateShort();
          }
        });

        wx.showToast({ title: '刷新成功', icon: 'none' });
      }, delay);
    };

    try {
      this.updateLocalUserData();
    } catch (e) {
      finish(false);
      return;
    }

    this.fetchHotTemplates(true)
      .then((res) => finish(!!(res && res.ok)))
      .catch(() => finish(false));
  },

  onRestore() {
    console.log('onRestore');
  },

  updateLocalUserData() {
    const appData = app.globalData;
    if (appData.isLogged && appData.userInfo) {
      this.setData({
        userInfo: appData.userInfo,
        isLogged: true
      });
    } else {
      // 未登录时的默认状态
      this.setData({
        userInfo: { coins: '-', energy: '-' },
        isLogged: false
      });
    }
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
      app.updateUserInfo({ coins, energy })
      this.updateLocalUserData()
      return true
    }).catch(() => false)
  },

  onStartGame() {
    if (!this.data.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再开始游戏',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }
    // 直接跳转到拼豆模式页面
    wx.navigateTo({ url: '/packageGame/pages/bead-mode/bead-mode' });
  },

  // 首页主入口「画板」：进入空白大画板自由绘制
  // bead-mode 不传 beadSession 时即为空画板，本地画布无需登录
  onGoBoard() {
    wx.vibrateShort({ type: 'light' });
    const appInst = getApp();
    if (appInst && appInst.globalData) {
      appInst.globalData.beadSession = null;
    }
    wx.navigateTo({ url: '/packageGame/pages/bead-mode/bead-mode' });
  },

  goToDetail(e) {
    const { id, title, imageUrl, author, time, likes } = e.currentTarget.dataset;
    
    // Construct URL with encoded parameters
    let url = `/pages/detail/detail?id=${id}`;
    if (title) url += `&title=${encodeURIComponent(title)}`;
    if (imageUrl) url += `&imageUrl=${encodeURIComponent(imageUrl)}`;
    if (author) url += `&author=${encodeURIComponent(author)}`;
    if (time) url += `&time=${encodeURIComponent(time)}`;
    if (likes) url += `&likes=${likes}`;
    
    wx.navigateTo({ url });
  },

  // 首页榜单封面加载失败兜底（index.wxml:195 绑定）
  // 注意：榜单拆成 leftTemplates / rightTemplates 两列渲染，只改 hotTemplates 不会刷新，
  // 必须同步更新该项所在那一列，否则图片会一直裂着。
  onImageError(e) {
    const idx = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(idx) || idx < 0) return;

    const item = (this.data.hotTemplates || [])[idx];
    const placeholder = '/images/placeholder.png';
    // 已是占位图则跳过，避免加载失败时反复触发 error
    if (!item || !item.imageUrl || item.imageUrl === placeholder) return;

    const patch = { [`hotTemplates[${idx}].imageUrl`]: placeholder };
    // 原数组偶数下标进左列、奇数下标进右列（见 fetchHotTemplates 的拆分规则）
    if (idx % 2 === 0) {
      patch[`leftTemplates[${idx / 2}].imageUrl`] = placeholder;
    } else {
      patch[`rightTemplates[${(idx - 1) / 2}].imageUrl`] = placeholder;
    }
    this.setData(patch);
  },

  onTemplateTap(e) {
    const id = e.currentTarget.dataset.id;
    const template = this.data.hotTemplates.find(t => t.id === id);
    
    if (template) {
      // 跳转到详情页，传递ID和图片URL
      let url = `/pages/template-detail/template-detail?id=${id}`;
      if (template.imageUrl) {
        url += `&imageUrl=${encodeURIComponent(template.imageUrl)}`;
      }
      wx.navigateTo({ url });
    }
  },

  // 「全部工具」：在当前页就地展开/收起小工具网格（果冻动画见 wxss 的 .toolbox-collapse）
  onToggleTools() {
    const next = !this.data.toolsExpanded;
    this.setData({ toolsExpanded: next });
    // 震动反馈
    wx.vibrateShort({ type: 'light' });
  },

  onToolTap(e) {
    const id = parseInt(e.currentTarget.dataset.id);
    
    // 检查登录状态
    const protectedIds = [1, 2, 3, 4, 5, 7];
    if (protectedIds.includes(id) && !this.data.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用该功能',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }

    // 震动反馈
    wx.vibrateShort({ type: 'light' });
    
    switch (id) {
      case 1: // 生成像素图
        wx.navigateTo({ url: '/packageTool/pages/generate/generate' });
        break;
      case 2: // 抠图 (原图纸编辑)
        wx.navigateTo({ url: '/packageTool/pages/matting/matting' });
        break;
      case 9: // 转卡通（入口已隐藏：依赖豆包 API，未配置前不对外）
        wx.navigateTo({ url: '/packageTool/pages/cartoon/cartoon' });
        break;
      case 14: // 拼豆模式（空白画板，本地可用，替代原"转卡通"的快捷位）
        wx.navigateTo({ url: '/packageGame/pages/bead-mode/bead-mode' });
        break;
      case 11: // Excel 色卡表
        wx.navigateTo({ url: '/packageTool/pages/color-list/color-list' });
        break;
      case 3: // 我的仓库
        // 直达「豆库管理」（智能豆库）：功能最全（库存/预警/记录/统计/添加）。
        // 原先的 warehouse 页只记录「有没有这个色」，与豆库管理数据不互通，已不再作为入口。
        wx.navigateTo({ url: '/packageWarehouse/pages/warehouse/manage/manage' });
        break;
      case 4: // 色卡表
        wx.navigateTo({ url: '/packageTool/pages/color-chart/color-chart' });
        break;
      case 5: // 我的作品
        wx.navigateTo({ url: '/pages/my-works/my-works' });
        break;
      case 6: // 新手教程
        wx.navigateTo({ url: '/packageMisc/pages/beginner-guide/beginner-guide' });
        break;
      case 7: // 收藏图纸
        wx.navigateTo({ url: '/pages/my-collections/my-collections' });
        break;
      case 8: // 我的订单
        wx.navigateTo({ url: '/packageMisc/pages/my-orders/my-orders' });
        break;
      case 12: // AI生成拼豆图
        // 该页面未在 app.json 注册，跳转必失败，改为提示
        wx.showToast({ title: '功能开发中...', icon: 'none' });
        break;
      case 13: // 图纸库
        wx.navigateTo({ url: '/pages/patterns/patterns' });
        break;
      default:
        wx.showToast({ title: '功能开发中...', icon: 'none' });
    }
    },

    onShareAppMessage() {
    return {
      title: '拼豆助手 - 创作你的拼豆作品',
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.png'
    };
  },

  onShareTimeline() {
    return {
      title: '拼豆助手 - 创作你的拼豆作品',
      query: '',
      imageUrl: '/images/share-cover.png'
    };
  }
});
