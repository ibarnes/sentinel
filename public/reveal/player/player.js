let model = null;
let session = null;
let state = { autoTimer: null };

async function api(url, opts={}){ const r=await fetch(url,opts); const j=await r.json(); if(!r.ok) throw new Error(j.error||'request_failed'); return j; }
function q(k){ return new URLSearchParams(location.search).get(k); }
function currentStep(){ return model?.steps?.[session.currentStepIndex] || null; }

function renderHotspots(step){
  const layer = document.getElementById('hotspots');
  layer.innerHTML='';
  (step.hotspots||[]).filter(h=>h.visible!==false).sort((a,b)=>(a.priority||0)-(b.priority||0)).forEach(h=>{
    const d=document.createElement('div');
    d.className=`hotspot ${h.type==='primary_target'?'primary':''}`;
    d.style.left=`${h.x}%`; d.style.top=`${h.y}%`; d.style.width=`${h.width}%`; d.style.height=`${h.height}%`;
    d.title=h.label||'hotspot';
    if(h.interactionMode==='click') d.onclick=()=>patch('interactHotspot',{ jumpTo:h.hotspotId });
    layer.appendChild(d);
  });
}

function render(){
  if(!model || !session) return;
  const s=currentStep();
  if(!s) return;
  document.getElementById('flow').textContent = `${model.title} (${model.sourceType})`;
  document.getElementById('title').textContent = s.title;
  document.getElementById('meta').textContent = `session ${session.sessionId} • ${session.playbackStatus} • step ${session.currentStepIndex+1}/${session.stepCount} • autoplay ${session.autoPlayEnabled?'on':'off'} • expires ${session.expiresAt || 'n/a'} • resumable ${session.resumable ? 'yes' : 'no'} • canProceed ${session.interactionState?.[String(session.currentStepIndex)]?.canProceed !== false ? 'yes':'no'}`;
  document.getElementById('intent').textContent = s.intent || 'No intent';
  document.getElementById('shot').src = s.highlight || s.screenshotAfter || s.screenshotBefore || '';
  document.getElementById('overlay').innerHTML = `<strong>${s.overlay?.title || s.title}</strong><div>${s.overlay?.body || ''}</div><div class='small'>mode: ${s.overlay?.progressionMode || 'manual'} • emphasis: ${s.overlay?.emphasisMode || 'none'}</div>`;
  const ann=document.getElementById('annotations'); ann.innerHTML='';
  (s.annotations||[]).forEach(a=>{ const li=document.createElement('li'); li.textContent=`${a.author||'author'}: ${a.text}`; ann.appendChild(li); });
  renderHotspots(s);
}

async function patch(action, extra={}){
  const out = await api(`/reveal/api/player/sessions/${session.sessionId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action, ...extra }) });
  session = out.session;
  model = out.model;
  render();
}

async function boot(){
  const flowId = location.pathname.split('/').pop();
  const snapshotId = q('snapshotId');
  const sessionId = q('sessionId');

  if (sessionId) {
    try {
      const resumed = await api(`/reveal/api/player/sessions/${encodeURIComponent(sessionId)}/resume`, { method:'POST', headers:{'Content-Type':'application/json'}, body: '{}' });
      session = resumed.session;
      model = resumed.model;
      document.getElementById('resume-note').textContent = `resume status: ${resumed.status}`;
    } catch (e) {
      document.getElementById('resume-note').textContent = `resume failed: ${e.message}`;
    }
  }

  if (!session || !model) {
    const body = snapshotId ? { snapshotId } : { flowId };
    const created = await api('/reveal/api/player/sessions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    session = created.session;
    model = created.model;
  }

  render();

  document.getElementById('next').onclick=()=>patch('next').catch(e=>alert(e.message));
  document.getElementById('prev').onclick=()=>patch('prev').catch(e=>alert(e.message));
  document.getElementById('restart').onclick=()=>patch('restart').catch(e=>alert(e.message));
  document.getElementById('dismiss').onclick=()=>patch('dismissOverlay').catch(e=>alert(e.message));
  document.getElementById('auto').onclick=async ()=>{
    const enabled = !session.autoPlayEnabled;
    await patch(enabled ? 'play' : 'pause', { autoPlayEnabled: enabled });
    document.getElementById('auto').textContent = enabled ? 'Stop Auto' : 'Auto Play';
    if(state.autoTimer){ clearInterval(state.autoTimer); state.autoTimer=null; }
    if(enabled){
      state.autoTimer=setInterval(async ()=>{
        if(!session.autoPlayEnabled) return;
        const s=currentStep();
        if(!s) return;
        if((s.overlay?.progressionMode||'manual')==='auto') {
          if(session.currentStepIndex >= session.stepCount - 1){
            await patch('pause', { autoPlayEnabled:false });
            clearInterval(state.autoTimer); state.autoTimer=null;
            document.getElementById('auto').textContent='Auto Play';
            return;
          }
          await patch('next').catch(()=>{});
        }
      }, currentStep()?.overlay?.stepDurationMs || currentStep()?.stepDurationMs || 3000);
    }
  };
}

boot().catch(e=>{ document.body.innerHTML=`<pre>${e.message}</pre>`; });
