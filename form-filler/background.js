/* Form Filler – background: context menus, keyboard shortcuts, toolbar badge. */
if (typeof importScripts === 'function') importScripts('shared/settings.js', 'shared/runner.js');

const t = (key) => ffApi.i18n.getMessage(key) || key;
const MENU_CONTEXTS = ['page', 'frame', 'editable', 'selection', 'link', 'image'];

async function createMenus() {
  await ffApi.contextMenus.removeAll();
  ffApi.contextMenus.create({ id: 'ff-fill-page', title: t('menuFillPage'), contexts: MENU_CONTEXTS });
  ffApi.contextMenus.create({ id: 'ff-fill-form', title: t('menuFillForm'), contexts: MENU_CONTEXTS });
  ffApi.contextMenus.create({ id: 'ff-fill-field', title: t('menuFillField'), contexts: ['editable'] });
  ffApi.contextMenus.create({ id: 'ff-clear-form', title: t('menuClearForm'), contexts: MENU_CONTEXTS });
}

ffApi.runtime.onInstalled.addListener(createMenus);
ffApi.runtime.onStartup.addListener(createMenus);

async function showBadge(tabId, res) {
  try {
    const text = res.ok ? String(res.filled) : '!';
    await ffApi.action.setBadgeBackgroundColor({ tabId, color: res.ok ? '#16a34a' : '#dc2626' });
    await ffApi.action.setBadgeText({ tabId, text });
    setTimeout(() => ffApi.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 4000);
  } catch (e) {
    /* tab may be gone */
  }
}

ffApi.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || tab.id == null) return;
  const frameId = info.frameId ?? 0;
  const requests = {
    'ff-fill-page': { action: 'fill', scope: 'page' },
    'ff-fill-form': { action: 'fill', scope: 'context', frameId },
    'ff-fill-field': { action: 'fill', scope: 'field', frameId },
    'ff-clear-form': { action: 'clear', scope: 'context', frameId },
  };
  const req = requests[info.menuItemId];
  if (req) showBadge(tab.id, await ffExecute(tab.id, req));
});

ffApi.commands.onCommand.addListener(async (command, tab) => {
  if (!tab || tab.id == null) [tab] = await ffApi.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const requests = {
    'fill-page': { action: 'fill', scope: 'page' },
    'fill-form': { action: 'fill', scope: 'focused' },
    'clear-page': { action: 'clear', scope: 'page' },
  };
  const req = requests[command];
  if (req) showBadge(tab.id, await ffExecute(tab.id, req));
});
