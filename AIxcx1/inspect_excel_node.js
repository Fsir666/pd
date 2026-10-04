const ExcelJS = require('exceljs');
const fs = require('fs');

async function inspect() {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile('色卡表_最终版_v4.xlsx');
        
        let output = '';
        output += `Worksheets: ${workbook.worksheets.map(ws => ws.name).join(', ')}\n\n`;
        
        workbook.eachSheet((worksheet, sheetId) => {
            output += `--- Sheet: ${worksheet.name} ---\n`;
            // Print first 5 rows
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber <= 5) {
                    output += `Row ${rowNumber}: ${JSON.stringify(row.values)}\n`;
                }
            });
            output += '\n';
        });

        fs.writeFileSync('excel_inspection_node.txt', output);
        console.log('Inspection complete. Check excel_inspection_node.txt');
        
    } catch (err) {
        console.error('Error:', err);
        fs.writeFileSync('excel_inspection_node.txt', `Error: ${err.message}`);
    }
}

inspect();
