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

// --- Supabase Client Initialization ---
const supabaseUrl = "https://tintsbslzdwjylwgocbm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbnRzYnNsemR3anlsd2dvY2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTgzMzQsImV4cCI6MjA5NzA5NDMzNH0.fYPaV8HiUrr6mllkZTztc1AYBdk64pPB6xPtWO14jug";
const supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

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
  checklist: [],
  activityLogs: [],
  inquiries: []
};

// User Credentials Directory (Authentication Database with Phone Links)
const userAccounts = {
  "admin@aerosky.com": { password: "878545", name: "Aerosky Admin", role: "admin", id: "admin-root", phone: "9811339509" }
};

// Clean and format phone number for exact comparison (e.g. remove spaces, dashes, match last 10 digits)
function cleanPhoneNumber(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
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

// Calculate distance between two coordinates in meters using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
  const R = 6371e3; // Earth's radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// Log audit trails to Supabase activity_logs table
async function logActivity(action, targetTable, recordId, details) {
  if (!supabaseClient) return;
  
  const userId = loggedInUser ? loggedInUser.id : "anonymous";
  const userName = loggedInUser ? loggedInUser.name : "System / Anon";
  const role = loggedInUser ? loggedInUser.role : "public";
  
  const logId = 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  
  try {
    await supabaseClient.from('activity_logs').insert({
      id: logId,
      user_id: userId,
      user_name: userName,
      role: role,
      action: action,
      target_table: targetTable,
      record_id: recordId,
      details: typeof details === 'object' ? JSON.stringify(details) : details
    });
  } catch (err) {
    console.error("Activity logging failed:", err);
  }
}

// Display in-app floating Toast notifications
function showToast(title, message, type = 'info', duration = 6000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const item = document.createElement("div");
  item.className = `toast-item ${type}`;

  let icon = 'ti-info-circle';
  if (type === 'success') icon = 'ti-circle-check';
  else if (type === 'warning') icon = 'ti-alert-triangle';
  else if (type === 'error') icon = 'ti-circle-x';

  item.innerHTML = `
    <div class="toast-icon"><i class="ti ${icon}"></i></div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  item.querySelector(".toast-close").addEventListener("click", () => {
    item.classList.add("closing");
    item.addEventListener("animationend", () => item.remove());
  });

  container.appendChild(item);

  setTimeout(() => {
    if (item.parentNode) {
      item.classList.add("closing");
      item.addEventListener("animationend", () => item.remove());
    }
  }, duration);
}

// Export PDF Invoice
function generateInvoicePDF(eventId) {
  const event = db.events.find(e => e.id === eventId);
  if (!event) return;
  const client = db.clients.find(c => c.id === event.clientId) || { name: "N/A", phone: "N/A", email: "N/A" };
  
  const payments = db.payments.filter(p => p.eventId === eventId && p.type === "client");
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = event.budget - totalPaid;
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Custom design colors (Aerosky Gold and Green accents)
  doc.setFillColor(13, 107, 62); // Green banner
  doc.rect(0, 0, 210, 30, 'F');
  
  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(20);
  doc.text("AEROSKY HOSPITALITY", 15, 20);
  doc.setFontSize(10);
  doc.setFont("Helvetica", "normal");
  doc.text("Event Management & Catering Specialists", 15, 26);
  
  // Invoice Metadata
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.text(`Invoice No: INV-${event.id.toUpperCase().substr(2,6)}`, 195, 45, { align: "right" });
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 195, 50, { align: "right" });
  
  // Client Details Section
  doc.setTextColor(0, 0, 0);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.text("CLIENT INFO:", 15, 45);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Name: ${client.name}`, 15, 52);
  doc.text(`Phone: ${client.phone}`, 15, 58);
  doc.text(`Email: ${client.email}`, 15, 64);
  
  // Event Details Section
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.text("EVENT SUMMARY:", 15, 76);
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Event Name: ${event.name}`, 15, 83);
  doc.text(`Venue: ${event.venue}`, 15, 89);
  doc.text(`Event Date: ${event.date}`, 15, 95);
  doc.text(`Status: ${event.status.toUpperCase()}`, 15, 101);
  
  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 108, 195, 108);
  
  // Table Headers
  doc.setFont("Helvetica", "bold");
  doc.text("Billing Component", 15, 115);
  doc.text("Amount", 195, 115, { align: "right" });
  doc.line(15, 118, 195, 118);
  
  // Row 1: Contract Value
  doc.setFont("Helvetica", "normal");
  doc.text("Event Contract Base Value", 15, 125);
  doc.text(`INR ${event.budget.toLocaleString('en-IN')}.00`, 195, 125, { align: "right" });
  doc.line(15, 128, 195, 128);
  
  // Row 2: Payments Made (Credits)
  doc.text("Payments Logged (Credits)", 15, 135);
  doc.text(`INR ${totalPaid.toLocaleString('en-IN')}.00`, 195, 135, { align: "right" });
  doc.line(15, 138, 195, 138);
  
  // Final Balance Box
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 145, 180, 20, 'F');
  doc.setFont("Helvetica", "bold");
  doc.text("OUTSTANDING BALANCE DUE:", 20, 157);
  doc.text(`INR ${outstanding.toLocaleString('en-IN')}.00`, 190, 157, { align: "right" });
  
  // Payment Breakdown
  if (payments.length > 0) {
    doc.setFontSize(11);
    doc.text("Transaction History:", 15, 178);
    doc.setFontSize(9);
    doc.setFont("Helvetica", "normal");
    
    let yPos = 186;
    payments.forEach((p, idx) => {
      doc.text(`${idx + 1}. Date: ${p.date}  |  Amount: INR ${p.amount.toLocaleString('en-IN')}.00`, 15, yPos);
      yPos += 7;
    });
  }
  
  doc.setFont("Helvetica", "italic");
  doc.setFontSize(8);
  doc.text("Note: This is a system generated statement. Please verify with manager for official signatures.", 15, 260);
  doc.text("Contact support at: billing@aerosky.com | Thank you for choosing Aerosky Hospitality.", 15, 265);
  
  doc.save(`Aerosky_Invoice_${event.id}.pdf`);
  logActivity("GENERATE_INVOICE", "events", event.id, { clientName: client.name, budget: event.budget });
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
async function loadDatabase() {
  if (!supabaseClient) {
    console.error("Supabase client not initialized!");
    return;
  }
  
  try {
    // Fetch data from all tables in parallel using Promise.all (activity logs limited to 100)
    const [
      clientsRes,
      eventsRes,
      serviceBoysRes,
      vendorsRes,
      assignmentsRes,
      vendorOrdersRes,
      paymentsRes,
      issuesRes,
      checklistRes,
      activityLogsRes,
      inquiriesRes
    ] = await Promise.all([
      supabaseClient.from('clients').select('*'),
      supabaseClient.from('events').select('*'),
      supabaseClient.from('service_boys').select('*'),
      supabaseClient.from('vendors').select('*'),
      supabaseClient.from('assignments').select('*'),
      supabaseClient.from('vendor_orders').select('*'),
      supabaseClient.from('payments').select('*'),
      supabaseClient.from('issues').select('*'),
      supabaseClient.from('checklist').select('*'),
      supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseClient.from('inquiries').select('*')
    ]);

    // Handle any fetch errors
    if (clientsRes.error) console.error("Error fetching clients:", clientsRes.error);
    if (eventsRes.error) console.error("Error fetching events:", eventsRes.error);
    if (serviceBoysRes.error) console.error("Error fetching service_boys:", serviceBoysRes.error);
    if (vendorsRes.error) console.error("Error fetching vendors:", vendorsRes.error);
    if (assignmentsRes.error) console.error("Error fetching assignments:", assignmentsRes.error);
    if (vendorOrdersRes.error) console.error("Error fetching vendor_orders:", vendorOrdersRes.error);
    if (paymentsRes.error) console.error("Error fetching payments:", paymentsRes.error);
    if (issuesRes.error) console.error("Error fetching issues:", issuesRes.error);
    if (checklistRes.error) console.error("Error fetching checklist:", checklistRes.error);
    if (activityLogsRes && activityLogsRes.error) console.error("Error fetching activity_logs:", activityLogsRes.error);
    if (inquiriesRes && inquiriesRes.error) console.error("Error fetching inquiries:", inquiriesRes.error);

    // Save fetched arrays directly to local memory cache db
    db.clients = clientsRes.data || [];
    db.events = eventsRes.data || [];
    db.serviceBoys = serviceBoysRes.data || [];
    db.vendors = vendorsRes.data || [];
    db.assignments = assignmentsRes.data || [];
    db.vendorOrders = vendorOrdersRes.data || [];
    db.payments = paymentsRes.data || [];
    db.issues = issuesRes.data || [];
    db.checklist = checklistRes.data || [];
    db.activityLogs = activityLogsRes ? (activityLogsRes.data || []) : [];
    db.inquiries = inquiriesRes ? (inquiriesRes.data || []) : [];

    // Map database properties (e.g. description -> desc) if there's any naming variation
    db.vendorOrders = db.vendorOrders.map(vo => ({
      id: vo.id,
      vendorId: vo.vendor_id,
      eventId: vo.event_id,
      desc: vo.description,
      price: parseFloat(vo.price) || 0
    }));

    db.events = db.events.map(e => ({
      id: e.id,
      name: e.name,
      date: e.date,
      venue: e.venue,
      clientId: e.client_id,
      status: e.status,
      budget: parseFloat(e.budget) || 0,
      latitude: parseFloat(e.latitude) || null,
      longitude: parseFloat(e.longitude) || null,
      menuText: e.menu_text || null,
      menuFileData: e.menu_file_data || null,
      menuFileName: e.menu_file_name || null
    }));

    db.activityLogs = db.activityLogs.map(al => ({
      id: al.id,
      userId: al.user_id,
      userName: al.user_name,
      role: al.role,
      action: al.action,
      targetTable: al.target_table,
      recordId: al.record_id,
      details: al.details,
      createdAt: al.created_at
    }));

    db.assignments = db.assignments.map(a => ({
      id: a.id,
      serviceBoyId: a.service_boy_id,
      eventId: a.event_id,
      role: a.role,
      daysWorked: parseInt(a.days_worked) || 1,
      status: a.status
    }));

    db.payments = db.payments.map(p => ({
      id: p.id,
      eventId: p.event_id,
      amount: parseFloat(p.amount) || 0,
      type: p.type,
      entityId: p.entity_id,
      date: p.date
    }));

    db.issues = db.issues.map(i => ({
      id: i.id,
      eventId: i.event_id,
      clientId: i.client_id,
      desc: i.description,
      images: i.images || [],
      status: i.status,
      date: i.date
    }));

    db.inquiries = db.inquiries.map(inq => ({
      id: inq.id,
      name: inq.name,
      phone: inq.phone,
      email: inq.email,
      eventType: inq.event_type,
      date: inq.date,
      venue: inq.venue,
      budget: parseFloat(inq.budget) || 0,
      status: inq.status,
      createdAt: inq.created_at
    }));

    // If checklist table is completely empty in Supabase, seed the default list items
    if (db.checklist.length === 0) {
      const seedItems = defaultChecklist.map(item => ({
        id: item.id,
        label: item.label,
        tag: item.tag,
        checked: false
      }));
      await supabaseClient.from('checklist').insert(seedItems);
      db.checklist = seedItems;
    }

  } catch (err) {
    console.error("Failed to sync database from Supabase:", err);
  }
}

function saveDatabase() {
  // Database state is persisted to Supabase in real-time
}

// --- App Navigation & Setup Router ---
let activeTab = "overview";
let activeAssignEventId = ""; // Track context event inside operations modal
let activeAssignTab = "tab-staff-assign";
let tempIssueImages = []; // Hold uploaded issue base64 strings

document.addEventListener("DOMContentLoaded", async () => {
  // Load database from Supabase
  await loadDatabase();

  // Initialize Elements & UI Bindings
  initAppNavigation();
  initFormSubmissions();
  initModalsClose();
  initChecklistTrigger();
  initLoginHandlers();
  initChatbot();
  
  // Check auth session
  checkAuthSession();

  // Toggle Custom Role input field in Add Staff modal
  const staffRoleSelect = document.getElementById("staff-role");
  if (staffRoleSelect) {
    staffRoleSelect.addEventListener("change", (e) => {
      const customGroup = document.getElementById("staff-role-custom-group");
      const customInput = document.getElementById("staff-role-custom");
      if (customGroup && customInput) {
        if (e.target.value === "custom") {
          customGroup.style.display = "block";
          customInput.required = true;
        } else {
          customGroup.style.display = "none";
          customInput.required = false;
          customInput.value = "";
        }
      }
    });
  }

  // Toggle Custom Role input field in Assign Staff modal
  const assignStaffRoleSelect = document.getElementById("assign-staff-role");
  if (assignStaffRoleSelect) {
    assignStaffRoleSelect.addEventListener("change", (e) => {
      const customGroup = document.getElementById("assign-staff-role-custom-group");
      const customInput = document.getElementById("assign-staff-role-custom");
      if (customGroup && customInput) {
        if (e.target.value === "custom") {
          customGroup.style.display = "block";
          customInput.required = true;
          customInput.focus();
        } else {
          customGroup.style.display = "none";
          customInput.required = false;
          customInput.value = "";
        }
      }
    });
  }

  // Toggle Crew Portal tabs inside Service Boy Portal
  const sbTabButtons = document.querySelectorAll("[data-sb-tab]");
  const sbPanels = document.querySelectorAll(".sb-panel");
  sbTabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sbTabButtons.forEach(b => {
        b.classList.remove("active");
        b.style.borderColor = "var(--border-color)";
        b.style.background = "var(--bg-card)";
      });
      btn.classList.add("active");
      btn.style.borderColor = "var(--brand-gold)";
      btn.style.background = "var(--bg-panel)";
      
      const tabVal = btn.dataset.sbTab;
      sbPanels.forEach(panel => {
        if (panel.id === `sb-panel-${tabVal}`) {
          panel.style.display = "block";
        } else {
          panel.style.display = "none";
        }
      });
    });
  });

  // Initialize Real-time event notifications for Admin
  if (supabaseClient) {
    supabaseClient.channel('enterprise-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'issues' }, async (payload) => {
        const issue = payload.new;
        await loadDatabase();
        renderAllViews();
        
        if (loggedInUser && loggedInUser.role === 'admin') {
          const clientName = db.clients.find(c => c.id === issue.client_id)?.name || "Client";
          const eventName = db.events.find(e => e.id === issue.event_id)?.name || "Event";
          showToast(
            `Support Ticket Filed!`,
            `${clientName} reported for "${eventName}": ${issue.description}`,
            `warning`
          );
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, async (payload) => {
        const payment = payload.new;
        await loadDatabase();
        renderAllViews();
        
        if (loggedInUser && loggedInUser.role === 'admin') {
          let source = "Transaction";
          if (payment.type === 'client') {
            const clientName = db.clients.find(c => c.id === payment.entity_id)?.name || "Client";
            source = `Client ${clientName}`;
          } else if (payment.type === 'vendor') {
            const vendorName = db.vendors.find(v => v.id === payment.entity_id)?.name || "Vendor";
            source = `Vendor ${vendorName}`;
          } else if (payment.type === 'staff') {
            const staffName = db.serviceBoys.find(s => s.id === payment.entity_id)?.name || "Staff";
            source = `Staff ${staffName}`;
          }
          
          const label = payment.type === 'client' ? 'Payment Received' : 'Payout Logged';
          const type = payment.type === 'client' ? 'success' : 'info';
          showToast(
            `${label}!`,
            `₹${parseFloat(payment.amount).toLocaleString('en-IN')} logged for ${source}.`,
            type
          );
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inquiries' }, async (payload) => {
        const inquiry = payload.new;
        await loadDatabase();
        renderAllViews();
        
        if (loggedInUser && loggedInUser.role === 'admin') {
          showToast(
            `New Booking Inquiry!`,
            `${inquiry.name} has sent an inquiry for a ${inquiry.event_type || 'event'}.`,
            `info`
          );
        }
      })
      .subscribe();
  }
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

// Extract first 6 numbers from Service Boy phone number as password
function getServiceBoyPassword(phone) {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, ""); // extract all digits
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.substring(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.substring(1);
  }
  return digits.substring(0, 6);
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

    activeTempUser = account;
    let phoneNumber = account.phone;

    if (!phoneNumber) {
      alert("Error: No phone number linked to this profile.");
      return;
    }

    // Ensure +91 country code prefix is present for Firebase SMS OTP delivery
    if (phoneNumber && !phoneNumber.startsWith("+")) {
      const localDigits = phoneNumber.replace(/\D/g, "").slice(-10);
      phoneNumber = "+91" + localDigits;
    }

    // Bypass Firebase OTP for Admin, Vendors, and Service Boys
    if (account.role === "service_boy" || account.role === "vendor" || account.role === "admin") {
      document.getElementById("login-credentials-section").style.display = "none";
      document.getElementById("login-otp-section").style.display = "block";
      
      const label = document.querySelector("#login-otp-section label");
      const subtext = document.getElementById("otp-phone-subtext");
      const verifyBtn = document.getElementById("btn-verify-otp");
      const otpInput = document.getElementById("login-otp");
      
      if (account.role === "admin") {
        if (label) label.textContent = "Enter Admin Password";
        if (subtext) subtext.textContent = "Please enter your administrator password.";
        if (otpInput) {
          otpInput.removeAttribute("maxlength");
          otpInput.placeholder = "Enter password";
          otpInput.type = "password";
        }
      } else {
        if (label) label.textContent = "Enter 6-Digit Password";
        if (subtext) subtext.textContent = "Please enter your 6-digit login password (the first 6 digits of your phone number).";
        if (otpInput) {
          otpInput.setAttribute("maxlength", "6");
          otpInput.placeholder = "e.g. 123456";
          otpInput.type = "text";
        }
      }
      
      if (verifyBtn) verifyBtn.innerHTML = `<i class="ti ti-circle-check"></i> Verify Password & Log In`;
      return;
    }

    // Normal Firebase SMS OTP verification flow (Clients only)
    const label = document.querySelector("#login-otp-section label");
    if (label) label.textContent = "Enter 6-Digit OTP Code";
    
    const subtext = document.getElementById("otp-phone-subtext");
    if (subtext) subtext.textContent = "An SMS with the OTP has been sent to your registered mobile phone.";
    
    const verifyBtn = document.getElementById("btn-verify-otp");
    if (verifyBtn) verifyBtn.innerHTML = `<i class="ti ti-circle-check"></i> Verify OTP & Log In`;

    const otpInput = document.getElementById("login-otp");
    if (otpInput) {
      otpInput.setAttribute("maxlength", "6");
      otpInput.placeholder = "e.g. 123456";
      otpInput.type = "text";
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

  // Verify OTP / Password button
  document.getElementById("btn-verify-otp").addEventListener("click", () => {
    const code = document.getElementById("login-otp").value.trim();
    
    if (activeTempUser && (activeTempUser.role === "service_boy" || activeTempUser.role === "vendor" || activeTempUser.role === "admin")) {
      if (!code) {
        alert("Please enter your password!");
        return;
      }
    } else {
      if (code.length !== 6) {
        alert("Please enter a valid 6-digit OTP code!");
        return;
      }
    }

    const verifyBtn = document.getElementById("btn-verify-otp");
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<i class="ti ti-loader" style="animation: spin 1s linear infinite;"></i> Verifying...`;

    // Direct password check client-side for Admin, Vendors, and Service Boys
    if (activeTempUser && (activeTempUser.role === "service_boy" || activeTempUser.role === "vendor" || activeTempUser.role === "admin")) {
      let expectedPassword = "";
      if (activeTempUser.role === "admin") {
        expectedPassword = activeTempUser.password || "admin123";
      } else {
        expectedPassword = getServiceBoyPassword(activeTempUser.phone);
      }

      if (code === expectedPassword) {
        loggedInUser = activeTempUser;
        sessionStorage.setItem("aerosky_logged_in_user", JSON.stringify(loggedInUser));
        
        // Reset password fields attributes
        const otpInput = document.getElementById("login-otp");
        if (otpInput) {
          otpInput.setAttribute("maxlength", "6");
          otpInput.placeholder = "e.g. 123456";
          otpInput.type = "text";
        }
        
        document.getElementById("login-credentials-section").style.display = "block";
        document.getElementById("login-otp-section").style.display = "none";
        document.getElementById("login-otp").value = "";
        form.reset();
        
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = `<i class="ti ti-circle-check"></i> Verify OTP & Log In`;
        
        loginSuccess(loggedInUser);
      } else {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = `<i class="ti ti-circle-check"></i> Verify Password & Log In`;
        alert("Incorrect password! Please try again.");
      }
      return;
    }

    // Normal Firebase OTP Confirm for clients
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
    
    // Restore default attributes
    const otpInput = document.getElementById("login-otp");
    if (otpInput) {
      otpInput.setAttribute("maxlength", "6");
      otpInput.placeholder = "e.g. 123456";
      otpInput.type = "text";
    }
    
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

  // Hide chatbot widget when logged in
  const chatbotWidget = document.getElementById("chatbot-widget");
  if (chatbotWidget) {
    chatbotWidget.style.display = "none";
  }

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
    
    // Reset active service boy tab to Home
    const homeTabBtn = document.getElementById("tab-sb-home");
    if (homeTabBtn) {
      homeTabBtn.click();
    }
    
    loadServiceBoyPortalView();
  }
}

function logoutSuccess() {
  document.getElementById("login-screen").classList.add("active");
  document.body.classList.add("logged-out");

  // Show chatbot widget when logged out
  const chatbotWidget = document.getElementById("chatbot-widget");
  if (chatbotWidget) {
    chatbotWidget.style.display = "block";
    resetChatbot();
  }
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
      
      if (activeTab === "activity-logs") {
        renderActivityLogsTab();
      } else if (activeTab === "leads") {
        renderLeadsTab();
      }
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
    div.addEventListener("click", async (e) => {
      if (e.target.tagName !== "INPUT") {
        const chk = div.querySelector("input");
        chk.checked = !chk.checked;
      }
      item.checked = !item.checked;
      try {
        await supabaseClient.from('checklist').update({ checked: item.checked }).eq('id', item.id);
        renderChecklistProgress();
      } catch (err) {
        console.error("Failed to update checklist in Supabase:", err);
      }
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
    const client = db.clients.find(c => c.id === e.clientId) || { name: "", phone: "" };
    const matchSearch = e.name.toLowerCase().includes(searchVal) || 
                        e.venue.toLowerCase().includes(searchVal) ||
                        client.name.toLowerCase().includes(searchVal) ||
                        client.phone.toLowerCase().includes(searchVal);
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
      <td class="text-right" style="white-space: nowrap;">
        <button class="btn btn-secondary btn-sm btn-manage-ops" data-id="${e.id}"><i class="ti ti-settings"></i> Ops</button>
        <button class="btn ${(e.menuText || e.menuFileData) ? 'btn-primary' : 'btn-secondary'} btn-sm btn-event-menu" data-id="${e.id}" title="${(e.menuText || e.menuFileData) ? 'Menu attached ✓' : 'Add/Edit Menu'}"><i class="ti ti-tools-kitchen-2"></i> Menu${(e.menuText || e.menuFileData) ? ' ✓' : ''}</button>
        <button class="btn btn-secondary btn-sm btn-generate-invoice" data-id="${e.id}"><i class="ti ti-file-text"></i> Invoice</button>
        <button class="btn btn-danger btn-sm btn-delete-event" data-id="${e.id}"><i class="ti ti-trash"></i> Delete</button>
      </td>
    `;
    
    // Status Change
    tr.querySelector(".event-status-toggle").addEventListener("change", async (event) => {
      const oldStatus = e.status;
      e.status = event.target.value;
      try {
        await supabaseClient.from('events').update({ status: e.status }).eq('id', e.id);
        logActivity("UPDATE_EVENT_STATUS", "events", e.id, { oldStatus, newStatus: e.status, eventName: e.name });
        renderAllViews();
      } catch (err) {
        console.error("Failed to update event status in Supabase:", err);
      }
    });
    
    // Manage Operations click
    tr.querySelector(".btn-manage-ops").addEventListener("click", () => {
      openOperationsModal(e.id);
    });
    
    // Menu Management click
    tr.querySelector(".btn-event-menu").addEventListener("click", () => {
      openMenuModal(e.id);
    });
    
    // Generate Invoice click
    tr.querySelector(".btn-generate-invoice").addEventListener("click", () => {
      generateInvoicePDF(e.id);
    });

    // Delete Event click
    tr.querySelector(".btn-delete-event").addEventListener("click", async () => {
      const confirmDelete = confirm(`Are you sure you want to permanently delete the event "${e.name}"? This will also remove all assignments, payments, and expenses linked to it.`);
      if (!confirmDelete) return;
      
      try {
        await Promise.all([
          supabaseClient.from('assignments').delete().eq('event_id', e.id),
          supabaseClient.from('vendor_orders').delete().eq('event_id', e.id),
          supabaseClient.from('payments').delete().eq('event_id', e.id),
          supabaseClient.from('issues').delete().eq('event_id', e.id)
        ]);
        
        const { error } = await supabaseClient.from('events').delete().eq('id', e.id);
        if (error) throw error;
        
        logActivity("DELETE_EVENT", "events", e.id, { eventName: e.name });
        showToast("Success", `Event "${e.name}" deleted successfully.`, "success");
        await loadDatabase();
        renderAllViews();
      } catch (err) {
        console.error("Failed to delete event:", err);
        showToast("Error", "Failed to delete event.", "danger");
      }
    });
    
    tbody.appendChild(tr);
  });
}

// Search triggers
document.getElementById("search-events").addEventListener("input", renderEventsTab);
document.getElementById("filter-event-status").addEventListener("change", renderEventsTab);

// --- Event Menu Management ---
let currentMenuEventId = null;
let pendingMenuFile = null; // { name, size, dataUrl }

function openMenuModal(eventId) {
  currentMenuEventId = eventId;
  pendingMenuFile = null;
  
  const evt = db.events.find(e => e.id === eventId);
  if (!evt) return;
  
  // Set title
  document.getElementById("menu-event-title").textContent = `Event: ${evt.name} — ${evt.date}`;
  
  // Reset input area
  document.getElementById("menu-text-input").value = "";
  document.getElementById("menu-file-input").value = "";
  document.getElementById("menu-file-selected").style.display = "none";
  
  // Check if menu already exists
  const hasText = evt.menuText && evt.menuText.trim();
  const hasFile = evt.menuFileData && evt.menuFileName;
  
  if (hasText || hasFile) {
    // Show current menu
    document.getElementById("menu-current-display").style.display = "block";
    document.getElementById("menu-input-area").style.display = "none";
    
    if (hasFile) {
      document.getElementById("menu-file-preview").style.display = "block";
      document.getElementById("menu-file-name").textContent = evt.menuFileName;
      document.getElementById("menu-file-size").textContent = "Uploaded file";
      document.getElementById("menu-text-preview").style.display = "none";
    } else {
      document.getElementById("menu-file-preview").style.display = "none";
    }
    
    if (hasText) {
      document.getElementById("menu-text-preview").style.display = "block";
      document.getElementById("menu-text-preview").querySelector("div").textContent = evt.menuText;
    } else {
      document.getElementById("menu-text-preview").style.display = "none";
    }
  } else {
    // No menu yet — show input area
    document.getElementById("menu-current-display").style.display = "none";
    document.getElementById("menu-input-area").style.display = "block";
  }
  
  openModal("modal-menu");
}

// Dropzone click to open file picker
document.getElementById("menu-dropzone").addEventListener("click", () => {
  document.getElementById("menu-file-input").click();
});

// Drag & drop support
const dropzone = document.getElementById("menu-dropzone");
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.style.borderColor = "var(--brand-gold)";
  dropzone.style.background = "var(--brand-gold-glow)";
});
dropzone.addEventListener("dragleave", () => {
  dropzone.style.borderColor = "var(--border-color)";
  dropzone.style.background = "var(--bg-input)";
});
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.style.borderColor = "var(--border-color)";
  dropzone.style.background = "var(--bg-input)";
  if (e.dataTransfer.files.length > 0) {
    handleMenuFileSelect(e.dataTransfer.files[0]);
  }
});

// File input change
document.getElementById("menu-file-input").addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleMenuFileSelect(e.target.files[0]);
  }
});

function handleMenuFileSelect(file) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    showToast("Error", "File too large. Maximum size is 5MB.", "danger");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = () => {
    pendingMenuFile = {
      name: file.name,
      size: file.size,
      dataUrl: reader.result
    };
    
    document.getElementById("menu-file-selected").style.display = "block";
    document.getElementById("menu-selected-name").textContent = file.name + " (" + formatFileSize(file.size) + ")";
  };
  reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// Remove selected file
document.getElementById("btn-menu-remove-file").addEventListener("click", () => {
  pendingMenuFile = null;
  document.getElementById("menu-file-input").value = "";
  document.getElementById("menu-file-selected").style.display = "none";
});

// Download existing menu file
document.getElementById("btn-menu-download").addEventListener("click", () => {
  const evt = db.events.find(e => e.id === currentMenuEventId);
  if (!evt || !evt.menuFileData) return;
  
  const link = document.createElement("a");
  link.href = evt.menuFileData;
  link.download = evt.menuFileName || "menu-file";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Clear menu
document.getElementById("btn-menu-clear").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to remove the menu for this event?")) return;
  
  try {
    await supabaseClient.from('events').update({
      menu_text: null,
      menu_file_data: null,
      menu_file_name: null
    }).eq('id', currentMenuEventId);
    
    // Update local cache
    const evt = db.events.find(e => e.id === currentMenuEventId);
    if (evt) {
      evt.menuText = null;
      evt.menuFileData = null;
      evt.menuFileName = null;
    }
    
    showToast("Success", "Menu cleared successfully.", "success");
    logActivity("CLEAR_MENU", "events", currentMenuEventId, { eventName: evt ? evt.name : "" });
    closeModal("modal-menu");
    renderEventsTab();
  } catch (err) {
    console.error("Failed to clear menu:", err);
    showToast("Error", "Failed to clear menu.", "danger");
  }
});

// Save menu
document.getElementById("btn-save-menu").addEventListener("click", async () => {
  const menuText = document.getElementById("menu-text-input").value.trim();
  const hasFile = pendingMenuFile !== null;
  
  if (!menuText && !hasFile) {
    showToast("Warning", "Please upload a file or type the menu text.", "warning");
    return;
  }
  
  try {
    const updatePayload = {
      menu_text: menuText || null,
      menu_file_data: hasFile ? pendingMenuFile.dataUrl : null,
      menu_file_name: hasFile ? pendingMenuFile.name : null
    };
    
    const { error } = await supabaseClient.from('events').update(updatePayload).eq('id', currentMenuEventId);
    if (error) throw error;
    
    // Update local cache
    const evt = db.events.find(e => e.id === currentMenuEventId);
    if (evt) {
      evt.menuText = menuText || null;
      evt.menuFileData = hasFile ? pendingMenuFile.dataUrl : null;
      evt.menuFileName = hasFile ? pendingMenuFile.name : null;
    }
    
    showToast("Success", "Menu saved successfully!", "success");
    logActivity("SAVE_MENU", "events", currentMenuEventId, { eventName: evt ? evt.name : "", hasFile, hasText: !!menuText });
    closeModal("modal-menu");
    renderEventsTab();
  } catch (err) {
    console.error("Failed to save menu:", err);
    showToast("Error", "Failed to save menu. Make sure menu_text, menu_file_data, and menu_file_name columns exist in the events table.", "danger");
  }
});

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
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td><strong>${s.name}</strong><br><span style="font-size:10px;color:var(--text-muted);">ID: SB-${s.id.substr(-4).toUpperCase()}</span></td>
      <td>${s.phone}</td>
      <td><span class="badge badge-info">${s.role}</span></td>
      <td>₹${s.rate}/day</td>
      <td><span class="badge badge-indigo">${activeAssignments} events</span></td>
      <td><strong>₹${earnings.toLocaleString('en-IN')}</strong></td>
      <td class="text-right" style="white-space: nowrap;">
        <button class="btn btn-secondary btn-sm btn-view-staff-history" data-id="${s.id}"><i class="ti ti-history"></i> History</button>
        <button class="btn btn-secondary btn-sm btn-delete-staff" data-id="${s.id}"><i class="ti ti-trash"></i></button>
      </td>
    `;
    
    tr.addEventListener("click", (e) => {
      if (e.target.closest(".btn-delete-staff")) return;
      openStaffHistoryModal(s.id);
    });
    
    tr.querySelector(".btn-delete-staff").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Remove ${s.name} from directory?`)) {
        try {
          await supabaseClient.from('service_boys').delete().eq('id', s.id);
          logActivity("DELETE_STAFF", "service_boys", s.id, { name: s.name, role: s.role });
          await loadDatabase();
          renderAllViews();
        } catch (err) {
          console.error("Failed to delete staff in Supabase:", err);
        }
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
    
    tr.querySelector(".btn-delete-vendor").addEventListener("click", async () => {
      if (confirm(`Remove ${v.name} from vendors?`)) {
        try {
          await supabaseClient.from('vendors').delete().eq('id', v.id);
          logActivity("DELETE_VENDOR", "vendors", v.id, { name: v.name, category: v.category });
          await loadDatabase();
          renderAllViews();
        } catch (err) {
          console.error("Failed to delete vendor in Supabase:", err);
        }
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
    
    card.querySelector(".issue-action-select").addEventListener("change", async (e) => {
      i.status = e.target.value;
      try {
        await supabaseClient.from('issues').update({ status: i.status }).eq('id', i.id);
        renderAllViews();
      } catch (err) {
        console.error("Failed to update issue status in Supabase:", err);
      }
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
    tr.querySelector(".toggle-attendance-btn").addEventListener("click", async () => {
      const oldStatus = a.status;
      if (a.status === "assigned") a.status = "present";
      else if (a.status === "present") a.status = "absent";
      else a.status = "assigned";
      
      try {
        await supabaseClient.from('assignments').update({ status: a.status }).eq('id', a.id);
        logActivity("TOGGLE_ATTENDANCE", "assignments", a.id, { oldStatus, newStatus: a.status, staffName: s.name, eventId: activeAssignEventId });
        renderAllViews();
        loadStaffAssignmentView();
      } catch (err) {
        console.error("Failed to toggle attendance in Supabase:", err);
      }
    });

    // Delete assignment
    tr.querySelector(".btn-delete-assignment").addEventListener("click", async () => {
      try {
        await supabaseClient.from('assignments').delete().eq('id', a.id);
        logActivity("DELETE_ASSIGNMENT", "assignments", a.id, { staffName: s.name, eventId: activeAssignEventId });
        await loadDatabase();
        renderAllViews();
        loadStaffAssignmentView();
      } catch (err) {
        console.error("Failed to delete assignment in Supabase:", err);
      }
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
    
    tr.querySelector(".btn-delete-vo").addEventListener("click", async () => {
      try {
        await supabaseClient.from('vendor_orders').delete().eq('id', vo.id);
        logActivity("DELETE_VENDOR_ORDER", "vendor_orders", vo.id, { vendorName: v.name, eventId: activeAssignEventId });
        await loadDatabase();
        renderAllViews();
        loadVendorAssignmentView();
      } catch (err) {
        console.error("Failed to delete vendor order in Supabase:", err);
      }
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
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="badge badge-${e.status === 'completed' ? 'success' : e.status === 'confirmed' ? 'indigo' : 'warning'}">${e.status}</span>
          <button class="btn btn-secondary btn-sm btn-client-download-invoice" data-id="${e.id}" style="padding: 4px 8px; font-size: 11px; display: flex; align-items: center; gap: 4px; border: 1px solid var(--brand-gold); color: var(--brand-gold);">
            <i class="ti ti-download"></i> Invoice
          </button>
        </div>
      </div>
      <div class="client-event-meta">
        <span><i class="ti ti-map-pin"></i> <strong>Venue:</strong> ${e.venue}</span>
        <span><i class="ti ti-calendar"></i> <strong>Schedule:</strong> ${e.date}</span>
      </div>
    `;
    
    pane.querySelector(".btn-client-download-invoice").addEventListener("click", () => {
      generateInvoicePDF(e.id);
    });
    
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

// --- Service Boy Portal View (Crew Check-In, Schedule & Payouts) ---
function loadServiceBoyPortalView() {
  if (!loggedInUser || loggedInUser.role !== "service_boy") return;
  const staffId = loggedInUser.id;

  const staff = db.serviceBoys.find(s => s.id === staffId);
  if (!staff) return;

  // Update portal title
  const portalTitle = document.getElementById("sb-portal-title");
  if (portalTitle) portalTitle.textContent = `${staff.name}'s Portal`;

  // All assignments for this staff member
  const myAssignments = db.assignments.filter(a => a.serviceBoyId === staffId);
  const presentAssignments = myAssignments.filter(a => a.status === "present");
  const pendingAssignments = myAssignments.filter(a => a.status === "assigned");

  const presentCount = presentAssignments.length;
  const totalEarned = presentAssignments.reduce((sum, a) => sum + (a.daysWorked * staff.rate), 0);
  const pendingCount = pendingAssignments.length;

  // --- HOME TAB: Metrics ---
  const rateVal    = document.getElementById("sb-rate-val");
  const daysVal    = document.getElementById("sb-days-val");
  const totalVal   = document.getElementById("sb-total-val");
  const pendingVal = document.getElementById("sb-pending-val");

  if (rateVal)    rateVal.textContent    = "₹" + staff.rate.toLocaleString('en-IN');
  if (daysVal)    daysVal.textContent    = presentCount;
  if (totalVal)   totalVal.textContent   = "₹" + totalEarned.toLocaleString('en-IN');
  if (pendingVal) pendingVal.textContent = pendingCount;

  // --- ATTENDANCE TAB: Event Dropdown ---
  const eventSelect = document.getElementById("sb-attend-event-select");
  if (eventSelect) {
    eventSelect.innerHTML = `<option value="">-- Choose an event --</option>`;

    // Show ALL assigned events (both pending and already present — so they can see status)
    myAssignments.forEach(a => {
      const ev = db.events.find(x => x.id === a.eventId);
      if (!ev) return;
      const label = a.status === "present"
        ? `${ev.name} (${ev.date}) ✓ Already Marked`
        : `${ev.name} (${ev.date}) — Pending`;
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = label;
      eventSelect.appendChild(opt);
    });

    // Elements inside attendance panel
    const preview      = document.getElementById("sb-attend-event-preview");
    const alreadyBox   = document.getElementById("sb-attend-already-marked");
    const markBtn      = document.getElementById("btn-sb-mark-attend");
    const gpsFeedback  = document.getElementById("sb-gps-feedback");

    const resetAttendancePanel = () => {
      if (preview)     preview.style.display     = "none";
      if (alreadyBox)  alreadyBox.style.display  = "none";
      if (markBtn)     markBtn.style.display      = "none";
      if (gpsFeedback) { gpsFeedback.style.display = "none"; gpsFeedback.textContent = ""; }
    };

    // On dropdown change → update preview card
    eventSelect.onchange = () => {
      resetAttendancePanel();
      const assignId = eventSelect.value;
      if (!assignId) return;

      const assignment = myAssignments.find(a => a.id === assignId);
      if (!assignment) return;
      const ev = db.events.find(x => x.id === assignment.eventId);
      if (!ev) return;

      // Fill preview fields
      const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setTxt("sb-preview-name",  ev.name);
      setTxt("sb-preview-date",  ev.date);
      setTxt("sb-preview-venue", ev.venue);
      setTxt("sb-preview-role",  assignment.role);

      const hasCoords = ev.latitude != null && ev.longitude != null && !isNaN(ev.latitude) && !isNaN(ev.longitude);
      const gpsEl = document.getElementById("sb-preview-gps");
      if (gpsEl) {
        gpsEl.textContent = hasCoords ? "Required (GPS enabled)" : "Not Required (No coords set)";
        gpsEl.style.color = hasCoords ? "var(--brand-gold)" : "var(--text-muted)";
      }

      const statusEl = document.getElementById("sb-preview-status");
      if (statusEl) {
        const badgeColor = assignment.status === "present" ? "#22c55e" : assignment.status === "absent" ? "#ef4444" : "#f59e0b";
        statusEl.innerHTML = `<span style="font-weight:700; color:${badgeColor};">${assignment.status.toUpperCase()}</span>`;
      }

      if (preview) preview.style.display = "block";

      // Already present — show green notice, hide button
      if (assignment.status === "present") {
        if (alreadyBox) alreadyBox.style.display = "block";
        if (markBtn)    markBtn.style.display      = "none";
        return;
      }

      // Pending — show the mark attendance button
      if (markBtn) {
        markBtn.style.display = "block";
        markBtn.disabled = false;
        markBtn.innerHTML = `<i class="ti ti-map-pin-check"></i>&nbsp; Verify Location &amp; Mark Present`;

        // Remove any previously attached click handler
        markBtn.onclick = null;

        markBtn.onclick = async () => {
          if (gpsFeedback) {
            gpsFeedback.style.display = "block";
            gpsFeedback.style.background = "rgba(197,155,39,0.1)";
            gpsFeedback.style.border = "1px solid rgba(197,155,39,0.3)";
            gpsFeedback.style.color = "var(--brand-gold)";
            gpsFeedback.innerHTML = `<i class="ti ti-loader" style="animation:spin 1s linear infinite;"></i>&nbsp; Fetching your GPS location...`;
          }
          markBtn.disabled = true;
          markBtn.innerHTML = `<i class="ti ti-loader" style="animation:spin 1s linear infinite;"></i>&nbsp; Verifying...`;

          if (!navigator.geolocation) {
            showGpsFeedback("error", "Geolocation is not supported by your browser.");
            markBtn.disabled = false;
            markBtn.innerHTML = `<i class="ti ti-map-pin-check"></i>&nbsp; Verify Location &amp; Mark Present`;
            return;
          }

          const proceedCheckin = async (verificationDetails) => {
            assignment.status = "present";
            try {
              await supabaseClient.from('assignments').update({ status: 'present' }).eq('id', assignment.id);
              logActivity("STAFF_CHECKIN", "assignments", assignment.id, {
                serviceBoyId: staffId,
                eventId: assignment.eventId,
                verification: verificationDetails
              });
              await loadDatabase();
              showGpsFeedback("success", `✓ Attendance marked successfully! ${verificationDetails}`);
              markBtn.style.display = "none";
              if (alreadyBox) alreadyBox.style.display = "block";
              loadServiceBoyPortalView();
              renderAllViews();
            } catch (err) {
              console.error("Check-in failed:", err);
              showGpsFeedback("error", "Failed to save attendance. Please try again.");
              markBtn.disabled = false;
              markBtn.innerHTML = `<i class="ti ti-map-pin-check"></i>&nbsp; Verify Location &amp; Mark Present`;
            }
          };

          const showGpsFeedback = (type, msg) => {
            if (!gpsFeedback) return;
            gpsFeedback.style.display = "block";
            if (type === "success") {
              gpsFeedback.style.background = "rgba(34,197,94,0.08)";
              gpsFeedback.style.border = "1px solid rgba(34,197,94,0.3)";
              gpsFeedback.style.color = "#22c55e";
            } else if (type === "error") {
              gpsFeedback.style.background = "rgba(239,68,68,0.08)";
              gpsFeedback.style.border = "1px solid rgba(239,68,68,0.3)";
              gpsFeedback.style.color = "#ef4444";
            } else {
              gpsFeedback.style.background = "rgba(197,155,39,0.08)";
              gpsFeedback.style.border = "1px solid rgba(197,155,39,0.3)";
              gpsFeedback.style.color = "var(--brand-gold)";
            }
            gpsFeedback.textContent = msg;
          };

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const userLat = position.coords.latitude;
              const userLng = position.coords.longitude;

              const hasCoords = ev.latitude != null && ev.longitude != null && !isNaN(ev.latitude) && !isNaN(ev.longitude);
              if (!hasCoords) {
                await proceedCheckin("Bypassed GPS (No venue coordinates set for this event)");
                return;
              }

              const distance = calculateDistance(userLat, userLng, ev.latitude, ev.longitude);

              if (distance <= 100) {
                await proceedCheckin(`GPS Verified — ${Math.round(distance)}m from venue`);
              } else {
                showGpsFeedback("error", `✗ Check-in failed. You are ${Math.round(distance)}m away from the venue. You must be within 100m.`);
                logActivity("CHECKIN_FAILED_GPS", "assignments", assignment.id, {
                  serviceBoyId: staffId,
                  eventId: ev.id,
                  distance: `${Math.round(distance)}m`,
                  userCoords: { latitude: userLat, longitude: userLng },
                  eventCoords: { latitude: ev.latitude, longitude: ev.longitude }
                });
                markBtn.disabled = false;
                markBtn.innerHTML = `<i class="ti ti-map-pin-check"></i>&nbsp; Verify Location &amp; Mark Present`;
              }
            },
            (error) => {
              let errMsg = "Unable to retrieve your location. Check device location permissions.";
              if (error.code === error.PERMISSION_DENIED) errMsg = "Location permission denied. Please allow location access.";
              showGpsFeedback("error", "✗ " + errMsg);
              markBtn.disabled = false;
              markBtn.innerHTML = `<i class="ti ti-map-pin-check"></i>&nbsp; Verify Location &amp; Mark Present`;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        };
      }
    };
  }

  // --- SCHEDULE TAB: Table ---
  const scheduleTbody = document.getElementById("sb-table-schedule-body");
  if (scheduleTbody) {
    scheduleTbody.innerHTML = "";
    if (myAssignments.length === 0) {
      scheduleTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No duties assigned.</td></tr>`;
    } else {
      myAssignments.forEach(a => {
        const e = db.events.find(x => x.id === a.eventId) || { name: "Removed Event", venue: "N/A", date: "N/A" };
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${e.name}</strong></td>
          <td>${e.date}</td>
          <td>${e.venue}</td>
          <td>${a.role}</td>
          <td>${a.daysWorked} days</td>
          <td><span class="badge badge-${a.status === 'present' ? 'success' : a.status === 'absent' ? 'danger' : 'warning'}">${a.status.toUpperCase()}</span></td>
        `;
        scheduleTbody.appendChild(tr);
      });
    }
  }

  // --- PAYOUTS TAB: Table ---
  const payoutsTbody = document.getElementById("sb-table-payouts-body");
  if (payoutsTbody) {
    payoutsTbody.innerHTML = "";
    if (presentAssignments.length === 0) {
      payoutsTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No earnings logged yet.</td></tr>`;
    } else {
      presentAssignments.forEach(a => {
        const e = db.events.find(x => x.id === a.eventId) || { name: "Removed Event", date: "N/A" };
        const wage = a.daysWorked * staff.rate;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${e.name}</strong></td>
          <td>${e.date}</td>
          <td>${a.role}</td>
          <td>₹${staff.rate.toLocaleString('en-IN')}/day</td>
          <td>${a.daysWorked} days</td>
          <td><strong style="color:var(--brand-gold);">₹${wage.toLocaleString('en-IN')}</strong></td>
        `;
        payoutsTbody.appendChild(tr);
      });
    }
  }
}

// --- Global Form Submissions Handler ---
function initFormSubmissions() {
  // 1. Add Event & Client
  document.getElementById("form-add-event").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
    }
    
    const clientName = document.getElementById("event-client-name").value.trim();
    const clientPhone = document.getElementById("event-client-phone").value.trim();
    const clientEmail = document.getElementById("event-client-email").value.trim();
    
    const eventId = 'e-' + Date.now();
    const eventName = document.getElementById("event-name").value.trim();
    const eventDate = document.getElementById("event-date").value;
    const eventVenue = document.getElementById("event-venue").value.trim();
    const eventBudget = parseFloat(document.getElementById("event-budget").value) || 0;
    const eventLat = parseFloat(document.getElementById("event-latitude").value) || null;
    const eventLng = parseFloat(document.getElementById("event-longitude").value) || null;
    
    try {
      // Prevent duplication: check if client with this phone number already exists
      let finalClientId;
      const cleanPhone = cleanPhoneNumber(clientPhone);
      const existingClient = db.clients.find(c => cleanPhoneNumber(c.phone) === cleanPhone);
      
      if (existingClient) {
        finalClientId = existingClient.id;
      } else {
        finalClientId = 'c-' + Date.now();
        await supabaseClient.from('clients').insert({ id: finalClientId, name: clientName, phone: clientPhone, email: clientEmail });
        logActivity("REGISTER_CLIENT", "clients", finalClientId, { name: clientName, phone: clientPhone });
      }
      
      await supabaseClient.from('events').insert({
        id: eventId,
        name: eventName,
        date: eventDate,
        venue: eventVenue,
        client_id: finalClientId,
        status: "planning",
        budget: eventBudget,
        latitude: eventLat,
        longitude: eventLng
      });
      
      logActivity("CREATE_EVENT", "events", eventId, {
        eventName,
        clientName,
        venue: eventVenue,
        budget: eventBudget,
        coords: { latitude: eventLat, longitude: eventLng }
      });

      await loadDatabase();
      closeModal("modal-event");
      document.getElementById("form-add-event").reset();
      renderAllViews();
      alert("New Event added successfully!");
    } catch (err) {
      console.error("Failed to add event in Supabase:", err);
      alert("Failed to save event details.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });
  
  // 2. Add Service Boy
  document.getElementById("form-add-staff").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const staffId = 's-' + Date.now();
    const name = document.getElementById("staff-name").value.trim();
    const phone = document.getElementById("staff-phone").value.trim();
    let role = document.getElementById("staff-role").value;
    if (role === "custom") {
      role = document.getElementById("staff-role-custom").value.trim();
    }
    const rate = parseFloat(document.getElementById("staff-rate").value) || 0;
    
    try {
      await supabaseClient.from('service_boys').insert({ id: staffId, name: name, phone: phone, role: role, rate: rate });
      logActivity("REGISTER_STAFF", "service_boys", staffId, { name, role, rate });
      await loadDatabase();
      closeModal("modal-staff");
      document.getElementById("form-add-staff").reset();
      
      // Reset custom input state
      const customGroup = document.getElementById("staff-role-custom-group");
      const customInput = document.getElementById("staff-role-custom");
      if (customGroup && customInput) {
        customGroup.style.display = "none";
        customInput.required = false;
        customInput.value = "";
      }
      
      renderAllViews();
      alert("Staff member registered!");
    } catch (err) {
      console.error("Failed to add staff in Supabase:", err);
      alert("Failed to save crew details.");
    }
  });
  
  // 3. Add Vendor
  document.getElementById("form-add-vendor").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const vendorId = 'v-' + Date.now();
    const name = document.getElementById("vendor-name").value.trim();
    const category = document.getElementById("vendor-category").value;
    const phone = document.getElementById("vendor-phone").value.trim();
    const email = document.getElementById("vendor-email").value.trim();
    
    try {
      await supabaseClient.from('vendors').insert({ id: vendorId, name: name, category: category, phone: phone, email: email });
      logActivity("REGISTER_VENDOR", "vendors", vendorId, { name, category });
      await loadDatabase();
      closeModal("modal-vendor");
      document.getElementById("form-add-vendor").reset();
      renderAllViews();
      alert("Vendor registered!");
    } catch (err) {
      console.error("Failed to add vendor in Supabase:", err);
      alert("Failed to save vendor details.");
    }
  });
  
  // 4. Assign Staff to Event
  document.getElementById("form-assign-staff").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const staffId = document.getElementById("assign-staff-id").value;
    let role = document.getElementById("assign-staff-role").value;
    if (role === "custom") {
      role = document.getElementById("assign-staff-role-custom").value.trim();
    }
    const days = parseInt(document.getElementById("assign-staff-days").value) || 1;
    
    if (!staffId) return;
    
    const assignmentId = 'a-' + Date.now();
    try {
      await supabaseClient.from('assignments').insert({
        id: assignmentId,
        service_boy_id: staffId,
        event_id: activeAssignEventId,
        role: role,
        days_worked: days,
        status: "assigned"
      });
      const staffName = db.serviceBoys.find(s => s.id === staffId)?.name || "Staff";
      logActivity("ASSIGN_STAFF", "assignments", assignmentId, { staffName, role, eventId: activeAssignEventId });
      await loadDatabase();
      
      // Reset custom input state
      const customGroup = document.getElementById("assign-staff-role-custom-group");
      const customInput = document.getElementById("assign-staff-role-custom");
      if (customGroup && customInput) {
        customGroup.style.display = "none";
        customInput.required = false;
        customInput.value = "";
      }
      
      renderAllViews();
      loadStaffAssignmentView();
    } catch (err) {
      console.error("Failed to assign staff in Supabase:", err);
      alert("Failed to assign crew member.");
    }
  });
  
  // 5. Link Vendor to Event
  document.getElementById("form-assign-vendor").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const vendorId = document.getElementById("assign-vendor-id").value;
    const desc = document.getElementById("assign-vendor-desc").value.trim();
    const price = parseFloat(document.getElementById("assign-vendor-price").value) || 0;
    
    if (!vendorId) return;
    
    const orderId = 'vo-' + Date.now();
    try {
      await supabaseClient.from('vendor_orders').insert({
        id: orderId,
        vendor_id: vendorId,
        event_id: activeAssignEventId,
        description: desc,
        price: price
      });
      const vendorName = db.vendors.find(v => v.id === vendorId)?.name || "Vendor";
      logActivity("LINK_VENDOR", "vendor_orders", orderId, { vendorName, desc, price, eventId: activeAssignEventId });
      await loadDatabase();
      renderAllViews();
      loadVendorAssignmentView();
      document.getElementById("form-assign-vendor").reset();
    } catch (err) {
      console.error("Failed to link vendor in Supabase:", err);
      alert("Failed to link vendor.");
    }
  });
  
  // 6. Log Payouts / Payments
  document.getElementById("form-log-payment").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const type = document.getElementById("payment-target-type").value;
    const entityId = document.getElementById("payment-recipient-select").value;
    const amount = parseFloat(document.getElementById("payment-amount").value) || 0;
    
    if (!entityId) {
      alert("Invalid payment target!");
      return;
    }
    
    const paymentId = 'p-' + Date.now();
    try {
      await supabaseClient.from('payments').insert({
        id: paymentId,
        event_id: activeAssignEventId,
        amount: amount,
        type: type,
        entity_id: entityId,
        date: new Date().toISOString().split('T')[0]
      });
      
      let recipientName = "Unknown";
      if (type === "client") recipientName = db.clients.find(c => c.id === entityId)?.name || "Client";
      else if (type === "vendor") recipientName = db.vendors.find(v => v.id === entityId)?.name || "Vendor";
      else if (type === "staff") recipientName = db.serviceBoys.find(s => s.id === entityId)?.name || "Staff";
      
      logActivity("LOG_PAYMENT", "payments", paymentId, { type, amount, recipientName, eventId: activeAssignEventId });

      await loadDatabase();
      renderAllViews();
      loadPaymentsAssignmentView();
      document.getElementById("payment-amount").value = "";
      alert("Payment logged successfully!");
    } catch (err) {
      console.error("Failed to log payment in Supabase:", err);
      alert("Failed to record transaction details.");
    }
  });
  
  // 7. Client submits issue ticket
  document.getElementById("form-report-issue").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const eventId = document.getElementById("issue-event-id").value;
    const clientId = loggedInUser.id; // Enforce context ID
    const desc = document.getElementById("issue-description").value.trim();
    
    const issueId = 'i-' + Date.now();
    try {
      await supabaseClient.from('issues').insert({
        id: issueId,
        event_id: eventId,
        client_id: clientId,
        description: desc,
        images: [...tempIssueImages],
        status: "open",
        date: new Date().toISOString().split('T')[0]
      });
      
      logActivity("REPORT_ISSUE", "issues", issueId, { eventId, clientId, desc });

      await loadDatabase();
      tempIssueImages = [];
      document.getElementById("upload-thumbnails").innerHTML = "";
      document.getElementById("form-report-issue").reset();
      
      loadClientPortalView();
      renderAllViews();
      alert("Support Ticket submitted to Admin command centre!");
    } catch (err) {
      console.error("Failed to report issue in Supabase:", err);
      alert("Failed to submit ticket details.");
    }
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
    renderActivityLogsTab();
    renderLeadsTab();
  }
}

// --- Activity Logs Audit View (Admin) ---
function renderActivityLogsTab() {
  const tbody = document.getElementById("table-activity-logs-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!db.activityLogs || db.activityLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg" style="text-align:center;">No audit logs recorded yet.</td></tr>`;
    return;
  }

  db.activityLogs.forEach(al => {
    let actionBadge = 'badge-action-other';
    if (al.action.includes('CREATE') || al.action.includes('ADD') || al.action.includes('REGISTER')) {
      actionBadge = 'badge-action-create';
    } else if (al.action.includes('UPDATE') || al.action.includes('TOGGLE') || al.action.includes('EDIT') || al.action.includes('CHECKIN')) {
      actionBadge = 'badge-action-update';
    } else if (al.action.includes('DELETE') || al.action.includes('REMOVE') || al.action.includes('UNLINK')) {
      actionBadge = 'badge-action-delete';
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-size:11px; color:var(--text-muted);">${new Date(al.createdAt).toLocaleString('en-IN')}</td>
      <td><strong>${al.userName}</strong><br><span style="font-size:10px;color:var(--text-muted);">ID: ${al.userId}</span></td>
      <td><span class="badge badge-info">${al.role.toUpperCase()}</span></td>
      <td><span class="badge badge-action ${actionBadge}">${al.action}</span></td>
      <td><span style="font-family:monospace;font-size:11px;">${al.targetTable}.${al.recordId}</span></td>
      <td><div class="log-payload-box">${al.details || ''}</div></td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Open Staff History Modal ---
function openStaffHistoryModal(staffId) {
  const staff = db.serviceBoys.find(s => s.id === staffId);
  if (!staff) return;

  document.getElementById("staff-history-name").textContent = staff.name;
  
  const tbody = document.getElementById("staff-history-table-body");
  tbody.innerHTML = "";

  const myAssignments = db.assignments.filter(a => a.serviceBoyId === staffId);

  if (myAssignments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg" style="text-align:center;">No work history recorded yet.</td></tr>`;
    openModal("modal-staff-history");
    return;
  }

  myAssignments.forEach(a => {
    const event = db.events.find(e => e.id === a.eventId) || { name: "Removed Event", date: "N/A" };
    const wages = a.status === 'present' ? a.daysWorked * staff.rate : 0;
    const wagesText = a.status === 'present' 
      ? `₹${wages.toLocaleString('en-IN')}` 
      : a.status === 'absent' 
        ? '₹0 (Absent)' 
        : '₹0 (Pending)';

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${event.name}</strong></td>
      <td style="font-size:11px; color:var(--text-muted);">${event.date}</td>
      <td>${a.role}</td>
      <td>${a.daysWorked} days</td>
      <td>
        <span class="badge badge-${a.status === 'present' ? 'success' : a.status === 'absent' ? 'danger' : 'warning'}">
          ${a.status.toUpperCase()}
        </span>
      </td>
      <td><strong>${wagesText}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  openModal("modal-staff-history");
}

// --- Admin Leads Inbox Table Renderer ---
function renderLeadsTab() {
  const tbody = document.getElementById("table-leads-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!db.inquiries || db.inquiries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg" style="text-align:center;">No inquiries received yet.</td></tr>`;
    return;
  }

  const sortedInquiries = [...db.inquiries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sortedInquiries.forEach(inq => {
    const tr = document.createElement("tr");
    const cleanStatus = inq.status || 'pending';
    const statusBadgeClass = `badge-status-${cleanStatus}`;

    const budgetVal = parseFloat(inq.budget) || 0;
    const formattedBudget = budgetVal > 0 ? `₹${budgetVal.toLocaleString('en-IN')}` : 'N/A';
    const dateVal = inq.date || 'Flexible';
    const dateStr = inq.createdAt ? new Date(inq.createdAt).toLocaleString('en-IN') : 'N/A';

    tr.innerHTML = `
      <td style="font-size: 11px; color: var(--text-muted);">${dateStr}</td>
      <td><strong>${inq.name}</strong></td>
      <td>
        <div><i class="ti ti-phone" style="font-size:11px;"></i> ${inq.phone}</div>
        ${inq.email ? `<div><i class="ti ti-mail" style="font-size:11px;"></i> ${inq.email}</div>` : ''}
      </td>
      <td>
        <span class="badge badge-info">${inq.eventType || 'N/A'}</span>
        <div style="font-weight:bold; margin-top:2px;">${formattedBudget}</div>
      </td>
      <td>
        <div><i class="ti ti-calendar" style="font-size:11px;"></i> ${dateVal}</div>
        <div style="font-size:11px; color:var(--text-muted);"><i class="ti ti-map-pin" style="font-size:11px;"></i> ${inq.venue || 'N/A'}</div>
      </td>
      <td>
        <select class="form-control inline lead-status-select ${statusBadgeClass}" data-id="${inq.id}" style="width: auto; padding: 2px 8px; font-weight: bold; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;">
          <option value="pending" ${cleanStatus === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="approved" ${cleanStatus === 'approved' ? 'selected' : ''}>Approved</option>
          <option value="booked" ${cleanStatus === 'booked' ? 'selected' : ''}>Booked</option>
          <option value="follow_up" ${cleanStatus === 'follow_up' ? 'selected' : ''}>Follow up</option>
          <option value="rejected" ${cleanStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </td>
    `;

    const selectEl = tr.querySelector(".lead-status-select");
    selectEl.addEventListener("change", async (e) => {
      const newStatus = e.target.value;
      selectEl.className = `form-control inline lead-status-select badge-status-${newStatus}`;
      try {
        inq.status = newStatus;
        await supabaseClient.from('inquiries').update({ status: newStatus }).eq('id', inq.id);
        logActivity("UPDATE_LEAD_STATUS", "inquiries", inq.id, { status: newStatus, name: inq.name });
        
        const eventId = 'e-' + inq.id;
        if (newStatus === "approved" || newStatus === "booked") {
          const existingEvent = db.events.find(evt => evt.id === eventId);
          if (!existingEvent) {
            // Prevent duplication: check if client with this phone number already exists
            const cleanPhone = cleanPhoneNumber(inq.phone);
            let finalClientId = null;
            const existingClient = db.clients.find(c => cleanPhoneNumber(c.phone) === cleanPhone);
            if (existingClient) {
              finalClientId = existingClient.id;
            } else {
              finalClientId = 'c-' + Date.now();
              const { error: clientError } = await supabaseClient.from('clients').insert({
                id: finalClientId,
                name: inq.name,
                phone: inq.phone,
                email: inq.email || null
              });
              if (clientError) throw clientError;
              logActivity("REGISTER_CLIENT", "clients", finalClientId, { name: inq.name, phone: inq.phone });
            }

            const eventName = `${inq.name}'s ${inq.eventType || 'Event'}`;
            const { error: eventError } = await supabaseClient.from('events').insert({
              id: eventId,
              name: eventName,
              date: inq.date || new Date().toISOString().split('T')[0],
              venue: inq.venue || 'TBD',
              client_id: finalClientId,
              status: "confirmed",
              budget: inq.budget || 0,
              latitude: null,
              longitude: null
            });
            if (eventError) throw eventError;

            logActivity("CREATE_EVENT", "events", eventId, {
              eventName,
              clientName: inq.name,
              venue: inq.venue || 'TBD',
              budget: inq.budget || 0
            });
            showToast("Event Created", `Event created for ${inq.name}`, "success");
          }
        } else {
          // If status changes away from approved/booked, delete any associated event & assignments
          const existingEvent = db.events.find(evt => evt.id === eventId);
          if (existingEvent) {
            await Promise.all([
              supabaseClient.from('assignments').delete().eq('event_id', eventId),
              supabaseClient.from('vendor_orders').delete().eq('event_id', eventId),
              supabaseClient.from('payments').delete().eq('event_id', eventId),
              supabaseClient.from('issues').delete().eq('event_id', eventId)
            ]);
            const { error: deleteError } = await supabaseClient.from('events').delete().eq('id', eventId);
            if (deleteError) throw deleteError;

            logActivity("DELETE_EVENT", "events", eventId, { eventName: existingEvent.name });
            showToast("Event Removed", `Event for ${inq.name} has been removed.`, "info");
          }
        }
        
        showToast("Lead Status Updated", `Lead for ${inq.name} is now ${newStatus.toUpperCase()}`, "success");
        await loadDatabase();
        renderAllViews();
      } catch (err) {
        console.error("Failed to update inquiry status in Supabase:", err);
        showToast("Error", "Could not update lead status", "danger");
      }
    });

    tbody.appendChild(tr);
  });
}

// --- Chatbot Widget State Machine ---
let chatbotState = {
  step: 0,
  data: {
    services: [], // catering, decor, entertainment
    eventName: "",
    eventType: "",
    guests: "",
    budgetTier: "", // budget, premium, luxury
    menuPref: "", // veg, non-veg, mixed
    tentativeMenu: "", // text or file name
    name: "",
    phone: "",
    date: "",
    venue: "",
    budget: 0
  }
};

function initChatbot() {
  const toggleBtn = document.getElementById("btn-chatbot-toggle");
  const chatbotWindow = document.getElementById("chatbot-window");
  const sendBtn = document.getElementById("btn-chatbot-send");
  const textInput = document.getElementById("chatbot-text-input");
  const messagesContainer = document.getElementById("chatbot-messages");

  if (!toggleBtn || !chatbotWindow || !sendBtn || !textInput || !messagesContainer) return;

  toggleBtn.addEventListener("click", () => {
    const isHidden = chatbotWindow.style.display === "none";
    if (isHidden) {
      chatbotWindow.style.display = "flex";
      toggleBtn.querySelector(".chatbot-open-icon").style.display = "none";
      toggleBtn.querySelector(".chatbot-close-icon").style.display = "block";
      
      // If we finished, reset
      if (chatbotState.step === 11) {
        resetChatbot();
      } else if (chatbotState.step === 0 && messagesContainer.children.length <= 1) {
        renderServiceOptions();
      }
      textInput.focus();
    } else {
      chatbotWindow.style.display = "none";
      toggleBtn.querySelector(".chatbot-open-icon").style.display = "block";
      toggleBtn.querySelector(".chatbot-close-icon").style.display = "none";
    }
  });

  sendBtn.addEventListener("click", () => {
    handleChatbotInput();
  });

  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleChatbotInput();
    }
  });
}

function handleChatbotInput() {
  const textInput = document.getElementById("chatbot-text-input");
  if (!textInput) return;

  const value = textInput.value.trim();
  
  // Define steps that allow empty text or use click options instead
  const noTextSteps = [0, 2, 6, 7, 8];
  if (!value && !noTextSteps.includes(chatbotState.step)) {
    return;
  }

  // Append user bubble unless we handle it programmatically via button click
  if (value) {
    appendChatBubble("client", value);
  }
  processChatbotStep(value);
  textInput.value = "";
}

function appendChatBubble(sender, text) {
  const messagesContainer = document.getElementById("chatbot-messages");
  if (!messagesContainer) return;

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerHTML = text;
  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return bubble;
}

async function processChatbotStep(value) {
  const textInput = document.getElementById("chatbot-text-input");
  if (!textInput) return;

  removeQuickOptionsUI();

  switch (chatbotState.step) {
    case 0: // Service Selection
      if (value) {
        chatbotState.data.services = [value];
      }
      appendChatBubble("assistant", `Got it! Let's collect event details. First, what is the **Name of the Event**? (e.g. Rahul's Wedding, Tech Conf)`);
      chatbotState.step = 1;
      textInput.type = "text";
      textInput.placeholder = "Type event name here...";
      break;

    case 1: // Event Name
      chatbotState.data.eventName = value;
      appendChatBubble("assistant", `Great! Please select the **Event Type**:`);
      renderEventTypeOptions();
      chatbotState.step = 2;
      textInput.placeholder = "Select or type event type...";
      break;

    case 2: // Event Type
      chatbotState.data.eventType = value;
      appendChatBubble("assistant", `Understood. Approximately **how many guests** will be attending?`);
      chatbotState.step = 3;
      textInput.type = "number";
      textInput.placeholder = "Enter number of guests...";
      break;

    case 3: // Number of Guests
      chatbotState.data.guests = value;
      appendChatBubble("assistant", `What is the scheduled **Date** for this event?`);
      chatbotState.step = 4;
      textInput.type = "date";
      textInput.placeholder = "";
      break;

    case 4: // Date
      chatbotState.data.date = value;
      appendChatBubble("assistant", `Where is the **Venue / Location** you are planning to host this?`);
      chatbotState.step = 5;
      textInput.type = "text";
      textInput.placeholder = "Type venue name or location...";
      break;

    case 5: // Venue
      chatbotState.data.venue = value;
      appendChatBubble("assistant", `Please select your **Budget Category** for this event:`);
      renderBudgetTierOptions();
      chatbotState.step = 6;
      textInput.placeholder = "Select budget tier...";
      break;

    case 6: // Budget Selection
      chatbotState.data.budgetTier = value;
      // Set a default numeric budget based on tier for database compatibility
      if (value.toLowerCase() === 'luxury') chatbotState.data.budget = 1000000;
      else if (value.toLowerCase() === 'premium') chatbotState.data.budget = 350000;
      else chatbotState.data.budget = 1000000;

      // Check if Catering or All Services was selected
      const hasCatering = chatbotState.data.services.some(s => s.toLowerCase().includes('catering') || s.toLowerCase().includes('all'));
      if (hasCatering) {
        appendChatBubble("assistant", `Since you selected **Catering**, what is your **Menu Preference**?`);
        renderMenuPreferenceOptions();
        chatbotState.step = 7;
      } else {
        // Skip Catering gathering, go straight to Name
        appendChatBubble("assistant", `Almost done! To register your inquiry, may I know your **Full Name**?`);
        chatbotState.step = 9;
        textInput.type = "text";
        textInput.placeholder = "Type full name here...";
      }
      break;

    case 7: // Menu Preference
      chatbotState.data.menuPref = value;
      appendChatBubble("assistant", `Please share your **Tentative Menu**. You can type it below or upload a PDF/Image of your menu:`);
      renderMenuUploadArea();
      chatbotState.step = 8;
      textInput.type = "text";
      textInput.placeholder = "Type your menu items here...";
      break;

    case 8: // Tentative Menu text input (file handled separately)
      if (value) {
        chatbotState.data.tentativeMenu = value;
        simulateMenuAIAnalysis(value);
      }
      break;

    case 9: // Full Name
      chatbotState.data.name = value;
      appendChatBubble("assistant", `Nice to meet you, <strong>${value}</strong>! Can I have your **Phone Number** so we can contact you?`);
      chatbotState.step = 10;
      textInput.type = "tel";
      textInput.placeholder = "Type phone number here...";
      break;

    case 10: // Phone Number
      chatbotState.data.phone = value;
      chatbotState.step = 11;
      appendChatBubble("assistant", `Thank you! Registering your customized inquiry in real-time...`);
      await submitInquiry();
      break;

    default:
      break;
  }
}

// Option Renders

function renderServiceOptions() {
  const container = createQuickOptionsContainer();
  const options = ["Catering", "Decor", "Entertainment", "All Services"];
  options.forEach(opt => {
    createQuickOptionButton(container, opt, () => {
      appendChatBubble("client", opt);
      chatbotState.data.services = [opt];
      processChatbotStep(opt);
    });
  });
}

function renderEventTypeOptions() {
  const container = createQuickOptionsContainer();
  const options = ["Wedding", "Birthday", "Corporate Event", "Anniversary", "Housewarming", "Other"];
  options.forEach(opt => {
    createQuickOptionButton(container, opt, () => {
      appendChatBubble("client", opt);
      processChatbotStep(opt);
    });
  });
}

function renderBudgetTierOptions() {
  const container = createQuickOptionsContainer();
  const options = ["Budget", "Premium", "Luxury"];
  options.forEach(opt => {
    createQuickOptionButton(container, opt, () => {
      appendChatBubble("client", opt);
      processChatbotStep(opt);
    });
  });
}

function renderMenuPreferenceOptions() {
  const container = createQuickOptionsContainer();
  const options = ["Veg", "Non-Veg", "Mixed"];
  options.forEach(opt => {
    createQuickOptionButton(container, opt, () => {
      appendChatBubble("client", opt);
      processChatbotStep(opt);
    });
  });
}

function renderMenuUploadArea() {
  const messagesContainer = document.getElementById("chatbot-messages");
  if (!messagesContainer) return;

  const container = document.createElement("div");
  container.id = "chatbot-quick-options";
  container.className = "chatbot-upload-box";
  container.style.marginTop = "8px";
  container.style.padding = "12px";
  container.style.border = "2px dashed var(--brand-gold)";
  container.style.borderRadius = "8px";
  container.style.textAlign = "center";
  container.style.background = "rgba(197, 160, 89, 0.05)";

  container.innerHTML = `
    <label for="chatbot-menu-file" style="cursor:pointer; display:block;">
      <i class="ti ti-cloud-upload" style="font-size: 28px; color: var(--brand-gold);"></i>
      <span style="display:block; font-size:12px; margin-top:4px; font-weight:bold; color:var(--text-normal);">Upload Menu (PDF / Image)</span>
    </label>
    <input type="file" id="chatbot-menu-file" accept=".pdf,image/*" style="display:none;">
  `;

  messagesContainer.appendChild(container);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const fileInput = container.querySelector("#chatbot-menu-file");
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      appendChatBubble("client", `📎 Uploaded: <strong>${file.name}</strong>`);
      chatbotState.data.tentativeMenu = `File: ${file.name}`;
      simulateMenuAIAnalysis(file.name);
    }
  });
}

function simulateMenuAIAnalysis(inputName) {
  removeQuickOptionsUI();
  
  const progressBubble = appendChatBubble("assistant", `🔍 <strong>Aerosky AI analyzing your menu choice...</strong><br>
    • Extracting items from input...<br>
    • Validating combinations...`);

  setTimeout(() => {
    progressBubble.innerHTML = `⚙️ <strong>Refining menu items and suggesting improvements...</strong>`;
    
    setTimeout(() => {
      progressBubble.innerHTML = `✨ <strong>Custom AI Menu Strategy Created!</strong><br><br>
        <strong>Suggested Improvements:</strong><br>
        1. Add a signature mocktail counter to welcome guests.<br>
        2. Pair seasonal starters matching the budget tier.<br>
        3. Optimize dessert distribution for ${chatbotState.data.guests || '100'} guests.<br><br>
        <strong>Generated Tentative Menu Plan:</strong><br>
        • 3 Starters (including Specialty Skewers)<br>
        • 2 Main Course Mains (matching preference: ${chatbotState.data.menuPref || 'Mixed'})<br>
        • Live Bread/Roti Counter & Rice pairing<br>
        • Premium Ice Cream & Warm Dessert combination.`;

      const textInput = document.getElementById("chatbot-text-input");
      if (textInput) {
        appendChatBubble("assistant", `Now to save your options, please enter your **Full Name**:`);
        chatbotState.step = 9;
        textInput.type = "text";
        textInput.placeholder = "Type full name here...";
        textInput.focus();
      }
    }, 1500);
  }, 1200);
}

// Helpers

function createQuickOptionsContainer() {
  const messagesContainer = document.getElementById("chatbot-messages");
  if (!messagesContainer) return null;

  const container = document.createElement("div");
  container.id = "chatbot-quick-options";
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.gap = "6px";
  container.style.marginTop = "6px";

  messagesContainer.appendChild(container);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return container;
}

function createQuickOptionButton(container, text, callback) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-outline btn-sm";
  btn.style.padding = "4px 10px";
  btn.style.fontSize = "12px";
  btn.style.borderColor = "var(--brand-gold)";
  btn.style.color = "var(--brand-gold)";
  btn.style.borderRadius = "20px";
  btn.style.cursor = "pointer";
  btn.textContent = text;
  btn.addEventListener("click", callback);
  container.appendChild(btn);
}

function removeQuickOptionsUI() {
  const container = document.getElementById("chatbot-quick-options");
  if (container) {
    container.remove();
  }
}

async function submitInquiry() {
  const inputRow = document.getElementById("chatbot-input-row");
  const textInput = document.getElementById("chatbot-text-input");
  
  const inquiryId = 'inq-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  
  // Format services and catering menu details into event type & venue description
  const formattedType = `${chatbotState.data.eventType} (${chatbotState.data.services.join(', ')})`;
  const finalVenue = `${chatbotState.data.venue} [Guests: ${chatbotState.data.guests}, Budget: ${chatbotState.data.budgetTier}]`;

  const payload = {
    id: inquiryId,
    name: chatbotState.data.name,
    phone: chatbotState.data.phone,
    email: null,
    event_type: formattedType,
    date: chatbotState.data.date,
    venue: finalVenue,
    budget: chatbotState.data.budget,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('inquiries').insert(payload);
      if (error) throw error;
    }
    
    logActivity("SUBMIT_INQUIRY", "inquiries", inquiryId, { name: payload.name, phone: payload.phone, type: payload.event_type });

    if (inputRow) inputRow.style.display = "none";
    appendChatBubble("assistant", `🎉 <strong>Success!</strong> Your inquiry has been submitted.<br><br>Our Team will review the details and reach out on <strong>${payload.phone}</strong> shortly.<br><br>Have a great day!`);
    
  } catch (err) {
    console.error("Failed to submit inquiry:", err);
    appendChatBubble("assistant", `⚠️ Sorry, there was an error submitting your details. Please try again later.`);
  }
}

function resetChatbot() {
  chatbotState = {
    step: 0,
    data: {
      services: [],
      eventName: "",
      eventType: "",
      guests: "",
      budgetTier: "",
      menuPref: "",
      tentativeMenu: "",
      name: "",
      phone: "",
      date: "",
      venue: "",
      budget: 0
    }
  };

  const inputRow = document.getElementById("chatbot-input-row");
  const textInput = document.getElementById("chatbot-text-input");
  const messagesContainer = document.getElementById("chatbot-messages");

  if (inputRow) inputRow.style.display = "flex";
  if (textInput) {
    textInput.type = "text";
    textInput.placeholder = "Select service above...";
    textInput.value = "";
  }
  if (messagesContainer) {
    messagesContainer.innerHTML = `
      <div class="chat-bubble assistant">
        Hi! Greetings of the day. <br><br>
        We are a one-stop solution for your social and corporate event requirements, including:
        <ul>
          <li>Catering</li>
          <li>Decor</li>
          <li>Entertainment</li>
        </ul>
        Please choose the service you need.
      </div>
    `;
    renderServiceOptions();
  }
}

