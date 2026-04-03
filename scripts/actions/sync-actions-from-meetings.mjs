#!/usr/bin/env node
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = '/home/ec2-user/.openclaw/workspace';
const MEETINGS_FILE = path.join(ROOT, 'dashboard/data/meeting_minutes.json');
const ACTIONS_FILE = path.join(ROOT, 'dashboard/data/action_items.json');
const TEAM_FILE = path.join(ROOT, 'dashboard/data/team.json');
const EVENTS_FILE = path.join(ROOT, 'dashboard/data/action_events.jsonl');

const TEAM_DEFAULTS = {
  coordinatorLead: 'Richelle Maylad',
  internalCoordinator: 'Monica Colon',
  founder: 'Isaac Barnes',
  legal: 'Stephanie Karp Loosvelt',
  strategy: 'Maryan Ali',
  operations: 'Tyreek Moore',
  originator: 'Richard J. Hoffman',
  operatorDigital: 'Leo LaBranche'
};

const ISAAC_REASONS = new Set(['none', 'buyer_judgment', 'relationship', 'signature', 'narrative', 'capital_decision']);

const DECISION_WORDS = [
  'approve','decide','decision','confirm','select','choose','authorize','commit','mandate','go/no-go','go no-go','capital','buyer','sign-off','finalize position'
];
const COORDINATION_WORDS = [
  'schedule','connect','intro','follow up','follow-up','send','align','coordinate','meeting','packet','route','whatsapp','email','recurring'
];
const RESEARCH_WORDS = [
  'identify','find','diligence','analyze','verify','map','gather','investigate','assess','research','pressure test'
];
const DELIVERABLE_WORDS = [
  'draft','prepare','build','update','create','produce','revise','write','brief','deck','memo','one-pager','one pager'
];

const STAGE_CRITICAL_WORDS = [
  'capital','buyer','mandate','gate','fid','pre-fid','go/no-go','go no-go','commitment','approval','blocker','decision owner','valuation','term sheet'
];

function nowIso() {
  return new Date().toISOString();
}

async function readJson(file, fallback) {
  try {
    const txt = await fs.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function appendEvent(event) {
  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
  await fs.appendFile(EVENTS_FILE, `${JSON.stringify(event)}\n`, 'utf8');
}

function normalizeSpace(v = '') {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function hashAction(meetingId, actionText) {
  const base = `${meetingId}::${normalizeSpace(actionText).toLowerCase()}`;
  return `ACT-${crypto.createHash('sha1').update(base).digest('hex').slice(0, 16)}`;
}

function classifyActionType(text = '') {
  const t = normalizeSpace(text).toLowerCase();
  const has = (arr) => arr.some((w) => t.includes(w));
  if (has(DECISION_WORDS)) return 'decision';
  if (has(DELIVERABLE_WORDS)) return 'deliverable';
  if (has(RESEARCH_WORDS)) return 'research';
  if (has(COORDINATION_WORDS)) return 'coordination';
  return 'coordination';
}

function normalizeStatus(v = '') {
  const s = String(v || 'open').trim().toLowerCase();
  return ['open','in_progress','blocked','done'].includes(s) ? s : 'open';
}

function normalizePriority(v = '') {
  const p = String(v || 'normal').trim().toLowerCase();
  return ['critical','high','normal','low'].includes(p) ? p : 'normal';
}

function inferStageCritical(text = '') {
  const t = normalizeSpace(text).toLowerCase();
  return STAGE_CRITICAL_WORDS.some((w) => t.includes(w));
}

function inferPriority({ text = '', stageCritical = false, due = '' }) {
  const t = normalizeSpace(text).toLowerCase();
  if (stageCritical && (t.includes('urgent') || t.includes('critical') || t.includes('capital') || t.includes('mandate') || t.includes('gate'))) {
    return 'critical';
  }
  if (stageCritical) return 'high';
  if (t.includes('follow up') || t.includes('follow-up') || t.includes('schedule')) return 'normal';
  return 'normal';
}

function inferEffort({ type = 'coordination', text = '' }) {
  const t = normalizeSpace(text).toLowerCase();
  if (type === 'decision' && (t.includes('capital') || t.includes('go/no-go') || t.includes('go no-go'))) return 5;
  if (type === 'deliverable' && (t.includes('deck') || t.includes('brief') || t.includes('memo') || t.includes('one-pager') || t.includes('one pager'))) return 3;
  if (type === 'research') return t.includes('map') || t.includes('diligence') ? 3 : 2;
  if (type === 'coordination' && (t.includes('recurring') || t.includes('multi') || t.includes('cross'))) return 3;
  if (type === 'coordination') return 2;
  return 2;
}

function inferIsaacRequirement(text = '') {
  const t = normalizeSpace(text).toLowerCase();
  if (t.includes('signature') || t.includes('sign') || t.includes('execute contract')) return { requires_isaac: true, isaac_reason: 'signature' };
  if (t.includes('buyer') || t.includes('positioning') || t.includes('final positioning')) return { requires_isaac: true, isaac_reason: 'buyer_judgment' };
  if (t.includes('relationship') || t.includes('intro') || t.includes('prime minister') || t.includes('president')) return { requires_isaac: true, isaac_reason: 'relationship' };
  if (t.includes('narrative') || t.includes('message') || t.includes('framing')) return { requires_isaac: true, isaac_reason: 'narrative' };
  if (t.includes('capital commitment') || t.includes('go/no-go') || t.includes('go no-go') || t.includes('mandate accept')) return { requires_isaac: true, isaac_reason: 'capital_decision' };
  return { requires_isaac: false, isaac_reason: 'none' };
}

function roleMap(team = []) {
  const names = team.filter((t) => String(t.status || 'active').toLowerCase() === 'active').map((t) => String(t.name || '').trim()).filter(Boolean);
  const byNorm = new Map(names.map((n) => [normalizeSpace(n).toLowerCase(), n]));
  const pick = (fallback) => byNorm.get(normalizeSpace(fallback).toLowerCase()) || fallback;
  return {
    coordinatorLead: pick(TEAM_DEFAULTS.coordinatorLead),
    internalCoordinator: pick(TEAM_DEFAULTS.internalCoordinator),
    founder: pick(TEAM_DEFAULTS.founder),
    legal: pick(TEAM_DEFAULTS.legal),
    strategy: pick(TEAM_DEFAULTS.strategy),
    operations: pick(TEAM_DEFAULTS.operations),
    originator: pick(TEAM_DEFAULTS.originator),
    operatorDigital: pick(TEAM_DEFAULTS.operatorDigital),
    allNames: names
  };
}

function inferOwner({ actionText, actionType, meetingParticipants = [], teamRoles }) {
  const t = normalizeSpace(actionText).toLowerCase();

  for (const p of meetingParticipants) {
    const n = normalizeSpace(p).toLowerCase();
    if (!n) continue;
    if (t.includes(n) && teamRoles.allNames.some((name) => normalizeSpace(name).toLowerCase() === n)) {
      return meetingParticipants.find((x) => normalizeSpace(x).toLowerCase() === n) || '';
    }
  }

  if (actionType === 'coordination') return teamRoles.coordinatorLead;
  if (actionType === 'research') return teamRoles.strategy;
  if (actionType === 'deliverable') {
    if (t.includes('legal') || t.includes('contract') || t.includes('compliance') || t.includes('terms')) return teamRoles.legal;
    if (t.includes('digital') || t.includes('platform') || t.includes('data center') || t.includes('product')) return teamRoles.operatorDigital;
    return teamRoles.originator;
  }
  if (actionType === 'decision') {
    if (t.includes('legal') || t.includes('contract') || t.includes('compliance')) return teamRoles.legal;
    if (t.includes('capital') || t.includes('buyer') || t.includes('mandate') || t.includes('valuation')) return teamRoles.operations;
    return teamRoles.originator;
  }

  return '';
}

function inferSupport({ actionText, actionType, owner, teamRoles }) {
  const t = normalizeSpace(actionText).toLowerCase();
  const support = [];

  if (actionType === 'coordination') {
    if (owner !== teamRoles.coordinatorLead) support.push(teamRoles.coordinatorLead);
    support.push(teamRoles.internalCoordinator);
  }

  if (actionType === 'research') {
    if (owner !== teamRoles.strategy) support.push(teamRoles.strategy);
    support.push(teamRoles.internalCoordinator);
  }

  if (actionType === 'deliverable') {
    support.push(teamRoles.internalCoordinator);
    if (t.includes('legal') || t.includes('contract')) support.push(teamRoles.legal);
    if (t.includes('brief') || t.includes('memo') || t.includes('deck')) support.push(teamRoles.strategy);
  }

  if (actionType === 'decision') {
    support.push(teamRoles.coordinatorLead, teamRoles.internalCoordinator);
    if (t.includes('legal') || t.includes('contract')) support.push(teamRoles.legal);
  }

  return [...new Set(support.map((x) => String(x || '').trim()).filter(Boolean).filter((x) => x !== owner))];
}

function inferDecisionOwner({ actionText, actionType, requiresIsaac, teamRoles }) {
  if (actionType !== 'decision') return null;
  const t = normalizeSpace(actionText).toLowerCase();

  if (requiresIsaac) return teamRoles.founder;
  if (t.includes('legal') || t.includes('contract') || t.includes('compliance') || t.includes('terms')) return teamRoles.legal;
  if (t.includes('operat') || t.includes('execution') || t.includes('workflow')) return teamRoles.operations;
  return null;
}

function applyValidation(item) {
  const out = { ...item };
  out.action_type = classifyActionType(out.action_type || out.action_text);
  out.status = normalizeStatus(out.status);
  out.priority = normalizePriority(out.priority);
  out.effort_score = Number.isFinite(Number(out.effort_score)) ? Math.max(1, Math.min(5, Number(out.effort_score))) : 2;
  out.support = Array.isArray(out.support) ? out.support.map((x) => String(x || '').trim()).filter(Boolean) : [];
  out.waiting_on = Array.isArray(out.waiting_on) ? out.waiting_on.map((x) => String(x || '').trim()).filter(Boolean) : [];
  out.initiative_ids = Array.isArray(out.initiative_ids) ? out.initiative_ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  out.decision_owner = out.decision_owner ? String(out.decision_owner).trim() : null;
  out.owner = String(out.owner || '').trim();
  out.coordinator_lead = String(out.coordinator_lead || TEAM_DEFAULTS.coordinatorLead).trim() || TEAM_DEFAULTS.coordinatorLead;
  out.internal_coordinator = String(out.internal_coordinator || TEAM_DEFAULTS.internalCoordinator).trim() || TEAM_DEFAULTS.internalCoordinator;
  out.requires_isaac = Boolean(out.requires_isaac);
  out.isaac_reason = ISAAC_REASONS.has(String(out.isaac_reason || 'none')) ? String(out.isaac_reason || 'none') : 'none';
  if (!out.requires_isaac) out.isaac_reason = 'none';
  if (out.requires_isaac && out.isaac_reason === 'none') out.isaac_reason = 'buyer_judgment';

  if (!out.owner && out.status === 'in_progress') out.status = 'open';
  if (out.action_type === 'decision' && !out.decision_owner && out.status !== 'done') {
    out.status = 'blocked';
    out.blocker_reason = normalizeSpace(out.blocker_reason || 'missing decision owner');
  }

  if (out.status === 'done' && !out.closed_at) out.closed_at = nowIso();
  if (out.status !== 'done') out.closed_at = null;

  return out;
}

function sameJSON(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const meetings = await readJson(MEETINGS_FILE, []);
  const existing = await readJson(ACTIONS_FILE, []);
  const team = await readJson(TEAM_FILE, []);
  const teamRoles = roleMap(team);

  const existingMap = new Map((Array.isArray(existing) ? existing : []).map((x) => [String(x.action_id || ''), x]));
  const touched = new Set();
  const out = Array.isArray(existing) ? [...existing] : [];

  let created = 0;
  let updated = 0;
  let preserved = 0;

  for (const meeting of (Array.isArray(meetings) ? meetings : [])) {
    const meetingId = String(meeting?.meeting_id || '').trim();
    if (!meetingId) continue;

    const initiativeIds = Array.isArray(meeting?.initiative_ids) ? meeting.initiative_ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
    const participants = Array.isArray(meeting?.participants) ? meeting.participants.map((x) => String(x || '').trim()).filter(Boolean) : [];
    const nextActions = Array.isArray(meeting?.next_actions) ? meeting.next_actions : [];

    for (const rawAction of nextActions) {
      const actionText = normalizeSpace(rawAction?.action || '');
      if (!actionText) continue;

      const actionId = hashAction(meetingId, actionText);
      touched.add(actionId);
      const existingItem = existingMap.get(actionId);

      const inferredType = classifyActionType(actionText);
      const inferredStageCritical = inferStageCritical(actionText);
      const inferredPriority = inferPriority({ text: actionText, stageCritical: inferredStageCritical, due: rawAction?.due || '' });
      const inferredEffort = inferEffort({ type: inferredType, text: actionText });
      const isaacInference = inferIsaacRequirement(actionText);

      const ownerCandidate = inferOwner({ actionText, actionType: inferredType, meetingParticipants: participants, teamRoles });
      const ownerFromMeeting = normalizeSpace(rawAction?.owner || '');
      const owner = ownerFromMeeting || ownerCandidate || '';
      const supportCandidate = inferSupport({ actionText, actionType: inferredType, owner, teamRoles });

      const decisionOwnerCandidate = inferDecisionOwner({
        actionText,
        actionType: inferredType,
        requiresIsaac: isaacInference.requires_isaac,
        teamRoles
      });

      const base = {
        action_id: actionId,
        meeting_id: meetingId,
        initiative_ids: initiativeIds,
        action_text: actionText,
        action_type: inferredType,
        owner,
        support: supportCandidate,
        decision_owner: decisionOwnerCandidate,
        coordinator_lead: teamRoles.coordinatorLead,
        internal_coordinator: teamRoles.internalCoordinator,
        due: normalizeSpace(rawAction?.due || ''),
        status: normalizeStatus(rawAction?.status || 'open'),
        priority: inferredPriority,
        effort_score: inferredEffort,
        stage_critical: inferredStageCritical,
        requires_isaac: isaacInference.requires_isaac,
        isaac_reason: isaacInference.isaac_reason,
        blocker_reason: '',
        waiting_on: [],
        evidence_ref: '',
        created_at: nowIso(),
        updated_at: nowIso(),
        escalated_at: null,
        closed_at: null,
      };

      let merged;
      if (!existingItem) {
        merged = applyValidation(base);
        out.push(merged);
        existingMap.set(actionId, merged);
        created += 1;
        await appendEvent({ ts: nowIso(), event_type: 'action.created', action_id: actionId, actor: 'system', meta: { meeting_id: meetingId } });
        if (merged.owner) {
          await appendEvent({ ts: nowIso(), event_type: 'action.assigned', action_id: actionId, actor: 'system', meta: { owner: merged.owner } });
        }
        if (merged.status === 'blocked') {
          await appendEvent({ ts: nowIso(), event_type: 'action.blocked', action_id: actionId, actor: 'system', meta: { blocker_reason: merged.blocker_reason || '' } });
        }
        continue;
      }

      merged = { ...existingItem };
      // System managed fields
      merged.meeting_id = meetingId;
      merged.initiative_ids = initiativeIds;
      merged.action_text = actionText;
      merged.coordinator_lead = normalizeSpace(merged.coordinator_lead || '') || teamRoles.coordinatorLead;
      merged.internal_coordinator = normalizeSpace(merged.internal_coordinator || '') || teamRoles.internalCoordinator;

      // Fill blanks only to preserve manual edits
      if (!normalizeSpace(merged.action_type || '')) merged.action_type = inferredType;
      if (!normalizeSpace(merged.owner || '')) merged.owner = owner;
      if (!Array.isArray(merged.support) || merged.support.length === 0) merged.support = supportCandidate;
      if ((merged.decision_owner == null || normalizeSpace(merged.decision_owner || '') === '') && inferredType === 'decision') merged.decision_owner = decisionOwnerCandidate;
      if (!normalizeSpace(merged.due || '')) merged.due = normalizeSpace(rawAction?.due || '');
      if (!normalizeSpace(merged.status || '')) merged.status = normalizeStatus(rawAction?.status || 'open');
      if (!normalizeSpace(merged.priority || '')) merged.priority = inferredPriority;
      if (!Number.isFinite(Number(merged.effort_score))) merged.effort_score = inferredEffort;
      if (typeof merged.stage_critical !== 'boolean') merged.stage_critical = inferredStageCritical;
      if (typeof merged.requires_isaac !== 'boolean') merged.requires_isaac = isaacInference.requires_isaac;
      if (!normalizeSpace(merged.isaac_reason || '')) merged.isaac_reason = isaacInference.isaac_reason;
      if (!Array.isArray(merged.waiting_on)) merged.waiting_on = [];
      if (typeof merged.blocker_reason !== 'string') merged.blocker_reason = '';
      if (typeof merged.evidence_ref !== 'string') merged.evidence_ref = '';
      if (!normalizeSpace(merged.created_at || '')) merged.created_at = nowIso();
      merged.updated_at = nowIso();

      const before = applyValidation(existingItem);
      const after = applyValidation(merged);

      const idx = out.findIndex((x) => String(x.action_id || '') === actionId);
      if (idx >= 0) out[idx] = after;
      existingMap.set(actionId, after);

      if (!sameJSON(before, after)) {
        updated += 1;
        await appendEvent({ ts: nowIso(), event_type: 'action.updated', action_id: actionId, actor: 'system', meta: { meeting_id: meetingId } });

        if (!before.owner && after.owner) {
          await appendEvent({ ts: nowIso(), event_type: 'action.assigned', action_id: actionId, actor: 'system', meta: { owner: after.owner } });
        }
        if (before.status !== 'blocked' && after.status === 'blocked') {
          await appendEvent({ ts: nowIso(), event_type: 'action.blocked', action_id: actionId, actor: 'system', meta: { blocker_reason: after.blocker_reason || '' } });
        }
        if (before.status !== 'done' && after.status === 'done') {
          await appendEvent({ ts: nowIso(), event_type: 'action.closed', action_id: actionId, actor: 'system', meta: {} });
        }
      } else {
        preserved += 1;
      }
    }
  }

  await writeJson(ACTIONS_FILE, out);
  console.log(JSON.stringify({ ok: true, total: out.length, touched: touched.size, created, updated, preserved }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
