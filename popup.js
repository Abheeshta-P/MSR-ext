// popup.js

let countdownInterval = null;
let nextSearchTimestamp = null;

async function getStatus() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: "GET_STATUS" }, resolve);
  });
}

function updateUI(data) {
  const { sessionActive, completedSearches, totalSearches, currentTerm, lastSessionDate, lastCompleted, nextSearchIn } = data;

  const pct = totalSearches > 0 ? completedSearches / totalSearches : 0;
  const circumference = 188;

  // Ring
  document.getElementById("ringCount").textContent = completedSearches;
  document.getElementById("ringFill").style.strokeDashoffset = circumference - (pct * circumference);

  // Bar
  document.getElementById("barFill").style.width = (pct * 100) + "%";

  // Info
  document.getElementById("completedVal").textContent = `${completedSearches} / ${totalSearches}`;
  document.getElementById("pointsVal").textContent = `+${completedSearches * 5} pts`;

  // Last run
  const lastRunEl = document.getElementById("lastRun");
  if (lastSessionDate) {
    const today = new Date().toDateString();
    lastRunEl.textContent = lastSessionDate === today ? "Today" : lastSessionDate;
  } else {
    lastRunEl.textContent = "Never";
  }

  // Status pill + button
  const pill = document.getElementById("statusPill");
  const btn = document.getElementById("mainBtn");
  const termEl = document.getElementById("currentTerm");
  const labelEl = document.getElementById("progressLabel");
  const timerSection = document.getElementById("timerSection");

  if (sessionActive) {
    pill.className = "status-pill running";
    pill.textContent = "RUNNING";
    btn.className = "btn btn-stop";
    btn.textContent = "⏹ STOP SESSION";
    labelEl.textContent = `Searching... (${completedSearches}/${totalSearches})`;
    termEl.className = "current-term searching";
    termEl.textContent = currentTerm ? `🔍 "${currentTerm}"` : "Starting...";
    document.getElementById("doneBanner").classList.remove("visible");

    // Timer
    if (nextSearchIn > 0 && completedSearches > 0 && completedSearches < totalSearches) {
      timerSection.classList.add("visible");
      if (!nextSearchTimestamp) {
        nextSearchTimestamp = Date.now() + nextSearchIn;
        startCountdown();
      }
    }
  } else {
    pill.className = "status-pill idle";
    pill.textContent = "IDLE";
    btn.className = "btn btn-start";
    btn.textContent = "▶ START SESSION";
    timerSection.classList.remove("visible");
    clearCountdownInterval();
    nextSearchTimestamp = null;

    if (completedSearches > 0 && completedSearches === totalSearches) {
      labelEl.textContent = "Session complete!";
      termEl.className = "current-term";
      termEl.textContent = "All 30 searches done. Points on the way! ✅";
      document.getElementById("doneBanner").classList.add("visible");
      document.getElementById("doneSub").textContent = `Earned ~${totalSearches * 5} points. Check rewards.microsoft.com`;
    } else if (completedSearches > 0) {
      labelEl.textContent = "Session stopped";
      termEl.className = "current-term";
      termEl.textContent = `Stopped at ${completedSearches}/${totalSearches} searches.`;
    } else {
      labelEl.textContent = "Ready to search";
      termEl.className = "current-term";
      termEl.textContent = "Click Start to begin 30 human-paced Bing searches and earn Microsoft Rewards points.";
    }
  }
}

function startCountdown() {
  clearCountdownInterval();
  countdownInterval = setInterval(() => {
    if (!nextSearchTimestamp) return;
    const remaining = Math.max(0, nextSearchTimestamp - Date.now());
    const secs = Math.ceil(remaining / 1000);
    document.getElementById("timerCountdown").textContent = secs + "s";
    if (remaining <= 0) {
      clearCountdownInterval();
      nextSearchTimestamp = null;
    }
  }, 500);
}

function clearCountdownInterval() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

async function handleBtn() {
  const data = await getStatus();
  if (data.sessionActive) {
    await new Promise(resolve => chrome.runtime.sendMessage({ action: "STOP_SESSION" }, resolve));
  } else {
    nextSearchTimestamp = null;
    clearCountdownInterval();
    await new Promise(resolve => chrome.runtime.sendMessage({ action: "START_SESSION" }, resolve));
  }
  const newData = await getStatus();
  updateUI(newData);
}

// Listen for live updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATUS_UPDATE") {
    nextSearchTimestamp = null; // reset timer on each update
    clearCountdownInterval();
    getStatus().then(data => {
      updateUI(data);
      if (data.sessionActive && data.nextSearchIn > 0) {
        nextSearchTimestamp = Date.now() + data.nextSearchIn;
        startCountdown();
      }
    });
  }
});

// Initial load
getStatus().then(updateUI);

// Attach button click via JS (CSP blocks inline onclick in extensions)
document.getElementById("mainBtn").addEventListener("click", handleBtn);
