# language: Python 3.10+, file: app.py (KempVoice)
# pip install aiohttp flask pywebview

import asyncio, json, os, sys, threading, time
from datetime import datetime
from queue import Queue
from typing import List, Optional, Dict

import aiohttp
from flask import Flask, render_template
import webview

# ─── paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─── gateway ──────────────────────────────────────────────────────────────────
_loop: Optional[asyncio.AbstractEventLoop] = None

GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json"
WS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Origin": "https://discord.com"
}
IDENTIFY_TEMPLATE = {
    "op": 2, "d": {
        "token": None, "capabilities": 16381,
        "properties": {
            "os": "Windows", "browser": "Chrome", "device": "",
            "system_locale": "en-US",
            "browser_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "browser_version": "124.0.0.0", "os_version": "10",
            "referrer": "", "referring_domain": "", "referrer_current": "",
            "referring_domain_current": "", "release_channel": "stable",
            "client_build_number": 330490, "client_event_source": None
        },
        "presence": {"status": "online", "since": 0, "activities": [], "afk": False},
        "compress": False, "client_state": {"guild_versions": {}}
    }
}

# ─── VCController ─────────────────────────────────────────────────────────────

class VCController:
    def __init__(self):
        self._connected: Dict[str, dict] = {}
        self._tasks: Dict[str, object]   = {}
        self._log_q: Queue = Queue()
        self._lock = threading.Lock()

    def push_log(self, msg: str, log_type: str = "info"):
        ts = datetime.now().strftime("%H:%M:%S")
        self._log_q.put({"message": f"<span class='log-time'>{ts}</span>{msg}", "type": log_type})

    def drain_logs(self) -> list:
        out = []
        while not self._log_q.empty():
            out.append(self._log_q.get_nowait())
        return out

    def get_connections(self) -> list:
        with self._lock:
            return [
                {"token": k[:20]+"...", "full_token": k, "user": v["user"],
                 "server": str(v["guild_id"]), "channel": str(v["channel_id"]),
                 "status": "Connected", "status_label": v.get("status_label", "online")}
                for k, v in self._connected.items()
            ]

    async def _hb(self, ws, interval_ms: int):
        try:
            while True:
                await asyncio.sleep(interval_ms / 1000)
                if ws.closed: break
                await ws.send_str(json.dumps({"op": 1, "d": None}))
        except: pass

    async def _run_token(self, token: str, guild_id: int, channel_id: int, options: dict):
        import random
        self_mute = options.get("mute", False)
        self_deaf = options.get("deaf", False)
        if options.get("randomize_options"):
            self_mute = random.choice([True, False])
            self_deaf = random.choice([True, False])
        auto_reconnect = options.get("auto_reconnect", True)
        status = options.get("status", "online")  # online | idle | dnd | invisible

        while True:
            session = aiohttp.ClientSession()
            hb_task = None
            entry   = None
            try:
                ws = await session.ws_connect(GATEWAY, headers=WS_HEADERS, heartbeat=None)
            except Exception as e:
                self.push_log(f"...{token[-8:]} WS failed: {e}", "error")
                await session.close()
                if not auto_reconnect: return
                await asyncio.sleep(5); continue

            try:
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        op = data.get("op"); t = data.get("t"); d = data.get("d") or {}
                        if op == 10:
                            hb_task = asyncio.create_task(self._hb(ws, d["heartbeat_interval"]))
                            identify = json.loads(json.dumps(IDENTIFY_TEMPLATE))
                            identify["d"]["token"] = token

                            # VR spoof — map vr status values to correct properties + presence
                            VR_DEVICES = {
                                "vr":       ("Meta Quest 3",       "Android"),
                                "vr_valve": ("Valve Index",        "Windows"),
                                "vr_psvr":  ("PlayStation VR2",    "Windows"),
                                "vr_apple": ("Apple Vision Pro",   "iOS"),
                            }
                            if status in VR_DEVICES:
                                device, os_name = VR_DEVICES[status]
                                identify["d"]["properties"]["os"]      = os_name
                                identify["d"]["properties"]["browser"] = "Discord VR"
                                identify["d"]["properties"]["device"]  = device
                                identify["d"]["presence"]["status"] = "online"
                                identify["d"]["presence"]["afk"]    = False
                            else:
                                real_status = status if status in ("online","idle","dnd","invisible") else "online"
                                identify["d"]["presence"]["status"] = real_status
                                identify["d"]["presence"]["afk"]    = (real_status == "idle")

                            await ws.send_str(json.dumps(identify))
                        elif op == 0 and t == "READY":
                            username = d.get("user", {}).get("username", "?")
                            self.push_log(f"{username} <span style='color:var(--text-light)'>→</span> joining VC {channel_id}...", "info")
                            await ws.send_str(json.dumps({"op": 4, "d": {
                                "guild_id": str(guild_id), "channel_id": str(channel_id),
                                "self_mute": self_mute, "self_deaf": self_deaf
                            }}))
                            # Determine display label for status
                            vr_labels = {"vr":"VR (Meta Quest)","vr_valve":"VR (Valve Index)",
                                         "vr_psvr":"VR (PSVR2)","vr_apple":"VR (Apple Vision)"}
                            status_label = vr_labels.get(status, status)
                            entry = {"user": username, "ws": ws, "session": session,
                                     "hb_task": hb_task, "guild_id": guild_id,
                                     "channel_id": channel_id, "status_label": status_label}
                            with self._lock: self._connected[token] = entry
                            self.push_log(f"{username} <span style='color:var(--success)'>→ Joined</span>", "succses")
                        elif op == 9:
                            self.push_log(f"...{token[-8:]} <span style='color:var(--error)'>invalid session</span>", "error"); break
                        elif op == 7:
                            self.push_log(f"...{token[-8:]} reconnect requested", "info"); break
                    elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        break
            except asyncio.CancelledError: break
            except Exception as e:
                self.push_log(f"...{token[-8:]} {type(e).__name__}: {e}", "error")
            finally:
                if hb_task: hb_task.cancel()
                with self._lock:
                    if token in self._connected:
                        uname = self._connected[token]["user"]
                        del self._connected[token]
                        self.push_log(f"{uname} <span style='color:var(--error)'>disconnected</span>", "error")
                try: await ws.close()
                except: pass
                await session.close()

            if not auto_reconnect: break
            self.push_log(f"...{token[-8:]} reconnecting in 5s...", "info")
            await asyncio.sleep(5)

    def join(self, tokens, guild_id, channel_id, options):
        self.push_log(f"Starting connection of {len(tokens)} tokens...", "info")
        for tok in tokens:
            fut = asyncio.run_coroutine_threadsafe(
                self._run_token(tok, guild_id, channel_id, options), _loop
            )
            self._tasks[tok] = fut

    def leave(self, tokens=None):
        targets = tokens if tokens else list(self._connected.keys())
        self.push_log(f"Disconnecting {len(targets)} tokens...", "info")
        for tok in targets:
            if tok in self._tasks:
                try: self._tasks[tok].cancel()
                except: pass
            with self._lock:
                if tok in self._connected:
                    asyncio.run_coroutine_threadsafe(self._connected[tok]["ws"].close(), _loop)

    def move_all(self, new_channel_id):
        with self._lock: items = list(self._connected.items())
        for tok, entry in items:
            asyncio.run_coroutine_threadsafe(
                entry["ws"].send_str(json.dumps({"op": 4, "d": {
                    "guild_id": str(entry["guild_id"]), "channel_id": str(new_channel_id),
                    "self_mute": False, "self_deaf": False
                }})), _loop
            )
            entry["channel_id"] = new_channel_id
        self.push_log(f"All tokens moved to channel {new_channel_id}", "succses")

    def leave_one(self, full_token):
        with self._lock: entry = self._connected.get(full_token)
        if entry:
            asyncio.run_coroutine_threadsafe(entry["ws"].close(), _loop)

    def set_mute_all(self, mute, deaf):
        with self._lock: items = list(self._connected.items())
        for tok, entry in items:
            asyncio.run_coroutine_threadsafe(
                entry["ws"].send_str(json.dumps({"op": 4, "d": {
                    "guild_id": str(entry["guild_id"]), "channel_id": str(entry["channel_id"]),
                    "self_mute": mute, "self_deaf": deaf
                }})), _loop
            )
        self.push_log(f"All tokens → mute={mute} deaf={deaf}", "info")

    def move_tokens(self, full_tokens: list, new_channel_id: int):
        """Mueve una lista específica de tokens a un canal."""
        moved = 0
        for tok in full_tokens:
            with self._lock: entry = self._connected.get(tok)
            if not entry: continue
            asyncio.run_coroutine_threadsafe(
                entry["ws"].send_str(json.dumps({"op": 4, "d": {
                    "guild_id": str(entry["guild_id"]), "channel_id": str(new_channel_id),
                    "self_mute": False, "self_deaf": False
                }})), _loop
            )
            entry["channel_id"] = new_channel_id
            moved += 1
        self.push_log(f"{moved} token(s) movidos al canal {new_channel_id}", "succses")

    def set_status(self, full_tokens: list, status: str):
        """Cambia el status de una lista de tokens (o todos si está vacía) en tiempo real."""

        VR_DEVICES = {
            "vr":       "Meta Quest 3",
            "vr_valve": "Valve Index",
            "vr_psvr":  "PlayStation VR2",
            "vr_apple": "Apple Vision Pro",
        }

        targets = full_tokens if full_tokens else list(self._connected.keys())
        for tok in targets:
            with self._lock: entry = self._connected.get(tok)
            if not entry: continue
            ws = entry["ws"]

            if status in VR_DEVICES:
                # VR — cambiar properties y presence via op 3
                # op 3 no cambia las properties, pero actualiza la presencia
                payload = json.dumps({
                    "op": 3,
                    "d": {
                        "since":      0,
                        "activities": [],
                        "status":     "online",
                        "afk":        False
                    }
                })
                entry["status_label"] = status
            elif status == "idle":
                payload = json.dumps({
                    "op": 3,
                    "d": {
                        "since":      int(time.time() * 1000),
                        "activities": [],
                        "status":     "idle",
                        "afk":        True
                    }
                })
                entry["status_label"] = "idle"
            else:
                valid_status = status if status in ["online", "dnd", "invisible"] else "online"
                payload = json.dumps({
                    "op": 3,
                    "d": {
                        "since":      0,
                        "activities": [],
                        "status":     valid_status,
                        "afk":        False
                    }
                })
                entry["status_label"] = valid_status

            asyncio.run_coroutine_threadsafe(ws.send_str(payload), _loop)
            # Update status_label in entry so table reflects new status
            with self._lock:
                if tok in self._connected:
                    vr_labels = {"vr":"VR (Meta Quest)","vr_valve":"VR (Valve Index)",
                                 "vr_psvr":"VR (PSVR2)","vr_apple":"VR (Apple Vision)"}
                    self._connected[tok]["status_label"] = vr_labels.get(status, status)

        label = status if not full_tokens else f"{len(full_tokens)} token(s)"
        self.push_log(f"Status → {status} ({label})", "succses")


# ─── JS API ───────────────────────────────────────────────────────────────────

class Api:
    def __init__(self, vc: VCController):
        self.vc = vc
        self._window = None

    def set_window(self, w): self._window = w

    def get_logs(self): return self.vc.drain_logs()
    def get_connections(self): return self.vc.get_connections()

    def join_vc_multi(self, tokens, guild_id, channel_id, options):
        toks = [t.strip() for t in tokens if t.strip()]
        if not toks: return {"success": False, "error": "No tokens"}
        self.vc.join(toks, int(guild_id), int(channel_id), options)
        return {"success": True}

    def leave_vc_multi(self, tokens, guild_id, channel_id):
        toks = [t.strip() for t in tokens if t.strip()]
        self.vc.leave(toks if toks else None)
        return {"success": True}

    def leave_vc(self, token, guild_id, channel_id):
        self.vc.leave_one(token)
        return {"success": True}

    def move_all(self, channel_id):
        self.vc.move_all(int(channel_id))
        return {"success": True}

    def move_tokens(self, full_tokens: list, channel_id: str):
        self.vc.move_tokens(full_tokens, int(channel_id))
        return {"success": True}

    def set_status(self, full_tokens: list, status: str):
        self.vc.set_status(full_tokens, status)
        return {"success": True}

    def mute_all(self, mute, deaf):
        self.vc.set_mute_all(mute, deaf)
        return {"success": True}

    def minimize(self):
        if self._window: self._window.minimize()

    def close(self):
        if self._window: self._window.destroy()


# ─── Flask ────────────────────────────────────────────────────────────────────

flask_app = Flask(__name__, template_folder=os.path.join(BASE_DIR, "templates"),
                  static_folder=os.path.join(BASE_DIR, "static"))
_vc_controller: Optional[VCController] = None

@flask_app.route("/")
def index():
    return render_template("index.html")

def run_flask():
    flask_app.run(debug=False, port=7843, use_reloader=False, threaded=True)

def start_asyncio_loop():
    global _loop
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    _loop.run_forever()

if __name__ == "__main__":
    _vc_controller = VCController()
    api = Api(_vc_controller)

    threading.Thread(target=start_asyncio_loop, daemon=True).start()
    threading.Thread(target=run_flask, daemon=True).start()
    time.sleep(1)

    window = webview.create_window(
        "Kemp Voice",
        url="http://127.0.0.1:7843",
        js_api=api,
        width=1000,
        height=680,
        resizable=True,
        frameless=True,
        background_color="#121212"
    )
    api.set_window(window)
    webview.start(debug=False)
