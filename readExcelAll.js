const XLSX = require('xlsx');

function dumpFormulas(filename) {
    console.log(`\n\n--- Reading ${filename} ---`);
    const workbook = XLSX.readFile(filename, { cellFormula: true, cellDates: true, cellNF: true, sheetStubs: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let R = range.s.r; R <= Math.min(range.e.r, 20); ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = {c:C, r:R};
            const cellRef = XLSX.utils.encode_cell(cellAddress);
            const cell = sheet[cellRef];
            if (cell) {
                if (cell.f) {
                    console.log(`${cellRef}: FORMULA: =${cell.f} | VALUE: ${cell.v}`);
                }
            }
        }
    }
}

dumpFormulas('d:/mehekk/30mayscanner/frontend/public/SHIMFORMULA_CIRCLE.xlsx');
dumpFormulas('d:/mehekk/30mayscanner/frontend/public/SHIMFORMULA_SLOTTED.xlsx');
dumpFormulas('d:/mehekk/30mayscanner/frontend/public/FINALEXCEL.xlsx');
