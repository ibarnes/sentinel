import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getRenderAdapterContract } from './renderAdapterContractService.js';
import { getProviderProfile, listProviderProfiles } from './providerCapabilityService.js';
import { buildProviderManifest, validateProviderManifestShape } from './providerManifestService.js';
import { mapRenderAdapterToProvider } from './providerMappingService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/provider-adapters';
const fileFor = (providerAdapterId) => path.join(ROOT, `${providerAdapterId}.json`);
const id = () => `pad_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

async function writeProviderAdapter(row) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(row.providerAdapterId), JSON.stringify(row, null, 2), 'utf8');
}

export async function getProviderAdapter(providerAdapterId) {
  try {
    return { providerAdapter: JSON.parse(await fs.readFile(fileFor(providerAdapterId), 'utf8')) };
  } catch {
    return { error: 'provider_adapter_not_found' };
  }
}

export async function createProviderAdapter({ renderAdapterContractId = null, providerType = null, providerProfileId = 'default', orchestrationProfile = null } = {}) {
  if (!renderAdapterContractId) return { error: 'missing_render_adapter_contract_id' };
  if (!providerType) return { error: 'missing_provider_type' };

  const contractOut = await getRenderAdapterContract(renderAdapterContractId);
  if (contractOut.error) return contractOut;
  const renderAdapterContract = contractOut.renderAdapterContract;

  const profileOut = getProviderProfile(providerType, providerProfileId);
  if (profileOut.error) return profileOut;

  const built = buildProviderManifest({ renderAdapterContract, providerType, providerProfileId });
  if (built.error) return built;

  let readinessState = built.readinessState;
  if (orchestrationProfile && orchestrationProfile !== renderAdapterContract.orchestrationProfile) {
    built.warnings.push('orchestration_profile_override');
    readinessState = built.blockingReasons.length ? 'blocked' : 'ready_with_warnings';
  }

  const row = {
    providerAdapterId: id(),
    createdAt: new Date().toISOString(),
    adapterVersion: 'v1',
    providerType,
    providerProfile: { providerProfileId, capabilityVersion: profileOut.providerProfile.capabilityVersion },
    sourceRenderAdapterContractId: renderAdapterContractId,
    sourceRefs: renderAdapterContract.sourceRefs,
    readinessState,
    capabilitySummary: {
      supportedStageTypes: profileOut.providerProfile.supportedStageTypes,
      supportedJobTypes: profileOut.providerProfile.supportedJobTypes,
      supportedOutputTargets: profileOut.providerProfile.supportedOutputTargets,
      unsupportedFeatures: profileOut.providerProfile.unsupportedFeatures
    },
    providerManifest: built.providerManifest,
    policyEvaluation: built.providerManifest.policySummary,
    blockingReasons: built.blockingReasons,
    warnings: built.warnings,
    metadata: { deterministic: true }
  };

  await writeProviderAdapter(row);
  return { providerAdapter: row };
}

export function exportProviderAdapter(providerAdapter, format = 'json') {
  if (format === 'json') {
    return { contentType: 'application/json', filename: `${providerAdapter.providerAdapterId}.json`, content: JSON.stringify(providerAdapter, null, 2) };
  }
  if (format === 'provider_manifest') {
    return {
      contentType: 'application/json',
      filename: `${providerAdapter.providerAdapterId}-provider-manifest.json`,
      content: JSON.stringify(providerAdapter.providerManifest, null, 2)
    };
  }
  if (format !== 'markdown') return { error: 'invalid_export_format' };

  const lines = [];
  lines.push(`# Provider Adapter ${providerAdapter.providerAdapterId}`);
  lines.push('', `- Provider: ${providerAdapter.providerType}/${providerAdapter.providerProfile.providerProfileId}`);
  lines.push(`- Source Contract: ${providerAdapter.sourceRenderAdapterContractId}`);
  lines.push(`- Readiness: ${providerAdapter.readinessState}`);
  lines.push(`- Blocking: ${(providerAdapter.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(providerAdapter.warnings || []).join(', ') || 'none'}`);
  lines.push('', '## Provider Manifest');
  lines.push('```json');
  lines.push(JSON.stringify(providerAdapter.providerManifest, null, 2));
  lines.push('```');
  return { contentType: 'text/markdown; charset=utf-8', filename: `${providerAdapter.providerAdapterId}.md`, content: `${lines.join('\n')}\n` };
}

export async function validateProviderAdapter({ providerAdapterId = null, providerManifest = null } = {}) {
  let manifest = providerManifest;
  if (!manifest && providerAdapterId) {
    const out = await getProviderAdapter(providerAdapterId);
    if (out.error) return out;
    manifest = out.providerAdapter.providerManifest;
  }
  const shape = validateProviderManifestShape(manifest);
  if (shape.status !== 'valid') return shape;

  const profile = getProviderProfile(manifest.providerType, manifest.providerProfileId);
  if (profile.error) return { status: 'unsupported_provider_profile', reasonCodes: ['unsupported_provider_profile'] };

  const supportedStages = new Set(profile.providerProfile.supportedStageTypes || []);
  const supportedJobs = new Set(profile.providerProfile.supportedJobTypes || []);

  const unsupportedStage = (manifest.executionStages || []).some((s) => !supportedStages.has(s.stageType));
  const unsupportedJob = (manifest.executionJobs || []).some((j) => !supportedJobs.has(j.jobType));
  if (unsupportedStage || unsupportedJob) {
    return { status: 'capability_mismatch', reasonCodes: [unsupportedStage ? 'unsupported_stage_type' : null, unsupportedJob ? 'unsupported_job_type' : null].filter(Boolean) };
  }

  const warnings = [];
  const blocks = [];
  for (const req of (profile.providerProfile.metadata?.requiredOutputTypes || [])) {
    if (!(manifest.outputTargetMap || []).some((o) => o.outputType === req)) blocks.push('missing_required_output_target');
  }

  if (blocks.length) return { status: 'blocked', reasonCodes: [...new Set(blocks)] };
  if (warnings.length) return { status: 'valid_with_warnings', reasonCodes: [...new Set(warnings)] };
  return { status: 'valid', reasonCodes: ['provider_manifest_valid'] };
}

export function listProviderCapabilityProfiles() {
  return listProviderProfiles();
}

export function inspectProviderCapabilityProfile(providerType, providerProfileId = 'default') {
  return getProviderProfile(providerType, providerProfileId);
}

export function previewProviderMapping({ renderAdapterContract, providerType, providerProfileId = 'default' }) {
  return mapRenderAdapterToProvider({ renderAdapterContract, providerType, providerProfileId });
}
