param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

Require-Command "python"
Require-Command "npm"

if (-not (Test-Path "backend\.venv\Scripts\python.exe")) {
  Write-Host "Creating backend virtual environment..." -ForegroundColor Cyan
  python -m venv backend\.venv
}

$pythonExe = (Resolve-Path "backend\.venv\Scripts\python.exe").Path

if (-not $SkipInstall) {
  Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
  & $pythonExe -m pip install -r backend\requirements.txt

  Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
  Push-Location "$root\frontend"
  npm install
  Pop-Location
}
elseif (-not (Test-Path "frontend\node_modules\.bin\next.cmd")) {
  Write-Host "Frontend dependencies missing; installing because Next.js is required..." -ForegroundColor Yellow
  Push-Location "$root\frontend"
  npm install
  Pop-Location
}

Write-Host "Training AI model..." -ForegroundColor Cyan
& $pythonExe ai-model\src\train.py

if ($LASTEXITCODE -ne 0) {
  throw "Model training failed."
}

$backendCommand = "Set-Location '$root\backend'; & '$pythonExe' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
$frontendCommand = "Set-Location '$root\frontend'; npm run dev"

$port8000InUse = (netstat -ano | Select-String ":8000" | Select-String "LISTENING")
$port3000InUse = (netstat -ano | Select-String ":3000" | Select-String "LISTENING")

if ($port8000InUse) {
  Write-Host "Port 8000 is already in use. Backend may already be running." -ForegroundColor Yellow
} else {
  Write-Host "Starting backend on http://localhost:8000/health ..." -ForegroundColor Green
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null
}

if ($port3000InUse) {
  Write-Host "Port 3000 is already in use. Frontend may already be running." -ForegroundColor Yellow
} else {
  Write-Host "Starting frontend on http://localhost:3000 ..." -ForegroundColor Green
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null
}

Write-Host "ClinIQ is launching in two new terminals." -ForegroundColor Yellow
