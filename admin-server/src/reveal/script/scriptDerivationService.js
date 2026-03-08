import crypto from 'crypto';

function sectionId(stepIndex) {
  return `sec_${stepIndex}_${crypto.createHash('sha1').update(String(stepIndex)).digest('hex').slice(0, 8)}`;
}

function shortText(text = '', max = 48) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function actionVerb(action = 'action') {
  const m = {
    click: 'Click', type: 'Type', input: 'Enter', navigate: 'Navigate', submit: 'Submit', upload: 'Upload', select: 'Select'
  };
  return m[String(action).toLowerCase()] || 'Complete';
}

export function deriveNarrationSections(steps = [], styleProfile) {
  const out = [];

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i] || {};
    const overlayTitle = step.overlay?.title || null;
    const overlayBody = step.overlay?.body || null;
    const primaryHotspots = (step.hotspots || []).filter((h) => h.type === 'primary_target').map((h) => h.hotspotId);
    const firstAnnotation = (step.annotations || [])[0]?.text || null;

    const baseTitle = step.title || `Step ${i + 1}`;
    const why = step.intent || overlayBody || firstAnnotation || '';
    const verb = actionVerb(step.action);
    const target = step.target?.text || step.target?.selector || baseTitle;

    let narrationText = `${verb} ${target}.`;
    if (why) narrationText = `${verb} ${target} to ${why.replace(/[.]+$/,'')}.`;

    if (styleProfile.id === 'concise_training') {
      narrationText = shortText(narrationText, 96);
    }
    if (styleProfile.id === 'executive_overview') {
      narrationText = `${baseTitle}: ${shortText(why || narrationText, 110)}`;
    }

    const onScreenSeed = overlayTitle || baseTitle;
    const onScreenText = shortText(onScreenSeed, Number(styleProfile.onScreenMaxChars || 48));

    out.push({
      sectionId: sectionId(i),
      stepIndex: i,
      title: baseTitle,
      narrationText,
      onScreenText,
      timing: {
        estimatedDurationMs: 0,
        leadInMs: 0,
        leadOutMs: 0
      },
      visualRefs: {
        screenshotBefore: step.screenshotBefore || null,
        screenshotAfter: step.screenshotAfter || null,
        highlight: step.highlight || null,
        hotspotIds: primaryHotspots
      },
      emphasis: step.overlay?.emphasisMode || 'none',
      notes: step.intent || null,
      metadata: {
        action: step.action || null,
        progressionMode: step.overlay?.progressionMode || step.progression?.progressionMode || 'manual',
        interactionComplexity: primaryHotspots.length > 1 ? 'high' : primaryHotspots.length === 1 ? 'medium' : 'low'
      }
    });
  }

  return out;
}
