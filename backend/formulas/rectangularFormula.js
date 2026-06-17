/**
 * RECTANGULAR (Plane & Hole) Shim Formula
 * =========================================
 * Excel Reference: "Plane & Hole Shims" section
 *
 * Verified Example (from Excel screenshot):
 *   L=40(blank), W=35(blank), HOLE DIA=7, NO HOLES=2
 *   AREA = (40+35)×2 = 150
 *   HOLE AREA = 3.14 × 7 × 2 = 43.96
 *   TOT AREA = 150 + 43.96 = 193.96 ≈ 194
 *   NO SRT PT = 2(holes) + 0 + 0 + 1(outer) = 3
 *   TH=0.5: COST = 193.96 × 0.5 × 0.022 + 3×2 = 8.13
 *   TH=1.0: COST = 193.96 × 1.0 × 0.022 + 3×2 = 10.27
 *   WT = (40+5)×(35+5)×0.00000786 = 0.01
 *   THK=3, M RATE=84, Mat COST=4
 *   FINAL = (36.80 + 3.57) × 1.2 = 48.44
 */

const {
    matchMaterial, getMaterialRate, getDensity,
    parseParts, parseHoles, calculateHoles,
    calculateMachiningCost, calculateFinal,
    roundWhole, round2
} = require('./shared');

function calculateRectangular(extracted, userMaterialRate) {
    const material = matchMaterial(extracted.material);
    const rate = getMaterialRate(material, userMaterialRate);
    const density = getDensity(material);

    // Raw drawing dimensions
    const drawingL = parseFloat(extracted.L) || 0;
    const drawingW = parseFloat(extracted.W) || 0;

    // Blank dimensions = drawing + 10mm machining allowance
    const L = drawingL + (drawingL > 0 ? 10 : 0);
    const W = drawingW + (drawingW > 0 ? 10 : 0);

    // Parse input data
    const parts = parseParts(extracted);
    const holes = parseHoles(extracted);
    const { holesPerimeter, totalHolesCount } = calculateHoles(holes);

    // ──────────────────────────────────────────────
    // OUTER PERIMETER (AREA in Excel)
    // Excel: (L + W) × 2 (uses BLANK sizes, already +10mm)
    // Example: (40 + 35) × 2 = 150
    // ──────────────────────────────────────────────
    const outerPerimeter = (L + W) * 2;

    // ──────────────────────────────────────────────
    // TOTAL CUTTING LENGTH (TOT AREA in Excel)
    // Excel: AREA + HOLE_AREA_1 + HOLE_AREA_2 + HOLE_AREA_3
    // Example: 150 + 43.96 = 193.96
    // ──────────────────────────────────────────────
    const totalCuttingLength = outerPerimeter + holesPerimeter;

    // ──────────────────────────────────────────────
    // START POINTS (NO SRT PT in Excel)
    // Excel: G3 + G4 + G5 + 1
    // = hole1_count + hole2_count + hole3_count + 1(outer)
    // Example: 2 + 0 + 0 + 1 = 3
    // ──────────────────────────────────────────────
    const startPoints = 1 + totalHolesCount;

    // ──────────────────────────────────────────────
    // MACHINING COST
    // Excel: COST = TOT_AREA × TH × 0.022 + NO_SRT_PT × 2
    // Example: 193.96 × 0.5 × 0.022 + 3×2 = 8.13
    // ──────────────────────────────────────────────
    const { totalMachiningCost, totalThicknessQty } = calculateMachiningCost(
        totalCuttingLength, startPoints, parts
    );

    // ──────────────────────────────────────────────
    // WEIGHT (WT in Excel)
    // Excel: (L+5) × (W+5) × 0.00000786 (uses BLANK L,W)
    // Adjusted for density: × (density / 7.85)
    // Example: (40+5) × (35+5) × 0.00000786 = 0.014148
    // ──────────────────────────────────────────────
    const weightPerMm = (L + 5) * (W + 5) * (0.00000786 / 7.85) * density;

    // ──────────────────────────────────────────────
    // MATERIAL COST
    // Excel: WT × THK × M_RATE
    // Example: 0.014148 × 3 × 84 = 3.57
    // ──────────────────────────────────────────────
    const totalMaterialCost = weightPerMm * totalThicknessQty * rate;

    // ──────────────────────────────────────────────
    // FINAL AMOUNT
    // Excel: (Machining VALUE + Material COST) × 1.2
    // Example: (36.80 + 3.57) × 1.2 = 48.44
    // ──────────────────────────────────────────────
    const finalAmount = calculateFinal(totalMachiningCost, totalMaterialCost);

    return {
        formulaType: 'rectangular',
        blankL: L,
        blankW: W,
        blankD: 0,
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

module.exports = calculateRectangular;
