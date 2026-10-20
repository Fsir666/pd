const versions = require('../packageMisc/pages/changelog/versions.js');

module.exports = function checkReleaseNotes(version) {
  const latest = versions[0];
  if (!latest || latest.version !== version) {
    throw new Error('请先在版本概览顶部添加 ' + version + ' 的更新记录，再上传小程序。');
  }
  if (!latest.title || !/^\d{4}-\d{2}-\d{2}$/.test(latest.date || '') || !/^\d{2}:\d{2}$/.test(latest.time || '') || !Array.isArray(latest.items) || !latest.items.length || latest.items.some(item => typeof item !== 'string' || !item.trim())) {
    throw new Error('版本概览缺少标题、日期时间或具体更新内容，请补齐后再上传。');
  }
};
