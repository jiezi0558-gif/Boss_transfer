const https = require('https');
const cloud = require('wx-server-sdk');
const { SYSTEM_PROMPT } = require('./prompt');
const {
  chooseRecommendedTrackId,
  normalizeModelResult,
} = require('./response');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const DEFAULT_DEMO_TEXT = '这个方案客户下午就催了，你先别解释为什么没做完，先把能上线的部分整理一下，12 点前给我一个可发出去的版本。另外把风险点列清楚，我不希望客户问的时候我们还没准备。';

function requestJson({ url, method = 'POST', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const request = https.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }, (response) => {
      let raw = '';

      response.on('data', (chunk) => {
        raw += chunk;
      });

      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP_${response.statusCode}:${raw}`));
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(new Error(`INVALID_JSON:${raw}`));
        }
      });
    });

    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

async function resolveText({ fileID, manualText, localFallback }) {
  if (manualText && manualText.trim()) {
    return {
      ocrText: manualText.trim(),
      ocrMeta: {
        source: 'manual',
        sourceLabel: '手动校对',
      },
    };
  }

  if (!fileID) {
    return {
      ocrText: localFallback ? DEFAULT_DEMO_TEXT : '',
      ocrMeta: {
        source: localFallback ? 'demo' : 'pending',
        sourceLabel: localFallback ? '演示 OCR' : '等待截图',
      },
    };
  }

  if (process.env.OCR_ADAPTER_URL) {
    const tempResult = await cloud.getTempFileURL({
      fileList: [fileID],
    });
    const file = tempResult.fileList && tempResult.fileList[0];
    const ocrResponse = await requestJson({
      url: process.env.OCR_ADAPTER_URL,
      headers: process.env.OCR_ADAPTER_TOKEN ? {
        Authorization: `Bearer ${process.env.OCR_ADAPTER_TOKEN}`,
      } : {},
      body: {
        fileID,
        tempFileURL: file ? file.tempFileURL : '',
      },
    });

    return {
      ocrText: (ocrResponse.text || '').trim(),
      ocrMeta: {
        source: 'adapter',
        sourceLabel: '云端 OCR',
      },
    };
  }

  return {
    ocrText: DEFAULT_DEMO_TEXT,
    ocrMeta: {
      source: 'demo',
      sourceLabel: '演示 OCR',
    },
  };
}

function detectScenario(text) {
  const normalized = text || '';
  const urgent = /今天|尽快|马上|立刻|中午|今晚|12 点前|deadline|催/.test(normalized);
  const defensive = /别解释|先不要解释|不用解释/.test(normalized);
  const external = /客户|对外|发出去|上线|交付/.test(normalized);
  const riskSensitive = /风险|准备|追问|口径|问题/.test(normalized);
  const overScope = /全部|都做完|全部上线|全部发/.test(normalized);

  return {
    urgent,
    defensive,
    external,
    riskSensitive,
    overScope,
  };
}

function buildRuleBasedResponse(text, unlockPremium) {
  const scenario = detectScenario(text);
  const hiddenIntent = scenario.external
    ? '老板要的不是解释，而是一个能马上对外同步的最小交付版本。'
    : '老板要的是明确动作和下一时间点，而不是过程性说明。';

  const summary = scenario.urgent
    ? '当前场景的压力点是时限极短，你的回复要同时解决“马上有结果”和“后续少追问”两件事。'
    : '当前场景更偏向确认优先级，你需要把动作和边界说清楚。';

  const riskLevelClass = scenario.urgent ? 'pill-warn' : 'pill-primary';
  const riskLevelText = scenario.urgent ? '高压场景' : '可控场景';

  const tracks = [
    {
      id: 'smooth',
      title: '丝滑顺从',
      tagline: '先稳住关系',
      scene: '适合当前对方更在意执行速度，你需要先把任务接稳时使用。',
      reply: scenario.external
        ? '收到，我先不展开原因，优先把目前能对外同步的部分整理成一个可直接发送的版本，按您说的时间点前发您确认。同时我会把风险点和待补部分单独列清，确保客户追问时我们口径一致。'
        : '收到，我先按您说的方向推进，优先把当前能落地的部分整理出来，并把下一步安排和时间点一起同步给您，避免信息来回确认。',
      strategy: '先接住任务，再补一个“我已经进入执行”的信号，能快速缓和压力。'
    },
    {
      id: 'align',
      title: '专业对齐',
      tagline: '稳住专业度',
      scene: '适合你希望体现判断力，让老板觉得你不是机械接活时使用。',
      reply: scenario.external
        ? '明白，我会先输出一个可对外同步的最小版本，保证客户今天能收到明确进展；同步我会把已完成、待补和风险影响拆开写清，避免后续追问时信息不一致。按当前节奏，我会在约定时间前先给您过一版。'
        : '明白，我先把这件事拆成优先完成项和后续补充项，再同步一个明确时间点给您。这样既能保证推进速度，也能避免后面返工。',
      strategy: '把“完成任务”上升到“管理预期和风险”，专业感会更强。'
    },
    {
      id: 'reject',
      title: '优雅拒绝',
      tagline: '体面设边界',
      scene: '适合你需要压缩范围、争取空间，但又不想正面顶回去时使用。',
      reply: scenario.overScope || scenario.external
        ? '收到。为了保证在当前时间点前输出一个质量可控、能直接对外同步的版本，我建议这轮先聚焦已完成内容和明确风险说明，暂不把尚未验证的部分一并放进去。这样能先稳住外部沟通，也能避免后续因为信息过满带来新的解释成本。我先按这个口径整理一版给您确认。'
        : '收到。为了保证这轮推进效率，我建议先聚焦最关键的交付项，把其余部分作为第二优先级补充。这样既能保证进度，也能减少来回调整。',
      strategy: '不是硬拒绝，而是用“交付质量”和“风险控制”来重设范围。'
    }
  ];

  return normalizeModelResult({
    result: {
      recommendedTrackId: chooseRecommendedTrackId({
        scenario,
        tracks,
      }),
      analysis: {
        summary,
        hiddenIntent,
        urgencyText: scenario.urgent ? '高，需要立刻给出时间点' : '中，建议尽快同步方案',
        emotionText: scenario.defensive ? '表面克制，实则不接受解释' : '理性施压',
        recommendedMove: scenario.external
          ? '先承接“对外可发”的目标，再主动补上风险口径和下一时间点。'
          : '先确认目标，再把你的行动顺序和边界讲清楚。',
        riskLevelText,
        riskLevelClass,
        signals: [
          scenario.defensive ? '老板明确阻断解释，代表此刻最稀缺的是结果。' : '消息重点落在结果，不在过程。',
          scenario.external ? '提到客户和对外同步，说明老板在承担外部压力。' : '这更像内部对齐，需要你给出清晰动作。',
          scenario.riskSensitive ? '主动列风险，能显著降低后续被追问概率。' : '补一个下一时间点，可以让沟通更可控。'
        ],
      },
      tracks,
      premium: unlockPremium ? {
        followUps: [
          '发出版本后，再补一条简短进展同步，告诉老板你已经推进到哪一步。',
          '如果对方追问原因，优先讲补救动作和下一时间点，少讲过程失误。',
          '提前准备一句话兜底：如需，我可以在下午补一版更完整说明。'
        ],
        avoidPhrases: [
          '“我本来是打算……”',
          '“其实问题不大。”',
          '“等客户问了再说。”'
        ],
        escalationTip: '高压场景里，最好用“结果预览 + 风险清单 + 下一时间点”三件套来回复。'
      } : null,
    },
    scenario,
    unlockPremium,
  });
}

function parseModelJson(rawContent) {
  try {
    return JSON.parse(rawContent);
  } catch (error) {
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) {
      throw error;
    }
    return JSON.parse(match[0]);
  }
}

async function generateWithLlm(text, unlockPremium) {
  if (!process.env.LLM_API_KEY || !process.env.LLM_BASE_URL) {
    return buildRuleBasedResponse(text, unlockPremium);
  }

  const response = await requestJson({
    url: `${process.env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`,
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: {
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify({
            chatText: text,
            unlockPremium,
          }),
        }
      ],
      temperature: 0.7,
    },
  });

  const message = response.choices
    && response.choices[0]
    && response.choices[0].message
    && response.choices[0].message.content;

  if (!message) {
    return buildRuleBasedResponse(text, unlockPremium);
  }

  const parsed = parseModelJson(message);
  if (!Array.isArray(parsed.tracks) || !parsed.tracks.length) {
    return buildRuleBasedResponse(text, unlockPremium);
  }

  const normalized = normalizeModelResult({
    result: parsed,
    scenario: detectScenario(text),
    unlockPremium,
  });

  if (!normalized.tracks.length) {
    return buildRuleBasedResponse(text, unlockPremium);
  }

  return normalized;
}

exports.main = async (event) => {
  const payload = event || {};
  const { fileID = '', manualText = '', unlockPremium = false, localFallback = false } = payload;
  const { ocrText, ocrMeta } = await resolveText({
    fileID,
    manualText,
    localFallback,
  });

  const finalText = ocrText || DEFAULT_DEMO_TEXT;
  const result = await generateWithLlm(finalText, unlockPremium);

  return {
    success: true,
    mode: process.env.LLM_API_KEY ? 'llm' : 'rules',
    ocrText: finalText,
    ocrMeta,
    recommendedTrackId: result.recommendedTrackId,
    analysis: result.analysis,
    tracks: result.tracks,
    premium: result.premium || null,
    teaser: unlockPremium ? null : {
      title: '高级包未解锁',
      copy: '继续看激励视频，可解锁跟进动作、禁忌表达和升级建议。',
    },
  };
};
