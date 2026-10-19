; Icy Tower 1.3.1 - Hebrew + Super Mario Edition + 4K installer (unofficial)
#define AppDir "..\he_app"

[Setup]
AppId={{E68BE168-0CE8-45CC-A111-F6A640C24D5F}
AppName=Icy Tower 1.3.1 - סופר מריו (עברית)
AppVersion=1.3.1
AppVerName=Icy Tower 1.3.1 - סופר מריו, בעברית, 4K + מהדורה מורחבת
AppPublisher=Free Lunch Design
AppPublisherURL=http://www.freelunchdesign.com
DefaultDirName={autopf}\Icy Tower 1.3
DefaultGroupName=Icy Tower
UninstallDisplayIcon={app}\icytower13.exe
UninstallDisplayName=Icy Tower 1.3.1 - סופר מריו (עברית)
SetupIconFile=mario.ico
OutputDir=..\..\output
OutputBaseFilename=icytower13_mario_he_4k_install
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
DisableWelcomePage=no
PrivilegesRequired=admin
ShowLanguageDialog=no
VersionInfoCompany=Free Lunch Design
VersionInfoDescription=Icy Tower v1.3.1 - Super Mario Edition (Hebrew, 4K)
VersionInfoVersion=1.4.0.0

[Languages]
Name: "hebrew"; MessagesFile: "compiler:Languages\Hebrew.isl"

[Messages]
hebrew.WelcomeLabel2=אשף זה יתקין את [name/ver] במחשב שלך.%n%nזוהי גרסת מעריצים לא רשמית של המשחק החינמי Icy Tower מאת Free Lunch Design: מתורגמת לעברית, עם סופר מריו כדמות הראשית, ובתצוגת 4K חדה (cnc-ddraw).%n%nכלול גם: המהדורה המורחבת - שלבים, רמות קושי עם מפות משלהן, דמויות (לואיג'י, סטיב, קריפר, העז ועוד), משחק אוטומטי ומצב פרסומות. רצה על כרטיס המסך החזק (NVIDIA / AMD).%n%nמריו הוא סימן מסחרי של Nintendo; זוהי עבודת מעריצים שאינה למטרות רווח.%n%nמומלץ לסגור את כל היישומים האחרים לפני שממשיכים.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "classicicon"; Description: "גם קיצור דרך לגרסה הקלאסית בשולחן העבודה"; GroupDescription: "{cm:AdditionalIcons}"

[Dirs]
; the game writes its config, scores, log and replays next to the exe
Name: "{app}"; Permissions: users-modify
Name: "{app}\replays"; Permissions: users-modify

[Files]
Source: "{#AppDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "log.txt,tower.cfg,Screenshots,last_game.itr"
Source: "{#AppDir}\tower.cfg"; DestDir: "{app}"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\Icy Tower - מהדורה מורחבת"; Filename: "{app}\extended\IcyMario.exe"; WorkingDir: "{app}\extended"
Name: "{group}\Icy Tower - סופר מריו (קלאסי)"; Filename: "{app}\icytower13.exe"; WorkingDir: "{app}"
Name: "{group}\קרא אותי"; Filename: "{app}\readme.txt"
Name: "{group}\מדריך דמויות מותאמות"; Filename: "{app}\characters\characters.txt"
Name: "{group}\{cm:UninstallProgram,Icy Tower}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Icy Tower - מהדורה מורחבת"; Filename: "{app}\extended\IcyMario.exe"; WorkingDir: "{app}\extended"; Tasks: desktopicon
Name: "{autodesktop}\Icy Tower - סופר מריו (קלאסי)"; Filename: "{app}\icytower13.exe"; WorkingDir: "{app}"; Tasks: classicicon

[Run]
Filename: "{app}\extended\IcyMario.exe"; WorkingDir: "{app}\extended"; Description: "הפעלת המהדורה המורחבת"; Flags: nowait postinstall skipifsilent
Filename: "{app}\icytower13.exe"; WorkingDir: "{app}"; Description: "הפעלת הגרסה הקלאסית"; Flags: nowait postinstall skipifsilent unchecked
Filename: "{app}\readme.txt"; Description: "הצג את קובץ ההסבר"; Flags: postinstall shellexec skipifsilent unchecked

[Registry]
; Windows graphics settings: "High performance" = the NVIDIA / AMD card (laptops with two GPUs)
Root: HKCU; Subkey: "Software\Microsoft\DirectX\UserGpuPreferences"; ValueType: string; ValueName: "{app}\icytower13.exe"; ValueData: "GpuPreference=2;"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Microsoft\DirectX\UserGpuPreferences"; ValueType: string; ValueName: "{app}\extended\IcyMario.exe"; ValueData: "GpuPreference=2;"; Flags: uninsdeletevalue

[UninstallDelete]
Type: files; Name: "{app}\log.txt"
Type: files; Name: "{app}\tower.cfg"
