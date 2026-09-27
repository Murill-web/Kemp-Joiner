import { addLog } from './utils.js';

// cache de conexiones para los checkboxes
let _lastConns = [];

export function initVC() {
  document.getElementById("vc-join-btn").addEventListener("click", joinVC);
  document.getElementById("vc-leave-btn").addEventListener("click", leaveAll);
  document.getElementById("move-all-btn").addEventListener("click", moveAll);
  document.getElementById("mute-all-btn").addEventListener("click",  () => muteAll(true,  false));
  document.getElementById("deaf-all-btn").addEventListener("click",  () => muteAll(false, true));
  document.getElementById("md-all-btn").addEventListener("click",    () => muteAll(true,  true));
  document.getElementById("unmute-all-btn").addEventListener("click",() => muteAll(false, false));
  document.getElementById("leave-selected-btn").addEventListener("click", leaveSelected);
  document.getElementById("leave-all-btn2").addEventListener("click", leaveAll);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getTokens() {
  return document.getElementById("tokens-textarea").value
    .split("\n").map(t => t.trim()).filter(Boolean);
}

function getChecked(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input[type=checkbox]:checked`))
    .map(cb => cb.value);
}

function buildCheckboxes(conns, containerId) {
  const box = document.getElementById(containerId);
  if (!box) return;
  if (!conns.length) {
    box.innerHTML = '<span style="color:var(--text-light);font-size:13px">Conecta tokens para verlos aquí</span>';
    return;
  }
  box.innerHTML = conns.map((c, i) => `
    <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;
      padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--input-bg)">
      <input type="checkbox" value="${c.full_token}" style="width:auto;accent-color:var(--primary)">
      Token ${i + 1} · ${c.user}
    </label>`).join("");
}

// ── poll ─────────────────────────────────────────────────────────────────────

export function startPolling() {
  setInterval(async () => {
    try {
      const conns = await window.pywebview.api.get_connections();
      _lastConns = conns;

      // tabla
      if (typeof window.updateVCTable === "function") window.updateVCTable(conns);

      // checkboxes mass actions
      buildCheckboxes(conns, "move-token-checkboxes");
      buildCheckboxes(conns, "status-token-checkboxes");

      // conn count
      const dot  = document.querySelector(".status-dot");
      const text = document.getElementById("conn-count");
      if (dot)  dot.className  = conns.length > 0 ? "status-dot online" : "status-dot offline";
      if (text) text.textContent = conns.length + " connected";

      // logs
      const logs = await window.pywebview.api.get_logs();
      logs.forEach(l => addLog(l.message, l.type));

    } catch(e) {}
  }, 600);
}

// ── join / leave ──────────────────────────────────────────────────────────────

async function joinVC() {
  const g = document.getElementById("vc-server-id").value.trim();
  const c = document.getElementById("vc-channel-id").value.trim();
  const tokens = getTokens();
  if (!g || !c || !tokens.length) {
    toast.error("Error", "Server ID, Channel ID y tokens son requeridos"); return;
  }
  const options = {
    mute:             document.getElementById("vc-join-muted").checked,
    deaf:             document.getElementById("vc-join-deafened").checked,
    auto_reconnect:   document.getElementById("vc-auto-reconnect").checked,
    randomize_options:document.getElementById("vc-randomize-options").checked,
    status:           document.getElementById("vc-status").value
  };
  const r = await window.pywebview.api.join_vc_multi(tokens, g, c, options);
  if (!r.success) toast.error("Error", r.error || "Failed");
}

async function leaveAll() {
  await window.pywebview.api.leave_vc_multi([], "", "");
  toast.info("Info", "Disconnecting all tokens...");
}

async function leaveSelected() {
  const tokens = document.getElementById("leave-tokens-textarea").value
    .split("\n").map(t => t.trim()).filter(Boolean);
  await window.pywebview.api.leave_vc_multi(tokens, "", "");
}

window.disconnectOne = async function(token, server, channel) {
  await window.pywebview.api.leave_vc(token, server, channel);
};

// ── move ──────────────────────────────────────────────────────────────────────

async function moveAll() {
  const ch = document.getElementById("move-channel-id").value.trim();
  if (!ch) { toast.error("Error", "Enter a channel ID"); return; }
  await window.pywebview.api.move_all(ch);
  toast.success("Done", "All tokens moved");
}

window.moveSelected = async function() {
  const ch = document.getElementById("move-channel-id").value.trim();
  if (!ch) { toast.error("Error", "Enter a channel ID"); return; }
  const selected = getChecked("move-token-checkboxes");
  if (!selected.length) { toast.error("Error", "Selecciona al menos un token"); return; }
  await window.pywebview.api.move_tokens(selected, ch);
  toast.success("Done", `${selected.length} token(s) movidos`);
};

window.moveSingle = async function(fullToken, idx) {
  const ch = document.getElementById(`move_ch_${idx}`).value.trim();
  if (!ch) return;
  await window.pywebview.api.move_tokens([fullToken], ch);
};

// ── status ────────────────────────────────────────────────────────────────────

window.setStatusAll = async function() {
  const status = document.getElementById("mass-status-select").value;
  await window.pywebview.api.set_status([], status);
  toast.success("Done", `Status → ${status} aplicado a todos`);
};

window.setStatusSelected = async function() {
  const status   = document.getElementById("mass-status-select").value;
  const selected = getChecked("status-token-checkboxes");
  if (!selected.length) { toast.error("Error", "Selecciona al menos un token"); return; }
  await window.pywebview.api.set_status(selected, status);
  toast.success("Done", `Status → ${status} (${selected.length} token(s))`);
};

window.setStatusSingle = async function(fullToken, idx) {
  const status = document.getElementById(`status_sel_${idx}`).value;
  await window.pywebview.api.set_status([fullToken], status);
};

// ── mute ──────────────────────────────────────────────────────────────────────

async function muteAll(mute, deaf) {
  await window.pywebview.api.mute_all(mute, deaf);
  toast.info("Info", `mute=${mute} deaf=${deaf} aplicado`);
}
