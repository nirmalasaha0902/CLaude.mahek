const XLSX = require('xlsx');

function dumpFormulas(filename) {
    console.log(`\n\n--- Reading ${filename} ---`);
    const workbook = XLSX.readFile(filename, { cellFormula: true, cellDates: true, cellNF: true, sheetStubs: true });
    
    workbook.SheetNames.forEach(sheetName => {
        console.log(`\nSheet: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];

        const range = XLSX.utils.decode_range(sheet['!ref']);
        for (let R = range.s.r; R <= Math.min(range.e.r, 20); ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = {c:C, r:R};
                const cellRef = XLSX.utils.encode_cell(cellAddress);
                const cell = sheet[cellRef];
                if (cell) {
                    let text = `${cellRef}: `;
                    if (cell.f) text += `FORMULA: =${cell.f} | `;
                    if (cell.v !== undefined) text += `VALUE: ${cell.v}`;
                    console.log(text);
                }
            }
        }
    });
}

dumpFormulas('d:/mehekk/30mayscanner/frontend/public/SHIMFORMULA_SLOTTED.xlsx');
