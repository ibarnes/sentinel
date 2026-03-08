#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const inSignals = path.join(ROOT, 'dashboard/data/signals.json');
const inBuyers = path.join(ROOT, 'dashboard/data/buyers.json');
const inInitiatives = path.join(ROOT, 'dashboard/data/initiatives.json');
const outDir = path.join(ROOT, 'mission-control/signal-pressure/out');
const rpDir = path.join(ROOT, 'mission-control/review-packets');

const now = new Date();
const ts = now.toISOString();
const tsFile = ts.replace(/[:.]/g, '-');

function readJson(p, fallback = []) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function confToNum(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('medium-high')) return 0.72;
  if (s.includes('high')) return 0.85;
  if (s.includes('medium')) return 0.62;
  if (s.includes('low')) return 0.35;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

function inferVerificationStatus(status = '', note = '') {
  const s = `${status} ${note}`.toLowerCase();
  if (s.includes('verified') || s.includes('first-party') || s.includes('first party')) return 'verified';
  if (s.includes('monitor')) return 'monitor';
  return 'provisional';
}

function inferVerificationBasis(note = '') {
  const n = String(note).toLowerCase();
  if (n.includes('first-party') || n.includes('first party')) return 'first_party';
  if (n.includes('tier-1') || n.includes('tier 1') || n.includes('reuters') || n.includes('bloomberg') || n.includes('ft')) return 'two_tier1_or_tier1';
  if (n.includes('on-record') || n.includes('executive statement')) return 'executive_on_record';
  return 'insufficient';
}

const LIFECYCLE_RULES = [
  ['demand', ['demand', 'adoption', 'utilization']],
  ['narrative', ['narrative', 'positioning', 'messaging']],
  ['governance', ['regulation', 'governance', 'policy', 'ministry', 'committee']],
  ['capital allocation', ['allocation', 'fund', 'budget', 'mandate', 'investment']],
  ['resource positioning', ['critical mineral', 'feedstock', 'resource']],
  ['platform architecture', ['platform', 'architecture', 'operating system']],
  ['financial structuring', ['blended finance', 'reinsurance', 'guaranty', 'capital stack', 'structuring']],
  ['connectivity', ['port', 'shipping', 'corridor', 'fiber', 'single window']],
  ['energy', ['power', 'electricity', 'grid', 'energy', 'fuel', 'refinery']],
  ['compute', ['compute', 'data center', 'ai factory', 'gpu', 'ai infrastructure']],
  ['industrial production', ['aluminum', 'steel', 'cement', 'industrial']],
  ['construction', ['construction', 'epc', 'buildout']],
  ['operator', ['operator', 'operations', 'throughput']],
  ['market access', ['export', 're-export', 'procurement', 'rfp', 'tender']]
];

function inferLayers(signal) {
  const text = [signal.title, signal.summary, signal.flow, (signal.tags || []).join(' ')].join(' ').toLowerCase();
  const layers = [];
  for (const [layer, kws] of LIFECYCLE_RULES) {
    if (kws.some(k => text.includes(k))) layers.push(layer);
  }
  return [...new Set(layers)];
}

function inferChannel(signal) {
  const text = [signal.title, signal.summary, signal.flow, signal.signal_class, (signal.tags || []).join(' ')].join(' ').toLowerCase();
  if (/law|policy|government|ministry|senate|regulator|federal/.test(text)) return 'politics';
  if (/ai|compute|data center|platform|digital|tech/.test(text)) return 'technology';
  if (/fund|allocation|investment|capital|financ|reinsurance|budget/.test(text)) return 'capital';
  return 'news';
}

function pressureType(signal) {
  const text = [signal.title, signal.summary, signal.flow].join(' ').toLowerCase();
  const t = [];
  if (/sign|agreement|mou|launch|approve|award/.test(text)) t.push('commitment_event');
  if (/policy|law|regulator|mandate/.test(text)) t.push('policy_enabling');
  if (/fund|capital|allocate|investment|facility/.test(text)) t.push('allocation_commitment');
  if (/build|construction|operator|operations|throughput/.test(text)) t.push('execution_movement');
  return t.length ? t : ['formation_signal'];
}

function stableKey(n) {
  return [n.headline.toLowerCase(), n.related_buyers.sort().join(','), n.related_initiatives.sort().join(',')].join('|');
}

ensureDir(outDir);
ensureDir(rpDir);

const rawSignals = readJson(inSignals, []);
const buyers = readJson(inBuyers, []);
const initiatives = readJson(inInitiatives, []);

const buyerSet = new Set(buyers.map(b => b.buyer_id).filter(Boolean));
const initiativeSet = new Set(initiatives.map(i => i.initiative_id || i.id).filter(Boolean));

const normalized = rawSignals.map((s) => {
  const related_buyers = (s.buyer_ids || []).filter(id => buyerSet.has(id));
  const related_initiatives = (s.initiative_ids || []).filter(id => initiativeSet.has(id));
  const lifecycle_layers = inferLayers(s);
  const verification_status = inferVerificationStatus(s.status, s.verification_note);
  const verification_basis = inferVerificationBasis(s.verification_note);
  const confidence_score = confToNum(s.confidence);

  return {
    id: s.signal_id || `sig-${Math.random().toString(36).slice(2, 10)}`,
    timestamp_utc: s.observed_at || ts,
    channel: inferChannel(s),
    headline: s.title || 'Untitled signal',
    source_count: Array.isArray(s.sources) ? s.sources.length : 0,
    related_buyers,
    related_initiatives,
    lifecycle_layers,
    pressure_type: pressureType(s),
    confidence_score,
    verification_status,
    verification_basis,
    summary: s.summary || '',
    why_it_matters: s.flow || '',
    tags: s.tags || []
  };
}).filter(s => s.related_buyers.length || s.related_initiatives.length || s.lifecycle_layers.length);

const highImpact = normalized.filter(s => s.confidence_score >= 0.75 || s.verification_status === 'verified');

const currentIndex = new Map(normalized.map(s => [stableKey(s), s]));
const prevDeltaPath = path.join(outDir, 'pressure-delta.json');
const prevDelta = readJson(prevDeltaPath, { last_keys: [] });
const prevKeys = new Set(prevDelta.last_keys || []);
const currentKeys = [...currentIndex.keys()];

const newKeys = currentKeys.filter(k => !prevKeys.has(k));
const newHighImpact = newKeys.map(k => currentIndex.get(k)).filter(s => s && highImpact.some(h => h.id === s.id));

const delta = {
  generated_at: ts,
  total_signals: normalized.length,
  high_impact_count: highImpact.length,
  new_signal_count: newKeys.length,
  new_high_impact_count: newHighImpact.length,
  new_high_impact: newHighImpact.slice(0, 10).map(s => ({
    id: s.id,
    headline: s.headline,
    channel: s.channel,
    verification_status: s.verification_status,
    confidence_score: s.confidence_score
  })),
  last_keys: currentKeys
};

// outputs
const jsonlPath = path.join(outDir, 'signals.jsonl');
fs.writeFileSync(jsonlPath, normalized.map(o => JSON.stringify(o)).join('\n') + '\n');
fs.writeFileSync(prevDeltaPath, JSON.stringify(delta, null, 2));

const reviewPacketPath = path.join(rpDir, `RP-${tsFile}-signal-pressure-monitor.md`);
const lines = [];
lines.push(`# Review Packet — Signal Pressure Monitor (${ts})`);
lines.push('');
lines.push('## Observations');
lines.push(`- Normalized signals: ${normalized.length}`);
lines.push(`- High impact signals: ${highImpact.length}`);
lines.push(`- New since prior run: ${newKeys.length}`);
lines.push(`- New high-impact: ${newHighImpact.length}`);
lines.push('');
lines.push('## New High-Impact Signals');
if (!newHighImpact.length) {
  lines.push('- None');
} else {
  for (const s of newHighImpact.slice(0, 10)) {
    lines.push(`- **${s.headline}** (${s.channel}) — ${s.verification_status}, confidence ${s.confidence_score}`);
  }
}
lines.push('');
lines.push('## Output Artifacts');
lines.push(`- JSONL ledger: \`${path.relative(ROOT, jsonlPath)}\``);
lines.push(`- Delta file: \`${path.relative(ROOT, prevDeltaPath)}\``);

fs.writeFileSync(reviewPacketPath, lines.join('\n') + '\n');

console.log(JSON.stringify({ ok: true, generated_at: ts, signals: normalized.length, review_packet: path.relative(ROOT, reviewPacketPath) }, null, 2));
