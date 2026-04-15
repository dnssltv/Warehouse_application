param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

$hostAlias = "warehouse-breezy.local"
$hostsPath = "$env:WINDIR\System32\drivers\etc\hosts"
$launchBat = Join-Path $ProjectRoot "app_launch.bat"
$logoPng = Join-Path $ProjectRoot "frontend\public\warehouse-logo.png"
$logoIco = Join-Path $ProjectRoot "frontend\public\warehouse-logo.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Warehouse Breezy.lnk"

if (-not (Test-Path $launchBat)) {
  throw "Launch script not found: $launchBat"
}

function Update-HostsFile {
  param(
    [string]$Path,
    [string]$Alias
  )

  $content = if (Test-Path $Path) { Get-Content -Path $Path -ErrorAction Stop } else { @() }

  $normalized = @()
  foreach ($line in $content) {
    if ($line -match "^\s*#") {
      $normalized += $line
      continue
    }
    if ($line -match "(^|\s)$([regex]::Escape($Alias))($|\s)") {
      continue
    }
    $normalized += $line
  }

  $normalized += "127.0.0.1 $Alias"
  Set-Content -Path $Path -Value $normalized -Encoding ASCII
}

function Convert-PngToIco {
  param(
    [string]$PngPath,
    [string]$IcoPath
  )

  if (-not (Test-Path $PngPath)) {
    return $false
  }

  Add-Type -AssemblyName System.Drawing
  $bitmap = New-Object System.Drawing.Bitmap($PngPath)
  try {
    $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
    try {
      $fs = [System.IO.File]::Open($IcoPath, [System.IO.FileMode]::Create)
      try {
        $icon.Save($fs)
      } finally {
        $fs.Close()
      }
    } finally {
      $icon.Dispose()
    }
  } finally {
    $bitmap.Dispose()
  }
  return (Test-Path $IcoPath)
}

function Create-DesktopShortcut {
  param(
    [string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$LnkPath,
    [string]$IconPath
  )

  $wsh = New-Object -ComObject WScript.Shell
  $shortcut = $wsh.CreateShortcut($LnkPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $WorkingDirectory
  if (Test-Path $IconPath) {
    $shortcut.IconLocation = $IconPath
  } else {
    $shortcut.IconLocation = "shell32.dll,220"
  }
  $shortcut.Save()
}

Update-HostsFile -Path $hostsPath -Alias $hostAlias
[void](Convert-PngToIco -PngPath $logoPng -IcoPath $logoIco)
Create-DesktopShortcut -TargetPath $launchBat -WorkingDirectory $ProjectRoot -LnkPath $shortcutPath -IconPath $logoIco

Write-Host "Hosts entry added: 127.0.0.1 $hostAlias"
Write-Host "Shortcut created: $shortcutPath"
if (Test-Path $logoIco) {
  Write-Host "Icon generated from logo: $logoIco"
} else {
  Write-Host "Icon fallback used (logo conversion failed)."
}
