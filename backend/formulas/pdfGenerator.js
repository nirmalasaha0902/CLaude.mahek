/**
 * PDF Generator — Generates beautiful PDF reports matching the Excel quotation layouts.
 * Uses pdfkit.
 */
const PDFDocument = require('pdfkit');

// Helper to convert doc to buffer asynchronously
function docToBuffer(doc) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));
    });
}

// Format numbers
function formatNum(v, decimals = 2) {
    if (v === 0 || v === null || v === undefined) return '0.00';
    return parseFloat(v).toFixed(decimals);
}

/**
 * Generate a single item report PDF
 */
async function generateSinglePdf(extracted, calc) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    
    // Header Banner
    doc.rect(40, 40, 515, 50).fill('#B25E25');
    doc.fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .fontSize(18)
       .text('SHIM SPECIFICATION SHEET', 40, 55, { width: 515, align: 'center' });
       
    // Spacer
    doc.moveDown(2);
    
    // Drawing details section
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12).text('Drawing Information', 40, 110);
    doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(40, 125).lineTo(555, 125).stroke();
    
    // Grid layout for info
    const infoY = 135;
    doc.font('Helvetica-Bold').fontSize(9).text('Part Name:', 40, infoY);
    doc.font('Helvetica').text(extracted.part_name || '-', 120, infoY);
    
    doc.font('Helvetica-Bold').text('Drawing No:', 280, infoY);
    doc.font('Helvetica').text(extracted.drawing_no || '-', 360, infoY);
    
    doc.font('Helvetica-Bold').text('Drawing Type:', 40, infoY + 18);
    const type = calc.formulaType || 'rectangular';
    doc.font('Helvetica').text(type.charAt(0).toUpperCase() + type.slice(1), 120, infoY + 18);
    
    doc.font('Helvetica-Bold').text('Material:', 280, infoY + 18);
    doc.font('Helvetica').text(extracted.material || 'MS', 360, infoY + 18);
    
    // Dimension Table
    doc.moveDown(3);
    const tblY = 190;
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12).text('Calculations & Specifications', 40, tblY);
    doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(40, tblY + 15).lineTo(555, tblY + 15).stroke();
    
    // Specifications table
    let specRowY = tblY + 25;
    const drawRow = (label, val, unit = 'mm') => {
        doc.font('Helvetica-Bold').fontSize(9).text(label, 50, specRowY);
        doc.font('Helvetica').text(`${val} ${unit}`, 250, specRowY, { align: 'right', width: 250 });
        doc.strokeColor('#EEEEEE').lineWidth(0.5).moveTo(40, specRowY + 12).lineTo(555, specRowY + 12).stroke();
        specRowY += 18;
    };
    
    if (type === 'circular') {
        drawRow('Blank Outer Diameter', calc.blankD);
        drawRow('Outer Area (Perimeter)', formatNum(calc.outerPerimeter));
        drawRow('Hole Area (Perimeter)', formatNum(calc.holePerimeter));
    } else {
        drawRow('Blank Length (L)', calc.blankL);
        drawRow('Blank Width (W)', calc.blankW);
        drawRow('Outer Area (Perimeter)', formatNum(calc.outerPerimeter));
        drawRow('Hole Area (Perimeter)', formatNum(calc.holePerimeter));
        
        if (type === 'slotted') {
            const slots = calc.slotDisplayData || [];
            slots.forEach((s, idx) => {
                drawRow(`Slot ${idx+1} Length`, s.length);
                drawRow(`Slot ${idx+1} Radius`, s.radius);
                drawRow(`Slot ${idx+1} Quantity`, s.count, 'pcs');
            });
            drawRow('Slots Area (Perimeter)', formatNum(calc.slotsPerimeter));
        }
    }
    
    drawRow('Total Cutting Length (TOT AREA)', formatNum(calc.totalCuttingLength));
    drawRow('Start Points (NO SRT PT)', calc.startPoints, 'points');
    drawRow('Unit Weight (WT)', formatNum(calc.weight, 3), 'kg');
    
    // Thickness rows
    doc.moveDown(1.5);
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(11).text('Machining & Materials Cost breakdown', 50, specRowY + 10);
    specRowY += 28;
    
    // Header for parts
    doc.rect(40, specRowY, 515, 18).fill('#FFF4B183');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);
    doc.text('Thickness (TH)', 45, specRowY + 5);
    doc.text('Machining Cost', 160, specRowY + 5);
    doc.text('Quantity (QTY)', 280, specRowY + 5);
    doc.text('Total Cost', 400, specRowY + 5);
    specRowY += 18;
    
    const parts = extracted.parts || [];
    parts.forEach(p => {
        const th = parseFloat(p.thickness) || 0;
        const q = parseInt(p.quantity) || 0;
        const multiplier = th >= 3 ? (calc.cuttingRate - 0.002) : calc.cuttingRate;
        const cost = th > 0 ? (calc.totalCuttingLength * th * multiplier) + (calc.startPoints * 2) : 0;
        const val = cost * q;
        
        doc.fillColor('#000000').font('Helvetica').fontSize(8);
        doc.text(`${formatNum(th, 2)} mm`, 45, specRowY + 5);
        doc.text(`Rs. ${formatNum(cost)}`, 160, specRowY + 5);
        doc.text(`${q} pcs`, 280, specRowY + 5);
        doc.text(`Rs. ${formatNum(val)}`, 400, specRowY + 5);
        
        doc.strokeColor('#EEEEEE').lineWidth(0.5).moveTo(40, specRowY + 18).lineTo(555, specRowY + 18).stroke();
        specRowY += 18;
    });
    
    // Grand Total Box
    specRowY += 15;
    doc.rect(300, specRowY, 255, 60).fill('#FFE699');
    doc.strokeColor('#CCCCCC').lineWidth(1).rect(300, specRowY, 255, 60).stroke();
    
    const unitMaterialCost = (calc.orderQuantity > 1) ? (calc.materialCost / calc.orderQuantity) : calc.materialCost;
    const unitFinalAmount = calc.unitFinalAmount || Math.round(calc.finalAmount / (calc.orderQuantity || 1));
    
    doc.fillColor('#CC0000').font('Helvetica-Bold').fontSize(10);
    doc.text('MATERIAL COST:', 310, specRowY + 12);
    doc.text(`Rs. ${formatNum(unitMaterialCost)}`, 450, specRowY + 12, { align: 'right', width: 95 });
    
    doc.fontSize(12);
    doc.text('FINAL AMOUNT:', 310, specRowY + 34);
    doc.text(`Rs. ${Math.round(unitFinalAmount)}`, 450, specRowY + 34, { align: 'right', width: 95 });

    doc.end();
    return docToBuffer(doc);
}

/**
 * Generate a multi-item summary quotation PDF
 */
async function generateMultiPdf(items, companyName, quoteNoOverride) {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    
    const cName = (companyName || 'MAHEK INDUSTRIES').toUpperCase();
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    const quoteNo = quoteNoOverride || 'MI/01/26-27';

    // Column x-coordinates
    const colX = {
        sr: 40,
        itemCd: 85,
        desc: 195,
        qty: 345,
        rate: 405,
        amt: 475
    };

    // Helper to draw the header on any page
    const drawPageHeader = () => {
        // 1. Top Company Banner (Brown/Rust)
        doc.rect(40, 40, 515, 45).fill('#B25E25');
        doc.fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .fontSize(22)
           .text(cName, 40, 52, { width: 515, align: 'center' });

        // 2. Subtitle Banner (Light Orange)
        doc.rect(40, 85, 515, 30).fill('#F4B183');
        doc.fillColor('#000000')
           .font('Helvetica-Bold')
           .fontSize(14)
           .text('QUOTATION With Mtl', 40, 93, { width: 515, align: 'center' });

        // 3. Info Block
        doc.rect(40, 115, 515, 20).fill('#F4B183');
        doc.fillColor('#000000')
           .font('Helvetica-Bold')
           .fontSize(9);
        doc.text(`Quotation no: ${quoteNo}`, 50, 121);
        doc.text(`Quotation Date: ${formattedDate}`, 400, 121, { align: 'right', width: 145 });

        // 4. Table Headers
        const tableY = 150;
        doc.rect(40, tableY, 515, 25).fill('#FBE5D6');
        doc.strokeColor('#000000').lineWidth(1).rect(40, tableY, 515, 25).stroke();
        
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);
        
        doc.text('Sr. No.', colX.sr, tableY + 8, { width: 45, align: 'center' });
        doc.text('Item Cd', colX.itemCd, tableY + 8, { width: 110, align: 'center' });
        doc.text('Description', colX.desc, tableY + 8, { width: 150, align: 'center' });
        doc.text('Po Qty', colX.qty, tableY + 8, { width: 60, align: 'center' });
        doc.text('Rate', colX.rate, tableY + 8, { width: 70, align: 'center' });
        doc.text('Amount', colX.amt, tableY + 8, { width: 80, align: 'center' });

        return tableY + 25; // return the starting Y for rows
    };

    let currentY = drawPageHeader();
    let grandTotalQty = 0;
    let grandTotalAmt = 0;

    items.forEach((item, idx) => {
        // Pagination check (if row goes beyond bottom margin 780)
        if (currentY + 22 > 780) {
            doc.addPage();
            currentY = drawPageHeader();
        }

        const poQty = item.calculation.orderQuantity || 1;
        const unitRate = item.calculation.unitFinalAmount || item.calculation.finalAmount;
        const totalAmt = poQty * unitRate;

        grandTotalQty += poQty;
        grandTotalAmt += totalAmt;

        // Alternating row styling or clean background
        doc.rect(40, currentY, 515, 22).fill('#D9D9D9');
        doc.strokeColor('#000000').lineWidth(0.5).rect(40, currentY, 515, 22).stroke();
        
        doc.fillColor('#000000').font('Helvetica').fontSize(9);
        doc.text((idx + 1).toString(), colX.sr, currentY + 7, { width: 45, align: 'center' });
        doc.text(item.extracted.drawing_no || item.extracted.part_name || '-', colX.itemCd, currentY + 7, { width: 110, align: 'center' });
        doc.text(item.extracted.part_name || '-', colX.desc, currentY + 7, { width: 150, align: 'center' });
        doc.text(formatNum(poQty), colX.qty, currentY + 7, { width: 60, align: 'center' });
        doc.text(formatNum(unitRate), colX.rate, currentY + 7, { width: 70, align: 'center' });
        doc.text(formatNum(totalAmt), colX.amt, currentY + 7, { width: 80, align: 'center' });

        currentY += 22;
    });

    // 6. Totals Row
    // Check if totals row fits on page, else paginate
    if (currentY + 30 > 780) {
        doc.addPage();
        currentY = drawPageHeader();
    }

    doc.rect(40, currentY, 515, 30).fill('#FFE699');
    doc.strokeColor('#000000').lineWidth(1).rect(40, currentY, 515, 30).stroke();
    
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
    doc.text('Total', colX.desc, currentY + 10, { width: 150, align: 'center' });
    doc.text(formatNum(grandTotalQty), colX.qty, currentY + 10, { width: 60, align: 'center' });
    doc.text('', colX.rate, currentY + 10, { width: 70, align: 'center' });
    doc.text(formatNum(grandTotalAmt), colX.amt, currentY + 10, { width: 80, align: 'center' });

    doc.end();
    return docToBuffer(doc);
}

module.exports = {
    generateSinglePdf,
    generateMultiPdf
};
