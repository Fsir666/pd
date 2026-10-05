// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 业务需要的数据库集合，缺失时自动创建（幂等，只在本实例内跑一次）
const REQUIRED_COLLECTIONS = [
  'users',
  'templates',
  'comments',
  'community_posts',
  'coin_ledger',
  'global_stats',
  'global_like_records',
  'template_likes',
  'user_follows',
  'doubao_tasks',
]

let collectionsReady = false

async function ensureCollections() {
  if (collectionsReady) return
  collectionsReady = true // 先置位，避免并发重复执行
  const db = cloud.database()

  let existing = new Set()
  try {
    const res = await db.listCollections()
    const list = (res && res.collections) || []
    existing = new Set(list.map((c) => (c && c.name) || c))
  } catch (e) {
    existing = new Set()
  }

  const created = []
  for (const name of REQUIRED_COLLECTIONS) {
    if (existing.has(name)) continue
    try {
      await db.createCollection(name)
      created.push(name)
    } catch (e) {
      // 已存在或无权限，忽略
    }
  }
  if (created.length) console.log('自动创建集合:', created.join(', '))
}

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    await ensureCollections()
  } catch (e) {
    console.error('集合检查失败', e)
  }

  const wxContext = cloud.getWXContext()

  return {
    event,
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    env: wxContext.ENV,
  }
}
