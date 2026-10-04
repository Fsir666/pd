$ApiUrl = "https://xjomnrsjaatpopxwpedl.supabase.co/auth/v1/otp"
$Phone = "13113354448"
$Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqb21ucnNqYWF0cG9weHdwZWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NDE0OTksImV4cCI6MjAzNjIxNzQ5OX0.TeKJfbwvgMhud5c3mkoCZgiv4NClcjbkHdmV4cT4K6gja4MTQyNTM1MmMtmZo2i6pko5lHr3qrCo3Unqg0aUy4cXfyRY8bSlCIn5vbmR5"

$Concurrent = 10
$Total = 30

$Success = 0
$Failed = 0
$Limited = 0

$Headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
    "apikey" = $Token
}

$Results = @()

Write-Host "=" * 50
Write-Host "SMS Pressure Test (PowerShell)"
Write-Host "=" * 50
Write-Host "URL: $ApiUrl"
Write-Host "Phone: $Phone"
Write-Host "Concurrent: $Concurrent, Total: $Total"
Write-Host "=" * 50

$Start = Get-Date

for ($i = 0; $i -lt $Total; $i += $Concurrent) {
    $Jobs = @()
    $BatchEnd = [Math]::Min($i + $Concurrent, $Total)
    
    for ($j = $i; $j -lt $BatchEnd; $j++) {
        $Idx = $j + 1
        $Body = @{
            phone = $Phone
            data = @{}
            create_user = $true
            gotrue_meta_security = @{}
            channel = "sms"
        } | ConvertTo-Json
        
        $Job = Start-Job -ScriptBlock {
            param($Url, $Body, $Headers, $Idx)
            try {
                $Response = Invoke-RestMethod -Uri $Url -Method Post -Body $Body -Headers $Headers -ContentType "application/json" -TimeoutSec 10
                return @{ Status = "OK"; Idx = $Idx }
            } catch {
                $StatusCode = $_.Exception.Response.StatusCode.value__
                if ($StatusCode -eq 429) {
                    return @{ Status = "Limited"; Idx = $Idx }
                } else {
                    return @{ Status = "Fail"; Idx = $Idx; Code = $StatusCode }
                }
            }
        } -ArgumentList $ApiUrl, $Body, $Headers, $Idx
        
        $Jobs += $Job
    }
    
    $JobResults = $Jobs | Wait-Job | Receive-Job
    $Jobs | Remove-Job
    
    foreach ($Result in $JobResults) {
        switch ($Result.Status) {
            "OK" { 
                $Script:Success++
                Write-Host "#$($Result.Idx) OK" 
            }
            "Limited" { 
                $Script:Limited++
                Write-Host "#$($Result.Idx) Limited (429)" 
            }
            default { 
                $Script:Failed++
                Write-Host "#$($Result.Idx) Fail $($Result.Code)" 
            }
        }
    }
    
    Write-Host "--- Batch $([Math]::Floor($i/$Concurrent) + 1) done ($BatchEnd/$Total) ---"
}

$Elapsed = ((Get-Date) - $Start).TotalSeconds

Write-Host ""
Write-Host "=" * 50
Write-Host "Result"
Write-Host "=" * 50
Write-Host "Success: $Success"
Write-Host "Limited: $Limited"
Write-Host "Failed: $Failed"
Write-Host "Time: $([Math]::Round($Elapsed, 2))s"
Write-Host "QPS: $([Math]::Round($Total/$Elapsed, 2))"
