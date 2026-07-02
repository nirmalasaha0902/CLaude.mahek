document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const recordsTableBody = document.getElementById('recordsTableBody');
    const tableLoading = document.getElementById('tableLoading');
    const refreshBtn = document.getElementById('refreshBtn');
    const adminName = document.getElementById('adminName');

    // Reports DOM
    const timeFilter = document.getElementById('timeFilter');
    const refreshReportsBtn = document.getElementById('refreshReportsBtn');
    const statFilesProduced = document.getElementById('statFilesProduced');
    const statTotalValue = document.getElementById('statTotalValue');
    const reportsTableBody = document.getElementById('reportsTableBody');
    const reportsTableLoading = document.getElementById('reportsTableLoading');
    let allQuotations = [];

    // Auth Check
    const checkAuth = () => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            loginScreen.classList.add('hidden');
            dashboardScreen.classList.remove('hidden');
            adminName.textContent = localStorage.getItem('adminUser') || 'Admin';
            
            // Tab switching setup
            const navItems = document.querySelectorAll('.nav-item[data-tab]');
            const tabContents = document.querySelectorAll('.tab-content');

            navItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    navItems.forEach(n => n.classList.remove('active'));
                    tabContents.forEach(t => t.style.display = 'none');
                    item.classList.add('active');
                    
                    const tabId = item.getAttribute('data-tab');
                    const targetTab = document.getElementById(`tab-${tabId}`);
                    if (targetTab) {
                        targetTab.style.display = 'block';
                        if (tabId === 'records') fetchRecords();
                        if (tabId === 'reports') fetchQuotations();
                    }
                });
            });

            // Initial load (Records tab is active by default in HTML)
            document.querySelector('.nav-item[data-tab="records"]').classList.add('active');
            document.getElementById('tab-records').style.display = 'block';
            document.getElementById('tab-reports').style.display = 'none';
            fetchRecords();
        } else {
            loginScreen.classList.remove('hidden');
            dashboardScreen.classList.add('hidden');
        }
    };

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
        loginError.textContent = '';

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Login failed');
            
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', data.username);
            checkAuth();
        } catch (err) {
            loginError.textContent = err.message;
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });

    // Logout Handler
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        checkAuth();
    });

    // Fetch Records
    const fetchRecords = async () => {
        recordsTableBody.innerHTML = '';
        tableLoading.classList.remove('hidden');
        const token = localStorage.getItem('adminToken');

        try {
            const res = await fetch('/api/admin/records', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                // Token expired
                localStorage.removeItem('adminToken');
                checkAuth();
                return;
            }
            const data = await res.json();
            renderTable(data);
        } catch (err) {
            console.error('Failed to fetch records:', err);
            recordsTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red;">Failed to load records.</td></tr>`;
        } finally {
            tableLoading.classList.add('hidden');
            feather.replace();
        }
    };

    refreshBtn.addEventListener('click', fetchRecords);

    // Render Table
    const renderTable = (records) => {
        if (!records || records.length === 0) {
            recordsTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No records found.</td></tr>`;
            return;
        }

        recordsTableBody.innerHTML = records.map(r => `
            <tr>
                <td>${new Date(r.createdAt).toLocaleDateString()} ${new Date(r.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
                <td><span class="badge ${r.entryType}">${r.entryType}</span></td>
                <td><strong>${r.partName}</strong><br><small style="color:#64748b">${r.drawingNumber}</small></td>
                <td style="text-transform: capitalize;">${r.shape}</td>
                <td>${r.material}</td>
                <td>
                    ${r.lengthL ? `L: ${r.lengthL}` : ''}
                    ${r.widthW ? `W: ${r.widthW}` : ''}
                    ${r.diameter ? `D: ${r.diameter}` : ''}
                </td>
                <td>${r.orderQuantity}</td>
                <td><strong>₹${r.pricing ? r.pricing.finalAmount : 0}</strong></td>
                <td>
                    <button class="btn-icon delete-btn" data-id="${r._id}" title="Delete Record">
                        <i data-feather="trash-2"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Attach delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this record?')) {
                    await deleteRecord(id);
                }
            });
        });
    };

    // Delete Record
    const deleteRecord = async (id) => {
        const token = localStorage.getItem('adminToken');
        try {
            await fetch(`/api/admin/records/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchRecords();
        } catch (err) {
            console.error('Delete failed', err);
            alert('Failed to delete record');
        }
    };

    // --- Reports Logic ---
    const fetchQuotations = async () => {
        reportsTableBody.innerHTML = '';
        reportsTableLoading.classList.remove('hidden');
        const token = localStorage.getItem('adminToken');

        try {
            const res = await fetch('/api/admin/quotations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('adminToken');
                checkAuth();
                return;
            }
            allQuotations = await res.json();
            filterAndRenderReports();
        } catch (err) {
            console.error('Failed to fetch quotations:', err);
            reportsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Failed to load reports.</td></tr>`;
        } finally {
            reportsTableLoading.classList.add('hidden');
            feather.replace();
        }
    };

    if (refreshReportsBtn) {
        refreshReportsBtn.addEventListener('click', fetchQuotations);
    }

    if (timeFilter) {
        timeFilter.addEventListener('change', () => filterAndRenderReports());
    }

    const filterAndRenderReports = () => {
        const filterVal = timeFilter.value;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        let filtered = allQuotations;

        if (filterVal === 'today') {
            filtered = allQuotations.filter(q => new Date(q.createdAt) >= startOfToday);
        } else if (filterVal === 'yesterday') {
            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfYesterday.getDate() - 1);
            filtered = allQuotations.filter(q => {
                const d = new Date(q.createdAt);
                return d >= startOfYesterday && d < startOfToday;
            });
        } else if (filterVal === 'this_week') {
            filtered = allQuotations.filter(q => new Date(q.createdAt) >= startOfWeek);
        } else if (filterVal === 'last_week') {
            const startOfLastWeek = new Date(startOfWeek);
            startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
            filtered = allQuotations.filter(q => {
                const d = new Date(q.createdAt);
                return d >= startOfLastWeek && d < startOfWeek;
            });
        } else if (filterVal === 'this_month') {
            filtered = allQuotations.filter(q => new Date(q.createdAt) >= startOfMonth);
        } else if (filterVal === 'last_month') {
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            filtered = allQuotations.filter(q => {
                const d = new Date(q.createdAt);
                return d >= startOfLastMonth && d < startOfMonth;
            });
        }

        // Update Stats
        statFilesProduced.textContent = filtered.length;
        const totalVal = filtered.reduce((sum, q) => sum + (parseFloat(q.costing) || 0), 0);
        statTotalValue.textContent = '₹' + totalVal.toFixed(2);

        // Grouping logic for sessions
        const groupedSessions = [];
        if (filtered.length > 0) {
            const sortedFiltered = [...filtered].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            let currentSession = null;

            sortedFiltered.forEach(q => {
                if (!currentSession) {
                    currentSession = {
                        createdAt: q.createdAt,
                        companyName: q.companyName || '-',
                        quantity: 1, 
                        costing: parseFloat(q.costing) || 0
                    };
                } else {
                    const timeDiff = Math.abs(new Date(q.createdAt) - new Date(currentSession.createdAt)) / (1000 * 60);
                    // If same company and within 120 minutes of the last scan in this session, group them
                    if ((q.companyName || '-') === currentSession.companyName && timeDiff < 120) {
                        currentSession.quantity += 1;
                        currentSession.costing += parseFloat(q.costing) || 0;
                        currentSession.createdAt = q.createdAt; // update to latest time
                    } else {
                        groupedSessions.push(currentSession);
                        currentSession = {
                            createdAt: q.createdAt,
                            companyName: q.companyName || '-',
                            quantity: 1,
                            costing: parseFloat(q.costing) || 0
                        };
                    }
                }
            });
            if (currentSession) {
                groupedSessions.push(currentSession);
            }
            // Reverse so newest sessions are at the top
            groupedSessions.reverse();
        }

        // Render Table
        if (groupedSessions.length === 0) {
            reportsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No reports found for this period.</td></tr>`;
        } else {
            reportsTableBody.innerHTML = groupedSessions.map(q => `
                <tr>
                    <td>${new Date(q.createdAt).toLocaleDateString()} <br><small style="color:#64748b">${new Date(q.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></td>
                    <td><strong>${q.companyName}</strong></td>
                    <td>${q.quantity}</td>
                    <td><strong>₹${parseFloat(q.costing || 0).toFixed(2)}</strong></td>
                </tr>
            `).join('');
        }
        feather.replace();
    };

    // Init
    checkAuth();
});
