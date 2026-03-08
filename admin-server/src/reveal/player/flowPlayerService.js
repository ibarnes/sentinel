import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { getFlow } from '../services/retrievalService.js';
import { getSnapshot, findSnapshotById } from '../services/snapshotService.js';
import { toPlaybackStep } from './stepRendererService.js';
import { resolverForServerStoredFlow, resolverForExtractedPackage } from './assetResolverService.js';

const pexec = promisify(execFile);
const PLAYER_PKG_ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/player-packages';

function basePlaybackModel(flow, sourceType) {
  const assetResolver = resolverForServerStoredFlow();
  return {
    flowId: flow.id,
    sourceType,
    title: flow.name || 'Reveal Flow',
    description: flow.description || null,
    steps: (flow.steps || []).map((s, i) => toPlaybackStep(s, i, assetResolver))
  };
}

export async function loadFromFlow(flowId) {
  const got = await getFlow(flowId, 'preferred');
  if (!got) return { error: 'flow_not_found' };
  return { model: basePlaybackModel(got.flow, 'reviewed_flow') };
}

export async function loadFromSnapshot(flowId, snapshotId) {
  const got = flowId ? await getSnapshot(flowId, snapshotId) : await findSnapshotById(snapshotId);
  if (got.error) return got;
  const flow = { ...got.snapshot.reviewedFlow, id: got.snapshot.flowId };
  return { model: basePlaybackModel(flow, 'immutable_snapshot') };
}

export async function loadFromPackage(packagePath) {
  const token = `pkg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const extractDir = path.join(PLAYER_PKG_ROOT, token);
  await fs.mkdir(extractDir, { recursive: true });

  try {
    await pexec('unzip', ['-o', packagePath, '-d', extractDir]);
    const manifest = JSON.parse(await fs.readFile(path.join(extractDir, 'manifest.json'), 'utf8'));

    let flow;
    if (manifest.packageType === 'snapshot') {
      flow = JSON.parse(await fs.readFile(path.join(extractDir, 'snapshot.json'), 'utf8')).reviewedFlow;
    } else if (manifest.packageType === 'reviewed_flow') {
      flow = JSON.parse(await fs.readFile(path.join(extractDir, 'reviewed-flow.json'), 'utf8'));
    } else {
      return { error: 'invalid_package_type' };
    }

    if (!flow || !Array.isArray(flow.steps)) return { error: 'malformed_package_flow' };

    const assetResolver = resolverForExtractedPackage(extractDir);
    const model = {
      flowId: flow.id || manifest.flowId,
      sourceType: 'reveal_package',
      title: flow.name || 'Reveal Package Flow',
      description: flow.description || null,
      packageToken: token,
      steps: flow.steps.map((s, i) => toPlaybackStep(s, i, assetResolver))
    };

    return { model };
  } catch {
    return { error: 'malformed_package' };
  }
}
