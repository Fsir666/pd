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
    // 规格行：宽×高 粒 · 颗数 颗 · 色号 个色号
    sizeText: '',
    beadCount: 0,
    colorCount: 0,
    // 用料清单（色块 + 色号 + hex + 颗数）
    materialRows: [],
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
    particleList: [],

    // 6. 图纸像素预览（替换原来的珠子照片）
    hasPixel: false,     // 是否有可绘制的图纸数据（有则显示像素图纸，无则回退原图）
    showGrid: true,      // 网格线
    showCode: true,      // 色号文字
    scale: 1,            // 缩放倍数（1/2/3/4）
    viewW: 0,            // 画布可视宽（px）
    viewH: 0,            // 画布可视高（px）
    canvasW: 0,          // canvas 实际宽（px，= viewW * scale）
    canvasH: 0           // canvas 实际高（px，= viewH * scale）
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight + 4
    });

    // 统一入口：发现页「图纸」传 key，榜单/作品传 id。
    // key 映射到云端内置记录 seed_<key>，与发现页数据完全一致（单一数据源）。
    let id = options.id ? String(options.id) : '';
    if (!id && options.key) {
      id = 'seed_' + String(options.key);
    }
    if (id) {
      this.setData({ id });
      this.fetchWorkDetails(id);
      this.fetchComments(id);
      this.fetchUserStatus(id);
    }
  },

  onReady() {
    if (this._pixel && this.data.hasPixel) {
      setTimeout(() => this.drawPixel(), 120);
    }
  },

  onShow() {
    // 从拼豆模式等返回时，canvas 内容可能已被回收，重绘一次
    if (this.data.hasPixel && this.canvasNode) {
      setTimeout(() => this.drawPixel(), 60);
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

      // 根据 board（beadColors / codesMard）构建像素图纸数据，替换原来那张「珠子照片」
      const pixel = this._buildPixelData(board, spec);
      this._pixel = pixel;
      // 规格行 + 用料清单（供详情页「图纸核心区」直接展示）
      const sizeInfo = this._buildSizeInfo(board, spec, pixel);
      const materialRows = this._buildMaterialRows(board, spec, pixel);
      const extra = {
        hasPixel: !!pixel,
        showGrid: true,
        showCode: true,
        scale: 1,
        sizeText: sizeInfo.sizeText,
        beadCount: sizeInfo.beadCount,
        colorCount: sizeInfo.colorCount,
        materialRows
      };
      if (pixel) {
        const sysInfo = wx.getSystemInfoSync();
        const winW = sysInfo.windowWidth || 375;
        const winH = sysInfo.windowHeight || 667;
        const viewW = winW;
        const cell = viewW / pixel.w;
        const naturalH = Math.ceil(cell * pixel.h);
        const maxH = Math.floor(winH * 0.6);
        const finalH = Math.min(naturalH, maxH);
        extra.viewW = viewW;
        extra.viewH = finalH;
        extra.canvasW = Math.round(viewW);
        extra.canvasH = Math.round(finalH);
      }

      this.setData(Object.assign({
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
      }, extra), () => {
        if (pixel) setTimeout(() => this.drawPixel(), 120);
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

  // ============ 图纸像素预览（小方块网格，替代原珠子照片）============

  // 规格行：宽×高 粒 · 颗数 颗 · 色号 个色号
  _buildSizeInfo(board, spec, pixel) {
    const b = board || {};
    const s = spec || {};
    const w = Number(b.gridWidth || (pixel && pixel.w) || s.cols || s.gridSize || 0);
    const h = Number(b.gridHeight || (pixel && pixel.h) || s.rows || s.gridSize || 0);
    let beadCount = Number(b.beadCount || s.beadCount || 0);
    let colorCount = 0;

    // 色号数：优先从像素数据统计实际出现的颜色
    if (pixel && pixel.hexes) {
      const set = new Set();
      let filled = 0;
      for (let i = 0; i < pixel.hexes.length; i++) {
        const hex = pixel.hexes[i];
        if (hex) {
          filled++;
          set.add(String(hex).toUpperCase());
        }
      }
      if (!beadCount) beadCount = filled;
      colorCount = set.size;
    }
    // 回退：从 codesMard 统计
    if (!colorCount && Array.isArray(b.codesMard)) {
      const set = new Set();
      let filled = 0;
      b.codesMard.forEach((c) => {
        const code = c != null ? String(c).trim() : '';
        if (code) {
          filled++;
          set.add(code);
        }
      });
      if (!beadCount) beadCount = filled;
      colorCount = set.size;
    }

    const sizeText = (w && h)
      ? `${w}×${h} 粒 · ${beadCount} 颗 · ${colorCount} 个色号`
      : '';
    return { sizeText, beadCount, colorCount };
  },

  // 用料清单：色块 + 色号 + hex + 颗数（按颗数倒序）
  _buildMaterialRows(board, spec, pixel) {
    const b = board || {};
    const s = spec || {};
    const rows = [];

    if (pixel && pixel.hexes && pixel.codes) {
      // pixel.codes: "x,y" -> 色号；pixel.hexes: 一维 hex 数组
      const w = pixel.w;
      const agg = Object.create(null); // 色号 -> { code, hex, count }
      for (let i = 0; i < pixel.hexes.length; i++) {
        const hex = pixel.hexes[i];
        if (!hex) continue;
        const x = (i % w) + 1;
        const y = Math.floor(i / w) + 1;
        const code = pixel.codes[x + ',' + y] || String(hex).toUpperCase();
        const key = code + '|' + String(hex).toUpperCase();
        if (!agg[key]) agg[key] = { code, hex: String(hex).toUpperCase(), count: 0 };
        agg[key].count++;
      }
      Object.keys(agg).forEach((k) => rows.push(agg[k]));
    } else if (Array.isArray(b.codesMard)) {
      // 兜底：只有 codesMard（色号）——用色号映射反查 hex
      const rev = this._getReverseCodeMapMard();
      const agg = Object.create(null);
      b.codesMard.forEach((c) => {
        const code = c != null ? String(c).trim() : '';
        if (!code) return;
        if (!agg[code]) {
          const hex = rev[code] || '';
          agg[code] = { code, hex, count: 0 };
        }
        agg[code].count++;
      });
      Object.keys(agg).forEach((k) => rows.push(agg[k]));
    } else if (Array.isArray(b.beadColors)) {
      // 兜底：beadColors 为数组形态
      const map = this._getHexCodeMap((b.brand || 'MARD').toUpperCase());
      const agg = Object.create(null);
      b.beadColors.forEach((hex) => {
        if (!hex) return;
        const H = String(hex).toUpperCase();
        const code = map[H] || H;
        const key = code + '|' + H;
        if (!agg[key]) agg[key] = { code, hex: H, count: 0 };
        agg[key].count++;
      });
      Object.keys(agg).forEach((k) => rows.push(agg[k]));
    }

    rows.sort((a, b2) => {
      if (b2.count !== a.count) return b2.count - a.count;
      return String(a.code).localeCompare(String(b2.code));
    });
    return rows;
  },

  // 构建像素数据：优先 beadColors（新），回退 codesMard（旧）
  _buildPixelData(board, spec) {
    if (!board) return null;
    const brand = (board.brand || 'MARD').toUpperCase();
    const map = this._getHexCodeMap(brand);
    let w = Number(board.gridWidth || (spec && spec.cols) || 0);
    let h = Number(board.gridHeight || (spec && spec.rows) || 0);
    let hexes = null;
    const codes = Object.create(null); // "x,y" -> 色号

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
        const hex = board.beadColors[key] || '';
        hexes[idx] = hex;
        if (hex) {
          const code = map[String(hex).toUpperCase()];
          if (code) codes[key] = code;
        }
      });
    } else if (Array.isArray(board.codesMard) && Number(board.gridSize) > 0) {
      const g = Number(board.gridSize);
      w = g; h = g;
      const rev = this._getReverseCodeMapMard(); // MARD 色号 -> hex
      hexes = new Array(g * g).fill('');
      for (let i = 0; i < board.codesMard.length; i++) {
        const code = board.codesMard[i] != null ? String(board.codesMard[i]).trim() : '';
        if (!code) continue;
        const hex = rev[code] || '';
        hexes[i] = hex;
        const y = Math.floor(i / g) + 1;
        const x = (i % g) + 1;
        const key = x + ',' + y;
        // 优先用品牌色号映射，找不到就用 raw 的 MARD 色号兜底
        const code2 = hex ? (map[String(hex).toUpperCase()] || code) : code;
        codes[key] = code2;
      }
    }

    if (!hexes || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return { w, h, hexes, codes };
  },

  // hex(大写) -> 品牌色号。
  // 主来源 data/color-data.js（beadColors 的 hex 正是从这里匹配出来的），
  // 兜底 data/color-mapping.js（另一套 hex 编码）。
  _getHexCodeMap(brand) {
    const cacheKey = '_hexCodeMap_' + brand;
    if (this[cacheKey]) return this[cacheKey];
    const map = Object.create(null);
    try {
      const colorData = require('../../data/color-data.js');
      const bd = colorData[String(brand).toLowerCase()];
      if (bd && Array.isArray(bd.subSeries)) {
        bd.subSeries.forEach((series) => {
          if (!series.colors) return;
          series.colors.forEach((c) => {
            if (c && c.hex && c.code) map[String(c.hex).toUpperCase()] = String(c.code).trim();
          });
        });
      }
    } catch (e) { /* ignore */ }
    // 兜底：color-mapping.js（键为大写 hex，值为 {品牌: 色号}）
    try {
      const mapping = require('../../data/color-mapping.js') || {};
      Object.keys(mapping).forEach((hex) => {
        const m = mapping[hex];
        const code = m && typeof m[brand] === 'string' ? String(m[brand]).trim() : '';
        if (code && !map[String(hex).toUpperCase()]) map[String(hex).toUpperCase()] = code;
      });
    } catch (e) { /* ignore */ }
    this[cacheKey] = map;
    return map;
  },

  _lum(hex) {
    const h = String(hex).replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    return (r + g + b) / 3;
  },

  // 绘制像素方块到 canvas（缩放时重绘，格子够大才显色号，放大不糊）
  drawPixel(retry) {
    const p = this._pixel;
    if (!p) return;
    const q = wx.createSelectorQuery();
    q.select('#detailCanvas').fields({ node: true, size: true }).exec((res) => {
      const info = res && res[0];
      if (!info || !info.node || !info.width) {
        if (!retry) setTimeout(() => this.drawPixel(true), 200);
        return;
      }
      const canvas = info.node;
      const ctx = canvas.getContext('2d');
      const dpr = (wx.getSystemInfoSync().pixelRatio || 2);
      canvas.width = info.width * dpr;
      canvas.height = info.height * dpr;
      ctx.scale(dpr, dpr);

      const { w, h, hexes, codes } = p;
      const cell = info.width / w;
      const codeReadable = this.data.showCode && cell >= 14;
      const fontSize = Math.min(13, Math.max(8, cell * 0.34));

      ctx.fillStyle = '#FBF7F2';
      ctx.fillRect(0, 0, info.width, info.height);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const hex = hexes[idx];
          const x0 = x * cell;
          const y0 = y * cell;
          if (!hex) {
            ctx.fillStyle = '#F2E9E2';
            ctx.fillRect(x0, y0, cell, cell);
          } else {
            ctx.fillStyle = hex;
            ctx.fillRect(x0, y0, cell, cell);
            if (codeReadable) {
              const lum = this._lum(hex);
              ctx.fillStyle = lum > 150 ? '#3A2A2E' : '#FFFDFB';
              ctx.font = '600 ' + fontSize.toFixed(0) + 'px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const code = codes[(x + 1) + ',' + (y + 1)];
              if (code) ctx.fillText(code, x0 + cell / 2, y0 + cell / 2);
            }
          }
          if (this.data.showGrid) {
            ctx.strokeStyle = (x % 5 === 0 || y % 5 === 0) ? '#C9B8AF' : '#EADFD7';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x0, y0, cell, cell);
          }
        }
      }
      this.canvasNode = canvas;
    });
  },

  toggleGrid() {
    if (!this.data.hasPixel) return;
    this.setData({ showGrid: !this.data.showGrid }, () => setTimeout(() => this.drawPixel(), 40));
    wx.vibrateShort({ type: 'light' });
  },

  toggleCode() {
    if (!this.data.hasPixel) return;
    const next = !this.data.showCode;
    let scale = this.data.scale;
    if (next && this._pixel) {
      const baseCell = this.data.viewW / this._pixel.w;
      if (baseCell * scale < 14) {
        scale = Math.min(4, Math.max(1, Math.ceil(14 / baseCell)));
      }
    }
    this.setData({ showCode: next });
    if (scale !== this.data.scale) {
      this._applyScale(scale);
    }
    setTimeout(() => this.drawPixel(), 60);
    wx.vibrateShort({ type: 'light' });
  },

  setScale(e) {
    if (!this.data.hasPixel) return;
    const val = Number(e.currentTarget.dataset.scale) || 1;
    if (val === this.data.scale) return;
    this._applyScale(val);
    setTimeout(() => this.drawPixel(), 60);
    wx.vibrateShort({ type: 'light' });
  },

  // ===== 双指捏合缩放（与 pattern-detail 对齐，1–4×）=====
  onCanvasTouchStart(e) {
    if (!this.data.hasPixel) return;
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches;
      this._pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      this._pinchStartScale = this.data.scale;
    }
  },

  onCanvasTouchMove(e) {
    if (!this.data.hasPixel) return;
    if (!this._pinchStartDist) return;
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / this._pinchStartDist;
      const newScale = Math.min(4, Math.max(1, this._pinchStartScale * ratio));
      if (Math.abs(newScale - this.data.scale) > 0.05) {
        this._applyScale(newScale);
        setTimeout(() => this.drawPixel(), 60);
      }
    }
  },

  onCanvasTouchEnd() {
    if (!this._pinchStartDist) return;
    this._pinchStartDist = 0;
    // 吸附到 0.5 步进，避免出现 1.37 这种零碎倍数
    const snapped = Math.round(this.data.scale * 2) / 2;
    const clamped = Math.min(4, Math.max(1, snapped));
    if (Math.abs(clamped - this.data.scale) > 0.001) {
      this._applyScale(clamped);
      setTimeout(() => this.drawPixel(), 50);
    }
  },

  _applyScale(newScale) {
    const viewW = this.data.viewW;
    const viewH = this.data.viewH;
    newScale = Math.min(4, Math.max(1, newScale));
    this.setData({
      scale: newScale,
      canvasW: Math.round(viewW * newScale),
      canvasH: Math.round(viewH * newScale)
    });
  },

  onCanvasScroll() {
    // 仅用按钮缩放，无需记录焦点；保留空处理
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

  // 「拼豆模式」入口（与「复刻同款」等价，语义更直白，供统一后的作品页主按钮使用）
  onGoBeadMode() {
    this.onRemix();
  },

  // 保存图纸图片：仅在有像素图纸数据时可用
  saveImage() {
    if (!this.data.hasPixel || !this.canvasNode || !this._pixel) {
      wx.showToast({ title: '图纸还没画好', icon: 'none' });
      return;
    }
    wx.canvasToTempFilePath({
      canvas: this.canvasNode,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.showToast({ title: '已存到相册', icon: 'none' });
            this._trackAchievement('save_image');
          },
          fail: () => wx.showToast({ title: '保存失败，请允许相册权限', icon: 'none' })
        });
      },
      fail: () => wx.showToast({ title: '生成图片失败', icon: 'none' })
    });
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
