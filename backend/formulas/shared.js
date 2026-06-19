/**
 * Shared utilities for all shim formula calculations
 * Mahekk Industries - Shim Formula System
 */

// Default material rates (₹/kg)
const DEFAULT_RATES = { 'MS': 84, 'SS304': 220, 'SS316': 280, 'BRASS': 450 };

// Material densities (g/cm³)
const DENSITIES = { 'MS': 7.85, 'SS304': 8.00, 'SS316': 8.00, 'BRASS': 8.50 };

// Machining cost multiplier (from Excel formula)
const MACHINING_MULTIPLIER = 0.022;

// Business markup
const MARKUP = 1.2;

/**
 * Match material string to a known material key
 */
function matchMaterial(materialStr) {
    const m = (materialStr || 'MS').toUpperCase();
    if (DEFAULT_RATES[m]) return m;
    if (m.includes('304')) return 'SS304';
    if (m.includes('316')) return 'SS316';
    if (m.includes('BRASS') || m.includes('BRAS')) return 'BRASS';
    return 'MS';
}

/**
 * Get material rate - user override or default
 */
function getMaterialRate(materialKey, userRate) {
    let rate = parseFloat(userRate);
    if (isNaN(rate) || rate <= 0) {
        rate = DEFAULT_RATES[materialKey] || 84;
    }
    return rate;
}

/**
 * Get material density
 */
function getDensity(materialKey) {
    return DENSITIES[materialKey] || 7.85;
}

/**
 * Parse parts (thickness × quantity) from extracted data with robust key normalization
 */
function parseParts(extracted) {
    let parts = [];
    if (Array.isArray(extracted.parts) && extracted.parts.length > 0) {
        parts = extracted.parts.map(p => {
            const th = parseFloat(p.thickness || p.thick || p.thk || p.th || p.t || p.T || 0);
            const q = parseInt(p.quantity || p.qty || p.count || p.cnt || p.q || p.Q || p.nos || p.qty_pieces || 1) || 1;
            return { thickness: th, quantity: q };
        });
    } else if (Array.isArray(extracted.thicknesses) && extracted.thicknesses.length > 0) {
        parts = extracted.thicknesses.map(th => ({
            thickness: parseFloat(th) || 0,
            quantity: parseInt(extracted.quantity || extracted.qty || 1) || 1
        }));
    } else {
        parts = [{
            thickness: parseFloat(extracted.TH || extracted.thk || extracted.t || extracted.T || extracted.thickness || 0) || 0,
            quantity: parseInt(extracted.quantity || extracted.qty || 1) || 1
        }];
    }
    return parts;
}

/**
 * Parse holes from extracted data with robust key normalization
 */
function parseHoles(extracted) {
    let holes = [];
    if (Array.isArray(extracted.holes) && extracted.holes.length > 0) {
        holes = extracted.holes.map(h => {
            const dia = parseFloat(h.diameter || h.dia || h.size || h.d || h.D || h.hole_dia || h.hole_diameter || 0);
            const cnt = parseInt(h.count || h.cnt || h.qty || h.quantity || h.number || h.num || h.no_holes || h.q || h.Q || 1) || 1;
            return { diameter: dia, count: cnt };
        });
    } else {
        const hole1_dia = parseFloat(extracted.hole1_dia || extracted.dia || extracted.diameter || 0);
        const no_holes = parseInt(extracted.no_holes || extracted.count || extracted.qty || 0);
        if (no_holes > 0 && hole1_dia > 0) {
            holes.push({ diameter: hole1_dia, count: no_holes });
        }
    }
    // Inner diameter (large central cutout for round shims)
    const inner_d = parseFloat(extracted.d) || 0;
    if (inner_d > 0) {
        // Check if there is already a hole in holes with the same diameter
        const hasInnerD = holes.some(h => Math.abs((parseFloat(h.diameter) || 0) - inner_d) < 0.1);
        if (!hasInnerD) {
            // Prepend inner diameter to the front so it goes into the first row of holes in the Excel template
            holes.unshift({ diameter: inner_d, count: 1 });
        } else {
            // If it already exists, let's make sure it is at the front (first index)
            const idx = holes.findIndex(h => Math.abs((parseFloat(h.diameter) || 0) - inner_d) < 0.1);
            if (idx > 0) {
                const innerHole = holes.splice(idx, 1)[0];
                holes.unshift(innerHole);
            }
        }
    }
    // Update extracted so frontend displays correctly
    extracted.holes = holes;
    return holes;
}

/**
 * Calculate hole perimeter and count
 * Excel: HOLE AREA = 3.14 * diameter * count
 */
function calculateHoles(holes) {
    let holesPerimeter = 0;
    let totalHolesCount = 0;
    for (const h of holes) {
        const hDia = parseFloat(h.diameter) || 0;
        const hCount = parseInt(h.count) || 0;
        holesPerimeter += 3.14 * hDia * hCount;
        totalHolesCount += hCount;
    }
    return { holesPerimeter, totalHolesCount };
}

/**
 * Calculate machining cost for all parts
 * Excel formulas from Shim_Formula1.xls:
 *   TH < 3mm:  COST = TOT_AREA × TH × 0.022 + startPoints × 2
 *   TH >= 3mm: COST = TOT_AREA × TH × 0.02  + startPoints × 2
 * VALUE = COST × QTY
 * Total = SUM(all VALUES)
 */
function calculateMachiningCost(totalCuttingLength, startPoints, parts) {
    let totalMachiningCost = 0;
    let totalThicknessQty = 0;

    for (const part of parts) {
        const th = parseFloat(part.thickness) || 0;
        const q = parseInt(part.quantity) || 1;

        // Excel uses 0.022 for all thicknesses
        const multiplier = 0.022;
        const machiningCostPerItem = (totalCuttingLength * th * multiplier) + (startPoints * 2);
        totalMachiningCost += machiningCostPerItem * q;
        totalThicknessQty += (th * q);
    }

    return { totalMachiningCost, totalThicknessQty };
}

/**
 * Calculate final amount with markup
 * Excel: FINAL AMOUNT = (totalMachiningValue + materialCost) × 1.2
 */
function calculateFinal(totalMachiningCost, totalMaterialCost) {
    return (totalMachiningCost + totalMaterialCost) * MARKUP;
}

function getSlotLength(drawingL, drawingW, sCenterFromEdge, defaultLength, slotDirectionDimension, blankL, blankW) {
    let aiLength = parseFloat(defaultLength) || 0;
    if (sCenterFromEdge <= 0) {
        return aiLength;
    }

    // As requested: always calculate slot length as (Width - slot center from edge)
    return drawingW - sCenterFromEdge;
}

/**
 * Parse slots from extracted data and return normalized slot objects
 */
function parseSlots(extracted, drawingL, drawingW, blankL, blankW) {
    let slots = [];
    if (Array.isArray(extracted.slots)) {
        slots = extracted.slots.map(s => {
            const sCenterFromEdge = parseFloat(s.slot_center_from_edge || s.center_from_edge || s.edge_distance || s.edge || s.center_edge || 0) || 0;
            const sRad = parseFloat(s.radius || s.rad || s.r || s.R || (s.width ? s.width / 2 : 0) || (s.diameter ? s.diameter / 2 : 0) || 0) || 0;
            const sCount = parseInt(s.count || s.cnt || s.qty || s.quantity || s.number || s.num || s.q || s.Q || 0) || 0;
            const rawLen = parseFloat(s.length || s.depth || s.len || s.l || s.L || 0) || 0;
            const sLen = getSlotLength(drawingL, drawingW, sCenterFromEdge, rawLen, extracted.slot_direction_dimension, blankL, blankW);
            
            return {
                slot_center_from_edge: sCenterFromEdge,
                length: sLen,
                radius: sRad,
                count: sCount,
                lengthQty: s.lengthQty !== undefined && s.lengthQty !== null ? parseInt(s.lengthQty) : undefined,
                radiusQty: s.radiusQty !== undefined && s.radiusQty !== null ? parseInt(s.radiusQty) : undefined
            };
        }).filter(s => s.count > 0 || (s.lengthQty > 0 || s.radiusQty > 0));
    }
    return slots;
}

// Rounding helpers
const roundWhole = (num) => Math.round(num);
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

module.exports = {
    matchMaterial,
    getMaterialRate,
    getDensity,
    parseParts,
    parseHoles,
    parseSlots,
    calculateHoles,
    calculateMachiningCost,
    calculateFinal,
    roundWhole,
    round2,
    getSlotLength,
    MACHINING_MULTIPLIER,
    MARKUP
};
