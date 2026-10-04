Component({
  data: {
    selected: 0,
    cursorLeft: '0%',
    cursorWidth: '120rpx',
    isDragging: false,
    hoverIndex: -1,
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

    this._startX = 0;
    this._startTime = 0;
    this._switchTimer = null;
  },

  detached() {
    if (this._switchTimer) clearTimeout(this._switchTimer);
  },

  methods: {
    setSelected(index) {
      const tabCenterPercent = index * 25 + 12.5;
      const cursorLeftPercent = tabCenterPercent - (this.cursorWidthPercent / 2);
      this.setData({
        selected: index,
        cursorLeft: cursorLeftPercent + '%',
        cursorWidth: '120rpx',
        hoverIndex: -1
      });
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
      }, 200);
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
           }, 200);
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
