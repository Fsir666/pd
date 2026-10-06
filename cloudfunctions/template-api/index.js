// 云函数入口文件
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')
const fs = require('fs')
const path = require('path')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

function escapeRegExp(input) {
  return String(input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function createOutTradeNo() {
  return `T${Date.now()}${Math.floor(Math.random() * 1000)}`
}

function pickPayFailMessage(payRes) {
  if (!payRes) return ''
  return String(payRes.returnMsg || payRes.return_msg || payRes.errMsg || payRes.err_msg || '')
}

function getEnvString(key) {
  const val = process.env[key]
  return typeof val === 'string' ? val.trim() : ''
}

function getWxPayPrivateKey() {
  const raw = getEnvString('WX_PAY_PRIVATE_KEY')
  if (raw) {
    let key = raw
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1)
    }
    return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key
  }
  const b64 = getEnvString('WX_PAY_PRIVATE_KEY_BASE64')
  if (!b64) return ''
  try {
    return Buffer.from(b64, 'base64').toString('utf8')
  } catch (e) {
    return ''
  }
}

function signWithRsaSha256Base64(privateKeyPem, message) {
  return crypto.createSign('RSA-SHA256').update(message).sign(privateKeyPem, 'base64')
}

function requestJson({ method, hostname, path, headers, bodyText }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname,
        path,
        headers
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          let json = null
          try {
            json = raw ? JSON.parse(raw) : null
          } catch (e) {
            json = null
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers || {},
            raw,
            json
          })
        })
      }
    )
    req.on('error', reject)
    if (bodyText) req.write(bodyText)
    req.end()
  })
}

function buildWechatPayAuthorization({ mchid, serialNo, privateKeyPem, method, path, bodyText }) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const nonceStr = randomString(32)
  const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${bodyText}\n`
  const signature = signWithRsaSha256Base64(privateKeyPem, message)
  return {
    authorization:
      `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`,
    timestamp,
    nonceStr
  }
}

function dayStringCN(ts) {
  const t = typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now()
  const d = new Date(t + 8 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

async function getUserByOpenid(openid) {
  if (!openid) return null
  try {
    const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
    return res && res.data && res.data[0] ? res.data[0] : null
  } catch (e) {
    return null
  }
}

async function incUserDailyStat(openid, incMap) {
  if (!openid || !incMap || typeof incMap !== 'object') return null
  const today = dayStringCN(Date.now())
  const user = await getUserByOpenid(openid)
  if (!user || !user._id) return null

  const safeInc = {}
  for (const k of Object.keys(incMap)) {
    const v = incMap[k]
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0
    if (n) safeInc[k] = n
  }
  const keys = Object.keys(safeInc)
  if (keys.length === 0) return null

  return await db.runTransaction(async (txn) => {
    const userRef = txn.collection('users').doc(String(user._id))
    const snap = await userRef.get().catch(() => null)
    const doc = snap && snap.data ? snap.data : null
    if (!doc) return null

    const day = doc.dailyStatsDay ? String(doc.dailyStatsDay) : ''
    const cur = (doc.dailyStats && typeof doc.dailyStats === 'object') ? doc.dailyStats : {}
    const base = day === today ? cur : {}
    const nextStats = { ...base }
    for (const k of keys) {
      const curV = typeof nextStats[k] === 'number' ? nextStats[k] : 0
      nextStats[k] = curV + safeInc[k]
    }

    await userRef.update({
      data: {
        dailyStatsDay: today,
        dailyStats: nextStats,
        updateTime: db.serverDate()
      }
    })

    return { day: today, stats: nextStats }
  })
}

function randomInviteCode(len) {
  const n = typeof len === 'number' && Number.isFinite(len) ? Math.max(4, Math.min(10, Math.floor(len))) : 6
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

async function ensureInviteCode(openid) {
  if (!openid) return ''
  const user = await getUserByOpenid(openid)
  if (!user || !user._id) return ''
  if (user.inviteCode) return String(user.inviteCode)

  for (let i = 0; i < 10; i++) {
    const code = randomInviteCode(6)
    const exists = await db.collection('users').where({ inviteCode: code }).count().catch(() => ({ total: 0 }))
    if (exists && typeof exists.total === 'number' && exists.total > 0) continue

    const tx = await db.runTransaction(async (txn) => {
      const ref = txn.collection('users').doc(String(user._id))
      const snap = await ref.get().catch(() => null)
      const doc = snap && snap.data ? snap.data : null
      if (!doc) return ''
      if (doc.inviteCode) return String(doc.inviteCode)
      await ref.update({ data: { inviteCode: code, updateTime: db.serverDate() } })
      return code
    }).catch(() => '')
    if (tx) return tx
  }
  return ''
}

async function ensureCollectionExists(collectionName) {
  if (!collectionName) return
  try {
    await db.createCollection(collectionName)
  } catch (e) {
    const msg = String((e && (e.message || e.errMsg)) || '')
    const ok = msg.includes('COLLECTION_ALREADY_EXISTS') || msg.includes('collection already exists')
    if (!ok) throw e
  }
}

function formatTimeCN(input) {
  const d = input instanceof Date ? input : new Date(input)
  if (!d || Number.isNaN(d.getTime())) return ''
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`
}

async function addCoinLedgerTxn(txn, payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const openid = p.openid ? String(p.openid) : ''
  const delta = typeof p.delta === 'number' && Number.isFinite(p.delta) ? Math.trunc(p.delta) : 0
  const balanceAfter = typeof p.balanceAfter === 'number' && Number.isFinite(p.balanceAfter) ? Math.trunc(p.balanceAfter) : null
  if (!openid || !delta) return null
  const title = p.title ? String(p.title).slice(0, 60) : ''
  const type = p.type ? String(p.type).slice(0, 30) : ''
  const meta = p.meta && typeof p.meta === 'object' ? p.meta : {}

  return txn.collection('coin_ledger').add({
    data: {
      _openid: openid,
      delta,
      balanceAfter,
      title,
      type,
      meta,
      day: dayStringCN(Date.now()),
      createTime: db.serverDate()
    }
  })
}

// 初始数据
const SEED_DATA = [
  {
    title: '皮卡丘像素风',
    author: '拼豆达人A',
    heat: 9999,
    image: '⚡', // 备用 emoji
    imageUrl: 'https://cdn.pixabay.com/photo/2016/08/23/15/51/pokemon-1614777_1280.png', // 示例图
    time: '2h',
    difficulty: '⭐⭐⭐',
    size: '32x32',
    beadsCount: 520,
    description: '这是一个非常可爱的皮卡丘拼豆图纸，适合新手入门。黄色为主色调，非常鲜艳！',
    price: 0
  },
  {
    title: '超级马里奥',
    author: '像素工坊',
    heat: 8848,
    image: '🍄',
    imageUrl: 'https://cdn.pixabay.com/photo/2021/02/08/15/02/mario-5995349_1280.png',
    time: '1.5h',
    difficulty: '⭐⭐',
    size: '24x24',
    beadsCount: 300,
    description: '经典的马里奥大叔，童年的回忆。制作简单，适合亲子互动。',
    price: 0
  },
  {
    title: '粉色爱心熊',
    author: '可爱多',
    heat: 6666,
    image: '🧸',
    imageUrl: 'https://cdn.pixabay.com/photo/2016/03/31/18/34/bear-1294373_1280.png',
    time: '3h',
    difficulty: '⭐⭐⭐⭐',
    size: '48x48',
    beadsCount: 800,
    description: '粉粉嫩嫩的爱心熊，送给女朋友的最佳礼物。',
    price: 0
  },
  {
    title: '彩虹独角兽',
    author: '梦幻西游',
    heat: 5200,
    image: '🦄',
    imageUrl: 'https://cdn.pixabay.com/photo/2017/08/24/09/57/unicorn-2675681_1280.png',
    time: '2.5h',
    difficulty: '⭐⭐⭐',
    size: '40x40',
    beadsCount: 600,
    description: '梦幻的彩虹独角兽，色彩丰富，挑战你的配色能力。',
    price: 0
  },
  {
    title: '我的世界剑',
    author: 'MC老玩家',
    heat: 3344,
    image: '⚔️',
    imageUrl: 'https://cdn.pixabay.com/photo/2020/05/27/14/43/minecraft-5227306_1280.png',
    time: '1h',
    difficulty: '⭐',
    size: '16x16',
    beadsCount: 150,
    description: '钻石剑！MC玩家必备。像素风格原汁原味。',
    price: 0
  },
  {
    title: '塞尔达传说',
    author: '海拉鲁流氓',
    heat: 2000,
    image: '🛡️',
    imageUrl: 'https://cdn.pixabay.com/photo/2017/06/16/16/09/link-2409549_1280.png',
    time: '4h',
    difficulty: '⭐⭐⭐⭐⭐',
    size: '64x64',
    beadsCount: 1200,
    description: '海拉鲁盾牌，防御力MAX。需要极大的耐心。',
    price: 0
  }
];

// 把内置图纸库（pattern-presets）作为「冯」(userId 47012803) 的社区作品发布。
// 增量幂等：按固定 _id = seed_<key> 检查是否已发布，只补发缺失的；新增图案后重跑即可自动补发，不会重复。
async function seedPresetsToUser() {
  const SEED_FLAG_ID = 'seed_presets_v1';
  const TARGET_USER_ID = '47012803';
  const CLOUD_PATH_PREFIX = 'seed-presets/';

  const userRes = await db
    .collection('users')
    .where({ userId: TARGET_USER_ID })
    .limit(1)
    .get()
    .catch(() => ({ data: [] }));
  const targetUser = userRes && userRes.data && userRes.data[0];
  if (!targetUser || !targetUser._openid) {
    return { code: -1, msg: `找不到 userId=${TARGET_USER_ID} 的用户，无法发布` };
  }
  const openid = targetUser._openid;
  const userInfo = {
    userId: targetUser.userId || '',
    userDocId: targetUser._id || '',
    nickName: targetUser.nickName || '悠米拼豆',
    avatarUrl: targetUser.avatarUrl || '',
    openid
  };

  const presets = require('./presets.json');
  const imagesDir = path.join(__dirname, 'images');
  const results = [];
  let seeded = 0;
  let skipped = 0;

  for (const p of presets) {
    const docId = 'seed_' + p.key;
    // 已发布过则跳过（增量补发，避免重复）
    const exist = await db.collection('templates').doc(docId).get().catch(() => null);
    if (exist && exist.data) {
      skipped++;
      continue;
    }

    const imgFile = path.join(imagesDir, p.key + '.png');
    if (!fs.existsSync(imgFile)) {
      results.push({ key: p.key, ok: false, reason: 'no image' });
      continue;
    }
    let fileID;
    try {
      const buf = fs.readFileSync(imgFile);
      const up = await cloud.uploadFile({ cloudPath: CLOUD_PATH_PREFIX + p.key + '.png', fileContent: buf });
      fileID = up.fileID;
    } catch (e) {
      results.push({ key: p.key, ok: false, reason: 'upload fail: ' + (e && e.message ? e.message : e) });
      continue;
    }

    const title = p.name || p.key;
    const tagText = p.tags && p.tags.length ? '（' + p.tags.join('·') + '）' : '';
    const desc = `原创拼豆图纸${tagText}，${p.w}×${p.h} 共 ${p.beadCount} 颗，MARD 品牌色号，可商用。`;
    try {
      await db.collection('templates').doc(docId).set({
        data: {
          title,
          author: userInfo.nickName || '匿名用户',
          imageUrl: fileID,
          description: desc,
          likeCount: 0,
          collectCount: 0,
          heat: 0,
          price: 0,
          isUserWork: true,
          isPublic: true,
          saveTimestamp: Date.now(),
          userInfo,
          board: p.board || null,
          spec: { gridSize: p.w, cols: p.w, rows: p.h, beadCount: p.beadCount },
          tags: p.tags || [],
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
          _openid: openid
        }
      });
      await db.collection('community_posts').doc(docId).set({
        data: {
          content: title,
          imageUrl: fileID,
          author: userInfo.nickName || '匿名用户',
          authorAvatar: userInfo.avatarUrl || '',
          likes: 0,
          templateId: docId,
          tags: p.tags || [],
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
          _openid: openid
        }
      });
      seeded++;
      results.push({ key: p.key, ok: true });
    } catch (e) {
      results.push({ key: p.key, ok: false, reason: 'write fail: ' + (e && e.message ? e.message : e) });
    }
  }

  await db.collection('config').doc(SEED_FLAG_ID).set({
    data: { done: true, time: db.serverDate(), seeded, skipped, total: presets.length }
  }).catch(() => {});

  return { code: 0, msg: 'seed done', seeded, skipped, total: presets.length, results };
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, id } = event;
  const wxContext = cloud.getWXContext()

  const isPayCallback = event && (event.outTradeNo || event.out_trade_no) && (event.returnCode || event.return_code)
  if (isPayCallback) {
    return { errcode: 0, errmsg: 'OK' }
  }

  try {
    // 1. 获取热门榜单
    if (action === 'getHot') {
      // 检查是否需要初始化数据
      const countResult = await db.collection('templates').count();
      if (countResult.total === 0) {
        // 初始化数据
        for (const item of SEED_DATA) {
          await db.collection('templates').add({
            data: {
              ...item,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          });
        }
      }

      // 查询前5条热门数据
      const result = await db.collection('templates')
        .orderBy('heat', 'desc')
        .limit(5)
        .get();

      return {
        code: 0,
        data: result.data,
        msg: 'success'
      };
    }

    // 2. 获取详情
    if (action === 'getDetail') {
      if (!id) {
        return { code: -1, msg: 'Missing template ID' };
      }
      
      const result = await db.collection('templates').doc(id).get();
      return {
        code: 0,
        data: result.data,
        msg: 'success'
      };
    }

    // 5. 获取评论列表
    if (action === 'getComments') {
      const { templateId, sortBy = 'new' } = event;
      if (!templateId) return { code: -1, msg: 'Missing templateId' };

      const orderByField = sortBy === 'hot' ? 'likes' : 'createTime';
      
      const result = await db.collection('comments')
        .where({ templateId })
        .orderBy(orderByField, 'desc')
        .limit(20) // 分页暂定20条
        .get();

      return {
        code: 0,
        data: result.data,
        msg: 'success'
      };
    }

    // 6. 发表评论
    if (action === 'addComment') {
      const { templateId, content, images, userInfo } = event;
      if (!templateId || (!content && (!images || images.length === 0))) {
        return { code: -1, msg: 'Content or images required' };
      }

      const res = await db.collection('comments').add({
        data: {
          templateId,
          content,
          images,
          userInfo, // 前端传来的头像昵称
          likes: 0,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
          _openid: wxContext.OPENID
        }
      });

      return {
        code: 0,
        data: res,
        msg: 'Comment added'
      };
    }

    // 6.1 获取全局点赞总数
    if (action === 'getGlobalLike') {
      const ref = db.collection('global_stats').doc('likes');
      try {
        const doc = await ref.get();
        const count = doc && doc.data && typeof doc.data.count === 'number' ? doc.data.count : 0;
        return { code: 0, data: { count }, msg: 'success' };
      } catch (e) {
        try {
          await ref.set({
            data: {
              count: 0,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          });
        } catch (e2) {}
        return { code: 0, data: { count: 0 }, msg: 'success' };
      }
    }

    // 6.2 点赞全局计数 (每日 1000 次)
    if (action === 'likeGlobal') {
      const openid = wxContext.OPENID;
      const now = new Date();
      const dateStr = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
      const limit = 1000;
      const recordId = `${openid}_${dateStr}`;
      const deltaRaw = event && typeof event.delta === 'number' ? event.delta : 1;
      const delta = Math.max(1, Math.min(50, Math.floor(deltaRaw)));

      const result = await db.runTransaction(async (txn) => {
        const recordRef = txn.collection('global_like_records').doc(recordId);
        const globalRef = txn.collection('global_stats').doc('likes');

        let todayCount = 0;
        try {
          const recordDoc = await recordRef.get();
          todayCount = recordDoc && recordDoc.data && typeof recordDoc.data.count === 'number' ? recordDoc.data.count : 0;
        } catch (e) {
          todayCount = 0;
        }

        let globalCount = 0;
        try {
          const globalDoc = await globalRef.get();
          globalCount = globalDoc && globalDoc.data && typeof globalDoc.data.count === 'number' ? globalDoc.data.count : 0;
        } catch (e) {
          globalCount = 0;
        }

        const remaining = Math.max(0, limit - todayCount);
        const applied = Math.min(delta, remaining);
        if (applied <= 0) {
          return { code: 1001, data: { count: globalCount, applied: 0 }, msg: 'Daily limit reached' };
        }

        if (todayCount > 0) {
          await recordRef.update({
            data: {
              count: _.inc(applied),
              updateTime: db.serverDate()
            }
          });
        } else {
          await recordRef.set({
            data: {
              _openid: openid,
              date: dateStr,
              count: applied,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          });
        }

        try {
          await globalRef.update({
            data: {
              count: _.inc(applied),
              updateTime: db.serverDate()
            }
          });
          globalCount = globalCount + applied;
        } catch (e) {
          await globalRef.set({
            data: {
              count: applied,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          });
          globalCount = applied;
        }

        return { code: 0, data: { count: globalCount, applied }, msg: 'success' };
      });

      return result;
    }

    // 7. 点赞图纸 (带每日限制)
    if (action === 'likeTemplate') {
      const { templateId } = event;
      if (!templateId) return { code: -1, msg: 'Missing templateId' };

      const now = new Date();
      // 获取东八区日期字符串 YYYY-MM-DD
      const dateStr = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];

      // 每日上限：同一用户每天最多给 100 个「不同作品」点赞
      // （同一作品当天重复点赞只 +1 计数，不额外占用额度）
      const DAILY_LIKE_LIMIT = 100;
      const todayLikes = await db.collection('template_likes')
        .where({ _openid: wxContext.OPENID, date: dateStr })
        .get()
        .catch(() => ({ data: [] }));
      const likedTodayIds = new Set((todayLikes.data || []).map(r => r.templateId));
      const isNewTargetToday = !likedTodayIds.has(templateId);
      if (isNewTargetToday && likedTodayIds.size >= DAILY_LIKE_LIMIT) {
        return { code: 1001, msg: `今天的点赞额度已用完（每天最多给 ${DAILY_LIKE_LIMIT} 个作品点赞），明天再来吧` };
      }

      // 查询今日点赞记录
      const likeRecord = await db.collection('template_likes')
        .where({
          templateId,
          _openid: wxContext.OPENID,
          date: dateStr
        })
        .get();

      if (likeRecord.data.length > 0) {
        const record = likeRecord.data[0];
        // 移除每日上限限制
        // if (record.count >= 500) {
        //   return { code: 1001, msg: 'Daily limit reached (500 likes)' };
        // }
        
        // 更新记录
        await db.collection('template_likes').doc(record._id).update({
          data: {
            count: _.inc(1),
            updateTime: db.serverDate()
          }
        });
      } else {
        // 创建新记录
        await db.collection('template_likes').add({
          data: {
            templateId,
            _openid: wxContext.OPENID,
            date: dateStr,
            count: 1,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
      }

      // 更新图纸热度/点赞数
      await db.collection('templates').doc(templateId).update({
        data: {
          heat: _.inc(1),
          // 如果有 likeCount 字段也可以更新，这里暂用 heat 代表热度
          likeCount: _.inc(1) 
        }
      });

      try {
        await db.collection('community_posts').doc(templateId).update({
          data: {
            likes: _.inc(1),
            updateTime: db.serverDate()
          }
        });
      } catch (e) {}

      await incUserDailyStat(wxContext.OPENID, { likeCount: 1 }).catch(() => null)

      return {
        code: 0,
        msg: 'Liked successfully'
      };
    }

    // 8. 收藏/取消收藏
    if (action === 'toggleCollect') {
      const { templateId } = event;
      if (!templateId) return { code: -1, msg: 'Missing templateId' };
      
      const openid = wxContext.OPENID;
      
      // 先查询用户文档
      const userRes = await db.collection('users').where({
        _openid: openid
      }).get();

      let isCollected = false;

      if (userRes.data.length === 0) {
        // 用户不存在，创建用户并添加收藏
        // 注意：实际项目中创建用户可能需要更多信息，这里仅作为 fallback 或初次初始化
        try {
          await db.collection('users').add({
            data: {
              _openid: openid,
              collectedTemplates: [templateId],
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          });
          isCollected = true;
        } catch (e) {
          console.error('Create user failed:', e);
          return { code: -1, msg: 'Create user failed', error: e };
        }
      } else {
        const userDoc = userRes.data[0];
        const userDocId = userDoc._id;
        const collectedTemplates = userDoc.collectedTemplates || [];
        
        // 检查是否已收藏
        isCollected = collectedTemplates.includes(templateId);
        
        if (isCollected) {
            // 已收藏 -> 移除
            try {
              await db.collection('users').doc(userDocId).update({
                  data: {
                      collectedTemplates: _.pull(templateId),
                      updateTime: db.serverDate()
                  }
              });
              isCollected = false;
            } catch (e) {
              console.error('Remove collection failed:', e);
              return { code: -1, msg: 'Remove failed', error: e };
            }
        } else {
            // 未收藏 -> 添加
            try {
              await db.collection('users').doc(userDocId).update({
                  data: {
                      collectedTemplates: _.addToSet(templateId),
                      updateTime: db.serverDate()
                  }
              });
              isCollected = true;
            } catch (e) {
              console.error('Add collection failed:', e);
              return { code: -1, msg: 'Add failed', error: e };
            }
        }
      }
      
      return {
        code: 0,
        data: { isCollected },
        msg: isCollected ? 'Collected' : 'Uncollected'
      };
    }

    if (action === 'getWallet') {
      const openid = wxContext.OPENID
      const user = await getUserByOpenid(openid)
      if (!user) return { code: 401, msg: '请先登录' }
      return {
        code: 0,
        msg: 'success',
        data: {
          coins: typeof user.coins === 'number' ? user.coins : 0,
          energy: typeof user.energy === 'number' ? user.energy : 0,
          lastCheckinDay: user.lastCheckinDay ? String(user.lastCheckinDay) : '',
          checkinStreak: typeof user.checkinStreak === 'number' ? user.checkinStreak : 0,
          today: dayStringCN(Date.now())
        }
      }
    }

    if (action === 'dailyCheckin') {
      const openid = wxContext.OPENID
      const today = dayStringCN(Date.now())
      const yesterday = dayStringCN(Date.now() - 24 * 60 * 60 * 1000)
      const user = await getUserByOpenid(openid)
      if (!user || !user._id) return { code: 401, msg: '请先登录' }

      const baseRewardCoins = 20
      const rewardEnergy = 1
      const maxEnergy = 10
      const streakBonusMap = {
        7: 50,
        14: 100,
        30: 200
      }

      await ensureCollectionExists('coin_ledger').catch(() => {})
      const txRes = await db.runTransaction(async (txn) => {
        const userRef = txn.collection('users').doc(String(user._id))
        const snap = await userRef.get().catch(() => null)
        const doc = snap && snap.data ? snap.data : null
        if (!doc) return { code: 401, msg: '请先登录' }

        const coins = typeof doc.coins === 'number' ? doc.coins : 0
        const energy = typeof doc.energy === 'number' ? doc.energy : 0
        const last = doc.lastCheckinDay ? String(doc.lastCheckinDay) : ''
        const prevStreak = typeof doc.checkinStreak === 'number' ? doc.checkinStreak : 0

        if (last === today) {
          return {
            code: 10002,
            msg: '今日已签到',
            data: { coins, energy, rewardCoins: 0, rewardEnergy: 0, today, streak: prevStreak, bonusCoins: 0 }
          }
        }

        const nextEnergy = Math.min(maxEnergy, energy + rewardEnergy)
        const streak = last === yesterday ? Math.max(1, prevStreak + 1) : 1
        const bonusCoins = streakBonusMap[streak] ? Number(streakBonusMap[streak]) : 0
        const rewardCoins = baseRewardCoins + bonusCoins

        await userRef.update({
          data: {
            coins: _.inc(rewardCoins),
            energy: nextEnergy,
            lastCheckinDay: today,
            checkinStreak: streak,
            updateTime: db.serverDate()
          }
        })

        await addCoinLedgerTxn(txn, {
          openid,
          delta: rewardCoins,
          balanceAfter: coins + rewardCoins,
          type: 'checkin',
          title: bonusCoins > 0 ? `签到奖励（连签${streak}天）` : '签到奖励',
          meta: { streak, bonusCoins }
        }).catch(() => null)

        return {
          code: 0,
          msg: 'ok',
          data: {
            coins: coins + rewardCoins,
            energy: nextEnergy,
            rewardCoins,
            rewardEnergy: nextEnergy - energy,
            today,
            streak,
            bonusCoins
          }
        }
      })

      return txRes
    }

    if (action === 'getDailyTasks') {
      const openid = wxContext.OPENID
      const today = dayStringCN(Date.now())
      const user = await getUserByOpenid(openid)
      if (!user) return { code: 401, msg: '请先登录' }

      const statsDay = user.dailyStatsDay ? String(user.dailyStatsDay) : ''
      const stats = (statsDay === today && user.dailyStats && typeof user.dailyStats === 'object') ? user.dailyStats : {}
      const claimsDay = user.dailyTaskClaimsDay ? String(user.dailyTaskClaimsDay) : ''
      const claimed = (claimsDay === today && Array.isArray(user.dailyTaskClaims)) ? user.dailyTaskClaims.map(String) : []

      const defs = [
        { id: 'share_1', title: '分享作品 1 次', key: 'shareCount', need: 1, rewardCoins: 10 },
        { id: 'like_3', title: '点赞 3 次', key: 'likeCount', need: 3, rewardCoins: 8 },
        { id: 'matting_1', title: '使用抠图 1 次', key: 'mattingCount', need: 1, rewardCoins: 8 },
        { id: 'cartoon_1', title: '使用转卡通 1 次', key: 'cartoonCount', need: 1, rewardCoins: 12 },
        { id: 'save_1', title: '发布作品 1 次', key: 'saveWorkCount', need: 1, rewardCoins: 12 }
      ]

      const tasks = defs.map((t) => {
        const cur = typeof stats[t.key] === 'number' ? stats[t.key] : 0
        const done = cur >= t.need
        const isClaimed = claimed.includes(t.id)
        return {
          id: t.id,
          title: t.title,
          progress: { cur, need: t.need },
          done,
          claimed: isClaimed,
          rewardCoins: t.rewardCoins,
          canClaim: done && !isClaimed
        }
      })

      return { code: 0, msg: 'success', data: { day: today, tasks } }
    }

    if (action === 'claimDailyTask') {
      const openid = wxContext.OPENID
      const { taskId } = event || {}
      const today = dayStringCN(Date.now())
      const user = await getUserByOpenid(openid)
      if (!user || !user._id) return { code: 401, msg: '请先登录' }
      const id = String(taskId || '')
      if (!id) return { code: -1, msg: '缺少 taskId' }

      const defs = {
        share_1: { key: 'shareCount', need: 1, rewardCoins: 10, title: '分享作品 1 次' },
        like_3: { key: 'likeCount', need: 3, rewardCoins: 8, title: '点赞 3 次' },
        matting_1: { key: 'mattingCount', need: 1, rewardCoins: 8, title: '使用抠图 1 次' },
        cartoon_1: { key: 'cartoonCount', need: 1, rewardCoins: 12, title: '使用转卡通 1 次' },
        save_1: { key: 'saveWorkCount', need: 1, rewardCoins: 12, title: '发布作品 1 次' }
      }
      const def = defs[id]
      if (!def) return { code: -1, msg: '未知任务' }

      await ensureCollectionExists('coin_ledger').catch(() => {})
      const txRes = await db.runTransaction(async (txn) => {
        const userRef = txn.collection('users').doc(String(user._id))
        const snap = await userRef.get().catch(() => null)
        const doc = snap && snap.data ? snap.data : null
        if (!doc) return { code: 401, msg: '请先登录' }

        const statsDay = doc.dailyStatsDay ? String(doc.dailyStatsDay) : ''
        const stats = (statsDay === today && doc.dailyStats && typeof doc.dailyStats === 'object') ? doc.dailyStats : {}
        const cur = typeof stats[def.key] === 'number' ? stats[def.key] : 0
        if (cur < def.need) return { code: 10003, msg: '任务未完成', data: { cur, need: def.need } }

        const claimsDay = doc.dailyTaskClaimsDay ? String(doc.dailyTaskClaimsDay) : ''
        const prevClaims = (claimsDay === today && Array.isArray(doc.dailyTaskClaims)) ? doc.dailyTaskClaims.map(String) : []
        if (prevClaims.includes(id)) return { code: 10004, msg: '已领取' }

        const rewardCoins = def.rewardCoins
        await userRef.update({
          data: {
            dailyTaskClaimsDay: today,
            dailyTaskClaims: _.addToSet(id),
            coins: _.inc(rewardCoins),
            updateTime: db.serverDate()
          }
        })

        const coins = typeof doc.coins === 'number' ? doc.coins : 0
        await addCoinLedgerTxn(txn, {
          openid,
          delta: rewardCoins,
          balanceAfter: coins + rewardCoins,
          type: 'task',
          title: `每日任务：${def.title}`,
          meta: { taskId: id }
        }).catch(() => null)
        return { code: 0, msg: 'ok', data: { rewardCoins, coins: coins + rewardCoins, taskId: id } }
      })

      return txRes
    }

    if (action === 'getCoinLedger') {
      const openid = wxContext.OPENID
      const user = await getUserByOpenid(openid)
      if (!user) return { code: 401, msg: '请先登录' }
      await ensureCollectionExists('coin_ledger').catch(() => {})
      const limitRaw = typeof event.limit === 'undefined' ? 20 : Number(event.limit)
      const skipRaw = typeof event.skip === 'undefined' ? 0 : Number(event.skip)
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20
      const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.floor(skipRaw)) : 0

      const res = await db.collection('coin_ledger')
        .where({ _openid: openid })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
        .catch(() => ({ data: [] }))

      const listRaw = res && Array.isArray(res.data) ? res.data : []
      const list = listRaw.map((it) => {
        const delta = typeof it.delta === 'number' ? it.delta : 0
        const balanceAfter = typeof it.balanceAfter === 'number' ? it.balanceAfter : null
        const title = it.title ? String(it.title) : ''
        const type = it.type ? String(it.type) : ''
        const t = it.createTime ? formatTimeCN(it.createTime) : ''
        return { delta, balanceAfter, title, type, time: t }
      })

      return { code: 0, msg: 'success', data: { list, hasMore: list.length === limit, nextSkip: skip + list.length } }
    }

    if (action === 'recordShare') {
      const openid = wxContext.OPENID
      const { templateId = '' } = event || {}
      const today = dayStringCN(Date.now())
      const user = await getUserByOpenid(openid)
      if (!user || !user._id) return { code: 401, msg: '请先登录' }

      const rewardCoins = 5
      const maxRewardPerDay = 1

      await ensureCollectionExists('coin_ledger').catch(() => {})
      const txRes = await db.runTransaction(async (txn) => {
        const userRef = txn.collection('users').doc(String(user._id))
        const snap = await userRef.get().catch(() => null)
        const doc = snap && snap.data ? snap.data : null
        if (!doc) return { code: 401, msg: '请先登录' }

        const coins = typeof doc.coins === 'number' ? doc.coins : 0

        const day = doc.dailyStatsDay ? String(doc.dailyStatsDay) : ''
        const curStats = (day === today && doc.dailyStats && typeof doc.dailyStats === 'object') ? doc.dailyStats : {}
        const nextStats = { ...curStats }
        nextStats.shareCount = (typeof nextStats.shareCount === 'number' ? nextStats.shareCount : 0) + 1

        const rewardDay = doc.shareRewardDay ? String(doc.shareRewardDay) : ''
        const rewardCount = rewardDay === today && typeof doc.shareRewardCount === 'number' ? doc.shareRewardCount : 0
        const canReward = rewardCount < maxRewardPerDay

        const updateData = {
          dailyStatsDay: today,
          dailyStats: nextStats,
          updateTime: db.serverDate()
        }

        let appliedReward = 0
        if (canReward) {
          appliedReward = rewardCoins
          updateData.coins = _.inc(rewardCoins)
          updateData.shareRewardDay = today
          updateData.shareRewardCount = rewardCount + 1
        } else {
          updateData.shareRewardDay = today
          updateData.shareRewardCount = rewardCount
        }

        await userRef.update({ data: updateData })

        if (appliedReward > 0) {
          await addCoinLedgerTxn(txn, {
            openid,
            delta: appliedReward,
            balanceAfter: coins + appliedReward,
            type: 'share',
            title: '作品分享奖励',
            meta: { templateId: String(templateId || '') }
          }).catch(() => null)
        }

        return {
          code: 0,
          msg: 'ok',
          data: {
            templateId: String(templateId || ''),
            rewardCoins: appliedReward,
            coins: coins + appliedReward
          }
        }
      })

      return txRes
    }

    if (action === 'getInviteInfo') {
      const openid = wxContext.OPENID
      const user = await getUserByOpenid(openid)
      if (!user) return { code: 401, msg: '请先登录' }
      const inviteCode = user.inviteCode ? String(user.inviteCode) : await ensureInviteCode(openid)
      const invitedBy = user.invitedBy ? String(user.invitedBy) : ''
      const invitedCount = typeof user.invitedCount === 'number' ? user.invitedCount : 0
      return { code: 0, msg: 'success', data: { inviteCode, invitedBy, invitedCount, inviterReward: 50, inviteeReward: 100 } }
    }

    if (action === 'getInviteRecords') {
      const openid = wxContext.OPENID
      const user = await getUserByOpenid(openid)
      if (!user) return { code: 401, msg: '请先登录' }
      const limitRaw = typeof event.limit === 'undefined' ? 20 : Number(event.limit)
      const skipRaw = typeof event.skip === 'undefined' ? 0 : Number(event.skip)
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20
      const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.floor(skipRaw)) : 0

      const res = await db
        .collection('users')
        .where({ invitedBy: openid })
        .orderBy('createTime', 'desc')
        .field({ avatarUrl: true, nickName: true, createTime: true })
        .skip(skip)
        .limit(limit)
        .get()
        .catch(() => ({ data: [] }))

      const listRaw = res && Array.isArray(res.data) ? res.data : []
      const list = listRaw.map((it) => ({
        avatarUrl: it && it.avatarUrl ? String(it.avatarUrl) : '',
        nickName: it && it.nickName ? String(it.nickName) : '匿名用户',
        registerTime: it && it.createTime ? formatTimeCN(it.createTime) : ''
      }))

      return { code: 0, msg: 'success', data: { list, hasMore: list.length === limit, nextSkip: skip + list.length } }
    }

    if (action === 'bindInvite') {
      const openid = wxContext.OPENID
      const codeRaw = event && typeof event.code === 'string' ? event.code : ''
      const code = codeRaw.trim().toUpperCase()
      if (!code) return { code: -1, msg: '缺少邀请码' }

      const user = await getUserByOpenid(openid)
      if (!user || !user._id) return { code: 401, msg: '请先登录' }

      const inviteeReward = 100
      const inviterReward = 50

      await ensureCollectionExists('coin_ledger').catch(() => {})
      const txRes = await db.runTransaction(async (txn) => {
        const inviteeRef = txn.collection('users').doc(String(user._id))
        const inviteeSnap = await inviteeRef.get().catch(() => null)
        const invitee = inviteeSnap && inviteeSnap.data ? inviteeSnap.data : null
        if (!invitee) return { code: 401, msg: '请先登录' }

        const already = invitee.invitedBy ? String(invitee.invitedBy) : ''
        if (already) return { code: 10005, msg: '已绑定邀请码' }

        const myCode = invitee.inviteCode ? String(invitee.inviteCode).toUpperCase() : ''
        if (myCode && myCode === code) return { code: 10006, msg: '不能填写自己的邀请码' }

        const inviterRes = await txn
          .collection('users')
          .where({ inviteCode: code })
          .limit(1)
          .get()
          .catch(() => ({ data: [] }))
        const inviter = inviterRes && inviterRes.data && inviterRes.data[0] ? inviterRes.data[0] : null
        if (!inviter || !inviter._id || !inviter._openid) return { code: 10007, msg: '邀请码无效' }

        const inviterOpenid = String(inviter._openid)
        if (inviterOpenid === openid) return { code: 10006, msg: '不能填写自己的邀请码' }

        const inviteeCoins = typeof invitee.coins === 'number' ? invitee.coins : 0
        const inviterCoins = typeof inviter.coins === 'number' ? inviter.coins : 0

        const inviterRef = txn.collection('users').doc(String(inviter._id))
        await Promise.all([
          inviteeRef.update({
            data: {
              invitedBy: inviterOpenid,
              inviteBindTime: db.serverDate(),
              coins: _.inc(inviteeReward),
              updateTime: db.serverDate()
            }
          }),
          inviterRef.update({
            data: {
              invitedCount: _.inc(1),
              coins: _.inc(inviterReward),
              updateTime: db.serverDate()
            }
          })
        ])

        await Promise.all([
          addCoinLedgerTxn(txn, {
            openid,
            delta: inviteeReward,
            balanceAfter: inviteeCoins + inviteeReward,
            type: 'invite',
            title: '填写邀请码奖励',
            meta: { inviterOpenid }
          }).catch(() => null),
          addCoinLedgerTxn(txn, {
            openid: inviterOpenid,
            delta: inviterReward,
            balanceAfter: inviterCoins + inviterReward,
            type: 'invite',
            title: '邀请好友奖励',
            meta: { inviteeOpenid: openid }
          }).catch(() => null)
        ])

        return {
          code: 0,
          msg: 'ok',
          data: {
            inviterOpenid,
            inviteeReward,
            inviterReward,
            wallet: {
              coins: inviteeCoins + inviteeReward
            }
          }
        }
      })

      return txRes
    }

    // 9. 获取用户对某作品的状态 (是否收藏)
    if (action === 'getUserStatus') {
      const { templateId } = event;
      if (!templateId) return { code: -1, msg: 'Missing templateId' };
      
      const openid = wxContext.OPENID;
      
      try {
        const userRes = await db.collection('users').where({
            _openid: openid
        }).get();
        
        let isCollected = false;
        if (userRes.data.length > 0) {
            const collectedTemplates = userRes.data[0].collectedTemplates || [];
            isCollected = collectedTemplates.includes(templateId);
        }
        
        return {
          code: 0,
          data: {
            isCollected
          },
          msg: 'success'
        };
      } catch (err) {
        console.error('Get user status failed:', err);
        return {
            code: 0,
            data: { isCollected: false },
            msg: 'success (fallback)'
        };
      }
    }

    // 10. 获取我的收藏列表
    if (action === 'getMyCollections') {
      const openid = wxContext.OPENID;
      
      try {
        // 1. 获取用户收藏的ID列表
        const userRes = await db.collection('users').where({
            _openid: openid
        }).get();
        
        if (userRes.data.length === 0 || !userRes.data[0].collectedTemplates || userRes.data[0].collectedTemplates.length === 0) {
            return {
                code: 0,
                data: [],
                msg: 'No collections'
            };
        }
        
        const templateIds = userRes.data[0].collectedTemplates;
        
        // 2. 根据ID列表批量查询模板详情
        // 注意：db.command.in 有数量限制，如果收藏很多需要分批，这里暂时假设数量不多
        const templatesRes = await db.collection('templates').where({
            _id: _.in(templateIds)
        }).get();
        
        return {
            code: 0,
            data: templatesRes.data,
            msg: 'success'
        };
      } catch (err) {
          console.error('Get my collections failed:', err);
          return {
              code: -1,
              msg: 'Get collections failed',
              error: err
          };
      }
    }

    // 11. 获取我的作品列表
    if (action === 'getMyWorks') {
      const openid = wxContext.OPENID;
      try {
        const result = await db.collection('templates').where({
            _openid: openid
        }).orderBy('createTime', 'desc').limit(100).get();
        
        return {
            code: 0,
            data: result.data,
            msg: 'success'
        };
      } catch (err) {
          console.error('Get my works failed:', err);
          return {
              code: -1,
              msg: 'Get works failed',
              error: err
          };
      }
    }

    if (action === 'saveMyWork') {
      const { title, description, imageUrl, isPublic, timestampMs, board, spec, authorInfo } = event || {};
      if (!imageUrl) return { code: -1, msg: 'Missing imageUrl' };
      const safeTitle = title && String(title).trim() ? String(title).trim().slice(0, 40) : '我的作品';
      const safeDesc = description && String(description).trim() ? String(description).trim().slice(0, 200) : '';
      const safeIsPublic = !!isPublic;
      const safeTimestampMs = typeof timestampMs === 'number' && Number.isFinite(timestampMs) ? Math.floor(timestampMs) : Date.now();
      const safeBoard = board && typeof board === 'object' ? board : {};
      const safeSpec = spec && typeof spec === 'object' ? spec : {};

      let userDoc = null;
      try {
        const userRes = await db.collection('users').where({ _openid: wxContext.OPENID }).limit(1).get();
        if (userRes && userRes.data && userRes.data.length > 0) userDoc = userRes.data[0];
      } catch (e) {}
      
      const clientUserInfo = authorInfo || {};
      const userInfo = {
        userId: userDoc && userDoc.userId ? userDoc.userId : '',
        userDocId: userDoc && userDoc._id ? userDoc._id : '',
        nickName: clientUserInfo.nickName || (userDoc && userDoc.nickName ? userDoc.nickName : ''),
        avatarUrl: clientUserInfo.avatarUrl || (userDoc && userDoc.avatarUrl ? userDoc.avatarUrl : ''),
        openid: wxContext.OPENID
      };

      const res = await db.collection('templates').add({
        data: {
          title: safeTitle,
          author: userInfo.nickName || '匿名用户',
          imageUrl,
          description: safeDesc,
          likeCount: 0,
          collectCount: 0,
          heat: 0,
          price: 0,
          isUserWork: true,
          isPublic: safeIsPublic,
          saveTimestamp: safeTimestampMs,
          userInfo,
          board: safeBoard,
          spec: safeSpec,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
          _openid: wxContext.OPENID
        }
      });

      const templateId = res && res._id ? res._id : '';
      if (safeIsPublic && templateId) {
        await db.collection('community_posts').doc(templateId).set({
          data: {
            content: safeTitle,
            imageUrl,
            author: userInfo.nickName || '匿名用户',
            authorAvatar: userInfo.avatarUrl || '',
            likes: 0,
            templateId,
            createTime: db.serverDate(),
            updateTime: db.serverDate(),
            _openid: wxContext.OPENID
          }
        });
      }

      await incUserDailyStat(wxContext.OPENID, { saveWorkCount: 1 }).catch(() => null)

      return {
        code: 0,
        data: { id: templateId },
        msg: 'success'
      };
    }

    if (action === 'seedPresets') {
      return await seedPresetsToUser();
    }

    if (action === 'trackAchievement') {
      const keyRaw = event && typeof event.key === 'string' ? event.key : '';
      const key = keyRaw.trim();
      if (!key) return { code: -1, msg: 'Missing key' };
      const openid = wxContext.OPENID;
      if (!openid) return { code: -1, msg: 'Missing openid' };

      const meta = {
        remix: { title: '复刻达人' },
        copy_material: { title: '配色管家' },
        share: { title: '分享之星' }
      };
      const title = meta[key] ? meta[key].title : key;

      let userDoc = null;
      try {
        const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get();
        if (userRes && userRes.data && userRes.data.length > 0) userDoc = userRes.data[0];
      } catch (e) {}

      const now = db.serverDate();
      if (!userDoc) {
        const newUser = {
          _openid: openid,
          achievements: { [key]: now },
          achievementCounters: { [key]: 1 },
          createTime: now,
          updateTime: now
        };
        await db.collection('users').add({ data: newUser }).catch(() => ({}));
        return { code: 0, data: { unlocked: true, title }, msg: 'success' };
      }

      const achievements = userDoc.achievements && typeof userDoc.achievements === 'object' ? userDoc.achievements : {};
      const unlocked = achievements[key] == null;
      const updateData = {
        updateTime: now,
        [`achievementCounters.${key}`]: _.inc(1)
      };
      if (unlocked) updateData[`achievements.${key}`] = now;

      await db.collection('users').doc(userDoc._id).update({ data: updateData }).catch(() => ({}));
      return { code: 0, data: { unlocked, title }, msg: 'success' };
    }

    // 12. 切换作品公开状态
    if (action === 'togglePublic') {
      const { templateId, isPublic } = event;
      if (!templateId) return { code: -1, msg: 'Missing templateId' };
      
      const safeIsPublic = !!isPublic;
      
      // 1. 更新 templates 集合
      await db.collection('templates').doc(templateId).update({
        data: {
          isPublic: safeIsPublic,
          updateTime: db.serverDate()
        }
      });
      
      // 2. 同步 community_posts 集合
      if (safeIsPublic) {
        // 如果设为公开 -> 添加到社区
        // 先获取作品详情
        const templateRes = await db.collection('templates').doc(templateId).get();
        const template = templateRes.data;
        
        // 检查是否已存在
        const postRes = await db.collection('community_posts').doc(templateId).get().catch(() => ({ data: null }));
        
        if (!postRes.data) {
           // 不存在 -> 创建
           await db.collection('community_posts').doc(templateId).set({
             data: {
               content: template.title || '无标题',
               imageUrl: template.imageUrl,
               author: template.author || '匿名用户',
               authorAvatar: (template.userInfo && template.userInfo.avatarUrl) || '',
               likes: template.likeCount || 0,
               templateId: templateId,
               createTime: db.serverDate(),
               updateTime: db.serverDate(),
               _openid: wxContext.OPENID
             }
           });
        } else {
            // 已存在 -> 也可以选择更新下信息，防止之前改了标题没同步
            await db.collection('community_posts').doc(templateId).update({
                data: {
                    updateTime: db.serverDate()
                }
            });
        }
      } else {
        // 如果设为私密 -> 从社区移除
        try {
            await db.collection('community_posts').doc(templateId).remove();
        } catch (e) {
            // 忽略删除不存在记录的错误
        }
      }
      
      return {
        code: 0,
        msg: safeIsPublic ? '已公开到社区' : '已转为私密作品',
        data: { isPublic: safeIsPublic }
      };
    }

    if (action === 'searchUsers') {
      const keywordRaw = event && typeof event.keyword === 'string' ? event.keyword : '';
      const keyword = keywordRaw.trim();
      const limitRaw = event && typeof event.limit === 'number' ? event.limit : 20;
      const limit = Math.max(1, Math.min(30, Math.floor(limitRaw)));
      if (!keyword) return { code: 0, data: [], msg: 'success' };

      const openid = wxContext.OPENID;
      const reg = db.RegExp({ regexp: escapeRegExp(keyword), options: 'i' });
      const usersRes = await db
        .collection('users')
        .where({ nickName: reg })
        .field({ _openid: true, nickName: true, avatarUrl: true, userId: true, bio: true })
        .limit(limit)
        .get();

      const users = usersRes.data || [];
      const openids = users.map((u) => u._openid).filter(Boolean);
      let followingSet = new Set();
      if (openids.length > 0) {
        const followRes = await db
          .collection('user_follows')
          .where({ fromOpenid: openid, toOpenid: _.in(openids) })
          .field({ toOpenid: true })
          .get()
          .catch(() => ({ data: [] }));
        followingSet = new Set((followRes.data || []).map((d) => d.toOpenid).filter(Boolean));
      }

      return {
        code: 0,
        data: users.map((u) => ({
          _openid: u._openid,
          userId: u.userId || '',
          nickName: u.nickName || '匿名用户',
          avatarUrl: u.avatarUrl || '',
          bio: u.bio || '',
          isFollowing: followingSet.has(u._openid)
        })),
        msg: 'success'
      };
    }

    if (action === 'searchAll') {
      const keywordRaw = event && typeof event.keyword === 'string' ? event.keyword : '';
      const keyword = keywordRaw.trim();
      const limitRaw = event && typeof event.limit === 'number' ? event.limit : 20;
      const limit = Math.max(1, Math.min(30, Math.floor(limitRaw)));
      if (!keyword) return { code: 0, data: { users: [], works: [] }, msg: 'success' };

      const openid = wxContext.OPENID;
      const reg = db.RegExp({ regexp: escapeRegExp(keyword), options: 'i' });

      const usersRes = await db
        .collection('users')
        .where({ nickName: reg })
        .field({ _openid: true, nickName: true, avatarUrl: true, userId: true, bio: true })
        .limit(Math.min(12, limit))
        .get()
        .catch(() => ({ data: [] }));

      const users = usersRes.data || [];
      const userOpenids = users.map((u) => u._openid).filter(Boolean);
      let followingSet = new Set();
      if (userOpenids.length > 0) {
        const followRes = await db
          .collection('user_follows')
          .where({ fromOpenid: openid, toOpenid: _.in(userOpenids) })
          .field({ toOpenid: true })
          .get()
          .catch(() => ({ data: [] }));
        followingSet = new Set((followRes.data || []).map((d) => d.toOpenid).filter(Boolean));
      }

      const postsRes = await db
        .collection('community_posts')
        .where(_.or([{ content: reg }, { title: reg }]))
        .orderBy('createTime', 'desc')
        .limit(limit)
        .get()
        .catch(() => ({ data: [] }));

      const templatesRes = await db
        .collection('templates')
        .where({ isPublic: true, title: reg })
        .field({ _id: true, title: true, imageUrl: true, author: true, likeCount: true, userInfo: true, createTime: true, _openid: true })
        .orderBy('createTime', 'desc')
        .limit(limit)
        .get()
        .catch(() => ({ data: [] }));

      const worksMap = new Map();
      (postsRes.data || []).forEach((p) => {
        const tid = p.templateId || p._id;
        worksMap.set(String(tid), {
          _id: p._id,
          templateId: tid,
          content: p.content || p.title || '',
          imageUrl: p.imageUrl || '',
          likes: typeof p.likes === 'number' ? p.likes : 0,
          author: p.author || '匿名用户',
          authorAvatar: p.authorAvatar || '',
          _openid: p._openid || ''
        });
      });
      (templatesRes.data || []).forEach((t) => {
        const tid = t._id;
        const key = String(tid);
        if (worksMap.has(key)) return;
        worksMap.set(key, {
          _id: tid,
          templateId: tid,
          content: t.title || '',
          imageUrl: t.imageUrl || '',
          likes: typeof t.likeCount === 'number' ? t.likeCount : 0,
          author: t.author || '匿名用户',
          authorAvatar: (t.userInfo && t.userInfo.avatarUrl) ? t.userInfo.avatarUrl : '',
          _openid: t._openid || ''
        });
      });

      return {
        code: 0,
        data: {
          users: users.map((u) => ({
            _openid: u._openid,
            userId: u.userId || '',
            nickName: u.nickName || '匿名用户',
            avatarUrl: u.avatarUrl || '',
            bio: u.bio || '',
            isFollowing: followingSet.has(u._openid)
          })),
          works: Array.from(worksMap.values())
        },
        msg: 'success'
      };
    }

    if (action === 'toggleFollow') {
      const toOpenid = event && typeof event.toOpenid === 'string' ? event.toOpenid : '';
      if (!toOpenid) return { code: -1, msg: 'Missing toOpenid' };

      const fromOpenid = wxContext.OPENID;
      if (toOpenid === fromOpenid) return { code: -1, msg: 'Cannot follow self' };

      const followDocId = `${fromOpenid}_${toOpenid}`;
      const followCol = db.collection('user_follows');
      const followDocRef = followCol.doc(followDocId);

      let isFollowing = false;
      try {
        await followDocRef.get();
        await followDocRef.remove();
        isFollowing = false;
      } catch (e) {
        const msg = e && e.message ? String(e.message) : '';
        if (msg.includes('DATABASE_COLLECTION_NOT_EXIST') || msg.includes('Collection not found') || msg.includes('集合不存在')) {
          return { code: -1, msg: 'db or table not exist: user_follows' };
        }

        try {
          await followDocRef.set({
            data: {
              fromOpenid,
              toOpenid,
              createTime: db.serverDate()
            }
          });
          isFollowing = true;
        } catch (err2) {
          const msg2 = err2 && err2.message ? String(err2.message) : '';
          if (msg2.includes('DATABASE_COLLECTION_NOT_EXIST') || msg2.includes('Collection not found') || msg2.includes('集合不存在')) {
            return { code: -1, msg: 'db or table not exist: user_follows' };
          } else {
            throw err2;
          }
        }
      }

      const followerCountRes = await followCol.where({ toOpenid }).count().catch(() => ({ total: 0 }));
      const followerCount = followerCountRes && typeof followerCountRes.total === 'number' ? followerCountRes.total : 0;

      return {
        code: 0,
        data: { isFollowing, followerCount },
        msg: 'success'
      };
    }

    if (action === 'getFollowStats') {
      const openid = event && typeof event.openid === 'string' && event.openid ? event.openid : wxContext.OPENID;
      if (!openid) return { code: -1, msg: 'Missing openid' };

      const followCol = db.collection('user_follows');
      try {
        const [followingCountRes, followerCountRes] = await Promise.all([
          followCol.where({ fromOpenid: openid }).count(),
          followCol.where({ toOpenid: openid }).count()
        ]);

        return {
          code: 0,
          data: {
            followingCount: followingCountRes && typeof followingCountRes.total === 'number' ? followingCountRes.total : 0,
            followerCount: followerCountRes && typeof followerCountRes.total === 'number' ? followerCountRes.total : 0
          },
          msg: 'success'
        };
      } catch (e) {
        const msg = e && e.message ? String(e.message) : '';
        if (msg.includes('DATABASE_COLLECTION_NOT_EXIST') || msg.includes('Collection not found') || msg.includes('集合不存在')) {
          return { code: -1, msg: 'db or table not exist: user_follows' };
        }
        throw e;
      }
    }

    if (action === 'getFollowList') {
      const type = event && typeof event.type === 'string' ? event.type : '';
      const targetOpenid = event && typeof event.openid === 'string' && event.openid ? event.openid : wxContext.OPENID;
      const limitRaw = event && typeof event.limit === 'number' ? event.limit : 20;
      const skipRaw = event && typeof event.skip === 'number' ? event.skip : 0;
      const limit = Math.max(1, Math.min(50, Math.floor(limitRaw)));
      const skip = Math.max(0, Math.floor(skipRaw));

      if (!targetOpenid) return { code: -1, msg: 'Missing openid' };
      if (type !== 'following' && type !== 'followers') return { code: -1, msg: 'Invalid type' };

      const followCol = db.collection('user_follows');
      let listRes;
      let totalRes;
      try {
        if (type === 'following') {
          [listRes, totalRes] = await Promise.all([
            followCol.where({ fromOpenid: targetOpenid }).orderBy('createTime', 'desc').skip(skip).limit(limit).get(),
            followCol.where({ fromOpenid: targetOpenid }).count()
          ]);
        } else {
          [listRes, totalRes] = await Promise.all([
            followCol.where({ toOpenid: targetOpenid }).orderBy('createTime', 'desc').skip(skip).limit(limit).get(),
            followCol.where({ toOpenid: targetOpenid }).count()
          ]);
        }
      } catch (e) {
        const msg = e && e.message ? String(e.message) : '';
        if (msg.includes('DATABASE_COLLECTION_NOT_EXIST') || msg.includes('Collection not found') || msg.includes('集合不存在')) {
          return { code: -1, msg: 'db or table not exist: user_follows' };
        }
        throw e;
      }

      const rows = (listRes && listRes.data) ? listRes.data : [];
      const total = totalRes && typeof totalRes.total === 'number' ? totalRes.total : 0;
      if (rows.length === 0) {
        return {
          code: 0,
          data: { list: [], total, hasMore: skip + 0 < total },
          msg: 'success'
        };
      }

      const openids = rows.map((r) => (type === 'following' ? r.toOpenid : r.fromOpenid)).filter(Boolean);
      const uniqOpenids = Array.from(new Set(openids));
      if (uniqOpenids.length === 0) {
        return {
          code: 0,
          data: { list: [], total, hasMore: skip + rows.length < total },
          msg: 'success'
        };
      }

      const userRes = await db.collection('users').where({ _openid: db.command.in(uniqOpenids) }).get().catch(() => ({ data: [] }));
      const userDocs = userRes && userRes.data ? userRes.data : [];
      const userMap = new Map(userDocs.map((u) => [u._openid, u]));

      const viewerOpenid = wxContext.OPENID;
      let followingSet = new Set();
      if (viewerOpenid && uniqOpenids.length > 0) {
        const viewerFollowsRes = await followCol
          .where({ fromOpenid: viewerOpenid, toOpenid: db.command.in(uniqOpenids) })
          .get()
          .catch(() => ({ data: [] }));
        const viewerRows = viewerFollowsRes && viewerFollowsRes.data ? viewerFollowsRes.data : [];
        followingSet = new Set(viewerRows.map((r) => r.toOpenid));
      }

      const list = openids.map((oid) => {
        const u = userMap.get(oid) || {};
        return {
          _openid: oid,
          userId: u.userId || '',
          nickName: u.nickName || '匿名用户',
          avatarUrl: u.avatarUrl || '',
          bio: u.bio || '',
          isFollowing: viewerOpenid ? followingSet.has(oid) : false
        };
      });

      return {
        code: 0,
        data: { list, total, hasMore: skip + rows.length < total },
        msg: 'success'
      };
    }

    if (action === 'getUserProfile') {
      const targetOpenid = event && typeof event.openid === 'string' ? event.openid : '';
      if (!targetOpenid) return { code: -1, msg: 'Missing openid' };

      const viewerOpenid = wxContext.OPENID;
      const isSelf = !!(viewerOpenid && viewerOpenid === targetOpenid);
      const userRes = await db
        .collection('users')
        .where({ _openid: targetOpenid })
        .limit(1)
        .get()
        .catch(() => ({ data: [] }));

      const userDoc = userRes.data && userRes.data.length > 0 ? userRes.data[0] : null;
      const userInfo = {
        _openid: targetOpenid,
        userId: (userDoc && userDoc.userId) || '',
        nickName: (userDoc && userDoc.nickName) || '匿名用户',
        avatarUrl: (userDoc && userDoc.avatarUrl) || '',
        bio: (userDoc && userDoc.bio) || ''
      };

      const followerCountRes = await db.collection('user_follows').where({ toOpenid: targetOpenid }).count().catch(() => ({ total: 0 }));
      const followerCount = followerCountRes && typeof followerCountRes.total === 'number' ? followerCountRes.total : 0;

      let isFollowing = false;
      if (viewerOpenid && viewerOpenid !== targetOpenid) {
        const viewerFollowDocId = `${viewerOpenid}_${targetOpenid}`;
        try {
          await db.collection('user_follows').doc(viewerFollowDocId).get();
          isFollowing = true;
        } catch (e) {
          isFollowing = false;
        }
      }

      const worksCountRes = await db
        .collection('templates')
        .where({ _openid: targetOpenid, isPublic: true })
        .count()
        .catch(() => ({ total: 0 }));
      const worksCount = worksCountRes && typeof worksCountRes.total === 'number' ? worksCountRes.total : 0;

      const worksRes = await db
        .collection('templates')
        .where({ _openid: targetOpenid, isPublic: true })
        .orderBy('createTime', 'desc')
        .limit(30)
        .get()
        .catch(() => ({ data: [] }));

      return {
        code: 0,
        data: {
          user: userInfo,
          followerCount,
          worksCount,
          isFollowing,
          isSelf,
          works: worksRes.data || []
        },
        msg: 'success'
      };
    }

    if (action === 'updateMyProfile') {
      const nickNameRaw = event && typeof event.nickName === 'string' ? event.nickName : '';
      const nickName = nickNameRaw.trim();
      if (!nickName) return { code: -1, msg: 'Missing nickName' };

      const avatarUrlRaw = event && typeof event.avatarUrl === 'string' ? event.avatarUrl : '';
      const avatarUrl = avatarUrlRaw.trim();
      const bioRaw = event && typeof event.bio === 'string' ? event.bio : '';
      const bio = bioRaw.trim().slice(0, 80);

      const openid = wxContext.OPENID;
      const updateData = {
        nickName,
        bio,
        updateTime: db.serverDate()
      };
      if (avatarUrl) updateData.avatarUrl = avatarUrl;

      const updateRes = await db.collection('users').where({ _openid: openid }).update({ data: updateData });
      const updated = updateRes && updateRes.stats && typeof updateRes.stats.updated === 'number' ? updateRes.stats.updated : 0;
      if (updated <= 0) return { code: -1, msg: 'User not found' };

      const templateUpdate = {
        author: nickName,
        updateTime: db.serverDate(),
        ['userInfo.nickName']: nickName
      };
      if (avatarUrl) templateUpdate['userInfo.avatarUrl'] = avatarUrl;
      await db.collection('templates').where({ _openid: openid }).update({ data: templateUpdate }).catch(() => ({}));

      const postUpdate = {
        author: nickName,
        updateTime: db.serverDate()
      };
      if (avatarUrl) postUpdate.authorAvatar = avatarUrl;
      await db.collection('community_posts').where({ _openid: openid }).update({ data: postUpdate }).catch(() => ({}));

      const userRes = await db
        .collection('users')
        .where({ _openid: openid })
        .limit(1)
        .get()
        .catch(() => ({ data: [] }));

      const user = userRes.data && userRes.data.length > 0 ? userRes.data[0] : null;
      return { code: 0, data: { user }, msg: 'success' };
    }

    // 4. 添加图纸 (开发者用)
    if (action === 'add') {
      const { template } = event;
      if (!template) {
        return { code: -1, msg: 'Missing template data' };
      }

      const res = await db.collection('templates').add({
        data: {
          ...template,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });

      return {
        code: 0,
        success: true,
        data: res,
        msg: 'Added successfully'
      };
    }

    // 3. 重置/初始化数据 (开发调试用)
    if (action === 'reset') {
      // 危险操作：清空现有数据
      const countResult = await db.collection('templates').count();
      if (countResult.total > 0) {
        await db.collection('templates').where({
          _id: _.exists(true) // 匹配所有记录
        }).remove();
      }

      // 重新插入 SEED_DATA
      for (const item of SEED_DATA) {
        await db.collection('templates').add({
          data: {
            ...item,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
      }

      return {
        code: 0,
        msg: 'Database reset successfully',
        count: SEED_DATA.length
      };
    }

    if (action === 'createPayJsapiTest') {
      const mchid = String(event.mchid || getEnvString('WX_PAY_MCH_ID') || '')
      const serialNo = String(event.serialNo || getEnvString('WX_PAY_CERT_SERIAL_NO') || '')
      const notifyUrl = String(event.notifyUrl || getEnvString('WX_PAY_NOTIFY_URL') || '')
      const privateKeyPem = getWxPayPrivateKey()
      const appid = String(event.appid || getEnvString('WX_PAY_APP_ID') || wxContext.FROM_APPID || wxContext.APPID || '')

      if (!mchid) return { code: -1, msg: 'Missing WX_PAY_MCH_ID' }
      if (!serialNo) return { code: -1, msg: 'Missing WX_PAY_CERT_SERIAL_NO' }
      if (!notifyUrl) return { code: -1, msg: 'Missing WX_PAY_NOTIFY_URL' }
      if (!privateKeyPem) return { code: -1, msg: 'Missing WX_PAY_PRIVATE_KEY' }
      if (!/BEGIN (RSA )?PRIVATE KEY/.test(privateKeyPem)) return { code: -1, msg: 'Invalid WX_PAY_PRIVATE_KEY (must be PEM private key)' }
      if (!appid) return { code: -1, msg: 'Missing appid' }
      if (!wxContext.OPENID) return { code: -1, msg: 'Missing openid' }

      const totalFeeInput = typeof event.totalFee === 'undefined' ? 1 : Number(event.totalFee)
      const totalFee = Number.isFinite(totalFeeInput) ? Math.max(1, Math.floor(totalFeeInput)) : 1
      const description = String(event.body || event.description || '测试支付')
      const outTradeNo = createOutTradeNo()

      const path = '/v3/pay/transactions/jsapi'
      const bodyObj = {
        appid,
        mchid,
        description,
        out_trade_no: outTradeNo,
        notify_url: notifyUrl,
        amount: { total: totalFee, currency: 'CNY' },
        payer: { openid: wxContext.OPENID }
      }
      const bodyText = JSON.stringify(bodyObj)
      const signed = buildWechatPayAuthorization({
        mchid,
        serialNo,
        privateKeyPem,
        method: 'POST',
        path,
        bodyText
      })

      const resp = await requestJson({
        method: 'POST',
        hostname: 'api.mch.weixin.qq.com',
        path,
        headers: {
          Authorization: signed.authorization,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'wxcloud'
        },
        bodyText
      })

      const ok = resp.statusCode >= 200 && resp.statusCode < 300
      if (!ok) {
        const msg = (resp.json && resp.json.message) ? String(resp.json.message) : 'WeChatPay API error'
        return {
          code: -1,
          msg,
          data: { statusCode: resp.statusCode, resp: resp.json || resp.raw }
        }
      }

      const prepayId = resp.json && resp.json.prepay_id ? String(resp.json.prepay_id) : ''
      if (!prepayId) {
        return { code: -1, msg: 'Missing prepay_id', data: { resp: resp.json || resp.raw } }
      }

      const timeStamp = String(Math.floor(Date.now() / 1000))
      const nonceStr = randomString(32)
      const pkg = `prepay_id=${prepayId}`
      const paySign = signWithRsaSha256Base64(privateKeyPem, `${appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`)

      return {
        code: 0,
        msg: 'success',
        data: {
          outTradeNo,
          prepayId,
          payment: {
            timeStamp,
            nonceStr,
            package: pkg,
            signType: 'RSA',
            paySign
          }
        }
      }
    }

    if (action === 'createPayTest') {
      const subMchId = event.subMchId || process.env.SUB_MCH_ID
      if (!subMchId) {
        return {
          code: -1,
          msg: 'Missing subMchId (set env SUB_MCH_ID or pass subMchId)'
        }
      }

      const totalFeeInput = typeof event.totalFee === 'undefined' ? 1 : Number(event.totalFee)
      const totalFee = Number.isFinite(totalFeeInput) ? Math.max(1, Math.floor(totalFeeInput)) : 1
      const body = String(event.body || '测试支付')
      const outTradeNo = createOutTradeNo()
      const nonceStr = randomString(24)
      const debug = {
        envId: wxContext.ENV,
        fromAppid: wxContext.FROM_APPID || '',
        hasOpenid: Boolean(wxContext.OPENID),
        subMchId: String(subMchId),
        totalFee
      }

      const unifiedOrderParamsCamel = {
        functionName: 'template-api',
        envId: wxContext.ENV,
        subMchId,
        nonceStr,
        body,
        outTradeNo,
        totalFee,
        spbillCreateIp: '127.0.0.1',
        tradeType: 'JSAPI',
        openid: wxContext.OPENID
      }

      const unifiedOrderParamsSnake = {
        functionName: 'template-api',
        envId: wxContext.ENV,
        sub_mch_id: subMchId,
        nonce_str: nonceStr,
        body,
        out_trade_no: outTradeNo,
        total_fee: totalFee,
        spbill_create_ip: '127.0.0.1',
        trade_type: 'JSAPI',
        openid: wxContext.OPENID
      }

      const payer = wxContext.FROM_APPID
        ? cloud.cloudPay({ appid: wxContext.FROM_APPID })
        : cloud.cloudPay

      let payRes = await payer.unifiedOrder(unifiedOrderParamsCamel)

      if (payRes && payRes.returnCode === 'FAIL') {
        const msg = pickPayFailMessage(payRes)
        if (/total_fee/i.test(msg) || /LACK_PARAMS/i.test(msg)) {
          payRes = await payer.unifiedOrder(unifiedOrderParamsSnake)
        }
      }

      if (payRes && payRes.returnCode === 'FAIL') {
        return {
          code: -1,
          msg: pickPayFailMessage(payRes) || 'unifiedOrder failed',
          data: { payRes, debug }
        }
      }

      if (payRes && payRes.resultCode === 'FAIL') {
        return {
          code: -1,
          msg: String(payRes.errCodeDes || payRes.err_code_des || pickPayFailMessage(payRes) || 'unifiedOrder failed'),
          data: { payRes, debug }
        }
      }

      return {
        code: 0,
        data: { ...payRes, debug },
        msg: 'success'
      }
    }

    return {
      code: -1,
      msg: 'Unknown action'
    };

  } catch (err) {
    console.error(err);
    return {
      code: -2,
      msg: err.message,
      error: err
    };
  }
}
