const http = require('http');

const PORT = process.env.PORT || 8787;
const OCR_ADAPTER_TOKEN = process.env.OCR_ADAPTER_TOKEN || '';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk;
    });

    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

async function handleOcr(body) {
  const tempFileURL = body && body.tempFileURL;

  if (!tempFileURL) {
    return {
      text: '',
    };
  }

  // 这里先返回模拟识别结果，接真实 OCR 时把这一段替换成你自己的服务调用。
  return {
    text: '老板：这个方案客户下午就催了，你先别解释为什么没做完，先把能上线的部分整理一下，12 点前给我一个可发出去的版本。另外把风险点列清楚，我不希望客户问的时候我们还没准备。',
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/ocr') {
    sendJson(response, 404, {
      error: 'Not Found',
    });
    return;
  }

  if (OCR_ADAPTER_TOKEN) {
    const authHeader = request.headers.authorization || '';
    const expectedHeader = `Bearer ${OCR_ADAPTER_TOKEN}`;

    if (authHeader !== expectedHeader) {
      sendJson(response, 401, {
        error: 'Unauthorized',
      });
      return;
    }
  }

  try {
    const body = await readJsonBody(request);
    const result = await handleOcr(body);

    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      error: 'OCR adapter failed',
      detail: error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`OCR adapter listening on http://localhost:${PORT}/ocr`);
});
