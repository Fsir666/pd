const https = require('https');
const ExcelJS = require('exceljs');
const fs = require('fs');

const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJsb2dpblR5cGUiOiJsb2dpbilsImxvZ2luSWQiOjgxNTYxNzAzMDM4OTY2NzlsImlwIjoiMSwicm5TdHliOiJSYUFBQmtXYTBrYzM3SWltY2Q3UVNBTGI3UVhNSFFIQSlSImlwIjoiMjIzLjg4LjE5NS4yNTEiLCJhZGRyZXNzIjoi5Lit5Zu95rKZ5Y2X55yB5a6J6Ziz5biCIOenu-WKqCIsImJyb3dzZXIiOiJNU0VkZ2UgMTQ1LjAuMC4wIiwiY3MiOiJXaW5kb3dzIDEwIiwiibG9naW5UaW1lIjoxNzcxNjYxNDgzfqA3NdROMC07qBa5_RimNQ_ykjDlV1gPxvBU94-DT2F2I";

const API_BASE = 'api.kai0x.top';

function httpsRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function getBrands() {
    const options = {
        hostname: API_BASE,
        path: '/api/pixelart/colorBrands/listColorBrands',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${TOKEN}`
        }
    };
    try {
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', (e) => reject(e));
            req.end();
        });

        console.log('Brands API Response:', JSON.stringify(response).substring(0, 200)); // Log first 200 chars

        if (response.success && response.data && response.data.brands) {
             return response.data.brands;
        }
        if (Array.isArray(response.data)) {
             return response.data;
        }
        return [];
    } catch (error) {
        console.error('Error fetching brands:', error);
        return [];
    }
}

async function getBrandColors(brandId) {
    const options = {
        hostname: API_BASE,
        path: `/api/pixelart/colorBrands/${brandId}/brandColors`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${TOKEN}`
        }
    };
    const response = await httpsRequest(options);
    if (response.success && response.data) {
        return response.data;
    }
    return [];
}

function hexToArgb(hex) {
    if (!hex) return 'FFFFFFFF';
    hex = hex.replace('#', '');
    if (hex.length === 6) {
        return 'FF' + hex;
    }
    return hex;
}

async function generateExcel() {
    try {
        console.log('Fetching brands...');
        const brands = await getBrands();
        console.log(`Found ${brands.length} brands.`);

        const workbook = new ExcelJS.Workbook();

        for (const brand of brands) {
            const sheetName = brand.brandName.replace(/[\\/?*\[\]]/g, '_'); // Sanitize sheet name
            console.log(`Processing brand: ${brand.brandName} (ID: ${brand.id})...`);
            
            const colors = await getBrandColors(brand.id);
            if (colors.length === 0) {
                console.log(`No colors found for ${brand.brandName}, skipping...`);
                continue;
            }

            const sheet = workbook.addWorksheet(sheetName);
            
            // Set headers
            sheet.columns = [
                { header: '色号 (Color Code)', key: 'code', width: 15 },
                { header: '颜色预览 (Preview)', key: 'preview', width: 15 },
                { header: 'HEX值 (HEX)', key: 'hex', width: 15 },
                { header: '排序 (Order)', key: 'order', width: 10 }
            ];

            // Style headers
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            // Add rows
            colors.forEach((color, index) => {
                const row = sheet.addRow({
                    code: color.colorCode,
                    hex: color.color,
                    order: color.displayOrder
                });

                // Add color preview
                const cell = row.getCell('preview');
                const argb = hexToArgb(color.color);
                
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: argb }
                };
            });
            
            console.log(`Added ${colors.length} colors to sheet "${sheetName}".`);
        }

        const filename = '色卡表_最终版_v3.xlsx';
        await workbook.xlsx.writeFile(filename);
        console.log(`Excel file generated successfully: ${filename}`);

    } catch (error) {
        console.error('Error generating Excel:', error);
    }
}

generateExcel();
