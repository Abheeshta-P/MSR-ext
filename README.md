# 🎯 MS Rewards Auto-Searcher — Edge Extension

Automatically runs **human-paced Bing searches** on both Desktop and Mobile to earn Microsoft Rewards points daily.

## ✨ Features

- **Dual-Phase Search**: Automatically completes both PC and Mobile search quotas.
- **Human-Like Behavior**: Random delays, smooth scrolling, and interaction injection to mimic real user behavior.
- **Customizable Quotas**: Set your own target for PC and Mobile searches.
- **Adjustable Delays**: Configure minimum and maximum wait times between searches.
- **Custom Wordlists**: Upload your own `.txt` file of search terms or use the built-in tech/news terms.
- **Progress Tracking**: Real-time progress bars, timer countdowns, and session history.

## 📦 Installation (Microsoft Edge)

1. **Download** and unzip this folder somewhere on your computer.
2. Open **Microsoft Edge** and go to: `edge://extensions/`
3. Toggle **"Developer mode"** ON (top-right).
4. Click **"Load unpacked"**.
5. Select the unzipped folder.
6. The extension icon appears in your toolbar. **Pin it** for easy access.

## 🚀 How to Use

1. **Sign in** to your Microsoft account on Bing first (`bing.com`).
2. Click the extension icon in Edge.
3. Hit **▶ START SESSION**.
4. The extension will:
    - Run PC searches in a background tab.
    - Switch to Mobile mode (User-Agent spoofing) and run mobile searches.
    - Automatically close tabs and inject natural interactions.
5. Once done, the status will change to **DONE**.
6. Check your points at [rewards.microsoft.com](https://rewards.microsoft.com).

## ⚙️ Settings

Click the **gear icon** ⚙️ to customize:
- **PC/Mobile Totals**: Default is 30/20 (matches standard Level 2 limits).
- **Delays**: Random range (e.g., 20–40s) for better safety.
- **Custom Terms**: Drop a `.txt` file with one search term per line.

## 🔑 Permissions Used

| Permission | Why |
|-----------|-----|
| `tabs` | Open/close Bing search tabs |
| `storage` | Save session progress and settings |
| `alarms` | Handle precise search timing |
| `notifications` | Notify when session is complete |
| `scripting` | Inject human-like interactions (scrolling) |
| `declarativeNetRequest` | Spoof Mobile User-Agent for mobile points |
| `host_permissions: bing.com` | Navigate and modify headers for Bing |

## ⚠️ Important Notes

- You must be **signed in to your Microsoft account** in Edge for searches to count.
- Microsoft awards points for **real user searches** — this extension mimics natural behavior, but use it responsibly.
- Do **not** use a VPN while running (violates Microsoft Rewards terms).
- Make sure your Edge browser profile is linked to your Microsoft account.
