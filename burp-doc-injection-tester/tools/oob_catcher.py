#!/usr/bin/env python3
"""
Local OOB catcher -- a stand-in for Burp Collaborator for offline lab use.

Logs every inbound HTTP request (method, path, headers, peer) to a JSONL file
so the replay harness can correlate a payload's unique token against a hit.
AUTHORIZED LOCAL LAB USE ONLY.

Usage:  python3 -I oob_catcher.py [--port 9000] [--log oob_hits.jsonl]
"""
import argparse, json, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOGFILE = "oob_hits.jsonl"


class H(BaseHTTPRequestHandler):
    def _log(self):
        rec = {
            "ts": time.time(),
            "method": self.command,
            "path": self.path,
            "peer": self.client_address[0],
            "headers": {k: v for k, v in self.headers.items()},
        }
        with open(LOGFILE, "a") as f:
            f.write(json.dumps(rec) + "\n")
        print("[HIT] %s %s from %s" % (self.command, self.path, self.client_address[0]))

    def do_GET(self):
        self._log()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok\n")

    do_POST = do_GET
    do_HEAD = do_GET

    def log_message(self, *a):   # silence default stderr noise
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=9000)
    ap.add_argument("--log", default=LOGFILE)
    a = ap.parse_args()
    LOGFILE = a.log
    open(LOGFILE, "w").close()   # truncate at start
    print("OOB catcher on 127.0.0.1:%d  log=%s" % (a.port, LOGFILE))
    ThreadingHTTPServer(("127.0.0.1", a.port), H).serve_forever()
