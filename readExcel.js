const XLSX = require('xlsx');

function dumpFormulas(filename) {
    console.log(`\n\n--- Reading ${filename} ---`);
    const workbook = XLSX.readFile(filename, { cellFormula: true, cellDates: true, cellNF: true, sheetStubs: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = {c:C, r:R};
            const cellRef = XLSX.utils.encode_cell(cellAddress);
            const cell = sheet[cellRef];
            if (cell) {
                if (cell.f) {
                    console.log(`${cellRef}: FORMULA: =${cell.f} | VALUE: ${cell.v}`);
                } else if (cell.v !== undefined && cell.v !== null && cell.v !== "") {
                    console.log(`${cellRef}: VALUE: ${cell.v}`);
                }
            }
        }
    }
}

dumpFormulas('d:/mehekk/30mayscanner/frontend/public/SHIMFORMULA_RECTANGULAR.xlsx');
