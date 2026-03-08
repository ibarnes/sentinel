function targetDescriptor(el) {
  if (!el) return {};
  const attrs = ['id', 'name', 'type', 'role', 'aria-label', 'placeholder'];
  const attrMap = Object.fromEntries(attrs.map((k) => [k, el.getAttribute?.(k) || null]));
  return {
    selector: cssPath(el),
    domPath: domPath(el),
    text: (el.innerText || el.value || el.getAttribute?.('aria-label') || '').slice(0, 240),
    tagName: el.tagName?.toLowerCase() || null,
    attributes: attrMap,
    boundingBox: rect(el)
  };
}

function cssPath(el) {
  if (!el || !el.parentElement) return '';
  const path = [];
  let curr = el;
  while (curr && curr.nodeType === Node.ELEMENT_NODE && path.length < 6) {
    let selector = curr.nodeName.toLowerCase();
    if (curr.id) {
      selector += `#${curr.id}`;
      path.unshift(selector);
      break;
    }
    const siblingIndex = [...curr.parentNode.children].filter((c) => c.nodeName === curr.nodeName).indexOf(curr) + 1;
    selector += `:nth-of-type(${siblingIndex})`;
    path.unshift(selector);
    curr = curr.parentElement;
  }
  return path.join(' > ');
}

function domPath(el) {
  const out = [];
  let curr = el;
  while (curr && curr.nodeType === Node.ELEMENT_NODE && out.length < 10) {
    out.unshift(curr.tagName.toLowerCase());
    curr = curr.parentElement;
  }
  return out.join('/');
}

function rect(el) {
  const r = el.getBoundingClientRect?.();
  if (!r) return null;
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

function send(type, payload) {
  chrome.runtime.sendMessage({ type, payload }, () => void chrome.runtime.lastError);
}

function rawEvent(type, el, extra = {}) {
  const significant = ['click', 'change', 'submit', 'navigation'].includes(type);
  const frameMeta = frameContextMeta();
  return {
    timestamp: new Date().toISOString(),
    actionType: type,
    significant,
    pageUrl: location.href,
    pageTitle: document.title,
    target: targetDescriptor(el),
    devicePixelRatio: window.devicePixelRatio || 1,
    zoom: detectZoom(),
    cssTransformScale: detectCssScale(el),
    viewport: { width: window.innerWidth || 0, height: window.innerHeight || 0 },
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0,
    framePath: frameMeta.framePath,
    frameOrigin: frameMeta.frameOrigin,
    frameOffsetX: frameMeta.frameOffsetX,
    frameOffsetY: frameMeta.frameOffsetY,
    frameChain: frameMeta.frameChain,
    ...extra
  };
}

document.addEventListener('click', (e) => {
  send('reveal:event', rawEvent('click', e.target));
}, true);

document.addEventListener('change', (e) => {
  const el = e.target;
  const isFile = el?.tagName?.toLowerCase() === 'input' && el.type === 'file';
  send('reveal:event', rawEvent('change', el, {
    valueMasked: isFile ? null : maskValue(el?.value),
    fileMeta: isFile ? [...(el.files || [])].map((f) => ({ name: f.name, size: f.size, type: f.type })) : null
  }));
}, true);

document.addEventListener('input', (e) => {
  const el = e.target;
  send('reveal:event', rawEvent('input', el, { valueMasked: maskValue(el?.value) }));
}, true);

document.addEventListener('submit', (e) => {
  send('reveal:event', rawEvent('submit', e.target));
}, true);

window.addEventListener('hashchange', () => {
  send('reveal:event', rawEvent('navigation', document.body, { toUrl: location.href }));
});

const historyPush = history.pushState;
history.pushState = function (...args) {
  const ret = historyPush.apply(this, args);
  send('reveal:event', rawEvent('navigation', document.body, { toUrl: location.href, navigationType: 'pushState' }));
  return ret;
};

function detectZoom() {
  try {
    if (window.visualViewport?.scale) return Number(window.visualViewport.scale) || 1;
  } catch {}
  return 1;
}

function detectCssScale(el) {
  try {
    const node = el && el.nodeType === Node.ELEMENT_NODE ? el : document.body;
    const t = getComputedStyle(node).transform;
    if (!t || t === 'none') return 1;
    const m = t.match(/matrix\(([^)]+)\)/);
    if (!m) return 1;
    const vals = m[1].split(',').map((x) => Number(x.trim()));
    if (vals.length >= 4) {
      const sx = Math.hypot(vals[0], vals[1]) || 1;
      return sx;
    }
  } catch {}
  return 1;
}

function frameContextMeta() {
  try {
    const chain = [];
    if (window.top === window) {
      chain.push({ framePath: 'top', frameOrigin: location.origin, frameOffsetX: 0, frameOffsetY: 0, viewportWidth: window.innerWidth || 0, viewportHeight: window.innerHeight || 0, unresolved: false });
      return { framePath: 'top', frameOrigin: location.origin, frameOffsetX: 0, frameOffsetY: 0, frameChain: chain };
    }

    let w = window;
    while (w && w !== w.top) {
      try {
        const fe = w.frameElement;
        const r = fe?.getBoundingClientRect?.();
        chain.unshift({
          framePath: 'iframe',
          frameOrigin: w.location?.origin || null,
          frameOffsetX: r?.x || 0,
          frameOffsetY: r?.y || 0,
          viewportWidth: w.innerWidth || 0,
          viewportHeight: w.innerHeight || 0,
          unresolved: false
        });
        w = w.parent;
      } catch {
        chain.unshift({ framePath: 'iframe', frameOrigin: null, frameOffsetX: 0, frameOffsetY: 0, viewportWidth: 0, viewportHeight: 0, unresolved: true });
        break;
      }
    }
    chain.unshift({ framePath: 'top', frameOrigin: document.referrer || null, frameOffsetX: 0, frameOffsetY: 0, viewportWidth: window.top?.innerWidth || 0, viewportHeight: window.top?.innerHeight || 0, unresolved: false });

    const last = chain[chain.length - 1] || { frameOffsetX: 0, frameOffsetY: 0 };
    return {
      framePath: 'iframe',
      frameOrigin: document.referrer || null,
      frameOffsetX: last.frameOffsetX || 0,
      frameOffsetY: last.frameOffsetY || 0,
      frameChain: chain
    };
  } catch {
    return { framePath: 'unknown', frameOrigin: null, frameOffsetX: 0, frameOffsetY: 0, frameChain: [{ framePath: 'unknown', unresolved: true }] };
  }
}

function maskValue(value) {
  if (!value) return '';
  if (String(value).length > 120) return '[masked_long_input]';
  return String(value).replace(/[A-Za-z0-9]/g, '*');
}
