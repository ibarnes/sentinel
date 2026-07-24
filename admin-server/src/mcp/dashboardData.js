import fs from 'fs/promises';
import path from 'path';

const DEFAULT_ROOT = '/home/ec2-user/.openclaw/workspace';
const WORKSPACE_ROOT = path.resolve(process.env.OPENCLAW_DASHBOARD_ROOT || DEFAULT_ROOT);
const DASHBOARD_ROOT = path.join(WORKSPACE_ROOT, 'dashboard');
const DATA_ROOT = path.join(DASHBOARD_ROOT, 'data');

const FILES = {
  buyers: path.join(DATA_ROOT, 'buyers.json'),
  initiatives: path.join(DATA_ROOT, 'initiatives.json'),
  signals: path.join(DATA_ROOT, 'signals.json'),
  meetingMinutes: path.join(DATA_ROOT, 'meeting_minutes.json'),
  actionItems: path.join(DATA_ROOT, 'action_items.json'),
  contactPaths: path.join(DATA_ROOT, 'contact_paths.json'),
  decisionArchitecture: path.join(DATA_ROOT, 'decision_architecture.json')
};

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function includesQuery(record, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack = JSON.stringify(record).toLowerCase();
  return haystack.includes(needle);
}

function normalizeVerificationStatus(value) {
  const normalized = String(value || '').replace(/_/g, '-').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'pending-review') return 'pending';
  return normalized;
}

function pick(record, fields) {
  const out = {};
  for (const field of fields) {
    if (field in record) out[field] = record[field];
  }
  return out;
}

function sortByScoreDesc(rows) {
  return [...rows].sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0));
}

export async function getBuyers() {
  const buyers = await readJson(FILES.buyers, []);
  return sortByScoreDesc(Array.isArray(buyers) ? buyers : []);
}

export async function getInitiatives() {
  const initiatives = await readJson(FILES.initiatives, []);
  return Array.isArray(initiatives) ? initiatives : [];
}

export async function getSignals() {
  const signals = await readJson(FILES.signals, []);
  return Array.isArray(signals) ? signals : [];
}

export async function getMeetingMinutes() {
  const meetings = await readJson(FILES.meetingMinutes, []);
  return Array.isArray(meetings) ? meetings : [];
}

export async function getActionItems() {
  const actions = await readJson(FILES.actionItems, []);
  return Array.isArray(actions) ? actions : [];
}

export async function getContactPaths() {
  const rows = await readJson(FILES.contactPaths, []);
  return Array.isArray(rows) ? rows : [];
}

export async function getDecisionArchitecture() {
  const rows = await readJson(FILES.decisionArchitecture, []);
  return Array.isArray(rows) ? rows : [];
}

export async function listBuyers({ query = '', limit = 10, minScore = null, status = '' } = {}) {
  const rows = await getBuyers();
  return rows
    .filter((row) => includesQuery(row, query))
    .filter((row) => minScore == null || Number(row?.score || 0) >= Number(minScore))
    .filter((row) => !status || String(row?.status || '').toLowerCase() === String(status).toLowerCase())
    .slice(0, limit)
    .map((row) => pick(row, ['buyer_id', 'name', 'score', 'status', 'tier', 'region', 'country', 'sector', 'last_updated']));
}

export async function getBuyerById(buyerId) {
  const rows = await getBuyers();
  return rows.find((row) => String(row?.buyer_id || '').toLowerCase() === String(buyerId || '').toLowerCase()) || null;
}

export async function listInitiatives({ query = '', limit = 10, status = '' } = {}) {
  const rows = await getInitiatives();
  return rows
    .filter((row) => includesQuery(row, query))
    .filter((row) => !status || String(row?.status || '').toLowerCase() === String(status).toLowerCase())
    .slice(0, limit)
    .map((row) => pick(row, ['initiative_id', 'name', 'status', 'region', 'country', 'sector', 'buyer_ids', 'last_updated']));
}

export async function getInitiativeById(initiativeId) {
  const rows = await getInitiatives();
  return rows.find((row) => String(row?.initiative_id || '').toLowerCase() === String(initiativeId || '').toLowerCase()) || null;
}

export async function listSignals({ query = '', limit = 10, buyerId = '', initiativeId = '', verificationStatus = '' } = {}) {
  const rows = await getSignals();
  const targetVerificationStatus = normalizeVerificationStatus(verificationStatus);
  return rows
    .filter((row) => includesQuery(row, query))
    .filter((row) => !buyerId || (Array.isArray(row?.related_buyers) && row.related_buyers.some((v) => String(v).toLowerCase() === String(buyerId).toLowerCase())))
    .filter((row) => !initiativeId || (Array.isArray(row?.related_initiatives) && row.related_initiatives.some((v) => String(v).toLowerCase() === String(initiativeId).toLowerCase())))
    .filter((row) => !targetVerificationStatus || normalizeVerificationStatus(row?.verification_status) === targetVerificationStatus)
    .slice(0, limit)
    .map((row) => pick(row, ['id', 'headline', 'summary', 'timestamp_utc', 'related_buyers', 'related_initiatives', 'verification_status', 'confidence_score']));
}

export async function searchMeetingMinutes({ query = '', limit = 10 } = {}) {
  const rows = await getMeetingMinutes();
  return rows
    .filter((row) => includesQuery(row, query))
    .slice(0, limit)
    .map((row) => pick(row, ['meeting_id', 'title', 'date', 'participants', 'initiative_ids', 'buyer_ids', 'summary', 'action_items']));
}

export async function listActionItems({ status = '', owner = '', limit = 10, query = '' } = {}) {
  const rows = await getActionItems();
  return rows
    .filter((row) => includesQuery(row, query))
    .filter((row) => !status || String(row?.status || '').toLowerCase() === String(status).toLowerCase())
    .filter((row) => !owner || String(row?.owner || '').toLowerCase() === String(owner).toLowerCase())
    .slice(0, limit)
    .map((row) => ({
      ...pick(row, ['action_id', 'action_text', 'status', 'priority', 'owner', 'support', 'initiative_ids', 'buyer_ids', 'due', 'due_date']),
      due: row?.due || row?.due_date || ''
    }));
}

export async function listContactPaths({ buyerId = '', limit = 10, query = '' } = {}) {
  const rows = await getContactPaths();
  return rows
    .filter((row) => includesQuery(row, query))
    .filter((row) => !buyerId || String(row?.buyer_id || '').toLowerCase() === String(buyerId).toLowerCase())
    .slice(0, limit);
}

export async function listDecisionArchitecture({ buyerId = '', limit = 10, query = '' } = {}) {
  const rows = await getDecisionArchitecture();
  return rows
    .filter((row) => includesQuery(row, query))
    .filter((row) => !buyerId || String(row?.buyer_id || '').toLowerCase() === String(buyerId).toLowerCase())
    .slice(0, limit);
}

export async function getDashboardSummary() {
  const [buyers, initiatives, signals, meetings, actions, contactPaths, decisions] = await Promise.all([
    getBuyers(),
    getInitiatives(),
    getSignals(),
    getMeetingMinutes(),
    getActionItems(),
    getContactPaths(),
    getDecisionArchitecture()
  ]);

  const topBuyers = buyers
    .slice(0, 5)
    .map((row) => ({
      buyer_id: row?.buyer_id,
      name: row?.name,
      score: row?.score,
      status: row?.status
    }));

  const openActions = actions.filter((row) => String(row?.status || '').toLowerCase() !== 'done');
  const blockedActions = actions.filter((row) => String(row?.status || '').toLowerCase() === 'blocked');
  const recentSignals = signals
    .filter((row) => row?.timestamp_utc)
    .sort((a, b) => String(b.timestamp_utc).localeCompare(String(a.timestamp_utc)))
    .slice(0, 5)
    .map((row) => ({
      id: row?.id,
      headline: normalizeText(row?.headline),
      timestamp_utc: row?.timestamp_utc,
      verification_status: row?.verification_status
    }));

  return {
    workspace_root: WORKSPACE_ROOT,
    dashboard_data_root: DATA_ROOT,
    counts: {
      buyers: buyers.length,
      initiatives: initiatives.length,
      signals: signals.length,
      meeting_minutes: meetings.length,
      action_items: actions.length,
      contact_paths: contactPaths.length,
      decision_architecture_rows: decisions.length
    },
    action_status: {
      open: openActions.length,
      blocked: blockedActions.length
    },
    top_buyers: topBuyers,
    recent_signals: recentSignals
  };
}

export { WORKSPACE_ROOT, DATA_ROOT };
