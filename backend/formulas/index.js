/**
 * Formula Router — Auto-detects drawing type and applies correct formula
 * ======================================================================
 * 
 * Detection Logic (priority order):
 *   1. SLOTTED:  shape==='slotted' (explicit) OR has non-empty slots array with count > 0
 *   2. RECTANGULAR (if D+L+W all > 0): D is likely a hole, not outer shape
 *   3. CIRCULAR: shape==='round'/'circular' AND D > 0, OR D > 0 with no L/W
 *   4. RECTANGULAR: default fallback (plane & hole shims)
 * 
 * The AI prompt classifies the shape, but we also validate using
 * the extracted dimensions to prevent misclassification.
 */

const { calculatePricingFromExcel } = require('./excelFormulaReader');

/**
 * Detect the drawing type from extracted data with validation
 * Returns: 'circular' | 'slotted' | 'rectangular'
 */
function detectDrawingType(extracted) {
    const shape = (extracted.shape || '').toLowerCase();
    const D = parseFloat(extracted.D) || 0;
    const L = parseFloat(extracted.L) || 0;
    const W = parseFloat(extracted.W) || 0;

    // Check for slots presence
    let hasSlots = false;
    if (Array.isArray(extracted.slots)) {
        for (const s of extracted.slots) {
            const count = parseInt(s.count) || 0;
            if (count > 0) {
                hasSlots = true;
                break;
            }
        }
    }

    // ── SLOTTED detection (check FIRST — highest priority) ──
    // Issue 7: Trust explicit shape === 'slotted' even without slot data
    // (normalization may have set shape to 'slotted' with correct slot params)
    if (shape === 'slotted') {
        return 'slotted';
    }
    // Secondary: Has valid slot data regardless of AI label
    if (hasSlots && L > 0) {
        return 'slotted';
    }

    // ── CIRCULAR detection ──
    // Issue 3: If D > 0 AND L > 0 AND W > 0, the part has both rectangular
    // and circular dimensions — the D is likely a hole annotation, not the outer shape.
    // Prefer rectangular in this case.
    if (D > 0 && L > 0 && W > 0) {
        // Has all dimensions — it's a rectangular part with holes, not circular
        console.log(`[Formula Router] D=${D}, L=${L}, W=${W} — all present, treating as rectangular (D is likely a hole)`);
        return 'rectangular';
    }

    // Primary: AI says "round"/"circular" AND has a diameter
    if (shape === 'round' || shape === 'circular') {
        if (D > 0) return 'circular';
        // AI said round but no diameter — likely misclassified
        // Fall through to check other types
    }
    if (D > 0 && L === 0 && W === 0) {
        return 'circular';
    }

    // ── RECTANGULAR detection (default) ──
    // Plane & Hole shims — may or may not have holes
    return 'rectangular';
}

/**
 * Main entry point: detect type and calculate pricing
 */
function calculatePricing(extracted, userMaterialRate, userCuttingRate) {
    const drawingType = detectDrawingType(extracted);
    
    console.log(`[Formula Router] Detected type: ${drawingType.toUpperCase()}`);
    console.log(`[Formula Router] Shape: ${extracted.shape}, D: ${extracted.D}, L: ${extracted.L}, W: ${extracted.W}`);
    if (extracted.slots) {
        console.log(`[Formula Router] Slots: ${JSON.stringify(extracted.slots)}`);
    }

    return calculatePricingFromExcel(drawingType, extracted, userMaterialRate, userCuttingRate);
}

module.exports = {
    calculatePricing,
    detectDrawingType
};
