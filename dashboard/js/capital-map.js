(async function initCapitalMap() {
  const container = document.getElementById('capital-map');
  const detailsEl = document.getElementById('node-details');
  if (!container) return;

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
  const dataEndpoints = ['/api/capital-map', '/dashboard/api/capital-map'];
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

  const pressureY = {
    monetary_pressure: 100,
    balance_sheet_pressure: 300,
    trust_access_pressure: 500,
    mandate_pressure: 700,
    bankability_pressure: 900
  };

  const mandateY = pressureY.mandate_pressure;
  const bankabilityY = pressureY.bankability_pressure;
  const signalY = mandateY - 140;

  const typedNodes = {
    signal: rawNodes.filter((n) => n.type === 'signal'),
    buyer: rawNodes.filter((n) => n.type === 'buyer'),
    initiative: rawNodes.filter((n) => n.type === 'initiative')
  };

  function spreadX(arr, start = 220, step = 200) {
    const out = new Map();
    arr.forEach((n, i) => out.set(n.id, start + i * step));
    return out;
  }

  const signalX = spreadX(typedNodes.signal);
  const buyerX = spreadX(typedNodes.buyer);
  const initiativeX = spreadX(typedNodes.initiative);

  function nodePosition(node) {
    const id = node.id;
    const type = node.type;

    if (pressureY[id] != null) {
      return { x: 90, y: pressureY[id] };
    }
    if (type === 'signal') {
      return { x: signalX.get(id) || 300, y: signalY };
    }
    if (type === 'buyer') {
      return { x: buyerX.get(id) || 300, y: mandateY };
    }
    if (type === 'initiative') {
      return { x: initiativeX.get(id) || 300, y: bankabilityY };
    }
    return { x: 520, y: 520 };
  }

  const elements = [
    ...rawNodes.map((n) => ({
      data: n,
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
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'font-size': 14,
          'min-zoomed-font-size': 11,
          'font-weight': 700,
          'color': '#f8fafc',
          'text-wrap': 'wrap',
          'text-max-width': 180,
          'text-valign': 'top',
          'text-halign': 'center',
          'text-margin-y': -14,
          'text-outline-width': 3,
          'text-outline-color': '#0b1220',
          'text-background-color': '#0b1220',
          'text-background-opacity': 0.78,
          'text-background-shape': 'roundrectangle',
          'text-background-padding': 3,
          'background-color': '#4f8cff',
          'border-width': 2,
          'border-color': '#cbd5e1',
          'width': 52,
          'height': 52,
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
          'target-arrow-color': '#ff8c42'
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
          'target-arrow-color': '#facc15'
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

  function renderDetails(node) {
    if (!detailsEl) return;
    if (!node) {
      detailsEl.innerHTML = 'Select a node to inspect.';
      return;
    }

    const connectedNodes = node.closedNeighborhood('node').toArray();
    const buyers = uniqLabels(connectedNodes, 'buyer');
    const signals = uniqLabels(connectedNodes, 'signal');
    const initiatives = uniqLabels(connectedNodes, 'initiative');
    const pressureLayer = pickPressureLayer(node, connectedNodes);

    detailsEl.innerHTML = `
      <div class="mb-2"><strong>Name</strong><div>${node.data('label') || node.id()}</div></div>
      <div class="mb-2"><strong>Type</strong><div>${node.data('type') || '—'}</div></div>
      <div class="mb-2"><strong>Pressure Layer</strong><div>${pressureLayer}</div></div>
      <div class="mb-2"><strong>Connected Buyers</strong><div>${buyers.length ? buyers.join(', ') : '—'}</div></div>
      <div class="mb-2"><strong>Connected Signals</strong><div>${signals.length ? signals.join(', ') : '—'}</div></div>
      <div class="mb-0"><strong>Connected Initiatives</strong><div>${initiatives.length ? initiatives.join(', ') : '—'}</div></div>
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

  cy.on('tap', 'node', (evt) => {
    focusNode(evt.target);
  });

  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      clearFocus();
      renderDetails(null);
    }
  });

  const resetBtn = document.getElementById('reset-map');
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

  [filterBuyerEl, filterSignalEl, filterInitiativeEl, filterPressureEl].forEach((el) => {
    el?.addEventListener('change', () => {
      applyFilters();
      clearFocus();
      renderDetails(null);
      cy.animate({ fit: { eles: cy.elements(':visible'), padding: 40 }, duration: 220 });
    });
  });

  const seedNode = nodeFromQuery();
  if (seedNode) {
    focusNode(seedNode, true);
  }
})();
