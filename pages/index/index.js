const detailHost = require('../../utils/pattern-detail-host.js');
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
  { id: 6, title: '新手教程', desc: '入门指南', iconClass: 'ico-book' }
];

Page({
  ...detailHost.methods,
  data: {
    detailOpen: false,
    activeDetailCard: '',
    detailLaunch: null,
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
  // 切回首页时 canvas 内容可能被回收（变空白但仍不透明），需要重绘。
  // 先把 is-painted 摘掉（退回透明），重绘完成后再由 drawRankCanvases 淡入，
  // 避免中途露出一块空白的画布。
  //
  // ⚠️ 只写 leftTemplates / rightTemplates：wxml 里渲染的只有这两个列数组，
  //    hotTemplates 仅作数据源不参与渲染，去改它只会多出无谓的渲染批次，
  //    还可能和列数组的写入交错，导致 canvas 刚建出来就被重建（表现为闪烁）。
  if (this._rankPixels && Object.keys(this._rankPixels).length) {
    const patch = {};
    (this.data.leftTemplates || []).forEach((t, i) => {
      if (t.boardReady) patch['leftTemplates[' + i + '].boardPainted'] = false;
    });
    (this.data.rightTemplates || []).forEach((t, i) => {
      if (t.boardReady) patch['rightTemplates[' + i + '].boardPainted'] = false;
    });
    if (Object.keys(patch).length) this.setData(patch);
    setTimeout(() => this.drawRankCanvases(), 120);
  }
},

  // ===== 榜单像素方块渲染 =====
  // MARD 色号 → hex（board 数据里的色号按 Mard-291 体系查表上色）
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
  //
  // 流程刻意分两步，避免「图片闪烁」：
  //   ① boardReady=true 让 canvas 挂载进 DOM（此时 opacity:0，用户看不见）；
  //   ② 下一帧才去查询 canvas 节点并把像素画上去，画完置 boardPainted=true 淡入。
  // 底层的兜底图片始终在，所以整个过程用户看不到空白帧。
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
      const painted = {};
      resList.forEach((info, i) => {
        const rank = ranks[i];
        if (!info || !info.node || !info.width) return;
        this._paintRankCanvas(pixelsMap[rank], info);
        painted[rank] = true;
      });
      // 真正画完了才让它淡入（同样只写两个列数组，见 onShow 里的说明）
      const patch = {};
      ['leftTemplates', 'rightTemplates'].forEach((col) => {
        (this.data[col] || []).forEach((t, i) => {
          if (painted[String(t.rank)]) patch[col + '[' + i + '].boardPainted'] = true;
        });
      });
      if (Object.keys(patch).length) this.setData(patch);
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
    //
    // ⚠️ 这里【绝不能】把整条记录读下来：
    //   每条作品的 board.beadColors 是 {"x,y":hex} 字典，一张 86×87 的图就有
    //   7000+ 个键、单条 240KB；榜单 10 条接近 1.9MB，直接超过小程序端单次
    //   查询的返回上限，导致整页查询失败（表现就是「热门榜单加载不出来」）。
    //   所以：① 这里只投影展示所需字段（10 条约 3KB）；
    //        ② 卡片上的像素缩略图另走 getHotBoards 按需取紧凑数据。
    const db = wx.cloud.database();
    const _ = db.command;
    const listFields = {
      _id: true, title: true, imageUrl: true, heat: true, likeCount: true,
      w: true, h: true, beadCount: true, createTime: true, tags: true,
      author: true, userInfo: true, image: true, time: true, size: true
    };
    return db.collection('templates')
      .where({ isPublic: _.neq(false) })
      .orderBy('heat', 'desc')
      .limit(10)
      .field(listFields)
      .get()
      .then(async res => {
        // 批量换取临时链接：cloud:// 开头的云存储路径在小程序端 <image> 里
        // 直接使用可能不显示，统一换成 https 临时链接再渲染。
        const fileList = res.data
          .filter(item => item.imageUrl && String(item.imageUrl).startsWith('cloud://'))
          .map(item => item.imageUrl);
        let urlMap = {};
        if (fileList.length > 0) {
          try {
            const urlRes = await wx.cloud.getTempFileURL({ fileList });
            urlRes.fileList.forEach(file => {
              if (file.status === 0) urlMap[file.fileID] = file.tempFileURL;
            });
          } catch (e) {
            console.error('换取链接失败', e);
          }
        }

        // 格式化数据以匹配UI
        const templates = res.data.map((item, index) => {
          const rank = index + 1;
          const realUrl = (item.imageUrl && urlMap[item.imageUrl]) ? urlMap[item.imageUrl] : item.imageUrl;
          return {
            ...item,
            id: item._id, // 映射 _id 到 id
            rank,
            // 确保字段存在
            image: item.image || '🎨', // 如果没有 icon，给个默认
            imageUrl: realUrl || '', // 像素缩略图由 canvas 兜底
            time: item.time || '-',
            size: item.size || '32x32',
            boardReady: false, // 像素数据回来后置 true，挂载 canvas
            boardPainted: false // canvas 真正画完后置 true，淡入显示
          };
        });

        const leftTemplates = [];
        const rightTemplates = [];
        templates.forEach((item, index) => {
          if (index % 2 === 0) {
            leftTemplates.push(item);
          } else {
            rightTemplates.push(item);
          }
        });

        this.setData({ hotTemplates: templates, leftTemplates, rightTemplates });
        if (!isRefresh) {
          wx.hideLoading();
        }

        // 展示字段已就绪即可收工；像素缩略图异步补上，不阻塞首屏
        this.fetchHotBoards(templates.map(t => t.id));
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

  /**
   * 拉取榜单的像素缩略数据并画成小方块。
   * 数据走云函数 getHotBoards（把 board 压成「色号二维数组」，10 条约 200KB），
   * 避免在列表查询里直接把 1.9MB 的原始 board 拖下来。
   */
  async fetchHotBoards(ids) {
    if (!ids || !ids.length) return;
    try {
      const r = await wx.cloud.callFunction({
        name: 'template-api',
        data: { action: 'getHotBoards', ids }
      });
      const res = r && r.result ? r.result : null;
      const packed = res && res.code === 0 ? (res.data || {}) : {};
      // _rankPixels 按「名次」索引（canvas 的 id 是 rankcv-<rank>），
      // 所以这里要把返回的作品 id 映射回它在榜单里的名次。
      const rankById = {};
      (this.data.hotTemplates || []).forEach((t) => { rankById[t.id] = t.rank; });
      const rankPixels = {};
      const hitRank = {};
      Object.keys(packed).forEach((id) => {
        const p = packed[id];
        const pixels = this._unpackBoardPixels(p);
        const rank = rankById[id];
        if (pixels && rank) { rankPixels[rank] = pixels; hitRank[id] = true; }
      });
      this._rankPixels = rankPixels;

      // 先让 canvas 挂载进 DOM（此时它是透明的，肉眼看不到），
      // 下一帧再绘制，画完由 drawRankCanvases 负责淡入。
      // 之所以不直接 drawRankCanvases：canvas 不在 DOM 里时查不到节点。
      //
      // ⚠️ 只写 leftTemplates / rightTemplates（wxml 只渲染这两个）。
      //    一次性把所有卡片的 boardReady 一起置 true，只产生一个渲染批次，
      //    避免逐个卡片反复触发节点重建。
      const patch = {};
      ['leftTemplates', 'rightTemplates'].forEach((col) => {
        (this.data[col] || []).forEach((t, i) => {
          if (hitRank[t.id]) patch[col + '[' + i + '].boardReady'] = true;
        });
      });
      if (!Object.keys(patch).length) return;
      this.setData(patch, () => {
        // setData 回调意味着节点已就绪，再等一帧确保渲染完成
        setTimeout(() => this.drawRankCanvases(), 50);
      });
    } catch (e) {
      // 像素图是锦上添花，失败就退回 imageUrl / 占位图，不影响榜单主体
      console.error('获取榜单像素数据失败', e);
    }
  },

  /**
   * 还原云函数下发的紧凑像素数据 → { w, h, hexes[] }
   * 入参形如 { w, h, rows: ["A1 A1 B2 ...", ...] }
   */
  _unpackBoardPixels(p) {
    if (!p || !p.w || !p.h || !Array.isArray(p.rows)) return null;
    const rev = this._getMardRevMap();
    const w = Number(p.w);
    const h = Number(p.h);
    const hexes = new Array(w * h).fill('');
    for (let y = 0; y < h; y++) {
      const parts = String(p.rows[y] || '').split(' ');
      for (let x = 0; x < w; x++) {
        const tok = parts[x] ? String(parts[x]).trim() : '';
        if (!tok) continue;
        // 色号 → hex；若本身就是 #RRGGBB 则直接使用
        hexes[y * w + x] = tok.charAt(0) === '#' ? tok : (rev[tok] || '');
      }
    }
    return { w, h, hexes };
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
    detailHost.open(this, e, e.currentTarget.dataset.id);
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
    const detailShare = this.detailShareMessage();
    if (detailShare) return detailShare;
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
