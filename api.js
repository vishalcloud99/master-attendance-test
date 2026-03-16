/**
 * Backend Configuration and API Wrapper
 */
const CONFIG = {
    // Replace these with your actual deployed Google Apps Script Web App URLs
    ATTENDANCE_API_URL: "https://script.google.com/macros/s/AKfycbw8GQNy-tuvySaPppicJgLutFLgdbt9LFvul3StgTnothlDy3NjzUt6lI-2ZrnXk0UXsA/exec",
    EXPENSE_API_URL: "https://script.google.com/macros/s/AKfycbwIAmpp1tusoYAawOmEX_3vxrk0QqVnaIGdcpqnFFhNa9tXa8-bp8lMBbVJ68_e5QIZlg/exec",
};

/**
 * Handles all requests to the Google Apps Script backend.
 */
class ApiService {

    // Helper to determine if we should mock based on whether the URL is set
    static isConfigured(url) {
        return url && url.startsWith("https://script.google.com/");
    }

    /**
     * Send a POST request to the backend with form data.
     * @param {string} action The action to perform
     * @param {Object} data The data payload to send
     */
    static async post(action, data) {
        // Route to the correct API endpoint
        let targetUrl = ["submitExpense"].includes(action) 
                        ? CONFIG.EXPENSE_API_URL 
                        : CONFIG.ATTENDANCE_API_URL;

        if (this.isConfigured(targetUrl)) {
            try {
                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8' // GAS preference for avoiding preflight CORS issues
                    },
                    body: JSON.stringify({ action: action, payload: data })
                });
                return await response.json();
            } catch (err) {
                console.error("API POST Error:", err);
                return { status: "error", message: err.message };
            }
        } else {
            // MOCK MODE
            console.log(`[MOCK API] POST ${action}`, data);
            await new Promise(resolve => setTimeout(resolve, 500));
            return { status: 'success', message: `Successfully mocked ${action}` };
        }
    }

    /**
     * Send a GET request to the backend.
     * @param {string} action The action to perform
     * @param {Object} params Additional URL parameters
     */
    static async get(action, params = {}) {
        let targetUrl = ["getExpenses"].includes(action) 
                        ? CONFIG.EXPENSE_API_URL 
                        : CONFIG.ATTENDANCE_API_URL;

        if (this.isConfigured(targetUrl)) {
            try {
                // Build query string
                const query = new URLSearchParams({ action, ...params }).toString();
                const response = await fetch(`${targetUrl}?${query}`);
                return await response.json();
            } catch (err) {
                console.error("API GET Error:", err);
                return { status: "error", data: [] };
            }
        } else {
            // MOCK MODE
            console.log(`[MOCK API] GET ${action}`, params);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Return mock stats
            if (action === 'getDashboardStats') {
                return { status: 'success', data: { visitsThisMonth: 12, attendanceThisMonth: 20 } };
            }
            
            // Return mock history data
            if (action === 'getVisits') {
                return { status: 'success', data: [ { date: '2026-03-15', time: '10:00:00', company: 'Acme Corp', visitPurpose: 'Sales Pitch' }, { date: '2026-03-14', time: '14:30:00', company: 'Global Tech', visitPurpose: 'Follow up' }, { date: '2026-03-10', time: '09:15:00', company: 'Stark Industries', visitPurpose: 'Demo' } ] };
            }
            
            if (action === 'getAttendance') {
                return { status: 'success', data: [ { date: '2026-03-15', time: '09:00:00', location: 'Office', purpose: 'Regular Work' }, { date: '2026-03-14', time: '08:55:00', location: 'Home', purpose: 'WFH' } ] };
            }
            
            if (action === 'getService') {
                return { status: 'success', data: [ { date: '2026-03-15', time: '11:00:00', siteName: 'Site A', numberOfLabour: 5 }, { date: '2026-03-12', time: '13:00:00', siteName: 'Site B', numberOfLabour: 2 } ] };
            }
            
            if (action === 'getExpenses') {
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                return { status: 'success', data: [ 
                    { date: today, time: '14:30:40', category: 'Expense', subCategory: 'Food', amount: 300, txId: 'TX260305154035', attachment: 'https://placehold.co/600x400/EEE/31343C?font=montserrat&text=Mock+Receipt' },
                    { date: '2026-03-14', time: '09:00:00', category: 'Advance Received', subCategory: 'Bank Transfer', amount: 4000, txId: 'TX260304141251' } 
                ]};
            }
            
            return { status: 'success', data: [] };
        }
    }
}
