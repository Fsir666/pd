/**
 * 当前小程序版本号（单一数据源）
 *
 * ⚠️ 维护约定：每次发版时同步改这里，并保证与 ci/upload.js 里的 version 一致。
 * 「版本概览」页面顶部的 currentVersion 与个人中心入口按钮上的版本号都读这里。
 */
const APP_VERSION = '1.0.121';

module.exports = { APP_VERSION };
