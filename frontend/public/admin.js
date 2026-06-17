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

    // Auth Check
    const checkAuth = () => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            loginScreen.classList.add('hidden');
            dashboardScreen.classList.remove('hidden');
            adminName.textContent = localStorage.getItem('adminUser') || 'Admin';
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

    // Init
    checkAuth();
});
