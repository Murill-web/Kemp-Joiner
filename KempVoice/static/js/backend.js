function minimizeWindow() {
  if (window.pywebview) window.pywebview.api.minimize();
}
function closeWindow() {
  if (window.pywebview) window.pywebview.api.close();
}
