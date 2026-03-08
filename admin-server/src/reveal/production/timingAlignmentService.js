export function alignSegmentTiming(segments = [], context = {}) {
  let cursor = 0;
  const out = [];
  for (let i = 0; i < segments.length; i += 1) {
    const s = { ...segments[i] };
    const pauseBeforeMs = Number(s.pauseBeforeMs || 120);
    const pauseAfterMs = Number(s.pauseAfterMs || 140);
    const base = Number(s.estimatedDurationMs || 1200);
    const duration = Math.max(400, base);
    const start = cursor + pauseBeforeMs;
    const end = start + duration;
    s.startOffsetMs = start;
    s.endOffsetMs = end;
    s.estimatedDurationMs = duration;
    out.push(s);
    cursor = end + pauseAfterMs;
  }
  return { segments: out, totalEstimatedDurationMs: cursor, context };
}
