Page({
  data: {
    template: null,
    showModal: false,
    // 评论区总开关：false=隐藏全部评论相关界面（审核需要），改回 true 即可恢复
    showComment: false,
    
    // 尺寸选择相关
    sizeIndex: 0,
    sizeOptions: [
      { level: '简单', size: 32 },
      { level: '中等', size: 48 },
      { level: '困难', size: 64 }
    ],
    currentSizeStr: '32x32',

    // 评论区相关
    activeTab: 0, // 0: 最新, 1: 最热
    commentContent: '',
    commentImages: [],
    comments: [
      {
        id: 1,
        userInfo: {
          nickName: '像素艺术家',
          avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
        },
        content: '这个图纸太棒了！拼出来效果很好。',
        images: [],
        createTime: '10月24日',
        likes: 128
      },
      {
        id: 2,
        userInfo: {
          nickName: '拼豆萌新',
          avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
        },
        content: '刚开始觉得有点难，但是跟着引导做很快就完成了！',
        images: ['https://mmbiz.qpic.cn/mmbiz_png/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'],
        createTime: '10月23日',
        likes: 45
      }
    ]
  },

  // 3D 渲染相关变量
  renderer: {
    beads: [], // {x, y, z, color}
    angleX: 0,
    angleY: 0,
    baseScale: 15, // 基础缩放比例
    currentScale: 1, // 当前交互缩放
    isDragging: false,
    lastTouchX: 0,
    lastTouchY: 0,
    lastTouchDist: 0,
    autoRotate: true,
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    requestId: null,
    imageLoaded: false,
    originalImage: null // 保存原始图片对象以便重新计算尺寸
  },

  onLoad(options) {
    const id = options.id;
    const imageUrl = options.imageUrl ? decodeURIComponent(options.imageUrl) : null;
    
    // 优先使用云函数获取最新详情
    this.fetchTemplateDetail(id, imageUrl);
    // 加载评论
    this.loadComments(id);
  },

  // 加载评论
  loadComments(id) {
    const sortBy = this.data.activeTab === 0 ? 'new' : 'hot';
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'getComments',
        templateId: id,
        sortBy: sortBy
      }
    }).then(res => {
      if (res.result.code === 0) {
        const comments = res.result.data.map(item => ({
          ...item,
          // 格式化时间为几月几号
          createTime: this.formatDate(new Date(item.createTime))
        }));
        this.setData({ comments });
      }
    }).catch(console.error);
  },

  formatDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  onUnload() {
    this.stopRender();
  },

  fetchTemplateDetail(id, imageUrl) {
    wx.showLoading({ title: '加载中...' });
    
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'getDetail',
        id: id
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.code === 0) {
        const data = res.result.data;
        if (!data.imageUrl && imageUrl) {
          data.imageUrl = imageUrl;
        }
        this.setData({ template: data });
        // 数据加载完成后，初始化3D场景
        this.init3DScene(data.imageUrl);
      } else {
        console.error('获取详情失败', res);
        wx.showToast({ title: '图纸不存在', icon: 'none' });
        if (imageUrl) {
            const data = {
                imageUrl: imageUrl,
                title: '未知图纸',
                author: '未知',
                description: '无法加载详细信息',
                size: '32x32'
            };
            this.setData({ template: data });
            this.init3DScene(imageUrl);
        }
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('详情云函数调用失败', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  // --- 尺寸选择逻辑 ---
  onSizeSelect(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.sizeIndex) return;

    this.setData({ sizeIndex: index });
    
    // 重新生成 3D 预览
    if (this.renderer.originalImage) {
      const maxEdge = this.data.sizeOptions[index].size;
      const sizeStr = this.calculateSizeStr(this.renderer.originalImage, maxEdge);
      this.setData({ currentSizeStr: sizeStr });
      this.generateBeadsFromImage(this.renderer.originalImage, sizeStr);
    }
  },

  calculateSizeStr(img, maxEdge) {
    const ratio = img.width / img.height;
    let cols, rows;
    if (ratio >= 1) {
      cols = maxEdge;
      rows = Math.round(maxEdge / ratio);
    } else {
      rows = maxEdge;
      cols = Math.round(maxEdge * ratio);
    }
    return `${cols}x${rows}`;
  },

  // --- 评论区逻辑 ---
  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.activeTab) return;
    
    this.setData({ activeTab: index }, () => {
      if (this.data.template) {
        this.loadComments(this.data.template._id || this.data.template.id);
      }
    });
  },

  onInput(e) {
    this.setData({ commentContent: e.detail.value });
  },

  onChooseImage() {
    wx.chooseImage({
      count: 3 - this.data.commentImages.length,
      success: (res) => {
        this.setData({
          commentImages: [...this.data.commentImages, ...res.tempFilePaths]
        });
      }
    });
  },

  onDeleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.commentImages;
    images.splice(index, 1);
    this.setData({ commentImages: images });
  },

  async onSubmitComment() {
    // 评论属于 UGC，必须登录后再发（与同页 onLikeTemplate 的守卫保持一致）。
    // 历史 bug：这里没有守卫，未登录也能发出去，
    // userInfo 会 fallback 成假名「像素用户」，评论区出现无名氏评论。
    if (!getApp().globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再评论',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' });
        }
      });
      return;
    }

    if (!this.data.commentContent && this.data.commentImages.length === 0) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发送中...' });

    try {
      // 1. 上传图片到云存储
      const cloudImageUrls = [];
      for (const filePath of this.data.commentImages) {
        const extension = filePath.split('.').pop();
        const cloudPath = `comments/${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath
        });
        cloudImageUrls.push(uploadRes.fileID);
      }

      // 2. 调用云函数保存评论
      const res = await wx.cloud.callFunction({
        name: 'template-api',
        data: {
          action: 'addComment',
          templateId: this.data.template._id || this.data.template.id,
          content: this.data.commentContent,
          images: cloudImageUrls,
          userInfo: getApp().globalData.userInfo || { nickName: '像素用户', avatarUrl: '' }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '评论成功', icon: 'success' });
        this.setData({
          commentContent: '',
          commentImages: []
        });
        // 重新加载评论
        this.loadComments(this.data.template._id || this.data.template.id);
      } else {
        throw new Error(res.result?.msg || '发送失败');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('发表评论失败', err);
      wx.showToast({ title: err.message || '网络错误', icon: 'none' });
    }
  },

  // 点赞图纸
  onLikeTemplate() {
    // 检查登录状态
    if (!getApp().globalData.isLogged) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再点赞',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return;
    }

    if (!this.data.template) return;
    
    wx.showLoading({ title: '点赞中...' });
    
    wx.cloud.callFunction({
      name: 'template-api',
      data: {
        action: 'likeTemplate',
        templateId: this.data.template._id || this.data.template.id
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '点赞成功', icon: 'success' });
        // 更新本地点赞数
        const template = this.data.template;
        template.heat = (template.heat || 0) + 1;
        this.setData({ template });
      } else if (res.result.code === 1001) {
        wx.showModal({
          title: '提示',
          content: '一天只能点赞10次，第二天再来。',
          showCancel: false
        });
      } else {
        wx.showToast({ title: res.result.msg || '点赞失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('点赞失败', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  // --- 3D 渲染逻辑 ---

  init3DScene(imageUrl) {
    // 1. 获取 Canvas 节点
    wx.createSelectorQuery()
      .select('#previewCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return;
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        this.renderer.canvas = canvas;
        this.renderer.ctx = ctx;
        this.renderer.width = res[0].width;
        this.renderer.height = res[0].height;

        // 2. 处理图片数据
        this.downloadAndProcessImage(imageUrl, canvas);
      });
  },

  downloadAndProcessImage(url, canvas) {
    console.log('开始处理图片:', url);
    const process = (localPath) => {
      console.log('图片下载成功，本地路径:', localPath);
      this.loadImage(localPath, canvas);
    };

    if (url.startsWith('cloud://')) {
      wx.cloud.downloadFile({
        fileID: url,
        success: res => process(res.tempFilePath),
        fail: err => {
          console.error('云文件下载失败', err);
          wx.showToast({ title: '无权限:请检查云存储权限设置', icon: 'none', duration: 3000 });
          
          // 绘制失败提示
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#cccccc';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 24px sans-serif';
          ctx.fillText('图片加载失败', canvas.width / 2, canvas.height / 2);
        }
      });
    } else {
      wx.getImageInfo({
        src: url,
        success: res => process(res.path),
        fail: err => {
          console.error('图片下载失败', err);
          this.loadImage(url, canvas); // 尝试直接加载
        }
      });
    }
  },

  loadImage(imageUrl, canvas) {
    const img = canvas.createImage();
    img.src = imageUrl;
    img.onload = () => {
        this.renderer.originalImage = img; // 保存引用
        
        // 计算初始尺寸
        const maxEdge = this.data.sizeOptions[this.data.sizeIndex].size;
        const sizeStr = this.calculateSizeStr(img, maxEdge);
        this.setData({ currentSizeStr: sizeStr });

        this.generateBeadsFromImage(img, sizeStr);
    };
    img.onerror = (e) => {
        console.error('Canvas 图片加载失败:', e);
    };
  },

  generateBeadsFromImage(img, sizeStr) {
    try {
        const [cols, rows] = sizeStr.split('x').map(Number);
        
        // 创建离屏 Canvas (基础库 2.7.0+)
        let offCtx;
        if (wx.createOffscreenCanvas) {
            const offCanvas = wx.createOffscreenCanvas({ type: '2d', width: cols, height: rows });
            offCtx = offCanvas.getContext('2d');
        } else {
            throw new Error('当前微信版本不支持离屏 Canvas');
        }
        
        offCtx.drawImage(img, 0, 0, cols, rows);
        const imgData = offCtx.getImageData(0, 0, cols, rows);
        const pixels = imgData.data;

        // 生成豆子数据
        const beads = [];
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const i = (y * cols + x) * 4;
            const r = pixels[i];
            const g = pixels[i+1];
            const b = pixels[i+2];
            const a = pixels[i+3];

            if (a > 100) { // 忽略透明像素
              beads.push({
                x: x - cols / 2 + 0.5, // 居中
                y: y - rows / 2 + 0.5,
                z: 0,
                color: `rgb(${r},${g},${b})`
              });
            }
          }
        }

        this.renderer.beads = beads;
        this.renderer.imageLoaded = true;
        this.renderer.baseScale = Math.min(this.renderer.width, this.renderer.height) / Math.max(cols, rows) * 0.8;
        
        // 开始渲染循环
        this.startRender();

      } catch (err) {
          console.error('3D 数据生成失败:', err);
          wx.showToast({ title: '渲染初始化失败', icon: 'none' });
      }
  },

  startRender() {
    if (this.renderer.requestId) return;
    
    const loop = () => {
      this.renderFrame();
      this.renderer.requestId = this.renderer.canvas.requestAnimationFrame(loop);
    };
    this.renderer.requestId = this.renderer.canvas.requestAnimationFrame(loop);
  },

  stopRender() {
    if (this.renderer.requestId) {
      this.renderer.canvas.cancelAnimationFrame(this.renderer.requestId);
      this.renderer.requestId = null;
    }
  },

  renderFrame() {
    const { ctx, width, height, beads, angleX, angleY, baseScale, currentScale, autoRotate } = this.renderer;
    
    if (!ctx) return;

    // 自动旋转
    if (autoRotate && !this.data.showModal) {
      this.renderer.angleY += 0.01;
    }

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 投影中心
    const cx = width / 2;
    const cy = height / 2;
    const scale = baseScale * currentScale;

    // 预计算旋转矩阵 (简化版)
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);

    // 变换并排序
    const renderList = beads.map(b => {
      // 绕Y轴旋转
      let x1 = b.x * cosY - b.z * sinY;
      let z1 = b.x * sinY + b.z * cosY;
      
      // 绕X轴旋转
      let y1 = b.y * cosX - z1 * sinX;
      let z2 = b.y * sinX + z1 * cosX;

      // 简单的透视投影 (可选，这里用正交投影看起来更像像素画，或者微透视)
      // 使用正交投影 + Z排序即可
      return {
        x: x1 * scale + cx,
        y: y1 * scale + cy,
        z: z2,
        r: scale * 0.45, // 豆子半径
        color: b.color
      };
    }).sort((a, b) => a.z - b.z); // 从远到近排序

    // 绘制
    for (const p of renderList) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      
      // 高光 (让它看起来像圆珠)
      ctx.beginPath();
      ctx.arc(p.x - p.r*0.3, p.y - p.r*0.3, p.r*0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
    }
  },

  // --- 全屏交互逻辑 ---

  showFullScreen() {
    this.setData({ showModal: true }, () => {
      // 切换 Canvas 目标到全屏 Canvas
      wx.createSelectorQuery()
        .select('#fullScreenCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
          
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);

          // 更新渲染器目标
          this.renderer.canvas = canvas; // 切换 raf 绑定的 canvas
          this.renderer.ctx = ctx;
          this.renderer.width = res[0].width;
          this.renderer.height = res[0].height;
          
          // 重置/调整参数
          this.renderer.autoRotate = false; // 停止自动旋转
          this.renderer.currentScale = 1.5; // 默认放大一点
          
          // 重启循环 (因为 canvas 变了，requestAnimationFrame 需要重新绑定)
          this.stopRender();
          this.startRender();
        });
    });
  },

  closeFullScreen() {
    this.setData({ showModal: false }, () => {
      // 切回预览 Canvas
      this.init3DScene(this.data.template.imageUrl, this.data.template.size || '32x32');
      this.renderer.autoRotate = true;
      this.renderer.currentScale = 1;
      this.renderer.angleX = 0; // 重置角度
    });
  },

  onTouchStart(e) {
    if (e.touches.length === 1) {
      this.renderer.isDragging = true;
      this.renderer.lastTouchX = e.touches[0].clientX;
      this.renderer.lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      // 双指缩放
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.renderer.lastTouchDist = Math.sqrt(dx*dx + dy*dy);
    }
  },

  onTouchMove(e) {
    if (e.touches.length === 1 && this.renderer.isDragging) {
      const dx = e.touches[0].clientX - this.renderer.lastTouchX;
      const dy = e.touches[0].clientY - this.renderer.lastTouchY;
      
      this.renderer.angleY += dx * 0.01;
      this.renderer.angleX += dy * 0.01;
      
      this.renderer.lastTouchX = e.touches[0].clientX;
      this.renderer.lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      const scaleFactor = dist / this.renderer.lastTouchDist;
      this.renderer.currentScale *= scaleFactor;
      // 限制缩放范围
      this.renderer.currentScale = Math.max(0.5, Math.min(this.renderer.currentScale, 5));
      
      this.renderer.lastTouchDist = dist;
    }
  },

  onTouchEnd() {
    this.renderer.isDragging = false;
  },
  
  preventScroll() {},

  onStartBuild() {
    // 跳转到游戏页面并加载该模板
    if (this.data.template && this.data.template.imageUrl) {
      const selectedSize = this.data.sizeOptions[this.data.sizeIndex].size;
      wx.navigateTo({
        url: `/pages/game/game?imageUrl=${encodeURIComponent(this.data.template.imageUrl)}&size=${selectedSize}`
      });
    } else {
      wx.showToast({
        title: '开始制作！',
        icon: 'success'
      });
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/game/game'
        });
      }, 1000);
    }
  }
})