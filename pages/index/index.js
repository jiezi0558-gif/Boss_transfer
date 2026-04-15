const { APP_CONFIG } = require('../../utils/config');
const { uploadScreenshot, analyzeChat } = require('../../utils/cloud');
const {
  resolveRecommendedTrackId,
  getTrackById,
  buildInsightTags,
} = require('../../utils/interaction');

const DEMO_TEXT = [
  '老板：这个方案客户下午就催了，你先别解释为什么没做完，',
  '先把能上线的部分整理一下，12 点前给我一个可发出去的版本。',
  '另外把风险点列清楚，我不希望客户问的时候我们还没准备。'
].join('');

const DEFAULT_TEASER = {
  title: '继续往下拆',
  copy: '解锁下一步怎么接、哪些话别说和升级建议。',
};

const DEFAULT_OCR_META = {
  source: 'pending',
  sourceLabel: '等待输入',
};

const IMAGE_ERROR_MESSAGE = '截图识别不稳定，你也可以直接粘贴文本。';

function chooseImageFile() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: resolve,
      fail: reject,
    });
  });
}

Page({
  data: {
    pageState: 'idle',
    loading: false,
    ocrLoading: false,
    premiumLoading: false,
    sheetVisible: false,
    editingVisible: false,
    screenshotPath: '',
    uploadedFileId: '',
    draftText: '',
    ocrText: '',
    ocrMeta: DEFAULT_OCR_META,
    analysis: null,
    tracks: [],
    activeTrackId: '',
    activeTrack: null,
    recommendedTrackId: 'align',
    insightTags: [],
    premium: null,
    teaser: DEFAULT_TEASER,
    errorMessage: '',
    adReady: false,
  },

  onLoad() {
    this.initRewardedVideo();
  },

  initRewardedVideo() {
    if (!wx.createRewardedVideoAd || !APP_CONFIG.rewardedVideoAdUnitId.startsWith('adunit-')) {
      return;
    }

    this.rewardedVideoAd = wx.createRewardedVideoAd({
      adUnitId: APP_CONFIG.rewardedVideoAdUnitId,
    });

    this.rewardedVideoAd.onLoad(() => {
      this.setData({ adReady: true });
    });

    this.rewardedVideoAd.onError(() => {
      this.setData({ adReady: false });
    });

    this.rewardedVideoAd.onClose(async (result) => {
      if (result && result.isEnded) {
        await this.fetchPremium();
        return;
      }

      wx.showToast({
        title: '完整观看后才能解锁',
        icon: 'none',
      });
    });
  },

  noop() {},

  openTextSheet() {
    this.setData({
      sheetVisible: true,
      draftText: this.data.ocrText || this.data.draftText || '',
    });
  },

  closeTextSheet() {
    this.setData({
      sheetVisible: false,
    });
  },

  handleDraftInput(event) {
    this.setData({
      draftText: event.detail.value,
    });
  },

  handleOcrInput(event) {
    this.setData({
      ocrText: event.detail.value,
    });
  },

  async chooseImage() {
    try {
      const media = await chooseImageFile();
      const file = media.tempFiles && media.tempFiles[0];
      if (!file || !file.tempFilePath) {
        return;
      }

      this.setData({
        screenshotPath: file.tempFilePath,
        uploadedFileId: '',
        errorMessage: '',
        sheetVisible: false,
      });

      await this.uploadAndAnalyze(file.tempFilePath);
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }

      this.showImageError('未能读取截图，请重新上传或改用文本输入。');
    }
  },

  async uploadAndAnalyze(filePath) {
    this.setData({
      loading: true,
      pageState: 'analyzing',
      analysis: null,
      tracks: [],
      activeTrack: null,
      activeTrackId: '',
      insightTags: [],
      premium: null,
      teaser: DEFAULT_TEASER,
      editingVisible: false,
      errorMessage: '',
    });

    try {
      const uploadResult = await uploadScreenshot(filePath);
      const uploadedFileId = uploadResult.fileID;
      this.setData({ uploadedFileId });

      await this.runBaseAnalysis({
        fileID: uploadedFileId,
      });
    } catch (error) {
      this.showImageError();
    } finally {
      this.setData({ loading: false });
    }
  },

  async submitTextSheet() {
    const manualText = (this.data.draftText || '').trim();
    if (!manualText) {
      wx.showToast({
        title: '先粘贴老板消息',
        icon: 'none',
      });
      return;
    }

    this.setData({
      sheetVisible: false,
      screenshotPath: '',
      uploadedFileId: '',
      ocrText: manualText,
      ocrMeta: {
        source: 'manual',
        sourceLabel: '手动输入',
      },
      errorMessage: '',
    });

    await this.runBaseAnalysis({
      manualText,
    });
  },

  async loadDemoCase() {
    this.setData({
      sheetVisible: false,
      draftText: DEMO_TEXT,
      screenshotPath: '',
      uploadedFileId: '',
      ocrText: DEMO_TEXT,
      ocrMeta: {
        source: 'demo',
        sourceLabel: '示例文本',
      },
      errorMessage: '',
      editingVisible: false,
    });

    await this.runBaseAnalysis({
      manualText: DEMO_TEXT,
      localFallback: true,
    });
  },

  async runBaseAnalysis({ fileID = '', manualText = '', localFallback = false } = {}) {
    this.setData({
      loading: true,
      pageState: 'analyzing',
      analysis: null,
      tracks: [],
      activeTrack: null,
      activeTrackId: '',
      insightTags: [],
      premium: null,
      teaser: DEFAULT_TEASER,
      editingVisible: false,
      errorMessage: '',
    });

    try {
      const result = await analyzeChat({
        fileID,
        manualText,
        unlockPremium: false,
        localFallback,
      });

      const payload = result.result || result;
      this.applyAnalysis(payload);
    } catch (error) {
      const fallbackText = (manualText || '').trim();

      if ((fallbackText || localFallback) && APP_CONFIG.demoFallback) {
        const fallbackPayload = this.buildLocalFallback(fallbackText || DEMO_TEXT, false);
        this.applyAnalysis(fallbackPayload);
        this.setData({
          errorMessage: '云函数暂不可用，当前展示规则版结果。',
        });
        return;
      }

      this.showImageError();
    } finally {
      this.setData({ loading: false });
    }
  },

  async reAnalyzeByText() {
    const manualText = (this.data.ocrText || '').trim();
    if (!manualText) {
      wx.showToast({
        title: '先补充聊天文本',
        icon: 'none',
      });
      return;
    }

    this.setData({
      ocrLoading: true,
      errorMessage: '',
    });

    try {
      const result = await analyzeChat({
        manualText,
        unlockPremium: Boolean(this.data.premium),
      });
      const payload = result.result || result;
      this.applyAnalysis(payload);
    } catch (error) {
      if (APP_CONFIG.demoFallback) {
        const fallbackPayload = this.buildLocalFallback(manualText, Boolean(this.data.premium));
        this.applyAnalysis(fallbackPayload);
        this.setData({
          errorMessage: '云函数暂不可用，当前展示规则版结果。',
        });
        return;
      }

      wx.showToast({
        title: '重新解码失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        ocrLoading: false,
      });
    }
  },

  buildLocalFallback(text, unlockPremium) {
    const urgency = text.includes('12 点前') || text.includes('今天') ? '高' : '中';

    return {
      ocrText: text,
      ocrMeta: {
        source: 'fallback',
        sourceLabel: '规则版结果',
      },
      recommendedTrackId: 'align',
      analysis: {
        summary: '现在最重要的不是解释过程，而是马上拿出一个能对外同步的版本。',
        hiddenIntent: '先给老板一个今天能发出去的结果，再把风险和边界交代清楚。',
        urgencyText: urgency === '高' ? '高，需要立刻给出时间点' : '中，建议尽快同步方案',
        emotionText: '表面克制，实则不接受解释',
        recommendedMove: '先承接交付，再主动补齐风险说明与下一时间点。',
        riskLevelText: '高压场景',
        riskLevelClass: 'pill-warn',
        signals: [
          '“先别解释”说明老板此刻最缺的是结果，不是原因。',
          '“可发出去的版本”代表先要最小可交付，而不是完美方案。',
          '提前列风险点，能把后续追问变成你主动控节奏。'
        ],
      },
      tracks: [
        {
          id: 'smooth',
          title: '丝滑顺从',
          tagline: '先稳住关系',
          scene: '适合老板情绪明显偏紧，你需要先把任务接住时使用。',
          reply: '收到，我先不展开原因，优先把现在能对外同步的部分整理成一个可直接发送的版本，按时间点前发您确认。同时我会把风险点和待补部分单独列清，确保客户追问时我们口径一致。',
          strategy: '先接住任务，再补一个明确动作，能快速稳住老板情绪。',
        },
        {
          id: 'align',
          title: '专业对齐',
          tagline: '稳住专业度',
          scene: '适合你既要接住任务，也想让老板看到你的判断力时使用。',
          reply: '明白，我会先输出一个可对外同步的最小版本，保证今天能有明确进展；同步我会把已完成、待补和风险影响拆开写清，避免后续追问时信息不一致。按当前节奏，我会在约定时间前先给您过一版。',
          strategy: '这类回复更像在管理预期和风险，默认最适合做首选。',
        },
        {
          id: 'reject',
          title: '优雅拒绝',
          tagline: '体面设边界',
          scene: '适合你需要压缩范围、争取空间，但又不能硬顶回去时使用。',
          reply: '收到。为了保证当前时间点前能输出一个质量可控、能直接对外同步的版本，我建议这轮先聚焦已完成内容和明确风险说明，暂不把尚未验证的部分一并放进去。这样能先稳住外部沟通，也能避免后续因为信息过满带来新的解释成本。我先按这个口径整理一版给您确认。',
          strategy: '不是硬拒绝，而是用交付质量和风险控制去重设范围。',
        }
      ],
      teaser: unlockPremium ? null : DEFAULT_TEASER,
      premium: unlockPremium ? {
        followUps: [
          '发出版本后，再补一条简短进展同步，告诉老板你已经推进到哪一步。',
          '如果对方追问原因，优先讲补救动作和下一时间点，少讲过程失误。',
          '提前准备一句兜底：如果需要，我可以在下午补一版更完整说明。'
        ],
        avoidPhrases: [
          '“其实是因为前面需求一直变。”',
          '“现在时间太赶，做不到。”',
          '“客户问了再说吧。”'
        ],
        escalationTip: '高压场景里，最好用“结果预览 + 风险清单 + 下一时间点”三件套来回复。',
      } : null,
    };
  },

  applyAnalysis(payload, { mergePremiumOnly = false } = {}) {
    const nextTracks = mergePremiumOnly && this.data.tracks.length
      ? this.data.tracks
      : (payload.tracks || []);
    const recommendedTrackId = resolveRecommendedTrackId(
      nextTracks,
      payload.recommendedTrackId || this.data.recommendedTrackId,
    );
    const activeTrackId = mergePremiumOnly
      ? resolveRecommendedTrackId(nextTracks, this.data.activeTrackId || recommendedTrackId)
      : recommendedTrackId;
    const nextAnalysis = mergePremiumOnly ? this.data.analysis : (payload.analysis || null);
    const nextPremium = Object.prototype.hasOwnProperty.call(payload, 'premium')
      ? payload.premium
      : (mergePremiumOnly ? this.data.premium : null);
    const nextTeaser = Object.prototype.hasOwnProperty.call(payload, 'teaser')
      ? payload.teaser
      : (mergePremiumOnly ? this.data.teaser : DEFAULT_TEASER);

    this.setData({
      pageState: 'result',
      ocrText: mergePremiumOnly ? this.data.ocrText : (payload.ocrText || this.data.ocrText),
      ocrMeta: mergePremiumOnly ? this.data.ocrMeta : (payload.ocrMeta || this.data.ocrMeta),
      draftText: mergePremiumOnly ? this.data.draftText : (payload.ocrText || this.data.draftText || ''),
      analysis: nextAnalysis,
      tracks: nextTracks,
      recommendedTrackId,
      activeTrackId,
      activeTrack: getTrackById(nextTracks, activeTrackId),
      insightTags: buildInsightTags(nextAnalysis),
      premium: nextPremium,
      teaser: nextTeaser,
      sheetVisible: false,
      editingVisible: false,
    });
  },

  showImageError(message = IMAGE_ERROR_MESSAGE) {
    this.setData({
      pageState: 'error',
      analysis: null,
      tracks: [],
      activeTrack: null,
      activeTrackId: '',
      insightTags: [],
      premium: null,
      teaser: DEFAULT_TEASER,
      editingVisible: false,
      errorMessage: message,
      loading: false,
      ocrLoading: false,
      premiumLoading: false,
    });
  },

  switchTrack(event) {
    const trackId = event.currentTarget.dataset.trackId;
    this.setData({
      activeTrackId: trackId,
      activeTrack: getTrackById(this.data.tracks, trackId),
    });
  },

  toggleEditing() {
    this.setData({
      editingVisible: !this.data.editingVisible,
    });
  },

  copyActiveTrack() {
    const current = this.data.activeTrack || getTrackById(this.data.tracks, this.data.activeTrackId);
    if (!current) {
      return;
    }

    wx.setClipboardData({
      data: current.reply,
    });
  },

  async unlockPremium() {
    if (this.data.premiumLoading || !(this.data.ocrText || '').trim()) {
      return;
    }

    if (this.rewardedVideoAd && this.data.adReady) {
      try {
        await this.rewardedVideoAd.show();
        return;
      } catch (error) {
        try {
          await this.rewardedVideoAd.load();
          await this.rewardedVideoAd.show();
          return;
        } catch (finalError) {
          this.setData({ adReady: false });
        }
      }
    }

    await this.fetchPremium();
  },

  async fetchPremium() {
    const manualText = (this.data.ocrText || '').trim();
    if (!manualText) {
      return;
    }

    this.setData({
      premiumLoading: true,
      errorMessage: '',
    });

    try {
      const result = await analyzeChat({
        manualText,
        unlockPremium: true,
      });
      const payload = result.result || result;
      this.applyAnalysis(payload, {
        mergePremiumOnly: true,
      });
    } catch (error) {
      if (APP_CONFIG.demoFallback) {
        const fallbackPayload = this.buildLocalFallback(manualText, true);
        this.applyAnalysis(fallbackPayload, {
          mergePremiumOnly: true,
        });
        this.setData({
          errorMessage: '云函数暂不可用，当前展示规则版高级包。',
        });
        return;
      }

      wx.showToast({
        title: '高级包解锁失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        premiumLoading: false,
      });
    }
  },
});
