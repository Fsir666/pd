const app = getApp();
const presets = require('../../data/pattern-presets.js');

Page({
  data: {
    communityList: [],
    feedLeft: [],
    feedRight: [],
    feedCount: 0,
    isRefreshing: false,
    feedSort: 'new',
    feedTag: '',
    searchVisible: false,
    searchFocus: false,
    searchQuery: '',
    searchLoading: false,
    searchUsers: [],
    searchWorks: [],
    currentTab: 1,
    cursorLeft: '25%', // Default for 2nd tab
    isDragging: false,
    presetList: []
  },

  onLoad() {
    // Get window width for tabbar drag calculation
    const sysInfo = wx.getSystemInfoSync();
    this.windowWidth = sysInfo.windowWidth;
    
    // TabBar Metrics
    this.tabBarWidth = this.windowWidth * 0.9;
    this.tabBarLeft = this.windowWidth * 0.05;

    this.setData({
      presetList: presets.map(p => ({
        key: p.key,
        name: p.name,
        tags: p.tags || [],
        w: p.w,
        h: p.h,
        beadCount: p.beadCount,
        thumb: '/images/patterns/' + p.key + '.png',
        // 本地兜底：内置图纸都归属「冯」账号（seed 发布到云端），
        // 云端数据回来前先显示作者名，避免作者行空白。
        authorName: '冯',
        authorAvatar: '',
        authorInitial: '冯',
        likes: 0
      }))
    }, () => {
      this.buildFeed();
      this.loadCommunityPosts();
      this.enrichPresetsWithMeta();
    });

    // Initialize refresh audio
    this.refreshAudio = wx.createInnerAudioContext();
    this.refreshAudio.src = '/audio/ding.mp3';
  },

  // 批量读取内置图纸在云端的「作者 + 点赞数」（seed_<key> 记录）
  enrichPresetsWithMeta() {
    const db = wx.cloud.database();
    const keys = this.data.presetList.map(p => p.key);
    if (!keys.length) return;
    // where 支持 _.in，一次最多 20 个，分批查
    const chunks = [];
    for (let i = 0; i < keys.length; i += 20) chunks.push(keys.slice(i, i + 20));
    const tasks = chunks.map(chunk =>
      db.collection('templates')
        .where({ _id: db.command.in(chunk.map(k => 'seed_' + k)) })
        .limit(100)
        .get()
        .catch(() => ({ data: [] }))
    );
    Promise.all(tasks).then(results => {
      const map = {};
      results.forEach(res => {
        (res.data || []).forEach(d => {
          const k = String(d._id || '').replace(/^seed_/, '');
          map[k] = d;
        });
      });
      const presetList = this.data.presetList.map(p => {
        const d = map[p.key];
        if (!d) return p;
        const ui = d.userInfo || {};
        const name = d.author || ui.nickName || '';
        return {
          ...p,
          authorName: name,
          authorAvatar: d.authorAvatar || ui.avatarUrl || '',
          authorInitial: name ? name.charAt(0) : '',
          likes: d.likeCount || d.heat || 0
        };
      });
      this.setData({ presetList }, () => this.buildFeed());
    });
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
    const tag = (this.data.feedTag || '').trim();
    const orderByField = this.data.feedSort === 'hot' ? 'likes' : 'createTime';

    // 统一收口：换完临时链接 -> 客户端排序 -> 落库渲染
    const finish = (rawList) => {
      const list = this._sortByField(rawList || [], orderByField);
      wx.hideLoading();
      this.setData({ communityList: list }, () => this.buildFeed());
    };

    const onError = (err) => {
      wx.hideLoading();
      console.error('Failed to load community posts', err);
      // 读不到社区数据也不影响图纸展示：清掉作品，重建统一信息流（图纸仍显示）
      this.setData({ communityList: [] }, () => this.buildFeed());
    };

    if (tag) {
      // 分类筛选：云端正则匹配标题/正文/标签，排序放客户端做，避免依赖云端复合索引
      db.collection('community_posts')
        .where(db.command.or([
          { content: db.RegExp({ regexp: tag, options: 'i' }) },
          { title: db.RegExp({ regexp: tag, options: 'i' }) },
          { tags: tag }
        ]))
        .limit(100)
        .get()
        .then(async res => finish(await this.exchangeCloudUrls(res.data)))
        .catch(onError);
      return;
    }

    db.collection('community_posts').orderBy(orderByField, 'desc').limit(100).get().then(async res => {
      // 批量换取临时链接
      finish(await this.exchangeCloudUrls(res.data));
    }).catch(onError);
  },

  // 客户端排序：兼容数字时间戳/Date/字符串，缺字段的排最后
  _sortByField(list, field) {
    return list.slice().sort((a, b) => {
      const va = a && a[field];
      const vb = b && b[field];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return vb - va;
      const ta = va instanceof Date ? va.getTime() : Number(va);
      const tb = vb instanceof Date ? vb.getTime() : Number(vb);
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta;
      return String(va).localeCompare(String(vb));
    });
  },

  onFeedSortTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    wx.vibrateShort({ type: 'light' });
    // 切排序时清掉分类，避免两种筛选状态打架
    if (key === this.data.feedSort && !this.data.feedTag) return;
    this.setData({ feedSort: key, feedTag: '' }, () => {
      this.buildFeed();
      this.loadCommunityPosts();
    });
  },

  onFeedTagTap(e) {
    const tag = e.currentTarget.dataset.tag;
    if (!tag) return;
    wx.vibrateShort({ type: 'light' });
    // 再点一次同一个分类 = 取消筛选
    const nextTag = this.data.feedTag === tag ? '' : tag;
    this.setData({ feedTag: nextTag }, () => {
      this.buildFeed();
      this.loadCommunityPosts();
    });
  },

  // 统一信息流：把「图纸」和「今日灵感作品」合并成一个瀑布流一起显示
  buildFeed() {
    const tag = this.data.feedTag;

    // 1) 图纸卡片
    let patterns = this.data.presetList;
    if (tag) patterns = patterns.filter(p => (p.tags || []).indexOf(tag) >= 0);
    const patternItems = patterns.map(p => ({
      type: 'pattern',
      _id: 'preset_' + p.key,
      key: p.key,
      name: p.name,
      thumb: p.thumb,
      tags: p.tags || [],
      beadCount: p.beadCount,
      authorName: p.authorName || '',
      authorAvatar: p.authorAvatar || '',
      authorInitial: p.authorInitial || '',
      likes: p.likes || 0
    }));

    // 2) 作品卡片（communityList 已由 loadCommunityPosts 按 tag 过滤好）
    // 去重：内置图纸已被 patternItems 承载（且内置卡跳转的详情页更完整——色号矩阵/用料清单/收藏），
    // 所以过滤掉 seed_<key> 的种子作品，避免同一图案在信息流出现两次。
    // 注：这些作品仍完整保留在「我的作品」页。
    const postItems = (this.data.communityList || [])
      .filter(p => !String(p._id || '').startsWith('seed_'))
      .map(p => ({
        type: 'post',
        _id: p._id,
        content: p.content,
        imageUrl: p.imageUrl,
        author: p.author,
        authorAvatar: p.authorAvatar,
        likes: p.likes,
        _openid: p._openid
      }));

    // 3) 合并
    let merged;
    if (tag) {
      // 选了分类：图纸在前、作品在后，全部已是该分类内容
      merged = patternItems.concat(postItems);
    } else {
      // 无筛选：交替穿插，让图纸和作品混在一起出现；末尾补「查看全部图纸」入口
      merged = [];
      const maxLen = Math.max(patternItems.length, postItems.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < patternItems.length) merged.push(patternItems[i]);
        if (i < postItems.length) merged.push(postItems[i]);
      }
      merged.push({ type: 'more', _id: 'more_all' });
    }

    // 4) 分两列
    const feedLeft = [];
    const feedRight = [];
    merged.forEach((item, idx) => {
      if (idx % 2 === 0) feedLeft.push(item);
      else feedRight.push(item);
    });

    this.setData({ feedLeft, feedRight, feedCount: merged.length });
  },

  openPattern(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({ url: '/pages/pattern-detail/pattern-detail?key=' + key });
  },

  openPatternList() {
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({ url: '/pages/patterns/patterns' });
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

  onImageError(e) {
    const { list, index } = e.currentTarget.dataset;
    const listKey = list === 'left' ? 'feedLeft' : 'feedRight';
    const currentList = this.data[listKey];
    const item = currentList[index];

    // 已是占位图则跳过，避免加载失败时反复触发 error
    if (item && item.type === 'post' && item.imageUrl !== '/images/placeholder.png') {
      item.imageUrl = '/images/placeholder.png';
      this.setData({ [listKey]: currentList });
    }
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
