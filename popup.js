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

// Initial load
getStatus().then(updateUI);
