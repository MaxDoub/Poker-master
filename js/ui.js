// Petites aides DOM, partagées par les écrans.

/** el('div.card', { onclick }, 'texte', child) */
export function el(spec, props = null, ...children) {
  const [tagPart, ...classes] = spec.split('.');
  const node = document.createElement(tagPart || 'div');
  if (classes.length) node.className = classes.join(' ');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'style' && typeof v === 'object') {
        for (const [prop, val] of Object.entries(v)) {
          if (prop.startsWith('--')) node.style.setProperty(prop, val);
          else node.style[prop] = val;
        }
      }
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** append() en filtrant null/undefined/false — sinon le DOM affiche la chaîne "null". */
export function mount(parent, ...children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Section avec titre, utilisée partout. */
export function section(title, ...children) {
  return el('section.card', null, title ? el('h2.card__title', null, title) : null, ...children);
}

export function stat(value, label, tone = null) {
  return el('div.stat' + (tone ? `.stat--${tone}` : ''), null,
    el('div.stat__value', null, value),
    el('div.stat__label', null, label));
}

export function go(route) {
  if (location.hash === route) window.dispatchEvent(new Event('hashchange'));
  else location.hash = route;
}

export function toast(message, tone = 'info') {
  const node = el(`div.toast.toast--${tone}`, null, message);
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 250);
  }, 2600);
}

export function pct(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  })} %`;
}

export function emptyState(message, actionLabel, route) {
  return el('div.empty', null,
    el('p', null, message),
    actionLabel ? el('button.btn.btn--primary', { onclick: () => go(route) }, actionLabel) : null);
}
