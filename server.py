"""Serves the site and proxies chat to OpenAI. The key stays in .env."""

import json
import os
import time
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODEL = "gpt-6-astra"
SYSTEM = """You are Hoodchan, the AI agent of the HOODCHAN memecoin.
Hard facts, never change them:
- Name: Hoodchan
- Ticker: HOODCHAN
- Contract address: 0xc38C332012a9116dcadE0c7F43B5D3C71799A9F8
Look: long black hair, bright green eyes, neon lime and black, a leaf emblem. You live between night cities and green mountains.
Voice: warm, quick, a little playful. Answer the actual question first and in full. Be useful on facts, how-tos, ideas, jokes, and everyday problems. Keep it tight unless the user wants depth. Do not invent a different contract or supply. You cannot see live prices or market caps — if asked for one, say so and tell them to check the chart on this page instead of guessing a number. You can explain crypto, and you are not their financial advisor. No slurs. No sexual content involving minors."""

WINDOW = 600
LIMIT = 20
hits = {}


def load_env():
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def allowed(ip):
    now = time.time()
    recent = [stamp for stamp in hits.get(ip, []) if now - stamp < WINDOW]
    if len(recent) >= LIMIT:
        hits[ip] = recent
        return False
    recent.append(now)
    hits[ip] = recent
    return True


def clean_messages(raw):
    if not isinstance(raw, list):
        return None
    cleaned = []
    for item in raw[-12:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            continue
        text = content.strip()
        if not text:
            continue
        cleaned.append({"role": role, "content": text[:4000]})
    if not cleaned or cleaned[-1]["role"] != "user":
        return None
    return [{"role": "system", "content": SYSTEM}, *cleaned]


def call_openai(messages):
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    model = os.environ.get("OPENAI_MODEL", MODEL).strip() or MODEL
    if not key:
        return 500, {"error": "missing_key"}
    payload = {
        "model": model,
        "messages": messages,
        "max_completion_tokens": 1500,
        "reasoning_effort": "medium",
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=55) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        code = "upstream"
        try:
            code = json.loads(detail).get("error", {}).get("code") or code
        except json.JSONDecodeError:
            pass
        if code in ("insufficient_quota", "credit_balance_exhausted"):
            return 402, {"error": "quota"}
        if error.code in (401, 403):
            return 401, {"error": "auth"}
        return 502, {"error": "upstream"}
    except (urllib.error.URLError, TimeoutError):
        return 502, {"error": "upstream"}
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content = message.get("content") or ""
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    text = str(content).strip()
    if not text:
        return 502, {"error": "empty"}
    return 200, {"choices": [{"message": {"role": "assistant", "content": text}}]}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/chat":
            self.send_error(404)
            return
        ip = self.client_address[0]
        if not allowed(ip):
            self.respond(429, {"error": "rate_limit"})
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > 100_000:
            self.respond(400, {"error": "bad_request"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.respond(400, {"error": "bad_request"})
            return
        messages = clean_messages(body.get("messages"))
        if not messages:
            self.respond(400, {"error": "bad_request"})
            return
        status, payload = call_openai(messages)
        self.respond(status, payload)

    def respond(self, status, payload):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        if args and str(args[0]).startswith("POST /api/chat"):
            print("chat", args[1] if len(args) > 1 else "")
            return
        super().log_message(fmt, *args)


if __name__ == "__main__":
    load_env()
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Hoodchan is on http://127.0.0.1:{port}")
    server.serve_forever()
