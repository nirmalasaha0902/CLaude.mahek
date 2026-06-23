const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { matchMaterial, getMaterialRate, getDensity, parseParts, parseHoles, parseSlots, calculateHoles, getSlotLength } = require('./shared');


/**
 * Parses and evaluates all formulas in a sheet after injecting manual input overrides.
 */
function evaluateExcelSheet(filePath, inputs, cuttingRate = 0.022) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Load sheet cells into our dictionary
    const sheetCells = {};
    Object.keys(sheet).forEach(key => {
        if (key.startsWith('!')) return;
        sheetCells[key] = {
            value: sheet[key].v,
            formula: sheet[key].f
        };
    });

    // Inject override inputs
    Object.keys(inputs).forEach(key => {
        if (key.startsWith('__FORMULA_')) {
            const targetCell = key.replace('__FORMULA_', '');
            if (!sheetCells[targetCell]) sheetCells[targetCell] = {};
            sheetCells[targetCell].formula = inputs[key];
        } else {
            if (!sheetCells[key]) sheetCells[key] = {};
            sheetCells[key].value = inputs[key];
        }
    });

    // Ensure all part rows have correct formulas to fix template spreadsheet discrepancies
    const isCircle = filePath.toUpperCase().includes('CIRCLE') || (sheetCells['B2'] && String(sheetCells['B2'].value).includes('Round'));
    if (isCircle) {
        // Circle template uses rows 2 to 5 for parts
        for (let r = 2; r <= 5; r++) {
            const thCell = `L${r}`;
            const th = inputs[thCell] !== undefined ? parseFloat(inputs[thCell]) : (sheetCells[thCell] ? parseFloat(sheetCells[thCell].value) : 0);
            const mult = cuttingRate;

            if (!sheetCells[`M${r}`]) sheetCells[`M${r}`] = {};
            sheetCells[`M${r}`].formula = `J2*L${r}*${mult}+(K2*2)`;
            if (!sheetCells[`O${r}`]) sheetCells[`O${r}`] = {};
            sheetCells[`O${r}`].formula = `M${r}*N${r}`;
        }
    } else {
        // Slotted and Rectangular templates use rows 3 to 6 for parts
        for (let r = 3; r <= 6; r++) {
            const thCell = `L${r}`;
            const th = inputs[thCell] !== undefined ? parseFloat(inputs[thCell]) : (sheetCells[thCell] ? parseFloat(sheetCells[thCell].value) : 0);
            const mult = cuttingRate;

            if (!sheetCells[`M${r}`]) sheetCells[`M${r}`] = {};
            sheetCells[`M${r}`].formula = `J3*L${r}*${mult}+(K3+K4)*2`;
            if (!sheetCells[`O${r}`]) sheetCells[`O${r}`] = {};
            sheetCells[`O${r}`].formula = `M${r}*N${r}`;
        }
    }

    const evaluatedCells = {};

    function getCellValue(cellId) {
        if (evaluatedCells[cellId] !== undefined) {
            return evaluatedCells[cellId];
        }

        const cell = sheetCells[cellId];
        if (!cell) {
            return 0;
        }

        if (cell.formula) {
            let formula = cell.formula;
            // Handle SUM function
            if (formula.startsWith('SUM(')) {
                const rangeMatch = formula.match(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/);
                if (rangeMatch) {
                    const startCell = rangeMatch[1];
                    const endCell = rangeMatch[2];
                    const startCol = startCell.match(/[A-Z]+/)[0];
                    const startRow = parseInt(startCell.match(/\d+/)[0]);
                    const endCol = endCell.match(/[A-Z]+/)[0];
                    const endRow = parseInt(endCell.match(/\d+/)[0]);

                    let sum = 0;
                    for (let r = startRow; r <= endRow; r++) {
                        sum += getCellValue(`${startCol}${r}`);
                    }
                    evaluatedCells[cellId] = sum;
                    return sum;
                }
            }

            // Replace cell references
            const cellRefs = formula.match(/[A-Z]+\d+/g) || [];
            // Sort by length descending so longer cell IDs (e.g. J10) get replaced before shorter ones (e.g. J1)
            cellRefs.sort((a, b) => b.length - a.length);

            let evalFormula = formula;
            for (const ref of cellRefs) {
                const refVal = getCellValue(ref);
                const regex = new RegExp(`\\b${ref}\\b`, 'g');
                evalFormula = evalFormula.replace(regex, `(${refVal})`);
            }

            try {
                evalFormula = evalFormula.replace(/\+\-/g, '-').replace(/\-\+/g, '-');
                const result = new Function(`return ${evalFormula}`)();
                evaluatedCells[cellId] = result;
                return result;
            } catch (e) {
                console.error(`[ExcelFormulaEvaluator] Error evaluating cell ${cellId} (formula: ${formula}, eval: ${evalFormula}):`, e.message);
                return 0;
            }
        } else {
            const val = parseFloat(cell.value);
            return isNaN(val) ? 0 : val;
        }
    }

    // Resolve all cells
    Object.keys(sheetCells).forEach(cellId => {
        getCellValue(cellId);
    });

    return evaluatedCells;
}

/**
 * Loads the Excel formula spreadsheet, inputs parsed dimensions, runs evaluation, and returns computed results.
 */
function calculatePricingFromExcel(drawingType, extracted, userMaterialRate, userCuttingRate) {
    const material = matchMaterial(extracted.material);
    const rate = getMaterialRate(material, userMaterialRate);
    const density = getDensity(material);

    // Calculate dimensions
    const drawingL = parseFloat(extracted.L) || 0;
    const drawingW = parseFloat(extracted.W) || 0;
    const drawingD = parseFloat(extracted.D) || 0;

    const L = drawingL + (drawingL > 0 ? 10 : 0);
    const W = drawingW + (drawingW > 0 ? 10 : 0);
    const D = drawingD + (drawingD > 0 ? 10 : 0);

    const parts = parseParts(extracted);
    const holes = parseHoles(extracted);
    const { holesPerimeter } = calculateHoles(holes);

    let templateFile = '';
    let inputs = {};
    let outputMap = {};

    const publicDir = path.join(__dirname, 'templates');

    if (drawingType === 'circular') {
        templateFile = path.join(publicDir, 'SHIMFORMULA_CIRCLE.xlsx');
        
        // Prepare inputs for CIRCLE
        inputs['D2'] = D;
        
        // Holes (up to 3)
        for (let i = 0; i < 3; i++) {
            const row = 2 + i;
            if (holes[i]) {
                inputs[`F${row}`] = parseFloat(holes[i].diameter) || 0;
                inputs[`G${row}`] = parseInt(holes[i].count) || 0;
            } else {
                inputs[`F${row}`] = 0;
                inputs[`G${row}`] = 0;
            }
        }

        // Parts (up to 4)
        for (let i = 0; i < 4; i++) {
            const row = 2 + i;
            if (parts[i]) {
                inputs[`L${row}`] = parseFloat(parts[i].thickness) || 0;
                inputs[`N${row}`] = parseInt(parts[i].quantity) || 0;
            } else {
                inputs[`L${row}`] = 0;
                inputs[`N${row}`] = 0;
            }
        }

        // Material Rate
        inputs['T2'] = rate;

        outputMap = {
            outerPerimeter: 'E2',
            totalCuttingLength: 'J2',
            startPoints: 'K2',
            machiningCost: 'O7',
            weight: 'R2',
            materialCost: 'U2',
            finalAmount: 'U3'
        };

    } else if (drawingType === 'slotted') {
        templateFile = path.join(publicDir, 'SHIMFORMULA_SLOTTED.xlsx');

        // Prepare inputs for SLOTTED
        inputs['C3'] = L;
        inputs['D3'] = W;

        // Holes (up to 3)
        for (let i = 0; i < 3; i++) {
            const row = 3 + i;
            if (holes[i]) {
                inputs[`F${row}`] = parseFloat(holes[i].diameter) || 0;
                inputs[`G${row}`] = parseInt(holes[i].count) || 0;
            } else {
                inputs[`F${row}`] = 0;
                inputs[`G${row}`] = 0;
            }
        }

        // Slots - Dynamic (Unlimited)
        const slotDisplayData = parseSlots(extracted, drawingL, drawingW, L, W);
        const maxSlots = Math.max(slotDisplayData.length, 2); // Show at least 2 slots for UI consistency
        
        for (let si = 0; si < maxSlots; si++) {
            const lenRow = 6 + si * 2;
            const radRow = 7 + si * 2;
            
            if (slotDisplayData[si]) {
                const s = slotDisplayData[si];
                inputs[`F${lenRow}`] = s.length;
                inputs[`C${lenRow}`] = s.length;
                inputs[`G${lenRow}`] = s.lengthQty !== undefined ? s.lengthQty : s.count * 2;
                inputs[`F${radRow}`] = s.radius;
                inputs[`C${radRow}`] = s.radius;
                inputs[`G${radRow}`] = s.radiusQty !== undefined ? s.radiusQty : s.count;
                // Add formulas for dynamically created rows
                inputs[`__FORMULA_H${lenRow}`] = `F${lenRow}*G${lenRow}`;
                inputs[`__FORMULA_H${radRow}`] = `3.14*F${radRow}*G${radRow}`;
            } else {
                inputs[`F${lenRow}`] = 0; inputs[`C${lenRow}`] = 0; inputs[`G${lenRow}`] = 0;
                inputs[`F${radRow}`] = 0; inputs[`C${radRow}`] = 0; inputs[`G${radRow}`] = 0;
                inputs[`__FORMULA_H${lenRow}`] = `F${lenRow}*G${lenRow}`;
                inputs[`__FORMULA_H${radRow}`] = `3.14*F${radRow}*G${radRow}`;
            }
        }
        
        // Dynamically override J3 to include ALL slot rows
        // J3 = E3 (outer perimeter) + H3:H5 (holes) + H6... (slots)
        let j3Formula = 'E3+H3+H4+H5';
        for (let si = 0; si < maxSlots; si++) {
            j3Formula += `+H${6 + si*2}+H${7 + si*2}`;
        }
        inputs['__FORMULA_J3'] = j3Formula;

        // Parts
        for (let i = 0; i < 4; i++) {
            const row = 3 + i;
            if (parts[i]) {
                inputs[`L${row}`] = parseFloat(parts[i].thickness) || 0;
                inputs[`N${row}`] = parseInt(parts[i].quantity) || 0;
            } else {
                inputs[`L${row}`] = 0;
                inputs[`N${row}`] = 0;
            }
        }

        // Material Rate
        inputs['T3'] = rate;

        outputMap = {
            outerPerimeter: 'E3',
            totalCuttingLength: 'J3',
            startPoints: 'K3',
            machiningCost: 'O8',
            weight: 'R3',
            materialCost: 'U3',
            finalAmount: 'U4'
        };

    } else {
        // default: rectangular
        templateFile = path.join(publicDir, 'SHIMFORMULA_RECTANGULAR.xlsx');

        // Prepare inputs for RECTANGULAR
        inputs['C3'] = L;
        inputs['D3'] = W;

        // Holes
        for (let i = 0; i < 3; i++) {
            const row = 3 + i;
            if (holes[i]) {
                inputs[`F${row}`] = parseFloat(holes[i].diameter) || 0;
                inputs[`G${row}`] = parseInt(holes[i].count) || 0;
            } else {
                inputs[`F${row}`] = 0;
                inputs[`G${row}`] = 0;
            }
        }

        // Slots are 0
        inputs['F6'] = 0; inputs['G6'] = 0;
        inputs['F7'] = 0; inputs['G7'] = 0;
        inputs['F8'] = 0; inputs['G8'] = 0;
        inputs['F9'] = 0; inputs['G9'] = 0;

        // Parts
        for (let i = 0; i < 4; i++) {
            const row = 3 + i;
            if (parts[i]) {
                inputs[`L${row}`] = parseFloat(parts[i].thickness) || 0;
                inputs[`N${row}`] = parseInt(parts[i].quantity) || 0;
            } else {
                inputs[`L${row}`] = 0;
                inputs[`N${row}`] = 0;
            }
        }

        // Material Rate
        inputs['T3'] = rate;

        outputMap = {
            outerPerimeter: 'E3',
            totalCuttingLength: 'J3',
            startPoints: 'K3',
            machiningCost: 'O8',
            weight: 'R3',
            materialCost: 'U3',
            finalAmount: 'U4'
        };
    }

    const cuttingRate = parseFloat(userCuttingRate) || 0.022;

    // Evaluate sheet cells
    const results = evaluateExcelSheet(templateFile, inputs, cuttingRate);

    // Apply material density scaling factors (reference formulas assume MS density of 7.85)
    const densityFactor = density / 7.85;

    const orderQuantity = parseInt(extracted.orderQuantity || extracted.order_quantity || 1) || 1;

    const rawWeight = parseFloat(results[outputMap.weight]) || 0;
    const finalWeight = rawWeight * densityFactor;

    const rawMaterialCost = parseFloat(results[outputMap.materialCost]) || 0;
    const finalMaterialCost = rawMaterialCost * densityFactor;

    const rawMachiningCost = parseFloat(results[outputMap.machiningCost]) || 0;
    
    // Single unit final amount
    const unitFinalAmount = (rawMachiningCost + finalMaterialCost) * 1.2;

    // Multiplied final totals
    const finalWeightMultiplied = finalWeight * orderQuantity;
    const finalMaterialCostMultiplied = finalMaterialCost * orderQuantity;
    const rawMachiningCostMultiplied = rawMachiningCost * orderQuantity;
    const finalAmountMultiplied = unitFinalAmount * orderQuantity;

    // Slots perimeter calculation
    let slotsPerimeter = 0;
    let slotDisplayData = [];
    if (drawingType === 'slotted') {
        const maxSlots = Math.max((extracted.slots || []).length, 2);
        for(let si=0; si < maxSlots; si++) {
            slotsPerimeter += (parseFloat(results[`H${6 + si*2}`]) || 0);
            slotsPerimeter += (parseFloat(results[`H${7 + si*2}`]) || 0);
        }

        if (Array.isArray(extracted.slots)) {
            for (const s of extracted.slots) {
                const sCenterFromEdge = parseFloat(s.slot_center_from_edge) || 0;
                let sLen = getSlotLength(drawingL, drawingW, sCenterFromEdge, s.length, extracted.slot_direction_dimension, L, W);
                const sRad = parseFloat(s.radius) || 0;
                const sCount = parseInt(s.count) || 0;
                if (sCount > 0) {
                    slotDisplayData.push({ length: sLen, radius: sRad, count: sCount });
                }
            }
        }
    }

    return {
        formulaType: drawingType,
        blankL: L,
        blankW: W,
        blankD: D,
        outerPerimeter: Math.round(parseFloat(results[outputMap.outerPerimeter]) || 0),
        role: undefined,
        holePerimeter: Math.round(holesPerimeter),
        slotsPerimeter: Math.round(slotsPerimeter),
        slotDisplayData: slotDisplayData,
        totalCuttingLength: Math.round(parseFloat(results[outputMap.totalCuttingLength]) || 0),
        startPoints: parseInt(results[outputMap.startPoints]) || 0,
        weight: Number((finalWeightMultiplied).toFixed(3)),
        materialRate: rate,
        materialCost: Math.round(finalMaterialCostMultiplied),
        machiningCost: Math.round(rawMachiningCostMultiplied),
        finalAmount: Math.round(finalAmountMultiplied),
        unitFinalAmount: Math.round(Math.round(finalAmountMultiplied) / orderQuantity),
        orderQuantity: orderQuantity,
        totalQty: parts.reduce((sum, p) => sum + (parseInt(p.quantity) || 1), 0),
        cuttingRate: cuttingRate
    };
}

module.exports = {
    calculatePricingFromExcel
};
