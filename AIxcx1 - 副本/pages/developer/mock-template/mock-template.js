const app = getApp();

// Theme Configuration System
// ⚠️ AI Configuration
// Get Key: https://platform.deepseek.com/
const API_KEY = ''; // 用户需自行输入 Key
const API_URL = 'https://api.deepseek.com/chat/completions';

const THEMES = {
  '快乐小狗': {
    strategy: 'symmetric_face',
    palette: ['#8B4513', '#D2691E', '#F4A460', '#FFDEAD', '#FFFFFF', '#000000'], // Browns, Tans
    description: '一只活泼可爱的小狗，毛茸茸的让人想摸一摸。'
  },
  '像素爱心': {
    strategy: 'heart',
    palette: ['#FF0000', '#FF69B4', '#FF1493', '#C71585', '#FFFFFF'], // Reds, Pinks
    description: '一颗跳动的像素爱心，代表满满的爱意。'
  },
  '神秘宝剑': {
    strategy: 'sword',
    palette: ['#C0C0C0', '#808080', '#4169E1', '#000080', '#FFD700'], // Silvers, Blues, Gold
    description: '传说中的勇者之剑，散发着寒冷的光芒。'
  },
  '复古游戏机': {
    strategy: 'box',
    palette: ['#2F4F4F', '#A9A9A9', '#800000', '#000000', '#DCDCDC'], // Greys, Dark Red
    description: '经典的掌上游戏机，带你回到童年时光。'
  },
  '向日葵': {
    strategy: 'flower',
    palette: ['#FFD700', '#FFA500', '#8B4513', '#228B22', '#32CD32'], // Yellows, Browns, Greens
    description: '向阳而生的花朵，充满了正能量。'
  },
  '小黄鸭': {
    strategy: 'duck',
    palette: ['#FFD700', '#FFFF00', '#FFA500', '#FF4500', '#000000'], // Yellows, Orange
    description: '嘎嘎嘎，一只正在游泳的小黄鸭。'
  },
  '外星人': {
    strategy: 'alien',
    palette: ['#32CD32', '#00FF00', '#800080', '#4B0082', '#000000'], // Greens, Purples
    description: '来自遥远星系的访客，长相奇特。'
  },
  '彩虹云': {
    strategy: 'cloud',
    palette: ['#FFB6C1', '#87CEFA', '#98FB98', '#DDA0DD', '#FFFFE0', '#FFFFFF'], // Pastels
    description: '雨后天晴，天空中飘浮着彩色的云朵。'
  },
  '笑脸': {
    strategy: 'smile',
    palette: ['#FFD700', '#000000', '#FFFFFF', '#FFA500'], 
    description: '一个灿烂的笑脸，希望能带给你好心情。'
  },
  '大树': {
    strategy: 'tree',
    palette: ['#8B4513', '#228B22', '#006400', '#32CD32'], 
    description: '一棵茁壮成长的大树，枝繁叶茂。'
  },
  '魔法药水': {
    strategy: 'potion',
    palette: ['#4B0082', '#8A2BE2', '#9370DB', '#FFFFFF', '#C0C0C0'], 
    description: '一瓶神秘的魔法药水，喝下去会有神奇的效果。'
  }
};

Page({
  data: {
    generatedData: null,
    loading: false,
    prompt: '',
    apiKey: ''
  },

  onLoad() {
    // No specific load logic needed
  },

  onApiKeyInput(e) {
    this.setData({ apiKey: e.detail.value });
  },

  onPromptInput(e) {
    this.setData({ prompt: e.detail.value });
  },

  onHeatInput(e) {
    const val = parseInt(e.detail.value);
    if (!isNaN(val)) {
      this.setData({
        'generatedData.heat': val
      });
    }
  },

  extractJSON(rawString) {
    try {
      // 1. 尝试移除 Markdown 代码块标记 (```json 和 ```)
      let cleanString = rawString.replace(/```json/g, '').replace(/```/g, '');
      
      // 2. 寻找第一个 '{' 和最后一个 '}'，只截取中间部分
      const firstOpen = cleanString.indexOf('{');
      const lastClose = cleanString.lastIndexOf('}');
      
      if (firstOpen !== -1 && lastClose !== -1) {
        cleanString = cleanString.substring(firstOpen, lastClose + 1);
      } else {
        throw new Error("未找到有效的 JSON 起始/结束标记 ({ ... })");
      }
      
      // 3. 解析并返回
      return JSON.parse(cleanString);
    } catch (e) {
      console.error("JSON清洗失败，原始返回内容:", rawString);
      // 抛出具体错误，方便调试
      throw new Error(`JSON解析错误: ${e.message}`);
    }
  },

  async generateData() {
    if (!this.data.apiKey) {
      wx.showToast({
        title: '请输入 API Key',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: 'AI 思考中...' });

    // 重新设计 Prompt，让 DeepSeek 生成可以直接渲染的像素数据
    // 我们将生成一个 32x32 的网格，使用 JSON 格式返回，但这次我们不仅返回坐标，
    // 而是通过前端渲染成一张图片，给用户"生成图片"的体验
    const systemPrompt = `
你是一位专业的像素艺术家。请根据用户输入的关键词，设计一副 32x32 的精美像素画。
请直接返回 JSON 数据，不要包含任何解释性文字。

返回格式必须严格遵守：
{
  "title": "作品标题",
  "description": "简短描述",
  "palette": ["#颜色1", "#颜色2", ...], // 必须包含所有用到的颜色 hex
  "pixels": [
    // 使用游程编码 (Run-Length Encoding) 压缩数据以节省 Token
    // 格式: [颜色索引, 连续像素数量]
    // 整个数组必须正好填满 32x32 = 1024 个像素
    // 颜色索引 -1 表示透明/背景
    [0, 10], [-1, 5], [1, 20], ...
  ]
}

示例：
如果 palette 是 ["#FF0000", "#00FF00"]
pixels: [[0, 2], [1, 1], [-1, 1021]]
表示：2个红色，1个绿色，1021个透明。
请确保像素画主体清晰，构图在画布中央。
`;

    wx.request({
      url: API_URL,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.apiKey}`
      },
      data: {
        model: 'deepseek-chat',
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: this.data.prompt || '一只可爱的小猫' }
        ],
        temperature: 1.0, // 增加创造性
        max_tokens: 4000,
        response_format: { type: "json_object" }
      },
      timeout: 120000, // 120s timeout
      success: async (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let aiContent = '';
          try {
            aiContent = res.data.choices[0].message.content;
            console.log('AI Raw Output:', aiContent);

            const aiData = this.extractJSON(aiContent);
            
            // 解压 RLE 数据
            const grid = Array(32).fill(null).map(() => Array(32).fill(null));
            let currentPixel = 0;
            
            if (aiData.pixels && Array.isArray(aiData.pixels)) {
              for (const [colorIdx, count] of aiData.pixels) {
                 for (let i = 0; i < count; i++) {
                   const x = currentPixel % 32;
                   const y = Math.floor(currentPixel / 32);
                   
                   if (y < 32) {
                     if (colorIdx !== -1 && aiData.palette[colorIdx]) {
                       grid[y][x] = aiData.palette[colorIdx];
                     } else {
                       grid[y][x] = null; // Transparent
                     }
                   }
                   currentPixel++;
                 }
              }
            }

            // 3. Render locally to create an image file
            const tempFilePath = await this.renderFromGrid(aiData.palette, grid);
            
            this.setData({
              generatedData: {
                title: aiData.title || '无标题',
                description: aiData.description || '无描述',
                difficulty: '⭐⭐⭐',
                size: '32x32',
                heat: 100,
                imageUrl: tempFilePath, // Use the locally rendered image
                tempImagePath: tempFilePath
              },
              loading: false
            });
            wx.hideLoading();

          } catch (parseErr) {
            console.error(parseErr);
            wx.showModal({ 
              title: '解析失败', 
              content: `AI 生成的数据格式有误，请重试。\n错误: ${parseErr.message}`, 
              showCancel: false 
            });
            wx.hideLoading();
            this.setData({ loading: false });
          }
        } else {
          console.error('API Error:', res);
          wx.showModal({ 
            title: 'API请求失败', 
            content: `状态码: ${res.statusCode}\n错误: ${JSON.stringify(res.data)}`, 
            showCancel: false 
          });
          wx.hideLoading();
          this.setData({ loading: false });
        }
      },
      fail: (err) => {
        console.error('Request Failed:', err);
        let content = '网络请求失败: ' + err.errMsg;
        
        if (err.errMsg.includes('domain')) {
          content = '请在开发者工具详情中勾选"不校验合法域名" (Local Settings -> Does not verify valid domain names)';
        } else if (err.errMsg.includes('timeout')) {
          content = '请求超时，AI 思考时间过长。\n\n请尝试：\n1. 检查网络连接\n2. 再次点击生成重试';
        }

        wx.showModal({
          title: '请求失败',
          content: content,
          showCancel: false
        });
        wx.hideLoading();
        this.setData({ loading: false });
      }
    });
  },

  renderFromGrid(palette, grid) {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#pixelCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            reject('Canvas not found');
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const width = 320;
          const height = 320;
          canvas.width = width;
          canvas.height = height;
          
            // Clear
            // Use transparent background for better result merging
            ctx.clearRect(0, 0, width, height); 
            
            // Or use White if we want a solid card
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);

          // Auto-calculate grid size based on grid dimension
          // Default to 32x32 if grid is 32x32 -> 10px
          // If grid is 16x16 -> 20px
          const rows = grid.length;
          const cols = rows > 0 ? grid[0].length : rows;
          const gridSize = width / cols; // Assuming square canvas
          
          // Debug Palette
          if (!palette || palette.length === 0) {
            console.warn('Palette missing, using fallback rainbow palette');
            palette = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#000000', '#FFFFFF'];
          }

          let drawCount = 0;

          // Draw Grid
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const val = grid[y][x];
              let color = null;

              if (val === null) {
                // Transparent
                continue; 
              } else if (typeof val === 'string' && val.startsWith('#')) {
                 // Direct Hex Color
                 color = val;
              } else if (typeof val === 'number') {
                 // Palette Index
                 // Handle -1 for transparent in legacy/other modes
                 if (val === -1) continue;
                 
                 // Robust index access
                 if (palette && palette[val]) {
                   color = palette[val];
                 } else if (palette && val > 0 && palette[val - 1]) {
                   // Fallback for 1-based index error
                   color = palette[val - 1];
                 }
              }

              if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
                drawCount++;
              }
            }
          }
          
          console.log(`Rendered ${drawCount} pixels.`);
          
          // If nothing was drawn, force a placeholder to prove canvas works
          if (drawCount === 0) {
             ctx.fillStyle = '#FF0000'; // Red
             ctx.fillRect(width/2 - 20, height/2 - 20, 40, 40);
             ctx.fillStyle = '#000000';
             ctx.font = '20px sans-serif';
             ctx.fillText('Empty Grid', width/2 - 40, height/2 + 40);
          }

          // Export
          wx.canvasToTempFilePath({
            canvas: canvas,
            x: 0, y: 0, width: width, height: height,
            destWidth: width, destHeight: height,
            success: (res) => {
              this.tempPath = res.tempFilePath; // Store temp path
              resolve(res.tempFilePath);
            },
            fail: reject
          });
        });
    });
  },

  generatePixelImage(theme) {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#pixelCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            reject('Canvas not found');
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          const width = 320;
          const height = 320;
          canvas.width = width;
          canvas.height = height;
          
          // Clear background (White or Light Grey)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Grid Setup
          const gridSize = 20; 
          const cols = 16;
          const rows = 16;

          // Drawing Logic based on Strategy
          this.drawStrategy(ctx, theme.strategy, theme.palette, cols, rows, gridSize);

          // Convert to temp file path
          wx.canvasToTempFilePath({
            canvas: canvas,
            x: 0,
            y: 0,
            width: width,
            height: height,
            destWidth: width,
            destHeight: height,
            success: (res) => {
              resolve(res.tempFilePath);
            },
            fail: (err) => {
              reject(err);
            }
          });
        });
    });
  },

  drawStrategy(ctx, strategy, palette, cols, rows, gridSize) {
    const randomColor = () => palette[Math.floor(Math.random() * palette.length)];

    const drawPixel = (x, y, color) => {
      if (x < 0 || x >= cols || y < 0 || y >= rows) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
    };

    switch (strategy) {
      case 'heart':
        this.drawHeart(drawPixel, randomColor, cols, rows);
        break;
      case 'symmetric_face': // Dog
      case 'alien':
        this.drawSymmetric(drawPixel, randomColor, cols, rows, strategy === 'alien');
        break;
      case 'sword':
        this.drawSword(drawPixel, randomColor, cols, rows);
        break;
      case 'flower':
        this.drawFlower(drawPixel, palette, cols, rows);
        break;
      case 'cloud':
        this.drawCloud(drawPixel, palette, cols, rows);
        break;
      case 'box': // Retro Console
        this.drawBox(drawPixel, palette, cols, rows);
        break;
      case 'duck':
        this.drawDuck(drawPixel, palette, cols, rows);
        break;
      case 'smile':
        this.drawSmile(drawPixel, palette, cols, rows);
        break;
      case 'tree':
        this.drawTree(drawPixel, palette, cols, rows);
        break;
      case 'potion':
        this.drawPotion(drawPixel, palette, cols, rows);
        break;
      default:
        this.drawRandom(drawPixel, randomColor, cols, rows);
    }
  },

  drawSmile(drawPixel, palette, cols, rows) {
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    const radius = Math.min(centerX, centerY) - 1;

    // Face
    for(let x=0; x<cols; x++) {
        for(let y=0; y<rows; y++) {
            if (Math.sqrt(Math.pow(x-centerX, 2) + Math.pow(y-centerY, 2)) <= radius) {
                drawPixel(x, y, palette[0]); // Yellow base
            }
        }
    }
    // Eyes
    drawPixel(centerX-2, centerY-2, palette[1]); 
    drawPixel(centerX+2, centerY-2, palette[1]);
    
    // Smile
    for(let x=centerX-3; x<=centerX+3; x++) {
        const y = centerY + 2 + Math.floor((x-centerX)*(x-centerX)/4);
        if (y < rows) drawPixel(x, y, palette[1]);
    }
  },

  drawTree(drawPixel, palette, cols, rows) {
    const centerX = Math.floor(cols / 2);
    // Trunk
    for(let y=rows-5; y<rows; y++) {
        drawPixel(centerX, y, palette[0]);
        drawPixel(centerX-1, y, palette[0]);
    }
    // Leaves (Triangle-ish blobs)
    for(let y=2; y<rows-4; y++) {
        const width = Math.floor((y-1) * 0.8);
        for(let x=centerX-width; x<=centerX+width; x++) {
            if (Math.random() > 0.3) drawPixel(x, y, palette[1]);
        }
    }
  },

  drawPotion(drawPixel, palette, cols, rows) {
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    
    // Bottle Neck
    for(let y=centerY-5; y<centerY-2; y++) {
        drawPixel(centerX, y, palette[4]);
        drawPixel(centerX-1, y, palette[4]);
    }
    // Bottle Body (Round)
    for(let x=centerX-4; x<=centerX+3; x++) {
        for(let y=centerY-2; y<centerY+5; y++) {
            if (Math.abs(x-centerX) + Math.abs(y-centerY-1) < 6) {
                 // Liquid
                 if (y > centerY) drawPixel(x, y, palette[0]);
                 else drawPixel(x, y, '#FFFFFF55'); // Glass
            }
        }
    }
  },

  drawHeart(drawPixel, randomColor, cols, rows) {
    const centerX = cols / 2;
    const centerY = rows / 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Simple Heart Equation or shape approximation
        const dx = (x - centerX) / (cols / 4);
        const dy = (y - centerY) / (rows / 4);
        // (x^2 + y^2 - 1)^3 - x^2*y^3 <= 0
        // Flip y for screen coords
        const py = -dy; 
        const val = Math.pow(dx*dx + py*py - 1, 3) - dx*dx * Math.pow(py, 3);
        
        if (val <= 0) {
           drawPixel(x, y, randomColor());
        }
      }
    }
  },

  drawSymmetric(drawPixel, randomColor, cols, rows, isAlien) {
    const centerX = Math.floor(cols / 2);
    // Draw left side and mirror to right
    for (let x = 0; x < centerX; x++) {
      for (let y = 2; y < rows - 2; y++) {
        // Higher density for center
        let chance = 0.4;
        if (x > centerX - 3) chance = 0.7;
        
        if (Math.random() < chance) {
          const color = randomColor();
          drawPixel(x + (cols%2), y, color); // Left
          drawPixel(cols - 1 - x - (cols%2), y, color); // Right (Mirror)
        }
      }
    }
    // Eyes
    if (isAlien) {
        const eyeColor = '#000000'; // Black eyes
        drawPixel(centerX - 2, 6, eyeColor);
        drawPixel(centerX + 1, 6, eyeColor);
    } else {
        // Dog eyes
        const eyeColor = '#000000';
        drawPixel(centerX - 2, 5, eyeColor);
        drawPixel(centerX + 1, 5, eyeColor);
        // Nose
        drawPixel(centerX - 1, 8, '#000000');
        drawPixel(centerX, 8, '#000000');
    }
  },

  drawSword(drawPixel, randomColor, cols, rows) {
    const centerX = Math.floor(cols / 2);
    // Blade
    for (let y = 2; y < rows - 4; y++) {
        drawPixel(centerX, y, '#C0C0C0'); // Blade center
        drawPixel(centerX - 1, y, '#A9A9A9'); // Blade edge
        drawPixel(centerX + 1, y, '#FFFFFF'); // Blade highlight
    }
    // Hilt
    for (let x = centerX - 3; x <= centerX + 3; x++) {
        drawPixel(x, rows - 4, '#FFD700'); // Gold hilt guard
    }
    // Handle
    for (let y = rows - 3; y < rows - 1; y++) {
        drawPixel(centerX, y, '#8B4513'); // Brown handle
    }
  },

  drawFlower(drawPixel, palette, cols, rows) {
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    
    // Petals (Yellow/Orange)
    for (let r = 0; r < 6; r++) {
       for(let theta = 0; theta < Math.PI * 2; theta += 0.1) {
           const x = Math.round(centerX + r * Math.cos(theta));
           const y = Math.round(centerY + r * Math.sin(theta));
           // Petal color
           if (r > 2) drawPixel(x, y, palette[0]); // Yellow
       }
    }
    
    // Center (Brown)
    for (let x = centerX - 2; x <= centerX + 2; x++) {
        for (let y = centerY - 2; y <= centerY + 2; y++) {
            if (Math.sqrt(Math.pow(x-centerX,2) + Math.pow(y-centerY,2)) < 2.5) {
                drawPixel(x, y, palette[2]); // Brown
            }
        }
    }
    
    // Stem
    for(let y = centerY + 5; y < rows; y++) {
        drawPixel(centerX, y, palette[3]); // Green
    }
  },
  
  drawCloud(drawPixel, palette, cols, rows) {
      const centerX = Math.floor(cols / 2);
      const centerY = Math.floor(rows / 2);
      
      // Random blobs
      for(let i=0; i<50; i++) {
          const x = Math.floor(Math.random() * cols);
          const y = Math.floor(Math.random() * rows);
          // Bias towards center
          const dist = Math.sqrt(Math.pow(x-centerX,2) + Math.pow(y-centerY,2));
          if (dist < 6) {
              drawPixel(x, y, palette[Math.floor(Math.random() * palette.length)]);
          }
      }
  },
  
  drawBox(drawPixel, palette, cols, rows) {
      // Draw a rect
      const startX = 3;
      const endX = cols - 3;
      const startY = 3;
      const endY = rows - 3;
      
      for(let x=startX; x<=endX; x++) {
          for(let y=startY; y<=endY; y++) {
              drawPixel(x, y, palette[0]); // Body
          }
      }
      // Screen
      for(let x=startX+2; x<=endX-2; x++) {
          for(let y=startY+2; y<=startY+6; y++) {
              drawPixel(x, y, '#9ACD32'); // Greenish screen
          }
      }
      // Buttons
      drawPixel(endX-2, endY-2, '#FF0000'); // A Btn
      drawPixel(endX-3, endY-1, '#FF0000'); // B Btn
  },
  
  drawDuck(drawPixel, palette, cols, rows) {
     const centerX = Math.floor(cols / 2);
     const centerY = Math.floor(rows / 2);
     
     // Body
     for(let x=centerX-3; x<=centerX+3; x++) {
         for(let y=centerY; y<=centerY+4; y++) {
             drawPixel(x, y, palette[0]); // Yellow
         }
     }
     // Head
     for(let x=centerX-2; x<=centerX+2; x++) {
         for(let y=centerY-4; y<centerY; y++) {
             drawPixel(x, y, palette[0]); // Yellow
         }
     }
     // Beak
     drawPixel(centerX-3, centerY-2, '#FF4500'); 
     // Eye
     drawPixel(centerX+1, centerY-2, '#000000');
  },

  drawRandom(drawPixel, randomColor, cols, rows) {
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        if (Math.random() > 0.5) {
          drawPixel(x, y, randomColor());
        }
      }
    }
  },

  submitData() {
    if (!this.data.generatedData) return;
    
    this.setData({ loading: true });
    
    const { title, description, difficulty, size, heat, tempImagePath } = this.data.generatedData;
    
    // 1. Upload Image
    const cloudPath = `templates/mock-${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempImagePath,
      success: res => {
        const fileID = res.fileID;
        
        // 2. Add to DB
        wx.cloud.callFunction({
          name: 'template-api',
          data: {
            action: 'add',
            template: {
              title,
              author: 'AI自动生成', // Mock author
              description,
              size,
              difficulty,
              imageUrl: fileID,
              heat: heat,
              price: 0,
              time: '1h'
            }
          },
          success: dbRes => {
            if (dbRes.result.code === 0) {
              wx.showToast({ title: '提交成功' });
              this.setData({ loading: false, generatedData: null });
            } else {
              wx.showToast({ title: '提交失败', icon: 'none' });
              this.setData({ loading: false });
            }
          },
          fail: err => {
            console.error(err);
            wx.showToast({ title: '调用云函数失败', icon: 'none' });
            this.setData({ loading: false });
          }
        });
      },
      fail: err => {
        console.error(err);
        wx.showToast({ title: '图片上传失败', icon: 'none' });
        this.setData({ loading: false });
      }
    });
  }
});