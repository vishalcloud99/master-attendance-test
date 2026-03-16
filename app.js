/**
 * Main Application Logic
 */

// Global State
const AppState = {
    fingerprint: null,
    employeeName: null,
    role: null,
    currentView: 'dashboard'
};

// ==========================================================================
// Initialization & Utility
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 1. Check for identifying data
    loadUserInfo();
    
    // 2. Setup Routing based on hash
    window.addEventListener('hashchange', handleRouteChange);
    
    // Handle initial route
    if (!window.location.hash) {
        window.location.hash = 'dashboard';
    } else {
        handleRouteChange();
    }

    // 3. Attach Listeners
    setupEventListeners();
}

/**
 * Load or generate the device fingerprint and user name.
 */
function loadUserInfo() {
    let fp = localStorage.getItem('device_fingerprint');
    const name = localStorage.getItem('employee_name');
    const role = localStorage.getItem('employee_role');
    
    if (!fp) {
        fp = generateFingerprint();
        localStorage.setItem('device_fingerprint', fp);
    }
    
    AppState.fingerprint = fp;
    
    if (name && role) {
        AppState.employeeName = name;
        AppState.role = role;
        document.getElementById('header-user-name').textContent = name;
        renderBottomNav();
    } else {
        // Force setup view
        window.location.hash = 'setup';
    }
}

/**
 * Unchangeable Device Fingerprint generation.
 * This is a basic implementation combining the user agent, screen resolution, and a random UUID.
 * Since it is stored in localStorage, it will persist unless cleared by the user.
 */
function generateFingerprint() {
    const randomHex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    const uuid = `${randomHex()}${randomHex()}-${randomHex()}-${randomHex()}-${randomHex()}-${randomHex()}${randomHex()}${randomHex()}`;
    const ua = navigator.userAgent.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20); // snippet
    const screenInfo = `${screen.width}x${screen.height}`;
    
    // Simple hash function for the screen+ua info
    let hash = 0, i, chr;
    const str = ua + screenInfo;
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    
    return `DEV_${Math.abs(hash)}_${uuid}`;
}

// ==========================================================================
// Routing & Navigation
// ==========================================================================
function handleRouteChange() {
    let hash = window.location.hash.replace('#', '') || 'dashboard';
    
    // Guard: Enforce setup if name is missing
    if (!AppState.employeeName && hash !== 'setup') {
        window.location.hash = 'setup';
        return;
    }
    
    // If setup is complete and user tries to go to setup, redirect to dashboard
    if (AppState.employeeName && hash === 'setup') {
        window.location.hash = 'dashboard';
        return;
    }

    // Update views
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    const targetView = document.getElementById(`view-${hash}`);
    if (targetView) {
        targetView.classList.remove('hidden');
    } else {
        // Fallback
        document.getElementById('view-dashboard').classList.remove('hidden');
        hash = 'dashboard';
    }

    // Determine bottom nav visibility constraints explicitly
    if (AppState.role === 'Sales' && hash === 'service-attendance') { window.location.hash = 'dashboard'; return; }
    if (AppState.role === 'Service' && hash === 'sales-visit') { window.location.hash = 'dashboard'; return; }

    // Update bottom nav UI
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`.bottom-nav .nav-item[href="#${hash}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Setup camera stream if loading an attendance view
    stopCamera(); // Clean up any active streams
    if (hash === 'general-attendance') setupCamera('ga-video');
    if (hash === 'sales-visit') setupCamera('sv-video');
    if (hash === 'service-attendance') {
        setupCamera('sa-video', 'user');
        setupCamera('lb-video', 'environment'); // Rear camera for labour
    }

    // Update Page Title
    const titleMap = {
        'dashboard': 'Dashboard',
        'sales-visit': 'Sales Visit',
        'expense-entry': 'Expense Entry',
        'history': 'History',
        'general-attendance': 'General Attendance',
        'service-attendance': 'Service Attendance',
        'setup': 'Profile Setup'
    };
    
    document.getElementById('page-title').textContent = titleMap[hash] || 'App';
    AppState.currentView = hash;
}

function renderBottomNav() {
    const salesNav = document.querySelector('.bottom-nav .nav-item[href="#sales-visit"]');
    const serviceNav = document.querySelector('.bottom-nav .nav-item[href="#service-attendance"]'); // Note: index.html doesn't technically have a bottom nav item for service yet, but keeping logic clean in case it's added
    
    // Also hide dashboard buttons conditionally
    const dashSalesBtn = document.querySelector('.action-btn[href="#sales-visit"]');
    const dashServiceBtn = document.querySelector('.action-btn[href="#service-attendance"]');

    if (AppState.role === 'Sales') {
        if (serviceNav) serviceNav.style.display = 'none';
        if (dashServiceBtn) dashServiceBtn.style.display = 'none';
        
        if (salesNav) salesNav.style.display = 'flex';
        if (dashSalesBtn) dashSalesBtn.style.display = 'flex';
    } else if (AppState.role === 'Service') {
        if (salesNav) salesNav.style.display = 'none';
        if (dashSalesBtn) dashSalesBtn.style.display = 'none';
        
        if (serviceNav) serviceNav.style.display = 'flex';
        if (dashServiceBtn) dashServiceBtn.style.display = 'flex';
    } else {
        // General / Admin sees everything
        if (salesNav) salesNav.style.display = 'flex';
        if (serviceNav) serviceNav.style.display = 'flex';
        if (dashSalesBtn) dashSalesBtn.style.display = 'flex';
        if (dashServiceBtn) dashServiceBtn.style.display = 'flex';
    }
}

let activeStreams = []; // Keep track of multiple streams

async function setupCamera(videoId, facingMode = 'user') {
    const videoObj = document.getElementById(videoId);
    if (!videoObj) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: facingMode } } 
        });
        videoObj.srcObject = stream;
        activeStreams.push(stream);
    } catch (err) {
        console.error("Error accessing camera:", err);
        UI.showToast("Camera access is required for attendance tracking. Please allow permissions.", "error");
    }
}

function stopCamera() {
    activeStreams.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
    });
    activeStreams = [];
}

/** 
 * Takes the live photo from video stream and draws to canvas, converts to DataURL.
 */
function captureLivePhoto(videoId, canvasId, previewId, dataId) {
    const video = document.getElementById(videoId);
    const canvas = document.getElementById(canvasId);
    const preview = document.getElementById(previewId);
    const dataInput = document.getElementById(dataId);
    
    if (!video.srcObject) return UI.showToast("Camera not active.", "error");

    // Draw to canvas
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get compressed quality directly
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality compression built-in
    
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    dataInput.value = dataUrl; // Save for form payload
    
    // Hide Video, show retake button
    video.style.display = 'none';
    
    // Logic to find adjacent button
    const container = video.parentElement.parentElement;
    const retakeBtn = container.querySelector('[id$="-retake-btn"]');
    if(retakeBtn) retakeBtn.classList.remove('hidden');
}

/**
 * Resets the UI so they can take the photo again.
 */
function resetLivePhoto(videoId, previewId, dataId, retakeBtnId) {
    document.getElementById(videoId).style.display = 'block';
    document.getElementById(previewId).classList.add('hidden');
    document.getElementById(dataId).value = "";
    document.getElementById(retakeBtnId).classList.add('hidden');
}

// ==========================================================================
// Event Handlers
// ==========================================================================
function setupEventListeners() {
    // Setup Profile Form
    const setupForm = document.getElementById('setup-form');
    if (setupForm) {
        setupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('setup-name').value.trim();
            const role = document.getElementById('setup-role').value;
            
            if (name && role) {
                localStorage.setItem('employee_name', name);
                localStorage.setItem('employee_role', role);
                AppState.employeeName = name;
                AppState.role = role;
                document.getElementById('header-user-name').textContent = name;
                renderBottomNav();
                window.location.hash = 'dashboard';
                prefillForms(); // Fill names into forms
            }
        });
    }

    // Prefill names if already loaded
    if (AppState.employeeName) {
        prefillForms();
    }

    // Image previews
    setupImagePreview('ga-selfie', 'ga-selfie-preview');
    setupImagePreview('sv-selfie', 'sv-selfie-preview');
    setupImagePreview('sa-selfie', 'sa-selfie-preview');
    setupImagePreview('sa-labour-photo', 'sa-labour-preview');
    setupFilePreview('ex-attachment', 'ex-attachment-name');

    // Dynamic Selects & Inputs
    const svPurpose = document.getElementById('sv-purpose');
    const svOtherContainer = document.getElementById('sv-other-purpose-container');
    const svOtherInput = document.getElementById('sv-other-purpose');
    if (svPurpose) {
        svPurpose.addEventListener('change', (e) => {
            if (e.target.value === 'Others') {
                svOtherContainer.classList.remove('hidden');
                svOtherInput.required = true;
            } else {
                svOtherContainer.classList.add('hidden');
                svOtherInput.required = false;
            }
        });
    }

    const saLabour = document.getElementById('sa-labour');
    const saLabourPhotoCont = document.getElementById('sa-labour-photo-container');
    const saLabourPhotoInput = document.getElementById('sa-labour-photo');
    if (saLabour) {
        saLabour.addEventListener('input', (e) => {
            if (parseInt(e.target.value) > 0) {
                saLabourPhotoCont.classList.remove('hidden');
                saLabourPhotoInput.required = true;
            } else {
                saLabourPhotoCont.classList.add('hidden');
                saLabourPhotoInput.required = false;
            }
        });
    }

    const exCategory = document.getElementById('ex-category');
    const exPaymentMethodCont = document.getElementById('ex-payment-method-container');
    const exPaymentMethodInput = document.getElementById('ex-payment-method');
    
    // Subcategory logic
    const exSubCategoryCont = document.getElementById('ex-sub-category-container');
    const exSubCategoryInput = document.getElementById('ex-sub-category');
    const optGeneral = document.getElementById('ex-opt-general');
    const optAdjustment = document.getElementById('ex-opt-adjustment');

    if (exCategory) {
        exCategory.addEventListener('change', (e) => {
            const val = e.target.value;
            
            // Reset fields on change
            exPaymentMethodInput.value = "";
            exSubCategoryInput.value = "";
            
            // Default UI state
            exPaymentMethodCont.classList.add('hidden');
            exPaymentMethodInput.required = false;
            
            exSubCategoryCont.classList.remove('hidden');
            exSubCategoryInput.required = true;
            
            optGeneral.classList.remove('hidden');
            optAdjustment.classList.add('hidden');

            if (val === 'Advance Received') {
                // Show Payment Method, Hide Sub Category
                exPaymentMethodCont.classList.remove('hidden');
                exPaymentMethodInput.required = true;
                
                exSubCategoryCont.classList.add('hidden');
                exSubCategoryInput.required = false;
                
            } else if (val === 'Expense') {
                // Hide Payment Method, Show Normal Sub Categories
                // (Handled by default logic above)
                
            } else if (val === 'Adjustment Against Salary') {
                // Hide Payment Method, Show adjustment options
                optGeneral.classList.add('hidden');
                optAdjustment.classList.remove('hidden');
            }
        });
        
        // Auto set Date to today
        document.getElementById('ex-date').value = Utils.getDateTime().date;
    }

    // Form Submissions
    document.getElementById('form-general').addEventListener('submit', handleGeneralAttendance);
    document.getElementById('form-sales').addEventListener('submit', handleSalesVisit);
    document.getElementById('form-service').addEventListener('submit', handleServiceAttendance);
    document.getElementById('form-expense').addEventListener('submit', handleExpenseEntry);

    // Expense Tabs
    const expenseTabs = document.querySelectorAll('.expense-tab');
    expenseTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Remove active from all tabs
            expenseTabs.forEach(t => t.classList.remove('active'));
            // Add active to clicked
            const clickedTab = e.currentTarget;
            clickedTab.classList.add('active');

            // Toggle containers
            const targetId = clickedTab.getAttribute('data-target');
            document.getElementById('expense-new-container').classList.add('hidden');
            document.getElementById('expense-history-container').classList.add('hidden');
            document.getElementById(targetId).classList.remove('hidden');

            // If history tab clicked, load data
            if (targetId === 'expense-history-container') {
                loadExpenseHistory();
            }
        });
    });

    // Expense Filters
    const expenseFilters = document.querySelectorAll('.filter-pill');
    expenseFilters.forEach(pill => {
        pill.addEventListener('click', (e) => {
            expenseFilters.forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderExpenseHistory(e.currentTarget.getAttribute('data-filter'));
        });
    });
}

function prefillForms() {
    ['ga-name', 'sv-name', 'sa-name', 'ex-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = AppState.employeeName;
    });
}

function setupImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.classList.remove('hidden');
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });
}

function setupFilePreview(inputId, textId) {
    const input = document.getElementById(inputId);
    const text = document.getElementById(textId);
    if (!input || !text) return;

    input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            text.textContent = e.target.files[0].name;
        }
    });
}

// ==========================================================================
// Form Submission Handlers
// ==========================================================================

async function gatherAutoFields() {
    UI.showLoader();
    try {
        const { date, time } = Utils.getDateTime();
        const fp = AppState.fingerprint;
        
        // Parallel fetch for speed
        const [location, ip, battery] = await Promise.allSettled([
            Utils.getLocation(),
            Utils.getIPAddress(),
            Utils.getBattery()
        ]);
        
        let lat = 0, lng = 0, address = "Unknown Array";
        if (location.status === 'fulfilled') {
            lat = location.value.lat;
            lng = location.value.lng;
            address = await Utils.getAddress(lat, lng);
        }

        return {
            date, time, fingerprint: fp,
            lat, lng, address,
            ip: ip.status === 'fulfilled' ? ip.value : "Unknown",
            battery: battery.status === 'fulfilled' ? battery.value : "Unknown"
        };
    } catch (e) {
        throw e;
    } finally {
        UI.hideLoader();
    }
}

async function handleGeneralAttendance(e) {
    e.preventDefault();
    try {
        const auto = await gatherAutoFields();
        UI.showLoader();
        
        const base64Data = document.getElementById('ga-selfie-data').value;
        if (!base64Data) {
            UI.hideLoader();
            return UI.showToast("Please take a live selfie first.", "error");
        }
        
        // Generate pseudo ID
        const attId = `ATT${auto.date.replace(/-/g, '')}${String(Math.floor(Math.random() * 90000) + 10000)}`;

        const payload = {
            'Attendance ID': attId,
            'Date': auto.date,
            'Time': auto.time,
            'Employee Name': AppState.employeeName,
            'Location (Manual Entry)': document.getElementById('ga-location').value,
            'purpose': document.getElementById('ga-purpose').value,
            'address (auto capture)': auto.address,
            'Battery Level(Auto capture)': auto.battery,
            'IP Address(Auto Capture)': auto.ip,
            'fingerprint': auto.fingerprint,
            'lat': auto.lat,
            'lng': auto.lng,
            'selfieLink': base64Data
        };
        
        const res = await ApiService.post('submitAttendance', payload);
        UI.hideLoader();
        
        if (res.status === 'success') {
            UI.showToast('Attendance Successfully Submitted!', 'success');
            resetLivePhoto('ga-video', 'ga-selfie-preview', 'ga-selfie-data', 'ga-retake-btn'); // reset cam
            e.target.reset();
            window.location.hash = 'dashboard';
        } else {
            UI.showToast('Error: ' + res.message, 'error');
        }
        
    } catch (err) {
        UI.showToast("Error: " + err.message, "error");
    } finally {
        UI.hideLoader();
    }
}

async function handleSalesVisit(e) {
    e.preventDefault();
    try {
        const auto = await gatherAutoFields();
        UI.showLoader();
        
        const base64Data = document.getElementById('sv-selfie-data').value;
        if (!base64Data) {
            UI.hideLoader();
            return UI.showToast("Please take a live selfie first.", "error");
        }
        
        const purposeSelect = document.getElementById('sv-purpose').value;
        const purpose = purposeSelect === 'Others' ? document.getElementById('sv-other-purpose').value : purposeSelect;
        
        const attId = `VIS${auto.date.replace(/-/g, '')}${String(Math.floor(Math.random() * 90000) + 10000)}`;

        const payload = {
            'Visit ID': attId, // Using 'Visit ID' based on user correction
            'Date': auto.date,
            'Time': auto.time,
            'Employee Name': AppState.employeeName,
            'Visit Purpose': purpose,
            'Company': document.getElementById('sv-company').value,
            'Contact Person': document.getElementById('sv-contact').value,
            'Visit Address': document.getElementById('sv-address').value,
            'Device Fingerprint': auto.fingerprint,
            'IP Address': auto.ip,
            'Battery Level': auto.battery,
            'Check-In Location': auto.address,
            'Latitude': auto.lat,
            'Longitude': auto.lng,
            'Selfie Drive Link': base64Data
        };
        
        const res = await ApiService.post('submitVisit', payload);
        UI.hideLoader();
        
        if (res.status === 'success') {
            UI.showToast('Visit Successfully Submitted!', 'success');
            resetLivePhoto('sv-video', 'sv-selfie-preview', 'sv-selfie-data', 'sv-retake-btn'); // reset cam
            e.target.reset();
            document.getElementById('sv-other-purpose-container').classList.add('hidden');
            window.location.hash = 'dashboard';
        } else {
            UI.showToast('Error: ' + res.message, 'error');
        }
    } catch (err) {
        UI.showToast("Error: " + err.message, "error");
    } finally {
        UI.hideLoader();
    }
}

async function handleServiceAttendance(e) {
    e.preventDefault();
    try {
        const auto = await gatherAutoFields();
        UI.showLoader();
        
        const selfieData = document.getElementById('sa-selfie-data').value;
        if (!selfieData) {
            UI.hideLoader();
            return UI.showToast("Please take a live selfie first.", "error");
        }
        
        const numLabour = parseInt(document.getElementById('sa-labour').value) || 0;
        let labourData = null;
        
        if (numLabour > 0) {
            labourData = document.getElementById('sa-labour-data').value;
            if (!labourData) {
                UI.hideLoader();
                return UI.showToast("Please capture the live labour photo first.", "error");
            }
        }
        
        const attId = `SRV${auto.date.replace(/-/g, '')}${String(Math.floor(Math.random() * 90000) + 10000)}`;

        const payload = {
            'Attendance ID': attId,
            'Date': auto.date,
            'Time': auto.time,
            'Employee Name': AppState.employeeName,
            'Site Name': document.getElementById('sa-site').value,
            'Number of Labour': numLabour,
            'Device Fingerprint': auto.fingerprint,
            'IP Address': auto.ip,
            'Battery Level': auto.battery,
            'Check-In Location': auto.address,
            'Latitude': auto.lat,
            'Longitude': auto.lng,
            'Selfie Drive Link': selfieData,
            'Labours Photo Drive Link': labourData
        };
        
        const res = await ApiService.post('submitServiceAttendance', payload);
        Utils.hideLoader();
        
        if (res.status === 'success') {
            UI.showToast('Service Attendance Successfully Submitted!', 'success');
            resetLivePhoto('sa-video', 'sa-selfie-preview', 'sa-selfie-data', 'sa-retake-btn'); // reset cam
            resetLivePhoto('lb-video', 'sa-labour-preview', 'sa-labour-data', 'lb-retake-btn'); // reset cam
            e.target.reset();
            document.getElementById('sa-labour-photo-container').classList.add('hidden');
            window.location.hash = 'dashboard';
        } else {
            UI.showToast('Error: ' + res.message, 'error');
        }
        
    } catch (err) {
        UI.showToast("Error: " + err.message, "error");
    } finally {
        UI.hideLoader();
    }
}

async function handleExpenseEntry(e) {
    e.preventDefault();
    try {
        // No auto geolocation strictly needed for expense, but fingerprint and name are
        UI.showLoader();
        
        const file = document.getElementById('ex-attachment').files[0];
        let attachmentBase64 = null;
        
        if (file) {
            if (file.type.startsWith('image/')) {
                attachmentBase64 = await Utils.compressImage(file, 1200, 1200, 0.8); // Higher quality for receipts
            } else {
                // Read PDF as base64
                attachmentBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            }
        }
        
        const { time } = Utils.getDateTime();
        
        const payload = {
            fingerprint: AppState.fingerprint,
            employeeName: AppState.employeeName,
            date: document.getElementById('ex-date').value,
            time: time,
            category: document.getElementById('ex-category').value,
            subCategory: document.getElementById('ex-sub-category').value,
            paymentMethod: document.getElementById('ex-payment-method').value,
            amount: parseFloat(document.getElementById('ex-amount').value),
            description: document.getElementById('ex-description').value,
            attachment: attachmentBase64
        };
        
        const res = await ApiService.post('submitExpense', payload);
        UI.showToast('Expense Submitted Successfully!', 'success');
        e.target.reset();
        document.getElementById('ex-attachment-name').textContent = '';
        document.getElementById('ex-payment-method-container').classList.add('hidden');
        document.getElementById('ex-date').value = Utils.getDateTime().date;
        prefillForms();
        window.location.hash = 'dashboard';
        
    } catch (err) {
        UI.showToast("Error: " + err.message, "error");
    } finally {
        UI.hideLoader();
    }
}

// ==========================================================================
// Dashboard & History Logic
// ==========================================================================

let historyData = [];
let currentHistoryType = 'visits';

document.addEventListener('DOMContentLoaded', () => {
    // History Tab Listeners
    document.querySelectorAll('.hist-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.hist-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentHistoryType = e.target.getAttribute('data-type');
            loadHistory(currentHistoryType);
        });
    });

    // Filter/Search Listeners
    const histSearch = document.getElementById('hist-search');
    const histFilter = document.getElementById('hist-filter');
    if (histSearch) histSearch.addEventListener('input', renderHistory);
    if (histFilter) histFilter.addEventListener('change', renderHistory);
    
    // Auto load dashboard when routing to it
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        if (hash === 'dashboard') loadDashboardStats();
        if (hash === 'history') loadHistory(currentHistoryType);
    });
});

async function loadDashboardStats() {
    if (!AppState.fingerprint) return;
    try {
        // Fetch abbreviated stats from a generic dashboard endpoint or calculate from getVisits/getAttendance
        const res = await ApiService.get('getDashboardStats', { fingerprint: AppState.fingerprint });
        document.getElementById('dash-visits-count').textContent = res.data?.visitsThisMonth || 0;
        document.getElementById('dash-attendance-count').textContent = res.data?.attendanceThisMonth || 0;
    } catch (e) {
        console.error("Could not load dashboard stats", e);
    }
}

async function loadHistory(type) {
    if (!AppState.fingerprint) return;
    UI.showLoader();
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '<p class="text-center text-muted">Loading...</p>';
    
    try {
        // action matches the backend endpoints: getVisits, getGeneral, getService, getExpenses
        let action = 'getVisits';
        if (type === 'general') action = 'getAttendance';
        if (type === 'service') action = 'getService';
        if (type === 'expenses') action = 'getExpenses';

        const res = await ApiService.get(action, { fingerprint: AppState.fingerprint });
        historyData = res.data || [];
        renderHistory();
    } catch (e) {
        listEl.innerHTML = `<p class="text-center text-danger">Error: ${e.message}</p>`;
    } finally {
        UI.hideLoader();
    }
}

function renderHistory() {
    const listEl = document.getElementById('history-list');
    const search = document.getElementById('hist-search').value.toLowerCase();
    const filter = document.getElementById('hist-filter').value;
    
    // Filter data
    const filtered = historyData.filter(item => {
        // Basic match across values
        const matchesSearch = Object.values(item).some(val => 
            val && String(val).toLowerCase().includes(search)
        );
        
        let matchesDate = true;
        if (filter !== 'all' && item.date) {
            const itemDate = new Date(item.date);
            const now = new Date();
            if (filter === 'today') {
                matchesDate = itemDate.toDateString() === now.toDateString();
            } else if (filter === 'week') {
                const diff = (now - itemDate) / (1000 * 60 * 60 * 24);
                matchesDate = diff <= 7;
            } else if (filter === 'month') {
                matchesDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            }
        }
        
        return matchesSearch && matchesDate;
    });

    // Render Stats
    const statsContainer = document.getElementById('hist-stats-container');
    if (historyData.length > 0) {
        statsContainer.classList.remove('hidden');
        document.getElementById('hist-stat-total').textContent = historyData.length;
        document.getElementById('hist-stat-filtered').textContent = filtered.length;
    } else {
        statsContainer.classList.add('hidden');
    }

    // Empty state
    if (filtered.length === 0) {
        listEl.innerHTML = '<p class="text-center text-muted margin-top-md">No records found.</p>';
        return;
    }

    // Build HTML
    let html = '';
    filtered.forEach(item => {
        let title = '', detail = '', badge = '';
        
        if (currentHistoryType === 'visits') {
            title = item.company || 'Unknown Company';
            detail = `${item.date} • ${item.visitPurpose}`;
        } else if (currentHistoryType === 'general') {
            title = item.location || 'Unknown Location';
            detail = `${item.date} • ${item.purpose}`;
        } else if (currentHistoryType === 'service') {
            title = item.siteName || 'Unknown Site';
            detail = `${item.date} • Labour: ${item.numberOfLabour}`;
        } else if (currentHistoryType === 'expenses') {
            title = `${item.category}`;
            detail = `${item.date} • ₹${item.amount}`;
            if (item.category === 'Expense') badge = '<span class="status-badge expense">Expense</span>';
            if (item.category === 'Advance Received') badge = '<span class="status-badge advance">Advance</span>';
        }

        html += `
            <div class="history-card">
                <div class="history-card-header">
                    <span>${item.date || ''} ${item.time || ''} -- Auto capture</span>
                    ${badge}
                </div>
                <div class="history-card-title">${title}</div>
                <div class="history-card-detail">${detail}</div>
            </div>
        `;
    });
    
    listEl.innerHTML = html;
}

// ==========================================================================
// Expense History & Scorecard Logic
// ==========================================================================

let userExpenses = [];

async function loadExpenseHistory() {
    if (!AppState.fingerprint) return;
    
    const listEl = document.getElementById('expense-transactions-list');
    listEl.innerHTML = '<p class="text-center text-muted" style="padding: 2rem;">Loading...</p>';
    
    try {
        const res = await ApiService.get('getExpenses', { fingerprint: AppState.fingerprint });
        userExpenses = res.data || [];
        updateExpenseScorecard();
        
        // Render based on currently active filter (default to 'today' or whatever is active)
        const activeFilter = document.querySelector('.filter-pill.active')?.getAttribute('data-filter') || 'today';
        renderExpenseHistory(activeFilter);
        
    } catch (e) {
        listEl.innerHTML = `<p class="text-center text-danger" style="padding: 2rem;">Error: ${e.message}</p>`;
    }
}

function updateExpenseScorecard() {
    let totalAdvance = 0;
    let totalExpense = 0;
    
    // Calculates All-Time scorecard as requested
    userExpenses.forEach(item => {
        const amount = parseFloat(item.amount) || 0;
        if (item.category === 'Advance Received') {
            totalAdvance += amount;
        } else if (item.category === 'Expense') {
            totalExpense += amount;
        }
    });

    const balance = totalAdvance - totalExpense;

    document.getElementById('scorecard-advance').textContent = `₹${totalAdvance.toLocaleString()}`;
    document.getElementById('scorecard-expense').textContent = `₹${totalExpense.toLocaleString()}`;
    document.getElementById('scorecard-balance').textContent = `₹${balance.toLocaleString()}`;
}

function renderExpenseHistory(filterType = 'today') {
    const listEl = document.getElementById('expense-transactions-list');
    
    // Filter data
    const filtered = userExpenses.filter(item => {
        if (filterType === 'all') return true;
        
        if (!item.date) return false;
        
        const itemDate = new Date(item.date);
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (filterType === 'today') {
            return item.date === todayStr;
        } else if (filterType === 'yesterday') {
            return item.date === yesterdayStr;
        } else if (filterType === 'week') {
            const diff = (now - itemDate) / (1000 * 60 * 60 * 24);
            return diff <= 7 && diff >= 0;
        } else if (filterType === 'month') {
            return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }
        
        return true;
    });

    // Empty state
    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state text-center margin-top-lg">
                <i class="fa-solid fa-mailbox fa-3x text-muted margin-bottom-sm" style="opacity: 0.5;"></i>
                <h4>No Transactions</h4>
                <p class="text-sm text-muted">No entries found for this period.</p>
            </div>
        `;
        return;
    }

    // Sort by date/time newest first
    filtered.sort((a, b) => {
        const dtA = new Date(`${a.date}T${a.time || '00:00:00'}`);
        const dtB = new Date(`${b.date}T${b.time || '00:00:00'}`);
        return dtB - dtA;
    });

    // Build HTML
    let html = '';
    filtered.forEach((item, index) => {
        const isAdvance = item.category === 'Advance Received';
        const amountClass = isAdvance ? 'text-success' : 'text-danger';
        const amountSign = isAdvance ? '+' : '-';
        const iconClass = isAdvance ? 'fa-arrow-down' : 'fa-arrow-up';
        const badgeClass = isAdvance ? 'advance' : 'expense';
        const displayCategory = isAdvance ? 'Advance' : 'Expense';
        
        // Generate pseudo TX ID if none exists
        const timestamp = `${item.date} ${item.time || '00:00:00'}`;
        const txId = item.txId || `TX${item.date.replace(/-/g, '')}${String(Math.floor(Math.random() * 90000) + 10000)}`;

        html += `
            <div class="transaction-card">
                <div class="transaction-header-row">
                    <span class="status-badge ${badgeClass}"><i class="fa-solid ${iconClass}"></i> ${displayCategory}</span>
                    <span class="transaction-amount ${amountClass}">${amountSign}₹${parseFloat(item.amount || 0).toLocaleString()}</span>
                </div>
                <div class="transaction-category">${item.subCategory || item.category}</div>
                
                <div class="transaction-meta">
                    <i class="fa-regular fa-calendar"></i> ${item.date}
                    ${item.attachment ? `<a href="${item.attachment}" target="_blank" class="receipt-link"><i class="fa-solid fa-file-invoice"></i> Receipt</a>` : ''}
                </div>
                
                <div class="transaction-id">${txId}</div>
                
                <div class="transaction-footer">
                    <i class="fa-regular fa-clock"></i> Entry Timestamp : ${timestamp}
                </div>
            </div>
        `;
    });
    
    listEl.innerHTML = html;
}

// ==========================================================================
// Utilities
// ==========================================================================
const UI = {
    showLoader: () => document.getElementById('app-loader').classList.remove('hidden'),
    hideLoader: () => document.getElementById('app-loader').classList.add('hidden'),
    showAlert: (msg) => UI.showToast(msg, 'error'),
    showToast: (msg, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return alert(msg);
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
        toast.innerHTML = `${icon} <span>${msg}</span>`;
        
        container.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); // Wait for CSS transition
        }, 3000);
    }
};

const Utils = {
    /**
     * Get current location Promise wrapper
     * @returns {Promise<{lat: number, lng: number}>}
     */
    getLocation: () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser"));
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }),
                    (err) => reject(err),
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            }
        });
    },

    /**
     * Get reverse geocoded address using free Nominatim API
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<string>}
     */
    getAddress: async (lat, lng) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await response.json();
            return data.display_name || "Address not found";
        } catch (error) {
            console.error("Reverse Geocoding Failed:", error);
            return `${lat}, ${lng}`; // Fallback to coordinates
        }
    },

    /**
     * Compress an image file using Canvas.
     * @param {File} file 
     * @param {number} maxWidth 
     * @param {number} maxHeight 
     * @param {number} quality (0.0 to 1.0)
     * @returns {Promise<string>} Base64 data URL
     */
    compressImage: (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height *= maxWidth / width));
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width *= maxHeight / height));
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    },
    
    /**
     * Get current Date and Time strings
     * @returns {{date: string, time: string}}
     */
    getDateTime: () => {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        
        // Format time to HH:MM:SS local
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const time = `${hours}:${minutes}:${seconds}`;
        
        return { date, time };
    },

    /**
     * Get IP address (using a free API)
     * @returns {Promise<string>}
     */
    getIPAddress: async () => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (e) {
            return "Unknown IP";
        }
    },

    /**
     * Get Battery Level
     * @returns {Promise<string>}
     */
    getBattery: async () => {
        if (navigator.getBattery) {
            try {
                const battery = await navigator.getBattery();
                return `${Math.round(battery.level * 100)}%`;
            } catch (e) {
                return "Unknown Battery";
            }
        }
        return "Not supported";
    }
};
