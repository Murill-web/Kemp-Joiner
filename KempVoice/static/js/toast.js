class ToastManager {
  constructor() {
    this.toasts = [];
    this.container = this.createContainer();
    this.injectStyles();
  }
  createContainer() {
    const c = document.createElement("div");
    c.className = "toast-container";
    document.body.appendChild(c);
    return c;
  }
  injectStyles() {
    const s = document.createElement("style");
    s.textContent = `.toast-container{position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:350px}.toast{position:relative;background:var(--card-bg);color:var(--text);border-radius:8px;padding:12px 16px;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:space-between;animation:toast-in .3s ease-out forwards;border-left:4px solid var(--primary);min-width:280px}.toast.success{border-left-color:var(--success)}.toast.error{border-left-color:var(--error)}.toast.warning{border-left-color:var(--warning)}.toast-content{flex:1}.toast-title{font-weight:500;margin-bottom:4px;font-size:14px}.toast-msg{font-size:13px;color:var(--text-light)}.toast-close{background:none;border:none;color:var(--text-light);cursor:pointer;font-size:18px;margin-left:10px;transition:color .2s}.toast-close:hover{color:var(--text)}@keyframes toast-in{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes toast-out{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}`;
    document.head.appendChild(s);
  }
  show({ title = "", message = "", type = "info", duration = 4000 } = {}) {
    const icons = { success: "✅", error: "❌", warning: "⚠️", info: "🔔" };
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<div class="toast-content"><div class="toast-title">${icons[type] || ""} ${title}</div><div class="toast-msg">${message}</div></div><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    this.container.appendChild(t);
    setTimeout(() => { t.style.animation = "toast-out .3s ease-out forwards"; setTimeout(() => t.remove(), 300); }, duration);
  }
  success(title, msg, d) { this.show({ title, message: msg, type: "success", duration: d }); }
  error(title, msg, d)   { this.show({ title, message: msg, type: "error",   duration: d }); }
  info(title, msg, d)    { this.show({ title, message: msg, type: "info",    duration: d }); }
  warning(title, msg, d) { this.show({ title, message: msg, type: "warning", duration: d }); }
}
window.toast = new ToastManager();
