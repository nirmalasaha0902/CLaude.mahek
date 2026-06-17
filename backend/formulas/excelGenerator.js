/**
 * Excel Sheet Generator — Separate logic per drawing type
 * Matches exact reference Shim Formula Sheet format
 */
const ExcelJS = require('exceljs');

// Shared styles
const S = {
    redBold: { name: 'Arial', size: 14, bold: true, color: { argb: 'FFCC0000' } },
    hdr: { name: 'Arial', size: 9, bold: true },
    data: { name: 'Arial', size: 9 },
    green: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } },
    pink: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } },
    yellow: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } },
    border: { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} }
};

// Smart number: whole if integer, exact decimal otherwise
function smartNum(v) {
    if (v === 0 || v === null || v === undefined) return 0;
    return Number.isInteger(v) ? v : parseFloat(v.toFixed(10).replace(/0+$/, '').replace(/\.$/, ''));
}

function setCell(ws, ref, val, opts = {}) {
    const c = ws.getCell(ref);
    c.value = val;
    c.font = opts.font || S.data;
    c.border = S.border;
    if (opts.fill) c.fill = opts.fill;
    if (opts.align) c.alignment = { horizontal: opts.align };
    return c;
}

function setHeaders(ws, headerList) {
    headerList.forEach(([ref, val]) => {
        setCell(ws, ref, val, { font: S.hdr, fill: S.pink, align: 'center' });
    });
}

function writeParts(ws, calc, parts, startRow = 3, cuttingRate = 0.022) {
    const thicknesses = parts.length > 0 ? parts : [{ thickness: 0, quantity: 0 }];
    let totalValue = 0;
    for (let i = 0; i < 4; i++) {
        const row = startRow + i;
        const p = thicknesses[i] || { thickness: 0, quantity: 0 };
        const th = parseFloat(p.thickness) || 0;
        const q = parseInt(p.quantity) || 0;
        
        // Determine thickness-based multiplier
        const multiplier = th >= 3 ? (cuttingRate - 0.002) : cuttingRate;
        const cost = th > 0 ? (calc.totalCuttingLength * th * multiplier) + (calc.startPoints * 2) : 0;
        const value = cost * q;
        totalValue += value;

        setCell(ws, `L${row}`, smartNum(th));
        if (th > 0) {
            const formulaM = startRow === 2 
                ? `J2*L${row}*${multiplier}+(K2*2)`
                : `J3*L${row}*${multiplier}+(K3+K4)*2`;
            setCell(ws, `M${row}`, { formula: formulaM, result: smartNum(cost) });
            setCell(ws, `O${row}`, { formula: `M${row}*N${row}`, result: smartNum(value) });
        } else {
            setCell(ws, `M${row}`, 0);
            setCell(ws, `O${row}`, 0);
        }
        setCell(ws, `N${row}`, q);
    }
    return totalValue;
}

function writeMaterialSection(ws, calc, parts, startRow = 3) {
    const thk = parts.reduce((s, p) => s + (parseFloat(p.thickness)||0) * (parseInt(p.quantity)||0), 0);
    const unitWeight = (calc.orderQuantity > 1) ? (calc.weight / calc.orderQuantity) : calc.weight;
    const unitMaterialCost = (calc.orderQuantity > 1) ? (calc.materialCost / calc.orderQuantity) : calc.materialCost;
    setCell(ws, `Q${startRow}`, 'MATERIAL COST', { font: S.hdr });
    setCell(ws, `R${startRow}`, smartNum(unitWeight));
    setCell(ws, `S${startRow}`, smartNum(thk));
    setCell(ws, `T${startRow}`, calc.materialRate);
    
    // Formula: WT * THK * M RATE
    const formulaMatCost = `R${startRow}*S${startRow}*T${startRow}`;
    setCell(ws, `U${startRow}`, { formula: formulaMatCost, result: smartNum(unitMaterialCost) });
    
    const finalRow = startRow + 1;
    setCell(ws, `Q${finalRow}`, 'FINAL AMOUNT', { font: {...S.hdr, color:{argb:'FFCC0000'}}, fill: S.yellow });
    setCell(ws, `R${finalRow}`, '', { fill: S.yellow });
    setCell(ws, `S${finalRow}`, '', { fill: S.yellow });
    setCell(ws, `T${finalRow}`, '', { fill: S.yellow });
    
    const totalMachiningCell = startRow === 2 ? 'O7' : 'O8';
    const formulaFinal = `ROUND((${totalMachiningCell}+U${startRow})*1.2, 0)`;
    const unitFinalAmount = calc.unitFinalAmount || Math.round(calc.finalAmount / (calc.orderQuantity || 1));
    setCell(ws, `U${finalRow}`, { formula: formulaFinal, result: Math.round(unitFinalAmount) }, { font: {...S.hdr, bold:true}, fill: S.yellow });
}

function setColWidths(ws) {
    ws.columns = [
        {width:3},{width:18},{width:8},{width:8},{width:10},
        {width:18},{width:8},{width:10},{width:3},{width:10},
        {width:10},{width:6},{width:8},{width:6},{width:8},
        {width:3},{width:16},{width:8},{width:6},{width:8},{width:10}
    ];
}

function writeTitle(ws, companyName) {
    ws.mergeCells('A1:U1');
    const t = ws.getCell('A1');
    t.value = companyName ? `Shim Formula Sheet - ${companyName}` : 'Shim Formula Sheet';
    t.font = S.redBold;
    t.alignment = { horizontal: 'center' };
}

function applyBordersToDataArea(ws, startRow, endRow, cols) {
    for (let r = startRow; r <= endRow; r++) {
        cols.forEach(col => {
            const c = ws.getCell(`${col}${r}`);
            c.border = S.border;
            if (!c.font || !c.font.name) c.font = S.data;
        });
    }
}

// ═══════════════════════════════════════════════════
// CIRCULAR — "Round & Hole Shim"
// ═══════════════════════════════════════════════════
function generateCircular(ws, extracted, calc, companyName) {
    setColWidths(ws);
    writeTitle(ws, companyName);

    // Headers — exact match to reference image
    setHeaders(ws, [
        ['B2',''], ['C2','Dia'], ['D2','AREA'],
        ['E2','HOLE DIA'], ['F2','NO HOLES'], ['G2','HOLE AREA'],
        ['J2','TOT AREA'], ['K2','NO SRT PT'],
        ['L2','TH'], ['M2','COST'], ['N2','QTY'], ['O2','VALUE'],
        ['R2','WT'], ['S2','THK'], ['T2','M RATE'], ['U2','Mat COST']
    ]);

    const holes = Array.isArray(extracted.holes) ? extracted.holes : [];
    const parts = Array.isArray(extracted.parts) ? extracted.parts : [];

    // Row 3: main data
    setCell(ws, 'B3', 'Round & Hole Shim', { font: S.hdr, fill: S.pink });
    setCell(ws, 'C3', calc.blankD, { fill: S.green });
    setCell(ws, 'D3', smartNum(3.14 * calc.blankD), { fill: S.green });

    // Hole data (up to 3 holes)
    for (let i = 0; i < 3; i++) {
        const row = 3 + i;
        if (holes[i]) {
            const dia = parseFloat(holes[i].diameter) || 0;
            const cnt = parseInt(holes[i].count) || 0;
            const area = smartNum(3.14 * dia * cnt);
            setCell(ws, `E${row}`, dia);
            setCell(ws, `F${row}`, cnt);
            setCell(ws, `G${row}`, area);
        } else {
            setCell(ws, `E${row}`, 0);
            setCell(ws, `F${row}`, 0);
            setCell(ws, `G${row}`, 0);
        }
    }

    // TOT AREA & SRT PT
    setCell(ws, 'J3', smartNum(calc.totalCuttingLength), { fill: S.green });
    setCell(ws, 'K3', calc.startPoints, { fill: S.green });

    // Thickness/cost rows — circular starts at Row 2 in template
    const totalValue = writeParts(ws, calc, parts, 2, calc.cuttingRate || 0.022);
    setCell(ws, 'O7', smartNum(totalValue), { fill: S.yellow });

    // Material section — circular starts at Row 2 in template
    writeMaterialSection(ws, calc, parts, 2);

    applyBordersToDataArea(ws, 3, 6, ['B','C','D','E','F','G']);
    applyBordersToDataArea(ws, 3, 6, ['J','K']);
}

// ═══════════════════════════════════════════════════
// RECTANGULAR — "Plane & Hole Shims"
// ═══════════════════════════════════════════════════
function generateRectangular(ws, extracted, calc, companyName) {
    setColWidths(ws);
    writeTitle(ws, companyName);

    // Headers — exact match
    setHeaders(ws, [
        ['B2','Size'], ['C2','L'], ['D2','W'], ['E2','AREA'],
        ['F2','HOLE / SLOT (Size)'], ['G2','QTY'], ['H2','AREA'],
        ['J2','TOT AREA'], ['K2','NO SRT PT'],
        ['L2','TH'], ['M2','COST'], ['N2','QTY'], ['O2','VALUE'],
        ['R2','WT'], ['S2','THK'], ['T2','M RATE'], ['U2','Mat COST']
    ]);

    const holes = Array.isArray(extracted.holes) ? extracted.holes : [];
    const parts = Array.isArray(extracted.parts) ? extracted.parts : [];

    // Row 3: dimensions
    setCell(ws, 'C3', calc.blankL, { fill: S.green });
    setCell(ws, 'D3', calc.blankW, { fill: S.green });
    setCell(ws, 'E3', smartNum(calc.outerPerimeter), { fill: S.green });

    // Holes
    const holeLabels = ['Hole 1(Dia)', 'Hole 2(Dia)', 'Hole 3(Dia)'];
    for (let i = 0; i < 3; i++) {
        const row = 3 + i;
        if (i === 0) setCell(ws, `B${row+1}`, 'Plane & Hole\nShims', { font: S.hdr, fill: S.pink });
        if (i > 0) {
            setCell(ws, `C${row}`, holeLabels[i]);
        }
        if (holes[i]) {
            const dia = parseFloat(holes[i].diameter) || 0;
            const cnt = parseInt(holes[i].count) || 0;
            setCell(ws, `F${row}`, dia);
            setCell(ws, `G${row}`, cnt);
            setCell(ws, `H${row}`, { formula: `3.14*F${row}*G${row}`, result: smartNum(3.14 * dia * cnt) });
        } else {
            setCell(ws, `F${row}`, 0);
            setCell(ws, `G${row}`, 0);
            setCell(ws, `H${row}`, { formula: `3.14*F${row}*G${row}`, result: 0 });
        }
    }

    // Slots section (empty for rectangular)
    setCell(ws, 'B6', 'Slotted Shims', { font: S.hdr, fill: S.pink });
    const slotLabels = ['Slot 1 Length','Slot 1 Radius','Slot 2 Length','Slot 2 Radius'];
    for (let i = 0; i < 4; i++) {
        const row = 6 + i;
        setCell(ws, `C${row}`, slotLabels[i]);
        setCell(ws, `F${row}`, 0);
        setCell(ws, `G${row}`, 0);
        const cellH = ws.getCell(`H${row}`);
        if (i % 2 === 0) {
            cellH.value = { formula: `F${row}*G${row}`, result: 0 };
        } else {
            cellH.value = { formula: `3.14*F${row}*G${row}`, result: 0 };
        }
        cellH.font = S.data;
        cellH.border = S.border;
    }

    // TOT AREA & SRT PT
    setCell(ws, 'J3', smartNum(calc.totalCuttingLength), { fill: S.green });
    setCell(ws, 'K3', calc.startPoints, { fill: S.green });

    // Thickness rows
    const totalValue = writeParts(ws, calc, parts, 3, calc.cuttingRate || 0.022);
    setCell(ws, 'O8', smartNum(totalValue), { fill: S.yellow });

    writeMaterialSection(ws, calc, parts);
    applyBordersToDataArea(ws, 3, 9, ['B','C','D','E','F','G','H']);
}

// ═══════════════════════════════════════════════════
// SLOTTED — "Slotted Shims" (with Plane & Hole header)
// ═══════════════════════════════════════════════════
function generateSlotted(ws, extracted, calc, companyName) {
    setColWidths(ws);
    writeTitle(ws, companyName);

    setHeaders(ws, [
        ['B2','Size'], ['C2','L'], ['D2','W'], ['E2','AREA'],
        ['F2','HOLE / SLOT (Size)'], ['G2','QTY'], ['H2','AREA'],
        ['J2','TOT AREA'], ['K2','NO SRT PT'],
        ['L2','TH'], ['M2','COST'], ['N2','QTY'], ['O2','VALUE'],
        ['R2','WT'], ['S2','THK'], ['T2','M RATE'], ['U2','Mat COST']
    ]);

    const holes = Array.isArray(extracted.holes) ? extracted.holes : [];
    const parts = Array.isArray(extracted.parts) ? extracted.parts : [];
    const slots = calc.slotDisplayData || [];

    // Row 3: dimensions
    setCell(ws, 'C3', calc.blankL, { fill: S.green });
    setCell(ws, 'D3', calc.blankW, { fill: S.green });
    setCell(ws, 'E3', smartNum(calc.outerPerimeter), { fill: S.green });

    // Row 3-5: Holes
    setCell(ws, 'B4', 'Plane & Hole\nShims', { font: S.hdr, fill: S.pink });
    const holeLabels = ['Hole 1(Dia)', 'Hole 2(Dia)', 'Hole 3(Dia)'];
    for (let i = 0; i < 3; i++) {
        const row = 3 + i;
        if (i > 0) {
            setCell(ws, `C${row}`, holeLabels[i]);
        }
        if (holes[i]) {
            const dia = parseFloat(holes[i].diameter) || 0;
            const cnt = parseInt(holes[i].count) || 0;
            setCell(ws, `F${row}`, dia);
            setCell(ws, `G${row}`, cnt);
            setCell(ws, `H${row}`, { formula: `3.14*F${row}*G${row}`, result: smartNum(3.14 * dia * cnt) });
        } else {
            setCell(ws, `F${row}`, 0);
            setCell(ws, `G${row}`, 0);
            setCell(ws, `H${row}`, { formula: `3.14*F${row}*G${row}`, result: 0 });
        }
    }

    // Row 6-9: Slots
    setCell(ws, 'B6', 'Slotted Shims', { font: S.hdr, fill: S.pink });
    for (let si = 0; si < 2; si++) {
        const lenRow = 6 + si * 2;
        const radRow = 7 + si * 2;
        if (slots[si]) {
            const sLen = parseFloat(slots[si].length) || 0;
            const sRad = parseFloat(slots[si].radius) || 0;
            const sCnt = parseInt(slots[si].count) || 0;
            const lenQty = slots[si].lengthQty !== undefined && slots[si].lengthQty !== null ? slots[si].lengthQty : (sCnt * 2);
            const radQty = slots[si].radiusQty !== undefined && slots[si].radiusQty !== null ? slots[si].radiusQty : sCnt;
            setCell(ws, `C${lenRow}`, `Slot ${si+1} Length`);
            setCell(ws, `F${lenRow}`, smartNum(sLen));
            setCell(ws, `G${lenRow}`, lenQty);
            const cellH_len = ws.getCell(`H${lenRow}`);
            cellH_len.value = { formula: `F${lenRow}*G${lenRow}`, result: smartNum(sLen * lenQty) };
            cellH_len.font = S.data;
            cellH_len.border = S.border;
            cellH_len.fill = S.green;

            setCell(ws, `C${radRow}`, `Slot ${si+1} Radius`);
            setCell(ws, `F${radRow}`, smartNum(sRad));
            setCell(ws, `G${radRow}`, radQty);
            const cellH_rad = ws.getCell(`H${radRow}`);
            cellH_rad.value = { formula: `3.14*F${radRow}*G${radRow}`, result: smartNum(3.14 * sRad * radQty) };
            cellH_rad.font = S.data;
            cellH_rad.border = S.border;
            cellH_rad.fill = S.green;
        } else {
            setCell(ws, `C${lenRow}`, `Slot ${si+1} Length`);
            setCell(ws, `F${lenRow}`, 0);
            setCell(ws, `G${lenRow}`, 0);
            const cellH_len = ws.getCell(`H${lenRow}`);
            cellH_len.value = { formula: `F${lenRow}*G${lenRow}`, result: 0 };
            cellH_len.font = S.data;
            cellH_len.border = S.border;

            setCell(ws, `C${radRow}`, `Slot ${si+1} Radius`);
            setCell(ws, `F${radRow}`, 0);
            setCell(ws, `G${radRow}`, 0);
            const cellH_rad = ws.getCell(`H${radRow}`);
            cellH_rad.value = { formula: `3.14*F${radRow}*G${radRow}`, result: 0 };
            cellH_rad.font = S.data;
            cellH_rad.border = S.border;
        }
    }

    // TOT AREA & SRT PT
    setCell(ws, 'J3', smartNum(calc.totalCuttingLength), { fill: S.green });
    setCell(ws, 'K3', calc.startPoints, { fill: S.green });

    const totalValue = writeParts(ws, calc, parts, 3, calc.cuttingRate || 0.022);
    setCell(ws, 'O8', smartNum(totalValue), { fill: S.yellow });

    writeMaterialSection(ws, calc, parts);
    applyBordersToDataArea(ws, 3, 9, ['B','C','D','E','F','G','H']);
}

// ═══════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════
async function generateExcel(extracted, calculation) {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Shim Formula Sheet');
    const type = calculation.formulaType || 'rectangular';

    switch (type) {
        case 'circular': generateCircular(ws, extracted, calculation); break;
        case 'slotted': generateSlotted(ws, extracted, calculation); break;
        default: generateRectangular(ws, extracted, calculation); break;
    }

    // Drawing info at bottom
    ws.getCell('B11').value = 'Drawing Type:';
    ws.getCell('C11').value = type.charAt(0).toUpperCase() + type.slice(1);
    ws.getCell('C11').font = { ...S.hdr, color: { argb: 'FF006600' } };
    ws.getCell('B12').value = 'Part Name:';
    ws.getCell('C12').value = extracted.part_name || '-';
    ws.getCell('B13').value = 'Drawing No:';
    ws.getCell('C13').value = extracted.drawing_no || '-';
    ws.getCell('B14').value = 'Material:';
    ws.getCell('C14').value = extracted.material || 'MS';

    return workbook;
}

async function generateMultiExcel(items, companyName) {
    const workbook = new ExcelJS.Workbook();

    // Add Combined summary sheet
    const combinedWs = workbook.addWorksheet('Combined');
    generateCombinedSheet(combinedWs, items, companyName);

    return workbook;
}

// ═══════════════════════════════════════════════════
// Combined summary sheet generation matching FINALEXCEL
// ═══════════════════════════════════════════════════
const C_STYLES = {
    fontCambria: (size, bold, color = 'FF000000') => ({
        name: 'Cambria',
        size,
        bold,
        color: { argb: color }
    }),
    fillSolid: (hex) => ({
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hex }
    }),
    borderMediumTopBottom: {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } }
    },
    borderMediumTopBottomThinLeftRight: {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    },
    borderThinBottomLeftRight: {
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    }
};

function generateCombinedSheet(ws, items, companyName) {
    // Set exact column widths matching FINALEXCEL
    ws.columns = [
        { width: 9.3 },  // Sr. No.
        { width: 16.6 }, // Item Cd
        { width: 33.6 }, // Description
        { width: 15.0 }, // Po Qty
        { width: 12.9 }, // Rate
        { width: 15.1 }  // Amount
    ];

    const cName = (companyName || 'MAHEK INDUSTRIES').toUpperCase();
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    const quoteNo = 'MI/01/26-27';

    // Row 1: Company Name
    ws.mergeCells('A1:F1');
    const r1 = ws.getRow(1);
    r1.height = 34.5;
    const cell1 = r1.getCell(1);
    cell1.value = cName;
    cell1.font = C_STYLES.fontCambria(36, true, 'FFFFFFFF');
    cell1.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = 1; col <= 6; col++) {
        r1.getCell(col).fill = C_STYLES.fillSolid('FFB25E25');
        r1.getCell(col).border = C_STYLES.borderMediumTopBottom;
    }

    // Row 2: Title
    ws.mergeCells('A2:F2');
    const r2 = ws.getRow(2);
    r2.height = 35.25;
    const cell2 = r2.getCell(1);
    cell2.value = 'QUOTATION With Mtl';
    cell2.font = C_STYLES.fontCambria(20, true, 'FF000000');
    cell2.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = 1; col <= 6; col++) {
        r2.getCell(col).fill = C_STYLES.fillSolid('FFF4B183');
        r2.getCell(col).border = C_STYLES.borderMediumTopBottom;
    }

    // Row 3: Quotation info
    ws.mergeCells('A3:F3');
    const r3 = ws.getRow(3);
    r3.height = 15;
    const cell3 = r3.getCell(1);
    cell3.value = `Quotation no:${quoteNo}                                                                                                        Quotation Date:${formattedDate}`;
    cell3.font = C_STYLES.fontCambria(11, true, 'FF000000');
    cell3.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = 1; col <= 6; col++) {
        r3.getCell(col).fill = C_STYLES.fillSolid('FFF4B183');
        r3.getCell(col).border = C_STYLES.borderMediumTopBottom;
    }

    // Row 4: Column Headers
    const headers = ['Sr. No.', 'Item Cd', 'Description', 'Po Qty', 'Rate', 'Amount'];
    const r4 = ws.getRow(4);
    r4.height = 27;
    headers.forEach((h, idx) => {
        const cell = r4.getCell(idx + 1);
        cell.value = h;
        cell.font = C_STYLES.fontCambria(11, true, 'FF000000');
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = C_STYLES.fillSolid('FFFBE5D6');
        cell.border = C_STYLES.borderMediumTopBottomThinLeftRight;
    });

    // Rows 5+: Data rows
    items.forEach((item, index) => {
        const rIdx = 5 + index;
        const row = ws.getRow(rIdx);
        row.height = 18;

        const poQty = item.calculation.orderQuantity || 1;
        const unitRate = item.calculation.unitFinalAmount || item.calculation.finalAmount;

        const vals = [
            index + 1,
            item.extracted.drawing_no || item.extracted.part_name || '-',
            item.extracted.part_name || '-',
            poQty,
            unitRate,
            { formula: `D${rIdx}*E${rIdx}`, result: poQty * unitRate }
        ];

        vals.forEach((val, colIdx) => {
            const cell = row.getCell(colIdx + 1);
            cell.value = val;
            cell.font = C_STYLES.fontCambria(11, false, 'FF000000');
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = C_STYLES.fillSolid('FFD9D9D9');
            cell.border = C_STYLES.borderThinBottomLeftRight;

            if (colIdx >= 3) {
                cell.numFmt = '0.00';
            }
        });
    });

    // Bottom Row: Totals
    const totRIdx = 5 + items.length;
    const totRow = ws.getRow(totRIdx);
    totRow.height = 31.5;

    for (let col = 1; col <= 6; col++) {
        const cell = totRow.getCell(col);
        cell.font = C_STYLES.fontCambria(12, true, 'FF000000');
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = C_STYLES.fillSolid('FFFFE699');
        cell.border = C_STYLES.borderMediumTopBottomThinLeftRight;
        
        if (col === 4) {
            cell.value = { formula: `SUM(D5:D${totRIdx - 1})` };
            cell.numFmt = '0.00';
        } else if (col === 6) {
            cell.value = { formula: `SUM(F5:F${totRIdx - 1})` };
            cell.numFmt = '0.00';
        }
    }
}

module.exports = { generateExcel, generateMultiExcel };

