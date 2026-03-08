import { visualRefsForStep, hasMajorTransition } from './visualAssemblyService.js';

function sceneId(i) { return `scene_${i + 1}`; }
function shotId(sceneIdx, shotIdx) { return `shot_${sceneIdx + 1}_${shotIdx + 1}`; }

function shotTypeFor(step) {
  if (step.highlight) return 'highlight_focus';
  if ((step.hotspots || []).length) return 'zoom_target';
  if ((step.annotations || []).length) return 'annotation_focus';
  if (step.overlay) return 'overlay_callout';
  return 'full_frame';
}

function estimateShotMs(step, type) {
  const base = Number(step.stepDurationMs || step.timing?.estimatedDurationMs || 2200);
  const bump = type === 'highlight_focus' ? 400 : type === 'annotation_focus' ? 300 : type === 'transition_hold' ? 500 : 0;
  return Math.max(900, base + bump);
}

export function deriveScenesAndShots({ steps = [], narrationSections = [] } = {}) {
  if (!steps.length) return { scenes: [], totalEstimatedDurationMs: 0 };

  const scenes = [];
  let current = null;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const prev = i > 0 ? steps[i - 1] : null;
    const section = narrationSections[i] || null;
    const newScene = !current
      || hasMajorTransition(prev, step)
      || (section && section.stepIndex !== i)
      || ((step.overlay?.progressionMode || 'manual') !== (prev?.overlay?.progressionMode || 'manual'));

    if (newScene) {
      current = {
        sceneId: sceneId(scenes.length),
        orderIndex: scenes.length,
        stepIndexRange: { start: i, end: i },
        title: step.title || `Scene ${scenes.length + 1}`,
        objective: step.intent || section?.narrationText || 'Complete step objective',
        estimatedDurationMs: 0,
        transitionIn: scenes.length ? 'cut' : 'none',
        transitionOut: 'cut',
        narrationSectionRefs: section ? [section.sectionId] : [],
        visualRefs: visualRefsForStep(step),
        shots: [],
        metadata: { progressionMode: step.overlay?.progressionMode || 'manual' }
      };
      scenes.push(current);
      if (scenes.length > 1) scenes[scenes.length - 2].transitionOut = 'cut';
    }

    current.stepIndexRange.end = i;
    if (section && !current.narrationSectionRefs.includes(section.sectionId)) current.narrationSectionRefs.push(section.sectionId);

    const shots = [];
    if (i === current.stepIndexRange.start) {
      shots.push({
        shotType: 'full_frame',
        title: `Establish: ${step.title || `Step ${i + 1}`}`,
        purpose: 'Set context',
        sourceAssetRef: step.screenshotAfter || step.screenshotBefore || null,
        highlightRef: null,
        hotspotRefs: [],
        overlayRef: step.overlay || null,
        estimatedDurationMs: 900,
        emphasis: 'none',
        notes: null,
        metadata: {}
      });
    }

    const typ = shotTypeFor(step);
    shots.push({
      shotType: typ,
      title: step.title || `Step ${i + 1}`,
      purpose: step.intent || 'Show action and outcome',
      sourceAssetRef: step.screenshotAfter || step.screenshotBefore || null,
      highlightRef: step.highlight || null,
      hotspotRefs: (step.hotspots || []).map((h) => h.hotspotId),
      overlayRef: step.overlay || null,
      estimatedDurationMs: estimateShotMs(step, typ),
      emphasis: step.overlay?.emphasisMode || 'none',
      notes: (step.annotations || []).map((a) => a.text).join(' | ') || null,
      metadata: { stepIndex: i }
    });

    if ((step.annotations || []).length) {
      shots.push({
        shotType: 'annotation_focus',
        title: `Annotation: ${step.title || `Step ${i + 1}`}`,
        purpose: 'Call out annotation detail',
        sourceAssetRef: step.screenshotAfter || step.screenshotBefore || null,
        highlightRef: step.highlight || null,
        hotspotRefs: [],
        overlayRef: null,
        estimatedDurationMs: 1100,
        emphasis: 'none',
        notes: (step.annotations || []).map((a) => a.text).join(' | '),
        metadata: { stepIndex: i }
      });
    }

    for (const s of shots) {
      const idx = current.shots.length;
      current.shots.push({
        shotId: shotId(current.orderIndex, idx),
        sceneId: current.sceneId,
        stepIndex: i,
        ...s,
        startOffsetMs: 0,
        endOffsetMs: 0
      });
    }
  }

  let total = 0;
  for (const sc of scenes) {
    let local = 0;
    for (const sh of sc.shots) {
      sh.startOffsetMs = total + local;
      local += Number(sh.estimatedDurationMs || 0);
      sh.endOffsetMs = total + local;
    }
    sc.estimatedDurationMs = local;
    total += local;
  }

  return { scenes, totalEstimatedDurationMs: total };
}
