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

const DNR_RULE_ID = 1;

// ─── Utils ─────────────────────────────────

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const getRandDelay = (min, max) => (Math.floor(Math.random() * (max - min + 1)) + min) / 60;

function broadcastStatus() {
  try {
    chrome.runtime.sendMessage({ type: "STATUS_UPDATE" });
  } catch {}
}

async function setMobileUA(enabled) {
  if (enabled) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [DNR_RULE_ID],
      addRules: [{
        id: DNR_RULE_ID,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [{ header: "user-agent", operation: "set", value: MOBILE_UA }]
        },
        condition: {
          urlFilter: "*://www.bing.com/search?*q=*",
          resourceTypes: ["main_frame"]
        }
      }]
    });
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [DNR_RULE_ID]
    });
  }
}

async function injectInteraction(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const scroll = () => {
          const distance = Math.floor(Math.random() * 500) + 200;
          window.scrollBy({ top: distance, behavior: 'smooth' });
          setTimeout(() => {
            window.scrollBy({ top: -distance, behavior: 'smooth' });
          }, 1000);
        };
        setTimeout(scroll, 1500);
      }
    });
  } catch (e) {
    console.error("Injection failed", e);
  }
}

// ─── SESSION START ─────────────────────────

async function startSession() {
  const data = await chrome.storage.local.get(["sessionActive", "phase"]);
  if (data.sessionActive) return { status: "already_running" };

  // Resume logic
  if (data.phase === "pc") {
    await chrome.storage.local.set({ sessionActive: true });
    chrome.alarms.create(ALARM_PC, { delayInMinutes: 0.02 });
    broadcastStatus();
    return { status: "resumed" };
  }
  if (data.phase === "mobile") {
    await chrome.storage.local.set({ sessionActive: true });
    await setMobileUA(true);
    chrome.alarms.create(ALARM_MOBILE, { delayInMinutes: 0.02 });
    broadcastStatus();
    return { status: "resumed" };
  }

  // Fresh start
  const settings = await chrome.storage.local.get([
    "pcTotal", "mobileTotal", "customTerms"
  ]);

  const pcTotal = settings.pcTotal || 30;
  const mobileTotal = settings.mobileTotal || 30;
  const terms = (settings.customTerms && settings.customTerms.length > 0) ? settings.customTerms : SEARCH_TERMS;

  await setMobileUA(false);

  await chrome.storage.local.set({
    sessionActive: true,
    phase: "pc",
    pcTotal: pcTotal,
    pcCompleted: 0,
    pcQueue: shuffle(terms).slice(0, pcTotal),
    pcCurrentTerm: "",
    searchTabId: null,
    mobileTotal: mobileTotal,
    mobileCompleted: 0,
    mobileQueue: shuffle(terms).slice(0, mobileTotal),
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
  const settings = await chrome.storage.local.get(["minDelay", "maxDelay"]);
  if (!data.sessionActive || data.phase !== "pc") return;

  if (data.pcCompleted >= data.pcTotal) {
    return startMobile();
  }

  const term = data.pcQueue[data.pcCompleted];
  const url = `https://www.bing.com/search?q=${encodeURIComponent(term)}&form=QBRE`;

  let tabId = data.searchTabId;

  try {
    if (tabId) {
      await chrome.tabs.update(tabId, { url });
    } else {
      const tab = await chrome.tabs.create({ url, active: false });
      tabId = tab.id;
    }

    await new Promise(r => setTimeout(r, 2000));
    await injectInteraction(tabId);

    const next = data.pcCompleted + 1;
    const delay = getRandDelay(settings.minDelay || 21, settings.maxDelay || 40);
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
      startMobile();
    }
  } catch {
    stopSession();
  }
}

// ─── MOBILE ────────────────────────────────

async function startMobile() {
  await setMobileUA(true);
  await chrome.storage.local.set({
    phase: "mobile",
    nextSearchIn: 0,
  });

  broadcastStatus();
  chrome.alarms.create(ALARM_MOBILE, { delayInMinutes: 0.02 });
}

async function doMobile() {
  const data = await chrome.storage.local.get(null);
  const settings = await chrome.storage.local.get(["minDelay", "maxDelay"]);
  if (!data.sessionActive || data.phase !== "mobile") return;

  if (data.mobileCompleted >= data.mobileTotal) {
    return endSession();
  }

  const term = data.mobileQueue[data.mobileCompleted];
  if (!term) return endSession();

  const url = `https://www.bing.com/search?q=${encodeURIComponent(term)}&form=QBRE`;

  let tabId = data.searchTabId;

  try {
    if (tabId) {
      await chrome.tabs.update(tabId, { url });
    } else {
      const tab = await chrome.tabs.create({ url, active: false });
      tabId = tab.id;
    }

    await new Promise(r => setTimeout(r, 2000));
    await injectInteraction(tabId);

    const next = data.mobileCompleted + 1;
    const delay = getRandDelay(settings.minDelay || 12, settings.maxDelay || 25);
    const nextSearchIn = delay * 60 * 1000;

    await chrome.storage.local.set({
      mobileCompleted: next,
      mobileCurrentTerm: term,
      searchTabId: tabId,
      nextSearchIn,
    });

    broadcastStatus();

    if (next < data.mobileTotal) {
      chrome.alarms.create(ALARM_MOBILE, { delayInMinutes: delay });
    } else {
      endSession();
    }
  } catch {
    chrome.alarms.create(ALARM_MOBILE, { delayInMinutes: 0.2 });
  }
}

// ─── STOP / END ────────────────────────────

async function stopSession() {
  chrome.alarms.clearAll();
  await setMobileUA(false);

  const data = await chrome.storage.local.get(["searchTabId", "pcCompleted", "pcTotal", "mobileCompleted", "mobileTotal", "phase"]);
  if (data.searchTabId) chrome.tabs.remove(data.searchTabId).catch(() => {});

  const isFinished = (data.pcCompleted >= data.pcTotal) && (data.mobileCompleted >= data.mobileTotal);

  await chrome.storage.local.set({
    sessionActive: false,
    phase: isFinished ? "done" : (data.phase || "paused"),
    nextSearchIn: 0,
    searchTabId: null
  });

  broadcastStatus();
}

async function endSession() {
  chrome.alarms.clearAll();
  await setMobileUA(false);

  const data = await chrome.storage.local.get([
    "pcCompleted",
    "mobileCompleted",
    "searchTabId"
  ]);

  if (data.searchTabId) chrome.tabs.remove(data.searchTabId).catch(() => {});

  await chrome.storage.local.set({
    sessionActive: false,
    phase: "done",
    lastSessionDate: new Date().toDateString(),
    lastPcCompleted: data.pcCompleted,
    lastMobileCompleted: data.mobileCompleted,
    searchTabId: null
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
  if (msg.action === "REFRESH_QUEUES") {
    (async () => {
      const data = await chrome.storage.local.get(null);
      const terms = (msg.customTerms && msg.customTerms.length > 0) ? msg.customTerms : SEARCH_TERMS;
      
      const pcTotal = Math.min(msg.pcTotal || 30, terms.length);
      const mobileTotal = Math.min(msg.mobileTotal || 30, terms.length);
      
      await chrome.storage.local.set({
        pcTotal,
        mobileTotal,
        customTerms: msg.customTerms,
        pcQueue: shuffle(terms).slice(0, pcTotal),
        mobileQueue: shuffle(terms).slice(0, mobileTotal),
        // Safety: ensure progress doesn't exceed new totals
        pcCompleted: Math.min(data.pcCompleted, pcTotal),
        mobileCompleted: Math.min(data.mobileCompleted, mobileTotal)
      });
      broadcastStatus();
      sendResponse({ status: "refreshed" });
    })();
    return true;
  }
  return true;
});;