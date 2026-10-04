// cloudfunctions/getMobile/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { code } = event;
  
  // 检查参数
  if (!code) {
    return {
      errCode: -1,
      errMsg: 'Missing code parameter'
    };
  }

  try {
    // 调用 openapi.phonenumber.getPhoneNumber 换取手机号
    const res = await cloud.openapi.phonenumber.getPhoneNumber({
      code: code
    });
    return res;
  } catch (err) {
    console.error('[getMobile] Error:', err);
    return {
      errCode: err.errCode || -1,
      errMsg: err.errMsg || 'Unknown error',
      error: err
    };
  }
};
