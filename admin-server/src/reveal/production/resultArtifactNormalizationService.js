import crypto from 'crypto';

export const RESULT_ARTIFACT_TYPES = [
  'subtitle_output','narration_output_ref','render_manifest_output','storyboard_output','scene_output','composite_output_ref','execution_result_summary'
];

export const PROVIDER_RESULT_SCHEMAS = {
  generic_renderer: { default: schema('generic_renderer/default') },
  subtitle_compositor: { default: schema('subtitle_compositor/default') },
  narration_pipeline: { default: schema('narration_pipeline/default') },
  scene_compositor: { default: schema('scene_compositor/default') },
  storyboard_exporter: { default: schema('storyboard_exporter/default') }
};

function schema(profile) {
  return {
    profile,
    acceptedArtifactTypes: [...RESULT_ARTIFACT_TYPES],
    requiredFieldsByArtifactType: {
      subtitle_output: ['format','outputRef','durationMs'],
      narration_output_ref: ['outputRef','durationMs'],
      render_manifest_output: ['manifestDigest','outputRefs'],
      storyboard_output: ['outputRef','frameCount'],
      scene_output: ['outputRef','sceneId'],
      composite_output_ref: ['outputRef','contentSummary'],
      execution_result_summary: ['status','completedAt','outputCount']
    },
    optionalFieldsByArtifactType: {
      subtitle_output: ['language','contentDigest','trackCount'],
      render_manifest_output: ['contentSummary','durationMs'],
      execution_result_summary: ['message','errorCode','warnings']
    },
    forbiddenFieldsByArtifactType: {
      execution_result_summary: ['outputRef'],
      subtitle_output: ['errorCode']
    },
    supportedOutputRefsByArtifactType: {
      subtitle_output: ['srt','vtt','json_subtitles'],
      narration_output_ref: ['audio_ref'],
      render_manifest_output: ['manifest_ref'],
      storyboard_output: ['storyboard_ref'],
      scene_output: ['scene_ref'],
      composite_output_ref: ['composite_ref']
    },
    trustExpectations: { requiresSignature: false, allowUnsigned: true }
  };
}

export function canonicalizeArtifactValue(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(canonicalizeArtifactValue); // semantic order preserved
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null; // normalized precision
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (['transportId','requestId','headers','runtimeMs','receivedAt'].includes(k)) continue; // transient fields excluded
      const cv = canonicalizeArtifactValue(v[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return v;
}

export function artifactPayloadDigest(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalizeArtifactValue(payload))).digest('hex');
}

export function normalizeResultArtifactPayload({ providerType, providerProfileId = 'default', artifactType, artifactPayload }) {
  const profile = PROVIDER_RESULT_SCHEMAS[providerType]?.[providerProfileId] || null;
  if (!profile) return { error: 'capability_mismatch' };
  if (!RESULT_ARTIFACT_TYPES.includes(artifactType) || !profile.acceptedArtifactTypes.includes(artifactType)) return { error: 'unsupported_artifact_type' };
  if (!artifactPayload || typeof artifactPayload !== 'object' || Array.isArray(artifactPayload)) return { error: 'malformed_artifact' };

  const required = profile.requiredFieldsByArtifactType?.[artifactType] || [];
  const missing = required.filter((f) => artifactPayload[f] === undefined);
  if (missing.length) return { error: 'malformed_artifact', reasonCodes: ['missing_required_fields_by_artifact_type'], missingFields: missing, profile };

  const forbidden = (profile.forbiddenFieldsByArtifactType?.[artifactType] || []).filter((f) => artifactPayload[f] !== undefined);
  if (forbidden.length) return { error: 'malformed_artifact', reasonCodes: ['forbidden_fields_present'], forbiddenFields: forbidden, profile };

  return {
    normalizedPayload: canonicalizeArtifactValue(artifactPayload),
    profile
  };
}
