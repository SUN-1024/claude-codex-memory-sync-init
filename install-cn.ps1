$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$env:REPOMEMO_MIRROR = "cn"
$InstallerSources = if ($env:REPOMEMO_INSTALLER_SOURCE) {
    @($env:REPOMEMO_INSTALLER_SOURCE)
} else {
    @(
        "https://cdn.jsdelivr.net/gh/SUN-1024/repomemo@main/install.ps1",
        "https://raw.githubusercontent.com/SUN-1024/repomemo/main/install.ps1"
    )
}

foreach ($InstallerSource in $InstallerSources) {
    if (Test-Path $InstallerSource) {
        & ([scriptblock]::Create((Get-Content -Raw -LiteralPath $InstallerSource)))
        return
    }
    $Installer = $null
    try {
        Write-Host "[RepoMemo] Downloading installer from $InstallerSource"
        $Installer = (Invoke-WebRequest -UseBasicParsing -Uri $InstallerSource).Content
    } catch {
        Write-Warning "RepoMemo installer source failed: $InstallerSource"
        continue
    }
    & ([scriptblock]::Create($Installer))
    return
}

throw "All RepoMemo installer download sources failed."
