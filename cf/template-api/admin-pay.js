const crypto = require('crypto');
const https = require('https');

const APP_ID = 'wx9db1df964c432583';
const COLLECTION = 'payment_test_orders';
const AMOUNT = 1; // Unit: fen. No amount or merchant parameters are accepted from clients.

function config() {
  const env = process.env;
  const pem = (value) => String(value || '').trim().replace(/\\n/g, '\n');
  return {
    mchid: String(env.WX_PAY_MCH_ID || '').trim(),
    appid: APP_ID,
    serial: String(env.WX_PAY_CERT_SERIAL_NO || '').trim(),
    privateKey: env.WX_PAY_PRIVATE_KEY_BASE64 ? Buffer.from(env.WX_PAY_PRIVATE_KEY_BASE64, 'base64').toString('utf8') : pem(env.WX_PAY_PRIVATE_KEY),
    publicKey: pem(env.WX_PAY_PUBLIC_KEY),
    publicKeyId: String(env.WX_PAY_PUBLIC_KEY_ID || '').trim(),
    apiKey: String(env.WX_PAY_API_V3_KEY || '').trim(),
    notifyUrl: String(env.WX_PAY_NOTIFY_URL || '').trim()
  };
}

function readiness(c) {
  let privateKeyValid = false;
  let publicKeyValid = false;
  try { privateKeyValid = crypto.createPrivateKey(c.privateKey).asymmetricKeyType === 'rsa'; } catch (_) {}
  try { publicKeyValid = crypto.createPublicKey(c.publicKey).asymmetricKeyType === 'rsa'; } catch (_) {}
  return [
    { label: '商户号', configured: /^\d+$/.test(c.mchid) },
    { label: '商户证书序列号', configured: /^[A-Fa-f0-9]+$/.test(c.serial) },
    { label: '商户私钥', configured: privateKeyValid },
    { label: '微信支付公钥', configured: publicKeyValid },
    { label: '微信支付公钥ID', configured: /^PUB_KEY_ID_[A-Za-z0-9]+$/.test(c.publicKeyId) },
    { label: 'APIv3密钥', configured: Buffer.byteLength(c.apiKey) === 32 },
    { label: '支付通知地址', configured: /^https:\/\/[^?\s]+$/.test(c.notifyUrl) }
  ];
}

function requireReady(c) {
  if (readiness(c).some(item => !item.configured)) throw new Error('支付配置尚未齐全，请先检查配置状态');
}

function verifySignature(c, headers, raw) {
  const h = {};
  Object.keys(headers || {}).forEach(key => { h[key.toLowerCase()] = headers[key]; });
  const timestamp = String(h['wechatpay-timestamp'] || '');
  const nonce = String(h['wechatpay-nonce'] || '');
  const signature = String(h['wechatpay-signature'] || '');
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !nonce || !signature || h['wechatpay-serial'] !== c.publicKeyId) {
    throw new Error('微信支付签名信息无效');
  }
  const valid = crypto.verify('RSA-SHA256', Buffer.from(timestamp + '\n' + nonce + '\n' + raw + '\n'), c.publicKey, Buffer.from(signature, 'base64'));
  if (!valid) throw new Error('微信支付签名验证失败');
}

function request(c, method, route, body) {
  const raw = body ? JSON.stringify(body) : '';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString('hex');
  const sign = crypto.sign('RSA-SHA256', Buffer.from(method + '\n' + route + '\n' + timestamp + '\n' + nonce + '\n' + raw + '\n'), c.privateKey).toString('base64');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.mch.weixin.qq.com', path: route, method,
      headers: {
        Authorization: 'WECHATPAY2-SHA256-RSA2048 mchid="' + c.mchid + '",nonce_str="' + nonce + '",signature="' + sign + '",timestamp="' + timestamp + '",serial_no="' + c.serial + '"',
        'Wechatpay-Serial': c.publicKeyId,
        'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Youmi-Admin-Payment/1.0'
      }
    }, res => {
      let result = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        result += chunk;
        if (result.length > 131072) req.destroy(new Error('支付接口返回数据过大'));
      });
      res.on('error', reject);
      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            let error = {};
            try { error = JSON.parse(result); } catch (_) {}
            const failure = new Error('微信支付：' + String(error.message || error.code || ('HTTP ' + res.statusCode)).slice(0, 160));
            failure.providerCode = String(error.code || '');
            throw failure;
          }
          verifySignature(c, res.headers, result);
          resolve(result ? JSON.parse(result) : {});
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(8000, () => req.destroy(new Error('支付接口请求超时，请查询订单后重试')));
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

function summary(order) {
  return {
    outTradeNo: order.outTradeNo,
    amountText: '0.01',
    state: order.state,
    transactionId: order.transactionId || '',
    paidAt: order.paidAt || '',
    createdAt: order.createdAt,
    expiresAt: order.expiresAt
  };
}

async function readOrder(db, id) {
  const result = await db.collection(COLLECTION).doc(id).get();
  return result.data;
}

async function applyTransaction(db, c, transaction) {
  const id = String(transaction.out_trade_no || '');
  if (!/^AT[a-f0-9]{30}$/.test(id)) throw new Error('非管理员测试订单');
  return db.runTransaction(async tx => {
    const ref = tx.collection(COLLECTION).doc(id);
    const result = await ref.get();
    const order = result.data;
    if (!order || order.amount !== AMOUNT || transaction.mchid !== c.mchid || transaction.appid !== c.appid || order.mchid !== c.mchid || order.appid !== c.appid || !transaction.payer || transaction.payer.openid !== order.ownerOpenid || !transaction.amount || transaction.amount.total !== AMOUNT || transaction.amount.currency !== 'CNY') {
      throw new Error('支付订单的商户、用户或金额校验失败');
    }
    const states = ['SUCCESS', 'NOTPAY', 'CLOSED', 'REVOKED', 'USERPAYING', 'PAYERROR'];
    if (!states.includes(transaction.trade_state)) throw new Error('未知支付状态');
    if (order.state === 'SUCCESS') {
      if (transaction.trade_state === 'SUCCESS' && transaction.transaction_id !== order.transactionId) throw new Error('支付流水号不一致');
      return order;
    }
    const next = {
      state: transaction.trade_state,
      checkedAt: Date.now()
    };
    if (next.state === 'SUCCESS') {
      if (!transaction.transaction_id) throw new Error('缺少支付流水号');
      next.transactionId = transaction.transaction_id;
      next.paidAt = transaction.success_time || '';
    }
    await ref.update({ data: next });
    return Object.assign({}, order, next);
  });
}

async function handle({ db, action, event, openid }) {
  const c = config();
  if (action === 'adminPayStatus') {
    const checks = readiness(c);
    return { code: 0, data: { checks, ready: checks.every(item => item.configured), merchantId: c.mchid, amountText: '0.01', accountKey: crypto.createHash('sha256').update(openid).digest('hex').slice(0, 20) } };
  }
  requireReady(c);
  if (action === 'queryAdminPayTest' || action === 'closeAdminPayTest') {
    const id = String(event.outTradeNo || '');
    if (!/^AT[a-f0-9]{30}$/.test(id)) throw new Error('订单号格式不正确');
    const order = await readOrder(db, id);
    if (!order || order.ownerOpenid !== openid) return { code: -3, msg: '无权查询此订单' };
    if (action === 'closeAdminPayTest') {
      if (order.state === 'SUCCESS') return { code: 0, data: { order: summary(order) } };
      await request(c, 'POST', '/v3/pay/transactions/out-trade-no/' + id + '/close', { mchid: c.mchid });
      const next = await db.runTransaction(async tx => {
        const ref = tx.collection(COLLECTION).doc(id);
        const latest = (await ref.get()).data;
        if (latest.state === 'SUCCESS') return latest;
        await ref.update({ data: { state: 'CLOSED' } });
        return Object.assign({}, latest, { state: 'CLOSED' });
      });
      return { code: 0, data: { order: summary(next) } };
    }
    let transaction;
    try {
      transaction = await request(c, 'GET', '/v3/pay/transactions/out-trade-no/' + id + '?mchid=' + encodeURIComponent(c.mchid));
    } catch (error) {
      if (error.providerCode !== 'ORDER_NOT_EXIST' || Date.now() - order.createdAt < 10000 || order.state === 'SUCCESS') throw error;
      const next = await db.runTransaction(async tx => {
        const ref = tx.collection(COLLECTION).doc(id);
        const latest = (await ref.get()).data;
        if (latest.state === 'SUCCESS') return latest;
        await ref.update({ data: { state: 'CREATE_FAILED' } });
        return Object.assign({}, latest, { state: 'CREATE_FAILED' });
      });
      return { code: 0, data: { order: summary(next) } };
    }
    const next = await applyTransaction(db, c, transaction);
    return { code: 0, data: { order: summary(next) } };
  }
  const requestId = String(event.requestId || '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(requestId)) throw new Error('请更新测试页面后重试');
  const id = 'AT' + crypto.createHash('sha256').update(openid + ':' + requestId).digest('hex').slice(0, 30);
  const now = Date.now();
  const existing = await db.runTransaction(async tx => {
    const ref = tx.collection(COLLECTION).doc(id);
    // Only a missing document is treated as a new order; storage errors must propagate.
    let order;
    try { order = (await ref.get()).data; } catch (error) {
      const message = String(error.errMsg || error.message || '');
      if (!/document.*(not exist|not found)|DOCUMENT_NOT_EXIST/i.test(message)) throw error;
    }
    if (order) return order;
    const fresh = { outTradeNo: id, ownerOpenid: openid, mchid: c.mchid, appid: c.appid, amount: AMOUNT, state: 'CREATING', createdAt: now, expiresAt: now + 15 * 60 * 1000 };
    await ref.set({ data: fresh });
    return null;
  });
  if (existing && existing.state === 'SUCCESS') return { code: 0, data: { order: summary(existing) } };
  if (existing && ['NOTPAY', 'USERPAYING'].includes(existing.state) && existing.prepayId && existing.expiresAt > now) return paymentResult(c, existing);
  if (existing) return { code: -1, msg: '这笔测试订单已存在，请先查询结果；请勿重复下单', data: { outTradeNo: id } };
  try {
    const result = await request(c, 'POST', '/v3/pay/transactions/jsapi', {
      appid: c.appid, mchid: c.mchid, description: '悠米拼豆管理员支付测试', out_trade_no: id,
      time_expire: new Date(now + 15 * 60 * 1000).toISOString(), notify_url: c.notifyUrl,
      amount: { total: AMOUNT, currency: 'CNY' }, payer: { openid }
    });
    if (!result.prepay_id) throw new Error('微信支付没有返回预支付信息');
    const order = { outTradeNo: id, createdAt: now, expiresAt: now + 15 * 60 * 1000, prepayId: result.prepay_id, state: 'NOTPAY' };
    // A very early notification must never be overwritten by a prepay response.
    await db.runTransaction(async tx => {
      const ref = tx.collection(COLLECTION).doc(id);
      const latest = (await ref.get()).data;
      const data = { prepayId: result.prepay_id };
      if (latest.state !== 'SUCCESS') data.state = 'NOTPAY';
      await ref.update({ data });
    });
    return paymentResult(c, order);
  } catch (error) {
    // The request may have reached WeChat. Keep the same id and query before retrying.
    return { code: -1, msg: error.message || '下单未完成，请先查询结果', data: { outTradeNo: id } };
  }
}

function paymentResult(c, order) {
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const pkg = 'prepay_id=' + order.prepayId;
  const paySign = crypto.sign('RSA-SHA256', Buffer.from(c.appid + '\n' + timeStamp + '\n' + nonceStr + '\n' + pkg + '\n'), c.privateKey).toString('base64');
  return { code: 0, data: { order: summary(order), payment: { timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign } } };
}

function httpResponse(statusCode, value) {
  return { isBase64Encoded: false, statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

async function notify({ db, event }) {
  try {
    const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method);
    if (method !== 'POST') return httpResponse(405, { code: 'FAIL', message: 'POST required' });
    const c = config();
    requireReady(c);
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body;
    if (typeof raw !== 'string' || raw.length > 65536) throw new Error('Invalid notification');
    verifySignature(c, event.headers || {}, raw);
    const message = JSON.parse(raw);
    if (message.event_type !== 'TRANSACTION.SUCCESS' || !message.resource || message.resource.algorithm !== 'AEAD_AES_256_GCM') throw new Error('Invalid payment event');
    const resource = message.resource;
    const encrypted = Buffer.from(resource.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(c.apiKey), Buffer.from(resource.nonce));
    decipher.setAuthTag(encrypted.slice(-16));
    decipher.setAAD(Buffer.from(resource.associated_data || ''));
    const decrypted = Buffer.concat([decipher.update(encrypted.slice(0, -16)), decipher.final()]);
    const transaction = JSON.parse(decrypted.toString('utf8'));
    if (transaction.trade_state !== 'SUCCESS') throw new Error('Not a successful payment');
    await applyTransaction(db, c, transaction);
    return httpResponse(200, { code: 'SUCCESS', message: '成功' });
  } catch (_) {
    return httpResponse(400, { code: 'FAIL', message: '通知验证或处理失败' });
  }
}

module.exports = { handle, notify, readiness, config, verifySignature, applyTransaction };
