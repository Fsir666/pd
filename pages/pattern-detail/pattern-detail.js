const presets = require('../../data/pattern-presets.js');

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

Page({
  data: {
    p: null,
    rows: [],
    canvasW: 0,
    canvasH: 0,
    isFav: false,
    // 作者信息（来自云端 seed_<key> 记录）
    author: { name: '', avatar: '', initial: '' },
    // 点赞
    likes: 0,
    isLiked: false,
    particleList: []
  },

  onLoad(query) {
    const key = query && query.key;
    const raw = presets.find(x => x.key === key) || presets[0];
    this._raw = raw;

    const sysInfo = wx.getSystemInfoSync();
    const winW = sysInfo.windowWidth || 375;
    const canvasW = Math.floor(winW * 0.92);
    const cell = canvasW / raw.w;
    const canvasH = Math.ceil(cell * raw.h);

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
      canvasW,
      canvasH,
      isFav: (wx.getStorageSync('pattern_favs') || []).indexOf(raw.key) >= 0
    });

    this.loadAuthorAndLikes();
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

  // 收藏 / 取消收藏（本地存储，内置图纸没有云端数据）
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

  onReady() {
    // 等一帧确保 canvas 拿到 setData 后的尺寸
    setTimeout(() => this.draw(), 80);
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

      const cell = info.width / raw.w;
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
            if (cell >= 16) {
              const lum = this._lum(raw.hexes[idx]);
              ctx.fillStyle = lum > 150 ? '#3A2A2E' : '#FFFDFB';
              ctx.font = '600 ' + Math.min(11, cell * 0.36).toFixed(0) + 'px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(raw.palette[idx], x0 + cell / 2, y0 + cell / 2);
            }
          }
          ctx.strokeStyle = (x % 5 === 0 || y % 5 === 0) ? '#C9B8AF' : '#EADFD7';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x0, y0, cell, cell);
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
    return {
      title: raw.name ? raw.name + ' 拼豆图纸' : '拼豆图纸',
      path: '/pages/pattern-detail/pattern-detail?key=' + (raw.key || '')
    };
  }
});
