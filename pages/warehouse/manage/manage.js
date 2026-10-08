const colorData = require('../../../data/color-data.js');
const app = getApp();

const KEY_INVENTORY = 'warehouse_inventory_v1';
const KEY_THRESHOLDS = 'warehouse_thresholds_v1';
const KEY_LOGS = 'warehouse_logs_v1';
const KEY_LAST_BRAND = 'warehouse_last_brand_v1';
const KEY_CUSTOM_BRANDS = 'custom_brands_v1';
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
    brands: [],
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
    editorOriginalCount: 0,
    batchVisible: false,
    batchMode: false,
    batchValue: 0,
    batchDialogVisible: false,
    batchType: 'threshold',
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
    itemLogs: [],
    
    // Custom Brand Management
    customBrands: [],
    addBrandVisible: false,
    addSeriesVisible: false,
    addColorVisible: false,
    tempBrandName: '',
    tempSeriesName: '',
    tempColorCode: '',
    tempColorHex: '',
    hsv: { h: 0, s: 1, v: 1 },
    svHandle: { x: 0, y: 0 },
    hueHandle: { x: 0 },
    editingBrandId: null,
    editingSeriesId: null,
    targetBrandId: null,
    targetSeriesId: null,
    
    // Group (Series) Filter
    groupList: [],
    selectedGroup: 'ALL',
    
    // Low Stock Filter
    showLowStockOnly: false,

    // Log Filter
    selectedLogColor: null,
  },

  onLoad() {
    this._inventory = wx.getStorageSync(KEY_INVENTORY) || {};
    this._thresholds = wx.getStorageSync(KEY_THRESHOLDS) || {};
    this._logs = wx.getStorageSync(KEY_LOGS) || [];
    
    // Load custom brands
    let localCustom = wx.getStorageSync(KEY_CUSTOM_BRANDS) || [];
    
    // Migration: Move colors from Color Card (subSeries) to Groups (Series)
    let migrated = false;
    localCustom.forEach(brand => {
      if (brand.subSeries) {
        brand.subSeries.forEach(series => {
          if (!series.groups) {
            series.groups = [];
            migrated = true;
          }
          if (series.colors && series.colors.length > 0) {
            const defaultGroup = {
              id: `${series.id}_G_DEFAULT`,
              name: '默认系列',
              colors: series.colors
            };
            series.groups.push(defaultGroup);
            delete series.colors; // Clean up old structure
            migrated = true;
          }
        });
      }
    });
    
    if (migrated) {
      wx.setStorageSync(KEY_CUSTOM_BRANDS, localCustom);
    }

    this.setData({ customBrands: localCustom });
    
    // Initialize brands (standard + custom)
    this._initBrands();

    const lastBrand = wx.getStorageSync(KEY_LAST_BRAND);
    const brand = this.data.brands.includes(lastBrand) ? lastBrand : (this.data.brands[0] || 'Mard');
    
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

  _initBrands() {
    // Merge custom brands into colorData
    const customBrands = this.data.customBrands || [];
    customBrands.forEach(cb => {
      // Ensure it has the structure expected by the app
      if (!colorData[cb.id]) {
        colorData[cb.id] = cb;
      } else {
        // Update existing entry if needed (e.g. name change)
        Object.assign(colorData[cb.id], cb);
      }
    });

    // Rebuild indexes
    const entries = Object.values(colorData).map(b => ({
      id: b.id,
      name: b.name
    }));
    const brandNames = entries.map(b => b.name);
    const nameToId = entries.reduce((acc, cur) => {
      acc[cur.name] = cur.id;
      return acc;
    }, {});

    // Store in instance
    this.BRAND_ENTRIES = entries;
    this.BRAND_NAME_TO_ID = nameToId;
    
    this.setData({ brands: brandNames });
  },

  _updateSeriesList() {
    const brandName = this.data.selectedBrand;
    const brandId = this.BRAND_NAME_TO_ID[brandName];
    const brandData = colorData[brandId];
    
    if (!brandData || !brandData.subSeries) {
      this.setData({ seriesList: [] });
      return;
    }
    
    // 生成系列列表：包括 ALL 和具体的子系列
    const list = [{ key: 'ALL', label: '全部色卡' }];
    
    brandData.subSeries.forEach(s => {
      list.push({ key: s.id, label: s.name });
    });
    
    this.setData({ seriesList: list, selectedSeries: 'ALL' }, () => {
      this._updateGroupList();
    });
  },

  _updateGroupList() {
    const brandName = this.data.selectedBrand;
    const seriesId = this.data.selectedSeries;
    // Ensure BRAND_NAME_TO_ID is available
    if (!this.BRAND_NAME_TO_ID) return;
    
    const brandId = this.BRAND_NAME_TO_ID[brandName];
    const brandData = colorData[brandId];
    
    if (!brandData) {
      this.setData({ groupList: [], selectedGroup: 'ALL' });
      return;
    }

    const groups = new Set();
    
    const processSeries = (series) => {
        if (series.groups) {
            series.groups.forEach(g => groups.add(g.name));
        } else if (series.colors) {
            series.colors.forEach(c => {
                if (c.series) groups.add(c.series);
            });
        }
    };

    if (seriesId === 'ALL') {
        if (brandData.subSeries) {
            brandData.subSeries.forEach(s => {
                processSeries(s);
            });
        }
    } else {
        const targetSeries = brandData.subSeries.find(s => s.id === seriesId);
        if (targetSeries) {
            processSeries(targetSeries);
        }
    }

    // Sort groups naturally (A, B, C...)
    const list = Array.from(groups).sort((a, b) => {
       return a.localeCompare(b, 'zh-CN', {numeric: true});
    });
    
    const uiList = [{key: 'ALL', label: '全部系列'}];
    list.forEach(g => {
        uiList.push({key: g, label: g});
    });
    
    this.setData({ groupList: uiList, selectedGroup: 'ALL' });
  },

  async _ensureOpenid() {
    const user = app && app.globalData ? app.globalData.userInfo : null;
    const openid = user && user._openid ? String(user._openid) : '';
    if (openid) return openid;
    try {
      const res = await wx.cloud.callFunction({ name: 'login', data: {} });
      const next = res && res.result && res.result.openid ? String(res.result.openid) : '';
      return next;
    } catch (e) {
      return '';
    }
  },

  async _initCloudData() {
    wx.showLoading({ title: '同步数据中' });
    try {
      // 1. Check cloud for existing data
      const openid = await this._ensureOpenid();
      if (!openid) throw new Error('openid_missing');
      const res = await db.collection(COLL_WAREHOUSE).where({ _openid: openid }).limit(1).get();
      if (res.data && res.data.length > 0) {
        const doc = res.data[0];
        console.log('[Warehouse] Loaded from cloud:', doc._id);
        this._docId = doc._id;
        // 以云端为准，但云端为空时保留本地数据。
        // ⚠️ 历史 bug：这里无条件用云端覆盖本地。若上次退出时本地有没来得及同步的改动
        // （见 _saveToCloud 的防抖），这次进来就会被云端旧数据冲掉，用户等于白数一遍珠子。
        // 现在：云端该字段为空（没有这个 key / 空对象 / 空数组）时，保留本地已有的。
        const hasKeys = (o) => o && typeof o === 'object' && Object.keys(o).length > 0;
        this._inventory = hasKeys(doc.inventory) ? doc.inventory : (this._inventory || {});
        this._thresholds = hasKeys(doc.thresholds) ? doc.thresholds : (this._thresholds || {});
        this._logs = Array.isArray(doc.logs) && doc.logs.length > 0 ? doc.logs : (this._logs || []);
        
        if (doc.customBrands) {
          this.setData({ customBrands: doc.customBrands });
          wx.setStorageSync(KEY_CUSTOM_BRANDS, doc.customBrands);
          this._initBrands();
        }
        
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
    // 防抖从 2000ms 降到 800ms：库存是一颗颗数出来的，窗口越短越不容易丢改动。
    // 配合下方 onUnload/onHide 的强制 flush，基本可以杜绝「改完就退出导致没同步」。
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._flushToCloud();
    }, 800);
  },

  // 立即把当前数据推到云端（跳过防抖）。退出页面/切后台时调用。
  _flushToCloud() {
    if (!this._docId) return;
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
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
      // 数据已写本地不会丢，但要让用户知道云端没同步成功（换设备会看不到）。
      // 只在本次会话第一次失败时提示，避免反复弹窗打扰。
      if (!this._saveFailedNotified) {
        this._saveFailedNotified = true;
        wx.showToast({
          title: '云端同步失败，数据已存本地',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  onShow() {
    this._refreshAll();
  },

  // ⚠️ 历史 bug：没有 onUnload / onHide。
  // 云保存有防抖，用户改完数量立刻退出页面时定时器直接没了，
  // 改动只落在本机；下次进页面云端旧数据又把本地覆盖回去 —— 等于白改。
  // 这里在离开页面时强制 flush 一次。
  onHide() {
    this._flushToCloud();
  },

  onUnload() {
    this._flushToCloud();
  },

  _buildCatalogByBrand() {
    const out = {};
    const brands = this.data.brands || [];
    brands.forEach(b => out[b] = []);

    Object.values(colorData).forEach(brand => {
      const brandName = brand.name;
      const seen = new Set();
      
      if (!out[brandName]) out[brandName] = [];
      
      if (brand.subSeries) {
        brand.subSeries.forEach(series => {
          if (series.colors) {
            series.colors.forEach(c => {
              const code = c.code;
              // 避免同一品牌下重复色号
              if (!seen.has(code)) {
                seen.add(code);
                out[brandName].push({
                  code: code,
                  hex: c.hex,
                  series: c.series,
                  subSeriesId: series.id // 用于筛选
                });
              } else {
                 // 如果已存在，可能需要关联多个 subSeriesId？
                 // 这里简单处理，先不处理多重关联，或者后续在 filter 时遍历所有 subSeries
                 // 实际上 _buildItems 会重新遍历，这里 _catalogByBrand 主要用于搜索和快速访问
              }
            });
          }
        });
      }
      
      // 排序
      out[brandName].sort((a, b) => {
        // 尝试按数字排序
        const numA = parseInt(a.code.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.code.replace(/\D/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        return a.code.localeCompare(b.code);
      });
    });
    
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

  // 批量写入库存：只在最后落一次本地存储 + 触发一次云同步。
  // ⚠️ 历史 bug：批量设置时循环调用 _setInventory，选 200 个色号就是
  // 200 次 setStorageSync（同步阻塞、每次都全量序列化整个库存对象）+ 200 次云同步重置，
  // 批量改一次 221 色会明显卡住。这里合并成一次写入。
  _setInventoryBatch(brand, codeValueMap) {
    if (!this._inventory || typeof this._inventory !== 'object') this._inventory = {};
    if (!this._inventory[brand] || typeof this._inventory[brand] !== 'object') this._inventory[brand] = {};
    Object.keys(codeValueMap || {}).forEach(code => {
      this._inventory[brand][code] = codeValueMap[code];
    });
    wx.setStorageSync(KEY_INVENTORY, this._inventory);
    this._saveToCloud();
  },

  // 批量写日志：entries 按时间从新到旧传入，一次性 unshift 进去
  _pushLogs(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const logs = Array.isArray(this._logs) ? this._logs : [];
    // 倒序遍历 unshift，保证传入顺序（新→旧）在列表里保持正确
    for (let i = entries.length - 1; i >= 0; i--) {
      logs.unshift(entries[i]);
    }
    if (logs.length > 300) logs.length = 300;
    this._logs = logs;
    wx.setStorageSync(KEY_LOGS, logs);
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
    const logs = this._buildLogs(items.list);
    this.setData({
      items: items.list,
      lowCount: totals.lowCount,
      brandTotal: totals.brandTotal,
      allTotal: totals.allTotal,
      logs
    });
    if (totals.lowCount > 0 && this._prevLowCount !== totals.lowCount && this.data.currentTab !== 'logs') {
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

  _buildItems() {
    // Ensure brands are initialized
    if (!this.BRAND_NAME_TO_ID) {
      this._initBrands();
    }

    const brandName = this.data.selectedBrand;
    // Use instance property instead of missing global
    const brandId = (this.BRAND_NAME_TO_ID && this.BRAND_NAME_TO_ID[brandName]);
    const brandData = brandId ? colorData[brandId] : null;
    
    if (!brandData) {
      console.warn('Brand data not found for:', brandName, brandId);
      // Try to recover by re-initializing if it looks like we should have data
      if (!this.BRAND_NAME_TO_ID || Object.keys(this.BRAND_NAME_TO_ID).length === 0) {
         this._initBrands();
         const retryId = this.BRAND_NAME_TO_ID[brandName];
         if (retryId && colorData[retryId]) {
            return this._buildItems(); // Retry once
         }
      }
      return { list: [] };
    }

    const inv = this._getBrandInventory(brandName);
    const t = this._getBrandThresholds(brandName);
    const dt = clampInt(t.defaultThreshold, 0);
    const overrides = (t && t.overrides && typeof t.overrides === 'object') ? t.overrides : {};
    
    const q = String(this.data.searchQuery || '').trim().toUpperCase();
    const selectedSeriesId = this.data.selectedSeries;
    const selectedGroup = this.data.selectedGroup;
    
    // 收集颜色
    let candidates = [];
    const seen = new Set();
    
    const processSeries = (series) => {
        // New structure: groups
        if (series.groups) {
            series.groups.forEach(g => {
                // Filter by group (name) if needed
                if (selectedGroup !== 'ALL' && g.name !== selectedGroup) return;
                
                if (g.colors) {
                    g.colors.forEach(c => {
                        if (!seen.has(c.code)) {
                            seen.add(c.code);
                            candidates.push(c);
                        }
                    });
                }
            });
        }
        // Old structure fallback
        if (series.colors) {
            series.colors.forEach(c => {
                 if (!seen.has(c.code)) {
                    // Filter by group (name) if needed
                    if (selectedGroup !== 'ALL' && c.series !== selectedGroup) return;
                    seen.add(c.code);
                    candidates.push(c);
                 }
            });
        }
    };

    if (selectedSeriesId === 'ALL') {
      if (brandData.subSeries) {
        brandData.subSeries.forEach(series => processSeries(series));
      }
    } else {
      const targetSeries = brandData.subSeries.find(s => s.id === selectedSeriesId);
      if (targetSeries) processSeries(targetSeries);
    }
    
    const list = [];
    
    candidates.forEach(c => {
      const code = c.code;
      
      // 搜索过滤
      if (q && String(code).toUpperCase().indexOf(q) === -1) return;
      
      const count = clampInt(inv[code], 0);
      const thRaw = overrides[code];
      const threshold = thRaw == null ? dt : clampInt(thRaw, 0);
      const isLow = threshold > 0 && count < threshold;
      const selected = this._selectedSet && this._selectedSet.has(code);
      
      list.push({
        key: code,
        code,
        hex: c.hex,
        count,
        threshold,
        isLow,
        selected
      });
    });

    const mode = this.data.sortMode;
    list.sort((a, b) => {
      if (mode === 'count') {
         return b.count - a.count || this._compareCodes(a.code, b.code);
      } else {
         return this._compareCodes(a.code, b.code) || b.count - a.count;
      }
    });

    return { list };
  },
  
  _compareCodes(codeA, codeB) {
    const numA = parseInt(codeA.replace(/\D/g, '')) || 0;
    const numB = parseInt(codeB.replace(/\D/g, '')) || 0;
    if (numA !== numB) return numA - numB;
    return String(codeA).localeCompare(String(codeB));
  },

  // ⚠️ 历史 bug：本类里曾有两个同名的 onSeriesTap（后面 1199 行附近还有一个），
  // JS 对象字面量同名 key 后者覆盖前者，导致这个「会调用 _updateGroupList」的版本
  // 成了永不执行的死代码，而生效的版本漏了 _updateGroupList —— 切换色卡系列时
  // 下方的「分组」列表不跟着变，仍停留在上一个系列的分组。
  // 现已合并为一个实现（见下方 onSeriesTap），此处删除。

  onGroupTap(e) {
    const group = e.currentTarget.dataset.group;
    if (!group || group === this.data.selectedGroup) return;

    this.setData({ selectedGroup: group }, () => {
      this._refreshAll();
    });
  },

  // ⚠️ 历史 bug：本类里曾有两个同名 onLogColorTap（下方「记录」区还有一个），
  // 同名 key 后者覆盖前者，这个版本是永不执行的死代码。
  // 顺带一提它本身也有问题：_refreshAll() 写在 setData 外面，会读到更新前的旧 data。
  // 保留下方那个（在 setData 回调里刷新）的正确实现，此处删除死代码。

  onLogColorAllTap() {
    this.setData({ selectedLogColor: null });
    this._refreshAll();
  },

  toggleShowLowStockOnly() {
    this.setData({
      showLowStockOnly: !this.data.showLowStockOnly
    });
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
    const brands = this.data.brands || [];
    
    for (let i = 0; i < brands.length; i++) {
      const b = brands[i];
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
    const brands = (this.data.brands && this.data.brands.length) ? this.data.brands : [];
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

  // ⚠️ 历史 bug：wxml 里 data-index="{{index}}" 传过来的是**字符串**（如 "0"），
  // wxml 侧比较 `pieSelectedIndex === index` 是宽松的（同为字符串）所以样式能高亮，
  // 但这里 `this._pieSelectedIndex === idx` 是数字 vs 字符串的**严格**比较，永远 false；
  // 更糟的是 `this._pieSelectedIndex = idx` 会把字符串存进去，紧接着
  // `_drawPieChart` 里 `this._pieSelectedIndex === i`（i 是数字）同样永远 false
  // → 点图例文字完全没有反应（扇区不弹开、也不取消）。
  // 统一转成数字再比较/赋值。
  _legendIndex(e) {
    const raw = e && e.currentTarget && e.currentTarget.dataset
      ? e.currentTarget.dataset.index
      : undefined;
    if (raw === undefined || raw === null || raw === '') return -1;
    const n = Number(raw);
    return Number.isFinite(n) ? n : -1;
  },

  onLegendTap(e) {
    const idx = this._legendIndex(e);
    if (idx < 0) return;
    
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
    const idx = this._legendIndex(e);
    if (idx < 0) return;
    
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

  _buildLogs(itemList) {
    const scope = this.data.logScope;
    const brand = this.data.selectedBrand;
    const selectedColor = this.data.selectedLogColor;
    const logs = Array.isArray(this._logs) ? this._logs : [];
    const q = String(this.data.logSearchQuery || '').trim().toUpperCase();
    
    // Create a set of valid codes from the current filtered item list (if brand scope is active)
    const validCodes = (scope === 'brand' && Array.isArray(itemList)) 
      ? new Set(itemList.map(i => i.code)) 
      : null;

    // Create a map for hex codes
    const hexMap = {};
    if (Array.isArray(itemList)) {
      itemList.forEach(i => hexMap[i.code] = i.hex);
    }

    const out = [];
    for (let i = 0; i < logs.length; i++) {
      const it = logs[i];
      if (!it || !it.ts) continue;
      
      if (scope === 'brand') {
        if (it.brand !== brand) continue;
        // If we have a validCodes set (meaning we are filtering by series/group), check it
        if (validCodes && !validCodes.has(it.code)) continue;
      }
      
      // Filter by selected specific color
      if (selectedColor && it.code !== selectedColor) continue;
      
      // Filter by log search query (code)
      if (q && String(it.code).toUpperCase().indexOf(q) === -1) continue;

      let hex = hexMap[it.code];
      if (!hex) {
        // Fallback lookup for other brands or items not in current filter
        const bId = this.BRAND_NAME_TO_ID && this.BRAND_NAME_TO_ID[it.brand];
        if (bId && colorData[bId] && colorData[bId].subSeries) {
          for (const s of colorData[bId].subSeries) {
            if (!s.colors) continue;
            const found = s.colors.find(c => c.code === it.code);
            if (found) {
              hex = found.hex;
              break;
            }
          }
        }
      }

      const delta = parseInt(it.delta, 10);
      if (!Number.isFinite(delta)) continue;
      const sign = delta > 0 ? '+' : '';
      out.push({
        id: String(it.id || `${it.ts}_${i}`),
        time: formatTime(it.ts),
        brand: it.brand,
        code: it.code,
        hex: hex || '#eee', // Default to gray if not found
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
    const brands = this.data.brands || [];
    if (!brands.includes(brand) || brand === this.data.selectedBrand) return;
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

  // 切换色卡系列：必须同时刷新「分组」列表（_updateGroupList），
  // 否则选中 Mard-48 时下方分组还停留在 Mard-24 的，会筛出空列表。
  // 这里同时重置批量选择态，避免跨系列残留选中项。
  onSeriesTap(e) {
    const s = e.currentTarget.dataset.series;
    if (s === this.data.selectedSeries) return;
    this.setData({ selectedSeries: s, batchMode: false, selectedCount: 0, selectAllText: '全选' }, () => {
      this._selectedSet = new Set();
      this._updateGroupList();
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
      editorValue: count,
      editorOriginalCount: count
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

  onQuickAdjust(e) {
    const delta = parseInt(e.currentTarget.dataset.delta, 10);
    if (isNaN(delta)) return;
    
    const current = parseInt(this.data.editorValue, 10) || 0;
    const newValue = Math.max(0, current + delta);
    
    this.setData({ editorValue: newValue });
    wx.vibrateShort({ type: 'light' });
  },

  closeEditor() {
    this.setData({ editorVisible: false, editorCode: '', editorValue: 0, editorOriginalCount: 0 });
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
    // ⚠️ 历史 bug：这里漏了 editorOriginalCount。
    // 编辑器里「当前库存：X」读的就是这个字段，不赋值就会显示上一次编辑残留的旧值
    // （或初始的 0），用户点开卡片看到"当前库存：0"但实际有几十颗，会以为数据错了。
    this.setData({
      editorVisible: true,
      editorType: 'count',
      editorCode: code,
      editorValue: count,
      editorOriginalCount: count
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
    const dt = this.data.defaultThreshold;
    this.setData(
      {
        batchMode: true,
        batchDialogVisible: false,
        batchValue: dt,
        batchType: 'threshold',
        selectedCount: 0,
        selectAllText: '全选'
      },
      () => this._refreshAll()
    );
  },

  openInventoryBatch() {
    this._selectedSet = new Set();
    this.setData(
      {
        batchMode: true,
        batchDialogVisible: false,
        batchValue: '',
        batchType: 'count',
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
        batchType: 'threshold',
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
    const items = this.data.items || [];
    if (!items.length) return;

    if (!this._selectedSet) this._selectedSet = new Set();
    
    // Check if all visible items are selected
    let allVisibleSelected = true;
    for (let i = 0; i < items.length; i++) {
      if (!this._selectedSet.has(items[i].code)) {
        allVisibleSelected = false;
        break;
      }
    }

    if (allVisibleSelected) {
      // Deselect all visible items
      items.forEach(it => this._selectedSet.delete(it.code));
    } else {
      // Select all visible items
      items.forEach(it => this._selectedSet.add(it.code));
    }

    this._syncBatchSelection();
    this._refreshAll();
  },

  _syncBatchSelection() {
    const items = this.data.items || [];
    const count = this._selectedSet ? this._selectedSet.size : 0;
    
    let allVisibleSelected = items.length > 0;
    if (items.length === 0) {
      allVisibleSelected = false;
    } else {
      for (let i = 0; i < items.length; i++) {
        if (!this._selectedSet || !this._selectedSet.has(items[i].code)) {
          allVisibleSelected = false;
          break;
        }
      }
    }

    this.setData({
      selectedCount: count,
      selectAllText: allVisibleSelected ? '反全选' : '全选'
    });
  },

  applyBatch() {
    const v = clampInt(this.data.batchValue, 0);
    const brand = this.data.selectedBrand;
    const type = this.data.batchType || 'threshold';
    
    if (!this._selectedSet || this._selectedSet.size === 0) {
      wx.showToast({ title: '请至少选择一项', icon: 'none' });
      return;
    }

    const count = this._selectedSet.size;
    const content = type === 'count'
      ? `是否要给 ${count} 个色块的库存修改为 ${v}？`
      : `是否要给 ${count} 个色块的阈值修改为 ${v}？`;

    wx.showModal({
      title: '确认批量设置',
      content,
      confirmColor: '#FF6A00',
      success: (res) => {
        if (res.confirm) {
          const target = Array.from(this._selectedSet);
          if (type === 'count') {
            const inv = this._getBrandInventory(brand);
            // 先收集所有改动，最后一次性落盘：
            // 逐条 _setInventory 会导致 N 次同步写存储 + N 次云同步，批量改 221 色会卡顿。
            const changed = {};
            const logEntries = [];
            const nowTs = Date.now();
            for (let i = 0; i < target.length; i++) {
              const code = target[i];
              const oldCount = clampInt(inv[code], 0);
              if (v !== oldCount) {
                changed[code] = v;
                logEntries.push({
                  id: `${nowTs}_${i}_${Math.random().toString(16).slice(2)}`,
                  ts: nowTs,
                  brand,
                  code,
                  delta: v - oldCount,
                  after: v
                });
              }
            }
            if (Object.keys(changed).length > 0) {
              this._setInventoryBatch(brand, changed);
              this._pushLogs(logEntries);
            }
          } else {
            const t = this._getBrandThresholds(brand);
            if (!t.overrides || typeof t.overrides !== 'object') t.overrides = {};
            for (let i = 0; i < target.length; i++) {
              t.overrides[target[i]] = v;
            }
            this._setBrandThresholds(brand, t);
          }
          wx.vibrateShort({ type: 'light' });
          this.hideBatchDialog();
          this.closeBatch();
          
          wx.showToast({
            title: '修改成功',
            icon: 'success'
          });
        }
      }
    });
  },

  onLogScopeTap(e) {
    const scope = e.currentTarget.dataset.scope;
    if (scope !== 'brand' && scope !== 'all') return;
    if (scope === this.data.logScope) return;
    this.setData({ logScope: scope, selectedLogColor: null }, () => this._refreshAll());
  },

  onLogColorTap(e) {
    const code = e.currentTarget.dataset.code;
    if (code === this.data.selectedLogColor) {
      this.setData({ selectedLogColor: null }, () => this._refreshAll());
    } else {
      this.setData({ selectedLogColor: code }, () => this._refreshAll());
    }
  },

  onLogSearchInput(e) {
    this.setData({ logSearchQuery: e.detail.value || '' }, () => this._refreshAll());
  },

  onClearLogSearch() {
    this.setData({ logSearchQuery: '' }, () => this._refreshAll());
  },

  /* --- Custom Brand Management --- */

  onShowAddBrandModal() {
    this.setData({
      addBrandVisible: true,
      tempBrandName: '',
      editingBrandId: null
    });
  },

  closeAddBrandModal() {
    this.setData({ addBrandVisible: false });
  },

  onBrandNameInput(e) {
    this.setData({ tempBrandName: e.detail.value });
  },

  onEditBrand(e) {
    const id = e.currentTarget.dataset.id;
    const brand = this.data.customBrands.find(b => b.id === id);
    if (!brand) return;
    this.setData({
      addBrandVisible: true,
      tempBrandName: brand.name,
      editingBrandId: id
    });
  },

  confirmAddBrand() {
    const name = this.data.tempBrandName.trim();
    if (!name) return wx.showToast({ title: '请输入品牌名称', icon: 'none' });

    const customBrands = this.data.customBrands || [];
    
    // Check duplicate name
    if (customBrands.some(b => b.name === name && b.id !== this.data.editingBrandId)) {
      return wx.showToast({ title: '品牌名称已存在', icon: 'none' });
    }

    if (this.data.editingBrandId) {
      const brand = customBrands.find(b => b.id === this.data.editingBrandId);
      if (brand) brand.name = name;
    } else {
      const newBrand = {
        id: `CUSTOM_${Date.now()}`,
        name: name,
        subSeries: []
      };
      customBrands.push(newBrand);
    }

    // ⚠️ 历史 bug：提示语在 setData 之后才读 editingBrandId，而上面已经把它置 null 了，
    // 所以「编辑已有品牌」也会显示"添加成功"。先存一份再清空。
    const isEditing = !!this.data.editingBrandId;
    this.setData({ customBrands, addBrandVisible: false, editingBrandId: null });
    this._saveCustomBrands();
    
    wx.showToast({ title: isEditing ? '修改成功' : '添加成功', icon: 'success' });
  },

  onDeleteBrand(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除品牌',
      content: '确定要删除该品牌及其所有数据吗？',
      confirmColor: '#ff3b30',
      success: (res) => {
        if (res.confirm) {
          const customBrands = this.data.customBrands.filter(b => b.id !== id);
          this.setData({ customBrands });
          this._saveCustomBrands();
        }
      }
    });
  },

  onShowAddSeriesModal(e) {
    const brandId = e.currentTarget.dataset.brandId;
    this.setData({
      addSeriesVisible: true,
      tempSeriesName: '',
      editingSeriesId: null,
      targetBrandId: brandId
    });
  },

  closeAddSeriesModal() {
    this.setData({ addSeriesVisible: false });
  },

  onSeriesNameInput(e) {
    this.setData({ tempSeriesName: e.detail.value });
  },

  onEditSeries(e) {
    const { brandId, seriesId } = e.currentTarget.dataset;
    const customBrands = this.data.customBrands;
    const brand = customBrands.find(b => b.id === brandId);
    if (!brand) return;
    const series = brand.subSeries.find(s => s.id === seriesId);
    if (!series) return;

    this.setData({
      addSeriesVisible: true,
      tempSeriesName: series.name,
      targetBrandId: brandId,
      editingSeriesId: seriesId
    });
  },

  confirmAddSeries() {
    const name = this.data.tempSeriesName.trim();
    if (!name) return wx.showToast({ title: '请输入色卡名称', icon: 'none' });

    const brandId = this.data.targetBrandId;
    const customBrands = this.data.customBrands;
    const brand = customBrands.find(b => b.id === brandId);
    
    if (!brand) return;

    // Check duplicate series name in this brand
    if (brand.subSeries.some(s => s.name === name && s.id !== this.data.editingSeriesId)) {
      return wx.showToast({ title: '色卡名称已存在', icon: 'none' });
    }

    if (this.data.editingSeriesId) {
      const series = brand.subSeries.find(s => s.id === this.data.editingSeriesId);
      if (series) series.name = name;
    } else {
      const newSeries = {
        id: `${brandId}_S_${Date.now()}`,
        name: name,
        groups: [],
        colors: [] // Deprecated but kept for compatibility
      };
      brand.subSeries.push(newSeries);
    }

    // 同上：先存编辑态再 setData 清空，否则提示永远是"添加成功"
    const isEditingSeries = !!this.data.editingSeriesId;
    this.setData({ customBrands, addSeriesVisible: false, editingSeriesId: null });
    this._saveCustomBrands();
    wx.showToast({ title: isEditingSeries ? '修改成功' : '添加成功', icon: 'success' });
  },

  onDeleteSeries(e) {
    const { brandId, seriesId } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除色卡',
      content: '确定要删除该色卡吗？',
      confirmColor: '#ff3b30',
      success: (res) => {
        if (res.confirm) {
          const customBrands = this.data.customBrands;
          const brand = customBrands.find(b => b.id === brandId);
          if (brand) {
            brand.subSeries = brand.subSeries.filter(s => s.id !== seriesId);
            this.setData({ customBrands });
            this._saveCustomBrands();
          }
        }
      }
    });
  },

  onShowAddGroupModal(e) {
    const { brandId, seriesId } = e.currentTarget.dataset;
    this.setData({
      addGroupVisible: true,
      tempGroupName: '',
      editingGroupId: null,
      targetBrandId: brandId,
      targetSeriesId: seriesId
    });
  },

  closeAddGroupModal() {
    this.setData({ addGroupVisible: false });
  },

  onGroupNameInput(e) {
    this.setData({ tempGroupName: e.detail.value });
  },

  onEditGroup(e) {
    const { brandId, seriesId, groupId } = e.currentTarget.dataset;
    const customBrands = this.data.customBrands;
    const brand = customBrands.find(b => b.id === brandId);
    if (!brand) return;
    const series = brand.subSeries.find(s => s.id === seriesId);
    if (!series) return;
    const group = series.groups.find(g => g.id === groupId);
    if (!group) return;

    this.setData({
      addGroupVisible: true,
      tempGroupName: group.name,
      targetBrandId: brandId,
      targetSeriesId: seriesId,
      editingGroupId: groupId
    });
  },

  confirmAddGroup() {
    const name = this.data.tempGroupName.trim();
    if (!name) return wx.showToast({ title: '请输入系列名称', icon: 'none' });

    const { targetBrandId, targetSeriesId } = this.data;
    const customBrands = this.data.customBrands;
    const brand = customBrands.find(b => b.id === targetBrandId);
    if (!brand) return;
    const series = brand.subSeries.find(s => s.id === targetSeriesId);
    if (!series) return;
    
    if (!series.groups) series.groups = [];

    // Check duplicate
    if (series.groups.some(g => g.name === name && g.id !== this.data.editingGroupId)) {
      return wx.showToast({ title: '系列名称已存在', icon: 'none' });
    }

    if (this.data.editingGroupId) {
      const group = series.groups.find(g => g.id === this.data.editingGroupId);
      if (group) group.name = name;
    } else {
      const newGroup = {
        id: `${targetSeriesId}_G_${Date.now()}`,
        name: name,
        colors: []
      };
      series.groups.push(newGroup);
    }

    // 同上：先存编辑态再 setData 清空，否则提示永远是"添加成功"
    const isEditingGroup = !!this.data.editingGroupId;
    this.setData({ customBrands, addGroupVisible: false, editingGroupId: null });
    this._saveCustomBrands();
    wx.showToast({ title: isEditingGroup ? '修改成功' : '添加成功', icon: 'success' });
  },

  onDeleteGroup(e) {
    const { brandId, seriesId, groupId } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除系列',
      content: '确定要删除该系列吗？',
      confirmColor: '#ff3b30',
      success: (res) => {
        if (res.confirm) {
          const customBrands = this.data.customBrands;
          const brand = customBrands.find(b => b.id === brandId);
          if (brand) {
            const series = brand.subSeries.find(s => s.id === seriesId);
            if (series && series.groups) {
              series.groups = series.groups.filter(g => g.id !== groupId);
              this.setData({ customBrands });
              this._saveCustomBrands();
            }
          }
        }
      }
    });
  },

  onEditColor(e) {
    const { brandId, seriesId, groupId, code } = e.currentTarget.dataset;
    const customBrands = this.data.customBrands;
    const brand = customBrands.find(b => b.id === brandId);
    if (!brand) return;
    const series = brand.subSeries.find(s => s.id === seriesId);
    if (!series) return;
    const group = series.groups.find(g => g.id === groupId);
    if (!group) return;
    const color = group.colors.find(c => c.code === code);
    if (!color) return;

    this.setData({
      addColorVisible: true,
      targetBrandId: brandId,
      targetSeriesId: seriesId,
      targetGroupId: groupId,
      tempColorCode: color.code,
      tempColorHex: color.hex,
      editingColorCode: code // Mark as editing mode
    }, () => {
      this.initColorPicker();
    });
  },

  onShowAddColorModal(e) {
    const { brandId, seriesId, groupId } = e.currentTarget.dataset;
    this.setData({
      addColorVisible: true,
      tempColorCode: '',
      tempColorHex: '',
      targetBrandId: brandId,
      targetSeriesId: seriesId,
      targetGroupId: groupId,
      editingColorCode: null
    }, () => {
      this.initColorPicker();
    });
  },

  closeAddColorModal() {
    this.setData({ addColorVisible: false });
  },

  onColorCodeInput(e) {
    this.setData({ tempColorCode: e.detail.value });
  },

  onColorHexInput(e) {
    const value = e.detail.value;
    this.setData({ tempColorHex: value });
    this._setHsvFromHex(value);
  },

  initColorPicker() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#svPanel').boundingClientRect();
    query.select('#hueSlider').boundingClientRect();
    query.exec((res) => {
      const svRect = res && res[0];
      const hueRect = res && res[1];
      if (!svRect || !hueRect) return;
      this._svRect = svRect;
      this._hueRect = hueRect;
      this._setHsvFromHex(this.data.tempColorHex);
    });
  },

  onSvTouchStart(e) {
    this._handleSvTouch(e);
  },

  onSvTouchMove(e) {
    this._handleSvTouch(e);
  },

  onHueTouchStart(e) {
    this._handleHueTouch(e);
  },

  onHueTouchMove(e) {
    this._handleHueTouch(e);
  },

  _hsvToRgb(h, s, v) {
    const c = v * s;
    const hh = (h / 60) % 6;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hh >= 0 && hh < 1) {
      r = c; g = x; b = 0;
    } else if (hh >= 1 && hh < 2) {
      r = x; g = c; b = 0;
    } else if (hh >= 2 && hh < 3) {
      r = 0; g = c; b = x;
    } else if (hh >= 3 && hh < 4) {
      r = 0; g = x; b = c;
    } else if (hh >= 4 && hh < 5) {
      r = x; g = 0; b = c;
    } else if (hh >= 5 && hh <= 6) {
      r = c; g = 0; b = x;
    }
    const m = v - c;
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  },

  _rgbToHex(r, g, b) {
    const toHex = (val) => {
      const str = Math.max(0, Math.min(255, Math.round(val))).toString(16).toUpperCase();
      return str.length === 1 ? `0${str}` : str;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  _setHsvFromHex(hex) {
    if (!this._svRect || !this._hueRect) return;
    const rgb = this._hexToRgb(hex) || { r: 255, g: 255, b: 255 };
    const hsv = this._rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.setData({ hsv });
    this._updateHandlesFromHsv(hsv);
  },

  _updateHandlesFromHsv(hsv) {
    if (!this._svRect || !this._hueRect) return;
    const h = Math.max(0, Math.min(360, hsv.h));
    const s = Math.max(0, Math.min(1, hsv.s));
    const v = Math.max(0, Math.min(1, hsv.v));
    const svX = s * this._svRect.width;
    const svY = (1 - v) * this._svRect.height;
    const hueX = (h / 360) * this._hueRect.width;
    this.setData({
      svHandle: { x: svX, y: svY },
      hueHandle: { x: hueX }
    });
  },

  _handleSvTouch(e) {
    if (!this._svRect) return;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) return;
    const x = Math.max(0, Math.min(this._svRect.width, (touch.x != null ? touch.x : touch.clientX) - this._svRect.left));
    const y = Math.max(0, Math.min(this._svRect.height, (touch.y != null ? touch.y : touch.clientY) - this._svRect.top));
    const s = this._svRect.width ? x / this._svRect.width : 0;
    const v = this._svRect.height ? 1 - y / this._svRect.height : 1;
    const h = this.data.hsv ? this.data.hsv.h : 0;
    const rgb = this._hsvToRgb(h, s, v);
    const hex = this._rgbToHex(rgb.r, rgb.g, rgb.b);
    this.setData({
      hsv: { h, s, v },
      svHandle: { x, y },
      tempColorHex: hex
    });
  },

  _handleHueTouch(e) {
    if (!this._hueRect) return;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) return;
    const x = Math.max(0, Math.min(this._hueRect.width, (touch.x != null ? touch.x : touch.clientX) - this._hueRect.left));
    const h = this._hueRect.width ? (x / this._hueRect.width) * 360 : 0;
    const s = this.data.hsv ? this.data.hsv.s : 0;
    const v = this.data.hsv ? this.data.hsv.v : 1;
    const rgb = this._hsvToRgb(h, s, v);
    const hex = this._rgbToHex(rgb.r, rgb.g, rgb.b);
    this.setData({
      hsv: { h, s, v },
      hueHandle: { x },
      tempColorHex: hex
    });
  },

  _hexToRgb(hex) {
    if (!hex) return null;
    const raw = String(hex).trim().replace('#', '');
    if (raw.length === 3) {
      const r = parseInt(raw[0] + raw[0], 16);
      const g = parseInt(raw[1] + raw[1], 16);
      const b = parseInt(raw[2] + raw[2], 16);
      return { r, g, b };
    }
    if (raw.length !== 6) return null;
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some(v => Number.isNaN(v))) return null;
    return { r, g, b };
  },

  _rgbToHsv(r, g, b) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const delta = max - min;
    let h = 0;
    if (delta !== 0) {
      if (max === rr) {
        h = ((gg - bb) / delta) % 6;
      } else if (max === gg) {
        h = (bb - rr) / delta + 2;
      } else {
        h = (rr - gg) / delta + 4;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : delta / max;
    return { h, s, v: max };
  },

  confirmAddColor() {
    const code = this.data.tempColorCode.trim();
    const hex = this.data.tempColorHex.trim(); // Optional?
    
    if (!code) return wx.showToast({ title: '请输入色号', icon: 'none' });

    const { targetBrandId, targetSeriesId, targetGroupId, editingColorCode } = this.data;
    const customBrands = this.data.customBrands;
    const brand = customBrands.find(b => b.id === targetBrandId);
    if (!brand) return;
    
    const series = brand.subSeries.find(s => s.id === targetSeriesId);
    if (!series) return;

    let targetList;
    let groupName;

    // Determine target list (group or series root)
    if (targetGroupId) {
        const group = series.groups ? series.groups.find(g => g.id === targetGroupId) : null;
        if (!group) return wx.showToast({ title: '系列不存在', icon: 'none' });
        if (!group.colors) group.colors = [];
        targetList = group.colors;
        groupName = group.name;
    } else {
        // Fallback or root level
        if (!series.colors) series.colors = [];
        targetList = series.colors;
        groupName = series.name;
    }

    // Check duplicate (excluding self if editing)
    if (targetList.some(c => c.code === code && c.code !== editingColorCode)) {
      return wx.showToast({ title: '色号已存在', icon: 'none' });
    }

    const colorObj = {
      code: code,
      hex: hex || '#CCCCCC',
      series: groupName
    };

    if (editingColorCode) {
      const idx = targetList.findIndex(c => c.code === editingColorCode);
      if (idx > -1) {
        targetList[idx] = colorObj;
      }
    } else {
      targetList.push(colorObj);
    }

    this.setData({ customBrands, addColorVisible: false, editingColorCode: null });
    this._saveCustomBrands();
  },

  onDeleteColor(e) {
    const { brandId, seriesId, groupId, code } = e.currentTarget.dataset;
    const customBrands = this.data.customBrands;
    const brand = customBrands.find(b => b.id === brandId);
    if (brand) {
      const series = brand.subSeries.find(s => s.id === seriesId);
      if (series) {
          if (groupId && series.groups) {
              const group = series.groups.find(g => g.id === groupId);
              if (group && group.colors) {
                  group.colors = group.colors.filter(c => c.code !== code);
                  this.setData({ customBrands });
                  this._saveCustomBrands();
              }
          } else if (series.colors) {
              series.colors = series.colors.filter(c => c.code !== code);
              this.setData({ customBrands });
              this._saveCustomBrands();
          }
      }
    }
  },

  _saveCustomBrands() {
    // Save to local storage
    wx.setStorageSync(KEY_CUSTOM_BRANDS, this.data.customBrands);
    
    // Update runtime data
    this._initBrands();
    this._refreshAll();
    
    // Save to cloud
    if (this._docId) {
       db.collection(COLL_WAREHOUSE).doc(this._docId).update({
        data: {
          customBrands: this.data.customBrands,
          updateTime: db.serverDate()
        }
      }).catch(console.error);
    }
  }
});
