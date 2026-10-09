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
