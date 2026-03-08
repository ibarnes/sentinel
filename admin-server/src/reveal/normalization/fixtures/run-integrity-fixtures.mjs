import fs from 'fs/promises';
import path from 'path';
import { normalizeElementBox, validateNormalizedBox } from '../../services/coordinateNormalizationService.js';
import { checksumForReplay, REPLAY_CHECKSUM_VERSION, explainChecksumDiff } from '../../services/replayIntegrityService.js';

const DIR = path.resolve('/home/ec2-user/.openclaw/workspace/admin-server/src/reveal/normalization/fixtures');
const BASELINE = path.join(DIR, 'integrity-baseline.v1.json');
const targets = [
  'nested-iframe-chain.raw.json',
  'partial-frame-chain.raw.json',
  'mismatched-dimensions.raw.json',
  'out-of-bounds-highlight.raw.json',
  'transform-estimated.raw.json'
];

const update = process.argv.includes('--update');
const baseline = JSON.parse(await fs.readFile(BASELINE, 'utf8').catch(() => '{}'));
baseline.version = REPLAY_CHECKSUM_VERSION;
baseline.checksums = baseline.checksums || {};
baseline.sources = baseline.sources || {};

let failures = 0;
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
  const val = norm.ok ? validateNormalizedBox(norm.box, norm.box.normalizedViewport) : { ok: false, reason: norm.reason, trace: [] };

  const replay = {
    stepId: f,
    sourceBox: raw.target?.boundingBox || null,
    sourceViewport: { width: raw.viewport?.width || 0, height: raw.viewport?.height || 0, scrollX: raw.scrollX || 0, scrollY: raw.scrollY || 0 },
    sourceScales: { devicePixelRatio: raw.devicePixelRatio || 1, zoom: raw.zoom || 1, cssTransformScale: raw.cssTransformScale || 1 },
    frameTrace: { frameChain: raw.frameChain || [], framePath: raw.framePath || 'top' },
    normalizationTrace: norm.trace || [],
    validationTrace: val.trace || [],
    finalBoxes: { normalizedBox: norm.ok ? norm.box : null, renderedBox: null, projectedBox: norm.projectedBox || null },
    finalHighlight: { mode: val.ok ? 'rendered' : 'fallback', fallbackReason: val.ok ? null : val.reason, driftRatio: norm.driftRatio || null, driftWarning: Boolean(norm.driftWarning) },
    warnings: val.ok ? [] : [`validation_failed:${val.reason}`],
    coordinateConfidence: val.ok ? 0.8 : 0.45,
    coordinateConfidenceReasonCodes: val.ok ? ['fixture_ok'] : ['fixture_validation_failed']
  };

  const { replayChecksum, checksumSource } = checksumForReplay(replay);
  const expected = baseline.checksums[f];
  const expectedSource = baseline.sources[f];

  if (update || !expected) {
    baseline.checksums[f] = replayChecksum;
    baseline.sources[f] = checksumSource;
    console.log(`BASELINE_SET ${f} ${replayChecksum}`);
    continue;
  }

  if (expected !== replayChecksum) {
    failures += 1;
    const diff = explainChecksumDiff(expectedSource, checksumSource, { maxDivergences: 10 });
    console.error(`MISMATCH ${f}\n  expected=${expected}\n  actual=${replayChecksum}`);
    if (diff.firstDivergence) {
      console.error(`  firstDivergence path=${diff.firstDivergence.path} stage=${diff.firstDivergence.stage} reason=${diff.firstDivergence.reason}`);
      console.error(`  stored=${JSON.stringify(diff.firstDivergence.storedValue)}`);
      console.error(`  current=${JSON.stringify(diff.firstDivergence.currentValue)}`);
    }
  } else {
    console.log(`OK ${f} ${replayChecksum}`);
  }
}

if (update || Object.values(baseline.checksums).some((v) => !v) || !Object.keys(baseline.sources).length) {
  await fs.writeFile(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
}

if (!update && failures > 0) process.exit(1);
