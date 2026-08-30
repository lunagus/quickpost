$ErrorActionPreference = 'Stop'
$installDir = "$HOME\.quickpost"
if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir | Out-Null }

Write-Host "Downloading quickpost CLI..." -ForegroundColor Cyan
$scriptUrl = "https://raw.githubusercontent.com/lunagus/quickpost/main/scripts/qp.ps1"
Invoke-WebRequest -Uri $scriptUrl -OutFile "$installDir\qp.ps1"

if (-not (Test-Path $PROFILE)) {
    New-Item -Type File -Path $PROFILE -Force | Out-Null
}

$profileLines = Get-Content $PROFILE -ErrorAction SilentlyContinue
$aliasLine = "function qp { & `"$installDir\qp.ps1`" @args }"

if ($profileLines -notcontains $aliasLine) {
    Add-Content -Path $PROFILE -Value "`n# quickpost CLI alias`n$aliasLine"
}

Write-Host "quickpost installed successfully!" -ForegroundColor Green
Write-Host "Please restart your terminal or run: " -NoNewline; Write-Host ". `$PROFILE" -ForegroundColor Yellow
Write-Host "Usage: qp file.png"
