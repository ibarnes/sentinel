(async function initCapitalMap() {
  const container = document.getElementById('capital-map');
  if (!container || !window.cytoscape) return;

  const response = await fetch('/api/capital-map', { credentials: 'same-origin' });
  const data = response.ok ? await response.json() : { nodes: [], edges: [] };

  const elements = [
    ...(Array.isArray(data.nodes) ? data.nodes : []).map((n) => ({ data: n })),
    ...(Array.isArray(data.edges) ? data.edges : []).map((e) => ({ data: e }))
  ];

  window.cytoscape({
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
      }
    ]
  });
})();
