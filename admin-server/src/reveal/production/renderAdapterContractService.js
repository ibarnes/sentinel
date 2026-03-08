import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getUnifiedVerifierPackage } from '../verification/unifiedVerifierService.js';
import { getExternalVerifierProfile } from '../verification/externalVerifierProfileService.js';
import { getShotList } from './shotListService.js';
import { getShotListSnapshot } from './shotListSnapshotService.js';
import { getVoiceTrackPlan } from './voiceTrackPlanService.js';
import { buildExecutionPlan } from './executionPayloadService.js';
import { deriveOutputTargets } from './outputTargetService.js';
import { validateAdapterContract } from './adapterValidationService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/render-adapter-contracts';
function id(){ return `rac_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function fileFor(renderAdapterContractId){ return path.join(ROOT, `${renderAdapterContractId}.json`); }

async function writeContract(c){ await fs.mkdir(ROOT,{recursive:true}); await fs.writeFile(fileFor(c.renderAdapterContractId), JSON.stringify(c,null,2)); }
export async function getRenderAdapterContract(renderAdapterContractId){ try{return {renderAdapterContract: JSON.parse(await fs.readFile(fileFor(renderAdapterContractId),'utf8'))};}catch{return {error:'render_adapter_contract_not_found'};} }

function policyReadiness({ profile, unified, external }) {
  const blockingReasons = [];
  const warnings = [];
  if (external) {
    if (external.admissionDecision === 'deny') blockingReasons.push(...(external.blockingReasons || ['policy_failed']));
    else if (external.admissionDecision === 'admit_with_warnings') warnings.push(...(external.warnings || []));
  } else if (unified) {
    if ((unified.blockingReasons || []).length) blockingReasons.push(...unified.blockingReasons);
    if ((unified.warnings || []).length) warnings.push(...unified.warnings);
  }

  let readinessState = 'ready';
  if (blockingReasons.length) readinessState = profile === 'dev' ? 'ready_with_warnings' : 'blocked';
  else if (warnings.length) readinessState = 'ready_with_warnings';
  return { readinessState, blockingReasons, warnings };
}

function artifact(id, type, ref, required, available, trustState, integrityState, notes = null){
  return { artifactId: id, artifactType: type, artifactRef: ref, required, available, trustState, integrityState, notes };
}

export async function createRenderAdapterContract({ adapterType = null, orchestrationProfile = 'dev', verifierPackageId = null, externalVerifierProfileId = null, shotListId = null, shotListSnapshotId = null, voiceTrackPlanId = null, renderPlanId = null } = {}) {
  if (!adapterType) return { error: 'missing_adapter_type' };
  if (!['storyboard_export','narrated_walkthrough','subtitle_only','visual_only','composite_render'].includes(adapterType)) return { error: 'unsupported_adapter_type' };

  if (verifierPackageId && externalVerifierProfileId) return { error: 'conflicting_source_refs' };

  let unified = null;
  if (verifierPackageId) {
    const u = await getUnifiedVerifierPackage(verifierPackageId);
    if (u.error) return u;
    unified = u.verifierPackage;
  }

  let external = null;
  if (externalVerifierProfileId) {
    const e = await getExternalVerifierProfile(externalVerifierProfileId);
    if (e.error) return e;
    external = e.externalVerifierProfile;
  }

  const inputArtifacts = [];
  if (unified) {
    inputArtifacts.push(artifact('a_unified','unified_verifier_package',{verifierPackageId: unified.verifierPackageId},true,true,'as_reported','as_reported',null));
    if (unified.scriptTrustSummary) inputArtifacts.push(artifact('a_script','reviewed_script',{scriptId: unified.scriptTrustSummary.scriptId},true,true, unified.scriptTrustSummary.trustPublication ? 'trusted' : 'untrusted', (unified.scriptTrustSummary.integritySummary?.brokenChainLinks||0)?'failed':'pass'));
    if (unified.voiceTrustSummary) inputArtifacts.push(artifact('a_voice','voice_track_plan',{voiceTrackPlanId: unified.voiceTrustSummary.voiceTrackPlanId},true,true, unified.voiceTrustSummary.trustPublication ? 'trusted' : 'untrusted', (unified.voiceTrustSummary.integritySummary?.brokenChainLinks||0)?'failed':'pass'));
  }

  if (shotListId) {
    const sl = await getShotList(shotListId);
    if (sl.error) return sl;
    inputArtifacts.push(artifact('a_shot','shot_list',{shotListId},true,true,'unknown','unknown',null));
  }
  if (shotListSnapshotId && shotListId) {
    const ss = await getShotListSnapshot(shotListId, shotListSnapshotId);
    if (ss.error) return ss;
    inputArtifacts.push(artifact('a_shot_snap','shot_list_snapshot',{shotListId,shotListSnapshotId},false,true,'unknown','unknown',null));
  }
  if (voiceTrackPlanId) {
    const vp = await getVoiceTrackPlan(voiceTrackPlanId);
    if (vp.error) return vp;
    inputArtifacts.push(artifact('a_voice_plan','voice_track_plan',{voiceTrackPlanId},adapterType!=='storyboard_export',true,'unknown','unknown',null));
  }
  if (renderPlanId) inputArtifacts.push(artifact('a_render_plan','render_plan',{renderPlanId},false,true,'unknown','unknown',null));

  if (!inputArtifacts.length) return { error: 'missing_trusted_upstream_refs' };

  const outputTargets = deriveOutputTargets({ adapterType });
  const executionPlan = buildExecutionPlan({ adapterType, inputArtifacts, outputTargets });

  const policyEval = policyReadiness({ profile: orchestrationProfile, unified, external });

  const contract = {
    renderAdapterContractId: id(),
    createdAt: new Date().toISOString(),
    contractVersion: 'v1',
    adapterType,
    orchestrationProfile,
    targetRef: { renderAdapterContractId: null },
    sourceRefs: { verifierPackageId, externalVerifierProfileId, shotListId, shotListSnapshotId, voiceTrackPlanId, renderPlanId },
    readinessState: policyEval.readinessState,
    executionPlan,
    inputArtifacts,
    outputTargets,
    policyEvaluation: policyEval,
    blockingReasons: policyEval.blockingReasons,
    warnings: policyEval.warnings,
    metadata: { deterministic: true }
  };
  contract.targetRef.renderAdapterContractId = contract.renderAdapterContractId;

  const val = validateAdapterContract(contract);
  if (val.status === 'malformed_contract' || val.status === 'missing_required_artifact') return { error: val.status, details: val };

  await writeContract(contract);
  return { renderAdapterContract: contract };
}

export function exportRenderAdapterContract(contract, format = 'json') {
  if (format === 'json' || format === 'adapter_manifest') {
    return { contentType: 'application/json', filename: `${contract.renderAdapterContractId}.${format === 'adapter_manifest' ? 'manifest' : 'json'}.json`, content: JSON.stringify(contract, null, 2) };
  }
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [];
  lines.push(`# Render Adapter Contract ${contract.renderAdapterContractId}`);
  lines.push('', `- Adapter Type: ${contract.adapterType}`);
  lines.push(`- Orchestration Profile: ${contract.orchestrationProfile}`);
  lines.push(`- Readiness: ${contract.readinessState}`);
  lines.push(`- Blocking: ${(contract.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(contract.warnings || []).join(', ') || 'none'}`);
  lines.push('', '## Input Artifacts');
  lines.push('```json'); lines.push(JSON.stringify(contract.inputArtifacts, null, 2)); lines.push('```');
  lines.push('', '## Output Targets');
  lines.push('```json'); lines.push(JSON.stringify(contract.outputTargets, null, 2)); lines.push('```');
  lines.push('', '## Execution Plan');
  lines.push('```json'); lines.push(JSON.stringify(contract.executionPlan, null, 2)); lines.push('```');
  return { contentType: 'text/markdown; charset=utf-8', filename: `${contract.renderAdapterContractId}.md`, content: lines.join('\n') + '\n' };
}
