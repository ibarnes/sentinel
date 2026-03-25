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

const strip = (x='') => x.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

async function readJson(file, fb) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fb; }
}

function parseRssItems(xml='') {
  const items = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const it of matches) {
    const g = (tag) => {
      const m = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? strip(m[1]) : '';
    };
    const title = g('title');
    const url = g('link');
    const summary = g('description');
    const pub = g('pubDate');
    const enclosure = (it.match(/<enclosure[^>]*url="([^"]+)"/i) || [])[1] || '';
    const media = (it.match(/<media:content[^>]*url="([^"]+)"/i) || [])[1] || '';
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

async function main() {
  const sources = (await readJson(sourcesFile, [])).filter((s) => s.enabled);
  const existing = await readJson(outFile, []);
  const seen = new Set(existing.map((x) => x.url));
  const out = [...existing];
  const stats = { total_sources: sources.length, ok_sources: 0, failed_sources: 0, items_added: 0, failures: [] };

  for (const src of sources) {
    try {
      const r = await fetch(src.url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!r.ok) {
        stats.failed_sources += 1;
        stats.failures.push({ source: src.name, url: src.url, status: r.status });
        continue;
      }
      const text = await r.text();
      const items = src.type === 'rss' ? parseRssItems(text) : parseWebPage(text, src.url);
      let addedHere = 0;
      for (const item of items.slice(0, 40)) {
        if (!item.url || seen.has(item.url)) continue;
        seen.add(item.url);
        const rel = relevanceScore(`${item.title} ${item.summary}`);
        out.push({
          feed_id: hash(item.url),
          source: src.name,
          source_id: src.source_id,
          title: item.title,
          summary: item.summary,
          url: item.url,
          image_url: item.image_url,
          published_at: item.published_at,
          tags: src.default_tags || [],
          trust_tier: src.trust_tier || 'tier2',
          relevance_score: rel,
          confidence: rel >= 60 ? 'Medium' : 'Low',
          signal_class: rel >= 60 ? 'Capital Reality' : 'Context Signal',
          why_it_matters: whyMatters(item),
          initiative_ids: ['USG']
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

  out.sort((a,b) => String(b.published_at||'').localeCompare(String(a.published_at||'')));
  await fs.writeFile(outFile, JSON.stringify(out.slice(0, 3000), null, 2) + '\n', 'utf8');
  const metaPath = path.join(ROOT, 'dashboard/data/signals_feed.meta.json');
  const meta = await readJson(metaPath, {});
  meta.last_run_at = nowIso();
  meta.last_run_stats = stats;
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`signals feed updated: ${out.length} items, added ${stats.items_added}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
