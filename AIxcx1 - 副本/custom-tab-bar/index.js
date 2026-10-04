Component({
  data: {
    selected: 0,
    cursorLeft: '0%', // 初始光标位置
    cursorWidth: '120rpx', // 初始光标宽度
    isDragging: false, // 是否正在拖拽
    hoverIndex: -1, // 当前光标悬停的索引（用于扫光动画）
    isDevtools: false,
    list: [
      { pagePath: "/pages/index/index", text: "首页" },
      { pagePath: "/pages/mall/mall", text: "社区" },
      { pagePath: "/pages/square/square", text: "广场" },
      { pagePath: "/pages/profile/profile", text: "我的" }
    ]
  },

  attached() {
    const sysInfo = wx.getSystemInfoSync();
    this.windowWidth = sysInfo.windowWidth;
    this.tabBarWidth = this.windowWidth * 0.9;
    this.tabBarLeft = this.windowWidth * 0.05;
    this.setData({ isDevtools: !!(sysInfo && sysInfo.platform === 'devtools') });

    this._startX = 0;
    this._startTime = 0;
    this._switchTimer = null;
  },

  detached() {
    if (this._switchTimer) clearTimeout(this._switchTimer);
  },

  methods: {
    switchTab(index) {
      const urls = [
        '/pages/index/index',
        '/pages/mall/mall',
        '/pages/square/square',
        '/pages/profile/profile'
      ];
      
      // 如果点击的是当前 Tab，不执行任何操作
      if (this.data.selected === index) return;

      if (this._switchTimer) clearTimeout(this._switchTimer);

      wx.vibrateShort({ type: 'light' });
      
      this.setData({
        isDragging: false, // 确保 transition 生效
        selected: index,
        cursorLeft: (index * 25) + '%',
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
      this._startY = e.touches[0].clientY; // 记录Y轴以防止垂直滚动干扰
      this._startTime = Date.now();
      this._isMoved = false;
      
      // Initialize for haptics and elastic width
      this._lastDragX = this._startX;
      this._lastDragTime = this._startTime;
      this._currentTabIndex = this.data.selected; // Track current tab index for haptics
      
      this.setData({ isDragging: true });
    },

    handleTabDrag(e) {
      if (!this.windowWidth) return;
      
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const now = Date.now();
      
      // 如果垂直移动距离大于水平移动，认为是页面滚动，不处理拖拽
      if (Math.abs(clientY - this._startY) > Math.abs(clientX - this._startX) && !this._isMoved) {
        return;
      }

      this._isMoved = true;
      
      // Calculate relative position
      let relativeX = clientX - this.tabBarLeft;
      let percent = (relativeX / this.tabBarWidth) * 100;
      let cursorLeft = percent - 12.5; // Center cursor
      
      // Clamp
      if (cursorLeft < 0) cursorLeft = 0;
      if (cursorLeft > 75) cursorLeft = 75;
      
      // --- Haptic Feedback & Hover State ---
      // Determine which tab we are currently hovering over
      let newTabIndex = 0;
      if (percent < 25) newTabIndex = 0;
      else if (percent < 50) newTabIndex = 1;
      else if (percent < 75) newTabIndex = 2;
      else newTabIndex = 3;

      // Vibrate when crossing tab boundaries
      if (newTabIndex !== this._currentTabIndex) {
        wx.vibrateShort({ type: 'light' });
        this._currentTabIndex = newTabIndex;
      }

      // --- Elastic Deformation ---
      // Calculate velocity
      const dt = now - this._lastDragTime;
      let cursorWidth = 120; // Default width in rpx

      if (dt > 0) {
        const dx = Math.abs(clientX - this._lastDragX);
        const velocity = dx / dt; // pixels per ms
        
        // Scale factor: e.g., velocity 1px/ms -> width increase by 40rpx
        // Max width increase limit to avoid looking broken (limit to +60rpx)
        const stretch = Math.min(velocity * 60, 60); 
        cursorWidth += stretch;
      }

      // Update last state
      this._lastDragX = clientX;
      this._lastDragTime = now;

      this.setData({ 
        cursorLeft: cursorLeft + '%',
        cursorWidth: cursorWidth + 'rpx',
        hoverIndex: newTabIndex // 更新悬停索引，触发文字变色
      });
    },

    handleTabEnd(e) {
      const endTime = Date.now();
      const timeDiff = endTime - this._startTime;
      const clientX = e.changedTouches[0].clientX; // use changedTouches for touchend
      
      // 计算当前手指所在的 Tab 索引
      let relativeX = clientX - this.tabBarLeft;
      let percent = (relativeX / this.tabBarWidth) * 100;
      
      let newTab = 0;
      if (percent < 25) newTab = 0;
      else if (percent < 50) newTab = 1;
      else if (percent < 75) newTab = 2;
      else newTab = 3;

      // 判断是点击还是拖拽
      // 如果移动距离很小且时间很短，或者没有触发 move 事件，视为点击
      if (!this._isMoved || (timeDiff < 200 && Math.abs(clientX - this._startX) < 10)) {
        // 点击逻辑：直接切换到手指所在的 Tab
        this.switchTab(newTab);
      } else {
        const prevTab = this.data.selected;
        // 拖拽逻辑：吸附
        this.setData({
          isDragging: false,
          selected: newTab,
          cursorLeft: (newTab * 25) + '%',
          cursorWidth: '120rpx',
          hoverIndex: -1 // 重置悬停
        });
        
        // 延迟跳转，让吸附动画先播放一点点，体验更好
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
      this.setData({
        isDragging: false,
        cursorLeft: (tab * 25) + '%',
        cursorWidth: '120rpx',
        hoverIndex: -1
      });
    }
  }
})
