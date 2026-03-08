import path from 'path';

const WORKSPACE = '/home/ec2-user/.openclaw/workspace';

export function resolverForServerStoredFlow() {
  return (step) => ({
    before: step.screenshots?.beforeUrl || null,
    after: step.screenshots?.afterUrl || null,
    highlight: step.screenshots?.highlightedUrl || null
  });
}

export function resolverForExtractedPackage(extractDir) {
  return (step) => {
    const b = step.screenshots?.beforeUrl ? packageUrlFromStepPath(extractDir, step.id, 'before') : null;
    const a = step.screenshots?.afterUrl ? packageUrlFromStepPath(extractDir, step.id, 'after') : null;
    const h = step.screenshots?.highlightedUrl ? packageUrlFromStepPath(extractDir, step.id, 'highlight') : null;
    return { before: b, after: a, highlight: h };
  };
}

function packageUrlFromStepPath(extractDir, stepId, kind) {
  // exposed via /reveal/api/player/packages/:sessionToken/assets/*
  const token = path.basename(extractDir);
  return `/reveal/api/player/packages/${token}/assets/${kind}/${encodeURIComponent(stepId)}.jpg`;
}

export function packageAssetFsPath(extractDir, kind, stepId) {
  const base = kind === 'highlight' ? 'assets/highlights' : 'assets/screenshots';
  return path.join(extractDir, base, `${stepId}-${kind}.jpg`);
}

export function safeAssetPath(token, kind, stepId) {
  const baseDir = path.join(WORKSPACE, 'reveal', 'storage', 'player-packages', token);
  const base = kind === 'highlight' ? 'assets/highlights' : 'assets/screenshots';
  return path.join(baseDir, base, `${stepId}-${kind}.jpg`);
}
