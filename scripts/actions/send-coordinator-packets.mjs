#!/usr/bin/env node
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const ROOT = '/home/ec2-user/.openclaw/workspace';
const ACTIONS_FILE = path.join(ROOT, 'dashboard/data/action_items.json');
const NOTIFICATIONS_FILE = path.join(ROOT, 'dashboard/data/action_notifications.json');
const EVENTS_FILE = path.join(ROOT, 'dashboard/data/action_events.jsonl');
const PACKET_DIR = path.join(ROOT, 'mission-control/actions/packets');

const COORDINATOR_TO = 'richelle@unifiedstategroup.com';
const COORDINATOR_CC = 'monica@unifiedstategroup.com';
const ISAAC_TO = 'isaac@unifiedstategroup.com';

const require = createRequire(import.meta.url);
let nodemailerLib = null;
try {
  nodemailerLib = require(path.join(ROOT, 'admin-server/node_modules/nodemailer'));
} catch {
  nodemailerLib = null;
}

const HEAVY_ACTION_THRESHOLD_PER_MEETING = Number(process.env.HEAVY_ACTION_THRESHOLD_PER_MEETING || '3');
const SHARED_DECISION_DEPENDENCY_THRESHOLD = Number(process.env.SHARED_DECISION_DEPENDENCY_THRESHOLD || '3');
const COORDINATOR_OVERLOAD_OPEN_ACTIONS = Number(process.env.COORDINATOR_OVERLOAD_OPEN_ACTIONS || '25');

const args = new Set(process.argv.slice(2));
const argMode = [...args].find((a) => a.startsWith('--mode='));
const MODE = ((argMode ? argMode.split('=')[1] : process.env.ACTION_PACKET_MODE || 'draft') || 'draft').toLowerCase() === 'send' ? 'send' : 'draft';
const DAILY = args.has('--daily') || String(process.env.ACTION_SEND_DAILY || '0') === '1';
const FORCE = args.has('--force');

function nowIso() {
  return new Date().toISOString();
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
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

function defaultNotifications() {
  return {
    version: 1,
    mode: 'draft',
    coordinator_packets: [],
    isaac_exception_packets: [],
    escalation_state: [],
    last_daily_isaac_sent_on: null,
    updated_at: nowIso(),
  };
}

function normalizeStatus(v = '') {
  const s = String(v || 'open').toLowerCase();
  return ['open', 'in_progress', 'blocked', 'done'].includes(s) ? s : 'open';
}

function enrich(items = []) {
  const now = new Date();
  const nowDay = now.toISOString().slice(0, 10);
  const in72 = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  return items.map((x) => {
    const due = String(x.due || '').trim();
    const dueDate = due ? new Date(`${due}T00:00:00Z`) : null;
    const updated = x.updated_at ? new Date(x.updated_at) : (x.created_at ? new Date(x.created_at) : null);
    const ageHours = updated && Number.isFinite(updated.getTime())
      ? Math.max(0, Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60)))
      : null;

    const stageCritical = Boolean(x.stage_critical);
    const missingOwner = !String(x.owner || '').trim();
    const decisionItem = String(x.action_type || '').toLowerCase() === 'decision';
    const missingDecisionOwner = decisionItem && !String(x.decision_owner || '').trim();
    const status = normalizeStatus(x.status);
    const blocked = status === 'blocked';
    const overdue = Boolean(due && due < nowDay && status !== 'done');
    const due72 = Boolean(dueDate && dueDate.getTime() >= now.getTime() && dueDate.getTime() <= in72.getTime() && status !== 'done');

    const escalations = [];
    if (missingOwner && (ageHours ?? 0) >= 24) escalations.push({ rule: 'owner_missing_24h', level: 'action' });
    if ((decisionItem || stageCritical) && missingDecisionOwner && (ageHours ?? 0) >= 24) escalations.push({ rule: 'decision_owner_missing_24h', level: 'action' });
    if (stageCritical && overdue) escalations.push({ rule: 'stage_critical_due_breach', level: 'action' });
    if (blocked && (ageHours ?? 0) > 48) escalations.push({ rule: 'blocked_over_48h', level: 'action' });
    if (Boolean(x.requires_isaac) && due && due < nowDay && status !== 'done') escalations.push({ rule: 'isaac_required_due_breach', level: 'action' });

    return {
      ...x,
      status,
      due,
      missingOwner,
      missingDecisionOwner,
      blocked,
      overdue,
      due72,
      stageCritical,
      ageHours,
      escalations,
    };
  });
}

function countBy(items = [], fn) {
  const map = new Map();
  for (const item of items) {
    const key = fn(item);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function packetHash(payload) {
  return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

function renderCoordinatorPacket({ ts, newActions, missingAssignments, missingDecisionOwners, due72, blocked, overdue, requiresIsaac, statusCounts, ownerCounts, initiativeCounts, mode }) {
  const lineItems = (items, fn) => items.length ? items.map(fn).join('\n') : '- none';
  const fmt = (a) => `- ${a.action_id}: ${a.action_text} | owner=${a.owner || '—'} | decision_owner=${a.decision_owner || '—'} | due=${a.due || '—'} | status=${a.status}`;

  return `# Coordinator Packet\n\n- Generated: ${ts}\n- Mode: ${mode}\n- To: ${COORDINATOR_TO}\n- CC: ${COORDINATOR_CC}\n\n## Summary\n- New actions captured: ${newActions.length}\n- Missing assignments: ${missingAssignments.length}\n- Missing decision owners: ${missingDecisionOwners.length}\n- Due in 72h: ${due72.length}\n- Blocked: ${blocked.length}\n- Overdue: ${overdue.length}\n- Requires Isaac: ${requiresIsaac.length}\n\n## Status counts\n${statusCounts.map(([k,v]) => `- ${k}: ${v}`).join('\n') || '- none'}\n\n## Top owners\n${ownerCounts.slice(0,10).map(([k,v]) => `- ${k}: ${v}`).join('\n') || '- none'}\n\n## Top initiatives\n${initiativeCounts.slice(0,10).map(([k,v]) => `- ${k}: ${v}`).join('\n') || '- none'}\n\n## Newly captured actions\n${lineItems(newActions, fmt)}\n\n## Missing assignment\n${lineItems(missingAssignments, fmt)}\n\n## Missing decision owner\n${lineItems(missingDecisionOwners, fmt)}\n\n## Due in 72h\n${lineItems(due72, fmt)}\n\n## Blocked\n${lineItems(blocked, fmt)}\n\n## Overdue\n${lineItems(overdue, fmt)}\n\n## Requires Isaac\n${lineItems(requiresIsaac, fmt)}\n`;
}

function renderIsaacException({ ts, newEscalations, activeEscalations, requiresIsaacOpen, mode }) {
  const line = (e) => `- ${e.key} | ${e.rule} | ${e.summary}`;
  const reqLine = (a) => `- ${a.action_id}: ${a.action_text} | due=${a.due || '—'} | status=${a.status} | reason=${a.isaac_reason || 'none'}`;
  return `# Isaac Exception Digest\n\n- Generated: ${ts}\n- Mode: ${mode}\n- Recipient: ${ISAAC_TO}\n\n## New escalations (${newEscalations.length})\n${newEscalations.length ? newEscalations.map(line).join('\n') : '- none'}\n\n## Active escalation conditions (${activeEscalations.length})\n${activeEscalations.length ? activeEscalations.map(line).join('\n') : '- none'}\n\n## Open actions requiring Isaac (${requiresIsaacOpen.length})\n${requiresIsaacOpen.length ? requiresIsaacOpen.map(reqLine).join('\n') : '- none'}\n`;
}

async function loadEnvFiles() {
  const envFiles = [path.join(ROOT, 'admin-server/.env'), path.join(ROOT, '.env')];
  for (const file of envFiles) {
    if (!fssync.existsSync(file)) continue;
    const raw = await fs.readFile(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const idx = t.indexOf('=');
      const k = t.slice(0, idx).trim();
      const v = t.slice(idx + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  }
}

function getMailer() {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || '587');
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  if (!host || !user || !pass || !nodemailerLib) return null;
  return nodemailerLib.createTransport({ host, port, secure, auth: { user, pass } });
}

async function sendMail({ to, cc, subject, text, mode }) {
  await fs.mkdir(PACKET_DIR, { recursive: true });
  const stamp = nowIso().replace(/[:.]/g, '-');
  const file = path.join(PACKET_DIR, `${stamp}__${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}.md`);
  await fs.writeFile(file, text, 'utf8');

  if (mode !== 'send') {
    return { delivery: 'draft', packet_path: file, message_id: null };
  }

  const mailer = getMailer();
  if (!mailer) {
    return { delivery: 'draft', packet_path: file, message_id: null, warning: 'SMTP not configured; drafted only' };
  }

  const info = await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    cc,
    subject,
    text,
  });

  return { delivery: 'sent', packet_path: file, message_id: info.messageId || null };
}

function buildEscalationSet(actions) {
  const current = [];

  for (const a of actions) {
    for (const e of a.escalations || []) {
      current.push({
        key: `${e.rule}::${a.action_id}`,
        rule: e.rule,
        action_id: a.action_id,
        summary: `${a.action_text} | owner=${a.owner || '—'} | decision_owner=${a.decision_owner || '—'} | due=${a.due || '—'}`,
      });
    }
  }

  // Rule 6: many heavy actions in one meeting
  const heavyByMeeting = new Map();
  for (const a of actions) {
    if (a.status === 'done') continue;
    if (Number(a.effort_score || 0) < 4) continue;
    if (!a.stageCritical) continue;
    const id = String(a.meeting_id || '');
    if (!id) continue;
    heavyByMeeting.set(id, (heavyByMeeting.get(id) || 0) + 1);
  }
  for (const [meetingId, count] of heavyByMeeting.entries()) {
    if (count > HEAVY_ACTION_THRESHOLD_PER_MEETING) {
      current.push({
        key: `meeting_heavy_threshold::${meetingId}`,
        rule: 'meeting_heavy_threshold',
        action_id: null,
        summary: `Meeting ${meetingId} has ${count} heavy stage-critical actions`,
      });
    }
  }

  // Rule 7: shared unresolved decision dependency
  const waitingMap = new Map();
  for (const a of actions) {
    if (a.status === 'done') continue;
    const waiting = Array.isArray(a.waiting_on) ? a.waiting_on : [];
    for (const w of waiting) {
      const key = String(w || '').trim().toLowerCase();
      if (!key) continue;
      waitingMap.set(key, (waitingMap.get(key) || 0) + 1);
    }
  }
  for (const [dep, count] of waitingMap.entries()) {
    if (count > SHARED_DECISION_DEPENDENCY_THRESHOLD) {
      current.push({
        key: `shared_decision_dependency::${dep}`,
        rule: 'shared_decision_dependency',
        action_id: null,
        summary: `Dependency "${dep}" blocks ${count} actions`,
      });
    }
  }

  // Rule 8: coordinator overload
  const openCount = actions.filter((a) => ['open', 'in_progress', 'blocked'].includes(a.status)).length;
  if (openCount > COORDINATOR_OVERLOAD_OPEN_ACTIONS) {
    current.push({
      key: 'coordinator_overload',
      rule: 'coordinator_overload',
      action_id: null,
      summary: `Open action queue is ${openCount} (> ${COORDINATOR_OVERLOAD_OPEN_ACTIONS})`,
    });
  }

  return current;
}

function summariseStats(actions) {
  return {
    statusCounts: countBy(actions, (a) => a.status),
    ownerCounts: countBy(actions.filter((a) => a.owner), (a) => a.owner),
    initiativeCounts: countBy(actions.flatMap((a) => (a.initiative_ids || []).map((i) => ({ i }))), (x) => x.i),
  };
}

async function main() {
  await loadEnvFiles();

  const actions = enrich(await readJson(ACTIONS_FILE, []));
  const ledger = await readJson(NOTIFICATIONS_FILE, defaultNotifications());
  if (!Array.isArray(ledger.coordinator_packets)) ledger.coordinator_packets = [];
  if (!Array.isArray(ledger.isaac_exception_packets)) ledger.isaac_exception_packets = [];
  if (!Array.isArray(ledger.escalation_state)) ledger.escalation_state = [];

  const now = nowIso();

  const alreadyNotifiedRefs = new Set();
  for (const p of ledger.coordinator_packets) {
    for (const ref of p.action_refs || []) alreadyNotifiedRefs.add(`${ref.action_id}::${ref.updated_at}`);
  }

  const newActions = actions.filter((a) => !alreadyNotifiedRefs.has(`${a.action_id}::${a.updated_at}`));
  const missingAssignments = actions.filter((a) => a.status !== 'done' && a.missingOwner);
  const missingDecisionOwners = actions.filter((a) => a.status !== 'done' && a.missingDecisionOwner);
  const due72 = actions.filter((a) => a.due72);
  const blocked = actions.filter((a) => a.blocked);
  const overdue = actions.filter((a) => a.overdue);
  const requiresIsaac = actions.filter((a) => a.status !== 'done' && a.requires_isaac);

  const stats = summariseStats(actions);
  const packetPayload = {
    new_action_refs: newActions.map((a) => `${a.action_id}::${a.updated_at}`),
    missing_assignments: missingAssignments.map((a) => a.action_id),
    missing_decision_owners: missingDecisionOwners.map((a) => a.action_id),
    due72: due72.map((a) => a.action_id),
    blocked: blocked.map((a) => a.action_id),
    overdue: overdue.map((a) => a.action_id),
    requires_isaac: requiresIsaac.map((a) => a.action_id),
  };

  const digest = packetHash(packetPayload);
  const lastPacket = ledger.coordinator_packets.length ? ledger.coordinator_packets[ledger.coordinator_packets.length - 1] : null;
  const shouldSendCoordinator = FORCE || !lastPacket || lastPacket.digest !== digest;

  if (shouldSendCoordinator) {
    const packetText = renderCoordinatorPacket({
      ts: now,
      newActions,
      missingAssignments,
      missingDecisionOwners,
      due72,
      blocked,
      overdue,
      requiresIsaac,
      statusCounts: stats.statusCounts,
      ownerCounts: stats.ownerCounts,
      initiativeCounts: stats.initiativeCounts,
      mode: MODE,
    });

    const subject = `[USG Coordinator Packet] ${now.slice(0, 10)} • ${newActions.length} new • ${blocked.length} blocked`;
    const mailResult = await sendMail({ to: COORDINATOR_TO, cc: COORDINATOR_CC, subject, text: packetText, mode: MODE });

    const packet = {
      packet_id: `CP-${now.replace(/[:.TZ-]/g, '').slice(0, 14)}-${digest.slice(0, 6)}`,
      sent_at: now,
      mode: MODE,
      digest,
      action_refs: newActions.map((a) => ({ action_id: a.action_id, updated_at: a.updated_at })),
      total_actions: actions.length,
      delivery: mailResult.delivery,
      packet_path: mailResult.packet_path,
      message_id: mailResult.message_id,
    };

    ledger.coordinator_packets.push(packet);
    await appendEvent({ ts: now, event_type: 'coordinator.packet.sent', action_id: null, actor: 'system', meta: { packet_id: packet.packet_id, mode: MODE, delivery: mailResult.delivery } });
  }

  // Escalation state management
  const currentEscalations = buildEscalationSet(actions);
  const currentMap = new Map(currentEscalations.map((e) => [e.key, e]));
  const stateMap = new Map((ledger.escalation_state || []).map((e) => [e.key, e]));
  const newEscalations = [];

  for (const [key, esc] of currentMap.entries()) {
    const prev = stateMap.get(key);
    if (!prev || !prev.active) {
      const next = {
        key,
        rule: esc.rule,
        action_id: esc.action_id,
        summary: esc.summary,
        active: true,
        first_seen_at: now,
        last_seen_at: now,
        last_notified_at: null,
        resolved_at: null,
      };
      stateMap.set(key, next);
      newEscalations.push(next);
      if (esc.action_id) {
        await appendEvent({ ts: now, event_type: 'action.escalated', action_id: esc.action_id, actor: 'system', meta: { rule: esc.rule } });
      }
    } else {
      prev.active = true;
      prev.last_seen_at = now;
      prev.summary = esc.summary;
      stateMap.set(key, prev);
    }
  }

  for (const [key, prev] of stateMap.entries()) {
    if (!currentMap.has(key) && prev.active) {
      prev.active = false;
      prev.resolved_at = now;
      prev.last_seen_at = now;
      stateMap.set(key, prev);
    }
  }

  ledger.escalation_state = [...stateMap.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));

  const activeEscalations = ledger.escalation_state.filter((e) => e.active);
  const requiresIsaacOpen = actions.filter((a) => a.status !== 'done' && a.requires_isaac);

  const shouldSendImmediateIsaac = newEscalations.length > 0;
  const today = now.slice(0, 10);
  const shouldSendDailyIsaac = DAILY && ledger.last_daily_isaac_sent_on !== today;

  if (shouldSendImmediateIsaac || shouldSendDailyIsaac || FORCE) {
    const packetText = renderIsaacException({
      ts: now,
      newEscalations,
      activeEscalations,
      requiresIsaacOpen,
      mode: MODE,
    });
    const scope = shouldSendImmediateIsaac ? 'immediate' : 'daily';
    const subject = `[USG Isaac Exceptions] ${scope.toUpperCase()} ${now.slice(0, 10)} • new=${newEscalations.length} active=${activeEscalations.length}`;
    const mailResult = await sendMail({ to: ISAAC_TO, cc: '', subject, text: packetText, mode: MODE });

    const packet = {
      packet_id: `IP-${now.replace(/[:.TZ-]/g, '').slice(0, 14)}-${packetHash({ scope, newEscalations: newEscalations.map((x) => x.key), activeEscalations: activeEscalations.map((x) => x.key) }).slice(0, 6)}`,
      scope,
      sent_at: now,
      mode: MODE,
      delivery: mailResult.delivery,
      packet_path: mailResult.packet_path,
      message_id: mailResult.message_id,
      new_escalation_keys: newEscalations.map((e) => e.key),
      active_escalation_keys: activeEscalations.map((e) => e.key),
    };
    ledger.isaac_exception_packets.push(packet);
    await appendEvent({ ts: now, event_type: 'isaac.exception.sent', action_id: null, actor: 'system', meta: { packet_id: packet.packet_id, scope, mode: MODE, delivery: mailResult.delivery } });

    if (shouldSendDailyIsaac) ledger.last_daily_isaac_sent_on = today;
    for (const e of newEscalations) {
      const st = stateMap.get(e.key);
      if (st) {
        st.last_notified_at = now;
        stateMap.set(e.key, st);
      }
    }
    ledger.escalation_state = [...stateMap.values()];
  }

  ledger.mode = MODE;
  ledger.updated_at = now;
  await writeJson(NOTIFICATIONS_FILE, ledger);

  console.log(JSON.stringify({
    ok: true,
    mode: MODE,
    total_actions: actions.length,
    new_actions: newActions.length,
    coordinator_packet_sent: shouldSendCoordinator,
    new_escalations: newEscalations.length,
    active_escalations: activeEscalations.length,
    isaac_packet_sent: shouldSendImmediateIsaac || shouldSendDailyIsaac || FORCE,
    daily: DAILY,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
