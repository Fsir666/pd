# pd 微信小程序 · WorkBuddy 多 Agent 开发协作

> 本目录是协作规范，并不等于 WorkBuddy 已自动创建专家团。请在 WorkBuddy 桌面客户端创建/选择项目、授权工作目录，并通过 `KICKOFF.md` 中的启动指令验证是否真的启动了多个 Agent。

## 真实项目结构（按仓库 main 现状）

- 原生微信小程序：`app.js`、`app.json`、`pages/`、`components/`、`packageTool/`、`packageGame/`、`packageMisc/`、`packageWarehouse/`、`utils/`
- 服务端接口/云函数：`cf/template-api/`
- 现有单元测试：`scripts/pixelate.test.js`
- 发布：`.github/workflows/deploy-miniprogram.yml`（手动触发）；CI 脚本在 `ci/`
- 现有 `AGENTS.md` 约束版本、更新记录和上传；根目录 `SKILL.md` 仅用于“图纸转数据”，不能当成通用开发规范

## 分工

| 身份 | 职责 | 主要目录 | 不可做 |
| --- | --- | --- | --- |
| 负责人/调度 Agent | 理解需求、设计接口、拆任务、控制并发、汇总、PR | 仅任务文档和集成 | 不越过测试或自动发版 |
| 小程序前端 Agent | 页面、组件、WXSS、交互、页面状态 | `pages/`、`components/`、`package*/`、`app.*` | 不擅改云接口契约 |
| 云端 API Agent | 接口、云函数、持久化、鉴权、数据验证 | `cf/template-api/` | 不连接或修改生产数据 |
| QA/审查 Agent | 独立审查、安全与回归检查、测试补充 | `scripts/`、测试/报告文档 | 不自证通过；不得部署 |

负责人先列出文件所有权，独立任务并行；同一文件、同一数据协议或接口契约任务一律串行。多人不得直接在一个工作树同时修改相同文件。每个实现任务使用单独分支/工作树；以 PR / diff 和验收证据交接。

## 执行闭环

1. 负责人先读 `AGENTS.md`、本文件、相关源码；明确任务 ID、目标、范围和验收标准。
2. 前端/后端分别在隔离分支工作；QA 可以并行阅读，但以集成后的代码独立验收为准。
3. 每位 Agent 必须交付：变更文件、关键决策、测试命令与实际结果、尚存风险。
4. 负责人复查 diff、接口兼容性、测试状态，提交待审核 PR；测试不过就退回修复，不伪称成功。
5. 用户明确验收之后再考虑合并；生产数据库操作、支付相关更改、正式发布、微信上传及 GitHub Actions deploy 需用户单独批准。

## 质量与安全基线

- 本地可运行：`node scripts/pixelate.test.js`。
- 静态语法示例：`node --check app.js`、`node --check cf/template-api/index.js`。
- 必须在微信开发者工具中检查页面运行、交互与真机体验；Node 单测不代表小程序端到端通过。
- 非发版 PR 不调整 `utils/version.js`、`packageMisc/pages/changelog/versions.js`；发版遵守根目录 `AGENTS.md`。
- 不打印或提交 `*.key`、`*.pem`、Token、密钥、用户隐私数据；检查 `project.private.config.json` 是否带有本机私有配置，勿扩大传播。
- 不触发 `workflow_dispatch` 的部署任务；不修改生产云函数、数据库、订单或支付流水。
- 根目录 `SKILL.md` 中出现外部绝对路径时必须检查文件确实存在；不得猜测本机路径。
- 遇到权限不足、环境缺失、Agent 子任务无法启动，报告事实和阻塞，不伪造“多 Agent 已运行”。

## 下一步

看 [KICKOFF.md](./KICKOFF.md)，在 WorkBuddy 项目工作区执行首轮**只读摸底 + 本地基线测试**。确认协作正常后再安排小功能开发。
