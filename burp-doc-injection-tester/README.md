# Document Injection Tester (Burp extension)

Inserts image/OCR-pipeline OOB payloads into a base64 document field inside a
JSON request body, replays the request, correlates Burp Collaborator (OAST)
interactions, and flags interesting responses. Built in the spirit of the
pdf-injection-tester / xls-injection-tester extensions.

**Authorized testing only.** Use solely against systems you are explicitly
permitted to assess.

## What it targets

The server-side pipeline behind a "document" upload: the format converter
(ImageMagick), the PostScript/PDF renderer (Ghostscript), SVG rasterizers,
metadata extractors (ExifTool), and OCR loaders (Tesseract/Leptonica). Code
execution in these pipelines almost always comes from those components, not from
the character-recognition step — so the payloads are SSRF/XXE/OOB probes plus
one RCE-class Ghostscript probe, each carrying a unique Collaborator host.

## Setup

1. Burp > Extensions > Options > Python environment: point at a Jython
   standalone JAR (2.7.x).
2. Burp > Extensions > Add > Extension type **Python** > select
   `doc_injection_tester.py`.
3. Make sure Burp Collaborator is reachable (default public server is fine for
   most engagements; a private server also works).

## Usage

1. In Proxy/Repeater, right-click the upload request >
   **Send to Document Injection Tester**.
2. Open the **Doc Injection Tester** tab.
3. Set:
   - **JSON field** — dotted path to the base64 document, e.g. `document`,
     `file.data`, `payload.attachment.content`. If the dotted path misses, it
     falls back to a recursive search for the leaf key.
   - **Value template** — defaults to `{{B64}}` (the raw base64). If the field
     expects a data URI, set e.g. `data:image/png;base64,{{B64}}`.
   - **Extra payloads dir** — defaults to `./payloads` (see that folder's
     README to add your own, including binary templates).
4. Click **Run**. A baseline valid PNG is sent first so every payload row shows
   a length delta vs. a known-good image.

## Reading the results

- **Collab = HIT** (+ Type dns/http) is the strong signal: the pipeline made an
  out-of-band request your payload induced — confirmed SSRF/XXE, or, for the
  Ghostscript row, command execution. Hits arrive asynchronously; the poller
  updates rows every ~5s (or click **Poll Collaborator now**).
- **Notes** surfaces component banners (ImageMagick/Ghostscript/ExifTool/…),
  stack traces, leaked filesystem paths, and the baseline length/status delta.
- Select a row to view the exact request sent and the response received.

## Notes / caveats

- `json.dumps` re-serializes the body (compact separators, possibly reordered
  keys). If the endpoint is picky about formatting, switch the insert to a
  targeted string replacement — the hook is `_apply_to_body`.
- The `ghostscript_eps_pipe` payload is **RCE-HEAVY**: confirm Ghostscript RCE
  is in scope before firing. Its command is a benign `curl` to Collaborator.
- Sends are sequential with a configurable delay to stay gentle on the target.
- If you prefer a Java/Montoya build (richer Collaborator API, typed UI), the
  same design ports directly — ask and I'll generate the Gradle project.
