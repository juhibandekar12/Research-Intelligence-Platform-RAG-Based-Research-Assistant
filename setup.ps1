# setup.ps1 - First-time environment setup script
# Run from: e:\rag\

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Research Intelligence Platform Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# ─── Backend ─────────────────────────────────────────────────────────
Write-Host "`n[+] Setting up Python Virtual Environment..." -ForegroundColor Yellow

if (-not (Test-Path ".\backend\.venv")) {
    Write-Host "    Creating .venv..." -ForegroundColor White
    python -m venv .\backend\.venv
    Write-Host "    [OK] Virtual environment created." -ForegroundColor Green
} else {
    Write-Host "    [OK] Virtual environment already exists." -ForegroundColor Green
}

Write-Host "    Installing Python dependencies..." -ForegroundColor White
$env:TMP="E:\pip_tmp"; $env:TEMP="E:\pip_tmp"; $env:TMPDIR="E:\pip_tmp"
New-Item -ItemType Directory -Force -Path "E:\pip_tmp" | Out-Null
& .\backend\.venv\Scripts\pip.exe install -r .\backend\requirements.txt --cache-dir E:\pip_cache

Write-Host "    [OK] Backend dependencies installed." -ForegroundColor Green

# ─── Frontend ────────────────────────────────────────────────────────
Write-Host "`n[+] Setting up Frontend Node Modules..." -ForegroundColor Yellow
Push-Location .\frontend
npm install --legacy-peer-deps --cache E:\npm_cache
Pop-Location

Write-Host "    [OK] Frontend dependencies installed." -ForegroundColor Green

# ─── .env ────────────────────────────────────────────────────────────
if (-not (Test-Path ".\backend\.env")) {
    Copy-Item ".\backend\.env.example" ".\backend\.env"
    Write-Host "`n[!] Created backend\.env from template." -ForegroundColor Yellow
    Write-Host "    IMPORTANT: Open backend\.env and set your GEMINI_API_KEY before running start.ps1" -ForegroundColor Yellow
} else {
    Write-Host "`n[OK] backend\.env file exists." -ForegroundColor Green
}

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  Setup Completed Successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "  1. Add your GEMINI_API_KEY into backend\.env" -ForegroundColor White
Write-Host "  2. Run .\start.ps1 to start the platform" -ForegroundColor White
