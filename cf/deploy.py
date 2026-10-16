# -*- coding: utf-8 -*-
"""部署 template-api 云函数。凭据与 ZIP 路径由环境变量提供。"""
import base64
import json
import os
import sys
import time

from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.scf.v20180416 import scf_client, models

SECRET_ID = os.environ.get("TENCENTCLOUD_SECRET_ID", "").strip()
SECRET_KEY = os.environ.get("TENCENTCLOUD_SECRET_KEY", "").strip()
REGION = "ap-shanghai"
FUNC = "template-api"
NS = "cloudbase-d3ghdhcts9aad4fec"
ZIP = os.environ.get("TEMPLATE_API_ZIP", "/workspace/cf/template-api-root.zip")

if not SECRET_ID or not SECRET_KEY:
    raise SystemExit("Missing TENCENTCLOUD_SECRET_ID or TENCENTCLOUD_SECRET_KEY")
if not os.path.isfile(ZIP):
    raise SystemExit("Cloud function archive not found: " + ZIP)

cred = credential.Credential(SECRET_ID, SECRET_KEY)
hp = HttpProfile(endpoint="scf.tencentcloudapi.com")
cp = ClientProfile(httpProfile=hp)
client = scf_client.ScfClient(cred, REGION, cp)

with open(ZIP, "rb") as f:
    raw = f.read()
b64 = base64.b64encode(raw).decode()
print("zip size %.1f MB, base64 %.1f MB" % (len(raw) / 1048576, len(b64) / 1048576))

req = models.UpdateFunctionCodeRequest()
req.FunctionName = FUNC
req.Namespace = NS
req.Handler = "index.main"
req.CodeSource = "ZipFile"
req.ZipFile = b64
resp = client.UpdateFunctionCode(req)
print(resp.to_json_string())

for _ in range(40):
    time.sleep(3)
    status_req = models.GetFunctionRequest()
    status_req.FunctionName = FUNC
    status_req.Namespace = NS
    status = client.GetFunction(status_req).Status
    print("status:", status, flush=True)
    if status == "Active":
        print("=== deployment complete ===")
        break
    if status in ("UpdateFailed", "CreateFailed"):
        raise SystemExit("=== deployment failed ===")
else:
    raise SystemExit("=== deployment timed out ===")
