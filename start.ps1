param([switch]$Install)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONUTF8 = '1'
# This launcher always targets local test data, even in a production-configured shell.
$env:DJANGO_ENV = 'development'
$env:DJANGO_DEBUG = '1'
$env:DATABASE_URL = ' '
$env:DJANGO_DATABASE_ENGINE = 'sqlite'
$env:DJANGO_DB_PATH = Join-Path $PSScriptRoot 'Backend\db.sqlite3'
$env:MEDIA_STORAGE = 'local'
$env:DJANGO_MEDIA_ROOT = Join-Path $PSScriptRoot 'Backend\private_media'
$env:WORTIFY_ENV_FILE = Join-Path $PSScriptRoot 'Backend\.env'
Remove-Item Env:RENDER -ErrorAction SilentlyContinue
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
    if (-not (Test-Path 'Backend/.env')) { Copy-Item 'Backend/.env.example' 'Backend/.env' }
    & $pythonPath -X utf8 tools/run_local.py --check
    if ($LASTEXITCODE -eq 10) { exit 0 }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $npmPath = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
    if (-not $npmPath) { throw 'Node.js is required. Install Node.js 22.12+ and reopen this terminal.' }
    Write-Host 'Preparing Wortify...' -ForegroundColor Cyan
    $requirementsHash = (Get-FileHash 'Backend/requirements.txt').Hash
    $stamp = Join-Path $PSScriptRoot '.venv/wortify-requirements.txt'
    if ($Install -or -not (Test-Path $stamp) -or (Get-Content $stamp -Raw) -ne $requirementsHash) {
        Invoke-Checked $pythonPath @('-m', 'pip', 'install', '-r', 'Backend/requirements.txt', '--disable-pip-version-check')
        [IO.File]::WriteAllText($stamp, $requirementsHash)
    }
    if ($Install -or -not (Test-Path -LiteralPath 'Frontend\node_modules\vite\bin\vite.js')) {
        Invoke-Checked $npmPath @('--prefix', 'Frontend', 'ci', '--cache', (Join-Path $PSScriptRoot '.npm-cache'), '--no-audit', '--no-fund')
    }
    Invoke-Checked $pythonPath @('-X', 'utf8', 'Backend/manage.py', 'migrate')
    Invoke-Checked $pythonPath @('-X', 'utf8', 'tools/run_local.py')
} catch {
    Write-Host "`n$($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'See the Windows instructions at the top of README.md.'
    exit 1
}
