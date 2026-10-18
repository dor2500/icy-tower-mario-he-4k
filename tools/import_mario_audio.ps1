# Import the user's own Super Mario Bros. recordings into the super_mario character:
# cuts the effects out of the effects video, takes one seamless loop of the theme, writes 22 kHz 16-bit mono WAVs
# (what Allegro 4 loads) and points super_mario.txt at them. The audio is the user's and is never committed or released.
# usage: import_mario_audio.ps1 -Src "C:\Users\Dorp\Downloads\Video" -Char work\he_app\characters\super_mario
param([string]$Src, [string]$Char)
$ErrorActionPreference = 'Stop'
$fx = Join-Path $Src 'Sound Effects of Super Mario Bros.mp4'
$theme = Join-Path $Src 'Super Mario Bros. Theme Song.mp4'

# [start, end] in seconds inside the effects video (found with silencedetect + a pitch track)
$cuts = [ordered]@{
  'smb_jump.wav'    = @(41.23, 41.50)   # small jump
  'smb_sprout.wav'  = @(29.47, 30.04)   # power-up appears (rising sweep) -> medium jump
  'smb_vine.wav'    = @(38.86, 39.96)   # long rising sweep -> cartwheel jump
  'smb_powerup.wav' = @(23.74, 24.72)   # power-up -> new game
  'smb_pause.wav'   = @(0.00, 0.73)     # pause
  'smb_death.wav'   = @(26.11, 28.78)   # lose a life
  'smb_coin.wav'    = @(19.54, 20.45)   # coin -> standing on an edge
}
# decode to WAV first: cutting the MP4 directly lands off by the audio stream's start offset
$tmp = Join-Path $env:TEMP 'smb_import'; New-Item -ItemType Directory -Force $tmp | Out-Null
ffmpeg -v error -y -i $fx -vn -ac 1 -ar 44100 (Join-Path $tmp 'fx.wav')
ffmpeg -v error -y -i $theme -vn -ac 1 -ar 44100 (Join-Path $tmp 'theme.wav')
foreach ($k in $cuts.Keys) {
  $a, $b = $cuts[$k]; $d = [math]::Round($b - $a, 3); $fo = [math]::Max(0.0, $d - 0.03)
  ffmpeg -v error -y -i (Join-Path $tmp 'fx.wav') -ar 22050 -sample_fmt s16 -af "atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,afade=t=out:st=${fo}:d=0.03" (Join-Path $Char $k)
}
# one loop of the overworld theme (the video plays it twice, period 39.70 s)
ffmpeg -v error -y -i (Join-Path $tmp 'theme.wav') -ar 22050 -sample_fmt s16 -af "atrim=start=0.31:end=40.01,asetpts=PTS-STARTPTS,volume=-2dB" (Join-Path $Char 'smb_theme.wav')
Remove-Item $tmp -Recurse -Force

$txt = Join-Path $Char 'super_mario.txt'
$map = @{ jumplo = 'smb_jump.wav'; jumpmed = 'smb_sprout.wav'; jumphi = 'smb_vine.wav'; pause = 'smb_pause.wav';
          death = 'smb_death.wav'; greeting = 'smb_powerup.wav'; edge = 'smb_coin.wav' }
$lines = [IO.File]::ReadAllLines($txt) | Where-Object { $_ -notmatch '^\[bgmusic\]' }
$lines = $lines | ForEach-Object {
  if ($_ -match '^\[(\w+)\]' -and $map.ContainsKey($matches[1])) { "[$($matches[1])]`t`t$($map[$matches[1]])" } else { $_ }
}
$out = New-Object System.Collections.Generic.List[string]
foreach ($l in $lines) { $out.Add($l); if ($l -match '^\[edge\]') { $out.Add("[bgmusic]`t`tsmb_theme.wav") } }
[IO.File]::WriteAllLines($txt, $out, (New-Object Text.UTF8Encoding $false))
"imported into $Char"
