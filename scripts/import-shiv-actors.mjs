#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ROOT = '/home/ec2-user/.openclaw/workspace';
const DEFAULT_INPUT = path.join(ROOT, '.openclaw', 'media', 'inbound');
const OUT_RAW = path.join(ROOT, 'dashboard', 'data', 'actors_raw_shiv.csv');
const OUT_ACTORS = path.join(ROOT, 'dashboard', 'data', 'actors.json');
const OUT_REVIEW = path.join(ROOT, 'dashboard', 'data', 'actors_import_review.json');

function parseArgs(argv) {
  const args = { input: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') args.input = argv[++i];
    else if (!args.input) args.input = a;
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let cur = '';
  let row = [];
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (q && next === '"') { cur += '"'; i++; continue; }
      q = !q; continue;
    }
    if (ch === ',' && !q) { row.push(cur); cur = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => String(x).length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function tidy(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/[\u0000-\u001f]/g, ' ').trim();
}

function slug(s) {
  return tidy(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function hashRow(row) {
  return crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 16);
}

const COUNTRY_FIX = new Map([
  ['veitnam', 'Vietnam'],
  ['viet nam', 'Vietnam'],
  ['south korea', 'South Korea'],
  ['ksa', 'Saudi Arabia']
]);

function normalizeCountry(v) {
  const t = tidy(v);
  if (!t) return '';
  const k = t.toLowerCase();
  return COUNTRY_FIX.get(k) || t;
}

function inferType(company, designation) {
  const s = `${company} ${designation}`.toLowerCase();
  if (/(minist|government|embassy|authority|council)/.test(s)) return 'regulator';
  if (/(fund|pif|sovereign|wealth)/.test(s)) return 'sovereign';
  if (/(family office|family holdings|family vehicle)/.test(s)) return 'family_office';
  if (/(operator|holdings|group|bank|capital|corp|corporation|company|plc|inc|ltd)/.test(s)) return 'corporate';
  return 'other';
}

function splitPrimaryOrg(company) {
  const t = tidy(company);
  if (!t) return '';
  return t.split(/[;,/]/).map(tidy).filter(Boolean)[0] || t;
}

async function resolveInput(p) {
  if (p) return p;
  const entries = await fs.readdir(DEFAULT_INPUT).catch(() => []);
  const candidate = entries.find((f) => f.toLowerCase().includes('shivs_relationships') && f.toLowerCase().endsWith('.csv'));
  if (!candidate) throw new Error('No input file found; pass --input <path-to-csv>');
  return path.join(DEFAULT_INPUT, candidate);
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = await resolveInput(args.input);
  const raw = await fs.readFile(inputPath, 'utf8');
  await fs.writeFile(OUT_RAW, raw, 'utf8');

  const rows = parseCsv(raw);
  if (!rows.length) throw new Error('CSV empty');
  const headers = rows[0].map((h) => tidy(h).toLowerCase());
  const idx = {
    first: headers.indexOf('first name'),
    last: headers.indexOf('last name'),
    designation: headers.indexOf('designation'),
    company: headers.indexOf('company'),
    country: headers.indexOf('country')
  };

  const actors = [];
  const review = [];
  const seenByKey = new Map();
  const slugCounter = new Map();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const first_name = tidy(r[idx.first]);
    const last_name = tidy(r[idx.last]);
    const designation = tidy(r[idx.designation]);
    const company = tidy(r[idx.company]);
    const country_normalized = normalizeCountry(r[idx.country]);
    const name_display = tidy(`${first_name} ${last_name}`);
    const organization_primary = splitPrimaryOrg(company);

    const issues = [];
    if (!name_display) issues.push('missing_name');
    if (!country_normalized) issues.push('missing_country');
    if (String(r[idx.country] || '').toLowerCase().includes('veitnam')) issues.push('country_typo_variant');
    if (/[\n\r]/.test(String(r[idx.company] || ''))) issues.push('multiline_company_cell');
    if (/[;,/]/.test(company)) issues.push('multi_entity_company_field');

    const dedupeKey = `${slug(name_display)}::${slug(organization_primary)}`;
    if (seenByKey.has(dedupeKey)) issues.push('duplicate_person_org_combo');
    seenByKey.set(dedupeKey, true);

    const baseId = slug(`${name_display}-${organization_primary}`) || `actor-${i}`;
    const n = (slugCounter.get(baseId) || 0) + 1;
    slugCounter.set(baseId, n);
    const actor_id = n === 1 ? baseId : `${baseId}-${n}`;

    const source_row_hash = hashRow({ i, first_name, last_name, designation, company, country: r[idx.country] || '' });
    const rec = {
      actor_id,
      name_display,
      first_name,
      last_name,
      organization_primary,
      designation,
      country_normalized,
      actor_type: inferType(company, designation),
      relationship_source: 'shiv_sun_group',
      relationship_strength: 'first_degree',
      source_row_hash,
      needs_review: issues.length > 0
    };

    if (rec.needs_review) {
      review.push({
        source_row_hash,
        status: 'pending',
        issues,
        source: { first_name, last_name, designation, company, country: tidy(r[idx.country]) },
        candidate: rec
      });
    } else {
      actors.push(rec);
    }
  }

  await fs.writeFile(OUT_ACTORS, `${JSON.stringify(actors, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUT_REVIEW, `${JSON.stringify(review, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    inputPath,
    outRaw: OUT_RAW,
    outActors: OUT_ACTORS,
    outReview: OUT_REVIEW,
    totalRows: rows.length - 1,
    publishedActors: actors.length,
    reviewQueue: review.length
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
