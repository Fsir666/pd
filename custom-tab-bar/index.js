Component({
  data: {
    selected: 0,
    cursorLeft: '0%',
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
    const sysInfo = wx.getSystemInfoSync();
    this.windowWidth = sysInfo.windowWidth;
    this.tabBarWidth = this.windowWidth * 0.9;
    this.tabBarLeft = this.windowWidth * 0.05;
    
    const cursorWidthPx = (120 / 750) * this.windowWidth;
    this.cursorWidthPercent = (cursorWidthPx / this.tabBarWidth) * 100;
    
    this.setData({ isDevtools: !!(sysInfo && sysInfo.platform === 'devtools') });

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
        const tabCenterPercent = idx * 25 + 12.5;
        const cursorLeftPercent = tabCenterPercent - (this.cursorWidthPercent / 2);
        this.setData({
          selected: idx,
          cursorLeft: cursorLeftPercent + '%',
          cursorWidth: '120rpx',
          hoverIndex: -1,
          isDragging: true, // 首帧关闭过渡，直接定位到正确位置
          initialized: true
        });
        // 下一帧恢复过渡，保证后续点击动画正常
        setTimeout(() => this.setData({ isDragging: false }), 60);
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
  },

  methods: {
    setSelected(index) {
      if (this.data.selected === index) return; // 已选中则跳过，避免重复动画
      const tabCenterPercent = index * 25 + 12.5;
      const cursorLeftPercent = tabCenterPercent - (this.cursorWidthPercent / 2);
      // 首次定位（initialized=false）：关闭过渡直接跳到位，避免“从首页位再滑一次”
      const isInitial = !this.data.initialized;
      this.setData({
        selected: index,
        cursorLeft: cursorLeftPercent + '%',
        cursorWidth: '120rpx',
        hoverIndex: -1,
        isDragging: isInitial,
        initialized: true
      });
      if (isInitial) {
        // 下一帧恢复过渡，保证后续点击切换动画正常
        setTimeout(() => this.setData({ isDragging: false }), 60);
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
      
      const tabCenterPercent = index * 25 + 12.5;
      const cursorLeftPercent = tabCenterPercent - (this.cursorWidthPercent / 2);
      
      this.setData({
        isDragging: false,
        selected: index,
        cursorLeft: cursorLeftPercent + '%',
        cursorWidth: '120rpx',
        hoverIndex: -1
      });

      this._switchTimer = setTimeout(() => {
        this._switchTimer = null;
        wx.switchTab({ url: urls[index] });
      }, 150);
    },

    handleTabStart(e) {
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
        const tabCenterPercent = newTab * 25 + 12.5;
        const cursorLeftPercent = tabCenterPercent - (this.cursorWidthPercent / 2);
        
        this.setData({
          isDragging: false,
          selected: newTab,
          cursorLeft: cursorLeftPercent + '%',
          cursorWidth: '120rpx',
          hoverIndex: -1
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
      const tabCenterPercent = tab * 25 + 12.5;
      const cursorLeftPercent = tabCenterPercent - (this.cursorWidthPercent / 2);
      
      this.setData({
        isDragging: false,
        cursorLeft: cursorLeftPercent + '%',
        cursorWidth: '120rpx',
        hoverIndex: -1
      });
    }
  }
})
