const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { action, content, mediaUrl, mediaType, openid, scene, title, nickname } = event;
  const wxContext = cloud.getWXContext();

  // 使用传入的 openid 或从上下文获取
  const userOpenid = openid || wxContext.OPENID;
  // 场景值：1 资料；2 评论；3 论坛；4 社交日志
  const sceneValue = scene || 2;

  try {
    switch (action) {
      case 'msgSecCheck':
        return await handleMsgSecCheck(content, userOpenid, sceneValue, title, nickname);
      case 'mediaCheck':
        return await handleMediaCheck(mediaUrl, mediaType, userOpenid, sceneValue);
      default:
        return { errCode: -1, errMsg: '未知操作' };
    }
  } catch (err) {
    console.error('安全审核出错', err);
    return { errCode: -1, errMsg: err.message || '审核失败' };
  }
};

// 文本内容安全审核
async function handleMsgSecCheck(content, openid, scene, title, nickname) {
  if (!content || !content.trim()) {
    return { errCode: 0, errMsg: '内容为空，通过审核' };
  }

  try {
    const params = {
      content: content,
      version: 2,
      scene: scene,
      openid: openid
    };

    // 可选参数
    if (title) params.title = title;
    if (nickname) params.nickname = nickname;

    const result = await cloud.openapi.security.msgSecCheck(params);

    if (result.errCode === 0) {
      // 检查结果
      const suggest = result.result && result.result.suggest;
      if (suggest === 'risky') {
        return { 
          errCode: 100, 
          errMsg: '内容含有违规信息',
          label: result.result.label,
          detail: result.detail
        };
      } else if (suggest === 'review') {
        return { 
          errCode: 101, 
          errMsg: '内容需要人工审核',
          label: result.result.label,
          detail: result.detail
        };
      }
      return { errCode: 0, errMsg: '通过', result: result.result };
    } else {
      return { errCode: result.errCode, errMsg: result.errMsg || '内容审核失败' };
    }
  } catch (err) {
    console.error('文本审核失败', err);
    return { errCode: -1, errMsg: err.errMsg || err.message || '审核失败' };
  }
}

// 多媒体内容安全审核（图片/音频）
async function handleMediaCheck(mediaUrl, mediaType, openid, scene) {
  // mediaType: 1-音频, 2-图片
  const type = mediaType === 1 ? 1 : 2;

  if (!mediaUrl) {
    return { errCode: 0, errMsg: '文件为空，通过审核' };
  }

  try {
    const result = await cloud.openapi.security.mediaCheckAsync({
      mediaUrl: mediaUrl,
      mediaType: type,
      version: 2,
      scene: scene,
      openid: openid
    });

    if (result.errCode === 0) {
      return { 
        errCode: 0, 
        errMsg: '提交成功，等待异步审核结果', 
        traceId: result.traceId 
      };
    } else {
      return { errCode: result.errCode, errMsg: result.errMsg || '媒体审核提交失败' };
    }
  } catch (err) {
    console.error('媒体审核失败', err);
    return { errCode: -1, errMsg: err.errMsg || err.message || '审核失败' };
  }
}
