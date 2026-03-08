let model = null;
let state = { index: 0, auto: false, timer: null };

async function api(url, opts={}){ const r=await fetch(url,opts); const j=await r.json(); if(!r.ok) throw new Error(j.error||'request_failed'); return j; }

function q(k){ return new URLSearchParams(location.search).get(k); }

function current(){ return model?.steps?.[state.index] || null; }

function render(){
  const s=current();
  if(!s) return;
  document.getElementById('title').textContent = s.title;
  document.getElementById('meta').textContent = `${s.action} • step ${state.index+1}/${model.steps.length} • confidence ${s.confidence ?? 'n/a'}`;
  document.getElementById('intent').textContent = s.intent || 'No intent';
  const img = document.getElementById('shot');
  img.src = s.highlight || s.screenshotAfter || s.screenshotBefore || '';
  const ann = document.getElementById('annotations');
  ann.innerHTML='';
  (s.annotations||[]).forEach(a=>{ const li=document.createElement('li'); li.textContent=`${a.author||'author'}: ${a.text}`; ann.appendChild(li); });
}

function gotoIndex(i){ state.index=Math.max(0,Math.min(model.steps.length-1,i)); render(); }
function next(){ gotoIndex(state.index+1); }
function prev(){ gotoIndex(state.index-1); }
function restart(){ gotoIndex(0); }

function toggleAuto(){
  state.auto=!state.auto;
  const btn=document.getElementById('auto');
  btn.textContent = state.auto ? 'Stop Auto' : 'Auto Play';
  if(state.timer){ clearInterval(state.timer); state.timer=null; }
  if(state.auto){
    state.timer=setInterval(()=>{ const s=current(); if(!s) return; if(state.index>=model.steps.length-1){ state.auto=false; toggleAuto(); return; } next(); }, current()?.stepDurationMs || 3000);
  }
}

async function boot(){
  const flowId = location.pathname.split('/').pop();
  const snapshotId = q('snapshotId');
  if(snapshotId) model=(await api(`/reveal/api/player/snapshots/${encodeURIComponent(flowId)}?flowId=${encodeURIComponent(flowId)}&snapshotId=${encodeURIComponent(snapshotId)}`)).model;
  else model=(await api(`/reveal/api/player/flows/${encodeURIComponent(flowId)}`)).model;
  document.getElementById('flow').textContent = `${model.title} (${model.sourceType})`;
  render();
  document.getElementById('next').onclick=next;
  document.getElementById('prev').onclick=prev;
  document.getElementById('restart').onclick=restart;
  document.getElementById('auto').onclick=toggleAuto;
}

boot().catch(e=>{ document.body.innerHTML=`<pre>${e.message}</pre>`; });
