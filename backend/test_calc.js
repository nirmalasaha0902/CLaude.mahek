const { calculatePricing } = require('./formulas');

const extracted = {
    shape: 'slotted',
    part_name: 'SHIM PACK',
    drawing_no: 'IEA251-10-03-159',
    L: 45, W: 16, D: 0, d: 0, material: 'SPCC',
    parts: [{ thickness: 2, quantity: 1 }, { thickness: 1, quantity: 2 }, { thickness: 0.5, quantity: 2 }],
    TH: 0, quantity: 5, holes: [],
    slots: [{ slot_center_from_edge: 8, length: 8, radius: 3.5, count: 4 }],
    slot_direction_dimension: 'W'
};

// Assuming material rate 84, cutting rate 0.022 as per previous sheet.
const calc = calculatePricing(extracted, 84, 0.022);
console.log(JSON.stringify(calc, null, 2));
