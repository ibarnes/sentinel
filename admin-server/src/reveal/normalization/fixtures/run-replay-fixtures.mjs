import fs from 'fs/promises';
import path from 'path';
import { normalizeElementBox, validateNormalizedBox } from '../../services/coordinateNormalizationService.js';

const DIR = path.resolve('/home/ec2-user/.openclaw/workspace/admin-server/src/reveal/normalization/fixtures');
const targets = [
  'nested-iframe-chain.raw.json',
  'partial-frame-chain.raw.json',
  'mismatched-dimensions.raw.json',
  'out-of-bounds-highlight.raw.json',
  'transform-estimated.raw.json'
];

for (const f of targets) {
  const arr = JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'));
  const raw = arr[0]?.metadata?.raw || {};
  const norm = normalizeElementBox({
    elementBox: raw.target?.boundingBox,
    screenshotMeta: {
      width: raw.highlight?.metadata?.width || (raw.viewport?.width || 0) * (raw.devicePixelRatio || 1),
      height: raw.highlight?.metadata?.height || (raw.viewport?.height || 0) * (raw.devicePixelRatio || 1),
      viewportWidth: raw.viewport?.width || 0,
      viewportHeight: raw.viewport?.height || 0,
      devicePixelRatio: raw.devicePixelRatio || 1
    },
    eventMeta: {
      devicePixelRatio: raw.devicePixelRatio || 1,
      zoom: raw.zoom || 1,
      cssTransformScale: raw.cssTransformScale || 1,
      viewportWidth: raw.viewport?.width || 0,
      viewportHeight: raw.viewport?.height || 0,
      scrollX: raw.scrollX || 0,
      scrollY: raw.scrollY || 0,
      frameChain: raw.frameChain,
      frameOffsetX: raw.frameOffsetX || 0,
      frameOffsetY: raw.frameOffsetY || 0,
      framePath: raw.framePath || 'top',
      frameOrigin: raw.frameOrigin || null
    }
  });
  const val = norm.ok ? validateNormalizedBox(norm.box, norm.box.normalizedViewport) : { ok: false, reason: norm.reason };
  console.log(`${f}: norm=${norm.ok} val=${val.ok} drift=${norm.driftRatio ?? 'n/a'} reasons=${val.reason || 'ok'}`);
}
