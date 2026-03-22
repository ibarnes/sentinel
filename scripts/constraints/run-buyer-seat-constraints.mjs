#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const ROOT = '/home/ec2-user/.openclaw/workspace';
const DATA = path.join(ROOT, 'dashboard/data');
const CONFIG = path.join(ROOT, 'dashboard/config');

const nowIso = () => new Date().toISOString();

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function scoreToConfidence(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function hasField(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function parseInfluence(value) {
  const s = String(value || '').toLowerCase();
  if (s.includes('high')) return 0.9;
  if (s.includes('med')) return 0.6;
  if (s.includes('low')) return 0.3;
  return 0;
}

function pickSeatStage(initiative = {}) {
  const gate = String(initiative.gate_stage || '').toLowerCase();
  const state = String(initiative.current_state || '').toLowerCase();
  if (gate.includes('0') || gate.includes('1') || state.includes('discover')) return 'anchor';
  if (state.includes('mandate') || gate.includes('2')) return 'mandate_fee';
  if (state.includes('pre') || gate.includes('3') || gate.includes('4')) return 'pre_fid';
  if (state.includes('fid') || gate.includes('5') || gate.includes('6')) return 'fid';
  return 'strategic_follow_on';
}

function evaluateConstraint(status, notes, evidenceScore) {
  let evidence_sufficiency = 'missing';
  if (evidenceScore >= 0.8) evidence_sufficiency = 'sufficient';
  else if (evidenceScore >= 0.45) evidence_sufficiency = 'partial';
  return {
    status,
    confidence: scoreToConfidence(evidenceScore),
    evidence_sufficiency,
    notes,
  };
}

function deriveBuyerSeat(initiative, buyer, decisionRows, contactRows) {
  const seatPeople = decisionRows.filter((r) => r.buyer_id === buyer?.buyer_id);
  const contact = contactRows.find((r) => r.buyer_id === buyer?.buyer_id);

  const authorityScore = Math.max(
    ...seatPeople.map((p) => parseInfluence(p.influence || p.title || p.lane)),
    hasField(buyer?.transfer_chain?.approval_authority) ? 0.6 : 0,
    0.2
  );

  const capitalScore = hasField(buyer?.transfer_chain?.funding_type)
    ? 0.8
    : hasField(buyer?.transfer_chain?.budget_program)
      ? 0.6
      : 0.3;

  const mandateScore = hasField(initiative.infrastructure_category) && Array.isArray(buyer?.sector_focus)
    ? (buyer.sector_focus.map((x) => String(x).toLowerCase()).includes(String(initiative.infrastructure_category || '').toLowerCase()) ? 0.85 : 0.55)
    : 0.45;

  const pressureScore = (() => {
    const p = String(buyer?.pressure_factors?.timing_urgency || '').toLowerCase();
    if (p.includes('high')) return 0.85;
    if (p.includes('med')) return 0.6;
    if (p.includes('low')) return 0.35;
    return 0.4;
  })();

  const riskScore = hasField(initiative?.macro_gravity_summary) ? 0.6 : 0.35;
  const trustScore = (() => {
    const s = String(contact?.status || contact?.access_type || '').toLowerCase();
    if (s.includes('ready') || s.includes('active') || s.includes('direct')) return 0.85;
    if (s.includes('warming') || s.includes('prox')) return 0.55;
    return 0.3;
  })();

  const decisionScore = (() => {
    const t = String(initiative?.next_required_transition || '').trim();
    if (t && t !== '—') return 0.8;
    const n = String(initiative?.next_required_state || '').trim();
    if (n && n !== '—') return 0.6;
    return 0.3;
  })();

  const dependencyStatus = seatPeople.length > 2 ? 'replaceable' : seatPeople.length > 1 ? 'thin_bench' : 'singleton';

  const authority = authorityScore >= 0.8 ? 'unconstrained' : authorityScore >= 0.5 ? 'partial' : 'blocked';
  const capital = capitalScore >= 0.8 ? 'aligned' : capitalScore >= 0.5 ? 'fragmented' : 'absent';
  const mandate = mandateScore >= 0.8 ? 'native' : mandateScore >= 0.5 ? 'adjacent' : 'out_of_scope';
  const pressure = pressureScore >= 0.8 ? 'high_pressure' : pressureScore >= 0.5 ? 'latent_pressure' : 'no_pressure';
  const risk = riskScore >= 0.8 ? 'acceptable' : riskScore >= 0.5 ? 'unclear' : 'too_high';
  const trust = trustScore >= 0.8 ? 'direct_trust' : trustScore >= 0.5 ? 'proxied' : 'no_access';
  const decision = decisionScore >= 0.8 ? 'binary_clear' : decisionScore >= 0.5 ? 'fuzzy' : 'open_loop';

  const constraints = {
    authority: evaluateConstraint(authority, 'Authority inferred from decision architecture influence and approval chain evidence.', authorityScore),
    capital_control: evaluateConstraint(capital, 'Capital control inferred from buyer transfer-chain deployability fields.', capitalScore),
    mandate_alignment: evaluateConstraint(mandate, 'Mandate fit inferred from initiative category vs buyer sector focus.', mandateScore),
    urgency_pressure: evaluateConstraint(pressure, 'Urgency inferred from buyer pressure factors and timing signals.', pressureScore),
    risk_perception: evaluateConstraint(risk, 'Risk stance inferred from initiative clarity and macro-gravity articulation.', riskScore),
    trust_access: evaluateConstraint(trust, 'Trust/access inferred from active contact path quality and freshness.', trustScore),
    decision_clarity: evaluateConstraint(decision, 'Decision clarity inferred from explicit next-transition definition.', decisionScore),
  };

  return {
    buyer_seat: {
      description: seatPeople[0]?.title || buyer?.name || 'Primary buyer seat',
      capital_range: buyer?.transfer_chain?.estimated_time_to_transfer || 'Unknown',
      capital_type: buyer?.transfer_chain?.funding_type || 'Unspecified',
      authority_type: buyer?.transfer_chain?.approval_authority || 'Unspecified',
      seat_validity: 'weak',
    },
    constraints,
    dependency_risk: {
      status: dependencyStatus,
      notes: `Derived from mapped decision-architecture bench depth (${seatPeople.length} seat actor(s)).`,
    },
  };
}

function computeDominance(record, policy) {
  const hardOrder = policy.hard_blocker_order;
  const convOrder = policy.conversion_blocker_order;
  const hardMap = policy.hard_blockers;
  const green = policy.green_states;

  const constraints = record.constraints;
  const hard = [];
  for (const key of hardOrder) {
    if ((hardMap[key] || []).includes(constraints[key].status)) hard.push(key);
  }

  let dominant_blocker = '';
  if (hard.length) dominant_blocker = hard[0];
  else {
    for (const key of convOrder) {
      if (!(green[key] || []).includes(constraints[key].status)) {
        dominant_blocker = key;
        break;
      }
    }
  }

  let dominant_degrader = '';
  const nonGreen = [...hardOrder, ...convOrder].filter((k) => !(green[k] || []).includes(constraints[k].status));
  if (nonGreen.length) {
    dominant_degrader = nonGreen.find((k) => k !== dominant_blocker) || '';
  }

  const hasHardBlocker = hard.length > 0;
  const hasAnyBlockerOrDegrader = Boolean(dominant_blocker || dominant_degrader);

  if (hasHardBlocker) record.buyer_seat.seat_validity = 'invalid';
  else if (hasAnyBlockerOrDegrader) record.buyer_seat.seat_validity = 'weak';
  else record.buyer_seat.seat_validity = 'valid';

  record.dominant_blocker = dominant_blocker;
  record.dominant_degrader = dominant_degrader;
  record.recommended_owner = policy.recommended_owner_by_constraint[dominant_blocker || dominant_degrader || ''] || 'Deal Lead';

  const nextKey = dominant_blocker || dominant_degrader;
  record.next_action = nextKey
    ? (policy.next_action_templates[nextKey] || 'Collect targeted evidence and resolve the dominant constraint.')
    : 'Seat is valid at current stage. Move to mandate conversion sequence.';

  return record;
}

function addIntelligenceTasks(record) {
  const tasks = [];
  for (const [key, value] of Object.entries(record.constraints)) {
    if (value.evidence_sufficiency === 'missing') {
      tasks.push({
        constraint: key,
        priority: key === 'authority' || key === 'capital_control' || key === 'mandate_alignment' ? 'high' : 'medium',
        task: `Collect first-party evidence to upgrade ${key} from missing evidence to partial/sufficient.`,
      });
    }
  }
  record.intelligence_tasks = tasks;
  return record;
}

async function main() {
  const initiatives = await readJson(path.join(DATA, 'initiatives.json'), []);
  const buyers = await readJson(path.join(DATA, 'buyers.json'), []);
  const decisionRows = await readJson(path.join(DATA, 'decision_architecture.json'), []);
  const contactRows = await readJson(path.join(DATA, 'contact_paths.json'), []);
  const policy = await readJson(path.join(CONFIG, 'buyer-seat-constraint.policy.v1.json'), {});

  const out = [];
  for (const i of initiatives) {
    const buyerId = i.primary_buyer_id || i.linked_buyers?.[0] || '';
    const buyer = buyers.find((b) => b.buyer_id === buyerId) || null;

    const base = deriveBuyerSeat(i, buyer, decisionRows, contactRows);
    let record = {
      initiative_id: i.initiative_id,
      buyer_id: buyerId || '',
      buyer_seat_stage: pickSeatStage(i),
      ...base,
      dominant_blocker: '',
      dominant_degrader: '',
      next_action: '',
      recommended_owner: '',
      model_version: 'usg_buyer_seat_constraints_v1.0',
      updated_at: nowIso(),
      updated_by: 'scripts/constraints/run-buyer-seat-constraints.mjs',
    };

    record = computeDominance(record, policy);
    record = addIntelligenceTasks(record);
    out.push(record);
  }

  const outPath = path.join(DATA, 'buyer_seat_constraints.json');
  await fs.writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(`wrote ${out.length} buyer-seat constraint records -> ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
