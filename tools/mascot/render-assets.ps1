# Regenerates every mascot asset from src/Snappy/wwwroot/mascot.js + mascot.css:
# app icon, tray icons, pop-up animation strips and the save sound, into src/Snappy/Assets.
# Needs: Microsoft Edge (for headless rendering), Node.js 22+, Python 3.
$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$assets = Join-Path $repo 'src\Snappy\Assets'
$work = Join-Path ([IO.Path]::GetTempPath()) 'snappy-render'
$out = Join-Path $work 'frames'
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $out, $assets | Out-Null

$server = Start-Process python -ArgumentList '-m', 'http.server', '5178', '--bind', '127.0.0.1', '--directory', "$repo" -PassThru -WindowStyle Hidden
try {
    Start-Sleep -Seconds 1
    node (Join-Path $PSScriptRoot 'render.mjs') $out
    if ($LASTEXITCODE -ne 0) { throw 'render failed' }

    $ico = Join-Path $PSScriptRoot 'build_ico.py'
    python $ico (Join-Path $assets 'snappy.ico') (Get-ChildItem $out -Filter 'icon-*.png').FullName
    foreach ($state in 'recording', 'paused', 'saving', 'idle') {
        python $ico (Join-Path $assets "tray-$state.ico") (Get-ChildItem $out -Filter "tray-$state-*.png").FullName
    }
    Copy-Item (Join-Path $out 'overlay-*.png'), (Join-Path $out 'overlay.json') $assets -Force
    python (Join-Path $PSScriptRoot 'make_snap.py') (Join-Path $assets 'snap.wav')
    Write-Host "Assets written to $assets"
}
finally {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
}
