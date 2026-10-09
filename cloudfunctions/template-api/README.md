# template-api 云函数源码备份

> 📦 这是微信小程序「悠米拼豆」后端云函数 `template-api` 的完整源码备份。
> 备份时间：2026-10-09
> 来源环境：`cloudbase-d3ghdhcts9aad4fec`（微信侧云开发环境，区域 ap-shanghai）

## 为什么要备份

`template-api` 是整个小程序的后端大脑，承载 40+ 个业务接口（登录、图纸库、
作品发布、社区互动、钱包、每日任务等），但**它此前只存在于云端和本地电脑上，
GitHub 仓库里并没有**。

一旦本地电脑出问题、或云端环境异常，这份 2500+ 行的核心逻辑将无从恢复。
因此单独建立本分支，把源码纳入版本管理。

## 文件说明

| 文件 | 说明 |
|---|---|
| `index.js` | 云函数主入口，全部业务逻辑（约 2500 行） |
| `package.json` | 依赖声明，仅依赖 `wx-server-sdk` |
| `package-lock.json` | 依赖版本锁定 |
| `config.json` | 云函数配置 |
| `presets.json` | 内置精品图纸预设数据 |
| `drafts.json` | 图纸库预设数据（批量灌库来源） |
| `images/` | 预设图纸缩略图 |
| `drafts-images/` | 图纸库图纸缩略图 |

## ⚠️ 重要说明

1. **本目录不包含 `node_modules`**。原因：体积达 54MB，且可由
   `npm install` 完整还原，无需入库。
   部署时请使用「云端安装依赖」模式（`installDependency: true`）。

2. **本分支独立存在，未合并到 `main`**。
   这样不会影响小程序的正常开发与发版流程。
   如需查看：在 GitHub 上切换到 `cloudfunctions-backup` 分支即可。

3. **部署方式**：
   ```bash
   # 方式一：微信开发者工具
   #   右键 cloudfunctions/template-api → 上传并部署（云端安装依赖）

   # 方式二：CloudBase CLI
   tcb fn code update template-api --dir ./cloudfunctions/template-api

   # 方式三：小程序 CI
   ci.cloud.uploadFunction({ name: 'template-api', path: '...', remoteNpmInstall: true })
   ```

4. **注意**：上传前请务必确认代码版本。切勿用旧版本覆盖线上环境，
   否则会丢失后续新增的业务接口（如每日任务、钱包、关注等）。

## 版本记录

| 日期 | 变更 |
|---|---|
| 2026-10-09 | 首次备份；含当日修复：`deleteDraft` 改为软删除、不再连带撤回已发布作品 |
