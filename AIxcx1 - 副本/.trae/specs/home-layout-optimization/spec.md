# 首页布局优化 Spec

## Why
目前小程序的首页布局较为传统：
1.  **热门图纸榜**采用单列垂直列表，展示效率低，无法充分展示精美的图纸封面，缺乏视觉冲击力。
2.  **拼豆工具箱**采用简单的 4 列网格，缺乏重点，视觉上比较单调。
为了提升用户体验，增强“好逛”的感觉（类似小红书风格），需要对这两块核心区域进行视觉和交互升级。

## What Changes
1.  **热门图纸榜 (Hot Templates)**：
    -   由单列垂直列表改为**双列瀑布流 (Waterfall)** 布局。
    -   卡片样式升级：加大图片展示区域，标题和作者信息移至图片下方。
    -   增加视觉层次感。
2.  **拼豆工具箱 (Toolbox)**：
    -   由均匀网格改为 **Bento (便当盒) 风格** 布局。
    -   将核心功能（如“生成像素图”、“转卡通”）设计为 2x2 或 2x1 的大尺寸卡片，突出重点。
    -   次要功能保持 1x1 小卡片。

## Impact
-   **Affected specs**: 首页视觉规范、组件交互规范。
-   **Affected code**:
    -   `pages/index/index.wxml` (结构调整)
    -   `pages/index/index.wxss` (样式重写)
    -   `pages/index/index.js` (数据结构可能微调，适配新布局)

## ADDED Requirements

### Requirement: Waterfall Layout for Hot Templates
系统应在首页展示热门图纸时使用双列瀑布流布局。

#### Scenario: Display Hot Templates
-   **WHEN** 用户进入首页并滚动到热门图纸区域
-   **THEN** 图纸列表应以双列形式排列，图片高度根据原图比例自适应（或统一裁剪为长图），卡片包含封面、标题、作者头像/昵称、热度值。

### Requirement: Bento Grid for Toolbox
系统应在首页展示工具箱时使用 Bento 风格网格布局。

#### Scenario: Display Toolbox
-   **WHEN** 用户进入首页查看工具箱区域
-   **THEN** “生成像素图”和“抠图/转卡通”等核心功能应以大卡片（占2个或4个网格单位）展示，背景带有装饰性图案或渐变；其他工具以标准小卡片展示。

## MODIFIED Requirements

### Requirement: Existing List View
原有的 `rank-list` 单列布局将被移除并替换为新的 `waterfall-list`。

## REMOVED Requirements
无。
