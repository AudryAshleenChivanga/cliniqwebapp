$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path "backend\.venv\Scripts\python.exe")) {
  python -m venv backend\.venv
}

$pythonExe = (Resolve-Path "backend\.venv\Scripts\python.exe").Path
& $pythonExe -m pip install -r backend\requirements.txt
& $pythonExe ai-model\src\train.py
