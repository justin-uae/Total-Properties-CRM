# TBC Scan Helper
#
# Runs in the background on a reception PC and lets the CRM's SCAN button use the
# scanner attached to this PC. The CRM (in the browser) calls this helper on
# http://localhost:47115; the helper runs NAPS2 (free, https://www.naps2.com) to do
# the actual scan and hands the PDF back to the browser, which attaches it to the
# record.
#
# Only the CRM's own web address may use it (see $AllowedOrigins), so other websites
# open in the browser cannot trigger scans or read scanned documents.
#
# Installed by install-scan-helper.cmd (downloaded from the CRM). By hand:
#   powershell -ExecutionPolicy Bypass -File scan-helper.ps1 -Install    (start now and at every login)
#   powershell -ExecutionPolicy Bypass -File scan-helper.ps1 -Uninstall  (stop and remove from startup)
#
# Keep this file ASCII-only: Windows PowerShell 5.1 misreads UTF-8 files without a BOM.

param([switch]$Install, [switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$Version = '1.0.0'
$Port = 47115
$ScanTimeoutMs = 10 * 60 * 1000
# Filled in by the CRM when this file is downloaded.
$AllowedOrigins = @(__ALLOWED_ORIGINS__)
$ShortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'TBC Scan Helper.lnk'

function Find-Naps2 {
  $candidates = @($env:TBC_NAPS2_PATH)
  if ($env:ProgramFiles) { $candidates += Join-Path $env:ProgramFiles 'NAPS2\NAPS2.Console.exe' }
  if (${env:ProgramFiles(x86)}) { $candidates += Join-Path ${env:ProgramFiles(x86)} 'NAPS2\NAPS2.Console.exe' }
  if ($env:LOCALAPPDATA) { $candidates += Join-Path $env:LOCALAPPDATA 'Programs\NAPS2\NAPS2.Console.exe' }
  foreach ($c in $candidates) { if ($c -and (Test-Path -LiteralPath $c)) { return $c } }
  $cmd = Get-Command 'NAPS2.Console.exe' -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

# Profile names set up in NAPS2 (Profiles button), so staff can pick e.g. "Cheque - both sides".
function Get-Naps2Profiles {
  $file = Join-Path $env:APPDATA 'NAPS2\profiles.xml'
  if (-not (Test-Path -LiteralPath $file)) { return @() }
  try {
    [xml]$xml = Get-Content -LiteralPath $file -Raw
    return @($xml.SelectNodes('//ScanProfile') | ForEach-Object {
      @{ name = [string]$_.DisplayName; isDefault = ([string]$_.IsDefault -eq 'true') }
    } | Where-Object { $_.name })
  } catch {
    return @()
  }
}

function Stop-RunningHelper {
  try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/shutdown" -Headers @{ 'X-TBC-Scan' = '1' } -Body '' -TimeoutSec 3 | Out-Null
    Start-Sleep -Milliseconds 500
  } catch {}
}

if ($Uninstall) {
  Stop-RunningHelper
  Remove-Item -LiteralPath $ShortcutPath -ErrorAction SilentlyContinue
  Write-Host 'TBC Scan Helper stopped and removed from startup.'
  exit 0
}

if ($Install) {
  Stop-RunningHelper
  $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($ShortcutPath)
  $lnk.TargetPath = $powershell
  $lnk.Arguments = $arguments
  $lnk.WindowStyle = 7
  $lnk.Description = 'Lets the CRM scan documents with this PC''s scanner'
  $lnk.Save()
  Start-Process -FilePath $powershell -ArgumentList $arguments -WindowStyle Hidden
  Write-Host 'TBC Scan Helper is installed and running. It will start automatically when you log in.'
  if (-not (Find-Naps2)) {
    Write-Host ''
    Write-Host 'NAPS2 was not found on this PC. Install it from https://www.naps2.com/download, then set up your scanner in NAPS2 (Profiles button).'
  }
  exit 0
}

function Send-Bytes($ctx, [int]$status, [string]$contentType, [byte[]]$bytes) {
  $res = $ctx.Response
  $res.StatusCode = $status
  $res.ContentType = $contentType
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.OutputStream.Close()
}

function Send-Json($ctx, [int]$status, $body) {
  $json = ConvertTo-Json -InputObject $body -Depth 5 -Compress
  Send-Bytes $ctx $status 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($json))
}

function Invoke-Scan([string]$profileName) {
  $naps2 = Find-Naps2
  if (-not $naps2) { throw 'NAPS2 is not installed on this PC. Install it from https://www.naps2.com/download.' }

  $out = Join-Path ([IO.Path]::GetTempPath()) ('tbc-scan-' + [guid]::NewGuid().ToString('N') + '.pdf')
  $arguments = "-o `"$out`""
  if ($profileName) {
    if ($profileName.Contains('"')) { throw 'Invalid NAPS2 profile name.' }
    $arguments += " -p `"$profileName`""
  }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $naps2
  $psi.Arguments = $arguments
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = [Diagnostics.Process]::Start($psi)
  $stdout = $p.StandardOutput.ReadToEndAsync()
  $stderr = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit($ScanTimeoutMs)) {
    try { $p.Kill() } catch {}
    throw 'The scan took too long and was stopped.'
  }
  $p.WaitForExit()
  $log = ($stdout.Result + "`n" + $stderr.Result).Trim()

  if (-not (Test-Path -LiteralPath $out)) {
    if ($log -match 'No scanned pages') { throw 'No pages were scanned. Check the document is in the scanner and try again.' }
    if ($log) { throw "NAPS2 could not scan: $log" }
    throw 'NAPS2 did not produce a scan. Open NAPS2 and check the scanner works there first.'
  }
  try {
    return [IO.File]::ReadAllBytes($out)
  } finally {
    Remove-Item -LiteralPath $out -ErrorAction SilentlyContinue
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
  $listener.Start()
} catch {
  # Another copy is already running (or the port is taken).
  exit 1
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    # Browsers always send Origin on these requests; local programs (like -Install) do not.
    $origin = $req.Headers['Origin']
    if ($origin) {
      if ($AllowedOrigins -notcontains $origin) {
        Send-Json $ctx 403 @{ message = 'This website is not allowed to use the scanner.' }
        continue
      }
      $res.AddHeader('Access-Control-Allow-Origin', $origin)
      $res.AddHeader('Vary', 'Origin')
      $res.AddHeader('Access-Control-Allow-Private-Network', 'true')
    }

    $path = $req.Url.AbsolutePath.TrimEnd('/').ToLowerInvariant()

    if ($req.HttpMethod -eq 'OPTIONS') {
      $res.AddHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      $res.AddHeader('Access-Control-Allow-Headers', 'X-TBC-Scan')
      $res.AddHeader('Access-Control-Max-Age', '600')
      $res.StatusCode = 204
      $res.Close()
      continue
    }

    if ($req.HttpMethod -eq 'GET' -and $path -eq '/status') {
      Send-Json $ctx 200 @{ ok = $true; version = $Version; naps2 = [bool](Find-Naps2); profiles = @(Get-Naps2Profiles) }
      continue
    }

    # The custom header forces a CORS preflight, so a page from another site can't even start a scan.
    if ($req.HttpMethod -ne 'POST' -or $req.Headers['X-TBC-Scan'] -ne '1') {
      Send-Json $ctx 404 @{ message = 'Not found' }
      continue
    }

    if ($path -eq '/scan') {
      $bytes = Invoke-Scan $req.QueryString['profile']
      Send-Bytes $ctx 200 'application/pdf' $bytes
      continue
    }

    if ($path -eq '/shutdown') {
      Send-Json $ctx 200 @{ ok = $true }
      $listener.Stop()
      break
    }

    Send-Json $ctx 404 @{ message = 'Not found' }
  } catch {
    try { Send-Json $ctx 500 @{ message = $_.Exception.Message } } catch {}
  }
}
