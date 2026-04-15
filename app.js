const { APP_CONFIG } = require('./utils/config');

App({
  onLaunch() {
    if (!wx.cloud) {
      console.warn('当前基础库不支持云开发，请升级微信开发者工具。');
      return;
    }

    const initOptions = {
      traceUser: true,
    };

    if (APP_CONFIG.cloudEnv && !APP_CONFIG.cloudEnv.startsWith('replace-with-')) {
      initOptions.env = APP_CONFIG.cloudEnv;
    }

    wx.cloud.init(initOptions);
  },
});
