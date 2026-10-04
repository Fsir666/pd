$output = python test.py 2>&1
$output | Out-File -FilePath "result.txt" -Encoding UTF8
Write-Host "Test completed. Check result.txt for output."
