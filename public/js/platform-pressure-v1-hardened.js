(function () {
  function byId(id) { return document.getElementById(id); }
  function setText(id, text) { var el = byId(id); if (el) el.textContent = text; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>]/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[c]; }); }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function fmtPct(v) { return (num(v) * 100).toFixed(0) + '%'; }
  function safeArray(v) { return Array.isArray(v) ? v : []; }

  var state = {
    rows: [],
    filtered: [],
    signalPhysics: { initiatives: [], ontologyLayers: [] },
    stageFilter: '',
    sortBy: 'ppi',
    sortDir: 'desc'
  };

  function showError(msg) {
    var box = byId('pp-failure') || byId('pp-error');
    if (!box) return;
    box.style.display = 'block';
    box.textContent = 'Platform Pressure section warning: ' + msg;
  }

  function parseBootstrap() {
    try {
      var el = byId('pp-data');
      if (!el) return;
      var payload = JSON.parse(el.textContent || '{}');
      state.rows = safeArray(payload.rows);
      state.signalPhysics = payload.signalPhysics || { initiatives: [], ontologyLayers: [] };
      state.filtered = state.rows.slice();
    } catch (e) {
      showError('bootstrap parse failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function getPhysicsForRow(row) {
    var inits = safeArray(((row || {}).linkRefs || {}).initiativeIds);
    var phys = safeArray((state.signalPhysics || {}).initiatives);
    for (var i = 0; i < inits.length; i++) {
      for (var j = 0; j < phys.length; j++) {
        if (String(phys[j].initiative_id || '') === String(inits[i])) return phys[j];
      }
    }
    return null;
  }

  function getOntologyLayers() {
    var layers = safeArray((state.signalPhysics || {}).ontologyLayers);
    if (layers.length) return layers.map(function (l) { return l.id || l.layer || l; });
    return [
      'demand','narrative_legitimacy','data_intelligence','governance','capital_allocation',
      'financial_structuring','platform_architecture','connectivity','compute_digital','energy',
      'industrial_production','construction','operator','resource','market_access'
    ];
  }

  function renderSummaryStrip() {
    try {
      var rows = state.filtered;
      var avg = rows.length ? (rows.reduce(function (s, r) { return s + num(r.ppi); }, 0) / rows.length).toFixed(1) : '0.0';
      var mandate = rows.filter(function (r) { return String(r.usgRelevance || '').indexOf('Mandate') >= 0; }).length;
      var movers = rows.filter(function (r) { return num(r.delta90d) > 0; }).length;
      var html = '' +
        '<div class="col-12 col-md-4"><div class="card metric-card"><div class="card-body py-2"><div class="metric-label">Mandate-Proximate sectors</div><div class="metric-value">'+esc(mandate)+'</div></div></div></div>' +
        '<div class="col-12 col-md-4"><div class="card metric-card"><div class="card-body py-2"><div class="metric-label">Average PPI</div><div class="metric-value">'+esc(avg)+'</div></div></div></div>' +
        '<div class="col-12 col-md-4"><div class="card metric-card"><div class="card-body py-2"><div class="metric-label">High momentum sectors</div><div class="metric-value">'+esc(movers)+'</div></div></div></div>';
      var target = byId('pp-summary');
      if (target) target.innerHTML = html;

      var top = rows.slice().sort(function (a,b) { return num(b.ppi)-num(a.ppi); })[0] || {};
      var usg = byId('pp-usg-window');
      if (usg) usg.innerHTML = '<div class="small text-muted">' + esc(top.recommended_motion || top.nextIntelligenceAction || 'monitor') + '</div>';
    } catch (e) {
      showError('summary strip failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function renderSignalMapCards() {
    try {
      var rows = state.filtered.slice().sort(function (a,b) { return num(b.ppi)-num(a.ppi); });
      var layers = getOntologyLayers();
      var cards = rows.slice(0, 12).map(function (r) {
        var phys = getPhysicsForRow(r) || {};
        var activeLayers = safeArray((((phys || {}).ontology || {}).activeLayers));
        var missingLayers = layers.filter(function (l) { return activeLayers.indexOf(l) < 0; });
        var progress = num((((phys || {}).ontology || {}).progression));
        if (!progress) progress = layers.length ? (activeLayers.length / layers.length) : 0;

        var stageCells = layers.map(function (layer, idx) {
          var active = activeLayers.indexOf(layer) >= 0;
          return '<button class="btn btn-sm ' + (active ? 'btn-primary' : 'btn-outline-secondary') + ' py-0 px-2 me-1 mb-1 pp-stage-cell" data-stage="'+esc(layer)+'" title="'+esc(layer)+'">' + (idx + 1) + '</button>';
        }).join('');

        var phaseMix = (phys || {}).phaseMix || {};
        var buyerMatches = safeArray((phys || {}).buyerAlignment).slice(0,3).map(function (b) { return String(b.buyer_id || '') + ' (' + String(b.signalCount || 0) + ')'; }).join(' • ') || String(r.likelyBuyerClass || '—');
        var constraints = safeArray(((r || {}).model_update || {}).constraints);
        var mainBlocker = String(r.mainStructuralBottleneck || constraints[0] || '—');
        var secondBlocker = String(constraints[1] || '—');
        var slowdown = constraints.join(' | ') || '—';

        return ''+
        '<details class="card mb-2">'+
          '<summary class="card-body" style="cursor:pointer;list-style:none">'+
            '<div class="d-flex justify-content-between align-items-start gap-2">'+
              '<div><strong>'+esc(r.sector || 'Unknown sector')+'</strong><div class="small text-muted">'+esc(r.region || '')+' · '+esc(phys.state || r.status || '')+'</div></div>'+
              '<div class="text-end"><div class="small text-muted">PPI / Opportunity Strength</div><div class="metric-value" style="font-size:1.1rem">'+esc(String(r.ppi || 0))+'</div></div>'+
            '</div>'+
            '<div class="mt-2">'+stageCells+'</div>'+
            '<div class="progress mt-2" style="height:8px"><div class="progress-bar" style="width:'+esc((progress*100).toFixed(0))+'%"></div></div>'+
            '<div class="small text-muted mt-1">Signal timing mix — Early: '+esc(fmtPct(phaseMix.early))+' · Mid: '+esc(fmtPct(phaseMix.mid))+' · Late: '+esc(fmtPct(phaseMix.late))+'</div>'+
          '</summary>'+
          '<div class="card-body pt-0">'+
            '<div class="small"><strong>Change Speed:</strong> '+esc(String((phys || {}).momentum || '—'))+' · <strong>Change Trend:</strong> '+esc(String((phys || {}).trajectory || r.velocityNote || '—'))+'</div>'+
            '<div class="small mt-1"><strong>Best buyer matches:</strong> '+esc(buyerMatches)+'</div>'+
            '<div class="small mt-1"><strong>Recommended USG move:</strong> '+esc(String((phys || {}).recommendedUSGMotion || r.recommended_motion || r.nextIntelligenceAction || 'monitor'))+'</div>'+
            '<div class="small mt-1"><strong>Confidence level:</strong> '+esc(String((phys || {}).recommendedUSGMotionConfidence || r.decision_confidence || 'medium'))+'</div>'+
            '<div class="small mt-1"><strong>Why this move:</strong> '+esc(String((phys || {}).recommendedUSGMotionRationale || r.whyItMatters || '—'))+'</div>'+
            '<div class="small mt-1"><strong>Main blocker:</strong> '+esc(mainBlocker)+'</div>'+
            '<div class="small mt-1"><strong>Second blocker:</strong> '+esc(secondBlocker)+'</div>'+
            '<div class="small mt-1"><strong>Missing key stages:</strong> '+esc(missingLayers.slice(0,6).join(', ') || 'None')+'</div>'+
            '<div class="small mt-1"><strong>What may slow this down:</strong> '+esc(slowdown)+'</div>'+
          '</div>'+
        '</details>';
      }).join('');

      setText('lem-generated-at', new Date().toISOString().slice(0,19).replace('T',' '));
      var panel = byId('lem-panel');
      if (panel) panel.innerHTML = cards || '<div class="text-muted">No initiative cards available.</div>';

      var legend = byId('lem-legend');
      if (legend) legend.innerHTML = layers.map(function (l, i) { return '<span class="badge text-bg-light border me-1 mb-1">' + (i+1) + '. ' + esc(l) + '</span>'; }).join('');

      var toggle = byId('lem-legend-toggle');
      if (toggle && !toggle.dataset.bound) {
        toggle.dataset.bound = '1';
        toggle.addEventListener('click', function(){
          var el = byId('lem-legend');
          if (!el) return;
          var hidden = el.classList.toggle('d-none');
          toggle.textContent = hidden ? 'Show Stage Legend' : 'Hide Stage Legend';
        });
      }

      var cells = document.querySelectorAll('.pp-stage-cell');
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].dataset.bound === '1') continue;
        cells[i].dataset.bound = '1';
        cells[i].addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var st = this.getAttribute('data-stage') || '';
          state.stageFilter = (state.stageFilter === st ? '' : st);
          applyFiltersAndRender();
        });
      }

      setText('pp-map-summary', 'Signals across lifecycle stages loaded for initiative diagnostics');
    } catch (e) {
      showError('Platform Signal Map failed: ' + (e && e.message ? e.message : String(e)));
      var panel = byId('lem-panel');
      if (panel) panel.innerHTML = '<div class="text-muted">Platform Signal Map unavailable. Other sections remain active.</div>';
    }
  }

  function renderLowerComparison() {
    try {
      var rows = state.filtered;
      var tbody = byId('pp-table');
      if (tbody) {
        tbody.innerHTML = rows.map(function (r) {
          return '<tr>'+
            '<td><strong>'+esc(r.sector || '')+'</strong><div class="small text-muted">'+esc(r.theater || '')+'</div></td>'+
            '<td>'+esc(r.region || '')+'</td>'+
            '<td><span class="pp-ppi">'+esc(String(r.ppi || 0))+'/25</span></td>'+
            '<td>'+esc(r.status || '')+'</td>'+
            '<td class="pp-hide-md">'+esc(r.buyerPath || '')+'</td>'+
            '<td class="pp-hide-md">'+esc(r.usgRelevance || '')+'</td>'+
            '<td>'+esc(String(r.delta90d || 0))+'</td>'+
            '<td>'+esc(r.likelyBuyerClass || '')+'</td>'+
            '<td class="pp-wide-col small text-muted">'+esc(r.recommended_motion || r.nextIntelligenceAction || 'monitor')+'</td>'+
            '<td class="pp-wide-col">'+esc(r.decision_confidence || 'medium')+'</td>'+
            '<td class="mono small">'+esc(r.lastUpdated || '')+'</td>'+
          '</tr>';
        }).join('') || '<tr><td colspan="11" class="text-muted">No sectors match filters.</td></tr>';
      }

      var classes = [];
      var topByBuyer = {};
      for (var i = 0; i < rows.length; i++) {
        var cls = String(rows[i].likelyBuyerClass || '').trim();
        if (cls && classes.indexOf(cls) < 0) classes.push(cls);
        if (cls && (!topByBuyer[cls] || num(rows[i].ppi) > num(topByBuyer[cls].ppi))) topByBuyer[cls] = rows[i];
      }
      setText('pp-heatmap', classes.length ? classes.join(' • ') : 'No buyer classes tagged');

      var topHtml = [];
      for (var k in topByBuyer) {
        if (!Object.prototype.hasOwnProperty.call(topByBuyer, k)) continue;
        topHtml.push('<div class="pp-heat-row"><strong>'+esc(k)+':</strong> '+esc(topByBuyer[k].sector)+' (PPI '+esc(topByBuyer[k].ppi)+')</div>');
      }
      setHtml('pp-top-by-buyer', topHtml.join('') || '<div class="text-muted">No buyer-class rows available.</div>');

      var watch = rows.filter(function (r) { return String(r.usgRelevance || '').indexOf('Mandate') >= 0; }).slice(0, 6).map(function (r) { return r.sector; });
      setText('pp-watchlist', watch.length ? watch.join(' • ') : 'No sectors in mandate window yet.');

      var constraints = [];
      for (var j = 0; j < rows.length; j++) {
        var b = String(rows[j].mainStructuralBottleneck || '').trim();
        if (b && constraints.indexOf(b) < 0) constraints.push(b);
        if (constraints.length >= 3) break;
      }
      setText('pp-constraints', constraints.length ? constraints.join(' | ') : 'Not specified');
    } catch (e) {
      showError('Lower comparison layer failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function initFilters() {
    try {
      var rows = state.rows;
      function uniq(mapFn) {
        var out = [];
        for (var i = 0; i < rows.length; i++) {
          var v = String(mapFn(rows[i]) || '').trim();
          if (v && out.indexOf(v) < 0) out.push(v);
        }
        out.sort();
        return out;
      }
      var sectors = uniq(function (r) { return r.sector; });
      var regions = uniq(function (r) { return r.region; });
      var buyers = uniq(function (r) { return r.likelyBuyerClass; });
      var fids = uniq(function (r) { return r.fidBoundaryType; });

      function fill(id, arr, head) {
        var el = byId(id); if (!el) return;
        el.innerHTML = '<option value="">'+head+'</option>' + arr.map(function (x) { return '<option>'+esc(x)+'</option>'; }).join('');
      }
      fill('f-sector', sectors, 'Sector (All)');
      fill('f-region', regions, 'Region (All)');
      fill('f-buyer', buyers, 'Buyer Class (All)');
      fill('f-fid', fids, 'FID Boundary (All)');

      ['f-sector','f-region','f-status','f-buyer','f-fid','f-min-ppi','f-search'].forEach(function (id) {
        var el = byId(id); if (!el) return;
        if (!el.dataset.bound) {
          el.dataset.bound = '1';
          el.addEventListener('input', applyFiltersAndRender);
          el.addEventListener('change', applyFiltersAndRender);
        }
      });

      var reset = byId('f-reset');
      if (reset && !reset.dataset.bound) {
        reset.dataset.bound = '1';
        reset.addEventListener('click', function () {
          ['f-sector','f-region','f-status','f-buyer','f-fid','f-search'].forEach(function (id) { var el=byId(id); if(el) el.value=''; });
          var min = byId('f-min-ppi'); if (min) min.value='0';
          state.stageFilter = '';
          applyFiltersAndRender();
        });
      }
    } catch (e) {
      showError('filter init failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function applyFiltersAndRender() {
    var sector = String((byId('f-sector') || {}).value || '');
    var region = String((byId('f-region') || {}).value || '');
    var status = String((byId('f-status') || {}).value || '');
    var buyer = String((byId('f-buyer') || {}).value || '');
    var fid = String((byId('f-fid') || {}).value || '');
    var minPpi = num((byId('f-min-ppi') || {}).value || 0);
    var q = String((byId('f-search') || {}).value || '').toLowerCase();

    state.filtered = state.rows.filter(function (r) {
      if (sector && String(r.sector || '') !== sector) return false;
      if (region && String(r.region || '') !== region) return false;
      if (status && String(r.status || '') !== status) return false;
      if (buyer && String(r.likelyBuyerClass || '') !== buyer) return false;
      if (fid && String(r.fidBoundaryType || '') !== fid) return false;
      if (num(r.ppi) < minPpi) return false;
      if (q) {
        var blob = [r.sector,r.region,r.status,r.buyerPath,r.usgRelevance,r.mainStructuralBottleneck,r.nextIntelligenceAction,r.recommended_motion,r.thesisSummary].join(' ').toLowerCase();
        if (blob.indexOf(q) < 0) return false;
      }
      if (state.stageFilter) {
        var phys = getPhysicsForRow(r) || {};
        var active = safeArray((((phys || {}).ontology || {}).activeLayers));
        if (active.indexOf(state.stageFilter) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      var av = num(a[state.sortBy]);
      var bv = num(b[state.sortBy]);
      var cmp;
      if (isNaN(av) || isNaN(bv)) cmp = String(a[state.sortBy] || '').localeCompare(String(b[state.sortBy] || ''));
      else cmp = av - bv;
      return state.sortDir === 'asc' ? cmp : -cmp;
    });

    setText('pp-active-filter', state.stageFilter ? ('Stage filter: ' + state.stageFilter) : '');

    renderSummaryStrip();
    renderSignalMapCards();
    renderLowerComparison();
  }

  function wireSort() {
    var buttons = document.querySelectorAll('button[data-sort]');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].dataset.bound) continue;
      buttons[i].dataset.bound = '1';
      buttons[i].addEventListener('click', function () {
        var k = this.getAttribute('data-sort') || 'ppi';
        if (state.sortBy === k) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else { state.sortBy = k; state.sortDir = 'desc'; }
        applyFiltersAndRender();
      });
    }
  }

  function refreshFromApi() {
    return fetch('/api/platform-pressure-data', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function (data) {
        var rows = safeArray((data || {}).rows);
        if (rows.length) state.rows = rows;
      });
  }

  function init() {
    parseBootstrap();
    initFilters();
    wireSort();
    applyFiltersAndRender();
    refreshFromApi().then(function () { applyFiltersAndRender(); }).catch(function (e) { showError('API refresh failed: ' + (e && e.message ? e.message : String(e))); });
  }

  window.addEventListener('error', function (e) { showError((e && e.message) || 'unknown'); });
  window.addEventListener('unhandledrejection', function (e) {
    var msg = (e && e.reason && (e.reason.message || e.reason)) || e.reason || 'unknown';
    showError(String(msg));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
