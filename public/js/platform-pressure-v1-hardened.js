(function () {
  function byId(id) { return document.getElementById(id); }
  function setHtml(id, html) { var el = byId(id); if (el) el.innerHTML = html; }
  function setText(id, text) { var el = byId(id); if (el) el.textContent = text; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>]/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[c]; }); }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }

  function showError(msg) {
    var box = byId('pp-failure') || byId('pp-error');
    if (!box) return;
    box.style.display = 'block';
    box.textContent = 'Platform Pressure UI error: ' + msg;
  }

  function summarize(rows) {
    var list = Array.isArray(rows) ? rows : [];
    var mandate = list.filter(function (r) { return String((r && r.usgRelevance) || '').indexOf('Mandate') >= 0; }).length;
    var avg = list.length ? (list.reduce(function (s, r) { return s + num(r && r.ppi); }, 0) / list.length).toFixed(1) : '0.0';
    var movers = list.filter(function (r) { return num(r && r.delta90d) > 0; }).length;
    setHtml('pp-summary',
      '<div class="col-12 col-md-4"><div class="card metric-card"><div class="card-body py-2"><div class="metric-label">Mandate-Proximate sectors</div><div class="metric-value">'+esc(mandate)+'</div></div></div></div>'+
      '<div class="col-12 col-md-4"><div class="card metric-card"><div class="card-body py-2"><div class="metric-label">Average PPI</div><div class="metric-value">'+esc(avg)+'</div></div></div></div>'+
      '<div class="col-12 col-md-4"><div class="card metric-card"><div class="card-body py-2"><div class="metric-label">High momentum sectors</div><div class="metric-value">'+esc(movers)+'</div></div></div></div>'
    );

    var classes = [];
    for (var i = 0; i < list.length; i++) {
      var c = String((list[i] && list[i].likelyBuyerClass) || '').trim();
      if (c && classes.indexOf(c) < 0) classes.push(c);
    }
    setText('pp-heatmap', classes.length ? classes.join(' • ') : 'No buyer classes tagged');

    var watch = list.filter(function (r) { return String((r && r.usgRelevance) || '').indexOf('Mandate') >= 0; }).slice(0, 6);
    setText('pp-watchlist', watch.length ? watch.map(function (r) { return r.sector; }).join(' • ') : 'No sectors in mandate window yet.');

    var constraints = [];
    for (var j = 0; j < list.length; j++) {
      var b = String((list[j] && list[j].mainStructuralBottleneck) || '').trim();
      if (b && constraints.indexOf(b) < 0) constraints.push(b);
      if (constraints.length >= 3) break;
    }
    setText('pp-constraints', constraints.length ? constraints.join(' | ') : 'Not specified');

    setText('pp-map-summary', 'Model data loaded: ' + list.length + ' sectors tracked');

    setHtml('pp-usg-window', '<div class="small text-muted">Data refreshed from API. Use this as decision-and-motion view.</div>');

    var topByBuyer = {};
    for (var k = 0; k < list.length; k++) {
      var r = list[k] || {};
      var cls = String(r.likelyBuyerClass || 'Unspecified');
      if (!topByBuyer[cls] || num(r.ppi) > num(topByBuyer[cls].ppi)) topByBuyer[cls] = r;
    }
    var lines = [];
    for (var key in topByBuyer) {
      if (!Object.prototype.hasOwnProperty.call(topByBuyer, key)) continue;
      var t = topByBuyer[key];
      lines.push('<div class="pp-heat-row"><strong>'+esc(key)+':</strong> '+esc(t.sector||'—')+' (PPI '+esc(t.ppi||0)+')</div>');
    }
    setHtml('pp-top-by-buyer', lines.join('') || '<div class="text-muted">No buyer-class rows available.</div>');
  }

  function fetchData() {
    return fetch('/api/platform-pressure-data', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function start() {
    fetchData().then(function (data) {
      summarize((data && data.rows) || []);
    }).catch(function (err) {
      showError(err && err.message ? err.message : String(err));
    });
  }

  window.addEventListener('error', function (e) { showError(e && e.message ? e.message : 'unknown'); });
  window.addEventListener('unhandledrejection', function (e) {
    var msg = (e && e.reason && (e.reason.message || e.reason)) || e.reason || 'unknown';
    showError(String(msg));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
