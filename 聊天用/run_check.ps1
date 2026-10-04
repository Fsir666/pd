Write-Host "Running Python check..."
$output = & python check_python.py 2>&1
Write-Host "Exit code: $LASTEXITCODE"
Write-Host "Output lines: $($output.Count)"
Write-Host "=== OUTPUT ==="
$output | ForEach-Object { Write-Host $_ }
