# KYC Audit Automation Tool

An AI-powered KYC verification tool for internal audit teams. Reads Aadhaar, PAN, LOS/LMS data, business photos, agreements and more — then automatically runs the full checklist, detects discrepancies, and generates audit reports.

---

## What it does

- Reads any KYC document — including scanned copies and vernacular (Hindi, Tamil, Telugu, Kannada etc.)
- Extracts Name, DOB, Father's Name, Address, PAN, Aadhaar from every document
- Runs 17 applicant + 17 co-applicant checklist items automatically
- Cross-checks documents against LOS and LMS data
- Analyses business visit photos and estimates business valuation in INR
- Rates every failed check as High / Medium / Low risk
- Auto-generates audit observations when more than 50% checks fail
- Dashboard showing pass rate, risk distribution, and trend across files
- Download individual file report or master report (TXT + CSV)

---

## How to use

### Step 1 — Get your Anthropic API key (free)
1. Go to https://console.anthropic.com/
2. Sign up for a free account
3. Click **API Keys** → **Create Key**
4. Copy the key (it starts with `sk-ant-api...`)

### Step 2 — Open the tool
Open the live link: `https://YOUR-USERNAME.github.io/kyc-audit-tool`

### Step 3 — Enter your API key
1. Click **Settings** in the left sidebar
2. Paste your API key
3. Click **Save API Key**

### Step 4 — Audit a file
1. Click **Upload Files**
2. Enter the applicant name or file ID
3. Upload Aadhaar and PAN (required). Add any other documents available.
4. Click **LOS / LMS Data** tab and enter available data (leave blank if not available)
5. Click **▶ Run AI Audit**
6. Wait ~30–60 seconds — the AI reads and checks everything
7. Results appear in the **Reports** tab automatically

### Step 5 — View and download
- **Dashboard** tab — see metrics, charts, and risk breakdown across all files
- **Reports** tab — expand any file for the full checklist with pass/fail/risk
- Download per-file report or the master report for all files

---

## Hosting on GitHub Pages (one-time setup)

### A. Create a GitHub account
1. Go to https://github.com
2. Click **Sign up**
3. Choose a username, enter email and password
4. Verify your email

### B. Create a new repository
1. After logging in, click the **+** button (top right) → **New repository**
2. Repository name: `kyc-audit-tool`
3. Set it to **Public**
4. Leave everything else as default
5. Click **Create repository**

### C. Upload the files
1. On the repository page, click **uploading an existing file**
2. Drag and drop all 3 files:
   - `index.html`
   - `style.css`
   - `app.js`
3. Scroll down, click **Commit changes**

### D. Enable GitHub Pages
1. Click **Settings** (in the repository, top menu)
2. Scroll down to **Pages** (left sidebar)
3. Under **Branch**, select `main` → `/ (root)`
4. Click **Save**
5. Wait 2–3 minutes

### E. Get your live link
Your tool is now live at:
```
https://YOUR-GITHUB-USERNAME.github.io/kyc-audit-tool
```
Bookmark this. Open it on any laptop or browser.

---

## Files in this project

| File | Purpose |
|------|---------|
| `index.html` | The main page structure |
| `style.css` | All styling and dark theme |
| `app.js` | All logic — uploads, AI API, checklist, reports |

---

## Privacy & Security

- **No data is stored anywhere.** All document processing happens directly between your browser and the Anthropic API.
- Your API key is stored only in your browser session (cleared when you close the tab).
- Documents are never saved to any server.

---

## Built for
Internal audit teams running KYC verification for loan files including Aadhaar, PAN, LOS/LMS cross-checks, business photo analysis, and audit reporting.
