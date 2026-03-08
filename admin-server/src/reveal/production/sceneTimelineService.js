export function mapSceneTimeline(scenes = []) {
  let cursor = 0;
  return scenes.map((s, i) => {
    const duration = Number(s.estimatedDurationMs || 0);
    const row = {
      sceneStartMs: cursor,
      sceneEndMs: cursor + duration,
      timelineOrder: i,
      linkedNarrationDurationMs: duration,
      linkedVisualDurationMs: duration,
      transitionPaddingMs: i === 0 ? 0 : 200,
      progressionMode: s.metadata?.progressionMode || 'manual'
    };
    cursor += duration;
    return { ...s, timeline: row };
  });
}
