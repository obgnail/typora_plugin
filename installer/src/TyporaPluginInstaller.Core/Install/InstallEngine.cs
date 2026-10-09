using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using TyporaPluginInstaller.Core.Manifest;
using TyporaPluginInstaller.Core.Menu;
using TyporaPluginInstaller.Core.Toml;

namespace TyporaPluginInstaller.Core.Install;

/// <summary>
/// 安装引擎：插件包 + installer.toml → 目标 plugin 目录 + settings.user.toml。
/// <para>分两步：<see cref="CreatePlan"/> 做全部校验并产出可展示的计划，
/// <see cref="Execute"/> 才真正写盘。两步都纯本地、无网络。</para>
/// </summary>
public static class InstallEngine
{
    private const string DefaultSettingsRelativePath = "global/settings/settings.default.toml";
    private const string UserSettingsRelativePath = "global/settings/settings.user.toml";
    private const string Separator = "---";

    /// <summary>粗略探测插件是否覆盖了 <c>call</c> / 提供了动作列表（用于菜单可点击性提示）。</summary>
    private static readonly Regex ActionDefinitionPattern = new(
        @"(?m)^\s*(call|staticActions|getDynamicActions)\s*[=:(]",
        RegexOptions.Compiled);

    private static StringComparison PathComparison =>
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    /// <summary>用户主目录来源；测试可替换。</summary>
    internal static Func<string?> HomeDirectoryProvider { get; set; } =
        () => Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

    // ---------------------------------------------------------------- planning

    public static InstallPlan CreatePlan(InstallOptions options)
    {
        var warnings = new List<string>();

        var sourceDir = Path.GetFullPath(options.SourceDirectory);
        if (!Directory.Exists(sourceDir))
        {
            throw new InstallException($"插件包目录不存在：{sourceDir}");
        }

        var manifestPath = string.IsNullOrWhiteSpace(options.ManifestPath)
            ? Path.Combine(sourceDir, InstallManifest.FileName)
            : Path.GetFullPath(options.ManifestPath!);

        InstallManifest manifest;
        try
        {
            manifest = ManifestLoader.Load(manifestPath);
        }
        catch (ManifestException e)
        {
            throw new InstallException(e.Message);
        }

        var targetDir = Path.GetFullPath(options.TargetPluginDirectory);
        if (!Directory.Exists(targetDir))
        {
            throw new InstallException($"目标 plugin 目录不存在：{targetDir}");
        }

        if (!options.AllowNonPluginTarget && !LooksLikePluginDirectory(targetDir))
        {
            throw new InstallException(
                $"这个目录看起来不是 Typora 的 plugin 目录：{targetDir}\n" +
                "它应当包含 global/settings/settings.default.toml 或 global/core/（通常位于 <Typora>/resources/plugin）。");
        }

        var manifestDir = Path.GetDirectoryName(manifestPath)!;
        var contentDir = Path.GetFullPath(Path.Combine(manifestDir, manifest.SourceDirectory));
        if (!Directory.Exists(contentDir))
        {
            throw new InstallException($"install.source 指向的目录不存在：{contentDir}");
        }

        if (!FileSystemHelper.IsWithin(contentDir, manifestDir))
        {
            throw new InstallException($"install.source 必须位于插件包目录内，不允许用 .. 逃逸：{manifest.SourceDirectory}");
        }

        var files = CollectFiles(manifest, manifestPath, manifestDir, contentDir, targetDir, warnings);

        // 入口自检：插件系统的加载器只认 plugin/<id>.js 与 plugin/<id>/index.js。
        var entryJs = Path.Combine(targetDir, manifest.Id + ".js");
        var entryIndex = Path.Combine(targetDir, manifest.Id, "index.js");
        var entryAlreadyPresent = File.Exists(entryJs) || File.Exists(entryIndex);
        var entryPlanned = files.Any(f =>
            string.Equals(f.TargetPath, entryJs, PathComparison) ||
            string.Equals(f.TargetPath, entryIndex, PathComparison));

        if (!entryAlreadyPresent && !entryPlanned)
        {
            throw new InstallException(
                $"安装后仍找不到插件入口。\n" +
                $"插件包需要提供 {manifest.Id}.js 或 {manifest.Id}/index.js（当前 install.source = \"{manifest.SourceDirectory}\"）。");
        }

        var (settingsPath, fromProfile) = ResolveSettingsPath(targetDir);
        var settingsExists = File.Exists(settingsPath);
        if (!settingsExists)
        {
            warnings.Add($"settings.user.toml 不存在，将在该位置新建：{settingsPath}");
        }

        // "要不要上菜单"由插件清单决定（mode），"放到哪个分组"由安装器决定（MenuChoice）；
        // 安装器选择"不注册"时也可以覆盖掉插件作者的意愿。
        var skipMenu = manifest.Menu == MenuMode.None || options.MenuChoice?.Kind == MenuChoiceKind.None;

        if (!skipMenu)
        {
            CheckMenuClickability(manifest, entryJs, entryIndex, files, warnings);
        }

        MenuPlan? menu = null;
        if (!skipMenu)
        {
            menu = PlanMenus(manifest, targetDir, settingsPath, options.MenuChoice, warnings);
        }

        var overwrites = files.Count(f => f.Overwrites);
        if (overwrites > 0)
        {
            warnings.Add($"有 {overwrites} 个目标文件已存在，将按 install.overwrite = {manifest.Overwrite.ToString().ToLowerInvariant()} 处理。");
        }

        if (!string.IsNullOrWhiteSpace(manifest.MinTypora))
        {
            warnings.Add($"此插件要求 Typora >= {manifest.MinTypora}（安装器不做版本校验）。");
        }

        return new InstallPlan
        {
            Manifest = manifest,
            SourceDirectory = sourceDir,
            ContentDirectory = contentDir,
            TargetPluginDirectory = targetDir,
            SettingsPath = settingsPath,
            SettingsFileExists = settingsExists,
            SettingsFromUserProfile = fromProfile,
            Files = files,
            Warnings = warnings,
            Menu = menu,
            EntryAlreadyPresent = entryAlreadyPresent,
        };
    }

    // --------------------------------------------------------------- executing

    public static InstallResult Execute(InstallOptions options, InstallPlan plan)
    {
        var log = new List<string>();
        var copied = new List<string>();

        log.Add($"插件：{plan.Manifest.Name} ({plan.Manifest.Id})" +
                (string.IsNullOrWhiteSpace(plan.Manifest.Version) ? string.Empty : $" v{plan.Manifest.Version}"));
        log.Add($"插件包：{plan.Manifest.ManifestPath}");
        log.Add($"核心文件目录：{plan.ContentDirectory}");
        log.Add($"目标 plugin 目录：{plan.TargetPluginDirectory}");
        log.Add(options.DryRun ? "模式：试运行（不写入任何文件）" : "模式：实际安装");
        log.Add(string.Empty);

        log.Add($"[1/3] 复制核心文件（{plan.Files.Count} 个）");
        foreach (var file in plan.Files)
        {
            if (options.DryRun)
            {
                log.Add($"  {(file.Overwrites ? "覆盖" : "新增")}  {file.RelativePath}");
                copied.Add(file.TargetPath);
                continue;
            }

            if (file.Overwrites && !plan.Manifest.Overwrite)
            {
                log.Add($"  跳过  {file.RelativePath}（已存在，且 install.overwrite = false）");
                continue;
            }

            try
            {
                FileSystemHelper.CopyFile(file.SourcePath, file.TargetPath, overwrite: true);
                log.Add($"  {(file.Overwrites ? "覆盖" : "新增")}  {file.RelativePath}");
                copied.Add(file.TargetPath);
            }
            catch (Exception e)
            {
                throw new InstallException($"复制失败：{file.SourcePath} → {file.TargetPath}\n{e.Message}");
            }
        }

        log.Add(string.Empty);
        log.Add("[2/3] 写入配置");

        if (!plan.Manifest.WriteSettings)
        {
            log.Add("  已按 installer.toml 的 install.settings = false 跳过配置写入。");
            return new InstallResult
            {
                Plan = plan,
                Log = log,
                CopiedFiles = copied,
                SettingsChanges = Array.Empty<KeyChange>(),
                DryRun = options.DryRun,
            };
        }

        var write = BuildSettingsWrite(plan);
        log.Add($"  配置文件：{plan.SettingsPath}" +
                (plan.SettingsFromUserProfile ? "（用户目录优先，与运行时行为一致）" : "（插件目录）"));

        if (write.Changes.Count == 0)
        {
            log.Add("  无需改动（插件配置已就绪）。");
        }
        else
        {
            foreach (var change in write.Changes)
            {
                log.Add($"  {change}");
            }
        }

        if (plan.Menu != null)
        {
            log.Add($"  {(plan.Menu.GroupCreated ? "新建" : "复用")}右键菜单分组「{plan.Menu.Title}」" +
                    $"，位于第 {plan.Menu.GroupIndex + 1} 组（共 {plan.Menu.FinalMenus.Count} 组）");
            log.Add($"  菜单基线来自：{plan.Menu.BaseSource}");
            foreach (var note in write.Notes)
            {
                log.Add($"  {note}");
            }
        }

        string? backupPath = null;
        if (!options.DryRun && write.Dirty)
        {
            try
            {
                TomlSettingsEditor.SaveText(plan.SettingsPath, EnsureTrailingNewline(write.Text), createBackup: true);
                backupPath = plan.SettingsPath + ".bak";
                if (File.Exists(backupPath))
                {
                    log.Add($"  原配置已备份到：{backupPath}");
                }
            }
            catch (Exception e)
            {
                throw new InstallException($"写入配置文件失败：{plan.SettingsPath}\n{e.Message}");
            }
        }

        log.Add(string.Empty);
        log.Add("[3/3] 完成");
        log.Add(options.DryRun
            ? "试运行结束：以上是将会发生的改动。"
            : "安装完成，请重启 Typora 让插件生效。");

        return new InstallResult
        {
            Plan = plan,
            Log = log,
            CopiedFiles = copied,
            SettingsChanges = write.Changes,
            DryRun = options.DryRun,
            SettingsBackupPath = backupPath,
        };
    }

    /// <summary>一步到位：规划 + 执行。</summary>
    public static InstallResult Install(InstallOptions options)
    {
        var plan = CreatePlan(options);
        return Execute(options, plan);
    }

    // ------------------------------------------------------------ settings text

    /// <summary>构造最终要写进 settings.user.toml 的文本。</summary>
    internal static SettingsWrite BuildSettingsWrite(InstallPlan plan)
    {
        var manifest = plan.Manifest;
        var text = File.Exists(plan.SettingsPath) ? File.ReadAllText(plan.SettingsPath) : string.Empty;
        var editor = new TomlSettingsEditor(text);

        var writable = manifest.SettingsOverwrite ? KeyWritePolicy.SetAlways : KeyWritePolicy.SetIfMissing;
        var pluginWrites = new List<KeyWrite>
        {
            new("ENABLE", true, KeyWritePolicy.SetIfDifferent),
            new("NAME", manifest.Name, KeyWritePolicy.SetIfMissingOrEmpty),
        };
        pluginWrites.AddRange(manifest.Settings.Select(kv => new KeyWrite(kv.Key, kv.Value, writable)));
        editor.Apply(manifest.Id, pluginWrites);

        if (plan.Menu != null)
        {
            // 保留兜底开关：任何"已加载但没被 MENUS 列出"的插件仍然会出现在菜单里，
            // 不会因为 MENUS 被整段覆盖而彻底消失。
            editor.Apply(MenuArrayCodec.Section, new[]
            {
                new KeyWrite("FIND_LOST_PLUGINS", true, KeyWritePolicy.SetIfDifferent),
            });
        }

        var result = editor.Text;
        var notes = new List<string>();
        var dirty = editor.IsDirty;

        if (plan.Menu != null)
        {
            result = MenuArrayCodec.Replace(result, plan.Menu.FinalMenus);

            // 自检：写盘前确认 MENUS 能原样回读，且没有留下第二种写法
            // （重复定义会让整个 settings 文件解析失败，进而把插件系统整个关掉）。
            if (!MenuArrayCodec.SameGroups(MenuArrayCodec.Extract(result), plan.Menu.FinalMenus))
            {
                throw new InstallException("生成的配置自检失败：MENUS 无法正确回读，已中止写入。");
            }
            if (MenuArrayCodec.HasInlineAssignment(result))
            {
                throw new InstallException("生成的配置自检失败：仍残留 `MENUS = [...]` 写法，已中止写入。");
            }

            dirty = true;
            notes.Add($"MENUS 整段写入（{plan.Menu.FinalMenus.Count} 组），数组是整体替换：安装后上游若调整默认菜单分组，不会自动生效。");
        }

        return new SettingsWrite(result, editor.Changes, dirty, notes);
    }

    private static string EnsureTrailingNewline(string text) =>
        text.Length == 0 || text.EndsWith('\n') ? text : text + "\n";

    // -------------------------------------------------------------- menu plan

    /// <summary>
    /// 读出目标目录当前"实际生效"的菜单分组，供 GUI 下拉框 / CLI <c>--list-groups</c> 使用。
    /// 显示名直接从目标的 <c>global/locales/*.json</c> 里读，所以和 Typora 里看到的一致。
    /// </summary>
    public static MenuGroupCatalog InspectMenus(string targetPluginDirectory)
    {
        var targetDir = Path.GetFullPath(targetPluginDirectory);
        var (baseMenus, baseSource) = ReadEffectiveMenus(targetDir);
        var locale = MenuTitles.Normalize(ResolveMenuLocale(targetDir, ResolveSettingsPath(targetDir).Path));
        var titles = MenuTitles.LoadSettingsTitles(targetDir, locale);

        var groups = baseMenus
            .Select(group => new MenuGroupInfo(
                group.Name,
                MenuTitles.DisplayTitle(group.Name, titles),
                group.List.Count,
                group.Name.StartsWith("__", StringComparison.Ordinal)))
            .ToList();

        return new MenuGroupCatalog(locale, MenuTitles.SuggestedGroupName(locale), groups, baseSource);
    }

    /// <summary>
    /// 按安装器选择（<see cref="MenuChoice"/>）计算最终的菜单落点。
    /// <para>插件清单只能说"要不要上菜单"，放哪儿完全由这里决定；分组名相同即视为同一个分组，
    /// 所以连着装几个插件只会有一个自定义分组。</para>
    /// </summary>
    private static MenuPlan PlanMenus(
        InstallManifest manifest,
        string targetDir,
        string settingsPath,
        MenuChoice? choice,
        List<string> warnings)
    {
        var (baseMenus, baseSource) = ReadEffectiveMenus(targetDir);
        var locale = MenuTitles.Normalize(ResolveMenuLocale(targetDir, settingsPath));

        // 默认行为：新建一个按目标语言命名的分组，放在最前。
        choice ??= MenuChoice.New(MenuTitles.SuggestedGroupName(locale), MenuGroupPosition.First);
        if (choice.Kind == MenuChoiceKind.None)
        {
            throw new InstallException("内部错误：MenuChoice.None 不应走到分组规划。");
        }

        // 目标分组（已有分组按 NAME 精确匹配；新建分组按标题匹配）
        var wanted = choice.GroupName?.Trim();
        if (string.IsNullOrEmpty(wanted))
        {
            wanted = MenuTitles.SuggestedGroupName(locale);
        }

        var groupIndex = -1;
        for (var i = 0; i < baseMenus.Count; i++)
        {
            var matches = choice.Kind == MenuChoiceKind.ExistingGroup
                ? string.Equals(baseMenus[i].Name, wanted, StringComparison.Ordinal)
                : string.Equals(baseMenus[i].Name, wanted, StringComparison.Ordinal);
            if (matches)
            {
                groupIndex = i;
                break;
            }
        }

        if (choice.Kind == MenuChoiceKind.ExistingGroup && groupIndex < 0)
        {
            var available = string.Join("\n", baseMenus.Select(g => "  - " + g.Name));
            throw new InstallException($"目标里没有名为 \"{wanted}\" 的菜单分组。当前可用：\n{available}");
        }

        var created = groupIndex < 0;
        var title = created ? wanted! : baseMenus[groupIndex].Name;

        // 先原样复刻所有分组，并把本插件从其它分组里摘掉，保证"一个插件只出现一次"。
        // 受管分组里的 `.call` 与分隔线都会被还原/重排：它们是写盘时按分组长度临时补的。
        var final = new List<MenuGroup>();
        var managedIndex = -1;
        for (var i = 0; i < baseMenus.Count; i++)
        {
            var isManagedGroup = i == groupIndex;
            var hadOurEntry = baseMenus[i].List.Any(entry => PluginPartOf(entry) == manifest.Id);
            var list = TidySeparators(baseMenus[i].List
                .Where(entry => PluginPartOf(entry) != manifest.Id)
                .Select(entry => isManagedGroup ? StripCallShorthand(entry) : entry)
                .ToList());

            // 上次是"只为这个插件建的分组"，这次挪到别处了 —— 别留下空壳，
            // 否则 FIND_LOST_PLUGINS 的兜底插件会莫名其妙落进这个空组。
            if (!isManagedGroup && list.Count == 0 && hadOurEntry && !IsBuiltinGroup(baseMenus[i].Name))
            {
                continue;
            }

            if (isManagedGroup)
            {
                managedIndex = final.Count;
            }
            final.Add(new MenuGroup(baseMenus[i].Name, list));
        }

        if (created)
        {
            var group = new MenuGroup(title, new[] { manifest.Id });
            if (choice.Position == MenuGroupPosition.Last)
            {
                final.Add(group);
                groupIndex = final.Count - 1;
            }
            else
            {
                final.Insert(0, group);
                groupIndex = 0;
            }
        }
        else
        {
            groupIndex = managedIndex;
            var list = final[groupIndex].List.ToList();
            list.Add(manifest.Id);
            final[groupIndex] = new MenuGroup(title, list);
        }

        // right_click_menu.js 里有两个坑，都不能碰，所以只能让分组"看起来像多条目分组"：
        //   1) LIST.length === 1 时一级菜单项直接指向 LIST[0]，但点击处理要求 `plugin.action`
        //      形式 —— 纯插件名会 return false，点了没反应；
        //   2) 写成 `plugin.action` 又能绕过 1)，却会在 _insertLevel2 里走到
        //      LiWithAction 的 `plugin.staticActions.find(...)`：没有 staticActions 的插件
        //      直接抛 TypeError，整份右键菜单都构建不出来（默认配置里没有这种条目，所以这条
        //      路径在插件系统里是没被验证过的）。
        // 补一条分隔线就能让 LIST.length 变成 2，走正常的多条目分支，两个坑都绕开；
        // 组里出现第二个插件时，分隔线会在下次安装时被清掉。
        // 对所有自定义分组（非 __XXX__ 形式）做同样处理：只要恰好只剩 1 个条目就补分隔线。
        // 不只是刚写进去的那个分组 —— 之前补过线的分组可能因为这次清理掉了线而重新变成单条目。
        for (var i = 0; i < final.Count; i++)
        {
            if (!IsBuiltinGroup(final[i].Name) && final[i].List.Count == 1)
            {
                final[i] = final[i] with { List = new[] { final[i].List[0], Separator } };
            }
        }

        warnings.Add(
            "右键菜单 MENUS 会整段写进 settings.user.toml：数组是整体替换，" +
            "安装后上游若调整默认菜单分组或新增内置插件，不会自动反映到这份配置里" +
            "（FIND_LOST_PLUGINS 会兜底保证这些插件仍然可见）。");

        return new MenuPlan(title, baseMenus, final, baseSource, groupIndex, created);
    }

    /// <summary>读出目标当前生效的 MENUS：用户配置优先，其次 settings.default.toml。</summary>
    private static (IReadOnlyList<MenuGroup> Menus, string Source) ReadEffectiveMenus(string targetDir)
    {
        var defaultsPath = Path.Combine(targetDir, DefaultSettingsRelativePath.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(defaultsPath))
        {
            throw new InstallException($"找不到 {defaultsPath}，无法读取默认右键菜单。");
        }

        var defaultMenus = MenuArrayCodec.Extract(File.ReadAllText(defaultsPath));
        if (defaultMenus.Count == 0)
        {
            throw new InstallException($"{defaultsPath} 里没有 [[right_click_menu.MENUS]] 数组表，无法选择菜单分组。");
        }

        IReadOnlyList<MenuGroup> baseMenus = defaultMenus;
        var baseSource = "settings.default.toml";

        // 优先级与运行时 settings.read() 一致：用户目录 > 插件目录 > 默认。
        foreach (var (path, label) in new[]
                 {
                     (OriginSettingsPath(targetDir), "插件目录的 settings.user.toml"),
                     (HomeSettingsPath(), "用户目录的 settings.user.toml"),
                 })
        {
            if (path == null || !File.Exists(path))
            {
                continue;
            }

            var text = File.ReadAllText(path);
            if (MenuArrayCodec.HasInlineAssignment(text))
            {
                throw new InstallException(
                    $"{label} 里用的是 `MENUS = [...]` 内联写法，安装器无法安全读取并保留它。\n" +
                    "请改成 [[right_click_menu.MENUS]] 数组表。");
            }

            var extracted = MenuArrayCodec.Extract(text);
            if (extracted.Count > 0)
            {
                baseMenus = extracted;
                baseSource = label;
            }
        }

        return (baseMenus, baseSource);
    }

    /// <summary>取合并后生效的 <c>[global] LOCALE</c>；<c>auto</c> 交给安装器自身的区域设置。</summary>
    private static string ResolveMenuLocale(string targetDir, string settingsPath)
    {
        var candidates = new[]
        {
            ReadIfExists(settingsPath),
            ReadIfExists(HomeSettingsPath()),
            ReadIfExists(Path.Combine(targetDir, DefaultSettingsRelativePath.Replace('/', Path.DirectorySeparatorChar))),
        };

        foreach (var text in candidates)
        {
            var value = text == null ? null : ReadGlobalLocale(text);
            if (value == null)
            {
                continue;
            }
            return value.Equals("auto", StringComparison.OrdinalIgnoreCase)
                ? CultureInfo.CurrentUICulture.Name
                : value;
        }

        return CultureInfo.CurrentUICulture.Name;
    }

    private static string? ReadGlobalLocale(string tomlText)
    {
        var inGlobal = false;
        foreach (var raw in tomlText.Split('\n'))
        {
            var line = TomlParser.StripComment(raw).Trim();
            if (line.StartsWith('['))
            {
                inGlobal = line == "[global]";
                continue;
            }
            if (!inGlobal)
            {
                continue;
            }

            var eq = line.IndexOf('=');
            if (eq <= 0 || line[..eq].Trim() != "LOCALE")
            {
                continue;
            }
            return line[(eq + 1)..].Trim().Trim('"', '\'');
        }
        return null;
    }

    private static string? ReadIfExists(string? path) =>
        path != null && File.Exists(path) ? File.ReadAllText(path) : null;

    private static string PluginPartOf(string entry)
    {
        if (string.IsNullOrEmpty(entry) || entry == Separator)
        {
            return string.Empty;
        }
        var dot = entry.IndexOf('.');
        return dot < 0 ? entry : entry[..dot];
    }

    /// <summary>插件系统自带的分组用 <c>__XXX__</c> 形式命名。</summary>
    private static bool IsBuiltinGroup(string name) => name.StartsWith("__", StringComparison.Ordinal);

    /// <summary>清掉早期版本写下的 <c>.call</c> 简写（那个写法会踩到框架的 LiWithAction 崩溃）。</summary>
    private static string StripCallShorthand(string entry) =>
        entry.EndsWith(".call", StringComparison.Ordinal) ? entry[..^".call".Length] : entry;

    /// <summary>去掉因移除条目而产生的首尾/连续分隔线。</summary>
    private static List<string> TidySeparators(IReadOnlyList<string> list)
    {
        var result = new List<string>();
        foreach (var item in list)
        {
            if (item == Separator && (result.Count == 0 || result[^1] == Separator))
            {
                continue;
            }
            result.Add(item);
        }
        while (result.Count > 0 && result[^1] == Separator)
        {
            result.RemoveAt(result.Count - 1);
        }
        return result;
    }

    // ----------------------------------------------------------------- helpers

    private static List<PlannedFile> CollectFiles(
        InstallManifest manifest,
        string manifestPath,
        string manifestDir,
        string contentDir,
        string targetDir,
        List<string> warnings)
    {
        var result = new List<PlannedFile>();
        var seenTargets = new HashSet<string>(PathComparison == StringComparison.OrdinalIgnoreCase
            ? StringComparer.OrdinalIgnoreCase
            : StringComparer.Ordinal);

        void Add(string sourceFile, string relative)
        {
            var target = Path.GetFullPath(Path.Combine(targetDir, relative));
            if (!FileSystemHelper.IsWithin(target, targetDir))
            {
                throw new InstallException($"映射到目标目录之外，已拒绝：{relative}");
            }

            if (!seenTargets.Add(target))
            {
                warnings.Add($"重复的安装条目被忽略：{relative}");
                return;
            }

            result.Add(new PlannedFile(sourceFile, target, relative.Replace('\\', '/'), File.Exists(target)));
        }

        if (manifest.Files.Count > 0)
        {
            foreach (var entry in manifest.Files)
            {
                if (entry.Length == 0)
                {
                    continue;
                }
                if (Path.IsPathRooted(entry))
                {
                    throw new InstallException($"install.files 不允许绝对路径：{entry}");
                }

                var full = Path.GetFullPath(Path.Combine(contentDir, entry));
                if (!FileSystemHelper.IsWithin(full, contentDir))
                {
                    throw new InstallException($"install.files 条目逃逸出核心目录：{entry}");
                }

                if (File.Exists(full))
                {
                    Add(full, Path.GetRelativePath(contentDir, full));
                }
                else if (Directory.Exists(full))
                {
                    foreach (var file in FileSystemHelper.EnumerateFiles(full))
                    {
                        Add(file, Path.GetRelativePath(contentDir, file));
                    }
                }
                else
                {
                    throw new InstallException($"install.files 条目不存在：{entry}（相对 {contentDir}）");
                }
            }
            return result;
        }

        var isPackageRoot = string.Equals(
            contentDir.TrimEnd(Path.DirectorySeparatorChar),
            manifestDir.TrimEnd(Path.DirectorySeparatorChar),
            PathComparison);

        foreach (var file in FileSystemHelper.EnumerateFiles(contentDir))
        {
            var relative = Path.GetRelativePath(contentDir, file);
            if (ShouldSkip(relative, file, manifestPath, isPackageRoot))
            {
                continue;
            }
            Add(file, relative);
        }

        if (result.Count == 0)
        {
            throw new InstallException($"插件包里没有可安装的文件：{contentDir}\n" +
                                       "请检查 install.source / install.files。");
        }

        return result;
    }

    /// <summary>整目录复制时的默认排除项（显式 install.files 不受影响）。</summary>
    private static bool ShouldSkip(string relative, string fullPath, string manifestPath, bool isPackageRoot)
    {
        if (string.Equals(Path.GetFullPath(fullPath), Path.GetFullPath(manifestPath), PathComparison))
        {
            return true;
        }

        var segments = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        foreach (var segment in segments)
        {
            if (segment.StartsWith('.'))
            {
                return true;
            }
            if (string.Equals(segment, "node_modules", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        // 只有"直接把包根当核心目录"时才顺带排除文档，避免把 README 装进 plugin/。
        if (isPackageRoot && segments.Length == 1)
        {
            var name = segments[0];
            if (name.EndsWith(".md", StringComparison.OrdinalIgnoreCase) ||
                name.StartsWith("README", StringComparison.OrdinalIgnoreCase) ||
                name.StartsWith("LICENSE", StringComparison.OrdinalIgnoreCase) ||
                name.StartsWith("CHANGELOG", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static bool LooksLikePluginDirectory(string targetDir) =>
        File.Exists(Path.Combine(targetDir, DefaultSettingsRelativePath.Replace('/', Path.DirectorySeparatorChar))) ||
        Directory.Exists(Path.Combine(targetDir, "global", "core")) ||
        File.Exists(Path.Combine(targetDir, "index.js"));

    private static string OriginSettingsPath(string targetDir) =>
        Path.Combine(targetDir, UserSettingsRelativePath.Replace('/', Path.DirectorySeparatorChar));

    private static string? HomeSettingsPath()
    {
        var home = HomeDirectoryProvider();
        return string.IsNullOrEmpty(home)
            ? null
            : Path.Combine(home, ".config", "typora_plugin", "settings.user.toml");
    }

    /// <summary>
    /// 复刻运行时的 <c>utils.settings.getUserTomlPath()</c>：
    /// <c>~/.config/typora_plugin/settings.user.toml</c> 存在就用它，否则用插件目录里那份。
    /// </summary>
    private static (string Path, bool FromProfile) ResolveSettingsPath(string targetDir)
    {
        var home = HomeSettingsPath();
        if (home != null && File.Exists(home))
        {
            return (home, true);
        }

        return (OriginSettingsPath(targetDir), false);
    }

    private static void CheckMenuClickability(
        InstallManifest manifest,
        string entryJs,
        string entryIndex,
        IReadOnlyList<PlannedFile> files,
        List<string> warnings)
    {
        var candidate = File.Exists(entryJs)
            ? entryJs
            : File.Exists(entryIndex)
                ? entryIndex
                : files.FirstOrDefault(f =>
                    string.Equals(f.TargetPath, entryJs, PathComparison) ||
                    string.Equals(f.TargetPath, entryIndex, PathComparison))?.SourcePath;

        if (candidate == null || !File.Exists(candidate))
        {
            return;
        }

        string content;
        try
        {
            content = File.ReadAllText(candidate);
        }
        catch
        {
            return;
        }

        if (!ActionDefinitionPattern.IsMatch(content))
        {
            warnings.Add(
                $"在 {Path.GetFileName(candidate)} 里没有检测到 call / staticActions / getDynamicActions 定义。" +
                "按 right_click_menu 的实现，菜单项会被置灰且无法点击（pointer-events: none）。");
        }
    }

    /// <summary>把结果渲染成纯文本（CLI 与 GUI 共用）。</summary>
    public static string Render(InstallResult result)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(Environment.NewLine, result.Log));
        if (result.Plan.Warnings.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("提示 / 警告：");
            foreach (var warning in result.Plan.Warnings)
            {
                sb.AppendLine($"  - {warning}");
            }
        }
        return sb.ToString().TrimEnd();
    }
}

/// <summary>最终写入内容 + 改动清单。</summary>
internal sealed record SettingsWrite(string Text, IReadOnlyList<KeyChange> Changes, bool Dirty, IReadOnlyList<string> Notes);
