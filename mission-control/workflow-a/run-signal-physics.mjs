import fs from 'node:fs/promises';

const SIGNALS_PATH = new URL('../../dashboard/data/signals.json', import.meta.url);
const INITIATIVES_PATH = new URL('../../dashboard/data/initiatives.json', import.meta.url);
const CONFIG_PATH = new URL('./signal-physics-config.json', import.meta.url);
const ONTOLOGY_PATH = new URL('./infrastructure-ontology.json', import.meta.url);
const OUT_DIR = new URL('./out/', import.meta.url);
const SNAPSHOT_PATH = new URL('../../dashboard/data/signal_physics_snapshot.json', import.meta.url);

const CONFIDENCE_WEIGHT = { 'High': 0.92, 'Medium-High': 0.82, 'Medium': 0.68, 'Low': 0.45 };
const VERIFICATION_WEIGHT = { 'Verified': 1.0, 'Active / Forming': 0.82, 'Monitor': 0.58 };
const MATERIALITY_WEIGHT = {
  'Capital Reality': 0.95,
  'Platform Pressure': 0.85,
  'Pre-FID Origin Window': 0.90,
  'FID Definability': 0.84,
  'Ecosystem / Theater': 0.72,
  'Structural Ambiguity': 0.66,
  'Sponsor Altitude': 0.80
};

const SYSTEM_KEYWORDS = {
  financial: ['capital', 'insurance', 'reinsurance', 'allocation', 'fund', 'financing', 'liquidity', 'credit', 'mandate'],
  energy: ['energy', 'power', 'grid', 'lng', 'oil', 'gas', 'battery', 'electricity'],
  compute: ['ai', 'compute', 'data center', 'hyperscaler', 'chip', 'nvidia'],
  communications: ['fiber', 'network', 'subsea', 'connectivity', 'telecom', 'satellite', 'digital rails', 'communications'],
  logistics: ['port', 'shipping', 'maritime', 'corridor', 'supply chain', 'strait', 'trade flow'],
  industrialProduction: ['industrial', 'manufacturing', 'aluminum', 'cement', 'factory', 'mining', 'commodities']
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

function safeParseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  return Math.max(0.01, (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function recencyWeight(observedAt, now) {
  const d = safeParseDate(observedAt);
  if (!d) return 0.55;
  const ageDays = daysBetween(now, d);
  if (ageDays <= 3) return 1.0;
  if (ageDays <= 7) return 0.92;
  if (ageDays <= 14) return 0.82;
  if (ageDays <= 30) return 0.70;
  return 0.55;
}

function sourceDomain(url = '') {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    if (url.startsWith('internal://')) return 'internal';
    return 'unknown';
  }
}

async function readJson(path, fallback = null) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); } catch { return fallback; }
}

function buildDomainReliability(signals) {
  const buckets = new Map();
  for (const s of signals) {
    for (const src of s.sources || []) {
      const d = sourceDomain(src.url);
      if (!buckets.has(d)) buckets.set(d, { total: 0, verified: 0 });
      const b = buckets.get(d);
      b.total += 1;
      if ((s.status || '').toLowerCase().includes('verified')) b.verified += 1;
    }
  }
  const rel = {};
  for (const [domain, v] of buckets.entries()) rel[domain] = clamp((v.verified + 1) / (v.total + 2), 0.2, 0.95);
  return rel;
}

function inferSystems(signal, systems) {
  const text = `${signal.title || ''} ${signal.summary || ''} ${(signal.tags || []).join(' ')}`.toLowerCase();
  const hits = systems.filter((sys) => (SYSTEM_KEYWORDS[sys] || []).some((k) => text.includes(k)));
  if (hits.length) return hits;
  if (signal.signal_class === 'Capital Reality') return ['financial'];
  if (signal.signal_class === 'Platform Pressure') return ['energy', 'financial'];
  if (signal.signal_class === 'Pre-FID Origin Window') return ['financial', 'industrialProduction'];
  if (signal.signal_class === 'Ecosystem / Theater') return ['communications'];
  return ['financial'];
}

function inferOntology(signal, ontology) {
  const text = `${signal.title || ''} ${signal.summary || ''} ${signal.flow || ''} ${(signal.tags || []).join(' ')}`.toLowerCase();
  const matches = [];

  for (const layer of ontology.layers || []) {
    const hitCount = (layer.keywords || []).reduce((n, k) => n + (text.includes(k.toLowerCase()) ? 1 : 0), 0);
    if (hitCount > 0) {
      matches.push({ id: layer.id, name: layer.name, phase: layer.phase, order: layer.order, score: Number(clamp(hitCount / 4, 0.2, 1.0).toFixed(3)) });
    }
  }

  if (!matches.length) {
    const defaults = {
      'Capital Reality': ['capital_allocation'],
      'Platform Pressure': ['demand', 'platform_architecture'],
      'Pre-FID Origin Window': ['platform_architecture', 'financial_structuring'],
      'FID Definability': ['financial_structuring'],
      'Ecosystem / Theater': ['narrative_legitimacy'],
      'Structural Ambiguity': ['data_intelligence'],
      'Sponsor Altitude': ['operator']
    };
    const ids = defaults[signal.signal_class] || ['data_intelligence'];
    for (const id of ids) {
      const layer = (ontology.layers || []).find((x) => x.id === id);
      if (layer) matches.push({ id: layer.id, name: layer.name, phase: layer.phase, order: layer.order, score: 0.3 });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const m of matches.sort((a, b) => a.order - b.order)) {
    if (!seen.has(m.id)) { seen.add(m.id); unique.push(m); }
  }

  const phaseCounts = unique.reduce((acc, x) => ({ ...acc, [x.phase]: (acc[x.phase] || 0) + 1 }), { early: 0, mid: 0, late: 0 });
  const phase = phaseCounts.late >= phaseCounts.mid && phaseCounts.late >= phaseCounts.early
    ? 'late'
    : phaseCounts.mid >= phaseCounts.early ? 'mid' : 'early';

  const crossLayerLinks = [];
  for (let i = 1; i < unique.length; i += 1) {
    crossLayerLinks.push({ from: unique[i - 1].id, to: unique[i].id, gap: unique[i].order - unique[i - 1].order });
  }

  const progression = unique.length
    ? Number((unique.reduce((a, b) => a + b.order, 0) / (unique.length * 15)).toFixed(3))
    : 0.1;

  return { layers: unique, phase, crossLayerLinks, progression };
}

function phaseWeight(phase) { return phase === 'early' ? 0.78 : phase === 'mid' ? 0.95 : 1.08; }

function computeSignalPhysics(signal, cfg, domainReliability, now, ontology) {
  const confidence = CONFIDENCE_WEIGHT[signal.confidence] ?? 0.58;
  const verification = VERIFICATION_WEIGHT[signal.status] ?? 0.58;
  const materiality = MATERIALITY_WEIGHT[signal.signal_class] ?? 0.7;
  const sources = signal.sources || [];
  const corroboration = clamp(Math.log2(sources.length + 1) / 2, 0.15, 1.0);
  const sourceAcc = sources.length
    ? sources.reduce((a, s) => a + (domainReliability[sourceDomain(s.url)] ?? 0.55), 0) / sources.length
    : 0.45;

  const text = `${signal.summary || ''} ${signal.verification_note || ''}`.toLowerCase();
  const ambiguityTokens = ['may', 'appears', 'monitor', 'unverified', 'rumor', 'pending', 'unknown'];
  const ambiguityHits = ambiguityTokens.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0);
  const clarity = clamp(1 - ambiguityHits * 0.12, 0.2, 1.0);

  const signalPower = (0.27 * sourceAcc) + (0.22 * verification) + (0.20 * corroboration) + (0.18 * materiality) + (0.13 * clarity);
  const noisePower = clamp((1 - sourceAcc) * 0.35 + (1 - clarity) * 0.35 + (1 - verification) * 0.30, 0.08, 0.95);
  const snr = clamp(signalPower / noisePower, 0.2, 6.0);

  const onto = inferOntology(signal, ontology);
  const lag = cfg.lagDaysByClass[signal.signal_class] || { min: 21, max: 180 };
  const recency = recencyWeight(signal.observed_at, now);
  const amplitude = clamp((signalPower * 100) * recency * phaseWeight(onto.phase), 3, 100);

  return {
    snr: Number(snr.toFixed(3)),
    snrNormalized: Number(clamp(snr / 6, 0, 1).toFixed(3)),
    sourceReliability: Number(sourceAcc.toFixed(3)),
    verificationLevel: Number(verification.toFixed(3)),
    corroborationLevel: Number(corroboration.toFixed(3)),
    materiality: Number(materiality.toFixed(3)),
    clarity: Number(clarity.toFixed(3)),
    lagDays: lag,
    phase: onto.phase,
    amplitude: Number(amplitude.toFixed(2)),
    recencyWeight: Number(recency.toFixed(3)),
    ontology: onto
  };
}

function applyCoupling(baseEnergy, systems, cfg) {
  const propagated = Object.fromEntries(systems.map((s) => [s, 0]));
  for (const [sys, val] of Object.entries(baseEnergy)) {
    propagated[sys] += val;
    const out = cfg.coupling[sys] || {};
    for (const [dst, w] of Object.entries(out)) {
      if (!(dst in propagated)) continue;
      propagated[dst] += val * w;
    }
  }
  for (const k of Object.keys(propagated)) propagated[k] = Number(propagated[k].toFixed(3));
  return propagated;
}

function detectResonance(signalsForInitiative) {
  const layerCounts = {};
  for (const s of signalsForInitiative) {
    for (const l of s.physics.ontology.layers || []) {
      layerCounts[l.id] = (layerCounts[l.id] || 0) + 1;
    }
  }
  const activeLayers = Object.values(layerCounts).filter((v) => v > 0).length;
  const clusterStrength = clamp((activeLayers - 1) / 8, 0, 1);
  return { layerCounts, activeLayers, clusterStrength: Number(clusterStrength.toFixed(3)) };
}

function classifyState(pressure, momentum, clusterStrength, progression) {
  const adjusted = pressure + Math.max(0, momentum * 8) + clusterStrength * 6 + progression * 10;
  if (adjusted < 16) return 'Monitor';
  if (adjusted < 28) return 'Shaping';
  if (adjusted < 40) return 'Platform Formation';
  if (adjusted < 54) return 'Capital Alignment';
  if (adjusted < 68) return 'Pre-FID';
  return 'Execution';
}

function summarizeTrajectory(momentum, acceleration) {
  if (momentum > 2 && acceleration > 0) return 'Rapidly forming';
  if (momentum > 0.7) return 'Building';
  if (momentum < -0.7 && acceleration < 0) return 'Losing momentum';
  return 'Slow emergence / stable';
}

function bayesianUpdate(prior, evidence, confidenceGain) {
  const k = clamp(0.15 + confidenceGain * 0.55, 0.15, 0.7);
  return clamp(prior + k * (evidence - prior), 0.01, 0.99);
}

async function main() {
  const now = new Date();
  const [signals, initiatives, cfg, ontology, previous] = await Promise.all([
    readJson(SIGNALS_PATH, []),
    readJson(INITIATIVES_PATH, []),
    readJson(CONFIG_PATH, null),
    readJson(ONTOLOGY_PATH, null),
    readJson(SNAPSHOT_PATH, null)
  ]);

  if (!cfg) throw new Error('signal-physics-config.json missing or invalid');
  if (!ontology) throw new Error('infrastructure-ontology.json missing or invalid');

  const systems = cfg.systems;
  const domainReliability = buildDomainReliability(signals);

  const enrichedSignals = signals.map((s) => {
    const physics = computeSignalPhysics(s, cfg, domainReliability, now, ontology);
    const sys = inferSystems(s, systems);
    const baseBySystem = Object.fromEntries(sys.map((k) => [k, Number((physics.amplitude * physics.snrNormalized).toFixed(3))]));
    const coupled = applyCoupling(baseBySystem, systems, cfg);
    return { ...s, systems: sys, physics, pressureContributionBySystem: coupled, ontologyLayers: physics.ontology.layers.map((l) => l.id) };
  });

  const initiativeIds = new Set(['GLOBAL', ...initiatives.map((i) => i.initiative_id)]);
  for (const s of enrichedSignals) for (const id of s.initiative_ids || []) initiativeIds.add(id);

  const previousByInitiative = new Map((previous?.initiatives || []).map((x) => [x.initiative_id, x]));
  const initiativeStates = [];

  for (const initiative_id of initiativeIds) {
    const group = enrichedSignals.filter((s) => initiative_id === 'GLOBAL' ? true : (s.initiative_ids || []).includes(initiative_id));
    const resonance = detectResonance(group);
    const pressureBySystem = Object.fromEntries(systems.map((sys) => [sys, 0]));

    for (const s of group) {
      const reinforcement = 1 + Math.max(0, (s.systems.length - 1) * 0.08) + resonance.clusterStrength * 0.25;
      for (const sys of systems) pressureBySystem[sys] += (s.pressureContributionBySystem[sys] || 0) * reinforcement;
    }
    for (const sys of systems) pressureBySystem[sys] = Number(pressureBySystem[sys].toFixed(3));

    const rawPressure = Object.values(pressureBySystem).reduce((a, b) => a + b, 0) / Math.max(1, systems.length);
    const sizeNormalizer = Math.max(1, Math.sqrt(group.length || 1));
    const normalizedPressure = rawPressure / sizeNormalizer;
    const pressure = Number((20 * Math.log1p(normalizedPressure / 20)).toFixed(3));

    const prev = previousByInitiative.get(initiative_id);
    const prevTs = safeParseDate(prev?.generatedAt || previous?.generatedAt || now.toISOString()) || now;
    const dtDays = Math.max(1, daysBetween(now, prevTs));
    const prevPressure = Number(prev?.pressure || pressure);
    const momentum = Number(((pressure - prevPressure) / dtDays).toFixed(4));
    const prevMomentum = Number(prev?.momentum || 0);
    const acceleration = Number(((momentum - prevMomentum) / dtDays).toFixed(4));

    const layerSet = new Set();
    const phaseCounts = { early: 0, mid: 0, late: 0 };
    let progressionSum = 0;
    let progressionN = 0;
    const buyerCounts = {};

    for (const s of group) {
      for (const l of s.physics.ontology.layers || []) layerSet.add(l.id);
      phaseCounts[s.physics.phase] = (phaseCounts[s.physics.phase] || 0) + 1;
      progressionSum += s.physics.ontology.progression;
      progressionN += 1;
      for (const b of s.buyer_ids || []) buyerCounts[b] = (buyerCounts[b] || 0) + 1;
    }

    const progression = Number((progressionN ? progressionSum / progressionN : 0.1).toFixed(3));
    const state = classifyState(pressure, momentum, resonance.clusterStrength, progression);

    const phaseMix = group.length
      ? {
          early: Number((phaseCounts.early / group.length).toFixed(3)),
          mid: Number((phaseCounts.mid / group.length).toFixed(3)),
          late: Number((phaseCounts.late / group.length).toFixed(3))
        }
      : { early: 0, mid: 0, late: 0 };

    const platformEvidence = sigmoid((pressure / 18) + (momentum * 2.0) + (resonance.clusterStrength * 1.4) + (progression * 2) - 2.1);
    const fidEvidence = sigmoid((pressure / 24) + (Math.max(0, momentum) * 1.8) + (phaseMix.late * 1.8) + (progression * 1.4) - 2.7);

    const priorPlatform = clamp(prev?.probability?.platformFormation ?? 0.35, 0.01, 0.99);
    const priorFid = clamp(prev?.probability?.fid ?? 0.25, 0.01, 0.99);
    const confidenceGain = group.length ? group.reduce((a, s) => a + s.physics.snrNormalized, 0) / group.length : 0.2;

    const pPlatform = bayesianUpdate(priorPlatform, platformEvidence, confidenceGain);
    const pFid = bayesianUpdate(priorFid, fidEvidence, confidenceGain);

    const topBuyers = Object.entries(buyerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([buyer_id, signalCount]) => ({ buyer_id, signalCount }));

    initiativeStates.push({
      initiative_id,
      pressure,
      pressureBySystem,
      momentum,
      acceleration,
      resonance,
      phaseMix,
      ontology: {
        activeLayers: [...layerSet],
        progression,
        layerCount: layerSet.size
      },
      buyerAlignment: topBuyers,
      trajectory: summarizeTrajectory(momentum, acceleration),
      state,
      probability: {
        platformFormation: Number(pPlatform.toFixed(3)),
        fid: Number(pFid.toFixed(3))
      },
      signalCount: group.length,
      generatedAt: now.toISOString()
    });
  }

  const sortedInitiatives = initiativeStates.filter((i) => i.initiative_id !== 'GLOBAL').sort((a, b) => b.pressure - a.pressure);
  const top = sortedInitiatives.slice(0, 8).map((x) => ({
    initiative_id: x.initiative_id,
    state: x.state,
    pressure: x.pressure,
    momentum: x.momentum,
    trajectory: x.trajectory,
    clusterStrength: x.resonance.clusterStrength,
    ontologyLayerCount: x.ontology.layerCount,
    ontologyProgression: x.ontology.progression,
    pPlatformFormation: x.probability.platformFormation,
    pFID: x.probability.fid,
    buyerAlignment: x.buyerAlignment
  }));

  const brief = {
    pressureLevels: top.map((x) => `${x.initiative_id}: ${x.pressure.toFixed(2)} (${x.state})`),
    momentumChanges: top.map((x) => `${x.initiative_id}: ${x.momentum >= 0 ? '+' : ''}${x.momentum.toFixed(3)} / day`),
    emergingClusters: top.filter((x) => x.clusterStrength >= 0.45 && x.ontologyLayerCount >= 3).map((x) => `${x.initiative_id} layers=${x.ontologyLayerCount} cluster=${x.clusterStrength.toFixed(2)}`),
    predictedTrajectories: top.map((x) => `${x.initiative_id}: ${x.trajectory}`),
    highConfidenceInitiatives: top.filter((x) => x.pPlatformFormation >= 0.65 || x.pFID >= 0.55).map((x) => x.initiative_id),
    weakeningInitiatives: top.filter((x) => x.momentum < -0.5).map((x) => x.initiative_id),
    buyerAlignment: top.map((x) => ({ initiative_id: x.initiative_id, buyers: x.buyerAlignment.slice(0, 3) }))
  };

  const snapshot = {
    version: 'signal-physics-v1.1-ontology',
    generatedAt: now.toISOString(),
    modelNotes: {
      fallbackRuleSystem: 'unchanged',
      explainability: 'Deterministic from signal metadata, ontology mapping, and config coefficients.'
    },
    ontologyVersion: ontology.version,
    ontologyLayers: ontology.layers.map((l) => ({ id: l.id, phase: l.phase, order: l.order })),
    systems,
    enrichedSignals,
    initiatives: initiativeStates,
    topInitiatives: top,
    morningBriefEnhancements: brief
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  await fs.writeFile(new URL(`./out/signal-physics-${stamp}.json`, import.meta.url), JSON.stringify(snapshot, null, 2));
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(SNAPSHOT_PATH.pathname);
}

main();
