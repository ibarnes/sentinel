#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const ROOT = '/home/ec2-user/.openclaw/workspace';
const sourcesFile = path.join(ROOT, 'dashboard/data/signals_sources.json');
const outFile = path.join(ROOT, 'dashboard/data/signals_feed.json');

const nowIso = () => new Date().toISOString();
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
};

const decodeHtml = (x='') => x
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ');

const strip = (x='') => decodeHtml(x)
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

async function readJson(file, fb) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fb; }
}

async function loadEnvFromFiles() {
  const files = [path.join(ROOT, 'admin-server/.env'), path.join(ROOT, '.env')];
  for (const file of files) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#') || !t.includes('=')) continue;
        const idx = t.indexOf('=');
        const k = t.slice(0, idx).trim();
        const v = t.slice(idx + 1).trim();
        if (!(k in process.env)) process.env[k] = v;
      }
    } catch {
      // ignore missing env files
    }
  }
}

function parseGmailAtomItems(xml = '') {
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  const items = [];
  for (const entry of entries) {
    const raw = (tag) => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? (m[1] || '') : '';
    };
    const g = (tag) => strip(raw(tag));

    const title = g('title');
    const summary = g('summary');
    const issued = g('issued') || g('modified');
    const author_name = strip((entry.match(/<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i) || [])[1] || '');
    const author_email = strip((entry.match(/<author>[\s\S]*?<email[^>]*>([\s\S]*?)<\/email>[\s\S]*?<\/author>/i) || [])[1] || '');
    const message_id = g('id') || `${author_email}:${issued}:${title}`;
    if (!title && !summary) continue;

    items.push({
      title: title || '(No subject)',
      summary,
      url: `internal://gmail/${encodeURIComponent(message_id)}`,
      published_at: issued ? new Date(issued).toISOString() : nowIso(),
      image_url: '',
      author_name,
      author_email,
      message_id,
    });
  }
  return items;
}

async function resolveGoogleNewsUrl(url='') {
  try {
    if (!url.includes('news.google.com/')) return url;
    const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
    return r.url || url;
  } catch {
    return url;
  }
}

async function parseRssItems(xml='') {
  const items = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const it of matches) {
    const raw = (tag) => {
      const m = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
      return m ? (m[1] || '') : '';
    };
    const g = (tag) => strip(raw(tag));

    const title = g('title');
    let url = g('link');
    const summary = g('description');
    const pub = g('pubDate');
    const enclosure = (it.match(/<enclosure[^>]*url="([^"]+)"/i) || [])[1] || '';
    const media = (it.match(/<media:content[^>]*url="([^"]+)"/i) || [])[1] || '';

    const descDecoded = decodeHtml(raw('description'));
    const href = (descDecoded.match(/<a[^>]*href=["']([^"']+)["']/i) || [])[1] || '';
    if (href && href.startsWith('http')) url = href;

    if (url.includes('news.google.com/')) url = await resolveGoogleNewsUrl(url);

    if (!title || !url) continue;
    items.push({ title, url, summary, published_at: pub ? new Date(pub).toISOString() : nowIso(), image_url: media || enclosure || '' });
  }
  return items;
}

function parseWebPage(html = '', url = '') {
  const title = strip((html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || [])[1]
    || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]
    || 'Web signal');
  const summary = strip((html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || [])[1]
    || (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) || [])[1]
    || '');
  const image_url = strip((html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '');
  return [{ title, url, summary, image_url, published_at: nowIso() }];
}

function relevanceScore(text='') {
  const t = text.toLowerCase();
  let s = 0;
  for (const kw of ['africa','sovereign','infrastructure','energy','capital','fund','ifc','afdb','ppp','corridor','governance','security']) {
    if (t.includes(kw)) s += 8;
  }
  for (const kw of ['celebrity','sports','lifestyle']) {
    if (t.includes(kw)) s -= 6;
  }
  return Math.max(0, Math.min(100, s));
}

function whyMatters(item) {
  const t = `${item.title} ${item.summary}`.toLowerCase();
  if (t.includes('sovereign') || t.includes('government')) return 'Potential policy/authority shift affecting capital pathways.';
  if (t.includes('infrastructure') || t.includes('energy')) return 'Directly relevant to USG initiative structuring and execution conditions.';
  if (t.includes('credit') || t.includes('rates') || t.includes('fund')) return 'May alter cost-of-capital and allocator posture for pre-FID pathways.';
  return 'Potentially relevant macro/context signal; requires verification and classification.';
}

function sanitizeSummary(summary='') {
  const cleaned = strip(summary || '');
  if (!cleaned) return '';
  return cleaned.replace(/\s+/g, ' ').trim();
}

function scoreItemQuality(item = {}) {
  const s = String(item.summary || '');
  let score = 0;
  if (s) score += 2;
  if (!s.includes('<a') && !s.includes('&lt;') && !s.includes('href="')) score += 3;
  if (String(item.url || '').includes('news.google.com/rss/articles/')) score -= 1;
  return score;
}

function dedupeFeed(items = []) {
  const map = new Map();
  for (const item of items) {
    const key = [
      String(item.source_id || item.source || '').toLowerCase(),
      String(item.title || '').toLowerCase().trim(),
      String(item.published_at || '').slice(0, 10)
    ].join('||');
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    const a = scoreItemQuality(existing);
    const b = scoreItemQuality(item);
    if (b > a) map.set(key, item);
  }
  return [...map.values()];
}

function normalizeEntityLabel(x = '') {
  return String(x || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function makeMatchers(actors = [], buyers = [], initiatives = []) {
  const actorMatchers = actors
    .map((a) => {
      const name = a?.name_display || [a?.first_name, a?.last_name].filter(Boolean).join(' ');
      const norm = normalizeEntityLabel(name);
      if (!norm || norm.length < 5 || norm.startsWith('unknown')) return null;
      return { id: String(a.actor_id || '').trim(), label: norm };
    })
    .filter((x) => x && x.id && x.label);

  const buyerMatchers = buyers.flatMap((b) => {
    const out = [];
    const idLabel = normalizeEntityLabel(b?.buyer_id || '');
    const nameLabel = normalizeEntityLabel(b?.name || b?.buyer_name || '');
    const id = String(b?.buyer_id || '').trim();
    if (id && idLabel.length >= 3) out.push({ id, label: idLabel });
    if (id && nameLabel.length >= 4) out.push({ id, label: nameLabel });
    return out;
  });

  const initiativeMatchers = initiatives.flatMap((i) => {
    const out = [];
    const id = String(i?.initiative_id || '').trim();
    const idLabel = normalizeEntityLabel(id);
    const nameLabel = normalizeEntityLabel(i?.name || i?.title || '');
    if (id && idLabel.length >= 5) out.push({ id, label: idLabel });
    if (id && nameLabel.length >= 6) out.push({ id, label: nameLabel });
    return out;
  });

  return { actorMatchers, buyerMatchers, initiativeMatchers };
}

function matchEntityIds(text = '', matchers = []) {
  const norm = normalizeEntityLabel(text);
  const ids = new Set();
  for (const m of matchers) {
    if (!m?.label || !m?.id) continue;
    if (norm.includes(m.label)) ids.add(m.id);
  }
  return [...ids];
}

async function main() {
  await loadEnvFromFiles();

  const sources = (await readJson(sourcesFile, [])).filter((s) => s.enabled);
  const existing = await readJson(outFile, []);
  const actors = await readJson(path.join(ROOT, 'dashboard/data/actors.json'), []);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const { actorMatchers, buyerMatchers, initiativeMatchers } = makeMatchers(actors, buyers, initiatives);

  const seen = new Set(existing.map((x) => x.url));
  const out = [...existing];
  const stats = { total_sources: sources.length, ok_sources: 0, failed_sources: 0, items_added: 0, failures: [] };

  for (const src of sources) {
    try {
      const headers = { 'user-agent': 'Mozilla/5.0' };
      if (src.type === 'gmail_atom') {
        const user = process.env.IMAP_USER || process.env.SMTP_USER || '';
        const pass = process.env.IMAP_PASS || process.env.SMTP_PASS || '';
        if (!user || !pass) {
          throw new Error('gmail_atom source requires IMAP_USER/IMAP_PASS or SMTP_USER/SMTP_PASS');
        }
        headers.authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
      }

      const r = await fetch(src.url, { headers });
      if (!r.ok) {
        stats.failed_sources += 1;
        stats.failures.push({ source: src.name, url: src.url, status: r.status });
        continue;
      }

      const text = await r.text();
      let items = [];
      if (src.type === 'rss') items = await parseRssItems(text);
      else if (src.type === 'gmail_atom') items = parseGmailAtomItems(text);
      else items = parseWebPage(text, src.url);
      let addedHere = 0;
      for (const item of items.slice(0, 40)) {
        if (!item.url || seen.has(item.url)) continue;

        const cleanedSummary = sanitizeSummary(item.summary || '');
        const textBlob = `${item.title || ''} ${cleanedSummary}`.toLowerCase();
        const matchKeywords = Array.isArray(src.match_keywords)
          ? src.match_keywords.map((k) => String(k || '').toLowerCase().trim()).filter(Boolean)
          : [];
        if (matchKeywords.length && !matchKeywords.some((k) => textBlob.includes(k))) continue;

        seen.add(item.url);
        const rel = relevanceScore(`${item.title} ${cleanedSummary}`);
        const textForMatching = `${item.title || ''} ${cleanedSummary}`;

        const buyerIdsFromSource = Array.isArray(src.buyer_ids) ? src.buyer_ids : [];
        const initiativeIdsFromSource = Array.isArray(src.initiative_ids) ? src.initiative_ids : [];
        const actorIdsDetected = matchEntityIds(textForMatching, actorMatchers);
        const buyerIdsDetected = matchEntityIds(textForMatching, buyerMatchers);
        const initiativeIdsDetected = matchEntityIds(textForMatching, initiativeMatchers);

        const buyerIds = [...new Set([...buyerIdsFromSource, ...buyerIdsDetected])];
        const initiativeIds = [...new Set([...initiativeIdsFromSource, ...initiativeIdsDetected])];
        const finalInitiativeIds = initiativeIds.length ? initiativeIds : ['USG'];

        const baseWhy = src.why_template ? String(src.why_template) : whyMatters(item);
        const buyerAnchor = buyerIds.length ? ` Buyer anchor: ${buyerIds.join(', ')}.` : '';
        const actorAnchor = actorIdsDetected.length ? ` Actor matches: ${actorIdsDetected.join(', ')}.` : '';

        out.push({
          feed_id: hash(item.url),
          source: src.name,
          source_id: src.source_id,
          title: item.title,
          summary: cleanedSummary,
          url: item.url,
          image_url: item.image_url,
          published_at: item.published_at,
          tags: src.default_tags || [],
          trust_tier: src.trust_tier || 'tier2',
          relevance_score: rel,
          confidence: rel >= 70 ? 'High' : (rel >= 55 ? 'Medium' : 'Low'),
          signal_class: rel >= 60 ? 'Capital Reality' : 'Context Signal',
          why_it_matters: `${baseWhy}${buyerAnchor}${actorAnchor}`.trim(),
          buyer_ids: buyerIds,
          actor_ids: actorIdsDetected,
          initiative_ids: finalInitiativeIds,
          email_from: item.author_email || null,
          email_author: item.author_name || null,
          email_message_id: item.message_id || null
        });
        stats.items_added += 1;
        addedHere += 1;
      }
      if (addedHere >= 0) stats.ok_sources += 1;
    } catch (e) {
      stats.failed_sources += 1;
      stats.failures.push({ source: src.name, url: src.url, error: String(e?.message || e) });
    }
  }

  const normalized = dedupeFeed(out).map((x) => ({ ...x, summary: sanitizeSummary(x.summary || '') }));
  normalized.sort((a,b) => String(b.published_at||'').localeCompare(String(a.published_at||'')));
  await fs.writeFile(outFile, JSON.stringify(normalized.slice(0, 3000), null, 2) + '\n', 'utf8');
  const metaPath = path.join(ROOT, 'dashboard/data/signals_feed.meta.json');
  const meta = await readJson(metaPath, {});
  meta.last_run_at = nowIso();
  meta.last_run_stats = stats;
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`signals feed updated: ${normalized.length} items, added ${stats.items_added}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
