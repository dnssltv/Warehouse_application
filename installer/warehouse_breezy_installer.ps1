param(
  [string]$HostAlias = "warehouse-breezy.local",
  [string]$ServerIp = "127.0.0.1"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

function Ensure-Admin {
  $current = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $argsLine = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -HostAlias `"$HostAlias`" -ServerIp `"$ServerIp`""
    Start-Process -FilePath "powershell.exe" -ArgumentList $argsLine -Verb RunAs | Out-Null
    exit 0
  }
}

function Resolve-BrowserTarget {
  $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  if (Test-Path $edge) { return @{ Target = $edge; Args = "--app=http://$HostAlias" } }
  $edge2 = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
  if (Test-Path $edge2) { return @{ Target = $edge2; Args = "--app=http://$HostAlias" } }
  $chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
  if (Test-Path $chrome) { return @{ Target = $chrome; Args = "--app=http://$HostAlias" } }
  $chrome2 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
  if (Test-Path $chrome2) { return @{ Target = $chrome2; Args = "--app=http://$HostAlias" } }
  return @{ Target = "cmd.exe"; Args = "/c start http://$HostAlias" }
}

function Update-Hosts {
  $hostsPath = "$env:WINDIR\System32\drivers\etc\hosts"
  $lines = if (Test-Path $hostsPath) { Get-Content $hostsPath } else { @() }
  $filtered = @()
  foreach ($line in $lines) {
    if ($line -match "^\s*#") { $filtered += $line; continue }
    if ($line -match "(^|\s)$([regex]::Escape($HostAlias))($|\s)") { continue }
    $filtered += $line
  }
  $filtered += "$ServerIp $HostAlias"
  Set-Content -Path $hostsPath -Value $filtered -Encoding ASCII
}

function Convert-LogoToIco {
  $pngPath = Join-Path $PSScriptRoot "warehouse-logo.png"
  $icoPath = Join-Path $PSScriptRoot "warehouse-logo.ico"
  if (-not (Test-Path $pngPath)) { return $null }
  Add-Type -AssemblyName System.Drawing
  $bitmap = New-Object System.Drawing.Bitmap($pngPath)
  try {
    $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
    try {
      $fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
      try { $icon.Save($fs) } finally { $fs.Close() }
    } finally { $icon.Dispose() }
  } finally { $bitmap.Dispose() }
  if (Test-Path $icoPath) { return $icoPath }
  return $null
}

function Create-Shortcut {
  param([string]$Target, [string]$Args, [string]$IconPath)
  $desktop = [Environment]::GetFolderPath("Desktop")
  $lnk = Join-Path $desktop "Warehouse Breezy.lnk"
  $wsh = New-Object -ComObject WScript.Shell
  $s = $wsh.CreateShortcut($lnk)
  $s.TargetPath = $Target
  $s.Arguments = $Args
  $s.WorkingDirectory = $PSScriptRoot
  if ($IconPath -and (Test-Path $IconPath)) {
    $s.IconLocation = $IconPath
  } else {
    $s.IconLocation = "shell32.dll,220"
  }
  $s.Save()
  return $lnk
}

Ensure-Admin
Update-Hosts
$browser = Resolve-BrowserTarget
$icon = Convert-LogoToIco
$shortcut = Create-Shortcut -Target $browser.Target -Args $browser.Args -IconPath $icon

[System.Windows.Forms.MessageBox]::Show(
  "Установка завершена.`nHosts: $ServerIp $HostAlias`nЯрлык: $shortcut",
  "Warehouse Breezy Installer",
  [System.Windows.Forms.MessageBoxButtons]::OK,
  [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
