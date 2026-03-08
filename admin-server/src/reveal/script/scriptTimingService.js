function countWords(text = '') {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

export function estimateSectionTiming(section, profile) {
  const wpm = Number(profile.wordsPerMinute || 145);
  const narrationWords = countWords(section.narrationText || '');
  const narrationMs = Math.max(900, Math.round((narrationWords / wpm) * 60000));

  const hotspotPenalty = (section.visualRefs?.hotspotIds || []).length * 180;
  const complexityPenalty = section.metadata?.interactionComplexity === 'high' ? 350 : section.metadata?.interactionComplexity === 'medium' ? 180 : 0;

  const leadInMs = Number(profile.leadInMs || 250);
  const leadOutMs = Number(profile.leadOutMs || 250);
  const estimatedDurationMs = Math.max(1200, narrationMs + hotspotPenalty + complexityPenalty + leadInMs + leadOutMs);

  return {
    estimatedDurationMs,
    leadInMs,
    leadOutMs
  };
}

export function estimateTotalDuration(sections = []) {
  return sections.reduce((sum, s) => sum + Math.max(0, Number(s.timing?.estimatedDurationMs || 0)), 0);
}
