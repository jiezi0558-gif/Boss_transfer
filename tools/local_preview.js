const https = require('https');
const { SYSTEM_PROMPT } = require('../cloudfunctions/analyzeChat/prompt');
const { normalizeModelResult } = require('../cloudfunctions/analyzeChat/response');

function requestJson({ url, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body || {});
    const request = https.request(url, {
      method: 'POST',
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

async function main() {
  const baseUrl = process.env.LLM_BASE_URL || 'https://api.minimaxi.com/v1';
  const apiKey = process.env.LLM_API_KEY || '';
  const model = process.env.LLM_MODEL || 'MiniMax-M2.5-highspeed';
  const chatText = process.argv.slice(2).join(' ').trim()
    || '老板：这个方案客户下午就催了，你先别解释为什么没做完，先把能上线的部分整理一下，12 点前给我一个可发出去的版本。另外把风险点列清楚，我不希望客户问的时候我们还没准备。';

  if (!apiKey) {
    throw new Error('Missing LLM_API_KEY');
  }

  const response = await requestJson({
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model,
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
            chatText,
            unlockPremium: true,
          }),
        },
      ],
      temperature: 0.7,
    },
  });

  const rawContent = response.choices
    && response.choices[0]
    && response.choices[0].message
    && response.choices[0].message.content;

  if (!rawContent) {
    throw new Error('Model returned empty content');
  }

  const parsed = parseModelJson(rawContent);
  const normalized = normalizeModelResult({
    result: parsed,
    scenario: {
      urgent: /今天|尽快|马上|立刻|12 点前|催/.test(chatText),
      overScope: /全部|都做完|全部上线|全部发/.test(chatText),
    },
    unlockPremium: true,
  });

  console.log(JSON.stringify({
    model,
    inputPreview: chatText.slice(0, 80),
    raw: parsed,
    normalized,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  parseModelJson,
};
