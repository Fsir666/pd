Page({
  data: {
    brands: [
      { id: 'mard', name: 'Mard', initial: 'M', desc: '系列套装', colors: '9 个色卡', color: '#FF6B6B', tag: '热门' },
      { id: 'hdds', name: '黄豆豆', initial: '黄', desc: '系列套装', colors: '7 个色卡', color: '#FFD93D', tag: '推荐' },
      { id: 'dodo', name: 'DoDo', initial: 'D', desc: '系列套装', colors: '11 个色卡', color: '#4D96FF' },
      { id: 'coco', name: 'CoCo', initial: 'C', desc: '系列套装', colors: '10 个色卡', color: '#6BCB77' },
      { id: 'manman', name: '漫漫', initial: '漫', desc: '系列套装', colors: '1 个色卡', color: '#9B59B6' },
      { id: 'xiaowu', name: '小舞', initial: '小', desc: '系列套装', colors: '1 个色卡', color: '#FF9F43' },
      { id: 'mixiaowo', name: '咪小窝', initial: '咪', desc: '系列套装', colors: '2 个色卡', color: '#E17055' },
      { id: 'kaka', name: '卡卡', initial: '卡', desc: '系列套装', colors: '1 个色卡', color: '#00CEC9' },
      { id: 'youken', name: '优肯', initial: '优', desc: '系列套装', colors: '3 个色卡', color: '#74B9FF' },
      { id: 'shishi', name: '柿柿', initial: '柿', desc: '系列套装', colors: '1 个色卡', color: '#FD79A8' },
      { id: 'tongqu', name: '童趣', initial: '童', desc: '系列套装', colors: '1 个色卡', color: '#FDCB6E' },
      { id: 'panpan', name: '盼盼', initial: '盼', desc: '系列套装', colors: '1 个色卡', color: '#A29BFE' }
    ]
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '色卡对照表'
    });
  },

  // 查看颜色
  onViewColors(e) {
    const brandId = e.currentTarget.dataset.id;
    const brandName = e.currentTarget.dataset.name;
    
    wx.navigateTo({
      url: `/packageTool/pages/brand-detail/brand-detail?id=${brandId}&name=${brandName}`
    });
  },

  // 查看色卡
  onViewChart(e) {
    const brandId = e.currentTarget.dataset.id;
    const brandName = e.currentTarget.dataset.name;
    
    wx.navigateTo({
      url: `/packageTool/pages/brand-detail/brand-detail?id=${brandId}&name=${brandName}`
    });
  }
});