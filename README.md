# 🚂 IRCTC Auto-Fill — Chrome Extension

A Chrome extension that auto-fills passenger details, train search, and payment information on the IRCTC website. Built for speed during Tatkal booking.

## ✨ Features

### 1. Passenger Auto-Fill (Automatic)
- Fills Name, Age, Gender, Berth preference, and Food choice for multiple passengers
- Automatically adds passenger rows as needed
- Clicks the **Continue** button after filling
- **Runs automatically** — no manual trigger needed

### 2. Train Search (Manual Trigger)
- Fills From/To stations with character-by-character typing (triggers Angular autocomplete)
- Navigates the calendar picker to the correct month/year and selects the date
- Selects Class and Quota from PrimeNG dropdowns
- Clicks the **Search** button
- After results load, **scrolls to your saved train number** and highlights it with a green border
- **Manual trigger** — a floating "Fill Train Details" button appears for you to click

### 3. Payment Selection (Automatic)
- **IRCTC eWallet**: Selects eWallet from the payment methods list → clicks Pay & Book → auto-confirms on the eWallet confirmation page
- **UPI (via IRCTC iPay)**: iPay is pre-selected by default → clicks Pay & Book directly

### 4. iPay Gateway (Automatic)
- On the IRCTC iPay payment gateway (`irctcipay.com`), automatically:
  - Selects the **UPI radio button**
  - Fills the **UPI ID (VPA)**
  - Clicks the **Pay** button
- You just need to approve the UPI request in your banking app

### 5. Status Notifications
- Toast notifications appear in the top-right corner showing current action:
  - 👥 "Filling passenger details..."
  - 💳 "Selecting payment gateway..."
  - 💳 "Initiating UPI payment..."

---

## 📦 Installation

### Step 1: Download/Clone
```bash
git clone <repo-url>
# or download and extract the ZIP
```

### Step 2: Load in Chrome
1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `tatkal-script` folder
5. The 🚂 extension icon appears in your toolbar

### Step 3: Pin the Extension
- Click the puzzle icon (🧩) in Chrome's toolbar
- Pin **IRCTC Auto-Fill** for quick access

---

## ⚙️ Setup — Enter Your Details

Click the 🚂 extension icon to open the popup.

### 👥 Passengers Tab
| Field | Description | Example |
|-------|-----------|---------|
| Name | Full name as on ID | `RAHUL KUMAR` |
| Age | Passenger age | `28` |
| Gender | Male / Female / Transgender | `Male` |
| Berth | Berth preference (optional) | `Lower` |
| Food | Food choice | `Veg` |

- Click **+ Add Passenger** to add more passengers
- Click **✕** to remove a passenger

### 🚆 Train Tab
| Field | Description | Example |
|-------|-----------|---------|
| Train Number | Train number to auto-scroll to in results | `12952` |
| From Station | Origin station code | `NDLS` |
| To Station | Destination station code | `MMCT` |
| Journey Date | Travel date | `2026-03-15` |
| Quota | Booking quota | `Tatkal` |
| Class | Travel class | `AC 3 Tier (3A)` |

### 💳 Payment Tab
| Field | Description | Example |
|-------|-----------|---------|
| Payment Method | eWallet or UPI | `IRCTC eWallet` |
| UPI ID | Your UPI address (only for UPI) | `name@upi` |

Click **💾 Save** after entering all details.

---

## 🚀 Usage — Booking Flow

### 1. Train Search Page
Navigate to IRCTC → Train Search. A floating **"Fill Train Details"** button appears in the top-right corner.
- Click it to auto-fill the search form and submit
- After results load, the extension scrolls to your train and highlights it

### 2. Passenger Input Page
After selecting your train and reaching the passenger form:
- **No action needed** — the extension auto-fills all passenger details and clicks Continue

### 3. Payment Selection Page
On the payment options page:
- **No action needed** — the extension auto-selects your chosen payment method and clicks Pay & Book
- For eWallet: also auto-confirms on the confirmation page

### 4. iPay Gateway Page
If using UPI, the iPay gateway opens:
- **No action needed** — the extension selects UPI, fills your VPA, and clicks Pay
- Just approve the payment in your UPI app

---

## 📁 Project Structure

```
tatkal-script/
├── manifest.json              # Extension config (Manifest V3)
├── background.js              # Service worker — SPA URL detection
├── README.md                  # This file
├── index.js                   # Original bookmarklet (reference only)
├── popup/
│   ├── popup.html             # Tabbed UI: Passengers | Train | Payment
│   ├── popup.css              # Dark theme styling
│   └── popup.js               # Tab switching, CRUD, Chrome storage
├── content/
│   ├── router.js              # Core: page detection, auto-fill logic, toasts
│   └── fill-button.css        # Floating button styling
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Key Files

| File | Purpose |
|------|---------|
| `manifest.json` | Defines permissions, content scripts, and matched URLs |
| `router.js` | Detects IRCTC pages, triggers auto-fill, handles all form interactions |
| `popup.js` | Manages the popup UI and saves data to `chrome.storage.local` |
| `background.js` | Listens for tab URL changes and notifies content scripts |

---

## 🔧 Troubleshooting

### "Extension context lost" error
**Cause:** You reloaded the extension without refreshing the IRCTC page.
**Fix:** Refresh the IRCTC page (Ctrl+R / Cmd+R).

### Floating button doesn't appear
1. Check `chrome://extensions` — is the extension enabled?
2. Open DevTools (F12) → Console → look for `[IRCTC Auto-Fill]` messages
3. Make sure the URL matches (e.g., `irctc.co.in/nget/train-search`)

### Fields not filling correctly
- Open DevTools → Console → check for ✅/⚠️ messages
- IRCTC may update their DOM — inspect elements and update selectors in `router.js`

### Date not selecting correctly
- Check the console for `[IRCTC Auto-Fill] Calendar shows:` logs
- The extension handles both short ("Mar") and full ("March") month name formats

---

## 🔐 Privacy & Security

- All data is stored **locally** in `chrome.storage.local` — nothing is sent to any server
- The extension only runs on `irctc.co.in` and `irctcipay.com`
- UPI IDs are stored unencrypted — acceptable for personal use only
- **Do not share** this extension with your credentials pre-filled

---

## 📝 Supported Pages

| Page | URL Pattern | Behavior |
|------|------------|---------|
| Train Search | `/nget/train-search` | Manual (floating button) |
| Passenger Input | `/nget/booking/psgninput` | Automatic |
| Payment Options | `/nget/payment/bkgPaymentOptions` | Automatic |
| iPay Gateway | `irctcipay.com` | Automatic |

---

## 🛠️ Development

### Modifying Selectors
All CSS selectors are in `content/router.js`. Key selectors (from tested Selenium automation):

- **Station inputs:** `input#origin`, `p-autocomplete#origin input`
- **Calendar:** `p-calendar input`, `.ui-datepicker-month`, `.ui-datepicker-calendar td a`
- **Class/Quota:** `p-dropdown[formcontrolname='journeyClass']` (PrimeNG, not `<select>`)
- **Train results:** `app-train-avl-enq`, `.train-heading strong`
- **Payment options:** `#pay-type .bank-type`
- **Pay & Book button:** `button.btn.btn-primary.hidden-xs`
- **UPI radio:** `input#mandateUPI`
- **VPA input:** `input#mndtVpa`

### After Making Changes
1. Go to `chrome://extensions`
2. Click the **refresh icon** (↻) on the extension card
3. **Refresh the IRCTC page** (important!)
