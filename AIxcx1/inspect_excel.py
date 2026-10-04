import pandas as pd
import sys

excel_file = '色卡表_最终版_v4.xlsx'
output_file = 'excel_inspection.txt'

with open(output_file, 'w', encoding='utf-8') as f:
    try:
        xls = pd.ExcelFile(excel_file)
        f.write(f"Sheet names: {xls.sheet_names}\n")
        
        for sheet_name in xls.sheet_names:
            f.write(f"\n--- Sheet: {sheet_name} ---\n")
            df = pd.read_excel(excel_file, sheet_name=sheet_name, nrows=5)
            f.write(df.to_string() + "\n")
            
    except Exception as e:
        f.write(f"Error reading Excel: {e}\n")

print(f"Inspection written to {output_file}")
