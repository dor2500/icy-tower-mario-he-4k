# Builds work\bin\xbrz_cli.exe (used by tools\build_web.py for the 6x HD graphics of the HTML version).
# xBRZ (c) Zenju, GPL-3.0 - sources from https://github.com/ioistired/xbrz.py (lib/). Needs Visual Studio Build Tools.
$ErrorActionPreference = 'Stop'
$R = Resolve-Path "$PSScriptRoot\..\.."
$src = "$R\work\dl\xbrz"
New-Item -ItemType Directory -Force $src, "$R\work\bin" | Out-Null
foreach ($f in 'xbrz.cpp', 'xbrz.h', 'xbrz_config.h', 'xbrz_tools.h', 'License.txt') {
  Invoke-WebRequest "https://raw.githubusercontent.com/ioistired/xbrz.py/master/lib/$f" -OutFile "$src\$f"
}
Set-Content "$src\dummy_module.cpp" '// python module stub not needed for the command line tool'
$vc = Get-ChildItem "${env:ProgramFiles(x86)}\Microsoft Visual Studio", "$env:ProgramFiles\Microsoft Visual Studio" -Recurse -Filter vcvars64.bat -EA SilentlyContinue | Select -First 1
if (-not $vc) { throw 'Visual Studio Build Tools (C++) not found' }
cmd /c "`"$($vc.FullName)`" >nul && cl /nologo /O2 /EHsc /std:c++17 /I`"$src`" `"$PSScriptRoot\xbrz_cli.cpp`" /Fe`"$R\work\bin\xbrz_cli.exe`" /Fo`"$R\work\bin\\`""
if ($LASTEXITCODE) { throw 'compile failed' }
"built $R\work\bin\xbrz_cli.exe"
