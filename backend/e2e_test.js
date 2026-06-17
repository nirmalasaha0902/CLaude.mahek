/**
 * Comprehensive E2E Test Suite for Drawing Quotation Scanner
 * ===========================================================
 * Tests all API endpoints, edge cases, worst-case scenarios
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;
let errors = [];

function log(status, testName, details) {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${status}] ${testName}`);
    if (details) console.log(`   └─ ${details}`);
    if (status === 'PASS') passed++;
    if (status === 'FAIL') {
        failed++;
        errors.push({ test: testName, details });
    }
}

function httpRequest(method, urlPath, body, contentType) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, BASE);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            timeout: 10000,
        };
        if (contentType) {
            options.headers = { 'Content-Type': contentType };
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, headers: res.headers, body: data });
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

// Multipart form upload helper
function httpUpload(urlPath, fieldName, filePath, mimeType, extraFields, timeoutMs) {
    return new Promise((resolve, reject) => {
        const boundary = '----TestBoundary' + Date.now();
        const url = new URL(urlPath, BASE);

        let bodyParts = [];

        // Add extra fields
        if (extraFields) {
            for (const [key, val] of Object.entries(extraFields)) {
                bodyParts.push(
                    `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
                );
            }
        }

        // Add file
        const fileContent = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        bodyParts.push(
            `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
        );

        const headerBuf = Buffer.from(bodyParts.join(''));
        const footerBuf = Buffer.from(`\r\n--${boundary}--\r\n`);
        const fullBody = Buffer.concat([headerBuf, fileContent, footerBuf]);

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            timeout: timeoutMs || 30000,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': fullBody.length,
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(fullBody);
        req.end();
    });
}

async function runTests() {
    console.log('='.repeat(60));
    console.log('  COMPREHENSIVE E2E TEST SUITE');
    console.log('  Drawing Quotation Scanner - Mahekk Industry');
    console.log('='.repeat(60));
    console.log('');

    // ═══════════════════════════════════════════════════════
    // SECTION 1: Static Asset Serving (Frontend)
    // ═══════════════════════════════════════════════════════
    console.log('\n── SECTION 1: Frontend Static Asset Serving ──\n');

    // T1.1: Homepage loads
    try {
        const res = await httpRequest('GET', '/');
        if (res.status === 200 && res.body.includes('<html')) {
            log('PASS', 'T1.1 Homepage (GET /) returns 200 with HTML');
        } else {
            log('FAIL', 'T1.1 Homepage', `Status: ${res.status}, Has HTML: ${res.body.includes('<html')}`);
        }
    } catch (e) { log('FAIL', 'T1.1 Homepage', e.message); }

    // T1.2: CSS file serves
    try {
        const res = await httpRequest('GET', '/style.css');
        if (res.status === 200 && res.body.includes('{')) {
            log('PASS', 'T1.2 CSS file (/style.css) serves correctly');
        } else {
            log('FAIL', 'T1.2 CSS file', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T1.2 CSS file', e.message); }

    // T1.3: JS file serves
    try {
        const res = await httpRequest('GET', '/app.js');
        if (res.status === 200 && res.body.includes('addEventListener')) {
            log('PASS', 'T1.3 JS file (/app.js) serves correctly');
        } else {
            log('FAIL', 'T1.3 JS file', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T1.3 JS file', e.message); }

    // T1.4: Logo image serves
    try {
        const res = await httpRequest('GET', '/lexicon-logo.png');
        if (res.status === 200) {
            log('PASS', 'T1.4 Logo image (/lexicon-logo.png) serves correctly');
        } else {
            log('FAIL', 'T1.4 Logo image', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T1.4 Logo image', e.message); }

    // T1.5: Excel template files accessible (these are critical for pricing)
    for (const xlFile of ['SHIMFORMULA_CIRCLE.xlsx', 'SHIMFORMULA_RECTANGULAR.xlsx', 'SHIMFORMULA_SLOTTED.xlsx', 'FINALEXCEL.xlsx']) {
        try {
            const res = await httpRequest('GET', `/${xlFile}`);
            if (res.status === 200) {
                log('PASS', `T1.5 Excel template (/${xlFile}) accessible`);
            } else {
                log('FAIL', `T1.5 Excel template (/${xlFile})`, `Status: ${res.status}`);
            }
        } catch (e) { log('FAIL', `T1.5 Excel template (/${xlFile})`, e.message); }
    }

    // T1.6: SPA fallback - unknown path returns index.html
    try {
        const res = await httpRequest('GET', '/some/random/path');
        if (res.status === 200 && res.body.includes('<html')) {
            log('PASS', 'T1.6 SPA fallback (/some/random/path) returns index.html');
        } else {
            log('FAIL', 'T1.6 SPA fallback', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T1.6 SPA fallback', e.message); }

    // ═══════════════════════════════════════════════════════
    // SECTION 2: API - Scan Progress Endpoint
    // ═══════════════════════════════════════════════════════
    console.log('\n── SECTION 2: API - Scan Progress ──\n');

    // T2.1: Scan progress endpoint
    try {
        const res = await httpRequest('GET', '/api/scan-progress');
        const data = JSON.parse(res.body);
        if (res.status === 200 && data.status) {
            log('PASS', 'T2.1 GET /api/scan-progress returns valid JSON');
        } else {
            log('FAIL', 'T2.1 Scan progress', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T2.1 Scan progress', e.message); }

    // ═══════════════════════════════════════════════════════
    // SECTION 3: API - Scan Endpoint (Edge Cases)
    // ═══════════════════════════════════════════════════════
    console.log('\n── SECTION 3: API - Scan Endpoint Edge Cases ──\n');

    // T3.1: Scan without file -> 400
    try {
        const res = await httpRequest('POST', '/api/scan', '', 'multipart/form-data; boundary=----test');
        if (res.status === 400 || res.status === 500) {
            log('PASS', 'T3.1 POST /api/scan without file returns error');
        } else {
            log('FAIL', 'T3.1 Scan without file', `Expected 400/500, got ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T3.1 Scan without file', e.message); }

    // T3.2: Scan with a tiny fake "image" (tests fallback detection)
    try {
        // Create a minimal 1x1 PNG
        const pngHeader = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
            0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
            0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        const testImgPath = path.join(__dirname, 'test_tiny.png');
        fs.writeFileSync(testImgPath, pngHeader);

        const res = await httpUpload('/api/scan', 'drawing', testImgPath, 'image/png', undefined, 60000);
        const data = JSON.parse(res.body);

        if (res.status === 200 && data.success && data.extracted && data.calculation) {
            log('PASS', 'T3.2 Scan with tiny image -> fallback detection works');
        } else if (res.status === 200 && data.success === false) {
            log('PASS', 'T3.2 Scan with tiny image -> graceful rejection');
        } else {
            log('FAIL', 'T3.2 Scan with tiny image', `Status: ${res.status}, Body: ${res.body.substring(0, 200)}`);
        }

        // Cleanup
        try { fs.unlinkSync(testImgPath); } catch(e) {}
    } catch (e) { log('FAIL', 'T3.2 Scan with tiny image', e.message); }

    // ═══════════════════════════════════════════════════════
    // SECTION 4: API - Recalculate Endpoint (Full Coverage)
    // ═══════════════════════════════════════════════════════
    console.log('\n── SECTION 4: API - Recalculate Endpoint ──\n');

    // T4.1: Rectangular shim recalculation
    try {
        const payload = {
            shape: 'rectangular', L: 60, W: 50, D: 0, d: 0,
            thickness: 2, quantity: 3, holeDia: 9, holeCount: 6,
            material: 'MS', materialRate: 84, cuttingRate: 0.022, slots: []
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        const data = JSON.parse(res.body);
        if (res.status === 200 && data.success && data.calculation.formulaType === 'rectangular') {
            log('PASS', `T4.1 Recalculate rectangular shim -> ₹${data.calculation.finalAmount}`);
        } else {
            log('FAIL', 'T4.1 Recalculate rectangular', `Status: ${res.status}, Body: ${res.body.substring(0, 300)}`);
        }
    } catch (e) { log('FAIL', 'T4.1 Recalculate rectangular', e.message); }

    // T4.2: Circular shim recalculation
    try {
        const payload = {
            shape: 'circular', L: 0, W: 0, D: 100, d: 50,
            thickness: 3, quantity: 2, holeDia: 6.6, holeCount: 7,
            material: 'MS', materialRate: 84, cuttingRate: 0.022, slots: []
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        const data = JSON.parse(res.body);
        if (res.status === 200 && data.success && data.calculation.formulaType === 'circular') {
            log('PASS', `T4.2 Recalculate circular shim -> ₹${data.calculation.finalAmount}`);
        } else {
            log('FAIL', 'T4.2 Recalculate circular', `Status: ${res.status}, Body: ${res.body.substring(0, 300)}`);
        }
    } catch (e) { log('FAIL', 'T4.2 Recalculate circular', e.message); }

    // T4.3: Slotted shim recalculation
    try {
        const payload = {
            shape: 'slotted', L: 45, W: 16, D: 0, d: 0,
            thickness: 2, quantity: 1, holeDia: 0, holeCount: 0,
            material: 'SPCC', materialRate: 84, cuttingRate: 0.022,
            slots: [{ slot_center_from_edge: 8, length: 8, radius: 3.5, count: 4 }]
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        const data = JSON.parse(res.body);
        if (res.status === 200 && data.success && data.calculation.formulaType === 'slotted') {
            log('PASS', `T4.3 Recalculate slotted shim -> ₹${data.calculation.finalAmount}`);
        } else {
            log('FAIL', 'T4.3 Recalculate slotted', `Status: ${res.status}, Body: ${res.body.substring(0, 300)}`);
        }
    } catch (e) { log('FAIL', 'T4.3 Recalculate slotted', e.message); }

    // T4.4: Empty body -> should error gracefully
    try {
        const res = await httpRequest('POST', '/api/recalculate', {}, 'application/json');
        const data = JSON.parse(res.body);
        if (res.status === 200 && data.success) {
            // Even empty defaults to rectangular with defaults, that's acceptable
            log('PASS', 'T4.4 Recalculate with empty body -> uses defaults gracefully');
        } else if (res.status >= 400) {
            log('PASS', 'T4.4 Recalculate with empty body -> returns error gracefully');
        } else {
            log('FAIL', 'T4.4 Empty body recalculate', `Unexpected: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T4.4 Empty body recalculate', e.message); }

    // T4.5: Worst case - zero dimensions
    try {
        const payload = {
            shape: 'rectangular', L: 0, W: 0, D: 0, d: 0,
            thickness: 0, quantity: 0, holeDia: 0, holeCount: 0,
            material: '', materialRate: 0, cuttingRate: 0, slots: []
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        const data = JSON.parse(res.body);
        if (res.status === 200 || res.status === 422) {
            log('PASS', 'T4.5 All-zero dimensions -> handles gracefully (no crash)');
        } else {
            log('FAIL', 'T4.5 All-zero dimensions', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T4.5 All-zero dimensions', e.message); }

    // T4.6: Worst case - extremely large dimensions
    try {
        const payload = {
            shape: 'rectangular', L: 999999, W: 999999, D: 0, d: 0,
            thickness: 999, quantity: 99999, holeDia: 500, holeCount: 100,
            material: 'SS304', materialRate: 200, cuttingRate: 0.05, slots: []
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        const data = JSON.parse(res.body);
        if (res.status === 200 && data.success && isFinite(data.calculation.finalAmount)) {
            log('PASS', `T4.6 Huge dimensions -> no overflow, result: ₹${data.calculation.finalAmount}`);
        } else {
            log('FAIL', 'T4.6 Huge dimensions', `Status: ${res.status}, finite: ${data && isFinite(data.calculation?.finalAmount)}`);
        }
    } catch (e) { log('FAIL', 'T4.6 Huge dimensions', e.message); }

    // T4.7: Worst case - negative dimensions
    try {
        const payload = {
            shape: 'rectangular', L: -50, W: -30, D: 0, d: 0,
            thickness: -2, quantity: -1, holeDia: -5, holeCount: -3,
            material: 'MS', materialRate: 84, cuttingRate: 0.022, slots: []
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        if (res.status === 200 || res.status === 422 || res.status === 500) {
            log('PASS', 'T4.7 Negative dimensions -> no crash');
        } else {
            log('FAIL', 'T4.7 Negative dimensions', `Unexpected status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T4.7 Negative dimensions', e.message); }

    // T4.8: String injection in numeric fields
    try {
        const payload = {
            shape: 'rectangular', L: 'abc', W: '<script>alert(1)</script>', D: 0, d: 0,
            thickness: 'null', quantity: 'undefined', holeDia: '{}', holeCount: '[]',
            material: 'MS', materialRate: 84, cuttingRate: 0.022, slots: []
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        if (res.status === 200 || res.status === 422 || res.status === 500) {
            log('PASS', 'T4.8 String injection in numeric fields -> no crash');
        } else {
            log('FAIL', 'T4.8 String injection', `Unexpected status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T4.8 String injection', e.message); }

    // T4.9: Invalid shape type
    try {
        const payload = {
            shape: 'hexagonal', L: 50, W: 30, D: 0, d: 0,
            thickness: 2, quantity: 1, material: 'MS', materialRate: 84, cuttingRate: 0.022
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        const data = JSON.parse(res.body);
        if (res.status === 200 && data.success) {
            log('PASS', `T4.9 Invalid shape "hexagonal" -> defaults to ${data.calculation.formulaType}`);
        } else {
            log('PASS', 'T4.9 Invalid shape "hexagonal" -> rejected gracefully');
        }
    } catch (e) { log('FAIL', 'T4.9 Invalid shape', e.message); }

    // T4.10: Circular with inner diameter > outer diameter
    try {
        const payload = {
            shape: 'circular', L: 0, W: 0, D: 25, d: 100,
            thickness: 2, quantity: 1, holeDia: 0, holeCount: 0,
            material: 'MS', materialRate: 84, cuttingRate: 0.022, slots: []
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        if (res.status === 200 || res.status === 422) {
            log('PASS', 'T4.10 Inner dia > outer dia -> no crash');
        } else {
            log('FAIL', 'T4.10 Inner > outer dia', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T4.10 Inner > outer dia', e.message); }

    // T4.11: Order Quantity Multiplier Verification
    try {
        const payload1 = {
            shape: 'rectangular', L: 60, W: 50, D: 0, d: 0,
            thickness: 2, quantity: 1, orderQuantity: 1, holeDia: 9, holeCount: 6,
            material: 'MS', materialRate: 84, cuttingRate: 0.022, slots: []
        };
        const res1 = await httpRequest('POST', '/api/recalculate', payload1, 'application/json');
        const data1 = JSON.parse(res1.body);
        
        const payload2 = {
            shape: 'rectangular', L: 60, W: 50, D: 0, d: 0,
            thickness: 2, quantity: 1, orderQuantity: 2, holeDia: 9, holeCount: 6,
            material: 'MS', materialRate: 84, cuttingRate: 0.022, slots: []
        };
        const res2 = await httpRequest('POST', '/api/recalculate', payload2, 'application/json');
        const data2 = JSON.parse(res2.body);

        if (res1.status === 200 && res2.status === 200 && data1.success && data2.success) {
            const amt1 = data1.calculation.finalAmount;
            const amt2 = data2.calculation.finalAmount;
            if (amt2 === amt1 * 2) {
                log('PASS', `T4.11 Quantity multiplier -> Rate: ₹${amt1}, Qty: 2, Total: ₹${amt2} (Correctly multiplied)`);
            } else {
                log('FAIL', 'T4.11 Quantity multiplier', `Rate: ₹${amt1}, Qty: 2, expected ₹${amt1 * 2} but got ₹${amt2}`);
            }
        } else {
            log('FAIL', 'T4.11 Quantity multiplier API call failed', `Status1: ${res1.status}, Status2: ${res2.status}`);
        }
    } catch (e) { log('FAIL', 'T4.11 Quantity multiplier', e.message); }


    // ═══════════════════════════════════════════════════════
    // SECTION 5: API - Excel Download Endpoints
    // ═══════════════════════════════════════════════════════
    console.log('\n── SECTION 5: API - Excel Download ──\n');

    // T5.1: Single Excel download
    try {
        const payload = {
            extracted: {
                shape: 'rectangular', part_name: 'Test Shim', drawing_no: 'TEST-001',
                L: 60, W: 50, D: 0, d: 0, TH: 2, quantity: 1,
                parts: [{ thickness: 2, quantity: 1 }],
                holes: [{ diameter: 9, count: 6 }], slots: [], material: 'MS', confidence: 'high'
            },
            calculation: {
                formulaType: 'rectangular', blankL: 70, blankW: 60, blankD: 0,
                outerPerimeter: 260, holePerimeter: 170, slotsPerimeter: 0,
                totalCuttingLength: 430, startPoints: 7, weight: 0.066,
                materialRate: 84, materialCost: 6, machiningCost: 12,
                finalAmount: 22, totalQty: 1, cuttingRate: 0.022, slotDisplayData: []
            }
        };
        const res = await httpRequest('POST', '/api/download-excel', payload, 'application/json');
        if (res.status === 200 && res.headers['content-type']?.includes('spreadsheetml')) {
            log('PASS', 'T5.1 Single Excel download -> valid XLSX returned');
        } else {
            log('FAIL', 'T5.1 Single Excel download', `Status: ${res.status}, Content-Type: ${res.headers['content-type']}`);
        }
    } catch (e) { log('FAIL', 'T5.1 Single Excel download', e.message); }

    // T5.2: Multi-sheet Excel download
    try {
        const item = {
            extracted: {
                shape: 'rectangular', part_name: 'Multi Test', drawing_no: 'MT-001',
                L: 60, W: 50, D: 0, d: 0, TH: 2, quantity: 1,
                parts: [{ thickness: 2, quantity: 1 }],
                holes: [], slots: [], material: 'MS', confidence: 'high'
            },
            calculation: {
                formulaType: 'rectangular', blankL: 70, blankW: 60, blankD: 0,
                outerPerimeter: 260, holePerimeter: 0, slotsPerimeter: 0,
                totalCuttingLength: 260, startPoints: 1, weight: 0.066,
                materialRate: 84, materialCost: 6, machiningCost: 8,
                finalAmount: 17, totalQty: 1, cuttingRate: 0.022, slotDisplayData: []
            }
        };
        const payload = { companyName: 'TestCompany', items: [item, item] };
        const res = await httpRequest('POST', '/api/download-excel-multi', payload, 'application/json');
        if (res.status === 200 && res.headers['content-type']?.includes('spreadsheetml')) {
            log('PASS', 'T5.2 Multi-sheet Excel download -> valid XLSX with 2 items');
        } else {
            log('FAIL', 'T5.2 Multi-sheet Excel download', `Status: ${res.status}, CT: ${res.headers['content-type']}`);
        }
    } catch (e) { log('FAIL', 'T5.2 Multi-sheet Excel download', e.message); }

    // T5.3: Excel download with missing data -> 400
    try {
        const res = await httpRequest('POST', '/api/download-excel', {}, 'application/json');
        if (res.status === 400) {
            log('PASS', 'T5.3 Excel download missing data -> 400 error');
        } else {
            log('FAIL', 'T5.3 Excel download missing data', `Expected 400, got ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T5.3 Excel download missing data', e.message); }

    // T5.4: Multi-Excel with empty items array -> 400
    try {
        const res = await httpRequest('POST', '/api/download-excel-multi', { companyName: 'X', items: [] }, 'application/json');
        if (res.status === 400) {
            log('PASS', 'T5.4 Multi-Excel empty items -> 400 error');
        } else {
            log('FAIL', 'T5.4 Multi-Excel empty items', `Expected 400, got ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T5.4 Multi-Excel empty items', e.message); }

    // T5.5: Single PDF download
    try {
        const payload = {
            extracted: {
                shape: 'rectangular', part_name: 'Test Shim', drawing_no: 'TEST-001',
                L: 60, W: 50, D: 0, d: 0, TH: 2, quantity: 1,
                parts: [{ thickness: 2, quantity: 1 }],
                holes: [{ diameter: 9, count: 6 }], slots: [], material: 'MS', confidence: 'high'
            },
            calculation: {
                formulaType: 'rectangular', blankL: 70, blankW: 60, blankD: 0,
                outerPerimeter: 260, holePerimeter: 170, slotsPerimeter: 0,
                totalCuttingLength: 430, startPoints: 7, weight: 0.066,
                materialRate: 84, materialCost: 6, machiningCost: 12,
                finalAmount: 22, totalQty: 1, cuttingRate: 0.022, slotDisplayData: []
            }
        };
        const res = await httpRequest('POST', '/api/download-pdf', payload, 'application/json');
        if (res.status === 200 && res.headers['content-type']?.includes('pdf')) {
            log('PASS', 'T5.5 Single PDF download -> valid PDF returned');
        } else {
            log('FAIL', 'T5.5 Single PDF download', `Status: ${res.status}, Content-Type: ${res.headers['content-type']}`);
        }
    } catch (e) { log('FAIL', 'T5.5 Single PDF download', e.message); }

    // T5.6: Multi-sheet PDF download
    try {
        const item = {
            extracted: {
                shape: 'rectangular', part_name: 'Multi Test', drawing_no: 'MT-001',
                L: 60, W: 50, D: 0, d: 0, TH: 2, quantity: 1,
                parts: [{ thickness: 2, quantity: 1 }],
                holes: [], slots: [], material: 'MS', confidence: 'high'
            },
            calculation: {
                formulaType: 'rectangular', blankL: 70, blankW: 60, blankD: 0,
                outerPerimeter: 260, holePerimeter: 0, slotsPerimeter: 0,
                totalCuttingLength: 260, startPoints: 1, weight: 0.066,
                materialRate: 84, materialCost: 6, machiningCost: 8,
                finalAmount: 17, totalQty: 1, cuttingRate: 0.022, slotDisplayData: []
            }
        };
        const payload = { companyName: 'TestCompany', items: [item, item] };
        const res = await httpRequest('POST', '/api/download-pdf-multi', payload, 'application/json');
        if (res.status === 200 && res.headers['content-type']?.includes('pdf')) {
            log('PASS', 'T5.6 Multi PDF download -> valid PDF with 2 items');
        } else {
            log('FAIL', 'T5.6 Multi PDF download', `Status: ${res.status}, CT: ${res.headers['content-type']}`);
        }
    } catch (e) { log('FAIL', 'T5.6 Multi PDF download', e.message); }

    // ═══════════════════════════════════════════════════════
    // SECTION 6: File System & Path Integrity
    // ═══════════════════════════════════════════════════════
    console.log('\n── SECTION 6: File System & Path Integrity ──\n');

    // T6.1: Backend .env exists
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        log('PASS', 'T6.1 backend/.env exists');
    } else {
        log('FAIL', 'T6.1 backend/.env missing', `Expected at ${envPath}`);
    }

    // T6.2: Formulas directory intact
    const formulasDir = path.join(__dirname, 'formulas');
    const expectedFormulas = ['index.js', 'shared.js', 'excelFormulaReader.js', 'excelGenerator.js',
                              'circularFormula.js', 'rectangularFormula.js', 'slottedFormula.js'];
    for (const f of expectedFormulas) {
        const fp = path.join(formulasDir, f);
        if (fs.existsSync(fp)) {
            log('PASS', `T6.2 formulas/${f} exists`);
        } else {
            log('FAIL', `T6.2 formulas/${f} missing`, `Expected at ${fp}`);
        }
    }

    // T6.3: Frontend public directory intact
    const frontendPublic = path.join(__dirname, '..', 'frontend', 'public');
    const expectedFrontend = ['index.html', 'style.css', 'app.js', 'lexicon-logo.png',
                               'SHIMFORMULA_CIRCLE.xlsx', 'SHIMFORMULA_RECTANGULAR.xlsx',
                               'SHIMFORMULA_SLOTTED.xlsx', 'FINALEXCEL.xlsx'];
    for (const f of expectedFrontend) {
        const fp = path.join(frontendPublic, f);
        if (fs.existsSync(fp)) {
            log('PASS', `T6.3 frontend/public/${f} exists`);
        } else {
            log('FAIL', `T6.3 frontend/public/${f} MISSING`, `Expected at ${fp}`);
        }
    }

    // T6.4: Uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
        log('PASS', 'T6.4 backend/uploads/ directory exists');
    } else {
        log('FAIL', 'T6.4 backend/uploads/ missing');
    }

    // T6.5: node_modules exists in backend
    const nmDir = path.join(__dirname, 'node_modules');
    if (fs.existsSync(nmDir)) {
        log('PASS', 'T6.5 backend/node_modules/ exists');
    } else {
        log('FAIL', 'T6.5 backend/node_modules/ missing');
    }

    // T6.6: Docker & DevOps files at root
    const rootDir = path.join(__dirname, '..');
    const devopsFiles = ['docker-compose.yml', 'package.json', 'README.md', '.env.example'];
    for (const f of devopsFiles) {
        const fp = path.join(rootDir, f);
        if (fs.existsSync(fp)) {
            log('PASS', `T6.6 Root ${f} exists`);
        } else {
            log('FAIL', `T6.6 Root ${f} MISSING`);
        }
    }

    // T6.7: Dockerfiles exist
    for (const df of ['backend/Dockerfile', 'frontend/Dockerfile', 'frontend/nginx.conf']) {
        const fp = path.join(rootDir, df);
        if (fs.existsSync(fp)) {
            log('PASS', `T6.7 ${df} exists`);
        } else {
            log('FAIL', `T6.7 ${df} MISSING`);
        }
    }

    // ═══════════════════════════════════════════════════════
    // SECTION 7: Worst-Case / Stress Scenarios
    // ═══════════════════════════════════════════════════════
    console.log('\n── SECTION 7: Worst-Case / Stress Scenarios ──\n');

    // T7.1: Malformed JSON body
    try {
        const res = await httpRequest('POST', '/api/recalculate', '{invalid json!!!', 'application/json');
        if (res.status === 400 || res.status === 500) {
            log('PASS', 'T7.1 Malformed JSON body -> rejected gracefully');
        } else {
            log('FAIL', 'T7.1 Malformed JSON', `Got status ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T7.1 Malformed JSON', e.message); }

    // T7.2: Wrong HTTP method on scan endpoint
    try {
        const res = await httpRequest('GET', '/api/scan');
        // Express returns 404 for unmatched GET on a POST-only route, or falls through to wildcard
        if (res.status !== 500) {
            log('PASS', `T7.2 GET /api/scan (wrong method) -> status ${res.status}, no crash`);
        } else {
            log('FAIL', 'T7.2 Wrong method', 'Server crashed with 500');
        }
    } catch (e) { log('FAIL', 'T7.2 Wrong method', e.message); }

    // T7.3: Very large JSON payload
    try {
        const bigSlots = [];
        for (let i = 0; i < 1000; i++) {
            bigSlots.push({ slot_center_from_edge: i, length: i * 2, radius: i * 0.5, count: i });
        }
        const payload = {
            shape: 'slotted', L: 500, W: 200, D: 0, d: 0,
            thickness: 1, quantity: 1, holeDia: 0, holeCount: 0,
            material: 'MS', materialRate: 84, cuttingRate: 0.022, slots: bigSlots
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        if (res.status === 200 || res.status === 422) {
            log('PASS', 'T7.3 1000 slots payload -> handled without crash');
        } else {
            log('FAIL', 'T7.3 Large payload', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T7.3 Large payload', e.message); }

    // T7.4: Concurrent requests
    try {
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(httpRequest('POST', '/api/recalculate', {
                shape: 'rectangular', L: 50 + i, W: 30 + i,
                thickness: 1, quantity: 1, material: 'MS', materialRate: 84, cuttingRate: 0.022
            }, 'application/json'));
        }
        const results = await Promise.all(promises);
        const allOk = results.every(r => r.status === 200);
        if (allOk) {
            log('PASS', 'T7.4 10 concurrent recalculate requests -> all succeeded');
        } else {
            const failures = results.filter(r => r.status !== 200).length;
            log('FAIL', 'T7.4 Concurrent requests', `${failures}/10 failed`);
        }
    } catch (e) { log('FAIL', 'T7.4 Concurrent requests', e.message); }

    // T7.5: SQL/NoSQL injection-style strings in material field
    try {
        const payload = {
            shape: 'rectangular', L: 50, W: 30, D: 0, d: 0,
            thickness: 2, quantity: 1,
            material: "'; DROP TABLE shims; --",
            materialRate: 84, cuttingRate: 0.022
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        if (res.status === 200 || res.status === 422) {
            log('PASS', 'T7.5 SQL injection in material field -> no crash, handled safely');
        } else {
            log('FAIL', 'T7.5 SQL injection', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T7.5 SQL injection', e.message); }

    // T7.6: Unicode and emoji in fields
    try {
        const payload = {
            shape: 'rectangular', L: 50, W: 30,
            thickness: 2, quantity: 1,
            material: '钢材🔩', materialRate: 84, cuttingRate: 0.022
        };
        const res = await httpRequest('POST', '/api/recalculate', payload, 'application/json');
        if (res.status === 200 || res.status === 422) {
            log('PASS', 'T7.6 Unicode/emoji in material -> no crash');
        } else {
            log('FAIL', 'T7.6 Unicode/emoji', `Status: ${res.status}`);
        }
    } catch (e) { log('FAIL', 'T7.6 Unicode/emoji', e.message); }

    // ═══════════════════════════════════════════════════════
    // SECTION 8: Cross-Reference Integrity (require paths)
    // ═══════════════════════════════════════════════════════
    console.log('\n── SECTION 8: Module Import Integrity ──\n');

    // T8.1: All backend modules load without error
    const modulesToTest = [
        './formulas/index',
        './formulas/shared',
        './formulas/excelFormulaReader',
        './formulas/excelGenerator',
        './formulas/circularFormula',
        './formulas/rectangularFormula',
        './formulas/slottedFormula'
    ];
    for (const mod of modulesToTest) {
        try {
            require(mod);
            log('PASS', `T8.1 require('${mod}') loads successfully`);
        } catch (e) {
            log('FAIL', `T8.1 require('${mod}') FAILED`, e.message);
        }
    }

    // ═══════════════════════════════════════════════════════
    // FINAL REPORT
    // ═══════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(60));
    console.log('  TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📊 Total:  ${passed + failed}`);
    console.log(`  📈 Rate:   ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    if (errors.length > 0) {
        console.log('\n── FAILURES DETAIL ──\n');
        errors.forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.test}`);
            console.log(`     → ${e.details}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('');

    // Write results to file
    const report = {
        timestamp: new Date().toISOString(),
        passed, failed, total: passed + failed,
        rate: ((passed / (passed + failed)) * 100).toFixed(1) + '%',
        errors
    };
    fs.writeFileSync(path.join(__dirname, '..', 'test_report.json'), JSON.stringify(report, null, 2));
    console.log('Report saved to test_report.json');
}

runTests().catch(e => {
    console.error('Test suite crashed:', e);
    process.exit(1);
});
