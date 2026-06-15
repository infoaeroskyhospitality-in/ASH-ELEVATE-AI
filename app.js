/* ==========================================================================
   AEROSKY HOSPITALITY — DATABASE ENGINE & PORTAL ENGINE
   ========================================================================== */

// --- Firebase Initialization Config ---
const firebaseConfig = {
  apiKey: "AIzaSyA1ubo_GqyE3M-4meC6S4P5zUeBH9UA7fU",
  authDomain: "aerosky-hospitality.firebaseapp.com",
  projectId: "aerosky-hospitality",
  storageBucket: "aerosky-hospitality.firebasestorage.app",
  messagingSenderId: "409468725723",
  appId: "1:409468725723:web:0c6d346c380363f851dffe",
  measurementId: "G-QVECD7L0DW"
};

// Initialize Firebase SDK
firebase.initializeApp(firebaseConfig);

// --- Database Schema Initializer & Caching ---
let db = {
  events: [],
  clients: [],
  vendors: [],
  serviceBoys: [],
  assignments: [],
  vendorOrders: [],
  payments: [],
  issues: [],
  checklist: []
};

// User Credentials Directory (Authentication Database with Phone Links)
const userAccounts = {
  "admin@aerosky.com": { password: "admin123", name: "Aerosky Admin", role: "admin", id: "admin-root", phone: "+919811339509" }
};

// Clean and format phone number for exact comparison (e.g. remove spaces, dashes)
function cleanPhoneNumber(phone) {
  if (!phone) return "";
  return phone.replace(/[\s\-\(\)]/g, "");
}

// Dynamic user accounts resolver by Phone Number
function findAccountByPhone(phoneInput) {
  const cleanInput = cleanPhoneNumber(phoneInput);
  if (!cleanInput) return null;
  
  // 1. Search in hardcoded userAccounts
  for (const email in userAccounts) {
    const account = userAccounts[email];
    if (cleanPhoneNumber(account.phone) === cleanInput) {
      return { ...account, email };
    }
  }
  
  // 2. Search in db.clients
  const client = db.clients.find(c => cleanPhoneNumber(c.phone) === cleanInput);
  if (client) {
    return {
      name: client.name,
      role: "client",
      id: client.id,
      phone: client.phone,
      email: client.email || `${client.id}@aerosky.com`
    };
  }
  
  // 3. Search in db.vendors
  const vendor = db.vendors.find(v => cleanPhoneNumber(v.phone) === cleanInput);
  if (vendor) {
    return {
      name: vendor.name,
      role: "vendor",
      id: vendor.id,
      phone: vendor.phone,
      email: vendor.email || `${vendor.id}@aerosky.com`
    };
  }
  
  // 4. Search in db.serviceBoys
  const staff = db.serviceBoys.find(sb => cleanPhoneNumber(sb.phone) === cleanInput);
  if (staff) {
    return {
      name: staff.name,
      role: "service_boy",
      id: staff.id,
      phone: staff.phone,
      email: `${staff.id}@aerosky.com`
    };
  }
  
  return null;
}

let loggedInUser = null;
let activeTempUser = null; // Stash user matching email validation before OTP is verified

// Default Build Checklist items
const defaultChecklist = [
  { id: "a1", label: "Define tech stack (Node, React, PostgreSQL)", tag: "foundation" },
  { id: "a3", label: "Design database schemas (Events, Staff, Vendors)", tag: "foundation" },
  { id: "a4", label: "Define user roles (Admin, Client, Vendor, ServiceBoy) & RBAC", tag: "security" },
  { id: "a7", label: "Set environment variable management & secrets manager", tag: "security" },
  { id: "au1", label: "Build JWT authentication with HTTP-only cookies", tag: "security" },
  { id: "au2", label: "Implement role-based access control API middleware", tag: "security" },
  { id: "au5", label: "Use parameterized SQL queries / ORM (SQL Injection prevent)", tag: "security" },
  { id: "sb1", label: "Implement Service Boy CRUD & Assign to Event", tag: "features" },
  { id: "sb7", label: "Scope Service Boy queries to user ID (Prevent IDOR)", tag: "security" },
  { id: "v4", label: "Build Vendor Portal for orders & ledger balances", tag: "features" },
  { id: "py1", label: "Client payment tracker (Advance, Due, Receipts)", tag: "features" },
  { id: "py6", label: "Validate payment webhook signatures server-side", tag: "security" },
  { id: "ad5", label: "Create Admin support inbox for client issues", tag: "features" },
  { id: "cl5", label: "Client Portal image upload & issue reporting system", tag: "features" },
  { id: "img3", label: "Validate image uploads using file magic bytes", tag: "security" },
  { id: "sec2", label: "Audit all endpoints for IDOR vulnerabilities", tag: "security" }
];

// Database version for clearing old browser caches
const DATABASE_VERSION = "2.0";

// Mock arrays are cleared for production deployment
const mockClients = [];
const mockEvents = [];
const mockServiceBoys = [];
const mockVendors = [];
const mockAssignments = [];
const mockVendorOrders = [];
const mockPayments = [];
const mockIssues = [];

// --- Database Management Engine ---
function loadDatabase() {
  try {
    const localDb = localStorage.getItem("aerosky_ems_db");
    let needsReset = false;
    
    if (localDb) {
      db = JSON.parse(localDb);
      // If version is missing or outdated, clear and reset
      if (!db.version || db.version !== DATABASE_VERSION) {
        needsReset = true;
      }
    } else {
      needsReset = true;
    }
    
    if (needsReset) {
      db = {
        version: DATABASE_VERSION,
        events: [],
        clients: [],
        vendors: [],
        serviceBoys: [],
        assignments: [],
        vendorOrders: [],
        payments: [],
        issues: [],
        checklist: defaultChecklist.map(item => ({ ...item, checked: false }))
      };
      saveDatabase();
    }
  } catch (e) {
    console.error("Failed to load local storage database", e);
  }
}

function saveDatabase() {
  try {
    localStorage.setItem("aerosky_ems_db", JSON.stringify(db));
  } catch (e) {
    console.error("Failed to save database to local storage", e);
  }
}

// --- App Navigation & Setup Router ---
let activeTab = "overview";
let activeAssignEventId = ""; // Track context event inside operations modal
let activeAssignTab = "tab-staff-assign";
let tempIssueImages = []; // Hold uploaded issue base64 strings

document.addEventListener("DOMContentLoaded", () => {
  // Load database
  loadDatabase();

  // Initialize Elements & UI Bindings
  initAppNavigation();
  initFormSubmissions();
  initModalsClose();
  initChecklistTrigger();
  initLoginHandlers();
  
  // Check auth session
  checkAuthSession();
});

// --- Auth / Session Management ---
function checkAuthSession() {
  try {
    const storedUser = sessionStorage.getItem("aerosky_logged_in_user");
    if (storedUser) {
      loggedInUser = JSON.parse(storedUser);
      loginSuccess(loggedInUser);
    } else {
      logoutSuccess();
    }
  } catch (e) {
    logoutSuccess();
  }
}

function initLoginHandlers() {
  const form = document.getElementById("form-login");
  const phoneInput = document.getElementById("login-phone");
  
  // Setup Firebase invisible reCAPTCHA Verifier
  try {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      'size': 'invisible'
    });
  } catch (err) {
    console.error("Firebase reCAPTCHA Initialization failed: ", err);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const phoneVal = phoneInput.value.trim();
    
    // Find account details
    const account = findAccountByPhone(phoneVal);
    if (!account) {
      alert("Mobile number not found in Aerosky directory! Please register this number first.");
      return;
    }

    // Trigger Firebase Phone OTP for all roles (Admin, Clients, Vendors, and Staff)
    activeTempUser = account;
    const phoneNumber = account.phone;

    if (!phoneNumber) {
      alert("Error: No phone number linked to this profile.");
      return;
    }

    const appVerifier = window.recaptchaVerifier;
    
    // Show loading state
    const submitBtn = document.getElementById("btn-login-submit");
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="ti ti-loader" style="animation: spin 1s linear infinite;"></i> Sending SMS OTP...`;

    firebase.auth().signInWithPhoneNumber(phoneNumber, appVerifier)
      .then((confirmationResult) => {
        window.confirmationResult = confirmationResult;
        
        // Switch views to OTP inputs
        document.getElementById("login-credentials-section").style.display = "none";
        document.getElementById("login-otp-section").style.display = "block";
        document.getElementById("otp-phone-subtext").textContent = `A verification code has been sent to your phone ending in ${phoneNumber.substr(-4)}`;
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      })
      .catch((err) => {
        console.error("Firebase SMS send failure: ", err);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        alert("SMS dispatch failed: " + err.message);
      });
  });

  // Verify OTP button
  document.getElementById("btn-verify-otp").addEventListener("click", () => {
    const code = document.getElementById("login-otp").value.trim();
    if (code.length !== 6) {
      alert("Please enter a valid 6-digit OTP code!");
      return;
    }

    const verifyBtn = document.getElementById("btn-verify-otp");
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<i class="ti ti-loader" style="animation: spin 1s linear infinite;"></i> Verifying...`;

    window.confirmationResult.confirm(code)
      .then((result) => {
        // Authenticated!
        loggedInUser = activeTempUser;
        sessionStorage.setItem("aerosky_logged_in_user", JSON.stringify(loggedInUser));
        
        // Reset inputs & load dashboard
        document.getElementById("login-credentials-section").style.display = "block";
        document.getElementById("login-otp-section").style.display = "none";
        document.getElementById("login-otp").value = "";
        form.reset();
        
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = `<i class="ti ti-circle-check"></i> Verify OTP & Log In`;
        
        loginSuccess(loggedInUser);
      })
      .catch((err) => {
        console.error("OTP verification error: ", err);
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = `<i class="ti ti-circle-check"></i> Verify OTP & Log In`;
        alert("Incorrect code! Please try again.");
      });
  });

  // Cancel OTP and go back
  document.getElementById("btn-cancel-otp").addEventListener("click", () => {
    document.getElementById("login-credentials-section").style.display = "block";
    document.getElementById("login-otp-section").style.display = "none";
    document.getElementById("login-otp").value = "";
    activeTempUser = null;
  });



  // Logout button
  document.getElementById("btn-logout").addEventListener("click", () => {
    sessionStorage.removeItem("aerosky_logged_in_user");
    loggedInUser = null;
    logoutSuccess();
  });
}

function loginSuccess(user) {
  // Hide login screen, show layout
  document.getElementById("login-screen").classList.remove("active");
  document.body.classList.remove("logged-out");
  
  // Set User Profile Pill details in Header
  document.getElementById("user-pill-name").textContent = user.name;
  document.getElementById("user-pill-role").textContent = user.role.replace('_', ' ').toUpperCase();
  document.getElementById("user-pill-avatar").textContent = user.name.split(" ").map(n => n[0]).join("").toUpperCase();

  // Hide all portal viewpoints
  document.querySelectorAll(".portal-view").forEach(view => {
    view.classList.remove("active");
  });

  // Toggle Admin layout sidebar
  const sidebar = document.getElementById("admin-sidebar");
  sidebar.style.display = user.role === "admin" ? "flex" : "none";

  // Route viewport depending on role (Scoping & Security compliance checks)
  if (user.role === "admin") {
    document.getElementById("view-admin").classList.add("active");
    document.querySelector('[data-tab="overview"]').click();
    renderAllViews();
  } else if (user.role === "client") {
    document.getElementById("view-client").classList.add("active");
    loadClientPortalView();
  } else if (user.role === "vendor") {
    document.getElementById("view-vendor").classList.add("active");
    loadVendorPortalView();
  } else if (user.role === "service_boy") {
    document.getElementById("view-service-boy").classList.add("active");
    loadServiceBoyPortalView();
  }
}

function logoutSuccess() {
  document.getElementById("login-screen").classList.add("active");
  document.body.classList.add("logged-out");
}

function initAppNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanels = document.querySelectorAll(".tab-panel");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      
      activeTab = item.dataset.tab;
      tabPanels.forEach(panel => {
        panel.classList.toggle("active", panel.id === `panel-${activeTab}`);
      });
    });
  });

  // Theme Toggler
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");
    document.body.classList.toggle("light-theme", !isDark);
    const icon = document.getElementById("theme-toggle").querySelector("i");
    icon.className = isDark ? "ti ti-sun" : "ti ti-moon";
  });

  // Assign Tabs inside details modal
  const assignTabs = document.querySelectorAll(".assign-tab");
  const assignTabContents = document.querySelectorAll(".assign-tab-content");
  
  assignTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      assignTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      activeAssignTab = tab.dataset.tab;
      assignTabContents.forEach(content => {
        content.classList.toggle("active", content.id === activeAssignTab);
      });
      
      // Load contextually
      loadAssignTabContent();
    });
  });

  // Quick Action Button
  document.getElementById("btn-quick-event").addEventListener("click", () => openModal("modal-event"));
  document.getElementById("btn-add-event").addEventListener("click", () => openModal("modal-event"));
  document.getElementById("btn-add-staff").addEventListener("click", () => openModal("modal-staff"));
  document.getElementById("btn-add-vendor").addEventListener("click", () => openModal("modal-vendor"));
  
  document.getElementById("btn-view-all-events").addEventListener("click", () => {
    document.querySelector('[data-tab="events"]').click();
  });
}

// --- Modal Handlers ---
function openModal(id) {
  document.getElementById(id).classList.add("active");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}
function initModalsClose() {
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });
}

// --- Overview Dashboard Calculations Engine ---
function renderOverviewKPIs() {
  let totalRevenue = 0;
  let totalVendorExpenses = 0;
  let totalStaffPayroll = 0;
  
  // Revenue is client payments logged
  const clientPayments = db.payments.filter(p => p.type === "client");
  totalRevenue = clientPayments.reduce((sum, p) => sum + p.amount, 0);
  
  // Total client outstanding budgets
  const totalContractBudget = db.events.reduce((sum, e) => sum + e.budget, 0);
  const outstandingRevenue = totalContractBudget - totalRevenue;
  
  // Vendor Expenses are invoice contracts linked
  totalVendorExpenses = db.vendorOrders.reduce((sum, vo) => sum + vo.price, 0);
  const vendorPayments = db.payments.filter(p => p.type === "vendor").reduce((sum, p) => sum + p.amount, 0);
  const outstandingVendorDue = totalVendorExpenses - vendorPayments;
  
  // Staff Payouts (Days Worked * Daily Rate)
  db.assignments.forEach(a => {
    if (a.status === "present") {
      const staff = db.serviceBoys.find(s => s.id === a.serviceBoyId);
      if (staff) {
        totalStaffPayroll += a.daysWorked * staff.rate;
      }
    }
  });
  
  const staffPayments = db.payments.filter(p => p.type === "staff").reduce((sum, p) => sum + p.amount, 0);
  const pendingStaffPayouts = totalStaffPayroll - staffPayments;
  
  const netMargin = totalRevenue - (totalVendorExpenses + totalStaffPayroll);
  const marginPct = totalRevenue ? Math.round((netMargin / totalRevenue) * 100) : 0;
  
  // Update Overview HTML
  const format = (num) => "₹" + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  
  document.getElementById("kpi-revenue").textContent = format(totalRevenue);
  document.getElementById("kpi-revenue-sub").textContent = `${format(outstandingRevenue)} outstanding balance`;
  
  document.getElementById("kpi-vendor-costs").textContent = format(totalVendorExpenses);
  document.getElementById("kpi-vendor-sub").textContent = `${format(outstandingVendorDue)} unpaid invoices`;
  
  document.getElementById("kpi-staff-costs").textContent = format(totalStaffPayroll);
  document.getElementById("kpi-staff-sub").textContent = `${format(pendingStaffPayouts)} pending payouts`;
  
  document.getElementById("kpi-margin").textContent = format(netMargin);
  document.getElementById("kpi-margin-pct").textContent = `${marginPct}% operating margin rate`;
  
  // Update Issues Inbox Badge count
  const openIssues = db.issues.filter(i => i.status === "open").length;
  document.getElementById("issues-badge").textContent = openIssues;
}

// --- Checklist Progress Tracker Logic ---
function initChecklistTrigger() {
  renderChecklistProgress();
}

function renderChecklistProgress() {
  const total = db.checklist.length;
  const done = db.checklist.filter(item => item.checked).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  
  document.getElementById("checklist-pct").textContent = pct + "%";
  document.getElementById("checklist-bar").style.width = pct + "%";
  
  document.getElementById("chk-total").textContent = total;
  document.getElementById("chk-done").textContent = done;
  document.getElementById("chk-rem").textContent = total - done;
  
  // Render lists
  const miniList = document.getElementById("checklist-mini-list");
  miniList.innerHTML = "";
  
  db.checklist.forEach(item => {
    const div = document.createElement("div");
    div.className = `mini-chk-item ${item.checked ? 'checked' : ''}`;
    div.innerHTML = `
      <input type="checkbox" ${item.checked ? 'checked' : ''}>
      <span class="mini-chk-label">${item.label} <span class="mini-chk-tag tag-${item.tag}">${item.tag}</span></span>
    `;
    
    // Toggle check
    div.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") {
        const chk = div.querySelector("input");
        chk.checked = !chk.checked;
      }
      item.checked = !item.checked;
      saveDatabase();
      renderChecklistProgress();
    });
    
    miniList.appendChild(div);
  });
}

// --- Active Events list rendering ---
function renderActiveEventsOverview() {
  const miniList = document.getElementById("events-mini-list");
  miniList.innerHTML = "";
  
  // Sort and pick latest 4
  const latestEvents = [...db.events].slice(-4).reverse();
  
  if (latestEvents.length === 0) {
    miniList.innerHTML = `<p class="empty-msg">No events recorded. Click 'New Event' to add.</p>`;
    return;
  }
  
  latestEvents.forEach(e => {
    const div = document.createElement("div");
    div.className = "mini-event-card";
    div.innerHTML = `
      <div class="mini-event-info">
        <h3>${e.name}</h3>
        <p><i class="ti ti-map-pin"></i> ${e.venue} | <i class="ti ti-calendar"></i> ${e.date}</p>
      </div>
      <div class="mini-event-right">
        <div class="mini-event-budget">₹${e.budget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        <span class="badge badge-${e.status === 'completed' ? 'success' : e.status === 'confirmed' ? 'indigo' : 'warning'}">${e.status}</span>
      </div>
    `;
    
    div.addEventListener("click", () => {
      openOperationsModal(e.id);
    });
    
    miniList.appendChild(div);
  });
}

// --- Event Management Rendering ---
function renderEventsTab() {
  const tbody = document.getElementById("table-events-body");
  tbody.innerHTML = "";
  
  const searchVal = document.getElementById("search-events").value.toLowerCase();
  const statusFilter = document.getElementById("filter-event-status").value;
  
  let filteredEvents = db.events.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(searchVal) || e.venue.toLowerCase().includes(searchVal);
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });
  
  if (filteredEvents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-msg" style="text-align:center;">No matching events found.</td></tr>`;
    return;
  }
  
  filteredEvents.forEach(e => {
    const client = db.clients.find(c => c.id === e.clientId) || { name: "N/A", phone: "N/A" };
    
    // Count assigned service boys
    const staffCount = db.assignments.filter(a => a.eventId === e.id).length;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${e.name}</strong></td>
      <td>
        <div>${e.venue}</div>
        <div style="font-size:11px;color:var(--text-muted);"><i class="ti ti-calendar"></i> ${e.date}</div>
      </td>
      <td>
        <div>${client.name}</div>
        <div style="font-size:11px;color:var(--text-muted);">${client.phone}</div>
      </td>
      <td>₹${e.budget.toLocaleString('en-IN')}</td>
      <td><span class="badge badge-indigo">${staffCount} assigned</span></td>
      <td>
        <select class="form-control inline event-status-toggle" style="padding:4px 8px; font-size:12px;" data-id="${e.id}">
          <option value="planning" ${e.status === 'planning' ? 'selected' : ''}>Planning</option>
          <option value="confirmed" ${e.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="completed" ${e.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
      <td class="text-right">
        <button class="btn btn-secondary btn-sm btn-manage-ops" data-id="${e.id}"><i class="ti ti-settings"></i> Operations</button>
      </td>
    `;
    
    // Status Change
    tr.querySelector(".event-status-toggle").addEventListener("change", (event) => {
      e.status = event.target.value;
      saveDatabase();
      renderAllViews();
    });
    
    // Manage Operations click
    tr.querySelector(".btn-manage-ops").addEventListener("click", () => {
      openOperationsModal(e.id);
    });
    
    tbody.appendChild(tr);
  });
}

// Search triggers
document.getElementById("search-events").addEventListener("input", renderEventsTab);
document.getElementById("filter-event-status").addEventListener("change", renderEventsTab);

// --- Staff / Service Boys Directory Rendering ---
function renderStaffTab() {
  const tbody = document.getElementById("table-staff-body");
  tbody.innerHTML = "";
  
  db.serviceBoys.forEach(s => {
    // Count active assignments
    const activeAssignments = db.assignments.filter(a => a.serviceBoyId === s.id).length;
    
    // Calculate total earnings across present assignments
    let earnings = 0;
    db.assignments.filter(a => a.serviceBoyId === s.id && a.status === "present").forEach(a => {
      earnings += a.daysWorked * s.rate;
    });
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${s.name}</strong><br><span style="font-size:10px;color:var(--text-muted);">ID: SB-${s.id.substr(2,3).toUpperCase()}</span></td>
      <td>${s.phone}</td>
      <td><span class="badge badge-info">${s.role}</span></td>
      <td>₹${s.rate}/day</td>
      <td><span class="badge badge-indigo">${activeAssignments} events</span></td>
      <td><strong>₹${earnings.toLocaleString('en-IN')}</strong></td>
      <td class="text-right">
        <button class="btn btn-secondary btn-sm btn-delete-staff" data-id="${s.id}"><i class="ti ti-trash"></i> Delete</button>
      </td>
    `;
    
    tr.querySelector(".btn-delete-staff").addEventListener("click", () => {
      if (confirm(`Remove ${s.name} from directory?`)) {
        db.serviceBoys = db.serviceBoys.filter(x => x.id !== s.id);
        // Clear his assignments
        db.assignments = db.assignments.filter(x => x.serviceBoyId !== s.id);
        saveDatabase();
        renderAllViews();
      }
    });
    
    tbody.appendChild(tr);
  });
}

// --- Vendor Logistics Tab Rendering ---
function renderVendorsTab() {
  const tbody = document.getElementById("table-vendors-body");
  tbody.innerHTML = "";
  
  db.vendors.forEach(v => {
    // Assigned projects count
    const projectCount = db.vendorOrders.filter(vo => vo.vendorId === v.id).length;
    
    // Finances
    const totalInvoiced = db.vendorOrders.filter(vo => vo.vendorId === v.id).reduce((sum, vo) => sum + vo.price, 0);
    const paidAmount = db.payments.filter(p => p.type === "vendor" && p.entityId === v.id).reduce((sum, p) => sum + p.amount, 0);
    const pendingDue = totalInvoiced - paidAmount;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${v.name}</strong></td>
      <td><span class="badge badge-success">${v.category}</span></td>
      <td>
        <div>${v.phone}</div>
        <div style="font-size:11px;color:var(--text-muted);">${v.email}</div>
      </td>
      <td><span class="badge badge-indigo">${projectCount} jobs</span></td>
      <td>₹${totalInvoiced.toLocaleString('en-IN')}</td>
      <td>₹${paidAmount.toLocaleString('en-IN')}</td>
      <td><strong style="color:${pendingDue > 0 ? 'var(--brand-gold)' : 'inherit'}">₹${pendingDue.toLocaleString('en-IN')}</strong></td>
      <td class="text-right">
        <button class="btn btn-secondary btn-sm btn-delete-vendor" data-id="${v.id}"><i class="ti ti-trash"></i></button>
      </td>
    `;
    
    tr.querySelector(".btn-delete-vendor").addEventListener("click", () => {
      if (confirm(`Remove ${v.name} from vendors?`)) {
        db.vendors = db.vendors.filter(x => x.id !== v.id);
        db.vendorOrders = db.vendorOrders.filter(x => x.vendorId !== v.id);
        saveDatabase();
        renderAllViews();
      }
    });
    
    tbody.appendChild(tr);
  });
}

// --- Support Tickets Inbox (Admin View) ---
function renderIssuesInboxTab() {
  const container = document.getElementById("issues-inbox-list");
  container.innerHTML = "";
  
  if (db.issues.length === 0) {
    container.innerHTML = `<p class="empty-msg" style="grid-column: 1/-1; text-align:center;">No issues currently reported by clients.</p>`;
    return;
  }
  
  db.issues.forEach(i => {
    const client = db.clients.find(c => c.id === i.clientId) || { name: "Unknown Client" };
    const event = db.events.find(e => e.id === i.eventId) || { name: "General Event" };
    
    const card = document.createElement("div");
    card.className = "issue-card";
    card.innerHTML = `
      <div class="issue-card-header">
        <div>
          <div class="issue-client-name">${client.name}</div>
          <div class="issue-event-name">${event.name}</div>
        </div>
        <span class="badge badge-${i.status === 'resolved' ? 'success' : i.status === 'in-progress' ? 'warning' : 'danger'}">${i.status}</span>
      </div>
      <p class="issue-text">${i.desc}</p>
      
      ${i.images && i.images.length > 0 ? `
        <div class="issue-attachments">
          ${i.images.map(img => `<img src="${img}" class="issue-img-thumb" onclick="window.open('${img}')">`).join('')}
        </div>
      ` : ''}
      
      <div class="issue-footer">
        <span class="issue-date"><i class="ti ti-calendar"></i> ${i.date}</span>
        <select class="form-control inline issue-action-select" data-id="${i.id}">
          <option value="open" ${i.status === 'open' ? 'selected' : ''}>Open</option>
          <option value="in-progress" ${i.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="resolved" ${i.status === 'resolved' ? 'selected' : ''}>Resolved</option>
        </select>
      </div>
    `;
    
    card.querySelector(".issue-action-select").addEventListener("change", (e) => {
      i.status = e.target.value;
      saveDatabase();
      renderAllViews();
    });
    
    container.appendChild(card);
  });
}

// --- Operations Modal Details Management ---
function openOperationsModal(eventId) {
  activeAssignEventId = eventId;
  const event = db.events.find(e => e.id === eventId);
  if (!event) return;
  
  document.getElementById("assign-event-title").textContent = event.name;
  
  // Set tab to staff default
  const firstTab = document.querySelector(".assign-tab");
  firstTab.click();
  
  openModal("modal-assign-detail");
}

function loadAssignTabContent() {
  if (!activeAssignEventId) return;
  
  if (activeAssignTab === "tab-staff-assign") {
    loadStaffAssignmentView();
  } else if (activeAssignTab === "tab-vendor-assign") {
    loadVendorAssignmentView();
  } else if (activeAssignTab === "tab-payments-assign") {
    loadPaymentsAssignmentView();
  }
}

// 1. Staff Assignments Manager
function loadStaffAssignmentView() {
  // Populate dropdown with staff boy directory
  const select = document.getElementById("assign-staff-id");
  select.innerHTML = `<option value="">Select Service Boy...</option>`;
  db.serviceBoys.forEach(s => {
    // Only boys not already assigned to this event
    const isAssigned = db.assignments.some(a => a.eventId === activeAssignEventId && a.serviceBoyId === s.id);
    if (!isAssigned) {
      select.innerHTML += `<option value="${s.id}">${s.name} (${s.role} - ₹${s.rate}/day)</option>`;
    }
  });

  // Render assigned table list
  const tbody = document.getElementById("assigned-staff-table-body");
  tbody.innerHTML = "";
  
  const assigned = db.assignments.filter(a => a.eventId === activeAssignEventId);
  
  if (assigned.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg" style="text-align:center;">No staff assigned to this event yet.</td></tr>`;
    return;
  }
  
  assigned.forEach(a => {
    const s = db.serviceBoys.find(x => x.id === a.serviceBoyId) || { name: "Removed Staff", rate: 0 };
    const wages = a.daysWorked * s.rate;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${s.name}</strong></td>
      <td>${a.role}</td>
      <td>${a.daysWorked} days</td>
      <td>
        <button type="button" class="btn btn-sm btn-secondary toggle-attendance-btn" data-id="${a.id}">
          <i class="ti ti-${a.status === 'present' ? 'circle-check' : a.status === 'absent' ? 'circle-x' : 'clock'}"></i>
          ${a.status.toUpperCase()}
        </button>
      </td>
      <td>₹${wages.toLocaleString('en-IN')}</td>
      <td>
        <button class="btn btn-secondary btn-sm btn-delete-assignment" data-id="${a.id}"><i class="ti ti-trash"></i></button>
      </td>
    `;
    
    // Toggle attendance
    tr.querySelector(".toggle-attendance-btn").addEventListener("click", () => {
      if (a.status === "assigned") a.status = "present";
      else if (a.status === "present") a.status = "absent";
      else a.status = "assigned";
      
      saveDatabase();
      renderAllViews();
      loadStaffAssignmentView();
    });

    // Delete assignment
    tr.querySelector(".btn-delete-assignment").addEventListener("click", () => {
      db.assignments = db.assignments.filter(x => x.id !== a.id);
      saveDatabase();
      renderAllViews();
      loadStaffAssignmentView();
    });
    
    tbody.appendChild(tr);
  });
}

// 2. Vendor Linkages Manager
function loadVendorAssignmentView() {
  // Populate dropdown with vendors list
  const select = document.getElementById("assign-vendor-id");
  select.innerHTML = `<option value="">Select Vendor...</option>`;
  db.vendors.forEach(v => {
    select.innerHTML += `<option value="${v.id}">${v.name} (${v.category})</option>`;
  });

  // Render assigned vendors table
  const tbody = document.getElementById("assigned-vendor-table-body");
  tbody.innerHTML = "";
  
  const linked = db.vendorOrders.filter(vo => vo.eventId === activeAssignEventId);
  
  if (linked.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg" style="text-align:center;">No vendor contracts linked to this event.</td></tr>`;
    return;
  }
  
  linked.forEach(vo => {
    const v = db.vendors.find(x => x.id === vo.vendorId) || { name: "Removed Vendor" };
    
    // Check if fully paid
    const paymentsSum = db.payments.filter(p => p.type === "vendor" && p.eventId === activeAssignEventId && p.entityId === v.id).reduce((sum, p) => sum + p.amount, 0);
    const balance = vo.price - paymentsSum;
    const paidBadge = balance <= 0 ? 'badge-success' : paymentsSum > 0 ? 'badge-warning' : 'badge-danger';
    const statusText = balance <= 0 ? 'Fully Paid' : paymentsSum > 0 ? `Paid (₹${paymentsSum})` : 'Unpaid';
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${v.name}</strong></td>
      <td>${vo.desc}</td>
      <td>₹${vo.price.toLocaleString('en-IN')}</td>
      <td><span class="badge ${paidBadge}">${statusText}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm btn-delete-vo" data-id="${vo.id}"><i class="ti ti-trash"></i></button>
      </td>
    `;
    
    tr.querySelector(".btn-delete-vo").addEventListener("click", () => {
      db.vendorOrders = db.vendorOrders.filter(x => x.id !== vo.id);
      saveDatabase();
      renderAllViews();
      loadVendorAssignmentView();
    });
    
    tbody.appendChild(tr);
  });
}

// 3. Operational Payments Ledger logs
function loadPaymentsAssignmentView() {
  const typeSelect = document.getElementById("payment-target-type");
  const entitySelect = document.getElementById("payment-recipient-select");
  
  const populateRecipients = () => {
    entitySelect.innerHTML = "";
    const type = typeSelect.value;
    const event = db.events.find(e => e.id === activeAssignEventId);
    
    if (type === "client") {
      // The client linked to this event
      const c = db.clients.find(x => x.id === event.clientId);
      if (c) {
        entitySelect.innerHTML = `<option value="${c.id}">${c.name} (Client Invoice)</option>`;
      }
    } else if (type === "vendor") {
      // Vendors linked to this event
      const linkedVo = db.vendorOrders.filter(vo => vo.eventId === activeAssignEventId);
      if (linkedVo.length === 0) {
        entitySelect.innerHTML = `<option value="">No vendors linked to event</option>`;
      } else {
        linkedVo.forEach(vo => {
          const v = db.vendors.find(x => x.id === vo.vendorId);
          if (v) {
            entitySelect.innerHTML += `<option value="${v.id}">${v.name} (Contract: ₹${vo.price})</option>`;
          }
        });
      }
    } else if (type === "staff") {
      // Service boys assigned to this event
      const assigned = db.assignments.filter(a => a.eventId === activeAssignEventId);
      if (assigned.length === 0) {
        entitySelect.innerHTML = `<option value="">No staff assigned to event</option>`;
      } else {
        assigned.forEach(a => {
          const s = db.serviceBoys.find(x => x.id === a.serviceBoyId);
          if (s) {
            entitySelect.innerHTML += `<option value="${s.id}">${s.name} (${a.role})</option>`;
          }
        });
      }
    }
  };
  
  typeSelect.removeEventListener("change", populateRecipients);
  typeSelect.addEventListener("change", populateRecipients);
  
  populateRecipients();

  // Render payments list
  const tbody = document.getElementById("assigned-payments-table-body");
  tbody.innerHTML = "";
  
  const payments = db.payments.filter(p => p.eventId === activeAssignEventId);
  
  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="text-align:center;">No payments logged for this event.</td></tr>`;
    return;
  }
  
  payments.forEach(p => {
    let entityName = "Unknown";
    if (p.type === "client") {
      entityName = db.clients.find(x => x.id === p.entityId)?.name || "Client";
    } else if (p.type === "vendor") {
      entityName = db.vendors.find(x => x.id === p.entityId)?.name || "Vendor";
    } else if (p.type === "staff") {
      entityName = db.serviceBoys.find(x => x.id === p.entityId)?.name || "Staff";
    }
    
    const categoryBadge = p.type === "client" ? 'badge-success' : p.type === "vendor" ? 'badge-warning' : 'badge-danger';
    const catLabel = p.type === "client" ? 'Income' : p.type === "vendor" ? 'Vendor Exp' : 'Staff Wage';
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.date}</td>
      <td><span class="badge ${categoryBadge}">${catLabel}</span></td>
      <td>${entityName}</td>
      <td class="text-right">₹${p.amount.toLocaleString('en-IN')}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Client Portal View Code (Strict IDOR scope details) ---
function loadClientPortalView() {
  if (!loggedInUser || loggedInUser.role !== "client") return;
  const clientId = loggedInUser.id; // Enforce logged-in ID
  
  // Filter events belonging ONLY to this client (strict data scoping)
  const clientEvents = db.events.filter(e => e.clientId === clientId);
  
  const eventsList = document.getElementById("client-events-list");
  eventsList.innerHTML = "";
  
  const staffTeam = document.getElementById("client-staff-team");
  staffTeam.innerHTML = "";
  
  const financeSummary = document.getElementById("client-finance-summary");
  financeSummary.innerHTML = "";
  
  const issueEventSelect = document.getElementById("issue-event-id");
  issueEventSelect.innerHTML = "";
  
  if (clientEvents.length === 0) {
    eventsList.innerHTML = `<p class="empty-msg">No active events registered under your profile.</p>`;
    staffTeam.innerHTML = `<p class="empty-msg">No coordination crew assigned.</p>`;
    financeSummary.innerHTML = `<div class="empty-msg">No bills generated.</div>`;
    return;
  }
  
  let totalContractValue = 0;
  let totalPaid = 0;
  const assignedServiceBoysSet = new Set();
  
  clientEvents.forEach(e => {
    totalContractValue += e.budget;
    issueEventSelect.innerHTML += `<option value="${e.id}">${e.name}</option>`;
    
    // Payments logged for this event
    totalPaid += db.payments.filter(p => p.eventId === e.id && p.type === "client").reduce((sum, p) => sum + p.amount, 0);
    
    // Add event pane
    const pane = document.createElement("div");
    pane.className = "client-event-pane";
    pane.innerHTML = `
      <div class="client-event-header">
        <h3>${e.name}</h3>
        <span class="badge badge-${e.status === 'completed' ? 'success' : e.status === 'confirmed' ? 'indigo' : 'warning'}">${e.status}</span>
      </div>
      <div class="client-event-meta">
        <span><i class="ti ti-map-pin"></i> <strong>Venue:</strong> ${e.venue}</span>
        <span><i class="ti ti-calendar"></i> <strong>Schedule:</strong> ${e.date}</span>
      </div>
    `;
    eventsList.appendChild(pane);
    
    // Fetch assigned service boys (Name & phone only, matching checklist security rules)
    db.assignments.filter(a => a.eventId === e.id).forEach(a => {
      assignedServiceBoysSet.add(a.serviceBoyId);
    });
  });
  
  // Render assigned service boys roster
  if (assignedServiceBoysSet.size === 0) {
    staffTeam.innerHTML = `<p class="empty-msg">No coordination crew assigned to your event details yet.</p>`;
  } else {
    assignedServiceBoysSet.forEach(sbId => {
      const sb = db.serviceBoys.find(x => x.id === sbId);
      if (sb) {
        const card = document.createElement("div");
        card.className = "client-staff-card";
        card.innerHTML = `
          <i class="ti ti-user"></i>
          <div class="client-staff-info">
            <h4>${sb.name}</h4>
            <p>${sb.phone}</p>
          </div>
        `;
        staffTeam.appendChild(card);
      }
    });
  }
  
  // Render financial summaries
  const due = totalContractValue - totalPaid;
  financeSummary.innerHTML = `
    <div class="client-finance-row">
      <span>Total Event Contract Amount:</span>
      <strong>₹${totalContractValue.toLocaleString('en-IN')}</strong>
    </div>
    <div class="client-finance-row paid">
      <span>Payments Made (Credits):</span>
      <strong>₹${totalPaid.toLocaleString('en-IN')}</strong>
    </div>
    <div class="client-finance-row outstanding">
      <span>Outstanding Dues (Pending):</span>
      <strong>₹${due.toLocaleString('en-IN')}</strong>
    </div>
  `;
  
  // Load client's support issues history
  renderClientIssuesHistory(clientId);
}

function renderClientIssuesHistory(clientId) {
  const list = document.getElementById("client-issues-list");
  list.innerHTML = "";
  
  const clientIssues = db.issues.filter(i => i.clientId === clientId);
  if (clientIssues.length === 0) {
    list.innerHTML = `<p class="empty-msg" style="text-align:left;">No support tickets logged.</p>`;
    return;
  }
  
  clientIssues.forEach(i => {
    const ticket = document.createElement("div");
    ticket.className = "client-issue-ticket";
    ticket.innerHTML = `
      <div class="ticket-hdr">
        <span>Ref ID: #${i.id.substr(2,4).toUpperCase()}</span>
        <span class="badge badge-${i.status === 'resolved' ? 'success' : i.status === 'in-progress' ? 'warning' : 'danger'}">${i.status}</span>
      </div>
      <p class="ticket-desc">${i.desc}</p>
      <div style="font-size:10px;color:var(--text-muted);margin-top:6px;"><i class="ti ti-clock"></i> Logged: ${i.date}</div>
    `;
    list.appendChild(ticket);
  });
}

// Client simulated uploader logic
document.getElementById("issue-file-upload").addEventListener("change", (event) => {
  const files = event.target.files;
  const thumbnails = document.getElementById("upload-thumbnails");
  thumbnails.innerHTML = "";
  tempIssueImages = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.match('image.*')) continue;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataURL = e.target.result;
      tempIssueImages.push(dataURL);
      
      const img = document.createElement("img");
      img.className = "upload-thumb";
      img.src = dataURL;
      thumbnails.appendChild(img);
    };
    reader.readAsDataURL(file);
  }
});

// --- Vendor Portal View Code (IDOR scopes) ---
function loadVendorPortalView() {
  if (!loggedInUser || loggedInUser.role !== "vendor") return;
  const vendorId = loggedInUser.id; // Enforce logged-in ID
  
  const orders = db.vendorOrders.filter(vo => vo.vendorId === vendorId);
  const paymentsSum = db.payments.filter(p => p.type === "vendor" && p.entityId === vendorId).reduce((sum, p) => sum + p.amount, 0);
  const totalInvoiced = orders.reduce((sum, vo) => sum + vo.price, 0);
  const due = totalInvoiced - paymentsSum;
  
  // Set KPIs
  document.getElementById("vendor-stat-jobs").textContent = orders.length;
  document.getElementById("vendor-stat-invoiced").textContent = "₹" + totalInvoiced.toLocaleString('en-IN');
  document.getElementById("vendor-stat-paid").textContent = "₹" + paymentsSum.toLocaleString('en-IN');
  document.getElementById("vendor-stat-due").textContent = "₹" + due.toLocaleString('en-IN');
  
  // Fill orders table
  const tbody = document.getElementById("table-vendor-orders-body");
  tbody.innerHTML = "";
  
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="text-align:center;">No contracts registered to your profile.</td></tr>`;
    return;
  }
  
  orders.forEach(vo => {
    const e = db.events.find(x => x.id === vo.eventId) || { name: "N/A" };
    const orderPayments = db.payments.filter(p => p.type === "vendor" && p.eventId === vo.eventId && p.entityId === vendorId).reduce((sum, p) => sum + orderPayments, 0);
    const orderDue = vo.price - orderPayments;
    
    const paidBadge = orderDue <= 0 ? 'badge-success' : orderPayments > 0 ? 'badge-warning' : 'badge-danger';
    const statusText = orderDue <= 0 ? 'Fully Paid' : orderPayments > 0 ? `Paid Partial (₹${orderPayments})` : 'Unpaid';
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${e.name}</strong></td>
      <td>${vo.desc}</td>
      <td>₹${vo.price.toLocaleString('en-IN')}</td>
      <td><span class="badge ${paidBadge}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Service Boy Portal View (Mobile Check-In & Schedule) ---
function loadServiceBoyPortalView() {
  if (!loggedInUser || loggedInUser.role !== "service_boy") return;
  const staffId = loggedInUser.id; // Enforce logged-in ID
  
  const staff = db.serviceBoys.find(s => s.id === staffId);
  if (!staff) return;
  
  // Render mobile header user details
  document.getElementById("sb-mobile-name").textContent = staff.name;
  document.getElementById("sb-mobile-id").textContent = `Staff ID: SB-${staff.id.substr(2,3).toUpperCase()}`;
  document.getElementById("sb-mobile-avatar").textContent = staff.name.split(" ").map(n => n[0]).join("").toUpperCase();
  
  // Check active assignments
  const myAssignments = db.assignments.filter(a => a.serviceBoyId === staffId);
  const presentDays = myAssignments.filter(a => a.status === "present").reduce((sum, a) => sum + a.daysWorked, 0);
  const totalEarned = presentDays * staff.rate;
  
  document.getElementById("sb-mobile-rate").textContent = "₹" + staff.rate;
  document.getElementById("sb-mobile-days").textContent = presentDays;
  document.getElementById("sb-mobile-total").textContent = "₹" + totalEarned.toLocaleString('en-IN');
  
  // Check attendance widget status
  const checkinStatus = document.getElementById("sb-mobile-checkin-status");
  const checkinBtn = document.getElementById("btn-sb-checkin");
  
  // Find if there is an assignment scheduled for today (or confirmed events)
  const activeAssign = myAssignments.find(a => a.status === "assigned");
  
  if (activeAssign) {
    checkinStatus.textContent = "Duty Logged (Pending Check-In)";
    checkinStatus.className = "checkin-status";
    checkinBtn.style.display = "block";
    checkinBtn.onclick = () => {
      activeAssign.status = "present";
      saveDatabase();
      loadServiceBoyPortalView();
      renderAllViews();
      alert("Attendance checked successfully! Your wage ledger is updated.");
    };
  } else {
    const hasPresent = myAssignments.some(a => a.status === "present");
    checkinStatus.textContent = hasPresent ? "Checked-In (Active)" : "No Duty Assigned Today";
    checkinStatus.className = `checkin-status ${hasPresent ? 'logged' : ''}`;
    checkinBtn.style.display = "none";
  }
  
  // Render duty schedule list
  const list = document.getElementById("sb-mobile-duty-list");
  list.innerHTML = "";
  
  if (myAssignments.length === 0) {
    list.innerHTML = `<p class="empty-msg" style="color:#71717a;">No assignments listed.</p>`;
    return;
  }
  
  myAssignments.forEach(a => {
    const e = db.events.find(x => x.id === a.eventId) || { name: "Event", venue: "Venue", date: "Date" };
    
    const card = document.createElement("div");
    card.className = "mobile-duty-card";
    card.innerHTML = `
      <div class="duty-hdr">
        <div class="duty-name">${e.name}</div>
        <span class="badge badge-${a.status === 'present' ? 'success' : a.status === 'absent' ? 'danger' : 'warning'}">${a.status}</span>
      </div>
      <div class="duty-venue"><i class="ti ti-map-pin"></i> ${e.venue}</div>
      <div class="duty-meta">
        <span>Role: ${a.role}</span>
        <span>Date: ${e.date}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

// --- Global Form Submissions Handler ---
function initFormSubmissions() {
  // 1. Add Event
  document.getElementById("form-add-event").addEventListener("submit", (e) => {
    e.preventDefault();
    
    // Create new client
    const clientId = 'c-' + Date.now();
    const clientName = document.getElementById("event-client-name").value;
    const clientPhone = document.getElementById("event-client-phone").value;
    const clientEmail = document.getElementById("event-client-email").value;
    
    db.clients.push({ id: clientId, name: clientName, phone: clientPhone, email: clientEmail });
    
    // Create Event
    const eventId = 'e-' + Date.now();
    const eventName = document.getElementById("event-name").value;
    const eventDate = document.getElementById("event-date").value;
    const eventVenue = document.getElementById("event-venue").value;
    const eventBudget = parseFloat(document.getElementById("event-budget").value) || 0;
    
    db.events.push({
      id: eventId,
      name: eventName,
      date: eventDate,
      venue: eventVenue,
      clientId: clientId,
      status: "planning",
      budget: eventBudget
    });
    
    saveDatabase();
    closeModal("modal-event");
    document.getElementById("form-add-event").reset();
    renderAllViews();
    alert("New Event added successfully!");
  });
  
  // 2. Add Service Boy
  document.getElementById("form-add-staff").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const staffId = 's-' + Date.now();
    const name = document.getElementById("staff-name").value;
    const phone = document.getElementById("staff-phone").value;
    const role = document.getElementById("staff-role").value;
    const rate = parseFloat(document.getElementById("staff-rate").value) || 0;
    
    db.serviceBoys.push({ id: staffId, name, phone, role, rate });
    
    saveDatabase();
    closeModal("modal-staff");
    document.getElementById("form-add-staff").reset();
    renderAllViews();
    alert("Staff member registered!");
  });
  
  // 3. Add Vendor
  document.getElementById("form-add-vendor").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const vendorId = 'v-' + Date.now();
    const name = document.getElementById("vendor-name").value;
    const category = document.getElementById("vendor-category").value;
    const phone = document.getElementById("vendor-phone").value;
    const email = document.getElementById("vendor-email").value;
    
    db.vendors.push({ id: vendorId, name, category, phone, email });
    
    saveDatabase();
    closeModal("modal-vendor");
    document.getElementById("form-add-vendor").reset();
    renderAllViews();
    alert("Vendor registered!");
  });
  
  // 4. Assign Staff to Event
  document.getElementById("form-assign-staff").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const staffId = document.getElementById("assign-staff-id").value;
    const role = document.getElementById("assign-staff-role").value;
    const days = parseInt(document.getElementById("assign-staff-days").value) || 1;
    
    if (!staffId) return;
    
    db.assignments.push({
      id: 'a-' + Date.now(),
      serviceBoyId: staffId,
      eventId: activeAssignEventId,
      role: role,
      daysWorked: days,
      status: "assigned"
    });
    
    saveDatabase();
    renderAllViews();
    loadStaffAssignmentView();
  });
  
  // 5. Link Vendor to Event
  document.getElementById("form-assign-vendor").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const vendorId = document.getElementById("assign-vendor-id").value;
    const desc = document.getElementById("assign-vendor-desc").value;
    const price = parseFloat(document.getElementById("assign-vendor-price").value) || 0;
    
    if (!vendorId) return;
    
    db.vendorOrders.push({
      id: 'vo-' + Date.now(),
      vendorId: vendorId,
      eventId: activeAssignEventId,
      desc: desc,
      price: price
    });
    
    saveDatabase();
    renderAllViews();
    loadVendorAssignmentView();
    document.getElementById("form-assign-vendor").reset();
  });
  
  // 6. Log Payouts / Payments
  document.getElementById("form-log-payment").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const type = document.getElementById("payment-target-type").value;
    const entityId = document.getElementById("payment-recipient-select").value;
    const amount = parseFloat(document.getElementById("payment-amount").value) || 0;
    
    if (!entityId) {
      alert("Invalid payment target!");
      return;
    }
    
    db.payments.push({
      id: 'p-' + Date.now(),
      eventId: activeAssignEventId,
      amount: amount,
      type: type,
      entityId: entityId,
      date: new Date().toISOString().split('T')[0]
    });
    
    saveDatabase();
    renderAllViews();
    loadPaymentsAssignmentView();
    document.getElementById("payment-amount").value = "";
    alert("Payment logged successfully!");
  });
  
  // 7. Client submits issue ticket
  document.getElementById("form-report-issue").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const eventId = document.getElementById("issue-event-id").value;
    const clientId = loggedInUser.id; // Enforce context ID
    const desc = document.getElementById("issue-description").value;
    
    db.issues.push({
      id: 'i-' + Date.now(),
      eventId: eventId,
      clientId: clientId,
      desc: desc,
      images: [...tempIssueImages],
      status: "open",
      date: new Date().toISOString().split('T')[0]
    });
    
    saveDatabase();
    tempIssueImages = [];
    document.getElementById("upload-thumbnails").innerHTML = "";
    document.getElementById("form-report-issue").reset();
    
    loadClientPortalView();
    renderAllViews();
    alert("Support Ticket submitted to Admin command centre!");
  });
}

// --- Global Renderer Router ---
function renderAllViews() {
  if (loggedInUser && loggedInUser.role === "admin") {
    renderOverviewKPIs();
    renderChecklistProgress();
    renderActiveEventsOverview();
    renderEventsTab();
    renderStaffTab();
    renderVendorsTab();
    renderIssuesInboxTab();
  }
}
