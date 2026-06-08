/* KYC AUDIT TOOL v3 — app.js */

const S = {
  apiKey:'', docs:[], csvData:{}, filter:'all', searchQuery:'',
  charts:{}, threshHigh:50, threshMed:25, ruleCatFilter:'all',
  checklist: getDefaultChecklist(),
};

/* ── DEFAULT CHECKLIST ── */
function getDefaultChecklist() {
  return [
    {id:'A1',desc:'Has applicant provided a valid Aadhaar? (12-digit format)',cat:'Applicant KYC',risk:'HIGH'},
    {id:'A2',desc:'Does applicant have a PAN Card?',cat:'Applicant KYC',risk:'HIGH'},
    {id:'A3',desc:'Is the 4th character of applicant PAN the letter "P"? (confirms individual)',cat:'Applicant KYC',risk:'HIGH'},
    {id:'A4',desc:'Is applicant photograph consistent across PAN and Aadhaar? (photo match)',cat:'Photo Verification',risk:'HIGH'},
    {id:'A5',desc:'Is PAN format valid? (5 letters + 4 digits + 1 letter)',cat:'Applicant KYC',risk:'HIGH'},
    {id:'A6',desc:'Is Date of Birth consistent across PAN and Aadhaar?',cat:'Applicant KYC',risk:'HIGH'},
    {id:'A7',desc:'Is applicant age between 20 and 60 years?',cat:'Applicant KYC',risk:'HIGH'},
    {id:'A8',desc:'Are permanent and correspondence addresses same and matching Aadhaar?',cat:'Applicant KYC',risk:'MEDIUM'},
    {id:'A9',desc:'Is name consistent across all provided documents?',cat:'Applicant KYC',risk:'HIGH'},
    {id:'A10',desc:'Is gender consistent across all provided documents?',cat:'Applicant KYC',risk:'MEDIUM'},
    {id:'A11',desc:'Does any address PIN code start with digit 9?',cat:'Applicant KYC',risk:'HIGH'},
    {id:'A12',desc:'Is applicant PIN code matching co-applicant PIN code?',cat:'Applicant KYC',risk:'MEDIUM'},
    {id:'A13',desc:'Is applicant name in documents matching LOS data?',cat:'LOS/LMS Cross-check',risk:'HIGH'},
    {id:'A14',desc:'Is applicant name in documents matching LMS data?',cat:'LOS/LMS Cross-check',risk:'HIGH'},
    {id:'A15',desc:'Is Date of Birth consistent across LOS and LMS?',cat:'LOS/LMS Cross-check',risk:'MEDIUM'},
    {id:'A16',desc:'Is PAN in documents matching PAN in LOS/LMS?',cat:'LOS/LMS Cross-check',risk:'HIGH'},
    {id:'A17',desc:'Is gender consistent across LOS and LMS?',cat:'LOS/LMS Cross-check',risk:'MEDIUM'},
    {id:'C1',desc:'Has co-applicant provided a valid Aadhaar?',cat:'Co-Applicant KYC',risk:'HIGH'},
    {id:'C2',desc:'Does co-applicant have a PAN Card?',cat:'Co-Applicant KYC',risk:'HIGH'},
    {id:'C3',desc:'Is the 4th character of co-applicant PAN "P"?',cat:'Co-Applicant KYC',risk:'HIGH'},
    {id:'C4',desc:'Is co-applicant photograph consistent across PAN and Aadhaar?',cat:'Photo Verification',risk:'HIGH'},
    {id:'C5',desc:'Is co-applicant PAN format valid?',cat:'Co-Applicant KYC',risk:'HIGH'},
    {id:'C6',desc:'Is co-applicant DOB consistent across PAN and Aadhaar?',cat:'Co-Applicant KYC',risk:'HIGH'},
    {id:'C7',desc:'Is co-applicant age between 20 and 60 years?',cat:'Co-Applicant KYC',risk:'HIGH'},
    {id:'C8',desc:'Is co-applicant name consistent across all documents?',cat:'Co-Applicant KYC',risk:'HIGH'},
    {id:'C9',desc:'Is co-applicant gender consistent with LOS/LMS?',cat:'Co-Applicant KYC',risk:'MEDIUM'},
    {id:'C10',desc:'Is co-applicant address consistent across LOS and LMS?',cat:'Co-Applicant KYC',risk:'MEDIUM'},
    {id:'P1',desc:'Is customer visit/business photo available and clear?',cat:'Photo Verification',risk:'MEDIUM'},
    {id:'P2',desc:'Does business photo match the declared business type and activity?',cat:'Business Verification',risk:'HIGH'},
    {id:'B1',desc:'Is GST/Udyam registration number valid and matching declared business?',cat:'Business Verification',risk:'HIGH'},
    {id:'B2',desc:'Is business address in GST certificate matching LOS address?',cat:'Business Verification',risk:'MEDIUM'},
  ];
}

/* ── NAV ── */
function navTo(page) {
  ['input','dashboard','reports'].forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = p === page ? 'block' : 'none';
  });
  document.querySelectorAll('.seg button[data-page]').forEach(b => b.classList.toggle('on', b.dataset.page === page));
  if (page === 'dashboard') renderDashboard();
  if (page === 'reports') renderReports();
}

/* ── SETTINGS ── */
function openSettings() { document.getElementById('settingsOverlay').style.display = 'grid'; }
function closeSettings() { document.getElementById('settingsOverlay').style.display = 'none'; }
function saveApiKey() {
  S.apiKey = document.getElementById('apiKeyInput').value.trim();
  document.getElementById('apiSaveMsg').style.display = 'block';
  const b = document.getElementById('apiBadge');
  b.innerHTML = S.apiKey ? '<span class="status-dot green"></span>API key active' : '<span class="status-dot red"></span>No API key';
  b.className = S.apiKey ? 'conf-badge' : 'conf-badge warn';
}
function saveThresholds() {
  S.threshHigh = parseInt(document.getElementById('threshHigh').value)||50;
  S.threshMed  = parseInt(document.getElementById('threshMed').value)||25;
}
function saveLmsApi() { alert('LMS/LOS API connection will be available in the next release. For now, upload a CSV file with customer data.'); }

/* ── ZIP UPLOAD ── */
function dzOver(e, id) { e.preventDefault(); document.getElementById(id).classList.add('over'); }
function dzLeave(id) { document.getElementById(id).classList.remove('over'); }
function dzDropZip(e) { e.preventDefault(); dzLeave('zipDropzone'); if (e.dataTransfer.files[0]) loadZip(e.dataTransfer.files[0]); }

async function loadZip(file) {
  if (!file) return;
  try {
    document.getElementById('zipMeta').textContent = 'Reading ZIP...';
    const zip = await JSZip.loadAsync(file);
    const customers = {};
    zip.forEach((path, zipEntry) => {
      if (zipEntry.dir) return;
      const parts = path.split('/').filter(Boolean);
      if (parts.length < 2) return; // skip root-level files
      const custId = parts[0];
      const fileName = parts[parts.length - 1];
      if (!customers[custId]) customers[custId] = [];
      customers[custId].push({ name: fileName, entry: zipEntry, path });
    });
    const custIds = Object.keys(customers);
    if (!custIds.length) { alert('No customer folders found in ZIP. Make sure each sub-folder = one customer.'); return; }
    S.docs = custIds.map(id => ({
      id: uid(), custId: id, files: customers[id],
      status: 'queued', result: null, error: null, isDemo: false
    }));
    document.getElementById('zipMeta').textContent = `${custIds.length} customer folders loaded from ${file.name}`;
    renderCustomerList();
    checkRunEligible();
  } catch(e) {
    alert('Could not read ZIP: ' + e.message);
    document.getElementById('zipMeta').textContent = 'Error reading ZIP';
  }
}

/* ── CSV UPLOAD ── */
async function loadCSV(file) {
  if (!file) return;
  const text = await file.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g,'_'));
  S.csvData = {};
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''));
    const row = {};
    headers.forEach((h, j) => { row[h] = vals[j] || ''; });
    const idKey = headers.find(h => h.includes('id') || h.includes('customer') || h.includes('loan'));
    if (idKey && row[idKey]) S.csvData[row[idKey]] = row;
  }
  const count = Object.keys(S.csvData).length;
  document.getElementById('csvStatus').textContent = `✓ ${count} customer records loaded from CSV. Data will be auto-matched by Customer ID.`;
  document.getElementById('csvStatus').style.color = 'var(--green)';
}

/* ── DEMO FILES ── */
const DEMO_NAMES = ['Rajesh Kumar','Priya Sharma','Amit Patel','Sunita Devi','Vikram Singh','Meena Kumari','Arjun Reddy','Kavitha Nair','Suresh Yadav','Lakshmi Iyer','Mohan Das','Anita Soni','Ramesh Gupta','Pooja Verma','Sanjay Tiwari','Deepa Menon','Ravi Shankar','Geeta Bose','Manoj Joshi','Usha Pillai'];
const DEMO_SHOPS = ['Kirana Store','Medical Store','Mobile Shop','Textile Shop','Hardware Store','Bakery','Vegetable Market','Tailoring Shop','Electronic Shop','Stationery Store','Jewellery Shop','Restaurant','Auto Parts Shop','Furniture Store','Cosmetics Shop','Book Store','Dairy Shop','Cycle Shop','Shoe Store','Tea Stall'];
const DEMO_CITIES = ['Mumbai','Delhi','Chennai','Bangalore','Hyderabad','Pune','Kolkata','Ahmedabad','Jaipur','Lucknow','Nagpur','Surat','Coimbatore','Kochi','Indore'];
const DEMO_LANGS = ['Hindi','Tamil','Telugu','Kannada','Marathi','Malayalam','Bengali','Gujarati','English'];

function loadDemo() {
  const n = Math.min(100, Math.max(1, parseInt(document.getElementById('demoCount').value) || 100));
  const rand = a => a[Math.floor(Math.random() * a.length)];
  const ri = (lo,hi) => Math.floor(lo + Math.random()*(hi-lo+1));
  S.docs = Array.from({length:n}, (_,i) => {
    const name = DEMO_NAMES[i % DEMO_NAMES.length] + (i >= DEMO_NAMES.length ? ' ' + (Math.floor(i/DEMO_NAMES.length)+1) : '');
    const custId = 'LOAN' + String(i+1).padStart(3,'0');
    const shop = rand(DEMO_SHOPS);
    const city = rand(DEMO_CITIES);
    const lang = rand(DEMO_LANGS);
    const profile = Math.random() < 0.35 ? 'clean' : Math.random() < 0.65 ? 'minor' : 'issues';
    return {
      id:uid(), custId, name, shop, city, lang, profile,
      files:[
        {name:'aadhaar.jpg',type:'demo-aadhaar'},
        {name:'pan.jpg',type:'demo-pan'},
        {name:'business_photo.jpg',type:'demo-photo'},
        {name:'agreement.pdf',type:'demo-agreement'},
      ],
      status:'queued', result:null, error:null, isDemo:true
    };
  });
  document.getElementById('zipMeta').textContent = `${n} demo customer files loaded`;
  renderCustomerList();
  checkRunEligible();
}

function renderCustomerList() {
  const el = document.getElementById('customerList');
  const count = document.getElementById('customerCount');
  count.textContent = S.docs.length + ' customers';
  if (!S.docs.length) { el.innerHTML = ''; return; }
  document.getElementById('wipeBtn').style.display = 'inline-flex';
  el.innerHTML = S.docs.slice(0,50).map(d => `
    <div class="cust-row" id="cr-${d.id}">
      <span class="cust-id">${esc(d.custId)}</span>
      <span class="cust-files">${d.name || ''} · ${(d.files||[]).length} file${(d.files||[]).length!==1?'s':''}</span>
      <span class="cust-status queued" id="cs-${d.id}">Queued</span>
    </div>`).join('') + (S.docs.length > 50 ? `<div style="text-align:center;padding:8px;font-size:12px;color:var(--muted)">+ ${S.docs.length-50} more customers</div>` : '');
}

function checkRunEligible() {
  const btn = document.getElementById('runBtn');
  const meta = document.getElementById('runMeta');
  btn.disabled = S.docs.length === 0;
  meta.textContent = S.docs.length ? `${S.docs.length} customer file${S.docs.length>1?'s':''} ready to audit.` : 'Upload a ZIP or load demo files to begin.';
}

/* ── CHECKLIST RULES ── */
let ruleCatFilter = 'all';
function setRuleCat(cat, btn) {
  ruleCatFilter = cat;
  document.querySelectorAll('[data-rcat]').forEach(b => b.classList.toggle('on', b.dataset.rcat === cat));
  renderRules();
}
function renderRules() {
  const filtered = ruleCatFilter === 'all' ? S.checklist : S.checklist.filter(r => r.cat === ruleCatFilter);
  document.getElementById('ruleCount').textContent = `(${S.checklist.length} total, showing ${filtered.length})`;
  const el = document.getElementById('rulesList');
  if (!filtered.length) { el.innerHTML = '<div class="empty-row">No rules in this category.</div>'; return; }
  el.innerHTML = `
    <div class="rule-row rule-head"><div>ID</div><div>Description</div><div>Category</div><div>Risk</div><div></div></div>
    ${filtered.map((r,i) => `
      <div class="rule-row">
        <div class="rule-id">${esc(r.id)}</div>
        <div class="rule-desc">${esc(r.desc)}</div>
        <div><span class="rule-cat">${esc(r.cat)}</span></div>
        <div><span class="risk-badge risk-${r.risk}">${r.risk}</span></div>
        <button class="del-btn" onclick="deleteRule('${r.id}')" title="Delete rule">✕</button>
      </div>`).join('')}`;
}
function addRule() {
  const id = document.getElementById('ruleId').value.trim();
  const desc = document.getElementById('ruleDesc').value.trim();
  const cat = document.getElementById('ruleCat').value;
  const risk = document.getElementById('ruleRisk').value;
  if (!id || !desc) { alert('Please enter both Rule ID and Description.'); return; }
  if (S.checklist.find(r => r.id === id)) { alert('Rule ID already exists. Use a different ID.'); return; }
  S.checklist.push({id, desc, cat, risk});
  document.getElementById('ruleId').value = '';
  document.getElementById('ruleDesc').value = '';
  renderRules();
}
function addBulkRules() {
  const text = document.getElementById('bulkRulesText').value.trim();
  if (!text) return;
  let added = 0;
  text.split('\n').forEach(line => {
    line = line.trim(); if (!line) return;
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 2) return;
    const [id, desc, cat, risk] = parts;
    if (!id || !desc) return;
    if (S.checklist.find(r => r.id === id)) return;
    S.checklist.push({ id, desc, cat: cat||'Custom', risk: ['HIGH','MEDIUM','LOW'].includes((risk||'').toUpperCase()) ? risk.toUpperCase() : 'MEDIUM' });
    added++;
  });
  document.getElementById('bulkRulesText').value = '';
  renderRules();
  alert(`${added} rule${added!==1?'s':''} added.`);
}
function deleteRule(id) { S.checklist = S.checklist.filter(r => r.id !== id); renderRules(); }
function resetChecklist() { if (confirm('Reset to default rules? Custom rules will be removed.')) { S.checklist = getDefaultChecklist(); renderRules(); } }
function exportChecklist() {
  const data = JSON.stringify(S.checklist, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data],{type:'application/json'}));
  a.download = 'kyc_checklist_rules.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function importChecklistClick() { document.getElementById('checklistImport').click(); }
async function importChecklist(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const rules = JSON.parse(text);
    if (!Array.isArray(rules)) throw new Error('Invalid format');
    S.checklist = rules;
    renderRules();
    alert(`${rules.length} rules imported.`);
  } catch(e) { alert('Could not import: ' + e.message); }
}

/* ── BUILD PROMPT ── */
async function buildMessages(doc) {
  const content = [];
  const losLms = getLOSLMSForDoc(doc);
  const losText = Object.keys(losLms).length ? Object.entries(losLms).map(([k,v])=>`${k}: ${v}`).join('\n') : 'No LOS/LMS data provided.';
  const checklistText = S.checklist.map(r => `${r.id} [${r.risk}] — ${r.desc} (Category: ${r.cat})`).join('\n');
  const langNote = doc.lang ? `This customer's documents may be in ${doc.lang}. Translate all extracted text to English.` : 'Documents may be in any Indian language (Hindi, Tamil, Telugu, Kannada, Marathi etc.). Extract and translate all text to English.';

  if (!doc.isDemo) {
    for (const f of (doc.files||[])) {
      try {
        const b64 = await f.entry.async('base64');
        const mt = f.name.match(/\.pdf$/i) ? 'application/pdf'
          : f.name.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg'
          : f.name.match(/\.png$/i) ? 'image/png'
          : 'image/jpeg';
        const label = guessDocLabel(f.name);
        if (mt === 'application/pdf') {
          content.push({type:'document',source:{type:'base64',media_type:'application/pdf',data:b64},title:label});
        } else {
          content.push({type:'image',source:{type:'base64',media_type:mt,data:b64}});
          content.push({type:'text',text:`[Above image is: ${label}]`});
        }
      } catch(e) { /* skip unreadable */ }
    }
  }

  const demoContext = doc.isDemo ? `
DEMO MODE: Generate realistic synthetic KYC audit results for:
- Customer: ${doc.name}, Customer ID: ${doc.custId}
- Business: ${doc.shop} in ${doc.city}
- Document language: ${doc.lang}
- Profile: ${doc.profile === 'clean' ? 'All documents are clean and consistent — most checks should PASS' : doc.profile === 'minor' ? 'Minor issues like small address mismatch — mostly PASS with 2-3 FAIL' : '3-5 significant issues including name mismatch or age violation — several FAIL'}
- Business photo shows: A ${doc.shop} with typical inventory for that type of business
` : '';

  content.push({type:'text', text:`
You are a senior KYC auditor at an Indian NBFC. Customer ID: "${doc.custId}".
${langNote}
${demoContext}

LOS/LMS DATA:
${losText}

CHECKLIST RULES TO EVALUATE (${S.checklist.length} rules):
${checklistText}

YOUR TASKS:

STEP 1 — FIELD EXTRACTION
Extract all the following. Translate to English from any Indian language found:
- From Aadhaar: Full Name, Father's Name, Date of Birth, Aadhaar Number (show only last 4), Gender, Full Address, PIN Code, State
- From PAN: Full Name, Father's Name, Date of Birth, PAN Number, 4th character
- From Co-applicant Aadhaar/PAN: Same fields
- From GST/Udyam: Business Name, Registration Number, Address, Type
- From Agreement/KFS: Borrower Name, Loan Amount, EMI, Tenure, Date

STEP 2 — KEY POINTS
List the 8-12 most important facts found across all documents. These are the headline facts an auditor would note first.

STEP 3 — PHOTO ANALYSIS
- Describe the business visible in the photo
- Identify all items/inventory/assets visible
- Estimate business valuation range in INR
- Compare face in Aadhaar vs PAN vs business photo and note if they match

STEP 4 — CHECKLIST
For EVERY rule in the checklist, run the check and respond:
- result: PASS / FAIL / CANNOT_VERIFY
- reason: brief explanation
- risk: use the risk level from the rule definition

STEP 5 — RISK & OBSERVATIONS
If fail rate exceeds 50%, write formal audit observations in professional language.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "custId": "${doc.custId}",
  "customerName": "",
  "extractedData": {
    "applicant": {"name":"","fatherName":"","dob":"","pan":"","pan4thChar":"","aadhaarLast4":"","gender":"","address":"","pinCode":"","state":"","age":"","language":""},
    "coApplicant": {"name":"","dob":"","pan":"","gender":"","address":"","pinCode":""},
    "business": {"name":"","gstNo":"","address":"","type":"","udyamNo":""},
    "loan": {"borrowerName":"","amount":"","emi":"","tenure":"","date":""}
  },
  "keyPoints": ["Key fact 1","Key fact 2","...up to 12"],
  "checkResults": [
    {"id":"A1","description":"...","result":"PASS","reason":"...","risk":"HIGH"}
  ],
  "photoAnalysis": {
    "businessType": "",
    "items": [],
    "valuationMin": 0,
    "valuationMax": 0,
    "photoMatchResult": "",
    "notes": ""
  },
  "summary": {"totalChecks":0,"passed":0,"failed":0,"cannotVerify":0,"highRisk":0,"mediumRisk":0,"lowRisk":0,"passRate":0},
  "auditObservations": []
}`});

  return [{role:'user',content}];
}

function getLOSLMSForDoc(doc) {
  if (S.csvData[doc.custId]) return S.csvData[doc.custId];
  const ids = ['los_name','lms_name','los_dob','lms_dob','los_pan','lms_pan','los_gender','lms_risk','los_address','los_pin','lms_branch'];
  const d = {};
  ids.forEach(id => { const el=document.getElementById(id); if(el&&el.value.trim()) d[id]=el.value.trim(); });
  return d;
}

function guessDocLabel(name) {
  const n = name.toLowerCase();
  if (n.includes('aadhaar')||n.includes('aadhar')||n.includes('uid')) return 'Aadhaar Card';
  if (n.includes('pan')) return 'PAN Card';
  if (n.includes('photo')||n.includes('shop')||n.includes('biz')||n.includes('visit')) return 'Business Visit Photo';
  if (n.includes('agree')||n.includes('kfs')||n.includes('loan')) return 'Loan Agreement / KFS';
  if (n.includes('gst')||n.includes('udyam')||n.includes('msme')) return 'GST / Udyam Certificate';
  if (n.includes('bank')||n.includes('statement')) return 'Bank Statement';
  if (n.includes('co')) return 'Co-Applicant Document';
  return 'KYC Document';
}

/* ── RUN ALL ── */
async function runAll() {
  if (!S.apiKey && S.docs.some(d=>!d.isDemo)) {
    showRunError('Please enter your Anthropic API key in Settings first (not needed for demo files).');
    return;
  }
  if (!S.docs.length) { showRunError('Upload a ZIP or load demo files first.'); return; }
  hideRunError();
  const concurrency = Math.max(1, Math.min(5, parseInt(document.getElementById('concurrency').value)||2));
  S.docs.forEach(d => { d.status='queued'; d.result=null; d.error=null; updateCustStatus(d); });
  document.getElementById('runBtn').disabled = true;
  document.getElementById('runBtn').innerHTML = '<span class="spinner"></span> Running...';
  document.getElementById('navDash').disabled = false;
  document.getElementById('navReports').disabled = false;
  navTo('dashboard');
  const queue = S.docs.map((_,i)=>i);
  await Promise.all(Array.from({length:concurrency},()=>processNext(queue)));
  document.getElementById('runBtn').disabled = false;
  document.getElementById('runBtn').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run KYC Audit';
  renderDashboard();
}

async function processNext(queue) {
  while (queue.length) {
    const idx = queue.shift();
    const doc = S.docs[idx]; if (!doc) continue;
    doc.status = 'running'; updateCustStatus(doc); renderBulkTable();
    try {
      if (doc.isDemo) {
        // Demo files: generate results locally, no API call needed
        await new Promise(r => setTimeout(r, 300 + Math.random()*400));
        doc.result = generateDemoResult(doc);
        doc.status = 'done';
      } else {
        const messages = await buildMessages(doc);
        const resp = await fetch('https://api.anthropic.com/v1/messages',{
          method:'POST',
          headers:{'Content-Type':'application/json','x-api-key':S.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
          body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4000,messages}),
        });
        if (!resp.ok) { const e=await resp.json(); throw new Error(e.error?.message||'API error '+resp.status); }
        const data = await resp.json();
        const raw = (data.content||[]).map(b=>b.text||'').join('').replace(/```json|```/g,'').trim();
        doc.result = JSON.parse(raw);
        doc.status = 'done';
      }
    } catch(e) { doc.error=e.message; doc.status='error'; }
    updateCustStatus(doc); renderBulkTable(); updateDashHero();
  }
}

function generateDemoResult(doc) {
  const profile = doc.profile || 'minor';
  const rand = a => a[Math.floor(Math.random()*a.length)];
  const ri = (lo,hi) => Math.floor(lo+Math.random()*(hi-lo+1));
  const pan = 'ABCDE' + ri(1000,9999) + 'F';
  const aadhaar = String(ri(1000,9999));
  const dob = `${String(ri(1,28)).padStart(2,'0')}/${String(ri(1,12)).padStart(2,'0')}/${ri(1965,2000)}`;
  const age = 2024 - parseInt(dob.split('/')[2]);
  const pin = (profile==='issues' && Math.random()<0.3) ? '9' + ri(10000,99999) : ri(400001,799999).toString();
  const langs = ['Hindi','Tamil','Telugu','Kannada','Marathi'];
  const lang = doc.lang || rand(langs);
  const bizItems = {
    'Kirana Store':['Rice bags (50kg)','Wheat flour','Cooking oil (5L)','Pulses','Sugar','Salt','Biscuits','Chips','Soft drinks','Soap','Detergent'],
    'Medical Store':['Medicines (OTC)','Prescription drugs','Surgical supplies','BP monitor','Thermometers','Syringes','Vitamins'],
    'Mobile Shop':['Smartphones (10 units)','Feature phones','Chargers','Earphones','Screen guards','Mobile covers','Power banks'],
    'Textile Shop':['Cotton sarees (50)','Silk sarees (20)','Dress materials','Blouse pieces','Readymade garments','Embroidery items'],
    'Hardware Store':['Cement bags (100)','Iron rods','Paint cans','Plumbing items','Electrical wire','Tools','Nails and screws'],
    'Bakery':['Bread loaves','Cakes','Biscuits','Pastries','Rusk','Cookies','Ovens (2 units)','Refrigerator'],
    'Restaurant':['Kitchen equipment','Tables (10)','Chairs (40)','Gas cylinders','Utensils','Refrigerator','Menu items'],
    'default':['General merchandise','Inventory items','Display shelves','Cash counter','Storage racks'],
  };
  const items = bizItems[doc.shop] || bizItems['default'];
  const valMin = {
    'Kirana Store':150000,'Medical Store':300000,'Mobile Shop':400000,'Textile Shop':250000,
    'Hardware Store':350000,'Bakery':200000,'Restaurant':500000
  }[doc.shop] || 100000;
  const valMax = valMin * (1.5 + Math.random());

  // Build checklist results based on profile
  const checks = S.checklist.map(rule => {
    let result, reason;
    if (profile === 'clean') {
      result = 'PASS';
      reason = 'Verified and consistent across all documents.';
    } else if (profile === 'minor') {
      // Fail 2-3 random medium checks
      const failIds = ['A8','A12','C9','A15','B2'];
      if (failIds.includes(rule.id) && Math.random() < 0.5) {
        result = 'FAIL';
        reason = rule.id==='A8' ? 'Permanent and correspondence address differ slightly' :
                 rule.id==='A12' ? 'Co-applicant PIN does not match applicant PIN' :
                 rule.id==='C9' ? 'Gender entry in LOS differs from Aadhaar' :
                 rule.id==='A15' ? 'DOB format inconsistency between LOS and LMS' :
                 'Address in GST certificate has minor discrepancy with LOS';
      } else if (['C1','C2','C3','C4','C5','C6','C7','C8'].includes(rule.id) && Math.random() < 0.4) {
        result = 'CANNOT_VERIFY';
        reason = 'Co-applicant documents not available in this folder.';
      } else {
        result = 'PASS';
        reason = 'Verified successfully.';
      }
    } else {
      // issues profile — fail 4-6 checks including some HIGH
      const failIds = ['A9','A6','A11','C1','C2','A13','A14'];
      if (failIds.includes(rule.id) && Math.random() < 0.65) {
        result = 'FAIL';
        reason = rule.id==='A9' ? 'Name spelling differs between Aadhaar and PAN — possible mismatch' :
                 rule.id==='A6' ? 'Date of Birth on PAN does not match Aadhaar' :
                 rule.id==='A11' ? 'Correspondence address PIN code starts with 9 — flagged' :
                 rule.id==='C1' ? 'Co-applicant Aadhaar not found in submitted documents' :
                 rule.id==='C2' ? 'Co-applicant PAN card not submitted' :
                 rule.id==='A13' ? 'Applicant name in documents does not match LOS records' :
                 'Applicant name in documents does not match LMS records';
      } else if (['C1','C2','C3','C4','C5','C6','C7','C8'].includes(rule.id)) {
        result = 'CANNOT_VERIFY';
        reason = 'Co-applicant documents not available.';
      } else {
        result = Math.random() < 0.75 ? 'PASS' : 'CANNOT_VERIFY';
        reason = result === 'PASS' ? 'Verified successfully.' : 'Could not verify — document quality insufficient.';
      }
    }
    return { id:rule.id, description:rule.desc, result, reason, risk: result==='FAIL'?rule.risk:'NA' };
  });

  const passed = checks.filter(c=>c.result==='PASS').length;
  const failed = checks.filter(c=>c.result==='FAIL').length;
  const cantVerify = checks.filter(c=>c.result==='CANNOT_VERIFY').length;
  const highRisk = checks.filter(c=>c.result==='FAIL'&&c.risk==='HIGH').length;
  const medRisk = checks.filter(c=>c.result==='FAIL'&&c.risk==='MEDIUM').length;
  const lowRisk = checks.filter(c=>c.result==='FAIL'&&c.risk==='LOW').length;
  const passRate = Math.round((passed/checks.length)*100);

  const observations = failed > checks.length * 0.5 ? [
    `Critical: Identity documents show name inconsistency between Aadhaar and PAN for ${doc.name}. Immediate re-verification required before loan disbursement.`,
    `High risk: Date of Birth mismatch detected across identity documents. Risk of document fraud cannot be ruled out.`,
    `Compliance gap: Co-applicant KYC documents are incomplete. Full set of documents must be collected as per RBI KYC norms.`,
  ] : failed > 2 ? [
    `Observation: Minor data inconsistencies found in ${doc.name}'s KYC file. Address and DOB fields require re-verification with originals.`,
  ] : [];

  return {
    custId: doc.custId,
    customerName: doc.name,
    extractedData: {
      applicant: {
        name: doc.name,
        fatherName: 'S/O ' + rand(['Ramesh','Suresh','Mahesh','Dinesh','Rajesh']) + ' Kumar',
        dob,
        pan,
        pan4thChar: 'P',
        aadhaarLast4: aadhaar,
        gender: rand(['Male','Female']),
        address: `${ri(1,999)}, ${rand(['MG Road','Gandhi Nagar','Nehru Street','Anna Salai','Ring Road'])}, ${doc.city} - ${pin}`,
        pinCode: pin,
        state: rand(['Maharashtra','Tamil Nadu','Karnataka','Telangana','Uttar Pradesh','Gujarat','Rajasthan']),
        age: String(age),
        language: lang,
      },
      coApplicant: { name:'', dob:'', pan:'', gender:'', address:'', pinCode:'' },
      business: { name: doc.name + "'s " + doc.shop, gstNo:'27' + ri(10,99) + 'ABCDE' + ri(1000,9999) + 'F1Z5', address: doc.city, type: doc.shop },
      loan: { borrowerName: doc.name, amount:'₹' + ri(1,15) + ',00,000', emi:'₹' + ri(5000,50000), tenure: ri(12,60) + ' months', date: `${ri(1,28)}/0${ri(1,9)}/2024` }
    },
    keyPoints: [
      `Customer ${doc.name} (${doc.custId}) runs a ${doc.shop} in ${doc.city}`,
      `Aadhaar last 4 digits: ${aadhaar} | PAN: ${pan}`,
      `Date of Birth: ${dob} | Age: ${age} years`,
      `Document language: ${lang}`,
      `Business type: ${doc.shop} | Estimated value: ₹${Math.round(valMin).toLocaleString('en-IN')} – ₹${Math.round(valMax).toLocaleString('en-IN')}`,
      `PIN Code: ${pin}${pin.startsWith('9') ? ' ⚠ Starts with 9 — flagged' : ' ✓ Valid'}`,
      `Total checklist: ${checks.length} rules | Passed: ${passed} | Failed: ${failed}`,
      `Risk level: ${highRisk > 0 ? 'HIGH' : medRisk > 0 ? 'MEDIUM' : 'LOW'}`,
      profile === 'issues' ? 'Multiple KYC discrepancies detected — requires senior review' : profile === 'minor' ? 'Minor inconsistencies noted — standard follow-up required' : 'All documents verified — file is clean',
    ],
    checkResults: checks,
    photoAnalysis: {
      businessType: doc.shop,
      items: items.slice(0, ri(5,9)),
      valuationMin: Math.round(valMin),
      valuationMax: Math.round(valMax),
      photoMatchResult: profile === 'issues' ? 'Face in business photo does not clearly match Aadhaar photo — further verification needed' : 'Face in business photo matches Aadhaar and PAN photographs',
      notes: `${doc.shop} appears to be a ${profile==='clean'?'well-established':'functioning'} business. Inventory and fixtures visible in photo are consistent with declared business activity.`
    },
    summary: { totalChecks:checks.length, passed, failed, cannotVerify:cantVerify, highRisk, mediumRisk:medRisk, lowRisk, passRate },
    auditObservations: observations,
  };
}

function updateCustStatus(doc) {
  const el = document.getElementById('cs-' + doc.id);
  if (!el) return;
  el.className = 'cust-status ' + doc.status;
  el.textContent = doc.status.charAt(0).toUpperCase() + doc.status.slice(1);
}

function showRunError(m) { const e=document.getElementById('runError'); e.textContent=m; e.style.display='block'; }
function hideRunError() { document.getElementById('runError').style.display='none'; }

/* ── DASHBOARD ── */
function renderDashboard() {
  updateDashHero(); renderPassFailCards(); renderCharts(); renderBulkTable(); updateFilterCounts();
  const done = S.docs.filter(d=>d.status==='done'&&d.result);
  const running = S.docs.filter(d=>d.status==='running').length;
  document.getElementById('dashLede').textContent = running
    ? `Processing ${running} file${running>1?'s':''} — results update in real time.`
    : `${done.length} of ${S.docs.length} customer files processed.`;
}

function updateDashHero() {
  const done = S.docs.filter(d=>d.status==='done'&&d.result);
  const filesPassed = done.filter(d=>(d.result.summary?.failed||0)===0).length;
  const totalChecks = done.reduce((a,d)=>a+(d.result.summary?.totalChecks||0),0);
  const totalPass = done.reduce((a,d)=>a+(d.result.summary?.passed||0),0);
  const high = done.reduce((a,d)=>a+(d.result.summary?.highRisk||0),0);
  const med  = done.reduce((a,d)=>a+(d.result.summary?.mediumRisk||0),0);
  const low  = done.reduce((a,d)=>a+(d.result.summary?.lowRisk||0),0);
  const pct = S.docs.length > 0 ? Math.round((done.length/S.docs.length)*100) : 0;
  document.getElementById('heroPass').textContent = filesPassed;
  document.getElementById('heroTotal').textContent = S.docs.length;
  document.getElementById('heroSub').textContent = `· ${done.length} audited · ${S.docs.length-done.length} pending`;
  document.getElementById('heroProg').style.width = pct+'%';
  document.getElementById('heroProgLabel').textContent = pct+'%';
  const bt = high+med+low||1;
  document.getElementById('heroBars').innerHTML = [
    {label:'High risk',color:'#C04646',count:high},
    {label:'Medium risk',color:'#C28A1B',count:med},
    {label:'Low risk',color:'#2E9461',count:low},
    {label:'Checks passed',color:'#1E4FE0',count:totalPass},
  ].map(b=>`<div class="band-bar-row"><div class="band-bar-label"><div class="band-dot" style="background:${b.color}"></div>${b.label}</div><div class="band-bar-track"><div class="band-bar-fill" style="background:${b.color};width:${Math.round(b.count/bt*100)}%"></div></div><div class="band-bar-count" style="color:${b.color}">${b.count}</div></div>`).join('');
}

function renderPassFailCards() {
  const done = S.docs.filter(d=>d.status==='done'&&d.result);
  const tc=done.reduce((a,d)=>a+(d.result.summary?.totalChecks||0),0);
  const tp=done.reduce((a,d)=>a+(d.result.summary?.passed||0),0);
  const tf=done.reduce((a,d)=>a+(d.result.summary?.failed||0),0);
  const th=done.reduce((a,d)=>a+(d.result.summary?.highRisk||0),0);
  const tm=done.reduce((a,d)=>a+(d.result.summary?.mediumRisk||0),0);
  const pr=tc>0?Math.round((tp/tc)*100):0;
  document.getElementById('passfailCards').innerHTML=`
    <div class="pf-card pf-meta"><div class="pf-num">${S.docs.length}</div><div class="pf-label">Total files</div><div class="pf-sub">${done.length} completed</div></div>
    <div class="pf-card pf-meta"><div class="pf-num">${tc}</div><div class="pf-label">Total checks</div><div class="pf-sub">${S.checklist.length} rules applied</div></div>
    <div class="pf-card pf-pass"><div class="pf-num">${tp}</div><div class="pf-label">Checks passed</div><div class="pf-sub">${pr}% pass rate</div></div>
    <div class="pf-card pf-fail"><div class="pf-num">${tf}</div><div class="pf-label">Checks failed</div><div class="pf-sub">${100-pr}% fail rate</div></div>
    <div class="pf-card pf-high"><div class="pf-num">${th}</div><div class="pf-label">High risk obs.</div><div class="pf-sub">${tm} medium risk</div></div>`;
}

function renderCharts() {
  const done = S.docs.filter(d=>d.status==='done'&&d.result);
  if (!done.length) return;
  if (S.charts.pf) S.charts.pf.destroy();
  if (S.charts.risk) S.charts.risk.destroy();
  const labels = done.slice(0,20).map(d=>(d.custId||d.name||'').slice(0,10));
  S.charts.pf = new Chart(document.getElementById('passFailChart'),{type:'bar',data:{labels,datasets:[{label:'Pass',data:done.slice(0,20).map(d=>d.result.summary?.passed||0),backgroundColor:'#2E9461'},{label:'Fail',data:done.slice(0,20).map(d=>d.result.summary?.failed||0),backgroundColor:'#C04646'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{size:10},boxWidth:10}}},scales:{x:{ticks:{font:{size:9},color:'#6B7385'},grid:{color:'#EEF0F4'}},y:{ticks:{font:{size:9},color:'#6B7385'},grid:{color:'#EEF0F4'}}}}});
  const h=done.reduce((a,d)=>a+(d.result.summary?.highRisk||0),0);
  const m=done.reduce((a,d)=>a+(d.result.summary?.mediumRisk||0),0);
  const l=done.reduce((a,d)=>a+(d.result.summary?.lowRisk||0),0);
  S.charts.risk = new Chart(document.getElementById('riskChart'),{type:'doughnut',data:{labels:['High','Medium','Low'],datasets:[{data:[h,m,l],backgroundColor:['#C04646','#C28A1B','#2E9461'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:10}}}}});
}

/* ── BULK TABLE ── */
let currentFilter = 'all';
function setFilter(f,btn) { currentFilter=f; document.querySelectorAll('#filterSeg button').forEach(b=>b.classList.toggle('on',b.dataset.filter===f)); renderBulkTable(); }
function filterTable() { S.searchQuery=document.getElementById('searchInput').value.toLowerCase(); renderBulkTable(); }
function updateFilterCounts() {
  const done=S.docs.filter(d=>d.status==='done'&&d.result);
  document.getElementById('fc-all').textContent=S.docs.length;
  document.getElementById('fc-pass').textContent=done.filter(d=>(d.result.summary?.failed||0)===0).length;
  document.getElementById('fc-fail').textContent=done.filter(d=>(d.result.summary?.failed||0)>0).length;
  document.getElementById('fc-high').textContent=done.filter(d=>(d.result.summary?.highRisk||0)>0).length;
  document.getElementById('tableSubtitle').textContent=`${done.length} of ${S.docs.length} processed`;
}

function renderBulkTable() {
  updateFilterCounts();
  let rows = S.docs.filter(d => {
    const q = S.searchQuery;
    if (q && !d.custId.toLowerCase().includes(q) && !(d.name||'').toLowerCase().includes(q) && !(d.result?.customerName||'').toLowerCase().includes(q)) return false;
    if (currentFilter==='pass') return d.status==='done'&&(d.result?.summary?.failed||0)===0;
    if (currentFilter==='fail') return d.status==='done'&&(d.result?.summary?.failed||0)>0;
    if (currentFilter==='high') return d.status==='done'&&(d.result?.summary?.highRisk||0)>0;
    return true;
  });
  const table = document.getElementById('bulkTable');
  if (!rows.length) { table.innerHTML='<div class="empty-row">No files match the current filter.</div>'; return; }
  table.innerHTML = `
    <div class="bulk-row bulk-head"><div>#</div><div>Customer</div><div>Checklist</div><div>Risk</div><div>Rate</div><div>Key Points</div><div></div></div>
    ${rows.map((d,i)=>{
      const s=d.result?.summary||{};
      const pass=s.passed||0,fail=s.failed||0,cant=s.cannotVerify||0,total=s.totalChecks||1;
      const rate=Math.round((pass/total)*100);
      const high=s.highRisk||0,med=s.mediumRisk||0;
      const riskCls=high>0?'high':med>0?'med':'low';
      const riskText=high>0?'High':med>0?'Medium':'Low';
      const custName=d.result?.customerName||d.result?.extractedData?.applicant?.name||d.name||'';
      if (d.status==='queued') return `<div class="bulk-row"><div class="b-i">${i+1}</div><div><div class="bn-title">${esc(d.custId)}</div><div class="bn-sub">Queued</div></div><div>—</div><div>—</div><div>—</div><div>—</div><div></div></div>`;
      if (d.status==='running') return `<div class="bulk-row"><div class="b-i">${i+1}</div><div><div class="bn-title">${esc(d.custId)}</div><div class="bn-sub">Processing…</div></div><div><div class="mini-spinner"></div></div><div>—</div><div>—</div><div>—</div><div></div></div>`;
      if (d.status==='error') return `<div class="bulk-row"><div class="b-i">${i+1}</div><div><div class="bn-title">${esc(d.custId)}</div><div class="bn-sub" style="color:var(--red)">${esc(d.error||'Error')}</div></div><div>—</div><div>—</div><div>—</div><div>—</div><div></div></div>`;
      return `<div class="bulk-row" onclick="openDetail('${d.id}')">
        <div class="b-i">${i+1}</div>
        <div><div class="bn-title">${esc(d.custId)}</div><div class="bn-sub">${esc(custName)}</div></div>
        <div><div class="mini-stack"><div style="width:${Math.round(pass/total*100)}%;background:#2E9461"></div><div style="width:${Math.round(fail/total*100)}%;background:#C04646"></div></div><div class="mini-counts"><span style="color:#2E9461">${pass}✓</span><span style="color:#C04646">${fail}✗</span>${cant?`<span style="color:#9AA3B2">${cant}?</span>`:''}</div></div>
        <div><span class="pill pill-${riskCls}">${riskText} risk</span></div>
        <div style="font-weight:600;font-size:14px;color:${rate>=70?'#2E9461':rate>=50?'#C28A1B':'#C04646'}">${rate}%</div>
        <div><button class="ghost-btn" style="font-size:11px;padding:4px 9px" onclick="event.stopPropagation();openKeyPoints('${d.id}')">📋 View Points</button></div>
        <div class="b-action">›</div>
      </div>`;
    }).join('')}`;
}

/* ── KEY POINTS OVERLAY ── */
function openKeyPoints(id) {
  const doc = S.docs.find(d=>d.id===id);
  if (!doc?.result) return;
  const kp = doc.result.keyPoints || [];
  const app = doc.result.extractedData?.applicant || {};
  const loan = doc.result.extractedData?.loan || {};
  const biz = doc.result.extractedData?.business || {};
  document.getElementById('detailPane').innerHTML = `
    <div class="dive-head">
      <div><div class="eyebrow">Key Points — ${esc(doc.custId)}</div><h3>${esc(doc.result.customerName||app.name||doc.custId)}</h3></div>
      <button class="ghost-btn" onclick="closeDetail()">✕</button>
    </div>
    <div style="padding:20px 24px;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div class="dive-label" style="margin-bottom:10px">Important Points from Documents</div>
        ${kp.length ? kp.map(p=>`<div class="kp-item" style="margin-bottom:6px;padding-left:16px;position:relative;font-size:13px;line-height:1.55;color:var(--ink-2)">${esc(p)}</div>`).join('') : '<div style="color:var(--muted);font-size:13px">No key points extracted.</div>'}
      </div>
      <div>
        <div class="dive-label" style="margin-bottom:8px">Extracted Applicant Details</div>
        <div class="kp-grid">
          ${Object.entries(app).filter(([k,v])=>v&&v!=='').map(([k,v])=>`<div class="kp-card"><div class="kp-card-label">${formatKey(k)}</div><div class="kp-card-val">${esc(v)}</div></div>`).join('')}
        </div>
        ${Object.values(loan).some(v=>v) ? `<div class="dive-label" style="margin:12px 0 8px">Loan Details</div><div class="kp-grid">${Object.entries(loan).filter(([k,v])=>v&&v!=='').map(([k,v])=>`<div class="kp-card"><div class="kp-card-label">${formatKey(k)}</div><div class="kp-card-val">${esc(v)}</div></div>`).join('')}</div>` : ''}
        ${Object.values(biz).some(v=>v) ? `<div class="dive-label" style="margin:12px 0 8px">Business Details</div><div class="kp-grid">${Object.entries(biz).filter(([k,v])=>v&&v!=='').map(([k,v])=>`<div class="kp-card"><div class="kp-card-label">${formatKey(k)}</div><div class="kp-card-val">${esc(v)}</div></div>`).join('')}</div>` : ''}
        ${doc.result.photoAnalysis?.businessType ? `
        <div class="dive-label" style="margin:12px 0 8px">Business Photo Analysis</div>
        <div class="biz-box" style="margin-bottom:0">
          <div class="biz-box-title">📷 ${esc(doc.result.photoAnalysis.businessType)}</div>
          <div class="biz-valuation">₹${(doc.result.photoAnalysis.valuationMin||0).toLocaleString('en-IN')} – ₹${(doc.result.photoAnalysis.valuationMax||0).toLocaleString('en-IN')}</div>
          ${doc.result.photoAnalysis.photoMatchResult?`<div style="font-size:12px;margin-top:6px;color:var(--ink-2)"><strong>Photo match:</strong> ${esc(doc.result.photoAnalysis.photoMatchResult)}</div>`:''}
          ${(doc.result.photoAnalysis.items||[]).length?`<div style="font-size:12px;margin-top:4px;color:var(--muted)">Items: ${doc.result.photoAnalysis.items.join(', ')}</div>`:''}
        </div>` : ''}
      </div>
    </div>`;
  document.getElementById('detailOverlay').style.display = 'grid';
}

/* ── FULL DETAIL OVERLAY ── */
function openDetail(id) {
  const doc = S.docs.find(d=>d.id===id);
  if (!doc?.result) return;
  const r = doc.result;
  const s = r.summary||{};
  const pass=s.passed||0,fail=s.failed||0,cant=s.cannotVerify||0,total=s.totalChecks||1;
  const rate=Math.round((pass/total)*100);
  const high=s.highRisk||0,med=s.mediumRisk||0;
  const riskColor=high>0?'var(--red)':med>0?'var(--amber)':'var(--green)';
  const riskLabel=high>0?'High risk':med>0?'Medium risk':'Low risk';
  const app=r.extractedData?.applicant||{};
  const extRows=Object.entries(app).filter(([k,v])=>v&&v!=='').map(([k,v])=>`<div class="ext-field"><div class="ef-label">${formatKey(k)}</div><div class="ef-val">${esc(v)}</div></div>`).join('');
  const checks=(r.checkResults||[]).map(c=>{
    const cls=c.result==='PASS'?'pass':c.result==='FAIL'?'fail':'cant';
    const icon=c.result==='PASS'?'✓':c.result==='FAIL'?'✗':'?';
    const rb=(c.result!=='PASS'&&c.risk&&c.risk!=='NA')?`<span class="ci-risk risk-${c.risk==='HIGH'?'HIGH':c.risk==='MEDIUM'?'MEDIUM':'LOW'}">${c.risk}</span>`:'';
    return `<div class="check-item ${cls}"><span class="ci-icon">${icon}</span><div><span class="ci-id">${c.id}</span>${rb} ${esc(c.description)}${c.reason?`<div style="font-size:11px;opacity:.75;margin-top:2px">${esc(c.reason)}</div>`:''}</div></div>`;
  }).join('');
  const obs=r.auditObservations?.length?`<div class="obs-box"><div class="obs-title">⚠ Audit Observations</div>${r.auditObservations.map(o=>`<div class="obs-item">${esc(o)}</div>`).join('')}</div>`:'';
  const photo=r.photoAnalysis?.businessType?`<div class="photo-box"><div class="photo-box-title">📷 Photo Analysis</div><strong>${esc(r.photoAnalysis.businessType)}</strong><div class="biz-valuation" style="margin-top:4px">₹${(r.photoAnalysis.valuationMin||0).toLocaleString('en-IN')} – ₹${(r.photoAnalysis.valuationMax||0).toLocaleString('en-IN')}</div>${r.photoAnalysis.photoMatchResult?`<div style="font-size:12px;margin-top:5px"><strong>Face match:</strong> ${esc(r.photoAnalysis.photoMatchResult)}</div>`:''}</div>`:'';
  const kpBox=r.keyPoints?.length?`<div class="key-points-box"><div class="kp-title">📌 Key Points</div>${r.keyPoints.map(p=>`<div class="kp-item">${esc(p)}</div>`).join('')}</div>`:'';
  document.getElementById('detailPane').innerHTML=`
    <div class="dive-head">
      <div><div class="eyebrow">File Detail — ${esc(doc.custId)}</div><h3>${esc(r.customerName||app.name||doc.custId)}</h3></div>
      <div style="display:flex;gap:8px"><button class="ghost-btn" onclick="openKeyPoints('${doc.id}')">📋 Key Points</button><button class="ghost-btn" onclick="downloadFileReport('${doc.id}')">⬇ Report</button><button class="ghost-btn" onclick="closeDetail()">✕</button></div>
    </div>
    <div class="dive-body">
      <div class="dive-col">
        <div class="applicant">${esc(r.customerName||app.name||doc.custId)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          <span class="pill ${fail===0?'pill-pass':'pill-fail'}">${fail===0?'✓ All checks passed':'✗ '+fail+' check'+(fail>1?'s':'')+' failed'}</span>
          <span class="pill pill-cant">${rate}% pass rate</span>
        </div>
        <div class="detail-score-row">
          <div class="ds-num" style="color:${riskColor}">${rate}<span>%</span></div>
          <div style="display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)">
            <div>✓ ${pass} passed</div><div style="color:var(--red)">✗ ${fail} failed</div><div>? ${cant} unverified</div>
          </div>
        </div>
        <div class="recommendation" style="border-color:${riskColor}">
          <div class="rec-label" style="color:${riskColor}">${riskLabel}</div>
          <div class="rec-title">${fail===0?'File cleared':high>0?'Immediate review required':med>0?'Conditional — review flagged items':'Minor observations noted'}</div>
          <div class="rec-reasoning">${r.auditObservations?.[0]||(fail===0?'All KYC checks passed.':'Review failed items before proceeding.')}</div>
        </div>
        ${kpBox}${photo}
        ${extRows?`<div class="dive-label" style="margin-top:14px">Extracted Fields</div><div class="ext-grid">${extRows}</div>`:''}
      </div>
      <div class="dive-col">
        <div class="dive-label">Checklist (${total} checks)</div>
        ${obs}${checks}
      </div>
    </div>`;
  document.getElementById('detailOverlay').style.display='grid';
}
function closeDetail() { document.getElementById('detailOverlay').style.display='none'; }

/* ── REPORTS PAGE ── */
function renderReports() {
  const done=S.docs.filter(d=>d.status==='done'&&d.result);
  const el=document.getElementById('reportsList');
  if (!done.length) { el.innerHTML='<div style="text-align:center;padding:60px;color:var(--muted)">No audit results yet.</div>'; return; }
  el.innerHTML=done.map((d,i)=>buildReportCard(d,i)).join('');
}
function buildReportCard(doc,idx) {
  const r=doc.result; const s=r.summary||{};
  const pass=s.passed||0,fail=s.failed||0,total=s.totalChecks||1;
  const rate=Math.round((pass/total)*100);
  const high=s.highRisk||0,med=s.mediumRisk||0;
  const rCls=high>0?'high':med>0?'med':'low';
  const rText=high>0?'High Risk':med>0?'Medium Risk':'Low Risk';
  const app=r.extractedData?.applicant||{};
  const extRows=Object.entries(app).filter(([k,v])=>v&&v!=='').map(([k,v])=>`<div class="ext-field"><div class="ef-label">${formatKey(k)}</div><div class="ef-val">${esc(v)}</div></div>`).join('');
  const checks=(r.checkResults||[]).map(c=>{
    const cls=c.result==='PASS'?'pass':c.result==='FAIL'?'fail':'cant';
    const icon=c.result==='PASS'?'✓':c.result==='FAIL'?'✗':'?';
    const rb=(c.result!=='PASS'&&c.risk&&c.risk!=='NA')?`<span class="ci-risk risk-${c.risk==='HIGH'?'HIGH':c.risk==='MEDIUM'?'MEDIUM':'LOW'}">${c.risk}</span>`:'';
    return `<div class="check-item ${cls}"><span class="ci-icon">${icon}</span><div><span class="ci-id">${c.id}</span>${rb} ${esc(c.description)}${c.reason?`<div style="font-size:11px;opacity:.75;margin-top:2px">${esc(c.reason)}</div>`:''}</div></div>`;
  }).join('');
  const obs=r.auditObservations?.length?`<div class="obs-box"><div class="obs-title">⚠ Audit Observations (${r.auditObservations.length})</div>${r.auditObservations.map(o=>`<div class="obs-item">${esc(o)}</div>`).join('')}</div>`:'';
  const photo=r.photoAnalysis?.businessType?`<div class="photo-box"><div class="photo-box-title">📷 Business Photo</div><strong>${esc(r.photoAnalysis.businessType)}</strong><div class="biz-valuation" style="margin-top:4px">₹${(r.photoAnalysis.valuationMin||0).toLocaleString('en-IN')} – ₹${(r.photoAnalysis.valuationMax||0).toLocaleString('en-IN')}</div>${r.photoAnalysis.photoMatchResult?`<div style="font-size:12px;margin-top:4px"><strong>Face match:</strong> ${esc(r.photoAnalysis.photoMatchResult)}</div>`:''}</div>`:'';
  const kpBox=r.keyPoints?.length?`<div class="key-points-box"><div class="kp-title">📌 Key Points (${r.keyPoints.length})</div>${r.keyPoints.map(p=>`<div class="kp-item">${esc(p)}</div>`).join('')}</div>`:'';
  return `
    <div class="report-card">
      <div class="report-card-header" onclick="toggleReport('rb-${idx}','rc-${idx}')">
        <div class="rch-name">${esc(doc.custId)} — ${esc(r.customerName||app.name||'')}</div>
        <div class="rch-pills"><span class="pill pill-pass">${pass} pass</span><span class="pill pill-fail">${fail} fail</span><span class="pill pill-cant">${rate}%</span><span class="pill pill-${rCls}">${rText}</span></div>
        <span class="rch-chevron" id="rc-${idx}">▼</span>
      </div>
      <div class="report-card-body" id="rb-${idx}">
        ${kpBox}${obs}${photo}
        ${extRows?`<div class="rb-section"><div class="rb-label">Extracted Fields</div><div class="ext-grid">${extRows}</div></div>`:''}
        <div class="rb-section"><div class="rb-label">Checklist Results</div>${checks}</div>
        <div class="report-actions">
          <button class="ghost-btn" onclick="openKeyPoints('${doc.id}')">📋 View All Key Points</button>
          <button class="ghost-btn" onclick="downloadFileReport('${doc.id}')">⬇ Download Report</button>
        </div>
      </div>
    </div>`;
}
function toggleReport(bId,cId) {
  const b=document.getElementById(bId); const c=document.getElementById(cId);
  b.classList.toggle('open'); if(c) c.classList.toggle('open');
}

/* ── DOWNLOADS ── */
function downloadFileReport(id) {
  const doc=S.docs.find(d=>d.id===id); if (!doc?.result) return;
  const r=doc.result; const s=r.summary||{};
  const rate=s.totalChecks>0?Math.round(((s.passed||0)/s.totalChecks)*100):0;
  let txt='╔══════════════════════════════════════════════════════════╗\n║         KYC AUDIT REPORT — INDIVIDUAL FILE             ║\n╚══════════════════════════════════════════════════════════╝\n\n';
  txt+=`Customer ID : ${r.custId||doc.custId}\nCustomer    : ${r.customerName||''}\nDate        : ${new Date().toLocaleDateString('en-IN')}\nTime        : ${new Date().toLocaleTimeString('en-IN')}\n\n`;
  txt+=`── SUMMARY ─────────────────────────────────────────────────\nTotal Checks : ${s.totalChecks||0}\nPassed       : ${s.passed||0}\nFailed       : ${s.failed||0}\nPass Rate    : ${rate}%\nHigh Risk    : ${s.highRisk||0} | Medium : ${s.mediumRisk||0} | Low : ${s.lowRisk||0}\n\n`;
  if (r.keyPoints?.length) { txt+=`── KEY POINTS ───────────────────────────────────────────────\n`; r.keyPoints.forEach((p,i)=>{ txt+=`${i+1}. ${p}\n`; }); txt+='\n'; }
  const app=r.extractedData?.applicant||{};
  if (Object.values(app).some(v=>v)) { txt+=`── EXTRACTED DATA ───────────────────────────────────────────\n`; Object.entries(app).forEach(([k,v])=>{ if(v) txt+=`  ${formatKey(k).padEnd(20)}: ${v}\n`; }); txt+='\n'; }
  if (r.photoAnalysis?.businessType) { txt+=`── BUSINESS PHOTO ───────────────────────────────────────────\nType      : ${r.photoAnalysis.businessType}\nValuation : ₹${(r.photoAnalysis.valuationMin||0).toLocaleString('en-IN')} – ₹${(r.photoAnalysis.valuationMax||0).toLocaleString('en-IN')}\nFace Match: ${r.photoAnalysis.photoMatchResult||'N/A'}\n\n`; }
  txt+=`── CHECKLIST ────────────────────────────────────────────────\n`;
  (r.checkResults||[]).forEach(c=>{ txt+=`[${(c.result||'').padEnd(13)}] ${(c.id||'').padEnd(5)} ${c.description||''}\n`; if(c.reason) txt+=`  → ${c.reason}\n`; txt+='\n'; });
  if (r.auditObservations?.length) { txt+=`── OBSERVATIONS ─────────────────────────────────────────────\n`; r.auditObservations.forEach((o,i)=>{ txt+=`${i+1}. ${o}\n`; }); }
  txt+='\n════════════════════════════════════════════════════════════\nGenerated by KYC Audit Automation Tool v3\n';
  dlText(txt,`KYC_${doc.custId}_Report.txt`);
}

function downloadMasterReport() {
  const done=S.docs.filter(d=>d.status==='done'&&d.result); if (!done.length) { alert('No results yet.'); return; }
  let txt='╔══════════════════════════════════════════════════════════╗\n║              KYC MASTER AUDIT REPORT                   ║\n╚══════════════════════════════════════════════════════════╝\n\n';
  txt+=`Generated   : ${new Date().toLocaleString('en-IN')}\nTotal Files : ${done.length}\nRules Used  : ${S.checklist.length}\n\n`;
  txt+=`── FILE SUMMARY ─────────────────────────────────────────────\n${'Customer ID'.padEnd(15)}${'Name'.padEnd(25)}${'Checks'.padEnd(8)}${'Pass'.padEnd(8)}${'Fail'.padEnd(8)}${'High'.padEnd(8)}Rate\n${'─'.repeat(74)}\n`;
  done.forEach(d=>{ const s=d.result.summary||{}; const rate=s.totalChecks>0?Math.round(((s.passed||0)/s.totalChecks)*100)+'%':'—'; txt+=`${d.custId.padEnd(15)}${(d.result.customerName||'').slice(0,24).padEnd(25)}${String(s.totalChecks||0).padEnd(8)}${String(s.passed||0).padEnd(8)}${String(s.failed||0).padEnd(8)}${String(s.highRisk||0).padEnd(8)}${rate}\n`; });
  txt+='\n── ALL OBSERVATIONS ─────────────────────────────────────────\n';
  done.forEach(d=>{ if(d.result.auditObservations?.length) { txt+=`\n[${d.custId}] ${d.result.customerName||''}\n`; d.result.auditObservations.forEach((o,i)=>{ txt+=`  ${i+1}. ${o}\n`; }); } });
  txt+='\n════════════════════════════════════════════════════════════\nGenerated by KYC Audit Automation Tool v3\n';
  dlText(txt,'KYC_Master_Report.txt');
}

function downloadMasterCSV() {
  const done=S.docs.filter(d=>d.status==='done'&&d.result); if (!done.length) { alert('No results yet.'); return; }
  const rows=[['Customer ID','Customer Name','Total Checks','Passed','Failed','Cannot Verify','High Risk','Med Risk','Low Risk','Pass Rate %','Business Type','Valuation','Key Points','Observations']];
  done.forEach(d=>{ const s=d.result.summary||{}; const rate=s.totalChecks>0?Math.round(((s.passed||0)/s.totalChecks)*100):0; rows.push([d.custId,d.result.customerName||'',s.totalChecks||0,s.passed||0,s.failed||0,s.cannotVerify||0,s.highRisk||0,s.mediumRisk||0,s.lowRisk||0,rate,d.result.photoAnalysis?.businessType||'',`${(d.result.photoAnalysis?.valuationMin||0).toLocaleString('en-IN')}-${(d.result.photoAnalysis?.valuationMax||0).toLocaleString('en-IN')}`,(d.result.keyPoints||[]).slice(0,3).join(' | '),(d.result.auditObservations||[]).join(' | ')]); });
  dlText(rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'),'KYC_Master_Report.csv');
}

function dlText(content,filename) {
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'})); a.download=filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ── WIPE ── */
function wipeAll() {
  if (!confirm('Clear all files and results?')) return;
  S.docs=[]; renderCustomerList(); checkRunEligible();
  document.getElementById('wipeBtn').style.display='none';
  document.getElementById('navDash').disabled=true;
  document.getElementById('navReports').disabled=true;
  document.getElementById('zipMeta').textContent='No ZIP loaded';
  navTo('input');
}

/* ── HELPERS ── */
function uid() { return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatKey(k) { return k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()); }

/* ── INIT ── */
navTo('input');
renderRules();