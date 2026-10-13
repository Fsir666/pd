---
title: SKILL
---

---

name: 图纸转数据  
description: |  
MARD 拼豆图纸截图高精度转换为小程序图纸库数据。使用场景：

- 用户说"图纸转数据"，或提供拼豆/像素图纸截图（可带水印）要求转换/提取/入库/上线
- 网格标定、单格取色、水印剔除、逐豆容量分配、图例计数校验的一体化流水线
- 生成悠米拼豆小程序图纸库条目（drafts.json + 缩略图）并部署上线
- 图纸库云函数运维：seedDrafts 灌库、verifyDrafts 验证、resyncDrafts 改字段、sort 排序策略
- 排查图纸库看不到图纸的问题

---

# 图纸转数据（MARD 拼豆图纸 → 小程序图纸库）

## Overview

把一张 MARD 拼豆图纸截图（带列/行号和图例，可能有小红书水印）高精度转换成色号数据，  
校验到与图例计数**一颗不差**，生成小程序图纸库条目并上线。

> 网格尺寸**由标定得出，不要假设 52×52**。
> 实测：首张图纸 51 列 × 52 行；「抱银杏的小猫」50 列 × 50 行。

> **v2 核心变化：有豆判定 = 格中心区有无色号文字。**
> 图纸每格都印了色号（`H2` / `A13` / `G8` …），文字在格中心、网格线在格边缘，天然分离。
> 实测「抱银杏的小猫」：中心区零暗像素的格恰好 1633 = 2500 − 867（图例总数），
> 一次判定即完全正确，17 色首次最近色全中——**无需水印剔除、无需容量修正兜底**。

本文件是**单文件 skill**：工作流 + 铁律清单 + 两个脚本（Python 源码内联）+ 两份附录。
脚本不是独立文件，用下面的一条命令落地（见「⚡ 最快路径」第 0 步）。

## ⚡ Agent 最快路径（先读这一节）

> **铁则：全程只读 2 张图** —— ① 原图（读图例）② `out/compare.png`（核对）。
> 每多读一张图都是白花的时间。**判据、阈值、修正都已固化在脚本里，看图找不出更好的判据。**

### 可直接复制的命令序列

```bash
# 0) 一键落地两个脚本（本文件是单文件 skill，代码块不是独立文件）
python3 - <<'PY'
import re, pathlib
t = pathlib.Path('/workspace/pd.txt').read_text(encoding='utf-8')   # 改成本文档实际路径
b = re.findall(r'```python\n(.*?)```', t, re.S)
pathlib.Path('/tmp/convert_pattern.py').write_text(b[0], encoding='utf-8')
pathlib.Path('/tmp/make_draft_entry.py').write_text(b[1], encoding='utf-8')
print('落地完成:', b[0].count('\n'), '/', b[1].count('\n'), '行')
PY

# 1) 图例：一次性裁出放大图（只此一张，不要反复裁），读它 -> 写 legend.json
python3 -c "from PIL import Image as I; im=I.open('X.png'); W,H=im.size; \
c=im.crop((int(W*0.55),0,W,H)).convert('RGB'); \
c.resize((c.width*2,c.height*2), I.LANCZOS).save('/tmp/legend.png')"

# 2) 转换：先别加 --grid，让脚本自己标定
python3 /tmp/convert_pattern.py --image X.png --legend legend.json --out ./out

# 3) 只核这三行（纯文本，不用看图）；全中才继续
#      [提取] 有豆格 N      -> N == legend.json 里的总数
#      [分配] 首次命中 a/b  -> a == b（等于色号数）
#      TOTAL ... ALL MATCH

# 4) 核对：只读 out/compare.png 这一张（左原图、右重建）

# 5) 生成条目 + 缩略图
python3 /tmp/make_draft_entry.py --pattern ./out/final_pattern.json \
    --key pp-xxx --name "中文名" \
    --drafts /workspace/pd/cf/template-api/drafts.json \
    --thumb-dir /workspace/pd/cf/template-api/drafts-images/drafts-images

# 6) 部署上线 -> 见附录 B        7) 本地 commit（GitHub 推送等用户说"推"）
```

### 🚫 禁止清单（实测最烧时间的动作）

| 别做 | 为什么 |
|---|---|
| 生成裁剪图/放大图去"找判据" | 判据已固化在脚本里；看图只能看出图案长什么样，看不出算法该怎么写 |
| 用视觉逐格读格子 | 2500 格，读不完也没必要 |
| 反复读 `compare.png` / `recon.png` | 读一次够；计数全中时图案几乎不可能错 |
| 一上来就传 `--grid` | 先让脚本自标定；两种方法都失败才手填 |
| 自检不符就自由发挥、试新方法 | 按下面「失败决策树」走 |
| 同一件事试 3 次还没进展 | 停下来报告：现状 + 卡点 + 已排除的可能，别继续烧时间 |
| 重跑整个流程来"确认一下" | 计数全中就是通过，重跑不会更对 |

## 失败决策树（自检不符时按顺序走）

脚本打印 `!! 自检不符: 有豆格 A, 图例总数 B, 差 ±d` 时：

| 症状 | 最可能原因 | 动作 |
|---|---|---|
| `d` 为正且大（+几百） | **网格偏半格**——格心落到格边界，把网格线当成了文字 | 看 `[标定A]/[标定B]` 的 X0/Y0/CW/CH 是否合理；不对就 `--grid` 手填 |
| `d` 为正且小（+几十） | 边缘格被吃进假豆 | 试 `--ctr-thr 0.02` |
| `d` 为负（漏豆） | 阈值过严或格距偏大 | 试 `--ctr-thr 0.005` |
| `d == 0` 但个别色号差 | **取色偏移**（不是网格问题） | 看 `out/cluster_table.txt` 的「平均距离」列，明显偏大的就是问题簇 → `--assign '{"旧":"新"}'` |
| 以上都不灵 | — | **停下来报告**：贴 `[标定]`/`[提取]` 打印 + `legend.json` |

> **实测标定参考**（「抱银杏的小猫」50×50，可作为症状对照）：
> - 正常：`有豆格 867` = 图例总数 867
> - 半格偏移（`--grid "39.6,621,19.24,19.26,50,50"`）→ `有豆格 1123`（**+256**）
> - `--ctr-thr` 在 **0.0005 ~ 0.025** 区间结果都是 867 → **阈值非常鲁棒**
> - 结论：自检不符时**优先怀疑网格，而不是阈值**

## 工作流（严格按顺序）

### 1. 读图例 → 写 legend JSON

图例在截图**右侧一栏**，每个色号一行：色号印在色块上，右边跟数量。  
**只裁一次、放大一次**（用「最快路径」第 1 步的命令出 `/tmp/legend.png`），读它。

```json
{"H2": ["#FEFFFF", 408], "G8": ["#753B32", 212], "...": ["#hex", 数量]}
```

> **图例计数是最终校验的唯一基准，读错一个数后面全错。**
> - **数量必须逐个抄准**；色值只要大致对即可（脚本按最近色匹配，色值只影响缩略图）
> - 抄完先把所有数量**加总一遍**，和图上可能标注的总数对一下

### 2. 跑转换流水线

```bash
python3 /tmp/convert_pattern.py --image <截图.png> --legend legend.json --out ./out
```

脚本自动完成：网格标定（编号带法 → 网格线周期法兜底）→ **中心区判有豆** → 逐格众数取色  
→ 逐豆最近图例色初配 → 容量约束修正 → 与图例计数校验 → 输出  
`final_pattern.json` + `recon.png` + `compare.png`。

**正常情况应当一次跑通**（实测「抱银杏的小猫」全程零手工干预）。跑完先核对三行：

| 打印 | 期望 | 不符时 |
|---|---|---|
| `[提取] 有豆格 N / 总数` | N == 图例总数 | 看脚本打印的 `!! 自检不符` 排查方向 |
| `[分配] … 首次命中 17/17` | 等于色号数 | 首次不是全中但「修正后」= 全部，也算通过 |
| `TOTAL got=… legend=…` | `ALL MATCH` | `MISMATCH` → 查 `cluster_table.txt` |

- 标定可疑时看 `[标定A]` / `[标定B]` 打印；仍不对就 `--grid "X0,Y0,CW,CH,n_cols,n_rows"` 手填
- 阈值可调 `--ctr-thr`（默认 0.01 = 格中心区暗像素占比）
- 差个别色号时看 `out/cluster_table.txt`，用 `--assign '{"旧色号":"新色号"}'` 整批改判
- **验收标准：N 色计数与图例完全一致，总数一致**——达成即通过，**不要再重跑"确认"**

### 3. 核对（只读一张图）

**前置条件：第 2 步那三行全中。** 没全中就先去「失败决策树」，不要靠看图诊断。

只读 `out/compare.png` 一张（左 = 原图裁切，右 = 重建），看**图案有没有整体串位**、
边缘有无明显错位。计数已经一颗不差时，这张图基本不会出问题——**读一次即可，不要反复读**。

> 图纸只保留图案本体，**周围是空格，不铺白豆**。

### 4. 生成图纸库条目 + 缩略图

```bash
python3 /tmp/make_draft_entry.py --pattern ./out/final_pattern.json \
    --key pp-<英文key> --name "<中文名>" \
    --drafts /workspace/pd/cf/template-api/drafts.json \
    --thumb-dir /workspace/pd/cf/template-api/drafts-images/drafts-images
```

产出 drafts.json 条目（palette 按豆数降序，cells 为 w*h 长字符串 base36 索引，  
`.`=空格）+ 豆子风格缩略图。**sort 默认 -10 = 排图纸库第一张**。

### 5. 部署上线

更新 zip 内 drafts.json → 部署云函数 → 灌库 → 验证。完整命令和坑见**附录 B**。

### 6. 本地 commit

用仓库历史身份 `Fsir666 <fsir666@users.noreply.github.com>` 提交。  
**GitHub 推送等用户明确说"推"再推。**

---

## 铁律（每条都是血泪教训）

1. **有豆判定 = 格中心区(28%~72%)有无暗像素(`mx<150`)**——图纸**每格都印了色号文字**，  
   文字落在格中心、网格线落在格边缘，两者天然分离：有色豆中心区必有文字像素，空格中心区纯背景。  
   ~~旧版用 `nw = (mx<195).mean() >= 0.04`（非网格线色像素占比）判空格~~ 方向是错的：  
   白豆本身是白的 → nw≈0 → **被判成空格**；空格被网格线抗锯齿蹭出 nw≥0.04 → **被判成有豆**，  
   且最近色一匹配全部落到 H2 上。实测旧判据得 H2=843（图例应为 102），容量修正也救不回来  
   （池子里同时有 743 个假豆，总量 1610 ≠ 867）。新判据零暗像素格恰好 1633 = 2500 − 867。
2. **不排除网格线色**——D17 图例标 `#C4D4F6`，但**截图里它的实际像素几乎等于淡蓝网格线色**，  
   排除网格线色会让整类报废。新判据不依赖颜色距离，天然绕开这个坑。
3. **编号数字中心 = 格心，X0/Y0 存的是左缘/上缘**——`X0 = 数字中心 - CW/2`；  
   混淆会让整图偏移半格、颜色全串
4. **标定的暗度判据不能加 `sat>25`**——行号/列号多为**黑字**（饱和度≈0），加了就一个都测不到；  
   用 `(mx<170) & ((mx-mn)<40)`。  
   > ⚠ 但这条只对「深色编号」成立：**编号样式不统一**。实测「抱银杏的小猫」列号带是  
   > **橙底白字**，`mx<170` 一个数字都测不到 → 编号带法整体失效。此时靠规则 7 的周期法兜底。
5. **标定别信网格线，也别只信"间距"**——① 网格线投票会因 D17 同色 + 重采样漂移失效；  
   ② **深色豆按网格排列，x 位置天然等差**，一行深豆的列投影本身就是等距链，会被误认成编号带。  
   必须同时要求「链跨度 ≥0.7W」**且**「段高 <1.2 格」——编号带是横跨全图的**细带**
6. **【v2 已删除水印剔除】新判据下水印根本不进候选集**——实测水印在格中心区贡献 <0.5% 暗像素  
   （中心区零暗像素的 1633 格一个不差）。  
   ~~旧版 `remove_watermark`「黄黑同格 + 贴边黑笔画」两级剔除~~ 是建立在 v1 错误候选集上的补丁，  
   实测误删 615 格（**含真豆**）——整个模块已删除。**水印不需要处理，也不应该处理**。  
   **仍要记住的反面教训**：绝不能用「黄像素全局包围盒」圈水印区——  
   暖色豆散布全图 → 包围盒覆盖整幅图 → 会误删数百格。
7. **标定必须有两手：编号带法（A） + 网格线周期法（B）**——A 依赖编号是深色字，  
   遇到橙底白字等样式会整体失效（实测直接抛"找不到列号带"）。B 不依赖编号带颜色：  
   ① 非纯白掩码 `mx<245` 的列/行投影做**自相关** → 主周期即格距  
      （实测 lag=19/38/57/77 全为峰 → CW=19.22，真值 19.28）；  
   ② 满幅暗行/暗列经「合并成带 → 丢弃厚带」筛出**粗网格线**（每 5 格一条）→ 首尾即格边界；  
   ③ 格距用**首尾粗线反推** `(末-首)/格数`，比自相关更准（自相关 0.3% 误差跨 50 格会累积 4px）；  
   ④ 列线要**限定在已求出的行范围内**再找（粗竖线只跨网格高度，全图投影会被标题/色卡淹没）。  
   两法都失败才要求 `--grid` 手填。
8. **颜色分配逐豆做，不要按簇整块挪**——K-means 簇粒度会拿 127 颗的大簇去补 2 颗的小缺口  
   （本图 E16 127 / H19 2 就整块错位），稀有色的簇还会被邻色大簇吃掉。  
   用「逐豆最近色初配 + 换色代价最小的容量修正」。  
   > 判据正确时此步**不产生任何修改**（实测 17 色首次最近色全中）；留着只为取色个别偏移时兜底。
9. **计数对齐才算完**——每色 count == 图例标注数；不对先查误删/漏豆，再用 `--assign` 兜底。  
   脚本已内置**自检**：`[提取] 有豆格数` 应等于图例总数，不等会打印 `!! 自检不符` 并给出排查方向  
   （半格偏移 / 阈值 / 图例读错 / 行列数不对）。**先看这个数，再往下走。**
10. **入库三连**——部署 zip → `seedDrafts {"force":true}` → `verifyDrafts {"keys":[...]}` 精确查  
   （无参 verifyDrafts 只返回前 100 条，新图纸在末尾会 grep 不到，误判失败）
11. **新图纸 sort=-10**——排 223 张末尾用户找不到（已验证两次）
12. **列表接口不带像素数据**——cells/hexes 太大超 1MB 返回上限，别往 listDrafts 加

---

## 脚本 A：convert_pattern.py

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MARD 拼豆图纸截图 -> cells 数据 一体化流水线

用法:
  python3 convert_pattern.py --image xbb.png --legend legend.json --out ./out
  python3 convert_pattern.py --image xbb.png --legend legend.json --out ./out \
      --grid "28,621,19.28,19.28,50,50" --assign '{"G4":"G8"}'

输入:
  --image     图纸截图（小红书带水印的截图也可以）
  --legend    图例 JSON: {"色号": ["#十六进制", 图例标注数量], ...}
              数量必须逐个读准（最终校验全靠它）
  --out       输出目录
  --grid      可选，手动指定 "X0,Y0,CW,CH[,n_cols,n_rows]"
              （X0/Y0 = 第 1 列/行格区左缘/上缘，CW/CH = 格距）
  --assign    可选，{"旧色号":"新色号"} 把某色号整批改判
  --ctr-thr   可选，有豆判定阈值（格中心区暗像素占比），默认 0.01

输出:
  final_pattern.json  {name,w,h,palette,counts,total,cells}
  recon.png / compare.png / cluster_table.txt

流程: 网格标定(编号带法 / 网格线周期法) -> 中心区判有豆 -> 逐格众数取色
      -> 逐豆最近图例色初配 -> 容量约束修正 -> 与图例计数校验 -> 输出

================================================================================
v2 变更说明（对照 v1，均为实测结论）
================================================================================
[1] 有豆判定彻底换掉（v1 的方向性错误）
    v1: 空格判据 = nw = (mx<195).mean() < 0.04（"非网格线色像素占比"）
    实测后果（本图 50x50）：
      * 白豆 H2 本身是白的 -> nw≈0 -> 被判成空格
      * 空格被网格线抗锯齿蹭出 nw>=0.04 -> 被判成有豆，
        最近色一匹配全部落到 H2 上
      * 得 H2=843 颗（图例应为 102），而容量修正救不回来
        （因为同时有 743 个假豆在池子里，总量 1610 ≠ 867）
    v2: 有豆判据 = 格中心区(28%~72%)是否存在暗像素 (mx<150)
    依据：图纸**每格都印了色号文字**（H2 / A13 / G8 ...）。
      文字在格中心、网格线在格边缘，两者天然分离。
      有色豆 -> 中心区有文字 -> 有暗像素
      空格   -> 中心区纯背景   -> 零暗像素
    实测：中心区零暗像素的格恰好 1633 = 2500 - 867（图例总数），
      一次判定即完全正确；17 个色号首次最近色即全部对上，容量修正未启动。

[2] 删除整个水印剔除模块（v1 的 remove_watermark / _watermark_box）
    新判据下，水印根本不进候选集：实测水印在格中心区贡献 <0.5% 暗像素
    （中心区零暗像素的 1633 格一个不差）。少了这一步，也就少了 v1 那样
    「误删 615 格（含真豆）」的风险。

[3] 取色改为「方格去边 -> 量化众数 -> 同色邻域中值」
    v1 的 cell_color 走「深色/亮色双分支」，文字占比高时会跳变。

[4] 标定新增「网格线周期法」兜底（编号带法失败时自动启用）
    编号带法依赖「黑字编号」，但图纸样式不统一：
      本图列号带是**橙底白字**，黑字判据一个数字都测不到 -> 标定直接失败。
    周期法：非纯白掩码的列/行投影做自相关 -> 主周期即 CW/CH
      （实测 lag=19/38/57/77 全为峰，周期 19.28 = CW）；
      再用粗网格线峰位定相位（网格线必落在格边界上，相位取众数即可）。

[5] 新增自检：豆格数 vs 图例总数
    不等时打印诊断与建议，而不是静默输出错数据。
"""
import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image


# ---------------------------------------------------------------- 1. 网格标定

def _runs(mask):
    """布尔数组 -> [(start, end)] 连续 True 段"""
    out, s = [], None
    for i, v in enumerate(mask):
        if v and s is None:
            s = i
        elif not v and s is not None:
            out.append((s, i - 1))
            s = None
    if s is not None:
        out.append((s, len(mask) - 1))
    return out


def _longest_chain(centers, lo=12.0, hi=40.0):
    """候选中心 -> (最长连续等差链, 间距)。用于从编号数字簇里剔除非编号噪点。"""
    cs = sorted(float(c) for c in centers)
    if len(cs) < 5:
        return None
    diffs = [b - a for a, b in zip(cs, cs[1:]) if lo <= b - a <= hi]
    if not diffs:
        return None
    s0 = float(np.median(diffs))
    best = None
    for i in range(len(cs)):
        chain = [cs[i]]
        cur = cs[i]
        while True:
            nxt = cur + s0
            cands = [c for c in cs if abs(c - nxt) <= s0 * 0.3]
            if not cands:
                break
            cur = min(cands, key=lambda c: abs(c - nxt))
            if cur <= chain[-1]:
                break
            chain.append(cur)
        if best is None or len(chain) > len(best):
            best = chain
    return best, s0


def _merge_near(centers, gap):
    """合并间距 < gap 的相邻中心。
    两位编号数字会被拆成两簇（如 '16' 的 '1''6' 间距约半格），不合并会断链。"""
    cs = sorted(float(c) for c in centers)
    if not cs:
        return cs
    out = [cs[0]]
    for c in cs[1:]:
        if c - out[-1] < gap:
            out[-1] = (out[-1] + c) / 2
        else:
            out.append(c)
    return out


def _line_peaks(proj, thr):
    """1D 投影 -> [(峰位, 峰值)]，相邻 <=3px 合并取最高。"""
    out = []
    for i in np.where(proj >= thr)[0]:
        i = int(i)
        if out and i - out[-1][1] <= 3:
            s, e, m = out[-1]
            if proj[i] > m:
                out[-1] = (s, i, float(proj[i]))
        else:
            out.append((i, i, float(proj[i])))
    return [((s + e) // 2, m) for s, e, m in out]


def _isolated_lines(hot, merge_gap=12, max_band=36):
    """布尔"该行/列很暗" -> 细线中心列表。

    先按 merge_gap 粗合并成带，再丢掉厚度 > max_band 的带。
    这一步是「周期法」能成立的关键：标题块（连续 550 行）和底部色卡块
    （每 4px 一条暗行）都会被合并成厚带后丢弃，只留网格线。
    """
    bands = []
    for s, e in _runs(hot):
        if bands and s - bands[-1][1] <= merge_gap:
            bands[-1] = (bands[-1][0], e)
        else:
            bands.append((s, e))
    return [(s + e) // 2 for s, e in bands if e - s + 1 <= max_band]


def _mainline(vals, pitch, tol=0.15):
    """从候选位置里取「最长等距主线」。网格线必落在格边界上且间距是格距整数倍。"""
    vals = sorted(float(v) for v in vals)
    if len(vals) < 3:
        return None
    best = None
    for i in range(len(vals)):
        ch = [vals[i]]
        for v in vals[i + 1:]:
            k = max(1, int(round((v - ch[-1]) / pitch)))
            if abs((v - ch[-1]) - k * pitch) <= tol * pitch * k:
                ch.append(v)
        if best is None or (ch[-1] - ch[0]) > (best[-1] - best[0]):
            best = ch
    return best if best is not None and len(best) >= 3 else None


def _pitch_autocorr(proj, lo=8, hi=64):
    """1D 投影 -> 主周期。自相关首个显著峰 = 细网格线间距（= 格距）。"""
    p = np.asarray(proj, dtype=float)
    p = p - p.mean()
    if not np.any(p):
        return None
    ac = np.correlate(p, p, mode='full')[len(p) - 1:]
    if ac[0] <= 0:
        return None
    ac = ac / ac[0]
    hi = min(hi, len(ac) - 2)
    if hi <= lo:
        return None
    seg = ac[lo:hi]
    k = int(seg.argmax()) + lo
    if ac[k] < 0.25:
        return None
    y0, y1, y2 = ac[k - 1], ac[k], ac[k + 1]        # 抛物线插值细化亚像素
    den = y0 - 2 * y1 + y2
    if den != 0:
        k = k + 0.5 * (y0 - y2) / den
    return float(k)


def _phase_from_peaks(peaks, pitch):
    """峰位 -> 相位（峰位对 pitch 取模后的众数）。
    网格线必然落在格边界上，所以即便个别峰是噪声，相位众数依然可靠。"""
    if not peaks:
        return None
    ph = np.sort(np.array([p % pitch for p in peaks], dtype=float))
    if ph.size == 1:
        return float(ph[0])
    best_i, best_n = 0, -1
    for i in range(ph.size):
        n = int(((ph >= ph[i] - 1.5) & (ph <= ph[i] + 1.5)).sum())
        if n > best_n:
            best_n, best_i = n, i
    sel = ph[(ph >= ph[best_i] - 1.5) & (ph <= ph[best_i] + 1.5)]
    return float(np.median(sel))


def _detect_row_num_col(a, X0, Y0, CW, CH, n_rows, n_cols):
    """最后一列若整列是浅蓝底（行号列），该列非数据。返回 (row_num_col, n_cols)。"""
    if n_cols < 3:
        return None, n_cols
    H, W, _ = a.shape
    last_x = int(X0 + (n_cols - 1) * CW)
    cw_i = int(CW)
    hits = total = 0
    for i in range(n_rows):
        y = int(Y0 + (i + 0.5) * CH)
        x = last_x + cw_i // 2
        if 0 <= y < H and 0 <= x < W - 1:
            total += 1
            r_, g_, b_ = a[y, x]
            if 215 <= r_ <= 245 and 225 <= g_ <= 252 and 235 <= b_ <= 255 and b_ >= r_ + 8:
                hits += 1
    if total and hits / total >= 0.6:
        return n_cols, n_cols - 1
    return None, n_cols


# ---- 标定法 A：编号带链式拟合（依赖"黑字编号"，样式合适时最稳） -------------

def _band_segments(dark, W):
    """编号带候选段：行暗计数高峰 且 暗像素横向跨度接近全宽。"""
    xs, xe = int(W * 0.05), int(W * 0.95)
    rowcnt = dark[:, xs:xe].sum(axis=1)
    thr = max(60.0, W * 0.06)
    out = []
    for s, e in _runs(rowcnt >= thr):
        if e - s < 3:
            continue
        cols = np.where(dark[s:e + 1].sum(axis=0) > 0)[0]
        if cols.size and cols[-1] - cols[0] >= W * 0.5:
            out.append((s, e))
    return out


def _analyze_band(dark, y_lo, y_hi, W):
    """分析候选段，返回 (kind, chain, spacing, span)。"""
    cnt = dark[y_lo:y_hi + 1].sum(axis=0)
    cl, solid = [], False
    for s, e in _runs(cnt >= 1):        # 细笔画数字列计数可能只有 1，阈值必须为 1
        if e - s < 2:
            continue
        if e - s >= W * 0.3:            # 超宽簇 -> 实心暗块
            solid = True
            continue
        cl.append(((s + e) / 2, s, e))
    if solid:
        return ('solid', None, None, 0)
    if len(cl) < 15:
        return ('none', None, None, 0)
    cs = sorted(c[0] for c in cl)
    d = np.diff(cs)
    d = d[(d > 6) & (d <= 40)]
    if d.size == 0:
        return ('none', None, None, 0)
    s0 = float(d.max())
    merged = _merge_near(cs, s0 * 0.55)
    r = _longest_chain(merged, lo=max(10.0, s0 * 0.6), hi=s0 * 1.6)
    if not r:
        return ('none', None, None, 0)
    chain, sp = r
    span = chain[-1] - chain[0]
    if len(chain) >= 15 and span >= W * 0.7 and (y_hi - y_lo) < 1.2 * sp:
        return ('band', chain, sp, span)
    return ('none', chain, sp, span)


def _row_clusters(dark, x0, x1):
    cnt = dark[:, x0:x1].sum(axis=1)
    out = []
    for s, e in _runs(cnt >= 2):
        if e - s < 3:
            continue
        colsum = dark[s:e + 1, x0:x1].sum(axis=0).astype(float)
        tot = float(colsum.sum())
        cx = float((np.arange(x0, x1) * colsum).sum() / tot) if tot else (x0 + x1) / 2
        out.append(((s + e) / 2, int(cnt[s:e + 1].sum()), s, e, cx))
    return out


def _filter_x_center(clusters, span=8.0, tol=8.0):
    if len(clusters) < 8:
        return clusters
    cxs = sorted(c[4] for c in clusters)
    best = []
    for st in cxs:
        grp = [c for c in cxs if st <= c <= st + span]
        if len(grp) > len(best):
            best = grp
    if not best or len(best) * 2 < len(clusters):
        return clusters
    lo, hi = min(best), max(best)
    return [c for c in clusters if lo - tol <= c[4] <= hi + tol]


def calibrate_by_bands(a, verbose=True):
    """标定法 A：编号数字链式拟合。失败返回 None（不再 SystemExit）。
    注意：本方法依赖编号数字是**深色字**。若图纸编号带是浅底/彩底白字
    （如橙底白字），本方法必然失败 —— 由 calibrate_by_period 兜底。"""
    H, W, _ = a.shape
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    dark = (mx < 170) & ((mx - mn) < 40)

    col_bands, junk = [], []
    for s, e in sorted(_band_segments(dark, W)):
        kind, chain, sp, span = _analyze_band(dark, s, e, W)
        if kind == 'band':
            col_bands.append((s, e, chain, sp))
            if verbose:
                print('[标定A] 列号带 y%d-%d -> %d 个编号, CW=%.2f, 跨度%.0f' %
                      (s, e, len(chain), sp, span))
        elif kind == 'solid':
            junk.append((s, e))
    if not col_bands:
        return None
    top = min(col_bands, key=lambda t: t[0])
    bot = None
    for t in col_bands:
        if t[0] > top[1] + 20 and (bot is None or t[1] > bot[1]):
            bot = t
    chain0 = top[2]
    CW = (chain0[-1] - chain0[0]) / (len(chain0) - 1)
    X0 = chain0[0] - CW / 2
    n_cols = len(chain0)
    top_center = (top[0] + top[1]) / 2

    CH = CW
    Y0 = top_center + CW / 2
    n_rows = None
    band_ys = [(t[0], t[1]) for t in col_bands]
    for xa, xb in ((0, int(W * 0.04)), (int(W * 0.96), W),
                   (0, int(W * 0.06)), (int(W * 0.94), W)):
        cl = _row_clusters(dark, xa, xb)
        cl = _filter_x_center(cl)
        cl = [c for c in cl if not any(lo - 4 <= c[0] <= hi + 4 for lo, hi in band_ys)]
        cl = [c for c in cl if not any(lo - 4 <= c[0] <= hi + 4 for lo, hi in junk)]
        if len(cl) < 10:
            continue
        r = _longest_chain([c[0] for c in cl], lo=max(10.0, CW * 0.6), hi=CW * 1.6)
        if r and len(r[0]) >= 10:
            rc = r[0]
            CH = (rc[-1] - rc[0]) / (len(rc) - 1)
            Y0 = rc[0] - CH / 2
            n_rows = len(rc)
            break
    if n_rows is None and bot is not None:
        n_rows = round(((bot[0] + bot[1]) / 2 - top_center) / CW) - 1
    if n_rows is None:
        return None

    row_num_col, n_cols = _detect_row_num_col(a, X0, Y0, CW, CH, n_rows, n_cols)
    if row_num_col and verbose:
        print('[标定A] 第 %d 列是行号列(非数据), 数据列=1..%d' % (row_num_col, n_cols))
    return X0, Y0, CW, CH, n_cols, n_rows


# ---- 标定法 B：网格线周期（不依赖编号带颜色）-------------------------------

def calibrate_by_period(a, verbose=True):
    """标定法 B：网格线周期（不依赖编号带颜色）。

    为什么需要它：编号带法依赖"编号是深色字"。本图列号带是**橙底白字**，
    黑字判据一个数字都测不到 -> 标定直接失败。
    实测本图（50x50）用本方法一步到位，无需手工 --grid。

    步骤：
      1. 细网格线周期：非纯白掩码(mx<245)的列/行投影做自相关
         实测 lag=19/38/57/77 全为峰 -> CW=19.22（真值 19.28）
      2. 行边界：满幅宽的暗行（>=0.5W）经 _isolated_lines 去掉标题/色卡厚带
         -> 11 条粗横线 621..1584
      3. 行距用**首尾粗线反推**（(1584-621)/50=19.26），比自相关更准
         （自相关有 0.3% 误差，跨 50 格会累积到 4px）
      4. 列边界：把列投影限定在已求出的行范围内再找粗竖线
         （粗竖线只跨网格高度，全图投影会被标题/色卡淹没）
    """
    H, W, _ = a.shape
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    dark = (mx < 150) & ((mx - mn) < 45)
    nw = mx < 245

    # ---- 1. 行边界 ----
    CH0 = _pitch_autocorr(nw.sum(axis=1).astype(float))
    CW0 = _pitch_autocorr(nw.sum(axis=0).astype(float))
    if not CH0 or not CW0:
        return None
    hlines = _isolated_lines(dark.sum(axis=1) >= 0.5 * W)
    cy = _mainline(hlines, CH0)
    if cy is None:
        return None
    Y0 = cy[0]
    n_rows = int(round((cy[-1] - cy[0]) / CH0))
    if n_rows < 5:
        return None
    CH = (cy[-1] - cy[0]) / n_rows

    # ---- 2. 列边界（限定在行范围内）----
    y0i, y1i = int(round(Y0)) + 3, int(round(Y0 + n_rows * CH)) - 3
    sub = dark[max(y0i, 0):max(y1i, 1), :]
    cs = sub.sum(axis=0).astype(float)
    if cs.max() <= 0:
        return None
    vlines = _isolated_lines(cs >= 0.75 * cs.max())
    cx = _mainline(vlines, CW0)
    if cx is None:
        return None
    X0 = cx[0]
    n_cols = int(round((cx[-1] - cx[0]) / CW0))
    if n_cols < 5:
        return None
    CW = (cx[-1] - cx[0]) / n_cols

    if verbose:
        print('[标定B] 自相关周期 CW0=%.2f CH0=%.2f' % (CW0, CH0))
        print('[标定B] 粗线定界 x%.0f-%.0f y%.0f-%.0f -> %d列 x %d行, X0=%.1f Y0=%.1f'
              % (cx[0], cx[-1], cy[0], cy[-1], n_cols, n_rows, X0, Y0))

    row_num_col, n_cols = _detect_row_num_col(a, X0, Y0, CW, CH, n_rows, n_cols)
    return X0, Y0, CW, CH, n_cols, n_rows


def calibrate(a, verbose=True):
    """先试编号带法，失败再试网格线周期法。"""
    r = calibrate_by_bands(a, verbose=verbose)
    if r is not None:
        return r
    if verbose:
        print('[标定] 编号带法失败（编号带可能非深色字），改用网格线周期法')
    r = calibrate_by_period(a, verbose=verbose)
    if r is not None:
        return r
    raise SystemExit('标定失败: 两种方法均未成功, 请用 --grid "X0,Y0,CW,CH,n_cols,n_rows" 手动指定')


# ---------------------------------------------------------------- 2. 取色

def hex2rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)])


def cell_patch_of(a, X0, Y0, CW, CH, r, c, pad=2):
    """第 r 行 c 列格区（1-based），四周各裁 pad 像素避开网格线。"""
    xl = X0 + (c - 1) * CW
    yt = Y0 + (r - 1) * CH
    x0, x1 = int(round(xl)) + pad, int(round(xl + CW)) - pad
    y0, y1 = int(round(yt)) + pad, int(round(yt + CH)) - pad
    return a[max(y0, 0):y1, max(x0, 0):x1]


def bead_color(patch):
    """格内主色：量化众数 -> 同色邻域中值。
    不用 v1 的「深色/亮色双分支」：文字占比高时分支会跳变。"""
    p = patch.reshape(-1, 3)
    if p.size == 0:
        return np.zeros(3)
    q = (p // 4 * 4)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    mode = keys[counts.argmax()].astype(float) + 2.0
    d = np.linalg.norm(p - mode, axis=1)
    sel = p[d < 30.0]
    if sel.shape[0] < 5:
        sel = p
    return np.median(sel, axis=0)


def extract(a, X0, Y0, CW, CH, n_rows, n_cols, ctr_thr=0.01, verbose=True):
    """全格扫描 -> cells{(r,c): dict}，r/c 均为 1-based。

    有豆判定 = 格中心区(28%~72%)暗像素占比 >= ctr_thr。
    见文件头 [1]：图纸每格都印色号文字，文字在格中心、网格线在格边缘。
    """
    cells = {}
    n_empty = 0
    for r in range(1, n_rows + 1):
        for c in range(1, n_cols + 1):
            patch = cell_patch_of(a, X0, Y0, CW, CH, r, c)
            ph, pw = patch.shape[:2]
            if ph < 4 or pw < 4:
                n_empty += 1
                continue
            y0, y1 = int(ph * 0.28), max(int(ph * 0.72), int(ph * 0.28) + 1)
            x0, x1 = int(pw * 0.28), max(int(pw * 0.72), int(pw * 0.28) + 1)
            frac = float((patch[y0:y1, x0:x1].max(axis=2) < 150).mean())
            if frac < ctr_thr:
                n_empty += 1
                continue
            cells[(r, c)] = dict(color=[float(v) for v in bead_color(patch)], ctr=frac)
    if verbose:
        print('[提取] 有豆格 %d / %d（空格 %d）' % (len(cells), n_rows * n_cols, n_empty))
    return cells


# ---------------------------------------------------------------- 3. 颜色分配

def assign_codes(cells, legend, verbose=True):
    """逐豆最近图例色初配 -> 容量约束修正（粒度 = 1 颗豆）。

    为什么不用「K-means 聚簇后整块挪簇」：稀有色会被邻近大簇吃掉，
    补缺口时又会拿大簇去补小缺口。逐豆「换成目标色代价最小」的贪心更稳。

    正常情况（判据正确）下首次最近色即全部对上，本步不产生任何修改；
    保留它是为了在个别色号取色偏移时自动兜底。
    """
    keys = list(cells.keys())
    if not keys:
        return {}, []
    X = np.array([cells[k]['color'] for k in keys], dtype=float)
    codes = list(legend)
    L = np.array([hex2rgb(legend[k][0]) for k in codes], dtype=float)
    D = np.linalg.norm(X[:, None, :] - L[None, :, :], axis=2)
    target = np.array([legend[c][1] for c in codes], dtype=int)
    C = len(codes)
    assign = D.argmin(axis=1).astype(int)
    n0 = _match_all(assign, target, codes)

    for _ in range(20000):
        cnt = np.bincount(assign, minlength=C)
        deficit = target - cnt
        if deficit.max() <= 0:
            break
        need = int(deficit.argmax())
        sur = cnt - target
        sur[deficit > 0] = -1
        if sur.max() <= 0:
            break
        give = int(sur.argmax())
        cand = np.where(assign == give)[0]
        if cand.size == 0:
            break
        cost = D[cand, need] - D[cand, give]
        assign[cand[int(cost.argmin())]] = need

    if verbose:
        n1 = _match_all(assign, target, codes)
        print('[分配] 逐豆最近色 + 容量修正, %d 色（首次命中 %d/%d，修正后 %d/%d）'
              % (C, n0, C, n1, C))

    table = []
    for i, code in enumerate(codes):
        sel = assign == i
        if sel.any():
            table.append((i, int(sel.sum()), X[sel].mean(axis=0), code,
                          float(D[sel, i].mean())))
    table.sort(key=lambda t: -t[1])
    code_of = {keys[i]: codes[int(assign[i])] for i in range(len(keys))}
    return code_of, table


def _match_all(assign, target, codes):
    cnt = np.bincount(assign, minlength=len(codes))
    return sum(1 for i in range(len(codes)) if cnt[i] == target[i])


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--image', required=True)
    ap.add_argument('--legend', required=True, help='图例 JSON: {"色号":["#hex",数量]}')
    ap.add_argument('--out', required=True)
    ap.add_argument('--grid', default=None, help='手动 "X0,Y0,CW,CH[,n_cols,n_rows]"')
    ap.add_argument('--assign', default=None, help='手动 {"旧色号":"新色号"} 整批改判')
    ap.add_argument('--ctr-thr', type=float, default=0.01,
                    help='有豆判定阈值（格中心区暗像素占比），默认 0.01')
    ap.add_argument('--name', default=None)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    a = np.asarray(Image.open(args.image).convert('RGB')).astype(int)
    H, W, _ = a.shape
    print('[读图] %s %dx%d' % (args.image, W, H))

    legend = json.loads(Path(args.legend).read_text(encoding='utf-8'))
    legend_total = sum(v[1] for v in legend.values())
    print('[图例] %d 色, 标注总数 %d' % (len(legend), legend_total))

    if args.grid:
        parts = [float(x) for x in args.grid.split(',')]
        X0, Y0, CW, CH = parts[:4]
        n_cols = int(parts[4]) if len(parts) > 4 else 50
        n_rows = int(parts[5]) if len(parts) > 5 else 50
        print('[标定] 手动指定 X0=%.1f Y0=%.1f CW=%.2f CH=%.2f 数据区 %dx%d' %
              (X0, Y0, CW, CH, n_cols, n_rows))
    else:
        X0, Y0, CW, CH, n_cols, n_rows = calibrate(a)

    if abs(CW - CH) > 1.2:
        print('[标定] !! CW=%.2f 与 CH=%.2f 不一致, 建议人工核对' % (CW, CH))
    print('[标定] 采用 X0=%.1f Y0=%.1f CW=%.2f CH=%.2f 数据区 %d列 x %d行' %
          (X0, Y0, CW, CH, n_cols, n_rows))

    cells = extract(a, X0, Y0, CW, CH, n_rows, n_cols, ctr_thr=args.ctr_thr)

    # ---- 自检：豆格数 vs 图例总数 ----
    if len(cells) != legend_total:
        print('\n!! 自检不符: 有豆格 %d, 图例总数 %d, 差 %+d' %
              (len(cells), legend_total, len(cells) - legend_total))
        print('   排查方向:')
        print('     1) 网格是否偏移半格 -> 看下方 compare.png，图案是否整体串位')
        print('     2) 阈值是否合适 -> 调 --ctr-thr（当前 %.3f）' % args.ctr_thr)
        print('     3) 图例数量读错 -> 重读图例')
        print('     4) 网格行列数不对 -> --grid 手动指定')

    code_of, table = assign_codes(cells, legend)
    if args.assign:
        ov = json.loads(args.assign)
        n_ov = 0
        for k in list(code_of):
            if code_of[k] in ov:
                code_of[k] = ov[code_of[k]]
                n_ov += 1
        print('[分配] 手动覆盖 %d 颗豆' % n_ov)

    with open(out / 'cluster_table.txt', 'w') as f:
        for i, n, avg, code, d in table:
            f.write('%-4s n=%4d avg=(%3d,%3d,%3d) 平均距离=%.1f\n' %
                    (code, n, avg[0], avg[1], avg[2], d))

    cnt = Counter(code_of.values())

    ok = True
    print('\n=== 计数 vs 图例 ===')
    for code in sorted(legend, key=lambda k: -legend[k][1]):
        n = legend[code][1]
        got = cnt.get(code, 0)
        if got != n:
            ok = False
        print('  %-4s legend=%4d got=%4d %s' % (code, n, got, 'OK' if got == n else 'XX'))
    total = sum(cnt.values())
    print('  TOTAL got=%d legend=%d  %s' % (total, legend_total,
                                            'ALL MATCH' if ok else 'MISMATCH'))
    if not ok:
        print('!! 计数不齐, 查看 cluster_table.txt 用 --assign 手动修正个别簇')

    grid = [[None] * n_cols for _ in range(n_rows)]
    for (r, c), code in code_of.items():
        if 1 <= r <= n_rows and 1 <= c <= n_cols:
            grid[r - 1][c - 1] = code
    result = {
        'name': args.name or Path(args.image).stem,
        'w': n_cols, 'h': n_rows,
        'palette': {k: legend[k][0] for k in legend},
        'counts': {k: legend[k][1] for k in legend},
        'total': legend_total,
        'cells': grid,
    }
    (out / 'final_pattern.json').write_text(
        json.dumps(result, ensure_ascii=False), encoding='utf-8')

    S = 14
    g = np.full((n_rows * S, n_cols * S, 3), 255, dtype=np.uint8)
    for r in range(n_rows):
        for c in range(n_cols):
            code = grid[r][c]
            if code:
                g[r * S:(r + 1) * S, c * S:(c + 1) * S] = hex2rgb(legend[code][0])
    Image.fromarray(g).resize((n_cols * S * 2, n_rows * S * 2), Image.NEAREST).save(out / 'recon.png')

    ox, oy = int(X0), int(Y0)
    oc = a[oy:oy + int(n_rows * CH), ox:ox + int(n_cols * CW)].astype('uint8')
    oc = np.asarray(Image.fromarray(oc).resize((n_cols * S, n_rows * S), Image.NEAREST))
    combo = np.full((n_rows * S, n_cols * S * 2 + 16, 3), 220, dtype=np.uint8)
    combo[:, :n_cols * S] = oc
    combo[:, n_cols * S + 16:] = np.asarray(
        Image.open(out / 'recon.png').resize((n_cols * S, n_rows * S)))
    Image.fromarray(combo).save(out / 'compare.png')
    print('\n输出: %s/final_pattern.json, recon.png, compare.png' % out)


if __name__ == '__main__':
    main()
```

---

## 脚本 B：make_draft_entry.py

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""final_pattern.json -> 悠米拼豆图纸库条目(drafts.json) + 豆子风格缩略图

用法:
  python3 make_draft_entry.py --pattern ./out/final_pattern.json \
      --key pp-pajama-baby-nightcap --name "睡衣宝宝·星星睡帽" \
      --drafts /workspace/pd/cf/template-api/drafts.json \
      --thumb-dir /workspace/pd/cf/template-api/drafts-images/drafts-images

要点:
  - palette 按豆数降序; cells 编成 w*h 长字符串, base36('0123456789abcdefghijklmnopqrstuvwxyz')
    索引对应 palette, '.' = 空格（小程序解析器 pages/detail/detail.js 同规则）
  - 缩略图 364px 级, 空格不画豆, 背景米色; 存到 thumb-dir/<key>.png
  - 新图纸 sort 默认 -10（排到图纸库第一张）。血泪教训: 排在 223 张末尾的
    新图纸用户根本找不到, 别用 max+1。
"""
import argparse
import json
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw

CH = '0123456789abcdefghijklmnopqrstuvwxyz'
BG = (245, 243, 239)


def hex2rgb(x):
    x = x.lstrip('#')
    return (int(x[0:2], 16), int(x[2:4], 16), int(x[4:6], 16))


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pattern', required=True, help='convert_pattern.py 产出的 final_pattern.json')
    ap.add_argument('--key', required=True, help='图纸 key, 如 pp-pajama-baby-nightcap')
    ap.add_argument('--name', required=True, help='图纸显示名')
    ap.add_argument('--drafts', required=True, help='drafts.json 路径')
    ap.add_argument('--thumb-dir', required=True, help='缩略图目录')
    ap.add_argument('--sort', type=int, default=-10, help='排序值, 默认 -10 = 图纸库第一张')
    ap.add_argument('--tag', default='pixel-pattern')
    ap.add_argument('--brand', default='mard')
    args = ap.parse_args()

    data = json.loads(Path(args.pattern).read_text(encoding='utf-8'))
    cells = data['cells']        # h x w, None = 空格
    h = len(cells)
    w = len(cells[0]) if h else 0
    hexes_map = data['palette']  # {code: '#hex'}

    cnt = Counter()
    for row in cells:
        for v in row:
            if v:
                cnt[v] += 1
    total = sum(cnt.values())
    print('尺寸 %dx%d | 豆数 %d | 色号 %d' % (w, h, total, len(cnt)))

    order = [c for c, _ in cnt.most_common()]
    palette, hexes, counts = [], [], []
    index_of = {}
    for i, code in enumerate(order):
        index_of[code] = i
        palette.append(code)
        hexes.append(hexes_map[code])
        counts.append(cnt[code])

    buf = []
    for r in range(h):
        for c in range(w):
            v = cells[r][c]
            buf.append('.' if not v else CH[index_of[v]])
    cells_str = ''.join(buf)
    assert len(cells_str) == w * h, (len(cells_str), w * h)

    entry = {
        'key': args.key,
        'name': args.name,
        'tags': [args.tag],
        'w': w, 'h': h,
        'beadCount': int(total),
        'palette': palette,
        'hexes': hexes,
        'counts': counts,
        'cells': cells_str,
        'brand': args.brand,
        'sort': args.sort,
    }

    # 缩略图: 双层椭圆模拟拼豆(外圈暗 0.72, 内圈本色, 中心留白孔)
    S = 7
    canvas = Image.new('RGB', (w * S, h * S), BG)
    d = ImageDraw.Draw(canvas)
    for r in range(h):
        for c in range(w):
            v = cells[r][c]
            if not v:
                continue
            col = hex2rgb(hexes_map[v])
            x0, y0 = c * S, r * S
            pad = max(0, int(S * 0.06))
            d.ellipse([x0 + pad, y0 + pad, x0 + S - 1 - pad, y0 + S - 1 - pad], fill=shade(col, 0.72))
            p2 = max(1, int(S * 0.14))
            d.ellipse([x0 + p2, y0 + p2, x0 + S - 1 - p2, y0 + S - 1 - p2], fill=col)
            if S >= 7:
                p3 = int(S * 0.34)
                d.ellipse([x0 + p3, y0 + p3, x0 + S - 1 - p3, y0 + S - 1 - p3], fill=BG)

    thumb_dir = Path(args.thumb_dir)
    thumb_dir.mkdir(parents=True, exist_ok=True)
    thumb_path = thumb_dir / (args.key + '.png')
    canvas.save(thumb_path)
    print('缩略图:', thumb_path, canvas.size)

    # 追加 drafts.json(按 key 去重, 保留原格式 indent=2)
    drafts_path = Path(args.drafts)
    drafts = json.loads(drafts_path.read_text(encoding='utf-8'))
    drafts = [x for x in drafts if x.get('key') != args.key]
    drafts.append(entry)
    drafts_path.write_text(json.dumps(drafts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('drafts.json 共 %d 条 -> %s' % (len(drafts), drafts_path))
    print('palette:', palette)
    print('counts :', counts)


if __name__ == '__main__':
    main()
```

---

## 附录 A：MARD 图纸转换实战笔记（蜡笔没了小新案例）

### A1. 图纸截图结构（小红书 MARD 图纸通用）

- 本案例 **52 列 × 52 行**（1023×2224 px）。**列数/行数一律以编号带数字个数为准**，  
  不能"看图数格子"——本案例曾把列号"1"（x25-32）误认成噪点，得出"51 列"的错误结论。  
  自洽校验：`左边距 + 列数×CW + 右边距 = 图宽`（19 + 52×18.93 + 19 ≈ 1023 ✓）
- 列号在**顶部带**（y496-509）和**底部带**（y1502-1511），数字中心 = 各列格心
- 行号在**左侧**（x0-19）**和右侧**（x1004-1023），两条网格外的列
- 网格线只有两种色：浅灰 `(235,235,235)` 和淡蓝 `(210,219,250)`
- 图例在右侧/右下，通常 3 行，每格一个色块 + 色号 + 数量

### A2. 网格标定（最容易翻车的一步）

xbb.png 的**正确**参数：

```
X0=19.0  Y0=511.5  CW=18.93  CH=18.95   n_cols=52  n_rows=52
```

**X0/Y0 是第 1 列/第 1 行格区的左缘/上缘**，格心 = X0 + CW/2。  
编号数字的簇中心 = 格心，所以 `X0 = 数字中心 - CW/2`。

**踩过的坑**：

| 错误做法             | 后果                                                        |
| ---------------- | --------------------------------------------------------- |
| 用网格线投票找边界        | D17 与淡蓝网格线同色 → 整列形成 15-19px 宽平台（真线 1-3px）；重采样致格线漂移 → 彻底失效 |
| 暗度判据加 `sat>25`   | 行号/列号是**黑字**（sat≈0）→ 一个都测不到，误抓标题文字                        |
| 只按"最长等差链"认编号带    | **网格里的深色豆行也是等距链**（豆按网格排列，x 天然等差）→ 被误认成编号带，标定彻底跑偏          |
| 行号条带 x 范围 ≥0.04W | G8 深棕 (#753B32) 与行号数字合并 → 必须 <0.03W（网格左缘 19 = 0.019W）     |
| 把列号"1"当噪点剔掉      | 得出"51 列"的错误结论 → 全图偏移半格                                    |
| 用列投影簇的"间距中位数"估格宽 | 细笔画数字会被切成多个碎片（间距 4-8px），中位数算出 11.5 而非 19 → 断链             |

**现在的做法（编号数字链式拟合，已验证）**：

1. 全图扫"编号带候选"：行暗计数 ≥ max(60, 0.06W) 且暗像素横向跨度 ≥ 0.5W  
   （标题/图例实心暗块也会入选，靠第 3 步排除）
2. 候选段内列投影 → 簇（阈值必须 `cnt≥1`：细笔画数字的列计数可能只有 1）  
   → **用最大间距估格宽**（碎片间距小、真实编号间距最大）→ 合并碎片 → 最长等差链
3. 判定编号带三条件：链长 ≥15 **且** 跨度 ≥0.7W **且** 段高 <1.2 格  
   —— 深色豆行跨度只有 0.45-0.5W，标题/图例是实心块（段高数百 px），全被排除
4. 顶部带 = y 最小者，底部带 = y 最大者；  
   `CW = (链尾 - 链首) / (链长 - 1)`（比单间距中位数准：18.93 vs 19.00）
5. `X0 = 链首 - CW/2`，`n_cols = 链长`
6. 行号列（左优先、右回退）：簇 → **x 质心聚集净化**（真实行号质心都 ≈9，  
   标题/图例文字 ≥23）→ 再剔「编号带 y 范围内」与「实心暗块邻近」的簇 → 等差链  
   → `CH`、`Y0 = 链首 - CH/2`、`n_rows = 链长`
7. 交叉校验：底部列号带推算 `n_rows = round((底带中心-顶带中心)/CW) - 1` 应与行号链长一致

### A3. 取色策略（proven）

```python
def cell_color(p):
    mx = p.max(axis=1); mn = p.min(axis=1); sat = mx - mn
    dark = (mx < 160) & (sat > 25)
    if dark.mean() >= 0.25:              # 深色豆(棕/黑): 深像素中位数
        return np.median(p[dark], axis=0)
    px = p[mx >= 110]                    # 亮色豆: 量化取众数均值
    q = (px // 10 * 10)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    mode = keys[counts.argmax()]
    return px[np.abs(q - mode).sum(axis=1) == 0].mean(axis=0)
```

**绝对不要排除网格线色**：D17 填充色 `(210,219,250)` 与淡蓝网格线**完全相同**，  
排除网格线会把整格 D17 填充抹掉 → 99 格蓝分散进 7 个垃圾簇。

**有豆判定**：`nw = (mx < 195).mean() >= 0.04`。  
两种网格线色 mx 都 >195，天然不影响；浅色豆靠格内黑色色号文字被判豆。

### A4. 水印剔除（黄字黑边）

本案例水印（@蜡笔没了小新，右上角 x586-978 y536-594）：

- 黄字黑边，覆盖行 2-5、列 29-51
- 黑描边是大笔画，**贴在格子边缘**；格内色号文字是**居中的小号字**——这是区分标志

两级剔除：

- A. **黄黑同格**：`yl > 0.03 且 blk > 0.12` → 删（本案例命中 60 格，全部落在行 2-5）
- B. **贴边黑笔画**：`0.04 < blk < 0.35 且 stroke > 0.55` → 删（本案例 19 格）

**三个致命陷阱（都踩过）**：

1. **不能用「黄像素全局包围盒」圈水印区**——图纸本身有大量暖色豆（棕/黄/橙，  
   本图 5 万黄像素散布全图），包围盒会覆盖整幅图 → 误删 531 格
2. **不能用「黄」单条件**（本图会命中 186 格暖色豆）**也不能用「黑」单条件**  
   （343 格深色豆）——必须取交集：**黄黑同格**才是水印
3. **B 级必须设 blk 上限**——满格深色豆的贴边比例也能到 0.61-0.79，  
   不设上限会把 G8 的 212 颗全删光；水印残留格 blk 只有 0.05-0.16。  
   也别用"格中心亮度"判：深色豆有高光中心，一样亮

**教训**：曾把 (6,28) 当水印误删，实际那是帽尖真 G8 豆 → 剔除后必须用图例计数校验兜底。

### A5. 图例读取（计数校验的唯一基准）

图例 3 行，每色数量必须逐个读准。本案例最终图例（22 色，总 1326）：

```
A6(3) A16(12) A17(44) A21(1) C28(11) D11(48) D16(1) D17(166)
E1(44) E15(20) E16(127) F11(1) F14(8) F22(2) G1(27) G8(212)
G14(10) G21(78) H2(408) H19(2) H21(5) H22(96)
```

**E15 曾误读为 28，实际是 20**——图例要放大逐行读，读错会导致后面全错。

### A6. 颜色分配（逐豆，不是按簇）

- **逐豆**按取色匹配最近图例色（不再用 K-means 簇整块挪）
- 容量约束修正：`缺口最大的色 ← 过剩最多的色`，每次挪「换成缺口色代价最小」的**一颗豆**，  
  迭代到每色 count == 图例标注数
- 为什么弃用簇粒度：① 稀有色的簇会被邻色大簇吃掉（H19 只有 2 颗，混进 127 颗的邻簇）；  
  ② 补缺口时会拿大簇补小缺口（把 E16 的 127 颗整簇挪去补 H19 的 2 颗缺口，全盘错位）
- **验收标准：每一色 count == 图例标注数，总数一致**（一颗不差才算完）
- 人工兜底：脚本打印 `cluster_table.txt`（每色豆数 / 均值色 / 平均距离），  
  个别色可用 `--assign '{"旧色号":"新色号"}'` 整批改判

### A7. 输出格式（小程序图纸库）

```json
{
  "key": "pp-xxx", "name": "名称", "tags": ["pixel-pattern"],
  "w": 51, "h": 52, "beadCount": 1326,
  "palette": ["H2","G8",...],       // 按豆数降序
  "hexes": ["#FEFFFF",...],
  "counts": [408,212,...],
  "cells": "2652字符",              // w*h 长字符串, base36 索引对应 palette
  "sort": -10, "brand": "mard"
}
```

- `.` = 空格。图纸只保留图案本体，**周围不铺白豆**
- 小程序解析器 `pages/detail/detail.js`：`CH='0123456789abcdefghijklmnopqrstuvwxyz'`
- 缩略图：豆子风格（外圈暗 0.72 + 内圈本色 + 中心留白孔），空格不画豆

### A8. 验证手段

- 重建渲染图 `recon.png` + 左右对比图 `compare.png`，肉眼核对
- 孤立豆（8 邻域无豆）与空洞（空白但 8 邻域 ≥6 豆）分析，定位可疑格
- 边界格逐个放大核对

---

## 附录 B：悠米拼豆图纸库 · 云函数运维手册

### B1. 架构关键事实

- 小程序「图纸库管理」(`packageMisc/pages/admin-drafts`) 调云函数 `template-api`
- `listDrafts` 读的是**云数据库 `owner_drafts` 集合**，不是 drafts.json
- drafts.json 只是**本地种子数据**，改它不会自动生效，必须走部署+灌库

### B2. 数据流

```
本地 drafts.json + 缩略图
   └─(打进 zip)─> 部署 template-api 云函数
                      └─ seedDrafts(force:true) ─> 云数据库 owner_drafts
                                                  └─ listDrafts ─> 小程序图纸库管理
```

### B3. 操作步骤（新增/更新图纸上线）

```bash
# 0. 准备: 本地 drafts.json 已加条目, 缩略图已生成
#    缩略图路径: cf/template-api/drafts-images/drafts-images/<key>.png

# 1. 更新部署包(替换 zip 内 drafts.json + 缩略图)
#    坑: 只换 drafts.json 不换缩略图 -> 新图纸 img:false,
#        因为缩略图是云函数从自己函数包目录里读的(index.js findDraftImageFile)
cd /workspace/pd/cf
python3 - <<'EOF'
import zipfile, os
src='template-api-root.zip'; tmp='new.zip'
img_dir='template-api/drafts-images'
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED) as zout:
    for it in zin.infolist():
        if it.filename == 'drafts.json':
            zout.write('template-api/drafts.json', 'drafts.json')
        elif it.filename.startswith('drafts-images/'):
            pass                                  # 缩略图整目录重写, 跳过旧的
        else:
            zout.writestr(it, zin.read(it.filename))
    for root, _, fs in os.walk(img_dir):
        for f in fs:
            p = os.path.join(root, f)
            zout.write(p, os.path.relpath(p, 'template-api'))
os.replace(tmp, src)
EOF

# 1b. zip 不存在时(仓库 .gitignore 忽略 *.zip)从源码重建:
#     zip -r -q template-api-root.zip index.js package.json package-lock.json \
#         presets.json drafts.json drafts-images
#     注意根目录必须直接是 index.js / package.json，不能套一层目录

# 2. 部署云函数(deploy_cf.py 内部轮询到 Active)
python3 /root/.codebuddy/artifact/<session>/deploy_cf.py

# 3. 灌库 — 必须 force:true!
#    坑: seedDrafts 有短路逻辑, 库中记录数 >= drafts.length*0.8 时直接跳过,
#    不加 force 新图纸永远进不去
python3 call_cf.py template-api seedDrafts '{"force":true}'
# 成功标志: {"seeded":1,"skipped":222,"failed":[]}

# 4. 验证(不要用无参 verifyDrafts! 它只返回前 100 条, 按 sort 升序,
#    新图纸排在末尾时 grep 不到, 会误判失败)
python3 call_cf.py template-api verifyDrafts '{"keys":["pp-xxx"]}'
# 成功标志: count:1, list:[{...img:true, deleted:false}]
```

### B4. 修改已入库图纸的字段（如 sort）

```bash
# 改本地 drafts.json 的 sort -> 重新打包 -> 部署 -> resyncDrafts 同步字段
python3 call_cf.py template-api resyncDrafts '{"keys":["pp-xxx"]}'
# resyncDrafts 会把 drafts.json 的 name/sort/w/h/palette/counts/cells 等
# 全覆盖到数据库记录(不含 claimed 状态, 不影响已认领关系)
```

### B5. sort 策略（重要教训）

- `listDrafts` 按 `sort` 升序渲染，图纸库管理是一次性全量网格，无分页无搜索
- 新图纸用 `max(sort)+1` 会排到 223 张的**最后一张**，用户根本找不到  
  （睡衣宝宝图纸因此被用户两次反馈"没找到"）
- **新图纸一律 sort=-10 排第一张**（全库最小值原为 -4）
- 已入错的用 resyncDrafts 改

### B6. 其他坑

- 云函数返回体 1MB 上限：`listDrafts` 已用 field() 剔除 cells/hexes，  
  单次 limit(500)；这就是为什么列表接口不带像素数据
- `checkAdmin` / `listDrafts` / `claimDrafts` / `deleteDraft` 要求管理员身份；  
  `seedDrafts` / `resyncDrafts` / `verifyDrafts` 可用 seedToken(`seed-47012803-pd`) 运维
- seedToken 存在云函数环境变量 SEED_TOKEN
- 部署脚本密钥在 artifact 目录 `.secrets`（TENCENT_SECRET_ID/KEY），不进仓库
- **`InvokeFunction` 的入参字段是 `req.Event`，不是 `req.Payload`**——  
  写 `Payload` 会报 `UnknownParameter: 未定义参数`。仓库 `cf/invoke.py` 就是写错的，注意别再抄
- 仓库 `cf/deploy.py` / `cf/invoke.py` 里**还硬编码着已吊销的旧腾讯云密钥**，顺手清掉更干净
- 部署耗时：6.3MB 包 → base64 8.4MB，上传 + 轮询 Active ≈ 1 分钟；  
  `seedDrafts force` ≈ 25 秒。这部分是物理成本，省不掉

### B7. 本地 git 规范

- 仓库 `/workspace/pd`，commit 用历史身份 `Fsir666 <fsir666@users.noreply.github.com>`
- GitHub 推送等用户明确说"推"再推

---

## 依赖

Python3 + numpy + PIL（无需 scikit-learn）。  
云函数操作用 artifact 目录的 `deploy_cf.py` / `call_cf.py`（密钥在 `.secrets`）。
