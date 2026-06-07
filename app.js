/* ── KYC AUDIT TOOL — app.js ── */

const S = {
  apiKey: '',
  docs: [],       // { id, name, size, file, status, result, error }
  losLms: {},
  filter: 'all',
  sortKey: 'name',
  sortDir: 1,
  charts: {},
  threshHigh: 50,
  threshMed: 25,
};

/* ── NAV ── */
function navTo(page) {
  ['input','dashboard','reports'].forEach(p => {
    document.getElementById('page-' + p).style.display = p === page ? 'block' : 'none';
  });
  document.querySelectorAll('.seg button[data-page]').forEach(b => {
    b.classList.toggle('on', b.dataset.page === page);
  });
  if (page === 'dashboard') renderDashboard();
  if (page === 'reports') renderReports();
}

/* ── SETTINGS ── */
function openSettings() { document.getElementById('settingsOverlay').style.display = 'grid'; }
function closeSettings() { document.getElementById('settingsOverlay').style.display = 'none'; }
function saveApiKey() {
  S.apiKey = document.getElementById('apiKeyInput').value.trim();
  document.getElementById('apiSaveMsg').style.display = 'block';
  const badge = document.getElementById('apiBadge');
  if (S.apiKey) {
    badge.textContent = '✓ API key active';
    badge.className = 'conf-badge';
  } else {
    badge.textContent = 'No API key';
    badge.className = 'conf-badge warn';
  }
}
function saveThresholds() {
  S.threshHigh = parseInt(document.getElementById('threshHigh').value) || 50;
  S.threshMed  = parseInt(document.getElementById('threshMed').value)  || 25;
}

/* ── DROPZONE ── */
function dzOver(e)  { e.preventDefault(); document.getElementById('dropzone').classList.add('over'); }
function dzLeave()  { document.getElementById('dropzone').classList.remove('over'); }
function dzDrop(e)  { e.preventDefault(); dzLeave(); addFiles(e.dataTransfer.files); }

function addFiles(files) {
  Array.from(files).forEach(f => {
    S.docs.push({ id: uid(), name: f.name, size: f.size, file: f, status: 'queued', result: null, error: null });
  });
  renderFileList();
  checkRunEligible();
}

function removeDoc(id) {
  S.docs = S.docs.filter(d => d.id !== id);
  renderFileList();
  checkRunEligible();
}

function renderFileList() {
  const el = document.getElementById('fileList');
  const cnt = document.getElementById('fileCount');
  cnt.textContent = S.docs.length + ' file' + (S.docs.length !== 1 ? 's' : '');
  if (!S.docs.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = S.docs.map(d => `
    <div class="file-row">
      <div class="file-icon">${iconFor(d.name)}</div>
      <div class="file-meta">
        <div class="file-name">${esc(d.name)}</div>
        <div class="file-sub">${fmtSize(d.size)}</div>
      </div>
      <button class="x-btn" onclick="removeDoc('${d.id}')" title="Remove">✕</button>
    </div>`).join('');
}

function checkRunEligible() {
  const btn = document.getElementById('runBtn');
  const meta = document.getElementById('runMeta');
  btn.disabled = S.docs.length === 0;
  meta.textContent = S.docs.length
    ? S.docs.length + ' file' + (S.docs.length > 1 ? 's' : '') + ' ready to audit.'
    : 'Upload at least 1 document to begin.';
  if (S.docs.length) document.getElementById('wipeBtn').style.display = 'inline-flex';
}

/* ── DEMO FILES ── */
function loadDemo() {
  const names = [
    'Ramesh_Kumar_Aadhaar.jpg','Ramesh_Kumar_PAN.jpg',
    'Sunita_Devi_Aadhaar.jpg','Priya_Sharma_PAN.jpg',
    'Vikram_Singh_Agreement.pdf'
  ];
  const sizes = [245000, 180000, 210000, 175000, 340000];
  S.docs = names.map((name, i) => ({
    id: uid(), name, size: sizes[i], file: null,
    status: 'queued', result: null, error: null, isDemo: true
  }));
  renderFileList();
  checkRunEligible();
}

/* ── LOS/LMS ── */
function getLOSLMS() {
  const ids = ['los_name','lms_name','los_dob','lms_dob','los_pan','lms_pan',
               'los_gender','lms_gender','los_address','lms_address','los_pin','lms_risk'];
  const d = {};
  ids.forEach(id => { const el = document.getElementById(id); if (el && el.value.trim()) d[id] = el.value.trim(); });
  return d;
}

/* ── HELPERS ── */
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtSize(b) { return b > 1e6 ? (b/1e6).toFixed(1)+' MB' : Math.round(b/1024)+' KB'; }
function iconFor(name) { return /\.pdf$/i.test(name) ? '📄' : /\.(jpg|jpeg|png|webp)$/i.test(name) ? '🖼' : '📁'; }
function formatKey(k) { return k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()); }

async function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ── BUILD PROMPT ── */
async function buildMessages(doc, losLms) {
  const content = [];
  const docLabels = {
    aadhaar:'Aadhaar Card', pan:'PAN Card', photo:'Business Visit Photo',
    agreement:'Loan Agreement', gst:'GST/Udyam Certificate', bank:'Bank Statement'
  };

  if (doc.file && !doc.isDemo) {
    try {
      const b64 = await fileToBase64(doc.file);
      const mt = doc.file.type.includes('pdf') ? 'application/pdf' : (doc.file.type || 'image/jpeg');
      // guess doc type from filename
      const fn = doc.name.toLowerCase();
      const label = fn.includes('aadhaar') || fn.includes('aadhar') ? 'Aadhaar Card'
        : fn.includes('pan') ? 'PAN Card'
        : fn.includes('photo') || fn.includes('shop') || fn.includes('biz') ? 'Business Visit Photo'
        : fn.includes('agree') || fn.includes('kfs') ? 'Loan Agreement'
        : fn.includes('gst') || fn.includes('udyam') || fn.includes('msme') ? 'GST/Udyam Certificate'
        : fn.includes('bank') ? 'Bank Statement'
        : 'KYC Document';
      if (mt === 'application/pdf') {
        content.push({ type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 }, title:label });
      } else {
        content.push({ type:'image', source:{ type:'base64', media_type:mt, data:b64 } });
        content.push({ type:'text', text:`[Above image is: ${label}]` });
      }
    } catch(e) { /* skip unreadable file */ }
  }

  const losText = Object.keys(losLms).length
    ? Object.entries(losLms).map(([k,v])=>`${k}: ${v}`).join('\n')
    : 'No LOS/LMS data provided.';

  const isDemo = doc.isDemo;
  const demoNote = isDemo ? `
NOTE: This is a DEMO run. No actual document was uploaded. Generate realistic but synthetic KYC audit results for an Indian loan applicant named "${doc.name.replace(/\.[^.]+$/,'').replace(/_/g,' ')}". Make most checks PASS but introduce 2-3 realistic failures to demonstrate the tool.` : '';

  content.push({ type:'text', text:`
You are a senior KYC auditor at an Indian financial institution. File: "${doc.name}".${demoNote}

LOS/LMS DATA:
${losText}

YOUR TASKS:

1. EXTRACT fields from every document (handle Hindi, Tamil, Telugu, Kannada by translating to English):
   From Aadhaar: Name, Father's Name, DOB, Aadhaar Number (mask first 8 digits), Gender, Address, PIN Code
   From PAN: Name, Father's Name, DOB, PAN Number, 4th character of PAN
   From GST/Udyam: Business Name, Registration No., Address, Business Type
   From Agreement/KFS: Borrower Name, Loan Amount, Date

2. RUN CHECKLIST — answer each as PASS / FAIL / CANNOT_VERIFY with a reason:

Applicant:
A1. Valid Aadhaar provided? (12-digit format)
A2. PAN Card provided?
A3. 4th character of PAN is "P"? (confirms individual)
A4. Photograph consistent across PAN and Aadhaar?
A5. PAN format valid? (5 letters + 4 digits + 1 letter)
A6. Date of Birth consistent across PAN and Aadhaar?
A7. Applicant age between 20 and 60 years?
A8. Permanent and correspondence addresses same and match Aadhaar?
A9. Name consistent across all documents?
A10. Gender consistent across all documents?
A11. Any address PIN code starts with digit 9?
A12. Co-applicant PIN matches applicant PIN?
A13. Name in documents matches LOS?
A14. Name in documents matches LMS?
A15. DOB consistent across LOS and LMS?
A16. PAN in documents matches LOS/LMS?
A17. Gender consistent across LOS and LMS?

Co-applicant (if documents provided):
C1. Valid Aadhaar provided?
C2. PAN Card provided?
C3. 4th character of co-applicant PAN is "P"?
C4. Co-applicant photograph consistent across documents?
C5. Co-applicant PAN format valid?
C6. Co-applicant DOB consistent across PAN and Aadhaar?
C7. Co-applicant age between 20 and 60 years?
C8. Co-applicant name consistent across all documents?
C9. Co-applicant gender consistent with LOS/LMS?
C10. Co-applicant address consistent across LOS and LMS?

Business photo (if provided):
P1. What type of business is visible?
P2. List all items/inventory visible.
P3. Approximate business valuation in INR based on visible assets.

3. RISK per FAIL:
   HIGH: Identity mismatch, invalid document format, age violation, PIN starting with 9
   MEDIUM: Address/DOB/gender inconsistency, LOS-LMS mismatch
   LOW: Optional field missing, image quality issue

4. OBSERVATIONS: If >50% of applicable checks FAIL, write formal audit observations.

Respond ONLY with valid JSON — no markdown, no backticks:
{
  "fileName": "${doc.name}",
  "extractedData": {
    "applicant": { "name":"","fatherName":"","dob":"","pan":"","pan4thChar":"","aadhaarLast4":"","gender":"","address":"","pinCode":"","age":"" },
    "coApplicant": { "name":"","dob":"","pan":"","gender":"","address":"","pinCode":"" },
    "business": { "name":"","registrationNo":"","address":"","type":"" }
  },
  "checkResults": [
    { "id":"A1","description":"Valid Aadhaar provided?","result":"PASS","reason":"12-digit Aadhaar visible","risk":"NA" }
  ],
  "businessPhoto": { "businessType":"","items":[],"valuationMin":0,"valuationMax":0,"notes":"" },
  "summary": { "totalChecks":0,"passed":0,"failed":0,"cannotVerify":0,"highRisk":0,"mediumRisk":0,"lowRisk":0,"passRate":0 },
  "auditObservations": []
}` });

  return [{ role:'user', content }];
}

/* ── RUN ALL ── */
async function runAll() {
  if (!S.apiKey) { showRunError('Please enter your Anthropic API key in Settings first.'); return; }
  if (!S.docs.length) { showRunError('Upload at least one document.'); return; }
  hideRunError();

  const concurrency = Math.max(1, Math.min(5, parseInt(document.getElementById('concurrency').value) || 2));
  const losLms = getLOSLMS();

  // reset all docs
  S.docs.forEach(d => { d.status = 'queued'; d.result = null; d.error = null; });

  document.getElementById('runBtn').disabled = true;
  document.getElementById('runBtn').innerHTML = '<span class="spinner"></span> Running...';
  document.getElementById('navDash').disabled = false;
  document.getElementById('navReports').disabled = false;

  navTo('dashboard');

  // process in batches
  const queue = S.docs.map((d, i) => i);
  const workers = Array.from({ length: concurrency }, () => processNext(queue, losLms));
  await Promise.all(workers);

  document.getElementById('runBtn').disabled = false;
  document.getElementById('runBtn').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run KYC Audit';
  renderDashboard();
}

async function processNext(queue, losLms) {
  while (queue.length) {
    const idx = queue.shift();
    const doc = S.docs[idx];
    if (!doc) continue;
    doc.status = 'running';
    renderBulkTable();
    try {
      const messages = await buildMessages(doc, losLms);
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-api-key': S.apiKey,
          'anthropic-version':'2023-06-01',
          'anthropic-dangerous-direct-browser-access':'true',
        },
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:4000, messages }),
      });
      if (!resp.ok) { const e = await resp.json(); throw new Error(e.error?.message || 'API error ' + resp.status); }
      const data = await resp.json();
      const raw = (data.content||[]).map(b=>b.text||'').join('').replace(/```json|```/g,'').trim();
      doc.result = JSON.parse(raw);
      doc.status = 'done';
    } catch(e) {
      doc.error = e.message;
      doc.status = 'error';
    }
    renderBulkTable();
    updateDashHero();
  }
}

function showRunError(msg) { const el = document.getElementById('runError'); el.textContent = msg; el.style.display = 'block'; }
function hideRunError() { document.getElementById('runError').style.display = 'none'; }

/* ── DASHBOARD ── */
function renderDashboard() {
  const done = S.docs.filter(d => d.status === 'done' && d.result);
  const total = S.docs.length;
  const running = S.docs.filter(d => d.status === 'running').length;

  // lede
  if (running) {
    document.getElementById('dashLede').textContent = `Processing ${running} file${running>1?'s':''} — results update in real time.`;
  } else {
    document.getElementById('dashLede').textContent = `${done.length} of ${total} files processed successfully.`;
  }

  updateDashHero();
  renderPassFailCards();
  renderCharts();
  renderBulkTable();
  updateFilterCounts();
}

function updateDashHero() {
  const done = S.docs.filter(d => d.status === 'done' && d.result);
  const total = S.docs.length;
  const totalChecks = done.reduce((a,d) => a + (d.result?.summary?.totalChecks||0), 0);
  const totalPass = done.reduce((a,d) => a + (d.result?.summary?.passed||0), 0);
  const totalFail = done.reduce((a,d) => a + (d.result?.summary?.failed||0), 0);
  const totalHigh = done.reduce((a,d) => a + (d.result?.summary?.highRisk||0), 0);
  const totalMed  = done.reduce((a,d) => a + (d.result?.summary?.mediumRisk||0), 0);
  const totalLow  = done.reduce((a,d) => a + (d.result?.summary?.lowRisk||0), 0);

  // count files that fully passed (0 failures)
  const filesPassed = done.filter(d => (d.result?.summary?.failed||0) === 0).length;
  const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;

  document.getElementById('heroPass').textContent = filesPassed;
  document.getElementById('heroTotal').textContent = total;
  document.getElementById('heroSub').textContent = `· ${done.length} audited · ${total - done.length} pending`;
  document.getElementById('heroProg').style.width = pct + '%';
  document.getElementById('heroProgLabel').textContent = pct + '%';

  const bandTotal = totalHigh + totalMed + totalLow || 1;
  document.getElementById('heroBars').innerHTML = [
    { label:'High risk', color:'#C04646', count:totalHigh },
    { label:'Medium risk', color:'#C28A1B', count:totalMed },
    { label:'Low risk', color:'#2E9461', count:totalLow },
    { label:'Passed checks', color:'#1E4FE0', count:totalPass },
  ].map(b => `
    <div class="band-bar-row">
      <div class="band-bar-label"><div class="band-dot" style="background:${b.color}"></div>${b.label}</div>
      <div class="band-bar-track"><div class="band-bar-fill" style="background:${b.color};width:${Math.round(b.count/(bandTotal)*100)}%"></div></div>
      <div class="band-bar-count" style="color:${b.color}">${b.count}</div>
    </div>`).join('');
}

function renderPassFailCards() {
  const done = S.docs.filter(d => d.status === 'done' && d.result);
  const totalChecks = done.reduce((a,d) => a + (d.result?.summary?.totalChecks||0), 0);
  const totalPass   = done.reduce((a,d) => a + (d.result?.summary?.passed||0), 0);
  const totalFail   = done.reduce((a,d) => a + (d.result?.summary?.failed||0), 0);
  const totalHigh   = done.reduce((a,d) => a + (d.result?.summary?.highRisk||0), 0);
  const totalMed    = done.reduce((a,d) => a + (d.result?.summary?.mediumRisk||0), 0);
  const passRate    = totalChecks > 0 ? Math.round((totalPass/totalChecks)*100) : 0;

  document.getElementById('passfailCards').innerHTML = `
    <div class="pf-card pf-meta"><div class="pf-num">${S.docs.length}</div><div class="pf-label">Total files</div><div class="pf-sub">${done.length} completed</div></div>
    <div class="pf-card pf-meta"><div class="pf-num">${totalChecks}</div><div class="pf-label">Total checks run</div><div class="pf-sub">across all files</div></div>
    <div class="pf-card pf-pass"><div class="pf-num">${totalPass}</div><div class="pf-label">Checks passed</div><div class="pf-sub">${passRate}% pass rate</div></div>
    <div class="pf-card pf-fail"><div class="pf-num">${totalFail}</div><div class="pf-label">Checks failed</div><div class="pf-sub">${100-passRate}% fail rate</div></div>
    <div class="pf-card pf-high"><div class="pf-num">${totalHigh}</div><div class="pf-label">High risk obs.</div><div class="pf-sub">${totalMed} medium · ${done.reduce((a,d)=>a+(d.result?.summary?.lowRisk||0),0)} low</div></div>`;
}

function renderCharts() {
  const done = S.docs.filter(d => d.status === 'done' && d.result);
  if (!done.length) return;

  if (S.charts.pf) S.charts.pf.destroy();
  if (S.charts.risk) S.charts.risk.destroy();

  const labels = done.map(d => d.result.fileName || d.name).map(n => n.length > 14 ? n.slice(0,12)+'…' : n);
  S.charts.pf = new Chart(document.getElementById('passFailChart'), {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Pass', data:done.map(d=>d.result.summary?.passed||0), backgroundColor:'#2E9461' },
        { label:'Fail', data:done.map(d=>d.result.summary?.failed||0), backgroundColor:'#C04646' },
        { label:"Can't verify", data:done.map(d=>d.result.summary?.cannotVerify||0), backgroundColor:'#9AA3B2' },
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ font:{size:11}, boxWidth:10 } } },
      scales:{
        x:{ ticks:{ font:{size:10}, color:'#6B7385' }, grid:{ color:'#EEF0F4' } },
        y:{ ticks:{ font:{size:10}, color:'#6B7385' }, grid:{ color:'#EEF0F4' } }
      }
    }
  });

  const high = done.reduce((a,d)=>a+(d.result.summary?.highRisk||0),0);
  const med  = done.reduce((a,d)=>a+(d.result.summary?.mediumRisk||0),0);
  const low  = done.reduce((a,d)=>a+(d.result.summary?.lowRisk||0),0);
  S.charts.risk = new Chart(document.getElementById('riskChart'), {
    type:'doughnut',
    data:{
      labels:['High risk','Medium risk','Low risk'],
      datasets:[{ data:[high,med,low], backgroundColor:['#C04646','#C28A1B','#2E9461'], borderWidth:0 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ font:{size:11}, boxWidth:10 } } }
    }
  });
}

/* ── BULK TABLE ── */
let currentFilter = 'all';
let searchQuery = '';

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('#filterSeg button').forEach(b => b.classList.toggle('on', b.dataset.filter === f));
  renderBulkTable();
}
function filterTable() { searchQuery = document.getElementById('searchInput').value.toLowerCase(); renderBulkTable(); }

function updateFilterCounts() {
  const done = S.docs.filter(d => d.status === 'done' && d.result);
  document.getElementById('fc-all').textContent  = S.docs.length;
  document.getElementById('fc-pass').textContent = done.filter(d => (d.result.summary?.failed||0) === 0).length;
  document.getElementById('fc-fail').textContent = done.filter(d => (d.result.summary?.failed||0) > 0).length;
  document.getElementById('fc-high').textContent = done.filter(d => (d.result.summary?.highRisk||0) > 0).length;
  document.getElementById('tableSubtitle').textContent = `${done.length} of ${S.docs.length} files processed`;
}

function renderBulkTable() {
  updateFilterCounts();
  let rows = S.docs.filter(d => {
    if (searchQuery && !d.name.toLowerCase().includes(searchQuery)) return false;
    if (currentFilter === 'pass') return d.status === 'done' && (d.result?.summary?.failed||0) === 0;
    if (currentFilter === 'fail') return d.status === 'done' && (d.result?.summary?.failed||0) > 0;
    if (currentFilter === 'high') return d.status === 'done' && (d.result?.summary?.highRisk||0) > 0;
    return true;
  });

  const table = document.getElementById('bulkTable');
  if (!rows.length) { table.innerHTML = '<div class="empty-row">No files match the current filter.</div>'; return; }

  table.innerHTML = `
    <div class="bulk-row bulk-head">
      <div>#</div><div>File</div><div>Checklist</div><div>Risk</div><div>Rate</div><div></div>
    </div>
    ${rows.map((d, i) => {
      const s = d.result?.summary || {};
      const pass = s.passed||0, fail = s.failed||0, cant = s.cannotVerify||0, total = s.totalChecks||1;
      const rate = Math.round((pass/total)*100);
      const high = s.highRisk||0, med = s.mediumRisk||0, low = s.lowRisk||0;
      const riskLabel = high>0?'high':med>0?'med':'low';
      const riskText  = high>0?'High risk':med>0?'Medium risk':'Low risk';

      if (d.status === 'queued') return `<div class="bulk-row"><div class="b-i">${i+1}</div><div><div class="bn-title">${esc(d.name)}</div><div class="bn-sub">Queued</div></div><div>—</div><div>—</div><div>—</div><div></div></div>`;
      if (d.status === 'running') return `<div class="bulk-row"><div class="b-i">${i+1}</div><div><div class="bn-title">${esc(d.name)}</div><div class="bn-sub">Processing…</div></div><div><div class="mini-spinner"></div></div><div>—</div><div>—</div><div></div></div>`;
      if (d.status === 'error') return `<div class="bulk-row error"><div class="b-i">${i+1}</div><div><div class="bn-title">${esc(d.name)}</div><div class="bn-sub" style="color:#C04646">${esc(d.error||'Error')}</div></div><div>—</div><div>—</div><div>—</div><div></div></div>`;

      return `<div class="bulk-row" onclick="openDetail('${d.id}')">
        <div class="b-i">${i+1}</div>
        <div><div class="bn-title">${esc(d.name)}</div><div class="bn-sub">${d.result?.extractedData?.applicant?.name||''}</div></div>
        <div>
          <div class="mini-stack">
            <div style="width:${Math.round(pass/total*100)}%;background:#2E9461"></div>
            <div style="width:${Math.round(fail/total*100)}%;background:#C04646"></div>
            <div style="width:${Math.round(cant/total*100)}%;background:#9AA3B2"></div>
          </div>
          <div class="mini-counts">
            <span style="color:#2E9461">${pass}✓</span>
            <span style="color:#C04646">${fail}✗</span>
            ${cant?`<span style="color:#9AA3B2">${cant}?</span>`:''}
          </div>
        </div>
        <div><span class="pill pill-${riskLabel}">${riskText}</span></div>
        <div style="font-weight:600;font-size:14px;color:${rate>=70?'#2E9461':rate>=50?'#C28A1B':'#C04646'}">${rate}%</div>
        <div class="b-action">›</div>
      </div>`;
    }).join('')}`;
}

/* ── DETAIL OVERLAY ── */
function openDetail(id) {
  const doc = S.docs.find(d => d.id === id);
  if (!doc || !doc.result) return;
  const r = doc.result;
  const s = r.summary || {};
  const pass = s.passed||0, fail = s.failed||0, cant = s.cannotVerify||0, total = s.totalChecks||1;
  const rate = Math.round((pass/total)*100);
  const high = s.highRisk||0, med = s.mediumRisk||0;
  const riskLabel = high>0?'High risk':med>0?'Medium risk':'Low risk';
  const riskColor = high>0?'var(--red)':med>0?'var(--amber)':'var(--green)';

  const app = r.extractedData?.applicant || {};
  const coapp = r.extractedData?.coApplicant || {};
  const biz = r.extractedData?.business || {};

  const extFields = (obj) => Object.entries(obj).filter(([k,v])=>v&&v!=='').map(([k,v])=>`
    <div class="ext-field"><div class="ef-label">${formatKey(k)}</div><div class="ef-val">${esc(v)}</div></div>`).join('');

  const checks = (r.checkResults||[]).map(c => {
    const cls = c.result==='PASS'?'pass':c.result==='FAIL'?'fail':'cant';
    const icon = c.result==='PASS'?'✓':c.result==='FAIL'?'✗':'?';
    const riskBadge = (c.result!=='PASS'&&c.risk&&c.risk!=='NA')
      ?`<span class="ci-risk risk-${c.risk==='HIGH'?'high':c.risk==='MEDIUM'?'med':'low'}">${c.risk}</span>`:'';
    return `<div class="check-item ${cls}"><span class="ci-icon">${icon}</span><div><span class="ci-id">${c.id}</span>${riskBadge} ${esc(c.description)}${c.reason?`<div style="font-size:11px;opacity:.75;margin-top:2px">${esc(c.reason)}</div>`:''}</div></div>`;
  }).join('');

  const obs = r.auditObservations?.length?`<div class="obs-box"><div class="obs-title">⚠ Audit Observations</div>${r.auditObservations.map(o=>`<div class="obs-item">${esc(o)}</div>`).join('')}</div>`:'';
  const bizBox = r.businessPhoto?.businessType?`<div class="biz-box"><div class="biz-box-title">📷 Business Analysis</div><strong>${esc(r.businessPhoto.businessType)}</strong><div class="biz-valuation" style="margin-top:6px">₹${(r.businessPhoto.valuationMin||0).toLocaleString('en-IN')} – ₹${(r.businessPhoto.valuationMax||0).toLocaleString('en-IN')}</div>${r.businessPhoto.items?.length?`<div style="font-size:12px;color:var(--muted);margin-top:4px">Items: ${r.businessPhoto.items.join(', ')}</div>`:''}</div>`:'';

  document.getElementById('detailPane').innerHTML = `
    <div class="dive-head">
      <div>
        <div class="eyebrow">File Detail</div>
        <h3>${esc(doc.name)}</h3>
      </div>
      <button class="ghost-btn" onclick="closeDetail()">✕ Close</button>
    </div>
    <div class="dive-body">
      <div class="dive-col">
        <div class="applicant">${esc(app.name||r.fileName||doc.name)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
          <span class="pill ${fail===0?'pill-pass':'pill-fail'}">${fail===0?'✓ All checks passed':'✗ '+fail+' check'+(fail>1?'s':'')+' failed'}</span>
          <span class="pill" style="background:var(--surface-2);color:var(--muted)">${rate}% pass rate</span>
        </div>
        <div class="detail-score-row">
          <div><div class="ds-num" style="color:${riskColor}">${rate}<span>%</span></div></div>
          <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted)">
            <div>✓ ${pass} passed</div>
            <div style="color:var(--red)">✗ ${fail} failed</div>
            <div>? ${cant} unverifiable</div>
          </div>
        </div>
        <div class="recommendation" style="border-color:${riskColor}">
          <div class="rec-label" style="color:${riskColor}">${riskLabel}</div>
          <div class="rec-title">${fail===0?'File cleared — no issues found':high>0?'Immediate review required':med>0?'Conditional — review flagged items':'Minor observations noted'}</div>
          <div class="rec-reasoning">${r.auditObservations?.length?r.auditObservations[0]:(fail===0?'All KYC checks passed. File is compliant.':'Review the failed checklist items and resolve before proceeding.')}</div>
        </div>
        ${app.name||Object.keys(app).some(k=>app[k]) ? `
        <div style="margin-top:18px">
          <div class="dive-label">Extracted — Applicant</div>
          <div class="ext-grid">${extFields(app)}</div>
          ${Object.values(coapp).some(v=>v)?`<div class="dive-label" style="margin-top:12px">Co-Applicant</div><div class="ext-grid">${extFields(coapp)}</div>`:''}
          ${Object.values(biz).some(v=>v)?`<div class="dive-label" style="margin-top:12px">Business</div><div class="ext-grid">${extFields(biz)}</div>`:''}
        </div>`:''
        }
        ${bizBox}
        <div style="margin-top:16px;display:flex;gap:8px;">
          <button class="ghost-btn" onclick="downloadFileReport('${id}')">⬇ Download Report</button>
        </div>
      </div>
      <div class="dive-col">
        <div class="dive-label">Checklist Results (${total} checks)</div>
        ${obs}
        ${checks}
      </div>
    </div>`;

  document.getElementById('detailOverlay').style.display = 'grid';
}
function closeDetail() { document.getElementById('detailOverlay').style.display = 'none'; }

/* ── REPORTS PAGE ── */
function renderReports() {
  const done = S.docs.filter(d => d.status === 'done' && d.result);
  const el = document.getElementById('reportsList');
  if (!done.length) {
    el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--muted)">No audit results yet. Run an audit first.</div>';
    return;
  }
  el.innerHTML = done.map((d, i) => buildReportCard(d, i)).join('');
}

function buildReportCard(doc, idx) {
  const r = doc.result;
  const s = r.summary || {};
  const pass = s.passed||0, fail = s.failed||0, total = s.totalChecks||1;
  const rate = Math.round((pass/total)*100);
  const high = s.highRisk||0, med = s.mediumRisk||0;
  const riskCls = high>0?'high':med>0?'med':'low';
  const riskText = high>0?'High Risk':med>0?'Medium Risk':'Low Risk';

  const app = r.extractedData?.applicant || {};
  const extRows = Object.entries(app).filter(([k,v])=>v&&v!=='')
    .map(([k,v])=>`<div class="ext-field"><div class="ef-label">${formatKey(k)}</div><div class="ef-val">${esc(v)}</div></div>`).join('');

  const checks = (r.checkResults||[]).map(c => {
    const cls = c.result==='PASS'?'pass':c.result==='FAIL'?'fail':'cant';
    const icon = c.result==='PASS'?'✓':c.result==='FAIL'?'✗':'?';
    const rb = (c.result!=='PASS'&&c.risk&&c.risk!=='NA')?`<span class="ci-risk risk-${c.risk==='HIGH'?'high':c.risk==='MEDIUM'?'med':'low'}">${c.risk}</span>`:'';
    return `<div class="check-item ${cls}"><span class="ci-icon">${icon}</span><div><span class="ci-id">${c.id}</span>${rb} ${esc(c.description)}${c.reason?`<div style="font-size:11px;opacity:.75;margin-top:2px">${esc(c.reason)}</div>`:''}</div></div>`;
  }).join('');

  const obs = r.auditObservations?.length?`<div class="obs-box"><div class="obs-title">⚠ Audit Observations (${r.auditObservations.length})</div>${r.auditObservations.map(o=>`<div class="obs-item">${esc(o)}</div>`).join('')}</div>`:'';
  const bizBox = r.businessPhoto?.businessType?`<div class="biz-box"><div class="biz-box-title">📷 Business Analysis</div><strong>${esc(r.businessPhoto.businessType)}</strong><div class="biz-valuation" style="margin-top:4px">₹${(r.businessPhoto.valuationMin||0).toLocaleString('en-IN')} – ₹${(r.businessPhoto.valuationMax||0).toLocaleString('en-IN')}</div>${r.businessPhoto.items?.length?`<div style="font-size:12px;color:var(--muted);margin-top:3px">Items: ${r.businessPhoto.items.join(', ')}</div>`:''}</div>`:'';

  return `
    <div class="report-card">
      <div class="report-card-header" onclick="toggleReport('rb-${idx}','rc-${idx}')">
        <div class="rch-name">${esc(doc.name)}</div>
        <div class="rch-pills">
          <span class="pill pill-pass">${pass} pass</span>
          <span class="pill pill-fail">${fail} fail</span>
          <span class="pill" style="background:var(--surface-2);color:var(--muted)">${rate}%</span>
          <span class="pill pill-${riskCls}">${riskText}</span>
        </div>
        <span class="rch-chevron" id="rc-${idx}">▼</span>
      </div>
      <div class="report-card-body" id="rb-${idx}">
        ${extRows?`<div class="rb-section"><div class="rb-label">Extracted Fields</div><div class="ext-grid">${extRows}</div></div>`:''}
        ${obs}${bizBox}
        <div class="rb-section"><div class="rb-label">Checklist (${total} checks)</div>${checks}</div>
        <div class="report-actions">
          <button class="ghost-btn" onclick="downloadFileReportById('${doc.id}')">⬇ Download Report (.txt)</button>
        </div>
      </div>
    </div>`;
}

function toggleReport(bodyId, chevId) {
  const body = document.getElementById(bodyId);
  const chev = document.getElementById(chevId);
  const open = body.classList.contains('open');
  body.classList.toggle('open', !open);
  if (chev) chev.classList.toggle('open', !open);
}

/* ── DOWNLOADS ── */
function downloadFileReportById(id) {
  const doc = S.docs.find(d => d.id === id);
  if (doc) downloadFileReport(id);
}

function downloadFileReport(id) {
  const doc = S.docs.find(d => d.id === id);
  if (!doc?.result) return;
  const r = doc.result;
  const s = r.summary || {};
  const rate = s.totalChecks>0 ? Math.round(((s.passed||0)/s.totalChecks)*100) : 0;
  let txt = '╔══════════════════════════════════════════════════════════╗\n';
  txt += '║         KYC AUDIT REPORT — INDIVIDUAL FILE             ║\n';
  txt += '╚══════════════════════════════════════════════════════════╝\n\n';
  txt += `File       : ${r.fileName}\nDate       : ${new Date().toLocaleDateString('en-IN')}\nTime       : ${new Date().toLocaleTimeString('en-IN')}\n\n`;
  txt += `── SUMMARY ─────────────────────────────────────────────────\n`;
  txt += `Total Checks : ${s.totalChecks||0}\nPassed       : ${s.passed||0}\nFailed       : ${s.failed||0}\nPass Rate    : ${rate}%\nHigh Risk    : ${s.highRisk||0} | Medium : ${s.mediumRisk||0} | Low : ${s.lowRisk||0}\n\n`;
  const app = r.extractedData?.applicant||{};
  if (Object.values(app).some(v=>v)) {
    txt += `── EXTRACTED DATA ───────────────────────────────────────────\n`;
    Object.entries(app).forEach(([k,v])=>{ if(v) txt += `  ${formatKey(k).padEnd(20)}: ${v}\n`; });
    txt += '\n';
  }
  txt += `── CHECKLIST ────────────────────────────────────────────────\n`;
  (r.checkResults||[]).forEach(c => {
    txt += `[${c.result.padEnd(13)}] ${c.id.padEnd(4)} ${c.description}\n`;
    if (c.reason) txt += `  Reason : ${c.reason}\n`;
    if (c.risk && c.risk!=='NA' && c.result!=='PASS') txt += `  Risk   : ${c.risk}\n`;
    txt += '\n';
  });
  if (r.auditObservations?.length) {
    txt += `── OBSERVATIONS ─────────────────────────────────────────────\n`;
    r.auditObservations.forEach((o,i)=>{ txt += `${i+1}. ${o}\n`; });
    txt += '\n';
  }
  if (r.businessPhoto?.businessType) {
    txt += `── BUSINESS ANALYSIS ────────────────────────────────────────\n`;
    txt += `Type      : ${r.businessPhoto.businessType}\nValuation : ₹${(r.businessPhoto.valuationMin||0).toLocaleString('en-IN')} – ₹${(r.businessPhoto.valuationMax||0).toLocaleString('en-IN')}\n`;
    if (r.businessPhoto.items?.length) txt += `Items     : ${r.businessPhoto.items.join(', ')}\n`;
  }
  txt += '\n════════════════════════════════════════════════════════════\nGenerated by KYC Audit Automation Tool\n';
  dlText(txt, `KYC_Report_${doc.name.replace(/\.[^.]+$/,'')}.txt`);
}

function downloadMasterReport() {
  const done = S.docs.filter(d=>d.status==='done'&&d.result);
  if (!done.length) { alert('No results yet.'); return; }
  let txt = '╔══════════════════════════════════════════════════════════╗\n';
  txt += '║              KYC MASTER AUDIT REPORT                   ║\n';
  txt += '╚══════════════════════════════════════════════════════════╝\n\n';
  txt += `Generated : ${new Date().toLocaleString('en-IN')}\nTotal Files : ${done.length}\n\n`;
  txt += `── FILE SUMMARY ─────────────────────────────────────────────\n`;
  txt += 'File'.padEnd(35)+'Checks'.padEnd(8)+'Pass'.padEnd(8)+'Fail'.padEnd(8)+'High'.padEnd(8)+'Rate\n';
  txt += '─'.repeat(72)+'\n';
  done.forEach(d=>{
    const s=d.result.summary||{};
    const rate=s.totalChecks>0?Math.round(((s.passed||0)/s.totalChecks)*100)+'%':'—';
    txt+=d.name.slice(0,34).padEnd(35)+String(s.totalChecks||0).padEnd(8)+String(s.passed||0).padEnd(8)+String(s.failed||0).padEnd(8)+String(s.highRisk||0).padEnd(8)+rate+'\n';
  });
  txt += '\n── OBSERVATIONS ─────────────────────────────────────────────\n';
  done.forEach(d=>{
    if (d.result.auditObservations?.length) {
      txt += `\n[${d.name}]\n`;
      d.result.auditObservations.forEach((o,i)=>{ txt+=`  ${i+1}. ${o}\n`; });
    }
  });
  txt += '\n════════════════════════════════════════════════════════════\nGenerated by KYC Audit Automation Tool\n';
  dlText(txt, 'KYC_Master_Report.txt');
}

function downloadMasterCSV() {
  const done = S.docs.filter(d=>d.status==='done'&&d.result);
  if (!done.length) { alert('No results yet.'); return; }
  const rows = [['File','Total Checks','Passed','Failed','Cannot Verify','High Risk','Medium Risk','Low Risk','Pass Rate %','Applicant Name','Observations']];
  done.forEach(d=>{
    const s=d.result.summary||{};
    const rate=s.totalChecks>0?Math.round(((s.passed||0)/s.totalChecks)*100):0;
    rows.push([d.name,s.totalChecks||0,s.passed||0,s.failed||0,s.cannotVerify||0,s.highRisk||0,s.mediumRisk||0,s.lowRisk||0,rate,d.result.extractedData?.applicant?.name||'',(d.result.auditObservations||[]).join(' | ')]);
  });
  dlText(rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'), 'KYC_Master_Report.csv');
}

function dlText(content, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ── WIPE ── */
function wipeAll() {
  if (!confirm('Clear all files and results from this session?')) return;
  S.docs = [];
  renderFileList();
  checkRunEligible();
  document.getElementById('wipeBtn').style.display = 'none';
  document.getElementById('navDash').disabled = true;
  document.getElementById('navReports').disabled = true;
  navTo('input');
}

/* ── INIT ── */
navTo('input');
