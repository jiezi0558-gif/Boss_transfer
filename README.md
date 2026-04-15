# 老板语言翻译器

一个面向“老板 / 上级沟通”场景的微信小程序 MVP。  
用户可以上传老板聊天截图，或直接粘贴文本，系统会先识别消息，再给出一句潜台词总结和一条最适合直接发送的回复；如果需要，也可以切换另外两种回复风格，或解锁更完整的高级建议。

## 当前版本能力

- 极简单页交互：首页只有一个主动作 `上传老板聊天截图`，其余入口都弱化成文本链接。
- 单页结果流：分析中、异常兜底、结果展示、OCR 校对展开、高级包解锁都在同一页完成。
- 默认最佳回复：云函数会返回 `recommendedTrackId`，前端优先展示推荐轨道，用户不理解“三轨系统”也能直接复制发送。
- OCR 兜底策略：支持截图上传、手动粘贴文本；如果云端 OCR 或云函数不可用，会自动退回规则版 Demo 结果，方便先演示产品。
- IAA 骨架：高级包通过激励视频广告或演示直解锁入口触发，内容只在结果页底部轻量追加。

## 当前主链路

1. 首页点击 `上传老板聊天截图`
2. 或点击 `直接粘贴文本` / `先看示例`
3. 进入 `正在翻译老板意思...`
4. 结果页默认展示：
   - 一句老板真实意图
   - 两个轻量标签
   - 一条最推荐的回复
5. 用户可切换：
   - `丝滑顺从`
   - `专业对齐`
   - `优雅拒绝`
6. 如果 OCR 有误，点击 `识别有误？修改文本` 原地展开文本框
7. 点击结果页底部入口，解锁高级包：
   - 下一步怎么接
   - 哪些话别说
   - 升级建议

## 目录结构

```text
.
|-- app.js
|-- app.json
|-- app.wxss
|-- pages/index
|-- utils
|-- tests
|-- docs/superpowers/plans
`-- cloudfunctions/analyzeChat
```

## 本地启动

1. 用微信开发者工具打开当前目录。
2. 在微信云开发中创建环境，把 `utils/config.js` 里的 `cloudEnv` 替换成真实环境 ID。
3. 在云函数目录执行依赖安装：

```bash
cd /Users/bytedance/codex/个人项目/语言翻译器/cloudfunctions/analyzeChat
npm install
```

4. 在开发者工具里上传并部署 `analyzeChat` 云函数。
5. 如果暂时没配后端，也可以直接点击首页的 `先看示例` 走完整条产品链路。

## 云函数输入 / 输出

前端统一调用 `analyzeChat`，当前使用的主要参数如下：

### 输入

- `fileID`: 截图上传后的云文件 ID
- `manualText`: 手动粘贴或 OCR 校对后的文本
- `unlockPremium`: 是否请求高级包内容
- `localFallback`: 是否强制退回演示结果

### 输出

- `ocrText`: 当前用于分析的最终文本
- `ocrMeta`: OCR 来源说明
- `recommendedTrackId`: 默认推荐展示的回复轨道，取值为 `smooth | align | reject`
- `analysis`: 潜台词解码结果
- `tracks`: 三条可切换回复
- `premium`: 高级包内容；基础模式下为 `null`
- `teaser`: 高级包轻提示；高级包已解锁时为 `null`

## 环境变量

在微信云开发控制台为 `analyzeChat` 配置以下变量：

- `LLM_BASE_URL`: OpenAI 兼容接口地址，例如 `https://api.openai.com/v1`
- `LLM_API_KEY`: 大模型调用密钥
- `LLM_MODEL`: 模型名，默认 `gpt-4o-mini`
- `OCR_ADAPTER_URL`: 可选，自定义 OCR 服务地址
- `OCR_ADAPTER_TOKEN`: 可选，自定义 OCR 服务鉴权 token

说明：

- 如果未配置 `OCR_ADAPTER_URL`，云函数会自动退回演示 OCR 文本，方便先验证主链路。
- 如果未配置 `LLM_*`，云函数会使用内置规则引擎生成结果，依然可以跑通完整页面。

## 已有校验

- `node --test tests/interaction-model.test.js`
- `node --check pages/index/index.js`
- `node --check utils/interaction.js`
- `node --check cloudfunctions/analyzeChat/index.js`
- `node --check cloudfunctions/analyzeChat/prompt.js`

## 推荐下一步

1. 接真实 OCR 适配器。
   把截图临时 URL 传给任意可用 OCR 服务，再按 `{ "text": "..." }` 的 JSON 结构返回。

2. 接真实大模型。
   当前已经支持 OpenAI 兼容接口；接入后重点关注 `recommendedTrackId`、三轨差异和高级包内容稳定性。

3. 在微信开发者工具里走一遍完整链路。
   重点验证上传截图、文本输入、默认推荐回复、OCR 重新解码、激励广告解锁这几个状态切换。

## 补充参考

- 接入模板和排查说明：`docs/integration-guide.md`
- MiniMax + PaddleOCR + 微信云联调操作单：`docs/minimax-paddle-wechat-runbook.md`
- PaddleOCR adapter：`tools/paddle_ocr_adapter.py`
- PaddleOCR 依赖文件：`tools/requirements-paddleocr.txt`
- PaddleOCR 本地 smoke test：`tools/smoke_test_ocr_adapter.py`
- 本地直连 MiniMax 预览脚本：`tools/local_preview.js`
- 纯假数据 OCR adapter 示例：`docs/ocr-adapter-example.js`
