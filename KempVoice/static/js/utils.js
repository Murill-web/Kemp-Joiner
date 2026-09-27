export function addLog(message, type = "info") {
  const container = document.getElementById("log-container");
  if (!container) return;
  const entry = document.createElement("div");
  entry.className = "log-entry" +
    (type === "error"   ? " log-error"   : "") +
    (type === "succses" ? " log-success" : "");
  entry.innerHTML = `<span class="log-message">${message}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}
window.addLog = addLog;

const STATUS_EMOJI = {
  online:    "🟢",
  idle:      "🌙",
  dnd:       "⛔",
  invisible: "⚫",
  vr:        "🥽",
  vr_valve:  "🥽",
  vr_psvr:   "🥽",
  vr_apple:  "🥽"
};

// ─── dropdown fix ────────────────────────────────────────────────────────────
// En lugar de re-renderizar innerHTML completo cada poll,
// actualizamos solo las celdas que cambian — los selects nunca se destruyen.

let _renderedRows = 0; // cuántas filas existen actualmente en el tbody

export function updateVCTable(conns) {
  const body = document.getElementById("vc-status-body");
  if (!body) return;

  if (!conns.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty-state">No active voice connections</td></tr>';
    _renderedRows = 0;
    return;
  }

  // Si la cantidad de filas cambió, re-render completo
  if (conns.length !== _renderedRows) {
    body.innerHTML = conns.map((c, i) => `
      <tr id="row_${i}">
        <td style="font-family:monospace;font-size:11px" id="cell_token_${i}"></td>
        <td id="cell_user_${i}"></td>
        <td id="cell_server_${i}"></td>
        <td id="cell_channel_${i}"></td>
        <td id="cell_status_${i}"></td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <input type="text" id="move_ch_${i}" placeholder="Channel ID"
              style="width:110px;padding:3px 6px;font-size:11px;border-radius:4px">
            <button class="secondary-btn" style="padding:3px 8px;font-size:11px"
              onclick="moveSingle('${c.full_token}', ${i})">Move</button>
            <select id="status_sel_${i}"
              style="padding:3px 6px;font-size:11px;border-radius:4px;background:var(--input-bg);color:var(--text);border:1px solid var(--border)">
              <option value="online">🟢 Online</option>
              <option value="idle">🌙 Idle</option>
              <option value="dnd">⛔ DND</option>
              <option value="invisible">⚫ Invisible</option>
              <option value="vr">🥽 VR (Meta Quest)</option>
              <option value="vr_valve">🥽 VR (Valve Index)</option>
              <option value="vr_psvr">🥽 VR (PlayStation VR2)</option>
              <option value="vr_apple">🥽 VR (Apple Vision Pro)</option>
            </select>
            <button class="secondary-btn" style="padding:3px 8px;font-size:11px"
              onclick="setStatusSingle('${c.full_token}', ${i})">Set</button>
            <button class="danger-btn" style="padding:3px 8px;font-size:11px"
              onclick="disconnectOne('${c.full_token}','${c.server}','${c.channel}')">Kick</button>
          </div>
        </td>
      </tr>`).join("");
    _renderedRows = conns.length;
  }

  // Actualizar solo celdas de texto y select value — nunca tocar el select DOM
  conns.forEach((c, i) => {
    const setCell = (id, html) => {
      const el = document.getElementById(id);
      if (el && el.innerHTML !== html) el.innerHTML = html;
    };

    setCell(`cell_token_${i}`,   c.token);
    setCell(`cell_user_${i}`,    c.user);
    setCell(`cell_server_${i}`,  c.server);
    setCell(`cell_channel_${i}`, c.channel);
    setCell(`cell_status_${i}`,
      `${STATUS_EMOJI[c.status_label] || "🟢"} ${c.status_label || "online"}`);

    // Solo setear value del select si no está enfocado (abierto)
    const sel = document.getElementById(`status_sel_${i}`);
    if (sel && document.activeElement !== sel && c.status_label) {
      sel.value = c.status_label;
    }
  });
}
window.updateVCTable = updateVCTable;

window.moveSingle = async function(fullToken, idx) {
  const ch = document.getElementById(`move_ch_${idx}`).value.trim();
  if (!ch) return;
  await window.pywebview.api.move_tokens([fullToken], ch);
};

window.setStatusSingle = async function(fullToken, idx) {
  const status = document.getElementById(`status_sel_${idx}`).value;
  await window.pywebview.api.set_status([fullToken], status);
  window.toast && window.toast.success("Done", `Status → ${status}`);
};

window.disconnectOne = async function(token, server, channel) {
  await window.pywebview.api.leave_vc(token, server, channel);
};
