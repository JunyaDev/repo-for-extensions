/* Form Filler – toolbar popup. */
const t = (key, subs) => ffApi.i18n.getMessage(key, subs) || key;
const $ = (id) => document.getElementById(id);

const PERSONA_FIELDS = [
  ['name', 'idName'], ['email', 'idEmail'], ['username', 'idUsername'], ['password', 'idPassword'],
  ['phone', 'idPhone'], ['address', 'idAddress'], ['birthDate', 'idBirthDate'], ['company', 'idCompany'],
  ['cf', 'idCf'], ['piva', 'idPiva'], ['iban', 'idIban'], ['card', 'idCard'], ['pin', 'idPin'],
  ['memorable', 'idMemorable'], ['beneficiary', 'idBeneficiary'], ['beneficiaryIban', 'idBeneficiaryIban'],
];

function localize() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  });
}

function renderPersona(p) {
  const dl = $('persona');
  dl.textContent = '';
  $('noPersona').hidden = !!p;
  if (!p) return;
  for (const [key, label] of PERSONA_FIELDS) {
    if (!p[key]) continue;
    const dt = document.createElement('dt');
    dt.textContent = t(label);
    const dd = document.createElement('dd');
    dd.textContent = p[key];
    dd.title = t('popupCopyHint');
    dd.addEventListener('click', async () => {
      const value = key === 'card' ? p[key].split(' · ')[0] : p[key];
      await navigator.clipboard.writeText(value);
      dd.classList.add('copied');
      setTimeout(() => dd.classList.remove('copied'), 700);
    });
    dl.append(dt, dd);
  }
}

function setStatus(text, cls = '') {
  const s = $('status');
  s.textContent = text;
  s.className = `status ${cls}`;
}

function renderLocale(locale) {
  document.querySelectorAll('#locale button').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.locale === locale));
  });
}

async function run(request) {
  const buttons = document.querySelectorAll('.actions button');
  buttons.forEach((b) => { b.disabled = true; });
  try {
    const [tab] = await ffApi.tabs.query({ active: true, currentWindow: true });
    const res = await ffExecute(tab.id, request);
    if (!res.ok) {
      setStatus(t('popupError'), 'err');
      return;
    }
    if (!res.total) {
      setStatus(t('popupNoFields'));
    } else {
      let msg = res.action === 'clear'
        ? t('popupCleared', [String(res.filled)])
        : t('popupFilled', [String(res.filled), String(res.total)]);
      if (res.frames > 1) msg += ` · ${t('popupFrames', [String(res.frames)])}`;
      if (res.locale) msg += ` · ${res.locale.toUpperCase()}`;
      setStatus(msg, 'ok');
    }
    if (res.persona) renderPersona(res.persona);
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
  }
}

async function init() {
  localize();
  const settings = await ffLoadSettings();
  const { lastPersona } = await ffApi.storage.local.get('lastPersona');
  renderLocale(settings.locale);
  $('keepIdentity').checked = settings.keepIdentity;
  renderPersona(lastPersona || null);

  document.querySelectorAll('#locale button').forEach((b) => {
    b.addEventListener('click', async () => {
      await ffSaveSettings({ locale: b.dataset.locale });
      renderLocale(b.dataset.locale);
    });
  });
  $('keepIdentity').addEventListener('change', (e) => ffSaveSettings({ keepIdentity: e.target.checked }));
  $('fillPage').addEventListener('click', () => run({ action: 'fill', scope: 'page' }));
  $('fillForm').addEventListener('click', () => run({ action: 'fill', scope: 'focused' }));
  $('newIdentity').addEventListener('click', () => run({ action: 'fill', scope: 'page', newIdentity: true }));
  $('clear').addEventListener('click', () => run({ action: 'clear', scope: 'page' }));
  $('openOptions').addEventListener('click', () => ffApi.runtime.openOptionsPage());
}

init();
