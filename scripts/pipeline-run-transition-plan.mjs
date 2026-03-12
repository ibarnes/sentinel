#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function arg(name, fallback=null){
  const idx=process.argv.indexOf(`--${name}`);
  if(idx>=0 && process.argv[idx+1]) return process.argv[idx+1];
  return fallback;
}

const dir=arg('dir');
if(!dir){console.error('Usage: node scripts/pipeline-run-transition-plan.mjs --dir <evidence_dir> [--out <path>]'); process.exit(1);} 
const out=arg('out', path.join(dir,'transition-plan.json'));

const required=['manifest.json','smoke.log','valid-response.json','invalid-response.json'];
const missing=required.filter(f=>!fs.existsSync(path.join(dir,f)));
let pass=false;
let checks=[];
if(missing.length===0){
  const valid=fs.readFileSync(path.join(dir,'valid-response.json'),'utf8');
  const invalid=fs.readFileSync(path.join(dir,'invalid-response.json'),'utf8');
  checks=[
    {name:'valid_has_201',pass:/201/.test(valid)},
    {name:'valid_has_runId',pass:/runId/i.test(valid)},
    {name:'valid_has_started_or_running',pass:/started|running/i.test(valid)},
    {name:'invalid_has_400',pass:/400/.test(invalid)}
  ];
  pass=checks.every(c=>c.pass);
}

const plan={
  generated_at:new Date().toISOString(),
  evidence_dir:dir,
  status: pass?'PASS':'BLOCKED',
  missing_files:missing,
  checks,
  transitions: pass
    ? [
      {task:'TASK-0111',action:'set Ready for Review',comment:'Credentialed smoke evidence captured and verified.'},
      {task:'TASK-0103',action:'set Ready for Review',comment:'Credentialed execution + evidence attached; acceptance criteria met.'},
      {task:'TASK-0097',action:'set Ready for Review',comment:'Live authenticated smoke evidence complete via TASK-0111/TASK-0103.'},
      {task:'TASK-0095',action:'set Ready for Review',comment:'Smoke verification satisfied through completed live evidence chain.'},
      {task:'TASK-0043',action:'set Ready for Review',comment:'POST /pipeline/run validation + runId creation slice now fully verified.'}
    ]
    : [
      {task:'TASK-0111',action:'remain Backlog/In Progress',comment:'Await credentialed run output.'},
      {task:'TASK-0103',action:'remain In Progress',comment:'Execution blocked pending credential and evidence artifacts.'},
      {task:'TASK-0097',action:'remain In Progress',comment:'Live smoke evidence still incomplete.'}
    ],
  next_action: pass
    ? 'Apply transition replay checklist and update BOARD.json within 30 minutes.'
    : 'Run scripts/pipeline-run-smoke-capture.sh in credentialed window, then re-run this planner.'
};

fs.writeFileSync(out, JSON.stringify(plan,null,2));
console.log(JSON.stringify({ok:true,status:plan.status,out},null,2));
