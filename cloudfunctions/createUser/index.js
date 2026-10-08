// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 生成8位随机数字
function generateRandomId() {
  // 生成 10000000 到 99999999 之间的随机整数
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generateInviteCode(len = 6) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
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

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const userData = event.userData || {}

  try {
    // 1. 检查用户是否已存在（防止重复创建）
    const userCheck = await db.collection('users').where({
      _openid: openid
    }).get()

    if (userCheck.data.length > 0) {
      // ⚠️ 历史 bug：这里曾经「发现已存在就直接返回」，什么都不补。
      // 后果很严重：未登录点收藏时，template-api 的 toggleCollect / setCollect
      // 会自动建一条只有 _openid + collectedTemplates 的「残缺 user」。
      // 之后用户点登录 -> app.login() 查到这条记录 -> 判定「已存在」直接放行，
      // 注册弹窗永远不出现；即使手动填了昵称提交，走到这里又被原样返回，
      // 昵称根本存不进去 —— 用户变成无名氏且永久无法注册。
      // 现在改为：已存在时把缺失的关键字段补全，让残缺账号能自愈。
      const exist = userCheck.data[0] || {}
      const patch = {}

      // 1) 昵称 / 头像 / 手机：只有「本地没值 + 本次传了值」才写入，不覆盖已有资料
      if (!exist.nickName && userData.nickName) patch.nickName = userData.nickName
      if (!exist.avatarUrl && userData.avatarUrl) patch.avatarUrl = userData.avatarUrl
      if (!exist.phone && userData.phone) patch.phone = userData.phone

      // 2) 8 位用户 ID：残缺 user 没有，补一个（用于分享主页 / 邀请匹配）
      if (!exist.userId) {
        let uniqueId = null
        let retryCount = 0
        while (!uniqueId && retryCount < 10) {
          const tempId = generateRandomId()
          const idCheck = await db.collection('users').where({ userId: tempId }).count()
          if (idCheck.total === 0) uniqueId = tempId
          else retryCount++
        }
        if (uniqueId) patch.userId = uniqueId
      }

      // 3) 邀请码：残缺 user 没有，补一个
      if (!exist.inviteCode) {
        let inviteCode = null
        let retryCount2 = 0
        while (!inviteCode && retryCount2 < 10) {
          const temp = generateInviteCode(6)
          const codeCheck = await db.collection('users').where({ inviteCode: temp }).count()
          if (codeCheck.total === 0) inviteCode = temp
          else retryCount2++
        }
        if (inviteCode) patch.inviteCode = inviteCode
      }

      // 4) 数值型默认字段：只在完全缺失时补，绝不覆盖已有余额（否则会清掉用户的豆币）
      if (typeof exist.coins !== 'number') patch.coins = 100
      if (typeof exist.energy !== 'number') patch.energy = 5
      if (typeof exist.invitedCount !== 'number') patch.invitedCount = 0
      if (!exist.invitedBy) patch.invitedBy = ''

      if (Object.keys(patch).length > 0) {
        patch.updateTime = db.serverDate()
        await db.collection('users').doc(exist._id).update({ data: patch }).catch(() => null)
      }

      return {
        success: true,
        data: { ...exist, ...patch },
        message: '用户已存在'
      }
    }

    // 2. 生成唯一的8位ID
    let uniqueId = null
    let isUnique = false
    let retryCount = 0
    const maxRetries = 10

    while (!isUnique && retryCount < maxRetries) {
      const tempId = generateRandomId()
      
      // 检查ID是否已存在
      const idCheck = await db.collection('users').where({
        userId: tempId
      }).count()

      if (idCheck.total === 0) {
        uniqueId = tempId
        isUnique = true
      } else {
        retryCount++
      }
    }

    if (!uniqueId) {
      throw new Error('生成用户ID失败，请重试')
    }

    // 2.5 生成唯一邀请码
    let inviteCode = null
    let inviteUnique = false
    retryCount = 0
    while (!inviteUnique && retryCount < maxRetries) {
      const temp = generateInviteCode(6)
      const codeCheck = await db.collection('users').where({ inviteCode: temp }).count()
      if (codeCheck.total === 0) {
        inviteCode = temp
        inviteUnique = true
      } else {
        retryCount++
      }
    }
    if (!inviteCode) {
      throw new Error('生成邀请码失败，请重试')
    }

    // 3. 创建新用户
    const newUser = {
      ...userData,
      _openid: openid,
      userId: uniqueId,
      inviteCode,
      invitedBy: '',
      invitedCount: 0,
      coins: 100, // 初始豆子
      energy: 5,  // 初始体力
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    const res = await db.collection('users').add({
      data: newUser
    })

    await ensureCollectionExists('coin_ledger').catch(() => {})
    await db.collection('coin_ledger').add({
      data: {
        _openid: openid,
        delta: 100,
        balanceAfter: 100,
        title: '新用户初始豆币',
        type: 'init',
        meta: {},
        day: (() => {
          const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
          const y = d.getUTCFullYear()
          const m = String(d.getUTCMonth() + 1).padStart(2, '0')
          const dd = String(d.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${dd}`
        })(),
        createTime: db.serverDate()
      }
    }).catch(() => null)

    return {
      success: true,
      data: {
        ...newUser,
        _id: res._id
      }
    }

  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err,
      message: err.message
    }
  }
}
