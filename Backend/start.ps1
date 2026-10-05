$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONUTF8 = '1'
function Invoke-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $Program" }
}
$pythonPath = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    Invoke-Checked 'python' @('-m', 'venv', '.venv')
}
Invoke-Checked $pythonPath @('-m', 'pip', 'install', '-r', 'requirements.txt')
Invoke-Checked $pythonPath @('manage.py', 'migrate')
$port = if ($env:WORTIFY_BACKEND_PORT) { $env:WORTIFY_BACKEND_PORT } else { '8000' }
Invoke-Checked $pythonPath @('manage.py', 'runserver', "127.0.0.1:$port")
