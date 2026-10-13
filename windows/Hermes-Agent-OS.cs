using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace HermesDesktopLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string electronExe = Path.Combine(appDir, @"node_modules\electron\dist\electron.exe");

                if (File.Exists(electronExe))
                {
                    ProcessStartInfo psi = new ProcessStartInfo(electronExe, ".")
                    {
                        WorkingDirectory = appDir,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    Process.Start(psi);
                    return;
                }

                // Fallback: search system PATH or npx electron
                ProcessStartInfo fallback = new ProcessStartInfo("cmd.exe", "/c call npx electron .")
                {
                    WorkingDirectory = appDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                Process.Start(fallback);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Hermes Agent OS Launcher Error:\n" + ex.Message,
                    "Hermes Agent OS — Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }
}
