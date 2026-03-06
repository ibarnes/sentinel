(async function initCapitalMap() {
  const container = document.getElementById('capital-map');
  const detailsEl = document.getElementById('node-details');
  if (!container || !window.cytoscape) return;

  const response = await fetch('/api/capital-map', { credentials: 'same-origin' });
  const data = response.ok ? await response.json() : { nodes: [], edges: [] };

  const elements = [
    ...(Array.isArray(data.nodes) ? data.nodes : []).map((n) => ({ data: n })),
    ...(Array.isArray(data.edges) ? data.edges : []).map((e) => ({ data: e }))
  ];

  const cy = window.cytoscape({
    container,
    elements,
    layout: {
      name: 'breadthfirst',
      directed: true,
      spacingFactor: 1.2,
      padding: 24
    },
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'font-size': 11,
          'color': '#e8ecf3',
          'text-wrap': 'wrap',
          'text-max-width': 120,
          'background-color': '#4f8cff',
          'border-width': 1,
          'border-color': '#233247',
          'width': 40,
          'height': 40
        }
      },
      {
        selector: 'node[type = "pressure_layer"]',
        style: {
          'shape': 'rectangle',
          'background-color': '#ff8c42'
        }
      },
      {
        selector: 'node[type = "buyer"]',
        style: {
          'background-color': '#3b82f6'
        }
      },
      {
        selector: 'node[type = "signal"]',
        style: {
          'background-color': '#facc15',
          'color': '#1f2937'
        }
      },
      {
        selector: 'node[type = "initiative"]',
        style: {
          'background-color': '#22c55e'
        }
      },
      {
        selector: 'node[type = "constraint"]',
        style: {
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
          'width': 'mapData(weight, 1, 5, 2, 10)'
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
          'opacity': 0.15
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

  const filterBuyerEl = document.getElementById('filter-buyer');
  const filterSignalEl = document.getElementById('filter-signal');
  const filterInitiativeEl = document.getElementById('filter-initiative');
  const filterPressureEl = document.getElementById('filter-pressure');

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
    const t = node.data('type');
    const path = cy.collection().union(node);

    const buyersFrom = (src) => src.outgoers('edge').filter((e) => {
      const ty = e.data('type');
      return ty === 'influences' || ty === 'pressure_flow' || ty === 'depends_on';
    }).targets().filter((n) => n.data('type') === 'buyer');

    const initiativesFromBuyers = (buyers) => buyers.outgoers('edge').filter((e) => e.data('type') === 'funds').targets().filter((n) => n.data('type') === 'initiative');

    if (t === 'signal' || t === 'pressure_layer') {
      const buyers = buyersFrom(node);
      const buyerEdges = node.outgoers('edge').filter((e) => buyers.contains(e.target()));
      const initiatives = initiativesFromBuyers(buyers);
      const fundEdges = buyers.outgoers('edge').filter((e) => initiatives.contains(e.target()));
      return path.union(buyers).union(buyerEdges).union(initiatives).union(fundEdges);
    }

    if (t === 'buyer') {
      const inbound = node.incomers('edge').filter((e) => {
        const srcType = e.source().data('type');
        return srcType === 'signal' || srcType === 'pressure_layer';
      });
      const sources = inbound.sources();
      const out = node.outgoers('edge').filter((e) => e.data('type') === 'funds');
      const initiatives = out.targets().filter((n) => n.data('type') === 'initiative');
      return path.union(inbound).union(sources).union(out).union(initiatives);
    }

    if (t === 'initiative') {
      const buyerEdges = node.incomers('edge').filter((e) => e.data('type') === 'funds');
      const buyers = buyerEdges.sources().filter((n) => n.data('type') === 'buyer');
      const upstreamEdges = buyers.incomers('edge').filter((e) => {
        const srcType = e.source().data('type');
        return srcType === 'signal' || srcType === 'pressure_layer';
      });
      const upstreamNodes = upstreamEdges.sources();
      return path.union(buyerEdges).union(buyers).union(upstreamEdges).union(upstreamNodes);
    }

    return path.union(node.closedNeighborhood());
  }

  function focusNode(node, center = false) {
    if (!node || node.empty()) return;
    clearFocus();
    cy.elements().addClass('dimmed');

    const traced = traceCapitalPath(node);
    traced.removeClass('dimmed');

    node.addClass('focus-node');
    traced.filter('edge').addClass('focus-edge');

    if (center) {
      cy.animate({ fit: { eles: traced, padding: 80 }, duration: 320 });
    }

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
