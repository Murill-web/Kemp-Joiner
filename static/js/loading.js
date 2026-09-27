export async function initLoading() {
  const bar     = document.getElementById("loading-progress");
  const status  = document.getElementById("loading-status");
  const overlay = document.getElementById("loading-overlay");
  const main    = document.getElementById("main-container");

  const steps = [
    { p: 20,  m: "Initializing..." },
    { p: 50,  m: "Loading modules..." },
    { p: 80,  m: "Almost ready..." },
    { p: 100, m: "Ready!" }
  ];

  for (const s of steps) {
    bar.style.width = s.p + "%";
    status.textContent = s.m;
    await new Promise(r => setTimeout(r, 300));
  }

  overlay.style.display = "none";
  main.style.display = "block";
}
