/**
 * CIRCULAR (Round & Hole) Shim Formula
 * ======================================
 * Excel Reference: "Round & Hole Shim" section
 *
 * Verified Example (from Excel screenshot):
 *   Dia=35(blank), HOLE DIA=13, NO HOLES=1
 *   AREA = 3.14 × 35 = 109.9
 *   HOLE AREA = 3.14 × 13 × 1 = 40.82
 *   TOT AREA = 109.9 + 40.82 = 150.72 ≈ 151
 *   NO SRT PT = 1(hole) + 1(outer) = 2
 *   TH=4.0: COST = 151 × 4 × 0.022 + 2×2 = 17.29 → 17
 *   WT = 35² × 0.000006262 = 0.008
 *   THK=4, M RATE=84, Mat COST=3
 *   FINAL = (17.26 + 2.58) × 1.2 = 23.81
 */

const {
    matchMaterial, getMaterialRate, getDensity,
    parseParts, parseHoles, calculateHoles,
    calculateMachiningCost, calculateFinal,
    roundWhole, round2
} = require('./shared');

function calculateCircular(extracted, userMaterialRate) {
    const material = matchMaterial(extracted.material);
    const rate = getMaterialRate(material, userMaterialRate);
    const density = getDensity(material);

    // Raw drawing diameter
    const drawingD = parseFloat(extracted.D) || 0;
    
    // Blank diameter = drawing + 10mm machining allowance
    const D = drawingD + (drawingD > 0 ? 10 : 0);

    // Parse input data
    const parts = parseParts(extracted);
    const holes = parseHoles(extracted);
    const { holesPerimeter, totalHolesCount } = calculateHoles(holes);

    // ──────────────────────────────────────────────
    // OUTER PERIMETER (AREA in Excel)
    // Excel: 3.14 × Dia (uses BLANK diameter)
    // Example: 3.14 × 35 = 109.9
    // ──────────────────────────────────────────────
    const outerPerimeter = 3.14 * D;

    // ──────────────────────────────────────────────
    // TOTAL CUTTING LENGTH (TOT AREA in Excel)
    // Excel: AREA + HOLE AREA
    // Example: 109.9 + 40.82 = 150.72
    // ──────────────────────────────────────────────
    const totalCuttingLength = outerPerimeter + holesPerimeter;

    // ──────────────────────────────────────────────
    // START POINTS (NO SRT PT in Excel)
    // 1 for outer contour + 1 per internal hole
    // Example: 1 + 1 = 2
    // ──────────────────────────────────────────────
    const startPoints = 1 + totalHolesCount;

    // ──────────────────────────────────────────────
    // MACHINING COST
    // Excel: COST = TOT_AREA × TH × 0.022 + NO_SRT_PT × 2
    // Example: 150.72 × 4 × 0.022 + 2×2 = 17.26
    // ──────────────────────────────────────────────
    const { totalMachiningCost, totalThicknessQty } = calculateMachiningCost(
        totalCuttingLength, startPoints, parts
    );

    // ──────────────────────────────────────────────
    // WEIGHT (WT in Excel)
    // Excel: D × D × 0.000006262 (for MS, density 7.85)
    // Adjusted for other materials: × (density / 7.85)
    // Example: 35 × 35 × 0.000006262 = 0.00767 ≈ 0.008
    // ──────────────────────────────────────────────
    const weightPerMm = D * D * (0.000006262 / 7.85) * density;

    // ──────────────────────────────────────────────
    // MATERIAL COST
    // Excel: WT × THK × M_RATE
    // Example: 0.00767 × 4 × 84 = 2.58
    // ──────────────────────────────────────────────
    const totalMaterialCost = weightPerMm * totalThicknessQty * rate;

    // ──────────────────────────────────────────────
    // FINAL AMOUNT
    // Excel: (Machining VALUE + Material COST) × 1.2
    // Example: (17.26 + 2.58) × 1.2 = 23.81
    // ──────────────────────────────────────────────
    const finalAmount = calculateFinal(totalMachiningCost, totalMaterialCost);

    return {
        formulaType: 'circular',
        blankL: 0,
        blankW: 0,
        blankD: D,
        outerPerimeter: roundWhole(outerPerimeter),
        holePerimeter: roundWhole(holesPerimeter),
        slotsPerimeter: 0,
        slotDisplayData: [],
        totalCuttingLength: roundWhole(totalCuttingLength),
        startPoints: startPoints,
        weight: Number((weightPerMm).toFixed(3)),
        materialRate: rate,
        materialCost: roundWhole(totalMaterialCost),
        machiningCost: roundWhole(totalMachiningCost),
        finalAmount: roundWhole(finalAmount),
        totalQty: parts.reduce((sum, p) => sum + (parseInt(p.quantity) || 1), 0)
    };
}

module.exports = calculateCircular;
