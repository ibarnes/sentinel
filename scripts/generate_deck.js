#!/usr/bin/env node
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';

const ROOT = '/home/ec2-user/.openclaw/workspace';
const HYPE = ['revolutionary','game-changing','world-class','unprecedented','best-in-class','disruptive'];

function arg(name, d=null){
  const i = process.argv.indexOf(`--${name}`);
  return i>=0 ? process.argv[i+1] : d;
}

function words(s){ return String(s||'').trim().split(/\s+/).filter(Boolean); }
function countSyllables(word){
  const w = word.toLowerCase().replace(/[^a-z]/g,'');
  if(!w) return 1;
  const m = w.match(/[aeiouy]+/g);
  return Math.max(1,(m||[]).length);
}
function fleschKincaid(text){
  const sents = Math.max(1, String(text).split(/[.!?]+/).filter(x=>x.trim()).length);
  const ws = words(text);
  const syll = ws.reduce((n,w)=>n+countSyllables(w),0);
  const wcount = Math.max(1, ws.length);
  return 0.39*(wcount/sents)+11.8*(syll/wcount)-15.59;
}
function simplifyLine(line){
  let out = String(line||'').replace(/\s+/g,' ').trim();
  for(const h of HYPE){ out = out.replace(new RegExp(`\\b${h}\\b`,'ig'),''); }
  const w = words(out);
  return w.slice(0,12).join(' ');
}
function normalizeBullets(list){
  return (list||[]).map(simplifyLine).filter(Boolean).slice(0,6);
}
function enforceReadability(text){
  let t = String(text||'');
  for(let i=0;i<5;i++){
    if(fleschKincaid(t)<=9.5) return t;
    t = t.split(/[.\n]+/).map(simplifyLine).filter(Boolean).join('. ') + '.';
  }
  return t;
}

async function rewriteWithClaude(text){
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return null;
  try{
    const r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'x-api-key': key,
        'anthropic-version':'2023-06-01',
        'content-type':'application/json'
      },
      body: JSON.stringify({
        model:'claude-3-5-sonnet-latest',
        max_tokens:300,
        messages:[{role:'user',content:`Rewrite this to 8th–9th grade reading level. Keep factual tone. No hype words. Keep short sentences:\n\n${text}`}]
      })
    });
    if(!r.ok) return null;
    const j = await r.json();
    const out = j?.content?.[0]?.text;
    return out ? String(out).trim() : null;
  }catch{ return null; }
}

async function applyReadability(text, copyProvider='local'){
  const local = enforceReadability(text);
  if(copyProvider !== 'claude') return local;
  const rewritten = await rewriteWithClaude(local);
  if(!rewritten) return local;
  return enforceReadability(rewritten);
}

async function readJson(p){ return JSON.parse(await fs.readFile(p,'utf8')); }
async function writeFile(p,c){ await fs.mkdir(path.dirname(p),{recursive:true}); await fs.writeFile(p,c,'utf8'); }

async function buildPlaceholderPng(out){
  // 1x1 transparent png
  const b64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s5kS0kAAAAASUVORK5CYII=';
  await fs.mkdir(path.dirname(out),{recursive:true});
  await fs.writeFile(out, Buffer.from(b64,'base64'));
}

async function maybeGenerateImage(img){
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;
  const outAbs = path.join(ROOT, img.output);
  if(img.provider==='openai' && openaiKey){
    try{
      const r = await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{'Authorization':`Bearer ${openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-image-1',prompt:img.prompt,size:img.size||'1024x1024'})});
      if(r.ok){
        const j=await r.json();
        const b64=j.data?.[0]?.b64_json;
        if(b64){ await fs.writeFile(outAbs, Buffer.from(b64,'base64')); return 'generated'; }
      }
    }catch{}
  }
  if(img.provider==='gemini' && geminiKey){
    // Scaffold path only: fallback placeholder for now if generation endpoint unavailable
  }

  if(img.provider==='grok' && xaiKey){
    try{
      const r = await fetch('https://api.x.ai/v1/images/generations',{
        method:'POST',
        headers:{'Authorization':`Bearer ${xaiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:'grok-2-image',prompt:img.prompt,size:img.size||'1024x1024'})
      });
      if(r.ok){
        const j=await r.json();
        const b64=j.data?.[0]?.b64_json;
        if(b64){ await fs.writeFile(outAbs, Buffer.from(b64,'base64')); return 'generated'; }
      }
    }catch{}
  }
  await buildPlaceholderPng(outAbs);
  return 'placeholder';
}

function renderTemplate(html, ctx){
  let out = html;
  for(const [k,v] of Object.entries(ctx)) out = out.replaceAll(`{{${k}}}`, String(v??''));
  return out;
}

function firstSentence(s){
  const t=String(s||'').trim();
  const m=t.match(/(.+?[.!?])(\s|$)/);
  return (m?m[1]:t).trim();
}

function parsePromptSlides(prompt){
  const txt=String(prompt||'');

  // Mode 1: explicit "SLIDE N"
  const rx=/SLIDE\s+(\d+)\s*[:.-]?/ig;
  const matches=[...txt.matchAll(rx)];
  if(matches.length>=2){
    const blocks=[];
    for(let i=0;i<matches.length;i++){
      const start=matches[i].index + matches[i][0].length;
      const end=i+1<matches.length?matches[i+1].index:txt.length;
      const body=txt.slice(start,end).trim();
      if(!body) continue;
      let title='Slide ' + matches[i][1];
      let rest=body;
      const sentenceMatch = body.match(/^\s*([^.!?]{3,120}[.!?])\s*(.*)$/s);
      if (sentenceMatch) {
        title = sentenceMatch[1].replace(/^[-•\d.\s)]+/, '').trim().replace(/[.!?]$/,'');
        rest = sentenceMatch[2].trim();
      }
      let bullets=[];
      if(/[•\-]/.test(rest)){
        bullets=rest.split(/[•\n\-]+/).map(x=>x.trim()).filter(Boolean);
      } else {
        bullets=rest.split(/[.?!]+/).map(x=>x.trim()).filter(Boolean);
      }
      bullets=normalizeBullets(bullets);
      if (bullets.length === 0) {
        bullets = normalizeBullets([
          `${title}.`,
          'Define the structural bottleneck.',
          'State the decision gate and owner.'
        ]);
      }
      blocks.push({title, bullets});
    }
    return blocks;
  }

  // Mode 2: numbered lines (e.g., "1) ...", "2. ...")
  const lines = txt.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  const numbered = lines.filter(l=>/^\d+\s*[\).:-]/.test(l));
  if(numbered.length>=2){
    return numbered.map((l,idx)=>{
      const title = l.replace(/^\d+\s*[\).:-]\s*/,'').trim() || `Slide ${idx+1}`;
      return {
        title,
        bullets: normalizeBullets([
          `${title}.`,
          'Define the structural bottleneck.',
          'State the decision gate and owner.'
        ])
      };
    });
  }

  return [];
}

async function main(){
  const buyer_id = arg('buyer_id');
  const initiative_id = arg('initiative_id');
  const deck_type = arg('deck_type','utc-internal');
  const template_id = arg('template_id','sovereign-memo');
  const image_provider = arg('image_provider','placeholder');
  const copy_provider = arg('copy_provider','local');
  const prompt = arg('prompt','');
  const auto_generate = String(arg('auto_generate','false')) === 'true';
  if(!initiative_id) throw new Error('initiative_id required');

  const buyers = await readJson(path.join(ROOT,'dashboard/data/buyers.json'));
  const initiatives = await readJson(path.join(ROOT,'dashboard/data/initiatives.json'));
  const initiative = initiatives.find(i=>i.initiative_id===initiative_id);
  if(!initiative) throw new Error('initiative not found');
  const buyer = buyer_id ? buyers.find(b=>b.buyer_id===buyer_id) : null;

  const tRoot = path.join(ROOT,'dashboard/templates/presentation-templates',template_id);
  const tMeta = await readJson(path.join(tRoot,'template.json'));
  const tCss = await fs.readFile(path.join(tRoot,'slide.css'),'utf8');
  const dType = await readJson(path.join(ROOT,'dashboard/deck-types', `${deck_type}.json`));

  const deckRel = deck_type==='utc-internal'
    ? `presentations/${initiative_id}/decks/utc-internal`
    : `presentations/${initiative_id}/decks/buyer-alignment/${buyer?.buyer_id||'UNKNOWN'}`;
  const deckAbs = path.join(ROOT, deckRel);
  const slidesDir = path.join(deckAbs,'slides');
  const assetsDir = path.join(deckAbs,'assets');
  await fs.rm(slidesDir, { recursive:true, force:true });
  await fs.mkdir(slidesDir,{recursive:true});
  await fs.mkdir(assetsDir,{recursive:true});

  const promptSlides = parsePromptSlides(prompt);
  const promptShort = firstSentence(prompt);
  const promptLine = promptShort ? `Operator intent: ${promptShort}` : '';
  const generatedHint = auto_generate ? 'Auto-generated draft from initiative and buyer context.' : 'Prompt-guided draft.';

  const baseBullets = normalizeBullets([
    `Macro shift: ${initiative.macro_gravity_summary}`,
    promptLine,
    `Capital bottleneck: funding does not meet project timing`,
    `Governance bottleneck: approvals and sequencing are fragmented`,
    `Resolution: align mandate, sequencing, and control gates`,
    `Outcome: lower execution risk and faster mandate delivery`
  ]);

  const mirrorBullets = normalizeBullets([
    `Mandate fit: ${(buyer?.mandate_summary)||'Buyer mandate profile required'}`,
    `Regional fit: ${(buyer?.geo_focus||[]).join(', ') || 'N/A'}`,
    `Sector fit: ${(buyer?.sector_focus||[]).join(', ') || 'N/A'}`,
    `Leverage: structure expands control and policy impact`,
    `Risk: phased gates compress downside`,
    promptLine
  ]);

  const activationBullets = normalizeBullets([
    'Gate 1: confirm mandate fit and governance sponsor',
    'Gate 2: lock capital sequencing and decision rights',
    'Gate 3: launch scoped work package with controls',
    'Gate 4: review KPIs and expand by trigger rules',
    generatedHint
  ]);

  const parsedPromptSlides = parsePromptSlides(prompt);
  const concisePrompt = firstSentence(prompt || 'Pressure to initiative alignment for execution discipline.').slice(0, 140);
  const titleSubtitle = await applyReadability(concisePrompt, copy_provider);
  const closeSubtitle = await applyReadability('Next action is controlled initiation, not persuasion.', copy_provider);

  let slides = [];
  if (parsedPromptSlides.length >= 2) {
    slides.push({layout:'title', kicker:'Structural Proof', title:initiative.name, subtitle:titleSubtitle, footer:`${initiative_id} • ${deck_type}`});
    for (const blk of parsedPromptSlides.slice(0, 20)) {
      slides.push({layout:'section', kicker:'Structural Proof', title:blk.title, bullets:blk.bullets, footer:`${initiative_id} • ${deck_type}`});
    }
    slides.push({layout:'close', title:'If aligned, Gate 1 starts here.', subtitle:closeSubtitle, footer:'Sentinel Presentation Engine v1'});
  } else {
    slides = [
      {layout:'title', kicker:'Structural Proof', title:initiative.name, subtitle:titleSubtitle, footer:`${initiative_id} • ${deck_type}`},
      {layout:'section', kicker:'Structural Inevitability', title:'Gravity', bullets:baseBullets, footer:'No hype. Mechanical logic only.'},
      {layout:'proof', title:'Mandate Mirror', bullets:mirrorBullets, footer:`Buyer: ${buyer?.name||'Internal'}`},
      {layout:'diagram', title:'Controlled Activation', image:'../assets/img-001.png', footer:'Capital sequencing and governance gates'},
      {layout:'close', title:'If aligned, Gate 1 starts here.', subtitle:closeSubtitle, footer:'Sentinel Presentation Engine v1'}
    ];
  }

  const images = [{id:'img-001', provider:image_provider, prompt:'Minimal infographic, sovereign capital, governance bottleneck, clean lines, no text', size:'1024x1024', output:`${deckRel}/assets/img-001.png`}];

  const deckJson = {
    initiative_id, buyer_id: buyer?.buyer_id||null, deck_type, template_id, copy_provider,
    prompt,
    auto_generate,
    generated_at: new Date().toISOString(),
    reading_level_target:'8-9',
    constraints:{max_words_per_bullet:12,max_lines_per_bullet:2,max_bullets:6,no_hype:true},
    template: tMeta,
    slides, images,
    status:{images:'pending'}
  };

  await writeFile(path.join(deckAbs,'deck.json'), JSON.stringify(deckJson,null,2));
  await writeFile(path.join(deckAbs,'slide.css'), tCss);

  for(let i=0;i<slides.length;i++){
    const s = slides[i];
    const layoutHtml = await fs.readFile(path.join(tRoot,'slide-layouts',`${s.layout}.html`),'utf8');
    const bulletItems = [];
    for (const b of (s.bullets || [])) {
      bulletItems.push(`<li>${await applyReadability(b, copy_provider)}</li>`);
    }
    const bullets = bulletItems.join('');
    const html = renderTemplate(layoutHtml,{...s, bullets});
    await writeFile(path.join(slidesDir, `${String(i+1).padStart(3,'0')}.html`), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../slide.css"></head><body>${html}</body></html>`);
  }

  const statuses=[];
  for(const img of images){ statuses.push(await maybeGenerateImage(img)); }
  deckJson.status.images = statuses.includes('generated') ? 'partial_or_full' : 'needs_images';
  await writeFile(path.join(deckAbs,'deck.json'), JSON.stringify(deckJson,null,2));

  const index = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deck</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#000}.hint{position:fixed;right:12px;bottom:10px;color:#fff;background:#0008;padding:6px 8px;border-radius:8px;font:12px sans-serif;display:flex;gap:6px;align-items:center}.hint button{background:#111;border:1px solid #444;color:#fff;border-radius:8px;padding:2px 8px}.counter{position:fixed;left:12px;bottom:10px;color:#fff;background:#0008;padding:6px 8px;border-radius:8px;font:12px sans-serif}</style></head><body><iframe id="f"></iframe><div class="counter" id="c"></div><div class="hint"><button id="prev">◀</button><span>Swipe / Tap edges</span><button id="next">▶</button></div><script>const slides=${JSON.stringify(slides.map((_,i)=>`slides/${String(i+1).padStart(3,'0')}.html`))};let i=0;const f=document.getElementById('f');const c=document.getElementById('c');function r(){f.src=slides[i];c.textContent=(i+1)+' / '+slides.length;}function next(){i=Math.min(slides.length-1,i+1);r()}function prev(){i=Math.max(0,i-1);r()}document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')next();if(e.key==='ArrowLeft')prev();});document.getElementById('next').addEventListener('click',next);document.getElementById('prev').addEventListener('click',prev);let sx=0,sy=0;document.addEventListener('touchstart',e=>{const t=e.changedTouches[0];sx=t.clientX;sy=t.clientY;},{passive:true});document.addEventListener('touchend',e=>{const t=e.changedTouches[0];const dx=t.clientX-sx, dy=t.clientY-sy;if(Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)){if(dx<0)next();else prev();}else{if(t.clientX>window.innerWidth*0.7)next();else if(t.clientX<window.innerWidth*0.3)prev();}}, {passive:true});r();</script></body></html>`;
  await writeFile(path.join(deckAbs,'index.html'), index);

  console.log(JSON.stringify({ok:true, deck:deckRel, images:deckJson.status.images},null,2));
}

main().catch(e=>{ console.error(e); process.exit(1); });
