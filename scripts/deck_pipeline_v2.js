#!/usr/bin/env node
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';

const ROOT='/home/ec2-user/.openclaw/workspace';
const TEMPLATES=path.join(ROOT,'dashboard/templates/presentation-templates');

const arg=(n,d=null)=>{const i=process.argv.indexOf(`--${n}`);return i>=0?process.argv[i+1]:d};
const bool=(n)=>String(arg(n,'false'))==='true';

function words(s){return String(s||'').trim().split(/\s+/).filter(Boolean)}
function syllables(w){const t=w.toLowerCase().replace(/[^a-z]/g,'');const m=t.match(/[aeiouy]+/g);return Math.max(1,(m||[]).length)}
function fleschKincaid(text){const s=Math.max(1,String(text).split(/[.!?]+/).filter(x=>x.trim()).length);const ws=words(text);const w=Math.max(1,ws.length);const sy=ws.reduce((n,x)=>n+syllables(x),0);return 0.39*(w/s)+11.8*(sy/w)-15.59}
function simplify(t){return String(t||'').replace(/\b(revolutionary|game-changing|disruptive|best-in-class|unprecedented)\b/ig,'').split(/\s+/).slice(0,12).join(' ').trim()}
function normalizeBullets(arr){return (arr||[]).map(simplify).filter(Boolean).slice(0,6)}
function rel(p){return path.relative(ROOT,p)}

function bulletsToHtml(items){
  const arr = Array.isArray(items) ? items : [];
  let parentOpen = false;
  const out = [];

  const isParent = (t) => /:\s*$/.test(t) || /^month\s+\d+\s*:/i.test(t);
  const isSiblingParent = (t) => /^month\s+\d+\s*:/i.test(t) || /^phase\s+\d+\s*:/i.test(t) || /^gate\s+\d+\s*:/i.test(t);

  for (let i = 0; i < arr.length; i++) {
    const text = String(arr[i] || '').trim();
    if (!text) continue;

    if (text.startsWith('__INTRO__ ')) {
      out.push(`<li class="intro">${text.replace('__INTRO__ ', '')}</li>`);
      parentOpen = false;
      continue;
    }

    if (i === 0 && /:\s*$/.test(text) && arr.length > 1) {
      out.push(`<li class="intro">${text}</li>`);
      parentOpen = false;
      continue;
    }

    if (isParent(text)) {
      out.push(`<li class="parent">${text}</li>`);
      parentOpen = true;
      continue;
    }

    const prev = i > 0 ? String(arr[i - 1] || '').trim() : '';
    if (parentOpen) {
      if (isSiblingParent(text)) {
        out.push(`<li class="parent">${text}</li>`);
        parentOpen = true;
      } else {
        out.push(`<li class="sub">${text}</li>`);
      }
    } else if (isParent(prev)) {
      out.push(`<li class="sub">${text}</li>`);
      parentOpen = true;
    } else {
      out.push(`<li>${text}</li>`);
    }
  }

  return out.join('');
}

function parsePromptSlides(prompt){
  const txt=String(prompt||'').replaceAll('⸻','\n');
  const rx=/SLIDE\s+(\d+)\s*[:.-]?/ig;
  const m=[...txt.matchAll(rx)];
  if(m.length<2) return [];
  const out=[];
  for(let i=0;i<m.length;i++){
    const start=m[i].index+m[i][0].length;
    const end=i+1<m.length?m[i+1].index:txt.length;
    const body=txt.slice(start,end).trim();
    if(!body) continue;
    const bIdx=body.search(/[•\n]/);
    let title='Slide '+m[i][1], rest=body;
    if(bIdx>0){ title=body.slice(0,bIdx).replace(/^title\s*:\s*/i,'').replace(/^[-•\d.\s)]+/,'').replace(/[.:-]+$/,'').trim(); rest=body.slice(bIdx).trim(); }
    let bullets = /[•\n]/.test(rest) ? rest.split(/[•\n]+/).map(x=>x.trim()).filter(Boolean) : rest.split(/[.?!]+/).map(x=>x.trim()).filter(Boolean);
    bullets = normalizeBullets(bullets);
    if(!bullets.length) bullets=[`${title}.`,'Define the structural bottleneck.','State the decision gate and owner.'];
    out.push({title,bullets});
  }
  return out;
}

function planSlides({initiative,buyer,prompt,deckType}){
  const parsed=parsePromptSlides(prompt);
  const core=[
    {purpose:'Prove structural inevitability',layout:'section',title:'Gravity',bullets:[`Macro shift: ${initiative.macro_gravity_summary||'Demand and constraints are active now.'}`]},
    {purpose:'Prove mandate fit',layout:'proof',title:'Mandate Mirror',bullets:[`Mandate fit: ${buyer?.mandate_summary||'Buyer mandate alignment required.'}`]},
    {purpose:'Prove controlled activation',layout:'diagram',title:'Controlled Activation',bullets:['Gate sequencing controls risk and execution.']}
  ];
  if(parsed.length>=3){
    return parsed.map((p,idx)=>({purpose: idx<3?core[idx].purpose:'Prove structural progression',layout: idx===2?'diagram':'section', title:p.title, bullets:p.bullets}));
  }
  return core;
}

function scoreDensity(slide){
  const text=[slide.title,...(slide.bullets||[])].join(' ');
  const wc=words(text).length;
  return Math.min(1, wc/90);
}

function critic(slide){
  const issues=[];
  if((slide.bullets||[]).length>slide.constraints.max_bullets) issues.push('too_many_bullets');
  for(const b of (slide.bullets||[])) if(words(b).length>slide.constraints.max_words_per_bullet) issues.push('bullet_too_long');
  if(fleschKincaid([slide.title,...slide.bullets].join('. '))>9.5) issues.push('readability_high');
  if(scoreDensity(slide)>0.4) issues.push('density_high');
  return issues;
}

function rewrite(slide){
  slide.title=simplify(slide.title);
  slide.bullets=normalizeBullets(slide.bullets);
  if(!slide.bullets.length) slide.bullets=['Clarify structural objective.'];
  return slide;
}

async function maybeImage(img){
  const out=path.join(ROOT,img.output_path);
  await fs.mkdir(path.dirname(out),{recursive:true});
  const openai=process.env.OPENAI_API_KEY;
  const gemini=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
  if(img.provider==='openai' && openai){
    try{const r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${openai}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-image-1',prompt:img.prompt,size:'1024x1024'})}); if(r.ok){const j=await r.json();const b=j.data?.[0]?.b64_json; if(b){await fs.writeFile(out,Buffer.from(b,'base64')); return 'generated';}}}catch{}
  }
  if(img.provider==='gemini' && gemini){ /* scaffold; fallback */ }
  const px='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s5kS0kAAAAASUVORK5CYII=';
  await fs.writeFile(out,Buffer.from(px,'base64'));
  return 'placeholder';
}

async function renderSlide(deckDir, templateId, slide){
  const tRoot=path.join(TEMPLATES,templateId);
  const layoutPath=path.join(tRoot,'slide-layouts',`${slide.layout}.html`);
  const layout = await fs.readFile(layoutPath,'utf8').catch(()=>'<section class="slide"><h2>{{title}}</h2><ul class="bullets">{{bullets}}</ul></section>');
  const bullets = bulletsToHtml(slide.bullets || []);
  const html = layout.replaceAll('{{title}}',slide.copy.title||slide.title).replaceAll('{{kicker}}','STRUCTURAL PROOF').replaceAll('{{subtitle}}',slide.copy.subtitle||'').replaceAll('{{footer}}',slide.copy.footer||'').replaceAll('{{bullets}}',bullets).replaceAll('{{image}}', slide.images?.[0]?.output_path ? '../'+path.basename(slide.images[0].output_path):'');
  const css = await fs.readFile(path.join(tRoot,'slide.css'),'utf8');
  const full = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../slide.css"><style>.bullets{max-width:70ch}.bullets li{margin:.35rem 0}.bullets li.intro{list-style:none;margin-left:0;padding-left:0;font-weight:500;opacity:.95}.bullets li.parent{list-style:none;margin-left:0;padding-left:0;font-weight:600;opacity:.95}.bullets li.sub{margin-left:1.4rem;list-style-type:circle;opacity:.95}</style></head><body>${html}</body></html>`;
  await fs.writeFile(path.join(deckDir,'slide.css'),css,'utf8');
  await fs.mkdir(path.join(deckDir,'slides'),{recursive:true});
  await fs.writeFile(path.join(deckDir,'slides',`${slide.slide_id}.html`),full,'utf8');
}

async function assembleIndex(deckDir, slideCount){
  const slides=[...Array(slideCount)].map((_,i)=>`slides/${String(i+1).padStart(3,'0')}.html`);
  const idx=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#000}.hint{position:fixed;right:12px;bottom:10px;color:#fff;background:#0008;padding:6px 8px;border-radius:8px;font:12px sans-serif;display:flex;gap:6px}.counter{position:fixed;left:12px;bottom:10px;color:#fff;background:#0008;padding:6px 8px;border-radius:8px;font:12px sans-serif}</style></head><body><iframe id=f></iframe><div id=c class=counter></div><div class=hint><button id=p>◀</button><span>Swipe / Tap edges</span><button id=n>▶</button></div><script>const s=${JSON.stringify(slides)};let i=0;const f=document.getElementById('f'),c=document.getElementById('c');function r(){f.src=s[i];c.textContent=(i+1)+' / '+s.length}function n(){i=Math.min(s.length-1,i+1);r()}function p(){i=Math.max(0,i-1);r()}document.getElementById('n').onclick=n;document.getElementById('p').onclick=p;document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')n();if(e.key==='ArrowLeft')p();});let sx=0,sy=0;document.addEventListener('touchstart',e=>{const t=e.changedTouches[0];sx=t.clientX;sy=t.clientY},{passive:true});document.addEventListener('touchend',e=>{const t=e.changedTouches[0];const dx=t.clientX-sx,dy=t.clientY-sy;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){if(dx<0)n();else p();}else{if(t.clientX>window.innerWidth*.7)n();else if(t.clientX<window.innerWidth*.3)p();}},{passive:true});r();</script></body></html>`;
  await fs.writeFile(path.join(deckDir,'index.html'),idx,'utf8');
}

async function runPipeline(opts){
  const deckRel = opts.deck_path || (opts.deck_type==='utc-internal' ? `presentations/${opts.initiative_id}/decks/utc-internal` : `presentations/${opts.initiative_id}/decks/buyer-alignment/${opts.buyer_id||'UNKNOWN'}`);
  const deckDir = path.join(ROOT,deckRel);
  await fs.mkdir(deckDir,{recursive:true});
  const logPath=path.join(deckDir,'stage-log.jsonl');
  const log=async(stage,status,meta={})=>fs.appendFile(logPath,JSON.stringify({ts:new Date().toISOString(),stage,status,...meta})+'\n');

  const deck = fssync.existsSync(path.join(deckDir,'deck.json')) ? JSON.parse(await fs.readFile(path.join(deckDir,'deck.json'),'utf8')) : {
    deckPlan:{constraints:{framework:['Gravity','Mandate Mirror','Controlled Activation'],target_grade_level:'8-9',max_bullets:6,max_words_per_bullet:12},audience:'internal',template_id:opts.template_id,slide_count:0,deck_type:opts.deck_type,initiative_id:opts.initiative_id,buyer_id:opts.buyer_id||null},
    slides:[]
  };

  if(opts.rerender_slide){
    const s=deck.slides.find(x=>x.slide_id===opts.rerender_slide);
    if(!s) throw new Error('slide not found');
    await renderSlide(deckDir, deck.deckPlan.template_id || opts.template_id, s);
    await assembleIndex(deckDir, deck.slides.length);
    await log('rerender','ok',{slide_id:s.slide_id});
    return {ok:true,deck:deckRel,slideCount:deck.slides.length,mode:'rerender'};
  }

  if(opts.rebuild_all){
    // Re-render all slides from existing SlideSpec source of truth.
    const tId = deck.deckPlan?.template_id || opts.template_id || 'sovereign-memo';
    for(const s of (deck.slides||[])){
      await renderSlide(deckDir, tId, s);
      await log('render','ok',{slide_id:s.slide_id,mode:'rebuild_all'});
    }
    await assembleIndex(deckDir, (deck.slides||[]).length);
    const qa={deck:deckRel,generated_at:new Date().toISOString(),slides:(deck.slides||[]).map(s=>({slide_id:s.slide_id,title:s.title,qa:s.qa||{}})),summary:{total:(deck.slides||[]).length,pass:(deck.slides||[]).filter(s=>s.qa?.pass!==false).length,fail:(deck.slides||[]).filter(s=>s.qa?.pass===false).length}};
    await fs.writeFile(path.join(deckDir,'qa-report.json'),JSON.stringify(qa,null,2),'utf8');
    await log('assemble','ok',{slides:(deck.slides||[]).length,mode:'rebuild_all'});
    return {ok:true,deck:deckRel,slideCount:(deck.slides||[]).length,mode:'rebuild_all'};
  }

  const buyers=JSON.parse(await fs.readFile(path.join(ROOT,'dashboard/data/buyers.json'),'utf8'));
  const initiatives=JSON.parse(await fs.readFile(path.join(ROOT,'dashboard/data/initiatives.json'),'utf8'));
  const initiative=initiatives.find(i=>i.initiative_id===opts.initiative_id);
  if(!initiative) throw new Error('initiative not found');
  const buyer = opts.buyer_id ? buyers.find(b=>b.buyer_id===opts.buyer_id) : null;

  await log('plan','start');
  const plan = planSlides({initiative,buyer,prompt:opts.prompt,deckType:opts.deck_type});
  deck.deckPlan={...deck.deckPlan,template_id:opts.template_id,slide_count:plan.length+2,deck_type:opts.deck_type,initiative_id:opts.initiative_id,buyer_id:opts.buyer_id||null,prompt:opts.prompt||''};

  const slides=[];
  slides.push({slide_id:'001',purpose:'Open the deck',layout:'title',copy:{title:initiative.name,subtitle:simplify(opts.prompt||'Structural proof deck'),footer:`${opts.initiative_id} • ${opts.deck_type}`},title:initiative.name,bullets:[],images:[],constraints:{max_bullets:6,max_words_per_bullet:12,target_grade_level:'8-9'},provenance:{sources:[]},qa:{},revisions_count:0});

  for(let i=0;i<plan.length;i++){
    const p=plan[i];
    const id=String(i+2).padStart(3,'0');
    let slide={slide_id:id,purpose:p.purpose,layout:p.layout,copy:{title:p.title,bullets:p.bullets,footer:`${opts.initiative_id} • ${opts.deck_type}`},title:p.title,bullets:p.bullets,images:[{slot_id:'img-001',prompt:'Minimal infographic, no text, infrastructure governance map',provider:opts.image_provider,output_path:`${deckRel}/assets/${id}-img-001.png`}],constraints:{max_bullets:6,max_words_per_bullet:12,target_grade_level:'8-9'},provenance:{sources:[]},qa:{},revisions_count:0};
    await log('draft','ok',{slide_id:id});

    for(let r=0;r<3;r++){
      const issues=critic(slide);
      if(!issues.length){ slide.qa={readability_score:fleschKincaid([slide.title,...slide.bullets].join('. ')),density_score:scoreDensity(slide),overflow_risk:scoreDensity(slide)>0.6?'high':'low',pass:true,fail:[]}; break; }
      slide.qa={readability_score:fleschKincaid([slide.title,...slide.bullets].join('. ')),density_score:scoreDensity(slide),overflow_risk:scoreDensity(slide)>0.6?'high':'low',pass:false,fail:issues};
      slide=rewrite(slide); slide.revisions_count+=1;
      await log('rewrite','retry',{slide_id:id,issues});
    }

    for(const img of slide.images){ const stat=await maybeImage(img); await log('image','ok',{slide_id:id,status:stat}); }
    slides.push(slide);
  }

  const closeId=String(slides.length+1).padStart(3,'0');
  slides.push({slide_id:closeId,purpose:'Close with next gate',layout:'close',copy:{title:'If aligned, Gate 1 starts here.',subtitle:'Define scope, authority, and timeline.',footer:'Sentinel v2'},title:'If aligned, Gate 1 starts here.',bullets:[],images:[],constraints:{max_bullets:6,max_words_per_bullet:12,target_grade_level:'8-9'},provenance:{sources:[]},qa:{readability_score:6,density_score:0.2,overflow_risk:'low',pass:true,fail:[]},revisions_count:0});

  deck.slides=slides;
  await fs.writeFile(path.join(deckDir,'deck.json'),JSON.stringify(deck,null,2),'utf8');

  for(const s of slides){ await renderSlide(deckDir, opts.template_id, s); await log('render','ok',{slide_id:s.slide_id}); }
  await assembleIndex(deckDir, slides.length);

  const qa={deck:deckRel,generated_at:new Date().toISOString(),slides:slides.map(s=>({slide_id:s.slide_id,title:s.title,qa:s.qa})),summary:{total:slides.length,pass:slides.filter(s=>s.qa?.pass!==false).length,fail:slides.filter(s=>s.qa?.pass===false).length}};
  await fs.writeFile(path.join(deckDir,'qa-report.json'),JSON.stringify(qa,null,2),'utf8');
  await log('qa','ok',qa.summary);
  await log('assemble','ok',{slides:slides.length});

  return {ok:true,deck:deckRel,slideCount:slides.length,images:'pipeline'};
}

async function main(){
  const opts={
    initiative_id:arg('initiative_id'),
    buyer_id:arg('buyer_id',''),
    deck_type:arg('deck_type','utc-internal'),
    template_id:arg('template_id','sovereign-memo'),
    image_provider:arg('image_provider','placeholder'),
    prompt:arg('prompt',''),
    deck_path:arg('deck_path',''),
    rerender_slide:arg('rerender_slide',''),
    rebuild_all: String(arg('rebuild_all','false')) === 'true'
  };
  if(!opts.initiative_id && !opts.deck_path) throw new Error('initiative_id or deck_path required');
  const out=await runPipeline(opts);
  console.log(JSON.stringify(out,null,2));
}

main().catch(e=>{console.error(e.message||e);process.exit(1)});
