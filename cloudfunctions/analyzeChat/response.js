function normalizeTracks(rawTracks) {
  const fallbackTitles = {
    smooth: {
      title: '丝滑顺从',
      tagline: '先稳住关系',
    },
    align: {
      title: '专业对齐',
      tagline: '稳住专业度',
    },
    reject: {
      title: '优雅拒绝',
      tagline: '体面设边界',
    },
  };

  const preferredOrder = ['smooth', 'align', 'reject'];
  const trackMap = new Map();

  if (Array.isArray(rawTracks)) {
    rawTracks.forEach((track) => {
      if (!track || !track.id || !preferredOrder.includes(track.id)) {
        return;
      }

      const fallbackMeta = fallbackTitles[track.id];
      trackMap.set(track.id, {
        id: track.id,
        title: track.title || fallbackMeta.title,
        tagline: track.tagline || fallbackMeta.tagline,
        scene: track.scene || '适合当前场景使用。',
        reply: track.reply || '',
        strategy: track.strategy || '先确保结果可发，再补充策略说明。',
      });
    });
  }

  return preferredOrder
    .filter((id) => trackMap.has(id))
    .map((id) => trackMap.get(id))
    .filter((track) => track.reply.trim());
}

function normalizeAnalysis(rawAnalysis) {
  const analysis = rawAnalysis || {};

  return {
    summary: analysis.summary || '先给老板一个可交付结果，再减少后续追问。',
    hiddenIntent: analysis.hiddenIntent || '老板现在最想要的是明确结果，而不是过程解释。',
    urgencyText: analysis.urgencyText || '中，建议尽快同步方案',
    emotionText: analysis.emotionText || '理性施压',
    recommendedMove: analysis.recommendedMove || '先承接目标，再给下一时间点。',
    riskLevelText: analysis.riskLevelText || '可控场景',
    riskLevelClass: analysis.riskLevelClass || 'pill-primary',
    signals: Array.isArray(analysis.signals) ? analysis.signals.filter(Boolean).slice(0, 3) : [],
  };
}

function normalizePremium(rawPremium, unlockPremium) {
  if (!unlockPremium) {
    return null;
  }

  const premium = rawPremium || {};
  return {
    followUps: Array.isArray(premium.followUps) ? premium.followUps.filter(Boolean).slice(0, 3) : [],
    avoidPhrases: Array.isArray(premium.avoidPhrases) ? premium.avoidPhrases.filter(Boolean).slice(0, 3) : [],
    escalationTip: premium.escalationTip || '先给结果，再补风险和下一步时间点。',
  };
}

function chooseRecommendedTrackId({ scenario, tracks, provided }) {
  const ids = Array.isArray(tracks) ? tracks.map((track) => track.id) : [];

  if (provided && ids.includes(provided)) {
    return provided;
  }

  if (scenario && scenario.overScope && ids.includes('reject')) {
    return 'reject';
  }

  if (ids.includes('align')) {
    return 'align';
  }

  if (scenario && scenario.urgent && ids.includes('smooth')) {
    return 'smooth';
  }

  return ids[0] || 'align';
}

function normalizeModelResult({ result, scenario, unlockPremium }) {
  const tracks = normalizeTracks(result && result.tracks);
  const analysis = normalizeAnalysis(result && result.analysis);
  const premium = normalizePremium(result && result.premium, unlockPremium);

  return {
    recommendedTrackId: chooseRecommendedTrackId({
      scenario,
      tracks,
      provided: result && result.recommendedTrackId,
    }),
    analysis,
    tracks,
    premium,
  };
}

module.exports = {
  normalizeTracks,
  normalizeAnalysis,
  normalizePremium,
  chooseRecommendedTrackId,
  normalizeModelResult,
};
