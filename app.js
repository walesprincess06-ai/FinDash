import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ================= 1. CONFIG & INIT =================
const firebaseConfig = {
    apiKey: "AIzaSyCxLopow8yVxqdpEH_MONquaMpiuLfKdPw",
    authDomain: "findash-pro-23388.firebaseapp.com",
    projectId: "findash-pro-23388",
    storageBucket: "findash-pro-23388.firebasestorage.app",
    messagingSenderId: "680840865262",
    appId: "1:680840865262:web:39b3d91acdadfc996a9aff",
    measurementId: "G-7T63PYSEK4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

lucide.createIcons();
document.getElementById('body-container').classList.remove('hidden');

let transactions = [];
let userBudgets = {}; 
let dashChartInst, repBarInst, repPieInst;
let notifiedSet = new Set(); 
let isSignUpMode = false;

document.getElementById('bud-month').value = new Date().toISOString().slice(0, 7);

// ================= 2. ROUTING & UI =================
const views = document.querySelectorAll('.view-section');
const navLinks = document.querySelectorAll('.nav-link');

function updateGreeting() {
    const hr = new Date().getHours();
    let g = 'Good Evening'; if (hr < 12) g = 'Good Morning'; else if (hr < 17) g = 'Good Afternoon';
    const name = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email.split('@')[0]) : 'User';
    document.getElementById('greeting-msg').textContent = `${g}, ${name}!`;
}

window.switchView = function(viewId, title) {
    views.forEach(v => v.classList.remove('active-view'));
    const target = document.getElementById(viewId);
    if(target) target.classList.add('active-view');
    document.getElementById('page-title').textContent = title;
    navLinks.forEach(l => {
        l.classList.remove('bg-activeMenu', 'text-white', 'border-l-4', 'border-blue-400'); l.classList.add('text-gray-300');
        if(l.getAttribute('data-view') === viewId) l.classList.add('bg-activeMenu', 'text-white', 'border-l-4', 'border-blue-400');
    });
    updateGreeting();
};

navLinks.forEach(l => l.addEventListener('click', (e) => { e.preventDefault(); switchView(l.getAttribute('data-view'), l.textContent.trim()); }));

function triggerAlert(title, msg, type = 'info', saveToList = true) {
    const container = document.getElementById('toast-container');
    if (container) {
        const toast = document.createElement('div');
        const color = type === 'error' ? 'red' : type === 'success' ? 'green' : type === 'warning' ? 'yellow' : 'blue';
        toast.className = `bg-white border-l-4 border-${color}-500 p-4 rounded shadow-lg flex items-center gap-3 toast-enter min-w-[300px] z-[100]`;
        toast.innerHTML = `<i data-lucide="bell" class="text-${color}-500"></i><div><h4 class="font-bold text-sm">${title}</h4><p class="text-xs text-gray-600">${msg}</p></div>`;
        container.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => { toast.remove(); }, 5000);
    }
    if (saveToList && !document.getElementById('app-view').classList.contains('hidden')) {
        const nl = document.getElementById('notifications-list');
        if (nl) {
            const border = type === 'success' ? 'border-l-green-500' : type === 'warning' ? 'border-l-yellow-400' : type === 'error' ? 'border-l-red-500' : 'border-l-blue-400';
            const bg = type === 'success' ? 'bg-green-50' : type === 'warning' ? 'bg-yellow-50' : type === 'error' ? 'bg-red-50' : 'bg-blue-50';
            const icon = type === 'success' ? 'check-circle' : type === 'warning' ? 'alert-triangle' : type === 'error' ? 'x-circle' : 'info';
            const colorTxt = type === 'success' ? 'text-green-600' : type === 'warning' ? 'text-yellow-600' : type === 'error' ? 'text-red-600' : 'text-blue-600';
            nl.innerHTML = `<div class="p-4 border-l-4 ${border} ${bg} rounded-lg mb-3 shadow-sm transition-all hover:shadow-md"><div class="flex justify-between items-start"><div class="flex items-center gap-2"><i data-lucide="${icon}" class="w-4 h-4 ${colorTxt}"></i><b class="text-sm text-gray-800">${title}</b></div><span class="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded border">NEW</span></div><p class="text-xs mt-2 text-gray-700 ml-6">${msg}</p></div>` + nl.innerHTML;
            document.querySelectorAll('.notif-count-badge').forEach(b => b.textContent = parseInt(b.textContent || 0) + 1);
            lucide.createIcons();
        }
    }
}

// ================= 3. AUTHENTICATION (SIGN UP & LOGIN) =================

// Toggle logic for Login vs Sign Up
const toggleAuthBtn = document.getElementById('toggle-auth-mode');
const nameField = document.getElementById('name-field');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('btn-auth-submit');
const authSubtitle = document.getElementById('auth-subtitle');

toggleAuthBtn.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    if (isSignUpMode) {
        authTitle.textContent = "Create Account";
        authSubtitle.textContent = "Join FinTrack to start tracking";
        authSubmitBtn.textContent = "Sign Up";
        toggleAuthBtn.textContent = "Already have an account? Login";
        nameField.classList.remove('hidden');
    } else {
        authTitle.textContent = "Welcome Back";
        authSubtitle.textContent = "Login to manage your finances";
        authSubmitBtn.textContent = "Login";
        toggleAuthBtn.textContent = "New here? Create an account";
        nameField.classList.add('hidden');
    }
});

// Auth form handler
document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('reg-name').value;

    try {
        if (isSignUpMode) {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCred.user, { displayName: name });
            triggerAlert('Welcome!', 'Account created successfully.', 'success');
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (err) {
        let msg = "Authentication failed.";
        if (err.code === 'auth/email-already-in-use') msg = "Email already registered.";
        if (err.code === 'auth/wrong-password') msg = "Incorrect password.";
        triggerAlert('Access Denied', msg, 'error', false);
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-view').classList.add('hidden'); document.getElementById('app-view').classList.remove('hidden');
        const name = user.displayName || user.email.split('@')[0];
        document.getElementById('user-fullname').textContent = name;
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
        switchView('dashboard-view', 'Dashboard');
        initCharts(); fetchData();
        if(!notifiedSet.has('vault_init')) { triggerAlert('Vault Initialized', 'Secure session started.', 'success'); notifiedSet.add('vault_init'); }
    } else {
        document.getElementById('auth-view').classList.remove('hidden'); document.getElementById('app-view').classList.add('hidden');
    }
});

document.getElementById('btn-google-login').addEventListener('click', (e) => {
    e.preventDefault(); signInWithPopup(auth, googleProvider).then(() => triggerAlert('Success', 'Logged in with Google', 'success')).catch(err => { console.error(err); triggerAlert('Auth Error', 'Could not connect.', 'error', false); });
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));
document.getElementById('toggle-password').addEventListener('click', function() { const i = document.getElementById('password'); const t = i.type === 'password' ? 'text' : 'password'; i.type = t; this.innerHTML = `<i data-lucide="${t==='password'?'eye':'eye-off'}" class="w-5 h-5"></i>`; lucide.createIcons(); });

// ================= 4. DATABASE WRITES =================
window.cancelEdit = function(type) {
    const form = document.getElementById(`form-${type}`); if (form) form.reset();
    document.getElementById(`${type}-id`).value = ''; 
    document.getElementById(`btn-${type}-submit`).textContent = `Save ${type==='inc'?'Income':'Expense'}`; 
    document.getElementById(`btn-${type}-cancel`).classList.add('hidden'); 
    document.getElementById(`${type}-form-title`).textContent = `Add ${type==='inc'?'Income':'Expense'}`;
};

document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'btn-inc-cancel') { e.preventDefault(); cancelEdit('inc'); }
    if (e.target && e.target.id === 'btn-exp-cancel') { e.preventDefault(); cancelEdit('exp'); }
});

document.getElementById('form-income').addEventListener('submit', async (e) => {
    e.preventDefault(); const id = document.getElementById('inc-id').value;
    const data = { type: 'income', amount: Number(document.getElementById('inc-amount').value), source: document.getElementById('inc-source').value, category: document.getElementById('inc-category').value, date: document.getElementById('inc-date').value, uid: auth.currentUser.uid };
    if (id) { await updateDoc(doc(db, "transactions", id), data); triggerAlert('Update Successful', 'Income record updated.', 'success'); cancelEdit('inc'); } 
    else { data.timestamp = new Date(); await addDoc(collection(db, "transactions"), data); triggerAlert('Revenue Captured', `Captured: ₹${data.amount.toLocaleString()}`, 'success'); }
    e.target.reset();
});

document.getElementById('form-expense').addEventListener('submit', async (e) => {
    e.preventDefault(); const id = document.getElementById('exp-id').value;
    const data = { type: 'expense', amount: Number(document.getElementById('exp-amount').value), category: document.getElementById('exp-category').value, description: document.getElementById('exp-desc').value, date: document.getElementById('exp-date').value, uid: auth.currentUser.uid };
    if (id) { await updateDoc(doc(db, "transactions", id), data); triggerAlert('Update Successful', 'Expense record updated.', 'success'); cancelEdit('exp'); } 
    else { data.timestamp = new Date(); await addDoc(collection(db, "transactions"), data); triggerAlert('Disbursement Confirmed', `Recorded: ₹${data.amount.toLocaleString()}`, 'error'); }
    e.target.reset();
});

document.getElementById('form-budget').addEventListener('submit', async (e) => {
    e.preventDefault(); const cat = document.getElementById('bud-category').value; const amt = Number(document.getElementById('bud-amount').value); const monthVal = document.getElementById('bud-month').value; 
    await setDoc(doc(db, "budgets", `${auth.currentUser.uid}_${cat}_${monthVal}`), { uid: auth.currentUser.uid, category: cat, limit: amt, month: monthVal });
    triggerAlert('Budget Set', `${cat} limit set to ₹${amt}`, 'success'); e.target.reset();
});

window.deleteTrans = async (id) => { if(confirm('Delete transaction?')) await deleteDoc(doc(db, "transactions", id)); };

window.editTrans = (id, type) => {
    const t = transactions.find(x => x.id === id); if(!t) return;
    document.getElementById(`${type}-id`).value = t.id; document.getElementById(`${type}-amount`).value = t.amount; document.getElementById(`${type}-date`).value = t.date;
    if(type === 'inc') { document.getElementById('inc-source').value = t.source; document.getElementById('inc-category').value = t.category; document.getElementById('inc-form-title').textContent = 'Edit Income'; }
    else { document.getElementById('exp-desc').value = t.description; document.getElementById('exp-category').value = t.category; document.getElementById('exp-form-title').textContent = 'Edit Expense'; }
    document.getElementById(`btn-${type}-submit`).textContent = 'Update'; document.getElementById(`btn-${type}-cancel`).classList.remove('hidden');
    switchView(`${type==='inc'?'income':'expenses'}-view`, type==='inc'?'Income':'Expenses');
};

document.getElementById('btn-clear-notifs').addEventListener('click', () => { document.getElementById('notifications-list').innerHTML = ''; document.querySelectorAll('.notif-count-badge').forEach(b=>b.textContent='0'); triggerAlert('Factory Reset', 'Notification ledger wiped.', 'info'); });

// ================= 5. DATA RENDERING =================
function fetchData() {
    if (!auth.currentUser) return;
    onSnapshot(query(collection(db, "budgets")), (snap) => {
        userBudgets = {}; snap.forEach(d => { if(d.data().uid === auth.currentUser.uid) { const m = d.data().month || "default"; if(!userBudgets[m]) userBudgets[m] = {}; userBudgets[m][d.data().category] = d.data().limit; } });
        if(transactions.length) processAllData();
    });
    onSnapshot(query(collection(db, "transactions"), orderBy("timestamp", "desc")), (snap) => {
        transactions = []; snap.forEach(d => { if(d.data().uid === auth.currentUser.uid) transactions.push({id: d.id, ...d.data()}); });
        processAllData();
    });
}

function processAllData() {
    const curDate = new Date(); 
    const cm = curDate.toLocaleString('en-US', { month: 'short' }); 
    const cy = curDate.getFullYear(); 
    const currentYm = `${cy}-${String(curDate.getMonth() + 1).padStart(2, '0')}`; 
    
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
        last6Months.push(d.toLocaleString('en-US', { month: 'short' }));
    }
    const trendData = {}; last6Months.forEach(m => trendData[m] = { i: 0, e: 0 });

    let mInc=0, mExp=0, cExp={}, cInc={};
    const incHtml=[], expHtml=[], recHtml=[];

    transactions.forEach((t, index) => {
        const td = new Date(t.date); 
        const tms = td.toLocaleString('en-US', { month: 'short' }); 
        
        if(trendData.hasOwnProperty(tms)) { trendData[tms][t.type === 'income' ? 'i' : 'e'] += t.amount; }
        
        if (tms === cm && td.getFullYear() === cy) { 
            if (t.type === 'income') { mInc+=t.amount; cInc[t.category]=(cInc[t.category]||0)+t.amount; } 
            else { mExp+=t.amount; cExp[t.category]=(cExp[t.category]||0)+t.amount; } 
        }
        
        const btnH = `<div class="flex justify-end gap-2"><button onclick="editTrans('${t.id}', '${t.type==='income'?'inc':'exp'}')" class="text-blue-500"><i data-lucide="edit" class="w-4 h-4"></i></button><button onclick="deleteTrans('${t.id}')" class="text-red-500"><i data-lucide="trash" class="w-4 h-4"></i></button></div>`;
        if(t.type==='income') incHtml.push(`<tr><td class="py-2">${t.date}</td><td>${t.source}</td><td><span class="bg-gray-100 px-2 rounded text-xs">${t.category}</span></td><td class="text-green-600 font-bold">+₹${t.amount}</td><td>${btnH}</td></tr>`);
        else expHtml.push(`<tr><td class="py-2">${t.date}</td><td>${t.description}</td><td><span class="bg-gray-100 px-2 rounded text-xs">${t.category}</span></td><td class="text-red-600 font-bold">-₹${t.amount}</td><td>${btnH}</td></tr>`);
        if(index < 5) recHtml.push(`<div class="flex justify-between items-center text-sm"><div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full ${t.type==='income'?'bg-green-500':'bg-red-500'}"></div><span>${t.type==='income'?t.source:t.description}</span></div><span class="${t.type==='income'?'text-green-600':'text-red-600'} font-bold">${t.type==='income'?'+':'-'}₹${t.amount}</span></div>`);
    });

    const bal = mInc - mExp; const sRate = mInc > 0 ? Math.round((bal/mInc)*100) : 0;
    document.getElementById('dash-income').textContent = `₹${mInc.toLocaleString()}`; document.getElementById('inc-total').textContent = `₹${mInc.toLocaleString()}`; document.getElementById('rep-inc').textContent = `₹${mInc.toLocaleString()}`;
    document.getElementById('dash-expense').textContent = `₹${mExp.toLocaleString()}`; document.getElementById('exp-total').textContent = `₹${mExp.toLocaleString()}`; document.getElementById('rep-exp').textContent = `₹${mExp.toLocaleString()}`;
    document.getElementById('dash-balance').textContent = `₹${bal.toLocaleString()}`; document.getElementById('rep-net').textContent = `₹${bal.toLocaleString()}`;
    document.getElementById('dash-savings').textContent = `${sRate}%`;
    document.getElementById('rep-daily').textContent = `₹${Math.round(mExp/curDate.getDate()).toLocaleString()}`;

    document.getElementById('inc-table-body').innerHTML = incHtml.join(''); document.getElementById('exp-table-body').innerHTML = expHtml.join(''); document.getElementById('dash-recent-list').innerHTML = recHtml.join('');
    document.getElementById('inc-breakdown').innerHTML = Object.keys(cInc).map(k=>`<div class="flex justify-between"><span>${k}</span><b>₹${cInc[k]}</b></div>`).join('');
    document.getElementById('exp-breakdown').innerHTML = Object.keys(cExp).map(k=>`<div class="flex justify-between"><span>${k}</span><b>₹${cExp[k]}</b></div>`).join('');

    if (bal < 5000 && bal > 0 && !notifiedSet.has(`${currentYm}_liq`)) { notifiedSet.add(`${currentYm}_liq`); triggerAlert('Liquidity Critical', 'Balance below ₹5,000.', 'error'); }

    let budHtml = ''; let maxPct = 0;
    const currentBudgets = userBudgets[currentYm] || {}; 
    for (const [cat, limit] of Object.entries(currentBudgets)) {
        const sp = cExp[cat] || 0; const pct = Math.round((sp/limit)*100); maxPct = Math.max(maxPct, pct);
        const rem = limit - sp; const clr = pct >= 100 ? 'red' : pct >= 90 ? 'yellow' : 'green';
        budHtml += `<div><div class="flex justify-between text-sm mb-1"><span>${cat}</span><span class="text-${clr}-600 font-medium">${pct}% used (₹${rem >= 0 ? rem : 0} left)</span></div><div class="w-full bg-gray-100 rounded-full h-2"><div class="bg-${clr}-500 h-2 rounded-full" style="width:${Math.min(100, pct)}%"></div></div></div>`;
        if (pct >= 100 && !notifiedSet.has(`${currentYm}_${cat}_over`)) { notifiedSet.add(`${currentYm}_${cat}_over`); triggerAlert('Budget Over', `${cat} exhausted.`, 'error'); }
    }
    document.getElementById('budget-list').innerHTML = budHtml || `<p class="text-sm text-gray-500">No budgets set.</p>`;
    
    // HEALTH SCORE LOGIC REMOVED TO PREVENT ERRORS

    updateCharts(mInc, mExp, cExp, trendData, last6Months); lucide.createIcons();
}

// ================= 6. CHART ENGINE =================
function initCharts() {
    if(dashChartInst) dashChartInst.destroy(); if(repBarInst) repBarInst.destroy(); if(repPieInst) repPieInst.destroy();
    dashChartInst = new Chart(document.getElementById('dashFlowChart').getContext('2d'), { type: 'doughnut', data: { labels: ['Income', 'Expense'], datasets: [{ data: [0,0], backgroundColor: ['#22c55e', '#ef4444'] }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
    repBarInst = new Chart(document.getElementById('repBarChart').getContext('2d'), { type: 'bar', data: { labels: [], datasets: [{ label:'Income', backgroundColor:'#22c55e', data:[] }, { label:'Expense', backgroundColor:'#ef4444', data:[] }] }, options: { responsive: true } });
    repPieInst = new Chart(document.getElementById('repPieChart').getContext('2d'), { type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#3b82f6','#ef4444','#eab308','#22c55e','#a855f7','#f97316','#64748b'] }] }, options: { responsive: true, maintainAspectRatio: false } });
}

function updateCharts(mInc, mExp, cExp, trendData, last6Months) {
    if(!dashChartInst) return;
    dashChartInst.data.datasets[0].data = [mInc, mExp]; dashChartInst.update();
    repPieInst.data.labels = Object.keys(cExp); repPieInst.data.datasets[0].data = Object.values(cExp); repPieInst.update();
    
    const incD=[], expD=[], tHtml=[];
    last6Months.forEach(m => { 
        const d = trendData[m]; incD.push(d.i); expD.push(d.e); 
        const pct = d.i>0 ? Math.round(((d.i-d.e)/d.i)*100) : 0;
        tHtml.push(`<div class="flex items-center text-sm"><span class="w-10 font-medium">${m}</span><div class="flex-1 mx-3 h-2 bg-gray-100 rounded-full"><div class="h-2 rounded-full ${pct>=30?'bg-green-500':pct>0?'bg-yellow-400':'bg-red-500'}" style="width:${Math.max(0,pct)}%"></div></div><span class="w-10 text-right font-bold">${pct}%</span></div>`);
    });
    document.getElementById('rep-trend-list').innerHTML = tHtml.join('');
    repBarInst.data.labels = last6Months; repBarInst.data.datasets[0].data = incD; repBarInst.data.datasets[1].data = expD; repBarInst.update();
}

setInterval(() => {
    if (!auth.currentUser || document.getElementById('app-view').classList.contains('hidden')) return;
    const wisdom = ["The 50-30-20 Rule: 50% Needs, 30% Wants, 20% Savings.", "SIP Reminders: Systematic investment leads to compounding wealth.", "Emergency Fund: Maintain 3-6 months of expenses."];
    triggerAlert('Smart Wisdom', wisdom[Math.floor(Math.random() * wisdom.length)], 'info'); 
}, 86400000);