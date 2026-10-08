/* Form Filler – DOM side: finds fields, describes them, classifies, generates and sets values with
 * the events frameworks (React, Vue, Angular, jQuery validators) expect. Entry point: __FF.run(opts). */
(() => {
  'use strict';
  const FF = globalThis.__FF;
  if (!FF || FF.run) return;

  const FIELD_SEL = 'input, select, textarea';
  const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);
  const KINDS = new Set(['checkbox', 'radio', 'file', 'email', 'tel', 'url', 'password', 'number', 'range',
    'date', 'datetime-local', 'month', 'week', 'time', 'color', 'search']);
  const DATE_KINDS = new Set(['date', 'datetime-local', 'month', 'week', 'time']);
  const DATE_IDS = new Set(['birthDate', 'date', 'futureDate', 'docIssueDate', 'ccExp', 'time']);
  const TEL_OK = new Set(['phone', 'mobile', 'landline', 'fax', 'areaCode', 'phonePrefix', 'postalCode', 'ccNumber',
    'ccCvv', 'ccExp', 'ccExpMonth', 'ccExpYear', 'otp', 'genericCode', 'quantity', 'age', 'partitaIva', 'houseNumber',
    'accountNumber', 'sortCode', 'routingNumber', 'birthDay', 'birthMonth', 'birthYear', 'day', 'month', 'year',
    'amount', 'ssn', 'taxId', 'idCard', 'iban', 'secretChar', 'customerNumber', 'pagopaNotice', 'postalAccount', 'abi',
    'cab', 'billNumber', 'codiceTributo', 'annoRiferimento', 'rateazione', 'enteCreditore', 'loanAmount', 'propertyValue',
    'downPayment', 'installment', 'balance', 'loanTerm', 'yearsDuration', 'interestRate']);
  const PASSWORD_OK = new Set(['password', 'otp', 'ccCvv', 'ccNumber', 'secretChar', 'memorable', 'customerNumber']);
  const TEXTAREA_SHORT = new Set(['subject', 'objectName', 'search', 'genericCode', 'date', 'time', 'year', 'month', 'day', 'bareName']);
  const HIGHLIGHT = { rule: '#16a34a', custom: '#2563eb', fallback: '#f59e0b' };
  const CONSENT_RE = /privacy|gdpr|consen|accett|acconsent|agree|accept|terms|termini|condizioni|informativa|trattamento|policy|autorizz|dichiaro|declare|confermo|maggiorenne|over 18|18 anni/;
  const POSITIVE_RE = /^(si|yes|y|true|1|ok|accetto|acconsento|accept|agree|i agree|autorizzo|consento|do il consenso)\b/;
  const BIRTH_RE = /birth|nascita|\bdob\b|\bbday\b|\bnat[oa]\b|\bborn\b|compleanno/;
  const GENDER_M = /\b(m|maschio|maschile|male|uomo|man|mr)\b/;
  const GENDER_F = /\b(f|femmina|femminile|female|donna|woman|ms|mrs)\b/;
  const NEGATIVE_RE = /^(no|non|not|nego|none|nessun[oa]?|false|0|n|i am not|i m not|negativo)\b/;
  const NEGATED_STATEMENT_RE = /\b(non|not|never|mai|nessun[oa]?|no)\b/;
  const BENEFICIARY_RE = /beneficiari|\bpayee\b|\brecipient\b|destinatari[oa]|\bcontroparte\b|counterparty|conto (di )?accredito|\bto account\b|send(ing)? money to|pay someone/;
  const HEADING_SEL = 'h1, h2, h3, h4, h5, h6, legend, [role="heading"]';
  const NO_KEYS_TYPES = new Set(['date', 'datetime-local', 'month', 'week', 'time', 'color', 'range', 'file', 'checkbox', 'radio']);

  const IT_WORDS = new Set(('nome cognome indirizzo citta telefono cellulare nascita codice fiscale invia accedi registrati ' +
    'registrazione conferma provincia comune messaggio accetto acconsento scegli seleziona obbligatorio obbligatori utente sesso ' +
    'azienda societa inserisci campo campi modulo richiesta iscriviti cerca paese nazione numero civico informativa consenso ' +
    'prosegui avanti indietro salva annulla carrello pagamento spedizione il lo gli della dei delle per con una sono questo ' +
    'questa tuo tua tuoi vostro vostra nostro nostra che non piu anche contatti prodotti servizi chi siamo').split(' '));
  const EN_WORDS = new Set(('name first last address city phone birth submit login sign register registration confirm state ' +
    'zip street message accept agree select choose required user company enter field fields form request subscribe search ' +
    'country number continue next back save cancel cart payment shipping the and of to for with your you our this that ' +
    'please is are be about contact products services').split(' '));

  // ---------- Locale ----------

  function resolveFallback(fb) {
    if (fb && fb !== 'browser') return fb;
    const nav = (navigator.language || 'en-US').toLowerCase();
    if (nav.startsWith('it')) return 'it';
    if (/-(gb|uk|ie)\b/.test(nav)) return 'en-GB';
    return 'en-US';
  }

  FF.detectLocale = function (settings) {
    const pref = settings.locale || 'auto';
    if (pref !== 'auto' && FF.data[pref]) return pref;
    const meta = document.querySelector('meta[http-equiv="content-language" i]');
    const lang = (document.documentElement.getAttribute('lang') || (meta && meta.getAttribute('content')) || '').toLowerCase();
    const host = location.hostname || '';
    let sample = '';
    try {
      sample = (document.body ? document.body.innerText : '').slice(0, 8000);
    } catch (e) {
      /* ignore */
    }
    sample += ' ' + [...document.querySelectorAll('[placeholder]')].slice(0, 60).map((e) => e.getAttribute('placeholder')).join(' ');
    // Canvas UIs (Flutter) expose their labels only as aria-label.
    sample += ' ' + deepQueryAll(document, '[aria-label]').slice(0, 80).map((e) => e.getAttribute('aria-label')).join(' ');
    let it = /\.it$/.test(host) ? 3 : 0;
    let en = 0;
    for (const w of FF.normalize(sample).split(' ')) {
      if (IT_WORDS.has(w)) it++;
      else if (EN_WORDS.has(w)) en++;
    }
    const fallback = resolveFallback(settings.fallbackLocale);
    if (lang.startsWith('it')) return 'it';
    if (it >= 3 && it >= en * 1.5) return 'it'; // Italian page with a wrong/missing lang attribute
    if (lang.startsWith('en') || (en >= 3 && en >= it * 1.5)) {
      if (/-(gb|uk|ie)\b/.test(lang) || /\.(uk|ie)$/.test(host)) return 'en-GB';
      if (/-us\b/.test(lang)) return 'en-US';
      return fallback === 'en-GB' ? 'en-GB' : 'en-US';
    }
    return fallback;
  };

  // ---------- DOM text helpers ----------

  const IGNORED_TEXT_PARENTS = 'select, option, textarea, script, style, noscript, template';

  function textOf(node) {
    if (!node) return '';
    let out = '';
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode;
      const p = t.parentElement;
      if (p && p.closest(IGNORED_TEXT_PARENTS)) continue;
      out += ' ' + t.nodeValue;
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  const clip = (s, n = 150) => (s && s.length > n ? s.slice(0, n) : s || '');

  function idsText(el, ids) {
    const root = el.getRootNode();
    return ids.split(/\s+/).map((id) => {
      const n = (root.getElementById ? root.getElementById(id) : null) || document.getElementById(id);
      return n ? textOf(n) : '';
    }).join(' ').trim();
  }

  function labelText(el) {
    const labels = el.labels ? [...el.labels] : [];
    if (!labels.length && el.id) {
      try {
        const l = el.getRootNode().querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (l) labels.push(l);
      } catch (e) {
        /* ignore */
      }
    }
    if (!labels.length && el.closest) {
      const l = el.closest('label');
      if (l) labels.push(l);
    }
    const parts = labels.map(textOf);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) parts.push(idsText(el, lb));
    const al = el.getAttribute('aria-label');
    if (al) parts.push(al);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  const parentOf = (n) => n.parentElement || (n.parentNode && n.parentNode.host) || null;

  /** Label-like element in a small wrapper that holds only this field (floating labels, div/span labels). */
  function containerLabel(el) {
    let node = parentOf(el);
    for (let d = 0; d < 3 && node && node !== document.body; d++, node = parentOf(node)) {
      if (node.querySelectorAll('input:not([type=hidden]), select, textarea').length > 1) return '';
      const cands = node.querySelectorAll('label, legend, .label, [class*="label"], [class*="Label"]');
      for (const l of cands) {
        if (l.contains(el)) continue;
        if (l.htmlFor && el.id && l.htmlFor !== el.id) continue;
        const t = textOf(l);
        if (t && t.length < 120) return t;
      }
    }
    return '';
  }

  /** Closest preceding text (table cells, <span>Label</span><input>, ...) without crossing other fields. */
  function nearbyText(el) {
    let node = el;
    for (let depth = 0; depth < 4 && node && node !== document.body; depth++) {
      let sib = node.previousSibling;
      while (sib) {
        if (sib.nodeType === Node.TEXT_NODE) {
          const t = sib.nodeValue.replace(/\s+/g, ' ').trim();
          if (t) return t.length <= 120 ? t : '';
        } else if (sib.nodeType === Node.ELEMENT_NODE && !/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|BR)$/.test(sib.tagName)) {
          if (sib.matches('input:not([type=hidden]), select, textarea, button') ||
            sib.querySelector('input:not([type=hidden]), select, textarea')) return '';
          const t = textOf(sib);
          if (t) return t.length <= 120 ? t : '';
        }
        sib = sib.previousSibling;
      }
      node = parentOf(node);
    }
    return '';
  }

  function legendText(el) {
    const fs = el.closest && el.closest('fieldset');
    const lg = fs && fs.querySelector('legend');
    return lg ? clip(textOf(lg), 100) : '';
  }

  const ATTRS = ['name', 'id', 'formcontrolname', 'ng-model', 'data-name', 'data-field', 'data-fieldname', 'data-testid',
    'data-test', 'data-qa', 'data-cy', 'v-model', 'x-model', 'wire:model', 'data-bind', 'data-fieldtype', 'data-encrypted-name'];

  function describe(el) {
    let label = labelText(el);
    if (!label) label = containerLabel(el);
    let ph = ['placeholder', 'aria-placeholder', 'data-placeholder'].map((a) => el.getAttribute(a)).filter(Boolean).join(' ');
    if (el.tagName === 'SELECT' && el.options.length && isPlaceholderOption(el.options[0], 0)) ph += ' ' + el.options[0].text;
    const title = el.getAttribute('title') || '';
    const attrs = ATTRS.map((a) => el.getAttribute(a)).filter(Boolean).join(' ');
    const nearby = label ? '' : nearbyText(el);
    const describedBy = el.getAttribute('aria-describedby');
    const help = describedBy ? idsText(el, describedBy) : '';
    return {
      ac: el.getAttribute('autocomplete') || '',
      sources: [['label', clip(label)], ['attr', attrs], ['placeholder', ph], ['title', title], ['nearby', nearby], ['legend', legendText(el)]],
      hint: [ph, title, el.getAttribute('pattern') || '', help, label].join(' '),
    };
  }

  /** Text around a field, climbing only through wrappers that hold at most `maxFields` fields (e.g. a d/m/y triple). */
  /** Nearest heading/legend above the field (crossing other fields), e.g. "Beneficiario" for a whole section. */
  function sectionHeading(el) {
    let node = el;
    for (let depth = 0; depth < 8 && node && node !== document.body; depth++) {
      let sib = node.previousElementSibling;
      for (let n = 0; sib && n < 15; n++, sib = sib.previousElementSibling) {
        if (sib.matches(HEADING_SEL)) return clip(textOf(sib), 100);
        const inner = sib.querySelectorAll(HEADING_SEL);
        if (inner.length) return clip(textOf(inner[inner.length - 1]), 100);
      }
      node = parentOf(node);
    }
    return '';
  }

  function groupText(el, maxFields) {
    let node = parentOf(el);
    let out = '';
    for (let d = 0; d < 3 && node && node !== document.body; d++, node = parentOf(node)) {
      if (node.querySelectorAll('input:not([type=hidden]), select, textarea').length > maxFields) break;
      const t = textOf(node);
      if (t.length > 300) break;
      out = t;
    }
    return FF.normalize(`${out} ${nearbyText(el)}`);
  }

  const MONTH_NAMES = new Set([...FF.data.it.months, ...FF.data['en-US'].months]
    .flatMap((m) => [m, m.slice(0, 3)]));

  /** Recognise day / month / year selects from their options. */
  function selectDatePart(el) {
    const opts = [...el.options].filter((o, i) => !isPlaceholderOption(o, i));
    if (opts.length < 2) return null;
    const texts = opts.map((o) => FF.normalize(o.text));
    if (texts.filter((t) => MONTH_NAMES.has(t)).length >= Math.min(10, opts.length)) return 'month';
    const nums = texts.map((t) => (/^\d+$/.test(t) ? +t : NaN));
    if (nums.some(isNaN)) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (min >= 1900 && max <= 2200) return 'year';
    if (min >= 1 && max <= 12 && opts.length === 12) return 'month';
    if (min >= 1 && max <= 31 && opts.length >= 28) return 'day';
    return null;
  }

  const DATE_PART_IDS = {
    birth: { day: 'birthDay', month: 'birthMonth', year: 'birthYear' },
    card: { month: 'ccExpMonth', year: 'ccExpYear' },
    plain: { day: 'day', month: 'month', year: 'year' },
  };

  function refineSelect(f) {
    const id = f.id;
    if (id && !/^(birth(Date|Day|Month|Year)|date|futureDate|docIssueDate|ccExp|ccExpMonth|ccExpYear|day|month|year)$/.test(id)) return;
    const part = selectDatePart(f.el);
    if (!part) return;
    const family = /^birth/.test(id || '') ? 'birth' : /^ccExp/.test(id || '') ? 'card' : 'plain';
    const mapped = DATE_PART_IDS[family][part];
    if (mapped && mapped !== id) {
      f.id = mapped;
      f.via = f.via ? `${f.via}+options` : 'options';
    }
  }

  // ---------- Field discovery ----------

  function kindOf(el) {
    const tag = el.tagName;
    if (tag === 'SELECT') return 'select';
    if (tag === 'TEXTAREA') return 'textarea';
    if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      if (SKIP_INPUT_TYPES.has(t)) return null;
      return KINDS.has(t) ? t : 'text';
    }
    if (el.isContentEditable) return 'editable';
    return null;
  }

  function deepQueryAll(root, sel, out = []) {
    root.querySelectorAll(sel).forEach((e) => out.push(e));
    root.querySelectorAll('*').forEach((e) => {
      if (e.shadowRoot) deepQueryAll(e.shadowRoot, sel, out);
    });
    return out;
  }

  function isRendered(el) {
    if (!el.isConnected || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.visibility !== 'collapse';
  }

  function looksVisible(el) {
    if (!isRendered(el)) return false;
    if (parseFloat(getComputedStyle(el).opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const left = r.left + window.scrollX;
    const top = r.top + window.scrollY;
    if (left + r.width < 0 || top + r.height < 0) return false; // off-screen honeypots
    return left <= Math.max(document.documentElement.scrollWidth, window.innerWidth) + 50;
  }

  function isUsable(el, kind) {
    if (looksVisible(el)) return true;
    if (kind === 'checkbox' || kind === 'radio' || kind === 'file' || kind === 'select') {
      // Custom-styled controls hide the native element but keep its label/wrapper visible.
      if (el.labels && [...el.labels].some(isRendered)) return true;
      const parent = parentOf(el);
      return !!parent && isRendered(parent) && parent.getBoundingClientRect().width >= 4;
    }
    return false;
  }

  function deepActiveElement() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  function resolveScope(scope) {
    if (scope === 'focused') {
      const a = deepActiveElement();
      if (!a || a === document.body || a === document.documentElement || /^(IFRAME|FRAME)$/.test(a.tagName)) return null;
      return { root: a.form || a.closest('form') || document };
    }
    if (scope === 'context' || scope === 'field') {
      const t = globalThis.__ffContextTarget;
      if (!t || !t.isConnected || !t.closest) return scope === 'field' ? null : { root: document };
      if (scope === 'field') {
        const el = t.closest('input, select, textarea, [contenteditable]');
        return el ? { root: el, single: el } : null;
      }
      return { root: t.form || t.closest('form') || document };
    }
    return { root: document };
  }

  function collect(scope, settings) {
    if (scope.single) return [scope.single];
    const root = scope.root;
    const set = new Set();
    if (root instanceof HTMLFormElement) {
      for (const e of root.elements) if (e.matches(FIELD_SEL)) set.add(e);
    }
    deepQueryAll(root, FIELD_SEL).forEach((e) => set.add(e));
    if (settings.fillContentEditable) {
      deepQueryAll(root, '[contenteditable]:not([contenteditable="false"])').forEach((e) => {
        if (!parentOf(e) || !parentOf(e).isContentEditable) set.add(e);
      });
    }
    return [...set];
  }

  // ---------- Setting values ----------

  function nativeSetter(el, prop) {
    for (let p = Object.getPrototypeOf(el); p; p = Object.getPrototypeOf(p)) {
      const d = Object.getOwnPropertyDescriptor(p, prop);
      if (d && d.set) return d.set;
    }
    return null;
  }

  function fire(el, type, Ctor = Event, extra = {}) {
    let ev;
    try {
      ev = new Ctor(type, { bubbles: true, cancelable: true, composed: true, ...extra });
    } catch (e) {
      ev = new Event(type, { bubbles: true, cancelable: true });
    }
    el.dispatchEvent(ev);
  }

  function focusEvents(el) {
    fire(el, 'focus', FocusEvent, { bubbles: false });
    fire(el, 'focusin', FocusEvent);
  }

  function blurEvents(el) {
    fire(el, 'blur', FocusEvent, { bubbles: false });
    fire(el, 'focusout', FocusEvent);
  }

  let simulateTyping = false;
  const canType = (el) => /^(INPUT|TEXTAREA)$/.test(el.tagName) && !NO_KEYS_TYPES.has(el.type);

  /** Set a value through the native setter so React/Vue trackers notice, then emit input/change/blur. */
  function typeInto(el, value) {
    if (simulateTyping && value !== '' && canType(el)) return typeKeys(el, value);
    focusEvents(el);
    const set = nativeSetter(el, 'value');
    if (set) set.call(el, value);
    else el.value = value;
    fire(el, 'input', InputEvent, { inputType: 'insertText', data: value });
    fire(el, 'change');
    blurEvents(el);
    // Masks and anti-automation guards that wipe programmatic values: retry with keystrokes.
    if (value !== '' && el.value === '' && canType(el)) typeKeys(el, value);
  }

  const KEY_CODES = {
    ' ': ['Space', 32], '-': ['Minus', 189], _: ['Minus', 189], '.': ['Period', 190], ',': ['Comma', 188],
    '/': ['Slash', 191], '?': ['Slash', 191], '@': ['Digit2', 50], '+': ['Equal', 187], '#': ['Digit3', 51],
    '!': ['Digit1', 49], $: ['Digit4', 52], '%': ['Digit5', 53], '*': ['Digit8', 56], ':': ['Semicolon', 186],
  };
  function keyInfo(ch) {
    if (/\d/.test(ch)) return [`Digit${ch}`, 48 + +ch];
    if (/[a-z]/i.test(ch)) return [`Key${ch.toUpperCase()}`, ch.toUpperCase().charCodeAt(0)];
    return KEY_CODES[ch] || ['', 0];
  }

  /** Type character by character: keydown → keypress → beforeinput → input → keyup, honouring preventDefault. */
  function typeKeys(el, value) {
    try {
      el.focus({ preventScroll: true });
    } catch (e) {
      /* ignore */
    }
    if (el.getRootNode().activeElement !== el) focusEvents(el);
    const set = nativeSetter(el, 'value');
    const write = (v) => (set ? set.call(el, v) : (el.value = v));
    write('');
    fire(el, 'input', InputEvent, { inputType: 'deleteContentBackward' });
    const max = el.maxLength > 0 ? el.maxLength : Infinity;
    for (const ch of String(value)) {
      const [code, keyCode] = keyInfo(ch);
      const base = { key: ch, code, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true };
      const down = el.dispatchEvent(new KeyboardEvent('keydown', base));
      const charCode = ch.charCodeAt(0);
      const press = down && el.dispatchEvent(new KeyboardEvent('keypress', { ...base, keyCode: charCode, charCode, which: charCode }));
      if (press && el.value.length < max) {
        const before = new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true, composed: true });
        if (el.dispatchEvent(before)) {
          write(el.value + ch);
          fire(el, 'input', InputEvent, { inputType: 'insertText', data: ch });
        }
      }
      el.dispatchEvent(new KeyboardEvent('keyup', base));
    }
    fire(el, 'change');
    if (el.getRootNode().activeElement === el) el.blur();
    else blurEvents(el);
  }

  const UNLOCKABLE = new Set(['text', 'email', 'tel', 'password', 'url', 'search', 'number', 'textarea']);

  /** Anti-autofill trick: `readonly` until focused (onfocus="this.removeAttribute('readonly')"). */
  function unlockReadonly(el, kind) {
    if (!el.readOnly) return true;
    if (!UNLOCKABLE.has(kind)) return false;
    focusEvents(el);
    if (!el.readOnly) return true;
    try {
      el.focus({ preventScroll: true });
    } catch (e) {
      /* ignore */
    }
    return !el.readOnly;
  }

  /** Put focus and scroll back where the user had them (typing simulation focuses each field in turn). */
  FF.settleFocus = function () {
    const st = FF.focusState;
    if (!st) return;
    const cur = deepActiveElement();
    try {
      if (st.el && st.el !== document.body && st.el !== document.documentElement && st.el.isConnected) {
        if (cur !== st.el) st.el.focus({ preventScroll: true });
      } else if (cur && cur !== document.body && cur.blur) {
        cur.blur();
      }
    } catch (e) {
      /* ignore */
    }
    if (window.scrollX !== st.x || window.scrollY !== st.y) window.scrollTo(st.x, st.y);
  };

  // ---------- On-screen PIN keypads ----------

  /** Digit buttons (0-9, possibly scrambled) near a read-only PIN field. Returns Map digit → element. */
  function findKeypad(el) {
    let node = parentOf(el);
    for (let d = 0; d < 6 && node && node !== document.documentElement; d++, node = parentOf(node)) {
      // The keypad must belong to this field: stop once the container holds other fields too.
      if (node.querySelectorAll('input:not([type=hidden]):not([type=button]), select, textarea').length > 1) return null;
      const keys = new Map();
      for (const k of node.querySelectorAll('button, [role="button"], a, td, li, span, div, input[type="button"]')) {
        if (k === el || k.querySelector('input, select, textarea')) continue;
        const t = (k.getAttribute('aria-label') || (k.tagName === 'INPUT' ? k.value : k.textContent) || '').trim();
        if (!/^\d$/.test(t) || !isRendered(k)) continue;
        const prev = keys.get(t);
        if (!prev || prev.contains(k)) keys.set(t, k); // prefer the innermost element; clicks bubble up
      }
      if (keys.size === 10) return keys;
    }
    return null;
  }

  function pressKeypad(keys, digits) {
    for (const d of digits) {
      const k = keys.get(d);
      if (!k) return false;
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
        fire(k, type, type.startsWith('pointer') && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent);
      }
      k.click();
    }
    return true;
  }

  function setChecked(el, val) {
    if (el.checked === val) return true;
    el.click();
    if (el.checked !== val) {
      const set = nativeSetter(el, 'checked');
      if (set) set.call(el, val);
      else el.checked = val;
      fire(el, 'input');
      fire(el, 'change');
    }
    return el.checked === val;
  }

  function setSelect(el, indexes) {
    focusEvents(el);
    if (el.multiple) [...el.options].forEach((o, i) => { o.selected = indexes.includes(i); });
    else el.selectedIndex = indexes[0];
    fire(el, 'input');
    fire(el, 'change');
    blurEvents(el);
  }

  function setEditable(el, text) {
    try {
      el.focus({ preventScroll: true });
      const sel = window.getSelection();
      const r = document.createRange();
      r.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(r);
      if (document.execCommand('insertText', false, text)) return true;
    } catch (e) {
      /* fall through */
    }
    el.textContent = text;
    fire(el, 'input', InputEvent, { inputType: 'insertText', data: text });
    return true;
  }

  function attachFile(el) {
    try {
      const dt = new DataTransfer();
      dt.items.add(FF.makeSampleFile(el.getAttribute('accept')));
      el.files = dt.files;
      fire(el, 'input');
      fire(el, 'change');
      return el.files.length > 0 ? el.files[0].name : false;
    } catch (e) {
      return false;
    }
  }

  // ---------- Value shaping ----------

  function isPlaceholderOption(o, index) {
    if (!o) return true;
    const text = (o.text || '').trim();
    const norm = FF.normalize(text);
    if (o.value === '' && (index === 0 || !norm)) return true;
    if (!norm && !o.value) return true;
    if (index === 0 && /^[-–—_.*\s]*$/.test(text)) return true;
    return /^(seleziona|selezionare|scegli|select|choose|please (select|choose)|pick (one|an?)|nessuna selezione)\b/.test(norm);
  }

  function isEmpty(el, kind) {
    switch (kind) {
      case 'select':
        return el.selectedIndex < 0 || isPlaceholderOption(el.options[el.selectedIndex], el.selectedIndex);
      case 'checkbox':
        return !el.checked;
      case 'file':
        return !el.files || !el.files.length;
      case 'editable':
        return !el.textContent.trim();
      case 'range':
        return true;
      case 'color':
        return !el.value || el.value === '#000000';
      default:
        return !el.value;
    }
  }

  function toList(val, f, ctx) {
    if (val == null) return [];
    const arr = Array.isArray(val) ? val : [val];
    return arr.filter((v) => v != null && v !== '').map((v) => {
      if (v instanceof Date) return FF.formatDate(v, FF.detectDateFormat(f.desc.hint, ctx.locale));
      return String(v);
    });
  }

  function finalizeText(el, list, ctx) {
    const maxL = el.maxLength > 0 ? el.maxLength : Infinity;
    const minL = el.minLength > 0 ? el.minLength : 0;
    const patternSrc = el.getAttribute('pattern');
    const re = patternSrc ? FF.compilePattern(patternSrc) : null;
    const ok = (s) => s.length <= maxL && s.length >= minL && (!re || re.test(s));
    for (const s of list) if (ok(s)) return s;
    for (const s of list) {
      for (const v of [s.replace(/\s+/g, ''), FF.stripAccents(s), s.replace(/[^A-Za-z0-9]/g, ''), s.toUpperCase(), s.toLowerCase()]) {
        if (ok(v)) return v;
      }
    }
    if (re) {
      for (let k = 0; k < 150; k++) {
        const g = FF.randomFromPattern(patternSrc, ctx.rng);
        if (g != null && ok(g)) return g;
      }
    }
    let s = list[0] || '';
    if (s.length < minL) {
      const numeric = /^\d*$/.test(s);
      while (s.length < minL) s += numeric ? ctx.rng.digits(1) : ' ' + ctx.rng.pick(ctx.D.words);
    }
    if (s.length > maxL) s = s.slice(0, maxL).trim();
    return s;
  }

  function firstNumber(val) {
    for (const v of Array.isArray(val) ? val : [val]) {
      if (typeof v === 'number') return v;
      if (v == null || v instanceof Date) continue;
      const n = parseFloat(String(v).replace(',', '.'));
      if (!isNaN(n)) return n;
    }
    return null;
  }

  function finalizeNumber(el, n, rng) {
    const num = (a) => {
      const x = parseFloat(a);
      return isNaN(x) ? null : x;
    };
    const min = num(el.min);
    const max = num(el.max);
    const stepAttr = (el.getAttribute('step') || '').trim().toLowerCase();
    const step = stepAttr === 'any' ? null : num(stepAttr) > 0 ? num(stepAttr) : 1;
    const isRange = el.type === 'range';
    // Bounds for random picks; only explicit min/max (or a range's defaults) constrain generated values.
    const lo = min ?? (isRange ? 0 : max != null && max < 1 ? max - 10 : 1);
    const hi = max ?? (isRange ? 100 : lo + 99);
    const floor = min ?? (isRange ? 0 : -Infinity);
    const cap = max ?? (isRange ? 100 : Infinity);
    if (n == null || isNaN(n) || n < floor || n > cap) n = lo + rng.next() * (hi - lo);
    if (step) {
      const base = min ?? 0;
      n = base + Math.round((n - base) / step) * step;
      if (n > cap) n -= step;
      if (n < floor) n += step;
    }
    const dec = step ? (String(step).split('.')[1] || '').length : Number.isInteger(n) ? 0 : 2;
    return n.toFixed(dec);
  }

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const y = t.getUTCFullYear();
    return `${y}-W${FF.pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7))}`;
  }

  const KIND_VALUE_RE = {
    date: /^\d{4}-\d{2}-\d{2}$/,
    'datetime-local': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
    month: /^\d{4}-\d{2}$/,
    week: /^\d{4}-W\d{2}$/,
    time: /^\d{2}:\d{2}/,
  };

  function finalizeDateKind(el, kind, val, ctx) {
    const list = Array.isArray(val) ? val : [val];
    const str = list.find((v) => typeof v === 'string' && KIND_VALUE_RE[kind].test(v));
    if (str) return str;
    if (kind === 'time') return `${FF.pad(ctx.rng.int(8, 18))}:${ctx.rng.pick(['00', '15', '30', '45'])}`;
    const d = list.find((v) => v instanceof Date) || FF.addDays(FF.today(), ctx.rng.int(1, 30));
    const fmt = (x) => {
      if (kind === 'date') return FF.isoDate(x);
      if (kind === 'month') return FF.isoDate(x).slice(0, 7);
      if (kind === 'week') return isoWeek(x);
      return `${FF.isoDate(x)}T${FF.pad(ctx.rng.int(8, 18))}:00`;
    };
    let s = fmt(d);
    const { min, max } = el;
    if ((min && s < min) || (max && s > max)) {
      if (kind === 'date') {
        const a = min ? new Date(`${min}T00:00`) : FF.addDays(new Date(`${max}T00:00`), -365);
        const b = max ? new Date(`${max}T00:00`) : FF.addDays(a, 365);
        s = fmt(new Date(a.getTime() + ctx.rng.next() * (b - a)));
      } else s = min && s < min ? min : max;
    }
    return s;
  }

  function matchOption(options, candidates) {
    const cands = candidates.map((c) => FF.normalize(c)).filter(Boolean);
    const opts = options.map((o) => ({ o, v: FF.normalize(o.value), t: FF.normalize(o.text) }));
    const isNum = (s) => /^\d+$/.test(s);
    for (const c of cands) {
      const n = isNum(c) ? Number(c) : null;
      const hit = opts.find((x) => x.v === c || x.t === c ||
        (n !== null && ((isNum(x.v) && Number(x.v) === n) || (isNum(x.t) && Number(x.t) === n))));
      if (hit) return hit.o;
    }
    for (const c of cands) {
      if (c.length < 3) continue;
      const re = new RegExp(`(^| )${FF.escapeRe(c)}( |$)`);
      const hit = opts.find((x) => re.test(x.t) || re.test(x.v));
      if (hit) return hit.o;
    }
    // Brackets such as "15.000 - 30.000 €", "Oltre 50k", "18-24", "up to 10,000".
    const n = candidates.map((c) => parseFloat(String(c).replace(/\s/g, '').replace(',', '.'))).find((x) => !isNaN(x));
    if (n !== undefined) {
      const hit = options.find((o) => {
        const r = optionRange(o.text);
        return r && n >= r[0] && n <= r[1];
      });
      if (hit) return hit;
    }
    return null;
  }

  function optionRange(text) {
    let t = String(text).toLowerCase().replace(/(\d)[.,'’\s](?=\d{3}(?!\d))/g, '$1');
    t = t.replace(/(\d+(?:[.,]\d+)?)\s*k\b/g, (m, x) => String(parseFloat(x.replace(',', '.')) * 1000));
    const nums = (t.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => parseFloat(x.replace(',', '.')));
    if (nums.length >= 2) return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
    if (nums.length === 1) {
      if (/oltre|over|more than|piu di|più di|above|maggiore|superiore|>|\+|or more|and above/.test(t)) return [nums[0], Infinity];
      if (/fino a|up to|less than|meno di|under|below|inferiore|minore|<|or less|entro/.test(t)) return [-Infinity, nums[0]];
    }
    return null;
  }

  const isNegativeOption = (o) => NEGATIVE_RE.test(FF.normalize(o.text)) || NEGATIVE_RE.test(FF.normalize(o.value));

  function fillSelect(el, candidates, ctx, prefer) {
    const options = [...el.options]
      .map((o, i) => ({ el: o, value: o.value, text: o.text, i }))
      .filter((x) => !x.el.disabled && !(x.el.parentElement && x.el.parentElement.disabled) && !isPlaceholderOption(x.el, x.i));
    if (!options.length) return false;
    let pick = (prefer && options.find(prefer)) || (candidates.length ? matchOption(options, candidates) : null);
    const how = pick ? null : 'fallback';
    if (!pick) pick = ctx.rng.pick(options);
    const indexes = [pick.i];
    if (el.multiple && options.length > 1 && ctx.rng.bool()) {
      const extra = ctx.rng.pick(options.filter((o) => o !== pick));
      indexes.push(extra.i);
    }
    setSelect(el, indexes);
    return { value: pick.text.trim(), how };
  }

  function coerceId(id, kind) {
    if (kind === 'email') return id === 'pec' ? 'pec' : 'email';
    if (kind === 'url') return id === 'social' ? 'social' : 'website';
    if (kind === 'password') return PASSWORD_OK.has(id) ? id : 'password';
    if (kind === 'tel') return TEL_OK.has(id) ? id : 'phone';
    if (kind === 'color') return 'color';
    if (kind === 'search' && !id) return 'search';
    if (DATE_KINDS.has(kind) && !DATE_IDS.has(id)) return kind === 'time' ? 'time' : 'date';
    if ((kind === 'textarea' || kind === 'editable') && (!id || TEXTAREA_SHORT.has(id))) return 'message';
    return id;
  }

  function parseBool(s) {
    const t = FF.normalize(s);
    if (/^(1|true|yes|si|on|check|checked)$/.test(t)) return true;
    if (/^(0|false|no|off|uncheck|unchecked)$/.test(t)) return false;
    return null;
  }

  function apply(f, val, ctx) {
    const { el, kind } = f;
    switch (kind) {
      case 'checkbox': {
        const b = typeof val === 'string' ? parseBool(val) : val;
        if (b === null || b === undefined) return false;
        return setChecked(el, b) ? { value: b ? '☑' : '☐' } : false;
      }
      case 'file': {
        const name = attachFile(el);
        return name ? { value: name } : false;
      }
      case 'select':
        return fillSelect(el, toList(val, f, ctx), ctx, f.id === 'kycNo' ? isNegativeOption : null);
      case 'number':
      case 'range': {
        const s = f.verbatim ? toList(val, f, ctx)[0] || '' : finalizeNumber(el, firstNumber(val), ctx.rng);
        typeInto(el, s);
        return { value: s };
      }
      case 'color': {
        const s = typeof val === 'string' && /^#[0-9a-f]{6}$/i.test(val) ? val : '#' + ctx.rng.chars(6, '0123456789abcdef');
        typeInto(el, s);
        return { value: s };
      }
      case 'editable': {
        const s = toList(val, f, ctx)[0] || '';
        setEditable(el, s);
        return { value: s };
      }
      default: {
        if (DATE_KINDS.has(kind)) {
          const s = finalizeDateKind(el, kind, val, ctx);
          typeInto(el, s);
          return { value: s };
        }
        let s;
        if (f.verbatim) {
          s = toList(val, f, ctx)[0] || '';
          if (el.maxLength > 0) s = s.slice(0, el.maxLength);
        } else s = finalizeText(el, toList(val, f, ctx), ctx);
        typeInto(el, s);
        return { value: s };
      }
    }
  }

  const savedOutline = new WeakMap();
  function highlight(el, how) {
    let target = el;
    if (!looksVisible(el)) target = (el.labels && el.labels[0]) || parentOf(el);
    if (!target || !target.style) return;
    if (!savedOutline.has(target)) savedOutline.set(target, [target.style.outline, target.style.outlineOffset]);
    target.style.outline = `2px solid ${HIGHLIGHT[how] || HIGHLIGHT.rule}`;
    target.style.outlineOffset = '1px';
    clearTimeout(target.__ffTimer);
    target.__ffTimer = setTimeout(() => {
      const [o, off] = savedOutline.get(target) || ['', ''];
      target.style.outline = o;
      target.style.outlineOffset = off;
      savedOutline.delete(target);
    }, 1800);
  }

  // ---------- Custom rules ("regex = value" per line) ----------

  function parseCustomRules(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('//')) continue;
      const m = t.match(/^(.+?)\s+=>?\s+(.*)$/) || t.match(/^(.+?)=(.*)$/);
      if (!m) continue;
      try {
        out.push({ re: new RegExp(m[1].trim(), 'i'), value: m[2].trim() });
      } catch (e) {
        /* invalid regex: ignore line */
      }
    }
    return out;
  }

  /** First custom rule matching any single source (label, name/id, placeholder, ...), raw or normalized. */
  function matchCustom(rules, sources) {
    if (!rules.length) return undefined;
    const texts = sources.map((s) => s[1]).filter(Boolean).flatMap((t) => [t.trim(), FF.normalize(t)]);
    for (const r of rules) if (texts.some((t) => r.re.test(t))) return r.value;
    return undefined;
  }

  // ---------- Context pass ----------

  function resolveContext(fields, scopeRoot) {
    const groups = new Map();
    for (const f of fields) {
      const key = f.el.form || scopeRoot;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    for (const list of groups.values()) {
      const ids = new Set(list.map((f) => f.id));
      const hasCard = ids.has('ccNumber') || ids.has('ccCvv');
      for (const f of list) {
        if (f.id === 'bareName') f.id = ids.has('lastName') ? 'firstName' : 'fullName';
        if (f.id === 'street' && ids.has('houseNumber')) f.streetOnly = true;
        if (!hasCard) {
          if (f.id === 'ccExp') f.id = 'futureDate';
          else if (f.id === 'ccExpMonth') f.id = 'month';
          else if (f.id === 'ccExpYear') f.id = 'year';
        } else if (f.id === 'month' || f.id === 'year') {
          f.id = f.id === 'month' ? 'ccExpMonth' : 'ccExpYear';
          continue;
        }
        if ((f.id === 'day' || f.id === 'month' || f.id === 'year' || f.id === 'date') &&
          BIRTH_RE.test(groupText(f.el, f.id === 'date' ? 1 : 3))) {
          f.id = { day: 'birthDay', month: 'birthMonth', year: 'birthYear', date: 'birthDate' }[f.id];
        }
      }
    }
  }

  // ---------- Radio groups ----------

  function textBefore(container, stopEl) {
    let out = '';
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n === stopEl) break;
      if (n.nodeType !== Node.TEXT_NODE) continue;
      const p = n.parentElement;
      if (p && p.closest(IGNORED_TEXT_PARENTS)) continue;
      out += ' ' + n.nodeValue;
    }
    out = out.replace(/\s+/g, ' ').trim();
    return out.length > 120 ? out.slice(-120) : out;
  }

  function optionText(r) {
    let t = r.labels && r.labels.length ? [...r.labels].map(textOf).join(' ') : '';
    if (!t) t = r.getAttribute('aria-label') || '';
    if (!t) {
      let s = r.nextSibling;
      while (s && s.nodeType === Node.TEXT_NODE && !s.nodeValue.trim()) s = s.nextSibling;
      if (s && s.nodeType === Node.TEXT_NODE) t = s.nodeValue.trim();
      else if (s && s.nodeType === Node.ELEMENT_NODE && !s.matches(FIELD_SEL)) t = textOf(s);
    }
    return clip(t, 80);
  }

  function groupRadios(radios, scopeRoot) {
    const formIds = new Map();
    const groups = new Map();
    for (const r of radios) {
      const form = r.form || scopeRoot;
      if (!formIds.has(form)) formIds.set(form, formIds.size);
      const key = r.name ? `${formIds.get(form)}|${r.name}` : r;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    return [...groups.values()];
  }

  function describeRadioGroup(radios) {
    const first = radios[0];
    let label = '';
    const rg = first.closest('[role="radiogroup"]');
    if (rg) {
      const lb = rg.getAttribute('aria-labelledby');
      label = rg.getAttribute('aria-label') || (lb ? idsText(rg, lb) : '');
    }
    let container = parentOf(first);
    while (container && !radios.every((r) => container.contains(r))) container = parentOf(container);
    let pre = '';
    if (container && container !== document.body && textOf(container).length < 400) pre = textBefore(container, first);
    const nearby = container && container !== document.body ? nearbyText(container) : '';
    return {
      sources: [['label', label], ['attr', [first.name, first.getAttribute('formcontrolname')].filter(Boolean).join(' ')],
        ['nearby', pre], ['nearby', nearby], ['legend', legendText(first)]],
      hint: '',
    };
  }

  // ---------- Split fields (card / IBAN / sort code / OTP spread over short boxes) ----------

  const SEGMENTABLE = new Set(['ccNumber', 'iban', 'sortCode', 'accountNumber', 'phone', 'mobile', 'landline', 'ssn', 'otp',
    'codiceFiscale', 'partitaIva', 'postalCode', 'pagopaNotice', 'customerNumber', 'ccExp', 'birthDate', 'date', 'futureDate',
    'docIssueDate', 'postalAccount', 'billNumber']);
  const SEGMENT_KINDS = new Set(['text', 'tel', 'number', 'password']);
  const shortField = (el) => (el.maxLength > 0 && el.maxLength <= 6) ||
    (+el.getAttribute('size') > 0 && +el.getAttribute('size') <= 6);

  function closeTogether(a, b) {
    let n = a;
    for (let k = 0; k < 3 && n; k++) {
      n = parentOf(n);
      if (n && n.contains(b)) return true;
    }
    return false;
  }

  /** A short field followed by short unlabeled (or same-type) neighbours is one value split across boxes. */
  function findSegments(fields) {
    for (let i = 0; i < fields.length; i++) {
      const head = fields[i];
      if (!SEGMENTABLE.has(head.id) || !SEGMENT_KINDS.has(head.kind) || !shortField(head.el)) continue;
      const run = [head];
      for (let j = i + 1; j < fields.length; j++) {
        const g = fields[j];
        const sameValue = g.id === head.id || !g.id || g.weak || (head.id === 'otp' && g.id === 'secretChar');
        if (!sameValue || !SEGMENT_KINDS.has(g.kind) || !closeTogether(run[run.length - 1].el, g.el)) break;
        if (!shortField(g.el) && g.id !== head.id) break;
        run.push(g);
        if (!shortField(g.el)) break;
      }
      if (run.length < 2) continue;
      const seg = { run, values: null };
      run.forEach((g, k) => Object.assign(g, { segment: seg, segIndex: k, id: head.id }));
      i += run.length - 1;
    }
  }

  function segmentValues(seg, makeCtx) {
    const head = seg.run[0];
    const ctx = { ...makeCtx(head), maxLength: 0 };
    const full = (toList(FF.generate(head.id, ctx), head, ctx)[0] || '').replace(/[^A-Za-z0-9]/g, '');
    let pos = 0;
    return seg.run.map((g, k) => {
      const size = g.el.maxLength > 0 ? g.el.maxLength : +g.el.getAttribute('size') || Infinity;
      const part = full.slice(pos, k === seg.run.length - 1 ? undefined : pos + size);
      pos += part.length;
      return part;
    });
  }

  // Shared with content/flutter.js
  FF.dom = {
    deepQueryAll, deepActiveElement, describe, textOf, sectionHeading, nativeSetter, highlight, toList, finalizeText,
    finalizeNumber, firstNumber, matchOption, isNegativeOption, coerceId, resolveContext, parseCustomRules, matchCustom,
    parseBool, CONSENT_RE, POSITIVE_RE, NEGATED_STATEMENT_RE, BENEFICIARY_RE,
  };

  // ---------- Main ----------

  FF.run = function (opts = {}) {
    // Flutter web draws on a canvas: handled by content/flutter.js (asynchronous, returns a Promise).
    if (FF.flutter && FF.flutter.detect()) return FF.flutter.run(opts);
    const settings = { ...(opts.settings || {}) };
    const result = { filled: 0, skipped: 0, total: 0, frame: location.href, top: window === window.top };
    const scope = resolveScope(opts.scope || 'page');
    if (!scope) return { ...result, inactive: true };
    const els = collect(scope, settings);
    FF.focusState = { el: deepActiveElement(), x: window.scrollX, y: window.scrollY };

    if (opts.action === 'clear') {
      for (const el of els) {
        const kind = kindOf(el);
        if (!kind || (kind !== 'editable' && el.matches(':disabled')) || el.readOnly) continue;
        if (!scope.single && !settings.includeHidden && !isUsable(el, kind)) continue;
        result.total++;
        if (kind === 'checkbox' || kind === 'radio') {
          if (!el.checked) continue;
          const set = nativeSetter(el, 'checked');
          if (set) set.call(el, false);
          else el.checked = false;
          fire(el, 'input');
          fire(el, 'change');
        } else if (kind === 'select') {
          const idx = el.multiple ? -1 : [...el.options].findIndex((o, i) => isPlaceholderOption(o, i));
          if (el.multiple ? !el.selectedOptions.length : idx < 0 || el.selectedIndex === idx) continue;
          setSelect(el, [idx]);
        } else if (kind === 'file') {
          if (!el.files || !el.files.length) continue;
          el.value = '';
          fire(el, 'change');
        } else if (kind === 'editable') {
          if (!el.textContent) continue;
          el.textContent = '';
          fire(el, 'input');
        } else if (kind === 'range' || kind === 'color' || !el.value) {
          continue;
        } else typeInto(el, '');
        result.filled++;
      }
      return result;
    }

    simulateTyping = !!settings.simulateTyping;
    const seed = opts.seed >>> 0;
    const locale = FF.detectLocale(settings);
    const p = FF.createPersona(seed, locale, settings, opts.ts);
    const rng = FF.makeRng((seed ^ 0x9e3779b9) >>> 0);
    const D = FF.data[locale];
    const custom = parseCustomRules(settings.customRules);
    const rows = [];

    const fields = [];
    const radios = [];
    for (const el of els) {
      const kind = kindOf(el);
      if (!kind) continue;
      if (kind !== 'editable' && el.matches(':disabled')) continue;
      if (!scope.single && !settings.includeHidden && !isUsable(el, kind)) continue;
      if (kind === 'radio') radios.push(el);
      else fields.push({ el, kind, desc: describe(el) });
    }

    for (const f of fields) {
      let acId = FF.fromAutocomplete(f.desc.ac);
      if (acId === 'password' && f.kind !== 'password') acId = null; // autocomplete="new-password" used to block autofill
      const text = FF.classify(f.desc.sources, f.kind);
      if (acId && !(acId === 'fullName' && text && /^(firstName|lastName|bareName|middleName)$/.test(text.id))) {
        f.id = acId;
        f.via = 'autocomplete';
      } else {
        f.id = text ? text.id : null;
        f.via = text ? text.src : null;
        f.weak = !!(text && text.weak);
      }
      // Fields about a beneficiary / payee get a second, different identity.
      f.benef = BENEFICIARY_RE.test(FF.normalize(`${f.desc.sources.map((s) => s[1]).join(' ')} ${sectionHeading(f.el)}`));
    }
    fields.filter((f) => f.kind === 'select').forEach(refineSelect);
    resolveContext(fields, scope.root);
    findSegments(fields);

    const makeCtx = (f) => ({
      p: f.benef ? p.beneficiary : p, rng, locale, D, kind: f.kind, el: f.el, hint: f.desc.hint, streetOnly: !!f.streetOnly,
      text: FF.normalize(f.desc.sources.map((s) => s[1]).join(' ')),
      maxLength: f.el.maxLength > 0 ? f.el.maxLength : 0,
    });
    const log = (f, value, how) => rows.push({
      kind: f.kind, detected: f.id || '-', via: f.via || '-', how, field: clip(f.el.name || f.el.id || '', 40),
      label: clip((f.desc.sources.find((s) => s[1]) || ['', ''])[1], 40), value: clip(String(value), 50),
    });

    for (const f of fields) {
      const { el, kind } = f;
      result.total++;
      const lockedOut = el.readOnly && kind !== 'select' && !(DATE_IDS.has(f.id) && !el.value) && !unlockReadonly(el, kind);
      // PIN field driven by an on-screen keypad (read-only, or no virtual keyboard): click the digits.
      const secretLike = ['otp', 'secretChar', 'customerNumber'].includes(f.id) || kind === 'password';
      if (secretLike && (lockedOut || el.getAttribute('inputmode') === 'none')) {
        const keys = findKeypad(el);
        if (keys) {
          const kctx = makeCtx(f);
          const id = ['otp', 'secretChar', 'customerNumber'].includes(f.id) ? f.id : 'otp';
          const digits = String(FF.generate(id, f.id === id ? kctx : { ...kctx, text: `${kctx.text} pin` })).replace(/\D/g, '');
          if (digits && pressKeypad(keys, digits)) {
            result.filled++;
            if (settings.highlight !== false) highlight(el, 'rule');
            log(f, `keypad ${digits}`, 'rule');
            continue;
          }
        }
      }
      if (lockedOut) {
        result.skipped++;
        log(f, '(read-only)', 'skip');
        continue;
      }
      if (!settings.overwrite && !isEmpty(el, kind)) {
        result.skipped++;
        log(f, '(has value)', 'skip');
        continue;
      }
      const ctx = makeCtx(f);
      let how = 'rule';
      let val;
      const cv = matchCustom(custom, f.desc.sources);
      if (cv !== undefined) {
        how = 'custom';
        val = /^\{skip\}$/i.test(cv) ? FF.SKIP : FF.template(cv, p.vars);
        f.verbatim = true;
      } else if (f.segment) {
        if (!f.segment.values) f.segment.values = segmentValues(f.segment, makeCtx);
        val = f.segment.values[f.segIndex];
        f.verbatim = true;
      } else if (kind === 'checkbox') {
        const consent = CONSENT_RE.test(ctx.text);
        // "I am a PEP" stays unticked; "I am NOT a PEP" gets ticked.
        if (f.id === 'kycNo') val = NEGATED_STATEMENT_RE.test(ctx.text);
        else if (settings.checkboxMode === 'required') val = el.required || consent ? true : null;
        else if (settings.checkboxMode === 'random') val = el.required || consent ? true : rng.bool();
        else val = true;
      } else if (kind === 'file') {
        val = settings.attachFiles === false ? FF.SKIP : true;
      } else {
        f.id = coerceId(f.id, kind);
        val = f.id ? FF.generate(f.id, ctx) : undefined;
        if (val == null || (Array.isArray(val) && !val.length)) {
          how = 'fallback';
          val = FF.fallbackValue(kind, ctx);
        }
      }
      if (val === FF.SKIP) {
        result.skipped++;
        log(f, '(skipped)', 'skip');
        continue;
      }
      let res = false;
      try {
        res = apply(f, val, ctx);
      } catch (e) {
        res = false;
      }
      if (res) {
        how = res.how || how;
        result.filled++;
        if (settings.highlight !== false) highlight(el, how);
        log(f, res.value, how);
      } else {
        result.skipped++;
        log(f, '(unchanged)', 'skip');
      }
    }

    for (const group of groupRadios(radios, scope.root)) {
      result.total++;
      const desc = describeRadioGroup(group);
      const f = { el: group[0], kind: 'radio', desc };
      const enabled = group.filter((r) => !r.matches(':disabled'));
      if (!enabled.length) continue;
      if (!settings.overwrite && group.some((r) => r.checked)) {
        result.skipped++;
        log(f, '(has value)', 'skip');
        continue;
      }
      const options = enabled.map((r) => ({ el: r, value: r.value, text: optionText(r) }));
      const ctx = makeCtx(f);
      const optText = options.map((o) => FF.normalize(`${o.text} ${o.value}`)).join(' | ');
      const c = FF.classify(desc.sources, 'radio');
      f.id = c ? c.id : null;
      f.via = c ? c.src : null;
      if (!f.id && options.some((o) => GENDER_M.test(FF.normalize(o.text || o.value))) &&
        options.some((o) => GENDER_F.test(FF.normalize(o.text || o.value)))) {
        f.id = 'gender';
        f.via = 'options';
      }
      let how = 'rule';
      let pick = null;
      const cv = matchCustom(custom, desc.sources);
      if (cv !== undefined) {
        if (/^\{skip\}$/i.test(cv)) {
          result.skipped++;
          log(f, '(skipped)', 'skip');
          continue;
        }
        how = 'custom';
        pick = matchOption(options, [FF.template(cv, p.vars)]);
      } else if (f.id === 'kycNo') {
        pick = options.find(isNegativeOption) || null;
      } else if (f.id && f.id !== 'bareName') {
        const v = FF.generate(f.id, ctx);
        if (v !== FF.SKIP) pick = matchOption(options, toList(v, f, ctx));
      }
      if (!pick && (CONSENT_RE.test(ctx.text) || CONSENT_RE.test(optText))) {
        pick = options.find((o) => POSITIVE_RE.test(FF.normalize(o.text)) || POSITIVE_RE.test(FF.normalize(o.value)));
      }
      if (!pick) {
        how = 'fallback';
        pick = rng.pick(options);
      }
      if (setChecked(pick.el, true)) {
        result.filled++;
        if (settings.highlight !== false) highlight(pick.el, how);
        log(f, pick.text || pick.value, how);
      } else {
        result.skipped++;
      }
    }

    FF.settleFocus();

    if (settings.debug) {
      console.groupCollapsed(`[Form Filler] ${result.filled}/${result.total} fields · ${locale} · ${location.href}`);
      console.table(rows);
      console.groupEnd();
    }
    return { ...result, locale, persona: p.summary, rows: settings.debug ? rows : undefined };
  };
})();
