import fs from 'node:fs/promises';

const SIGNALS_PATH = new URL('../../dashboard/data/signals.json', import.meta.url);
const INITIATIVES_PATH = new URL('../../dashboard/data/initiatives.json', import.meta.url);
const CONFIG_PATH = new URL('./signal-physics-config.json', import.meta.url);
const OUT_DIR = new URL('./out/', import.meta.url);
const SNAPSHOT_PATH = new URL('../../dashboard/data/signal_physics_snapshot.json', import.meta.url);

const CONFIDENCE_WEIGHT = {
  'High': 0.92,
  'Medium-High': 0.82,
  'Medium': 0.68,
  'Low': 0.45
};

const VERIFICATION_WEIGHT = {
  'Verified': 1.0,
  'Active / Forming': 0.82,
  'Monitor': 0.58
};

const MATERIALITY_WEIGHT = {
  'Capital Reality': 0.95,
  'Platform Pressure': 0.85,
  'Pre-FID Origin Window': 0.90,
  'FID Definability': 0.84,
  'Ecosystem / Theater': 0.72,
  'Structural Ambiguity': 0.66,
  'Sponsor Altitude': 0.80
};

const PHASE_MAP = {
  early: ['projection', 'policy', 'narrative', 'strategy', 'ambition', 'ecosystem', 'theater'],
  mid: ['mandate', 'platform', 'architecture', 'capital', 'allocation', 'positioning'],
  late: ['commitment', 'agreement', 'construction', 'operator', 'execution', 'deploy']
};

const SYSTEM_KEYWORDS = {
  financial: ['capital', 'insurance', 'reinsurance', 'allocation', 'fund', 'financing', 'liquidity', 'credit', 'mandate'],
  energy: ['energy', 'power', 'grid', 'lng', 'oil', 'gas', 'battery', 'electricity'],
  compute: ['ai', 'compute', 'data center', 'hyperscaler', 'chip', 'nvidia'],
  communications: ['fiber', 'network', 'subsea', 'connectivity', 'telecom', 'satellite', 'digital rails', 'communications'],
  logistics: ['port', 'shipping', 'maritime', 'corridor', 'supply chain', 'strait', 'trade flow'],
  industrialProduction: ['industrial', 'manufacturing', 'aluminum', 'cement', 'factory', 'mining', 'commodities']
};

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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function inferPhase(signal) {
  const text = `${signal.title || ''} ${signal.summary || ''} ${signal.flow || ''}`.toLowerCase();
  for (const [phase, keys] of Object.entries(PHASE_MAP)) {
    if (keys.some((k) => text.includes(k))) return phase;
  }
  if (signal.signal_class === 'Ecosystem / Theater' || signal.signal_class === 'Structural Ambiguity') return 'early';
  if (signal.signal_class === 'Capital Reality' || signal.signal_class === 'Pre-FID Origin Window') return 'mid';
  return 'late';
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

function phaseWeight(phase) {
  return phase === 'early' ? 0.78 : phase === 'mid' ? 0.95 : 1.08;
}

function phaseSignalContribution(phase, targetState) {
  const maps = {
    Monitor: { early: 1.0, mid: 0.8, late: 0.6 },
    Shaping: { early: 0.9, mid: 1.0, late: 0.7 },
    PlatformFormation: { early: 0.7, mid: 1.0, late: 0.9 },
    CapitalAlignment: { early: 0.5, mid: 0.95, late: 1.0 },
    PreFID: { early: 0.4, mid: 0.8, late: 1.05 },
    Execution: { early: 0.3, mid: 0.7, late: 1.1 }
  };
  return maps[targetState][phase] || 0.8;
}

function classifyState(pressure, momentum, clusterStrength) {
  const adjusted = pressure + Math.max(0, momentum * 8) + clusterStrength * 4;
  if (adjusted < 18) return 'Monitor';
  if (adjusted < 32) return 'Shaping';
  if (adjusted < 48) return 'Platform Formation';
  if (adjusted < 62) return 'Capital Alignment';
  if (adjusted < 78) return 'Pre-FID';
  return 'Execution';
}

function summarizeTrajectory(momentum, acceleration) {
  if (momentum > 2 && acceleration > 0) return 'Rapidly forming';
  if (momentum > 0.7) return 'Building';
  if (momentum < -0.7 && acceleration < 0) return 'Losing momentum';
  return 'Slow emergence / stable';
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
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
  for (const [domain, v] of buckets.entries()) {
    rel[domain] = clamp((v.verified + 1) / (v.total + 2), 0.2, 0.95);
  }
  return rel;
}

function computeSignalPhysics(signal, cfg, domainReliability, now) {
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

  const phase = inferPhase(signal);
  const lag = cfg.lagDaysByClass[signal.signal_class] || { min: 21, max: 180 };
  const recency = recencyWeight(signal.observed_at, now);
  const amplitude = clamp((signalPower * 100) * recency * phaseWeight(phase), 3, 100);

  return {
    snr: Number(snr.toFixed(3)),
    snrNormalized: Number(clamp(snr / 6, 0, 1).toFixed(3)),
    sourceReliability: Number(sourceAcc.toFixed(3)),
    verificationLevel: Number(verification.toFixed(3)),
    corroborationLevel: Number(corroboration.toFixed(3)),
    materiality: Number(materiality.toFixed(3)),
    clarity: Number(clarity.toFixed(3)),
    lagDays: lag,
    phase,
    amplitude: Number(amplitude.toFixed(2)),
    recencyWeight: Number(recency.toFixed(3))
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
  const byLayer = { demand: 0, policy: 0, capital: 0, architecture: 0, execution: 0 };
  for (const s of signalsForInitiative) {
    const text = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
    if (/demand|capacity|load|consumption/.test(text)) byLayer.demand += 1;
    if (/policy|regulator|federal|government|directive|framework/.test(text)) byLayer.policy += 1;
    if (/capital|allocation|fund|insurance|guaranty|mandate/.test(text)) byLayer.capital += 1;
    if (/architecture|platform|governance|stack|sequencing/.test(text)) byLayer.architecture += 1;
    if (/construction|operator|agreement|execution|epc/.test(text)) byLayer.execution += 1;
  }
  const activeLayers = Object.values(byLayer).filter((v) => v > 0).length;
  const clusterStrength = clamp((activeLayers - 1) / 4, 0, 1);
  return { byLayer, activeLayers, clusterStrength: Number(clusterStrength.toFixed(3)) };
}

function bayesianUpdate(prior, evidence, confidenceGain) {
  const k = clamp(0.15 + confidenceGain * 0.55, 0.15, 0.7);
  return clamp(prior + k * (evidence - prior), 0.01, 0.99);
}

async function main() {
  const now = new Date();
  const [signals, initiatives, cfg, previous] = await Promise.all([
    readJson(SIGNALS_PATH, []),
    readJson(INITIATIVES_PATH, []),
    readJson(CONFIG_PATH, null),
    readJson(SNAPSHOT_PATH, null)
  ]);

  if (!cfg) throw new Error('signal-physics-config.json missing or invalid');

  const systems = cfg.systems;
  const domainReliability = buildDomainReliability(signals);

  const enrichedSignals = signals.map((s) => {
    const physics = computeSignalPhysics(s, cfg, domainReliability, now);
    const sys = inferSystems(s, systems);
    const baseBySystem = Object.fromEntries(sys.map((k) => [k, Number((physics.amplitude * physics.snrNormalized).toFixed(3))]));
    const coupled = applyCoupling(baseBySystem, systems, cfg);
    return {
      ...s,
      systems: sys,
      physics,
      pressureContributionBySystem: coupled
    };
  });

  const initiativeIds = new Set(['GLOBAL', ...initiatives.map((i) => i.initiative_id)]);
  for (const s of enrichedSignals) for (const id of s.initiative_ids || []) initiativeIds.add(id);

  const previousByInitiative = new Map((previous?.initiatives || []).map((x) => [x.initiative_id, x]));
  const initiativeStates = [];

  for (const initiative_id of initiativeIds) {
    const group = enrichedSignals.filter((s) => initiative_id === 'GLOBAL'
      ? true
      : (s.initiative_ids || []).includes(initiative_id));

    const resonance = detectResonance(group);
    const pressureBySystem = Object.fromEntries(systems.map((sys) => [sys, 0]));

    for (const s of group) {
      const reinforcement = 1 + Math.max(0, (s.systems.length - 1) * 0.08) + resonance.clusterStrength * 0.2;
      for (const sys of systems) {
        pressureBySystem[sys] += (s.pressureContributionBySystem[sys] || 0) * reinforcement;
      }
    }

    for (const sys of systems) pressureBySystem[sys] = Number(pressureBySystem[sys].toFixed(3));

    const rawPressure = Object.values(pressureBySystem).reduce((a, b) => a + b, 0) / Math.max(1, systems.length);
    const sizeNormalizer = Math.max(1, Math.sqrt(group.length || 1));
    const normalizedPressure = rawPressure / sizeNormalizer;
    const pressure = Number((20 * Math.log1p(normalizedPressure / 20)).toFixed(3));

    const prev = previousByInitiative.get(initiative_id);
    const prevTs = safeParseDate(prev?.generatedAt || previous?.generatedAt || now.toISOString()) || now;
    const dtDays = daysBetween(now, prevTs);

    const prevPressure = Number(prev?.pressure || pressure);
    const momentum = Number(((pressure - prevPressure) / dtDays).toFixed(4));
    const prevMomentum = Number(prev?.momentum || 0);
    const acceleration = Number(((momentum - prevMomentum) / dtDays).toFixed(4));

    const state = classifyState(pressure, momentum, resonance.clusterStrength);

    const phaseMix = {
      early: group.length ? group.filter((s) => s.physics.phase === 'early').length / group.length : 0,
      mid: group.length ? group.filter((s) => s.physics.phase === 'mid').length / group.length : 0,
      late: group.length ? group.filter((s) => s.physics.phase === 'late').length / group.length : 0
    };

    const target = state.replace('-', '').replace(' ', '');
    const phaseFit = (
      phaseMix.early * phaseSignalContribution('early', target) +
      phaseMix.mid * phaseSignalContribution('mid', target) +
      phaseMix.late * phaseSignalContribution('late', target)
    );

    const platformEvidence = sigmoid((pressure / 28) + (momentum * 2.4) + (resonance.clusterStrength * 1.2) - 1.6) * phaseFit;
    const fidEvidence = sigmoid((pressure / 34) + (Math.max(0, momentum) * 2.0) + (phaseMix.late * 1.5) - 2.2);

    const priorPlatform = clamp(prev?.probability?.platformFormation ?? 0.35, 0.01, 0.99);
    const priorFid = clamp(prev?.probability?.fid ?? 0.25, 0.01, 0.99);
    const confidenceGain = group.length
      ? group.reduce((a, s) => a + s.physics.snrNormalized, 0) / group.length
      : 0.2;

    const pPlatform = bayesianUpdate(priorPlatform, platformEvidence, confidenceGain);
    const pFid = bayesianUpdate(priorFid, fidEvidence, confidenceGain);

    initiativeStates.push({
      initiative_id,
      pressure,
      pressureBySystem,
      momentum,
      acceleration,
      resonance,
      phaseMix: Object.fromEntries(Object.entries(phaseMix).map(([k, v]) => [k, Number(v.toFixed(3))])),
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

  const sortedInitiatives = initiativeStates
    .filter((i) => i.initiative_id !== 'GLOBAL')
    .sort((a, b) => b.pressure - a.pressure);

  const top = sortedInitiatives.slice(0, 8).map((x) => ({
    initiative_id: x.initiative_id,
    state: x.state,
    pressure: x.pressure,
    momentum: x.momentum,
    trajectory: x.trajectory,
    clusterStrength: x.resonance.clusterStrength,
    pPlatformFormation: x.probability.platformFormation,
    pFID: x.probability.fid
  }));

  const brief = {
    pressureLevels: top.map((x) => `${x.initiative_id}: ${x.pressure.toFixed(2)} (${x.state})`),
    momentumChanges: top.map((x) => `${x.initiative_id}: ${x.momentum >= 0 ? '+' : ''}${x.momentum.toFixed(3)} / day`),
    emergingClusters: top.filter((x) => x.clusterStrength >= 0.45).map((x) => `${x.initiative_id} cluster=${x.clusterStrength.toFixed(2)}`),
    predictedTrajectories: top.map((x) => `${x.initiative_id}: ${x.trajectory}`),
    highConfidenceInitiatives: top.filter((x) => x.pPlatformFormation >= 0.65 || x.pFID >= 0.55).map((x) => x.initiative_id),
    weakeningInitiatives: top.filter((x) => x.momentum < -0.5).map((x) => x.initiative_id)
  };

  const snapshot = {
    version: 'signal-physics-v1',
    generatedAt: now.toISOString(),
    modelNotes: {
      fallbackRuleSystem: 'unchanged',
      explainability: 'All fields are deterministic from signal metadata + config coefficients.'
    },
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
