import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const DEFAULT_WORKSPACE_ROOT = '/home/ec2-user/.openclaw/workspace';
const WORKSPACE_ROOT = path.resolve(process.env.OPENCLAW_DASHBOARD_ROOT || DEFAULT_WORKSPACE_ROOT);
const ENV_FILE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '.env');
const CACHE_ROOT = path.join(WORKSPACE_ROOT, 'state', 'uos-core');
const VALIDATION_REPORT_FILE = path.join(CACHE_ROOT, 'last-validation.json');

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith('#')) continue;
      const index = text.indexOf('=');
      if (index <= 0) continue;
      const key = text.slice(0, index).trim();
      let value = text.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {}
}

loadEnvFile(ENV_FILE);

const API_BASE_URL = process.env.UOS_CORE_API_BASE_URL || 'https://uos.unifiedstategroup.com/api/public/v1';
const API_TIMEOUT_MS = Number(process.env.UOS_CORE_TIMEOUT_MS || '20000');
const DEFAULT_STALE_HOURS = Number(process.env.UOS_CORE_STALE_HOURS || '168');

const EXPLICIT_ERROR_MESSAGES = new Map([
  [401, 'UOS Core authentication failed. Check the server-side UOS token.'],
  [403, 'UOS Core denied access for this resource.'],
  [404, 'The requested UOS Core record was not found.'],
  [422, 'UOS Core rejected the request payload as invalid.'],
  [429, 'UOS Core rate limited the request. Respect Retry-After before retrying.'],
  [500, 'UOS Core returned a server error.']
]);

function nowIso() {
  return new Date().toISOString();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function lowerString(value) {
  return cleanString(value).toLowerCase();
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toObject(value) {
  return isObject(value) ? value : {};
}

function createCorrelationId() {
  return crypto.randomUUID();
}

function getToken() {
  return cleanString(process.env.UOS_CORE_TOKEN);
}

function getTokenConfigured() {
  return Boolean(getToken());
}

function makeErrorMessage(status, fallback = '') {
  return EXPLICIT_ERROR_MESSAGES.get(status) || fallback || `UOS Core request failed with status ${status}.`;
}

function parseRetryAfter(value) {
  const text = cleanString(value);
  if (!text) return null;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return { raw: text, seconds };
  }
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    return { raw: text, seconds: null };
  }
  return {
    raw: text,
    seconds: Math.max(0, Math.ceil((timestamp - Date.now()) / 1000))
  };
}

function safeSlug(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function serializeForCache(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify({ note: 'Unable to serialize value for cache.' }, null, 2);
  }
}

async function writeJsonAtomic(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const next = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(next, `${serializeForCache(value)}\n`, 'utf8');
  await fsp.rename(next, filePath);
}

function pickFirst(value, keys) {
  if (!isObject(value)) return undefined;
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null && value[key] !== '') {
      return value[key];
    }
  }
  return undefined;
}

function extractCollection(payload, preferredKeys = []) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isObject(payload)) {
    return [];
  }

  for (const key of preferredKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value) && !['errors', 'warnings'].includes(key)) {
      return value;
    }
  }

  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function parseDate(value) {
  const text = cleanString(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDateForDisplay(value) {
  const timestamp = parseDate(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : cleanString(value) || '—';
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function textIncludesAny(value, needles) {
  const haystack = lowerString(value);
  return needles.some((needle) => haystack.includes(needle));
}

function stringifyCompact(value) {
  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value)) {
    return value.map((item) => stringifyCompact(item)).filter(Boolean).join(' | ');
  }
  if (isObject(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${stringifyCompact(item)}`)
      .filter((entry) => !entry.endsWith(': '))
      .join(' | ');
  }
  return cleanString(value);
}

export class UosCoreApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'UosCoreApiError';
    this.status = details.status || 500;
    this.correlationId = details.correlationId || null;
    this.retryAfter = details.retryAfter || null;
    this.body = details.body;
    this.url = details.url || '';
    this.method = details.method || 'GET';
    this.code = details.code || 'uos_core_error';
  }
}

async function requestJson(endpoint, { method = 'GET', query = null, body = undefined, correlationId = null, cacheKey = '' } = {}) {
  const token = getToken();
  if (!token) {
    throw new UosCoreApiError('Missing UOS_CORE_TOKEN in the server-side secret store.', {
      status: 500,
      correlationId: correlationId || createCorrelationId(),
      code: 'missing_uos_core_token',
      method,
      url: endpoint
    });
  }

  const requestCorrelationId = correlationId || createCorrelationId();
  const url = new URL(endpoint, API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response;
  let rawBody = '';
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Correlation-Id': requestCorrelationId,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    rawBody = await response.text();
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    throw new UosCoreApiError(isAbort ? 'UOS Core request timed out.' : `UOS Core network error: ${error?.message || 'unknown error'}`, {
      status: 502,
      correlationId: requestCorrelationId,
      code: isAbort ? 'uos_core_timeout' : 'uos_core_network_error',
      method,
      url: url.toString()
    });
  } finally {
    clearTimeout(timeoutId);
  }

  let payload = null;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { raw_body: rawBody };
    }
  }

  const responseCorrelationId = cleanString(response.headers.get('x-correlation-id')) || requestCorrelationId;
  const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
  const result = {
    ok: response.ok,
    status: response.status,
    correlation_id: responseCorrelationId,
    retry_after: retryAfter,
    url: url.toString(),
    method,
    fetched_at: nowIso(),
    payload
  };

  if (cacheKey) {
    await writeJsonAtomic(path.join(CACHE_ROOT, `${safeSlug(cacheKey)}.json`), result);
  }

  if (!response.ok) {
    throw new UosCoreApiError(makeErrorMessage(response.status, cleanString(payload?.message || payload?.error || rawBody)), {
      status: response.status,
      correlationId: responseCorrelationId,
      retryAfter,
      body: payload,
      method,
      url: url.toString(),
      code: `uos_core_http_${response.status}`
    });
  }

  return result;
}

export async function getUosHealth(options = {}) {
  return requestJson('health', { ...options, cacheKey: 'health' });
}

export async function listUosOpportunities({ limit, ...query } = {}) {
  return requestJson('opportunities', {
    query: { ...(limit === undefined ? {} : { limit }), ...query },
    cacheKey: 'opportunities'
  });
}

export async function getUosOpportunity(opportunityId, options = {}) {
  return requestJson(`opportunities/${encodeURIComponent(String(opportunityId || ''))}`, {
    ...options,
    cacheKey: `opportunity-${opportunityId}`
  });
}

export async function listUosActivities({ limit, ...query } = {}) {
  return requestJson('activities', {
    query: { ...(limit === undefined ? {} : { limit }), ...query },
    cacheKey: 'activities'
  });
}

export async function getUosCapacity(options = {}) {
  return requestJson('capacity', { ...options, cacheKey: 'capacity' });
}

export async function getUosReviewQueue(options = {}) {
  return requestJson('review-queue', { ...options, cacheKey: 'review-queue' });
}

export async function getUosConstraints(opportunityId, options = {}) {
  return requestJson('constraints', {
    ...options,
    query: { opportunity_id: opportunityId },
    cacheKey: `constraints-${opportunityId}`
  });
}

export async function getUosGateDefinitions(options = {}) {
  return requestJson('gate-definitions', { ...options, cacheKey: 'gate-definitions' });
}

export async function createUosChangeRequest(payload, options = {}) {
  return requestJson('change-requests', {
    ...options,
    method: 'POST',
    body: payload,
    cacheKey: 'change-request-create'
  });
}

export async function getUosChangeRequest(changeRequestId, options = {}) {
  return requestJson(`change-requests/${encodeURIComponent(String(changeRequestId || ''))}`, {
    ...options,
    cacheKey: `change-request-${changeRequestId}`
  });
}

function normalizeOpportunity(record) {
  const item = toObject(record);
  const opportunityId = cleanString(pickFirst(item, ['id', 'opportunity_id', 'opportunityId', 'slug', 'code']));
  const title = cleanString(pickFirst(item, ['title', 'name', 'opportunity_name', 'headline']));
  const status = cleanString(pickFirst(item, ['status', 'stage', 'gate_status', 'current_state'])) || 'unknown';
  const owner = cleanString(pickFirst(item, ['owner', 'owner_name', 'decision_owner', 'assigned_to', 'assignee']));
  const nextDueAt = pickFirst(item, ['next_due_at', 'due_at', 'due_date', 'next_action_due_at', 'next_review_at']);
  const updatedAt = pickFirst(item, ['updated_at', 'last_activity_at', 'last_updated_at', 'modified_at']);
  const authority = cleanString(pickFirst(item, ['authority_status', 'authority', 'decision_authority']));
  const staleFlag = item.stale === true || item.is_stale === true || item.staleness_state === 'stale' || item.status === 'stale';
  return {
    id: opportunityId || title || 'unknown',
    title: title || opportunityId || 'Untitled opportunity',
    status,
    owner,
    next_due_at: cleanString(nextDueAt),
    updated_at: cleanString(updatedAt),
    authority,
    stale: staleFlag,
    raw: item
  };
}

function classifyActivity(record) {
  const item = toObject(record);
  const outcomeType = lowerString(pickFirst(item, ['outcome_type', 'outcomeType', 'outcome']));
  const activityType = lowerString(pickFirst(item, ['activity_type', 'type', 'kind', 'category']));
  const status = lowerString(pickFirst(item, ['status', 'result', 'state']));
  const summary = stringifyCompact(pickFirst(item, ['summary', 'title', 'description', 'headline', 'notes']));
  const haystack = [outcomeType, activityType, status, summary].join(' | ');

  const hasDecision = textIncludesAny(haystack, ['decision', 'approved', 'approval', 'ruled']);
  const hasCommitment = textIncludesAny(haystack, ['commitment', 'committed', 'promised']);
  const hasEvidence = textIncludesAny(haystack, ['evidence', 'artifact', 'document', 'proof']);
  const hasBlocker = textIncludesAny(haystack, ['blocker', 'blocked', 'constraint', 'dependency']);
  const noChange = outcomeType === 'no_change';
  const movedForward = !noChange && (hasDecision || hasCommitment || hasEvidence || textIncludesAny(haystack, ['advanced', 'progress', 'moved', 'completed']));

  return {
    id: cleanString(pickFirst(item, ['id', 'activity_id', 'activityId'])) || summary || 'activity',
    opportunity_id: cleanString(pickFirst(item, ['opportunity_id', 'opportunityId'])),
    title: summary || cleanString(pickFirst(item, ['title', 'headline'])) || 'Untitled activity',
    owner: cleanString(pickFirst(item, ['owner', 'actor', 'performed_by', 'assignee'])),
    occurred_at: cleanString(pickFirst(item, ['occurred_at', 'timestamp', 'created_at', 'date', 'at'])),
    outcome_type: outcomeType || activityType || status || 'unknown',
    no_change: noChange,
    moved_forward: movedForward,
    produced: {
      decisions: hasDecision,
      commitments: hasCommitment,
      evidence: hasEvidence,
      blockers: hasBlocker
    },
    raw: item
  };
}

function normalizeCapacityRecord(record) {
  const item = toObject(record);
  const name = cleanString(pickFirst(item, ['owner', 'person', 'name', 'actor']));
  const available = coerceNumber(pickFirst(item, ['available_capacity', 'capacity_available', 'available_hours', 'available']));
  const allocated = coerceNumber(pickFirst(item, ['allocated_capacity', 'assigned_capacity', 'allocated_hours', 'used']));
  const utilization = coerceNumber(pickFirst(item, ['utilization', 'load_ratio', 'utilization_pct']));
  const authority = cleanString(pickFirst(item, ['authority', 'authority_status', 'decision_authority']));
  const calibration = cleanString(pickFirst(item, ['calibration_status', 'calibration', 'status']));
  const constrained = item.constrained === true || textIncludesAny(stringifyCompact(item), ['constraint', 'blocked']);
  const overloaded = item.overloaded === true || (utilization !== null && utilization >= 1) || textIncludesAny(stringifyCompact(item), ['overloaded', 'at capacity']);
  const uncalibrated = item.uncalibrated === true || textIncludesAny(calibration, ['uncalibrated', 'unknown', 'missing']);
  const missingAuthority = item.missing_authority === true || textIncludesAny(authority, ['missing', 'none', 'unknown', 'insufficient']);
  return {
    name: name || 'Unnamed capacity record',
    available_capacity: available,
    allocated_capacity: allocated,
    utilization,
    authority,
    calibration,
    constrained,
    overloaded,
    uncalibrated,
    missing_authority: missingAuthority,
    raw: item
  };
}

function normalizeReviewQueueRecord(record) {
  const item = toObject(record);
  return {
    id: cleanString(pickFirst(item, ['id', 'review_id', 'change_request_id'])) || 'review-item',
    title: cleanString(pickFirst(item, ['title', 'summary', 'name'])) || 'Review item',
    owner: cleanString(pickFirst(item, ['owner', 'review_owner', 'decision_owner', 'assignee'])),
    due_at: cleanString(pickFirst(item, ['due_at', 'due_date', 'deadline', 'next_review_at'])),
    status: cleanString(pickFirst(item, ['status', 'state'])) || 'unknown',
    authority: cleanString(pickFirst(item, ['authority', 'authority_status'])),
    raw: item
  };
}

function normalizeChangeRequestRecord(record) {
  const item = toObject(record);
  return {
    id: cleanString(pickFirst(item, ['id', 'change_request_id', 'request_id'])) || 'change-request',
    title: cleanString(pickFirst(item, ['title', 'summary', 'name'])) || 'Change request',
    status: cleanString(pickFirst(item, ['status', 'state'])) || 'unknown',
    submitted_at: cleanString(pickFirst(item, ['submitted_at', 'created_at', 'requested_at'])),
    owner: cleanString(pickFirst(item, ['owner', 'requested_by', 'submitter'])),
    raw: item
  };
}

function summarizeOpportunities(opportunities) {
  const normalized = opportunities.map(normalizeOpportunity);
  const staleCutoff = Date.now() - (DEFAULT_STALE_HOURS * 60 * 60 * 1000);
  const stale = normalized.filter((record) => {
    if (record.stale) return true;
    const updatedAt = parseDate(record.updated_at);
    return Number.isFinite(updatedAt) ? updatedAt < staleCutoff : false;
  });

  const dueNext = normalized
    .filter((record) => record.next_due_at)
    .sort((a, b) => String(a.next_due_at).localeCompare(String(b.next_due_at)))
    .slice(0, 10)
    .map((record) => ({
      id: record.id,
      title: record.title,
      owner: record.owner || 'unassigned',
      due_at: record.next_due_at,
      status: record.status
    }));

  return { normalized, stale, dueNext };
}

function summarizeActivities(activities) {
  const normalized = activities.map(classifyActivity);
  return {
    normalized,
    movedForward: normalized.filter((record) => record.moved_forward),
    producedDecisions: normalized.filter((record) => record.produced.decisions),
    producedCommitments: normalized.filter((record) => record.produced.commitments),
    producedEvidence: normalized.filter((record) => record.produced.evidence),
    producedBlockers: normalized.filter((record) => record.produced.blockers)
  };
}

function summarizeCapacity(payload) {
  const normalized = extractCollection(payload, ['capacity', 'items', 'rows']).map(normalizeCapacityRecord);
  return {
    normalized,
    constrained: normalized.filter((record) => record.constrained),
    overloaded: normalized.filter((record) => record.overloaded),
    uncalibrated: normalized.filter((record) => record.uncalibrated),
    missingAuthority: normalized.filter((record) => record.missing_authority)
  };
}

function summarizeReviewQueue(payload) {
  const normalized = extractCollection(payload, ['review_queue', 'items', 'rows']).map(normalizeReviewQueueRecord);
  return {
    normalized,
    awaitingGovernedAction: normalized.filter((record) => !['closed', 'done', 'approved', 'rejected', 'applied'].includes(lowerString(record.status)))
  };
}

function summarizeChangeRequests(changeRequests) {
  const normalized = changeRequests.map(normalizeChangeRequestRecord);
  return normalized.filter((record) => ['submitted', 'pending', 'queued', 'under_review', 'awaiting_review'].includes(lowerString(record.status)));
}

export async function getUosOverview() {
  const [opportunitiesResult, activitiesResult, capacityResult, reviewQueueResult] = await Promise.all([
    listUosOpportunities({ limit: 100 }),
    listUosActivities({ limit: 100 }),
    getUosCapacity(),
    getUosReviewQueue()
  ]);

  const opportunities = summarizeOpportunities(extractCollection(opportunitiesResult.payload, ['opportunities', 'items', 'results', 'data']));
  const activities = summarizeActivities(extractCollection(activitiesResult.payload, ['activities', 'items', 'results', 'data']));
  const capacity = summarizeCapacity(capacityResult.payload);
  const reviewQueue = summarizeReviewQueue(reviewQueueResult.payload);

  const awaitingGovernedAction = summarizeChangeRequests(
    reviewQueue.awaitingGovernedAction.map((item) => item.raw)
  );

  return {
    authoritative_system: 'UOS Core',
    token_configured: getTokenConfigured(),
    generated_at: nowIso(),
    moved_forward: activities.movedForward.map((record) => ({
      id: record.id,
      opportunity_id: record.opportunity_id || null,
      title: record.title,
      occurred_at: record.occurred_at,
      outcome_type: record.outcome_type
    })),
    produced: {
      commitments: activities.producedCommitments.map((record) => ({ id: record.id, title: record.title, occurred_at: record.occurred_at })),
      decisions: activities.producedDecisions.map((record) => ({ id: record.id, title: record.title, occurred_at: record.occurred_at })),
      evidence: activities.producedEvidence.map((record) => ({ id: record.id, title: record.title, occurred_at: record.occurred_at })),
      blockers: activities.producedBlockers.map((record) => ({ id: record.id, title: record.title, occurred_at: record.occurred_at }))
    },
    due_next: opportunities.dueNext,
    stale_opportunities: opportunities.stale.map((record) => ({
      id: record.id,
      title: record.title,
      status: record.status,
      updated_at: record.updated_at || null,
      owner: record.owner || null
    })),
    capacity_flags: {
      constrained: capacity.constrained.map((record) => ({ name: record.name, authority: record.authority || null })),
      overloaded: capacity.overloaded.map((record) => ({ name: record.name, utilization: record.utilization })),
      uncalibrated: capacity.uncalibrated.map((record) => ({ name: record.name, calibration: record.calibration || null })),
      missing_authority: capacity.missingAuthority.map((record) => ({ name: record.name, authority: record.authority || null }))
    },
    awaiting_governed_action: [
      ...reviewQueue.awaitingGovernedAction.map((record) => ({
        id: record.id,
        title: record.title,
        status: record.status,
        owner: record.owner || null,
        due_at: record.due_at || null,
        source: 'review_queue'
      })),
      ...awaitingGovernedAction.map((record) => ({
        id: record.id,
        title: record.title,
        status: record.status,
        owner: record.owner || null,
        due_at: record.submitted_at || null,
        source: 'change_request'
      }))
    ],
    api_meta: {
      opportunities: { status: opportunitiesResult.status, correlation_id: opportunitiesResult.correlation_id },
      activities: { status: activitiesResult.status, correlation_id: activitiesResult.correlation_id },
      capacity: { status: capacityResult.status, correlation_id: capacityResult.correlation_id },
      review_queue: { status: reviewQueueResult.status, correlation_id: reviewQueueResult.correlation_id }
    }
  };
}

export async function runUosValidationSequence() {
  const results = [];
  const steps = [
    { key: 'health', run: () => getUosHealth() },
    { key: 'opportunities', run: () => listUosOpportunities({ limit: 1 }) },
    { key: 'activities', run: () => listUosActivities({ limit: 10 }) },
    { key: 'capacity', run: () => getUosCapacity() }
  ];

  for (const step of steps) {
    try {
      const result = await step.run();
      results.push({
        key: step.key,
        ok: true,
        status: result.status,
        correlation_id: result.correlation_id,
        retry_after: result.retry_after
      });
    } catch (error) {
      if (error instanceof UosCoreApiError) {
        results.push({
          key: step.key,
          ok: false,
          status: error.status,
          correlation_id: error.correlationId,
          retry_after: error.retryAfter,
          error: error.message
        });
        if (error.status >= 500 || error.code === 'missing_uos_core_token') {
          break;
        }
        continue;
      }
      throw error;
    }
  }

  const report = {
    generated_at: nowIso(),
    base_url: API_BASE_URL,
    token_configured: getTokenConfigured(),
    results
  };
  await writeJsonAtomic(VALIDATION_REPORT_FILE, report);
  return report;
}

export function getUosConfigSummary() {
  return {
    base_url: API_BASE_URL,
    token_configured: getTokenConfigured(),
    cache_root: CACHE_ROOT,
    validation_report_file: VALIDATION_REPORT_FILE
  };
}

export { WORKSPACE_ROOT, CACHE_ROOT, VALIDATION_REPORT_FILE };
