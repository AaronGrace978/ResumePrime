export const SCAN_PAGE_SCRIPT = `(() => {
  const cssPath = (el) => {
    if (!(el instanceof Element)) return '';
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let sel = node.nodeName.toLowerCase();
      if (node.className && typeof node.className === 'string') {
        const cls = node.className.trim().split(/\\s+/).slice(0, 2).map((c) => CSS.escape(c)).join('.');
        if (cls) sel += '.' + cls;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.nodeName === node.nodeName);
        if (siblings.length > 1) sel += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
      }
      parts.unshift(sel);
      if (node.id) break;
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const labelFor = (el) => {
    const id = el.getAttribute('id');
    if (id) {
      const lab = document.querySelector('label[for="' + CSS.escape(id) + '"]');
      if (lab) return lab.innerText.trim();
    }
    const wrap = el.closest('label');
    if (wrap) return wrap.innerText.trim().replace(el.value || '', '').trim();
    const aria = el.getAttribute('aria-label');
    if (aria) return aria;
    const labelled = el.getAttribute('aria-labelledby');
    if (labelled) {
      return labelled.split(/\\s+/).map((i) => document.getElementById(i)?.innerText || '').join(' ').trim();
    }
    const prev = el.previousElementSibling;
    if (prev && /LABEL|SPAN|P|DIV|LEGEND/.test(prev.tagName)) return prev.innerText.trim().slice(0, 120);
    return el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('id') || el.type || 'field';
  };

  const nodes = [...document.querySelectorAll('input, textarea, select')];
  const fields = [];
  nodes.forEach((el, i) => {
    if (!(el instanceof HTMLElement)) return;
    const type = (el.getAttribute('type') || el.tagName.toLowerCase()).toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'file', 'reset'].includes(type)) return;
    if (el.offsetParent === null && type !== 'checkbox' && type !== 'radio') return;
    const options = el.tagName === 'SELECT'
      ? [...el.options].map((o) => o.textContent?.trim() || o.value).filter(Boolean)
      : undefined;
    fields.push({
      id: el.id || el.name || ('f' + i),
      name: el.getAttribute('name') || '',
      label: labelFor(el).slice(0, 160),
      type,
      required: el.required || el.getAttribute('aria-required') === 'true',
      value: type === 'checkbox' || type === 'radio' ? String(el.checked) : (el.value || ''),
      selector: cssPath(el),
      options
    });
  });

  const captcha = !!(document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], .g-recaptcha, [data-sitekey]'));
  const loginHints = /sign in|log in|sso|continue with google/i.test(document.body.innerText.slice(0, 4000));
  const submit = document.querySelector('button[type="submit"], input[type="submit"], button');
  return {
    url: location.href,
    title: document.title,
    fields,
    captcha,
    loginHints,
    submitText: submit ? (submit.innerText || submit.value || 'Submit') : null
  };
})()`

export const FILL_FIELDS_SCRIPT = `(fields) => {
  const setNative = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  const results = [];
  for (const f of fields) {
    const el = document.querySelector(f.selector);
    if (!el) {
      results.push({ selector: f.selector, ok: false, reason: 'not_found' });
      continue;
    }
    try {
      el.scrollIntoView({ block: 'center' });
      if (el instanceof HTMLSelectElement) {
        const opt = [...el.options].find((o) =>
          o.value === f.value || o.textContent?.trim() === f.value
        );
        if (opt) el.value = opt.value;
        else el.value = f.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        const want = /^(true|1|yes|on)$/i.test(String(f.value));
        if (el.checked !== want) el.click();
      } else {
        setNative(el, f.value ?? '');
      }
      results.push({ selector: f.selector, ok: true });
    } catch (err) {
      results.push({ selector: f.selector, ok: false, reason: String(err) });
    }
  }
  return results;
}`

export const SUBMIT_SCRIPT = `(() => {
  const btn = document.querySelector('button[type="submit"], input[type="submit"]')
    || [...document.querySelectorAll('button')].find((b) => /submit|apply|send application/i.test(b.innerText));
  if (!btn) return { ok: false, reason: 'no_submit_button' };
  btn.click();
  return { ok: true, text: btn.innerText || btn.value || 'Submit' };
})()`
