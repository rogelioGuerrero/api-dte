param(
  [string]$MhUrl = "https://apitest.dtes.mh.gob.sv/fesv/recepciondte", # ambiente 00 (test)
  # Pega aquí el token tal cual lo devuelve /seguridad/auth (incluyendo el prefijo Bearer si ya viene)
  [string]$BearerToken = "Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxNDAxMjgwNTc2MTAyNSIsImF1dGhvcml0aWVzIjpbIlVTRVIiLCJVU0VSX0FQSSIsIlVTRVJfV0VCIiwiVXN1YXJpbyJdLCJjX25pdCI6IjE0MDEyODA1NzYxMDI1IiwiY19kdWkiOiIwMjQ1MzA5OTYiLCJpYXQiOjE3NzE3OTIzOTgsImV4cCI6MTc3MTg3ODc5OH0.18JgLq9PLxoZjtjp4WdDSlfZ0EH6zr3lHJioUnGPQ3MN2YlTILHzP03MfjXmaLjyKnQXeFE_TGI9XnQGVV08aA",
  # Usa payload-envio (envoltorio con ambiente/idEnvio/version/tipoDte/documento)
  [string]$JsonPath = "./payload-envio.json"
)

$body = Get-Content -Raw -Path $JsonPath

$headers = @{
  "Content-Type" = "application/json; charset=utf-8"
  "Authorization" = $BearerToken
  "User-Agent"    = "API-DTE/1.0"
  "Accept"        = "application/json"
}

Write-Host "POST $MhUrl" -ForegroundColor Cyan
Write-Host "Len:" ($body.Length) "chars" -ForegroundColor Cyan

try {
  $resp = Invoke-RestMethod -Method Post -Uri $MhUrl -Headers $headers -Body $body
  Write-Host "Status: OK" -ForegroundColor Green
  $resp | ConvertTo-Json -Depth 6
} catch {
  Write-Host "Status: ERROR" -ForegroundColor Red
  if ($_.Exception.Response -and $_.Exception.Response.ContentLength -gt 0) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $errBody = $reader.ReadToEnd()
    Write-Host $errBody
  } else {
    Write-Host $_
  }
  exit 1
}
