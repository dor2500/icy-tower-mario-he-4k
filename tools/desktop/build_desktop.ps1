# Builds the desktop edition with all the changes: <Out>\<Name>.exe (build.ps1: icytower13.exe) (WebView2 host, tools\desktop\IcyMario.cs) + <Out>\web
# (the HTML version with its generated assets). Needs: .NET Framework 4 csc (in every Windows), internet once for the
# WebView2 SDK (NuGet, cached in work\dl\webview2), web\assets built by tools\build_web.py.
param([Parameter(Mandatory)][string]$Out, [string]$Icon, [string]$Name = 'IcyMario')
$ErrorActionPreference = 'Stop'
$R = Split-Path (Split-Path $PSScriptRoot)
$pkg = "$R\work\dl\webview2\pkg"
if (-not (Test-Path "$pkg\lib\net462\Microsoft.Web.WebView2.WinForms.dll")) {
  New-Item -ItemType Directory -Force "$R\work\dl\webview2" | Out-Null
  Invoke-WebRequest 'https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2' -OutFile "$R\work\dl\webview2\wv2.zip"
  Expand-Archive "$R\work\dl\webview2\wv2.zip" $pkg -Force
}
if (-not (Test-Path "$R\web\assets\assets.json")) { throw 'web\assets missing: run tools\build_web.py first' }
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force $Out | Out-Null
$lib = "$pkg\lib\net462"
Copy-Item "$lib\Microsoft.Web.WebView2.Core.dll", "$pkg\runtimes\win-x64\native\WebView2Loader.dll" $Out
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$cargs = @('/nologo', '/target:winexe', '/platform:x64', '/optimize+', "/out:$Out\$Name.exe",
  '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', "/r:$Out\Microsoft.Web.WebView2.Core.dll")
if ($Icon) { $cargs += "/win32icon:$Icon" }
& $csc @cargs "$PSScriptRoot\IcyMario.cs"
if ($LASTEXITCODE) { throw 'csc failed' }
# the game itself (no service worker: the app is offline anyway)
New-Item -ItemType Directory -Force "$Out\web" | Out-Null
Copy-Item "$R\web\index.html", "$R\web\style.css", "$R\web\ads.css", "$R\web\manifest.webmanifest" "$Out\web"
Copy-Item "$R\web\js", "$R\web\fonts", "$R\web\assets", "$R\web\modern" "$Out\web" -Recurse
"desktop edition: $Out"
