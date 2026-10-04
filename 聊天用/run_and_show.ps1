$output = & python test.py 2>&1
Write-Host "=== OUTPUT START ==="
foreach ($line in $output) {
    Write-Host $line
}
Write-Host "=== OUTPUT END ==="
