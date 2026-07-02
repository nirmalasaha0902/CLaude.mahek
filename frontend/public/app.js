document.addEventListener('DOMContentLoaded', () => {
    // Session State Management
    let sessionActive = false;
    let companyName = "";
    let sessionDrawings = []; // array of { id, sheetTabName, displayName, shape, qty, cost, extracted, calculation }
    let sessionQuoteNumber = null;

    async function getQuoteNumber() {
        if (sessionQuoteNumber) return sessionQuoteNumber;
        try {
            const res = await fetch('/api/next-quote-number');
            const data = await res.json();
            sessionQuoteNumber = data.quoteNumber;
        } catch (e) {
            console.error('Failed to get quote number', e);
            sessionQuoteNumber = 'MI/01/26-27';
        }
        return sessionQuoteNumber;
    }

    // Store last scan data for Excel download / adjustments
    let lastExtracted = null;
    let lastCalculation = null;

    // --- Dynamic Hole UI Helpers ---
    function addHoleRow(diaVal = '', countVal = '') {
        const container = document.getElementById('dynamic-holes-container');
        if (!container) return;
        
        const row = document.createElement('div');
        row.className = 'dynamic-hole-row';
        row.innerHTML = `
            <div class="form-group">
                <label>Hole Diameter (mm)</label>
                <input type="number" class="hole-dia-input" step="0.1" value="${diaVal}">
            </div>
            <div class="form-group">
                <label>Hole Count</label>
                <input type="number" class="hole-count-input" min="0" value="${countVal}">
            </div>
            <button type="button" class="btn-remove-hole">X</button>
        `;
        
        row.querySelector('.btn-remove-hole').addEventListener('click', () => {
            row.remove();
        });
        
        container.appendChild(row);
    }

    const addHoleRowBtn = document.getElementById('addHoleRowBtn');
    if (addHoleRowBtn) {
        addHoleRowBtn.addEventListener('click', () => addHoleRow('', ''));
    }
    
    // --- Dynamic Slot UI Helpers ---
    function addSlotRow(lengthVal = '', lengthQtyVal = '', radiusVal = '', radiusQtyVal = '') {
        const container = document.getElementById('dynamic-slots-container');
        if (!container) return;
        
        const row = document.createElement('div');
        row.className = 'dynamic-slot-row';
        row.innerHTML = `
            <div class="form-group">
                <label>Slot Length (mm)</label>
                <input type="number" class="slot-length-input" step="0.1" value="${lengthVal}">
            </div>
            <div class="form-group">
                <label>Length Qty</label>
                <input type="number" class="slot-length-qty-input" min="0" value="${lengthQtyVal}">
            </div>
            <div class="form-group">
                <label>Slot Radius (mm)</label>
                <input type="number" class="slot-radius-input" step="0.1" value="${radiusVal}">
            </div>
            <div class="form-group">
                <label>Radius Qty</label>
                <input type="number" class="slot-radius-qty-input" min="0" value="${radiusQtyVal}">
            </div>
            <button type="button" class="btn-remove-slot">X</button>
        `;
        
        row.querySelector('.btn-remove-slot').addEventListener('click', () => {
            row.remove();
        });
        
        container.appendChild(row);
    }

    const addSlotRowBtn = document.getElementById('addSlotRowBtn');
    if (addSlotRowBtn) {
        addSlotRowBtn.addEventListener('click', () => addSlotRow('', '', '', ''));
    }
    // -------------------------------

    // Session Elements
    const sessionForm = document.getElementById('sessionForm');
    const companyNameInput = document.getElementById('companyNameInput');
    const sessionStartCard = document.getElementById('sessionStartCard');
    const mainScannerContainer = document.getElementById('mainScannerContainer');
    const sessionCompanyNameText = document.getElementById('sessionCompanyNameText');
    const endSessionBtn = document.getElementById('endSessionBtn');

    // Drawing Gallery / Compilation Elements
    const sessionDrawingsCard = document.getElementById('sessionDrawingsCard');
    const sessionDrawingsList = document.getElementById('sessionDrawingsList');
    const drawingsCountText = document.getElementById('drawingsCountText');
    const sessionTotalAmountText = document.getElementById('sessionTotalAmountText');
    const downloadMultiExcelBtn = document.getElementById('downloadMultiExcelBtn');

    // Scanner / Upload Elements
    const uploadForm = document.getElementById('uploadForm');
    const drawingInput = document.getElementById('drawingInput');
    const imagePreview = document.getElementById('imagePreview');
    const dropZone = document.getElementById('dropZone');
    const scanBtn = document.getElementById('scanBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const resultSection = document.getElementById('resultSection');

    // Actions Elements
    const addToSessionBtn = document.getElementById('addToSessionBtn');
    const downloadExcelBtn = document.getElementById('downloadExcelBtn');

    // ── Session State Controls ──

    if (sessionForm) {
        sessionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const value = companyNameInput.value.trim();
            if (value) {
                startSession(value);
            }
        });
    }

    if (endSessionBtn) {
        endSessionBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to end this session? All compiled drawing sheets will be lost.")) {
                endSession();
            }
        });
    }

    function startSession(name) {
        companyName = name;
        sessionActive = true;
        sessionDrawings = [];

        sessionCompanyNameText.textContent = name;
        sessionStartCard.classList.add('hidden');
        mainScannerContainer.classList.remove('hidden');

        renderDrawingsList();
        resetScannerState();
    }

    function endSession() {
        companyName = "";
        sessionActive = false;
        sessionDrawings = [];

        sessionStartCard.classList.remove('hidden');
        mainScannerContainer.classList.add('hidden');
        companyNameInput.value = "";
        renderSavedSessionsList();
    }

    // ── Saved Sessions Local Storage Logic ──
    const saveSessionBtn = document.getElementById('saveSessionBtn');
    const savedSessionsCard = document.getElementById('savedSessionsCard');
    const savedSessionsList = document.getElementById('savedSessionsList');

    function getSavedSessions() {
        const data = localStorage.getItem('mahekk_saved_sessions');
        return data ? JSON.parse(data) : [];
    }

    function saveSavedSessions(sessions) {
        localStorage.setItem('mahekk_saved_sessions', JSON.stringify(sessions));
    }

    function renderSavedSessionsList() {
        if (!savedSessionsList || !savedSessionsCard) return;
        const sessions = getSavedSessions();
        if (sessions.length === 0) {
            savedSessionsCard.classList.add('hidden');
            return;
        }
        
        // Only show if not actively in a session
        if (!sessionActive) {
            savedSessionsCard.classList.remove('hidden');
        } else {
            savedSessionsCard.classList.add('hidden');
        }

        savedSessionsList.innerHTML = '';
        sessions.sort((a, b) => b.timestamp - a.timestamp).forEach(sess => {
            const tr = document.createElement('tr');
            const dateStr = new Date(sess.timestamp).toLocaleString();
            tr.innerHTML = `
                <td><strong>${sess.companyName}</strong></td>
                <td>${dateStr}</td>
                <td>${sess.drawings.length} sheet(s)</td>
                <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-resume-session btn-primary" data-id="${sess.id}" style="padding: 4px 10px; font-size: 12px; height: auto;" type="button">Resume</button>
                    <button class="btn-delete-session btn-danger" data-id="${sess.id}" style="padding: 4px 10px; font-size: 12px; height: auto; background: #e74c3c; border-color: #e74c3c;" type="button">Delete</button>
                </td>
            `;
            savedSessionsList.appendChild(tr);
        });

        document.querySelectorAll('.btn-resume-session').forEach(btn => {
            btn.addEventListener('click', function() {
                resumeSession(this.getAttribute('data-id'));
            });
        });
        document.querySelectorAll('.btn-delete-session').forEach(btn => {
            btn.addEventListener('click', function() {
                if(confirm("Delete this saved quotation?")) {
                    deleteSavedSession(this.getAttribute('data-id'));
                }
            });
        });
    }

    function deleteSavedSession(id) {
        let sessions = getSavedSessions();
        sessions = sessions.filter(s => s.id !== id);
        saveSavedSessions(sessions);
        renderSavedSessionsList();
    }

    function resumeSession(id) {
        const sessions = getSavedSessions();
        const sess = sessions.find(s => s.id === id);
        if (sess) {
            companyName = sess.companyName;
            sessionActive = true;
            sessionDrawings = sess.drawings || [];

            sessionCompanyNameText.textContent = companyName;
            sessionStartCard.classList.add('hidden');
            savedSessionsCard.classList.add('hidden');
            mainScannerContainer.classList.remove('hidden');

            renderDrawingsList();
            resetScannerState();
        }
    }

    if (saveSessionBtn) {
        saveSessionBtn.addEventListener('click', () => {
            if (sessionDrawings.length === 0) {
                alert("No sheets to save. Add drawings to the quotation first.");
                return;
            }
            let sessions = getSavedSessions();
            const existingIndex = sessions.findIndex(s => s.companyName === companyName);
            const sessionData = {
                id: existingIndex >= 0 ? sessions[existingIndex].id : Date.now().toString(),
                companyName: companyName,
                drawings: sessionDrawings,
                timestamp: Date.now()
            };
            
            if (existingIndex >= 0) {
                sessions[existingIndex] = sessionData;
            } else {
                sessions.push(sessionData);
            }
            saveSavedSessions(sessions);
            alert("Session saved successfully! You can resume it later from the Previous Quotations list.");
        });
    }

    // Initialize list
    renderSavedSessionsList();


    function resetScannerState() {
        uploadForm.reset();
        imagePreview.style.display = 'none';
        imagePreview.src = '';
        if(document.getElementById('filePreviewName')) document.getElementById('filePreviewName').style.display = 'none';
        document.getElementById('uploadText').style.display = 'block';
        document.getElementById('uploadSubText').style.display = 'block';
        document.getElementById('uploadIcon').style.display = 'flex';
        if(document.getElementById('uploadOptions')) document.getElementById('uploadOptions').style.display = 'flex';
        if(document.getElementById('btnChangePhoto')) document.getElementById('btnChangePhoto').style.display = 'none';
        dropZone.style.padding = '3rem 1rem 20px 1rem';
        dropZone.style.borderStyle = 'dashed';
        
        resultSection.classList.add('hidden');
        errorMessage.classList.add('hidden');
        lastExtracted = null;
        lastCalculation = null;
    }

    // ── Image Preview logic ──
    const btnTakePhoto = document.getElementById('btnTakePhoto');
    const btnUploadFile = document.getElementById('btnUploadFile');
    const btnChangePhoto = document.getElementById('btnChangePhoto');
    
    if (btnChangePhoto) {
        btnChangePhoto.addEventListener('click', () => {
            drawingInput.value = '';
            resetScannerState();
        });
    }
    
    if (btnTakePhoto) {
        btnTakePhoto.addEventListener('click', () => {
            drawingInput.setAttribute('accept', 'image/*');
            drawingInput.setAttribute('capture', 'environment');
            drawingInput.click();
        });
    }

    if (btnUploadFile) {
        btnUploadFile.addEventListener('click', () => {
            drawingInput.setAttribute('accept', 'image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            drawingInput.removeAttribute('capture');
            drawingInput.click();
        });
    }

    drawingInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                if (file.type.startsWith('image/')) {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                    if(document.getElementById('filePreviewName')) document.getElementById('filePreviewName').style.display = 'none';
                } else {
                    imagePreview.style.display = 'none';
                    let nameEl = document.getElementById('filePreviewName');
                    if(nameEl) {
                        nameEl.textContent = file.name;
                        nameEl.style.display = 'block';
                    }
                }
                // Hide default text and icon but keep file input clickable
                document.getElementById('uploadText').style.display = 'none';
                document.getElementById('uploadSubText').style.display = 'none';
                document.getElementById('uploadIcon').style.display = 'none';
                if(document.getElementById('uploadOptions')) document.getElementById('uploadOptions').style.display = 'none';
                if(document.getElementById('btnChangePhoto')) document.getElementById('btnChangePhoto').style.display = 'flex';
                dropZone.style.padding = '1rem';
                dropZone.style.borderStyle = 'solid';
            }
            reader.readAsDataURL(file);
        }
    });

    // ── Submit Scan Form ──
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = drawingInput.files[0];
        if (!file) {
            showError("Please select or capture an image first.");
            return;
        }

        // UI state update
        scanBtn.disabled = true;
        scanBtn.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        resultSection.classList.add('hidden');

        // Reset loading UI
        const statusText = document.getElementById('loadingStatusText');
        const progressFill = document.getElementById('loadingProgressFill');
        const attemptText = document.getElementById('loadingAttemptText');
        statusText.textContent = 'AI is reading your drawing...';
        statusText.className = '';
        progressFill.style.width = '15%';
        progressFill.className = 'loading-progress-fill';
        attemptText.textContent = '';

        // Start polling for progress updates
        const progressInterval = setInterval(async () => {
            try {
                const progRes = await fetch('/api/scan-progress');
                const prog = await progRes.json();
                if (prog.status !== 'idle') {
                    statusText.textContent = prog.message;
                    const pct = Math.min(95, (prog.attempt / prog.maxAttempts) * 80 + 15);
                    progressFill.style.width = pct + '%';

                    if (prog.status === 'retrying') {
                        statusText.className = 'retrying';
                        progressFill.className = 'loading-progress-fill retrying';
                        attemptText.textContent = 'Please wait, the AI server is temporarily busy...';
                    } else if (prog.status === 'verifying') {
                        statusText.className = '';
                        progressFill.className = 'loading-progress-fill';
                        progressFill.style.width = '75%';
                        attemptText.textContent = 'Double-checking results for accuracy...';
                    } else if (prog.status === 'fallback') {
                        statusText.className = 'fallback';
                        progressFill.className = 'loading-progress-fill fallback';
                        attemptText.textContent = 'Using offline detection mode';
                    } else if (prog.status === 'processing' || prog.status === 'done') {
                        statusText.className = '';
                        progressFill.className = 'loading-progress-fill';
                        progressFill.style.width = '100%';
                        attemptText.textContent = '';
                    } else {
                        attemptText.textContent = `Attempt ${prog.attempt} of ${prog.maxAttempts}`;
                    }
                }
            } catch (e) { /* ignore polling errors */ }
        }, 2000);

        const formData = new FormData(uploadForm);

        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to process the drawing. Please try again.');
            }

            // Store data for Excel download
            lastExtracted = data.extracted;
            lastCalculation = data.calculation;

            displayResults(data.extracted, data.calculation, data.warnings);
            resultSection.classList.remove('hidden');
            
            // 100% Accuracy HITL: Hide price until user verifies
            document.getElementById('priceCalculationCard').classList.add('hidden');
            document.getElementById('downloadActions').classList.add('hidden');
            
            // Scroll to results smoothly
            setTimeout(() => {
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);

        } catch (error) {
            showError(error.message);
        } finally {
            clearInterval(progressInterval);
            scanBtn.disabled = false;
            scanBtn.classList.remove('hidden');
            loadingIndicator.classList.add('hidden');
        }
    });

    // ── Add Drawing to Quotation Session ──
    if (addToSessionBtn) {
        addToSessionBtn.addEventListener('click', () => {
            if (!lastExtracted || !lastCalculation) {
                showError("No scan data available to add. Please scan a drawing first.");
                return;
            }

            const drawingIndex = sessionDrawings.length + 1;
            const drawingId = Date.now().toString();
            const sheetTabName = `Dwg.no.${drawingIndex}`;

            let fallbackShape = lastExtracted.shape || "rectangular";
            let shapeTitle = fallbackShape.charAt(0).toUpperCase() + fallbackShape.slice(1);
            const partName = lastExtracted.part_name || shapeTitle;
            const drawingNo = lastExtracted.drawing_no ? ` (${lastExtracted.drawing_no})` : "";
            const displayName = partName + drawingNo;

            const shape = lastExtracted.shape || "rectangular";
            const qty = lastCalculation.orderQuantity || lastExtracted.orderQuantity || 1;
            const cost = lastCalculation.unitFinalAmount || (qty > 0 ? lastCalculation.finalAmount / qty : lastCalculation.finalAmount) || 0;

            sessionDrawings.push({
                id: drawingId,
                sheetTabName: sheetTabName,
                displayName: displayName,
                shape: shape,
                qty: qty,
                cost: cost,
                extracted: JSON.parse(JSON.stringify(lastExtracted)),
                calculation: JSON.parse(JSON.stringify(lastCalculation))
            });

            // Save to Neon DB via admin API
            fetch('/api/admin/quotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName: companyName || 'Unknown Company',
                    drawingDetails: displayName,
                    shape: shape,
                    quantity: qty,
                    costing: cost,
                    extractedData: lastExtracted,
                    calculationData: lastCalculation
                })
            }).catch(err => console.error('Failed to log quotation to DB:', err));

            renderDrawingsList();
            resetScannerState();

            // Scroll smoothly back to top of upload section
            document.getElementById('uploadCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // ── Rendering Compiled List ──
    function renderDrawingsList() {
        sessionDrawingsList.innerHTML = "";

        if (sessionDrawings.length === 0) {
            sessionDrawingsCard.classList.add('hidden');
            drawingsCountText.textContent = "0";
            sessionTotalAmountText.textContent = "₹0";
            return;
        }

        sessionDrawingsCard.classList.remove('hidden');
        drawingsCountText.textContent = sessionDrawings.length;

        let totalValue = 0;

        sessionDrawings.forEach((item, index) => {
            item.sheetTabName = `Dwg.no.${index + 1}`; // Re-index in case of deletion
            totalValue += item.qty * item.cost;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="cell-sheet-tab"><strong>${item.sheetTabName}</strong></td>
                <td>${item.displayName}</td>
                <td><span class="shape-badge shape-${item.shape}">${item.shape}</span></td>
                <td>${item.qty}</td>
                <td>₹${Math.round(item.cost)}</td>
                <td style="text-align: right;">
                    <button class="btn-delete-drawing" data-id="${item.id}" type="button" title="Remove sheet from Excel">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </td>
            `;
            sessionDrawingsList.appendChild(tr);
        });

        sessionTotalAmountText.textContent = `₹${Math.round(totalValue)}`;

        // Wire delete buttons
        const deleteButtons = sessionDrawingsList.querySelectorAll('.btn-delete-drawing');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                deleteDrawingItem(id);
            });
        });
    }

    function deleteDrawingItem(id) {
        sessionDrawings = sessionDrawings.filter(item => item.id !== id);
        renderDrawingsList();
    }

    // ── Download Single Excel Sheet ──
    downloadExcelBtn.addEventListener('click', async () => {
        if (!lastExtracted || !lastCalculation) {
            showError('No scan data available. Please scan a drawing first.');
            return;
        }

        downloadExcelBtn.disabled = true;
        const originalText = downloadExcelBtn.innerHTML;
        downloadExcelBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner" style="margin-right: 8px; vertical-align: middle;">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
            </svg>
            Generating...`;

        try {
            const response = await fetch('/api/download-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    extracted: lastExtracted,
                    calculation: lastCalculation
                })
            });

            if (!response.ok) throw new Error('Failed to generate Excel');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const disposition = response.headers.get('Content-Disposition');
            const filenameMatch = disposition && disposition.match(/filename="([^"]+)"/);
            a.download = filenameMatch ? filenameMatch[1] : 'Shim_Quote.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            showError('Failed to download Excel: ' + error.message);
        } finally {
            downloadExcelBtn.disabled = false;
            downloadExcelBtn.innerHTML = originalText;
        }
    });

    // ── Download Single PDF Sheet ──
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', async () => {
            if (!lastExtracted || !lastCalculation) {
                showError('No scan data available. Please scan a drawing first.');
                return;
            }

            downloadPdfBtn.disabled = true;
            const originalText = downloadPdfBtn.innerHTML;
            downloadPdfBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner" style="margin-right: 8px; vertical-align: middle;">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                Generating...`;

            try {
                const response = await fetch('/api/download-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        extracted: lastExtracted,
                        calculation: lastCalculation
                    })
                });

                if (!response.ok) throw new Error('Failed to generate PDF');

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const disposition = response.headers.get('Content-Disposition');
                const filenameMatch = disposition && disposition.match(/filename="([^"]+)"/);
                a.download = filenameMatch ? filenameMatch[1] : 'Shim_Quote.pdf';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                showError('Failed to download PDF: ' + error.message);
            } finally {
                downloadPdfBtn.disabled = false;
                downloadPdfBtn.innerHTML = originalText;
            }
        });
    }

    // ── Download Multi-Sheet Excel ──
    if (downloadMultiExcelBtn) {
        downloadMultiExcelBtn.addEventListener('click', async () => {
            if (sessionDrawings.length === 0) {
                showError("No drawings compiled to download. Scan and add drawings to your quotation first.");
                return;
            }

            downloadMultiExcelBtn.disabled = true;
            const originalText = downloadMultiExcelBtn.innerHTML;
            downloadMultiExcelBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner" style="margin-right: 8px; vertical-align: middle;">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                Generating Excel workbook...`;

            try {
                const payloadItems = sessionDrawings.map(d => ({
                    extracted: d.extracted,
                    calculation: d.calculation
                }));

                const currentQuoteNo = await getQuoteNumber();

                const response = await fetch('/api/download-excel-multi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        companyName: companyName,
                        items: payloadItems,
                        quoteNo: currentQuoteNo
                    })
                });

                if (!response.ok) throw new Error('Failed to generate compiled Excel file');

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const disposition = response.headers.get('Content-Disposition');
                const filenameMatch = disposition && disposition.match(/filename="([^"]+)"/);
                const filename = filenameMatch ? filenameMatch[1] : `Shim_Quote_Session_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                showError('Failed to download compiled Excel file: ' + error.message);
            } finally {
                downloadMultiExcelBtn.disabled = false;
                downloadMultiExcelBtn.innerHTML = originalText;
            }
        });
    }

    // ── Download Multi-Sheet PDF ──
    const downloadMultiPdfBtn = document.getElementById('downloadMultiPdfBtn');
    if (downloadMultiPdfBtn) {
        downloadMultiPdfBtn.addEventListener('click', async () => {
            if (sessionDrawings.length === 0) {
                showError("No drawings compiled to download. Scan and add drawings to your quotation first.");
                return;
            }

            downloadMultiPdfBtn.disabled = true;
            const originalText = downloadMultiPdfBtn.innerHTML;
            downloadMultiPdfBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner" style="margin-right: 8px; vertical-align: middle;">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                Generating PDF...`;

            try {
                const payloadItems = sessionDrawings.map(d => ({
                    extracted: d.extracted,
                    calculation: d.calculation
                }));

                const currentQuoteNo = await getQuoteNumber();

                const response = await fetch('/api/download-pdf-multi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        companyName: companyName,
                        items: payloadItems,
                        quoteNo: currentQuoteNo
                    })
                });

                if (!response.ok) throw new Error('Failed to generate compiled PDF file');

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const disposition = response.headers.get('Content-Disposition');
                const filenameMatch = disposition && disposition.match(/filename="([^"]+)"/);
                const filename = filenameMatch ? filenameMatch[1] : `Shim_Quote_Session_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                showError('Failed to download compiled PDF file: ' + error.message);
            } finally {
                downloadMultiPdfBtn.disabled = false;
                downloadMultiPdfBtn.innerHTML = originalText;
            }
        });
    }

    // ── Field adjustment visibility based on shape ──
    function toggleAdjustmentInputsVisibility(shape) {
        const grpLength = document.getElementById('grp-adj-length');
        const grpWidth = document.getElementById('grp-adj-width');
        const grpDiameter = document.getElementById('grp-adj-diameter');
        const grpInnerd = document.getElementById('grp-adj-innerd');
        const grpSlotsContainer = document.getElementById('dynamic-slots-container');
        const grpAddSlotBtn = document.getElementById('addSlotRowBtn');

        if (shape === 'circular' || shape === 'round') {
            if (grpLength) grpLength.style.display = 'none';
            if (grpWidth) grpWidth.style.display = 'none';
            if (grpDiameter) grpDiameter.style.display = 'block';
            if (grpInnerd) grpInnerd.style.display = 'block';
        } else {
            if (grpLength) grpLength.style.display = 'block';
            if (grpWidth) grpWidth.style.display = 'block';
            if (grpDiameter) grpDiameter.style.display = 'none';
            if (grpInnerd) grpInnerd.style.display = 'none';
        }

        if (shape === 'slotted') {
            if (grpSlotsContainer) grpSlotsContainer.style.display = 'block';
            if (grpAddSlotBtn) grpAddSlotBtn.style.display = 'inline-block';
        } else {
            if (grpSlotsContainer) grpSlotsContainer.style.display = 'none';
            if (grpAddSlotBtn) grpAddSlotBtn.style.display = 'none';
        }
    }

    const adjShapeSelect = document.getElementById('adj-shape');
    if (adjShapeSelect) {
        adjShapeSelect.addEventListener('change', function() {
            toggleAdjustmentInputsVisibility(this.value);
        });
    }

    // ── Submit Recalculate Form ──
    const adjustForm = document.getElementById('adjustForm');
    if (adjustForm) {
        adjustForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!lastExtracted || !lastCalculation) {
                showError('No scan data available. Please scan a drawing first.');
                return;
            }

            const recalcBtn = document.getElementById('recalcBtn');
            const originalBtnHTML = recalcBtn.innerHTML;
            recalcBtn.disabled = true;
            recalcBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner" style="margin-right: 8px; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Recalculating...`;

            // Read values
            const shape = document.getElementById('adj-shape').value;
            const length = document.getElementById('adj-length').value;
            const width = document.getElementById('adj-width').value;
            const diameter = document.getElementById('adj-diameter').value;
            const innerd = document.getElementById('adj-innerd').value;
            const partsText = document.getElementById('adj-parts') ? document.getElementById('adj-parts').value : '';
            let partsArray = [];
            let totalQty = 1;
            let primaryThickness = 0.5;
            if (partsText) {
                const strParts = partsText.split(',').map(s => s.trim()).filter(Boolean);
                for (const s of strParts) {
                    const match = s.match(/([\d\.]+)\s*[xX*]\s*(\d+)/);
                    if (match) {
                        partsArray.push({
                            thickness: parseFloat(match[1]),
                            quantity: parseInt(match[2], 10)
                        });
                    }
                }
                if (partsArray.length > 0) {
                    primaryThickness = partsArray[0].thickness;
                    totalQty = partsArray.reduce((sum, p) => sum + p.quantity, 0);
                }
            }

            const holeRows = document.querySelectorAll('.dynamic-hole-row');
            let holesArray = [];
            holeRows.forEach(row => {
                const dia = parseFloat(row.querySelector('.hole-dia-input').value) || 0;
                const count = parseInt(row.querySelector('.hole-count-input').value, 10) || 0;
                if (dia > 0 && count > 0) {
                    holesArray.push({ diameter: dia, count: count });
                }
            });

            let slotsArray = [];
            if (shape === 'slotted') {
                const slotRows = document.querySelectorAll('.dynamic-slot-row');
                slotRows.forEach(row => {
                    const sLen = parseFloat(row.querySelector('.slot-length-input').value) || 0;
                    const sLenQty = parseInt(row.querySelector('.slot-length-qty-input').value, 10) || 0;
                    const sRad = parseFloat(row.querySelector('.slot-radius-input').value) || 0;
                    const sRadQty = parseInt(row.querySelector('.slot-radius-qty-input').value, 10) || 0;
                    if (sLen > 0 && sRad > 0 && (sLenQty > 0 || sRadQty > 0)) {
                        slotsArray.push({
                            slot_center_from_edge: 0,
                            length: sLen,
                            lengthQty: sLenQty,
                            radius: sRad,
                            radiusQty: sRadQty,
                            count: sRadQty // fallback for count
                        });
                    }
                });
            }

            const orderQuantity = parseInt(document.getElementById('adj-order-quantity') ? document.getElementById('adj-order-quantity').value : '1', 10) || 1;
            const material = lastExtracted.material || 'MS';
            const materialRate = document.getElementById('materialRateInput').value || 84;
            const cuttingRate = document.getElementById('cuttingRateInput').value || 0.022;

            try {
                const response = await fetch('/api/recalculate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shape,
                        L: length,
                        W: width,
                        D: diameter,
                        d: innerd,
                        thickness: primaryThickness,
                        quantity: totalQty,
                        orderQuantity: orderQuantity,
                        parts: partsArray,
                        holes: holesArray,
                        part_name: lastExtracted.part_name,
                        drawing_no: lastExtracted.drawing_no,
                        material,
                        materialRate,
                        cuttingRate,
                        slots: shape === 'slotted' ? slotsArray : [],
                        slot_direction_dimension: lastExtracted ? lastExtracted.slot_direction_dimension : null
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Recalculation failed');
                }

                // Update stored data
                lastExtracted = data.extracted;
                lastCalculation = data.calculation;

                // Re-render (no warnings on manual recalc)
                displayResults(data.extracted, data.calculation, []);
                
                // SHOW the final calculation and download actions
                document.getElementById('priceCalculationCard').classList.remove('hidden');
                document.getElementById('downloadActions').classList.remove('hidden');
                
                // Highlight calculation change effect by scrolling slightly
                document.getElementById('priceCalculationCard').scrollIntoView({ behavior: 'smooth', block: 'start' });

            } catch (error) {
                showError('Recalculation Error: ' + error.message);
            } finally {
                recalcBtn.disabled = false;
                recalcBtn.innerHTML = originalBtnHTML;
            }
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function displayResults(extracted, calc, warnings) {
        warnings = warnings || [];
        const safeVal = (val, suffix = '') => {
            if (val === null || val === undefined || val === '') return '-';
            return val + suffix;
        };

        // Layer 3: Confidence Warning Banner
        const confidenceWarning = document.getElementById('confidenceWarning');
        const confidenceIcon = document.getElementById('confidenceWarningIcon');
        const confidenceTitle = document.getElementById('confidenceWarningTitle');
        const confidenceMsg = document.getElementById('confidenceWarningMsg');
        const confidenceList = document.getElementById('confidenceWarningList');
        const adjustmentCard = document.getElementById('adjustmentCard');

        // Reset warning state
        confidenceWarning.classList.add('hidden');
        confidenceWarning.classList.remove('confidence-warning--medium', 'confidence-warning--low');
        adjustmentCard.classList.remove('adjustment-card--highlight', 'adjustment-card--highlight-medium');

        const confidence = (extracted.confidence || 'high').toLowerCase();

        if (confidence === 'low') {
            // Low confidence warning banner disabled as requested
        } else if (confidence === 'medium') {
            confidenceWarning.classList.remove('hidden');
            confidenceWarning.classList.add('confidence-warning--medium');
            confidenceIcon.textContent = '⚠️';
            confidenceTitle.textContent = 'Moderate AI Confidence — Please Verify';
            confidenceMsg.textContent = 'AI results may have minor inaccuracies. Please check the extracted values and use Adjust & Recalculate if needed.';
            adjustmentCard.classList.add('adjustment-card--highlight-medium');
        }

        // Show individual warnings
        confidenceList.innerHTML = '';
        if (warnings.length > 0) {
            warnings.forEach(w => {
                const li = document.createElement('li');
                li.textContent = w;
                confidenceList.appendChild(li);
            });
            if (confidence === 'high') {
                // Even high-confidence results can have informational warnings
                confidenceWarning.classList.remove('hidden');
                confidenceWarning.classList.add('confidence-warning--medium');
                confidenceIcon.textContent = 'ℹ️';
                confidenceTitle.textContent = 'Auto-Corrections Applied';
                confidenceMsg.textContent = 'The system applied automatic corrections to ensure accuracy:';
            }
        }
        document.getElementById('res-partName').textContent = safeVal(extracted.part_name);
        document.getElementById('res-drawingNo').textContent = safeVal(extracted.drawing_no);
        document.getElementById('res-shape').textContent = safeVal(extracted.shape);
        
        const isRound = extracted.shape === 'round' || extracted.shape === 'circular';
        document.getElementById('res-length').textContent = isRound ? '-' : safeVal(extracted.L, ' mm');
        document.getElementById('res-width').textContent = isRound ? '-' : safeVal(extracted.W, ' mm');
        document.getElementById('res-diameter').textContent = isRound ? safeVal(extracted.D, ' mm') : '-';
        
        let partsText = Array.isArray(extracted.parts) && extracted.parts.length > 0 
            ? extracted.parts.map(p => `${p.thickness}mm x ${p.quantity}`).join(', ')
            : safeVal(extracted.TH, ' mm');
        document.getElementById('res-parts').textContent = partsText;

        let holesText = Array.isArray(extracted.holes) && extracted.holes.length > 0 
            ? extracted.holes.map(h => `${h.count}x Ø${h.diameter}`).join(', ') 
            : safeVal(extracted.no_holes);
        document.getElementById('res-noHoles').textContent = holesText;

        if (Array.isArray(calc.slotDisplayData) && calc.slotDisplayData.length > 0) {
            document.getElementById('row-slot-length').style.display = 'table-row';
            document.getElementById('row-slot-radius').style.display = 'table-row';
            document.getElementById('row-calc-slots').style.display = 'table-row';
            
            let lenStr = extracted.slots.map(s => `${s.length} x ${s.count * 2}`).join(', ');
            let radStr = extracted.slots.map(s => `R${s.radius} x ${s.count}`).join(', ');
            
            document.getElementById('res-slot-length').textContent = lenStr;
            document.getElementById('res-slot-radius').textContent = radStr;
            document.getElementById('calc-slotsPerimeter').textContent = safeVal(calc.slotsPerimeter, ' mm');
        } else {
            document.getElementById('row-slot-length').style.display = 'none';
            document.getElementById('row-slot-radius').style.display = 'none';
            document.getElementById('row-calc-slots').style.display = 'none';
        }

        document.getElementById('res-material').textContent = safeVal(extracted.material);
        document.getElementById('res-quantity').textContent = calc.orderQuantity || extracted.orderQuantity || 1;
        document.getElementById('res-confidence').textContent = safeVal(extracted.confidence);

        // Section 2: Price Calculation
        const blankSizeText = calc.formulaType === 'circular'
            ? `Ø ${calc.blankD} mm`
            : `${calc.blankL} x ${calc.blankW} mm`;
        document.getElementById('calc-blank-size').textContent = blankSizeText;

        document.getElementById('calc-outerPerimeter').textContent = safeVal(calc.outerPerimeter, ' mm');
        document.getElementById('calc-holePerimeter').textContent = safeVal(calc.holePerimeter, ' mm');
        document.getElementById('calc-totalCuttingLength').textContent = safeVal(calc.totalCuttingLength, ' mm');
        document.getElementById('calc-startPoints').textContent = safeVal(calc.startPoints);
        document.getElementById('calc-weight').textContent = safeVal(calc.weight);
        document.getElementById('calc-materialRate').textContent = safeVal(calc.materialRate);
        document.getElementById('calc-materialCost').textContent = safeVal(calc.materialCost);
        document.getElementById('calc-machiningCost').textContent = safeVal(calc.machiningCost);
        document.getElementById('calc-finalAmount').textContent = '₹' + safeVal(calc.finalAmount);

        // Populate and update adjustment form values
        const adjShape = document.getElementById('adj-shape');
        const adjLength = document.getElementById('adj-length');
        const adjWidth = document.getElementById('adj-width');
        const adjDiameter = document.getElementById('adj-diameter');
        const adjInnerd = document.getElementById('adj-innerd');
        const adjParts = document.getElementById('adj-parts');
        const adjHoleDia = document.getElementById('adj-holeDia');
        const adjHoleCount = document.getElementById('adj-holeCount');
        const adjOrderQuantity = document.getElementById('adj-order-quantity');

        if (adjOrderQuantity && calc) {
            adjOrderQuantity.value = calc.orderQuantity || extracted.orderQuantity || 1;
        }

        if (adjShape && extracted) {
            adjShape.value = extracted.shape || 'rectangular';
            adjLength.value = extracted.L || '';
            adjWidth.value = extracted.W || '';
            adjDiameter.value = extracted.D || '';
            adjInnerd.value = extracted.d || '';
            
            if (adjParts) {
                if (Array.isArray(extracted.parts) && extracted.parts.length > 0) {
                    adjParts.value = extracted.parts.map(p => `${p.thickness}x${p.quantity}`).join(', ');
                } else if (extracted.TH || extracted.quantity) {
                    adjParts.value = `${extracted.TH || 0.5}x${extracted.quantity || 1}`;
                } else {
                    adjParts.value = '';
                }
            }

            const holesContainer = document.getElementById('dynamic-holes-container');
            if (holesContainer) {
                holesContainer.innerHTML = ''; // clear existing
                if (Array.isArray(extracted.holes) && extracted.holes.length > 0) {
                    if (extracted.shape === 'circular' || extracted.shape === 'round') {
                        adjInnerd.value = extracted.d || '';
                        const mountingHoles = extracted.holes.filter(h => Math.abs((parseFloat(h.diameter) || 0) - (extracted.d || 0)) >= 0.1);
                        if (mountingHoles.length > 0) {
                            mountingHoles.forEach(h => addHoleRow(h.diameter, h.count));
                        } else {
                            addHoleRow('', '');
                        }
                    } else {
                        extracted.holes.forEach(h => addHoleRow(h.diameter, h.count));
                    }
                } else {
                    addHoleRow('', ''); // One empty row by default
                }
            }

            const slotsContainer = document.getElementById('dynamic-slots-container');
            if (slotsContainer) {
                slotsContainer.innerHTML = ''; // clear existing
                if (extracted.shape === 'slotted' && Array.isArray(extracted.slots) && extracted.slots.length > 0) {
                    extracted.slots.forEach(s => {
                        const lenQty = s.lengthQty !== undefined && s.lengthQty !== null ? s.lengthQty : (s.count * 2);
                        const radQty = s.radiusQty !== undefined && s.radiusQty !== null ? s.radiusQty : s.count;
                        addSlotRow(s.length, lenQty, s.radius, radQty);
                    });
                } else if (extracted.shape === 'slotted') {
                    addSlotRow('', '', '', ''); // One empty row by default for slotted shim
                }
            }

            toggleAdjustmentInputsVisibility(extracted.shape);
        }
    }
});
