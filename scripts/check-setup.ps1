$ErrorActionPreference = "Stop"

Set-Location "C:\Projects\kurapuro\web"

$envPath = Join-Path (Get-Location) ".env.local"

if (-not (Test-Path $envPath)) {
  Write-Host ".env.local was not found." -ForegroundColor Red
  exit 1
}

$values = @{}

Get-Content $envPath | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') {
    return
  }

  $parts = $_ -split "=", 2
  if ($parts.Length -eq 2) {
    $values[$parts[0].Trim()] = $parts[1].Trim()
  }
}

$required = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL"
)

$missing = @()
$invalid = @()

foreach ($key in $required) {
  if (-not $values.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($values[$key])) {
    $missing += $key
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing environment values:" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host " - $_" }
  exit 1
}

$urlValue = $values["NEXT_PUBLIC_SUPABASE_URL"]
if ($urlValue -notmatch '^https://[a-z0-9-]+\.supabase\.co$') {
  $invalid += "NEXT_PUBLIC_SUPABASE_URL should look like https://<project-ref>.supabase.co"
}

$publishableValue = $values["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
if ($publishableValue -notmatch '^sb_publishable_') {
  $invalid += "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY should start with sb_publishable_"
}

$serviceRoleValue = $values["SUPABASE_SERVICE_ROLE_KEY"]
if ([string]::IsNullOrWhiteSpace($serviceRoleValue)) {
  $invalid += "SUPABASE_SERVICE_ROLE_KEY is empty"
}

if ($invalid.Count -gt 0) {
  Write-Host "Environment values are present but some formats look wrong:" -ForegroundColor Yellow
  $invalid | ForEach-Object { Write-Host " - $_" }
  exit 1
}

Write-Host "Environment values are present." -ForegroundColor Green
Write-Host "NEXT_PUBLIC_APP_URL = $($values['NEXT_PUBLIC_APP_URL'])"
