/**
 * 生成小程序预览二维码（体验版/预览版扫码用）
 *
 * 用法：node ci/preview.js [输出图片路径] [页面路径] [额外query]
 *   node ci/preview.js                       # 首页二维码 → /workspace/preview-qr.jpg
 *   node ci/preview.js /tmp/qr.jpg pages/detail/detail id=xxx
 *
 * 说明：二维码由微信侧生成，扫码后打开的是「当前上传的这版代码」，
 * 需要用开发者/体验成员身份扫码。有效期由微信控制。
 */
const ci = require('miniprogram-ci');

const OUT = process.argv[2] || '/workspace/preview-qr.jpg';
const PAGE = process.argv[3] || '';
const QUERY = process.argv[4] || '';

const project = new ci.Project({
  appid: 'wx9db1df964c432583',
  type: 'miniProgram',
  projectPath: '/workspace/pd',
  privateKeyPath: '/workspace/pd_private.key',
  ignores: ['node_modules/**/*', 'ci/**/*', 'cf/**/*', 'scripts/**/*', '*.key'],
});

(async () => {
  const res = await ci.preview({
    project,
    desc: '白色格子恢复显示色号 v1.0.121',
    setting: { es6: true, minify: true, autoPrefixWXSS: true },
    qrcodeFormat: 'image',
    qrcodeOutputDest: OUT,
    pagePath: PAGE,
    searchQuery: QUERY,
  });
  console.log('二维码已生成:', OUT);
  console.log(JSON.stringify(res).slice(0, 400));
})().catch((e) => {
  console.error('生成失败:', e && (e.message || e));
  process.exit(1);
});
