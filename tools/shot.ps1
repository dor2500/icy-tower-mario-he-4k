param([string]$Exe, [string]$Out, [int]$Wait = 6, [string[]]$Keys = @(), [switch]$Keep)
# Launch the game (or reuse the running one), send keys as scan codes, capture its window to $Out.
# Keys: up down left right enter esc space f1 del, or sleepNNN.
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Threading;
public class W {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static void Key(byte scan, bool ext) {
    uint f = 0x0008 | (ext ? 0x0001u : 0u);           // KEYEVENTF_SCANCODE
    keybd_event(0, scan, f, UIntPtr.Zero); Thread.Sleep(90);
    keybd_event(0, scan, f | 0x0002, UIntPtr.Zero);   // KEYUP
  }
}
"@
[W]::SetProcessDPIAware() | Out-Null
$map = @{ up = @(0x48, 1); down = @(0x50, 1); left = @(0x4B, 1); right = @(0x4D, 1); enter = @(0x1C, 0); esc = @(0x01, 0); space = @(0x39, 0); f1 = @(0x3B, 0); del = @(0x53, 1) }
# (icytower13.exe = the new game, icytower13_classic.exe = the original engine)
$p = Get-Process ([IO.Path]::GetFileNameWithoutExtension($Exe)) -EA SilentlyContinue | Select -First 1
if (-not $p) {
  $p = Start-Process -FilePath $Exe -WorkingDirectory (Split-Path $Exe) -PassThru
  Start-Sleep $Wait
  $p.Refresh()
}
$h = $p.MainWindowHandle
[W]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 300
foreach ($k in $Keys) {
  if ($k -match '^sleep(\d+)$') { Start-Sleep -Milliseconds $matches[1]; continue }
  $s = $map[$k.ToLower()]
  [W]::Key([byte]$s[0], [bool]$s[1]); Start-Sleep -Milliseconds 350
}
Start-Sleep -Milliseconds 700
$r = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$r) | Out-Null
$bmp = New-Object Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
$g = [Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
$bmp.Save($Out); "saved $Out"
if (-not $Keep) { Stop-Process -Id $p.Id -Force }
