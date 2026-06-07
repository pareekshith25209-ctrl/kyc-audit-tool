/* ─────────────────────────────────────────
   KYC AUDIT AUTOMATION TOOL — app.js
   ───────────────────────────────────────── */

// ── STATE ──
const state = {
  apiKey: '',
  uploadedFiles: {},
  allResults: [],
  charts: {},
  threshHigh: 50,
  threshMed: 25,
};

// ── PAGE NAVIGATION ──
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    const titles = {
      upload: 'Upload KYC Documents',
      losdata: 'LOS / LMS Data Entry',
      dashboard: 'Audit Dashboard',
      reports: 'Reports & Observations',
      settings: 'Settings',
    };
    document.getElementById('pageTitle').textContent = titles[page] || '';
    if (page === 'dashboard') renderDashboard();
    if (page === 'reports') renderReports();
  });
});

// ── API KEY ──
function saveApiKey() {
  state.apiKey = document.getElementById('apiKeyInput').value.trim();
  document.getElementById('apiSaveMsg').style.display = 'block';
  updateApiStatus();
}

function updateApiStatus() {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (state.apiKey) {
    dot.className = 'status-dot ok';
    txt.textContent = 'API key active';
  } else {
    dot.className = 'status-dot';
    txt.textContent = 'Enter API key in Settings';
  }
}

function saveThresholds() {
  state.threshHigh = parseInt(document.getElementById('threshHigh').value) || 50;
  state.threshMed = parseInt(document.getElementById('threshMed').value) || 25;
  alert('Thresholds saved.');
}

// ── FILE UPLOAD ──
function triggerUpload(id) {
  document.getElementById('file-' + id).click();
}

function fileSelected(id, input) {
  if (!input.files[0]) return;
  const f = input.files[0];
  state.uploadedFiles[id] = f;
  const subEl = document.getElementById('sub-' + id);
  const badgeEl = document.getElementById('badge-' + id);
  const cardEl = document.getElementById('card-' + id);
  if (subEl) subEl.textContent = '✓ ' + f.name;
  if (badgeEl) { badgeEl.textContent = 'Ready'; badgeEl.className = 'uc-badge ready'; }
  if (cardEl) cardEl.classList.add('uploaded');
  checkRunEligible();
}

function checkRunEligible() {
  const hasCore = state.uploadedFiles['aadhaar'] && state.uploadedFiles['pan'];
  document.getElementById('runBtn').disabled = !hasCore;
}

// ── FILE → BASE64 ──
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('File read failed'));
    r.readAsDataURL(file);
  });
}

// ── LOS/LMS DATA ──
function getLOSLMSData() {
  const ids = [
    'los_name','los_dob','los_pan','los_aadhaar4','los_gender','los_address','los_permaddress','los_pin','los_phone',
    'lms_name','lms_dob','lms_pan','lms_mobile','lms_gender','lms_address','lms_permaddress','lms_risk','lms_branch','lms_income',
    'los_coname','los_copan','los_codob','los_cogender','los_copin','los_coaddress',
    'lms_coname','lms_codob','lms_cogender','lms_coaddress',
  ];
  const data = {};
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim()) data[id] = el.value.trim();
  });
  return data;
}

// ── PROGRESS ──
const STEPS = [
  'Reading documents',
  'Extracting fields',
  'Running KYC checklist',
  'Cross-checking LOS/LMS',
  'Analysing business photo',
  'Generating observations',
  'Compiling report',
];

function setProgress(pct, label, doneSteps) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent = pct + '%';
  document.getElementById('progressLabel').textContent = label;
  const stepsEl = document.getElementById('progressSteps');
  stepsEl.innerHTML = STEPS.map((s, i) => {
    let cls = 'p-step';
    if (i < doneSteps) cls += ' done';
    else if (i === doneSteps) cls += ' active';
    return `<span class="${cls}">${i < doneSteps ? '✓' : ''} ${s}</span>`;
  }).join('');
}

// ── BUILD AI PROMPT ──
async function buildMessages(losLms, fileName) {
  const content = [];
  const docLabels = {
    aadhaar: 'Applicant Aadhaar Card',
    pan: 'Applicant PAN Card',
    coapplaadhaar: 'Co-Applicant Aadhaar Card',
    coapplpan: 'Co-Applicant PAN Card',
    photo: 'Customer Business Visit Photo',
    agreement: 'Loan Agreement / Key Facts Statement',
    gst: 'GST / MSME / Udyam Certificate',
    bank: 'Bank Statement',
  };

  for (const [key, file] of Object.entries(state.uploadedFiles)) {
    try {
      const b64 = await fileToBase64(file);
      const mt = file.type.includes('pdf') ? 'application/pdf' : (file.type || 'image/jpeg');
      if (mt === 'application/pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 }, title: docLabels[key] || key });
      } else {
        content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: b64 } });
        content.push({ type: 'text', text: `[Above image is: ${docLabels[key] || key}]` });
      }
    } catch(e) { console.warn('Could not process file:', key, e); }
  }

  const losText = Object.keys(losLms).length > 0
    ? Object.entries(losLms).map(([k,v]) => `${k}: ${v}`).join('\n')
    : 'No LOS/LMS data provided by user.';

  content.push({ type: 'text', text: `
You are a senior KYC auditor at a financial institution auditing a loan file. You have been given documents for applicant file: "${fileName}".

=== LOS / LMS DATA ===
${losText}

=== YOUR TASK ===

STEP 1 — FIELD EXTRACTION
Extract the following from each document you can read. Handle Hindi, Tamil, Telugu, Kannada or any regional language text by translating to English.
From Aadhaar: Name, Father's Name, Date of Birth, Aadhaar Number (mask all but last 4), Gender, Full Address, PIN Code.
From PAN: Name, Date of Birth, Father's Name, PAN Number, 4th character of PAN.
From GST/Udyam/MSME: Business Name, Registration Number, Business Address, Business Type.
From Agreement/KFS: Borrower Name, Loan Amount, Date.

STEP 2 — CHECKLIST (answer each: PASS / FAIL / CANNOT_VERIFY + reason)

Applicant checks:
A1. Has applicant provided a valid Aadhaar? (format: 12 digits)
A2. Does applicant have a PAN Card?
A3. Is the 4th character of applicant's PAN the letter "P"? (indicates individual)
A4. Is the applicant photograph consistent across PAN and Aadhaar? (visual check)
A5. Is PAN format valid? (pattern: 5 letters, 4 digits, 1 letter — e.g. ABCDE1234F)
A6. Is Date of Birth consistent across PAN and Aadhaar?
A7. Is applicant age between 20 and 60 years? (calculate from DOB)
A8. Are permanent and correspondence addresses same and matching Aadhaar address?
A9. Is name consistent across all provided documents?
A10. Is gender consistent across all provided documents?
A11. Does any address PIN code start with digit 9?
A12. If co-applicant PIN is provided, does it match applicant PIN?
A13. Is name in documents matching name in LOS?
A14. Is name in documents matching name in LMS?
A15. Is DOB in documents matching DOB in LOS and LMS?
A16. Is PAN in documents matching PAN in LOS and LMS?
A17. Is gender in documents matching gender in LOS and LMS?

Co-applicant checks (only if co-applicant documents are provided):
C1. Has co-applicant provided a valid Aadhaar?
C2. Does co-applicant have a PAN Card?
C3. Is the 4th character of co-applicant PAN "P"?
C4. Is co-applicant photograph consistent across their PAN and Aadhaar?
C5. Is co-applicant PAN format valid?
C6. Is co-applicant Date of Birth consistent across PAN and Aadhaar?
C7. Is co-applicant age between 20 and 60 years?
C8. Is co-applicant name consistent across all documents?
C9. Is co-applicant gender consistent across documents and LOS/LMS?
C10. Is co-applicant address in LOS matching LMS?

Business photo checks (only if business photo provided):
P1. What type of business is visible?
P2. List all items / inventory visible in the photo.
P3. Provide approximate business valuation range in INR based on visible assets, stock, fixtures, and typical market rates for this type of business.

STEP 3 — RISK RATING
For each FAIL, assign risk:
- HIGH: Identity mismatch (name/DOB/PAN/Aadhaar), invalid document, age out of range, PIN starts with 9
- MEDIUM: Address inconsistency, gender mismatch, LOS/LMS data mismatch
- LOW: Optional document missing, minor formatting issue, cannot verify due to image quality

STEP 4 — AUDIT OBSERVATIONS
If more than 50% of applicable checks FAIL, generate formal audit observations. Each observation must be a clear, professional sentence stating what was found, which documents are affected, and the risk implication.

=== RESPONSE FORMAT ===
Respond ONLY with valid JSON. No markdown, no backticks, no extra text before or after the JSON.

{
  "fileName": "${fileName}",
  "extractedData": {
    "applicant": {
      "name": "",
      "fatherName": "",
      "dob": "",
      "pan": "",
      "pan4thChar": "",
      "aadhaarLast4": "",
      "gender": "",
      "address": "",
      "pinCode": "",
      "age": ""
    },
    "coApplicant": {
      "name": "",
      "dob": "",
      "pan": "",
      "gender": "",
      "address": "",
      "pinCode": ""
    },
    "business": {
      "name": "",
      "gstNumber": "",
      "address": ""
    }
  },
  "checkResults": [
    {
      "id": "A1",
      "description": "Has applicant provided a valid Aadhaar?",
      "result": "PASS",
      "reason": "Aadhaar card found, 12-digit number visible",
      "risk": "NA"
    }
  ],
  "businessPhoto": {
    "businessType": "",
    "items": [],
    "valuationMin": 0,
    "valuationMax": 0,
    "currency": "INR",
    "notes": ""
  },
  "summary": {
    "totalChecks": 0,
    "passed": 0,
    "failed": 0,
    "cannotVerify": 0,
    "highRisk": 0,
    "mediumRisk": 0,
    "lowRisk": 0,
    "passRate": 0
  },
  "auditObservations": []
}
` });

  return [{ role: 'user', content }];
}

// ── RUN AUDIT ──
async function runAudit() {
  if (!state.apiKey) {
    alert('Please enter your Anthropic API key in Settings first.');
    return;
  }
  const fileName = document.getElementById('fileNameInput').value.trim() || ('FILE_' + (state.allResults.length + 1));
  const losLms = getLOSLMSData();

  document.getElementById('runBtn').disabled = true;
  document.getElementById('runBtnText').textContent = '⏳ Analysing...';
  document.getElementById('progressSection').style.display = 'block';
  setProgress(5, 'Reading uploaded documents...', 0);

  try {
    setProgress(20, 'Preparing documents for AI...', 1);
    const messages = await buildMessages(losLms, fileName);

    setProgress(40, 'AI is extracting fields and running checklist...', 2);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages,
      }),
    });

    setProgress(70, 'Cross-checking LOS/LMS data...', 3);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'API error ' + response.status);
    }

    const data = await response.json();
    setProgress(85, 'Generating observations and risk ratings...', 5);

    const rawText = (data.content || []).map(b => b.text || '').join('');
    const clean = rawText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    setProgress(100, 'Audit complete!', 7);
    state.allResults.push(result);
    updateSidebarStats();

    setTimeout(() => {
      document.getElementById('progressSection').style.display = 'none';
      document.getElementById('runBtn').disabled = false;
      document.getElementById('runBtnText').textContent = '▶ Run AI Audit';
      // navigate to reports
      document.querySelector('[data-page="reports"]').click();
    }, 800);

  } catch(e) {
    setProgress(0, '✗ Error: ' + e.message, 0);
    document.getElementById('runBtn').disabled = false;
    document.getElementById('runBtnText').textContent = '▶ Run AI Audit';
    console.error(e);
  }
}

// ── SIDEBAR STATS ──
function updateSidebarStats() {
  document.getElementById('ssStat1').textContent = state.allResults.length;
  const totalChecks = state.allResults.reduce((a,r) => a + (r.summary?.totalChecks||0), 0);
  const totalHigh = state.allResults.reduce((a,r) => a + (r.summary?.highRisk||0), 0);
  document.getElementById('ssStat2').textContent = totalChecks;
  document.getElementById('ssStat3').textContent = totalHigh;
}

// ── DASHBOARD ──
function renderDashboard() {
  if (state.allResults.length === 0) {
    document.getElementById('dashEmpty').style.display = 'block';
    document.getElementById('dashContent').style.display = 'none';
    return;
  }
  document.getElementById('dashEmpty').style.display = 'none';
  document.getElementById('dashContent').style.display = 'block';

  const R = state.allResults;
  const totFiles = R.length;
  const totChecks = R.reduce((a,r) => a + (r.summary?.totalChecks||0), 0);
  const totPass = R.reduce((a,r) => a + (r.summary?.passed||0), 0);
  const totFail = R.reduce((a,r) => a + (r.summary?.failed||0), 0);
  const totHigh = R.reduce((a,r) => a + (r.summary?.highRisk||0), 0);
  const totMed = R.reduce((a,r) => a + (r.summary?.mediumRisk||0), 0);
  const totLow = R.reduce((a,r) => a + (r.summary?.lowRisk||0), 0);
  const passRate = totChecks > 0 ? Math.round((totPass/totChecks)*100) : 0;

  document.getElementById('metricsRow').innerHTML = [
    { label: 'Files Audited', val: totFiles, cls: 'blue' },
    { label: 'Total Checks', val: totChecks, cls: '' },
    { label: 'Passed', val: totPass, cls: 'green' },
    { label: 'Failed', val: totFail, cls: 'red' },
    { label: 'Pass Rate', val: passRate + '%', cls: passRate >= 70 ? 'green' : passRate >= 50 ? 'amber' : 'red' },
    { label: 'High Risk', val: totHigh, cls: 'red' },
    { label: 'Medium Risk', val: totMed, cls: 'amber' },
    { label: 'Low Risk', val: totLow, cls: 'green' },
  ].map(m => `<div class="metric-card"><div class="mc-label">${m.label}</div><div class="mc-val ${m.cls}">${m.val}</div></div>`).join('');

  // Charts
  if (state.charts.passFailChart) state.charts.passFailChart.destroy();
  if (state.charts.riskChart) state.charts.riskChart.destroy();
  if (state.charts.trendChart) state.charts.trendChart.destroy();

  state.charts.passFailChart = new Chart(document.getElementById('passFailChart'), {
    type: 'bar',
    data: {
      labels: R.map(r => r.fileName || 'File'),
      datasets: [
        { label: 'Pass', data: R.map(r => r.summary?.passed||0), backgroundColor: '#16a34a' },
        { label: 'Fail', data: R.map(r => r.summary?.failed||0), backgroundColor: '#dc2626' },
        { label: 'Cannot Verify', data: R.map(r => r.summary?.cannotVerify||0), backgroundColor: '#4338ca' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9aa3b0', font: { size: 10 } }, grid: { color: '#2a2f3a' } },
        y: { ticks: { color: '#9aa3b0', font: { size: 10 } }, grid: { color: '#2a2f3a' } },
      },
    },
  });

  state.charts.riskChart = new Chart(document.getElementById('riskChart'), {
    type: 'doughnut',
    data: {
      labels: ['High Risk', 'Medium Risk', 'Low Risk'],
      datasets: [{ data: [totHigh, totMed, totLow], backgroundColor: ['#dc2626','#d97706','#16a34a'], borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#9aa3b0', font: { size: 11 }, boxWidth: 12 } } },
    },
  });

  state.charts.trendChart = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: R.map((r,i) => r.fileName || ('File '+(i+1))),
      datasets: [{
        label: 'Pass Rate %',
        data: R.map(r => r.summary?.passRate || (r.summary?.totalChecks > 0 ? Math.round((r.summary.passed/r.summary.totalChecks)*100) : 0)),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#3b82f6',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9aa3b0', font: { size: 10 } }, grid: { color: '#2a2f3a' } },
        y: { min: 0, max: 100, ticks: { color: '#9aa3b0', font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#2a2f3a' } },
      },
    },
  });
}

// ── REPORTS ──
function renderReports() {
  if (state.allResults.length === 0) {
    document.getElementById('reportsEmpty').style.display = 'block';
    document.getElementById('reportsContent').style.display = 'none';
    return;
  }
  document.getElementById('reportsEmpty').style.display = 'none';
  document.getElementById('reportsContent').style.display = 'block';

  document.getElementById('reportsList').innerHTML = state.allResults.map((r, idx) => buildReportCard(r, idx)).join('');
}

function buildReportCard(r, idx) {
  const s = r.summary || {};
  const passRate = s.totalChecks > 0 ? Math.round(((s.passed||0)/s.totalChecks)*100) : 0;
  const riskLabel = (s.highRisk||0) > 0 ? 'HIGH RISK' : (s.mediumRisk||0) > 0 ? 'MEDIUM RISK' : 'LOW RISK';
  const riskCls = (s.highRisk||0) > 0 ? 'high' : (s.mediumRisk||0) > 0 ? 'med' : 'low';

  // Extracted data section
  const appData = r.extractedData?.applicant || {};
  const coData = r.extractedData?.coApplicant || {};
  const bizData = r.extractedData?.business || {};

  const extRows = (obj, prefix) => Object.entries(obj)
    .filter(([k,v]) => v && v !== '')
    .map(([k,v]) => `<div class="ext-field"><div class="ef-label">${formatKey(k)}</div><div class="ef-val">${v}</div></div>`)
    .join('');

  const extSection = (extRows(appData,'app').length || extRows(coData,'co').length) ? `
    <div class="extracted-section">
      <div class="ext-title">Extracted Fields — Applicant</div>
      <div class="ext-grid">${extRows(appData,'app')}</div>
      ${extRows(coData,'co').length ? `<div class="ext-title" style="margin-top:10px;">Co-Applicant</div><div class="ext-grid">${extRows(coData,'co')}</div>` : ''}
      ${extRows(bizData,'biz').length ? `<div class="ext-title" style="margin-top:10px;">Business</div><div class="ext-grid">${extRows(bizData,'biz')}</div>` : ''}
    </div>` : '';

  // Checklist
  const checks = (r.checkResults || []).map(c => {
    const icon = c.result === 'PASS' ? '✓' : c.result === 'FAIL' ? '✗' : '?';
    const cls = c.result === 'PASS' ? 'pass' : c.result === 'FAIL' ? 'fail' : 'cannot';
    const riskBadge = c.result !== 'PASS' && c.risk && c.risk !== 'NA'
      ? `<span class="ci-risk risk-${c.risk === 'HIGH' ? 'high' : c.risk === 'MEDIUM' ? 'med' : 'low'}">${c.risk}</span>` : '';
    return `<div class="check-item ${cls}">
      <span class="ci-icon">${icon}</span>
      <div>
        <span class="ci-id">${c.id}</span>${riskBadge}
        — ${c.description}
        ${c.reason ? `<div style="font-size:11px;opacity:0.8;margin-top:2px;">${c.reason}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  // Observations
  const obsSection = r.auditObservations?.length ? `
    <div class="obs-section">
      <div class="obs-title">⚠ Audit Observations (${r.auditObservations.length})</div>
      ${r.auditObservations.map(o => `<div class="obs-item">${o}</div>`).join('')}
    </div>` : '';

  // Business photo
  const bizSection = r.businessPhoto?.businessType ? `
    <div class="biz-section">
      <div class="biz-title">📷 Business Analysis</div>
      <div><strong>${r.businessPhoto.businessType}</strong></div>
      <div class="biz-val" style="margin-top:6px;">₹${(r.businessPhoto.valuationMin||0).toLocaleString('en-IN')} – ₹${(r.businessPhoto.valuationMax||0).toLocaleString('en-IN')}</div>
      ${r.businessPhoto.items?.length ? `<div class="biz-items">Items seen: ${r.businessPhoto.items.join(', ')}</div>` : ''}
      ${r.businessPhoto.notes ? `<div class="biz-items" style="margin-top:4px;">${r.businessPhoto.notes}</div>` : ''}
    </div>` : '';

  return `
    <div class="report-card" id="rcard-${idx}">
      <div class="report-card-header" onclick="toggleReport(${idx})">
        <div class="rch-name">${r.fileName || ('File ' + (idx+1))}</div>
        <div class="rch-pills">
          <span class="pill pill-pass">${s.passed||0} pass</span>
          <span class="pill pill-fail">${s.failed||0} fail</span>
          <span class="pill pill-rate">${passRate}%</span>
          <span class="pill pill-${riskCls}">${riskLabel}</span>
        </div>
        <span class="rch-chevron" id="chevron-${idx}">▼</span>
      </div>
      <div class="report-card-body" id="rbody-${idx}">
        ${extSection}
        ${obsSection}
        ${bizSection}
        <div class="checklist-section">
          <div class="checklist-title">Checklist Results</div>
          ${checks}
        </div>
        <div class="report-actions">
          <button class="btn-outline" onclick="downloadFileReport(${idx})">⬇ Download Report (.txt)</button>
        </div>
      </div>
    </div>`;
}

function toggleReport(idx) {
  const body = document.getElementById('rbody-' + idx);
  const chevron = document.getElementById('chevron-' + idx);
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  chevron.classList.toggle('open', !isOpen);
}

function formatKey(k) {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

// ── DOWNLOAD: FILE REPORT ──
function downloadFileReport(idx) {
  const r = state.allResults[idx];
  if (!r) return;
  const s = r.summary || {};
  const passRate = s.totalChecks > 0 ? Math.round(((s.passed||0)/s.totalChecks)*100) : 0;

  let txt = '';
  txt += '╔══════════════════════════════════════════════════════════════╗\n';
  txt += '║           KYC AUDIT REPORT — INDIVIDUAL FILE               ║\n';
  txt += '╚══════════════════════════════════════════════════════════════╝\n\n';
  txt += `File ID       : ${r.fileName}\n`;
  txt += `Date          : ${new Date().toLocaleDateString('en-IN')}\n`;
  txt += `Time          : ${new Date().toLocaleTimeString('en-IN')}\n\n`;

  txt += '── SUMMARY ─────────────────────────────────────────────────────\n';
  txt += `Total Checks  : ${s.totalChecks||0}\n`;
  txt += `Passed        : ${s.passed||0}\n`;
  txt += `Failed        : ${s.failed||0}\n`;
  txt += `Cannot Verify : ${s.cannotVerify||0}\n`;
  txt += `Pass Rate     : ${passRate}%\n`;
  txt += `High Risk     : ${s.highRisk||0}\n`;
  txt += `Medium Risk   : ${s.mediumRisk||0}\n`;
  txt += `Low Risk      : ${s.lowRisk||0}\n\n`;

  txt += '── EXTRACTED DATA ──────────────────────────────────────────────\n';
  if (r.extractedData?.applicant) {
    txt += 'Applicant:\n';
    Object.entries(r.extractedData.applicant).forEach(([k,v]) => { if (v) txt += `  ${formatKey(k).padEnd(20)}: ${v}\n`; });
  }
  if (r.extractedData?.coApplicant?.name) {
    txt += 'Co-Applicant:\n';
    Object.entries(r.extractedData.coApplicant).forEach(([k,v]) => { if (v) txt += `  ${formatKey(k).padEnd(20)}: ${v}\n`; });
  }
  txt += '\n';

  txt += '── CHECKLIST RESULTS ───────────────────────────────────────────\n';
  (r.checkResults || []).forEach(c => {
    const mark = c.result === 'PASS' ? '[PASS]' : c.result === 'FAIL' ? '[FAIL]' : '[N/V] ';
    txt += `${mark} ${c.id.padEnd(4)} ${c.description}\n`;
    if (c.reason) txt += `       Reason : ${c.reason}\n`;
    if (c.risk && c.risk !== 'NA' && c.result !== 'PASS') txt += `       Risk   : ${c.risk}\n`;
    txt += '\n';
  });

  if (r.auditObservations?.length) {
    txt += '── AUDIT OBSERVATIONS ──────────────────────────────────────────\n';
    r.auditObservations.forEach((o, i) => { txt += `${i+1}. ${o}\n`; });
    txt += '\n';
  }

  if (r.businessPhoto?.businessType) {
    txt += '── BUSINESS PHOTO ANALYSIS ─────────────────────────────────────\n';
    txt += `Business Type : ${r.businessPhoto.businessType}\n`;
    txt += `Valuation     : ₹${(r.businessPhoto.valuationMin||0).toLocaleString('en-IN')} – ₹${(r.businessPhoto.valuationMax||0).toLocaleString('en-IN')} INR\n`;
    if (r.businessPhoto.items?.length) txt += `Items Seen    : ${r.businessPhoto.items.join(', ')}\n`;
    if (r.businessPhoto.notes) txt += `Notes         : ${r.businessPhoto.notes}\n`;
    txt += '\n';
  }

  txt += '════════════════════════════════════════════════════════════════\n';
  txt += 'Generated by KYC Audit Automation Tool\n';

  downloadText(txt, `KYC_Report_${r.fileName}.txt`);
}

// ── DOWNLOAD: MASTER REPORT ──
function downloadMasterReport() {
  if (state.allResults.length === 0) { alert('No audit results to export.'); return; }

  const totChecks = state.allResults.reduce((a,r) => a + (r.summary?.totalChecks||0), 0);
  const totPass = state.allResults.reduce((a,r) => a + (r.summary?.passed||0), 0);
  const totHigh = state.allResults.reduce((a,r) => a + (r.summary?.highRisk||0), 0);

  let txt = '';
  txt += '╔══════════════════════════════════════════════════════════════╗\n';
  txt += '║            KYC MASTER AUDIT REPORT                         ║\n';
  txt += '╚══════════════════════════════════════════════════════════════╝\n\n';
  txt += `Generated     : ${new Date().toLocaleString('en-IN')}\n`;
  txt += `Total Files   : ${state.allResults.length}\n`;
  txt += `Total Checks  : ${totChecks}\n`;
  txt += `Total Passed  : ${totPass}\n`;
  txt += `High Risk Obs : ${totHigh}\n\n`;

  txt += '── FILE SUMMARY TABLE ──────────────────────────────────────────\n';
  txt += 'File'.padEnd(30) + 'Checks'.padEnd(8) + 'Pass'.padEnd(8) + 'Fail'.padEnd(8) + 'High'.padEnd(8) + 'Rate\n';
  txt += '─'.repeat(68) + '\n';
  state.allResults.forEach(r => {
    const s = r.summary || {};
    const rate = s.totalChecks > 0 ? Math.round(((s.passed||0)/s.totalChecks)*100) + '%' : '—';
    txt += (r.fileName||'—').padEnd(30) + String(s.totalChecks||0).padEnd(8) + String(s.passed||0).padEnd(8) + String(s.failed||0).padEnd(8) + String(s.highRisk||0).padEnd(8) + rate + '\n';
  });
  txt += '\n';

  txt += '── OBSERVATIONS ACROSS ALL FILES ───────────────────────────────\n';
  state.allResults.forEach((r, i) => {
    if (r.auditObservations?.length) {
      txt += `\n[${r.fileName}]\n`;
      r.auditObservations.forEach((o, j) => { txt += `  ${j+1}. ${o}\n`; });
    }
  });

  txt += '\n════════════════════════════════════════════════════════════════\n';
  txt += 'Generated by KYC Audit Automation Tool\n';

  downloadText(txt, 'KYC_Master_Report.txt');
}

// ── DOWNLOAD: CSV ──
function downloadMasterCSV() {
  if (state.allResults.length === 0) { alert('No audit results to export.'); return; }
  const rows = [['File ID','Total Checks','Passed','Failed','Cannot Verify','High Risk','Medium Risk','Low Risk','Pass Rate %','Observations']];
  state.allResults.forEach(r => {
    const s = r.summary || {};
    const rate = s.totalChecks > 0 ? Math.round(((s.passed||0)/s.totalChecks)*100) : 0;
    rows.push([
      r.fileName||'—', s.totalChecks||0, s.passed||0, s.failed||0, s.cannotVerify||0,
      s.highRisk||0, s.mediumRisk||0, s.lowRisk||0, rate,
      (r.auditObservations||[]).join(' | '),
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadText(csv, 'KYC_Master_Report.csv');
}

function downloadText(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── INIT ──
updateApiStatus();
