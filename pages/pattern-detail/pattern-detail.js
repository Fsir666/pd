const presets = require('../../data/pattern-presets.js');

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

Page({
  data: {
    p: null,
    rows: [],
    canvasW: 0,
    canvasH: 0,
    isFav: false,
    // 作者信息（来自云端 seed_<key> 记录；云端未就绪时兜底显示「冯」）
    author: { name: '冯', avatar: '', initial: '冯' },
    // 点赞
    likes: 0,
    isLiked: false,
    particleList: [],
    // 视图控制
    showGrid: true,      // 网格线
    showCode: true,      // 色号文字
    scale: 1,            // 缩放倍数
    viewW: 0,            // 可视区域宽（px）
    viewH: 0,
    scrollLeft: 0,       // 拖动位置（px）
    scrollTop: 0,
    showGuide: false     // 首次进入的看图引导（看过一次后不再弹）
  },

  onLoad(query) {
    const key = query && query.key;
    const raw = presets.find(x => x.key === key) || presets[0];
    this._raw = raw;

    const sysInfo = wx.getSystemInfoSync();
    const winW = sysInfo.windowWidth || 375;
    // 可视区宽度：留边距，缩放时 canvas 超出部分靠外层 scroll-view 滚动
    const viewW = Math.floor(winW * 0.92);
    // 初始按图纸宽度铺满可视区（长图限制最大高度，超出可上下滚）
    const cell = viewW / raw.w;
    const viewH = Math.min(Math.ceil(cell * raw.h), Math.floor(winW * 1.1));

    const rows = raw.palette.map((code, i) => ({
      code,
      hex: raw.hexes[i],
      count: raw.counts[i]
    }));

    wx.setNavigationBarTitle({ title: raw.name + ' 图纸' });

    this.setData({
      p: {
        key: raw.key,
        name: raw.name,
        w: raw.w,
        h: raw.h,
        beadCount: raw.beadCount,
        colors: raw.palette.length
      },
      rows,
      viewW,
      viewH,
      // canvas 实际像素 = 可视区 * 缩放
      canvasW: Math.round(viewW * this.data.scale),
      canvasH: Math.round(viewH * this.data.scale),
      isFav: (wx.getStorageSync('pattern_favs') || []).indexOf(raw.key) >= 0
    });

    this.loadAuthorAndLikes();
  },

  // ===== 视图控制 =====
  // 注意：showGrid / showCode 只影响 draw() 内部逻辑，
  // 改完必须重新调用 draw()，否则画布内容不会变化
  toggleGrid() {
    const next = !this.data.showGrid;
    this.setData({ showGrid: next }, () => {
      setTimeout(() => this.draw(), 40);
    });
    wx.vibrateShort({ type: 'light' });
  },

  toggleCode() {
    const next = !this.data.showCode;
    // 打开色号时，若当前格子太小看不清，自动放大一档让变化可见
    let scale = this.data.scale;
    if (next) {
      const baseCell = this.data.viewW / (this._raw ? this._raw.w : 24);
      if (baseCell * scale < 13) {
        scale = Math.min(4, Math.max(1, Math.ceil(13 / baseCell * 2) / 2));
      }
    }
    this.setData({ showCode: next });
    if (scale !== this.data.scale) {
      this._applyScale(scale, false);
    }
    setTimeout(() => this.draw(), 60);
    wx.vibrateShort({ type: 'light' });
  },

  setScale(e) {
    const val = Number(e.currentTarget.dataset.scale) || 1;
    if (val === this.data.scale) return;
    this._applyScale(val, false);
    setTimeout(() => this.draw(), 60);
    wx.vibrateShort({ type: 'light' });
  },

  // 双指缩放手势
  onTouchStart(e) {
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches;
      this._pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      this._pinchStartScale = this.data.scale;

      // 记录双指中心点在「画布内容坐标系」里的位置，缩放后保持这个点不动
      const cx = (a.clientX + b.clientX) / 2;
      const cy = (a.clientY + b.clientY) / 2;
      this._pinchFocusX = cx;
      this._pinchFocusY = cy;
      this._pinchContentX = (cx - this._scrollRectLeft + (this._scrollLeft || 0)) / this.data.scale;
      this._pinchContentY = (cy - this._scrollRectTop + (this._scrollTop || 0)) / this.data.scale;
    }
  },

  onTouchMove(e) {
    if (!this._pinchStartDist) return;
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!this._pinchStartDist) return;
      const ratio = dist / this._pinchStartDist;
      const newScale = Math.min(4, Math.max(1, this._pinchStartScale * ratio));
      if (Math.abs(newScale - this.data.scale) > 0.01) {
        this._applyScale(newScale, false);
      }
    }
  },

  // 统一设置缩放 + 画布尺寸；keepFocus 为 true 时保持双指中心点不动
  _applyScale(newScale, keepFocus) {
    const viewW = this.data.viewW;
    const viewH = this.data.viewH;
    newScale = Math.min(4, Math.max(1, newScale));

    const patch = {
      scale: newScale,
      canvasW: Math.round(viewW * newScale),
      canvasH: Math.round(viewH * newScale)
    };

    if (keepFocus && this._pinchContentX != null) {
      const left = Math.max(0, this._pinchContentX * newScale - this._pinchFocusX + this._scrollRectLeft);
      const top = Math.max(0, this._pinchContentY * newScale - this._pinchFocusY + this._scrollRectTop);
      patch.scrollLeft = Math.round(left);
      patch.scrollTop = Math.round(top);
    }

    this.setData(patch);
  },

  // 记录 scroll-view 的滚动位置（不 setData，避免与 scroll-left 绑定互相触发）
  onScroll(e) {
    this._scrollLeft = e.detail.scrollLeft;
    this._scrollTop = e.detail.scrollTop;
  },

  onTouchEnd() {
    if (this._pinchStartDist) {
      this._pinchStartDist = 0;
      // 吸附到 0.5 步进，避免 1.37 这种零碎倍数
      const snapped = Math.round(this.data.scale * 2) / 2;
      const clamped = Math.min(4, Math.max(1, snapped));
      this._pinchContentX = null;
      this._pinchContentY = null;
      if (Math.abs(clamped - this.data.scale) > 0.001) {
        this._applyScale(clamped, true);
        setTimeout(() => this.draw(), 50);
      } else {
        setTimeout(() => this.draw(), 40);
      }
    }
  },

  // 从云端 seed_<key> 读取作者与点赞数（内置图纸已作为「冯」的社区作品发布）
  loadAuthorAndLikes() {
    const raw = this._raw;
    if (!raw) return;
    const docId = 'seed_' + raw.key;
    wx.cloud.database()
      .collection('templates')
      .doc(docId)
      .get()
      .then(res => {
        const d = res && res.data;
        if (!d) return;
        const ui = d.userInfo || {};
        const name = d.author || ui.nickName || '悠米拼豆';
        this.setData({
          author: {
            name,
            avatar: d.authorAvatar || ui.avatarUrl || '',
            initial: name.charAt(0)
          },
          likes: d.likeCount || d.heat || 0
        });
      })
      .catch(() => {
        // 云端还没发布（冯未打开过 App）时，留空即可，不阻塞浏览
      });
  },

  // 收藏 / 取消收藏
  // 双写：本地 Storage 立即生效（离线可用）+ 云端 users.collectedTemplates（跨设备 /「我的收藏」页读取）
  toggleFav() {
    const raw = this._raw;
    if (!raw) return;
    const favs = wx.getStorageSync('pattern_favs') || [];
    const idx = favs.indexOf(raw.key);
    const isFav = idx < 0;
    if (isFav) favs.push(raw.key);
    else favs.splice(idx, 1);
    wx.setStorageSync('pattern_favs', favs);
    wx.vibrateShort({ type: 'light' });
    wx.showToast({ title: isFav ? '已收藏' : '已取消收藏', icon: 'none' });
    this.setData({ isFav });

    // 同步云端（失败不影响本地体验）
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'setCollect',
        templateId: 'seed_' + raw.key,
        collected: isFav
      }
    }).catch(() => {});
  },

  // 点赞：写入云端 seed_<key>（templates.heat/likeCount + community_posts.likes）
  onLike(e) {
    const raw = this._raw;
    if (!raw) return;
    const newLikes = this.data.likes + 1;
    this.setData({ likes: newLikes, isLiked: true });
    wx.vibrateShort({ type: 'medium' });

    // 粒子特效（简化自社区详情页）
    const emojis = ['❤️', '✨', '🌸', '🐰', '🐱', '🍭', '🎀', '🦄', '🍓', '🔥'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    let touchX, touchY;
    if (e && e.touches && e.touches.length > 0) {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    } else if (e && e.detail && e.detail.x) {
      touchX = e.detail.x;
      touchY = e.detail.y;
    } else {
      const sysInfo = wx.getSystemInfoSync();
      touchX = sysInfo.windowWidth * 0.5;
      touchY = sysInfo.windowHeight - 160;
    }
    const randomX = (Math.random() - 0.5) * 160;
    const jumpHeight = -150 - Math.random() * 300;
    const rotation = (randomX > 0 ? 1 : -1) * (360 + Math.random() * 360);
    const duration = 1.5 + Math.random();

    const list = this.data.particleList.slice();
    list.push({
      id: Date.now() + Math.random(),
      emoji: randomEmoji,
      style: `left: ${touchX}px; top: ${touchY}px; --tx: ${randomX}rpx; --ty: ${jumpHeight}rpx; --rot: ${rotation}deg; --duration: ${duration}s;`
    });
    this.setData({ particleList: list });
    setTimeout(() => {
      const cur = this.data.particleList.slice();
      const i = cur.findIndex(p => p.id === list[list.length - 1].id);
      if (i !== -1) {
        cur.splice(i, 1);
        this.setData({ particleList: cur });
      }
    }, duration * 1000 + 100);

    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'likeTemplate', templateId: 'seed_' + raw.key }
    }).then(res => {
      const r = res && res.result;
      if (r && r.code === 1001) {
        // 每日额度用完
        this.rollbackLike(newLikes);
        wx.showToast({ title: r.msg || '这个作品你今天已经点满 100 次啦', icon: 'none', duration: 2000 });
        return;
      }
      if (r && r.code !== 0) {
        throw new Error(r.msg || '云函数错误');
      }
    }).catch(err => {
      console.error('点赞同步失败', err);
      this.rollbackLike(newLikes);
    });
  },

  rollbackLike(newLikes) {
    this.setData({ likes: newLikes - 1, isLiked: false });
  },

  onShow() {
    // 从拼豆模式等页面返回时，canvas 内容可能已被回收，重绘一次
    if (this._raw && this.canvasNode) {
      setTimeout(() => this.draw(), 60);
    }
  },

  onReady() {
    // 等一帧确保 canvas 拿到 setData 后的尺寸
    setTimeout(() => {
      this.draw();
      // 首次进入才弹看图引导，看过就记下来不再弹
      if (!wx.getStorageSync('pd_pattern_guide_seen')) {
        this.setData({ showGuide: true });
      }
    }, 80);
    // 记录 scroll-view 在页面中的坐标，双指缩放时用来保持焦点
    wx.createSelectorQuery().select('.canvas-scroll').boundingClientRect(rect => {
      if (rect) {
        this._scrollRectLeft = rect.left;
        this._scrollRectTop = rect.top;
      }
    }).exec();
  },

  // 关闭首次引导并记录，下次不再弹
  closeGuide() {
    this.setData({ showGuide: false });
    wx.setStorageSync('pd_pattern_guide_seen', '1');
  },

  draw(retry) {
    const raw = this._raw;
    if (!raw) return;
    const q = wx.createSelectorQuery();
    q.select('#patternCanvas').fields({ node: true, size: true }).exec(res => {
      const info = res && res[0];
      if (!info || !info.node || !info.width) {
        if (!retry) setTimeout(() => this.draw(true), 200);
        return;
      }
      const canvas = info.node;
      const ctx = canvas.getContext('2d');
      const dpr = (wx.getSystemInfoSync().pixelRatio || 2);
      canvas.width = info.width * dpr;
      canvas.height = info.height * dpr;
      ctx.scale(dpr, dpr);

      const showGrid = this.data.showGrid;
      const showCode = this.data.showCode;
      // cell 按 canvas 实际宽度算（缩放后自动变大）
      const cell = info.width / raw.w;
      // 色号只在格子够大时画，否则糊成一团（48×48 缩放前 cell 太小）
      const codeReadable = showCode && cell >= 14;
      const fontSize = Math.min(13, Math.max(8, cell * 0.34));

      ctx.fillStyle = '#FFFDFB';
      ctx.fillRect(0, 0, info.width, info.height);

      for (let y = 0; y < raw.h; y++) {
        for (let x = 0; x < raw.w; x++) {
          const ch = raw.cells.charAt(y * raw.w + x);
          const idx = DIGITS.indexOf(ch);
          const x0 = x * cell;
          const y0 = y * cell;
          if (idx < 0) {
            ctx.fillStyle = '#FBF7F2';
            ctx.fillRect(x0, y0, cell, cell);
          } else {
            ctx.fillStyle = raw.hexes[idx];
            ctx.fillRect(x0, y0, cell, cell);
            if (codeReadable) {
              const lum = this._lum(raw.hexes[idx]);
              ctx.fillStyle = lum > 150 ? '#3A2A2E' : '#FFFDFB';
              ctx.font = '600 ' + fontSize.toFixed(0) + 'px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(raw.palette[idx], x0 + cell / 2, y0 + cell / 2);
            }
          }
          // 网格线（可关）：5 格加粗
          if (showGrid) {
            ctx.strokeStyle = (x % 5 === 0 || y % 5 === 0) ? '#C9B8AF' : '#EADFD7';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x0, y0, cell, cell);
          }
        }
      }
      this.canvasNode = canvas;
    });
  },

  _lum(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (r + g + b) / 3;
  },

  copyList() {
    const raw = this._raw;
    if (!raw) return;
    const lines = [raw.name + ' 拼豆图纸（' + raw.w + 'x' + raw.h + '，共 ' + raw.beadCount + ' 颗）'];
    raw.palette.forEach((code, i) => {
      lines.push(code + '  ' + raw.counts[i] + '颗');
    });
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '采购单已复制', icon: 'none' })
    });
  },

  // 把图纸导入「拼豆模式」：cells 编码 -> pixelHexes（每格 hex 的一维数组，按行展开）
  goToBeadMode() {
    const raw = this._raw;
    if (!raw) return;
    wx.vibrateShort({ type: 'light' });

    const total = raw.w * raw.h;
    const pixelHexes = new Array(total);
    for (let i = 0; i < total; i++) {
      const ch = raw.cells.charAt(i);
      if (ch === '.' || ch === ' ') {
        pixelHexes[i] = '';
        continue;
      }
      const idx = DIGITS.indexOf(ch);
      pixelHexes[i] = (idx >= 0 && idx < raw.hexes.length) ? raw.hexes[idx] : '';
    }

    const app = getApp();
    if (app && app.globalData) {
      app.globalData.beadSession = {
        pixelHexes,
        gridSize: raw.w,
        gridHeight: raw.h,
        selectedBrand: 'MARD',
        showGrid: true,
        showRuler: true,
        showCellCodes: true
      };
    }

    wx.navigateTo({
      url: '/pages/bead-mode/bead-mode',
      fail: () => wx.showToast({ title: '无法进入拼豆模式', icon: 'none' })
    });
  },

  saveImage() {
    if (!this.canvasNode) {
      wx.showToast({ title: '图纸还没画好', icon: 'none' });
      return;
    }
    const raw = this._raw;
    wx.canvasToTempFilePath({
      canvas: this.canvasNode,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已存到相册', icon: 'none' }),
          fail: () => wx.showToast({ title: '保存失败，请允许相册权限', icon: 'none' })
        });
      },
      fail: () => wx.showToast({ title: '生成图片失败', icon: 'none' })
    });
  },

  onShareAppMessage() {
    const raw = this._raw || {};
    const key = raw.key || '';
    const app = getApp();
    const inv = app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.inviteCode ? String(app.globalData.userInfo.inviteCode) : '';
    const invPart = inv ? `&inv=${encodeURIComponent(inv)}` : '';
    const path = '/pages/pattern-detail/pattern-detail?key=' + encodeURIComponent(key) + invPart;
    const out = {
      title: raw.name ? raw.name + ' 拼豆图纸' : '拼豆图纸',
      path
    };
    if (key) out.imageUrl = '/images/patterns/' + key + '.png';
    return out;
  }
});
