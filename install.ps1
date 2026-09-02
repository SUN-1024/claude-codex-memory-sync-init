$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-RepoMemo([string]$Message) {
    Write-Host "[RepoMemo] $Message"
}

function Get-EnvOrDefault([string]$Name, [string]$Default) {
    $Value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $Default }
    return $Value
}

$InstallRoot = Get-EnvOrDefault "REPOMEMO_INSTALL_ROOT" (Join-Path $env:LOCALAPPDATA "RepoMemo")
$BinDir = Get-EnvOrDefault "REPOMEMO_BIN_DIR" (Join-Path $InstallRoot "bin")
$PackageSpec = Get-EnvOrDefault "REPOMEMO_PACKAGE_SPEC" "repomemo@latest"
$Mirror = Get-EnvOrDefault "REPOMEMO_MIRROR" "global"
$ForcePrivateNode = (Get-EnvOrDefault "REPOMEMO_FORCE_PRIVATE_NODE" "0") -eq "1"
$SkipPathUpdate = (Get-EnvOrDefault "REPOMEMO_SKIP_PATH_UPDATE" "0") -eq "1"

if ([string]::IsNullOrWhiteSpace($InstallRoot) -or [System.IO.Path]::GetPathRoot($InstallRoot) -eq $InstallRoot) {
    throw "Unsafe installation root: $InstallRoot"
}
if (-not [System.IO.Path]::IsPathRooted($InstallRoot)) { throw "Installation root must be an absolute path: $InstallRoot" }
if ([string]::IsNullOrWhiteSpace($BinDir) -or [System.IO.Path]::GetPathRoot($BinDir) -eq $BinDir) {
    throw "Unsafe binary directory: $BinDir"
}
if (-not [System.IO.Path]::IsPathRooted($BinDir)) { throw "Binary directory must be an absolute path: $BinDir" }

if ($Mirror -eq "cn") {
    $NodeMirror = Get-EnvOrDefault "REPOMEMO_NODE_MIRROR" "https://npmmirror.com/mirrors/node"
    $Registry = Get-EnvOrDefault "REPOMEMO_NPM_REGISTRY" "https://registry.npmmirror.com"
    Write-RepoMemo "Using China mirrors: npmmirror Node.js and npm registry."
} else {
    $NodeMirror = Get-EnvOrDefault "REPOMEMO_NODE_MIRROR" "https://nodejs.org/dist"
    $Registry = Get-EnvOrDefault "REPOMEMO_NPM_REGISTRY" "https://registry.npmjs.org"
}

New-Item -ItemType Directory -Force -Path $InstallRoot, $BinDir | Out-Null
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("repomemo-install-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

try {
    $NodeExe = $null
    $NpmCommand = $null
    if (-not $ForcePrivateNode) {
        $NodeCandidate = Get-Command node -ErrorAction SilentlyContinue
        $NpmCandidate = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if ($NodeCandidate -and $NpmCandidate) {
            $NodeMajorText = & $NodeCandidate.Source -p "process.versions.node.split('.')[0]" 2>$null
            if ($LASTEXITCODE -eq 0 -and [int]$NodeMajorText -ge 22) {
                $NodeExe = $NodeCandidate.Source
                $NpmCommand = $NpmCandidate.Source
                Write-RepoMemo "Using existing Node.js $(& $NodeExe --version)."
            }
        }
    }

    if (-not $NodeExe) {
        $OsArchitecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
        $Architecture = switch ($OsArchitecture.ToUpperInvariant()) {
            "AMD64" { "x64" }
            "ARM64" { "arm64" }
            default { throw "Unsupported CPU architecture: $OsArchitecture" }
        }

        $IndexPath = Join-Path $TempDir "index.tab"
        Invoke-WebRequest -UseBasicParsing -Uri "$NodeMirror/index.tab" -OutFile $IndexPath
        $RequestedVersion = Get-EnvOrDefault "REPOMEMO_NODE_VERSION" ""
        $NodeVersion = $null
        if ($RequestedVersion) {
            $NodeVersion = $RequestedVersion
        } else {
            $VersionLine = Get-Content $IndexPath | Where-Object { $_ -match '^v24\.' } | Select-Object -First 1
            if ($VersionLine) { $NodeVersion = $VersionLine.Split("`t")[0] }
        }
        if (-not $NodeVersion) { throw "Could not find a Node.js 24 release in $NodeMirror/index.tab" }
        if ($NodeVersion -notmatch '^v24\.[0-9]+\.[0-9]+$') { throw "REPOMEMO_NODE_VERSION must be a complete Node.js 24 version such as v24.20.0" }

        $ArchiveName = "node-$NodeVersion-win-$Architecture.zip"
        $ArchivePath = Join-Path $TempDir $ArchiveName
        $SumsPath = Join-Path $TempDir "SHASUMS256.txt"
        Write-RepoMemo "Downloading private Node.js $NodeVersion (win-$Architecture)."
        Invoke-WebRequest -UseBasicParsing -Uri "$NodeMirror/$NodeVersion/$ArchiveName" -OutFile $ArchivePath
        Invoke-WebRequest -UseBasicParsing -Uri "$NodeMirror/$NodeVersion/SHASUMS256.txt" -OutFile $SumsPath

        $ChecksumLine = Get-Content $SumsPath | Where-Object { $_ -match ("\s" + [regex]::Escape($ArchiveName) + '$') } | Select-Object -First 1
        if (-not $ChecksumLine) { throw "Node.js checksum entry is missing for $ArchiveName" }
        $ExpectedChecksum = ($ChecksumLine -split '\s+')[0].ToUpperInvariant()
        $ActualChecksum = (Get-FileHash -Algorithm SHA256 -Path $ArchivePath).Hash.ToUpperInvariant()
        if ($ExpectedChecksum -ne $ActualChecksum) { throw "Node.js SHA-256 verification failed" }

        Expand-Archive -Path $ArchivePath -DestinationPath $TempDir -Force
        $RuntimeRoot = Join-Path $InstallRoot "runtime"
        $RuntimeDir = Join-Path $RuntimeRoot "node-$NodeVersion-win-$Architecture"
        New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
        if (-not (Test-Path $RuntimeDir)) {
            Move-Item -Path (Join-Path $TempDir "node-$NodeVersion-win-$Architecture") -Destination $RuntimeDir
        }
        $NodeExe = Join-Path $RuntimeDir "node.exe"
        $NpmCommand = Join-Path $RuntimeDir "npm.cmd"
    }

    if (-not (Test-Path $NodeExe)) { throw "Node.js executable is unavailable: $NodeExe" }
    if (-not (Test-Path $NpmCommand)) { throw "npm executable is unavailable: $NpmCommand" }

    $AppDir = Join-Path $InstallRoot ("app." + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Write-RepoMemo "Installing $PackageSpec."
    & $NpmCommand install --prefix $AppDir --no-save --omit=dev --ignore-scripts --registry=$Registry $PackageSpec
    if ($LASTEXITCODE -ne 0) { throw "npm installation failed with exit code $LASTEXITCODE" }

    $CliPath = Join-Path $AppDir "node_modules\repomemo\dist\cli.js"
    if (-not (Test-Path $CliPath)) { throw "RepoMemo CLI was not installed at $CliPath" }

    $WrapperPath = Join-Path $BinDir "repomemo.cmd"
    $WrapperTemp = Join-Path $BinDir (".repomemo." + [guid]::NewGuid().ToString("N") + ".tmp")
    Set-Content -Path $WrapperTemp -Encoding Ascii -Value "@`"$NodeExe`" `"$CliPath`" %*"
    Move-Item -LiteralPath $WrapperTemp -Destination $WrapperPath -Force

    if (-not $SkipPathUpdate) {
        $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
        $PathEntries = @($UserPath -split ';' | Where-Object { $_ })
        if ($PathEntries -notcontains $BinDir) {
            $NewUserPath = (($PathEntries + $BinDir) -join ';')
            [Environment]::SetEnvironmentVariable("Path", $NewUserPath, "User")
        }
        if (($env:Path -split ';') -notcontains $BinDir) { $env:Path = "$BinDir;$env:Path" }
    }

    $VersionOutput = & $WrapperPath --version
    if ($LASTEXITCODE -ne 0) { throw "Installed RepoMemo failed its version check" }
    Write-RepoMemo "Installed successfully: $VersionOutput"
    Write-RepoMemo "Run: `"$WrapperPath`" init --target C:\path\to\project"
    if (-not $SkipPathUpdate) { Write-RepoMemo "Open a new terminal before using repomemo by name." }
} finally {
    if (Test-Path $TempDir) { Remove-Item -LiteralPath $TempDir -Recurse -Force }
}
