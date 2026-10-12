const ci = require('miniprogram-ci');
const path = require('path');

(async () => {
  const project = new ci.Project({
    appid: 'wx9db1df964c432583',
    type: 'miniProgram',
    projectPath: '/workspace/pd',
    privateKeyPath: '/workspace/pd_private.key',
    ignores: ['node_modules/**/*', 'ci/**/*', '*.key'],
  });

  const result = await ci.upload({
    project,
    version: '1.0.120',
    desc: '首页榜单缩略图不再先显示错误的原图，改为像素图直接淡入',
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
