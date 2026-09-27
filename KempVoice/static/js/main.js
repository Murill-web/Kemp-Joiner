import { initLoading } from './loading.js';
import { initTabs }    from './tabs.js';
import { initVC, startPolling } from './vc.js';

document.addEventListener("DOMContentLoaded", async () => {
  await initLoading();
  initTabs();
  initVC();
  startPolling();
});
