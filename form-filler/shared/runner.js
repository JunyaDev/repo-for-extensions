/* Form Filler – injects the content scripts into a tab and runs a fill/clear action in its frames. */
/* exported ffExecute */
const FF_CONTENT_FILES = [
  'content/core.js',
  'content/data.js',
  'content/generators.js',
  'content/rules.js',
  'content/samples.js',
  'content/filler.js',
  'content/flutter.js',
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
  const run = async (scope) => {
    const results = await ffApi.scripting.executeScript({
      target,
      func: (opts) => (globalThis.__FF && globalThis.__FF.run ? globalThis.__FF.run(opts) : null),
      args: [{ action, scope, seed, ts, settings }],
    });
    return (results || []).map((r) => r && r.result).filter((r) => r && !r.inactive);
  };
  try {
    // Start from fresh code: tabs opened before an extension update would otherwise keep the old version.
    await ffApi.scripting.executeScript({ target, func: () => { delete globalThis.__FF; } });
    await ffApi.scripting.executeScript({ target, files: FF_CONTENT_FILES });
    // One identity per fill: detect the language in the top frame and reuse it in every iframe (payment iframes etc.).
    if (settings.locale === 'auto' && request.frameId == null) {
      const [top] = await ffApi.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        // Flutter pages have no readable text until their accessibility tree is on: they detect it themselves.
        func: (s) => {
          const FF = globalThis.__FF;
          if (!FF || !FF.detectLocale || (FF.flutter && FF.flutter.detect())) return null;
          return FF.detectLocale(s);
        },
        args: [settings],
      });
      if (top && top.result) settings.locale = top.result;
    }
    let frames = await run(request.scope || 'page');
    // "Focused form" with no field focused anywhere: fill the whole page instead of doing nothing.
    if (request.scope === 'focused' && !frames.length) frames = await run('page');
    // Typing into iframes moves focus into them; hand it back to where the user was in the top page.
    if (request.frameId == null) {
      await ffApi.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        func: () => globalThis.__FF && globalThis.__FF.settleFocus && globalThis.__FF.settleFocus(),
      }).catch(() => {});
    }
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
