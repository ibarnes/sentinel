import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { verifyAttestationSignature, verifyBundleManifestSignature } from './attestationSigningService.js';
import { verifySubtitleBundle } from '../production/subtitleProofService.js';

const pexec = promisify(execFile);

async function unzipToTemp(buffer) {
  const base = `/tmp/reveal-verify-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const zipPath = `${base}.zip`;
  const outDir = `${base}-dir`;
  await fs.writeFile(zipPath, buffer);
  await fs.mkdir(outDir, { recursive: true });
  await pexec('unzip', ['-qq', zipPath, '-d', outDir]);
  return { zipPath, outDir };
}

async function readJsonIfExists(p) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; }
}

export async function verifyZipBundle(buffer) {
  if (!buffer?.length) return { status: 'malformed_bundle', reasonCodes: ['empty_zip_payload'] };

  let tmp = null;
  try {
    tmp = await unzipToTemp(buffer);
    const files = await fs.readdir(tmp.outDir);
    if (!files.length) return { status: 'zip_structure_invalid', reasonCodes: ['empty_archive'] };

    const hasAttestation = files.includes('attestation-report.json') && files.includes('manifest.json');
    const hasSubtitle = files.includes('subtitle-bundle-manifest.json') && files.includes('proof-signature.json');
    if (!hasAttestation && !hasSubtitle) return { status: 'missing_required_file', reasonCodes: ['unknown_bundle_layout'] };

    if (hasAttestation) {
      const manifest = await readJsonIfExists(path.join(tmp.outDir, 'manifest.json'));
      const report = await readJsonIfExists(path.join(tmp.outDir, 'attestation-report.json'));
      if (!manifest || !report) return { status: 'malformed_bundle', reasonCodes: ['invalid_attestation_files'] };

      const manSig = await verifyBundleManifestSignature(manifest);
      const attSig = await verifyAttestationSignature(report);

      let status = 'verified';
      const reasonCodes = [];
      if (manSig.status === 'invalid_signature' || attSig.status === 'invalid_signature') {
        status = 'invalid_signature';
        reasonCodes.push('signature_verification_failed');
      } else if (manSig.status === 'unsigned' || attSig.status === 'unsigned') {
        status = 'unsigned';
        reasonCodes.push('unsigned_artifact');
      }

      return {
        status,
        reasonCodes,
        bundleType: 'attestation_bundle',
        manifestSignature: manSig,
        attestationSignature: attSig
      };
    }

    // subtitle style bundle
    const bundle = {};
    for (const f of files) {
      const full = path.join(tmp.outDir, f);
      if (f.endsWith('.json')) bundle[f] = await readJsonIfExists(full);
      else bundle[f] = await fs.readFile(full, 'utf8');
    }
    const res = await verifySubtitleBundle(bundle);
    return { ...res, bundleType: 'subtitle_bundle' };
  } catch {
    return { status: 'zip_structure_invalid', reasonCodes: ['unzip_failed'] };
  } finally {
    if (tmp) {
      await fs.rm(tmp.zipPath, { force: true }).catch(() => {});
      await fs.rm(tmp.outDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
