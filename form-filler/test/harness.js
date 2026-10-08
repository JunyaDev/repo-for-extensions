/* Headless test harness. Open a test page with ?harness[&seed=42][&locale=en-GB][&rules=...][&action=clear][&typing=1]:
 * the content scripts run directly in the page and the results are written as JSON into #ff-results. */
(() => {
  const params = new URLSearchParams(location.search);
  if (!params.has('harness')) return;
  const files = ['core', 'data', 'generators', 'rules', 'samples', 'filler'];
  const allFields = (root, out = []) => {
    root.querySelectorAll('input, select, textarea').forEach((e) => out.push(e));
    root.querySelectorAll('*').forEach((e) => e.shadowRoot && allFields(e.shadowRoot, out));
    return out;
  };
  const load = (f) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `../content/${f}.js`;
    s.onload = res;
    s.onerror = rej;
    document.head.append(s);
  });
  window.addEventListener('load', async () => {
    const out = document.getElementById('ff-results');
    try {
      for (const f of files) await load(f);
      const settings = {
        locale: params.get('locale') || 'auto', fallbackLocale: 'it', overwrite: true, includeHidden: false,
        checkboxMode: 'all', attachFiles: true, fillContentEditable: true, highlight: false, debug: true,
        simulateTyping: params.get('typing') === '1', emailTemplate: '{first}.{last}{n}@example.com', fixedPassword: '',
        customRules: params.get('rules') || '',
      };
      let res = window.__FF.run({ action: 'fill', scope: 'page', seed: +(params.get('seed') || 42), ts: 1, settings });
      if (params.get('action') === 'clear') res = { ...window.__FF.run({ action: 'clear', scope: 'page', settings }), rows: [] };
      const fields = allFields(document).map((el) => {
        let v;
        if (el.type === 'checkbox' || el.type === 'radio') v = el.checked ? 'CHECKED' : '';
        else if (el.tagName === 'SELECT') v = [...el.selectedOptions].map((o) => o.text).join(', ');
        else if (el.type === 'file') v = el.files.length ? `${el.files[0].name} (${el.files[0].type}, ${el.files[0].size}B)` : '';
        else v = el.value;
        const form = (el.closest('form, [data-section]') || {}).id || (el.getRootNode() instanceof ShadowRoot ? '(shadow)' : '');
        return { form, name: el.name || el.id || el.getAttribute('aria-label') || '', type: el.type, value: v };
      });
      document.querySelectorAll('[contenteditable]').forEach((el) => {
        fields.push({ form: (el.closest('form') || {}).id || '', name: 'contenteditable', type: 'editable', value: el.textContent });
      });
      out.textContent = JSON.stringify({ summary: { ...res, rows: undefined }, rows: res.rows, fields }, null, 1);
    } catch (e) {
      out.textContent = `ERROR ${e}\n${e.stack}`;
    }
  });
})();
