# WorkBuddy 启动操作与首轮指令

## 本机准备

1. 在 WorkBuddy 新建/打开项目（建议名称 `pd-微信小程序`），将工作目录指向本机的 `pd` 仓库根目录，不是 GitHub 网页。
2. 如果本机尚无代码，使用 Git 或让 WorkBuddy 在获得文件系统授权后克隆：`git clone https://github.com/Fsir666/pd.git`
3. 在仓库里执行：`git fetch origin` 然后 `git switch -c workbuddy/multi-agent-setup --track origin/workbuddy/multi-agent-setup`；已有该本地分支则直接切换。
4. WorkBuddy 有“专家团/多 Agent”入口时创建一个开发专家团：调度负责人、微信前端、云端 API、QA 审查。具体菜单随版本变化，不要假装已创建；必要时逐个创建自定义专家并绑定对应项目级 Skill。
5. 先确认终端可以调用 `git`、`node`，并已经在微信开发者工具内导入本地仓库。部署凭证不用配置到 WorkBuddy 项目文件。

## 复制给 WorkBuddy 的启动指令

```text
你现在是 pd 微信小程序 AI 开发团队的调度负责人。当前仓库：https://github.com/Fsir666/pd 。

第一步先读取根目录 AGENTS.md、docs/workbuddy/README.md，以及 .agents/skills/ 下四份 pd 专项技能。注意：根目录 SKILL.md 是“图纸转数据”专项工作流，不要将它误认为通用 Agent 团队配置。

请优先使用 WorkBuddy 的专家团或多 Agent 协作能力，分别派遣【小程序前端 Agent】【云端 API Agent】【QA 审查 Agent】执行下面的只读检查，不要只在同一个 Agent 中假扮多个角色。如果没有启动独立子 Agent 的能力，明确说明你实际采用的模式，不可伪称并行成功。

本轮仅做系统摸底，不修改任何代码，不推送 GitHub、不部署、不上传微信：
A. 前端 Agent：梳理页面、组件、分包、图片转拼豆功能入口与依赖。
B. 后端 Agent：梳理 cf/template-api、接口调用、与前端的接口契约，不接触正式云环境。
C. QA Agent：运行 node scripts/pixelate.test.js；检查 app.js 和 cf/template-api/index.js 语法；列出缺少的测试。
D. 调度负责人：合并三份报告，标注证据、实际命令输出、阻塞点、可并行模块，以及下一轮最小可行开发任务。

请输出：真实启动的 Agent 数、每人任务及结果、测试通过/失败证据、优先级最高的 3 个风险、下一轮建议；有失败就标注失败，禁止代替我确认发布。
```

## 成功判据

- WorkBuddy 显示实际被调用的子 Agent 或明确告知功能不可用。
- 三份独立视角的摸底报告，指向真实文件。
- 真实可追溯的测试结果（不是凭推测说“通过”）。
- 没有代码变动、没有云资源或发布行为。
- 将最终报告和后续 PR 交给 ChatGPT 复核。
