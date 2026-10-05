const app = getApp();

Page({
  data: {
    communityList: [],
    leftList: [],
    rightList: [],
    isRefreshing: false,
    feedSort: 'new',
    searchVisible: false,
    searchFocus: false,
    searchQuery: '',
    searchLoading: false,
    searchUsers: [],
    searchWorks: [],
    currentTab: 1,
    cursorLeft: '25%', // Default for 2nd tab
    isDragging: false
  },

  onLoad() {
    // Get window width for tabbar drag calculation
    const sysInfo = wx.getSystemInfoSync();
    this.windowWidth = sysInfo.windowWidth;
    
    // TabBar Metrics
    this.tabBarWidth = this.windowWidth * 0.9;
    this.tabBarLeft = this.windowWidth * 0.05;

    this.loadCommunityPosts();
    
    // Initialize refresh audio
    this.refreshAudio = wx.createInnerAudioContext();
    this.refreshAudio.src = '/audio/ding.mp3'; 
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected(1);
    }
  },

  openSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  closeSearch() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.setData({
      searchVisible: false,
      searchFocus: false,
      searchQuery: '',
      searchLoading: false,
      searchUsers: [],
      searchWorks: []
    });
  },

  noop() {},

  loadCommunityPosts() {
    wx.showLoading({ title: '加载灵感...' });
    const db = wx.cloud.database();
    
    // Using mock data if DB is empty or for robust initial display
    // But ideally fetch from DB.
    
    const orderByField = this.data.feedSort === 'hot' ? 'likes' : 'createTime';
    db.collection('community_posts').orderBy(orderByField, 'desc').get().then(async res => {
      // 批量换取临时链接
      const list = await this.exchangeCloudUrls(res.data);
      
      wx.hideLoading();
      this.processWaterfallData(list);
    }).catch(err => {
      wx.hideLoading();
      console.error('Failed to load community posts', err);
      // 不再用 mock 假数据兜底：读不到就保持空态，避免误导用户以为已有内容
    });
  },

  onFeedSortTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.feedSort) return;
    this.setData({ feedSort: key }, () => this.loadCommunityPosts());
  },

  // 辅助方法：批量换取云文件链接
  async exchangeCloudUrls(list) {
    if (!list || list.length === 0) return [];
    
    const fileIdSet = new Set();
    list.forEach((item) => {
      if (item && item.imageUrl && item.imageUrl.startsWith('cloud://')) fileIdSet.add(item.imageUrl);
      if (item && item.authorAvatar && item.authorAvatar.startsWith('cloud://')) fileIdSet.add(item.authorAvatar);
    });
    const fileList = Array.from(fileIdSet);
      
    if (fileList.length === 0) return list;
    
    try {
      const res = await wx.cloud.getTempFileURL({ fileList });
      const urlMap = {};
      res.fileList.forEach(file => {
        if (file.status === 0) {
          urlMap[file.fileID] = file.tempFileURL;
        }
      });
      
      return list.map(item => ({
        ...item,
        imageUrl: urlMap[item.imageUrl] || item.imageUrl,
        authorAvatar: urlMap[item.authorAvatar] || item.authorAvatar
      }));
    } catch (e) {
      console.error('Exchange URLs failed', e);
      return list;
    }
  },

  async exchangeUserAvatars(list) {
    if (!list || list.length === 0) return [];
    const fileList = list
      .filter(item => item.avatarUrl && item.avatarUrl.startsWith('cloud://'))
      .map(item => item.avatarUrl);
    if (fileList.length === 0) return list;

    try {
      const res = await wx.cloud.getTempFileURL({ fileList });
      const urlMap = {};
      res.fileList.forEach(file => {
        if (file.status === 0) urlMap[file.fileID] = file.tempFileURL;
      });
      return list.map(item => ({
        ...item,
        avatarUrl: urlMap[item.avatarUrl] || item.avatarUrl
      }));
    } catch (e) {
      console.error('Exchange user avatars failed', e);
      return list;
    }
  },

  onSearchInput(e) {
    const value = (e.detail && typeof e.detail.value === 'string') ? e.detail.value : '';
    const q = value.trim();
    this.setData({ searchQuery: value });

    if (this._searchTimer) clearTimeout(this._searchTimer);
    if (!q) {
      this.setData({ searchUsers: [], searchWorks: [], searchLoading: false });
      return;
    }

    this._searchTimer = setTimeout(() => {
      this.doSearchAll(q);
    }, 250);
  },

  onSearchConfirm() {
    const q = (this.data.searchQuery || '').trim();
    if (!q) return;
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.doSearchAll(q);
  },

  onSearchClear() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.setData({ searchQuery: '', searchUsers: [], searchWorks: [], searchLoading: false, searchFocus: true }, () => {
      setTimeout(() => this.setData({ searchFocus: false }), 300);
    });
  },

  doSearchAll(keyword) {
    this.setData({ searchLoading: true });
    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'searchAll', keyword }
    }).then(async res => {
      const r = res && res.result;
      if (!r || r.code !== 0) throw new Error((r && r.msg) || 'search failed');

      const users = await this.exchangeUserAvatars((r.data && r.data.users) || []);
      const worksRaw = (r.data && r.data.works) || [];
      const works = await this.exchangeCloudUrls(worksRaw);

      this.setData({
        searchUsers: users,
        searchWorks: works,
        searchLoading: false
      });
    }).catch(err => {
      console.error('Search failed', err);
      this.setData({ searchUsers: [], searchWorks: [], searchLoading: false });
    });
  },

  generateMockData() {
    // Fallback data to make the UI look populated immediately
    return [
      { _id: '1', content: 'Pixel Art City', imageUrl: 'https://picsum.photos/300/400?random=1', author: 'PixelMaster', likes: 120, authorAvatar: 'https://picsum.photos/100/100?random=101' },
      { _id: '2', content: 'My Little Pony', imageUrl: 'https://picsum.photos/400/300?random=2', author: 'PonyFan', likes: 85, authorAvatar: 'https://picsum.photos/100/100?random=102' },
      { _id: '3', content: 'Cyberpunk Vibes', imageUrl: 'https://picsum.photos/300/500?random=3', author: 'NeonBoy', likes: 230, authorAvatar: 'https://picsum.photos/100/100?random=103' },
      { _id: '4', content: 'Retro Game Boy', imageUrl: 'https://picsum.photos/400/400?random=4', author: 'RetroGamer', likes: 99, authorAvatar: 'https://picsum.photos/100/100?random=104' },
      { _id: '5', content: 'Space Invaders', imageUrl: 'https://picsum.photos/300/300?random=5', author: 'ArcadeKing', likes: 45, authorAvatar: 'https://picsum.photos/100/100?random=105' },
      { _id: '6', content: 'Sunset Beach', imageUrl: 'https://picsum.photos/300/450?random=6', author: 'BeachLover', likes: 150, authorAvatar: 'https://picsum.photos/100/100?random=106' },
    ];
  },

  processWaterfallData(list) {
    const leftList = [];
    const rightList = [];
    
    list.forEach((item, index) => {
      // Simple alternating distribution
      if (index % 2 === 0) {
        leftList.push(item);
      } else {
        rightList.push(item);
      }
    });
    
    this.setData({
      communityList: list,
      leftList,
      rightList
    });
  },

  onRefresh() {
    if (this._freshing) return;
    this._freshing = true;
    this.setData({ isRefreshing: true });
    
    setTimeout(() => {
      this.loadCommunityPosts(); // Reload data
      this.setData({ isRefreshing: false });
      this._freshing = false;
      if (this.refreshAudio) this.refreshAudio.play();
      wx.vibrateShort({ type: 'medium' });
    }, 1200);
  },

  onRestore() {
    // console.log('onRestore');
  },

  goToDetail(e) {
    const { id, title, imageUrl, author, likes } = e.currentTarget.dataset;
    let url = `/pages/detail/detail?id=${id}`;
    if (title) url += `&title=${encodeURIComponent(title)}`;
    if (imageUrl) url += `&imageUrl=${encodeURIComponent(imageUrl)}`;
    if (author) url += `&author=${encodeURIComponent(author)}`;
    if (likes) url += `&likes=${likes}`;
    wx.navigateTo({ url });
  },

  goToAuthor(e) {
    const openid = e.currentTarget.dataset.openid;
    if (!openid) return;
    wx.navigateTo({
      url: `/pages/user-profile/user-profile?openid=${encodeURIComponent(openid)}`
    });
  },

  goToUserProfile(e) {
    const openid = e.currentTarget.dataset.openid;
    if (!openid) return;
    wx.navigateTo({
      url: `/pages/user-profile/user-profile?openid=${encodeURIComponent(openid)}`
    });
  },

  goToUserProfileFromSearch(e) {
    const openid = e.currentTarget.dataset.openid;
    if (!openid) return;
    this.closeSearch();
    wx.navigateTo({
      url: `/pages/user-profile/user-profile?openid=${encodeURIComponent(openid)}`
    });
  },

  goToDetailFromSearch(e) {
    const { id, title, imageUrl, author, likes } = e.currentTarget.dataset;
    if (!id) return;
    this.closeSearch();
    let url = `/pages/detail/detail?id=${id}`;
    if (title) url += `&title=${encodeURIComponent(title)}`;
    if (imageUrl) url += `&imageUrl=${encodeURIComponent(imageUrl)}`;
    if (author) url += `&author=${encodeURIComponent(author)}`;
    if (likes) url += `&likes=${likes}`;
    wx.navigateTo({ url });
  },

  onToggleFollowFromSearch(e) {
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

    const toOpenid = e.currentTarget.dataset.openid;
    const index = Number(e.currentTarget.dataset.index);
    if (!toOpenid || Number.isNaN(index)) return;

    wx.cloud.callFunction({
      name: 'template-api',
      data: { action: 'toggleFollow', toOpenid }
    }).then(res => {
      const r = res && res.result;
      if (!r || r.code !== 0) throw new Error((r && r.msg) || 'toggle failed');
      const next = this.data.searchUsers.slice();
      if (next[index]) next[index].isFollowing = !!(r.data && r.data.isFollowing);
      this.setData({ searchUsers: next });
    }).catch(err => {
      console.error('Toggle follow failed', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  onCreateTap() {
    wx.vibrateShort({ type: 'light' });
    if (!app.globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '登录后可同步创作数据，是否先去登录？',
        confirmText: '去登录',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }
    wx.navigateTo({ url: '/pages/game/game' });
  },

  onGenerateTap() {
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({ url: '/pages/generate/generate' });
  },

  onImageError(e) {
    const { list, index } = e.currentTarget.dataset;
    const listKey = list === 'left' ? 'leftList' : 'rightList';
    const currentList = this.data[listKey];
    
    if (currentList[index]) {
      // 设置默认图片或占位图
      currentList[index].imageUrl = '/images/placeholder.png'; // 假设有个占位图，或者使用网络图片
      // 或者直接移除该项，防止空白
      // currentList.splice(index, 1);
      
      this.setData({
        [listKey]: currentList
      });
    }
  },

  // TabBar Interaction
  // Removed custom implementation, now using custom-tab-bar component

  navigateToTab(index) {
    if (index === 1) {
      wx.pageScrollTo({ scrollTop: 0, duration: 300 });
      return;
    }
    const urls = ['/pages/index/index', '/pages/mall/mall', '/pages/square/square', '/pages/profile/profile'];
    wx.switchTab({ url: urls[index] });
  },

  onShareAppMessage() {
    return {
      title: '灵感发现 - 发现精选拼豆作品',
      path: '/pages/mall/mall',
      imageUrl: '/images/share-cover.png'
    };
  },

  onShareTimeline() {
    return {
      title: '灵感发现 - 发现精选拼豆作品',
      query: '',
      imageUrl: '/images/share-cover.png'
    };
  }
})
