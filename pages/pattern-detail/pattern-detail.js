const presets = require('../../data/pattern-presets.js');

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

Page({
  data: {
    p: null,
    rows: [],
    canvasW: 0,
    canvasH: 0,
    isFav: false
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
