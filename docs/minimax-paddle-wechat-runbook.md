# MiniMax + PaddleOCR + 微信云联调操作单

这份 runbook 是按你当前项目现状写的，目标是最快把三段链路串起来：

1. `MiniMax` 负责话术生成
2. `PaddleOCR` 负责截图转文本
3. `微信云函数 analyzeChat` 负责把 OCR 和模型串起来

## 0. 你要先准备好的东西

- 一个可用的 `MiniMax API Key`
- 一个微信云开发环境
- 一台能运行 Python 3 的机器
- 一台能运行 Node.js 的机器

## 0.5 先在本机直连 MiniMax

在不进微信云之前，你可以先直接测试模型链路：

```bash
cd /Users/bytedance/codex/个人项目/语言翻译器
LLM_BASE_URL=https://api.minimaxi.com/v1 \
LLM_API_KEY=你的 MiniMax Key \
LLM_MODEL=MiniMax-M2.5-highspeed \
node tools/local_preview.js
```

如果正常，你会看到一份格式化 JSON，里面包含：

- `raw`
- `normalized`

先把这一步跑通，再继续接云函数，定位问题会轻很多。

## 1. 本地启动 PaddleOCR adapter

在项目根目录执行：

```bash
cd /Users/bytedance/codex/个人项目/语言翻译器
python3 -m pip install -r tools/requirements-paddleocr.txt
OCR_ADAPTER_TOKEN=your-secret-token python3 tools/paddle_ocr_adapter.py
```

成功后，你应该能看到：

```text
PaddleOCR adapter listening on http://0.0.0.0:8787/ocr
```

## 2. 本地 smoke test OCR adapter

找一张公网可访问的聊天截图 URL，然后执行：

```bash
cd /Users/bytedance/codex/个人项目/语言翻译器
python3 tools/smoke_test_ocr_adapter.py \
  --adapter-url http://127.0.0.1:8787/ocr \
  --image-url https://your-public-image-url/example.png \
  --token your-secret-token
```

如果正常，你会收到类似：

```json
{
  "text": "老板：今天中午前给我一个版本",
  "lines": ["老板：今天中午前给我一个版本"]
}
```

先把这一步跑通，再继续接微信云。

## 3. 配微信云函数环境变量

在微信云开发控制台中，为 `analyzeChat` 配这些环境变量：

```text
LLM_BASE_URL=https://api.minimaxi.com/v1
LLM_API_KEY=你的 MiniMax Key
LLM_MODEL=MiniMax-M2.5-highspeed
OCR_ADAPTER_URL=http://127.0.0.1:8787/ocr
OCR_ADAPTER_TOKEN=your-secret-token
```

如果你的 OCR adapter 不是部署在本机，而是部署到一台公网服务上，把 `OCR_ADAPTER_URL` 改成那个公网地址。

## 4. 部署云函数

在项目根目录执行：

```bash
cd /Users/bytedance/codex/个人项目/语言翻译器/cloudfunctions/analyzeChat
npm install
```

然后去微信开发者工具：

1. 打开当前项目
2. 云开发面板里找到 `analyzeChat`
3. 上传并部署

## 5. 改小程序本地配置

编辑：

```text
utils/config.js
```

把：

```js
cloudEnv: 'replace-with-your-cloud-env-id'
```

改成你的真实环境 ID。

如果你已经拿到激励视频广告位，再把：

```js
rewardedVideoAdUnitId: ''
```

换成真实 `adunit-...`

## 6. 先测文本链路

打开微信开发者工具后，先不要测截图，先测最稳的一段：

1. 点 `直接粘贴文本`
2. 粘贴一段老板消息
3. 点 `开始翻译`

确认页面能正常出来：

- 老板真正要的是
- 一条默认推荐回复
- 三轨切换
- 底部高级包入口

如果这一步失败，优先排查 `MiniMax` 配置，不要先怀疑 OCR。

## 7. 再测截图链路

确认文本链路通过后，再测：

1. 点 `上传老板聊天截图`
2. 选一张老板聊天截图
3. 看结果是否直接落到推荐回复
4. 如果 OCR 识别偏差，点 `识别有误？修改文本`

如果这一步失败，优先排查：

- `OCR_ADAPTER_URL`
- `OCR_ADAPTER_TOKEN`
- PaddleOCR adapter 是否正在运行
- 微信云函数所在环境能不能访问到你的 OCR adapter

## 8. 最后测高级包

如果你已经配置广告位：

1. 点结果页底部解锁入口
2. 完整观看激励视频
3. 看高级包是否正常追加到当前页底部

如果你还没配置广告位，当前代码会走演示直解锁逻辑，也可以先验证界面状态切换。

## 9. 最常见的三个坑

### 坑 1：本地 OCR adapter 能跑，但云函数调不到

原因通常是：

- 你把 `OCR_ADAPTER_URL` 写成了 `127.0.0.1`
- 但云函数运行在微信云，不是在你电脑里

这时你需要把 PaddleOCR adapter 部署到一台公网可访问的服务上，再把 `OCR_ADAPTER_URL` 改成公网地址。

### 坑 2：MiniMax 通了，但总返回规则版结果

优先检查：

- `LLM_BASE_URL` 是否是 `https://api.minimaxi.com/v1`
- `LLM_API_KEY` 是否真的部署到云环境
- `LLM_MODEL` 是否拼错

### 坑 3：PaddleOCR 首次启动很慢

这是正常现象，通常是首次下载模型或初始化依赖。  
先等它完整启动，再做 smoke test。
