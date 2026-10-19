// icytower13.exe (built from this file) - the game on the desktop with all the changes: the HTML version (web\: stages, difficulty levels, characters,
// auto play, ads mode) in a full-screen WebView2 window, offline, drawn on the strong graphics card (NVIDIA / AMD).
// Built by tools\desktop\build_desktop.ps1 (csc of .NET Framework 4 + the WebView2 SDK from NuGet).
//   web\ next to the exe is served as https://icymario.game/ ; settings and highscores: %LOCALAPPDATA%\IcyMario
//   messages from the page: "exit", "fullscreen" (F11 / Alt+Enter), "open:<url>" (ads -> default browser),
//   "classic" (start the original 2003 engine, icytower13_classic.exe next to this exe, and close)
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyTitle("Icy Tower - Super Mario Edition (extended)")]
[assembly: System.Reflection.AssemblyProduct("Icy Tower 1.3.1 - Super Mario Edition")]
[assembly: System.Reflection.AssemblyVersion("1.4.0.0")]

static class Program {
  [STAThread]
  static void Main() {
    PreferStrongGpu();
    Application.EnableVisualStyles();
    Application.SetCompatibleTextRenderingDefault(false);
    Application.Run(new GameForm());
  }

  // Windows graphics settings ("High performance" = the NVIDIA / AMD card on laptops with two GPUs), the same entry
  // as Settings > System > Display > Graphics: for this app and for the classic game next to it
  static void PreferStrongGpu() {
    try {
      string dir = AppDomain.CurrentDomain.BaseDirectory;
      using (RegistryKey k = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\DirectX\UserGpuPreferences")) {
        foreach (string exe in new[] { Application.ExecutablePath, Path.Combine(dir, "icytower13_classic.exe") }) {
          if (File.Exists(exe) && k.GetValue(exe) == null) k.SetValue(exe, "GpuPreference=2;");
        }
      }
    } catch (Exception) { /* not important enough to stop the game */ }
  }
}


class GameForm : Form {
  CoreWebView2Controller ctl;
  bool full = true;
  Rectangle normal;

  public GameForm() {
    Text = "אייסי טאוור - מהדורת סופר מריו";
    BackColor = Color.Black;
    try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }
    StartPosition = FormStartPosition.Manual;
    Rectangle wa = Screen.PrimaryScreen.WorkingArea;
    normal = new Rectangle(wa.X + wa.Width / 8, wa.Y + wa.Height / 8, wa.Width * 3 / 4, wa.Height * 3 / 4);
    SetFull(true);
  }

  void SetFull(bool on) {
    full = on;
    if (on) {
      if (WindowState == FormWindowState.Normal && Visible && FormBorderStyle != FormBorderStyle.None) normal = Bounds;
      FormBorderStyle = FormBorderStyle.None;
      WindowState = FormWindowState.Normal;
      Bounds = Screen.FromControl(this).Bounds;
    } else {
      FormBorderStyle = FormBorderStyle.Sizable;
      WindowState = FormWindowState.Normal;
      Bounds = normal;
    }
    FocusGame();
  }

  protected override void OnResize(EventArgs e) {
    base.OnResize(e);
    if (ctl != null) ctl.Bounds = ClientRectangle;
  }

  // the keyboard goes to the game right away (no click needed), also after Alt+Tab
  protected override void OnActivated(EventArgs e) { base.OnActivated(e); FocusGame(); }
  protected override void OnGotFocus(EventArgs e) { base.OnGotFocus(e); FocusGame(); }
  void FocusGame() {
    if (ctl == null) return;
    try { ctl.MoveFocus(CoreWebView2MoveFocusReason.Programmatic); } catch (Exception) { }
  }

  protected override async void OnLoad(EventArgs e) {
    base.OnLoad(e);
    string root = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "web");
    string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "IcyMario");
    try {
      CoreWebView2EnvironmentOptions opt = new CoreWebView2EnvironmentOptions(
        "--force_high_performance_gpu --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy " +
        "--autoplay-policy=no-user-gesture-required");
      CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, data, opt);
      ctl = await env.CreateCoreWebView2ControllerAsync(Handle);
    } catch (Exception ex) {
      if (MessageBox.Show("כדי להפעיל את המהדורה המורחבת צריך את רכיב Microsoft Edge WebView2 (מגיע עם Windows 11).\n" +
          "לפתוח את דף ההורדה?\n\n" + ex.Message, Text, MessageBoxButtons.YesNo, MessageBoxIcon.Warning,
          MessageBoxDefaultButton.Button1, MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign) == DialogResult.Yes)
        OpenUrl("https://developer.microsoft.com/microsoft-edge/webview2/");
      Close();
      return;
    }
    ctl.DefaultBackgroundColor = Color.Black;
    ctl.Bounds = ClientRectangle;
    ctl.IsVisible = true;
    CoreWebView2 core = ctl.CoreWebView2;
    CoreWebView2Settings s = core.Settings;
    s.AreDefaultContextMenusEnabled = false;
    s.AreDevToolsEnabled = false;
    s.IsZoomControlEnabled = false;
    s.IsStatusBarEnabled = false;
    s.AreBrowserAcceleratorKeysEnabled = false;      // no F5 / Ctrl+F ... (F11 and Alt+Enter: handled by the page)
    s.IsPinchZoomEnabled = false;
    s.IsSwipeNavigationEnabled = false;
    core.SetVirtualHostNameToFolderMapping("icymario.game", root, CoreWebView2HostResourceAccessKind.Allow);
    core.WebMessageReceived += OnMessage;
    core.NewWindowRequested += (o, a) => { a.Handled = true; OpenUrl(a.Uri); };
    core.ContainsFullScreenElementChanged += (o, a) => SetFull(core.ContainsFullScreenElement || full);
    core.DocumentTitleChanged += (o, a) => { if (!string.IsNullOrEmpty(core.DocumentTitle)) Text = core.DocumentTitle; };
    core.NavigationCompleted += (o, a) => FocusGame();
    core.Navigate("https://icymario.game/index.html");
    FocusGame();
  }

  protected override void OnFormClosed(FormClosedEventArgs e) {
    if (ctl != null) ctl.Close();
    base.OnFormClosed(e);
  }

  void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
    string m;
    try { m = e.TryGetWebMessageAsString(); } catch (Exception) { return; }
    if (m == "exit") Close();
    else if (m == "fullscreen") SetFull(!full);
    else if (m.StartsWith("open:")) OpenUrl(m.Substring(5));
    else if (m == "classic") {
      string exe = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icytower13_classic.exe");
      if (File.Exists(exe)) {
        try { Process.Start(new ProcessStartInfo(exe) { WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory, UseShellExecute = true }); Close(); }
        catch (Exception) { }
      }
    }
  }

  static void OpenUrl(string url) {
    if (url == null || !(url.StartsWith("https://") || url.StartsWith("http://"))) return;
    try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch (Exception) { }
  }
}