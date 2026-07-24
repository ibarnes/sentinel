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

const manifestPath = path.join(dir,'manifest.json');
const authLogPath = path.join(dir,'auth-smoke.log');
const legacyLogPath = path.join(dir,'smoke.log');
const logPath = fs.existsSync(authLogPath) ? authLogPath : legacyLogPath;
const validPath = path.join(dir,'valid-response.json');
const invalidPath = path.join(dir,'invalid-response.json');
const auditPath = path.join(dir,'pipeline-run-created.audit.json');

const required = [
  { label: 'manifest.json', ok: fs.existsSync(manifestPath) },
  { label: 'auth-smoke.log|smoke.log', ok: fs.existsSync(logPath) },
  { label: 'valid-response.json', ok: fs.existsSync(validPath) },
  { label: 'invalid-response.json', ok: fs.existsSync(invalidPath) },
  { label: 'pipeline-run-created.audit.json', ok: fs.existsSync(auditPath) }
];
const missing=required.filter((entry)=>!entry.ok).map((entry)=>entry.label);
let pass=false;
let checks=[];
if(missing.length===0){
  const valid=JSON.parse(fs.readFileSync(validPath,'utf8'));
  const invalid=JSON.parse(fs.readFileSync(invalidPath,'utf8'));
  const audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const log=fs.readFileSync(logPath,'utf8');
  const validRun = valid?.run && typeof valid.run === 'object' ? valid.run : valid;
  const runId = String(validRun?.runId || validRun?.run_id || validRun?.id || manifest?.run_id || '');
  const auditMeta = audit?.meta && typeof audit.meta === 'object' ? audit.meta : {};
  checks=[
    {name:'log_has_201',pass:/HTTP 201/.test(log)},
    {name:'log_has_400',pass:/HTTP 400/.test(log)},
    {name:'valid_has_runId',pass:!!runId},
    {name:'valid_has_started',pass:String(validRun?.status || '').toLowerCase()==='started'},
    {name:'invalid_has_validation_error',pass:!!(invalid && (invalid.error || invalid.message || invalid.details || invalid.validationErrors))},
    {name:'audit_matches_run',pass:audit?.event_type === 'pipeline.run.created'
      && String(audit?.entity_id || '') === runId
      && String(auditMeta.deckId || '') === String(validRun?.deckId || manifest?.deck_id || '')
      && String(auditMeta.status || '').toLowerCase() === 'started'}
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
