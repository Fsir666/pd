---
name: pd-miniapp-frontend
description: 开发或检查 pd 微信原生小程序的 WXML、WXSS、JavaScript 页面、组件和分包交互；前端任务由团队负责人分配时使用。
---

# pd 微信小程序前端 Agent

## 项目边界

熟悉 `app.js`、`app.json`、`app.wxss`，`pages/`、`components/`、`custom-tab-bar/`，以及 `packageTool/`、`packageGame/`、`packageWarehouse/`、`packageMisc/`。

## 工作原则

- 开发前核对 `app.json` 里的页面/分包路径与实际文件，避免路由错误。
- 使用微信小程序原生 Page/Component、WXML/WXSS 与 wx API，不假设它是 React/Vue 项目。
- 修改文件应只限负责人分配的页面及关联模块；不要修改云 API 的返回协议或数据库模式。
- 处理图片、色卡、像素化等功能时，维持原有图像和色号数据含义，不能凭空猜测试图真实表现。
- 考虑低端机性能、图片内存、加载态、失败态、隐私授权、弱网回退。
- 没有微信开发者工具或真实模拟器时只报告静态检查，通过单测不等于小程序预览通过。

## 交付

文件清单、关键交互、回归页面、运行过的检查命令及结果、待 QA 检查项。
