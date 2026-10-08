/* Form Filler – Flutter web support.
 * Flutter draws its UI on a canvas, so a page has no form fields in the DOM until Flutter's accessibility tree
 * ("semantics") is switched on. Then every TextField becomes an <input>/<textarea> labelled with aria-label, and
 * checkboxes / radios / dropdowns become role=checkbox / radio / button nodes. A value only reaches the app if the
 * field is focused and connected first, so fields are visited one at a time:
 *   focus → wait until Flutter connects it (it rewrites the input's attributes) → set value + `input` event. */
(() => {
  'use strict';
  const FF = globalThis.__FF;
  if (!FF || !FF.dom || FF.flutter) return;
  const D = FF.dom;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Two animation frames (Flutter renders/handles input per frame), with a timeout for background tabs. */
  const frames = () => new Promise((r) => {
    const t = setTimeout(r, 80);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clearTimeout(t);
      r();
    }));
  });

  const detect = () => !!document.querySelector('flutter-view, flt-glass-pane');
  const hosts = () => D.deepQueryAll(document, 'flt-semantics-host');
  const inHosts = (sel) => hosts().flatMap((h) => [...h.querySelectorAll(sel)]);
  const semanticsCount = () => inHosts('flt-semantics').length;
  const hasSize = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const labelOf = (el) => (el.getAttribute('aria-label') || D.textOf(el) || '').trim();

  /** Switch on Flutter's accessibility tree (the hidden "Enable accessibility" button) and wait until it is built. */
  async function ensureSemantics() {
    if (semanticsCount() > 1) return true;
    const placeholder = D.deepQueryAll(document, 'flt-semantics-placeholder')[0];
    if (!placeholder) return false;
    placeholder.click();
    let last = -1;
    for (let i = 0; i < 60; i++) {
      await wait(50);
      const n = semanticsCount();
      if (n > 1 && n === last) return true;
      last = n;
    }
    return semanticsCount() > 1;
  }

  function kindOf(el) {
    if (el.tagName === 'TEXTAREA') return 'textarea';
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    return ['email', 'tel', 'password', 'number', 'url', 'search'].includes(t) ? t : 'text';
  }

  const isTextInput = (el) => !!el && /^(INPUT|TEXTAREA)$/.test(el.tagName);
  // Flutter's own hidden editing input (used when a field was focused before the accessibility tree was on).
  const isEditingInput = (el) => isTextInput(el) && !!el.closest('flt-text-editing-host');

  /** Blur whatever has focus and let Flutter close the text connection. */
  async function release() {
    const a = D.deepActiveElement();
    if (!a || a === document.body || !a.blur) return;
    a.blur();
    await frames();
    await frames();
  }

  /** Leave nothing focused: Flutter refocuses a dropdown when its menu finishes closing, so keep checking a while. */
  async function settleFocus() {
    for (let calm = 0, i = 0; i < 25 && calm < 4; i++) {
      const a = D.deepActiveElement();
      if (a && a !== document.body && a.blur && a.closest && a.closest('flt-semantics-host, flt-text-editing-host')) {
        a.blur();
        calm = 0;
      } else calm++;
      await frames();
    }
  }

  /**
   * Focus a field and wait until Flutter has connected it (it rewrites the input's attributes / its editing input).
   * Returns the element that now receives text: the field itself, or Flutter's hidden editing input.
   */
  async function activate(el) {
    const current = D.deepActiveElement();
    if (current === el) return el;
    // Flutter's hidden editing input pulls focus back to itself: release it before switching fields.
    if (isEditingInput(current)) await release();
    const host = D.deepQueryAll(document, 'flt-text-editing-host')[0];
    const connected = new Promise((resolve) => {
      const mo = new MutationObserver(() => {
        mo.disconnect();
        clearTimeout(timer);
        resolve(true);
      });
      const timer = setTimeout(() => {
        mo.disconnect();
        resolve(false);
      }, 1500);
      mo.observe(el, { attributes: true });
      if (host) mo.observe(host, { attributes: true, childList: true, subtree: true });
    });
    el.focus({ preventScroll: true });
    // Without window focus (e.g. the toolbar popup is open) the browser may not fire `focus`: Flutter needs it.
    if (!document.hasFocus()) el.dispatchEvent(new FocusEvent('focus'));
    await connected;
    await frames(); // Flutter writes the field's current text into the input right after connecting
    const a = D.deepActiveElement();
    return isTextInput(a) ? a : el;
  }

  function setValue(el, value) {
    D.nativeSetter(el, 'value').call(el, value);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: value }));
  }

  /** Items of the menu a dropdown opened: role=menuitem/option nodes that were not there before the click. */
  async function openMenu(button) {
    const before = new Set(inHosts('[role="menuitem"], [role="option"]'));
    button.click();
    for (let i = 0; i < 30; i++) {
      await wait(50);
      const items = inHosts('[role="menuitem"], [role="option"]').filter((n) => !before.has(n) && hasSize(n));
      if (items.length) {
        await frames();
        return items;
      }
    }
    return [];
  }

  async function waitGone(nodes) {
    for (let i = 0; i < 30 && nodes.some((n) => n.isConnected); i++) await wait(50);
  }

  // Ids tried for dropdowns without a readable label: the option list itself tells what the field is.
  const INFER_IDS = ['province', 'region', 'country', 'gender', 'salutation', 'city', 'nationality', 'language', 'currency',
    'maritalStatus', 'education', 'employmentStatus', 'accountType', 'sourceOfFunds', 'accountPurpose', 'loanPurpose', 'docType'];

  async function run(opts = {}) {
    const settings = { ...(opts.settings || {}) };
    FF.focusState = null; // focus is managed here, not by the runner's settleFocus
    const result = { filled: 0, skipped: 0, total: 0, frame: location.href, top: window === window.top, flutter: true };
    const t0 = performance.now();
    const timing = {};
    const mark = (k) => { timing[k] = Math.round(performance.now() - t0); };
    const semantics = await ensureSemantics();
    mark('semantics');

    const seed = opts.seed >>> 0;
    const locale = FF.detectLocale(settings);
    const p = FF.createPersona(seed, locale, settings, opts.ts);
    const rng = FF.makeRng((seed ^ 0x9e3779b9) >>> 0);
    const Dl = FF.data[locale];
    const custom = D.parseCustomRules(settings.customRules);
    const rows = [];
    const done = (value, f, how) => {
      result.filled++;
      if (settings.highlight !== false) D.highlight(f.el, how);
      rows.push({ kind: f.kind, detected: f.id || '-', via: f.via || '-', how, label: (f.label || '').slice(0, 40), value: String(value).slice(0, 50) });
    };
    const makeCtx = (f) => ({
      p: f.benef ? p.beneficiary : p, rng, locale, D: Dl, kind: f.kind, el: f.el, hint: f.desc.hint, streetOnly: !!f.streetOnly,
      text: FF.normalize(f.desc.sources.map((s) => s[1]).join(' ')), maxLength: f.el.maxLength > 0 ? f.el.maxLength : 0,
    });

    // Text fields: semantics inputs, or (accessibility unavailable) only the field Flutter is currently editing.
    let texts = semantics
      ? inHosts('input, textarea').filter(hasSize)
      : D.deepQueryAll(document, 'flt-text-editing-host input, flt-text-editing-host textarea');
    const target = globalThis.__ffContextTarget;
    if (opts.scope === 'field') texts = texts.filter((el) => el === target || (target && target.contains && target.contains(el)));

    if (opts.action === 'clear') {
      for (const el of texts) {
        result.total++;
        if (!el.value) continue;
        setValue(await activate(el), '');
        await frames();
        result.filled++;
      }
      if (opts.scope !== 'field') {
        for (const el of inHosts('[role="checkbox"][aria-checked="true"], [role="switch"][aria-checked="true"]')) {
          result.total++;
          el.click();
          await frames();
          result.filled++;
        }
      }
      await release();
      return { ...result, locale };
    }

    const fields = texts.map((el) => ({ el, kind: kindOf(el), desc: D.describe(el), label: el.getAttribute('aria-label') || '' }));
    for (const f of fields) {
      let acId = FF.fromAutocomplete(f.desc.ac);
      if (acId === 'password' && f.kind !== 'password') acId = null;
      const c = FF.classify(f.desc.sources, f.kind);
      if (acId && !(acId === 'fullName' && c && /^(firstName|lastName|bareName|middleName)$/.test(c.id))) {
        f.id = acId;
        f.via = 'autocomplete';
      } else {
        f.id = c ? c.id : null;
        f.via = c ? c.src : null;
        f.weak = !!(c && c.weak);
      }
      f.benef = D.BENEFICIARY_RE.test(FF.normalize(`${f.desc.sources.map((s) => s[1]).join(' ')} ${D.sectionHeading(f.el)}`));
    }
    D.resolveContext(fields, document);

    for (const f of fields) {
      result.total++;
      if (!settings.overwrite && f.el.value) {
        result.skipped++;
        continue;
      }
      const ctx = makeCtx(f);
      let how = 'rule';
      let value;
      const cv = D.matchCustom(custom, f.desc.sources);
      if (cv !== undefined) {
        if (/^\{skip\}$/i.test(cv)) {
          result.skipped++;
          continue;
        }
        how = 'custom';
        value = FF.template(cv, p.vars);
      } else {
        f.id = D.coerceId(f.id, f.kind);
        let val = f.id ? FF.generate(f.id, ctx) : undefined;
        if (val === FF.SKIP) {
          result.skipped++;
          continue;
        }
        if (val == null || (Array.isArray(val) && !val.length)) {
          how = 'fallback';
          val = FF.fallbackValue(f.kind, ctx);
        }
        value = f.kind === 'number' ? D.finalizeNumber(f.el, D.firstNumber(val), rng) : D.finalizeText(f.el, D.toList(val, f, ctx), ctx);
      }
      setValue(await activate(f.el), value);
      done(value, f, how);
    }
    // Leave no field focused (Flutter keeps the values).
    await release();
    mark('texts');
    if (!semantics || opts.scope === 'field') return finish();

    // Checkboxes and switches
    for (const el of inHosts('[role="checkbox"], [role="switch"]').filter(hasSize)) {
      result.total++;
      const f = { el, kind: 'checkbox', label: labelOf(el), desc: { sources: [['label', labelOf(el)]], hint: '' } };
      const text = FF.normalize(f.label);
      const c = FF.classify(f.desc.sources, 'checkbox');
      f.id = c ? c.id : null;
      const cv = D.matchCustom(custom, f.desc.sources);
      let want;
      if (cv !== undefined) want = /^\{skip\}$/i.test(cv) ? null : D.parseBool(FF.template(cv, p.vars));
      else if (f.id === 'kycNo') want = D.NEGATED_STATEMENT_RE.test(text);
      else if (settings.checkboxMode === 'required') want = D.CONSENT_RE.test(text) ? true : null;
      else if (settings.checkboxMode === 'random') want = D.CONSENT_RE.test(text) ? true : rng.bool();
      else want = true;
      const checked = el.getAttribute('aria-checked') === 'true';
      if (want === null || want === undefined || (!settings.overwrite && checked)) {
        result.skipped++;
        continue;
      }
      if (checked !== want) {
        el.click();
        await frames();
      }
      done(want ? '☑' : '☐', f, cv !== undefined ? 'custom' : 'rule');
    }

    // Radio groups: consecutive role=radio siblings; the label is the text node just before the group.
    const groups = [];
    for (const r of inHosts('[role="radio"]').filter(hasSize)) {
      const g = groups[groups.length - 1];
      if (g && g[g.length - 1].nextElementSibling === r) g.push(r);
      else groups.push([r]);
    }
    for (const group of groups) {
      result.total++;
      const prev = group[0].previousElementSibling;
      const rg = group[0].closest('[role="radiogroup"]');
      const groupLabel = (rg && labelOf(rg)) || (prev && !prev.getAttribute('role') ? labelOf(prev) : '');
      const f = { el: group[0], kind: 'radio', label: groupLabel, desc: { sources: [['label', groupLabel]], hint: '' } };
      if (!settings.overwrite && group.some((r) => r.getAttribute('aria-checked') === 'true')) {
        result.skipped++;
        continue;
      }
      const options = group.map((r) => ({ el: r, value: '', text: labelOf(r) }));
      const c = FF.classify(f.desc.sources, 'radio');
      f.id = c ? c.id : null;
      let how = 'rule';
      let pick = null;
      const cv = D.matchCustom(custom, f.desc.sources);
      if (cv !== undefined) {
        how = 'custom';
        pick = D.matchOption(options, [FF.template(cv, p.vars)]);
      } else if (f.id === 'kycNo') {
        pick = options.find(D.isNegativeOption) || null;
      } else if (f.id && f.id !== 'bareName') {
        const v = FF.generate(f.id, makeCtx(f));
        if (v !== FF.SKIP) pick = D.matchOption(options, D.toList(v, f, makeCtx(f)));
      }
      if (!pick) {
        const optText = options.map((o) => FF.normalize(o.text)).join(' | ');
        if (D.CONSENT_RE.test(FF.normalize(groupLabel)) || D.CONSENT_RE.test(optText)) {
          pick = options.find((o) => D.POSITIVE_RE.test(FF.normalize(o.text))) || null;
        } else if (options.some((o) => /\b(maschio|male|uomo)\b/.test(FF.normalize(o.text)))) {
          pick = D.matchOption(options, D.toList(FF.generate('gender', makeCtx(f)), f, makeCtx(f)));
        }
      }
      if (!pick) {
        how = 'fallback';
        pick = rng.pick(options);
      }
      if (pick.el.getAttribute('aria-checked') !== 'true') {
        pick.el.click();
        await frames();
      }
      done(pick.text, f, how);
    }

    // Dropdowns (DropdownButtonFormField & co.: an expandable button that is a form field, i.e. has aria-invalid).
    for (const el of inHosts('[role="button"][aria-expanded="false"][aria-invalid], [role="combobox"][aria-expanded="false"]').filter(hasSize)) {
      result.total++;
      const label = labelOf(el);
      const f = { el, kind: 'select', label, desc: { sources: [['label', label]], hint: '' } };
      const items = await openMenu(el);
      if (!items.length) {
        result.skipped++;
        continue;
      }
      const options = items.map((n) => ({ el: n, value: '', text: labelOf(n) }));
      const c = FF.classify(f.desc.sources, 'select');
      f.id = c ? c.id : null;
      let how = 'rule';
      let pick = null;
      const cv = D.matchCustom(custom, f.desc.sources);
      if (cv !== undefined) {
        how = 'custom';
        pick = D.matchOption(options, [FF.template(cv, p.vars)]);
      } else if (f.id === 'kycNo') {
        pick = options.find(D.isNegativeOption) || null;
      } else if (f.id) {
        const v = FF.generate(f.id, makeCtx(f));
        if (v !== FF.SKIP) pick = D.matchOption(options, D.toList(v, f, makeCtx(f)));
      } else {
        for (const id of INFER_IDS) {
          const v = FF.generate(id, makeCtx(f));
          pick = D.matchOption(options, D.toList(v, f, makeCtx(f)));
          if (pick) {
            f.id = id;
            f.via = 'options';
            break;
          }
        }
      }
      if (!pick) {
        how = 'fallback';
        pick = rng.pick(options);
      }
      pick.el.click();
      await waitGone(items);
      await frames();
      done(pick.text, f, how);
    }
    mark('dropdowns');
    await settleFocus();
    return finish();

    function finish() {
      if (settings.debug) {
        console.groupCollapsed(`[Form Filler] Flutter: ${result.filled}/${result.total} fields · ${locale}`);
        console.table(rows);
        console.groupEnd();
      }
      mark('total');
      return { ...result, locale, persona: p.summary, rows: settings.debug ? rows : undefined, timing: settings.debug ? timing : undefined };
    }
  }

  FF.flutter = { detect, run };
})();
