[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ApiUrl = "https://xjomnrsjaatpopxwpedl.supabase.co/auth/v1/otp"
$Phone = "13113354448"
$Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqb21ucnNqYWF0cG9weHdwZWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA2NDE0OTksImV4cCI6MjAzNjIxNzQ5OX0.TeKJfbwvgMhud5c3mkoCZgiv4NClcjbkHdmV4cT4K6gja4MTQyNTM1MmMtmZo2i6pko5lHr3qrCo3Unqg0aUy4cXfyRY8bSlCIn5vbmR5"

$Body = '{"phone":"' + $Phone + '","data":{},"create_user":true,"gotrue_meta_security":{},"channel":"sms"}'

Write-Host "Testing with WebRequest..."
Write-Host "URL: $ApiUrl"

try {
    $Request = [Net.WebRequest]::Create($ApiUrl)
    $Request.Method = "POST"
    $Request.ContentType = "application/json"
    $Request.Headers.Add("Authorization", "Bearer $Token")
    $Request.Headers.Add("apikey", $Token)
    $Request.Timeout = 30000
    
    $Stream = $Request.GetRequestStream()
    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    $Stream.Write($Bytes, 0, $Bytes.Length)
    $Stream.Close()
    
    $Response = $Request.GetResponse()
    $Reader = New-Object System.IO.StreamReader($Response.GetResponseStream())
    $Result = $Reader.ReadToEnd()
    
    Write-Host "Success!"
    Write-Host "Status: $($Response.StatusCode)"
    Write-Host "Response: $Result"
    
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.InnerException) {
        Write-Host "Inner: $($_.Exception.InnerException.Message)"
    }
}
