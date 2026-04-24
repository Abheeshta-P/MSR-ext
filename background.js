// background.js — MS Rewards Auto-Searcher (MV3 safe, alarm-based)

const SEARCH_TERMS = [
  "latest AI developments 2025", "OpenAI GPT updates", "Google Gemini new features",
  "best programming languages 2025", "Rust vs Go performance", "React 19 new hooks",
  "cloud computing trends", "AWS vs Azure comparison", "Kubernetes best practices",
  "TypeScript advanced tips", "Python machine learning tutorial", "Linux kernel update",
  "Apple WWDC 2025 announcements", "Samsung Galaxy AI features", "Nvidia GPU benchmark",
  "quantum computing breakthrough", "cybersecurity threats 2025", "zero trust security model",
  "5G network expansion", "Wi-Fi 7 speed test", "electric vehicle technology",
  "Tesla autopilot update", "SpaceX Starship launch", "NASA Mars mission",
  "global tech news today", "stock market technology sector", "cryptocurrency market trends",
  "India startup ecosystem 2025", "digital payments innovation", "smart city infrastructure",
  "renewable energy technology", "solar panel efficiency record", "data privacy regulations",
  "EU AI Act compliance", "open source software trends", "GitHub Copilot update",
  "VS Code new extensions", "Docker container best practices", "microservices architecture",
  "edge computing use cases", "IoT device security", "blockchain technology applications",
  "augmented reality headset", "virtual reality gaming 2025", "wearable tech health monitor",
  "drone delivery technology", "autonomous vehicle update", "robotics in manufacturing",
  "3D printing medical applications", "gene editing CRISPR news", "climate tech innovation",
  "fusion energy progress", "hyperloop transportation", "underwater internet cable"
];

const ALARM_NAME = "next_search";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Random delay in MINUTES (alarms use minutes), between 21–40 seconds
function randomDelayMinutes() {
  const seconds = Math.floor(Math.random() * (40 - 21 + 1)) + 21;
  return seconds / 60;
}

async function startSession() {
  const existing = await chrome.storage.local.get("sessionActive");
  if (existing.sessionActive) return { status: "already_running" };

  const queue = shuffle(SEARCH_TERMS).slice(0, 30);

  await chrome.storage.local.set({
    sessionActive: true,
    totalSearches: 30,
    completedSearches: 0,
    searchQueue: queue,
    currentTerm: "",
    sessionStartTime: Date.now(),
    searchTabId: null
  });

  broadcastStatus();

  // Fire first search after ~1 second
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.017 });

  return { status: "started" };
}

async function doNextSearch() {
  const data = await chrome.storage.local.get(null);

  if (!data.sessionActive) return;

  const { searchQueue, completedSearches, totalSearches } = data;

  if (!searchQueue || completedSearches >= totalSearches || completedSearches >= searchQueue.length) {
    await endSession();
    return;
  }

  const term = searchQueue[completedSearches];
  const url = `https://www.bing.com/search?q=${encodeURIComponent(term)}&form=QBLH`;

  let tabId = data.searchTabId || null;

  try {
    if (tabId) {
      try {
        await chrome.tabs.update(tabId, { url });
      } catch {
        const tab = await chrome.tabs.create({ url, active: false });
        tabId = tab.id;
      }
    } else {
      const tab = await chrome.tabs.create({ url, active: false });
      tabId = tab.id;
    }

    const newCompleted = completedSearches + 1;
    const delayMinutes = randomDelayMinutes();
    const nextSearchIn = Math.round(delayMinutes * 60 * 1000);

    await chrome.storage.local.set({
      completedSearches: newCompleted,
      currentTerm: term,
      searchTabId: tabId,
      nextSearchIn,
      lastUpdated: Date.now()
    });

    broadcastStatus();

    if (newCompleted < totalSearches) {
      await chrome.alarms.clear(ALARM_NAME);
      chrome.alarms.create(ALARM_NAME, { delayInMinutes: delayMinutes });
    } else {
      await endSession();
    }

  } catch (err) {
    console.error("Search error:", err);
    await endSession();
  }
}

async function stopSession() {
  await chrome.alarms.clear(ALARM_NAME);
  const data = await chrome.storage.local.get("searchTabId");

  if (data.searchTabId) {
    try { await chrome.tabs.remove(data.searchTabId); } catch {}
  }

  await chrome.storage.local.set({
    sessionActive: false,
    searchTabId: null,
    nextSearchIn: 0
  });

  broadcastStatus();
  return { status: "stopped" };
}

async function endSession() {
  await chrome.alarms.clear(ALARM_NAME);
  const data = await chrome.storage.local.get(["completedSearches", "totalSearches", "searchTabId"]);

  if (data.searchTabId) {
    try { await chrome.tabs.remove(data.searchTabId); } catch {}
  }

  await chrome.storage.local.set({
    sessionActive: false,
    searchTabId: null,
    nextSearchIn: 0,
    lastSessionDate: new Date().toDateString(),
    lastCompleted: data.completedSearches
  });

  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "MS Rewards Done!",
      message: `Completed ${data.completedSearches}/${data.totalSearches} searches. Points incoming!`
    });
  } catch {}

  broadcastStatus();
}

function broadcastStatus() {
  chrome.runtime.sendMessage({ type: "STATUS_UPDATE" }).catch(() => {});
}

// KEY FIX: Alarms survive service worker termination
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    doNextSearch();
  }
});

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "START_SESSION") {
    startSession().then(sendResponse);
    return true;
  }
  if (msg.action === "STOP_SESSION") {
    stopSession().then(sendResponse);
    return true;
  }
  if (msg.action === "GET_STATUS") {
    chrome.storage.local.get(null).then(data => {
      sendResponse({
        sessionActive: data.sessionActive || false,
        completedSearches: data.completedSearches || 0,
        totalSearches: data.totalSearches || 30,
        currentTerm: data.currentTerm || "",
        lastSessionDate: data.lastSessionDate || null,
        lastCompleted: data.lastCompleted || 0,
        nextSearchIn: data.nextSearchIn || 0
      });
    });
    return true;
  }
});

// On install — reset cleanly
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.set({
    sessionActive: false,
    completedSearches: 0,
    totalSearches: 30,
    searchQueue: [],
    searchTabId: null
  });
});
