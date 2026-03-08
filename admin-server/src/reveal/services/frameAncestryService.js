function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function normalizeFrameChain(rawChain, fallback = {}) {
  const chain = Array.isArray(rawChain) ? rawChain : [];
  const out = [];

  for (const node of chain) {
    if (!node || typeof node !== 'object') {
      out.push({ unresolved: true, reason: 'malformed_frame_node' });
      continue;
    }
    out.push({
      framePath: String(node.framePath || 'unknown'),
      frameOrigin: node.frameOrigin || null,
      frameOffsetX: num(node.frameOffsetX, 0),
      frameOffsetY: num(node.frameOffsetY, 0),
      viewportWidth: num(node.viewportWidth, 0),
      viewportHeight: num(node.viewportHeight, 0),
      unresolved: Boolean(node.unresolved)
    });
  }

  if (!out.length) {
    out.push({
      framePath: String(fallback.framePath || 'top'),
      frameOrigin: fallback.frameOrigin || null,
      frameOffsetX: num(fallback.frameOffsetX, 0),
      frameOffsetY: num(fallback.frameOffsetY, 0),
      viewportWidth: num(fallback.viewportWidth, 0),
      viewportHeight: num(fallback.viewportHeight, 0),
      unresolved: false
    });
  }

  return out;
}

export function accumulateFrameOffsets(frameChain = []) {
  let x = 0;
  let y = 0;
  let unresolvedSegments = 0;

  for (const n of frameChain) {
    if (n?.unresolved) unresolvedSegments += 1;
    x += num(n?.frameOffsetX, 0);
    y += num(n?.frameOffsetY, 0);
  }

  const impossible = Math.abs(x) > 100000 || Math.abs(y) > 100000;
  return {
    x,
    y,
    unresolvedSegments,
    complete: unresolvedSegments === 0,
    impossible
  };
}

export function frameChainSummary(frameChain = []) {
  return frameChain.map((n) => `${n.framePath || 'unknown'}@${n.frameOffsetX || 0},${n.frameOffsetY || 0}${n.unresolved ? '?': ''}`).join(' -> ');
}
