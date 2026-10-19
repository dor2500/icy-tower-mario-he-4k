# Icy Tower 1.3.1 - Hebrew + Super Mario Edition + 4K: full build.
# Needs: Python 3 (pillow, numpy, scipy, pefile), Inno Setup 6. Windows only (set_icon uses UpdateResource).
# Inputs (not in git, see README): work\extract\app (the original game files), work\unpacked\icytower13.exe
# (UPX-unpacked original exe), work\dl\cnc-ddraw\x (cnc-ddraw release), work\tower.cfg.bak (a default config).
# -MarioAudio <folder>: also import your own SMB effects/theme videos (local builds only; never publish that build).
param([switch]$NoInstaller, [string]$MarioAudio)
$ErrorActionPreference = 'Stop'
$R = $PSScriptRoot; $T = "$R\tools"; $W = "$R\work"; $A = "$W\he_app"
$orig = "$W\extract\app"
function py { python -I @args; if ($LASTEXITCODE) { throw "python $args failed" } }

# 1. staging folder = original game + Hebrew texts
if (Test-Path $A) { Remove-Item $A -Recurse -Force }
Copy-Item $orig $A -Recurse
py "$T\make_texts.py" $A

# 2. graphics: Hebrew text bitmaps, then Mario (title face, menu cursor, instructions, icon)
py "$T\make_images.py" "$orig\data\data.dat" "$W\he_images"
py "$T\make_mario_gui.py" "$orig\data\data.dat" "$W\he_images"
py "$T\build_data.py" "$orig\data\data.dat" "$A\data\data.dat" "$W\he_images"

# 3. exe: Mario icon FIRST (UpdateResource rewrites the PE), then the Hebrew strings in a new .heb section
Copy-Item "$W\unpacked\icytower13.exe" "$W\icytower13_icon.exe" -Force
py "$T\set_icon.py" "$W\icytower13_icon.exe" "$W\he_images\mario.ico"
py "$T\patch_exe.py" "$W\icytower13_icon.exe" "$A\icytower13.exe"

# 4. Super Mario character (default) + 4K via cnc-ddraw
py "$T\make_mario.py" $A
if ($MarioAudio) { & "$T\import_mario_audio.ps1" -Src $MarioAudio -Char "$A\characters\super_mario" }
# the original Icy Tower music is removed: menu = the Mario theme (or silence), in game = silence, so the only
# music in the game is Mario's own [bgmusic] (smb_theme.wav, set by import_mario_audio.ps1)
if ($MarioAudio) { py "$T\set_music.py" "$orig\data\sfx13.dat" "$A\data\sfx13.dat" "$A\characters\super_mario\smb_theme.wav" }
else { py "$T\set_music.py" "$orig\data\sfx13.dat" "$A\data\sfx13.dat" }
# the spoken lines ("Good!", "Hurry up!" ...) in Hebrew, Mario-style voice (tools\voice, made by make_voice.py)
py "$T\set_voice.py" "$A\data\sfx13.dat" "$T\voice"
py "$T\set_default_char.py" "$W\tower.cfg.bak" "$A\tower.cfg" super_mario
Copy-Item "$W\dl\cnc-ddraw\x\ddraw.dll" $A
New-Item -ItemType Directory -Force "$A\Shaders" | Out-Null
Copy-Item "$W\dl\cnc-ddraw\x\Shaders\nearest-neighbor.glsl" "$A\Shaders\"
Copy-Item "$W\dl\cnc-ddraw\x\Shaders\xbrz" "$A\Shaders\" -Recurse   # HD / 8K look (libretro glsl-shaders)
Copy-Item "$T\ddraw.ini" $A
Copy-Item "$W\he_images\mario.ico" "$W\installer\mario.ico"

# 5. installer
if (-not $NoInstaller) {
  & "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" /Q "$W\installer\icytower_he.iss"
  if ($LASTEXITCODE) { throw 'ISCC failed' }
}

# 6. HTML version: the same graphics (6x xBRZ for HD/8K), fonts and sounds -> web\assets (needs work\bin\xbrz_cli.exe,
#    see tools\xbrz\xbrz_cli.cpp). Without -MarioAudio the web version has no music.
if (Test-Path "$W\bin\xbrz_cli.exe") { py "$T\build_web.py" $A "$R\web\assets" "$W\bin\xbrz_cli.exe" }
"done: $A"
