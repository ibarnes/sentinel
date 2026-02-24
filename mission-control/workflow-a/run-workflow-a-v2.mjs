import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCES_PATH = new URL('../buyer-sources.yaml', import.meta.url);
const RULES_PATH = new URL('./extraction-rules.json', import.meta.url);
const OUT_DIR = new URL('./out/', import.meta.url);

function parseYamlMap(yaml) {
  const lines = yaml.split(/\r?\n/);
  const out = {};
  let current = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!raw.startsWith(' ') && line.endsWith(':')) {
      current = line.slice(0, -1);
      out[current] = {};
      continue;
    }
    if (current && raw.startsWith('  ')) {
      const [k, ...rest] = line.trim().split(':');
      out[current][k.trim()] = rest.join(':').trim();
    }
  }
  return out;
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { ok: false, error: `HTTP_${res.status}`, text: '' };
    return { ok: true, text: await res.text() };
  } catch (e) {
    return { ok: false, error: `FETCH_${String(e.message || e)}`, text: '' };
  }
}

async function braveSearch(query) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return { ok: false, reason: 'BRAVE_API_KEY_MISSING', snippets: [] };
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
  try {
    const res = await fetch(url, { headers: { 'X-Subscription-Token': key } });
    if (!res.ok) return { ok: false, reason: `BRAVE_HTTP_${res.status}`, snippets: [] };
    const j = await res.json();
    const snippets = (j?.web?.results || []).map(r => [r.title, r.description].filter(Boolean).join(' - ')).join('\n');
    return { ok: true, snippets: [snippets] };
  } catch (e) {
    return { ok: false, reason: `BRAVE_FETCH_${String(e.message || e)}`, snippets: [] };
  }
}

function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(text, regexes) {
  for (const r of regexes) {
    const rx = typeof r === 'string' ? new RegExp(r, 'i') : r;
    const m = text.match(rx);
    if (m) return m[1] || m[0];
  }
  return 'MISSING';
}

function timingUrgencyFromText(text) {
  const t = text.toLowerCase();
  if (/\b(90\s*days|this\s*quarter|next\s*quarter|immediate|near[- ]term)\b/.test(t)) return 5;
  if (/\b(180\s*days|six\s*months|half[- ]year)\b/.test(t)) return 4;
  if (/\b(12\s*months|one\s*year|annual)\b/.test(t)) return 3;
  if (/\b(24\s*months|two\s*years)\b/.test(t)) return 2;
  return 1;
}

function fieldScore(v) { return v === 'MISSING' ? 1 : 3; }

function computeAScore(fields) {
  const s = [
    fieldScore(fields.capitalAmount),
    fieldScore(fields.mandateLanguage),
    fieldScore(fields.geography),
    fieldScore(fields.leadershipStatement),
    fields.urgencyIndicator
  ];
  return Number((s.reduce((a, b) => a + b, 0) / 5).toFixed(2));
}

async function latestPriorRows() {
  try {
    const files = (await fs.readdir(OUT_DIR)).filter(f => f.endsWith('.json') && f.startsWith('workflow-a-')).sort();
    if (!files.length) return {};
    const latest = files[files.length - 1];
    const data = JSON.parse(await fs.readFile(new URL(`./out/${latest}`, import.meta.url), 'utf8'));
    const map = {};
    for (const r of data.rows || []) map[r.buyer] = r;
    return map;
  } catch {
    return {};
  }
}

function changedFields(curr, prev) {
  if (!prev) return ['NEW_BASELINE'];
  const fields = ['date', 'capitalAmount', 'sector', 'geography', 'mandateLanguage', 'leadershipStatement', 'urgencyIndicator', 'signalScore'];
  return fields.filter(f => String(curr[f]) !== String(prev[f]));
}

async function main() {
  const yaml = await fs.readFile(SOURCES_PATH, 'utf8');
  const buyers = parseYamlMap(yaml);
  const rules = JSON.parse(await fs.readFile(RULES_PATH, 'utf8'));
  const prior = await latestPriorRows();
  const rows = [];

  for (const [buyer, src] of Object.entries(buyers)) {
    const direct = await fetchText(src.press);
    const brave = await braveSearch(`${buyer} infrastructure allocation mandate press release`);

    const mergedText = [
      direct.ok ? cleanHtml(direct.text) : '',
      ...(brave.snippets || [])
    ].join(' ');

    const rule = rules[buyer] || {};
    const geographyHints = (rule.geographyHints || []).map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    const record = {
      buyer,
      source: src.press,
      leadershipSource: src.leadership || 'MISSING',
      extractionMode: 'direct+brave(optional)+chromium(pending)',
      date: firstMatch(mergedText, [
        ...(rule.datePatterns || []),
        /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/i
      ]),
      capitalAmount: firstMatch(mergedText, [/\$\s?[\d,.]+\s?(?:bn|billion|m|million)?/i, /\b[\d,.]+\s?(?:bn|billion|m|million)\b/i]),
      sector: firstMatch(mergedText, [/\b(infrastructure|renewable|energy|real estate|housing|transport|digital)\b/i]),
      geography: geographyHints ? firstMatch(mergedText, [new RegExp(`\\b(${geographyHints})\\b`, 'i')]) : 'MISSING',
      mandateLanguage: firstMatch(mergedText, [/\b(mandate|allocation|commitment|deploy(?:ment)?|investment\s+strategy|platform|fund\s+launch)\b/i]),
      leadershipStatement: 'MISSING',
      urgencyIndicator: timingUrgencyFromText(mergedText),
      missingInputs: [],
      fetchStatus: direct.ok ? 'OK' : direct.error,
      braveStatus: brave.ok ? 'OK' : brave.reason
    };

    for (const k of ['date', 'capitalAmount', 'sector', 'geography', 'mandateLanguage', 'leadershipStatement']) {
      if (record[k] === 'MISSING') record.missingInputs.push(k);
    }

    record.signalScore = computeAScore(record);
    const prev = prior[buyer];
    record.changedFields = changedFields(record, prev);
    rows.push(record);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = `workflow-a-${stamp}.json`;
  await fs.writeFile(new URL(`./out/${outFile}`, import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));

  const md = [];
  md.push('# Pressure Surface Changes (auto-generated)');
  md.push('');
  for (const r of rows) {
    md.push(`## ${r.buyer}`);
    md.push(`- Signal Score: ${r.signalScore}`);
    md.push(`- What changed: ${r.changedFields.join(', ')}`);
    md.push(`- Missing inputs: ${r.missingInputs.length ? r.missingInputs.join(', ') : 'None'}`);
    md.push(`- Source: ${r.source}`);
    md.push('');
  }
  await fs.writeFile(new URL(`./out/workflow-a-${stamp}.md`, import.meta.url), md.join('\n'));
  console.log(path.join('mission-control/workflow-a/out', outFile));
}

main();
