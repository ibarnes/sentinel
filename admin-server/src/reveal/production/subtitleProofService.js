import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { getVoiceTrackPlan, exportVoiceTrackPlan } from './voiceTrackPlanService.js';
import { getVoicePlanSnapshot } from './voicePlanSnapshotService.js';
import { verifyVoicePlanSnapshotIntegrity } from './voicePlanIntegrityService.js';
import { getLatestVoiceTrustPublication } from './voiceTrustPublicationService.js';
import { getSigningContext } from '../services/packageSigningService.js';

const pexec = promisify(execFile);

const POLICY_PROFILES = {
  dev: { id: 'dev', requireTrustPublication: false, requireSignedTrustPublication: false, requireSnapshotIntegrity: false, requireSignedProof: false },
  internal_verified: { id: 'internal_verified', requireTrustPublication: true, requireSignedTrustPublication: false, requireSnapshotIntegrity: true, requireSignedProof: false },
  production_verified: { id: 'production_verified', requireTrustPublication: true, requireSignedTrustPublication: true, requireSnapshotIntegrity: true, requireSignedProof: true }
};

function canonicalize(v){
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(canonicalize);
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null;
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const cv = canonicalize(v[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return v;
}

function policy(profileId, ctx) {
  const p = POLICY_PROFILES[profileId] || POLICY_PROFILES.dev;
  const blockingReasons = [];
  const warnings = [];

  if (p.requireSnapshotIntegrity) {
    if (!ctx.voiceSnapshotIntegrity) blockingReasons.push('latest_voice_plan_snapshot_missing');
    else if (ctx.voiceSnapshotIntegrity.integrityStatus !== 'match') blockingReasons.push('latest_voice_plan_snapshot_integrity_failed');
  }
  if (p.requireTrustPublication) {
    if (!ctx.voiceTrustPublication) blockingReasons.push('trust_publication_missing');
    else {
      if (!ctx.voiceTrustPublication.voiceChainHeadDigest) blockingReasons.push('chain_head_digest_missing');
      if (p.requireSignedTrustPublication && ctx.voiceTrustPublication.voiceTrustPublicationSignatureStatus !== 'signed') blockingReasons.push('latest_voice_trust_publication_unsigned');
    }
  }
  if (p.id === 'dev' && !ctx.voiceTrustPublication) warnings.push('trust_publication_missing_dev_mode');

  return {
    orchestrationPolicyProfile: p.id,
    policyEvaluationResult: blockingReasons.length ? 'blocked' : 'pass',
    blockingReasons,
    warnings,
    evaluatedAt: new Date().toISOString()
  };
}

function proofPayload(bundle) {
  return canonicalize({
    manifest: bundle['subtitle-bundle-manifest.json'],
    voiceTrackPlanId: bundle['voice-track-plan.json']?.voiceTrackPlanId || null,
    voicePlanSnapshotId: bundle['voice-track-plan-snapshot.json']?.voicePlanSnapshotId || null,
    voiceTrustPublicationId: bundle['voice-trust-publication.json']?.voiceTrustPublicationId || null,
    voiceChainHeadDigest: bundle['voice-trust-publication.json']?.voiceChainHeadDigest || null,
    srt: bundle['subtitles.srt'],
    vtt: bundle['subtitles.vtt']
  });
}

function bundleHash(bundle) {
  return crypto.createHash('sha256').update(JSON.stringify(proofPayload(bundle))).digest('hex');
}

export async function buildSignedSubtitleBundle({ voiceTrackPlanId, voicePlanSnapshotId = null, format = 'signed_subtitle_bundle', orchestrationPolicyProfile = 'dev' } = {}) {
  const got = await getVoiceTrackPlan(voiceTrackPlanId);
  if (got.error) return got;
  const plan = got.voiceTrackPlan;

  let snapshot = null;
  let snapIntegrity = null;
  if (voicePlanSnapshotId) {
    const s = await getVoicePlanSnapshot(voiceTrackPlanId, voicePlanSnapshotId);
    if (s.error) return s;
    snapshot = s.snapshot;
    snapIntegrity = await verifyVoicePlanSnapshotIntegrity(voiceTrackPlanId, voicePlanSnapshotId);
  }

  const trustPubOut = await getLatestVoiceTrustPublication(voiceTrackPlanId);
  const trustPub = trustPubOut.error ? null : trustPubOut.voiceTrustPublication;

  const gate = policy(orchestrationPolicyProfile, { voiceSnapshotIntegrity: snapIntegrity, voiceTrustPublication: trustPub, voiceTrackPlan: plan });
  if (gate.policyEvaluationResult === 'blocked') return { error: 'subtitle_bundle_policy_blocked', gate };

  const manifest = {
    subtitleBundleId: `ssb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    bundleVersion: 'v1',
    voiceTrackPlanId,
    voicePlanSnapshotId: snapshot?.voicePlanSnapshotId || null,
    voiceTrustPublicationId: trustPub?.voiceTrustPublicationId || null,
    voiceChainHeadDigest: trustPub?.voiceChainHeadDigest || null,
    signatureStatus: 'unsigned',
    trustProfileSummary: trustPub?.trustProfile || null,
    createdAt: new Date().toISOString(),
    readinessState: gate
  };

  const bundle = {
    'subtitle-bundle-manifest.json': manifest,
    'voice-track-plan.json': plan,
    'voice-track-plan-snapshot.json': snapshot || null,
    'captions.json': { captions: plan.captions || [], subtitleTracks: plan.subtitleTracks || [] },
    'subtitles.srt': exportVoiceTrackPlan(plan, 'srt').content,
    'subtitles.vtt': exportVoiceTrackPlan(plan, 'vtt').content,
    'trust-summary.json': plan.metadata?.sourceApprovalTrust || null,
    'integrity-summary.json': { voiceSnapshotIntegrity: snapIntegrity || null },
    'voice-trust-publication.json': trustPub || null
  };

  const hash = bundleHash(bundle);
  const ctx = await getSigningContext();
  let proofSig = { status: 'unsigned', signatureVersion: 'subtitle-proof-sig-v1', signingKeyId: null, signingAlgorithm: 'RSA-SHA256', unsignedReason: ctx.enabled ? 'policy_unsigned' : (ctx.unsignedReason || 'missing_key') };
  if (ctx.enabled) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(canonicalize({ bundleHash: hash, manifest })));
    signer.end();
    proofSig = {
      status: 'signed',
      signature: signer.sign(ctx.privateKey, 'base64'),
      signatureVersion: 'subtitle-proof-sig-v1',
      signingKeyId: ctx.signingKeyId,
      signingAlgorithm: ctx.signingAlgorithm,
      signerKeyFingerprint: ctx.signerKeyFingerprint
    };
    manifest.signatureStatus = 'signed';
  }

  if ((POLICY_PROFILES[orchestrationPolicyProfile] || POLICY_PROFILES.dev).requireSignedProof && proofSig.status !== 'signed') {
    return { error: 'subtitle_bundle_policy_blocked', gate: { ...gate, blockingReasons: [...gate.blockingReasons, 'signed_subtitle_proof_required'] } };
  }

  bundle['proof-signature.json'] = { ...proofSig, bundleHash: hash, bundleHashVersion: 'sha256-v1' };

  if (format === 'json') return { contentType: 'application/json', filename: `${voiceTrackPlanId}-signed-subtitle-bundle.json`, content: JSON.stringify(bundle, null, 2) };
  if (format !== 'signed_subtitle_bundle') return { error: 'invalid_signed_subtitle_bundle_format' };

  const tmp = `/tmp/reveal-ssb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.mkdir(tmp, { recursive: true });
  for (const [name, value] of Object.entries(bundle)) {
    const p = path.join(tmp, name);
    if (name.endsWith('.srt') || name.endsWith('.vtt')) await fs.writeFile(p, String(value));
    else await fs.writeFile(p, JSON.stringify(value, null, 2));
  }
  const zipPath = `${tmp}.zip`;
  await pexec('zip', ['-X', '-r', zipPath, '.', '-i', '*'], { cwd: tmp });
  const buffer = await fs.readFile(zipPath);
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });
  return { contentType: 'application/zip', filename: `${voiceTrackPlanId}-signed-subtitle-bundle.zip`, buffer };
}

export async function verifySubtitleBundle(bundleObj) {
  if (!bundleObj || typeof bundleObj !== 'object') return { status: 'malformed_bundle', reasonCodes: ['missing_bundle'] };
  if (!bundleObj['subtitle-bundle-manifest.json'] || !bundleObj['voice-track-plan.json'] || !bundleObj['proof-signature.json']) return { status: 'malformed_bundle', reasonCodes: ['missing_required_files'] };

  const proof = bundleObj['proof-signature.json'];
  const expectedHash = bundleHash(bundleObj);
  if (proof.bundleHash && proof.bundleHash !== expectedHash) return { status: 'content_hash_mismatch', reasonCodes: ['bundle_hash_mismatch'], expectedHash, providedHash: proof.bundleHash };

  const trust = bundleObj['voice-trust-publication.json'];
  if (!trust) return { status: 'missing_voice_trust_publication', reasonCodes: ['missing_voice_trust_publication'] };
  if (bundleObj['subtitle-bundle-manifest.json'].voiceChainHeadDigest && trust.voiceChainHeadDigest !== bundleObj['subtitle-bundle-manifest.json'].voiceChainHeadDigest) {
    return { status: 'chain_head_mismatch', reasonCodes: ['chain_head_digest_mismatch'] };
  }

  if (proof.status !== 'signed' || !proof.signature) return { status: 'unsigned', reasonCodes: ['unsigned_bundle'] };

  const ctx = await getSigningContext();
  if (!ctx.enabled) return { status: 'unsigned', reasonCodes: ['missing_verifier_key'] };
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(JSON.stringify(canonicalize({ bundleHash: expectedHash, manifest: bundleObj['subtitle-bundle-manifest.json'] })));
  verifier.end();
  const ok = verifier.verify(ctx.publicKey, proof.signature, 'base64');
  if (!ok) return { status: 'invalid_signature', reasonCodes: ['signature_verification_failed'] };

  return { status: 'verified', reasonCodes: ['signature_verified'], bundleHash: expectedHash, trustPublicationId: trust.voiceTrustPublicationId || null };
}

export { POLICY_PROFILES, policy as evaluateOrchestrationPolicy };
