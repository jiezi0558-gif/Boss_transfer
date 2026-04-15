const DEFAULT_RECOMMENDED_TRACK_ID = 'align';

function normalizeTracks(tracks) {
  return Array.isArray(tracks) ? tracks.filter((track) => track && track.id) : [];
}

function resolveRecommendedTrackId(tracks, recommendedTrackId = '') {
  const normalizedTracks = normalizeTracks(tracks);
  const ids = normalizedTracks.map((track) => track.id);

  if (recommendedTrackId && ids.includes(recommendedTrackId)) {
    return recommendedTrackId;
  }

  if (ids.includes(DEFAULT_RECOMMENDED_TRACK_ID)) {
    return DEFAULT_RECOMMENDED_TRACK_ID;
  }

  return ids[0] || DEFAULT_RECOMMENDED_TRACK_ID;
}

function getTrackById(tracks, trackId = '') {
  const normalizedTracks = normalizeTracks(tracks);
  return normalizedTracks.find((track) => track.id === trackId) || null;
}

function buildInsightTags(analysis = {}) {
  const tags = [];
  const urgencySource = `${analysis.urgencyText || ''} ${analysis.riskLevelText || ''}`;
  const emotionSource = analysis.emotionText || '';

  if (/高|立刻|马上|尽快|催|高压/.test(urgencySource)) {
    tags.push('高压');
  } else if (urgencySource) {
    tags.push('可控');
  }

  if (/不接受解释|别解释/.test(emotionSource)) {
    tags.push('不接受解释');
  } else if (/施压|强势/.test(emotionSource)) {
    tags.push('有压迫感');
  } else if (emotionSource) {
    tags.push('先要结果');
  }

  if (!tags.length && analysis.recommendedMove) {
    tags.push('先给结果');
  }

  return tags.slice(0, 2);
}

module.exports = {
  DEFAULT_RECOMMENDED_TRACK_ID,
  resolveRecommendedTrackId,
  getTrackById,
  buildInsightTags,
};
