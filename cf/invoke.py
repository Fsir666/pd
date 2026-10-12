# -*- coding: utf-8 -*-
"""调用云函数动作（同步等待返回）。"""
import base64, json, sys
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.scf.v20180416 import scf_client, models

SECRET_ID = "AKIDxwjwwiFZgYoqfGdl6HMCoCM1SikYAZlp"
SECRET_KEY = "tXw75pKaeV7UcXFjCTVIwMYWHn6B7sSn"
REGION = "ap-shanghai"
FUNC = "template-api"
NS = "cloudbase-d3ghdhcts9aad4fec"

action = sys.argv[1] if len(sys.argv) > 1 else "resyncDrafts"
payload = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

payload.setdefault("action", action)
payload.setdefault("seedToken", "seed-47012803-pd")

cred = credential.Credential(SECRET_ID, SECRET_KEY)
hp = HttpProfile(endpoint="scf.tencentcloudapi.com")
cp = ClientProfile(httpProfile=hp)
client = scf_client.ScfClient(cred, REGION, cp)

req = models.InvokeFunctionRequest()
req.FunctionName = FUNC
req.Namespace = NS
req.Payload = json.dumps(payload, ensure_ascii=False)

resp = client.InvokeFunction(req)
r = json.loads(resp.to_json_string())
print("== 云函数执行结果 ==")
print("ErrCode:", r.get("ErrCode"), "| Memorial:", r.get("Memorial"))
res = r.get("Result", {})
if isinstance(res, str):
    try:
        res = json.loads(res)
    except Exception:
        pass
print(json.dumps(res, ensure_ascii=False, indent=2)[:4000])
