import fs from 'node:fs/promises';

const SOURCES_PATH = new URL('../buyer-sources.yaml', import.meta.url);
const RULES_PATH = new URL('./extraction-rules.json', import.meta.url);
const FALLBACK_PATH = new URL('./fallback-sources.json', import.meta.url);
const OUT_DIR = new URL('./out/', import.meta.url);

function parseYamlMap(yaml) {
  const lines = yaml.split(/\r?\n/); const out = {}; let current = null;
  for (const raw of lines) {
    const line = raw.trimEnd(); if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!raw.startsWith(' ') && line.endsWith(':')) { current = line.slice(0,-1); out[current] = {}; continue; }
    if (current && raw.startsWith('  ')) { const [k,...rest] = line.trim().split(':'); out[current][k.trim()] = rest.join(':').trim(); }
  }
  return out;
}

const clean = (h) => h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

function findWithSnippet(text, patterns) {
  for (const p of patterns) {
    const rx = typeof p === 'string' ? new RegExp(p, 'i') : p;
    const m = text.match(rx);
    if (m) {
      const v = (m[1] || m[0]).trim();
      const i = m.index || 0;
      const start = Math.max(0, i - 80);
      const end = Math.min(text.length, i + v.length + 80);
      return { value: v, snippet: text.slice(start, end) };
    }
  }
  return { value: 'MISSING', snippet: 'MISSING' };
}

function parseDateCandidate(value) {
  if (value === 'MISSING') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isStaleNonEventDate(dateObj) {
  if (!dateObj) return false;
  const now = Date.now();
  const diffDays = Math.abs(now - dateObj.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 730; // > 24 months considered stale for pressure events
}

const urgency = (t)=>/90\s*days|this\s*quarter|next\s*quarter|immediate|near[- ]term/i.test(t)?5:/180\s*days|six\s*months|half[- ]year/i.test(t)?4:/12\s*months|one\s*year|annual/i.test(t)?3:/24\s*months|two\s*years/i.test(t)?2:1;
const fScore = (v)=>v==='MISSING'?1:3;
const ascore = (r)=>Number(((fScore(r.capitalAmount)+fScore(r.mandateLanguage)+fScore(r.geography)+fScore(r.leadershipStatement)+r.urgencyIndicator)/5).toFixed(2));

async function fetchUrl(url){
  try { const res = await fetch(url,{redirect:'follow'}); if(!res.ok) return {ok:false,status:`HTTP_${res.status}`,url,text:''}; return {ok:true,status:'OK',url,text:await res.text()}; }
  catch(e){ return {ok:false,status:`FETCH_${String(e.message||e)}`,url,text:''}; }
}

async function brave(query){
  const key=process.env.BRAVE_API_KEY; if(!key) return {ok:false,status:'BRAVE_API_KEY_MISSING',text:''};
  try{ const u=`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`; const r=await fetch(u,{headers:{'X-Subscription-Token':key}}); if(!r.ok) return {ok:false,status:`BRAVE_HTTP_${r.status}`,text:''}; const j=await r.json(); const txt=(j?.web?.results||[]).map(x=>`${x.title||''} ${x.description||''}`.trim()).join(' '); return {ok:true,status:'OK',text:txt}; }
  catch(e){ return {ok:false,status:`BRAVE_FETCH_${String(e.message||e)}`,text:''}; }
}

function provenance(v, directOk, braveOk){ if(v==='MISSING') return 'missing'; if(directOk) return 'verified_source'; if(braveOk) return 'search_derived'; return 'unverified'; }
function confidence(prov){ return prov==='verified_source'?'high':prov==='search_derived'?'medium':'low'; }

async function main(){
  const buyers = parseYamlMap(await fs.readFile(SOURCES_PATH,'utf8'));
  const rules = JSON.parse(await fs.readFile(RULES_PATH,'utf8'));
  const fallbacks = JSON.parse(await fs.readFile(FALLBACK_PATH,'utf8'));
  const rows=[];

  for(const [buyer,src] of Object.entries(buyers)){
    const urls = [src.press, ...((fallbacks[buyer]||[]).filter(u=>u!==src.press))];
    let fetched = null;
    for(const u of urls){ const r = await fetchUrl(u); if(r.ok){ fetched=r; break; } if(!fetched) fetched=r; }
    const b = await brave(`${buyer} infrastructure allocation mandate leadership statement`);
    const txt = `${fetched?.ok?clean(fetched.text):''} ${b.ok?b.text:''}`.trim();
    const rule = rules[buyer] || {};
    const geos = (rule.geographyHints||[]).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');

    const fDate = findWithSnippet(txt,[...(rule.datePatterns||[]),/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/i]);
    const parsed = parseDateCandidate(fDate.value);
    const staleDate = isStaleNonEventDate(parsed);
    const dateValue = staleDate ? 'MISSING' : fDate.value;

    const fCap = findWithSnippet(txt,[/\$\s?[\d,.]+\s?(?:bn|billion|m|million)?/i,/\b[\d,.]+\s?(?:bn|billion|m|million)\b/i]);
    const fSector = findWithSnippet(txt,[/\b(infrastructure|renewable|energy|real estate|housing|transport|digital)\b/i]);
    const fGeo = geos?findWithSnippet(txt,[new RegExp(`\\b(${geos})\\b`,'i')]):{value:'MISSING',snippet:'MISSING'};
    const fMandate = findWithSnippet(txt,[/\b(mandate|allocation|commitment|deploy(?:ment)?|investment\s+strategy|platform|fund\s+launch)\b/i]);
    const fLead = findWithSnippet(txt,[/\b(chairman|ceo|leadership|governor|president|chief executive)\b/i]);

    const rec = {
      buyer,
      sourceTried: urls,
      sourceUsed: fetched?.url || src.press,
      fetchStatus: fetched?.status || 'FETCH_UNKNOWN',
      braveStatus: b.status,
      chromiumStatus: 'PENDING_INTEGRATION',
      date: dateValue,
      capitalAmount: fCap.value,
      sector: fSector.value,
      geography: fGeo.value,
      mandateLanguage: fMandate.value,
      leadershipStatement: fLead.value,
      urgencyIndicator: urgency(txt),
      staleDateFiltered: staleDate
    };

    rec.evidence = {
      date: staleDate ? 'Filtered as stale (>24m old) for pressure events' : fDate.snippet,
      capitalAmount: fCap.snippet,
      sector: fSector.snippet,
      geography: fGeo.snippet,
      mandateLanguage: fMandate.snippet,
      leadershipStatement: fLead.snippet
    };

    rec.signalScore = ascore(rec);
    rec.fieldProvenance = {
      date: provenance(rec.date, !!fetched?.ok, b.ok),
      capitalAmount: provenance(rec.capitalAmount, !!fetched?.ok, b.ok),
      sector: provenance(rec.sector, !!fetched?.ok, b.ok),
      geography: provenance(rec.geography, !!fetched?.ok, b.ok),
      mandateLanguage: provenance(rec.mandateLanguage, !!fetched?.ok, b.ok),
      leadershipStatement: provenance(rec.leadershipStatement, !!fetched?.ok, b.ok)
    };
    rec.overallConfidence = confidence(Object.values(rec.fieldProvenance).includes('verified_source') ? 'verified_source' : (Object.values(rec.fieldProvenance).includes('search_derived') ? 'search_derived' : 'missing'));
    rec.missingInputs = Object.entries(rec).filter(([k,v])=>['date','capitalAmount','sector','geography','mandateLanguage','leadershipStatement'].includes(k) && v==='MISSING').map(([k])=>k);
    rows.push(rec);
  }

  await fs.mkdir(OUT_DIR,{recursive:true});
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const out = new URL(`./out/workflow-a-v3_1-${stamp}.json`, import.meta.url);
  await fs.writeFile(out, JSON.stringify({generatedAt:new Date().toISOString(), rows}, null, 2));
  console.log(out.pathname);
}

main();
