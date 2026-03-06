(async function initCapitalMap() {
  const mapEl = document.getElementById('capital-map');
  const detailsEl = document.getElementById('node-details');
  if (!mapEl || !window.cytoscape) return;

  const setDetails = (node) => {
    if (!detailsEl) return;
    if (!node) {
      detailsEl.innerHTML = 'Select a node to inspect.';
      return;
    }
    const d = node.data();
    detailsEl.innerHTML = [
      `<div><strong>${d.label || d.id}</strong></div>`,
      `<div class="text-muted">ID: ${d.id || '—'}</div>`,
      `<div class="text-muted">Type: ${d.type || '—'}</div>`
    ].join('');
  };

  let payload = { nodes: [], edges: [] };
  try {
    const r = await fetch('/api/capital-map', { credentials: 'same-origin' });
    if (r.ok) payload = await r.json();
  } catch (_) {}

  const elements = [
    ...(Array.isArray(payload.nodes) ? payload.nodes : []).map((n) => ({ data: n })),
    ...(Array.isArray(payload.edges) ? payload.edges : []).map((e) => ({ data: e }))
  ];

  const cy = window.cytoscape({
    container: mapEl,
    elements,
    layout: { name: 'breadthfirst', directed: true, padding: 20, spacingFactor: 1.15 },
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'font-size': 11,
          'text-wrap': 'wrap',
          'text-max-width': 120,
          'color': '#e8ecf3',
          'background-color': '#4f8cff',
          'border-width': 1,
          'border-color': '#2d3c58',
          'width': 36,
          'height': 36
        }
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'line-color': '#60708f',
          'target-arrow-color': '#60708f',
          'width': 1.5,
          'label': 'data(type)',
          'font-size': 8,
          'color': '#9aa5b4'
        }
      },
      {
        selector: 'node[type = "pressure_layer"]',
        style: { 'background-color': '#7b61ff' }
      },
      {
        selector: 'node[type = "signal"]',
        style: { 'background-color': '#ff9f43' }
      },
      {
        selector: 'node[type = "buyer"]',
        style: { 'background-color': '#2ecc71' }
      },
      {
        selector: 'node[type = "initiative"]',
        style: { 'background-color': '#00bcd4' }
      },
      {
        selector: 'node[type = "constraint"]',
        style: { 'background-color': '#ef5350' }
      },
      {
        selector: 'node:selected',
        style: { 'border-width': 3, 'border-color': '#f5f7ff' }
      }
    ]
  });

  cy.on('tap', 'node', (evt) => setDetails(evt.target));
  cy.on('tap', (evt) => { if (evt.target === cy) setDetails(null); });
})();
