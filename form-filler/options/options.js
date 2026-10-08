/* Form Filler – options page: every [data-setting] control auto-saves. */
const t = (key) => ffApi.i18n.getMessage(key) || '';

document.querySelectorAll('[data-i18n]').forEach((el) => {
  const msg = t(el.dataset.i18n);
  if (msg) el.textContent = msg;
});

let savedTimer;
function flashSaved() {
  const s = document.getElementById('saved');
  s.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { s.hidden = true; }, 1200);
}

function render(settings) {
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const v = settings[el.dataset.setting];
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v ?? '';
  });
}

async function init() {
  render(await ffLoadSettings());
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const save = async () => {
      const value = el.type === 'checkbox' ? el.checked : el.value;
      await ffSaveSettings({ [el.dataset.setting]: value });
      flashSaved();
    };
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', debounce(save, 300));
  });
  document.getElementById('reset').addEventListener('click', async () => {
    if (!confirm(t('optResetConfirm'))) return;
    await ffSaveSettings({ ...FF_DEFAULTS });
    render(FF_DEFAULTS);
    flashSaved();
  });
}

function debounce(fn, ms) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
}

init();
