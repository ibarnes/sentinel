export function applyPlaybackControl(totalSteps, currentStepIndex = 0, control = 'none', jumpTo = null) {
  const max = Math.max(0, Number(totalSteps || 0) - 1);
  let idx = Math.max(0, Math.min(max, Number(currentStepIndex || 0)));

  if (control === 'next') idx = Math.min(max, idx + 1);
  else if (control === 'prev') idx = Math.max(0, idx - 1);
  else if (control === 'restart') idx = 0;
  else if (control === 'jump' && jumpTo != null) idx = Math.max(0, Math.min(max, Number(jumpTo || 0)));

  return {
    currentStepIndex: idx,
    hasPrev: idx > 0,
    hasNext: idx < max,
    nextStepIndex: idx < max ? idx + 1 : null,
    prevStepIndex: idx > 0 ? idx - 1 : null,
    restartStepIndex: 0
  };
}
