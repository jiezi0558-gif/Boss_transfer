const { APP_CONFIG } = require('./config');

function buildCloudPath(filePath) {
  const segments = filePath.split('.');
  const suffix = segments.length > 1 ? segments.pop() : 'png';
  return `chat-captures/${Date.now()}-${Math.random().toString(16).slice(2)}.${suffix}`;
}

function uploadScreenshot(filePath) {
  if (!wx.cloud) {
    return Promise.reject(new Error('当前环境未启用云开发。'));
  }

  return wx.cloud.uploadFile({
    cloudPath: buildCloudPath(filePath),
    filePath,
  });
}

function analyzeChat(payload) {
  if (!wx.cloud) {
    return Promise.reject(new Error('当前环境未启用云开发。'));
  }

  return wx.cloud.callFunction({
    name: APP_CONFIG.cloudFunctionName,
    data: payload,
  });
}

module.exports = {
  uploadScreenshot,
  analyzeChat,
};
