[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ApiUrl = "https://xjomnrsjaatpopxwpedl.supabase.co/auth/v1/otp"
$Phone = "13113354448"
$Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqb21ucnNqYWF0cG9weHdwZWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NDE0OTksImV4cCI6MjAzNjIxNzQ5OX0.TeKJfbwvgMhud5c3mkoCZgiv4NClcjbkHdmV4cT4K6gja4MTQyNTM1MmMtmZo2i6pko5lHr3qrCo3Unqg0aUy4cXfyRY8bSlCIn5vbmR5"

$Headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
    "apikey" = $Token
}

$Body = @{
    phone = $Phone
    data = @{}
    create_user = $true
    gotrue_meta_security = @{}
    channel = "sms"
} | ConvertTo-Json -Depth 10

Write-Host "Testing single request..."
Write-Host "URL: $ApiUrl"

try {
    $Response = Invoke-WebRequest -Uri $ApiUrl -Method Post -Body $Body -Headers $Headers -ContentType "application/json" -TimeoutSec 10 -UseBasicParsing
    Write-Host "Success!"
    Write-Host "Status: $($Response.StatusCode)"
    Write-Host "Response: $($Response.Content)"
} catch {
    Write-Host "Error!"
    Write-Host "Exception: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
        try {
            $Stream = $_.Exception.Response.GetResponseStream()
            $Reader = New-Object System.IO.StreamReader($Stream)
            $ResponseBody = $Reader.ReadToEnd()
            Write-Host "Response Body: $ResponseBody"
        } catch {
            Write-Host "Could not read response body"
        }
    }
}
