import fs from 'node:fs/promises';

const SOURCES_PATH = new URL('../buyer-sources.yaml', import.meta.url);
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

function extractFirst(text, regex) {
  const m = text.match(regex);
  return m ? m[1] || m[0] : 'MISSING';
}

function scoreField(value) {
  return value === 'MISSING' ? 1 : 3;
}

function timingUrgencyFromText(text) {
  const t = text.toLowerCase();
  if (/\b(quarter|q[1-4]|this month|next month|90 days)\b/.test(t)) return 5;
  if (/\b(6 months|half-year|180 days)\b/.test(t)) return 4;
  if (/\b(12 months|one year|annual)\b/.test(t)) return 3;
  if (/\b(24 months|two years)\b/.test(t)) return 2;
  return 1;
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return `ERROR_HTTP_${res.status}`;
    return await res.text();
  } catch (e) {
    return `ERROR_FETCH_${String(e.message || e)}`;
  }
}

function extractDelta(html) {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  return {
    date: extractFirst(clean, /(\b(?:20\d{2}|19\d{2})[-\/.](?:0?[1-9]|1[0-2])[-\/.](?:0?[1-9]|[12]\d|3[01])\b)/),
    capitalAmount: extractFirst(clean, /(\$\s?[\d,.]+\s?(?:bn|billion|m|million)?)/i),
    sector: extractFirst(clean, /\b(infrastructure|renewable|energy|real estate|housing|transport|digital)\b/i),
    geography: extractFirst(clean, /\b(saudi arabia|gcc|nigeria|middle east|global|africa|europe|asia|us|united states)\b/i),
    mandateLanguage: extractFirst(clean, /\b(mandate|allocation|commitment|deploy|investment strategy|platform)\b/i),
    urgencyIndicator: 'MISSING',
  };
}

function computeAScore(fields) {
  const f1 = scoreField(fields.capitalAmount);
  const f2 = scoreField(fields.mandateLanguage);
  const f3 = scoreField(fields.geography);
  const f4 = scoreField(fields.date);
  const f5 = fields.urgencyIndicator;
  const avg = (f1 + f2 + f3 + f4 + f5) / 5;
  return Number(avg.toFixed(2));
}

async function main() {
  const yaml = await fs.readFile(SOURCES_PATH, 'utf8');
  const buyers = parseYamlMap(yaml);
  const rows = [];

  for (const [buyer, src] of Object.entries(buyers)) {
    const html = await fetchText(src.press);
    const fields = html.startsWith('ERROR_')
      ? {
          date: 'MISSING', capitalAmount: 'MISSING', sector: 'MISSING', geography: 'MISSING', mandateLanguage: 'MISSING', urgencyIndicator: 1,
          error: html,
        }
      : (() => {
          const d = extractDelta(html);
          d.urgencyIndicator = timingUrgencyFromText(html);
          return d;
        })();

    const score = computeAScore(fields);
    rows.push({ buyer, source: src.press, ...fields, signalScore: score });
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = new URL(`workflow-a-${stamp}.json`, OUT_DIR);
  await fs.writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));

  console.log(`Wrote ${outPath.pathname}`);
}

main();
