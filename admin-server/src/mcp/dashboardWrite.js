import fs from 'fs/promises';
import path from 'path';
import { DATA_ROOT, WORKSPACE_ROOT } from './dashboardData.js';

const FILES = {
  meetingMinutes: path.join(DATA_ROOT, 'meeting_minutes.json'),
  signals: path.join(DATA_ROOT, 'signals.json'),
  initiatives: path.join(DATA_ROOT, 'initiatives.json'),
  actionItems: path.join(DATA_ROOT, 'action_items.json'),
  team: path.join(DATA_ROOT, 'team.json'),
  actors: path.join(DATA_ROOT, 'actors.json'),
  dailyBusinessTruth: path.join(DATA_ROOT, 'daily_business_truth.json'),
  priorityDeclarations: path.join(DATA_ROOT, 'current_priority_declarations.json'),
  decisions: path.join(DATA_ROOT, 'decisions.json'),
  externalCommitments: path.join(DATA_ROOT, 'external_commitments.json'),
  informationGaps: path.join(DATA_ROOT, 'information_gaps.json'),
  meetingReconciliations: path.join(DATA_ROOT, 'meeting_outcome_reconciliations.json'),
  auditLog: path.join(WORKSPACE_ROOT, 'mission-control', 'activity', 'mcp-dashboard-writes.jsonl')
};

function nowIso() {
  return new Date().toISOString();
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file, value) {
  const next = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(next, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(next, file);
}

async function appendAuditEvent(event) {
  await fs.mkdir(path.dirname(FILES.auditLog), { recursive: true });
  await fs.appendFile(FILES.auditLog, `${JSON.stringify(event)}\n`, 'utf8');
}

function cleanString(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanOptionalString(value) {
  const text = cleanString(value);
  return text || undefined;
}

function cleanStringList(values) {
  const list = Array.isArray(values) ? values : [];
  return Array.from(new Set(list.map((value) => cleanString(value)).filter(Boolean)));
}

function cleanBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

const NICKNAME_EQUIVALENTS = new Map([
  ['dan', ['dan', 'danny', 'daniel']],
  ['danny', ['dan', 'danny', 'daniel']],
  ['daniel', ['dan', 'danny', 'daniel']],
  ['mike', ['michael', 'mike']],
  ['michael', ['michael', 'mike']],
  ['steve', ['stephen', 'steve', 'steven']],
  ['stephen', ['stephen', 'steve', 'steven']],
  ['steven', ['stephen', 'steve', 'steven']],
  ['rick', ['richard', 'rick', 'ricky']],
  ['ricky', ['richard', 'rick', 'ricky']],
  ['richard', ['richard', 'rick', 'ricky']]
]);

function slugToken(value) {
  const token = cleanString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token || 'ITEM';
}

function inferMeetingDate(dateTime) {
  const parsed = Date.parse(String(dateTime || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : nowIso().slice(0, 10);
}

function ensureIsoOrNow(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : nowIso();
}

function normalizeNameToken(value) {
  return cleanString(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(value) {
  const normalized = normalizeNameToken(value);
  return normalized ? normalized.split(' ') : [];
}

function equivalentNameTokens(token) {
  const direct = NICKNAME_EQUIVALENTS.get(token);
  if (direct) {
    return new Set(direct);
  }
  for (const variants of NICKNAME_EQUIVALENTS.values()) {
    if (variants.includes(token)) {
      return new Set(variants);
    }
  }
  return new Set([token]);
}

function tokensMatchLoosely(inputToken, candidateToken) {
  if (!inputToken || !candidateToken) {
    return false;
  }
  if (inputToken === candidateToken) {
    return true;
  }
  const inputVariants = equivalentNameTokens(inputToken);
  const candidateVariants = equivalentNameTokens(candidateToken);
  for (const variant of inputVariants) {
    if (candidateVariants.has(variant)) {
      return true;
    }
  }
  return candidateToken.startsWith(inputToken) || inputToken.startsWith(candidateToken);
}

function buildTeamMemberIndex(member, index) {
  const tokens = nameTokens(member?.name);
  const email = cleanOptionalString(member?.email)?.toLowerCase() || '';
  return {
    index,
    member,
    email,
    normalizedName: tokens.join(' '),
    tokens,
    richness: [
      email,
      cleanOptionalString(member?.title),
      cleanOptionalString(member?.role),
      cleanOptionalString(member?.organization),
      cleanOptionalString(member?.location),
      cleanOptionalString(member?.linkedin),
      cleanOptionalString(member?.bio),
      cleanOptionalString(member?.profile_image)
    ].filter(Boolean).length
  };
}

function isSparseTeamMember(entry) {
  return Boolean(entry) && entry.richness <= 1;
}

function pickBestExactNameMatch(exactName) {
  if (!exactName.length) {
    return null;
  }
  const ranked = [...exactName].sort((a, b) => {
    if (b.richness !== a.richness) {
      return b.richness - a.richness;
    }
    return a.index - b.index;
  });
  if (ranked.length === 1) {
    return ranked[0];
  }
  const [first, second] = ranked;
  if (first.richness > second.richness) {
    return first;
  }
  return null;
}

function pickBestEmailMatch(matches, normalizedInputName = '') {
  if (!matches.length) {
    return null;
  }
  const ranked = [...matches].sort((a, b) => {
    const aExactName = a.normalizedName === normalizedInputName ? 1 : 0;
    const bExactName = b.normalizedName === normalizedInputName ? 1 : 0;
    if (bExactName !== aExactName) {
      return bExactName - aExactName;
    }
    if (b.richness !== a.richness) {
      return b.richness - a.richness;
    }
    return a.index - b.index;
  });
  return ranked[0];
}

function findTeamMemberIndex(team, { email, name }) {
  const keyEmail = cleanOptionalString(email)?.toLowerCase() || '';
  const inputTokens = nameTokens(name);
  const normalizedInputName = inputTokens.join(' ');
  const indexedMembers = team.map((member, index) => buildTeamMemberIndex(member, index));

  if (keyEmail) {
    const exactEmail = indexedMembers.filter((entry) => entry.email === keyEmail);
    const bestExactEmail = pickBestEmailMatch(exactEmail, normalizedInputName);
    if (bestExactEmail) {
      return bestExactEmail.index;
    }
  }

  const exactName = indexedMembers.filter((entry) => entry.normalizedName && entry.normalizedName === normalizedInputName);
  const bestExactName = pickBestExactNameMatch(exactName);
  if (bestExactName && !isSparseTeamMember(bestExactName)) {
    return bestExactName.index;
  }

  if (!inputTokens.length) {
    return -1;
  }

  const candidates = indexedMembers
    .map((entry) => {
      if (!entry.tokens.length) {
        return null;
      }

      if (inputTokens.length === 1) {
        const matchesFirstToken = tokensMatchLoosely(inputTokens[0], entry.tokens[0]);
        return matchesFirstToken ? { ...entry, score: 2 } : null;
      }

      const lastInputToken = inputTokens[inputTokens.length - 1];
      const lastCandidateToken = entry.tokens[entry.tokens.length - 1];
      if (!tokensMatchLoosely(lastInputToken, lastCandidateToken)) {
        return null;
      }

      const firstInputToken = inputTokens[0];
      const firstCandidateToken = entry.tokens[0];
      if (!tokensMatchLoosely(firstInputToken, firstCandidateToken)) {
        return null;
      }

      const remainingInputTokens = inputTokens.slice(1, -1);
      const remainingCandidateTokens = entry.tokens.slice(1, -1);
      const remainingMatch = remainingInputTokens.every((token) =>
        remainingCandidateTokens.some((candidateToken) => tokensMatchLoosely(token, candidateToken))
      );
      if (!remainingMatch) {
        return null;
      }

      return { ...entry, score: 3 + remainingInputTokens.length };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.richness !== a.richness) {
        return b.richness - a.richness;
      }
      return a.index - b.index;
    });

  if (!candidates.length) {
    if (bestExactName) {
      return bestExactName.index;
    }
    return -1;
  }
  if (bestExactName && bestExactName.score === undefined) {
    const [bestCandidate] = candidates;
    if (!bestCandidate || bestExactName.richness >= bestCandidate.richness) {
      return bestExactName.index;
    }
  }
  if (candidates.length === 1) {
    return candidates[0].index;
  }

  const [first, second] = candidates;
  if (first.score > second.score) {
    return first.index;
  }
  if (first.richness > second.richness) {
    return first.index;
  }
  return -1;
}

function normalizeNextActions(actions) {
  const list = Array.isArray(actions) ? actions : [];
  return list
    .map((item) => ({
      action: cleanString(item?.action),
      owner: cleanOptionalString(item?.owner) || '',
      due: cleanOptionalString(item?.due) || '',
      status: cleanOptionalString(item?.status) || 'open'
    }))
    .filter((item) => item.action);
}

function buildMeetingId({ dateTime, title }) {
  const datePart = inferMeetingDate(dateTime);
  return `MM-${datePart}-${slugToken(title)}-${Date.now()}`;
}

function buildSignalId() {
  const stamp = nowIso().slice(0, 10);
  return `SIG-${stamp}-${Date.now()}`;
}

function buildRecordId(prefix, explicitId, label = '') {
  const cleaned = cleanOptionalString(explicitId);
  if (cleaned) {
    return cleaned;
  }
  const stamp = nowIso().slice(0, 10);
  return `${prefix}-${stamp}-${slugToken(label).slice(0, 48)}-${Date.now()}`;
}

function normalizeMeetingSource(source = {}) {
  return {
    type: cleanOptionalString(source.type) || 'mcp_submission',
    notes: cleanOptionalString(source.notes) || '',
    recorded_by: cleanOptionalString(source.recorded_by) || 'MCP',
    submitted_by: cleanOptionalString(source.submitted_by) || 'MCP',
    team_member: cleanOptionalString(source.team_member) || '',
    confidence: cleanOptionalString(source.confidence) || 'medium',
    link: cleanOptionalString(source.link) || ''
  };
}

function normalizeEvidenceRefs(values) {
  const list = Array.isArray(values) ? values : [];
  return list
    .map((item) => {
      if (typeof item === 'string') {
        const ref = cleanOptionalString(item);
        return ref ? { ref } : null;
      }
      if (!item || typeof item !== 'object') {
        return null;
      }
      const normalized = {
        ref: cleanOptionalString(item.ref) || cleanOptionalString(item.id) || '',
        type: cleanOptionalString(item.type) || '',
        label: cleanOptionalString(item.label) || '',
        url: cleanOptionalString(item.url) || '',
        note: cleanOptionalString(item.note) || ''
      };
      return normalized.ref || normalized.label || normalized.url ? normalized : null;
    })
    .filter(Boolean);
}

function normalizeApprovalContext(value) {
  const source = cleanObject(value);
  if (!Object.keys(source).length) {
    return null;
  }
  const normalized = {
    status: cleanOptionalString(source.status) || '',
    approver: cleanOptionalString(source.approver) || '',
    approval_id: cleanOptionalString(source.approvalId) || cleanOptionalString(source.approval_id) || '',
    source: cleanOptionalString(source.source) || '',
    notes: cleanOptionalString(source.notes) || ''
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function normalizeMutationContext(input = {}, tool) {
  const effectiveAt = ensureIsoOrNow(input.effectiveAt || input.effective_at);
  const context = {
    tool,
    effective_at: effectiveAt,
    changed_by: cleanOptionalString(input.changedBy || input.changed_by) || 'MCP',
    reason: cleanOptionalString(input.reason) || '',
    confidence_status: cleanOptionalString(input.confidenceStatus || input.confidence_status) || 'medium',
    source_record_ids: cleanStringList(input.sourceRecordIds || input.source_record_ids),
    evidence_refs: normalizeEvidenceRefs(input.evidenceRefs || input.evidence_refs),
    supersedes_record_ids: cleanStringList(input.supersedesRecordIds || input.supersedes_record_ids),
    approval_context: normalizeApprovalContext(input.approvalContext || input.approval_context)
  };
  return context;
}

function applySyncMetadata(record, context, now) {
  return {
    ...record,
    updated_at: now,
    last_sync: {
      ...context,
      updated_at: now
    }
  };
}

async function readCollection(file) {
  return readJson(file, []);
}

function cleanOptionalStringList(value) {
  if (value === undefined) {
    return undefined;
  }
  return cleanStringList(value);
}

function ensureRecordIndex(rows, idField, idValue, entityLabel) {
  const index = rows.findIndex((row) => cleanString(row?.[idField]) === cleanString(idValue));
  if (index < 0) {
    throw new Error(`${entityLabel} not found: ${idValue}`);
  }
  return index;
}

function maybeSet(next, current, input, inputKey, targetKey = inputKey, transform = cleanString) {
  if (!(inputKey in input)) {
    return;
  }
  const raw = input[inputKey];
  next[targetKey] = raw === null ? null : transform(raw);
  if (next[targetKey] === undefined) {
    next[targetKey] = current[targetKey];
  }
}

function maybeSetArray(next, input, inputKey, targetKey = inputKey) {
  if (!(inputKey in input)) {
    return;
  }
  next[targetKey] = cleanStringList(input[inputKey]);
}

function maybeSetBoolean(next, current, input, inputKey, targetKey = inputKey) {
  if (!(inputKey in input)) {
    return;
  }
  next[targetKey] = cleanBoolean(input[inputKey], Boolean(current[targetKey]));
}

function maybeSetNumber(next, current, input, inputKey, targetKey = inputKey) {
  if (!(inputKey in input)) {
    return;
  }
  const value = cleanNumber(input[inputKey]);
  next[targetKey] = value === undefined ? current[targetKey] : value;
}

function normalizeRegistryRecord(base, input, context, now) {
  return applySyncMetadata({
    ...base,
    source_record_ids: context.source_record_ids,
    evidence_refs: context.evidence_refs,
    supersedes_record_ids: context.supersedes_record_ids,
    confidence_status: context.confidence_status,
    approval_context: context.approval_context,
    effective_at: context.effective_at,
    changed_by: context.changed_by,
    reason: context.reason,
    tags: cleanStringList(input.tags),
    status: cleanOptionalString(input.status) || base.status || 'active'
  }, context, now);
}

async function upsertRegistryRecord({
  file,
  idField,
  idValue,
  buildRecord,
  eventType,
  entityType
}) {
  const rows = await readCollection(file);
  const now = nowIso();
  const index = rows.findIndex((row) => cleanString(row?.[idField]) === cleanString(idValue));
  const existing = index >= 0 ? rows[index] : null;
  const record = buildRecord(existing, now);
  if (existing) {
    rows[index] = record;
  } else {
    rows.push(record);
  }
  await writeJsonAtomic(file, rows);
  await appendAuditEvent({
    ts: now,
    event_type: eventType,
    entity_type: entityType,
    entity_id: record[idField],
    meta: {
      action: existing ? 'updated' : 'created',
      status: record.status || '',
      confidence_status: record.confidence_status || ''
    }
  });
  return {
    action: existing ? 'updated' : 'created',
    record
  };
}

function applyInitiativePatch(current, input, context, now) {
  const next = { ...current };
  maybeSet(next, current, input, 'name');
  maybeSet(next, current, input, 'status');
  maybeSet(next, current, input, 'macroGravitySummary', 'macro_gravity_summary');
  maybeSetArray(next, input, 'linkedBuyers', 'linked_buyers');
  maybeSet(next, current, input, 'gateStage', 'gate_stage');
  maybeSet(next, current, input, 'currentState', 'current_state');
  maybeSetNumber(next, current, input, 'readinessScore', 'readiness_score');
  maybeSetNumber(next, current, input, 'maxPossibleScore', 'max_possible_score');
  maybeSet(next, current, input, 'nextRequiredState', 'next_required_state');
  maybeSetArray(next, input, 'criticalConstraints', 'critical_constraints');
  maybeSet(next, current, input, 'primaryConstraint', 'primary_constraint');
  maybeSet(next, current, input, 'nextRequiredTransition', 'next_required_transition');
  maybeSetNumber(next, current, input, 'openDependencyCount', 'open_dependency_count');
  maybeSetBoolean(next, current, input, 'active');
  maybeSet(next, current, input, 'portfolioVisibility', 'portfolio_visibility');
  maybeSetBoolean(next, current, input, 'mandateSigned', 'mandate_signed');
  maybeSetBoolean(next, current, input, 'feeSecured', 'fee_secured');
  maybeSet(next, current, input, 'phaseBanner', 'phase_banner');
  maybeSetNumber(next, current, input, 'pathPrecisionScore', 'path_precision_score');
  maybeSet(next, current, input, 'boundaryLossRisk', 'boundary_loss_risk');
  maybeSetBoolean(next, current, input, 'internalAccessCritical', 'internal_access_critical');
  maybeSet(next, current, input, 'flowHealth', 'flow_health');
  maybeSet(next, current, input, 'dataConfidenceStatus', 'data_confidence_status');
  maybeSet(next, current, input, 'staleReason', 'stale_reason');
  maybeSet(next, current, input, 'staleMarkedAt', 'stale_marked_at', ensureIsoOrNow);
  return applySyncMetadata(next, context, now);
}

function applyActionItemPatch(current, input, context, now) {
  const next = { ...current };
  maybeSet(next, current, input, 'meetingId', 'meeting_id');
  maybeSetArray(next, input, 'initiativeIds', 'initiative_ids');
  maybeSetArray(next, input, 'buyerIds', 'buyer_ids');
  maybeSet(next, current, input, 'actionText', 'action_text');
  maybeSet(next, current, input, 'actionType', 'action_type');
  maybeSet(next, current, input, 'owner');
  maybeSetArray(next, input, 'support');
  maybeSet(next, current, input, 'decisionOwner', 'decision_owner');
  maybeSet(next, current, input, 'coordinatorLead', 'coordinator_lead');
  maybeSet(next, current, input, 'internalCoordinator', 'internal_coordinator');
  if ('due' in input || 'dueDate' in input) {
    const dueValue = cleanOptionalString(input.due ?? input.dueDate) || '';
    next.due = dueValue;
    next.due_date = dueValue;
  }
  maybeSet(next, current, input, 'status');
  maybeSet(next, current, input, 'priority');
  maybeSetNumber(next, current, input, 'effortScore', 'effort_score');
  maybeSetBoolean(next, current, input, 'stageCritical', 'stage_critical');
  maybeSetBoolean(next, current, input, 'requiresIsaac', 'requires_isaac');
  maybeSet(next, current, input, 'isaacReason', 'isaac_reason');
  maybeSet(next, current, input, 'blockerReason', 'blocker_reason');
  maybeSetArray(next, input, 'waitingOn', 'waiting_on');
  maybeSet(next, current, input, 'evidenceRef', 'evidence_ref');
  maybeSet(next, current, input, 'dataConfidenceStatus', 'data_confidence_status');
  maybeSet(next, current, input, 'staleReason', 'stale_reason');
  maybeSet(next, current, input, 'staleMarkedAt', 'stale_marked_at', ensureIsoOrNow);
  maybeSet(next, current, input, 'closedAt', 'closed_at', ensureIsoOrNow);
  if (String(next.status || '').toLowerCase() === 'done' && !next.closed_at) {
    next.closed_at = context.effective_at;
  }
  if (String(next.status || '').toLowerCase() === 'superseded' && !next.closed_at) {
    next.closed_at = context.effective_at;
  }
  return applySyncMetadata(next, context, now);
}

function registryLookupConfig(recordType) {
  const normalized = cleanString(recordType).toLowerCase();
  const map = {
    initiative: { file: FILES.initiatives, idField: 'initiative_id', entityType: 'initiative' },
    action_item: { file: FILES.actionItems, idField: 'action_id', entityType: 'action_item' },
    meeting_minutes: { file: FILES.meetingMinutes, idField: 'meeting_id', entityType: 'meeting_minutes' },
    signal: { file: FILES.signals, idField: 'signal_id', entityType: 'signal' },
    daily_business_truth: { file: FILES.dailyBusinessTruth, idField: 'truth_id', entityType: 'daily_business_truth' },
    priority_declaration: { file: FILES.priorityDeclarations, idField: 'priority_declaration_id', entityType: 'priority_declaration' },
    decision: { file: FILES.decisions, idField: 'decision_id', entityType: 'decision' },
    external_commitment: { file: FILES.externalCommitments, idField: 'commitment_id', entityType: 'external_commitment' },
    information_gap: { file: FILES.informationGaps, idField: 'gap_id', entityType: 'information_gap' },
    meeting_reconciliation: { file: FILES.meetingReconciliations, idField: 'reconciliation_id', entityType: 'meeting_reconciliation' }
  };
  const config = map[normalized];
  if (!config) {
    throw new Error(`unsupported recordType: ${recordType}`);
  }
  return config;
}

async function getMeetingByIdOrThrow(meetingId) {
  const meetings = await readCollection(FILES.meetingMinutes);
  const index = ensureRecordIndex(meetings, 'meeting_id', meetingId, 'meeting');
  return { meetings, index, meeting: meetings[index] };
}

export async function addMeetingMinutes(input) {
  const meetings = await readJson(FILES.meetingMinutes, []);
  const createdAt = nowIso();
  const dateTime = ensureIsoOrNow(input.dateTime);
  const meeting = {
    meeting_id: buildMeetingId({ dateTime, title: input.title }),
    date_time: dateTime,
    title: cleanString(input.title),
    participants: cleanStringList(input.participants),
    summary: cleanString(input.summary),
    initiative_ids: cleanStringList(input.initiativeIds),
    buyer_ids: cleanStringList(input.buyerIds),
    signal_ids: cleanStringList(input.signalIds),
    decisions: cleanStringList(input.decisions),
    risks: cleanStringList(input.risks),
    next_actions: normalizeNextActions(input.nextActions),
    source: normalizeMeetingSource(input.source),
    created_at: createdAt,
    updated_at: createdAt,
    visibility: cleanOptionalString(input.visibility) || 'internal',
    tags: cleanStringList(input.tags)
  };

  meetings.push(meeting);
  await writeJsonAtomic(FILES.meetingMinutes, meetings);
  await appendAuditEvent({
    ts: createdAt,
    event_type: 'mcp.meeting_minutes.create',
    entity_type: 'meeting_minutes',
    entity_id: meeting.meeting_id,
    meta: {
      title: meeting.title,
      participants: meeting.participants,
      buyer_ids: meeting.buyer_ids,
      initiative_ids: meeting.initiative_ids
    }
  });
  return meeting;
}

export async function addPendingSignal(input) {
  const signals = await readJson(FILES.signals, []);
  const createdAt = nowIso();
  const observedAt = ensureIsoOrNow(input.observedAt);
  const signal = {
    signal_id: buildSignalId(),
    title: cleanString(input.title),
    status: 'Monitor',
    confidence: cleanOptionalString(input.confidence) || 'Medium',
    observed_at: observedAt,
    buyer_ids: cleanStringList(input.buyerIds),
    initiative_ids: cleanStringList(input.initiativeIds),
    summary: cleanString(input.summary),
    verification_note: cleanOptionalString(input.verificationNote) || 'Pending review via MCP submission.',
    verification_status: 'pending',
    signal_class: cleanString(input.signalClass),
    model_step: cleanOptionalString(input.modelStep) || '1_collect_signals',
    system_guess: cleanOptionalString(input.systemGuess) || '',
    actor_refs: cleanStringList(input.actorRefs),
    actor_roles: cleanStringList(input.actorRoles),
    lifecycle_stage_refs: cleanStringList(input.lifecycleStageRefs),
    evidence_type: cleanOptionalString(input.evidenceType) || 'user_submission',
    evidence_strength: cleanOptionalString(input.evidenceStrength) || 'low',
    advances_hypothesis: input.advancesHypothesis !== false,
    blocks_hypothesis: Boolean(input.blocksHypothesis),
    geography: cleanStringList(input.geography),
    country: cleanOptionalString(input.country) || '',
    sources: (Array.isArray(input.sources) ? input.sources : [])
      .map((item) => ({
        label: cleanString(item?.label),
        url: cleanOptionalString(item?.url) || ''
      }))
      .filter((item) => item.label)
  };

  signals.push(signal);
  await writeJsonAtomic(FILES.signals, signals);
  await appendAuditEvent({
    ts: createdAt,
    event_type: 'mcp.signal.create_pending',
    entity_type: 'signal',
    entity_id: signal.signal_id,
    meta: {
      title: signal.title,
      signal_class: signal.signal_class,
      buyer_ids: signal.buyer_ids,
      initiative_ids: signal.initiative_ids
    }
  });
  return signal;
}

export async function upsertTeamMember(input) {
  const team = await readJson(FILES.team, []);
  const result = applyTeamMemberUpsert(team, input, { now: nowIso() });
  const sorted = [...team].sort((a, b) => cleanString(a?.name).localeCompare(cleanString(b?.name)));
  await writeJsonAtomic(FILES.team, sorted);
  await appendAuditEvent({
    ts: result.now,
    event_type: 'mcp.team.upsert',
    entity_type: 'team_member',
    entity_id: result.auditEntityId,
    meta: result.auditMeta
  });
  return {
    action: result.action,
    member: result.member
  };
}

function applyTeamMemberUpsert(team, input, { now }) {
  const email = cleanOptionalString(input.email) || '';
  const name = cleanString(input.name);
  const keyEmail = email.toLowerCase();
  const index = findTeamMemberIndex(team, { email, name });
  const currentMember = index >= 0 ? team[index] : null;
  const currentName = cleanString(currentMember?.name);
  const preserveCanonicalName = Boolean(
    currentMember
    && !keyEmail
    && normalizeNameToken(currentName)
    && normalizeNameToken(currentName) !== normalizeNameToken(name)
  );
  const resolvedName = preserveCanonicalName ? currentName : name;

  const nextMember = {
    name: resolvedName,
    email,
    title: cleanOptionalString(input.title) || '',
    status: cleanOptionalString(input.status) || 'active',
    role: cleanOptionalString(input.role) || '',
    organization: cleanOptionalString(input.organization) || '',
    location: cleanOptionalString(input.location) || '',
    linkedin: cleanOptionalString(input.linkedin) || '',
    bio: cleanOptionalString(input.bio) || '',
    updated_at: now,
    profile_image: cleanOptionalString(input.profileImage) || ''
  };

  let action = 'created';
  if (index >= 0) {
    team[index] = {
      ...team[index],
      ...Object.fromEntries(Object.entries(nextMember).filter(([, value]) => value !== '')),
      name: resolvedName,
      updated_at: now
    };
    action = 'updated';
  } else {
    team.push(nextMember);
  }

  const saved = index >= 0 ? team[index] : nextMember;
  return {
    now,
    action,
    member: saved,
    auditEntityId: email || name,
    auditMeta: {
      action,
      name: resolvedName,
      email,
      title: saved.title || '',
      role: saved.role || ''
    }
  };
}

export async function bulkUpsertTeamMembers(input) {
  const team = await readJson(FILES.team, []);
  const updates = Array.isArray(input?.updates) ? input.updates : [];
  const results = [];
  const auditEvents = [];

  for (const item of updates) {
    const result = applyTeamMemberUpsert(team, item, { now: nowIso() });
    results.push({
      action: result.action,
      member: result.member
    });
    auditEvents.push({
      ts: result.now,
      event_type: 'mcp.team.upsert',
      entity_type: 'team_member',
      entity_id: result.auditEntityId,
      meta: {
        ...result.auditMeta,
        bulk: true
      }
    });
  }

  const sorted = [...team].sort((a, b) => cleanString(a?.name).localeCompare(cleanString(b?.name)));
  await writeJsonAtomic(FILES.team, sorted);
  for (const event of auditEvents) {
    await appendAuditEvent(event);
  }

  return {
    updated_count: results.length,
    results
  };
}

export async function addActor(input) {
  const actors = await readJson(FILES.actors, []);
  const actorId = cleanString(input.actorId);
  if (!actorId) {
    throw new Error('actorId is required');
  }
  if (actors.some((actor) => cleanString(actor?.actor_id) === actorId)) {
    throw new Error(`actor already exists: ${actorId}`);
  }

  const firstName = cleanOptionalString(input.firstName) || '';
  const lastName = cleanOptionalString(input.lastName) || '';
  const nameDisplay = cleanOptionalString(input.nameDisplay)
    || cleanOptionalString(`${firstName} ${lastName}`)
    || cleanString(input.name)
    || actorId;
  const createdAt = nowIso();
  const actor = {
    actor_id: actorId,
    name_display: nameDisplay,
    first_name: firstName,
    last_name: lastName,
    organization_primary: cleanOptionalString(input.organizationPrimary) || '',
    designation: cleanOptionalString(input.designation) || '',
    country_normalized: cleanOptionalString(input.countryNormalized) || '',
    actor_type: cleanOptionalString(input.actorType) || 'other',
    relationship_source: cleanOptionalString(input.relationshipSource) || '',
    relationship_strength: cleanOptionalString(input.relationshipStrength) || '',
    source_row_hash: cleanOptionalString(input.sourceRowHash) || '',
    needs_review: cleanBoolean(input.needsReview, false),
    owner: cleanOptionalString(input.owner) || '',
    assignment_policy: cleanOptionalString(input.assignmentPolicy) || '',
    investor_eligibility: cleanOptionalString(input.investorEligibility) || '',
    assignment_guardrail: cleanOptionalString(input.assignmentGuardrail) || '',
    clearance_required: cleanBoolean(input.clearanceRequired, false),
    profile_image: cleanOptionalString(input.profileImage) || '',
    resolution_status: cleanOptionalString(input.resolutionStatus) || '',
    linkedin: cleanOptionalString(input.linkedin) || '',
    created_at: createdAt,
    updated_at: createdAt
  };

  actors.push(actor);
  await writeJsonAtomic(FILES.actors, actors);
  await appendAuditEvent({
    ts: createdAt,
    event_type: 'mcp.actor.create',
    entity_type: 'actor',
    entity_id: actor.actor_id,
    meta: {
      name_display: actor.name_display,
      actor_type: actor.actor_type,
      owner: actor.owner
    }
  });
  return actor;
}

export async function updateActor(input) {
  const actors = await readJson(FILES.actors, []);
  const actorId = cleanString(input.actorId);
  if (!actorId) {
    throw new Error('actorId is required');
  }
  const index = actors.findIndex((actor) => cleanString(actor?.actor_id) === actorId);
  if (index < 0) {
    throw new Error(`actor not found: ${actorId}`);
  }

  const current = actors[index];
  const firstName = input.firstName !== undefined ? cleanString(input.firstName) : current.first_name || '';
  const lastName = input.lastName !== undefined ? cleanString(input.lastName) : current.last_name || '';
  const next = {
    ...current,
    first_name: firstName,
    last_name: lastName,
    name_display: input.nameDisplay !== undefined
      ? (cleanOptionalString(input.nameDisplay) || cleanOptionalString(`${firstName} ${lastName}`) || current.name_display || current.name || actorId)
      : (cleanOptionalString(`${firstName} ${lastName}`) || current.name_display || current.name || actorId),
    organization_primary: input.organizationPrimary !== undefined ? cleanString(input.organizationPrimary) : (current.organization_primary || ''),
    designation: input.designation !== undefined ? cleanString(input.designation) : (current.designation || ''),
    country_normalized: input.countryNormalized !== undefined ? cleanString(input.countryNormalized) : (current.country_normalized || ''),
    actor_type: input.actorType !== undefined ? (cleanOptionalString(input.actorType) || current.actor_type || '') : (current.actor_type || ''),
    relationship_source: input.relationshipSource !== undefined ? cleanString(input.relationshipSource) : (current.relationship_source || ''),
    relationship_strength: input.relationshipStrength !== undefined ? cleanString(input.relationshipStrength) : (current.relationship_strength || ''),
    source_row_hash: input.sourceRowHash !== undefined ? cleanString(input.sourceRowHash) : (current.source_row_hash || ''),
    needs_review: input.needsReview !== undefined ? cleanBoolean(input.needsReview, false) : Boolean(current.needs_review),
    owner: input.owner !== undefined ? cleanString(input.owner) : (current.owner || ''),
    assignment_policy: input.assignmentPolicy !== undefined ? cleanString(input.assignmentPolicy) : (current.assignment_policy || ''),
    investor_eligibility: input.investorEligibility !== undefined ? cleanString(input.investorEligibility) : (current.investor_eligibility || ''),
    assignment_guardrail: input.assignmentGuardrail !== undefined ? cleanString(input.assignmentGuardrail) : (current.assignment_guardrail || ''),
    clearance_required: input.clearanceRequired !== undefined ? cleanBoolean(input.clearanceRequired, false) : Boolean(current.clearance_required),
    profile_image: input.profileImage !== undefined ? cleanString(input.profileImage) : (current.profile_image || ''),
    resolution_status: input.resolutionStatus !== undefined ? cleanString(input.resolutionStatus) : (current.resolution_status || ''),
    linkedin: input.linkedin !== undefined ? cleanString(input.linkedin) : (current.linkedin || ''),
    updated_at: nowIso()
  };

  actors[index] = next;
  await writeJsonAtomic(FILES.actors, actors);
  await appendAuditEvent({
    ts: next.updated_at,
    event_type: 'mcp.actor.update',
    entity_type: 'actor',
    entity_id: actorId,
    meta: {
      actor_type: next.actor_type,
      owner: next.owner,
      organization_primary: next.organization_primary
    }
  });
  return next;
}

export async function upsertDailyBusinessTruth(input) {
  const context = normalizeMutationContext(input, 'upsert_daily_business_truth');
  const truthId = buildRecordId('DBT', input.truthId, input.truthKey || input.title || 'truth');
  return upsertRegistryRecord({
    file: FILES.dailyBusinessTruth,
    idField: 'truth_id',
    idValue: truthId,
    eventType: 'mcp.daily_business_truth.upsert',
    entityType: 'daily_business_truth',
    buildRecord(existing, now) {
      const base = {
        truth_id: truthId,
        truth_key: cleanOptionalString(input.truthKey) || cleanOptionalString(existing?.truth_key) || slugToken(input.title || truthId).toLowerCase(),
        date: cleanOptionalString(input.date) || cleanOptionalString(existing?.date) || now.slice(0, 10),
        title: cleanString(input.title || existing?.title),
        statement: cleanString(input.statement || existing?.statement),
        category: cleanOptionalString(input.category) || cleanOptionalString(existing?.category) || '',
        owner: cleanOptionalString(input.owner) || cleanOptionalString(existing?.owner) || '',
        created_at: existing?.created_at || now
      };
      return normalizeRegistryRecord(base, input, context, now);
    }
  });
}

export async function updateInitiative(input) {
  const initiatives = await readCollection(FILES.initiatives);
  const initiativeId = cleanString(input.initiativeId);
  if (!initiativeId) {
    throw new Error('initiativeId is required');
  }
  const index = ensureRecordIndex(initiatives, 'initiative_id', initiativeId, 'initiative');
  const now = nowIso();
  const context = normalizeMutationContext(input, 'update_initiative');
  const next = applyInitiativePatch(initiatives[index], input, context, now);
  initiatives[index] = next;
  await writeJsonAtomic(FILES.initiatives, initiatives);
  await appendAuditEvent({
    ts: now,
    event_type: 'mcp.initiative.update',
    entity_type: 'initiative',
    entity_id: initiativeId,
    meta: {
      status: next.status || '',
      current_state: next.current_state || '',
      readiness_score: next.readiness_score ?? null,
      confidence_status: context.confidence_status
    }
  });
  return next;
}

export async function updateActionItem(input) {
  const actions = await readCollection(FILES.actionItems);
  const actionId = cleanString(input.actionId);
  if (!actionId) {
    throw new Error('actionId is required');
  }
  const index = ensureRecordIndex(actions, 'action_id', actionId, 'action item');
  const now = nowIso();
  const context = normalizeMutationContext(input, 'update_action_item');
  const next = applyActionItemPatch(actions[index], input, context, now);
  actions[index] = next;
  await writeJsonAtomic(FILES.actionItems, actions);
  await appendAuditEvent({
    ts: now,
    event_type: 'mcp.action_item.update',
    entity_type: 'action_item',
    entity_id: actionId,
    meta: {
      status: next.status || '',
      owner: next.owner || '',
      due: next.due || '',
      confidence_status: context.confidence_status
    }
  });
  return next;
}

export async function closeOrSupersedeActionItem(input) {
  const actionId = cleanString(input.actionId);
  if (!actionId) {
    throw new Error('actionId is required');
  }
  const outcome = cleanString(input.outcome).toLowerCase();
  if (!['close', 'supersede'].includes(outcome)) {
    throw new Error('outcome must be close or supersede');
  }
  const reason = cleanString(input.reason);
  if (!reason) {
    throw new Error('reason is required');
  }
  return updateActionItem({
    ...input,
    actionId,
    status: outcome === 'supersede' ? 'superseded' : (cleanOptionalString(input.closedStatus) || 'done'),
    blockerReason: reason,
    effectiveAt: input.effectiveAt,
    reason,
    evidenceRef: cleanOptionalString(input.evidenceRef) || cleanOptionalString(input.supersededByActionId) || '',
    closedAt: input.effectiveAt || nowIso()
  });
}

export async function setCurrentPriorityDeclaration(input) {
  const context = normalizeMutationContext(input, 'set_current_priority_declaration');
  const declarationId = buildRecordId('PRIO', input.declarationId, input.title || input.summary || 'priority');
  return upsertRegistryRecord({
    file: FILES.priorityDeclarations,
    idField: 'priority_declaration_id',
    idValue: declarationId,
    eventType: 'mcp.priority_declaration.set',
    entityType: 'priority_declaration',
    buildRecord(existing, now) {
      const base = {
        priority_declaration_id: declarationId,
        title: cleanString(input.title || existing?.title),
        summary: cleanString(input.summary || existing?.summary),
        owner: cleanOptionalString(input.owner) || cleanOptionalString(existing?.owner) || '',
        initiative_ids: cleanStringList(input.initiativeIds || existing?.initiative_ids),
        buyer_ids: cleanStringList(input.buyerIds || existing?.buyer_ids),
        priority_rank: cleanNumber(input.priorityRank) ?? existing?.priority_rank ?? null,
        effective_start: ensureIsoOrNow(input.effectiveStart || existing?.effective_start || context.effective_at),
        effective_end: cleanOptionalString(input.effectiveEnd) || cleanOptionalString(existing?.effective_end) || '',
        created_at: existing?.created_at || now
      };
      return normalizeRegistryRecord(base, input, context, now);
    }
  });
}

export async function recordDecision(input) {
  const context = normalizeMutationContext(input, 'record_decision');
  const decisionId = buildRecordId('DEC', input.decisionId, input.title || input.outcome || 'decision');
  return upsertRegistryRecord({
    file: FILES.decisions,
    idField: 'decision_id',
    idValue: decisionId,
    eventType: 'mcp.decision.record',
    entityType: 'decision',
    buildRecord(existing, now) {
      const base = {
        decision_id: decisionId,
        title: cleanString(input.title || existing?.title),
        decision_type: cleanOptionalString(input.decisionType) || cleanOptionalString(existing?.decision_type) || '',
        outcome: cleanString(input.outcome || existing?.outcome),
        owner: cleanOptionalString(input.owner) || cleanOptionalString(existing?.owner) || '',
        initiative_ids: cleanStringList(input.initiativeIds || existing?.initiative_ids),
        buyer_ids: cleanStringList(input.buyerIds || existing?.buyer_ids),
        action_ids: cleanStringList(input.actionIds || existing?.action_ids),
        meeting_id: cleanOptionalString(input.meetingId) || cleanOptionalString(existing?.meeting_id) || '',
        created_at: existing?.created_at || now
      };
      return normalizeRegistryRecord(base, input, context, now);
    }
  });
}

export async function recordExternalCommitment(input) {
  const context = normalizeMutationContext(input, 'record_external_commitment');
  const commitmentId = buildRecordId('COM', input.commitmentId, input.party || input.commitment || 'commitment');
  return upsertRegistryRecord({
    file: FILES.externalCommitments,
    idField: 'commitment_id',
    idValue: commitmentId,
    eventType: 'mcp.external_commitment.record',
    entityType: 'external_commitment',
    buildRecord(existing, now) {
      const base = {
        commitment_id: commitmentId,
        party: cleanString(input.party || existing?.party),
        commitment: cleanString(input.commitment || existing?.commitment),
        owner: cleanOptionalString(input.owner) || cleanOptionalString(existing?.owner) || '',
        due_date: cleanOptionalString(input.dueDate) || cleanOptionalString(existing?.due_date) || '',
        initiative_ids: cleanStringList(input.initiativeIds || existing?.initiative_ids),
        buyer_ids: cleanStringList(input.buyerIds || existing?.buyer_ids),
        counterparties: cleanStringList(input.counterparties || existing?.counterparties),
        notes: cleanOptionalString(input.notes) || cleanOptionalString(existing?.notes) || '',
        created_at: existing?.created_at || now
      };
      return normalizeRegistryRecord(base, input, context, now);
    }
  });
}

export async function recordInformationGap(input) {
  const context = normalizeMutationContext(input, 'record_information_gap');
  const gapId = buildRecordId('GAP', input.gapId, input.title || 'gap');
  return upsertRegistryRecord({
    file: FILES.informationGaps,
    idField: 'gap_id',
    idValue: gapId,
    eventType: 'mcp.information_gap.record',
    entityType: 'information_gap',
    buildRecord(existing, now) {
      const base = {
        gap_id: gapId,
        title: cleanString(input.title || existing?.title),
        description: cleanOptionalString(input.description) || cleanOptionalString(existing?.description) || '',
        severity: cleanOptionalString(input.severity) || cleanOptionalString(existing?.severity) || 'medium',
        owner: cleanOptionalString(input.owner) || cleanOptionalString(existing?.owner) || '',
        due_date: cleanOptionalString(input.dueDate) || cleanOptionalString(existing?.due_date) || '',
        initiative_ids: cleanStringList(input.initiativeIds || existing?.initiative_ids),
        buyer_ids: cleanStringList(input.buyerIds || existing?.buyer_ids),
        blocking: cleanBoolean(input.blocking, Boolean(existing?.blocking)),
        created_at: existing?.created_at || now
      };
      return normalizeRegistryRecord(base, input, context, now);
    }
  });
}

export async function markRecordStale(input) {
  const recordType = cleanString(input.recordType);
  const recordId = cleanString(input.recordId);
  if (!recordType || !recordId) {
    throw new Error('recordType and recordId are required');
  }
  const staleReason = cleanString(input.staleReason);
  if (!staleReason) {
    throw new Error('staleReason is required');
  }
  const config = registryLookupConfig(recordType);
  const rows = await readCollection(config.file);
  const index = ensureRecordIndex(rows, config.idField, recordId, config.entityType);
  const now = nowIso();
  const context = normalizeMutationContext({
    ...input,
    confidenceStatus: input.confidenceStatus || 'stale'
  }, 'mark_record_stale');
  const current = rows[index];
  const next = applySyncMetadata({
    ...current,
    data_confidence_status: context.confidence_status,
    stale_reason: staleReason,
    stale_marked_at: context.effective_at
  }, context, now);
  rows[index] = next;
  await writeJsonAtomic(config.file, rows);
  await appendAuditEvent({
    ts: now,
    event_type: 'mcp.record.mark_stale',
    entity_type: config.entityType,
    entity_id: recordId,
    meta: {
      stale_reason: staleReason,
      confidence_status: context.confidence_status
    }
  });
  return next;
}

export async function reconcileMeetingOutcomes(input) {
  const meetingId = cleanString(input.meetingId);
  if (!meetingId) {
    throw new Error('meetingId is required');
  }
  const { meetings, index, meeting } = await getMeetingByIdOrThrow(meetingId);
  const now = nowIso();
  const context = normalizeMutationContext(input, 'reconcile_meeting_outcomes');
  const applied = {
    initiatives: [],
    action_items: [],
    decisions: [],
    commitments: [],
    information_gaps: [],
    priority_declaration: null
  };

  for (const item of Array.isArray(input.initiativeUpdates) ? input.initiativeUpdates : []) {
    applied.initiatives.push(await updateInitiative({
      ...item,
      sourceRecordIds: cleanStringList([meetingId, ...(item.sourceRecordIds || []), ...(input.sourceRecordIds || [])]),
      evidenceRefs: [...(input.evidenceRefs || []), ...(item.evidenceRefs || [])],
      changedBy: item.changedBy || input.changedBy,
      reason: item.reason || input.reason || `Reconciled from meeting ${meetingId}`,
      effectiveAt: item.effectiveAt || input.effectiveAt
    }));
  }

  for (const item of Array.isArray(input.actionItemUpdates) ? input.actionItemUpdates : []) {
    applied.action_items.push(await updateActionItem({
      ...item,
      sourceRecordIds: cleanStringList([meetingId, ...(item.sourceRecordIds || []), ...(input.sourceRecordIds || [])]),
      evidenceRefs: [...(input.evidenceRefs || []), ...(item.evidenceRefs || [])],
      changedBy: item.changedBy || input.changedBy,
      reason: item.reason || input.reason || `Reconciled from meeting ${meetingId}`,
      effectiveAt: item.effectiveAt || input.effectiveAt
    }));
  }

  for (const item of Array.isArray(input.decisions) ? input.decisions : []) {
    const result = await recordDecision({
      ...item,
      meetingId,
      sourceRecordIds: cleanStringList([meetingId, ...(item.sourceRecordIds || []), ...(input.sourceRecordIds || [])]),
      evidenceRefs: [...(input.evidenceRefs || []), ...(item.evidenceRefs || [])],
      changedBy: item.changedBy || input.changedBy,
      reason: item.reason || input.reason || `Decision recorded from meeting ${meetingId}`,
      effectiveAt: item.effectiveAt || input.effectiveAt
    });
    applied.decisions.push(result.record);
  }

  for (const item of Array.isArray(input.externalCommitments) ? input.externalCommitments : []) {
    const result = await recordExternalCommitment({
      ...item,
      sourceRecordIds: cleanStringList([meetingId, ...(item.sourceRecordIds || []), ...(input.sourceRecordIds || [])]),
      evidenceRefs: [...(input.evidenceRefs || []), ...(item.evidenceRefs || [])],
      changedBy: item.changedBy || input.changedBy,
      reason: item.reason || input.reason || `Commitment recorded from meeting ${meetingId}`,
      effectiveAt: item.effectiveAt || input.effectiveAt
    });
    applied.commitments.push(result.record);
  }

  for (const item of Array.isArray(input.informationGaps) ? input.informationGaps : []) {
    const result = await recordInformationGap({
      ...item,
      sourceRecordIds: cleanStringList([meetingId, ...(item.sourceRecordIds || []), ...(input.sourceRecordIds || [])]),
      evidenceRefs: [...(input.evidenceRefs || []), ...(item.evidenceRefs || [])],
      changedBy: item.changedBy || input.changedBy,
      reason: item.reason || input.reason || `Information gap recorded from meeting ${meetingId}`,
      effectiveAt: item.effectiveAt || input.effectiveAt
    });
    applied.information_gaps.push(result.record);
  }

  if (input.priorityDeclaration) {
    const result = await setCurrentPriorityDeclaration({
      ...input.priorityDeclaration,
      sourceRecordIds: cleanStringList([meetingId, ...(input.priorityDeclaration.sourceRecordIds || []), ...(input.sourceRecordIds || [])]),
      evidenceRefs: [...(input.evidenceRefs || []), ...(input.priorityDeclaration.evidenceRefs || [])],
      changedBy: input.priorityDeclaration.changedBy || input.changedBy,
      reason: input.priorityDeclaration.reason || input.reason || `Priority updated from meeting ${meetingId}`,
      effectiveAt: input.priorityDeclaration.effectiveAt || input.effectiveAt
    });
    applied.priority_declaration = result.record;
  }

  const reconciliationId = buildRecordId('REC', input.reconciliationId, meeting.title || meetingId);
  const record = normalizeRegistryRecord({
    reconciliation_id: reconciliationId,
    meeting_id: meetingId,
    title: cleanOptionalString(input.title) || `Reconciliation for ${meeting.title}`,
    summary: cleanOptionalString(input.summary) || '',
    applied_counts: {
      initiatives: applied.initiatives.length,
      action_items: applied.action_items.length,
      decisions: applied.decisions.length,
      commitments: applied.commitments.length,
      information_gaps: applied.information_gaps.length,
      priority_declaration: applied.priority_declaration ? 1 : 0
    },
    created_at: now
  }, input, context, now);

  const reconciliations = await readCollection(FILES.meetingReconciliations);
  reconciliations.push(record);
  await writeJsonAtomic(FILES.meetingReconciliations, reconciliations);

  meetings[index] = {
    ...meeting,
    updated_at: now,
    reconciliation_id: reconciliationId,
    reconciliation_status: 'reconciled',
    reconciled_at: context.effective_at,
    reconciliation_summary: cleanOptionalString(input.summary) || meeting.reconciliation_summary || ''
  };
  await writeJsonAtomic(FILES.meetingMinutes, meetings);

  await appendAuditEvent({
    ts: now,
    event_type: 'mcp.meeting.reconcile',
    entity_type: 'meeting_reconciliation',
    entity_id: reconciliationId,
    meta: {
      meeting_id: meetingId,
      applied_counts: record.applied_counts
    }
  });

  return {
    reconciliation: record,
    applied
  };
}
