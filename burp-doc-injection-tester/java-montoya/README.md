# Document Injection Tester — Java / Montoya build

Montoya-API port of the Jython extension. Same behaviour; supported API, native
request/response editors, first-class Collaborator.

**Authorized testing only.**

## Build

No Gradle/Maven required — just a JDK 17+:

```bash
./build.sh          # downloads montoya-api if missing, compiles, packages
# -> doc-injection-tester.jar
```

Or with Gradle, if you have it: `gradle jar` (uses `build.gradle`).

The Montoya API is `compileOnly` / provided-at-runtime, so it is **not** bundled;
the jar contains only this extension's classes plus the ServiceLoader entry
`META-INF/services/burp.api.montoya.BurpExtension`.

## Load

Burp > Extensions > Add > Extension type **Java** > select
`doc-injection-tester.jar`. A **Doc Injection Tester** tab appears, and a
**Send to Document Injection Tester** entry is added to request context menus.

## Use

Identical flow to the Jython version (see `../README.md`):

1. Right-click the upload request > **Send to Document Injection Tester**.
2. In the tab, set the **JSON field** (dotted path, e.g. `file.data`; falls back
   to a recursive leaf-key match), the **Value template** (`{{B64}}`, or e.g.
   `data:image/png;base64,{{B64}}`), and the **Extra payloads dir**.
3. **Run**. A baseline PNG is sent first; each payload row shows a length delta.

**Point the payloads dir** at the shared templates folder from the repo root
(`../payloads`) to pick up the drop-in files — the default (`user.dir/payloads`)
resolves against Burp's working directory, which is usually not what you want.

## Notes vs. the Jython version

- JSON insertion is a **targeted value replacement** (regex on `"key":"…"`), so
  the rest of the body — key order, whitespace — is preserved byte-for-byte.
  `withBody()` recomputes Content-Length automatically.
- Binary payload templates round-trip correctly (read as ISO-8859-1, byte-level
  `{{COLLAB}}` substitution, then Base64).
- Collaborator correlation uses `payload.id()` ↔ `interaction.id()`; the poller
  runs every 5s and is torn down on extension unload.
- The `ghostscript_eps_pipe` payload is **RCE-HEAVY**; confirm scope before use.
