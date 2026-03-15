(function () {
  function byId(id) { return document.getElementById(id); }
  function setText(id, text) { var el = byId(id); if (el) el.textContent = text; }
  function showError(msg) {
    var box = byId('pp-error');
    if (!box) return;
    box.style.display = 'block';
    box.textContent = 'Platform Pressure UI error: ' + msg;
  }

  function safeNum(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function renderFromRows(rows) {
    var list = Array.isArray(rows) ? rows : [];
    var mandate = list.filter(function (r) { return String((r && r.usgRelevance) || '').indexOf('Mandate') >= 0; }).length;
    var avg = list.length ? (list.reduce(function (s, r) { return s + safeNum(r && r.ppi); }, 0) / list.length).toFixed(1) : '0.0';
    var highDelta = list.filter(function (r) { return safeNum(r && r.delta90d) > 0; }).length;
    var metricsEl = byId('pp-metrics');
    if (metricsEl) {
      metricsEl.innerHTML = '' +
        '<li>Mandate Window count: <strong>' + mandate + '</strong></li>' +
        '<li>High momentum sectors (90D Δ > 0): <strong>' + highDelta + '</strong></li>' +
        '<li>Average PPI: <strong>' + avg + '</strong></li>';
    }

    var constraints = [];
    for (var i = 0; i < list.length; i++) {
      var c = (list[i] && list[i].mainStructuralBottleneck) || '';
      if (c && constraints.indexOf(c) < 0) constraints.push(c);
      if (constraints.length >= 3) break;
    }
    setText('pp-constraints', constraints.length ? constraints.join(' | ') : 'Not specified');

    var classes = [];
    for (var j = 0; j < list.length; j++) {
      var bc = String((list[j] && list[j].likelyBuyerClass) || '').trim();
      if (bc && classes.indexOf(bc) < 0) classes.push(bc);
    }
    setText('pp-heatmap', classes.length ? classes.join(' • ') : 'No buyer classes tagged');

    setText('pp-map-summary', 'Model data loaded: ' + list.length + ' sectors tracked');
  }

  function fetchData() {
    return fetch('/api/platform-pressure-data', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function start() {
    try {
      fetchData().then(function (data) {
        var rows = (data && data.rows) || [];
        renderFromRows(rows);
      }).catch(function (err) {
        showError(err && err.message ? err.message : String(err));
      });
    } catch (e) {
      showError(e && e.message ? e.message : String(e));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
