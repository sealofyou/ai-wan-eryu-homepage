param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$RequiredPath = "/shares/2026-07-18-workbuddy-competition/"
)

$ErrorActionPreference = "Stop"
$version = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveDir = Join-Path $ProjectRoot "output"
$archive = Join-Path $archiveDir "eryu-homepage-$version.tar.gz"
$remoteScriptPath = Join-Path $archiveDir "activate-vps2-$version.sh"
$remoteArchive = "/tmp/eryu-homepage-$version.tar.gz"
$remoteScript = "/tmp/activate-vps2-$version.sh"
$remoteRelease = "/srv/eryu-homepage/releases/$version"

New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null

Push-Location $ProjectRoot
try {
  npm test
  if ($LASTEXITCODE -ne 0) { throw "npm test failed" }

  npm run check
  if ($LASTEXITCODE -ne 0) { throw "npm run check failed" }

  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

  if (-not (Test-Path (Join-Path $ProjectRoot "dist/index.html"))) {
    throw "dist/index.html is missing"
  }

  tar -C (Join-Path $ProjectRoot "dist") -czf $archive .
  if ($LASTEXITCODE -ne 0) { throw "archive creation failed" }

  scp $archive "vps2:$remoteArchive"
  if ($LASTEXITCODE -ne 0) { throw "upload failed" }

  $remoteScriptBody = @'
set -euo pipefail
previous=$(readlink -f /srv/eryu-homepage/current)
mkdir -p '__REMOTE_RELEASE__'
tar -xzf '__REMOTE_ARCHIVE__' -C '__REMOTE_RELEASE__'
rm -f '__REMOTE_ARCHIVE__'
test -f '__REMOTE_RELEASE__/index.html'
test -f '__REMOTE_RELEASE____REQUIRED_PATH__index.html'
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
ln -sfn '__REMOTE_RELEASE__' /srv/eryu-homepage/current.next
mv -Tf /srv/eryu-homepage/current.next /srv/eryu-homepage/current
if ! curl -fsS -H 'Host: eryu.fun' 'http://127.0.0.1__REQUIRED_PATH__' >/dev/null; then
  ln -sfn "$previous" /srv/eryu-homepage/current.next
  mv -Tf /srv/eryu-homepage/current.next /srv/eryu-homepage/current
  rm -f '__REMOTE_SCRIPT__'
  exit 1
fi
rm -f '__REMOTE_SCRIPT__'
printf 'version=%s previous=%s current=%s\n' '__VERSION__' "$previous" "$(readlink -f /srv/eryu-homepage/current)"
'@
  $remoteScriptBody = $remoteScriptBody.Replace("__REMOTE_RELEASE__", $remoteRelease).Replace("__REMOTE_ARCHIVE__", $remoteArchive).Replace("__REMOTE_SCRIPT__", $remoteScript).Replace("__REQUIRED_PATH__", $RequiredPath).Replace("__VERSION__", $version)
  [System.IO.File]::WriteAllText($remoteScriptPath, $remoteScriptBody, (New-Object System.Text.UTF8Encoding($false)))

  scp $remoteScriptPath "vps2:$remoteScript"
  if ($LASTEXITCODE -ne 0) { throw "remote activation script upload failed" }

  ssh vps2 "bash $remoteScript"
  if ($LASTEXITCODE -ne 0) { throw "remote activation failed; previous release was restored" }
}
finally {
  if (Test-Path $remoteScriptPath) { Remove-Item -Force $remoteScriptPath }
  Pop-Location
}
