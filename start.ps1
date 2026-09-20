$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONUTF8 = '1'
function Invoke-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Failed (exit $LASTEXITCODE): $Program $($Arguments -join ' ')" }
}
try {
    $pythonPath = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $pythonPath)) {
        $launcher = Get-Command py.exe -ErrorAction SilentlyContinue
        if ($launcher) { Invoke-Checked $launcher.Source @('-3', '-m', 'venv', '.venv') }
        else {
            $launcher = Get-Command python.exe -ErrorAction SilentlyContinue
            if (-not $launcher) { throw 'Python is required. Install Python 3.12+ and reopen this terminal.' }
            Invoke-Checked $launcher.Source @('-m', 'venv', '.venv')
        }
    }
    $npmPath = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
    if (-not $npmPath) { throw 'Node.js is required. Install Node.js 22.12+ and reopen this terminal.' }
    Write-Host 'Preparing Lernraum...' -ForegroundColor Cyan
    Invoke-Checked $pythonPath @('-m', 'pip', 'install', '-r', 'requirements.txt', '--disable-pip-version-check')
    if (-not (Test-Path -LiteralPath 'frontend-react\node_modules\vite\bin\vite.js')) {
        Invoke-Checked $npmPath @('--prefix', 'frontend-react', 'ci', '--cache', (Join-Path $PSScriptRoot '.npm-cache'), '--no-audit', '--no-fund')
    }
    Invoke-Checked $pythonPath @('-X', 'utf8', 'manage.py', 'migrate')
    Invoke-Checked $npmPath @('run', 'build')
    Invoke-Checked $pythonPath @('-X', 'utf8', 'tools/run_local.py')
} catch {
    Write-Host "`n$($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'See the Windows instructions at the top of README.md.'
    exit 1
}
