const cloud = require('wx-server-sdk');
const https = require('https');
const url = require('url');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const COIN_COSTS = {
  matting: 5,
  createDoubaoTask: 10,
  doubaoImageToImage: 5,
  deepseek: 1
};

function dayStringCN(ts) {
  const t = typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now()
  const d = new Date(t + 8 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ==========================================
// ⚠️ 配置区域 / Configuration
// ==========================================
const API_KEY = process.env.DEEPSEEK_API_KEY || '';

// DeepSeek 官方配置
const API_URL = 'https://api.deepseek.com/chat/completions'; 
const MODEL_NAME = 'deepseek-chat';
// ==========================================

const DOUBAO_ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const DOUBAO_MODEL = 'doubao-seedream-4-5-251128';
const DOUBAO_TASK_COLLECTION = 'doubao_tasks';
const AOS_MATTING_URL = 'https://techsz.aoscdn.com/api/tasks/visual/segmentation';

async function ensureCollectionExists(collectionName) {
  if (!collectionName) return;
  try {
    await db.createCollection(collectionName);
  } catch (e) {
    const msg = String((e && e.message) || (e && e.errMsg) || '');
    const isAlreadyExists = msg.includes('COLLECTION_ALREADY_EXISTS') || msg.includes('collection already exists');
    if (!isAlreadyExists) {
      throw e;
    }
  }
}

async function getUserDocIdByOpenid(openid) {
  if (!openid) return ''
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get().catch(() => null)
  const doc = res && res.data && res.data[0] ? res.data[0] : null
  return doc && doc._id ? String(doc._id) : ''
}

async function changeCoins({ openid, delta, type, title, meta }) {
  const d = typeof delta === 'number' && Number.isFinite(delta) ? Math.trunc(delta) : 0
  if (!d) return { ok: true, coins: null }
  const userId = await getUserDocIdByOpenid(openid)
  if (!userId) return { ok: false, code: 401, msg: '请先登录' }
  await ensureCollectionExists('coin_ledger').catch(() => {})

  return await db.runTransaction(async (txn) => {
    const ref = txn.collection('users').doc(userId)
    const snap = await ref.get().catch(() => null)
    const user = snap && snap.data ? snap.data : null
    if (!user) return { ok: false, code: 401, msg: '请先登录' }

    const coins = typeof user.coins === 'number' ? user.coins : 0
    const next = coins + d
    if (next < 0) {
      return {
        ok: false,
        code: 10001,
        msg: '豆币不足',
        data: {
          coins,
          need: -d
        }
      }
    }

    await ref.update({
      data: {
        coins: _.inc(d),
        updateTime: db.serverDate()
      }
    })

    await txn.collection('coin_ledger').add({
      data: {
        _openid: openid,
        delta: d,
        balanceAfter: next,
        title: title ? String(title).slice(0, 60) : '',
        type: type ? String(type).slice(0, 30) : '',
        meta: meta && typeof meta === 'object' ? meta : {},
        day: dayStringCN(Date.now()),
        createTime: db.serverDate()
      }
    }).catch(() => null)

    return { ok: true, coins: next }
  })
}

async function consumeCoins({ openid, cost, type, title, meta }) {
  const c = typeof cost === 'number' && Number.isFinite(cost) ? Math.max(0, Math.trunc(cost)) : 0
  if (!c) return { ok: true, coins: null, cost: 0 }
  const res = await changeCoins({ openid, delta: -c, type: type || 'consume', title: title || '豆币消耗', meta })
  if (!res || !res.ok) return res
  return { ok: true, coins: res.coins, cost: c }
}

async function incUserDailyStat(openid, incMap) {
  if (!openid || !incMap || typeof incMap !== 'object') return null
  const today = dayStringCN(Date.now())
  const userId = await getUserDocIdByOpenid(openid)
  if (!userId) return null

  const safeInc = {}
  for (const k of Object.keys(incMap)) {
    const v = incMap[k]
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
    if (n) safeInc[k] = n
  }
  const keys = Object.keys(safeInc)
  if (keys.length === 0) return null

  return await db.runTransaction(async (txn) => {
    const ref = txn.collection('users').doc(userId)
    const snap = await ref.get().catch(() => null)
    const doc = snap && snap.data ? snap.data : null
    if (!doc) return null

    const day = doc.dailyStatsDay ? String(doc.dailyStatsDay) : ''
    const cur = (doc.dailyStats && typeof doc.dailyStats === 'object') ? doc.dailyStats : {}
    const base = day === today ? cur : {}
    const next = { ...base }
    for (const k of keys) {
      const curV = typeof next[k] === 'number' ? next[k] : 0
      next[k] = curV + safeInc[k]
    }
    await ref.update({
      data: {
        dailyStatsDay: today,
        dailyStats: next,
        updateTime: db.serverDate()
      }
    })
    return { day: today, stats: next }
  })
}

// Helper function to make HTTPS request without external dependencies
function httpsPost(requestUrl, data, headers) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(requestUrl);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'POST',
      headers: headers,
      timeout: 50000 // 50s timeout for the request itself
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`API Error: ${res.statusCode} ${responseBody}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

function httpsGetBuffer(requestUrl, redirectLeft = 3) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(requestUrl);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 50000
    };

    const req = https.request(options, (res) => {
      const code = res.statusCode || 0;
      const location = res.headers ? res.headers.location : '';
      if ([301, 302, 303, 307, 308].includes(code) && location && redirectLeft > 0) {
        res.resume();
        const nextUrl = String(location).startsWith('http')
          ? String(location)
          : `${parsedUrl.protocol}//${parsedUrl.hostname}${location}`;
        resolve(httpsGetBuffer(nextUrl, redirectLeft - 1));
        return;
      }

      if (code < 200 || code >= 300) {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          reject(new Error(`Download Error: ${code} ${body}`));
        });
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: String((res.headers && res.headers['content-type']) || '')
        });
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

function httpsPostMultipart(requestUrl, fields, file) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(requestUrl);
    const boundary = `----wxFormBoundary${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const parts = [];
    const push = (v) => {
      parts.push(Buffer.isBuffer(v) ? v : Buffer.from(String(v)));
    };

    const map = fields || {};
    const keys = Object.keys(map);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = map[k];
      push(`--${boundary}\r\n`);
      push(`Content-Disposition: form-data; name="${k}"\r\n\r\n`);
      push(`${v == null ? '' : String(v)}\r\n`);
    }

    const f = file || {};
    const fileName = f.filename ? String(f.filename) : 'image.jpg';
    const fileField = f.fieldName ? String(f.fieldName) : 'image_file';
    const fileType = f.contentType ? String(f.contentType) : 'application/octet-stream';
    const fileBuf = f.buffer && Buffer.isBuffer(f.buffer) ? f.buffer : Buffer.from(f.buffer || []);

    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\n`);
    push(`Content-Type: ${fileType}\r\n\r\n`);
    push(fileBuf);
    push(`\r\n`);
    push(`--${boundary}--\r\n`);

    const body = Buffer.concat(parts);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'X-API-KEY': process.env.AOS_API_KEY || ''
      },
      timeout: 50000
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`API Error: ${res.statusCode} ${responseBody}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.write(body);
    req.end();
  });
}

async function processDoubaoTask(taskId) {
  if (!taskId) {
    return { code: -1, msg: '缺少任务 ID' };
  }

  console.log('processDoubaoTask:start', { taskId });

  const taskRef = db.collection(DOUBAO_TASK_COLLECTION).doc(taskId);
  const taskSnap = await taskRef.get().catch(() => null);
  const task = taskSnap && taskSnap.data ? taskSnap.data : null;
  if (!task) {
    console.log('processDoubaoTask:not_found', { taskId });
    return { code: -2, msg: '任务不存在' };
  }

  await taskRef.update({
    data: {
      lastTriggerAt: Date.now()
    }
  }).catch(() => null);

  const status = String(task.status || '');
  if (status !== 'pending') {
    console.log('processDoubaoTask:skip', { taskId, status });
    return { code: 0, msg: 'skip', data: { status } };
  }

  const ARK_API_KEY = process.env.DOUBAO_ARK_API_KEY || '';
  if (!ARK_API_KEY) {
    console.log('processDoubaoTask:no_key', { taskId });
    await taskRef.update({
      data: {
        status: 'failed',
        errorMessage: '未配置豆包 API Key',
        updatedAt: Date.now(),
        finishedAt: Date.now()
      }
    });
    return { code: -3, msg: '未配置豆包 API Key' };
  }

  await taskRef.update({
    data: {
      status: 'processing',
      updatedAt: Date.now(),
      startedAt: Date.now()
    }
  });
  console.log('processDoubaoTask:processing', { taskId });

  try {
    const fileID = task.fileID || '';
    if (!fileID) throw new Error('缺少图片 fileID');

    const tempUrlRes = await cloud.getTempFileURL({ fileList: [fileID] });
    const file = (tempUrlRes && tempUrlRes.fileList && tempUrlRes.fileList[0]) ? tempUrlRes.fileList[0] : null;
    if (!file || file.status !== 0 || !file.tempFileURL) {
      throw new Error('图片链接获取失败');
    }

    const ratio = task.ratio || '1:1';
    const size = String(task.resolution || '4K').toUpperCase() === '2K' ? '2K' : '4K';

    const prompt = `请把输入照片生成“Q版拼豆风格”的卡通形象。要求：保留人物/主体的神态特征，整体可爱、干净、细节清晰，背景简洁；画面比例：${ratio}；输出清晰度：${size}；不要水印。`;

    const requestData = {
      model: DOUBAO_MODEL,
      prompt,
      image: file.tempFileURL,
      size,
      watermark: false
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ARK_API_KEY}`
    };

    const response = await httpsPost(DOUBAO_ARK_URL, requestData, headers);
    const url0 = response && response.data && response.data[0] && response.data[0].url ? response.data[0].url : '';
    if (!url0) throw new Error('生成失败');

    const downloadRes = await httpsGetBuffer(url0);
    const contentType = String((downloadRes && downloadRes.contentType) || '').toLowerCase();
    const ext = contentType.includes('png') ? 'png' : (contentType.includes('webp') ? 'webp' : 'jpg');
    const cloudPath = `cartoon_results/${taskId}-${Date.now()}.${ext}`;
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: downloadRes && downloadRes.buffer ? downloadRes.buffer : Buffer.from([])
    });
    const resultFileID = uploadRes && uploadRes.fileID ? String(uploadRes.fileID) : '';
    if (!resultFileID) throw new Error('结果上传失败');

    await taskRef.update({
      data: {
        status: 'success',
        resultUrl: url0,
        resultFileID,
        updatedAt: Date.now(),
        finishedAt: Date.now()
      }
    });

    console.log('processDoubaoTask:success', { taskId });
    return { code: 0, msg: 'success', data: { status: 'success', resultUrl: url0, resultFileID } };
  } catch (e) {
    const errMsg = String((e && e.message) || '生成失败');
    console.log('processDoubaoTask:failed', { taskId, errMsg });
    await taskRef.update({
      data: {
        status: 'failed',
        errorMessage: errMsg,
        updatedAt: Date.now(),
        finishedAt: Date.now()
      }
    });
    return { code: -4, msg: 'failed', error: errMsg };
  }
}

exports.main = async (event, context) => {
  try {
    const { action, subject, taskId } = event || {};
    const wxContext = cloud.getWXContext();

    console.log('ai-generator:invoke', {
      hasAction: !!action,
      action: action || '',
      hasEvent: !!event
    });

    const maybeDocId = (() => {
      if (!event) return '';
      if (event.docId) return String(event.docId);
      if (event._id) return String(event._id);
      if (event.doc && event.doc._id) return String(event.doc._id);
      if (event.data && event.data._id) return String(event.data._id);
      if (event.documentId) return String(event.documentId);
      return '';
    })();

    const maybeCollectionName = (() => {
      if (!event) return '';
      if (event.collectionName) return String(event.collectionName);
      if (event.collection) return String(event.collection);
      if (event.CollectionName) return String(event.CollectionName);
      return '';
    })();

    const maybeEventType = (() => {
      if (!event) return '';
      if (event.eventType) return String(event.eventType);
      if (event.type) return String(event.type);
      if (event.EventType) return String(event.EventType);
      if (event.op) return String(event.op);
      return '';
    })();

    const isDbTriggerCall = !action && !!maybeDocId;
    const isCreateOp = String(maybeEventType).toLowerCase().includes('create') || String(maybeEventType).toLowerCase().includes('insert');

    if (isDbTriggerCall && (!maybeCollectionName || maybeCollectionName === DOUBAO_TASK_COLLECTION) && (!maybeEventType || isCreateOp)) {
      console.log('ai-generator:db_trigger', { maybeDocId, maybeCollectionName, maybeEventType });
      return await processDoubaoTask(maybeDocId);
    }

    if (action === 'createDoubaoTask') {
      const { fileID, ratio = '1:1', resolution = '4K' } = event || {};
      if (!fileID) return { code: -1, msg: '缺少图片 fileID' };

      const pay = await consumeCoins({
        openid: wxContext.OPENID,
        cost: COIN_COSTS.createDoubaoTask,
        type: 'consume',
        title: '转卡通消耗',
        meta: { action: 'createDoubaoTask' }
      })
      if (!pay || !pay.ok) {
        return { code: pay && pay.code ? pay.code : -1, msg: (pay && pay.msg) ? pay.msg : '豆币不足', data: (pay && pay.data) ? pay.data : {} }
      }

      const now = Date.now();
      let addRes;
      try {
        try {
          addRes = await db.collection(DOUBAO_TASK_COLLECTION).add({
            data: {
              openid: wxContext.OPENID,
              fileID,
              ratio,
              resolution,
              status: 'pending',
              createdAt: now,
              updatedAt: now
            }
          });
        } catch (e) {
          const msg = String((e && e.message) || (e && e.errMsg) || '');
          const isNotExist = msg.includes('-502005') || msg.includes('COLLECTION_NOT_EXISTS') || msg.includes('collection not exist') || msg.includes('Db or Table not exist');
          if (!isNotExist) throw e;
          await ensureCollectionExists(DOUBAO_TASK_COLLECTION);
          addRes = await db.collection(DOUBAO_TASK_COLLECTION).add({
            data: {
              openid: wxContext.OPENID,
              fileID,
              ratio,
              resolution,
              status: 'pending',
              createdAt: now,
              updatedAt: now
            }
          });
        }
      } catch (e) {
        const refund = await changeCoins({
          openid: wxContext.OPENID,
          delta: pay.cost,
          type: 'refund',
          title: '转卡通失败退款',
          meta: { action: 'createDoubaoTask' }
        }).catch(() => null)
        const errMsg = String((e && e.message) || (e && e.errMsg) || '创建任务失败')
        return {
          code: -6,
          msg: '创建任务失败',
          error: errMsg,
          data: {
            wallet: {
              coins: refund && refund.ok ? refund.coins : null
            }
          }
        }
      }

      await incUserDailyStat(wxContext.OPENID, { cartoonCount: 1 }).catch(() => null)

      const newTaskId = addRes && addRes._id ? String(addRes._id) : '';
      return { code: 0, msg: 'ok', data: { taskId: newTaskId, wallet: { coins: pay.coins } } };
    }

    if (action === 'getDoubaoTask') {
      const id = String(taskId || '');
      if (!id) return { code: -1, msg: '缺少任务 ID' };
      const snap = await db.collection(DOUBAO_TASK_COLLECTION).doc(id).get().catch(() => null);
      const doc = snap && snap.data ? snap.data : null;
      if (!doc) return { code: -2, msg: '任务不存在' };
      if (doc.openid && doc.openid !== wxContext.OPENID) return { code: -3, msg: '无权限' };

      return {
        code: 0,
        msg: 'ok',
        data: {
          status: doc.status || '',
          resultUrl: doc.resultUrl || '',
          resultFileID: doc.resultFileID || '',
          errorMessage: doc.errorMessage || ''
        }
      };
    }

    if (action === 'processDoubaoTask') {
      return await processDoubaoTask(String(taskId || ''));
    }

    if (action === 'doubaoImageToImage') {
      const { fileID, ratio = '1:1', resolution = '4K', prompt: customPrompt } = event || {};
      const ARK_API_KEY = process.env.DOUBAO_ARK_API_KEY || '';

      if (!ARK_API_KEY) {
        return { code: -1, msg: '未配置豆包 API Key' };
      }
      if (!fileID) {
        return { code: -1, msg: '缺少图片 fileID' };
      }

      const size = String(resolution || '4K').toUpperCase() === '2K' ? '2K' : '4K';

      try {
        const tempUrlRes = await cloud.getTempFileURL({ fileList: [fileID] });
        const file = (tempUrlRes && tempUrlRes.fileList && tempUrlRes.fileList[0]) ? tempUrlRes.fileList[0] : null;
        if (!file || file.status !== 0 || !file.tempFileURL) {
          return { code: -2, msg: '图片链接获取失败' };
        }

        const defaultPrompt = `请把输入照片生成“Q版拼豆风格”的卡通形象。要求：保留人物/主体的神态特征，整体可爱、干净、细节清晰，背景简洁；画面比例：${ratio}；输出清晰度：${size}；不要水印。`;
        const prompt = customPrompt || defaultPrompt;

        const requestData = {
          model: DOUBAO_MODEL,
          prompt,
          image: file.tempFileURL,
          size,
          watermark: false
        };

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ARK_API_KEY}`
        };

        const response = await httpsPost(DOUBAO_ARK_URL, requestData, headers);
        const url0 = response && response.data && response.data[0] && response.data[0].url ? response.data[0].url : '';
        if (!url0) {
          return { code: -3, msg: '生成失败' };
        }

        const downloadRes = await httpsGetBuffer(url0);
        const contentType = String((downloadRes && downloadRes.contentType) || '').toLowerCase();
        const ext = contentType.includes('png') ? 'png' : (contentType.includes('webp') ? 'webp' : 'jpg');
        const cloudPath = `cartoon_results/direct-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
        const uploadRes = await cloud.uploadFile({
          cloudPath,
          fileContent: downloadRes && downloadRes.buffer ? downloadRes.buffer : Buffer.from([])
        });
        const resultFileID = uploadRes && uploadRes.fileID ? String(uploadRes.fileID) : '';

        return {
          code: 0,
          data: {
            url: url0,
            fileID: resultFileID
          },
          msg: 'success'
        };
      } catch (error) {
        console.error('Doubao API Call Failed:', error.message);
        return { code: -5, msg: '生成失败', error: error.message };
      }
    }

    if (action === 'matting') {
      const { fileID } = event || {};
      const apiKey = process.env.AOS_API_KEY || '';
      if (!apiKey) {
        return { code: -1, msg: '未配置抠图 API Key' };
      }
      if (!fileID) {
        return { code: -1, msg: '缺少图片 fileID' };
      }

      const openid = wxContext.OPENID
      const pay = await consumeCoins({ openid, cost: COIN_COSTS.matting, type: 'consume', title: '抠图消耗', meta: { action: 'matting' } })
      if (!pay || !pay.ok) {
        return { code: pay && pay.code ? pay.code : -1, msg: (pay && pay.msg) ? pay.msg : '豆币不足', data: (pay && pay.data) ? pay.data : {} }
      }

      let refunded = false
      const refundOnce = async () => {
        if (refunded) return null
        refunded = true
        return await changeCoins({ openid, delta: pay.cost, type: 'refund', title: '抠图失败退款', meta: { action: 'matting' } }).catch(() => null)
      }

      try {
        const dl = await cloud.downloadFile({ fileID });
        const buf = dl && dl.fileContent ? (Buffer.isBuffer(dl.fileContent) ? dl.fileContent : Buffer.from(dl.fileContent)) : null;
        if (!buf || !buf.length) {
          await refundOnce()
          return { code: -2, msg: '图片读取失败' };
        }

        const extMatch = String(fileID).match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
        const ext = extMatch && extMatch[1] ? String(extMatch[1]).toLowerCase() : 'jpg';
        const contentType = ext === 'png'
          ? 'image/png'
          : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
        const filename = `input.${ext === 'png' || ext === 'webp' ? ext : 'jpg'}`;

        const res = await httpsPostMultipart(
          AOS_MATTING_URL,
          { sync: '1' },
          { fieldName: 'image_file', filename, contentType, buffer: buf }
        );

        const imageUrl = res && res.data && res.data.image ? String(res.data.image) : '';
        const status = res && typeof res.status !== 'undefined' ? Number(res.status) : NaN;
        if (status !== 200 || !imageUrl) {
          const msg = res && res.message ? String(res.message) : '抠图失败';
          await refundOnce()
          return { code: -3, msg };
        }

        const out = await httpsGetBuffer(imageUrl);
        const outType = String((out && out.contentType) || '').toLowerCase();
        const outExt = outType.includes('png') ? 'png' : (outType.includes('webp') ? 'webp' : 'jpg');
        const cloudPath = `matting_results/${Date.now()}-${Math.floor(Math.random() * 1000)}.${outExt}`;
        const up = await cloud.uploadFile({
          cloudPath,
          fileContent: out && out.buffer ? out.buffer : Buffer.from([])
        });
        const resultFileID = up && up.fileID ? String(up.fileID) : '';
        if (!resultFileID) {
          await refundOnce()
          return { code: -4, msg: '结果上传失败' };
        }

        await incUserDailyStat(openid, { mattingCount: 1 }).catch(() => null)

        return {
          code: 0,
          msg: 'ok',
          data: {
            fileID: resultFileID,
            wallet: { coins: pay.coins }
          }
        };
      } catch (e) {
        const refund = await refundOnce()
        const errMsg = String((e && e.message) || '网络请求失败');
        return {
          code: -5,
          msg: '网络请求失败',
          error: errMsg,
          data: {
            wallet: { coins: refund && refund.ok ? refund.coins : null }
          }
        };
      }
    }

    if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
      return {
        code: -1,
        msg: '未配置 API Key'
      };
    }

    const prompt = `
    Design a 16x16 pixel art of: ${subject || 'a random cute object'}.
    
    Respond with ONLY a valid JSON object (no markdown formatting).
    JSON Structure:
    {
      "title": "Short title",
      "description": "Short description",
      "palette": ["#HexColor1", "#HexColor2", ...],
      "grid": [
        [0, 0, 1, 1, ...], // 16 rows, each containing 16 integers (indices into palette)
        ...
      ]
    }
    Use 0 for transparent/background if possible, or include a background color in palette.
    Ensure the art is centered and clear.
  `;

    try {
      const requestData = {
        model: MODEL_NAME, 
        messages: [
          { role: "system", content: "You are a pixel art generator. You strictly output JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      };

      const response = await httpsPost(API_URL, requestData, headers);

      const aiContent = response.choices[0].message.content;
      let pixelData;
    
      try {
        pixelData = JSON.parse(aiContent);
      } catch (e) {
        const cleanJson = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
        pixelData = JSON.parse(cleanJson);
      }

      return {
        code: 0,
        data: pixelData
      };

    } catch (error) {
      console.error('AI API Call Failed:', error.message);
      return {
        code: -2,
        msg: 'AI 生成失败',
        error: error.message
      };
    }
  } catch (e) {
    console.error('Function Unhandled Error:', e && e.stack ? e.stack : e);
    return {
      code: -999,
      msg: '云函数异常',
      error: String((e && e.message) || e || '')
    };
  }
};
