(async function initCapitalMap() {
  const container = document.getElementById('capital-map');
  const detailsEl = document.getElementById('node-details');
  if (!container) return;

  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  function sizeContainer() {
    const topOffset = isMobile ? 140 : 190;
    const h = Math.max(isMobile ? 420 : 520, window.innerHeight - topOffset);
    container.style.height = `${h}px`;
  }
  sizeContainer();

  async function ensureCytoscape() {
    if (window.cytoscape) return true;
    const candidates = [
      '/dashboard/vendor/cytoscape.min.js',
      'https://unpkg.com/cytoscape@3.30.2/dist/cytoscape.min.js'
    ];
    for (const src of candidates) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = src;
          s.async = true;
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
        if (window.cytoscape) return true;
      } catch (_) {}
    }
    return !!window.cytoscape;
  }

  const cytoscapeReady = await ensureCytoscape();
  if (!cytoscapeReady) {
    if (detailsEl) detailsEl.innerHTML = '<span class="text-danger">Cytoscape failed to load.</span>';
    return;
  }

  let data = { nodes: [], edges: [] };
  const dataEndpoints = ['/dashboard/api/capital-map', '/api/capital-map'];
  for (const ep of dataEndpoints) {
    try {
      const response = await fetch(ep, { credentials: 'same-origin' });
      if (response.ok) {
        data = await response.json();
        break;
      }
    } catch (_) {}
  }

  const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const nodeIdSet = new Set(rawNodes.map((n) => n.id));
  const rawEdges = (Array.isArray(data.edges) ? data.edges : []).filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target));

  const nodeSize = isMobile ? 66 : 52;
  const labelSize = isMobile ? 16 : 14;
  const pressureY = {
    monetary_pressure: 100,
    balance_sheet_pressure: 300,
    trust_access_pressure: 500,
    mandate_pressure: 700,
    bankability_pressure: 900
  };

  const pressureFixedLabels = {
    monetary_pressure: 'Monetary Pressure\n(Central Banks)',
    balance_sheet_pressure: 'Balance Sheet Pressure\n(Global Banks)',
    trust_access_pressure: 'Trust & Access Pressure\n(Settlement Networks)',
    mandate_pressure: 'Mandate Pressure\n(Institutions)',
    bankability_pressure: 'Bankability Pressure\n(Assets / Projects)'
  };

  const buyerY = pressureY.mandate_pressure;
  const signalY = buyerY - 200;
  const initiativeY = buyerY + 200;

  const typedNodes = {
    signal: rawNodes.filter((n) => n.type === 'signal'),
    buyer: rawNodes.filter((n) => n.type === 'buyer'),
    initiative: rawNodes.filter((n) => n.type === 'initiative')
  };

  function spreadX(arr, start = 360, targetSpan = 1400) {
    const out = new Map();
    const n = arr.length;
    if (!n) return out;
    if (n === 1) {
      out.set(arr[0].id, start + 320);
      return out;
    }
    const step = Math.max(70, Math.min(130, Math.floor(targetSpan / (n - 1))));
    arr.forEach((node, i) => out.set(node.id, start + i * step));
    return out;
  }

  const signalX = spreadX(typedNodes.signal, 360, 1300);
  const buyerX = spreadX(typedNodes.buyer, 360, 1400);
  const initiativeX = spreadX(typedNodes.initiative, 360, 1500);

  function nodePosition(node) {
    const id = node.id;
    const type = node.type;

    if (pressureY[id] != null) {
      return { x: 180, y: pressureY[id] };
    }
    if (type === 'signal') {
      return { x: signalX.get(id) || 300, y: signalY };
    }
    if (type === 'buyer') {
      return { x: buyerX.get(id) || 300, y: buyerY };
    }
    if (type === 'initiative') {
      return { x: initiativeX.get(id) || 300, y: initiativeY };
    }
    return { x: 520, y: 520 };
  }

  const elements = [
    ...rawNodes.map((n) => ({
      data: {
        ...n,
        display_label: pressureFixedLabels[n.id] || n.label || n.id
      },
      position: nodePosition(n),
      locked: n.type === 'pressure_layer'
    })),
    ...rawEdges.map((e) => ({ data: e }))
  ];

  if (detailsEl) {
    detailsEl.innerHTML = `<span class="text-muted">Loaded ${rawNodes.length} nodes / ${rawEdges.length} edges.</span>`;
  }

  if (!elements.length && detailsEl) {
    detailsEl.innerHTML = '<span class="text-warning">No capital-map data loaded.</span>';
  }

  let cy;
  try {
    cy = window.cytoscape({
    container,
    elements,
    layout: {
      name: 'preset'
    },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    minZoom: isMobile ? 0.15 : 0.2,
    maxZoom: isMobile ? 2.2 : 2.6,
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(display_label)',
          'font-size': labelSize,
          'min-zoomed-font-size': isMobile ? 12 : 11,
          'font-weight': 700,
          'color': '#f8fafc',
          'text-wrap': 'wrap',
          'text-max-width': isMobile ? 210 : 180,
          'text-valign': 'top',
          'text-halign': 'center',
          'text-margin-y': -14,
          'text-outline-width': 3,
          'text-outline-color': '#0b1220',
          'text-background-color': '#0b1220',
          'text-background-opacity': 0.78,
          'text-background-shape': 'roundrectangle',
          'text-background-padding': isMobile ? 5 : 3,
          'background-color': '#4f8cff',
          'border-width': 2,
          'border-color': '#cbd5e1',
          'width': nodeSize,
          'height': nodeSize,
          'transition-property': 'opacity, border-width, border-color, width',
          'transition-duration': '240ms'
        }
      },
      {
        selector: 'node[type = "pressure_layer"]',
        style: {
          'shape': 'rectangle',
          'background-color': '#ff8c42',
          'font-weight': 800,
          'font-size': 15
        }
      },
      {
        selector: 'node[type = "signal"]',
        style: {
          'shape': 'diamond',
          'background-color': '#facc15'
        }
      },
      {
        selector: 'node[type = "buyer"]',
        style: {
          'shape': 'ellipse',
          'background-color': '#3b82f6'
        }
      },
      {
        selector: 'node[type = "initiative"]',
        style: {
          'shape': 'hexagon',
          'background-color': '#22c55e'
        }
      },
      {
        selector: 'node[type = "constraint"]',
        style: {
          'shape': 'triangle',
          'background-color': '#ef4444'
        }
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'line-color': '#74829a',
          'target-arrow-color': '#74829a',
          'width': 'mapData(weight, 1, 5, 2, 10)',
          'transition-property': 'opacity, width',
          'transition-duration': '240ms'
        }
      },
      {
        selector: 'edge[type = "pressure_flow"]',
        style: {
          'line-color': '#ff8c42',
          'target-arrow-color': '#ff8c42',
          'width': 'mapData(weight, 1, 5, 4, 14)'
        }
      },
      {
        selector: 'edge[type = "funds"]',
        style: {
          'line-color': '#22c55e',
          'target-arrow-color': '#22c55e'
        }
      },
      {
        selector: 'edge[type = "influences"]',
        style: {
          'line-color': '#facc15',
          'target-arrow-color': '#facc15',
          'line-style': 'dashed'
        }
      },
      {
        selector: 'edge[type = "depends_on"]',
        style: {
          'line-color': '#3b82f6',
          'target-arrow-color': '#3b82f6',
          'line-style': 'dashed'
        }
      },
      {
        selector: 'edge[type = "blocks"]',
        style: {
          'line-color': '#ef4444',
          'target-arrow-color': '#ef4444'
        }
      },
      {
        selector: '.dimmed',
        style: {
          'opacity': 0.2
        }
      },
      {
        selector: '.filtered-out',
        style: {
          'display': 'none'
        }
      },
      {
        selector: '.focus-node',
        style: {
          'border-width': 3,
          'border-color': '#f8fafc'
        }
      },
      {
        selector: '.focus-edge',
        style: {
          'width': 4,
          'opacity': 1
        }
      }
    ]
    });
  } catch (err) {
    if (detailsEl) {
      detailsEl.innerHTML = `<span class="text-danger">Map render error: ${String(err && err.message ? err.message : err)}</span>`;
    }
    return;
  }

  function clampPan() {
    const eles = cy.elements(':visible');
    if (!eles.length) return;
    const bb = eles.boundingBox();
    const z = cy.zoom();
    const w = cy.width();
    const h = cy.height();
    const pad = isMobile ? 36 : 60;

    let minX = w - (bb.x2 * z + pad);
    let maxX = -bb.x1 * z + pad;
    let minY = h - (bb.y2 * z + pad);
    let maxY = -bb.y1 * z + pad;

    // If content is smaller than viewport in either axis, center it instead of snapping to an edge.
    if (minX > maxX) {
      const cx = (minX + maxX) / 2;
      minX = cx;
      maxX = cx;
    }
    if (minY > maxY) {
      const cyMid = (minY + maxY) / 2;
      minY = cyMid;
      maxY = cyMid;
    }

    const pan = cy.pan();
    const nx = Math.min(maxX, Math.max(minX, pan.x));
    const ny = Math.min(maxY, Math.max(minY, pan.y));
    if (nx !== pan.x || ny !== pan.y) cy.pan({ x: nx, y: ny });
  }

  cy.on('pan zoom', clampPan);
  window.addEventListener('resize', () => {
    sizeContainer();
    cy.resize();
    clampPan();
  });

  const filterBuyerEl = document.getElementById('filter-buyer');
  const filterSignalEl = document.getElementById('filter-signal');
  const filterInitiativeEl = document.getElementById('filter-initiative');
  const filterPressureEl = document.getElementById('filter-pressure');
  let focusMode = 'buyer';
  document.querySelectorAll('input[name="focus-mode"]').forEach((el) => {
    el.addEventListener('change', () => {
      if (el.checked) {
        focusMode = el.value;
        const current = cy.nodes('.focus-node');
        if (current.length) {
          focusNode(current[0], false);
        }
      }
    });
  });

  function addOptions(selectEl, nodes) {
    if (!selectEl) return;
    const sorted = [...nodes].sort((a, b) => String(a.data('label') || a.id()).localeCompare(String(b.data('label') || b.id())));
    for (const n of sorted) {
      const opt = document.createElement('option');
      opt.value = n.id();
      opt.textContent = n.data('label') || n.id();
      selectEl.appendChild(opt);
    }
  }

  addOptions(filterBuyerEl, cy.nodes('[type = "buyer"]'));
  addOptions(filterSignalEl, cy.nodes('[type = "signal"]'));
  addOptions(filterInitiativeEl, cy.nodes('[type = "initiative"]'));
  addOptions(filterPressureEl, cy.nodes('[type = "pressure_layer"]'));

  function uniqLabels(collection, type) {
    const set = new Set(
      collection
        .filter((n) => n.data('type') === type)
        .map((n) => n.data('label') || n.id())
    );
    return [...set];
  }

  function pickPressureLayer(focusNode, connectedNodes) {
    if (focusNode.data('type') === 'pressure_layer') {
      return focusNode.data('label') || focusNode.id();
    }
    const p = connectedNodes.find((n) => n.data('type') === 'pressure_layer');
    return p ? (p.data('label') || p.id()) : '—';
  }

  function nodeFacts(node) {
    const connectedNodes = node.closedNeighborhood('node').toArray();
    return {
      name: node.data('label') || node.id(),
      type: node.data('type') || '—',
      pressureLayer: pickPressureLayer(node, connectedNodes),
      buyers: uniqLabels(connectedNodes, 'buyer'),
      signals: uniqLabels(connectedNodes, 'signal'),
      initiatives: uniqLabels(connectedNodes, 'initiative')
    };
  }

  function renderDetails(node) {
    if (!detailsEl) return;
    if (!node) {
      detailsEl.innerHTML = 'Select a node to inspect.';
      return;
    }

    const f = nodeFacts(node);

    detailsEl.innerHTML = `
      <div class="mb-2"><strong>Name</strong><div>${f.name}</div></div>
      <div class="mb-2"><strong>Type</strong><div>${f.type}</div></div>
      <div class="mb-2"><strong>Pressure Layer</strong><div>${f.pressureLayer}</div></div>
      <div class="mb-2"><strong>Connected Buyers</strong><div>${f.buyers.length ? f.buyers.join(', ') : '—'}</div></div>
      <div class="mb-2"><strong>Connected Signals</strong><div>${f.signals.length ? f.signals.join(', ') : '—'}</div></div>
      <div class="mb-0"><strong>Connected Initiatives</strong><div>${f.initiatives.length ? f.initiatives.join(', ') : '—'}</div></div>
    `;
  }

  function clearFocus() {
    cy.elements().removeClass('dimmed focus-node focus-edge');
  }

  function applyFilters() {
    const selectedIds = [
      filterBuyerEl?.value,
      filterSignalEl?.value,
      filterInitiativeEl?.value,
      filterPressureEl?.value
    ].filter(Boolean);

    cy.elements().removeClass('filtered-out');

    if (!selectedIds.length) return;

    let keep = cy.collection();
    for (const id of selectedIds) {
      const n = cy.getElementById(id);
      if (n && n.length) {
        keep = keep.union(traceCapitalPath(n));
      }
    }

    cy.elements().difference(keep).addClass('filtered-out');
  }

  function traceCapitalPath(node) {
    const allowedNodeTypes = new Set(['pressure_layer', 'signal', 'buyer', 'initiative']);
    const allowedEdgeTypes = new Set(['pressure_flow', 'influences', 'funds', 'depends_on']);

    const walk = (start, dir) => {
      const visitedNodes = new Set([start.id()]);
      const visitedEdges = new Set();
      const queue = [start];

      while (queue.length) {
        const cur = queue.shift();
        const edgeSet = dir === 'up' ? cur.incomers('edge') : cur.outgoers('edge');

        edgeSet.forEach((e) => {
          if (!allowedEdgeTypes.has(e.data('type'))) return;
          const next = dir === 'up' ? e.source() : e.target();
          if (!allowedNodeTypes.has(next.data('type'))) return;
          visitedEdges.add(e.id());
          if (!visitedNodes.has(next.id())) {
            visitedNodes.add(next.id());
            queue.push(next);
          }
        });
      }

      return {
        nodes: cy.collection(Array.from(visitedNodes).map((id) => cy.getElementById(id))),
        edges: cy.collection(Array.from(visitedEdges).map((id) => cy.getElementById(id)))
      };
    };

    const up = walk(node, 'up');
    const down = walk(node, 'down');

    // Focus modes bias what side gets emphasized but still keep full path visibility
    if (focusMode === 'buyer') {
      return up.nodes.union(up.edges).union(down.nodes).union(down.edges);
    }
    if (focusMode === 'initiative') {
      return up.nodes.union(up.edges).union(node).union(down.edges).union(down.nodes);
    }
    // Signal mode
    return up.nodes.union(up.edges).union(down.nodes).union(down.edges);
  }

  function focusNode(node, center = false) {
    if (!node || node.empty()) return;
    clearFocus();
    cy.elements().addClass('dimmed');

    const traced = traceCapitalPath(node);
    traced.removeClass('dimmed');

    node.addClass('focus-node');
    traced.filter('edge').addClass('focus-edge');

    cy.animate({
      fit: { eles: traced, padding: center ? 80 : 60 },
      duration: center ? 320 : 220,
      easing: 'ease-in-out'
    });

    renderDetails(node);
  }

  function norm(v) {
    return String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }

  function nodeFromQuery() {
    const q = new URLSearchParams(window.location.search);
    const buyer = q.get('buyer');
    const initiative = q.get('initiative');
    const signal = q.get('signal');

    const tryIds = [];
    if (buyer) {
      tryIds.push(buyer, `buyer_${norm(buyer)}`);
    }
    if (initiative) {
      tryIds.push(initiative, `initiative_${norm(initiative)}`);
    }
    if (signal) {
      tryIds.push(signal, `signal_${norm(signal)}`);
    }

    for (const id of tryIds) {
      const n = cy.getElementById(id);
      if (n && n.length) return n;
    }
    return null;
  }

  async function highestRankedBuyerNode() {
    const endpoints = ['/dashboard/data/buyers.json', '/data/buyers.json'];
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep, { credentials: 'same-origin' });
        if (!r.ok) continue;
        const buyers = await r.json();
        if (!Array.isArray(buyers) || !buyers.length) continue;
        const sorted = [...buyers].sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0));
        const top = sorted[0];
        if (!top) continue;

        const tryIds = [
          String(top.buyer_id || ''),
          `buyer_${norm(top.buyer_id || '')}`,
          `buyer_${norm(top.name || '')}`
        ].filter(Boolean);

        for (const id of tryIds) {
          const n = cy.getElementById(id);
          if (n && n.length) return n;
        }
      } catch (_) {}
    }
    return null;
  }

  function anchorBuyerNeighborhood(node) {
    if (!node || node.empty()) return;
    cy.elements().removeClass('filtered-out');

    let keep = cy.collection().union(node);
    const adjacentEdges = node.connectedEdges();
    adjacentEdges.forEach((e) => {
      const src = e.source();
      const tgt = e.target();
      const other = src.id() === node.id() ? tgt : src;
      const t = other.data('type');
      if (t === 'signal' || t === 'initiative') {
        keep = keep.union(other).union(e);
      }
    });

    cy.elements().difference(keep).addClass('filtered-out');

    if (filterBuyerEl) filterBuyerEl.value = node.id();
    if (filterSignalEl) filterSignalEl.value = '';
    if (filterInitiativeEl) filterInitiativeEl.value = '';
    if (filterPressureEl) filterPressureEl.value = '';

    focusNode(node, true);

    if (detailsEl) {
      const visibleNodes = cy.nodes(':visible').length;
      const visibleEdges = cy.edges(':visible').length;
      const label = String(node.data('label') || node.id());
      detailsEl.innerHTML = `<span class="text-muted">Default anchor: ${label}. Showing ${visibleNodes} nodes / ${visibleEdges} edges in buyer neighborhood.</span>`;
    }
  }

  const tip = document.createElement('div');
  tip.style.position = 'fixed';
  tip.style.zIndex = '9999';
  tip.style.maxWidth = '320px';
  tip.style.pointerEvents = 'none';
  tip.style.padding = '8px 10px';
  tip.style.borderRadius = '8px';
  tip.style.border = '1px solid rgba(255,255,255,.16)';
  tip.style.background = 'rgba(9,14,24,.95)';
  tip.style.color = '#e8ecf3';
  tip.style.fontSize = '12px';
  tip.style.lineHeight = '1.35';
  tip.style.boxShadow = '0 8px 24px rgba(0,0,0,.35)';
  tip.style.display = 'none';
  document.body.appendChild(tip);

  function moveTip(e) {
    tip.style.left = `${e.renderedPosition.x + 18}px`;
    tip.style.top = `${e.renderedPosition.y + 18}px`;
  }

  cy.on('mouseover', 'node', (evt) => {
    const f = nodeFacts(evt.target);
    tip.innerHTML = `
      <div><strong>Name:</strong> ${f.name}</div>
      <div><strong>Type:</strong> ${f.type}</div>
      <div><strong>Pressure Layer:</strong> ${f.pressureLayer}</div>
      <div><strong>Connected Buyers:</strong> ${f.buyers.length ? f.buyers.join(', ') : '—'}</div>
      <div><strong>Connected Signals:</strong> ${f.signals.length ? f.signals.join(', ') : '—'}</div>
      <div><strong>Connected Initiatives:</strong> ${f.initiatives.length ? f.initiatives.join(', ') : '—'}</div>
    `;
    moveTip(evt);
    tip.style.display = 'block';
  });

  cy.on('mousemove', 'node', moveTip);
  cy.on('mouseout', 'node', () => { tip.style.display = 'none'; });

  cy.on('tap', 'node', (evt) => {
    focusNode(evt.target);
  });

  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      clearFocus();
      renderDetails(null);
      tip.style.display = 'none';
    }
  });

  const resetBtn = document.getElementById('reset-map');
  const centerBtn = document.getElementById('center-graph');
  const highlightBtn = document.getElementById('highlight-path');
  const toggleLabelsBtn = document.getElementById('toggle-labels');
  let labelsOn = true;

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (filterBuyerEl) filterBuyerEl.value = '';
      if (filterSignalEl) filterSignalEl.value = '';
      if (filterInitiativeEl) filterInitiativeEl.value = '';
      if (filterPressureEl) filterPressureEl.value = '';
      applyFilters();
      clearFocus();
      renderDetails(null);
      cy.animate({ fit: { eles: cy.elements(':visible'), padding: 40 }, duration: 260 });
    });
  }

  centerBtn?.addEventListener('click', () => {
    cy.animate({ fit: { eles: cy.elements(':visible'), padding: 50 }, duration: 260, easing: 'ease-in-out' });
  });

  function animateCapitalPath(node) {
    const tracedEdges = traceCapitalPath(node).filter('edge');
    if (!tracedEdges.length) return;

    const stage1 = tracedEdges.filter((e) => e.source().data('type') === 'pressure_layer' && e.target().data('type') === 'buyer');
    const stage2 = tracedEdges.filter((e) => {
      const a = e.source().data('type');
      const b = e.target().data('type');
      return (a === 'buyer' && b === 'signal') || (a === 'signal' && b === 'buyer');
    });
    const fallback = tracedEdges.filter((e) => !stage1.contains(e) && !stage2.contains(e));

    tracedEdges.style('opacity', 0.2);

    const animateSet = (set, done) => {
      if (!set.length) return done();
      set.animate({ style: { opacity: 1 }, duration: 800, easing: 'ease-in-out' });
      setTimeout(done, 820);
    };

    animateSet(stage1, () => {
      animateSet(stage2, () => {
        if (fallback.length) {
          fallback.animate({ style: { opacity: 1 }, duration: 800, easing: 'ease-in-out' });
        }
      });
    });
  }

  highlightBtn?.addEventListener('click', () => {
    const focus = cy.nodes('.focus-node');
    if (focus.length) {
      focusNode(focus[0], false);
      animateCapitalPath(focus[0]);
      return;
    }
    if (detailsEl) {
      detailsEl.innerHTML = '<span class="text-warning">Select a node first to highlight its capital path.</span>';
    }
  });

  toggleLabelsBtn?.addEventListener('click', () => {
    labelsOn = !labelsOn;
    cy.style()
      .selector('node')
      .style('label', labelsOn ? 'data(display_label)' : '')
      .update();
  });

  [filterBuyerEl, filterSignalEl, filterInitiativeEl, filterPressureEl].forEach((el) => {
    el?.addEventListener('change', () => {
      applyFilters();
      clearFocus();
      renderDetails(null);
      cy.animate({ fit: { eles: cy.elements(':visible'), padding: 40 }, duration: 220 });
    });
  });

  (async () => {
    const seedNode = nodeFromQuery();
    if (seedNode) {
      focusNode(seedNode, true);
      return;
    }

    const topBuyer = await highestRankedBuyerNode();
    if (topBuyer) {
      anchorBuyerNeighborhood(topBuyer);
      return;
    }

    cy.animate({ fit: { eles: cy.elements(':visible'), padding: isMobile ? 30 : 44 }, duration: 220, easing: 'ease-in-out' });
  })();
})();
