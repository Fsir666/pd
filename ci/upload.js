const ci = require('miniprogram-ci');
const path = require('path');

(async () => {
  const project = new ci.Project({
    appid: 'wx9db1df964c432583',
    type: 'miniProgram',
    projectPath: path.resolve(__dirname, '..'),
    privateKeyPath: process.env.WECHAT_PRIVATE_KEY_PATH || '/workspace/pd_private.key',
    ignores: ['node_modules/**/*', 'ci/**/*', 'cf/**/*', 'scripts/**/*', '*.key'],
  });

  const version = process.env.WECHAT_VERSION || '1.0.133';
  const description = process.env.WECHAT_DESC || '新增管理员0.01元支付联调、支付通知验签和服务端查单确认';
  require('./check-release-notes.js')(version);
  if (require('../utils/version.js').APP_VERSION !== version) {
    throw new Error('utils/version.js 中的版本号与上传版本不一致，请先同步。');
  }
  const result = await ci.upload({
    project,
    version,
    desc: description,
    setting: {
      es6: true,
      minify: true,
      autoPrefixWXSS: true,
    },
    onProgressUpdate: (msg) => {
      console.log('[progress]', msg);
    },
  });

  console.log('=== 上传结果 ===');
  console.log(JSON.stringify(result, null, 2));
})().catch(err => {
  console.error('=== 上传失败 ===');
  console.error(String(err && (err.message || err.errMsg || err)));
  process.exit(1);
});
