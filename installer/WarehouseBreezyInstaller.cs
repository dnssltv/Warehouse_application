using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Security.Principal;

namespace WarehouseBreezyInstaller
{
    internal static class Program
    {
        private const string HostAlias = "warehouse-breezy.local";
        private const string ShortcutName = "Warehouse Breezy.lnk";

        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                if (!IsAdministrator())
                {
                    RelaunchAsAdmin(args);
                    return 0;
                }

                string ip = args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]) ? args[0] : "127.0.0.1";
                if (args.Length == 0)
                {
                    Console.Write("Введите IP сервера (Enter для 127.0.0.1): ");
                    string input = Console.ReadLine() ?? "";
                    if (!string.IsNullOrWhiteSpace(input))
                    {
                        ip = input.Trim();
                    }
                }

                UpdateHosts(ip, HostAlias);
                string iconPath = EnsureIcon();
                CreateDesktopShortcut(iconPath);

                Console.WriteLine("Готово. Hosts: " + ip + " " + HostAlias);
                Console.WriteLine("Ярлык создан: " + Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), ShortcutName));
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Ошибка установки: " + ex.Message);
                return 1;
            }
        }

        private static bool IsAdministrator()
        {
            var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }

        private static void RelaunchAsAdmin(string[] args)
        {
            string exePath = Process.GetCurrentProcess().MainModule.FileName;
            string arguments = args.Length > 0 ? string.Join(" ", args.Select(EscapeArg)) : "";
            var psi = new ProcessStartInfo(exePath, arguments)
            {
                UseShellExecute = true,
                Verb = "runas"
            };
            Process.Start(psi);
        }

        private static string EscapeArg(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private static void UpdateHosts(string ip, string alias)
        {
            string hostsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), @"System32\drivers\etc\hosts");
            string[] lines = File.Exists(hostsPath) ? File.ReadAllLines(hostsPath) : new string[0];
            var filtered = lines.Where(line =>
            {
                string t = line.Trim();
                if (t.StartsWith("#")) return true;
                return !t.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries).Contains(alias, StringComparer.OrdinalIgnoreCase);
            }).ToList();

            filtered.Add(ip + " " + alias);
            File.WriteAllLines(hostsPath, filtered);
        }

        private static string EnsureIcon()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string[] candidates =
            {
                Path.Combine(baseDir, "warehouse-logo.png"),
                Path.Combine(baseDir, @"frontend\public\warehouse-logo.png")
            };

            string pngPath = candidates.FirstOrDefault(File.Exists);
            if (pngPath == null)
            {
                return null;
            }

            string icoPath = Path.Combine(baseDir, "warehouse-logo.ico");
            using (var bmp = new Bitmap(pngPath))
            {
                IntPtr hIcon = bmp.GetHicon();
                using (var icon = Icon.FromHandle(hIcon))
                using (var fs = new FileStream(icoPath, FileMode.Create))
                {
                    icon.Save(fs);
                }
            }

            return File.Exists(icoPath) ? icoPath : null;
        }

        private static void CreateDesktopShortcut(string iconPath)
        {
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string shortcutPath = Path.Combine(desktop, ShortcutName);
            string url = "http://" + HostAlias;

            string edge = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe");
            string edge2 = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe");
            string chrome = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe");
            string chrome2 = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe");

            string target;
            string args;
            if (File.Exists(edge)) { target = edge; args = "--app=" + url; }
            else if (File.Exists(edge2)) { target = edge2; args = "--app=" + url; }
            else if (File.Exists(chrome)) { target = chrome; args = "--app=" + url; }
            else if (File.Exists(chrome2)) { target = chrome2; args = "--app=" + url; }
            else { target = "cmd.exe"; args = "/c start " + url; }

            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            dynamic shell = Activator.CreateInstance(shellType);
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = target;
            shortcut.Arguments = args;
            shortcut.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;
            shortcut.Description = "Warehouse Breezy";
            shortcut.IconLocation = !string.IsNullOrWhiteSpace(iconPath) && File.Exists(iconPath) ? iconPath : "shell32.dll,220";
            shortcut.Save();
        }
    }
}
