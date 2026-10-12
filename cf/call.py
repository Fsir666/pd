# -*- coding: utf-8 -*-
"""直接 HTTP 调用腾讯云 SCF InvokeFunction（绕开 SDK 参数名 bug）。"""
import hashlib, hmac, json, sys, time, base64
from datetime import datetime, timezone
import requests

SECRET_ID = "AKIDxwjwwiFZgYoqfGdl6HMCoCM1SikYAZlp"
SECRET_KEY = "tXw75pKaeV7UcXFjCTVIwMYWHn6B7sSn"
REGION = "ap-shanghai"
FUNC = "template-api"
NS = "cloudbase-d3ghdhcts9aad4fec"
HOST = "scf.tencentcloudapi.com"
SERVICE = "scf"
VERSION = "2018-04-16"

def call(action, payload):
    body = json.dumps(payload, ensure_ascii=False)
    ts = int(time.time())
    date = datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d")
    ct = "application/json; charset=utf-8"
    canonical = "\n".join([
        "POST", "/", "",
        "content-type:%s" % ct,
        "host:%s" % HOST,
        "x-tc-action:%s" % action.lower(),
        "",
        "content-type;host;x-tc-action",
        hashlib.sha256(body.encode()).hexdigest(),
    ])
    sts = "TC3-HMAC-SHA256\n%d\n%s/%s/tc3_request\n%s" % (
        ts, date, SERVICE, hashlib.sha256(canonical.encode()).hexdigest())
    def sign(k, m): return hmac.new(k, m.encode(), hashlib.sha256).digest()
    sk = sign(("TC3" + SECRET_KEY).encode(), date)
    sk = sign(sk, SERVICE)
    sk = sign(sk, "tc3_request")
    sig = hmac.new(sk, sts.encode(), hashlib.sha256).hexdigest()
    auth = ("TC3-HMAC-SHA256 Credential=%s/%s/%s/tc3_request, "
            "SignedHeaders=content-type;host;x-tc-action, Signature=%s"
            % (SECRET_ID, date, SERVICE, sig))
    headers = {
        "Authorization": auth, "Content-Type": ct, "Host": HOST,
        "X-TC-Action": action, "X-TC-Version": VERSION,
        "X-TC-Timestamp": str(ts), "X-TC-Region": REGION,
    }
    r = requests.post("https://%s/" % HOST, headers=headers, data=body.encode(), timeout=300)
    return r.json()

action = sys.argv[1] if len(sys.argv) > 1 else "resyncDrafts"
# 第2个参数：函数内 action（默认同 action）
inner = sys.argv[2] if len(sys.argv) > 2 else action
extra = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}

inner_payload = {"action": inner, "seedToken": "seed-47012803-pd"}
inner_payload.update(extra)

req = {
    "FunctionName": FUNC,
    "Namespace": NS,
    # ⚠️ SCF InvokeFunction 的入参字段名是 Event（不是 Payload）；
    # 传 Payload 会被网关判为 UnknownParameter。
    "Event": json.dumps(inner_payload, ensure_ascii=False),
}
resp = call("InvokeFunction", req)
print("== 响应 ==")
rr = resp.get("Response", {})
print("ErrCode:", rr.get("ErrCode"), "ErrMsg:", rr.get("ErrMsg"))
res = rr.get("Result", {})
if isinstance(res, str):
    try: res = json.loads(res)
    except Exception: pass
print(json.dumps(res, ensure_ascii=False, indent=2)[:5000])
