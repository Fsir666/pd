const http = require('http')

function sendJson(res, statusCode, body) {
  const text = JSON.stringify(body)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 2 * 1024 * 1024) {
        raw = raw.slice(0, 2 * 1024 * 1024)
      }
    })
    req.on('end', () => resolve(raw))
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/wxpay/notify') {
    const rawBody = await readBody(req)
    let parsed = null
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null
    } catch (e) {
      parsed = null
    }

    const summary = {
      id: parsed && parsed.id ? String(parsed.id) : '',
      create_time: parsed && parsed.create_time ? String(parsed.create_time) : '',
      event_type: parsed && parsed.event_type ? String(parsed.event_type) : '',
      resource_type: parsed && parsed.resource_type ? String(parsed.resource_type) : ''
    }

    console.log('wxpay_notify_received', {
      summary,
      headers: {
        'wechatpay-serial': req.headers['wechatpay-serial'] || '',
        'wechatpay-signature': req.headers['wechatpay-signature'] ? '[present]' : '',
        'wechatpay-timestamp': req.headers['wechatpay-timestamp'] || '',
        'wechatpay-nonce': req.headers['wechatpay-nonce'] || ''
      }
    })

    return sendJson(res, 200, { code: 'SUCCESS', message: '成功' })
  }

  return sendJson(res, 404, { code: 'NOT_FOUND', message: 'Not Found' })
})

const port = Number(process.env.PORT || 8080)
server.listen(port, () => {
  console.log(`wxpay-notify listening on ${port}`)
})

