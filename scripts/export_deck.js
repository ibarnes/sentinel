#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'module';
const require = createRequire('/home/ec2-user/.openclaw/workspace/admin-server/package.json');
const PptxGenJS = require('pptxgenjs');

const ROOT='/home/ec2-user/.openclaw/workspace';
const arg=(n,d=null)=>{const i=process.argv.indexOf(`--${n}`);return i>=0?process.argv[i+1]:d};

async function exportPptx(deckDir){
  const deck=JSON.parse(await fs.readFile(path.join(deckDir,'deck.json'),'utf8'));
  const pptx=new PptxGenJS();
  pptx.layout='LAYOUT_WIDE';
  for(const s of deck.slides||[]){
    const slide=pptx.addSlide();
    slide.addText(s.title||'',{x:0.6,y:0.5,w:12,h:0.8,fontSize:28,bold:true});
    if(s.subtitle) slide.addText(s.subtitle,{x:0.6,y:1.4,w:12,h:0.6,fontSize:16});
    const bullets=(s.bullets||[]).map(b=>({text:b,options:{bullet:{indent:18}}}));
    if(bullets.length) slide.addText(bullets,{x:0.8,y:2,w:11,h:3.8,fontSize:18});
    if(s.image){
      const img=path.resolve(deckDir,s.image);
      try{ await fs.access(img); slide.addImage({path:img,x:7.2,y:2,w:5.5,h:3.5}); }catch{}
    }
    slide.addText(s.footer||'',{x:0.6,y:6.8,w:12,h:0.3,fontSize:10,color:'666666'});
  }
  const out=path.join(deckDir,'export.pptx');
  await pptx.writeFile({fileName:out});
  return out;
}

function exportPdf(deckDir){
  const index=path.join(deckDir,'index.html');
  const out=path.join(deckDir,'export.pdf');
  const cmd=`node -e "const { chromium } = require('playwright'); (async()=>{ const b=await chromium.launch({headless:true}); const p=await b.newPage({viewport:{width:1366,height:768}}); await p.goto('file://${index}',{waitUntil:'networkidle'}); await p.pdf({path:'${out}',format:'A4',printBackground:true}); await b.close(); })().catch(e=>{console.error(e);process.exit(1)});"`;
  const r=spawnSync('bash',['-lc',cmd],{encoding:'utf8'});
  if(r.status!==0) throw new Error('PDF export failed (Playwright not available).');
  return out;
}

async function main(){
  const deck=arg('deck');
  const format=arg('format','both');
  if(!deck) throw new Error('--deck required');
  const deckDir=path.join(ROOT,deck);
  const out={};
  if(format==='pptx' || format==='both') out.pptx=await exportPptx(deckDir);
  if(format==='pdf' || format==='both') {
    try{ out.pdf=exportPdf(deckDir); }catch(e){ out.pdf_error=String(e.message||e); }
  }
  console.log(JSON.stringify({ok:true,...out},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
