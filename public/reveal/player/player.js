let model = null;
let session = null;
let state = { autoTimer: null };
const boot = window.REVEAL_PLAYER_BOOT || {};

async function api(url, opts={}){ const r=await fetch(url,opts); const j=await r.json(); if(!r.ok) throw new Error(j.error||'request_failed'); return j; }
function currentStep(){ return model?.steps?.[session.currentStepIndex] || null; }
function readOnly(){ return Boolean(boot.readOnly); }

function applyEmbed(){
  const embed = boot.embed || {};
  if (!embed.showControls) document.getElementById('controls').style.display = 'none';
  if (!embed.showAnnotations) document.getElementById('annotations').parentElement.style.display = 'none';
  if (!embed.showOverlay) document.getElementById('overlay').style.display = 'none';
  if (embed.embedMode === 'minimal_embed') document.getElementById('panel').style.display = 'none';
  if (embed.embedMode === 'kiosk_embed') {
    document.getElementById('panel').style.display = 'none';
    document.getElementById('controls').style.display = 'none';
  }
}

function renderHotspots(step){
  const layer = document.getElementById('hotspots');
  layer.innerHTML='';
  (step.hotspots||[]).filter(h=>h.visible!==false).sort((a,b)=>(a.priority||0)-(b.priority||0)).forEach(h=>{
    const d=document.createElement('div');
    d.className=`hotspot ${h.type==='primary_target'?'primary':''}`;
    d.style.left=`${h.x}%`; d.style.top=`${h.y}%`; d.style.width=`${h.width}%`; d.style.height=`${h.height}%`;
    d.title=h.label||'hotspot';
    if(h.interactionMode==='click' && !readOnly()) d.onclick=()=>patch('interactHotspot',{ jumpTo:h.hotspotId });
    layer.appendChild(d);
  });
}

function render(){
  if(!model || !session) return;
  const s=currentStep(); if(!s) return;
  const shareText = boot.share?.shareId ? ` • share ${boot.share.shareId}` : '';
  document.getElementById('flow').textContent = `${model.title} (${model.sourceType})${shareText}`;
  document.getElementById('title').textContent = s.title;
  const meta = [];
  if (!readOnly()) meta.push(`session ${session.sessionId}`);
  if ((boot.embed||{}).showStepCounter !== false) meta.push(`step ${session.currentStepIndex+1}/${session.stepCount}`);
  meta.push(session.playbackStatus);
  document.getElementById('meta').textContent = meta.join(' • ');
  document.getElementById('intent').textContent = s.intent || 'No intent';
  document.getElementById('shot').src = s.highlight || s.screenshotAfter || s.screenshotBefore || '';
  document.getElementById('overlay').innerHTML = `<strong>${s.overlay?.title || s.title}</strong><div>${s.overlay?.body || ''}</div>`;
  const ann=document.getElementById('annotations'); ann.innerHTML='';
  (s.annotations||[]).forEach(a=>{ const li=document.createElement('li'); li.textContent=`${a.author||'author'}: ${a.text}`; ann.appendChild(li); });
  renderHotspots(s);
}

async function patch(action, extra={}){
  if(readOnly()) return;
  const out = await api(`/reveal/api/player/sessions/${session.sessionId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action, ...extra }) });
  session = out.session; model = out.model; render();
}

async function bootLoad(){
  const flowId = boot.flowId || location.pathname.split('/').pop();
  const snapshotId = boot.snapshotId || null;
  const sessionId = boot.sessionId || null;

  if (sessionId) {
    try {
      const resumed = await api(`/reveal/api/player/sessions/${encodeURIComponent(sessionId)}/resume`, { method:'POST', headers:{'Content-Type':'application/json'}, body: '{}' });
      session = resumed.session; model = resumed.model;
    } catch {
      const loaded = await api(`/reveal/api/player/sessions/${encodeURIComponent(sessionId)}`);
      session = loaded.session; model = loaded.model;
    }
  }

  if (!session || !model) {
    const shouldSession = boot.share ? Boolean(boot.playbackDefaults?.autoSession ?? true) : true;
    if (shouldSession) {
      const body = snapshotId ? { snapshotId } : { flowId };
      const created = await api('/reveal/api/player/sessions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      session = created.session; model = created.model;
    } else if (snapshotId) {
      const loaded = await api(`/reveal/api/player/snapshots/${encodeURIComponent(snapshotId)}`);
      model = loaded.model;
      session = { sessionId: 'stateless', currentStepIndex: loaded.playback.currentStepIndex || 0, stepCount: model.steps.length, playbackStatus: 'ready' };
    } else {
      const loaded = await api(`/reveal/api/player/flows/${encodeURIComponent(flowId)}`);
      model = loaded.model;
      session = { sessionId: 'stateless', currentStepIndex: loaded.playback.currentStepIndex || 0, stepCount: model.steps.length, playbackStatus: 'ready' };
    }
  }

  applyEmbed();
  render();

  document.getElementById('next').onclick=()=>patch('next').catch(e=>alert(e.message));
  document.getElementById('prev').onclick=()=>patch('prev').catch(e=>alert(e.message));
  document.getElementById('restart').onclick=()=>patch('restart').catch(e=>alert(e.message));
  document.getElementById('dismiss').onclick=()=>patch('dismissOverlay').catch(e=>alert(e.message));
  document.getElementById('auto').onclick=async ()=>{
    const enabled = !session.autoPlayEnabled;
    await patch(enabled ? 'play' : 'pause', { autoPlayEnabled: enabled });
  };

  if (readOnly()) {
    for (const id of ['next','prev','restart','dismiss','auto']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  }
}

bootLoad().catch(e=>{ document.body.innerHTML=`<pre>${e.message}</pre>`; });
