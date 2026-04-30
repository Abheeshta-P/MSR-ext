// background.js — MS Rewards Auto-Searcher v2 (PC + Mobile)

const SEARCH_TERMS = [
  "latest AI developments 2025",
  "OpenAI GPT updates",
  "Google Gemini new features",
  "best programming languages 2025",
  "Rust vs Go performance",
  "React 19 new hooks",
  "cloud computing trends",
  "AWS vs Azure comparison",
  "Kubernetes best practices",
  "TypeScript advanced tips",
  "Python machine learning tutorial",
  "Linux kernel update",
  "Apple WWDC 2025 announcements",
  "Samsung Galaxy AI features",
  "Nvidia GPU benchmark",
  "quantum computing breakthrough",
  "cybersecurity threats 2025",
  "zero trust security model",
  "5G network expansion",
  "Wi-Fi 7 speed test",
  "electric vehicle technology",
  "Tesla autopilot update",
  "SpaceX Starship launch",
  "NASA Mars mission",
  "global tech news today",
  "stock market technology sector",
  "cryptocurrency market trends",
  "India startup ecosystem 2025",
  "digital payments innovation",
  "smart city infrastructure",
  "renewable energy technology",
  "solar panel efficiency record",
  "data privacy regulations",
  "EU AI Act compliance",
  "open source software trends",
  "GitHub Copilot update",
  "VS Code new extensions",
  "Docker container best practices",
  "microservices architecture",
  "edge computing use cases",
  "IoT device security",
  "blockchain technology applications",
  "augmented reality headset",
  "virtual reality gaming 2025",
  "wearable tech health monitor",
  "drone delivery technology",
  "autonomous vehicle update",
  "robotics in manufacturing",
  "3D printing medical applications",
  "gene editing CRISPR news",
  "climate tech innovation",
  "fusion energy progress",
  "hyperloop transportation",
  "underwater internet cable",
];

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const ALARM_PC = "pc_search";
const ALARM_MOBILE = "mobile_search";
const PC_TOTAL = 30;
const MOBILE_TOTAL = 30;

// ─── Utils ─────────────────────────────────

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const delayPC = () => (Math.floor(Math.random() * 20) + 21) / 60;
const delayMobile = () => (Math.floor(Math.random() * 8) + 8) / 60;

function broadcastStatus() {
  try {
    chrome.runtime.sendMessage({ type: "STATUS_UPDATE" });
  } catch {}
}

// ─── SESSION START ─────────────────────────

async function startSession() {
  const { sessionActive } = await chrome.storage.local.get("sessionActive");
  if (sessionActive) return { status: "already_running" };

  await chrome.storage.local.set({
    sessionActive: true,
    phase: "pc",

    pcTotal: PC_TOTAL,
    pcCompleted: 0,
    pcQueue: shuffle(SEARCH_TERMS).slice(0, PC_TOTAL),
    pcCurrentTerm: "",
    searchTabId: null,

    mobileTotal: MOBILE_TOTAL,
    mobileCompleted: 0,
    mobileQueue: shuffle(SEARCH_TERMS).slice(0, MOBILE_TOTAL),
    mobileCurrentTerm: "",

    nextSearchIn: 0,
  });

  broadcastStatus();

  chrome.alarms.clearAll();
  chrome.alarms.create(ALARM_PC, { delayInMinutes: 0.02 });

  return { status: "started" };
}

// ─── PC SEARCH ─────────────────────────────

async function doPC() {
  const data = await chrome.storage.local.get(null);
  if (!data.sessionActive || data.phase !== "pc") return;

  if (data.pcCompleted >= data.pcTotal) {
    return startMobile();
  }

  const term = data.pcQueue[data.pcCompleted];
  const url = `https://www.bing.com/search?q=${encodeURIComponent(term)}`;

  let tabId = data.searchTabId;

  try {
    if (tabId) {
      await chrome.tabs.update(tabId, { url });
    } else {
      const tab = await chrome.tabs.create({ url, active: false });
      tabId = tab.id;
    }

    const next = data.pcCompleted + 1;
    const delay = delayPC();
    const nextSearchIn = delay * 60 * 1000;

    await chrome.storage.local.set({
      pcCompleted: next,
      pcCurrentTerm: term,
      searchTabId: tabId,
      nextSearchIn,
    });

    broadcastStatus();

    if (next < data.pcTotal) {
      chrome.alarms.create(ALARM_PC, { delayInMinutes: delay });
    } else {
      if (tabId) chrome.tabs.remove(tabId).catch(() => {});
      await chrome.storage.local.set({ searchTabId: null });
      startMobile();
    }
  } catch {
    endSession();
  }
}

// ─── MOBILE ────────────────────────────────

async function startMobile() {
  await chrome.storage.local.set({
    phase: "mobile",
    nextSearchIn: 0,
  });

  broadcastStatus();

  chrome.alarms.create(ALARM_MOBILE, { delayInMinutes: 0.02 });
}

async function doMobile() {
  const data = await chrome.storage.local.get(null);
  if (!data.sessionActive || data.phase !== "mobile") return;

  if (data.mobileCompleted >= data.mobileTotal) {
    return endSession();
  }

  const term = data.mobileQueue[data.mobileCompleted];
  const url = `https://www.bing.com/search?q=${encodeURIComponent(term)}`;

  try {
    await fetch(url, {
      headers: { "User-Agent": MOBILE_UA },
      credentials: "include",
    });

    const next = data.mobileCompleted + 1;
    const delay = delayMobile();
    const nextSearchIn = delay * 60 * 1000;

    await chrome.storage.local.set({
      mobileCompleted: next,
      mobileCurrentTerm: term,
      nextSearchIn,
    });

    broadcastStatus();

    if (next < data.mobileTotal) {
      chrome.alarms.create(ALARM_MOBILE, { delayInMinutes: delay });
    } else {
      endSession();
    }
  } catch {
    chrome.alarms.create(ALARM_MOBILE, { delayInMinutes: delayMobile() });
  }
}

// ─── STOP / END ────────────────────────────

async function stopSession() {
  chrome.alarms.clearAll();

  const { searchTabId } = await chrome.storage.local.get("searchTabId");
  if (searchTabId) chrome.tabs.remove(searchTabId).catch(() => {});

  await chrome.storage.local.set({
    sessionActive: false,
    phase: "done",
    nextSearchIn: 0,
  });

  broadcastStatus();
}

async function endSession() {
  chrome.alarms.clearAll();

  const data = await chrome.storage.local.get([
    "pcCompleted",
    "mobileCompleted",
  ]);

  await chrome.storage.local.set({
    sessionActive: false,
    phase: "done",
    lastSessionDate: new Date().toDateString(),
    lastPcCompleted: data.pcCompleted,
    lastMobileCompleted: data.mobileCompleted,
  });

  broadcastStatus();
}

// ─── LISTENERS ─────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_PC) doPC();
  if (alarm.name === ALARM_MOBILE) doMobile();
});

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.action === "START_SESSION") startSession().then(sendResponse);
  if (msg.action === "STOP_SESSION") stopSession().then(sendResponse);
  if (msg.action === "GET_STATUS") {
    chrome.storage.local.get(null).then(sendResponse);
  }
  return true;
});