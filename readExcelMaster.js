const XLSX = require('xlsx');

function dumpFormulas(filename) {
    console.log(`\n\n--- Reading ${filename} ---`);
    const workbook = XLSX.readFile(filename, { cellFormula: true, cellDates: true, cellNF: true, sheetStubs: true });
    
    workbook.SheetNames.forEach(sheetName => {
        console.log(`\nSheet: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];

        const range = XLSX.utils.decode_range(sheet['!ref']);
        for (let R = range.s.r; R <= Math.min(range.e.r, 50); ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = {c:C, r:R};
                const cellRef = XLSX.utils.encode_cell(cellAddress);
                const cell = sheet[cellRef];
                if (cell) {
                    if (cell.f && String(cell.f).includes('0.02')) {
                        console.log(`${cellRef}: FORMULA: =${cell.f} | VALUE: ${cell.v}`);
                    }
                }
            }
        }
    });
}

dumpFormulas('d:/mehekk/30mayscanner/frontend/public/Shim_Formula.xls');
dumpFormulas('d:/mehekk/30mayscanner/frontend/public/ShimFormula_2.xls');
