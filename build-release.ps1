# Builds everything for a GitHub release into .\dist:
#   SnappySetup-<version>.exe              the installer, with Snappy inside
#   Snappy-<version>-win-x64.zip           the program alone, which the auto updater downloads
#   Snappy-<version>-win-x64.zip.sha256    its checksum, which the updater verifies
#   Snappy-<version>-source.zip            the source code without build output
#
# Needs the .NET 8 SDK. The version comes from src\Snappy\Snappy.csproj.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$ffmpegVersion = '9.0.1'
$ffmpegSha256 = 'fec81ae03971d9dd4be3ebe02e263bd2ec1d789483f931bdba5f5715e65da2e9'
$ffmpegUrls = @(
    "https://github.com/GyanD/codexffmpeg/releases/download/$ffmpegVersion/ffmpeg-$ffmpegVersion-essentials_build.zip",
    "https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-$ffmpegVersion-essentials_build.zip"
)

# Zip entries always use forward slashes, whatever the .NET version behind PowerShell does by default.
function New-Zip([string]$Folder, [string]$Destination, [string]$Prefix = '') {
    $archive = [IO.Compression.ZipFile]::Open($Destination, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in Get-ChildItem $Folder -Recurse -File) {
            $name = $Prefix + $file.FullName.Substring($Folder.Length + 1).Replace('\', '/')
            [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $name, [IO.Compression.CompressionLevel]::Optimal)
        }
    } finally {
        $archive.Dispose()
    }
}

[xml]$project = Get-Content 'src\Snappy\Snappy.csproj'
$version = @($project.Project.PropertyGroup | ForEach-Object { $_.Version } | Where-Object { $_ })[0]
Write-Host "Building Snappy $version"

# 1. FFmpeg
$ffmpegDir = Join-Path $PSScriptRoot 'ffmpeg'
if (-not (Test-Path (Join-Path $ffmpegDir 'ffmpeg.exe'))) {
    New-Item -ItemType Directory -Force $ffmpegDir | Out-Null
    $download = Join-Path $env:TEMP "ffmpeg-$ffmpegVersion-essentials_build.zip"
    foreach ($url in $ffmpegUrls) {
        try {
            Write-Host "Downloading FFmpeg from $url"
            Invoke-WebRequest $url -OutFile $download -UseBasicParsing
            break
        } catch {
            Write-Warning "That didn't work: $($_.Exception.Message)"
        }
    }
    if (-not (Test-Path $download)) {
        throw "Couldn't download FFmpeg. Put ffmpeg.exe and LICENSE from the gyan.dev $ffmpegVersion essentials build into .\ffmpeg"
    }
    $hash = (Get-FileHash $download -Algorithm SHA256).Hash
    if ($hash -ne $ffmpegSha256) {
        Remove-Item $download
        throw "The FFmpeg download has an unexpected checksum ($hash)"
    }
    $archive = [IO.Compression.ZipFile]::OpenRead($download)
    try {
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -match '^[^/]+/bin/ffmpeg\.exe$') {
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $ffmpegDir 'ffmpeg.exe'), $true)
            } elseif ($entry.FullName -match '^[^/]+/LICENSE$') {
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $ffmpegDir 'LICENSE'), $true)
            }
        }
    } finally {
        $archive.Dispose()
    }
    Remove-Item $download
}

# 2. The program
$dist = Join-Path $PSScriptRoot 'dist'
$app = Join-Path $dist 'app'
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
dotnet publish 'src\Snappy\Snappy.csproj' -c Release -r win-x64 --self-contained true -o $app --nologo
if ($LASTEXITCODE) { throw 'Publishing Snappy failed' }
Get-ChildItem $app -Recurse -Filter *.pdb | Remove-Item
Copy-Item 'LICENSE', 'THIRD-PARTY-NOTICES.md' $app

# 3. The file list. Updates and uninstalling only ever touch the files named here.
$files = Get-ChildItem $app -Recurse -File | ForEach-Object { $_.FullName.Substring($app.Length + 1) } | Sort-Object
[IO.File]::WriteAllLines((Join-Path $app 'snappy-files.txt'), [string[]]$files, (New-Object Text.UTF8Encoding $false))

# 4. Zip and checksum
$zipName = "Snappy-$version-win-x64.zip"
$zip = Join-Path $dist $zipName
New-Zip $app $zip
$sha = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$zip.sha256", "$sha  $zipName`n")

# 5. Setup
$setupOut = Join-Path $dist 'setup'
dotnet build 'src\Snappy.Setup\Snappy.Setup.csproj' -c Release "-p:Version=$version" "-p:PayloadZip=$zip" -o $setupOut --nologo
if ($LASTEXITCODE) { throw 'Building the setup failed' }
Move-Item (Join-Path $setupOut 'SnappySetup.exe') (Join-Path $dist "SnappySetup-$version.exe")
Remove-Item $setupOut, $app -Recurse -Force

# 6. Source code, without build output or FFmpeg
$source = Join-Path $dist "Snappy-$version-source"
New-Item -ItemType Directory $source | Out-Null
Copy-Item '.gitignore', 'LICENSE', 'README.md', 'THIRD-PARTY-NOTICES.md', 'build-release.ps1' $source
foreach ($dir in 'src', 'tools') {
    robocopy $dir (Join-Path $source $dir) /E /XD bin obj node_modules /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying $dir failed" }
}
$global:LASTEXITCODE = 0
New-Zip $source (Join-Path $dist "Snappy-$version-source.zip") "Snappy-$version-source/"
Remove-Item $source -Recurse -Force

Write-Host ''
Write-Host "Done. Release files are in $dist"
Get-ChildItem $dist | Format-Table Name, @{ Name = 'MB'; Expression = { [math]::Round($_.Length / 1MB, 1) } } -AutoSize
