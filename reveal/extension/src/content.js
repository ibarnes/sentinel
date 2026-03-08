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
  return {
    timestamp: new Date().toISOString(),
    actionType: type,
    significant,
    pageUrl: location.href,
    pageTitle: document.title,
    target: targetDescriptor(el),
    framePath: window.top === window ? 'top' : 'iframe',
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

function maskValue(value) {
  if (!value) return '';
  if (String(value).length > 120) return '[masked_long_input]';
  return String(value).replace(/[A-Za-z0-9]/g, '*');
}
