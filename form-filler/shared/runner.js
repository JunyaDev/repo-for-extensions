/* Form Filler – injects the content scripts into a tab and runs a fill/clear action in its frames. */
/* exported ffExecute */
const FF_CONTENT_FILES = [
  'content/core.js',
  'content/data.js',
  'content/generators.js',
  'content/rules.js',
  'content/samples.js',
  'content/filler.js',
];

/**
 * @param {number} tabId
 * @param {{action?: 'fill'|'clear', scope?: 'page'|'focused'|'context'|'field', frameId?: number, newIdentity?: boolean}} request
 * @returns {Promise<{ok: boolean, filled: number, total: number, frames: number, locale?: string, persona?: object, error?: string}>}
 */
async function ffExecute(tabId, request = {}) {
  const settings = await ffLoadSettings();
  const action = request.action || 'fill';
  const stored = await ffApi.storage.local.get(['lastSeed', 'lastTs']);
  let seed = stored.lastSeed;
  let ts = stored.lastTs;
  if (!settings.keepIdentity || request.newIdentity || seed == null) {
    seed = crypto.getRandomValues(new Uint32Array(1))[0];
    ts = Date.now();
  }
  const target = request.frameId != null ? { tabId, frameIds: [request.frameId] } : { tabId, allFrames: true };
  try {
    await ffApi.scripting.executeScript({ target, files: FF_CONTENT_FILES });
    // One identity per fill: detect the language in the top frame and reuse it in every iframe (payment iframes etc.).
    if (settings.locale === 'auto' && request.frameId == null) {
      const [top] = await ffApi.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        func: (s) => (globalThis.__FF && globalThis.__FF.detectLocale ? globalThis.__FF.detectLocale(s) : null),
        args: [settings],
      });
      if (top && top.result) settings.locale = top.result;
    }
    const results = await ffApi.scripting.executeScript({
      target,
      func: (opts) => (globalThis.__FF && globalThis.__FF.run ? globalThis.__FF.run(opts) : null),
      args: [{ action, scope: request.scope || 'page', seed, ts, settings }],
    });
    const frames = (results || []).map((r) => r && r.result).filter((r) => r && !r.inactive);
    const summary = {
      ok: true,
      action,
      filled: frames.reduce((n, r) => n + (r.filled || 0), 0),
      total: frames.reduce((n, r) => n + (r.total || 0), 0),
      frames: frames.length,
    };
    const main = frames.find((r) => r.top && r.persona) || frames.find((r) => r.persona);
    if (main) {
      summary.locale = main.locale;
      summary.persona = main.persona;
    }
    if (action === 'fill') {
      await ffApi.storage.local.set({ lastSeed: seed, lastTs: ts, ...(main ? { lastPersona: main.persona } : {}) });
    }
    return summary;
  } catch (e) {
    return { ok: false, filled: 0, total: 0, frames: 0, error: String((e && e.message) || e) };
  }
}
