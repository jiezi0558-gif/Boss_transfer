# 接入指南

这份指南给你三样能直接落地的东西：

1. `analyzeChat` 云函数需要的环境变量模板
2. 一个可直接跑起来的 `PaddleOCR` adapter
3. 一个 OCR adapter 本地 smoke test 脚本
4. 一个本地直连 `MiniMax` 的预览脚本
5. 一个纯 Node 的假数据 OCR adapter 示例

## 一、云函数环境变量模板

在微信云开发控制台里，给 `analyzeChat` 配下面这些变量。

### 1. 大模型

```text
LLM_BASE_URL=https://api.minimaxi.com/v1
LLM_API_KEY=your-minimax-api-key
LLM_MODEL=MiniMax-M2.5-highspeed
```

说明：

- `LLM_BASE_URL` 必须是 OpenAI 兼容接口根地址，不要带 `/chat/completions`
- 当前代码会自动请求：

```text
${LLM_BASE_URL}/chat/completions
```

- `LLM_MODEL` 可以换成你自己的兼容模型名
- 如果你当前用的是 MiniMax，建议先从 `MiniMax-M2.5-highspeed` 开始联调

### 2. OCR

```text
OCR_ADAPTER_URL=http://127.0.0.1:8787/ocr
OCR_ADAPTER_TOKEN=your-secret-token
```

说明：

- 如果不填 `OCR_ADAPTER_URL`，当前云函数会自动退回演示 OCR 文本
- `OCR_ADAPTER_TOKEN` 是可选的，但建议加上，避免接口裸奔

## 二、PaddleOCR adapter

仓库里已经放好了一个最小可用的 PaddleOCR HTTP adapter：

```text
tools/paddle_ocr_adapter.py
tools/requirements-paddleocr.txt
tools/smoke_test_ocr_adapter.py
tools/local_preview.js
```

### 安装

```bash
cd /Users/bytedance/codex/个人项目/语言翻译器
python3 -m pip install -r tools/requirements-paddleocr.txt
```

### 启动

```bash
cd /Users/bytedance/codex/个人项目/语言翻译器
OCR_ADAPTER_TOKEN=your-secret-token python3 tools/paddle_ocr_adapter.py
```

### 本地 smoke test

```bash
cd /Users/bytedance/codex/个人项目/语言翻译器
python3 tools/smoke_test_ocr_adapter.py \
  --adapter-url http://127.0.0.1:8787/ocr \
  --image-url https://your-public-image-url/example.png \
  --token your-secret-token
```

默认会监听：

```text
http://0.0.0.0:8787/ocr
```

### 可选环境变量

```text
PORT=8787
OCR_ADAPTER_TOKEN=your-secret-token
PADDLE_OCR_LANG=ch
```

说明：

- `PADDLE_OCR_LANG=ch` 适合中文聊天截图
- 这版 adapter 会先下载 `tempFileURL` 对应图片，再用 PaddleOCR 识别
- 返回格式里除了 `text`，还会额外带 `lines`

## 三、OCR adapter 请求格式

当前云函数会向 OCR adapter 发一个 `POST` 请求，请求体格式如下：

```json
{
  "fileID": "cloud://xxx/xxx.png",
  "tempFileURL": "https://tmp-xxx.tcb.qcloud.la/xxx.png"
}
```

如果你配置了 `OCR_ADAPTER_TOKEN`，还会带上：

```text
Authorization: Bearer your-secret-token
```

你的 OCR adapter 只需要返回：

```json
{
  "text": "识别出来的聊天内容"
}
```

PaddleOCR adapter 当前实际会返回：

```json
{
  "text": "识别出来的聊天内容",
  "lines": ["逐行结果 1", "逐行结果 2"]
}
```

云函数目前只依赖 `text` 字段。

## 四、最小联调顺序

### 路线 A：先接模型

1. 先只配 `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL`
2. 可先运行：

```bash
cd /Users/bytedance/codex/个人项目/语言翻译器
LLM_BASE_URL=https://api.minimaxi.com/v1 \
LLM_API_KEY=你的 MiniMax Key \
LLM_MODEL=MiniMax-M2.5-highspeed \
node tools/local_preview.js
```

3. 再在小程序里用 `直接粘贴文本`
4. 确认能正确返回：
   - `recommendedTrackId`
   - `analysis`
   - `tracks`
   - `premium`

### 路线 B：再接 OCR

1. 再配 `OCR_ADAPTER_URL / OCR_ADAPTER_TOKEN`
2. 在本地启动 `tools/paddle_ocr_adapter.py`
3. 测试 `上传老板聊天截图`
4. 确认 OCR adapter 正常返回 `{ "text": "..." }`

### 路线 C：最后接广告

1. 在 `utils/config.js` 里配置 `rewardedVideoAdUnitId`
2. 测试高级包解锁是否正常

## 五、排查建议

### 1. 页面总是显示规则版结果

优先检查：

- `LLM_API_KEY` 是否为空
- `LLM_BASE_URL` 是否写成了完整接口路径
- 云函数环境变量是否部署到线上环境而不是本地草稿环境

### 2. 截图上传后没有真实 OCR

优先检查：

- `OCR_ADAPTER_URL` 是否已配置
- `tools/paddle_ocr_adapter.py` 是否已经启动
- OCR adapter 是否能从 `tempFileURL` 拉到图片
- OCR adapter 是否返回了合法 JSON

### 3. PaddleOCR 没装起来

优先检查：

- 是否执行过 `python3 -m pip install -r tools/requirements-paddleocr.txt`
- 当前 Python 环境是否能导入 `paddleocr`
- 首次启动是否需要等待模型下载完成

### 4. 模型返回结构不稳定

优先检查：

- 模型是否真的输出了 JSON
- 是否包含三条合法轨道：`smooth / align / reject`
- 是否返回了 `recommendedTrackId`

即使模型返回不完整，当前后端也会做一层归一兜底。

## 六、推荐补充阅读

- 完整联调操作单：`docs/minimax-paddle-wechat-runbook.md`
