// 白条宽度占 tabBar 容器的百分比：120rpx / 750rpx 设计宽 ÷ 容器 90% 宽
// 这个比例与屏幕尺寸无关，写成常量，避免依赖 getSystemInfoSync 才算出正确 left
const CURSOR_WIDTH_PERCENT = (120 / 750 / 0.9) * 100; // ≈ 17.7778

Component({
  data: {
    selected: 0,
    cursorLeft: '3.61%', // 首页（第 0 项）的正确初始位置，避免首帧停在 0% 偏左
    cursorWidth: '120rpx',
    isDragging: false,
    hoverIndex: -1,
    initialized: false, // 是否已首次定位：首次定位关闭过渡，杜绝“从首页位再滑一次”
    isDevtools: false,
    list: [
      { pagePath: "/pages/index/index", text: "首页" },
      { pagePath: "/pages/mall/mall", text: "发现" },
      { pagePath: "/pages/square/square", text: "广场" },
      { pagePath: "/pages/profile/profile", text: "我的" }
    ]
  },

  attached() {
    this._ensureMetrics();

    // 根据当前页面路径初始化选中态：避免进入/返回 tab 页时小白条从首位滑过（解决“跳动两次”）
    try {
      const pages = getCurrentPages();
      const cur = pages[pages.length - 1];
      const route = cur && (cur.route || cur.__route__ || '');
      const idx = this.data.list.findIndex(t => {
        const p = t.pagePath.replace(/^\//, '');
        return route === p || route.indexOf(p) >= 0;
      });
      if (idx >= 0) {
        // 无论 selected 是否已是该值，都要重新定位一次，保证 left 是算出来的而不是初始值
        this.setSelected(idx);
      }
    } catch (e) {
      // 拿不到页面栈时，交给各页面 onShow 的 setSelected 兜底
    }

    this._startX = 0;
    this._startTime = 0;
    this._switchTimer = null;
  },

  detached() {
    if (this._switchTimer) clearTimeout(this._switchTimer);
    if (this._initTimer) clearTimeout(this._initTimer);
  },

  methods: {
    // 只在拖拽计算（px 坐标）时需要屏幕宽度；left 的百分比换算不依赖它
    _ensureMetrics() {
      if (this.cursorWidthPercent != null && this.windowWidth) return;
      let sysInfo = null;
      try {
        sysInfo = wx.getSystemInfoSync();
      } catch (e) {
        sysInfo = null;
      }
      this.windowWidth = (sysInfo && sysInfo.windowWidth) || this.windowWidth || 375;
      this.tabBarWidth = this.windowWidth * 0.9;
      this.tabBarLeft = this.windowWidth * 0.05;
      this.cursorWidthPercent = CURSOR_WIDTH_PERCENT;
      if (sysInfo) {
        this.setData({ isDevtools: sysInfo.platform === 'devtools' });
      }
    },

    _cursorLeftFor(index) {
      this._ensureMetrics();
      const tabCenterPercent = index * 25 + 12.5;
      let left = tabCenterPercent - this.cursorWidthPercent / 2;
      if (Number.isNaN(left)) left = 0;
      if (left < 0) left = 0;
      return left + '%';
    },

    setSelected(index) {
      this._ensureMetrics();
      // 关键：未首次定位时必须放行。否则首页 setSelected(0) 会因 selected 已是 0 被跳过，
      // 白条一直停在初始 left，看起来比正确位置偏左。
      if (this.data.selected === index && this.data.initialized) return;
      // 首次定位（initialized=false）：关闭过渡直接跳到位，避免“从首页位再滑一次”
      const isInitial = !this.data.initialized;
      this.setData({
        selected: index,
        cursorLeft: this._cursorLeftFor(index),
        cursorWidth: '120rpx',
        hoverIndex: -1,
        isDragging: isInitial,
        initialized: true
      });
      if (isInitial) {
        // 下一帧恢复过渡，保证后续点击切换动画正常
        if (this._initTimer) clearTimeout(this._initTimer);
        this._initTimer = setTimeout(() => {
          this._initTimer = null;
          this.setData({ isDragging: false });
        }, 60);
      }
    },

    switchTab(index) {
      const urls = [
        '/pages/index/index',
        '/pages/mall/mall',
        '/pages/square/square',
        '/pages/profile/profile'
      ];
      
      if (this.data.selected === index) return;

      if (this._switchTimer) clearTimeout(this._switchTimer);

      wx.vibrateShort({ type: 'light' });

      this.setData({
        isDragging: false,
        selected: index,
        cursorLeft: this._cursorLeftFor(index),
        cursorWidth: '120rpx',
        hoverIndex: -1,
        initialized: true
      });

      this._switchTimer = setTimeout(() => {
        this._switchTimer = null;
        wx.switchTab({ url: urls[index] });
      }, 150);
    },

    handleTabStart(e) {
      this._ensureMetrics();
      this._startX = e.touches[0].clientX;
      this._startY = e.touches[0].clientY;
      this._startTime = Date.now();
      this._isMoved = false;
      
      this._lastDragX = this._startX;
      this._lastDragTime = this._startTime;
      this._currentTabIndex = this.data.selected;
      
      this.setData({ isDragging: true });
    },

    handleTabDrag(e) {
      this._ensureMetrics();
      if (!this.windowWidth) return;
      
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const now = Date.now();
      
      if (Math.abs(clientY - this._startY) > Math.abs(clientX - this._startX) && !this._isMoved) {
        return;
      }

      this._isMoved = true;
      
      let relativeX = clientX - this.tabBarLeft;
      let percent = (relativeX / this.tabBarWidth) * 100;
      let cursorLeft = percent - (this.cursorWidthPercent / 2);
      
      const maxLeft = 100 - this.cursorWidthPercent;
      if (cursorLeft < 0) cursorLeft = 0;
      if (cursorLeft > maxLeft) cursorLeft = maxLeft;
      
      let newTabIndex = 0;
      if (percent < 25) newTabIndex = 0;
      else if (percent < 50) newTabIndex = 1;
      else if (percent < 75) newTabIndex = 2;
      else newTabIndex = 3;

      if (newTabIndex !== this._currentTabIndex) {
        wx.vibrateShort({ type: 'light' });
        this._currentTabIndex = newTabIndex;
      }

      const dt = now - this._lastDragTime;
      let cursorWidth = 120;

      if (dt > 0) {
        const dx = Math.abs(clientX - this._lastDragX);
        const velocity = dx / dt;
        
        const stretch = Math.min(velocity * 60, 60); 
        cursorWidth += stretch;
      }

      this._lastDragX = clientX;
      this._lastDragTime = now;

      this.setData({ 
        cursorLeft: cursorLeft + '%',
        cursorWidth: cursorWidth + 'rpx',
        hoverIndex: newTabIndex
      });
    },

    handleTabEnd(e) {
      const endTime = Date.now();
      const timeDiff = endTime - this._startTime;
      const clientX = e.changedTouches[0].clientX;
      
      let relativeX = clientX - this.tabBarLeft;
      let percent = (relativeX / this.tabBarWidth) * 100;
      
      let newTab = 0;
      if (percent < 25) newTab = 0;
      else if (percent < 50) newTab = 1;
      else if (percent < 75) newTab = 2;
      else newTab = 3;

      if (!this._isMoved || (timeDiff < 200 && Math.abs(clientX - this._startX) < 10)) {
        this.switchTab(newTab);
      } else {
        const prevTab = this.data.selected;
        this.setData({
          isDragging: false,
          selected: newTab,
          cursorLeft: this._cursorLeftFor(newTab),
          cursorWidth: '120rpx',
          hoverIndex: -1,
          initialized: true
        });
        
        if (prevTab !== newTab) {
           wx.vibrateShort({ type: 'medium' });
           if (this._switchTimer) clearTimeout(this._switchTimer);
           this._switchTimer = setTimeout(() => {
             this._switchTimer = null;
             wx.switchTab({ url: [
               '/pages/index/index',
               '/pages/mall/mall',
               '/pages/square/square',
               '/pages/profile/profile'
             ][newTab] });
           }, 150);
        }
      }
    },
  
    handleTabCancel() {
      const tab = this.data.selected;
      this.setData({
        isDragging: false,
        cursorLeft: this._cursorLeftFor(tab),
        cursorWidth: '120rpx',
        hoverIndex: -1
      });
    }
  }
})
