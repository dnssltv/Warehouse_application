[Version]
Class=IEXPRESS
SEDVersion=3

[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=I
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
SelfDelete=0
CAB_ResvCodeSigning=0
CompressionType=MSZIP
SignTool=0
RestartIfNeeded=0
TimeStamp=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=.\WarehouseBreezyInstaller.exe
FriendlyName=Warehouse Breezy Installer
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File warehouse_breezy_installer.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0=""
FILE1=""

[SourceFiles]
SourceFiles0=.

[SourceFiles0]
%FILE0%=
%FILE1%=

[Strings]
FILE0=warehouse_breezy_installer.ps1
FILE1=warehouse-logo.png
