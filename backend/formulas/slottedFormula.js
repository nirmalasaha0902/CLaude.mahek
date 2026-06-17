/**
 * SLOTTED Shim Formula
 * =====================
 * Excel Reference: "Slotted Shims" section
 *
 * KEY RULE: Slot Length = Drawing L - slot_center_from_edge
 *   Example 1: L=70, edge=12.5 → slot_length = 70 - 12.5 = 57.5
 *   Example 2: L=50, edge=10   → slot_length = 50 - 10 = 40
 *
 * Length QTY = always 2× Radius QTY (two straight sides per slot)
 *
 * Verified Example (from Excel screenshot):
 *   L=80(blank), W=70(blank), drawingL=70
 *   AREA = (80+70)×2 = 300
 *   Slot Length=57.5, QTY=4(2 slots × 2 sides), AREA=230
 *   Slot Radius=5.5, QTY=2(2 slots), AREA=34.54
 *   TOT AREA = 300 + 230 + 34.54 = 564.54 ≈ 565
 *   NO SRT PT = 0(no holes) + 1(outer) = 1
 *   TH=0.5: COST = 564.54 × 0.5 × 0.022 + 1×2 = 8.21 → 8
 *   TH=1.0: COST = 564.54 × 1.0 × 0.022 + 1×2 = 14.42 → 14
 *   WT = (80+5)×(70+5)×0.00000786 = 0.05
 *   THK=3, M RATE=84, Mat COST=13
 *   FINAL = (45.26 + 12.63) × 1.2 = 69.47
 */

const {
    matchMaterial, getMaterialRate, getDensity,
    parseParts, parseHoles, parseSlots, calculateHoles,
    calculateMachiningCost, calculateFinal,
    roundWhole, round2, getSlotLength
} = require('./shared');

function calculateSlotted(extracted, userMaterialRate) {
    const material = matchMaterial(extracted.material);
    const rate = getMaterialRate(material, userMaterialRate);
    const density = getDensity(material);

    // Raw drawing dimensions (before +10mm)
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
    // Excel: (L + W) × 2 (uses BLANK sizes)
    // Example: (80 + 70) × 2 = 300
    // ──────────────────────────────────────────────
    const outerPerimeter = (L + W) * 2;

    // ──────────────────────────────────────────────
    // SLOTS PERIMETER
    // Slot Length = drawingL - slot_center_from_edge
    //   Example: 70 - 12.5 = 57.5
    // Length QTY = count × 2 (two straight sides per slot)
    // Radius QTY = count
    // Excel: Slot Length AREA = length × lengthQTY = 57.5 × 4 = 230
    // Excel: Slot Radius AREA = 3.14 × radius × radiusQTY = 3.14 × 5.5 × 2 = 34.54
    // ──────────────────────────────────────────────
    let slotsPerimeter = 0;
    let slotDisplayData = [];
    let totalSlotCount = 0;

    const slots = parseSlots(extracted, drawingL, drawingW, L, W);
    for (const s of slots) {
        const slotLinesQty = s.lengthQty !== undefined && s.lengthQty !== null ? s.lengthQty : (s.count * 2);
        const slotCurvesQty = s.radiusQty !== undefined && s.radiusQty !== null ? s.radiusQty : s.count;

        slotsPerimeter += (s.length * slotLinesQty) + (3.14 * s.radius * slotCurvesQty);
        totalSlotCount += s.count;

        slotDisplayData.push({
            length: s.length,
            lengthQty: slotLinesQty,
            radius: s.radius,
            radiusQty: slotCurvesQty,
            count: s.count
        });
    }

    // ──────────────────────────────────────────────
    // TOTAL CUTTING LENGTH (TOT AREA in Excel)
    // Excel: outer + holes + slot_lengths + slot_radii
    // Example: 300 + 0 + 230 + 34.54 = 564.54
    // ──────────────────────────────────────────────
    const totalCuttingLength = outerPerimeter + holesPerimeter + slotsPerimeter;

    // ──────────────────────────────────────────────
    // START POINTS (NO SRT PT in Excel)
    // Slots are open from the edge - NO separate start point needed
    // Only holes need pierce points + 1 for outer
    // Example: 0(no holes) + 1 = 1
    // ──────────────────────────────────────────────
    const startPoints = 1 + totalHolesCount;

    // ──────────────────────────────────────────────
    // MACHINING COST
    // Excel: COST = TOT_AREA × TH × 0.022 + NO_SRT_PT × 2
    // Example: 564.54 × 0.5 × 0.022 + 1×2 = 8.21
    // ──────────────────────────────────────────────
    const { totalMachiningCost, totalThicknessQty } = calculateMachiningCost(
        totalCuttingLength, startPoints, parts
    );

    // ──────────────────────────────────────────────
    // WEIGHT (WT in Excel)
    // Excel: (L+5) × (W+5) × 0.00000786 (uses BLANK L,W)
    // Adjusted for density: × (density / 7.85)
    // Example: (80+5) × (70+5) × 0.00000786 = 0.050115
    // ──────────────────────────────────────────────
    const weightPerMm = (L + 5) * (W + 5) * (0.00000786 / 7.85) * density;

    // ──────────────────────────────────────────────
    // MATERIAL COST
    // Excel: WT × THK × M_RATE
    // Example: 0.050115 × 3 × 84 = 12.63
    // ──────────────────────────────────────────────
    const totalMaterialCost = weightPerMm * totalThicknessQty * rate;

    // ──────────────────────────────────────────────
    // FINAL AMOUNT
    // Excel: (Machining VALUE + Material COST) × 1.2
    // Example: (45.26 + 12.63) × 1.2 = 69.47
    // ──────────────────────────────────────────────
    const finalAmount = calculateFinal(totalMachiningCost, totalMaterialCost);

    return {
        formulaType: 'slotted',
        blankL: L,
        blankW: W,
        blankD: 0,
        outerPerimeter: roundWhole(outerPerimeter),
        holePerimeter: roundWhole(holesPerimeter),
        slotsPerimeter: roundWhole(slotsPerimeter),
        slotDisplayData: slotDisplayData,
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

module.exports = calculateSlotted;
