const colorMap = require('../../../data/color-mapping.js');

const BRANDS = ['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'];
const KEY_INVENTORY = 'warehouse_inventory_v1';
const KEY_THRESHOLDS = 'warehouse_thresholds_v1';
const KEY_LOGS = 'warehouse_logs_v1';
const KEY_LAST_BRAND = 'warehouse_last_brand_v1';
const COLL_WAREHOUSE = 'warehouse_data';
const db = wx.cloud.database();

const clampInt = (n, min) => {
  const v = parseInt(String(n == null ? '' : n), 10);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, v);
};

const pad2 = (n) => String(n).padStart(2, '0');
const formatTime = (ts) => {
  const d = new Date(ts);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const formatCount = (n) => {
  const v = clampInt(n, 0);
  if (v >= 10000) {
    const w = (v / 10000).toFixed(1).replace(/\.0$/, '');
    return `${w}w`;
  }
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const formatPercent1 = (num) => {
  const v = Math.max(0, Number(num) || 0);
  return (Math.round(v * 10) / 10).toFixed(1);
};

Page({
  data: {
    brands: BRANDS,
    selectedBrand: 'MARD',
    sortMode: 'code',
    searchQuery: '',
    defaultThreshold: 0,
    lowCount: 0,
    brandTotal: 0,
    allTotal: 0,
    items: [],
    logs: [],
    logScope: 'brand',
    logSearchQuery: '',
    currentTab: 'inventory',
    statsOkBeads: 0,
    statsLowBeads: 0,
    _chartsReady: false,
    pieSelectedIndex: -1,
    pieFocusedIndex: -1,
    editorVisible: false,
    editorType: 'count',
    editorCode: '',
    editorValue: 0,
    batchVisible: false,
    batchMode: false,
    batchValue: 0,
    batchDialogVisible: false,
    selectedCount: 0,
    selectAllText: '全选',
    seriesList: [],
    selectedSeries: 'ALL',
    itemActionVisible: false,
    itemActionCode: '',
    itemActionCount: 0,
    itemActionThreshold: 0,
    logDialogVisible: false,
    logDialogCode: '',
    itemLogs: []
  },

  onLoad() {
    const lastBrand = wx.getStorageSync(KEY_LAST_BRAND);
    const brand = BRANDS.includes(lastBrand) ? lastBrand : 'MARD';
    this._inventory = wx.getStorageSync(KEY_INVENTORY) || {};
    this._thresholds = wx.getStorageSync(KEY_THRESHOLDS) || {};
    this._logs = wx.getStorageSync(KEY_LOGS) || [];
    this._catalogByBrand = this._buildCatalogByBrand();
    this._selectedSet = new Set();
    this._prevLowCount = 0;
    this.setData({ selectedBrand: brand }, () => {
      this._updateSeriesList();
      this._syncBrandThreshold();
      this._refreshAll();
      // Initialize from cloud
      this._initCloudData();
    });
  },

  _updateSeriesList() {
    const brand = this.data.selectedBrand;
    const catalog = (this._catalogByBrand && this._catalogByBrand[brand]) || [];
    const seriesSet = new Set();
    let hasNumeric = false;
    
    catalog.forEach(item => {
      const code = item.code || '';
      // Check for letter prefix
      const match = code.match(/^([A-Z]+)/);
      if (match) {
        seriesSet.add(match[1]);
      } else if (/^\d/.test(code)) {
        // Starts with a digit
        hasNumeric = true;
      }
    });

    // Mapping for series descriptions
    const descMap = {
      'H': '（H1为透明色）',
      'M': '（低饱和莫兰迪）',
      'P': '（珠光）',
      'Q': '（温变）',
      'R': '（透明果冻水晶）',
      'T': '（透明）',
      'Y': '（夜光）',
      'ZG': '（光变）'
    };

    const list = Array.from(seriesSet).sort().map(s => {
      const desc = descMap[s] || '';
      return { key: s, label: `${s} 系列色卡${desc}` };
    });
    
    // Add "Other/Numeric" category if numeric codes exist
    if (hasNumeric) {
      list.push({ key: 'NUMERIC', label: '数字系列色卡' });
    }
    
    list.unshift({ key: 'ALL', label: '全部色卡' });
    this.setData({ seriesList: list, selectedSeries: 'ALL' });
  },

  async _initCloudData() {
    wx.showLoading({ title: '同步数据中' });
    try {
      // 1. Check cloud for existing data
      const res = await db.collection(COLL_WAREHOUSE).get();
      if (res.data && res.data.length > 0) {
        const doc = res.data[0];
        console.log('[Warehouse] Loaded from cloud:', doc._id);
        this._docId = doc._id;
        // Merge cloud data (cloud source of truth)
        this._inventory = doc.inventory || {};
        this._thresholds = doc.thresholds || {};
        this._logs = doc.logs || [];
        
        // Update local cache
        wx.setStorageSync(KEY_INVENTORY, this._inventory);
        wx.setStorageSync(KEY_THRESHOLDS, this._thresholds);
        wx.setStorageSync(KEY_LOGS, this._logs);
        
        // Refresh UI
        this._refreshAll();
      } else {
        // 2. No cloud data, try to migrate local data
        console.log('[Warehouse] No cloud data, migrating local...');
        const data = {
          inventory: this._inventory,
          thresholds: this._thresholds,
          logs: this._logs,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        };
        const addRes = await db.collection(COLL_WAREHOUSE).add({ data });
        this._docId = addRes._id;
        console.log('[Warehouse] Migrated to cloud:', addRes._id);
      }
    } catch (err) {
      console.error('[Warehouse] Sync failed:', err);
      if (err.errMsg && (err.errMsg.includes('Collection not found') || err.errMsg.includes('-502001'))) {
         wx.showModal({
           title: '需创建集合',
           content: '请在云开发控制台创建名为 "warehouse_data" 的集合以保存数据。',
           showCancel: false
         });
      }
    } finally {
      wx.hideLoading();
    }
  },

  _saveToCloud() {
    if (!this._docId) return;
    // Debounce save
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      wx.showNavigationBarLoading();
      db.collection(COLL_WAREHOUSE).doc(this._docId).update({
        data: {
          inventory: this._inventory,
          thresholds: this._thresholds,
          logs: this._logs,
          updateTime: db.serverDate()
        }
      }).then(() => {
        console.log('[Warehouse] Auto-saved to cloud');
        wx.hideNavigationBarLoading();
      }).catch(err => {
        console.error('[Warehouse] Auto-save failed', err);
        wx.hideNavigationBarLoading();
      });
    }, 2000); // 2s debounce
  },

  onShow() {
    this._refreshAll();
  },

  _buildCatalogByBrand() {
    const out = {};
    for (let i = 0; i < BRANDS.length; i++) out[BRANDS[i]] = [];
    const seenByBrand = {};
    for (let i = 0; i < BRANDS.length; i++) seenByBrand[BRANDS[i]] = new Set();

    const entries = Object.entries(colorMap || {});
    for (let i = 0; i < entries.length; i++) {
      const hex = String(entries[i][0] || '').toUpperCase();
      const brands = entries[i][1] || {};
      for (let b = 0; b < BRANDS.length; b++) {
        const brand = BRANDS[b];
        const code = String(brands[brand] || '').trim();
        if (!code || code === '-') continue;
        const seen = seenByBrand[brand];
        if (seen.has(code)) continue;
        seen.add(code);
        out[brand].push({ code, hex });
      }
    }
    for (let b = 0; b < BRANDS.length; b++) {
      const brand = BRANDS[b];
      out[brand].sort((a, c) => String(a.code).localeCompare(String(c.code)));
    }
    return out;
  },

  _getBrandInventory(brand) {
    const inv = this._inventory && this._inventory[brand];
    return inv && typeof inv === 'object' ? inv : {};
  },

  _getBrandThresholds(brand) {
    const t = this._thresholds && this._thresholds[brand];
    if (t && typeof t === 'object') return t;
    return { defaultThreshold: 0, overrides: {} };
  },

  _setBrandThresholds(brand, next) {
    if (!this._thresholds || typeof this._thresholds !== 'object') this._thresholds = {};
    this._thresholds[brand] = next;
    wx.setStorageSync(KEY_THRESHOLDS, this._thresholds);
    this._saveToCloud();
  },

  _setInventory(brand, code, count) {
    if (!this._inventory || typeof this._inventory !== 'object') this._inventory = {};
    if (!this._inventory[brand] || typeof this._inventory[brand] !== 'object') this._inventory[brand] = {};
    this._inventory[brand][code] = count;
    wx.setStorageSync(KEY_INVENTORY, this._inventory);
    this._saveToCloud();
  },

  _pushLog(entry) {
    const logs = Array.isArray(this._logs) ? this._logs : [];
    logs.unshift(entry);
    if (logs.length > 300) logs.length = 300;
    this._logs = logs;
    wx.setStorageSync(KEY_LOGS, logs);
    this._saveToCloud();
  },

  _syncBrandThreshold() {
    const brand = this.data.selectedBrand;
    const t = this._getBrandThresholds(brand);
    const dt = clampInt(t.defaultThreshold, 0);
    if (t.defaultThreshold !== dt) {
      t.defaultThreshold = dt;
      this._setBrandThresholds(brand, t);
    }
    this.setData({ defaultThreshold: dt });
  },

  _refreshAll() {
    const brand = this.data.selectedBrand;
    wx.setStorageSync(KEY_LAST_BRAND, brand);
    const items = this._buildItems(brand);
    const totals = this._computeTotals(items);
    const logs = this._buildLogs();
    this.setData({
      items: items.list,
      lowCount: totals.lowCount,
      brandTotal: totals.brandTotal,
      allTotal: totals.allTotal,
      logs
    });
    if (totals.lowCount > 0 && this._prevLowCount !== totals.lowCount) {
      wx.showToast({
        title: `有 ${totals.lowCount} 个颜色低于阈值`,
        icon: 'none',
        duration: 1600
      });
    }
    this._prevLowCount = totals.lowCount;
    if (this.data.currentTab === 'stats') {
      this._computeStats();
      this._initCharts();
    }
  },

  _buildItems(brand) {
    const catalog = (this._catalogByBrand && this._catalogByBrand[brand]) || [];
    const inv = this._getBrandInventory(brand);
    const t = this._getBrandThresholds(brand);
    const dt = clampInt(t.defaultThreshold, 0);
    const overrides = (t && t.overrides && typeof t.overrides === 'object') ? t.overrides : {};
    const q = String(this.data.searchQuery || '').trim().toUpperCase();
    const series = this.data.selectedSeries;

    const list = [];
    for (let i = 0; i < catalog.length; i++) {
      const code = catalog[i].code;
      if (q && String(code).toUpperCase().indexOf(q) === -1) continue;
      
      // Series filter
      if (series !== 'ALL') {
        if (series === 'NUMERIC') {
          // Keep if starts with digit
          if (!/^\d/.test(code)) continue;
        } else {
          // Standard prefix match
          if (!code.startsWith(series)) continue;
        }
      }
      
      const count = clampInt(inv[code], 0);
      const thRaw = overrides[code];
      const threshold = thRaw == null ? dt : clampInt(thRaw, 0);
      const isLow = threshold > 0 && count < threshold;
      const selected = this._selectedSet && this._selectedSet.has(code);
      list.push({
        key: code,
        code,
        hex: catalog[i].hex,
        count,
        threshold,
        isLow,
        selected
      });
    }

    const mode = this.data.sortMode;
    if (mode === 'count') {
      list.sort((a, b) => b.count - a.count || String(a.code).localeCompare(String(b.code)));
    } else {
      list.sort((a, b) => String(a.code).localeCompare(String(b.code)) || b.count - a.count);
    }

    return { list };
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.currentTab) return;
    this.setData({ currentTab: tab }, () => {
      if (tab === 'stats') {
        this._computeStats();
        this._initCharts();
      }
    });
  },

  _computeTotals(brandItems) {
    const brandTotal = (brandItems.list || []).reduce((sum, it) => sum + (it.count || 0), 0);
    let allTotal = 0;
    const inv = this._inventory && typeof this._inventory === 'object' ? this._inventory : {};
    const brands = Object.keys(inv);
    for (let i = 0; i < brands.length; i++) {
      const m = inv[brands[i]];
      if (!m || typeof m !== 'object') continue;
      const codes = Object.keys(m);
      for (let j = 0; j < codes.length; j++) {
        allTotal += clampInt(m[codes[j]], 0);
      }
    }
    const lowCount = (brandItems.list || []).reduce((sum, it) => sum + (it.isLow ? 1 : 0), 0);
    return { brandTotal, allTotal, lowCount };
  },

  _computeStats() {
    const totalsByBrand = {};
    for (let i = 0; i < BRANDS.length; i++) {
      const b = BRANDS[i];
      const inv = this._getBrandInventory(b);
      let sum = 0;
      const codes = Object.keys(inv || {});
      for (let j = 0; j < codes.length; j++) {
        sum += clampInt(inv[codes[j]], 0);
      }
      totalsByBrand[b] = sum;
    }
    const brand = this.data.selectedBrand;
    const inv = this._getBrandInventory(brand);
    const t = this._getBrandThresholds(brand);
    const dt = clampInt(t.defaultThreshold, 0);
    const overrides = (t && t.overrides && typeof t.overrides === 'object') ? t.overrides : {};
    const hexByCode = {};
    const catalog = (this._catalogByBrand && this._catalogByBrand[brand]) || [];
    for (let i = 0; i < catalog.length; i++) hexByCode[catalog[i].code] = catalog[i].hex;
    const counts = [];
    const lowList = [];
    const codes = Object.keys(inv || {});
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const count = clampInt(inv[code], 0);
      const thRaw = overrides[code];
      const threshold = thRaw == null ? dt : clampInt(thRaw, 0);
      if (count > 0) counts.push({ label: code, value: count, hex: hexByCode[code] || '#ccc' });
      if (threshold > 0 && count < threshold) {
        const shortage = threshold - count;
        lowList.push({ code, count, threshold, hex: hexByCode[code] || '#ccc', shortage });
      }
    }
    counts.sort((a, b) => b.value - a.value);
    const TOP = 8;
    const top = counts.slice(0, TOP);
    const otherSum = counts.slice(TOP).reduce((s, it) => s + it.value, 0);
    const slices = top.slice();
    if (otherSum > 0) slices.push({ label: '其他', value: otherSum, hex: '#E5E5EA' });
    const totalVal = Math.max(1, slices.reduce((s, it) => s + it.value, 0));
    slices.forEach(it => {
      it.percent = formatPercent1(it.value / totalVal * 100);
    });
    lowList.sort((a, b) => b.shortage - a.shortage || a.count - b.count);
    const lowTop = lowList.slice(0, 10);
    this._totalsByBrand = totalsByBrand;
    this._pieSlices = slices;
    this.setData({ statsSlices: slices, statsLowList: lowTop });
  },

  _initCharts() {
    const sys = wx.getSystemInfoSync();
    const dpr = sys.pixelRatio || 1;
    const query = wx.createSelectorQuery();
    query.select('#barCanvas').fields({ node: true, size: true }).select('#pieCanvas').fields({ node: true, size: true, rect: true }).exec((res) => {
      if (!res || !res[0] || !res[1]) return;
      const barNode = res[0].node;
      const barW = res[0].width;
      const barH = res[0].height;
      const pieNode = res[1].node;
      const pieW = res[1].width;
      const pieH = res[1].height;
      barNode.width = Math.floor(barW * dpr);
      barNode.height = Math.floor(barH * dpr);
      pieNode.width = Math.floor(pieW * dpr);
      pieNode.height = Math.floor(pieH * dpr);
      const barCtx = barNode.getContext('2d');
      const pieCtx = pieNode.getContext('2d');
      barCtx.scale(dpr, dpr);
      pieCtx.scale(dpr, dpr);
      // Save bbox for hit test
      this._pieBBox = {
        left: res[1].left,
        top: res[1].top,
        width: pieW,
        height: pieH,
        dpr
      };
      this._pieCtx = pieCtx;
      this._pieSize = { width: pieW, height: pieH };
      this._drawBarChart(barCtx, barW, barH);
      this._drawPieChart(pieCtx, pieW, pieH, this._animProgress || 1);
    });
  },

  _drawBarChart(ctx, width, height) {
    const padding = 24;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, width, height);
    const brands = BRANDS.slice();
    const totals = brands.map(b => (this._totalsByBrand && this._totalsByBrand[b]) || 0);
    const maxVal = Math.max(1, ...totals);
    const chartH = height - padding * 2 - 20;
    const chartW = width - padding * 2;
    const barWidth = Math.max(12, Math.floor((chartW - (brands.length + 1) * 12) / brands.length));
    const colors = {
      'MARD': '#FF6A00',
      'COCO': '#AF52DE',
      '漫漫': '#54A0FF',
      '盼盼': '#34C759',
      '咪小窝': '#FF2D55'
    };
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < brands.length; i++) {
      const x = padding + 12 + i * (barWidth + 12);
      const val = totals[i];
      const h = Math.round((val / maxVal) * chartH);
      const y = padding + (chartH - h);
      ctx.fillStyle = colors[brands[i]] || '#FF6A00';
      const radius = 6;
      // rounded rect bar
      const bw = barWidth;
      ctx.beginPath();
      const r = Math.min(radius, bw / 2, h);
      const btm = y + h;
      ctx.moveTo(x, btm);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, btm);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(String(val), x + bw / 2, y - 16);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(brands[i], x + bw / 2, padding + chartH + 4);
    }
  },

  _drawPieChart(ctx, width, height, progress = 1) {
    const slices = Array.isArray(this._pieSlices) ? this._pieSlices : [];
    let total = 0;
    for (let i = 0; i < slices.length; i++) total += clampInt(slices[i].value, 0);
    const drawTotal = total; // Real total for display
    total = Math.max(1, total); // Avoid divide by zero for drawing angles
    const cx = width / 2;
    const cy = height / 2 + 8;
    const rBase = Math.min(width, height) / 2 - 20;
    const r = rBase * (0.96 + 0.04 * progress);
    const ri = r * 0.6;
    ctx.clearRect(0, 0, width, height);
    let start = -Math.PI / 2;
    const gap = 0.015;
    this._pieGeo = [];
    for (let i = 0; i < slices.length; i++) {
      const val = clampInt(slices[i].value, 0);
      const ang = (val / total) * Math.PI * 2;
      const sa = start + gap * 0.5;
      const ea = start + ang - gap * 0.5;
      const color = slices[i].color || slices[i].hex || '#FF6A00';
      // Handle focus/highlight state
      let useColor = color;
      if (this.data.pieFocusedIndex >= 0 && i !== this.data.pieFocusedIndex) {
        useColor = '#F2F2F7'; // dim others
      }
      const drawSlice = (offsetX = 0, offsetY = 0, shadow = false) => {
        ctx.save();
        if (shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.16)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.08)';
          ctx.shadowBlur = 8;
        }
        ctx.translate(offsetX, offsetY);
        ctx.beginPath();
        ctx.arc(cx, cy, r, sa, ea);
        ctx.arc(cx, cy, ri, ea, sa, true);
        ctx.closePath();
        ctx.fillStyle = useColor;
        ctx.fill();
        // glossy overlay (only if not dimmed)
        if (this.data.pieFocusedIndex < 0 || i === this.data.pieFocusedIndex) {
          const grad = ctx.createRadialGradient(cx, cy, ri, cx, cy, r);
          grad.addColorStop(0, 'rgba(255,255,255,0.06)');
          grad.addColorStop(1, 'rgba(0,0,0,0.04)');
          ctx.fillStyle = grad;
          ctx.fill();
        }
        ctx.restore();
        // outer highlight
        ctx.beginPath();
        ctx.strokeStyle = (this.data.pieFocusedIndex < 0 || i === this.data.pieFocusedIndex) ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.arc(cx + offsetX, cy + offsetY, r, sa, ea);
        ctx.stroke();
      };
      // normal draw first
      drawSlice();
      this._pieGeo.push({
        start: sa,
        end: ea,
        label: slices[i].label,
        value: val,
        color: useColor,
        rawColor: color
      });
      start += ang;
    }
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.arc(cx, cy, ri, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 2;
    ctx.arc(cx, cy, ri + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.86)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(this.data.selectedBrand, cx, cy - 14);
    ctx.font = '12px sans-serif';
    const totalTxt = `总计 ${formatCount(drawTotal)} 颗`;
    ctx.fillText(totalTxt, cx, cy + 2);
    if (Number.isInteger(this._pieSelectedIndex) && this._pieSelectedIndex >= 0 && this._pieSelectedIndex < this._pieGeo.length) {
      const seg = this._pieGeo[this._pieSelectedIndex];
      const mid = (seg.start + seg.end) / 2;
      // pop-out re-draw with slight offset
      const off = 6 * progress;
      const ox = off * Math.cos(mid);
      const oy = off * Math.sin(mid);
      // redraw selected slice on top with stronger shadow
      ctx.save();
      const drawSelected = () => {
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur = 14;
        ctx.translate(ox, oy);
        ctx.beginPath();
        ctx.arc(cx, cy, r, seg.start, seg.end);
        ctx.arc(cx, cy, ri, seg.end, seg.start, true);
        ctx.closePath();
        ctx.fillStyle = seg.color; // Use the color from geo, which is already dimmed/highlighted
        ctx.fill();
      };
      drawSelected();
      ctx.restore();
      // center percent
      const totalVal = Math.max(1, total);
      const pct = seg.value / totalVal * 100;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`占比 ${formatPercent1(pct)}%`, cx, cy + 20);
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 1.5;
      const x1 = cx + ox + (ri + 6) * Math.cos(mid);
      const y1 = cy + oy + (ri + 6) * Math.sin(mid);
      const x2 = cx + ox + (r + 10) * Math.cos(mid);
      const y2 = cy + oy + (r + 10) * Math.sin(mid);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = seg.color;
      ctx.arc(x2, y2, 3, 0, Math.PI * 2);
      ctx.fill();
      const isRight = Math.cos(mid) >= 0;
      const hx = x2 + (isRight ? 14 : -14);
      const hy = y2;
      const text = `${seg.label} ${seg.value} 颗`;
      ctx.font = '12px sans-serif';
      const tw = ctx.measureText(text).width;
      const th = 18;
      const rx = isRight ? hx : hx - tw - 14;
      const ry = hy - th / 2;
      const rr = 8;
      const drawRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      drawRect(rx, ry, tw + 14, th, rr);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, rx + 7, ry + th / 2);
      ctx.restore();
    }
  },

  onPieTouch(e) {
    const bbox = this._pieBBox;
    if (!bbox || !this._pieGeo || !this._pieGeo.length) return;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e.detail || {};
    let lx, ly;
    if (touch.x != null && touch.y != null) {
      // Canvas 提供的是相对坐标
      lx = touch.x;
      ly = touch.y;
    } else if (touch.pageX != null && touch.pageY != null) {
      lx = touch.pageX - bbox.left;
      ly = touch.pageY - bbox.top;
    } else {
      return;
    }
    const cx = bbox.width / 2;
    const cy = bbox.height / 2 + 8;
    const r = Math.min(bbox.width, bbox.height) / 2 - 20;
    const ri = r * 0.6;
    const dx = lx - cx;
    const dy = ly - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // widen tolerance for hit zone
    if (dist < ri - 16 || dist > r + 20) {
      if (this._pieSelectedIndex != null) {
        this._pieSelectedIndex = -1;
        this.setData({ pieSelectedIndex: -1 }); // sync to wxml
        this._redrawPieOnly();
      }
      return;
    }
    let ang = Math.atan2(dy, dx);
    // normalize to same coordinate system as drawing start (-PI/2 is 0)
    // Convert to [0, 2PI) with zero at -PI/2
    if (ang < -Math.PI / 2) ang += Math.PI * 2;
    // Find segment
    let hit = -1;
    for (let i = 0; i < this._pieGeo.length; i++) {
      const seg = this._pieGeo[i];
      let s = seg.start;
      let e2 = seg.end;
      if (e2 < s) e2 += Math.PI * 2;
      let a = ang;
      if (a < s) a += Math.PI * 2;
      if (a >= s && a <= e2) {
        hit = i;
        break;
      }
    }
    this._pieSelectedIndex = hit;
    this.setData({ pieSelectedIndex: hit }); // sync to wxml
    this._animProgress = 0;
    this._animatePie();
  },

  onLegendTap(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx === undefined) return;
    
    // If long-pressed focused mode is active, clear it first
    if (this.data.pieFocusedIndex >= 0) {
      this.setData({ pieFocusedIndex: -1 });
    }

    if (this._pieSelectedIndex === idx) {
      this._pieSelectedIndex = -1;
      this.setData({ pieSelectedIndex: -1 });
    } else {
      this._pieSelectedIndex = idx;
      this.setData({ pieSelectedIndex: idx });
    }
    
    this._animProgress = 0;
    this._animatePie();
  },

  onLegendLongPress(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx === undefined) return;
    
    // Toggle focus mode
    if (this.data.pieFocusedIndex === idx) {
      this.setData({ pieFocusedIndex: -1 });
    } else {
      this.setData({ pieFocusedIndex: idx });
      // Also select it to show details
      this._pieSelectedIndex = idx;
      this.setData({ pieSelectedIndex: idx });
    }
    
    this._redrawPieOnly();
  },

  _redrawPieOnly() {
    if (!this._pieCtx || !this._pieSize) return;
    this._drawPieChart(this._pieCtx, this._pieSize.width, this._pieSize.height, this._animProgress || 1);
  },

  _animatePie() {
    if (!this._pieCtx || !this._pieSize) {
      this._initCharts();
      return;
    }
    const steps = 8;
    const step = () => {
      if (this._animProgress == null) this._animProgress = 0;
      this._animProgress += 1 / steps;
      if (this._animProgress > 1) this._animProgress = 1;
      this._redrawPieOnly();
      if (this._animProgress < 1) {
        setTimeout(step, 16);
      }
    };
    step();
  },

  _buildLogs() {
    const scope = this.data.logScope;
    const brand = this.data.selectedBrand;
    const logs = Array.isArray(this._logs) ? this._logs : [];
    const q = String(this.data.logSearchQuery || '').trim().toUpperCase();
    const out = [];
    for (let i = 0; i < logs.length; i++) {
      const it = logs[i];
      if (!it || !it.ts) continue;
      if (scope === 'brand' && it.brand !== brand) continue;
      
      // Filter by log search query (code)
      if (q && String(it.code).toUpperCase().indexOf(q) === -1) continue;

      const delta = parseInt(it.delta, 10);
      if (!Number.isFinite(delta)) continue;
      const sign = delta > 0 ? '+' : '';
      out.push({
        id: String(it.id || `${it.ts}_${i}`),
        time: formatTime(it.ts),
        brand: it.brand,
        code: it.code,
        delta: Math.abs(delta),
        sign: delta > 0 ? '+' : '-',
        isAdd: delta > 0,
        after: it.after
      });
      if (out.length >= 40) break;
    }
    return out;
  },

  onBrandTap(e) {
    const brand = e.currentTarget.dataset.brand;
    if (!BRANDS.includes(brand) || brand === this.data.selectedBrand) return;
    this._selectedSet = new Set();
    this.setData(
      {
        selectedBrand: brand,
        searchQuery: '',
        batchMode: false,
        batchDialogVisible: false,
        selectedCount: 0,
        selectAllText: '全选',
        selectedSeries: 'ALL'
      },
      () => {
        this._updateSeriesList();
        this._syncBrandThreshold();
        this._refreshAll();
      }
    );
  },

  onSortTap(e) {
    const sortMode = e.currentTarget.dataset.sort;
    if (sortMode !== 'code' && sortMode !== 'count') return;
    if (sortMode === this.data.sortMode) return;
    this.setData({ sortMode }, () => this._refreshAll());
  },

  onSeriesTap(e) {
    const s = e.currentTarget.dataset.series;
    if (s === this.data.selectedSeries) return;
    this.setData({ selectedSeries: s, batchMode: false, selectedCount: 0, selectAllText: '全选' }, () => {
      this._selectedSet = new Set();
      this._refreshAll();
    });
  },



  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value || '' }, () => this._refreshAll());
  },

  onClearSearch() {
    this.setData({ searchQuery: '' }, () => this._refreshAll());
  },

  onDefaultThresholdDec() {
    const v = clampInt(this.data.defaultThreshold, 0);
    const next = Math.max(0, v - 1);
    this._updateDefaultThreshold(next);
  },

  onDefaultThresholdInc() {
    const v = clampInt(this.data.defaultThreshold, 0);
    const next = v + 1;
    this._updateDefaultThreshold(next);
  },

  onDefaultThresholdInput(e) {
    const next = clampInt(e.detail.value, 0);
    this._updateDefaultThreshold(next, true);
  },

  _updateDefaultThreshold(next, keepInput) {
    const brand = this.data.selectedBrand;
    const t = this._getBrandThresholds(brand);
    const v = clampInt(next, 0);
    t.defaultThreshold = v;
    if (!t.overrides || typeof t.overrides !== 'object') t.overrides = {};
    this._setBrandThresholds(brand, t);
    this.setData({ defaultThreshold: keepInput ? String(next) : v }, () => this._refreshAll());
  },



  openCountEditor(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    const brand = this.data.selectedBrand;
    const inv = this._getBrandInventory(brand);
    const count = clampInt(inv[code], 0);
    this.setData({
      editorVisible: true,
      editorType: 'count',
      editorCode: code,
      editorValue: count
    });
  },

  openThresholdEditor(e) {
    const code = e.currentTarget.dataset.code || (e.detail && e.detail.code);
    if (!code) return;
    const t = this._getBrandThresholds(this.data.selectedBrand);
    const overrides = t.overrides || {};
    const val = overrides[code] !== undefined ? overrides[code] : t.defaultThreshold;
    this.setData({
      editorVisible: true,
      editorType: 'threshold',
      editorCode: code,
      editorValue: val
    });
  },

  onEditorInput(e) {
    this.setData({ editorValue: e.detail.value });
  },

  closeEditor() {
    this.setData({ editorVisible: false, editorCode: '', editorValue: 0 });
  },

  confirmEditor() {
    const type = this.data.editorType;
    const code = this.data.editorCode;
    const v = clampInt(this.data.editorValue, 0);
    const brand = this.data.selectedBrand;
    if (!code) return this.closeEditor();

    const title = type === 'count' ? '修改库存' : '设置阈值';
    const content = `确定将 ${brand} ${code} 的${type === 'count' ? '库存' : '预警阈值'}修改为 ${v} 吗？`;

    wx.showModal({
      title,
      content,
      confirmColor: '#FF6A00',
      success: (res) => {
        if (res.confirm) {
          this._doSubmitEditor(type, code, v, brand);
        }
      }
    });
  },

  _doSubmitEditor(type, code, v, brand) {
    if (type === 'count') {
      const inv = this._getBrandInventory(brand);
      const oldCount = clampInt(inv[code], 0);
      if (v !== oldCount) {
        this._setInventory(brand, code, v);
        this._pushLog({
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          ts: Date.now(),
          brand,
          code,
          delta: v - oldCount,
          after: v
        });
      }
    } else {
      const t = this._getBrandThresholds(brand);
      if (!t.overrides || typeof t.overrides !== 'object') t.overrides = {};
      t.overrides[code] = v;
      this._setBrandThresholds(brand, t);
    }

    wx.vibrateShort({ type: 'light' });
    this.closeEditor();
    this._refreshAll();
  },

  onItemTap(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;

    if (this.data.batchMode) {
      // Batch selection mode
      if (!this._selectedSet) this._selectedSet = new Set();
      if (this._selectedSet.has(code)) this._selectedSet.delete(code);
      else this._selectedSet.add(code);
      this._syncBatchSelection();
      this._refreshAll();
    } else {
      // Normal mode: open action sheet to edit quantity or threshold
      this.openItemActionSheet(code);
    }
  },

  openItemActionSheet(code) {
    const brand = this.data.selectedBrand;
    const inv = this._getBrandInventory(brand);
    const count = clampInt(inv[code], 0);
    
    // Get current threshold
    const t = this._getBrandThresholds(brand);
    const overrides = t.overrides || {};
    const threshold = overrides[code] !== undefined ? overrides[code] : t.defaultThreshold;

    this.setData({
      itemActionVisible: true,
      itemActionCode: code,
      itemActionCount: count,
      itemActionThreshold: threshold
    });
  },

  hideItemActionSheet() {
    this.setData({ itemActionVisible: false });
  },

  onActionEditCount() {
    const code = this.data.itemActionCode;
    const count = this.data.itemActionCount;
    this.hideItemActionSheet();
    this.setData({
      editorVisible: true,
      editorType: 'count',
      editorCode: code,
      editorValue: count
    });
  },

  onActionEditThreshold() {
    const code = this.data.itemActionCode;
    this.hideItemActionSheet();
    this.openThresholdEditor({ currentTarget: { dataset: { code } } });
  },

  onActionViewLogs() {
    const code = this.data.itemActionCode;
    const brand = this.data.selectedBrand;
    this.hideItemActionSheet();
    
    // Filter logs for this specific item (exact match)
    const logs = Array.isArray(this._logs) ? this._logs : [];
    const itemLogs = [];
    
    for (let i = 0; i < logs.length; i++) {
      const it = logs[i];
      if (!it || !it.ts) continue;
      // Exact match for brand and code
      if (it.brand === brand && it.code === code) {
        const delta = parseInt(it.delta, 10);
        if (!Number.isFinite(delta)) continue;
        
        itemLogs.push({
          id: String(it.id || `${it.ts}_${i}`),
          time: formatTime(it.ts),
          brand: it.brand,
          code: it.code,
          delta: Math.abs(delta),
          sign: delta > 0 ? '+' : '-',
          isAdd: delta > 0,
          after: it.after
        });
      }
      if (itemLogs.length >= 50) break; // Limit to 50 records
    }

    this.setData({
      logDialogVisible: true,
      logDialogCode: code,
      itemLogs: itemLogs
    });
  },

  closeLogDialog() {
    this.setData({
      logDialogVisible: false,
      itemLogs: []
    });
  },

  openBatch() {
    this._selectedSet = new Set();
    this.setData(
      {
        batchMode: true,
        batchDialogVisible: false,
        selectedCount: 0,
        selectAllText: '全选'
      },
      () => this._refreshAll()
    );
  },

  closeBatch() {
    this._selectedSet = new Set();
    this.setData(
      {
        batchMode: false,
        batchDialogVisible: false,
        batchValue: 0,
        selectedCount: 0,
        selectAllText: '全选'
      },
      () => this._refreshAll()
    );
  },

  showBatchDialog() {
    if (!this._selectedSet || this._selectedSet.size === 0) {
      wx.showToast({ title: '请至少选择一项', icon: 'none' });
      return;
    }
    const brand = this.data.selectedBrand;
    const t = this._getBrandThresholds(brand);
    const dt = clampInt(t.defaultThreshold, 0);
    this.setData({
      batchDialogVisible: true,
      batchValue: dt
    });
  },

  hideBatchDialog() {
    this.setData({ batchDialogVisible: false });
  },

  onBatchInput(e) {
    this.setData({ batchValue: e.detail.value });
  },

  toggleSelectAll() {
    const brand = this.data.selectedBrand;
    const catalog = (this._catalogByBrand && this._catalogByBrand[brand]) || [];
    if (!this._selectedSet) this._selectedSet = new Set();
    if (this._selectedSet.size === catalog.length) {
      this._selectedSet = new Set();
    } else {
      const s = new Set();
      for (let i = 0; i < catalog.length; i++) s.add(catalog[i].code);
      this._selectedSet = s;
    }
    this._syncBatchSelection();
    this._refreshAll();
  },

  _syncBatchSelection() {
    const brand = this.data.selectedBrand;
    const catalog = (this._catalogByBrand && this._catalogByBrand[brand]) || [];
    const count = this._selectedSet ? this._selectedSet.size : 0;
    const all = catalog.length > 0 && count === catalog.length;
    this.setData({
      selectedCount: count,
      selectAllText: all ? '清空' : '全选'
    });
  },

  applyBatch() {
    const v = clampInt(this.data.batchValue, 0);
    const brand = this.data.selectedBrand;
    const t = this._getBrandThresholds(brand);
    if (!t.overrides || typeof t.overrides !== 'object') t.overrides = {};
    if (!this._selectedSet || this._selectedSet.size === 0) {
      wx.showToast({ title: '请至少选择一项', icon: 'none' });
      return;
    }
    const target = Array.from(this._selectedSet);
    for (let i = 0; i < target.length; i++) {
      t.overrides[target[i]] = v;
    }
    this._setBrandThresholds(brand, t);
    wx.vibrateShort({ type: 'light' });
    this.hideBatchDialog();
    this.closeBatch();
  },

  onLogScopeTap(e) {
    const scope = e.currentTarget.dataset.scope;
    if (scope !== 'brand' && scope !== 'all') return;
    if (scope === this.data.logScope) return;
    this.setData({ logScope: scope }, () => this._refreshAll());
  },

  onLogSearchInput(e) {
    this.setData({ logSearchQuery: e.detail.value || '' }, () => this._refreshAll());
  },

  onClearLogSearch() {
    this.setData({ logSearchQuery: '' }, () => this._refreshAll());
  }
});
