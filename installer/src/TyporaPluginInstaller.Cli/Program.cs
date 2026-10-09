using System.Text;
using TyporaPluginInstaller.Core.Install;
using TyporaPluginInstaller.Core.Menu;

namespace TyporaPluginInstaller.Cli;

/// <summary>
/// 无界面宿主：给自动化 / Linux 上验证用。GUI 只是它的壳，两者共用 <see cref="InstallEngine"/>。
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

        右键菜单分组（不指定时：新建一个按目标语言命名的分组，放在最前）：
              --menu-group <名字>   放进该分组；名字不存在就新建。
                                    内置分组可以写键（__INTERACTIVE_PLUGINS__）
                                    也可以写显示名（交互插件 / Interactive Plugins）
              --menu-position <p>   新建分组时的位置：first（默认）或 last
              --menu-none           不注册右键菜单
              --list-groups         只列出目标当前的菜单分组后退出

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
        string? menuGroup = null;
        var menuNone = false;
        var menuPosition = MenuGroupPosition.First;
        var listGroups = false;
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
                case "--menu-group":
                    menuGroup = Next(args, ref i, arg);
                    break;
                case "--menu-position":
                    menuPosition = Next(args, ref i, arg).ToLowerInvariant() switch
                    {
                        "first" => MenuGroupPosition.First,
                        "last" => MenuGroupPosition.Last,
                        var other => throw new ArgumentException($"--menu-position 只支持 first / last，收到 {other}"),
                    };
                    break;
                case "--menu-none":
                    menuNone = true;
                    break;
                case "--list-groups":
                    listGroups = true;
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

        if (listGroups)
        {
            if (string.IsNullOrWhiteSpace(target))
            {
                Console.Error.WriteLine("--list-groups 需要同时提供 --target。");
                return 2;
            }
            PrintGroups(target!);
            return 0;
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
            MenuChoice = ResolveMenuChoice(target!, menuGroup, menuNone, menuPosition),
        };

        var result = InstallEngine.Install(options);

        Console.WriteLine(json ? Json(result) : InstallEngine.Render(result));
        return 0;
    }

    /// <summary>把 <c>--menu-group</c> 解析成"放进已有分组"或"新建分组"。</summary>
    private static MenuChoice? ResolveMenuChoice(string target, string? menuGroup, bool menuNone, MenuGroupPosition position)
    {
        if (menuNone)
        {
            return MenuChoice.Skip;
        }
        if (string.IsNullOrWhiteSpace(menuGroup))
        {
            return null;   // 交给安装器用默认行为（新建按语言命名的分组，放最前）
        }

        var catalog = InstallEngine.InspectMenus(target);
        // 既接受内部键（__INTERACTIVE_PLUGINS__），也接受列表里显示的译名（交互插件），
        // 免得用户照着 --list-groups 的输出敲名字却被当成"新建分组"。
        var existing = catalog.Groups.FirstOrDefault(g =>
            string.Equals(g.Key, menuGroup, StringComparison.Ordinal) ||
            string.Equals(g.DisplayTitle, menuGroup, StringComparison.Ordinal));
        return existing != null
            ? MenuChoice.Existing(existing.Key)
            : MenuChoice.New(menuGroup, position);
    }

    private static void PrintGroups(string target)
    {
        var catalog = InstallEngine.InspectMenus(target);
        Console.WriteLine($"目标语言        : {catalog.Locale}");
        Console.WriteLine($"建议新分组名    : {catalog.SuggestedGroupName}");
        Console.WriteLine($"菜单基线来自    : {catalog.BaseSource}");
        Console.WriteLine("当前菜单分组：");
        foreach (var group in catalog.Groups)
        {
            Console.WriteLine($"  {group}");
        }
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
        sb.AppendLine($"  \"menuGroup\": {(result.Plan.Menu == null ? "null" : Quote(result.Plan.Menu.Title))},");
        sb.AppendLine($"  \"menuGroupCreated\": {(result.Plan.Menu?.GroupCreated == true ? "true" : "false")},");
        sb.AppendLine($"  \"copiedFiles\": [{string.Join(", ", result.CopiedFiles.Select(Quote))}],");
        sb.AppendLine($"  \"warnings\": [{string.Join(", ", result.Plan.Warnings.Select(Quote))}],");
        sb.AppendLine($"  \"log\": [{string.Join(", ", result.Log.Select(Quote))}]");
        sb.AppendLine("}");
        return sb.ToString().TrimEnd();
    }

    private static string Quote(string value) =>
        "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", string.Empty) + "\"";
}
