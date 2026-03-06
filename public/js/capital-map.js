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
          'width': 2
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

  function focusNode(node, center = false) {
    if (!node || node.empty()) return;
    clearFocus();
    cy.elements().addClass('dimmed');

    const neighborhood = node.closedNeighborhood();
    neighborhood.removeClass('dimmed');

    node.addClass('focus-node');
    node.connectedEdges().addClass('focus-edge');

    if (center) {
      cy.animate({ fit: { eles: neighborhood, padding: 80 }, duration: 320 });
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

  const seedNode = nodeFromQuery();
  if (seedNode) {
    focusNode(seedNode, true);
  }
})();
