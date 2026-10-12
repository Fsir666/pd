# -*- coding: utf-8 -*-
"""用 ZipFile(base64 内联) 方式部署 template-api 云函数。
前提：/workspace/cf/template-api-fixed.zip 已包含 **根目录下的 index.js**
（腾讯云要求 zip 根目录直接是 index.js/package.json，不能套一层目录）
"""
import base64, json, sys, time
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.scf.v20180416 import scf_client, models

SECRET_ID = "AKIDxwjwwiFZgYoqfGdl6HMCoCM1SikYAZlp"
SECRET_KEY = "tXw75pKaeV7UcXFjCTVIwMYWHn6B7sSn"
REGION = "ap-shanghai"
FUNC = "template-api"
NS = "cloudbase-d3ghdhcts9aad4fec"
ZIP = "/workspace/cf/template-api-root.zip"

cred = credential.Credential(SECRET_ID, SECRET_KEY)
hp = HttpProfile(endpoint="scf.tencentcloudapi.com")
cp = ClientProfile(httpProfile=hp)
client = scf_client.ScfClient(cred, REGION, cp)

with open(ZIP, "rb") as f:
    raw = f.read()
b64 = base64.b64encode(raw).decode()
print("zip 大小 %.1f MB, base64 %.1f MB" % (len(raw)/1048576, len(b64)/1048576))

req = models.UpdateFunctionCodeRequest()
req.FunctionName = FUNC
req.Namespace = NS
req.Handler = "index.main"
req.CodeSource = "ZipFile"
req.ZipFile = b64
resp = client.UpdateFunctionCode(req)
print(json.dumps(resp.to_json_string(), ensure_ascii=False))

# 轮询状态
for i in range(40):
    time.sleep(3)
    r2 = models.GetFunctionRequest()
    r2.FunctionName = FUNC
    r2.Namespace = NS
    g = client.GetFunction(r2)
    st = g.Status
    print("status:", st, flush=True)
    if st == "Active":
        print("=== 部署完成 ===")
        break
    if st in ("UpdateFailed", "CreateFailed"):
        print("=== 部署失败 ===")
        sys.exit(1)
