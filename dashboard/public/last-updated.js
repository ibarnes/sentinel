(async function () {
  const target = document.getElementById('uos-last-updated');
  if (!target) return;
  try {
    const res = await fetch('/dashboard/state/state.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const state = await res.json();
    const docs = Array.isArray(state.updatedDocs) ? state.updatedDocs.join(', ') : 'Unknown';
    target.innerHTML = `
      <strong>Last updated:</strong> ${state.lastUpdated || 'N/A'}<br/>
      <strong>UOS docs updated:</strong> ${docs}
    `;
  } catch (err) {
    target.textContent = `Last updated unavailable (${err.message})`;
  }
})();
