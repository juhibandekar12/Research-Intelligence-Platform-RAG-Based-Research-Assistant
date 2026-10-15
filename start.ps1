# start.ps1 - Launch backend and frontend servers
# Run from: e:\rag\

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Starting Research Intelligence Platform" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (-not (Test-Path ".\backend\.env")) {
    Write-Host "[ERROR] backend\.env not found!" -ForegroundColor Red
    Write-Host "        Edit backend\.env and set your GEMINI_API_KEY." -ForegroundColor Yellow
    exit 1
}

# Start Backend (set UTF-8 to prevent emoji crash on Windows)
Write-Host "[+] Launching FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "`$env:PYTHONIOENCODING='utf-8'; Set-Location 'e:\rag\backend'; & '.\.venv\Scripts\activate.ps1'; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
) -WindowStyle Normal

Start-Sleep -Seconds 5

# Start Frontend
Write-Host "[+] Launching React Frontend on http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location 'e:\rag\frontend'; npm run dev"
) -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "[OK] Platform services launched!" -ForegroundColor Green
Write-Host "     Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "     Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "     API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "[*] Opening browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
