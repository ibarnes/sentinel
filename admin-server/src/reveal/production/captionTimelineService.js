function words(text=''){return String(text).trim().split(/\s+/).filter(Boolean);}

export function deriveCaptions(segments = [], { maxWordsPerCue = 10, minCueMs = 600 } = {}) {
  const captions = [];
  let idx = 0;
  for (const seg of segments) {
    const w = words(seg.narrationText || '');
    const chunks = [];
    for (let i = 0; i < w.length; i += maxWordsPerCue) chunks.push(w.slice(i, i + maxWordsPerCue));
    if (!chunks.length) chunks.push(['']);

    const span = Math.max(minCueMs * chunks.length, Number(seg.endOffsetMs || 0) - Number(seg.startOffsetMs || 0));
    const cueDur = Math.max(minCueMs, Math.floor(span / chunks.length));
    let start = Number(seg.startOffsetMs || 0);

    for (let c = 0; c < chunks.length; c += 1) {
      const text = chunks[c].join(' ').trim();
      const end = c === chunks.length - 1 ? Number(seg.endOffsetMs || start + cueDur) : start + cueDur;
      captions.push({
        captionId: `cap_${idx + 1}`,
        orderIndex: idx,
        sourceSegmentId: seg.segmentId,
        text,
        startOffsetMs: start,
        endOffsetMs: Math.max(start + minCueMs, end),
        lineIndex: 0,
        styleHint: 'default',
        metadata: {}
      });
      idx += 1;
      start = end;
    }
  }

  const totalDurationMs = captions.length ? captions[captions.length - 1].endOffsetMs : 0;
  const subtitleTracks = [{ trackId: 'default-en', locale: 'en', formatSupport: ['srt','vtt','json'], totalCueCount: captions.length, totalDurationMs }];
  return { captions, subtitleTracks };
}
