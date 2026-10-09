using System.Text;
using TyporaPluginInstaller.Core.Install;

namespace TyporaPluginInstaller.Cli;

/// <summary>
/// 无界面宿主：给自动化 / Linux 上验证用。
/// GUI 只是它的壳，两者共用 <see cref="InstallEngine"/>。
/// </summary>
internal static class Program
{
    private const string Usage = """
        typora-plugin-installer-cli —— 把第三方 Typora 插件包安装进 plugin 目录

        用法：
          typora-plugin-installer-cli --source <插件包目录> --target <plugin 目录> [选项]

        选项：
          -s, --source <dir>        插件包目录（包含 installer.toml）
          -t, --target <dir>        Typora 的 plugin 目录（含 global/settings/settings.default.toml）
          -m, --manifest <file>     显式指定清单文件（默认 <source>/installer.toml）
          -n, --dry-run             只演练，不写盘（别名 --check）
              --allow-non-plugin-target
                                    跳过"目标目录像不像 plugin 目录"的校验
              --json                以 JSON 输出结果
          -h, --help                显示本帮助

        退出码：0 成功；1 安装失败；2 参数错误
        """;

    private static int Main(string[] args)
    {
        try
        {
            return Run(args);
        }
        catch (InstallException e)
        {
            Console.Error.WriteLine("安装失败：" + e.Message);
            return 1;
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("意外错误：" + e);
            return 1;
        }
    }

    private static int Run(string[] args)
    {
        string? source = null;
        string? target = null;
        string? manifest = null;
        var dryRun = false;
        var allowNonPluginTarget = false;
        var json = false;

        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            switch (arg)
            {
                case "-h" or "--help":
                    Console.WriteLine(Usage);
                    return 0;
                case "-s" or "--source":
                    source = Next(args, ref i, arg);
                    break;
                case "-t" or "--target":
                    target = Next(args, ref i, arg);
                    break;
                case "-m" or "--manifest":
                    manifest = Next(args, ref i, arg);
                    break;
                case "-n" or "--dry-run" or "--check":
                    dryRun = true;
                    break;
                case "--allow-non-plugin-target":
                    allowNonPluginTarget = true;
                    break;
                case "--json":
                    json = true;
                    break;
                default:
                    Console.Error.WriteLine($"未知参数：{arg}");
                    Console.Error.WriteLine();
                    Console.Error.WriteLine(Usage);
                    return 2;
            }
        }

        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(target))
        {
            Console.Error.WriteLine("必须同时提供 --source 与 --target。");
            Console.Error.WriteLine();
            Console.Error.WriteLine(Usage);
            return 2;
        }

        var options = new InstallOptions
        {
            SourceDirectory = source!,
            TargetPluginDirectory = target!,
            ManifestPath = manifest,
            DryRun = dryRun,
            AllowNonPluginTarget = allowNonPluginTarget,
        };

        var result = InstallEngine.Install(options);

        if (json)
        {
            Console.WriteLine(Json(result));
        }
        else
        {
            Console.WriteLine(InstallEngine.Render(result));
        }

        return 0;
    }

    private static string Next(string[] args, ref int index, string flag)
    {
        if (index + 1 >= args.Length)
        {
            throw new ArgumentException($"参数 {flag} 缺少取值。");
        }
        return args[++index];
    }

    private static string Json(InstallResult result)
    {
        var sb = new StringBuilder();
        sb.AppendLine("{");
        sb.AppendLine($"  \"dryRun\": {(result.DryRun ? "true" : "false")},");
        sb.AppendLine($"  \"pluginId\": {Quote(result.Plan.Manifest.Id)},");
        sb.AppendLine($"  \"pluginName\": {Quote(result.Plan.Manifest.Name)},");
        sb.AppendLine($"  \"target\": {Quote(result.Plan.TargetPluginDirectory)},");
        sb.AppendLine($"  \"settingsPath\": {Quote(result.Plan.SettingsPath)},");
        sb.AppendLine($"  \"copiedFiles\": [{string.Join(", ", result.CopiedFiles.Select(Quote))}],");
        sb.AppendLine($"  \"warnings\": [{string.Join(", ", result.Plan.Warnings.Select(Quote))}],");
        sb.AppendLine($"  \"log\": [{string.Join(", ", result.Log.Select(Quote))}]");
        sb.AppendLine("}");
        return sb.ToString().TrimEnd();
    }

    private static string Quote(string value) =>
        "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", string.Empty) + "\"";
}
