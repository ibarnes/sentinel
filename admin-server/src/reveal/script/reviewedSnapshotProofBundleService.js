import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { getReviewedScript, reviewedExport } from './reviewedScriptService.js';
import { getLatestTrustPublication } from './reviewedSnapshotTrustPublicationService.js';
import { recomputeReviewedSnapshotIntegrity, listReviewedSnapshots } from './reviewedScriptSnapshotService.js';
import { verifyLatestReviewedSnapshot } from './reviewedSnapshotVerificationService.js';

const pexec = promisify(execFile);

function bundleId() { return `pb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

export async function buildProofBundle(scriptId, { format = 'json' } = {}) {
  const review = await getReviewedScript(scriptId);
  if (review.error) return review;
  const trust = await getLatestTrustPublication(scriptId);
  if (trust.error) return { error: 'latest_trust_publication_missing' };

  const verifier = await verifyLatestReviewedSnapshot(scriptId);
  const integrity = await recomputeReviewedSnapshotIntegrity(scriptId);
  const chain = await listReviewedSnapshots(scriptId);
  const reviewedArtifact = reviewedExport(review, 'json', true);

  const manifest = {
    proofBundleId: bundleId(),
    scriptId,
    reviewedSnapshotId: trust.trustPublication.latestReviewedSnapshotId,
    reviewVersion: review.reviewed.reviewVersion,
    chainHeadDigest: trust.trustPublication.chainHeadDigest,
    trustPublicationId: trust.trustPublication.trustPublicationId,
    proofBundleVersion: 'v1',
    createdAt: new Date().toISOString(),
    artifactList: [
      'reviewed-script.json',
      'trust-publication.json',
      'integrity-summary.json',
      'chain-summary.json',
      'verifier-metadata.json',
      'proof-bundle-manifest.json'
    ],
    signatureStatus: trust.trustPublication.trustPublicationSignatureStatus,
    trustProfileSummary: trust.trustPublication.trustProfile || null,
    verifierEndpoint: `/reveal/api/scripts/${encodeURIComponent(scriptId)}/review/verify-latest`
  };

  const payload = {
    manifest,
    reviewedScript: JSON.parse(reviewedArtifact.content),
    trustPublication: trust.trustPublication,
    integritySummary: integrity,
    chainSummary: chain,
    verifierMetadata: verifier
  };

  if (format === 'json') {
    return {
      contentType: 'application/json',
      filename: `${scriptId}-proof-bundle.json`,
      content: JSON.stringify(payload, null, 2)
    };
  }
  if (format !== 'zip') return { error: 'invalid_proof_bundle_format' };

  const tmp = `/tmp/reveal-proof-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.mkdir(tmp, { recursive: true });
  await fs.writeFile(path.join(tmp, 'reviewed-script.json'), JSON.stringify(payload.reviewedScript, null, 2));
  await fs.writeFile(path.join(tmp, 'trust-publication.json'), JSON.stringify(payload.trustPublication, null, 2));
  await fs.writeFile(path.join(tmp, 'integrity-summary.json'), JSON.stringify(payload.integritySummary, null, 2));
  await fs.writeFile(path.join(tmp, 'chain-summary.json'), JSON.stringify(payload.chainSummary, null, 2));
  await fs.writeFile(path.join(tmp, 'verifier-metadata.json'), JSON.stringify(payload.verifierMetadata, null, 2));
  await fs.writeFile(path.join(tmp, 'proof-bundle-manifest.json'), JSON.stringify(payload.manifest, null, 2));

  const zipPath = `${tmp}.zip`;
  await pexec('zip', ['-X', '-r', zipPath, '.', '-i', '*.json'], { cwd: tmp });
  const buf = await fs.readFile(zipPath);
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });

  return {
    contentType: 'application/zip',
    filename: `${scriptId}-proof-bundle.zip`,
    buffer: buf
  };
}
