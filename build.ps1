# Crea il pacchetto dell'estensione (solo i file che il browser carica) in dist\outlook-web-reply-all-cc.zip.
# Nessuna dipendenza: JavaScript puro, Manifest V3.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null

$zip = Join-Path $dist 'outlook-web-reply-all-cc.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$root\extension\*" -DestinationPath $zip
Write-Host "Pacchetto -> $zip" -ForegroundColor Green
