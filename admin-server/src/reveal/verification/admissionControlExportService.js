export function exportExternalVerifierProfile(profile, format = 'json') {
  if (format === 'json') return { contentType: 'application/json', filename: `${profile.externalVerifierProfileId}.json`, content: JSON.stringify(profile, null, 2) };
  if (format === 'compliance_verdict') {
    const verdict = {
      verdictId: `cv_${profile.externalVerifierProfileId}`,
      targetRef: profile.targetRef,
      policyProfile: { id: profile.policyProfileId, name: profile.policyProfileName },
      overallVerdict: profile.overallVerdict,
      admissionDecision: profile.admissionDecision,
      blockingReasons: profile.blockingReasons || [],
      warnings: profile.warnings || [],
      verifiedAt: profile.createdAt,
      verifierPackageId: profile.unifiedPackageSummary?.verifierPackageId || null,
      latestAttestationSnapshotId: profile.attestationSnapshotSummary?.latestAttestationSnapshotId || null,
      latestAttestationTrustPublicationId: profile.attestationTrustPublicationSummary?.attestationTrustPublicationId || null,
      policyManifest: profile.policyManifestSummary,
      trustIntegritySummary: {
        attestationTrustStatus: profile.attestationTrustPublicationSummary?.status || null,
        policyManifestValidity: profile.policyManifestSummary?.validityStatus || null
      },
      digest: null
    };
    return { contentType: 'application/json', filename: `${profile.externalVerifierProfileId}-compliance-verdict.json`, content: JSON.stringify(verdict, null, 2) };
  }
  if (format !== 'markdown') return { error: 'invalid_export_format' };

  const lines = [];
  lines.push(`# External Verifier Profile ${profile.externalVerifierProfileId}`);
  lines.push('', `- Policy: ${profile.policyProfileId}`);
  lines.push(`- Verdict: ${profile.overallVerdict}`);
  lines.push(`- Admission: ${profile.admissionDecision}`);
  lines.push(`- Blocking: ${(profile.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(profile.warnings || []).join(', ') || 'none'}`);
  lines.push('', '## Summaries');
  lines.push('```json');
  lines.push(JSON.stringify({
    unifiedPackageSummary: profile.unifiedPackageSummary,
    attestationSnapshotSummary: profile.attestationSnapshotSummary,
    attestationTrustPublicationSummary: profile.attestationTrustPublicationSummary,
    policyManifestSummary: profile.policyManifestSummary
  }, null, 2));
  lines.push('```');
  return { contentType: 'text/markdown; charset=utf-8', filename: `${profile.externalVerifierProfileId}.md`, content: lines.join('\n') + '\n' };
}
