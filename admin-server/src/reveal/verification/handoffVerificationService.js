import { verifyHandoffArtifact } from './handoffCertificationService.js';

export async function verifyHandoff({ artifactType = null, artifact = null } = {}) {
  if (!artifactType) return { status: 'malformed_handoff', reasonCodes: ['missing_artifact_type'] };
  if (!['adapter_manifest','compliance_verdict','signed_certificate'].includes(artifactType)) {
    return { status: 'malformed_handoff', reasonCodes: ['unsupported_handoff_artifact_type'] };
  }
  return verifyHandoffArtifact(artifactType, artifact);
}
