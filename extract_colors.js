const ExcelJS = require('exceljs');
const fs = require('fs');

const BRAND_MAP = {
    'Mard': 'mard',
    '黄豆豆': 'hdds',
    'DoDo': 'dodo',
    'CoCo': 'coco',
    '漫漫': 'manman',
    '小舞': 'xiaowu',
    '咪小窝': 'mixiaowo',
    '卡卡': 'kaka',
    '优肯': 'youken',
    '柿柿': 'shishi',
    '童趣': 'tongqu',
    '盼盼': 'panpan'
};

async function extract() {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile('色卡表_最终版_v4.xlsx');
        
        const result = {};

        workbook.eachSheet((worksheet, sheetId) => {
            const sheetName = worksheet.name;
            
            // Determine Brand
            let brandId = null;
            let brandName = null;
            
            for (const [name, id] of Object.entries(BRAND_MAP)) {
                if (sheetName.startsWith(name)) {
                    brandId = id;
                    brandName = name;
                    break;
                }
            }
            
            if (!brandId) {
                console.warn(`Unknown brand for sheet: ${sheetName}`);
                return;
            }

            if (!result[brandId]) {
                result[brandId] = {
                    id: brandId,
                    name: brandName,
                    subSeries: []
                };
            }

            // Determine Sub-Series Name and ID
            const seriesId = sheetName; 
            const seriesName = sheetName;

            const subSeriesObj = {
                id: seriesId,
                name: seriesName,
                colors: []
            };
            result[brandId].subSeries.push(subSeriesObj);

            // Extract Rows
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                const values = row.values;
                // Based on inspection: [null, "A系列", "A4", null, "#FBED56", 1]
                // Index 1: Series
                // Index 2: Code
                // Index 4: Hex
                
                const series = values[1];
                const code = values[2];
                const hex = values[4];

                if (code) { // Hex might be missing sometimes? Assuming code is key
                    subSeriesObj.colors.push({
                        series: series || '其它',
                        code: code.toString(),
                        hex: hex ? hex.toString() : '#CCCCCC' // Default gray if missing
                    });
                }
            });
        });

        const jsContent = `module.exports = ${JSON.stringify(result, null, 2)};`;
        
        // Ensure data directory exists
        if (!fs.existsSync('data')) {
            fs.mkdirSync('data');
        }
        
        fs.writeFileSync('data/color-data.js', jsContent);
        console.log('Extraction complete. Saved to data/color-data.js');
        
    } catch (err) {
        console.error('Error:', err);
    }
}

extract();
