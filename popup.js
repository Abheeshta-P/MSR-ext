let interval = null;
let nextTime = null;

const qs = (id) => document.getElementById(id);

function formatTime(ms) {
  return Math.ceil(ms / 1000) + "s";
}

function startTimer() {
  clearInterval(interval);
  interval = setInterval(() => {
    if (!nextTime) return;
    const remaining = Math.max(0, nextTime - Date.now());
    qs("timerVal").textContent = formatTime(remaining);
  }, 500);
}

async function getStatus() {
  return new Promise((res) => {
    chrome.runtime.sendMessage({ action: "GET_STATUS" }, res);
  });
}

function updateUI(data) {
  const {
    sessionActive,
    phase,
    pcCompleted = 0,
    pcTotal = 30,
    mobileCompleted = 0,
    mobileTotal = 30,
    nextSearchIn = 0,
    pcCurrentTerm = "",
    mobileCurrentTerm = "",
    lastSessionDate = "Never"
  } = data;

  // Counts & Progress
  qs("pcCount").textContent = pcCompleted;
  qs("mobileCount").textContent = mobileCompleted;
  qs("pcBar").style.width = (pcCompleted / pcTotal) * 100 + "%";
  qs("mobileBar").style.width = (mobileCompleted / mobileTotal) * 100 + "%";

  // Status Pill
  const pill = qs("statusPill");
  pill.textContent = sessionActive ? (phase === "pc" ? "DESKTOP" : "MOBILE") : (phase === "done" ? "DONE" : "IDLE");
  pill.className = "status-pill";
  if (sessionActive) pill.classList.add("active");
  if (phase === "done") pill.classList.add("done");

  // Current Term
  const term = phase === "pc" ? pcCurrentTerm : (phase === "mobile" ? mobileCurrentTerm : "");
  qs("termText").textContent = sessionActive ? (term || "...") : (phase === "done" ? "Done" : "—");

  // Stats
  qs("pointsVal").textContent = ((pcCompleted + mobileCompleted) * 5);
  qs("lastRun").textContent = "Last run: " + lastSessionDate;

  // Banner
  qs("doneBanner").classList.toggle("visible", phase === "done");

  // Settings Guard
  qs("settingsBtn").disabled = sessionActive;
  if (sessionActive) toggleDrawer(false);

  // Main Button
  const btn = qs("mainBtn");
  btn.textContent = sessionActive ? "Stop Session" : (phase === "done" ? "Restart Session" : "Start Session");
  btn.className = sessionActive ? "btn btn-stop" : "btn";

  // Timer
  if (sessionActive && nextSearchIn > 0) {
    qs("timerRow").classList.add("visible");
    nextTime = Date.now() + nextSearchIn;
    startTimer();
  } else {
    qs("timerRow").classList.remove("visible");
    nextTime = null;
    clearInterval(interval);
  }
}

// Button click
qs("mainBtn").addEventListener("click", async () => {
  const data = await getStatus();
  const action = data.sessionActive ? "STOP_SESSION" : "START_SESSION";
  
  await new Promise((res) => chrome.runtime.sendMessage({ action }, res));
  updateUI(await getStatus());
});

// Live updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATUS_UPDATE") {
    getStatus().then(updateUI);
  }
});

// ─── Settings Logic ─────────────────────────

let customTerms = [];

const toggleDrawer = (open) => {
  qs("settingsDrawer").classList.toggle("open", open);
};

qs("settingsBtn").addEventListener("click", () => toggleDrawer(true));
qs("closeSettings").addEventListener("click", () => toggleDrawer(false));

// Load settings
async function loadSettings() {
  const settings = await chrome.storage.local.get([
    "pcTotal", "mobileTotal", "minDelay", "maxDelay", "customTerms"
  ]);
  
  if (settings.pcTotal) qs("pcTotalInput").value = settings.pcTotal;
  if (settings.mobileTotal) qs("mobileTotalInput").value = settings.mobileTotal;
  if (settings.minDelay) qs("minDelayInput").value = settings.minDelay;
  if (settings.maxDelay) qs("maxDelayInput").value = settings.maxDelay;
  if (settings.customTerms && settings.customTerms.length > 0) {
    customTerms = settings.customTerms;
    qs("dzText").innerHTML = `<b>${customTerms.length} terms active</b><br>Click or Drop to change`;
    qs("dropZone").classList.add("loaded");
    qs("resetTerms").style.display = "block";
  }
}

// Drag & Drop + Click to Upload
const dz = qs("dropZone");
const fi = qs("fileInput");

const handleFile = (file) => {
  if (file && file.name.endsWith(".txt")) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      customTerms = ev.target.result.split("\n").map(t => t.trim()).filter(t => t.length > 0);
      qs("dzText").innerHTML = `<b>${customTerms.length} terms loaded</b><br>Click or Drop to change`;
      dz.classList.add("loaded");
      qs("resetTerms").style.display = "block";
      fi.value = ""; // Clear for re-upload of same file
    };
    reader.readAsText(file);
  }
};

dz.addEventListener("click", (e) => {
  if (e.target.id === "resetTerms") return;
  fi.click();
});

fi.addEventListener("change", (e) => {
  if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

qs("resetTerms").addEventListener("click", (e) => {
  e.stopPropagation();
  customTerms = [];
  qs("dzText").innerHTML = `Click or Drop .txt file<br>for custom terms`;
  dz.classList.remove("loaded");
  qs("resetTerms").style.display = "none";
});

dz.addEventListener("dragover", (e) => {
  e.preventDefault();
  dz.classList.add("dragover");
});
dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
dz.addEventListener("drop", (e) => {
  e.preventDefault();
  dz.classList.remove("dragover");
  handleFile(e.dataTransfer.files[0]);
});

// Save Settings
qs("saveSettings").addEventListener("click", async () => {
  const pcTotal = parseInt(qs("pcTotalInput").value);
  const mobileTotal = parseInt(qs("mobileTotalInput").value);
  const minDelay = parseInt(qs("minDelayInput").value);
  const maxDelay = parseInt(qs("maxDelayInput").value);

  await chrome.storage.local.set({
    pcTotal, mobileTotal, minDelay, maxDelay, customTerms
  });

  const btn = qs("saveSettings");
  const oldText = btn.textContent;
  btn.textContent = "SAVED!";
  btn.style.background = "var(--green)";
  setTimeout(() => {
    btn.textContent = oldText;
    btn.style.background = "";
    toggleDrawer(false);
  }, 1000);
});

// Initial load
loadSettings();
getStatus().then(updateUI);
