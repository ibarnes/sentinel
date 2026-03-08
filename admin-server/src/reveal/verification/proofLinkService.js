import { getRenderAdapterContract } from '../production/renderAdapterContractService.js';
import { getExternalVerifierProfile, latestExternalVerifierProfile } from './externalVerifierProfileService.js';
import { getAdmissionCertificate, latestAdmissionCertificate } from './admissionCertificateService.js';
import { getAdapterTrustPublication, getLatestAdapterTrustPublication } from './adapterTrustPublicationService.js';
import { getAttestationTrustPublication, getLatestAttestationTrustPublication } from './attestationTrustPublicationService.js';
import { getPolicyManifest } from './policyManifestService.js';

export async function resolveProofLinks({ renderAdapterContractId = null, externalVerifierProfileId = null, admissionCertificateId = null, adapterTrustPublicationId = null, attestationTrustPublicationId = null, policyProfileId = 'dev', mode = 'latest' } = {}) {
  if (mode === 'explicit_refs' && (!renderAdapterContractId || !externalVerifierProfileId || !admissionCertificateId)) {
    return { error: 'missing_required_refs_for_explicit_mode' };
  }

  const adapter = renderAdapterContractId ? await getRenderAdapterContract(renderAdapterContractId) : null;
  if (adapter?.error) return adapter;

  const external = externalVerifierProfileId
    ? await getExternalVerifierProfile(externalVerifierProfileId)
    : await latestExternalVerifierProfile({ policyProfileId, verifierPackageId: adapter?.renderAdapterContract?.sourceRefs?.verifierPackageId || null, mode: 'latest' });
  if (external?.error) return external;

  const admission = admissionCertificateId
    ? await getAdmissionCertificate(admissionCertificateId)
    : await latestAdmissionCertificate({ renderAdapterContractId: renderAdapterContractId || null, policyProfileId, adapterType: adapter?.renderAdapterContract?.adapterType || null });
  if (admission?.error) return admission;

  const adapterTrust = adapterTrustPublicationId
    ? await getAdapterTrustPublication(renderAdapterContractId || admission.admissionCertificate?.renderAdapterContractId || '', adapterTrustPublicationId)
    : await getLatestAdapterTrustPublication(renderAdapterContractId || admission.admissionCertificate?.renderAdapterContractId || '');

  const verifierPackageId = admission.admissionCertificate?.verifierPackageId || external.externalVerifierProfile?.unifiedPackageSummary?.verifierPackageId || null;
  const attTrust = attestationTrustPublicationId
    ? await getAttestationTrustPublication(verifierPackageId || '', attestationTrustPublicationId)
    : await getLatestAttestationTrustPublication(verifierPackageId || '');

  const policy = await getPolicyManifest(policyProfileId || external.externalVerifierProfile?.policyProfileId || 'dev');
  if (policy.error) return policy;

  return {
    adapter: adapter?.renderAdapterContract || null,
    external: external.externalVerifierProfile,
    admission: admission.admissionCertificate,
    adapterTrust: adapterTrust.error ? null : adapterTrust.adapterTrustPublication,
    attestationTrust: attTrust.error ? null : attTrust.attestationTrustPublication,
    policyManifest: policy.policyManifest
  };
}
