/* Form Filler – settings shared by background, popup and options pages. */
/* exported FF_DEFAULTS, ffApi, ffLoadSettings, ffSaveSettings */
const ffApi = globalThis.browser ?? globalThis.chrome;

const FF_DEFAULTS = Object.freeze({
  locale: 'auto', // auto | it | en-US | en-GB
  fallbackLocale: 'browser', // used when "auto" can't tell: browser | it | en-US | en-GB
  overwrite: true,
  includeHidden: false,
  checkboxMode: 'all', // all | required | random
  attachFiles: true,
  fillContentEditable: false,
  simulateTyping: false, // type character by character (key events) instead of setting values directly
  highlight: true,
  keepIdentity: false,
  emailTemplate: '{first}.{last}{n}@example.com',
  fixedPassword: '',
  customRules: '',
  debug: false,
});

async function ffLoadSettings() {
  const stored = await ffApi.storage.sync.get(FF_DEFAULTS);
  return { ...FF_DEFAULTS, ...stored };
}

async function ffSaveSettings(patch) {
  await ffApi.storage.sync.set(patch);
}
