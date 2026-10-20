# 发版要求

- 每次更新并上传微信小程序时，必须在 `packageMisc/pages/changelog/versions.js` 的最顶部添加对应版本的更新内容。使用面向用户的中文，记录实际已完成的变化。
- 更新记录、`utils/version.js`、上传版本号必须一致。日期和时间以北京时间记录；历史补录不编造无法核实的日期或时间。
- `ci/upload.js` 与本地上传脚本必须先调用 `ci/check-release-notes.js`，更新记录缺失时停止上传。
