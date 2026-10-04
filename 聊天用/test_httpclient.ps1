Add-Type -AssemblyName System.Net.Http

$ApiUrl = "https://xjomnrsjaatpopxwpedl.supabase.co/auth/v1/otp"
$Phone = "13113354448"
$Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqb21ucnNqYWF0cG9weHdwZWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NDE0OTksImV4cCI6MjAzNjIxNzQ5OX0.TeKJfbwvgMhud5c3mkoCZgiv4NClcjbkHdmV4cT4K6gja4MTQyNTM1MmMtmZo2i6pko5lHr3qrCo3Unqg0aUy4cXfyRY8bSlCIn5vbmR5"

$Handler = New-Object System.Net.Http.HttpClientHandler
$Client = New-Object System.Net.Http.HttpClient($Handler)
$Client.Timeout = [TimeSpan]::FromSeconds(30)

$Client.DefaultRequestHeaders.Add("Authorization", "Bearer $Token")
$Client.DefaultRequestHeaders.Add("apikey", $Token)

$Body = '{"phone":"' + $Phone + '","data":{},"create_user":true,"gotrue_meta_security":{},"channel":"sms"}'

Write-Host "Testing with HttpClient..."
Write-Host "URL: $ApiUrl"
Write-Host "Body: $Body"

try {
    $Content = New-Object System.Net.Http.StringContent($Body, [System.Text.Encoding]::UTF8, "application/json")
    $Response = $Client.PostAsync($ApiUrl, $Content).Result
    
    Write-Host "Status: $($Response.StatusCode)"
    $ResponseBody = $Response.Content.ReadAsStringAsync().Result
    Write-Host "Response: $ResponseBody"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.InnerException) {
        Write-Host "Inner: $($_.Exception.InnerException.Message)"
    }
}
