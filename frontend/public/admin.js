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
    const searchInput = document.getElementById('searchInput');
    const searchReportsBtn = document.getElementById('searchReportsBtn');
    const refreshReportsBtn = document.getElementById('refreshReportsBtn');
    const statFilesProduced = document.getElementById('statFilesProduced');
    const reportsTableBody = document.getElementById('reportsTableBody');
    const reportsTableLoading = document.getElementById('reportsTableLoading');
    let allQuotations = [];
    let weeklyChartInstance = null;

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
        refreshReportsBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            fetchQuotations();
        });
    }

    if (searchReportsBtn) {
        searchReportsBtn.addEventListener('click', () => filterAndRenderReports());
    }
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') filterAndRenderReports();
        });
    }

    const filterAndRenderReports = () => {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        // 1. Group ALL quotations into sessions first
        const allGroupedSessions = [];
        if (allQuotations.length > 0) {
            const sortedQuotations = [...allQuotations].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            let currentSession = null;

            sortedQuotations.forEach(q => {
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
                        allGroupedSessions.push(currentSession);
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
                allGroupedSessions.push(currentSession);
            }
            // Reverse so newest sessions are at the top
            allGroupedSessions.reverse();
        }

        // 2. Filter grouped sessions by the search query
        let filteredSessions = allGroupedSessions;
        if (query) {
            filteredSessions = allGroupedSessions.filter(session => {
                const dateStr = new Date(session.createdAt).toLocaleDateString().toLowerCase();
                const timeStr = new Date(session.createdAt).toLocaleTimeString().toLowerCase();
                const companyStr = (session.companyName || '').toLowerCase();
                return dateStr.includes(query) || timeStr.includes(query) || companyStr.includes(query);
            });
        }

        // 3. Update Stats
        statFilesProduced.textContent = filteredSessions.length;
        
        // 4. Render Chart
        const ctx = document.getElementById('weeklyChart');
        if (ctx) {
            const labels = [];
            const data = [];
            const today = new Date();
            today.setHours(0,0,0,0);
            
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
                
                let dayCount = 0;
                filteredSessions.forEach(s => {
                    const sd = new Date(s.createdAt);
                    sd.setHours(0,0,0,0);
                    if (sd.getTime() === d.getTime()) {
                        dayCount += s.quantity; 
                    }
                });
                data.push(dayCount);
            }
            
            if (weeklyChartInstance) {
                weeklyChartInstance.destroy();
            }
            
            weeklyChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Files Scanned',
                        data: data,
                        backgroundColor: '#3b82f6',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // 5. Render Table
        if (filteredSessions.length === 0) {
            reportsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No reports found for this search.</td></tr>`;
        } else {
            reportsTableBody.innerHTML = filteredSessions.map(q => `
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
