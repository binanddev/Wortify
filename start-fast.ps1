$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$pythonPath = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$vitePath = Join-Path $PSScriptRoot 'Frontend\node_modules\vite\bin\vite.js'

if (-not (Test-Path -LiteralPath $pythonPath)) {
    Write-Host 'Local Python environment is missing. Run .\start.ps1 once to prepare the project.' -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath $vitePath)) {
    Write-Host 'Frontend dependencies are missing. Run .\start.ps1 once to prepare the project.' -ForegroundColor Red
    exit 1
}

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js is required. Install Node.js and reopen this terminal.' -ForegroundColor Red
    exit 1
}

& $pythonPath -X utf8 (Join-Path $PSScriptRoot 'tools\run_local.py')
exit $LASTEXITCODE
